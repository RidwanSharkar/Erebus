import type { WraithStrikeImpactTalentProps } from '@/components/weapons/RunebladeWraithStrikeImpact';

export type AftershockPaletteKey = 'default' | 'wrathful' | 'infested' | 'wraith_guard' | 'staggering';

export type AftershockColorPalette = {
  ground: string;
  ember: string;
  fissure: string;
  pillar: string;
  pillarOuter: string;
  shockwave: string;
  blastCore: string;
  spark: string;
  light: string;
};

const PALETTES: Record<AftershockPaletteKey, AftershockColorPalette> = {
  default: {
    ground: '#0a3340',
    ember: '#1097B5',
    fissure: '#60e8ff',
    pillar: '#d0f8ff',
    pillarOuter: '#1097B5',
    shockwave: '#7ecbff',
    blastCore: '#e8fcff',
    spark: '#60e8ff',
    light: '#60e8ff',
  },
  infested: {
    ground: '#173800',
    ember: '#50FF28',
    fissure: '#D8FF75',
    pillar: '#D7FF72',
    pillarOuter: '#22CC11',
    shockwave: '#BCFF65',
    blastCore: '#F4FFAA',
    spark: '#B7FF55',
    light: '#66FF33',
  },
  wrathful: {
    ground: '#3d0a0a',
    ember: '#ff5252',
    fissure: '#ffcdd2',
    pillar: '#ffffff',
    pillarOuter: '#ff1744',
    shockwave: '#ff8a80',
    blastCore: '#ffe0e0',
    spark: '#ffcdd2',
    light: '#ff1744',
  },
  staggering: {
    ground: '#0a2840',
    ember: '#42a5f5',
    fissure: '#b3e5fc',
    pillar: '#ffffff',
    pillarOuter: '#1e88e5',
    shockwave: '#90caf9',
    blastCore: '#e3f2fd',
    spark: '#7ecbff',
    light: '#42a5f5',
  },
  wraith_guard: {
    ground: '#2a0a3d',
    ember: '#ba68c8',
    fissure: '#e1bee7',
    pillar: '#fce4ec',
    pillarOuter: '#9c27b0',
    shockwave: '#ce93d8',
    blastCore: '#f3e5f5',
    spark: '#e1bee7',
    light: '#d500f9',
  },
};

export function resolveAftershockPaletteKey(
  meta: WraithStrikeImpactTalentProps,
): AftershockPaletteKey {
  if (meta.wrathfulStrike) return 'wrathful';
  if (meta.infestedStrike) return 'infested';
  if (meta.wraithGuard) return 'wraith_guard';
  if (meta.staggeringStrike) return 'staggering';
  return 'default';
}

export function getAftershockColorPalette(
  meta: WraithStrikeImpactTalentProps,
): AftershockColorPalette {
  return PALETTES[resolveAftershockPaletteKey(meta)];
}
