/** Shared sci-fi HUD chrome tokens for resource bars and panels. */

import type { Archetype } from '@/utils/archetypes';

export const BAR_HEIGHT = 30;

/** Slanted right edge — bars emerge from the XP medallion on the left. */
export const RESOURCE_BAR_CLIP =
  'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)';

export const RESOURCE_BAR_TRACK_CLIP =
  'polygon(1px 1px, calc(100% - 17px) 1px, calc(100% - 1px) 50%, calc(100% - 17px) calc(100% - 1px), 1px calc(100% - 1px))';

export const HUD_PANEL_CLIP =
  'polygon(16px 0%, calc(100% - 16px) 0%, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0% calc(100% - 16px), 0% 16px)';

export const HUD_PANEL_BG =
  'linear-gradient(180deg, rgba(8,10,22,0.94) 0%, rgba(4,5,14,0.97) 100%)';

export const HUD_PANEL_BORDER = '1px solid rgba(80,120,200,0.22)';

export const HUD_PANEL_SHADOW =
  '0 8px 40px rgba(0,0,0,0.8), 0 0 80px rgba(40,80,160,0.1), inset 0 1px 0 rgba(255,255,255,0.06)';

/** Integrated LevelBadge outer diameter (128px ring + 14px frame padding). */
export const INTEGRATED_LEVEL_BADGE_OUTER_SIZE = 142;
/** LevelBadge -mr-5 overlap with the resource bars column. */
export const LEVEL_BADGE_OVERLAP = 20;
/** Left offset for resource bars when the integrated level badge is shown. */
export const LEVEL_BADGE_BARS_OFFSET =
  8 + INTEGRATED_LEVEL_BADGE_OUTER_SIZE - LEVEL_BADGE_OVERLAP + 8;

export const BAR_FRAME_GRADIENT =
  'linear-gradient(180deg, rgba(80,90,120,0.55) 0%, rgba(20,24,36,0.95) 45%, rgba(8,10,18,0.98) 100%)';

export const BAR_TRACK_GRADIENT =
  'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(12,14,24,0.92) 100%)';

/** Subtle hex/honeycomb overlay for bar interiors. */
export const HEX_PATTERN_BG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='24' viewBox='0 0 28 24'>
    <path d='M14 0l12 7v10l-12 7L2 17V7z' fill='none' stroke='rgba(120,160,220,0.07)' stroke-width='0.6'/>
    <path d='M0 12l12-7v10l-12 7V12z' fill='none' stroke='rgba(120,160,220,0.05)' stroke-width='0.6'/>
    <path d='M28 12l-12-7v10l12 7V12z' fill='none' stroke='rgba(120,160,220,0.05)' stroke-width='0.6'/>
  </svg>`,
)}")`;

export const TICKS = [25, 50, 75] as const;

/** Hotkey weapon portrait — rounded square, slightly larger than 48px hotkey slots. */
export const WEAPON_PORTRAIT_SIZE = 66;
export const WEAPON_PORTRAIT_FRAME_PADDING = 4;
export const WEAPON_PORTRAIT_RADIUS = 10;

export type ResourceBarKind = 'shield' | 'health' | 'energy';

export const RESOURCE_BAR_THEMES: Record<
  ResourceBarKind,
  {
    label: string;
    gradientFrom: string;
    gradientTo: string;
    glowColor: string;
    icon: string;
  }
> = {
  shield: {
    label: 'Shields',
    gradientFrom: '#1a3fa8',
    gradientTo: '#60b8f8',
    glowColor: '#4A90E2',
    icon: '/icons/aegis.svg',
  },
  health: {
    label: 'Health',
    gradientFrom: '#7a1010',
    gradientTo: '#ef5050',
    glowColor: '#DC2626',
    icon: '/icons/rejuvShot.svg',
  },
  energy: {
    label: 'Energy',
    gradientFrom: '#5a2080',
    gradientTo: '#b060f0',
    glowColor: '#9333EA',
    icon: '/icons/storedCharge.svg',
  },
};

export type ResourceBarTheme = (typeof RESOURCE_BAR_THEMES)[ResourceBarKind];

const ENERGY_BAR_THEME_YELLOW: ResourceBarTheme = {
  label: 'Energy',
  gradientFrom: '#7a5a08',
  gradientTo: '#f0c040',
  glowColor: '#EAB308',
  icon: '/icons/storedCharge.svg',
};

const ENERGY_BAR_THEME_PURPLE: ResourceBarTheme = RESOURCE_BAR_THEMES.energy;

const ENERGY_BAR_THEME_ORANGE: ResourceBarTheme = {
  label: 'Energy',
  gradientFrom: '#9a3412',
  gradientTo: '#f97316',
  glowColor: '#F97316',
  icon: '/icons/storedCharge.svg',
};

export function getResourceBarTheme(
  kind: ResourceBarKind,
  archetype?: Archetype,
): ResourceBarTheme {
  if (kind !== 'energy') {
    return RESOURCE_BAR_THEMES[kind];
  }

  switch (archetype) {
    case 'ROGUE':
    case 'GLADIATOR':
      return ENERGY_BAR_THEME_YELLOW;
    case 'ALCHEMIST':
    case 'ACOLYTE':
      return ENERGY_BAR_THEME_PURPLE;
    case 'SORCERESS':
      return ENERGY_BAR_THEME_ORANGE;
    default:
      return ENERGY_BAR_THEME_PURPLE;
  }
}
