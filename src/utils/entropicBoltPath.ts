import { Vector3 } from '@/utils/three-exports';

export const ENTROPIC_CURVE_WIDTH = 0;
export const ENTROPIC_FORWARD_SCALE = 12.25;
export const ENTROPIC_START_SPEED = 0.03;
export const ENTROPIC_MAX_SPEED = 2.75;
export const ENTROPIC_ACCEL_DISTANCE = ENTROPIC_FORWARD_SCALE;
export const ENTROPIC_MAX_LIFETIME = 1.5;
/** ECS hit sphere radius for entropic bolt collision (segment sweep + distance check). */
export const ENTROPIC_BOLT_COLLISION_RADIUS = 0.125;
/** Fraction of enemy trigger radius counted for entropic bolt hits (rest is generic projectile logic). */
export const ENTROPIC_BOLT_TARGET_RADIUS_SCALE = 0.60;

/** XZ-only point + segment sweep — entropic bolts ignore vertical slop from tall enemy triggers. */
export function checkEntropicBoltHit(
  projectilePos: Vector3,
  previousProjectilePos: Vector3,
  targetPos: Vector3,
  targetRadius: number,
  projectileRadius = ENTROPIC_BOLT_COLLISION_RADIUS,
  targetRadiusScale = ENTROPIC_BOLT_TARGET_RADIUS_SCALE,
): boolean {
  const combined = projectileRadius + targetRadius * targetRadiusScale;
  const combinedSq = combined * combined;

  const dx = projectilePos.x - targetPos.x;
  const dz = projectilePos.z - targetPos.z;
  if (dx * dx + dz * dz <= combinedSq) return true;

  const segX = projectilePos.x - previousProjectilePos.x;
  const segZ = projectilePos.z - previousProjectilePos.z;
  const segLenSq = segX * segX + segZ * segZ;
  if (segLenSq === 0) return dx * dx + dz * dz <= combinedSq;

  const toStartX = targetPos.x - previousProjectilePos.x;
  const toStartZ = targetPos.z - previousProjectilePos.z;
  const t = Math.max(0, Math.min(1, (toStartX * segX + toStartZ * segZ) / segLenSq));
  const closestX = previousProjectilePos.x + segX * t;
  const closestZ = previousProjectilePos.z + segZ * t;
  const cdx = targetPos.x - closestX;
  const cdz = targetPos.z - closestZ;
  return cdx * cdx + cdz * cdz <= combinedSq;
}

const AXIS_Y = new Vector3(0, 1, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);
const _forward = new Vector3();
const _right = new Vector3();
const _control = new Vector3();
const _target = new Vector3();
const _sample = new Vector3();

export type EntropicCurveDirection = 'left' | 'right' | undefined;

export interface EntropicBezierPoints {
  control: Vector3;
  target: Vector3;
}

export function computeEntropicBezierPoints(
  start: Vector3,
  direction: Vector3,
  curveDirection?: EntropicCurveDirection,
): EntropicBezierPoints {
  _forward.copy(direction).normalize();
  _right.crossVectors(_forward, AXIS_Y);
  if (_right.lengthSq() < 1e-8) {
    _right.copy(FALLBACK_UP).cross(_forward);
  }
  _right.normalize();

  const side = curveDirection === 'right' ? 1 : curveDirection === 'left' ? -1 : 0;

  _control
    .copy(start)
    .add(_forward.clone().multiplyScalar(ENTROPIC_FORWARD_SCALE * 0.5))
    .add(_right.clone().multiplyScalar(ENTROPIC_CURVE_WIDTH * side));

  _target.copy(start).add(_forward.clone().multiplyScalar(ENTROPIC_FORWARD_SCALE));

  return {
    control: _control.clone(),
    target: _target.clone(),
  };
}

export function sampleEntropicBezier(
  start: Vector3,
  control: Vector3,
  target: Vector3,
  t: number,
  out?: Vector3,
): Vector3 {
  const clamped = Math.max(0, Math.min(1, t));
  const inv = 1 - clamped;
  const inv2 = inv * inv;
  const t2 = clamped * clamped;

  _sample
    .copy(start)
    .multiplyScalar(inv2)
    .add(_control.clone().multiplyScalar(2 * inv * clamped))
    .add(_target.clone().multiplyScalar(t2));

  return out ? out.copy(_sample) : _sample.clone();
}

/** Approximate quadratic-bezier arc length via uniform sampling. */
export function approximateEntropicPathLength(
  start: Vector3,
  control: Vector3,
  target: Vector3,
  segments = 32,
): number {
  let length = 0;
  let prev = start.clone();
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const pt = sampleEntropicBezier(start, control, target, t);
    length += prev.distanceTo(pt);
    prev = pt;
  }
  return length;
}

export function getEntropicSpeedAtDistance(distanceTraveled: number): number {
  const progress = Math.min(distanceTraveled / ENTROPIC_ACCEL_DISTANCE, 1);
  return ENTROPIC_START_SPEED + (ENTROPIC_MAX_SPEED - ENTROPIC_START_SPEED) * progress;
}
