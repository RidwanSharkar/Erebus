import type { CoopRoomKind } from '../contexts/MultiplayerContext';
import { StatSystem, type StatKey } from './StatSystem';

export interface RoomTitleAnnouncement {
  title: string;
  color: string;
  glowColor: string;
}

export const TRIAL_ROOM_PEDESTAL_GOLD = 250;
export const STAT_ROOM_PEDESTAL_POINTS = StatSystem.STAT_ROOM_PEDESTAL_POINTS;
export const BOON_REROLL_FATE_COST = 1;
export const STARTING_FATE = 3;

export const ROOM_TITLE_ANNOUNCEMENT_MS = 4100;

export const REWARD_ANNOUNCEMENT_COLORS = {
  gold: '#eab308',
  stat: '#f97316',
  purchased: '#ec4899',
  unlocked: '#c084fc',
} as const;

export const INTRO_ROOM_GOLD_REWARDS = [50, 75, 100, 0] as const;
export const SUNKEN_ROOM_GOLD_REWARDS = INTRO_ROOM_GOLD_REWARDS;
export const ETERNITY_ROOM_GOLD_REWARDS = [50, 75, 0, 75, 0] as const;
export const FAE_REALM_ROOM_GOLD_REWARDS = [40, 60, 80] as const;
export const DEEP_SANCTUM_STAT_POINTS = 8;
export const DEEP_SANCTUM_GOLD_MIN = 150;

export const GUIDE_ANNOUNCEMENTS = {
  chooseWeapon: { title: 'CHOOSE YOUR WEAPON', color: '#eab308' },
  enterPortal: { title: 'ENTER A PORTAL', color: '#eab308' },
  descendPortal: { title: 'DESCEND', color: '#c084fc' },
  drinkFountain: { title: 'DRINK FROM THE FOUNTAIN', color: '#22d3ee' },
  chooseAlly: { title: 'REVIVE AN ANCESTOR', color: '#eab308' },
  speakWithArchitect: { title: 'SPEAK WITH THE ARCHITECT', color: '#88ddff' },
  empowerSpiritAnimal: { title: 'EMPOWER YOUR SPIRIT ANIMAL', color: '#34d399' },
  claimReward: { title: 'CLAIM YOUR REWARD', color: '#94a3b8' },
  chooseGateway: { title: 'CHOOSE A GATEWAY', color: '#94a3b8' },
  descendVoid: { title: 'DESCEND', color: '#c084fc' },
  killSpines: { title: 'DESTROY THE SPINES', color: '#ef4444' },
  defendStructure: { title: 'DEFEND THE STRUCTURE', color: '#f59e0b' },
  defeatChampion: { title: 'DEFEAT THE CHAMPION', color: '#dc2626' },
  deliriumSuccess: { title: 'STRUCTURE HELD — REWARD EARNED', color: '#22c55e' },
  deliriumFailed: { title: 'CLEAR THE GHOULS', color: '#ef4444' },
} as const;

export const LEVEL_UP_ANNOUNCEMENT = { title: 'LEVEL UP', color: '#eab308' } as const;

export function buildRunePickupAnnouncement(stat: StatKey): { title: string; color: string } {
  return {
    title: `+1 ${stat.toUpperCase()}`,
    color: StatSystem.getStatColor(stat),
  };
}

export type BossSlainLabel = 'hate' | 'knights' | 'envy' | 'fear' | 'destiny' | 'trinity';

export const BOSS_SLAIN_ANNOUNCEMENTS: Record<
  BossSlainLabel,
  { title: string; color: string }
> = {
  hate: { title: 'HATE SLAIN', color: '#dc2626' },
  knights: { title: 'TWIN EMPERORS SLAIN', color: '#dc2626' },
  envy: { title: 'ENVY SLAIN', color: '#22c55e' },
  fear: { title: 'FEAR SLAIN', color: '#6c3dff' },
  destiny: { title: 'DESTINY SLAIN', color: '#f59e0b' },
  trinity: { title: 'TRINITY SLAIN', color: '#dc2626' },
};

