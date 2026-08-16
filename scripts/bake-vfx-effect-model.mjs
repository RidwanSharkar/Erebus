/**
 * Bake a skinned WoW-export VFX GLB into a static, unit-normalized trail mesh.
 *
 * Drops animation/skin, strips unused vertex attributes, centers and scales
 * so the longest axis is 1.0 and lies on -Z, joins primitives by material,
 * then WebP-compresses surviving textures.
 *
 * Usage:
 *   node scripts/bake-vfx-effect-model.mjs
 *   node scripts/bake-vfx-effect-model.mjs --dry-run
 *   node scripts/bake-vfx-effect-model.mjs arcaneEffect.glb
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

const DEFAULT_INPUT = 'arcaneEffect.glb';
const DEFAULT_OUTPUT = 'arcaneEffectTrail.glb';
const STRIP_SEMANTICS = new Set(['JOINTS_0', 'WEIGHTS_0', 'TEXCOORD_1', 'NORMAL']);
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

/**
 * Column-major mat4 for v' = Ry * S * T * v.
 * Uniform scale, Y-axis rotation, then translation baked as T first.
 */
function mat4RotateScaleTranslate(rotYRad, scale, tx, ty, tz) {
  const c = Math.cos(rotYRad);
  const s = Math.sin(rotYRad);
  const stX = scale * tx;
  const stY = scale * ty;
  const stZ = scale * tz;
  return [
    c * scale, 0, -s * scale, 0,
    0, scale, 0, 0,
    s * scale, 0, c * scale, 0,
    c * stX + s * stZ, stY, -s * stX + c * stZ, 1,
  ];
}

function longestAxisIndex(size) {
  let axis = 0;
  if (size[1] > size[axis]) axis = 1;
  if (size[2] > size[axis]) axis = 2;
  return axis;
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

function centerNormalizeAndAlign(document) {
  const scene = document.getRoot().getDefaultScene() ?? document.getRoot().listScenes()[0];
  if (!scene) {
    throw new Error('GLB has no scene');
  }
  const { min, max } = getBounds(scene);
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  const extent = Math.max(size[0], size[1], size[2]);
  if (!(extent > MIN_BBOX_EXTENT)) {
    throw new Error(
      `Bind pose looks degenerate (bbox extent ${extent.toFixed(4)}). ` +
        'Re-export a mid-animation snapshot before baking.',
    );
  }
  const center = [
    (min[0] + max[0]) * 0.5,
    (min[1] + max[1]) * 0.5,
    (min[2] + max[2]) * 0.5,
  ];
  const scale = 1 / extent;
  // Map the longest axis onto -Z so runtime lookAt(+direction) aims the plume forward.
  const axis = longestAxisIndex(size);
  let rotY = 0;
  if (axis === 0) rotY = Math.PI / 2;
  else if (axis === 1) rotY = 0;
  const matrix = mat4RotateScaleTranslate(rotY, scale, -center[0], -center[1], -center[2]);
  for (const mesh of document.getRoot().listMeshes()) {
    transformMesh(mesh, matrix);
  }
  return { min, max, size, extent, center, scale, rotY, axis };
}

async function bakeFile(inputName, outputName) {
  const inputPath = path.join(environDir, inputName);
  const outputPath = path.join(environDir, outputName);
  const beforeBytes = statSync(inputPath).size;
  const document = await io.read(inputPath);
  const before = collectStats(document);

  dropAnimationAndSkin(document);
  stripDeadAttributes(document);
  const xform = centerNormalizeAndAlign(document);

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
        resize: [512, 512],
        quality: 80,
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
    await io.write(outputPath, document);
    afterBytes = statSync(outputPath).size;
  }

  return {
    inputName,
    outputName,
    beforeBytes,
    afterBytes,
    before,
    after,
    xform,
    afterBounds,
  };
}

const inputName = namesFilter[0] ?? DEFAULT_INPUT;
const outputName =
  inputName === DEFAULT_INPUT ? DEFAULT_OUTPUT : inputName.replace(/\.glb$/i, 'Trail.glb');

if (dryRun) {
  console.log('Dry run — no files will be written\n');
}

const result = await bakeFile(inputName, outputName);

console.log(`${result.inputName} -> ${result.outputName}`);
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
    `extent ${result.xform.extent.toFixed(2)} axis=${result.xform.axis} rotY=${result.xform.rotY.toFixed(2)}`,
);
if (result.afterBounds) {
  console.log(
    `  out  bbox [${result.afterBounds.min.map((n) => n.toFixed(3)).join(', ')}] .. ` +
      `[${result.afterBounds.max.map((n) => n.toFixed(3)).join(', ')}]`,
  );
}
