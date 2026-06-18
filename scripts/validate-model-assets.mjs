import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const modelsDir = path.join(root, 'public', 'models');
const io = new NodeIO()
  .setLogger(new Logger(Verbosity.ERROR))
  .registerExtensions(ALL_EXTENSIONS);
const threeLoader = new GLTFLoader();

globalThis.self ??= globalThis;

const BASE_SCENE_FILES = new Set([
  'boss_idle.glb',
  'character_idle.glb',
  'ghoul_idle.glb',
  'knight_idle.glb',
  'martyr_idle.glb',
  'shade_idle.glb',
  'templar_idle.glb',
  'titan_walk.glb',
  'viper_idle.glb',
  'warlock_idle.glb',
  'weaver_idle.glb',
  'zombie_idle.glb',
]);

function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

async function listGlbs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.glb'))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function animationDuration(animation) {
  let duration = 0;
  for (const sampler of animation.listSamplers()) {
    const input = sampler.getInput();
    if (!input) continue;
    const values = input.getArray();
    if (!values || values.length === 0) continue;
    duration = Math.max(duration, values[values.length - 1]);
  }
  return duration;
}

function collectDocumentStats(document) {
  const root = document.getRoot();
  const animations = root.listAnimations();
  return {
    animations: animations.length,
    channels: animations.reduce((sum, animation) => sum + animation.listChannels().length, 0),
    durations: animations.map(animationDuration),
    meshes: root.listMeshes().length,
  };
}

async function readOriginalDocument(relativePath) {
  const { stdout } = await execFileAsync('git', ['show', `HEAD:${relativePath}`], {
    cwd: root,
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    bytes: stdout.length,
    document: await io.readBinary(new Uint8Array(stdout)),
  };
}

async function parseWithThree(filePath) {
  const buffer = await readFile(filePath);
  return new Promise((resolve, reject) => {
    threeLoader.parse(
      buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
      '',
      resolve,
      reject,
    );
  });
}

function countThreeMeshes(scene) {
  let count = 0;
  scene.traverse((node) => {
    if (node.isMesh || node.isSkinnedMesh) count += 1;
  });
  return count;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

function assertDurationClose(actual, expected, message) {
  if (Math.abs(actual - expected) > 0.0001) {
    throw new Error(`${message}: expected ${expected}, received ${actual}`);
  }
}

const files = await listGlbs(modelsDir);
let beforeTotal = 0;
let afterTotal = 0;

for (const filePath of files) {
  const filename = path.basename(filePath);
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, '/');
  const isBaseScene = BASE_SCENE_FILES.has(filename);

  const original = await readOriginalDocument(relativePath);
  const optimizedDocument = await io.read(filePath);
  const originalStats = collectDocumentStats(original.document);
  const optimizedStats = collectDocumentStats(optimizedDocument);
  const afterBytes = (await stat(filePath)).size;
  const originalBytes = original.bytes;

  beforeTotal += originalBytes;
  afterTotal += afterBytes;

  assertEqual(optimizedStats.animations, originalStats.animations, `${filename} animation count`);
  assertEqual(optimizedStats.channels, originalStats.channels, `${filename} animation channel count`);
  optimizedStats.durations.forEach((duration, index) => {
    assertDurationClose(duration, originalStats.durations[index], `${filename} animation ${index} duration`);
  });

  if (isBaseScene) {
    if (optimizedStats.meshes <= 0) throw new Error(`${filename} should retain renderable scene meshes`);
  } else {
    const threeGltf = await parseWithThree(filePath);
    const threeMeshCount = countThreeMeshes(threeGltf.scene);
    assertEqual(threeGltf.animations.length, originalStats.animations, `${filename} Three.js animation count`);
    assertEqual(threeMeshCount, 0, `${filename} renderable mesh count`);
  }

  console.log(
    [
      filename.padEnd(32),
      (isBaseScene ? 'scene' : 'animation').padEnd(9),
      `${formatBytes(originalBytes)} -> ${formatBytes(afterBytes)}`.padEnd(25),
      `anim ${optimizedStats.animations}`,
      `channels ${optimizedStats.channels}`,
      `duration ${optimizedStats.durations.map((duration) => duration.toFixed(3)).join(',')}`,
    ].join('  '),
  );
}

const saved = beforeTotal - afterTotal;
console.log('\nValidation passed');
console.log(`Files: ${files.length}`);
console.log(`Before: ${formatBytes(beforeTotal)}`);
console.log(`After: ${formatBytes(afterTotal)}`);
console.log(`Saved: ${formatBytes(saved)} (${((saved / beforeTotal) * 100).toFixed(1)}%)`);
