'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import type { CameraSystem } from '@/systems/CameraSystem';
import {
  EXPLORE_MAX_DRAW_HEIGHT,
  EXPLORE_MAX_DRAW_WIDTH,
  EXPLORE_ZOOM_DPR_MAX,
  EXPLORE_ZOOM_RADIUS_FAR,
  STANDARD_MAX_DRAW_HEIGHT,
  STANDARD_MAX_DRAW_WIDTH,
  computeCappedDpr,
  resetExploreZoomLod,
  setCanvasDpr,
  updateExploreZoomLod,
} from '@/utils/exploreZoomLod';

const DPR_APPLY_EPS = 0.035;
const SIZE_APPLY_EPS = 0.5;
const BUFFER_OVER_EPS = 2;

/**
 * Pushes camera orbit radius into exploreZoomLod (Explore only) and sets canvas DPR.
 * Explore: drawing buffer capped to 1280×720 + zoom LOD (1.5 far → 1.0 close).
 * Other rooms: drawing buffer capped to 1440×810.
 *
 * Re-applies when the live WebGL buffer exceeds the cap even if the *computed*
 * DPR is unchanged — R3F configure() can overwrite setDpr on resize/rerender.
 */
export default function ExploreZoomLodDriver({
  enabled,
  cameraSystemRef,
}: {
  enabled: boolean;
  cameraSystemRef: MutableRefObject<CameraSystem | null>;
}) {
  const setDpr = useThree((s) => s.setDpr);
  const gl = useThree((s) => s.gl);
  const lastDprRef = useRef(-1);
  const lastWRef = useRef(-1);
  const lastHRef = useRef(-1);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    return () => {
      setCanvasDpr(null);
    };
  }, []);

  useFrame(() => {
    const exploreOn = enabledRef.current;
    const lod = exploreOn
      ? updateExploreZoomLod(cameraSystemRef.current?.getDistance() ?? EXPLORE_ZOOM_RADIUS_FAR)
      : resetExploreZoomLod();

    const zoomDpr = exploreOn ? lod.dpr : EXPLORE_ZOOM_DPR_MAX;
    const maxW = exploreOn ? EXPLORE_MAX_DRAW_WIDTH : STANDARD_MAX_DRAW_WIDTH;
    const maxH = exploreOn ? EXPLORE_MAX_DRAW_HEIGHT : STANDARD_MAX_DRAW_HEIGHT;

    // Prefer live CSS client size — R3F `size` can lag one resize frame.
    const canvas = gl.domElement;
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    const nextDpr = computeCappedDpr(width, height, zoomDpr, maxW, maxH);

    const actualDpr = gl.getPixelRatio();
    const gpu = gl.getContext();
    const drawW = gpu.drawingBufferWidth;
    const drawH = gpu.drawingBufferHeight;
    const bufferOverCap =
      drawW > maxW + BUFFER_OVER_EPS || drawH > maxH + BUFFER_OVER_EPS;
    const actualDprDrift = Math.abs(actualDpr - nextDpr) >= DPR_APPLY_EPS;

    const sizeChanged =
      Math.abs(width - lastWRef.current) >= SIZE_APPLY_EPS ||
      Math.abs(height - lastHRef.current) >= SIZE_APPLY_EPS;
    const computedChanged = Math.abs(nextDpr - lastDprRef.current) >= DPR_APPLY_EPS;

    if (!sizeChanged && !computedChanged && !bufferOverCap && !actualDprDrift) {
      return;
    }

    lastDprRef.current = nextDpr;
    lastWRef.current = width;
    lastHRef.current = height;
    setCanvasDpr(nextDpr);
    setDpr(nextDpr);
  });

  return null;
}
