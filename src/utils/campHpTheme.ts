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
  blue:   { background: '#03071e', fill: '#e01030', text: '#99bbff' },
  green:  { background: '#021a06', fill: '#e01030', text: '#99ffbb' },
  'ally-green': { background: '#021a06', fill: '#18d65b', text: '#99ffbb' },
  red:    { background: '#1f0305', fill: '#e01030', text: '#ffaaaa' },
  purple: { background: '#0f0320', fill: '#e01030', text: '#dd99ff' },
  yellow: { background: '#1a1400', fill: '#ffd000', text: '#fff3b0' },
};

const DEFAULT_PALETTE: CampHpPalette = {
  background: '#111111',
  fill:       '#e01030',
  text:       '#ffffff',
};

export function campHpTheme(campType: string | undefined): CampHpPalette {
  if (!campType) return DEFAULT_PALETTE;
  return PALETTES[campType] ?? DEFAULT_PALETTE;
}
