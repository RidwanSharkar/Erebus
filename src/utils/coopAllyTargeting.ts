export type CoopAllyKind = 'knight' | 'huntress' | 'phantom' | 'demon' | 'enchantress';

const COOP_ALLY_KINDS: readonly CoopAllyKind[] = ['knight', 'huntress', 'phantom', 'demon', 'enchantress'];

export function parseCoopAllyKind(kind: string | null | undefined): CoopAllyKind {
  const k = String(kind || '').toLowerCase();
  return COOP_ALLY_KINDS.includes(k as CoopAllyKind) ? (k as CoopAllyKind) : 'knight';
}

/** Co-op player-owned allies — not valid targets for player attacks or debuffs. */
export function isCoopPlayerAllyEntity(entity: {
  userData?: { isCoopAlliedUnit?: boolean; coopServerEnemyType?: string };
}): boolean {
  if (entity.userData?.isCoopAlliedUnit === true) return true;
  const t = entity.userData?.coopServerEnemyType;
  return t === 'player-zombie'
    || t === 'allied-knight'
    || t === 'allied-huntress'
    || t === 'allied-phantom'
    || t === 'allied-demon'
    || t === 'allied-enchantress'
    || t === 'allied-healer';
}
