'use client';

import React from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import {
  getWeaponDisplayName,
  getWeaponPortraitIconSrc,
} from '@/utils/weaponIcons';
import {
  HEX_PATTERN_BG,
  WEAPON_PORTRAIT_FRAME_PADDING,
  WEAPON_PORTRAIT_RADIUS,
  WEAPON_PORTRAIT_SIZE,
} from './hudChrome';

interface WeaponPortraitBadgeProps {
  weapon: WeaponType;
  /** Overrides native title / aria-label (defaults to weapon display name). */
  label?: string;
  className?: string;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: () => void;
}

export default function WeaponPortraitBadge({
  weapon,
  label,
  className = '',
  onMouseEnter,
  onMouseLeave,
}: WeaponPortraitBadgeProps) {
  const portraitSrc = getWeaponPortraitIconSrc(weapon);
  if (!portraitSrc) return null;

  const outerSize = WEAPON_PORTRAIT_SIZE + WEAPON_PORTRAIT_FRAME_PADDING * 1;
  const displayLabel = label ?? getWeaponDisplayName(weapon);

  return (
    <div
      className={`relative shrink-0 select-none ${className}`}
      style={{ width: outerSize, height: outerSize, zIndex: 2 }}
      data-block-game-input
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      title={displayLabel}
      aria-label={displayLabel}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          width: outerSize,
          height: outerSize,
          borderRadius: WEAPON_PORTRAIT_RADIUS,
          background:
            'linear-gradient(145deg, rgba(50,60,90,0.75) 0%, rgba(10,12,22,0.98) 55%, rgba(4,6,14,1) 100%)',
          boxShadow:
            '0 0 20px rgba(60,120,255,0.18), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 5px rgba(0,0,0,0.55)',
        }}
      >
        <div
          className="relative overflow-hidden"
          style={{
            width: WEAPON_PORTRAIT_SIZE,
            height: WEAPON_PORTRAIT_SIZE,
            borderRadius: Math.max(6, WEAPON_PORTRAIT_RADIUS - 2),
            border: '1px solid rgba(100,140,220,0.28)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.55)',
          }}
        >
          <div
            className="absolute inset-0 opacity-35"
            style={{
              backgroundImage: HEX_PATTERN_BG,
              backgroundSize: '28px 24px',
            }}
          />
          <img
            src={portraitSrc}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ filter: 'drop-shadow(0 0 8px rgba(80,140,255,0.35))' }}
          />
        </div>
      </div>
    </div>
  );
}
