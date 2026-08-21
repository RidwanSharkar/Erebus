import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const layoutPath = path.join(root, 'src', 'utils', 'dungeonLayout.ts');
const backendPath = path.join(root, 'backend', 'gameRoom.js');
const glbPath = path.join(root, 'public', 'models', 'maps', 'lifesizeLAIR.glb');

const CELL = 2;
const STEP = 2.4;
const MAX_XZ = 2.5;
const MAX_Y = 2;
const WALKABLE_NY = 0.55;
const PACK_NAMES = [
  'DUNGEON_ENTRANCE_PACK',
  'DUNGEON_BRIDGE_PACK',
  'DUNGEON_PRE_BOSS_PACK',
  'DUNGEON_LEDGE_PACK',
  'DUNGEON_LAIR_MOUTH_PACK',
  'DUNGEON_LAIR_OPENING_PACK',
  'DUNGEON_GREAT_LAIR_PACK',
];

function num(src, pattern, label) {
  const match = src.match(pattern);
  if (!match) throw new Error(`Missing ${label}`);
  return Number(match[1]);
}

function parsePacks(src) {
  const packs = {};
  for (const name of PACK_NAMES) {
    const block = src.match(new RegExp(`${name}\\s*=\\s*Object\\.freeze\\(\\[([\\s\\S]*?)\\]\\)`));
    if (!block) throw new Error(`Missing ${name}`);
    const members = [...block[1].matchAll(
      /type:\s*'([^']+)'\s*,\s*x:\s*(-?[\d.]+)\s*,\s*y:\s*(-?[\d.]+)\s*,\s*z:\s*(-?[\d.]+)/g,
    )].map((m) => ({
      type: m[1],
      x: Number(m[2]),
      y: Number(m[3]),
      z: Number(m[4]),
    }));
    if (members.length === 0) throw new Error(`Empty ${name}`);
    packs[name] = members;
  }
  return packs;
}

function packsEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((spec, i) => (
    spec.type === b[i].type
    && spec.x === b[i].x
    && spec.y === b[i].y
    && spec.z === b[i].z
  ));
}

function mul(m, v) {
  const [x, y, z] = v;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

async function walkableNodes(scale, lift) {
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(glbPath);
  const cells = new Map();
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const world = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const idx = prim.getIndices();
      const count = idx ? idx.getCount() : pos.getCount();
      const el = [0, 0, 0];
      for (let i = 0; i + 2 < count; i += 3) {
        const P = [];
        for (let k = 0; k < 3; k++) {
          const a = idx ? idx.getScalar(i + k) : i + k;
          pos.getElement(a, el);
          P.push(mul(world, el));
        }
        const ux = P[1][0] - P[0][0];
        const uy = P[1][1] - P[0][1];
        const uz = P[1][2] - P[0][2];
        const vx = P[2][0] - P[0][0];
        const vy = P[2][1] - P[0][1];
        const vz = P[2][2] - P[0][2];
        let nx = uy * vz - uz * vy;
        let ny = uz * vx - ux * vz;
        let nz = ux * vy - uy * vx;
        const len = Math.hypot(nx, ny, nz);
        if (len < 1e-9) continue;
        ny /= len;
        if (Math.abs(ny) <= WALKABLE_NY) continue;
        const cx = ((P[0][0] + P[1][0] + P[2][0]) / 3) * scale;
        const cy = ((P[0][1] + P[1][1] + P[2][1]) / 3) * scale + lift;
        const cz = ((P[0][2] + P[1][2] + P[2][2]) / 3) * scale;
        const key = `${Math.floor(cx / CELL)},${Math.floor(cz / CELL)}`;
        let list = cells.get(key);
        if (!list) {
          list = [];
          cells.set(key, list);
        }
        list.push(cy);
      }
    }
  }

  const nodes = [];
  for (const [key, ys] of cells) {
    ys.sort((a, b) => a - b);
    const groups = [];
    let cur = [ys[0]];
    for (let i = 1; i < ys.length; i++) {
      if (ys[i] - ys[i - 1] > 1.5) {
        groups.push(cur);
        cur = [];
      }
      cur.push(ys[i]);
    }
    groups.push(cur);
    const [sx, sz] = key.split(',').map(Number);
    for (const g of groups) {
      nodes.push({
        cx: sx * CELL + CELL / 2,
        cz: sz * CELL + CELL / 2,
        y: g[Math.floor(g.length / 2)],
      });
    }
  }
  return nodes;
}

