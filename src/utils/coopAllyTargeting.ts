/** Co-op player-owned allies — not valid targets for player attacks or debuffs. */
export function isCoopPlayerAllyEntity(entity: {
  userData?: { isCoopAlliedUnit?: boolean; coopServerEnemyType?: string };
}): boolean {
  if (entity.userData?.isCoopAlliedUnit === true) return true;
  const t = entity.userData?.coopServerEnemyType;
  return t === 'player-zombie' || t === 'allied-knight' || t === 'allied-healer';
}
