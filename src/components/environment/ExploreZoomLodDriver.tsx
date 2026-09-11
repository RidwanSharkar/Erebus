'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import type { CameraSystem } from '@/systems/CameraSystem';
import {
  CANVAS_DEFAULT_DPR,
  EXPLORE_ZOOM_RADIUS_FAR,
  computeExploreDpr,
  resetExploreZoomLod,
  updateExploreZoomLod,
} from '@/utils/exploreZoomLod';

const DPR_APPLY_EPS = 0.035;
const SIZE_APPLY_EPS = 0.5;

/**
 * Pushes camera orbit radius into exploreZoomLod and sets canvas DPR.
 * Explore: zoom LOD (1.5 far → 1.0 close) further capped to 1280×720 drawing buffer.
 * Other rooms: restore Canvas default dpr={[1, 1.5]}.
 */
export default function ExploreZoomLodDriver({
  enabled,
  cameraSystemRef,
}: {
  enabled: boolean;
  cameraSystemRef: MutableRefObject<CameraSystem | null>;
}) {
  const setDpr = useThree((s) => s.setDpr);
  const get = useThree((s) => s.get);
  const lastDprRef = useRef(-1);
  const lastWRef = useRef(-1);
  const lastHRef = useRef(-1);
  const wasEnabledRef = useRef(enabled);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useFrame(() => {
    const exploreOn = enabledRef.current;
    const lod = exploreOn
      ? updateExploreZoomLod(cameraSystemRef.current?.getDistance() ?? EXPLORE_ZOOM_RADIUS_FAR)
      : resetExploreZoomLod();

    if (!exploreOn) {
      if (wasEnabledRef.current) {
        wasEnabledRef.current = false;
        lastDprRef.current = -1;
        lastWRef.current = -1;
        lastHRef.current = -1;
        setDpr(CANVAS_DEFAULT_DPR);
      }
      return;
    }

    wasEnabledRef.current = true;
    const { width, height } = get().size;
    const nextDpr = computeExploreDpr(width, height, lod.dpr);
    const sizeChanged =
      Math.abs(width - lastWRef.current) >= SIZE_APPLY_EPS ||
      Math.abs(height - lastHRef.current) >= SIZE_APPLY_EPS;
    if (!sizeChanged && Math.abs(nextDpr - lastDprRef.current) < DPR_APPLY_EPS) {
      return;
    }
    lastDprRef.current = nextDpr;
    lastWRef.current = width;
    lastHRef.current = height;
    setDpr(nextDpr);
  });

  return null;
}
