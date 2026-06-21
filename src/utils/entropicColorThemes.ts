export type EntropicColorVariant = 'rosegold' | 'purple' | 'blue' | 'red' | 'green' | 'arctic';

/** Default Scythe LMB Entropic Bolt palette before a colored room boon is obtained. */
export const DEFAULT_ENTROPIC_COLOR_VARIANT: EntropicColorVariant = 'rosegold';

export type EntropicColorTheme = {
  primary: string;
  secondary: string;
  light: string;
};

const BASE_THEMES: Record<EntropicColorVariant, EntropicColorTheme> = {
  rosegold: { primary: '#d4849a', secondary: '#f0b8c8', light: '#fde0ea' },
  red: { primary: '#ef4444', secondary: '#fca5a5', light: '#fecaca' },
  blue: { primary: '#3b82f6', secondary: '#93c5fd', light: '#93c5fd' },
  green: { primary: '#22c55e', secondary: '#86efac', light: '#bbf7d0' },
  purple: { primary: '#9333ea', secondary: '#c084fc', light: '#e9d5ff' },
  arctic: { primary: '#0c4a6e', secondary: '#0284c7', light: '#7dd3fc' },
};

const CRYOFLAME_THEME: EntropicColorTheme = {
  primary: '#1e40af',
  secondary: '#3b82f6',
  light: '#60a5fa',
};

/** Normalize bolt / talent / room strings into a canonical entropic palette key. */
export function parseEntropicColorVariant(
  raw: string | undefined,
): EntropicColorVariant {
  switch (raw) {
    case 'red':
    case 'wrathful':
      return 'red';
    case 'blue':
    case 'staggering':
      return 'blue';
    case 'green':
    case 'infesting':
    case 'infested':
      return 'green';
    case 'purple':
    case 'wraith_guard':
      return 'purple';
    case 'arctic':
      return 'arctic';
    case 'rosegold':
    default:
      return 'rosegold';
  }
}

export function getEntropicColorTheme(
  variant: EntropicColorVariant | string | undefined,
  isCryoflame = false,
): EntropicColorTheme {
  if (isCryoflame) return CRYOFLAME_THEME;
  return BASE_THEMES[parseEntropicColorVariant(variant)];
}

/** Beam VFX: map bolt palette to color + emissive pair. */
export function getEntropicBeamColors(variant: EntropicColorVariant): { color: string; emissive: string } {
  const theme = getEntropicColorTheme(variant);
  return { color: theme.primary, emissive: theme.light };
}

export type EntropicExplosionColors = {
  core: string;
  coreEmissive: string;
  inner: string;
  innerEmissive: string;
  ring: string;
  ringEmissive: string;
  spark: string;
  sparkEmissive: string;
  light: string;
  /** Dark outer pull shell for implosion VFX. */
  void: string;
  voidEmissive: string;
  /** Bright collapse point at singularity. */
  singularity: string;
  singularityEmissive: string;
  /** Inward-spiraling jagged debris. */
  shard: string;
  shardEmissive: string;
};

