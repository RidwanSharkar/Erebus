import type { WraithStrikeTheme } from '@/utils/talents';
import {
  ASPECT_DEATHDEALER,
  ASPECT_ROYAL_GUARD,
  type WeaponAspect,
} from '@/utils/weaponAspects';

export type WraithStrikeColorPalette = {
  main: string;
  emissive: string;
  inner: string;
  outer: string;
  particle: string;
  light: string;
  flash: string;
};

/** Aspect fallback when no Wraith Strike talent theme is active. */
export function getAspectDefaultWraithStrikeTheme(
  aspect: WeaponAspect | null | undefined,
): WraithStrikeTheme {
  if (aspect === ASPECT_ROYAL_GUARD || aspect === ASPECT_DEATHDEALER) {
    return 'guard';
  }
  return 'default';
}

const PALETTES: Record<WraithStrikeTheme, WraithStrikeColorPalette> = {
  default: {
    main: '#7F67C7',
    emissive: '#4027B0',
    inner: '#e1bee7',
    outer: '#9693D9',
    particle: '#e1bee7',
    light: '#4300FA',
    flash: '#E7E4F5',
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
