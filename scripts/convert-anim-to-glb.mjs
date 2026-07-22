/**
 * Convert a Mixamo animation FBX to a single-animation GLB via Assimp.
 * Produces the same _$AssimpFbx$_Rotation track layout as convert-idle-to-glb.mjs
 * so locomotion/attack clips bind to the idle mesh skeleton.
 *
 * Requires: assimp (Open Asset Import Library CLI)
 *
 * Usage: node scripts/convert-anim-to-glb.mjs <input.fbx> <output.glb>
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const inputPath = process.argv[2];
const outputPath = process.argv[3];

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert-anim-to-glb.mjs <input.fbx> <output.glb>');
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

/** mixamorig:Hips → mixamorigHips (preserve Assimp helper suffixes). */
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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'erebus-anim-glb-'));
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
  const animCount = root.listAnimations().length;

  if (animCount === 0) {
    console.error('Error: exported GLB has no animations.');
    process.exit(1);
  }

  await io.write(absOutput, document);

  const outBytes = readFileSync(absOutput);
  console.log(
    `Wrote ${absOutput} (${(outBytes.length / 1024).toFixed(1)} KB) — ` +
      `${animCount} anim(s), ${renamed} node(s) renamed`,
  );
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
