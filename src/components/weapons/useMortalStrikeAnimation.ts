'use client';

import { useRef, useCallback } from 'react';
import type { Group } from 'three';
import type { Vector3 } from 'three';

export const MORTAL_STRIKE_EFFECT_DURATION = 0.42;

export function useMortalStrikeAnimation({
  contentRef,
  position,
}: {
  contentRef: React.RefObject<Group | null>;
  position: Vector3;
  direction: Vector3;
}) {
  const timeRef = useRef(0);

  const reset = useCallback(() => {
    timeRef.current = 0;
    if (contentRef.current) {
      contentRef.current.position.set(0, 0, 0);
      contentRef.current.scale.set(0.01, 0.01, 0.01);
    }
  }, [contentRef]);

  const tick = useCallback(
    (delta: number): { finished: boolean; t: number; progress: number } => {
      timeRef.current += delta;
      const t = timeRef.current;
      const progress = Math.min(t / MORTAL_STRIKE_EFFECT_DURATION, 1);

      if (contentRef.current) {
        const sweepScale = 0.35 + progress * 1.05;
        const arcFade =
          t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - 0.1) / (MORTAL_STRIKE_EFFECT_DURATION - 0.1));
        contentRef.current.scale.set(sweepScale, sweepScale * arcFade, sweepScale);
        // Slide along local +Z (parent group applies yaw — always forward relative to player)
        contentRef.current.position.set(0, 0, progress * 1.4);
      }

      return {
        finished: t >= MORTAL_STRIKE_EFFECT_DURATION,
        t,
        progress,
      };
    },
    [contentRef],
  );

  return { reset, tick, anchorY: position.y + 0.85 };
}
