import React, { useEffect, useRef, useState } from 'react';
import type { Archetype } from '@/utils/archetypes';
import {
  BAR_FRAME_GRADIENT,
  BAR_HEIGHT,
  BAR_TRACK_GRADIENT,
  getResourceBarTheme,
  HEX_PATTERN_BG,
  RESOURCE_BAR_CLIP,
  RESOURCE_BAR_TRACK_CLIP,
  TICKS,
  type ResourceBarKind,
} from './hudChrome';

interface ResourceBarProps {
  current: number;
  max: number;
  kind: ResourceBarKind;
  archetype?: Archetype;
}

export default function ResourceBar({ current, max, kind, archetype }: ResourceBarProps) {
  const { gradientFrom, gradientTo, glowColor } = getResourceBarTheme(kind, archetype);
  const pct = Math.max(0, Math.min(100, max > 0 ? (current / max) * 100 : 0));
  const isLow = pct < 30;
  const isCritical = pct < 15;

  const prevPctRef = useRef(pct);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drainPct, setDrainPct] = useState(pct);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (pct < prevPctRef.current) {
      setDrainPct(prevPctRef.current);
      setFlashing(true);
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      drainTimerRef.current = setTimeout(() => setDrainPct(pct), 380);
      flashTimerRef.current = setTimeout(() => setFlashing(false), 480);
    } else {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      setDrainPct(pct);
    }
    prevPctRef.current = pct;
  }, [pct]);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return (
    <div style={{ width: '100%', minWidth: 0 }}>
      <div
        style={{
          position: 'relative',
          padding: '2px',
          background: BAR_FRAME_GRADIENT,
          clipPath: RESOURCE_BAR_CLIP,
          boxShadow: `0 0 14px ${glowColor}22, inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.6)`,
        }}
      >
        <div
          style={{
            position: 'relative',
            height: `${BAR_HEIGHT}px`,
            background: BAR_TRACK_GRADIENT,
            clipPath: RESOURCE_BAR_CLIP,
            overflow: 'hidden',
          }}
        >
          {/* Hex texture */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: HEX_PATTERN_BG,
              backgroundSize: '28px 24px',
              opacity: 0.85,
              pointerEvents: 'none',
            }}
          />

          {/* Drain ghost */}
          <div
            style={{
              position: 'absolute',
              inset: 3,
              clipPath: RESOURCE_BAR_TRACK_CLIP,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${drainPct}%`,
                background: `linear-gradient(90deg, ${glowColor}55, ${glowColor}28)`,
                transition: 'width 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Main fill */}
          <div
            style={{
              position: 'absolute',
              inset: 3,
              clipPath: RESOURCE_BAR_TRACK_CLIP,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${gradientFrom}ee, ${gradientTo}, ${gradientFrom}cc)`,
                backgroundSize: '200% 100%',
                animation: pct > 0 ? 'hb-flow 3s linear infinite' : 'none',
                boxShadow: `0 0 ${isCritical ? 16 : 8}px ${glowColor}${isCritical ? 'cc' : '66'}`,
                transition: 'width 0.18s ease-out',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '45%',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '35%',
                  background: 'linear-gradient(0deg, rgba(0,0,0,0.35) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '-20%',
                  left: 0,
                  width: '32%',
                  height: '140%',
                  background:
                    'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                  animation: 'hb-shimmer 4.8s ease-in-out infinite',
                  willChange: 'transform',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </div>

          {flashing && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(255,255,255,0.52)',
                animation: 'hb-flash 0.48s ease-out forwards',
                pointerEvents: 'none',
                zIndex: 4,
              }}
            />
          )}

          {TICKS.map((t) => (
            <div
              key={t}
              style={{
                position: 'absolute',
                top: '12%',
                bottom: '12%',
                left: `calc(3px + (100% - 6px) * ${t / 100})`,
                width: '2px',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0.55) 50%, rgba(255,255,255,0.05) 100%)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
          ))}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              border: `1px solid ${glowColor}${isLow ? 'bb' : '35'}`,
              clipPath: RESOURCE_BAR_CLIP,
              boxShadow: isLow ? `inset 0 0 12px ${glowColor}33` : 'inset 0 1px 0 rgba(255,255,255,0.06)',
              animation: 'hb-border-pulse 1s ease-in-out infinite',
              animationPlayState: isLow ? 'running' : 'paused',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          />

          {/* Left-aligned values */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              paddingLeft: 15,
              pointerEvents: 'none',
              zIndex: 6,
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 800,
                fontVariantNumeric: 'tabular-nums',
                color: 'rgba(255,255,255,0.96)',
                textShadow: `0 1px 4px rgba(0,0,0,1), 0 0 10px ${glowColor}55`,
                letterSpacing: '0.04em',
                lineHeight: 1,
              }}
            >
              {Math.round(current).toLocaleString()} / {max.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
