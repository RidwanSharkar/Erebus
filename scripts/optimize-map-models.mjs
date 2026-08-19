/**
 * Optimize static map GLBs under public/models/maps/.
 *
 * Same payload-preserving pipeline as optimize-environ-models (dedup / weld /
 * flatten+join / WebP / prune). Does NOT strip meshes. Textures already ≤256
 * so resize [1024, 1024] is a no-op cap.
 *
 * `join({ keepNamed: true })` keeps WMO room nodes (DragonEntrance / RallyArea /
 * Lair, etc.) from merging into world-spanning per-material meshes that defeat
 * frustum culling. Re-run on an *unjoined* source GLB; already-joined files
 * cannot recover room splits.
 *
 * Usage:
 *   node scripts/optimize-map-models.mjs
 *   node scripts/optimize-map-models.mjs --dry-run
 *   node scripts/optimize-map-models.mjs orgrimmararena.glb
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, flatten, join, prune, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';
import { formatBytes } from './model-asset-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const mapsDir = path.join(root, 'public', 'models', 'maps');
const dryRun = process.argv.includes('--dry-run');
const namesFilter = process.argv
  .slice(2)
  .filter((arg) => arg !== '--dry-run')
  .map((name) => (name.endsWith('.glb') ? name : `${name}.glb`));

const io = new NodeIO()
  .setLogger(new Logger(Verbosity.ERROR))
  .registerExtensions(ALL_EXTENSIONS);

function listMapGlbs() {
  const all = readdirSync(mapsDir)
    .filter((name) => name.endsWith('.glb'))
    .sort();
  if (namesFilter.length === 0) return all;
  const wanted = new Set(namesFilter);
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
  const filePath = path.join(mapsDir, fileName);
  const beforeBytes = statSync(filePath).size;
  const document = await io.read(filePath);
  const before = collectStats(document);
  const docRoot = document.getRoot();

  const transforms = [
    flatten({ cleanup: false }),
    join({ cleanup: false, keepNamed: true, keepMeshes: false }),
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

const files = listMapGlbs();
if (files.length === 0) {
  console.error(`No GLB files found in ${mapsDir}`);
  process.exit(1);
}

const results = [];
for (const fileName of files) {
  const result = await optimizeFile(fileName);
  results.push(result);
  console.log(
    [
      result.fileName.padEnd(24),
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
