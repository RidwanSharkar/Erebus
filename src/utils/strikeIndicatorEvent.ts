import type { WeaponType } from '@/components/dragon/weapons';

export const EREBUS_STRIKE_INDICATOR_EVENT = 'erebus-strike-indicator';

export type ErebusStrikeIndicatorDetail = {
  weapon: WeaponType;
  /** World-space anchor (matches damage numbers height offset). */
  position?: { x: number; y: number; z: number };
};