/** Portal hex colors — keep in sync with ThroneRoom.tsx THRONE_PORTAL_COLOR_HEX. */
const ROOM_TITLE_COLORS = {
  throne: '#eab308',
  merchant: '#ec4899',
  trial: '#eab308',
  stat: '#f97316',
  red: '#ef4444',
  blue: '#3b82f6',
  green: '#22c55e',
  purple: '#B18BFF',
  boss: '#dc2626',
  intro: '#f5e6b8',
  sunken: '#7dd3fc',
  eternity: '#f97316',
  fae: '#f9a8d4',
  explore: '#ef4444',
  defense: '#3b82f6',
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
      title: 'AVERNUS',
      color: ROOM_TITLE_COLORS.merchant,
      glowColor: ROOM_TITLE_COLORS.merchant,
    };
  }

  if (kind === 'trial') {
    return {
      title: 'CRYPT OF CURRENCY',
      color: ROOM_TITLE_COLORS.trial,
      glowColor: ROOM_TITLE_COLORS.trial,
    };
  }

  if (kind === 'stat') {
    return {
      title: 'CRYPT OF SKILL',
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

  if (kind === 'intro') {
    const index = visitIndex != null && visitIndex > 0 ? visitIndex : 1;
    return {
      title: `INNER SANCTUM ${toRomanNumeral(index)}`,
      color: ROOM_TITLE_COLORS.intro,
      glowColor: ROOM_TITLE_COLORS.intro,
    };
  }

  if (kind === 'fae_realm') {
    const index = visitIndex != null && visitIndex > 0 ? visitIndex : 1;
    return {
      title: `FAE REALM ${toRomanNumeral(index)}`,
      color: ROOM_TITLE_COLORS.fae,
      glowColor: '#ec4899',
    };
  }

  if (kind === 'explore') {
    return {
      title: 'THE WILDS',
      color: ROOM_TITLE_COLORS.explore,
      glowColor: '#dc2626',
    };
  }

  if (kind === 'defense') {
    return {
      title: 'THRONE DEFENSE',
      color: ROOM_TITLE_COLORS.defense,
      glowColor: '#3b82f6',
    };
  }

  if (kind === 'deep_sanctum') {
    const index = visitIndex != null && visitIndex > 0 ? visitIndex : 5;
    return {
      title: `INNER SANCTUM ${toRomanNumeral(index)}`,
      color: ROOM_TITLE_COLORS.intro,
      glowColor: ROOM_TITLE_COLORS.intro,
    };
  }

  if (kind === 'sunken_temple') {
    const index = visitIndex != null && visitIndex > 0 ? visitIndex : 1;
    return {
      title: `SUNKEN TEMPLE ${toRomanNumeral(index)}`,
      color: ROOM_TITLE_COLORS.sunken,
      glowColor: ROOM_TITLE_COLORS.sunken,
    };
  }

  if (kind === 'eternity_palace') {
    const index = visitIndex != null && visitIndex > 0 ? visitIndex : 1;
    return {
      title: `ETERNITY'S PALACE ${toRomanNumeral(index)}`,
      color: ROOM_TITLE_COLORS.eternity,
      glowColor: ROOM_TITLE_COLORS.eternity,
    };
  }

  if (kind === 'eden' || kind === 'eden_finale') {
    return {
      title: 'EDEN',
      color: '#86efac',
      glowColor: '#22c55e',
    };
  }

  if (kind === 'false_eden') {
    return {
      title: 'DISTORTED EDEN',
      color: '#86efac',
      glowColor: '#22c55e',
    };
  }

  if (kind === 'delirium_gate') {
    return {
      title: 'DELIRIUM GATE',
      color: '#f59e0b',
      glowColor: '#dc2626',
    };
  }

  if (kind === 'erebus_gate') {
    return {
      title: 'EREBUS GATE',
      color: '#d4a574',
      glowColor: '#991b1b',
    };
  }

  if (kind === 'dream_layer') {
    return {
      title: 'DREAM LAYER',
      color: '#9ad8ff',
      glowColor: '#3b82f6',
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
