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

export type SkyTempleSpawnSpec = {
  type: string;
  x: number;
  y: number;
  z: number;
  campColor: string;
  forceCannon?: boolean;
};

/** Kill-gated plaza waves. Keep in sync with `backend/gameRoom.js`. */
export const SKY_TEMPLE_WAVE_1 = Object.freeze([
  Object.freeze({ type: 'spectre', x: -26, y: 0, z: 2, campColor: 'purple' }),
  Object.freeze({ type: 'death-knight', x: -22, y: 0, z: -6, campColor: 'red' }),
  Object.freeze({ type: 'viper', x: 24, y: 0, z: 2, campColor: 'green' }),
  Object.freeze({ type: 'viper', x: 24, y: 0, z: -4, campColor: 'blue' }),
  Object.freeze({ type: 'knight', x: 21, y: 0, z: 5, campColor: 'red' }),
  Object.freeze({ type: 'knight', x: 27, y: 0, z: -5, campColor: 'blue' }),
]);

export const SKY_TEMPLE_WAVE_2 = Object.freeze([
  Object.freeze({ type: 'stone-giant', x: -6, y: 0, z: 0, campColor: 'red' }),
  Object.freeze({ type: 'stone-giant', x: 6, y: 0, z: 0, campColor: 'blue' }),
]);

export const SKY_TEMPLE_WAVE_3 = Object.freeze([
  Object.freeze({ type: 'weaver', x: -26, y: 0, z: 2, campColor: 'green' }),
  Object.freeze({ type: 'weaver', x: -22, y: 0, z: -6, campColor: 'blue' }),
  Object.freeze({ type: 'weaver', x: -28, y: 0, z: -4, campColor: 'green' }),
  Object.freeze({ type: 'assassin', x: -24, y: 0, z: 0, campColor: 'green' }),
  Object.freeze({ type: 'valkyrie', x: 21, y: 0, z: 4, campColor: 'green' }),
  Object.freeze({ type: 'valkyrie', x: 27, y: 0, z: -4, campColor: 'blue' }),
]);

export const SKY_TEMPLE_WAVE_4 = Object.freeze([
  Object.freeze({ type: 'eternal-oak', x: 0, y: 0, z: 0, campColor: 'green' }),
  Object.freeze({ type: 'tiger', x: -7, y: 0, z: 3, campColor: 'red' }),
  Object.freeze({ type: 'tiger', x: 7, y: 0, z: -3, campColor: 'blue' }),
]);

export const SKY_TEMPLE_WAVE_5 = Object.freeze([
  Object.freeze({ type: 'death-knight', x: -26, y: 0, z: 2, campColor: 'red' }),
  Object.freeze({ type: 'death-knight', x: -22, y: 0, z: -6, campColor: 'purple' }),
  Object.freeze({ type: 'wraith', x: -28, y: 0, z: -2, campColor: 'purple' }),
  Object.freeze({ type: 'wraith', x: -20, y: 0, z: 4, campColor: 'red' }),
  Object.freeze({ type: 'titan', x: 21, y: 0, z: 4, campColor: 'red', forceCannon: true }),
  Object.freeze({ type: 'titan', x: 27, y: 0, z: -4, campColor: 'blue', forceCannon: true }),
]);

export const SKY_TEMPLE_WAVE_6 = Object.freeze([
  Object.freeze({ type: 'colossus', x: 0, y: 0, z: 0, campColor: 'red' }),
  Object.freeze({ type: 'spectre', x: -8, y: 0, z: 2, campColor: 'purple' }),
  Object.freeze({ type: 'spectre', x: 8, y: 0, z: -2, campColor: 'blue' }),
]);

export const SKY_TEMPLE_WAVES = Object.freeze([
  SKY_TEMPLE_WAVE_1,
  SKY_TEMPLE_WAVE_2,
  SKY_TEMPLE_WAVE_3,
  SKY_TEMPLE_WAVE_4,
  SKY_TEMPLE_WAVE_5,
  SKY_TEMPLE_WAVE_6,
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
