/** Shared sci-fi HUD chrome tokens for resource bars and panels. */

import type { Archetype } from '@/utils/archetypes';

export const BAR_HEIGHT = 30;
/** Outer frame height including 2px padding on each side. */
export const RESOURCE_BAR_FRAME_HEIGHT = BAR_HEIGHT + 4;
/** Tailwind `gap-1` between stacked resource bars. */
export const RESOURCE_BAR_BAR_GAP_PX = 4;
/** Diagonal slice depth on the right edge (taper cut). */
export const RESOURCE_BAR_SLICE_PX = 18;
/** Samples along the LevelBadge arc for the concave left edge. */
export const RESOURCE_BAR_ARC_SAMPLES = 10;
/** Extra px outside the badge circle so bars don't collide with the ring. */
export const RESOURCE_BAR_ARC_CLEARANCE_PX = 2;
/** Bars column padding / pull so the arc bites into the badge overlap. */
export const RESOURCE_BARS_COLUMN_PAD_LEFT = 8;
export const RESOURCE_BARS_COLUMN_MARGIN_LEFT = -14;

export const HUD_PANEL_CLIP =
  'polygon(16px 0%, calc(100% - 16px) 0%, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0% calc(100% - 16px), 0% 16px)';

export const HUD_PANEL_BG =
  'linear-gradient(180deg, rgba(8,10,22,0.94) 0%, rgba(4,5,14,0.97) 100%)';

export const HUD_PANEL_BORDER = '1px solid rgba(80,120,200,0.22)';

export const HUD_PANEL_SHADOW =
  '0 8px 40px rgba(0,0,0,0.8), 0 0 80px rgba(40,80,160,0.1), inset 0 1px 0 rgba(255,255,255,0.06)';

/** Integrated LevelBadge outer diameter (128px ring + 14px frame padding). */
export const INTEGRATED_LEVEL_BADGE_OUTER_SIZE = 142;
/** LevelBadge -mr-5 overlap with the resource bars column. */
export const LEVEL_BADGE_OVERLAP = 20;
/** Left offset for resource bars when the integrated level badge is shown. */
export const LEVEL_BADGE_BARS_OFFSET =
  8 + INTEGRATED_LEVEL_BADGE_OUTER_SIZE - LEVEL_BADGE_OVERLAP + 8;

export type ResourceBarSlot = 0 | 1 | 2;

/**
 * How much shorter each stacked bar is vs the top (shield) baseline.
 * Applied left-aligned so only the right end recedes.
 */
export const RESOURCE_BAR_WIDTH_TAPER_PX: Record<ResourceBarSlot, number> = {
  0: 0,
  1: 14,
  2: 28,
};

/** Y offset of a bar's vertical center from the LevelBadge center (px). */
export function getIntegratedBarCenterOffsetY(barSlot: ResourceBarSlot): number {
  const stackH =
    RESOURCE_BAR_FRAME_HEIGHT * 3 + RESOURCE_BAR_BAR_GAP_PX * 2;
  const stackTop = (INTEGRATED_LEVEL_BADGE_OUTER_SIZE - stackH) / 2;
  const barCenterY =
    stackTop +
    barSlot * (RESOURCE_BAR_FRAME_HEIGHT + RESOURCE_BAR_BAR_GAP_PX) +
    RESOURCE_BAR_FRAME_HEIGHT / 2;
  return barCenterY - INTEGRATED_LEVEL_BADGE_OUTER_SIZE / 2;
}

/** Bar left edge X relative to LevelBadge left, given current HUD overlap layout. */
export function getIntegratedBarLeftX(): number {
  return (
    INTEGRATED_LEVEL_BADGE_OUTER_SIZE -
    LEVEL_BADGE_OVERLAP +
    RESOURCE_BARS_COLUMN_MARGIN_LEFT +
    RESOURCE_BARS_COLUMN_PAD_LEFT
  );
}

function fmtPx(n: number): string {
  return `${Math.round(n * 100) / 100}px`;
}

/**
 * Build a clip-path polygon for a resource bar.
 * Left: concave arc hugging the LevelBadge (when integrated + barSlot set).
 * Right: clean diagonal slice — angle is kept consistent via height-scaled slice.
 */
export function buildResourceBarClipPath(options: {
  barSlot?: ResourceBarSlot;
  integrated?: boolean;
  /** Parallel inset for nested clips (shifts edges inward). */
  inset?: number;
  /**
   * Element height the clip is applied to. Slice depth scales with this so the
   * diagonal angle matches the outer frame (avoids tip/border mismatch).
   */
  height?: number;
} = {}): string {
  const inset = options.inset ?? 0;
  const height = options.height ?? RESOURCE_BAR_FRAME_HEIGHT;
  // Keep the same diagonal angle as the outer frame: rise/run = height/slice.
  const slice =
    RESOURCE_BAR_SLICE_PX * (height / RESOURCE_BAR_FRAME_HEIGHT);
  const r = INTEGRATED_LEVEL_BADGE_OUTER_SIZE / 2;
  const integrated =
    options.integrated ?? options.barSlot !== undefined;

  const points: string[] = [];

  // —— Left edge (top → bottom) ——
  if (integrated && options.barSlot !== undefined) {
    const barLeftX = getIntegratedBarLeftX();
    const centerOffsetY = getIntegratedBarCenterOffsetY(options.barSlot);
    const samples = RESOURCE_BAR_ARC_SAMPLES;
    // Map this element's vertical span onto the full frame slot for arc sampling.
    const frameH = RESOURCE_BAR_FRAME_HEIGHT;
    const yOffset = (frameH - height) / 2;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const localY = t * height;
      const frameLocalY = yOffset + localY;
      const dy = centerOffsetY - frameH / 2 + frameLocalY;
      let xLocal = 0;
      if (Math.abs(dy) <= r) {
        xLocal =
          r +
          Math.sqrt(r * r - dy * dy) +
          RESOURCE_BAR_ARC_CLEARANCE_PX -
          barLeftX;
      }
      xLocal = Math.max(0, xLocal) + inset;
      const y = i === 0 ? inset : i === samples ? height - inset : localY;
      points.push(`${fmtPx(xLocal)} ${fmtPx(y)}`);
    }
  } else {
    points.push(`${fmtPx(inset)} ${fmtPx(inset)}`);
    points.push(`${fmtPx(inset)} calc(100% - ${inset}px)`);
  }

  // —— Bottom of diagonal → top-right tip (auto-closes along top) ——
  // Clean diagonal: top extends farther right than the bottom (taper cut).
  points.push(`calc(100% - ${slice + inset}px) calc(100% - ${inset}px)`);
  points.push(`calc(100% - ${inset}px) ${fmtPx(inset)}`);

  return `polygon(${points.join(', ')})`;
}

