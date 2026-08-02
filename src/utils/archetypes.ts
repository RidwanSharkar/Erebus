/** Player archetype — determines what the Shift key does in co-op. */
export type Archetype = 'NONE' | 'ROGUE' | 'GLADIATOR' | 'ACOLYTE' | 'ALCHEMIST' | 'SORCERESS';

export const ARCHETYPE_NONE: Archetype = 'NONE';
export const ARCHETYPE_ROGUE: Archetype = 'ROGUE';
export const ARCHETYPE_GLADIATOR: Archetype = 'GLADIATOR';
export const ARCHETYPE_ACOLYTE: Archetype = 'ACOLYTE';
export const ARCHETYPE_ALCHEMIST: Archetype = 'ALCHEMIST';
export const ARCHETYPE_SORCERESS: Archetype = 'SORCERESS';

/** Selectable throne-room archetypes (excludes NONE). */
export const THRONE_ARCHETYPES = [
  ARCHETYPE_ROGUE,
  ARCHETYPE_GLADIATOR,
  ARCHETYPE_ACOLYTE,
  ARCHETYPE_ALCHEMIST,
  ARCHETYPE_SORCERESS,
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
  ALCHEMIST: {
    id: 'ALCHEMIST',
    label: 'Alchemist',
    shortLabel: 'Alchemist',
    description: 'Toggle Shift to activate Prime Materia.',
    primaryColor: '#22c55e',
    secondaryColor: '#166534',
    accentColor: '#86efac',
  },
  SORCERESS: {
    id: 'SORCERESS',
    label: 'Sorceress',
    shortLabel: 'Sorceress',
    description: 'Hold Shift to charge Incineration. Left-click to fire. Over 90 charge becomes Plasma, draining shield for bonus damage and forward lightning bolts. 2s cooldown after firing.',
    primaryColor: '#f97316',
    secondaryColor: '#b91c1c',
    accentColor: '#fde047',
  },
};

/** Throne-room pedestal trinket GLBs (floating symbol above each archetype pedestal). */
export const ARCHETYPE_TRINKET_MODEL_PATH: Record<ThroneArchetype, string> = {
  ROGUE: '/models/trinket/ROGUETRINKET.glb',
  GLADIATOR: '/models/trinket/GLADIATORTRINKET.glb',
  ACOLYTE: '/models/trinket/ACOLYTETRINKET.glb',
  ALCHEMIST: '/models/trinket/ALCHEMISTTRINKET.glb',
  SORCERESS: '/models/trinket/SORCERESSTRINKET.glb',
};

/**
 * Torus halo + point-light colors for throne archetype pedestals.
 * Optional `pedestal` overrides the stone-cap glow (falls back to `light`).
 * Alchemist: green pedestal aligned with ARCHETYPE_DISPLAY; halo/trinket light stay red.
 * Sorceress uses explicit orange — secondaryColor is too dark on throne-room grass.
 */
export const ARCHETYPE_PEDESTAL_GLOW: Record<
  ThroneArchetype,
  { readonly halo: string; readonly light: string; readonly pedestal?: string }
> = {
  ROGUE: { halo: '#0e7490', light: '#22d3ee' },
  GLADIATOR: { halo: '#b45309', light: '#fbbf24' },
  ACOLYTE: { halo: '#6b21a8', light: '#a855f7' },
  ALCHEMIST: { halo: '#dc2626', light: '#ef4444', pedestal: '#22c55e' },
  SORCERESS: { halo: '#ea580c', light: '#f97316' },
};

export function getArchetypePedestalCapGlow(archetype: ThroneArchetype): string {
  const g = ARCHETYPE_PEDESTAL_GLOW[archetype];
  return g.pedestal ?? g.light;
}

export function isArchetype(value: unknown): value is Archetype {
  return (
    value === 'NONE' ||
    value === 'ROGUE' ||
    value === 'GLADIATOR' ||
    value === 'ACOLYTE' ||
    value === 'ALCHEMIST' ||
    value === 'SORCERESS'
  );
}

export function normalizeArchetype(value: unknown): Archetype {
  if (typeof value !== 'string') return ARCHETYPE_NONE;
  const upper = value.toUpperCase();
  if (isArchetype(upper)) return upper;
  return ARCHETYPE_NONE;
}

export function isSelectableArchetype(value: Archetype): value is ThroneArchetype {
  return (
    value === 'ROGUE' ||
    value === 'GLADIATOR' ||
    value === 'ACOLYTE' ||
    value === 'ALCHEMIST' ||
    value === 'SORCERESS'
  );
}

export const ARCHETYPE_ICON_SRC: Record<ThroneArchetype, string> = {
  ROGUE: '/icons/rogue.webp',
  GLADIATOR: '/icons/gladiator.webp',
  ACOLYTE: '/icons/acolyte.webp',
  ALCHEMIST: '/icons/achemist.webp',
  SORCERESS: '/icons/sorceress.webp',
};

/** SVG variants for crisp rendering in the level badge. */
export const ARCHETYPE_ICON_SVG_SRC: Record<ThroneArchetype, string> = {
  ROGUE: '/icons/rogue.svg',
  GLADIATOR: '/icons/gladiator.svg',
  ACOLYTE: '/icons/acolyte.svg',
  ALCHEMIST: '/icons/alchemist.svg',
  SORCERESS: '/icons/sorceress.svg',
};

export function getArchetypeIconSrc(archetype: Archetype): string | null {
  if (!isSelectableArchetype(archetype)) return null;
  return ARCHETYPE_ICON_SRC[archetype];
}

export function getArchetypeIconSvgSrc(archetype: Archetype): string | null {
  if (!isSelectableArchetype(archetype)) return null;
  return ARCHETYPE_ICON_SVG_SRC[archetype];
}
