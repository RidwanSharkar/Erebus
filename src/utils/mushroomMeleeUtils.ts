import { Vector3 } from '@/utils/three-exports';
import { MELEE_ARC_MIN_DOT } from './meleeArcConstants';
import { MUSHROOM_MELEE_RANGE } from './mushroomConstants';

export interface MushroomMeleeTarget {
  index: number;
  position: Vector3;
  /** When set, effective range is `distance - radius` (trunk-plus trees). */
  radius?: number;
}

/**
 * Co-op: same spatial rules as Sword/Runeblade `performSwingDamage` (range + combo-3 full sphere).
 */
export function forEachMushroomHitBySwing(
  playerPosition: Vector3,
  playerYaw: number,
  comboStep: 1 | 2 | 3,
  mushrooms: MushroomMeleeTarget[] | undefined,
  onHit: (index: number) => void,
  now: number,
  lastHitTime: Record<string, number>,
  hitCooldownMs: number = 100,
  cooldownKeyPrefix: string = 'mushroom',
): void {
  if (!mushrooms?.length) return;
  for (const m of mushrooms) {
    if (!m.position) continue;
    const key = `${cooldownKeyPrefix}-${m.index}`;
    if (now - (lastHitTime[key] || 0) < hitCooldownMs) continue;
    const surfaceDist = Math.max(0, playerPosition.distanceTo(m.position) - (m.radius ?? 0));
    if (surfaceDist > MUSHROOM_MELEE_RANGE) continue;
    if (comboStep === 3) {
      lastHitTime[key] = now;
      onHit(m.index);
      continue;
    }
    const forward = new Vector3(Math.sin(playerYaw), 0, Math.cos(playerYaw));
    const toT = m.position.clone().sub(playerPosition);
    toT.y = 0;
    if (toT.lengthSq() < 1e-8) {
      lastHitTime[key] = now;
      onHit(m.index);
      continue;
    }
    toT.normalize();
    const dot = toT.dot(forward);
    if (dot > MELEE_ARC_MIN_DOT) {
      lastHitTime[key] = now;
      onHit(m.index);
    }
  }
}
