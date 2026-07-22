'use client';

import React from 'react';
import { ExperienceSystem } from '@/utils/ExperienceSystem';
import { getArchetypeIconSvgSrc, type Archetype } from '@/utils/archetypes';

interface LevelBadgeProps {
  experience: number;
  level: number;
  isLocalPlayer?: boolean;
  selectedArchetype?: Archetype;
  /** Integrated mode sits beside resource bars; standalone keeps legacy bottom caption. */
  variant?: 'standalone' | 'integrated';
  className?: string;
}

const INTEGRATED_SIZE = 128;
const STANDALONE_SIZE = 88;
const RING_STROKE = 4;

export function CardinalNotch({ position }: { position: 'top' | 'bottom' | 'left' | 'right' }) {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: 8,
    height: 8,
    background: 'linear-gradient(135deg, rgba(120,180,255,0.9) 0%, rgba(40,80,160,0.7) 100%)',
    transform: 'rotate(45deg)',
    boxShadow: '0 0 6px rgba(80,160,255,0.8)',
    pointerEvents: 'none',
  };

  const offsets: Record<typeof position, React.CSSProperties> = {
    top: { top: 2, left: '50%', marginLeft: -4 },
    bottom: { bottom: 2, left: '50%', marginLeft: -4 },
    left: { left: 2, top: '50%', marginTop: -4 },
    right: { right: 2, top: '50%', marginTop: -4 },
  };

  return <div style={{ ...base, ...offsets[position] }} />;
}

