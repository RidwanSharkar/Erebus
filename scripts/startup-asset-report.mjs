import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const srcDir = path.join(root, 'src');
const topCount = Number(process.argv[2] ?? 20);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!entry.isFile()) return [];
    const info = await stat(fullPath);
    return [{ path: fullPath, bytes: info.size }];
  }));
  return files.flat();
}

async function readSrcText() {
  const files = (await walk(srcDir)).filter(file => /\.(ts|tsx|js|jsx)$/.test(file.path));
  const contents = await Promise.all(files.map(file => readFile(file.path, 'utf8')));
  return contents.join('\n');
}

function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}

function relative(filePath) {
  return path.relative(root, filePath);
}

const publicFiles = await walk(publicDir);
const srcText = await readSrcText();

const byDir = new Map();
for (const file of publicFiles) {
  const parts = relative(file.path).split(path.sep);
  const bucket = parts.slice(0, Math.min(2, parts.length - 1)).join('/');
  byDir.set(bucket, (byDir.get(bucket) ?? 0) + file.bytes);
}

const publicTotal = publicFiles.reduce((sum, file) => sum + file.bytes, 0);
const modelFiles = publicFiles.filter(file => file.path.endsWith('.glb'));
const audioFiles = publicFiles.filter(file => /\.(mp3|wav|ogg|m4a)$/i.test(file.path));
const unreferencedModels = modelFiles.filter(file => {
  const publicUrl = `/${path.relative(publicDir, file.path).replaceAll(path.sep, '/')}`;
  return !srcText.includes(publicUrl);
});

console.log(`Public assets: ${formatBytes(publicTotal)} across ${publicFiles.length} files`);
console.log(`Models: ${formatBytes(modelFiles.reduce((sum, file) => sum + file.bytes, 0))} across ${modelFiles.length} GLBs`);
console.log(`Audio: ${formatBytes(audioFiles.reduce((sum, file) => sum + file.bytes, 0))} across ${audioFiles.length} files`);

console.log('\nLargest asset directories:');
for (const [dir, bytes] of [...byDir.entries()].sort((a, b) => b[1] - a[1]).slice(0, topCount)) {
  console.log(`${formatBytes(bytes).padStart(10)}  ${dir}`);
}

console.log('\nLargest individual assets:');
for (const file of [...publicFiles].sort((a, b) => b.bytes - a.bytes).slice(0, topCount)) {
  console.log(`${formatBytes(file.bytes).padStart(10)}  ${relative(file.path)}`);
}

if (unreferencedModels.length > 0) {
  console.log('\nGLBs with no literal /models/... reference in src:');
  for (const file of unreferencedModels.sort((a, b) => b.bytes - a.bytes).slice(0, topCount)) {
    console.log(`${formatBytes(file.bytes).padStart(10)}  ${relative(file.path)}`);
  }
}
