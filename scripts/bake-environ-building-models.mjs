/**
 * Join-by-material bake for explore building GLBs.
 * Drops leftover skins/anims (static buildings do not play clips).
 * Does NOT ground-align (React components already apply MODEL_Y) and does not recompress textures.
 *
 * Usage:
 *   node scripts/bake-environ-building-models.mjs
 *   node scripts/bake-environ-building-models.mjs --dry-run
 *   node scripts/bake-environ-building-models.mjs watchTower.glb siegeTower.glb
 */
import { statSync } from 'node:fs';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  compactPrimitive,
  dedup,
  flatten,
  getGLPrimitiveCount,
  getMeshVertexCount,
  join,
  prune,
  weld,
  VertexCountMethod,
} from '@gltf-transform/functions';
import { formatBytes } from './model-asset-config.mjs';

const root = path.resolve(import.meta.dirname, '..');
const environDir = path.join(root, 'public', 'models', 'environ');
const dryRun = process.argv.includes('--dry-run');
const namesFilter = process.argv
  .slice(2)
  .filter((arg) => arg !== '--dry-run')
  .map((name) => (name.endsWith('.glb') ? name : `${name}.glb`));

const DEFAULT_BUILDINGS = [
  'watchTower.glb',
  'siegeTower.glb',
  'research.glb',
  'spiritLounge2.glb',
  'Tower2.glb',
  'fireplace.glb',
  'shrine.glb',
  'obelisk.glb',
  'shieldBattery.glb',
];

const STRIP_SEMANTICS = new Set(['JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_1']);

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
    }
  }
}

async function bakeFile(fileName) {
  const filePath = path.join(environDir, fileName);
  const beforeBytes = statSync(filePath).size;
  const document = await io.read(filePath);
  const before = collectStats(document);

  dropAnimationAndSkin(document);
  stripDeadAttributes(document);

  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      compactPrimitive(prim);
    }
  }

  await document.transform(
    flatten({ cleanup: false }),
    join({ cleanup: false, keepNamed: false, keepMeshes: false }),
  );
  await document.transform(
    dedup({ keepUniqueNames: true }),
    weld(),
    prune({
      keepLeaves: false,
      keepAttributes: false,
      keepExtras: false,
    }),
  );

  const after = collectStats(document);
  let afterBytes;
  if (dryRun) {
    const binary = await io.writeBinary(document);
    afterBytes = binary.byteLength;
  } else {
    await io.write(filePath, document);
    afterBytes = statSync(filePath).size;
  }

  return { fileName, beforeBytes, afterBytes, before, after };
}

const files = namesFilter.length > 0 ? namesFilter : DEFAULT_BUILDINGS;

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
      `saved ${formatBytes(result.beforeBytes - result.afterBytes)}`,
  );
  console.log(
    `  mesh ${result.before.meshes}->${result.after.meshes}` +
      `  prim ${result.before.primitives}->${result.after.primitives}` +
      `  tris ${result.before.triangles}->${result.after.triangles}` +
      `  verts ${result.before.verts}->${result.after.verts}` +
      `  skins ${result.before.skins}->${result.after.skins}` +
      `  anim ${result.before.animations}->${result.after.animations}` +
      `  nodes ${result.before.nodes}->${result.after.nodes}`,
  );
}