function reachableFrom(nodes, spawnX, spawnZ, spawnY) {
  const byCell = new Map();
  nodes.forEach((n, i) => {
    const k = `${Math.floor(n.cx / CELL)},${Math.floor(n.cz / CELL)}`;
    let a = byCell.get(k);
    if (!a) {
      a = [];
      byCell.set(k, a);
    }
    a.push(i);
  });

  let start = 0;
  let best = Infinity;
  nodes.forEach((n, i) => {
    const d = Math.hypot(n.cx - spawnX, n.cz - spawnZ) + Math.abs(n.y - spawnY) * 3;
    if (d < best) {
      best = d;
      start = i;
    }
  });

  const dirs = [
    [CELL, 0], [-CELL, 0], [0, CELL], [0, -CELL],
    [CELL, CELL], [CELL, -CELL], [-CELL, CELL], [-CELL, -CELL],
  ];
  const seen = new Uint8Array(nodes.length);
  const q = [start];
  seen[start] = 1;
  const reach = [];
  while (q.length) {
    const i = q.pop();
    reach.push(nodes[i]);
    const n = nodes[i];
    for (const [dx, dz] of dirs) {
      const k = `${Math.floor((n.cx + dx) / CELL)},${Math.floor((n.cz + dz) / CELL)}`;
      const a = byCell.get(k);
      if (!a) continue;
      for (const j of a) {
        if (seen[j]) continue;
        if (Math.abs(nodes[j].y - n.y) > STEP) continue;
        seen[j] = 1;
        q.push(j);
      }
    }
  }
  return reach;
}

function nearestReachable(reach, x, z) {
  let best = null;
  let bestD = Infinity;
  for (const n of reach) {
    const d = Math.hypot(n.cx - x, n.cz - z);
    if (d < bestD) {
      bestD = d;
      best = n;
    }
  }
  return best ? { node: best, dist: bestD } : null;
}

const layoutSrc = await readFile(layoutPath, 'utf8');
const backendSrc = await readFile(backendPath, 'utf8');
const clientPacks = parsePacks(layoutSrc);
const serverPacks = parsePacks(backendSrc);

const errors = [];
for (const name of PACK_NAMES) {
  if (!packsEqual(clientPacks[name], serverPacks[name])) {
    errors.push(`${name} client/server copies differ`);
  }
}

const scale = num(layoutSrc, /DUNGEON_NEXUS_MODEL_SCALE\s*=\s*([\d.]+)/, 'DUNGEON_NEXUS_MODEL_SCALE');
const nativeFloorY = num(layoutSrc, /DUNGEON_NATIVE_FLOOR_Y\s*=\s*([\d.]+)/, 'DUNGEON_NATIVE_FLOOR_Y');
const spawnX = num(layoutSrc, /DUNGEON_SPAWN\s*=\s*Object\.freeze\(\{\s*x:\s*(-?[\d.]+)/, 'DUNGEON_SPAWN.x');
const spawnZ = num(layoutSrc, /DUNGEON_SPAWN\s*=\s*Object\.freeze\(\{\s*x:\s*-?[\d.]+,\s*y:\s*-?[\d.]+,\s*z:\s*(-?[\d.]+)/, 'DUNGEON_SPAWN.z');
const lift = -nativeFloorY * scale;

const nodes = await walkableNodes(scale, lift);
const reach = reachableFrom(nodes, spawnX, spawnZ, 0.5);

for (const name of PACK_NAMES) {
  for (const spec of clientPacks[name]) {
    const hit = nearestReachable(reach, spec.x, spec.z);
    if (!hit || hit.dist > MAX_XZ) {
      errors.push(`${name} ${spec.type} (${spec.x}, ${spec.z}) is not on reachable walkable XZ (nearest ${hit ? hit.dist.toFixed(2) : 'none'})`);
      continue;
    }
    const dy = Math.abs(hit.node.y - spec.y);
    if (dy > MAX_Y) {
      errors.push(`${name} ${spec.type} (${spec.x}, ${spec.z}) y=${spec.y} is ${dy.toFixed(2)} off walkable y=${hit.node.y.toFixed(2)}`);
    }
  }
}

if (errors.length) {
  console.error('Dungeon pack validation failed:');
  for (const err of errors) console.error(`- ${err}`);
  process.exit(1);
}

console.log(`Dungeon packs ok (${reach.length} reachable cells, scale ${scale})`);
