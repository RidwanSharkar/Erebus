/**
 * Convert a Mixamo idle FBX (full mesh + skin) to a textured base-scene GLB.
 * Uses Assimp to preserve embedded diffuse/normal/specular maps, then normalizes
 * Mixamo bone names so existing three.js animation clips still bind.
 *
 * Requires: assimp (Open Asset Import Library CLI)
 *
 * Usage: node scripts/convert-idle-to-glb.mjs <input.fbx> <output.glb>
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert-idle-to-glb.mjs <input.fbx> <output.glb>');
  process.exit(1);
}

const absInput = path.resolve(inputPath);
const absOutput = path.resolve(outputPath);

function findAssimp() {
  try {
    execFileSync('which', ['assimp'], { stdio: 'pipe' });
    return 'assimp';
  } catch {
    return null;
  }
}

const assimp = findAssimp();
if (!assimp) {
  console.error(
    'Error: assimp CLI not found. Install Open Asset Import Library (e.g. brew install assimp).',
  );
  process.exit(1);
}

/**
 * Normalize Mixamo colon-style bone names (mixamorig:Hips → mixamorigHips).
 * Do NOT strip _$AssimpFbx$_ helper suffixes — collapsing those onto base bone
 * names creates duplicate node names and breaks the Assimp rotation-helper chain.
 */
function normalizeMixamoNodeName(name) {
  if (!name) return name;
  return name.replace(/:/g, '');
}

function normalizeMixamoBones(document) {
  const root = document.getRoot();
  let renamed = 0;
  for (const node of root.listNodes()) {
    const next = normalizeMixamoNodeName(node.getName());
    if (next !== node.getName()) {
      node.setName(next);
      renamed += 1;
    }
  }
  return renamed;
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'erebus-idle-glb-'));
const tmpGlb = path.join(tmpDir, 'assimp-export.glb');

try {
  console.log(`Exporting with assimp: ${absInput}`);
  execFileSync(assimp, ['export', absInput, tmpGlb], { stdio: 'inherit' });

  const io = new NodeIO()
    .setLogger(new Logger(Verbosity.ERROR))
    .registerExtensions(ALL_EXTENSIONS);

  const document = await io.read(tmpGlb);
  const renamed = normalizeMixamoBones(document);

  const root = document.getRoot();
  const meshCount = root.listMeshes().length;
  const textureCount = root.listTextures().length;
  const animCount = root.listAnimations().length;

  if (meshCount === 0) {
    console.error('Error: exported GLB has no meshes.');
    process.exit(1);
  }
  if (textureCount === 0) {
    console.warn('Warning: exported GLB has no embedded textures.');
  }

  await io.write(absOutput, document);

  const outBytes = readFileSync(absOutput);
  console.log(
    `Wrote ${absOutput} (${(outBytes.length / 1024).toFixed(1)} KB) — ` +
      `${meshCount} mesh(es), ${textureCount} texture(s), ${animCount} anim(s), ${renamed} node(s) renamed`,
  );
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
