import type { MortalStrikeTheme } from '@/utils/talents';

export type MortalStrikeColorPalette = {
  main: string;
  emissive: string;
  inner: string;
  outer: string;
  particle: string;
  light: string;
  flash: string;
};

const PALETTES: Record<MortalStrikeTheme, MortalStrikeColorPalette> = {
  default: {
    main: '#FF9748',
    emissive: '#FF6F00',
    inner: '#FF9748',
    outer: '#FF9748',
    particle: '#FF9748',
    light: '#FF9748',
    flash: '#FFE0B2',
  },
  wrathful: {
    main: '#ff5252',
    emissive: '#ff1744',
    inner: '#ffcdd2',
    outer: '#ff5252',
    particle: '#ffcdd2',
    light: '#ff1744',
    flash: '#ffe0e0',
  },
  staggering: {
    main: '#42a5f5',
    emissive: '#1e88e5',
    inner: '#b3e5fc',
    outer: '#42a5f5',
    particle: '#7ecbff',
    light: '#42a5f5',
    flash: '#e3f2fd',
  },
  infested: {
    main: '#50FF28',
    emissive: '#22CC11',
    inner: '#D8FF75',
    outer: '#50FF28',
    particle: '#B7FF55',
    light: '#66FF33',
    flash: '#F4FFAA',
  },
  wraith_guard: {
    main: '#ba68c8',
    emissive: '#9c27b0',
    inner: '#e1bee7',
    outer: '#ba68c8',
    particle: '#e1bee7',
    light: '#d500f9',
    flash: '#f3e5f5',
  },
};

export function parseMortalStrikeTheme(raw: string | undefined): MortalStrikeTheme {
  if (raw === 'wrathful' || raw === 'staggering' || raw === 'infested' || raw === 'wraith_guard') {
    return raw;
  }
  return 'default';
}

export function getMortalStrikeColorPalette(theme: MortalStrikeTheme | string | undefined): MortalStrikeColorPalette {
  return PALETTES[parseMortalStrikeTheme(theme)];
}