/** Flat-left + diagonal-slice fallback (no LevelBadge arc). */
export const RESOURCE_BAR_CLIP = buildResourceBarClipPath({ integrated: false });

export const RESOURCE_BAR_TRACK_CLIP = buildResourceBarClipPath({
  integrated: false,
  inset: 1,
});

export const BAR_FRAME_GRADIENT =
  'linear-gradient(180deg, rgba(80,90,120,0.55) 0%, rgba(20,24,36,0.95) 45%, rgba(8,10,18,0.98) 100%)';

export const BAR_TRACK_GRADIENT =
  'linear-gradient(180deg, rgba(0,0,0,0.85) 0%, rgba(12,14,24,0.92) 100%)';

/** Subtle hex/honeycomb overlay for bar interiors. */
export const HEX_PATTERN_BG = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='24' viewBox='0 0 28 24'>
    <path d='M14 0l12 7v10l-12 7L2 17V7z' fill='none' stroke='rgba(120,160,220,0.07)' stroke-width='0.6'/>
    <path d='M0 12l12-7v10l-12 7V12z' fill='none' stroke='rgba(120,160,220,0.05)' stroke-width='0.6'/>
    <path d='M28 12l-12-7v10l12 7V12z' fill='none' stroke='rgba(120,160,220,0.05)' stroke-width='0.6'/>
  </svg>`,
)}")`;

export const TICKS = [25, 50, 75] as const;

/** Hotkey weapon portrait — rounded square, slightly larger than 48px hotkey slots. */
export const WEAPON_PORTRAIT_SIZE = 66;
export const WEAPON_PORTRAIT_FRAME_PADDING = 4;
export const WEAPON_PORTRAIT_RADIUS = 10;

export type ResourceBarKind = 'shield' | 'health' | 'energy';

/** Width reduction for a resource bar (left-aligned taper). Prefers barSlot when set. */
export function getResourceBarWidthTaperPx(options: {
  barSlot?: ResourceBarSlot;
  kind: ResourceBarKind;
}): number {
  if (options.barSlot !== undefined) {
    return RESOURCE_BAR_WIDTH_TAPER_PX[options.barSlot];
  }
  switch (options.kind) {
    case 'health':
      return RESOURCE_BAR_WIDTH_TAPER_PX[1];
    case 'energy':
      return RESOURCE_BAR_WIDTH_TAPER_PX[2];
    default:
      return RESOURCE_BAR_WIDTH_TAPER_PX[0];
  }
}

export const RESOURCE_BAR_THEMES: Record<
  ResourceBarKind,
  {
    label: string;
    gradientFrom: string;
    gradientTo: string;
    glowColor: string;
    icon: string;
  }
> = {
  shield: {
    label: 'Shields',
    gradientFrom: '#1a3fa8',
    gradientTo: '#60b8f8',
    glowColor: '#4A90E2',
    icon: '/icons/aegis.svg',
  },
  health: {
    label: 'Health',
    gradientFrom: '#7a1010',
    gradientTo: '#ef5050',
    glowColor: '#DC2626',
    icon: '/icons/rejuvShot.svg',
  },
  energy: {
    label: 'Energy',
    gradientFrom: '#5a2080',
    gradientTo: '#b060f0',
    glowColor: '#9333EA',
    icon: '/icons/storedCharge.svg',
  },
};

export type ResourceBarTheme = (typeof RESOURCE_BAR_THEMES)[ResourceBarKind];

const ENERGY_BAR_THEME_YELLOW: ResourceBarTheme = {
  label: 'Energy',
  gradientFrom: '#7a5a08',
  gradientTo: '#f0c040',
  glowColor: '#EAB308',
  icon: '/icons/storedCharge.svg',
};

const ENERGY_BAR_THEME_PURPLE: ResourceBarTheme = RESOURCE_BAR_THEMES.energy;

const ENERGY_BAR_THEME_ORANGE: ResourceBarTheme = {
  label: 'Energy',
  gradientFrom: '#9a3412',
  gradientTo: '#f97316',
  glowColor: '#F97316',
  icon: '/icons/storedCharge.svg',
};

export function getResourceBarTheme(
  kind: ResourceBarKind,
  archetype?: Archetype,
): ResourceBarTheme {
  if (kind !== 'energy') {
    return RESOURCE_BAR_THEMES[kind];
  }

  switch (archetype) {
    case 'ROGUE':
    case 'GLADIATOR':
      return ENERGY_BAR_THEME_YELLOW;
    case 'ALCHEMIST':
    case 'ACOLYTE':
      return ENERGY_BAR_THEME_PURPLE;
    case 'SORCERESS':
      return ENERGY_BAR_THEME_ORANGE;
    default:
      return ENERGY_BAR_THEME_PURPLE;
  }
}
