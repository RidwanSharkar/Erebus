import { stat } from 'node:fs/promises';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample } from '@gltf-transform/functions';
import {
  formatBytes,
  isBaseScene,
  listAllModelGlbs,
  toModelsRelativePath,
} from './model-asset-config.mjs';

const root = process.cwd();
const modelsDir = path.join(root, 'public', 'models');
const dryRun = process.argv.includes('--dry-run');

const io = new NodeIO()
  .setLogger(new Logger(Verbosity.ERROR))
  .registerExtensions(ALL_EXTENSIONS);

function stripRenderablePayload(document) {
  const rootNode = document.getRoot();
  for (const node of document.getRoot().listNodes()) {
    node.setMesh(null);
    node.setSkin(null);
    node.setCamera(null);
  }
  for (const mesh of rootNode.listMeshes()) mesh.dispose();
  for (const skin of rootNode.listSkins()) skin.dispose();
  for (const material of rootNode.listMaterials()) material.dispose();
  for (const texture of rootNode.listTextures()) texture.dispose();
  for (const camera of rootNode.listCameras()) camera.dispose();
}

function collectStats(document) {
  const docRoot = document.getRoot();
  const animations = docRoot.listAnimations();
  const animationChannels = animations.reduce(
    (sum, animation) => sum + animation.listChannels().length,
    0,
  );
  return {
    animations: animations.length,
    animationChannels,
    nodes: docRoot.listNodes().length,
    meshes: docRoot.listMeshes().length,
    materials: docRoot.listMaterials().length,
    textures: docRoot.listTextures().length,
    accessors: docRoot.listAccessors().length,
  };
}

async function optimizeFile(filePath) {
  const relPath = toModelsRelativePath(modelsDir, filePath);
  const beforeBytes = (await stat(filePath)).size;
  const document = await io.read(filePath);
  const before = collectStats(document);
  const baseScene = isBaseScene(modelsDir, filePath);

  if (!baseScene) {
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

  let afterBytes;
  if (dryRun) {
    const binary = await io.writeBinary(document);
    afterBytes = binary.byteLength;
  } else {
    await io.write(filePath, document);
    afterBytes = (await stat(filePath)).size;
  }

  const after = collectStats(document);
  const savedBytes = beforeBytes - afterBytes;
  const savedPct = beforeBytes > 0 ? (savedBytes / beforeBytes) * 100 : 0;

  return {
    relPath,
    isBaseScene: baseScene,
    beforeBytes,
    afterBytes,
    savedBytes,
    savedPct,
    before,
    after,
  };
}

if (dryRun) {
  console.log('Dry run — no files will be written\n');
}

const files = await listAllModelGlbs(modelsDir);
const results = [];

for (const filePath of files) {
  const result = await optimizeFile(filePath);
  results.push(result);

  const mode = result.isBaseScene ? 'scene' : 'animation';
  console.log(
    [
      result.relPath.padEnd(42),
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

// Per-folder summary for dry-run / reporting
const byFolder = new Map();
for (const result of results) {
  const folder = result.relPath.includes('/')
    ? result.relPath.slice(0, result.relPath.indexOf('/'))
    : '(root)';
  const entry = byFolder.get(folder) ?? { before: 0, after: 0, files: 0 };
  entry.before += result.beforeBytes;
  entry.after += result.afterBytes;
  entry.files += 1;
  byFolder.set(folder, entry);
}

console.log('\nPer-folder');
for (const [folder, entry] of [...byFolder.entries()].sort((a, b) => b.before - a.before)) {
  const saved = entry.before - entry.after;
  const pct = entry.before > 0 ? (saved / entry.before) * 100 : 0;
  console.log(
    [
      folder.padEnd(16),
      `${entry.files} files`.padEnd(10),
      `${formatBytes(entry.before)} -> ${formatBytes(entry.after)}`.padEnd(25),
      `saved ${formatBytes(saved)} (${pct.toFixed(1)}%)`,
    ].join('  '),
  );
}

console.log(dryRun ? '\nSummary (dry run)' : '\nSummary');
console.log(`Files: ${results.length}`);
console.log(`Before: ${formatBytes(beforeTotal)}`);
console.log(`After: ${formatBytes(afterTotal)}`);
console.log(`Saved: ${formatBytes(savedTotal)} (${((savedTotal / beforeTotal) * 100).toFixed(1)}%)`);