export default function LevelBadge({
  experience,
  level,
  isLocalPlayer = true,
  selectedArchetype,
  variant = 'standalone',
  className = '',
}: LevelBadgeProps) {
  const isIntegrated = variant === 'integrated';
  const ringSize = isIntegrated ? INTEGRATED_SIZE : STANDALONE_SIZE;
  const ringRadius = (ringSize - RING_STROKE) / 2;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const framePadding = isIntegrated ? 14 : 12;

  const isMaxLevel = level >= 5;
  const progress = ExperienceSystem.getLevelProgress(level, experience);
  const { min, max } = ExperienceSystem.getCurrentLevelExpRange(level);
  const currentLevelExp = experience - min;
  const maxLevelExp = max - min;
  const progressPct = isMaxLevel ? 100 : progress;

  const accentFrom = isLocalPlayer ? '#fbbf24' : '#60a5fa';
  const accentTo = isLocalPlayer ? '#f59e0b' : '#6366f1';
  const arcOffset = ringCircumference * (1 - progressPct / 100);
  const showProgressArc = progressPct > 0;
  const gradId = `xpGrad-${isLocalPlayer ? 'local' : 'remote'}-${variant}`;

  const archetypeIcon = selectedArchetype ? getArchetypeIconSvgSrc(selectedArchetype) : null;
  const outerSize = ringSize + framePadding;

  const xpCaption = isMaxLevel
    ? `${experience.toLocaleString()} XP`
    : `${currentLevelExp.toLocaleString()} / ${maxLevelExp.toLocaleString()}`;

  return (
    <div
      className={`select-none shrink-0 ${className}`}
      style={{ width: outerSize }}
      data-block-game-input
    >
      <div className="relative flex flex-col items-center">
        <div
          className="relative flex items-center justify-center"
          style={{
            width: outerSize,
            height: outerSize,
            background: isIntegrated
              ? 'linear-gradient(145deg, rgba(50,60,90,0.75) 0%, rgba(10,12,22,0.98) 55%, rgba(4,6,14,1) 100%)'
              : 'linear-gradient(145deg, rgba(60,70,100,0.6) 0%, rgba(12,14,24,0.95) 50%, rgba(6,8,16,0.98) 100%)',
            borderRadius: '50%',
            boxShadow: isIntegrated
              ? '0 0 28px rgba(60,120,255,0.22), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -3px 6px rgba(0,0,0,0.55)'
              : '0 0 20px rgba(60,120,255,0.15), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -2px 4px rgba(0,0,0,0.5)',
            zIndex: 2,
          }}
        >
          {isIntegrated && (
            <>
              <CardinalNotch position="top" />
              <CardinalNotch position="bottom" />
              <CardinalNotch position="left" />
              <CardinalNotch position="right" />
            </>
          )}

          <svg
            width={outerSize}
            height={outerSize}
            className="absolute inset-0"
            style={{ transform: 'rotate(-90deg)' }}
            aria-hidden
          >
            <circle
              cx={outerSize / 2}
              cy={outerSize / 2}
              r={ringRadius + 2}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={RING_STROKE}
            />
            {showProgressArc && (
              <circle
                cx={outerSize / 2}
                cy={outerSize / 2}
                r={ringRadius + 2}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={arcOffset}
                style={{
                  transition: 'stroke-dashoffset 0.5s ease-out',
                  filter: `drop-shadow(0 0 4px ${accentFrom}88)`,
                }}
              />
            )}
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={accentFrom} />
                <stop offset="100%" stopColor={accentTo} />
              </linearGradient>
            </defs>
          </svg>

          <div
            className="relative flex flex-col items-center justify-center overflow-hidden"
            style={{
              width: ringSize,
              height: ringSize,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 35% 28%, rgba(35,50,90,0.96) 0%, rgba(8,10,20,0.98) 68%)',
              border: '1px solid rgba(100,140,220,0.3)',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.65)',
            }}
          >
            {/* Hex backdrop */}
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(
                  `<svg xmlns='http://www.w3.org/2000/svg' width='40' height='35' viewBox='0 0 40 35'>
                    <path d='M20 0l17 10v15l-17 10L3 25V10z' fill='none' stroke='rgba(80,140,255,0.35)' stroke-width='0.8'/>
                  </svg>`,
                )}")`,
                backgroundSize: '40px 35px',
              }}
            />

            {archetypeIcon ? (
              <img
                src={archetypeIcon}
                alt=""
                className={`opacity-90 ${isIntegrated ? 'w-9 h-9 mb-0.5' : 'w-7 h-7 mb-0.5'}`}
                style={{ filter: 'drop-shadow(0 0 8px rgba(100,180,255,0.55))' }}
              />
            ) : (
              <span className="text-[8px] font-bold uppercase tracking-widest text-white/40 mb-0.5">
                Level
              </span>
            )}

            <span
              className={`font-black leading-none tabular-nums ${isIntegrated ? 'text-3xl' : 'text-2xl'}`}
              style={{
                color: 'rgba(255,255,255,0.96)',
                textShadow: `0 0 14px ${accentFrom}66, 0 2px 4px rgba(0,0,0,0.85)`,
              }}
            >
              {level}
            </span>

            {isIntegrated && (
              <div className="mt-1 text-center px-2" style={{ zIndex: 1 }}>
                <p
                  className="text-[7px] font-bold uppercase tracking-[0.2em] leading-none mb-0.5"
                  style={{ color: 'rgba(180,190,210,0.65)' }}
                >
                  {isMaxLevel ? 'Max Level' : 'Experience'}
                </p>
                <p
                  className="text-[9px] font-semibold tabular-nums leading-none"
                  style={{
                    color: accentFrom,
                    textShadow: `0 0 8px ${accentFrom}44`,
                  }}
                >
                  {xpCaption}
                </p>
              </div>
            )}
          </div>
        </div>

        {!isIntegrated && (
          <div className="mt-1.5 text-center" style={{ minWidth: ringSize + 16 }}>
            <p
              className="text-[9px] font-bold uppercase tracking-widest mb-0.5"
              style={{ color: 'rgba(180,190,210,0.7)' }}
            >
              {isMaxLevel ? 'Max Level' : 'Experience'}
            </p>
            <p
              className="text-[10px] font-semibold tabular-nums"
              style={{
                color: accentFrom,
                textShadow: `0 0 8px ${accentFrom}44`,
              }}
            >
              {isMaxLevel
                ? `${experience.toLocaleString()} XP`
                : `${currentLevelExp.toLocaleString()} / ${maxLevelExp.toLocaleString()} XP`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
