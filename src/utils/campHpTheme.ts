/**
 * Camp HP bar colour themes — one palette per archetype.
 * Each renderer imports this and reads `campHpTheme(campType)`.
 */

export interface CampHpPalette {
  background: string;  // dark nameplate track
  fill: string;        // health bar fill colour
  text: string;        // label text colour
}

const PALETTES: Record<string, CampHpPalette> = {
  blue:   { background: '#03071e', fill: '#1e44ff', text: '#99bbff' },
  green:  { background: '#021a06', fill: '#22cc44', text: '#99ffbb' },
  red:    { background: '#1f0305', fill: '#e01030', text: '#ffaaaa' },
  purple: { background: '#0f0320', fill: '#9922dd', text: '#dd99ff' },
};

const DEFAULT_PALETTE: CampHpPalette = {
  background: '#111111',
  fill:       '#888888',
  text:       '#ffffff',
};

export function campHpTheme(campType: string | undefined): CampHpPalette {
  if (!campType) return DEFAULT_PALETTE;
  return PALETTES[campType] ?? DEFAULT_PALETTE;
}
