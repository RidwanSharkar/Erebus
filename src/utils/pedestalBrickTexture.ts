import type { Texture } from '@/utils/three-exports';
import { RepeatWrapping, sRGBEncoding } from '@/utils/three-exports';

/** Albedo for procedural pedestal / pillar stone cylinders. */
export const PEDESTAL_BRICK_TEXTURE_PATH = '/texture.png';

/**
 * Soft albedo fill so dark charcoal brick stays vivid without point lights.
 * Matches `THRONE_PERIMETER_PYLON_SELF_ILLUMINATION` (emissiveMap = albedo).
 */
export const PEDESTAL_BRICK_SELF_ILLUMINATION = 0.25;

/** PBR response tuned so dark brick albedo still catches nearby pedestal point lights. */
export const PEDESTAL_BRICK_STONE_PROPS = {
  color: '#ffffff',
  roughness: 0.42,
  metalness: 0.08,
  emissive: '#ffffff',
  emissiveIntensity: PEDESTAL_BRICK_SELF_ILLUMINATION,
} as const;

/** Slightly duller finish for throne archetype pedestals only. */
export const PEDESTAL_BRICK_ARCHETYPE_STONE_PROPS = {
  ...PEDESTAL_BRICK_STONE_PROPS,
  roughness: 0.62,
  metalness: 0.04,
} as const;

/**
 * Configure UV wrap + color space for cylinder-unwrapped pedestal stone.
 * Safe to call multiple times on the same texture instance.
 */
export function configurePedestalBrickTexture(texture: Texture): void {
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(1.5, 2);
  texture.encoding = sRGBEncoding;
  texture.needsUpdate = true;
}
