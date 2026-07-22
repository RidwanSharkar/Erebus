/** Titans cannot be stunned or frozen by player abilities. */
export function isImmuneToPlayerStunAndFreeze(coopServerEnemyType?: string | null): boolean {
  return coopServerEnemyType === 'titan';
}
