'use client';

import React, { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Camera } from '@/utils/three-exports';
import { Vector3 } from '@/utils/three-exports';
import { WeaponType } from '@/components/dragon/weapons';
import {
  EREBUS_STRIKE_INDICATOR_EVENT,
  type ErebusStrikeIndicatorDetail,
} from '@/utils/strikeIndicatorEvent';

declare global {
  interface WindowEventMap {
    'erebus-strike-indicator': CustomEvent<ErebusStrikeIndicatorDetail>;
  }
}

interface StrikeIndicatorProps {
  enabled: boolean;
  camera: Camera | null;
  size: { width: number; height: number } | null;
}

const StrikeIndicator = memo(function StrikeIndicator({
  enabled,
  camera,
  size,
}: StrikeIndicatorProps) {
  const [isShowingStrike, setIsShowingStrike] = useState(false);
  const [strikeWeapon, setStrikeWeapon] = useState<WeaponType>(WeaponType.BOW);
  const [strikeWorldPos, setStrikeWorldPos] = useState<Vector3 | null>(null);
  const strikeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStrikeEvent = useCallback((ev: Event) => {
    const e = ev as CustomEvent<ErebusStrikeIndicatorDetail>;
    const weapon = e.detail?.weapon;
    if (weapon !== WeaponType.BOW && weapon !== WeaponType.SCYTHE) return;

    const p = e.detail?.position;
    setStrikeWorldPos(p != null ? new Vector3(p.x, p.y, p.z) : null);

    setStrikeWeapon(weapon);

    if (strikeTimeoutRef.current != null) {
      clearTimeout(strikeTimeoutRef.current);
    }
    setIsShowingStrike(true);
    strikeTimeoutRef.current = setTimeout(() => {
      setIsShowingStrike(false);
      setStrikeWorldPos(null);
      strikeTimeoutRef.current = null;
    }, 400);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setIsShowingStrike(false);
      setStrikeWorldPos(null);
      if (strikeTimeoutRef.current != null) {
        clearTimeout(strikeTimeoutRef.current);
        strikeTimeoutRef.current = null;
      }
      return;
    }

    window.addEventListener(EREBUS_STRIKE_INDICATOR_EVENT, handleStrikeEvent);
    return () => {
      window.removeEventListener(EREBUS_STRIKE_INDICATOR_EVENT, handleStrikeEvent);
      if (strikeTimeoutRef.current != null) {
        clearTimeout(strikeTimeoutRef.current);
      }
    };
  }, [enabled, handleStrikeEvent]);

  const screenPx = useMemo(() => {
    if (
      strikeWorldPos &&
      camera &&
      size &&
      size.width > 0 &&
      size.height > 0
    ) {
      const projected = strikeWorldPos.clone().project(camera);
      const x = (projected.x * 0.5 + 0.5) * size.width;
      const y = (projected.y * -0.5 + 0.5) * size.height;
      return { x, y, mode: 'projected' as const };
    }
    return {
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
      mode: 'center' as const,
    };
  }, [camera, size, strikeWorldPos]);

  if (!enabled || !isShowingStrike) {
    return null;
  }

  const isBowEquipped = strikeWeapon === WeaponType.BOW;

  const scale = 1.0;
  const opacity = 1.0;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-visible"
      style={{
        zIndex: 9998,
        background: 'transparent',
      }}
    >
      <div
        className="absolute"
        style={{
          left: `${screenPx.x}px`,
          top: `${screenPx.y}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transition:
            screenPx.mode === 'projected'
              ? 'transform 0.05s ease-out, left 0.05s ease-out, top 0.05s ease-out'
              : 'transform 0.05s ease-out',
        }}
      >
        <div
          className="relative"
          style={{
            width: isBowEquipped ? '48px' : '60px',
            height: isBowEquipped ? '48px' : '60px',
            overflow: 'visible',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            isolation: 'isolate',
          }}
        >
          <svg
            width={isBowEquipped ? 48 : 60}
            height={isBowEquipped ? 48 : 60}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              opacity,
              background: 'transparent',
              overflow: 'visible',
            }}
          >
            {[1, 2, 3, 4].map((i) => {
              const sizeSvg = isBowEquipped ? 48 : 60;
              const spacing = sizeSvg / 6;
              const x = (i + 0.5) * spacing;
              const y = (i + 0.5) * spacing;
              return (
                <circle
                  key={`diag1-${i}`}
                  cx={x}
                  cy={y}
                  r={2}
                  fill="#cccccc"
                  style={{ filter: 'drop-shadow(0 0 4px #cccccc)' }}
                />
              );
            })}
            {[1, 2, 3, 4].map((i) => {
              const sizeSvg = isBowEquipped ? 48 : 60;
              const spacing = sizeSvg / 6;
              const x = sizeSvg - (i + 0.5) * spacing;
              const y = (i + 0.5) * spacing;
              return (
                <circle
                  key={`diag2-${i}`}
                  cx={x}
                  cy={y}
                  r={2}
                  fill="#cccccc"
                  style={{ filter: 'drop-shadow(0 0 4px #cccccc)' }}
                />
              );
            })}
          </svg>
          <div
            className="absolute rounded-full"
            style={{
              width: '6px',
              height: '6px',
              backgroundColor: '#cccccc',
              boxShadow: '0 0 8px #cccccc',
              opacity: opacity * 0.9,
              transform: 'translate(-50%, -50%)',
              left: '50%',
              top: '50%',
              transition: 'all 0.05s ease-out',
            }}
          />
        </div>
      </div>
    </div>
  );
});

export default StrikeIndicator;
