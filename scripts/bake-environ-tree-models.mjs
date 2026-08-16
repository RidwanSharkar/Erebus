/**
 * Bake skinned WoW-export tree GLBs into static, ground-aligned meshes.
 *
 * Drops animation/skin, strips joint weights, flattens + joins by material,
 * translates so bbox minY = 0, then WebP-compresses textures.
 *
 * Usage:
 *   node scripts/bake-environ-tree-models.mjs
 *   node scripts/bake-environ-tree-models.mjs --dry-run
 *   node scripts/bake-environ-tree-models.mjs deadtree.glb snowtree.glb
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  compactPrimitive,
  dedup,
  flatten,
  getBounds,
  getGLPrimitiveCount,
  getMeshVertexCount,
  join,
  prune,
  textureCompress,
  transformMesh,
  VertexCountMethod,
  weld,
} from '@gltf-transform/functions';
import sharp from 'sharp';
import { formatBytes } from './model-asset-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const environDir = path.join(root, 'public', 'models', 'environ');
const dryRun = process.argv.includes('--dry-run');
const namesFilter = process.argv
  .slice(2)
  .filter((arg) => arg !== '--dry-run')
  .map((name) => (name.endsWith('.glb') ? name : `${name}.glb`));

const DEFAULT_TREES = ['deadtree.glb', 'browntree.glb', 'redtree.glb'];
const STRIP_SEMANTICS = new Set(['JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_1']);
const MIN_BBOX_EXTENT = 0.05;

const io = new NodeIO()
  .setLogger(new Logger(Verbosity.ERROR))
  .registerExtensions(ALL_EXTENSIONS);

function collectStats(document) {
  const docRoot = document.getRoot();
  let primitives = 0;
  let triangles = 0;
  let verts = 0;
  for (const mesh of docRoot.listMeshes()) {
    primitives += mesh.listPrimitives().length;
    verts += getMeshVertexCount(mesh, VertexCountMethod.UPLOAD);
    for (const prim of mesh.listPrimitives()) {
      triangles += getGLPrimitiveCount(prim);
    }
  }
  return {
    meshes: docRoot.listMeshes().length,
    primitives,
    triangles,
    verts,
    materials: docRoot.listMaterials().length,
    textures: docRoot.listTextures().length,
    animations: docRoot.listAnimations().length,
    skins: docRoot.listSkins().length,
    nodes: docRoot.listNodes().length,
  };
}

function dropAnimationAndSkin(document) {
  for (const animation of document.getRoot().listAnimations()) {
    animation.dispose();
  }
  for (const node of document.getRoot().listNodes()) {
    node.setSkin(null);
  }
  for (const skin of document.getRoot().listSkins()) {
    skin.dispose();
  }
}

function stripDeadAttributes(document) {
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of prim.listSemantics()) {
        if (STRIP_SEMANTICS.has(semantic) || semantic.startsWith('JOINTS_') || semantic.startsWith('WEIGHTS_')) {
          prim.setAttribute(semantic, null);
        }
      }
      compactPrimitive(prim);
    }
  }
}

function mat4Translate(tx, ty, tz) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
}

function disposeMeshlessNodes(document) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of document.getRoot().listNodes()) {
      if (node.getMesh() || node.getCamera() || node.listChildren().length > 0) continue;
      node.dispose();
      changed = true;
    }
  }
}

function groundAlign(document) {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (!scene) {
    throw new Error('GLB has no scene');
  }
  const { min, max } = getBounds(scene);
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const extent = Math.max(size[0], size[1], size[2]);
  if (!(extent > MIN_BBOX_EXTENT)) {
    throw new Error(`Bind pose looks degenerate (bbox extent ${extent.toFixed(4)}).`);
  }
  const matrix = mat4Translate(0, -min[1], 0);
  for (const mesh of document.getRoot().listMeshes()) {
    transformMesh(mesh, matrix);
  }
  return { min, max, size, extent, liftY: -min[1] };
}

async function bakeFile(fileName) {
  const filePath = path.join(environDir, fileName);
  const beforeBytes = statSync(filePath).size;
  const document = await io.read(filePath);
  const before = collectStats(document);

  dropAnimationAndSkin(document);
  stripDeadAttributes(document);
  const xform = groundAlign(document);

  await document.transform(
    flatten({ cleanup: false }),
    join({ cleanup: false, keepNamed: false, keepMeshes: false }),
  );
  disposeMeshlessNodes(document);
  await document.transform(
    dedup({ keepUniqueNames: true }),
    weld(),
    prune({
      keepLeaves: false,
      keepAttributes: false,
      keepExtras: false,
    }),
  );

  const docRoot = document.getRoot();
  if (docRoot.listTextures().length > 0) {
    await document.transform(
      textureCompress({
        encoder: sharp,
        targetFormat: 'webp',
        resize: [1024, 1024],
        quality: 82,
      }),
    );
  }

  const after = collectStats(document);
  const scene = docRoot.getDefaultScene() ?? docRoot.listScenes()[0];
  const afterBounds = scene ? getBounds(scene) : null;

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
    before,
    after,
    xform,
    afterBounds,
  };
}

const files = namesFilter.length > 0 ? namesFilter : DEFAULT_TREES;

if (dryRun) {
  console.log('Dry run — no files will be written\n');
}

const results = [];
for (const fileName of files) {
  const result = await bakeFile(fileName);
  results.push(result);
  console.log(`${result.fileName}`);
  console.log(
    `  size  ${formatBytes(result.beforeBytes)} -> ${formatBytes(result.afterBytes)}  ` +
      `saved ${formatBytes(result.beforeBytes - result.afterBytes)} ` +
      `(${(((result.beforeBytes - result.afterBytes) / result.beforeBytes) * 100).toFixed(1)}%)`,
  );
  console.log(
    `  mesh ${result.before.meshes}->${result.after.meshes}` +
      `  prim ${result.before.primitives}->${result.after.primitives}` +
      `  tris ${result.before.triangles}->${result.after.triangles}` +
      `  verts ${result.before.verts}->${result.after.verts}`,
  );
  console.log(
    `  mat ${result.before.materials}->${result.after.materials}` +
      `  tex ${result.before.textures}->${result.after.textures}` +
      `  anim ${result.before.animations}->${result.after.animations}` +
      `  skin ${result.before.skins}->${result.after.skins}` +
      `  nodes ${result.before.nodes}->${result.after.nodes}`,
  );
  console.log(
    `  bind bbox [${result.xform.min.map((n) => n.toFixed(2)).join(', ')}] .. ` +
      `[${result.xform.max.map((n) => n.toFixed(2)).join(', ')}]  ` +
      `liftY ${result.xform.liftY.toFixed(3)} height ${result.xform.size[1].toFixed(2)}`,
  );
  if (result.afterBounds) {
    console.log(
      `  out  bbox [${result.afterBounds.min.map((n) => n.toFixed(3)).join(', ')}] .. ` +
        `[${result.afterBounds.max.map((n) => n.toFixed(3)).join(', ')}]`,
    );
  }
}

const beforeTotal = results.reduce((sum, result) => sum + result.beforeBytes, 0);
const afterTotal = results.reduce((sum, result) => sum + result.afterBytes, 0);
console.log(dryRun ? '\nSummary (dry run)' : '\nSummary');
console.log(`Files: ${results.length}`);
console.log(`Before: ${formatBytes(beforeTotal)}`);
console.log(`After: ${formatBytes(afterTotal)}`);
console.log(`Saved: ${formatBytes(beforeTotal - afterTotal)} (${(((beforeTotal - afterTotal) / beforeTotal) * 100).toFixed(1)}%)`);
