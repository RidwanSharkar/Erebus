import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';

const root = process.cwd();
const modelsDir = path.join(root, 'public', 'models');

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

const io = new NodeIO()
  .setLogger(new Logger(Verbosity.ERROR))
  .registerExtensions(ALL_EXTENSIONS);

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

function stripRenderablePayload(document) {
  const root = document.getRoot();
  for (const node of document.getRoot().listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
    node.setCamera(null);
  }
  for (const mesh of root.listMeshes()) mesh.dispose();
  for (const skin of root.listSkins()) skin.dispose();
  for (const material of root.listMaterials()) material.dispose();
  for (const texture of root.listTextures()) texture.dispose();
  for (const camera of root.listCameras()) camera.dispose();
}

function collectStats(document) {
  const root = document.getRoot();
  const animations = root.listAnimations();
  const animationChannels = animations.reduce(
    (sum, animation) => sum + animation.listChannels().length,
    0,
  );
  return {
    animations: animations.length,
    animationChannels,
    nodes: root.listNodes().length,
    meshes: root.listMeshes().length,
    materials: root.listMaterials().length,
    textures: root.listTextures().length,
    accessors: root.listAccessors().length,
  };
}

async function optimizeFile(filePath) {
  const filename = path.basename(filePath);
  const beforeBytes = (await stat(filePath)).size;
  const document = await io.read(filePath);
  const before = collectStats(document);
  const isBaseScene = BASE_SCENE_FILES.has(filename);

  if (!isBaseScene) {
    stripRenderablePayload(document);
  }

  await document.transform(
    dedup({ keepUniqueNames: true }),
    resample(),
    prune({
      keepLeaves: true,
      keepAttributes: true,
      keepExtras: true,
    }),
  );

  await io.write(filePath, document);

  const afterBytes = (await stat(filePath)).size;
  const after = collectStats(document);
  const savedBytes = beforeBytes - afterBytes;
  const savedPct = beforeBytes > 0 ? (savedBytes / beforeBytes) * 100 : 0;

  return {
    filename,
    isBaseScene,
    beforeBytes,
    afterBytes,
    savedBytes,
    savedPct,
    before,
    after,
  };
}

const files = await listGlbs(modelsDir);
const results = [];

for (const filePath of files) {
  const result = await optimizeFile(filePath);
  results.push(result);

  const mode = result.isBaseScene ? 'scene' : 'animation';
  console.log(
    [
      result.filename.padEnd(32),
      mode.padEnd(9),
      `${formatBytes(result.beforeBytes)} -> ${formatBytes(result.afterBytes)}`.padEnd(25),
      `saved ${formatBytes(result.savedBytes)} (${result.savedPct.toFixed(1)}%)`,
      `mesh ${result.before.meshes}->${result.after.meshes}`,
      `anim ${result.before.animations}->${result.after.animations}`,
      `channels ${result.before.animationChannels}->${result.after.animationChannels}`,
    ].join('  '),
  );
}

const beforeTotal = results.reduce((sum, result) => sum + result.beforeBytes, 0);
const afterTotal = results.reduce((sum, result) => sum + result.afterBytes, 0);
const savedTotal = beforeTotal - afterTotal;

console.log('\nSummary');
console.log(`Files: ${results.length}`);
console.log(`Before: ${formatBytes(beforeTotal)}`);
console.log(`After: ${formatBytes(afterTotal)}`);
console.log(`Saved: ${formatBytes(savedTotal)} (${((savedTotal / beforeTotal) * 100).toFixed(1)}%)`);
