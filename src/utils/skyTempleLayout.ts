/** Keep in sync with `backend/gameRoom.js` sky temple AABB / spawn constants. */

/**
 * Valkyr temple (`lifesizeTemple.glb`). Native AABB:
 * X −77.07..77.07, Y −68.03..120.86, Z −67.01..47.85.
 * Plaza walkable floor ≈ native Y 0.25. Lift so that plane is world Y=0.
 * Scale 0.5 shrinks the authored life-size mesh.
 */
export const SKY_TEMPLE_MODEL_SCALE = 0.5;
const SKY_TEMPLE_NATIVE_FLOOR_Y = 0.25;
export const SKY_TEMPLE_MODEL_POSITION: [number, number, number] = [
  0,
  -SKY_TEMPLE_NATIVE_FLOOR_Y * SKY_TEMPLE_MODEL_SCALE,
  0,
];

export const SKY_TEMPLE_PLAYABLE_MIN_X = -37;
export const SKY_TEMPLE_PLAYABLE_MAX_X = 37;
export const SKY_TEMPLE_PLAYABLE_MIN_Z = -32;
export const SKY_TEMPLE_PLAYABLE_MAX_Z = 22.5;

/** South rim. Y sits above the raised plaza lip so the mesh snap / drop lands on top. */
export const SKY_TEMPLE_SPAWN = Object.freeze({ x: 0, y: 4, z: -28 });

/** Fixed encounter on plaza flanks. Keep in sync with `backend/gameRoom.js`. */
export const SKY_TEMPLE_PACK = Object.freeze([
  Object.freeze({ type: 'spectre', x: -26, y: 0, z: 2, campColor: 'purple' }),
  Object.freeze({ type: 'death-knight', x: -22, y: 0, z: -6, campColor: 'red' }),
  Object.freeze({ type: 'assassin', x: 24, y: 0, z: 0, campColor: 'green' }),
  Object.freeze({ type: 'knight', x: 21, y: 0, z: 5, campColor: 'red' }),
  Object.freeze({ type: 'knight', x: 27, y: 0, z: -5, campColor: 'blue' }),
]);

export type SkyTemplePlayableAabb = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const SKY_TEMPLE_PLAYABLE_AABB: SkyTemplePlayableAabb = Object.freeze({
  minX: SKY_TEMPLE_PLAYABLE_MIN_X,
  maxX: SKY_TEMPLE_PLAYABLE_MAX_X,
  minZ: SKY_TEMPLE_PLAYABLE_MIN_Z,
  maxZ: SKY_TEMPLE_PLAYABLE_MAX_Z,
});

export function clampToSkyTempleAabb(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.max(SKY_TEMPLE_PLAYABLE_MIN_X, Math.min(SKY_TEMPLE_PLAYABLE_MAX_X, x)),
    z: Math.max(SKY_TEMPLE_PLAYABLE_MIN_Z, Math.min(SKY_TEMPLE_PLAYABLE_MAX_Z, z)),
  };
}
