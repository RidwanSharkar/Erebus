import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import CloudkillArrow from './CloudkillArrow';
import {
  CLOUDKILL_ARROW_DELAY_MS,
  CLOUDKILL_WARNING_MS,
} from '@/utils/talents';

export interface CloudkillVolleyArrowSpec {
  targetPosition: Vector3;
  startPosition?: Vector3;
  delayMs: number;
  timestamp?: number;
}

interface CloudkillVolleyProps {
  castId: string;
  arrows: CloudkillVolleyArrowSpec[];
  onComplete: () => void;
}

/** Renders a staggered volley of Cloudkill arrows (VFX-only; damage is ECS/server-side). */
export default function CloudkillVolley({ castId, arrows, onComplete }: CloudkillVolleyProps) {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const completedRef = useRef(0);
  const [done, setDone] = useState(false);

  const handleArrowComplete = useCallback(() => {
    completedRef.current += 1;
    if (completedRef.current >= arrows.length) {
      setDone(true);
    }
  }, [arrows.length]);

  useEffect(() => {
    if (!done) return;
    onCompleteRef.current();
  }, [done]);

  useEffect(() => {
    const maxDelay = arrows.reduce((max, a) => Math.max(max, a.delayMs), 0);
    const fallbackMs =
      maxDelay + CLOUDKILL_WARNING_MS + 3500 + CLOUDKILL_ARROW_DELAY_MS;
    const t = window.setTimeout(() => {
      setDone(true);
    }, fallbackMs);
    return () => window.clearTimeout(t);
  }, [arrows, castId]);

  if (done) return null;

  return (
    <>
      {arrows.map((arrow, index) => (
        <CloudkillArrow
          key={`${castId}-${index}`}
          targetPosition={arrow.targetPosition}
          startPosition={arrow.startPosition}
          delayMs={arrow.delayMs}
          timestamp={arrow.timestamp}
          onComplete={handleArrowComplete}
        />
      ))}
    </>
  );
}
