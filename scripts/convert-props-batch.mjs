/**
 * Batch-convert FBX props to optimized static GLBs.
 * Uses Assimp for FBX → GLB, stages textures when available,
 * then @gltf-transform for prune/dedup/weld (+ WebP compress when textured).
 *
 * Requires: assimp (Open Asset Import Library CLI)
 *
 * Usage:
 *   node scripts/convert-props-batch.mjs              # all public/props/*.fbx → glb/
 *   node scripts/convert-props-batch.mjs TwistedTree_1 Fern_1
 *   node scripts/convert-props-batch.mjs --dir turrets  # public/props/turrets/*.fbx → turrets/glb/
 */
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Logger, NodeIO, Verbosity } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, weld } from '@gltf-transform/functions';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const propsRoot = path.join(root, 'public', 'props');

function parseArgs(argv) {
  let subdir = '';
  const names = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dir') {
      subdir = argv[i + 1] || '';
      i += 1;
      continue;
    }
    if (arg.startsWith('--dir=')) {
      subdir = arg.slice('--dir='.length);
      continue;
    }
    names.push(arg);
  }
  // Normalize: "turrets" or "turrets/" → turrets
  subdir = subdir.replace(/^[/\\]+|[/\\]+$/g, '');
  return { subdir, names };
}

const { subdir, names: namesFilter } = parseArgs(process.argv.slice(2));
const sourceDir = subdir ? path.join(propsRoot, subdir) : propsRoot;
const outDir = subdir ? path.join(sourceDir, 'glb') : path.join(propsRoot, 'glb');

/** Prefer local staging copy; fall back to MegaKit Textures if still in Downloads. */
function resolveTexturesDir() {
  const candidates = [
    process.env.STYLIZED_NATURE_TEXTURES,
    path.join(root, 'assets', 'stylized-nature', 'Textures'),
    path.join(propsRoot, 'Textures'),
    path.join(sourceDir, 'Textures'),
    path.join(
      process.env.HOME || '',
      'Downloads',
      'Stylized Nature MegaKit[Standard]',
      'Textures',
    ),
  ].filter(Boolean);

  for (const dir of candidates) {
    if (dir && existsSync(dir) && readdirSync(dir).length > 0) return dir;
  }
  return path.join(root, 'assets', 'stylized-nature', 'Textures');
}

const texturesDir = resolveTexturesDir();

