import type { CoopRoomKind } from '../contexts/MultiplayerContext';
import { StatSystem } from './StatSystem';

export interface RoomTitleAnnouncement {
  title: string;
  color: string;
  glowColor: string;
}

export const TRIAL_ROOM_PEDESTAL_GOLD = 250;
export const STAT_ROOM_PEDESTAL_POINTS = StatSystem.STAT_ROOM_PEDESTAL_POINTS;
export const BOON_REROLL_GOLD_COST = 50;

export const REWARD_ANNOUNCEMENT_COLORS = {
  gold: '#eab308',
  stat: '#eab308',
  purchased: '#ec4899',
  unlocked: '#c084fc',
} as const;

/** Portal hex colors — keep in sync with ThroneRoom.tsx THRONE_PORTAL_COLOR_HEX. */
const ROOM_TITLE_COLORS = {
  throne: '#eab308',
  merchant: '#ec4899',
  trial: '#f97316',
  stat: '#eab308',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#6c3dff',
  boss: '#dc2626',
} as const;

const COLORED_HALL_BASE: Record<'red' | 'blue' | 'green' | 'purple', string> = {
  red: 'INFERNAL GATE',
  blue: 'TEMPEST GATE',
  green: 'ELDRITCH GATE',
  purple: 'ABYSSAL GATE',
};

const ROMAN_PAIRS: ReadonlyArray<[number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I'],
];

export function toRomanNumeral(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return 'I';
  let remaining = Math.floor(n);
  let result = '';
  for (const [value, numeral] of ROMAN_PAIRS) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result || 'I';
}

export function buildRoomTitleAnnouncement(
  kind: CoopRoomKind | 'throne' | null | undefined,
  visitIndex?: number | null,
): RoomTitleAnnouncement | null {
  if (!kind) return null;

  if (kind === 'throne') {
    return {
      title: 'THRONE ROOM',
      color: ROOM_TITLE_COLORS.throne,
      glowColor: ROOM_TITLE_COLORS.throne,
    };
  }

  if (kind === 'merchant') {
    return {
      title: 'MERCHANT',
      color: ROOM_TITLE_COLORS.merchant,
      glowColor: ROOM_TITLE_COLORS.merchant,
    };
  }

  if (kind === 'trial') {
    return {
      title: 'TRIAL ROOM',
      color: ROOM_TITLE_COLORS.trial,
      glowColor: ROOM_TITLE_COLORS.trial,
    };
  }

  if (kind === 'stat') {
    return {
      title: 'STAT ROOM',
      color: ROOM_TITLE_COLORS.stat,
      glowColor: ROOM_TITLE_COLORS.stat,
    };
  }

  if (kind === 'boss') {
    const index = visitIndex != null && visitIndex > 0 ? visitIndex : 1;
    return {
      title: `CHAMBER OF DEATH ${toRomanNumeral(index)}`,
      color: ROOM_TITLE_COLORS.boss,
      glowColor: ROOM_TITLE_COLORS.boss,
    };
  }

  if (kind === 'red' || kind === 'blue' || kind === 'green' || kind === 'purple') {
    const color = ROOM_TITLE_COLORS[kind];
    const index = visitIndex != null && visitIndex > 0 ? visitIndex : 1;
    return {
      title: `${COLORED_HALL_BASE[kind]} ${toRomanNumeral(index)}`,
      color,
      glowColor: color,
    };
  }

  return null;
}
