/** Keep in sync with `backend/gameRoom.js` defense tower constants. */

export const DEFENSE_ROOM_SCALE = 1.35;
export const DEFENSE_TOWER_TRIANGLE_RADIUS = 7;
export const DEFENSE_TOWER_HULL_RADIUS = 1.4;
export const DEFENSE_SPAWN_DISTANCE = 12;
export const DEFENSE_WAVE_COUNT = 20;
/** Bolt spawn height (tower crown). Keep in sync with `DefenseTower.tsx`. */
export const DEFENSE_TOWER_MUZZLE_Y = 10.0;
/** Chest-height impact so shots travel downward from the orb. */
export const DEFENSE_TOWER_IMPACT_Y = 1.0;

const SE_X = DEFENSE_TOWER_TRIANGLE_RADIUS * Math.sqrt(3) / 2;
const SE_Z = -DEFENSE_TOWER_TRIANGLE_RADIUS / 2;

export type DefenseTowerSlot = 'n' | 'se' | 'sw';
export type DefenseTowerAttackKind = 'bolt';

export type DefenseTowerDef = {
  id: string;
  slot: DefenseTowerSlot;
  x: number;
  z: number;
};

export type DefenseTowerAttackProfile = {
  kind: DefenseTowerAttackKind;
  damage: number;
  cooldownMs: number;
  range: number;
  impactDelayMs: number;
};

export type DefenseTowerBoltTheme = {
  primary: string;
  secondary: string;
  light: string;
};

export const DEFENSE_TOWER_BOLT_THEMES: Record<DefenseTowerSlot, DefenseTowerBoltTheme> = {
  n: { primary: '#f87171', secondary: '#fecaca', light: '#fecaca' },
  se: { primary: '#d8b4fe', secondary: '#f3e8ff', light: '#e9d5ff' },
  sw: { primary: '#60a5fa', secondary: '#bfdbfe', light: '#93c5fd' },
};

const BOLT_PROFILE: DefenseTowerAttackProfile = {
  kind: 'bolt',
  damage: 150,
  cooldownMs: 1500,
  range: 8,
  impactDelayMs: 280,
};

export const DEFENSE_TOWER_ATTACK_PROFILES: Record<string, DefenseTowerAttackProfile> = {
  'defense-tower-n': { ...BOLT_PROFILE },
  'defense-tower-sw': { ...BOLT_PROFILE },
  'defense-tower-se': { ...BOLT_PROFILE },
};

export const DEFENSE_TOWER_DEFS: readonly DefenseTowerDef[] = Object.freeze([
  Object.freeze({ id: 'defense-tower-n', slot: 'n' as const, x: 0, z: DEFENSE_TOWER_TRIANGLE_RADIUS }),
  Object.freeze({ id: 'defense-tower-se', slot: 'se' as const, x: SE_X, z: SE_Z }),
  Object.freeze({ id: 'defense-tower-sw', slot: 'sw' as const, x: -SE_X, z: SE_Z }),
]);

export function getDefenseTowerSlot(id: string): DefenseTowerSlot | null {
  if (id === 'defense-tower-n') return 'n';
  if (id === 'defense-tower-se') return 'se';
  if (id === 'defense-tower-sw') return 'sw';
  return null;
}

export function getDefenseTowerObstacles(): Array<{ x: number; z: number; radius: number }> {
  return DEFENSE_TOWER_DEFS.map((d) => ({
    x: d.x,
    z: d.z,
    radius: DEFENSE_TOWER_HULL_RADIUS,
  }));
}
