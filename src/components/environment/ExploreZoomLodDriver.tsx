'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { MutableRefObject } from 'react';
import type { CameraSystem } from '@/systems/CameraSystem';
import {
  EXPLORE_ZOOM_RADIUS_FAR,
  resetExploreZoomLod,
  updateExploreZoomLod,
} from '@/utils/exploreZoomLod';

const DPR_APPLY_EPS = 0.035;

/**
 * Pushes camera orbit radius into exploreZoomLod and lerps canvas DPR
 * (1.5 zoomed out → 1.0 zoomed in). No visual children.
 */
export default function ExploreZoomLodDriver({
  enabled,
  cameraSystemRef,
}: {
  enabled: boolean;
  cameraSystemRef: MutableRefObject<CameraSystem | null>;
}) {
  const setDpr = useThree((s) => s.setDpr);
  const lastDprRef = useRef(-1);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useFrame(() => {
    const lod = enabledRef.current
      ? updateExploreZoomLod(cameraSystemRef.current?.getDistance() ?? EXPLORE_ZOOM_RADIUS_FAR)
      : resetExploreZoomLod();
    if (Math.abs(lod.dpr - lastDprRef.current) < DPR_APPLY_EPS) return;
    lastDprRef.current = lod.dpr;
    setDpr(lod.dpr);
  });

  return null;
}
