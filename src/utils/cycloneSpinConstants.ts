/** Cyclone Rush / Bladestorm orbital spin — shared between Runeblade and Titan. */

export const CYCLONE_SPIN_ROTATION_SPEED = 10.5; // rad/s

/** Player Cyclone Rush orbit (Runeblade post-Charge spin). */
export const CYCLONE_SPIN_ORBIT_RADIUS = 1.025;
export const CYCLONE_SPIN_ORBIT_HEIGHT = 0.5;
export const CYCLONE_SPIN_HIT_RADIUS = 2.95;

/** Titan Bladestorm — scaled orbit for large model; slower than player Cyclone Rush. */
export const TITAN_BLADESTORM_ORBIT_RADIUS = 2.0;
export const TITAN_BLADESTORM_ORBIT_HEIGHT = 1.25;
export const TITAN_BLADESTORM_HIT_RADIUS = 4.5;
export const TITAN_BLADESTORM_SPIN_SPEED = 18.0; // rad/s — matches server tick rate

/** Fixed blade Euler rotation for Titan Bladestorm — tip points skyward, no spin. */
export const TITAN_BLADESTORM_BLADE_ROTATION: [number, number, number] = [
  -Math.PI / 2,
  Math.PI / 2,
  0,
];

/** Blade orientation during orbital spin (matches Runeblade Cyclone Rush). */
export function applyCycloneSpinBladeRotation(
  group: { rotation: { set: (x: number, y: number, z: number) => void }; rotateY: (r: number) => void },
  angle: number,
): void {
  group.rotation.set(Math.PI / 4, -angle + Math.PI, 1);
  group.rotateY(-angle + Math.PI);
}
