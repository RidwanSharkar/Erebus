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
  'ally_idle.glb',
  'boss_idle.glb',
  'character_idle.glb',
  'ghoul_idle.glb',
  'knight_idle.glb',
  'martyr_idle.glb',
  'nemesis_idle.glb',
  'sentinel_idle.glb',
  'shade_idle.glb',
  'spectre_idle.glb',
  'templar_idle.glb',
  'titan_walk.glb',
  'valkyrie_idle.glb',
  'viper_idle.glb',
  'warlock_idle.glb',
  'weaver_idle.glb',
  'wraith_idle.glb',
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

async function readOriginalDocument(relativePath, filePath) {
  try {
    const { stdout } = await execFileAsync('git', ['show', `HEAD:${relativePath}`], {
      cwd: root,
      encoding: 'buffer',
      maxBuffer: 64 * 1024 * 1024,
    });
    return {
      bytes: stdout.length,
      document: await io.readBinary(new Uint8Array(stdout)),
    };
  } catch {
    // New assets not yet in git HEAD — use on-disk file as baseline.
    const buffer = await readFile(filePath);
    return {
      bytes: buffer.length,
      document: await io.readBinary(new Uint8Array(buffer)),
    };
  }
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

function assertKnightAnimationClip(filename, threeGltf) {
  if (!filename.startsWith('knight_') || filename === 'knight_idle.glb') return;

  const clip = threeGltf.animations[0];
  if (!clip) {
    throw new Error(`${filename} should contain a knight animation clip`);
  }

  const trackCount = clip.tracks.length;
  if (trackCount !== 156) {
    throw new Error(`${filename} knight animation track count: expected 156, received ${trackCount}`);
  }

  assertAssimpMixamoAnimationClip(filename, clip);
}

/** FBXLoader duplicate-chain artifacts — idle/anim track on mixamorigLeftLeg_2 etc. */
function hasFbxLoaderSuffixArtifacts(tracks) {
  return tracks.some((track) => /^mixamorig\w+_[23]\.(quaternion|position|scale)$/.test(track.name));
}

function hasAssimpRotationHelpers(tracks) {
  return tracks.some((track) => track.name.includes('$AssimpFbx$_Rotation'));
}

function hasAssimpLegTrack(tracks) {
  return tracks.some((track) => track.name.startsWith('mixamorigLeftUpLeg_$AssimpFbx$_Rotation.'));
}

function assertAssimpMixamoAnimationClip(filename, clip) {
  if (!clip?.tracks?.length) {
    throw new Error(`${filename} should contain an animation clip`);
  }

  const tracks = clip.tracks;
  if (hasFbxLoaderSuffixArtifacts(tracks)) {
    throw new Error(`${filename} has FBXLoader _2/_3 bone suffix tracks — reconvert via Assimp pipeline`);
  }

  if (!hasAssimpRotationHelpers(tracks)) {
    // Wraith uses a flat Mixamo skeleton without Assimp helpers — validated separately.
    if (filename.startsWith('wraith_')) return;
    throw new Error(`${filename} animation should target Assimp rotation helper bones`);
  }

  if (!hasAssimpLegTrack(tracks)) {
    throw new Error(`${filename} animation should drive mixamorigLeftUpLeg_$AssimpFbx$_Rotation`);
  }
}

function idlePrefixFromFilename(filename) {
  const match = filename.match(/^(.+?)_(?:idle|walk|run|sprint|attack|attack2|melee|melee2|death|cast|holdCast|throwUp|spin|smite|aggro|impact|launch|block|startblock|idleblock|castheal|castsummon|summon|fastwalk)\.glb$/);
  return match?.[1] ?? null;
}

function collectTrackNames(threeGltf) {
  const clip = threeGltf.animations[0];
  if (!clip) return new Set();
  return new Set(clip.tracks.map((track) => track.name));
}

async function loadThreeGltf(filePath) {
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

const idleTrackCache = new Map();

async function getIdleTrackNames(prefix) {
  if (idleTrackCache.has(prefix)) return idleTrackCache.get(prefix);
  const idlePath = path.join(modelsDir, `${prefix}_idle.glb`);
  try {
    const idleGltf = await loadThreeGltf(idlePath);
    const names = collectTrackNames(idleGltf);
    idleTrackCache.set(prefix, names);
    return names;
  } catch {
    return null;
  }
}

async function assertAnimationCompatibleWithIdle(filename, threeGltf) {
  const prefix = idlePrefixFromFilename(filename);
  if (!prefix) return;

  const idleTracks = await getIdleTrackNames(prefix);
  if (!idleTracks?.size) return;

  const animTracks = collectTrackNames(threeGltf);
  const missing = [...idleTracks].filter((name) => !animTracks.has(name));
  if (missing.length > 0) {
    throw new Error(
      `${filename} missing ${missing.length} idle track(s) — e.g. ${missing.slice(0, 3).join(', ')}`,
    );
  }
}

function assertIdleSceneAnimationClip(filename, threeGltf) {
  const clip = threeGltf.animations[0];
  if (!clip) return;

  if (filename.startsWith('wraith_')) return;

  assertAssimpMixamoAnimationClip(filename, clip);
}

const files = await listGlbs(modelsDir);
let beforeTotal = 0;
let afterTotal = 0;

for (const filePath of files) {
  const filename = path.basename(filePath);
  const relativePath = path.relative(root, filePath).replaceAll(path.sep, '/');
  const isBaseScene = BASE_SCENE_FILES.has(filename);

  const original = await readOriginalDocument(relativePath, filePath);
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
    const threeGltf = await parseWithThree(filePath);
    assertIdleSceneAnimationClip(filename, threeGltf);
  } else {
    const threeGltf = await parseWithThree(filePath);
    const threeMeshCount = countThreeMeshes(threeGltf.scene);
    assertEqual(threeGltf.animations.length, originalStats.animations, `${filename} Three.js animation count`);
    assertEqual(threeMeshCount, 0, `${filename} renderable mesh count`);
    assertKnightAnimationClip(filename, threeGltf);
    if (!filename.startsWith('wraith_')) {
      assertAssimpMixamoAnimationClip(filename, threeGltf.animations[0]);
      await assertAnimationCompatibleWithIdle(filename, threeGltf);
    }
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
