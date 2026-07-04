import type { WraithStrikeTheme } from '@/utils/talents';

export type WraithStrikeColorPalette = {
  main: string;
  emissive: string;
  inner: string;
  outer: string;
  particle: string;
  light: string;
  flash: string;
};

const PALETTES: Record<WraithStrikeTheme, WraithStrikeColorPalette> = {
  default: {
    main: '#ba68c8',
    emissive: '#9c27b0',
    inner: '#e1bee7',
    outer: '#ce93d8',
    particle: '#e1bee7',
    light: '#d500f9',
    flash: '#f3e5f5',
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
  infested: {
    main: '#50FF28',
    emissive: '#22CC11',
    inner: '#D8FF75',
    outer: '#50FF28',
    particle: '#B7FF55',
    light: '#66FF33',
    flash: '#F4FFAA',
  },
  guard: {
    main: '#ff8c00',
    emissive: '#e65100',
    inner: '#ffe033',
    outer: '#ffb300',
    particle: '#ffe082',
    light: '#ffab00',
    flash: '#fff8e1',
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
};

export function parseWraithStrikeTheme(raw: string | undefined): WraithStrikeTheme {
  if (raw === 'wrathful' || raw === 'infested' || raw === 'guard' || raw === 'staggering') {
    return raw;
  }
  return 'default';
}

export function getWraithStrikeColorPalette(
  theme: WraithStrikeTheme | string | undefined,
): WraithStrikeColorPalette {
  return PALETTES[parseWraithStrikeTheme(theme)];
}
