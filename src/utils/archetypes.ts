/** Player archetype — determines what the Shift key does in co-op. */
export type Archetype = 'NONE' | 'ROGUE' | 'GLADIATOR' | 'ACOLYTE';

export const ARCHETYPE_NONE: Archetype = 'NONE';
export const ARCHETYPE_ROGUE: Archetype = 'ROGUE';
export const ARCHETYPE_GLADIATOR: Archetype = 'GLADIATOR';
export const ARCHETYPE_ACOLYTE: Archetype = 'ACOLYTE';

/** Selectable throne-room archetypes (excludes NONE). */
export const THRONE_ARCHETYPES = [
  ARCHETYPE_ROGUE,
  ARCHETYPE_GLADIATOR,
  ARCHETYPE_ACOLYTE,
] as const;

export type ThroneArchetype = (typeof THRONE_ARCHETYPES)[number];

export interface ArchetypeDisplayMeta {
  readonly id: ThroneArchetype;
  readonly label: string;
  readonly shortLabel: string;
  readonly description: string;
  readonly primaryColor: string;
  readonly secondaryColor: string;
  readonly accentColor: string;
}

export const ARCHETYPE_DISPLAY: Record<ThroneArchetype, ArchetypeDisplayMeta> = {
  ROGUE: {
    id: 'ROGUE',
    label: 'Rogue',
    shortLabel: 'Rogue',
    description: 'Hold Shift to sprint.',
    primaryColor: '#22d3ee',
    secondaryColor: '#0e7490',
    accentColor: '#67e8f9',
  },
  GLADIATOR: {
    id: 'GLADIATOR',
    label: 'Gladiator',
    shortLabel: 'Gladiator',
    description: 'Press Shift to deflect.',
    primaryColor: '#fbbf24',
    secondaryColor: '#b45309',
    accentColor: '#fde68a',
  },
  ACOLYTE: {
    id: 'ACOLYTE',
    label: 'Acolyte',
    shortLabel: 'Acolyte',
    description: 'Hold Shift to channel Locusts.',
    primaryColor: '#a855f7',
    secondaryColor: '#6b21a8',
    accentColor: '#d8b4fe',
  },
};

export function isArchetype(value: unknown): value is Archetype {
  return (
    value === 'NONE' ||
    value === 'ROGUE' ||
    value === 'GLADIATOR' ||
    value === 'ACOLYTE'
  );
}

export function normalizeArchetype(value: unknown): Archetype {
  if (typeof value !== 'string') return ARCHETYPE_NONE;
  const upper = value.toUpperCase();
  if (isArchetype(upper)) return upper;
  return ARCHETYPE_NONE;
}

export function isSelectableArchetype(value: Archetype): value is ThroneArchetype {
  return value === 'ROGUE' || value === 'GLADIATOR' || value === 'ACOLYTE';
}

export const ARCHETYPE_ICON_SRC: Record<ThroneArchetype, string> = {
  ROGUE: '/icons/rogue.svg',
  GLADIATOR: '/icons/gladiator.svg',
  ACOLYTE: '/icons/acolyte.svg',
};

export function getArchetypeIconSrc(archetype: Archetype): string | null {
  if (!isSelectableArchetype(archetype)) return null;
  return ARCHETYPE_ICON_SRC[archetype];
}
