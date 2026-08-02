import { Vector3 } from 'three';

/** Shared pending-miss timers for knight-style melee (allies, ghouls, player-zombies). */
const pendingMissTimers = new Map<string, ReturnType<typeof setTimeout>>();
let damageVariant: 1 | 2 = 1;

type Vec3Like = { x: number; y?: number; z: number };

function toVector3(pos: Vector3 | Vec3Like): Vector3 {
  if (pos instanceof Vector3) return pos;
  return new Vector3(pos.x, pos.y ?? 0, pos.z);
}

/** Schedule a miss whoosh; cancelled if a hit confirms first. */
export function scheduleKnightStyleMiss(
  attackerId: string,
  position: Vector3 | Vec3Like,
  delayMs = 1100,
  onMiss?: () => void,
) {
  if (!attackerId) return;
  const existing = pendingMissTimers.get(attackerId);
  if (existing) clearTimeout(existing);
  const pos = toVector3(position);
  const timer = setTimeout(() => {
    pendingMissTimers.delete(attackerId);
    window.audioSystem?.playKnightMissSound(pos);
    onMiss?.();
  }, delayMs);
  pendingMissTimers.set(attackerId, timer);
}

/** Cancel a pending miss. Returns true if a timer was cleared. */
export function cancelKnightStyleMiss(attackerId: string | undefined | null): boolean {
  if (!attackerId) return false;
  const timer = pendingMissTimers.get(attackerId);
  if (!timer) return false;
  clearTimeout(timer);
  pendingMissTimers.delete(attackerId);
  return true;
}

export function playKnightStyleHit(position: Vector3 | Vec3Like) {
  const pos = toVector3(position);
  window.audioSystem?.playKnightDamageSound(pos, damageVariant);
  damageVariant = damageVariant === 1 ? 2 : 1;
}

export function clearAllKnightStyleMissTimers() {
  pendingMissTimers.forEach(clearTimeout);
  pendingMissTimers.clear();
}
