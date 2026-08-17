/**
 * Optimize static pylon / reward-camp GLBs under public/models/trinket/pylons/.
 *
 * Same payload-preserving pipeline as optimize-environ-models.mjs
 * (dedup / weld / WebP texture compress / prune). Does NOT strip meshes.
 *
 * Usage:
 *   node scripts/optimize-pylon-models.mjs
 *   node scripts/optimize-pylon-models.mjs --dry-run
 *   node scripts/optimize-pylon-models.mjs goldProp.glb blueProp.glb
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { formatBytes } from './model-asset-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const pylonsDir = path.join(root, 'public', 'models', 'trinket', 'pylons');
const dryRun = process.argv.includes('--dry-run');

/** Reward-camp props used by explore mode (plus any extra names passed on the CLI). */
const DEFAULT_PROP_FILES = [
  'goldProp.glb',
  'statProp.glb',
  'blueProp.glb',
  'greenProp.glb',
  'redProp.glb',
  'purpleProp.glb',
  'bossProp.glb',
];

const namesFilter = process.argv
  .slice(2)
  .filter((arg) => arg !== '--dry-run')
  .map((name) => (name.endsWith('.glb') ? name : `${name}.glb`));

const io = new NodeIO()
  .setLogger(new Logger(Verbosity.ERROR))
  .registerExtensions(ALL_EXTENSIONS);

function listPylonGlbs() {
  const all = readdirSync(pylonsDir)
    .filter((name) => name.endsWith('.glb'))
    .sort();
  if (namesFilter.length > 0) {
    const wanted = new Set(namesFilter);
    return all.filter((name) => wanted.has(name));
  }
  const wanted = new Set(DEFAULT_PROP_FILES);
  return all.filter((name) => wanted.has(name));
}

function collectStats(document) {
  const docRoot = document.getRoot();
  return {
    meshes: docRoot.listMeshes().length,
    materials: docRoot.listMaterials().length,
    textures: docRoot.listTextures().length,
    animations: docRoot.listAnimations().length,
  };
}

async function optimizeFile(fileName) {
  const filePath = path.join(pylonsDir, fileName);
  const beforeBytes = statSync(filePath).size;
  const document = await io.read(filePath);
  const before = collectStats(document);
  const docRoot = document.getRoot();

  const transforms = [
    dedup({ keepUniqueNames: true }),
    weld(),
  ];
  if (docRoot.listTextures().length > 0) {
    transforms.push(
      textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [1024, 1024],
        quality: 82,
      }),
    );
  }
  transforms.push(
    prune({
      keepLeaves: true,
      keepAttributes: true,
      keepExtras: true,
    }),
  );

  await document.transform(...transforms);

  const after = collectStats(document);
  let afterBytes;
  if (dryRun) {
    const binary = await io.writeBinary(document);
    afterBytes = binary.byteLength;
  } else {
    await io.write(filePath, document);
    afterBytes = statSync(filePath).size;
  }

  return {
    fileName,
    beforeBytes,
    afterBytes,
    savedBytes: beforeBytes - afterBytes,
    savedPct: beforeBytes > 0 ? ((beforeBytes - afterBytes) / beforeBytes) * 100 : 0,
    before,
    after,
  };
}

if (dryRun) {
  console.log('Dry run — no files will be written\n');
}

const files = listPylonGlbs();
if (files.length === 0) {
  console.error(`No matching GLB files found in ${pylonsDir}`);
  process.exit(1);
}

const results = [];
for (const fileName of files) {
  const result = await optimizeFile(fileName);
  results.push(result);
  console.log(
    [
      result.fileName.padEnd(16),
      `${formatBytes(result.beforeBytes)} -> ${formatBytes(result.afterBytes)}`.padEnd(25),
      `saved ${formatBytes(result.savedBytes)} (${result.savedPct.toFixed(1)}%)`,
      `mesh ${result.before.meshes}->${result.after.meshes}`,
      `mat ${result.before.materials}->${result.after.materials}`,
      `tex ${result.before.textures}->${result.after.textures}`,
      `anim ${result.before.animations}->${result.after.animations}`,
    ].join('  '),
  );
}

const beforeTotal = results.reduce((sum, result) => sum + result.beforeBytes, 0);
const afterTotal = results.reduce((sum, result) => sum + result.afterBytes, 0);
const savedTotal = beforeTotal - afterTotal;
console.log(dryRun ? '\nSummary (dry run)' : '\nSummary');
console.log(`Files: ${results.length}`);
console.log(`Before: ${formatBytes(beforeTotal)}`);
console.log(`After: ${formatBytes(afterTotal)}`);
console.log(`Saved: ${formatBytes(savedTotal)} (${((savedTotal / beforeTotal) * 100).toFixed(1)}%)`);