const EXPLOSION_PALETTES: Record<EntropicColorVariant, EntropicExplosionColors> = {
  rosegold: {
    core: '#d4849a',
    coreEmissive: '#fde0ea',
    inner: '#f0b8c8',
    innerEmissive: '#fff5f8',
    ring: '#d4849a',
    ringEmissive: '#f0b8c8',
    spark: '#f0b8c8',
    sparkEmissive: '#fde0ea',
    light: '#f0b8c8',
    void: '#7a3d52',
    voidEmissive: '#d4849a',
    singularity: '#fde0ea',
    singularityEmissive: '#fff8fb',
    shard: '#f0b8c8',
    shardEmissive: '#fde0ea',
  },
  red: {
    core: '#ef4444',
    coreEmissive: '#fecaca',
    inner: '#fca5a5',
    innerEmissive: '#fff1f2',
    ring: '#ef4444',
    ringEmissive: '#fca5a5',
    spark: '#fca5a5',
    sparkEmissive: '#fecaca',
    light: '#ff5252',
    void: '#7f1d1d',
    voidEmissive: '#ef4444',
    singularity: '#fecaca',
    singularityEmissive: '#fff5f5',
    shard: '#fca5a5',
    shardEmissive: '#fecaca',
  },
  blue: {
    core: '#3b82f6',
    coreEmissive: '#93c5fd',
    inner: '#60a5fa',
    innerEmissive: '#dbeafe',
    ring: '#2563eb',
    ringEmissive: '#93c5fd',
    spark: '#60a5fa',
    sparkEmissive: '#bfdbfe',
    light: '#42a5f5',
    void: '#1e3a8a',
    voidEmissive: '#3b82f6',
    singularity: '#93c5fd',
    singularityEmissive: '#e3f2fd',
    shard: '#60a5fa',
    shardEmissive: '#93c5fd',
  },
  green: {
    core: '#22c55e',
    coreEmissive: '#bbf7d0',
    inner: '#86efac',
    innerEmissive: '#ecfdf5',
    ring: '#16a34a',
    ringEmissive: '#86efac',
    spark: '#86efac',
    sparkEmissive: '#bbf7d0',
    light: '#50ff28',
    void: '#14532d',
    voidEmissive: '#22c55e',
    singularity: '#bbf7d0',
    singularityEmissive: '#f0fff4',
    shard: '#86efac',
    shardEmissive: '#bbf7d0',
  },
  purple: {
    core: '#9333ea',
    coreEmissive: '#e9d5ff',
    inner: '#c084fc',
    innerEmissive: '#f3e8ff',
    ring: '#7e22ce',
    ringEmissive: '#c084fc',
    spark: '#c084fc',
    sparkEmissive: '#e9d5ff',
    light: '#ba68c8',
    void: '#581c87',
    voidEmissive: '#9333ea',
    singularity: '#e9d5ff',
    singularityEmissive: '#faf5ff',
    shard: '#c084fc',
    shardEmissive: '#e9d5ff',
  },
  arctic: {
    core: '#0284c7',
    coreEmissive: '#7dd3fc',
    inner: '#38bdf8',
    innerEmissive: '#e0f2fe',
    ring: '#0369a1',
    ringEmissive: '#7dd3fc',
    spark: '#38bdf8',
    sparkEmissive: '#bae6fd',
    light: '#38bdf8',
    void: '#0c4a6e',
    voidEmissive: '#0284c7',
    singularity: '#7dd3fc',
    singularityEmissive: '#f0f9ff',
    shard: '#38bdf8',
    shardEmissive: '#7dd3fc',
  },
};

const CRYOFLAME_EXPLOSION: EntropicExplosionColors = {
  core: '#1e40af',
  coreEmissive: '#60a5fa',
  inner: '#3b82f6',
  innerEmissive: '#dbeafe',
  ring: '#1d4ed8',
  ringEmissive: '#60a5fa',
  spark: '#3b82f6',
  sparkEmissive: '#93c5fd',
  light: '#3b82f6',
  void: '#1e3a8a',
  voidEmissive: '#1e40af',
  singularity: '#60a5fa',
  singularityEmissive: '#eff6ff',
  shard: '#3b82f6',
  shardEmissive: '#60a5fa',
};

/** Entropic bolt impact VFX — maps bolt palette to implosion mesh colors. */
export function getEntropicExplosionColors(
  variant: EntropicColorVariant | string | undefined,
  isCryoflame = false,
): EntropicExplosionColors {
  if (isCryoflame) return CRYOFLAME_EXPLOSION;
  return EXPLOSION_PALETTES[parseEntropicColorVariant(variant)];
}

/** Alias for implosion impact VFX. */
export const getEntropicImpactColors = getEntropicExplosionColors;
