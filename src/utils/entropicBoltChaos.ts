import { Vector3 } from '@/utils/three-exports';

export const CHAOS_AMPLITUDE = 0.58;
const MICRO_JITTER = 0.05;

const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const _flight = new Vector3();
const _perpA = new Vector3();
const _perpB = new Vector3();

export function entropicChaosSeedFromId(id: number): number {
  return (id * 0.618033988) % 1;
}

export function computePerpendicularAxes(flightDir: Vector3, outA: Vector3, outB: Vector3) {
  _flight.copy(flightDir);
  if (_flight.lengthSq() < 1e-8) {
    _flight.set(0, 1, 0);
  } else {
    _flight.normalize();
  }
  const ref = Math.abs(_flight.dot(AXIS_Y)) > 0.92 ? AXIS_Z : AXIS_Y;
  outA.crossVectors(_flight, ref).normalize();
  outB.crossVectors(_flight, outA).normalize();
}

/**
 * Visual-only perpendicular offset for entropic bolt chaos.
 * Writes into `out` and returns it.
 */
export function computeEntropicChaosOffset(
  flightDir: Vector3,
  time: number,
  seed: number,
  out: Vector3,
  amplitude = CHAOS_AMPLITUDE,
): Vector3 {
  computePerpendicularAxes(flightDir, _perpA, _perpB);

  const s = seed * 12.9898;
  const wobbleA =
    Math.sin(time * 14.2 + s) * 0.55 +
    Math.sin(time * 10.6 + s * 1.31) * 0.35 +
    Math.sin(time * 16.8 + s * 2.17) * 0.1;
  const wobbleB =
    Math.cos(time * 11.4 + s * 1.7) * 0.55 +
    Math.cos(time * 13.1 + s * 0.92) * 0.35 +
    Math.sin(time * 9.3 + s * 1.55) * 0.1;

  const jitterA = (Math.random() - 0.5) * MICRO_JITTER;
  const jitterB = (Math.random() - 0.5) * MICRO_JITTER;

  return out
    .copy(_perpA)
    .multiplyScalar((wobbleA + jitterA) * amplitude)
    .addScaledVector(_perpB, (wobbleB + jitterB) * amplitude);
}

/**
 * Dust scatter offset for trail particles — smaller animated drift per point.
 */
export function computeEntropicDustScatter(
  flightDir: Vector3,
  time: number,
  pointSeed: number,
  trailAge: number,
  scatterScale: number,
  out: Vector3,
): Vector3 {
  computePerpendicularAxes(flightDir, _perpA, _perpB);

  const scatter = scatterScale * trailAge;
  const wobbleA = Math.sin(time * 1.8 + pointSeed * 12.5 + trailAge * 5.2) * scatter;
  const wobbleB = Math.cos(time * 1.4 + pointSeed * 9.7 + trailAge * 4.1) * scatter * 0.75;

  return out.copy(_perpA).multiplyScalar(wobbleA).addScaledVector(_perpB, wobbleB);
}