function findAssimp() {
  try {
    execFileSync('which', ['assimp'], { stdio: 'pipe' });
    return 'assimp';
  } catch {
    return null;
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

function listFbxFiles(dir, namesFilterList) {
  if (!existsSync(dir)) {
    console.error(`Error: source dir not found: ${dir}`);
    process.exit(1);
  }
  const all = readdirSync(dir)
    .filter((name) => name.endsWith('.fbx'))
    .sort();

  if (!namesFilterList || namesFilterList.length === 0) return all;

  const wanted = new Set(
    namesFilterList.map((n) => (n.endsWith('.fbx') ? n : `${n}.fbx`)),
  );
  const matched = all.filter((name) => wanted.has(name));
  const missing = [...wanted].filter((name) => !all.includes(name));
  if (missing.length > 0) {
    console.warn(`Warning: missing FBX files: ${missing.join(', ')}`);
  }
  return matched;
}

/** Stage every texture into the Assimp export dir so relative URIs resolve. */
function stageTextures(destDir) {
  if (!existsSync(texturesDir)) return 0;
  let n = 0;
  for (const name of readdirSync(texturesDir)) {
    const src = path.join(texturesDir, name);
    if (!statSync(src).isFile()) continue;
    copyFileSync(src, path.join(destDir, name));
    n += 1;
  }
  return n;
}

/**
 * Assimp sometimes writes Windows absolute texture URIs. Rewrite image.uri
 * entries to basename so staged Textures/ files resolve, then re-pack GLB.
 * Also drop images whose files are missing so NodeIO can still read untextured kits.
 */
function rewriteImageUrisToBasenames(glbPath, textureSearchDir) {
  const buf = readFileSync(glbPath);
  const magic = buf.toString('utf8', 0, 4);
  if (magic !== 'glTF') throw new Error('not a GLB');

  const jsonChunkLen = buf.readUInt32LE(12);
  const jsonChunkType = buf.toString('utf8', 16, 20);
  if (jsonChunkType !== 'JSON') throw new Error('expected JSON chunk');

  const jsonStart = 20;
  const jsonEnd = jsonStart + jsonChunkLen;
  const jsonPad = (4 - (jsonChunkLen % 4)) % 4;
  const binChunkStart = jsonEnd + jsonPad;
  const rest = buf.subarray(binChunkStart);

  const jsonText = buf.toString('utf8', jsonStart, jsonEnd).replace(/\0+$/, '');
  const json = JSON.parse(jsonText);
  let changed = 0;

  const images = json.images || [];
  const keepIndexMap = new Map();
  const keptImages = [];

  for (let i = 0; i < images.length; i += 1) {
    const image = images[i];
    if (image.uri && typeof image.uri === 'string') {
      const base = path.basename(image.uri.replace(/\\/g, '/'));
      if (base !== image.uri) {
        image.uri = base;
        changed += 1;
      }
      const localPath = path.join(textureSearchDir, image.uri);
      if (!existsSync(localPath)) {
        changed += 1;
        continue; // drop missing texture
      }
    }
    keepIndexMap.set(i, keptImages.length);
    keptImages.push(image);
  }

  if (keptImages.length !== images.length) {
    json.images = keptImages;
    if (json.textures) {
      const keptTextures = [];
      const texIndexMap = new Map();
      for (let i = 0; i < json.textures.length; i += 1) {
        const tex = json.textures[i];
        if (typeof tex.source === 'number' && keepIndexMap.has(tex.source)) {
          tex.source = keepIndexMap.get(tex.source);
          texIndexMap.set(i, keptTextures.length);
          keptTextures.push(tex);
        }
      }
      json.textures = keptTextures;
      // Clear material texture refs that pointed at dropped textures
      for (const mat of json.materials || []) {
        const pbr = mat.pbrMetallicRoughness;
        if (pbr?.baseColorTexture && !texIndexMap.has(pbr.baseColorTexture.index)) {
          delete pbr.baseColorTexture;
        }
        if (mat.normalTexture && !texIndexMap.has(mat.normalTexture.index)) {
          delete mat.normalTexture;
        }
        if (mat.occlusionTexture && !texIndexMap.has(mat.occlusionTexture.index)) {
          delete mat.occlusionTexture;
        }
        if (mat.emissiveTexture && !texIndexMap.has(mat.emissiveTexture.index)) {
          delete mat.emissiveTexture;
        }
        if (pbr?.metallicRoughnessTexture && !texIndexMap.has(pbr.metallicRoughnessTexture.index)) {
          delete pbr.metallicRoughnessTexture;
        }
      }
    }
  }

  if (changed === 0 && keptImages.length === images.length) return 0;

  let newJson = Buffer.from(JSON.stringify(json), 'utf8');
  const pad = (4 - (newJson.length % 4)) % 4;
  if (pad) newJson = Buffer.concat([newJson, Buffer.alloc(pad, 0x20)]);

  const totalLen = 12 + 8 + newJson.length + rest.length;
  const out = Buffer.alloc(totalLen);
  out.write('glTF', 0);
  out.writeUInt32LE(2, 4);
  out.writeUInt32LE(totalLen, 8);
  out.writeUInt32LE(newJson.length, 12);
  out.write('JSON', 16);
  newJson.copy(out, 20);
  rest.copy(out, 20 + newJson.length);
  writeFileSync(glbPath, out);
  return changed;
}

const assimp = findAssimp();
if (!assimp) {
  console.error(
    'Error: assimp CLI not found. Install Open Asset Import Library (e.g. brew install assimp).',
  );
  process.exit(1);
}

if (!existsSync(texturesDir) || readdirSync(texturesDir).length === 0) {
  console.warn(
    `Warning: no textures at ${texturesDir}. Untextured FBXs will still convert with base materials.`,
  );
}

mkdirSync(outDir, { recursive: true });

const io = new NodeIO()
  .setLogger(new Logger(Verbosity.ERROR))
  .registerExtensions(ALL_EXTENSIONS);

const fbxFiles = listFbxFiles(sourceDir, namesFilter);

if (fbxFiles.length === 0) {
  console.error('No FBX files to convert.');
  process.exit(1);
}

console.log(`Converting ${fbxFiles.length} prop(s) → ${outDir}`);
console.log(`Source: ${sourceDir}`);
console.log(`Textures: ${texturesDir}\n`);

let ok = 0;
let failed = 0;
let totalBefore = 0;
let totalAfter = 0;
let zeroTextureCount = 0;

for (const filename of fbxFiles) {
  const absInput = path.join(sourceDir, filename);
  const baseName = path.basename(filename, '.fbx');
  const absOutput = path.join(outDir, `${baseName}.glb`);
  const tmpDir = mkdtempSync(path.join(tmpdir(), 'erebus-prop-glb-'));
  const tmpGlb = path.join(tmpDir, 'assimp-export.glb');

  try {
    stageTextures(tmpDir);
    execFileSync(assimp, ['export', absInput, tmpGlb], { stdio: 'pipe' });
    rewriteImageUrisToBasenames(tmpGlb, tmpDir);

    const document = await io.read(tmpGlb);
    const rootDoc = document.getRoot();

    for (const anim of [...rootDoc.listAnimations()]) {
      anim.dispose();
    }

    // Assimp FBX leaves Unity-style node scale=100; mesh data is already ~meters.
    // Child translations are often left in the pre-scale unit space (e.g. Y=131 → should be 1.31).
    let normalizedScale100 = false;
    for (const node of rootDoc.listNodes()) {
      const s = node.getScale();
      if (
        s &&
        Math.abs(s[0] - 100) < 0.01 &&
        Math.abs(s[1] - 100) < 0.01 &&
        Math.abs(s[2] - 100) < 0.01
      ) {
        node.setScale([1, 1, 1]);
        normalizedScale100 = true;
      }
    }
    if (normalizedScale100) {
      for (const node of rootDoc.listNodes()) {
        const t = node.getTranslation();
        if (!t) continue;
        if (Math.abs(t[0]) > 10 || Math.abs(t[1]) > 10 || Math.abs(t[2]) > 10) {
          node.setTranslation([t[0] / 100, t[1] / 100, t[2] / 100]);
        }
      }
    }

    // Turrets / kits that already had scale baked to 1 may still carry cm translations.
    for (const node of rootDoc.listNodes()) {
      const t = node.getTranslation();
      if (!t) continue;
      if (Math.abs(t[0]) > 50 || Math.abs(t[1]) > 50 || Math.abs(t[2]) > 50) {
        node.setTranslation([t[0] / 100, t[1] / 100, t[2] / 100]);
      }
    }

    const transforms = [
      dedup({ keepUniqueNames: true }),
      weld(),
    ];
    if (rootDoc.listTextures().length > 0) {
      transforms.push(
        textureCompress({
          encoder: sharp,
          targetFormat: 'webp',
          resize: [1024, 1024],
          quality: 80,
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

    const meshCount = rootDoc.listMeshes().length;
    const textureCount = rootDoc.listTextures().length;
    const materialCount = rootDoc.listMaterials().length;

    if (meshCount === 0) {
      throw new Error('exported GLB has no meshes');
    }
    if (textureCount === 0) zeroTextureCount += 1;

    await io.write(absOutput, document);

    const beforeBytes = statSync(absInput).size;
    const afterBytes = statSync(absOutput).size;
    totalBefore += beforeBytes;
    totalAfter += afterBytes;
    ok += 1;

    console.log(
      [
        baseName.padEnd(28),
        `${formatBytes(beforeBytes)} → ${formatBytes(afterBytes)}`.padEnd(24),
        `mesh ${meshCount}`,
        `tex ${textureCount}`,
        `mat ${materialCount}`,
        textureCount === 0 ? '(no textures)' : '',
      ]
        .filter(Boolean)
        .join('  '),
    );
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${baseName}: ${err instanceof Error ? err.message : err}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

console.log('\nSummary');
console.log(`OK: ${ok}  Failed: ${failed}`);
console.log(`FBX total: ${formatBytes(totalBefore)}`);
console.log(`GLB total: ${formatBytes(totalAfter)}`);
if (zeroTextureCount > 0) {
  console.warn(
    `\nWarning: ${zeroTextureCount} GLB(s) have 0 textures (base materials only).`,
  );
}
if (failed > 0) process.exit(1);
