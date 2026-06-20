export type EntropicColorVariant = 'purple' | 'blue' | 'red' | 'green' | 'arctic';

export type EntropicColorTheme = {
  primary: string;
  secondary: string;
  light: string;
};

export function getEntropicColorTheme(
  variant: EntropicColorVariant | string | undefined,
  isCryoflame = false,
): EntropicColorTheme {
  if (isCryoflame) return { primary: '#1e40af', secondary: '#3b82f6', light: '#60a5fa' };
  switch (variant) {
    case 'arctic':
      return { primary: '#0c4a6e', secondary: '#0284c7', light: '#7dd3fc' };
    case 'blue':
      return { primary: '#3b82f6', secondary: '#93c5fd', light: '#93c5fd' };
    case 'red':
      return { primary: '#ef4444', secondary: '#fca5a5', light: '#fecaca' };
    case 'green':
      return { primary: '#22c55e', secondary: '#86efac', light: '#bbf7d0' };
    case 'purple':
    default:
      return { primary: '#9333ea', secondary: '#c084fc', light: '#e9d5ff' };
  }
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
};

/** Expanding-sphere impact VFX — maps bolt palette to explosion mesh colors. */
export function getEntropicExplosionColors(
  variant: EntropicColorVariant | string | undefined,
  isCryoflame = false,
): EntropicExplosionColors {
  const theme = getEntropicColorTheme(variant, isCryoflame);
  return {
    core: theme.primary,
    coreEmissive: theme.light,
    inner: theme.secondary,
    innerEmissive: '#ffffff',
    ring: theme.primary,
    ringEmissive: theme.light,
    spark: theme.secondary,
    sparkEmissive: '#ffffff',
    light: theme.primary,
  };
}
