'use client';

import React, { memo, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { Camera } from '@/utils/three-exports';
import { Vector3 } from '@/utils/three-exports';
import { WeaponType } from '@/components/dragon/weapons';
import {
  EREBUS_STRIKE_INDICATOR_EVENT,
  type ErebusStrikeIndicatorDetail,
  type StrikeIndicatorVariant,
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

const KILL_FLASH_DURATION_MS = 550;
const WEAPON_HIT_DURATION_MS = 400;

const StrikeIndicator = memo(function StrikeIndicator({
  enabled,
  camera,
  size,
}: StrikeIndicatorProps) {
  const [isShowingStrike, setIsShowingStrike] = useState(false);
  const [strikeWeapon, setStrikeWeapon] = useState<WeaponType>(WeaponType.BOW);
  const [strikeVariant, setStrikeVariant] = useState<StrikeIndicatorVariant>('weapon-hit');
  const [strikeWorldPos, setStrikeWorldPos] = useState<Vector3 | null>(null);
  const strikeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleStrikeEvent = useCallback((ev: Event) => {
    const e = ev as CustomEvent<ErebusStrikeIndicatorDetail>;
    const variant = e.detail?.variant ?? 'weapon-hit';

    if (variant === 'weapon-hit') {
      const weapon = e.detail?.weapon;
      if (weapon !== WeaponType.BOW && weapon !== WeaponType.SCYTHE) return;
      setStrikeWeapon(weapon);
    }

    const p = e.detail?.position;
    setStrikeWorldPos(p != null ? new Vector3(p.x, p.y, p.z) : null);
    setStrikeVariant(variant);

    if (strikeTimeoutRef.current != null) {
      clearTimeout(strikeTimeoutRef.current);
    }
    setIsShowingStrike(true);
    const duration = variant === 'kill' ? KILL_FLASH_DURATION_MS : WEAPON_HIT_DURATION_MS;
    strikeTimeoutRef.current = setTimeout(() => {
      setIsShowingStrike(false);
      setStrikeWorldPos(null);
      strikeTimeoutRef.current = null;
    }, duration);
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

  const isKill = strikeVariant === 'kill';
  const isBowEquipped = strikeWeapon === WeaponType.BOW;
  const sizePx = isKill ? 72 : isBowEquipped ? 48 : 60;
  const dotColor = isKill ? '#ff2d2d' : '#cccccc';
  const glowColor = isKill ? '#ff5555' : '#cccccc';
  const dotRadius = isKill ? 2.5 : 2;
  const centerDotSize = isKill ? '8px' : '6px';
  const opacity = 1.0;

  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-visible"
      style={{
        zIndex: 9998,
        background: 'transparent',
      }}
    >
      <style>{`
        @keyframes strike-kill-pulse {
          0% { transform: translate(-50%, -50%) scale(0.85); opacity: 0.7; }
          40% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        }
      `}</style>
      <div
        className="absolute"
        style={{
          left: `${screenPx.x}px`,
          top: `${screenPx.y}px`,
          transform: isKill ? undefined : 'translate(-50%, -50%) scale(1)',
          animation: isKill ? 'strike-kill-pulse 0.35s ease-out forwards' : undefined,
          transition:
            !isKill && screenPx.mode === 'projected'
              ? 'transform 0.05s ease-out, left 0.05s ease-out, top 0.05s ease-out'
              : !isKill
                ? 'transform 0.05s ease-out'
                : undefined,
        }}
      >
        <div
          className="relative"
          style={{
            width: `${sizePx}px`,
            height: `${sizePx}px`,
            overflow: 'visible',
            background: 'transparent',
            border: 'none',
            outline: 'none',
            boxShadow: 'none',
            isolation: 'isolate',
          }}
        >
          {isKill && (
            <div
              className="absolute rounded-full"
              style={{
                width: `${sizePx}px`,
                height: `${sizePx}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                border: '1.5px solid rgba(255, 45, 45, 0.55)',
                boxShadow: '0 0 14px rgba(255, 85, 85, 0.7), inset 0 0 10px rgba(255, 45, 45, 0.25)',
                background: 'transparent',
                pointerEvents: 'none',
              }}
            />
          )}
          <svg
            width={sizePx}
            height={sizePx}
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
              const spacing = sizePx / 6;
              const x = (i + 0.5) * spacing;
              const y = (i + 0.5) * spacing;
              return (
                <circle
                  key={`diag1-${i}`}
                  cx={x}
                  cy={y}
                  r={dotRadius}
                  fill={dotColor}
                  style={{ filter: `drop-shadow(0 0 ${isKill ? 6 : 4}px ${glowColor})` }}
                />
              );
            })}
            {[1, 2, 3, 4].map((i) => {
              const spacing = sizePx / 6;
              const x = sizePx - (i + 0.5) * spacing;
              const y = (i + 0.5) * spacing;
              return (
                <circle
                  key={`diag2-${i}`}
                  cx={x}
                  cy={y}
                  r={dotRadius}
                  fill={dotColor}
                  style={{ filter: `drop-shadow(0 0 ${isKill ? 6 : 4}px ${glowColor})` }}
                />
              );
            })}
          </svg>
          <div
            className="absolute rounded-full"
            style={{
              width: centerDotSize,
              height: centerDotSize,
              backgroundColor: dotColor,
              boxShadow: `0 0 ${isKill ? 12 : 8}px ${glowColor}`,
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
