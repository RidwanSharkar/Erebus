import { MUSHROOM_MAX_HP } from './mushroomConstants';

export const MUSHROOM_COUNT = 20;
export const MUSHROOM_INNER_RADIUS = 5;
export const MUSHROOM_OUTER_RADIUS = 25;
export const MUSHROOM_LAYOUT_SEED = 0x1a2b3c4d;

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
    const angle = rand() * Math.PI * 2;
    const r = MUSHROOM_INNER_RADIUS + rand() * (MUSHROOM_OUTER_RADIUS - MUSHROOM_INNER_RADIUS);
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
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
