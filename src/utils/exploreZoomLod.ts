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

/** Matches Canvas `dpr={[1, 1.5]}` in page.tsx — restore when leaving Explore. */
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
 * Cap Explore drawing-buffer pixels to EXPLORE_MAX_DRAW_* while preserving
 * aspect ratio. Never exceeds zoomLodDpr (1.0 close → 1.5 far).
 * Steps down (floor) so the buffer never exceeds the named max.
 */
export function computeExploreDpr(
  cssWidth: number,
  cssHeight: number,
  zoomDpr: number,
): number {
  const w = Math.max(1, cssWidth);
  const h = Math.max(1, cssHeight);
  const resCap = Math.min(
    EXPLORE_MAX_DRAW_WIDTH / w,
    EXPLORE_MAX_DRAW_HEIGHT / h,
  );
  const capped = Math.min(resCap, zoomDpr);
  const stepped = Math.floor(capped / DPR_STEP + 1e-9) * DPR_STEP;
  return Math.min(zoomDpr, Math.max(DPR_FLOOR, stepped));
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
