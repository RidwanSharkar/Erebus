/** Short-lived stamps so CombatSystem harvest floats are not doubled by the server `*-damaged` echo. */

export type HarvestFloatKind = 'tree' | 'root' | 'rock' | 'spine' | 'mushroom';

const STAMP_TTL_MS = 1500;
const stamps = new Map<string, number>();

function stampKey(kind: HarvestFloatKind, index: number): string {
  return `${kind}:${index}`;
}

export function stampLocalHarvestDamageFloat(kind: HarvestFloatKind, index: number): void {
  stamps.set(stampKey(kind, index), Date.now() + STAMP_TTL_MS);
}

/** True if CombatSystem already spawned a local float for this harvest hit. */
export function consumeLocalHarvestDamageFloat(kind: HarvestFloatKind, index: number): boolean {
  const key = stampKey(kind, index);
  const until = stamps.get(key);
  if (until == null) return false;
  stamps.delete(key);
  return until >= Date.now();
}
