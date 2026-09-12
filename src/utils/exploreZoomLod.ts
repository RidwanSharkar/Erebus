/**
 * Explore camera-radius LOD. Close-up is fill-rate bound (same draw list, more
 * pixels), so quality drops when the orbit radius shrinks — the opposite of
 * geometric LOD. Module flags only; no per-frame React state.
 *
 * Coop CameraSystem: radius 3.5–12.5 (default distance 10).
 */

export const EXPLORE_ZOOM_RADIUS_NEAR = 3.5;
export const EXPLORE_ZOOM_RADIUS_FAR = 12.5;
export const EXPLORE_ZOOM_DPR_MIN = 1;
export const EXPLORE_ZOOM_DPR_MAX = 1.5;

/** Max WebGL drawing-buffer size in Explore (CSS canvas stays fullscreen). */
export const EXPLORE_MAX_DRAW_WIDTH = 1280;
export const EXPLORE_MAX_DRAW_HEIGHT = 720;

/**
 * Max WebGL drawing-buffer for non-Explore rooms (Throne, Fae, defense, PvP, …).
 * Next 16:9 tier above 720p (~1400-class).
 */
export const STANDARD_MAX_DRAW_WIDTH = 1600;
export const STANDARD_MAX_DRAW_HEIGHT = 900;

/** Legacy R3F default range; drawing-buffer cap now always uses a numeric DPR. */
export const CANVAS_DEFAULT_DPR: [number, number] = [1, 1.5];

const DPR_FLOOR = 0.25;

/** Enter close at or inside default orbit; hysteresis avoids grass-rewrite thrash. */
const CLOSE_ENTER = 8;
const CLOSE_EXIT = 8.5;
const VERY_CLOSE_ENTER = 5;
const VERY_CLOSE_EXIT = 5.5;
const DPR_STEP = 0.04;

export type ExploreZoomLod = {
  radius: number;
  close: boolean;
  veryClose: boolean;
  dpr: number;
};

const lod: ExploreZoomLod = {
  radius: EXPLORE_ZOOM_RADIUS_FAR,
  close: false,
  veryClose: false,
  dpr: EXPLORE_ZOOM_DPR_MAX,
};

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

function deviceDprCap(): number {
  const device =
    typeof window !== 'undefined' && Number.isFinite(window.devicePixelRatio)
      ? window.devicePixelRatio
      : 1;
  return Math.min(Math.max(device, EXPLORE_ZOOM_DPR_MIN), EXPLORE_ZOOM_DPR_MAX);
}

function lerpDpr(radius: number): number {
  const cap = deviceDprCap();
  const span = EXPLORE_ZOOM_RADIUS_FAR - EXPLORE_ZOOM_RADIUS_NEAR;
  const t = clamp01((radius - EXPLORE_ZOOM_RADIUS_NEAR) / span);
  const raw = EXPLORE_ZOOM_DPR_MIN + (cap - EXPLORE_ZOOM_DPR_MIN) * t;
  const stepped = Math.round(raw / DPR_STEP) * DPR_STEP;
  return Math.min(cap, Math.max(EXPLORE_ZOOM_DPR_MIN, stepped));
}

/**
 * Cap drawing-buffer pixels to maxWidth×maxHeight while preserving aspect
 * ratio. Never exceeds zoomDpr. Steps down (floor) so the buffer never
 * exceeds the named max.
 */
export function computeCappedDpr(
  cssWidth: number,
  cssHeight: number,
  zoomDpr: number,
  maxWidth: number,
  maxHeight: number,
): number {
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  const resCap = Math.min(maxWidth / w, maxHeight / h);
  const capped = Math.min(resCap, zoomDpr);
  const stepped = Math.floor(capped / DPR_STEP + 1e-9) * DPR_STEP;
  return Math.min(zoomDpr, Math.max(DPR_FLOOR, stepped));
}

/** Explore: 1280×720 cap + zoom LOD input. */
export function computeExploreDpr(
  cssWidth: number,
  cssHeight: number,
  zoomDpr: number,
): number {
  return computeCappedDpr(
    cssWidth,
    cssHeight,
    zoomDpr,
    EXPLORE_MAX_DRAW_WIDTH,
    EXPLORE_MAX_DRAW_HEIGHT,
  );
}

export function updateExploreZoomLod(radius: number): ExploreZoomLod {
  lod.radius = radius;
  if (lod.close) {
    if (radius > CLOSE_EXIT) lod.close = false;
  } else if (radius < CLOSE_ENTER) {
    lod.close = true;
  }
  if (lod.veryClose) {
    if (radius > VERY_CLOSE_EXIT) lod.veryClose = false;
  } else if (radius < VERY_CLOSE_ENTER) {
    lod.veryClose = true;
  }
  lod.dpr = lerpDpr(radius);
  return lod;
}

/** Restore far-zoom quality when leaving explore. */
export function resetExploreZoomLod(): ExploreZoomLod {
  return updateExploreZoomLod(EXPLORE_ZOOM_RADIUS_FAR);
}

export function getExploreZoomLod(): ExploreZoomLod {
  return lod;
}

export function isExploreZoomClose(): boolean {
  return lod.close;
}

export function isExploreZoomVeryClose(): boolean {
  return lod.veryClose;
}

/**
 * Global Canvas `dpr` override. A number (can be < 1) so R3F configure()
 * does not clamp back to [1, 1.5]. Null until the driver publishes → fallback.
 */
let canvasDpr: number | null = null;
const canvasDprListeners = new Set<() => void>();

export function getCanvasDpr(): number | null {
  return canvasDpr;
}

export function setCanvasDpr(dpr: number | null): void {
  if (canvasDpr === dpr) return;
  if (
    dpr !== null &&
    canvasDpr !== null &&
    Math.abs(canvasDpr - dpr) < 1e-6
  ) {
    return;
  }
  canvasDpr = dpr;
  canvasDprListeners.forEach((listener) => listener());
}

export function subscribeCanvasDpr(listener: () => void): () => void {
  canvasDprListeners.add(listener);
  return () => {
    canvasDprListeners.delete(listener);
  };
}

/** First-frame fallback before ExploreZoomLodDriver publishes. */
export function computeCanvasDprFallback(explore = false): number {
  const maxW = explore ? EXPLORE_MAX_DRAW_WIDTH : STANDARD_MAX_DRAW_WIDTH;
  const maxH = explore ? EXPLORE_MAX_DRAW_HEIGHT : STANDARD_MAX_DRAW_HEIGHT;
  const w =
    typeof window !== 'undefined' && Number.isFinite(window.innerWidth)
      ? window.innerWidth
      : maxW;
  const h =
    typeof window !== 'undefined' && Number.isFinite(window.innerHeight)
      ? window.innerHeight
      : maxH;
  return computeCappedDpr(w, h, EXPLORE_ZOOM_DPR_MAX, maxW, maxH);
}
