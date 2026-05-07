import { MUSHROOM_MAX_HP } from './mushroomConstants';
import { MAIN_MAP_HALF_X, MAIN_MAP_HALF_Z } from './mapConstants';

export const MUSHROOM_COUNT = 20;
export const MUSHROOM_INNER_RADIUS = 5;
export const MUSHROOM_OUTER_RADIUS = MAIN_MAP_HALF_Z - 2;
export const MUSHROOM_LAYOUT_SEED = 0x1a2b3c4d;
const MUSHROOM_HALF_X = MAIN_MAP_HALF_X - 1.0;
const MUSHROOM_HALF_Z = MAIN_MAP_HALF_Z - 2.0;

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface MushroomInstance {
  index: number;
  x: number;
  z: number;
  h: number;
  cr: number;
}

let cached: MushroomInstance[] | null = null;

export function buildMushroomInstances(): MushroomInstance[] {
  if (cached) return cached;
  const rand = mulberry32(MUSHROOM_LAYOUT_SEED);
  const out: MushroomInstance[] = [];
  for (let i = 0; i < MUSHROOM_COUNT; i++) {
    let x = 0;
    let z = 0;
    for (let attempt = 0; attempt < 64; attempt++) {
      x = (rand() * 2 - 1) * MUSHROOM_HALF_X;
      z = (rand() * 2 - 1) * MUSHROOM_HALF_Z;
      if (Math.hypot(x, z) >= MUSHROOM_INNER_RADIUS) break;
    }
    const h = 0.14 + rand() * 0.55;
    const cr = 0.7 + rand() * 1.4;
    out.push({ index: i, x, z, h, cr });
  }
  cached = out;
  return out;
}

export function getMushroomInstanceByIndex(index: number): MushroomInstance | undefined {
  return buildMushroomInstances()[index];
}

/** Stem center (matches InstancedMushrooms stem `pos.set(x, h*0.5, z)`) for ECS / sphere hit. */
export function getMushroomColliderCenter(inst: MushroomInstance): { x: number; y: number; z: number } {
  return { x: inst.x, y: inst.h * 0.5, z: inst.z };
}

export const MUSHROOM_DEFAULT_HEALTH = MUSHROOM_MAX_HP;
