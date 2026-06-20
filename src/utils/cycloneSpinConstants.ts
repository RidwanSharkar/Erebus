/** Cyclone Rush / Bladestorm orbital spin — shared between Runeblade and Titan. */

export const CYCLONE_SPIN_ROTATION_SPEED = 32.5; // rad/s

/** Player Cyclone Rush orbit (Runeblade post-Charge spin). */
export const CYCLONE_SPIN_ORBIT_RADIUS = 1.125;
export const CYCLONE_SPIN_ORBIT_HEIGHT = 0.65;
export const CYCLONE_SPIN_HIT_RADIUS = 2.95;

/** Titan Bladestorm — scaled orbit for large model, same spin speed/orientation. */
export const TITAN_BLADESTORM_ORBIT_RADIUS = 3.0;
export const TITAN_BLADESTORM_ORBIT_HEIGHT = 3.5;
export const TITAN_BLADESTORM_HIT_RADIUS = 4.75;

/** Blade orientation during orbital spin (matches Runeblade Cyclone Rush). */
export function applyCycloneSpinBladeRotation(
  group: { rotation: { set: (x: number, y: number, z: number) => void }; rotateY: (r: number) => void },
  angle: number,
): void {
  group.rotation.set(Math.PI / 4, -angle + Math.PI, 1);
  group.rotateY(-angle + Math.PI);
}
