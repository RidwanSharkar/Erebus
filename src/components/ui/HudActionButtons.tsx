'use client';

import React from 'react';
import { CardinalNotch } from './LevelBadge';

interface HudActionButtonsProps {
  onOpenRulebook: () => void;
  onOpenControls: () => void;
  onOpenSettings: () => void;
}

const BUTTON_SIZE = 40;
const FRAME_PADDING = 8;
const OUTER_SIZE = BUTTON_SIZE + FRAME_PADDING;

function HudCircleButton({
  onClick,
  title,
  iconSrc,
  iconClassName = 'h-5 w-5',
}: {
  onClick: () => void;
  title: string;
  iconSrc: string;
  iconClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className="relative flex shrink-0 items-center justify-center hover:scale-110 transition-transform cursor-pointer"
      style={{ width: OUTER_SIZE, height: OUTER_SIZE }}
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          width: OUTER_SIZE,
          height: OUTER_SIZE,
          background:
            'linear-gradient(145deg, rgba(50,60,90,0.75) 0%, rgba(10,12,22,0.98) 55%, rgba(4,6,14,1) 100%)',
          borderRadius: '50%',
          boxShadow:
            '0 0 16px rgba(60,120,255,0.22), inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -2px 5px rgba(0,0,0,0.55)',
        }}
      >
        <CardinalNotch position="top" />
        <CardinalNotch position="bottom" />
        <CardinalNotch position="left" />
        <CardinalNotch position="right" />

        <div
          className="relative flex items-center justify-center overflow-hidden"
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            borderRadius: '50%',
            background:
              'radial-gradient(circle at 35% 28%, rgba(35,50,90,0.96) 0%, rgba(8,10,20,0.98) 68%)',
            border: '1px solid rgba(100,140,220,0.3)',
            boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.65)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconSrc}
            alt=""
            className={`${iconClassName} object-contain opacity-90`}
            aria-hidden
          />
        </div>
      </div>
    </button>
  );
}

export default function HudActionButtons({
  onOpenRulebook,
  onOpenControls,
  onOpenSettings,
}: HudActionButtonsProps) {
  return (
    <div className="mt-2 flex flex-col items-center gap-2" data-block-game-input>
      <HudCircleButton
        onClick={onOpenRulebook}
        title="Rulebook"
        iconSrc="/icons/rules.svg"
      />
      <HudCircleButton
        onClick={onOpenControls}
        title="Replay controls"
        iconSrc="/icons/strike.svg"
      />
      <HudCircleButton
        onClick={onOpenSettings}
        title="Settings"
        iconSrc="/icons/settings.svg"
      />
    </div>
  );
}
