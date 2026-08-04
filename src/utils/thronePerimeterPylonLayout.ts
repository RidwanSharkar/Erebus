/**
 * Outer-rim decorative pylons for the throne grass disc / Fae Realm hex.
 * Six evenly spaced copies face the room center (0, 0) on XZ.
 */

import { FAE_REALM_HEX_RADIUS } from '@/utils/mapConstants';
import { rotationYTowardArenaCenter } from '@/utils/coopArenaLayout';

export const THRONE_PERIMETER_PYLON_PATH = '/models/trinket/pylons/5.glb';

export const THRONE_PERIMETER_PYLON_COUNT = 6;

/**
 * Just past COOP_THRONE_ROOM_RADIUS (15) so pylons sit outside the playable rim.
 */
export const THRONE_PERIMETER_PYLON_RADIUS = 15 + 2;

/** Grass disc Y — pylon feet sit on this plane (matches statue / shard décor). */
export const THRONE_PERIMETER_PYLON_GROUND_Y = -0.67;

/**
 * Soft albedo fill so dark charcoal pylons stay readable without point lights.
 * Higher than UNIT_SELF_ILLUMINATION (0.18); lower than knight armor fill.
 */
export const THRONE_PERIMETER_PYLON_SELF_ILLUMINATION = 0.4125;

/**
 * Raw GLB: minY ≈ 0.018, height ≈ 5.53m.
 * groundY = −minY so feet land on the grass plane after scale.
 */
export const THRONE_PERIMETER_PYLON_META = {
  groundY: -0.1182,
  defaultScale: 0.625,
} as const;

/** Just past FAE_REALM_HEX_RADIUS so pylons sit outside the hex vertices. */
export const FAE_REALM_PERIMETER_PYLON_RADIUS = FAE_REALM_HEX_RADIUS + 1.5;

/**
 * Hex vertices sit at π/6 + n·π/3 (matches `isInsideHexArenaXZ` orientation).
 */
const FAE_REALM_PERIMETER_PYLON_ANGLE_OFFSET = Math.PI / 6;

/**
 * Pitch after yaw so the tip leans toward the room center.
 * Negative: after cutout faces −Z toward center, −X tips the top inward.
 */
export const THRONE_PERIMETER_PYLON_INWARD_TILT = -Math.PI / 9; // ~20°

export type ThronePerimeterPylonDef = {
  position: [number, number, number];
  rotationY: number;
  /** Local X pitch after yaw (negative = tip toward center). */
  rotationX?: number;
  /** Multiplies defaultScale (usually 1). */
  scale?: number;
};

export function buildPerimeterPylonLayout(
  count: number = THRONE_PERIMETER_PYLON_COUNT,
  radius: number = THRONE_PERIMETER_PYLON_RADIUS,
  angleOffset: number = 0,
): ThronePerimeterPylonDef[] {
  const defs: ThronePerimeterPylonDef[] = [];
  for (let i = 0; i < count; i++) {
    const angle = angleOffset + (i / count) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    defs.push({
      position: [x, 0, z],
      // Mesh front is −Z; +π so the cutout faces the room center.
      rotationY: rotationYTowardArenaCenter(x, z) + Math.PI,
      rotationX: THRONE_PERIMETER_PYLON_INWARD_TILT,
    });
  }
  return defs;
}

export const THRONE_PERIMETER_PYLON_LAYOUT: readonly ThronePerimeterPylonDef[] =
  buildPerimeterPylonLayout();

export const FAE_REALM_PERIMETER_PYLON_LAYOUT: readonly ThronePerimeterPylonDef[] =
  buildPerimeterPylonLayout(
    THRONE_PERIMETER_PYLON_COUNT,
    FAE_REALM_PERIMETER_PYLON_RADIUS,
    FAE_REALM_PERIMETER_PYLON_ANGLE_OFFSET,
  );
