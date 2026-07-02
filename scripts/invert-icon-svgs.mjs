import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ICON_DIR = join(process.cwd(), 'public/icons');
const SKIP = new Set(['storm.svg', 'necro.svg', 'infernal.svg', 'glacial.svg', 'bladerush.svg']);

const files = (await readdir(ICON_DIR)).filter(f => f.endsWith('.svg'));
let changed = 0;

for (const file of files) {
  if (SKIP.has(file)) continue;
  const path = join(ICON_DIR, file);
  const src = await readFile(path, 'utf8');
  const next = src.replaceAll('fill="#000000"', 'fill="#ffffff"');
  if (next !== src) {
    await writeFile(path, next);
    changed++;
  }
}

console.log(`Updated ${changed} icons (${SKIP.size} skipped).`);
