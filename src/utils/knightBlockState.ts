/** Client-side knight block windows — synced from `knight-block-telegraph` (matches server `isKnightBlocking`). */

const blockActiveUntil = new Map<string, number>();

export function registerKnightBlock(
  knightId: string,
  durationMs: number,
  timestamp: number = Date.now(),
): void {
  const until = timestamp + durationMs;
  const prev = blockActiveUntil.get(knightId) ?? 0;
  blockActiveUntil.set(knightId, Math.max(prev, until));
}

export function isKnightBlocking(knightId: string, now: number = Date.now()): boolean {
  const until = blockActiveUntil.get(knightId);
  return !!until && now < until;
}

/** Ignite and venom bypass knight block (matches `gameRoom.damageEnemy`). */
export function knightBlockBypassesDamageType(damageType?: string): boolean {
  return damageType === 'ignite' || damageType === 'venom';
}

export function clearKnightBlock(knightId: string): void {
  blockActiveUntil.delete(knightId);
}
