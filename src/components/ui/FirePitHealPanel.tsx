'use client';

import React from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import {
  EXPLORE_FIRE_PIT_HEAL_MEAT_COST,
  EXPLORE_FIRE_PIT_HEAL_SELF_HP,
  type ExploreFirePitHealAction,
} from '@/utils/exploreBuildings';

interface FirePitHealPanelProps {
  open: boolean;
  meat: number;
  hunger?: number;
  playerAtFullHp: boolean;
  allyCount: number;
  onHeal: (action: ExploreFirePitHealAction) => void;
  widthPercent?: number;
}

const DEFAULT_WIDTH_PERCENT = 72;
const MEAT_ICON = '/icons/meat.svg';

export default function FirePitHealPanel({
  open,
  meat,
  hunger = 0,
  playerAtFullHp,
  allyCount,
  onHeal,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: FirePitHealPanelProps) {
  if (!open) return null;

  const affordable = meat >= EXPLORE_FIRE_PIT_HEAL_MEAT_COST;
  const selfReady = affordable && (!playerAtFullHp || hunger > 0);
  const alliesReady = affordable && allyCount > 0;

  return (
    <div style={{ width: `${widthPercent}%`, margin: '0 auto' }}>
      <div
        className="backdrop-blur-md flex flex-col justify-center gap-1.5"
        style={{
          position: 'relative',
          minHeight: 88,
          background: HUD_PANEL_BG,
          border: HUD_PANEL_BORDER,
          clipPath: HUD_PANEL_CLIP,
          boxShadow: HUD_PANEL_SHADOW,
          padding: '8px 16px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '16px',
            right: '16px',
            height: '1px',
            background:
              'linear-gradient(90deg, transparent, rgba(244,63,94,0.45) 25%, rgba(254,205,170,0.85) 50%, rgba(244,63,94,0.45) 75%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <p
          className="text-center text-xs font-semibold tracking-wide m-0"
          style={{
            color: 'rgba(255, 210, 180, 0.95)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          Fire Pit — cook raw meat
        </p>
        <button
          type="button"
          className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
          style={{
            color: selfReady ? 'rgba(255, 230, 210, 0.95)' : 'rgba(140, 150, 170, 0.65)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            pointerEvents: selfReady ? 'auto' : 'none',
          }}
          onClick={() => selfReady && onHeal('self')}
        >
          <span className="flex items-center gap-2">
            <span
              style={{
                display: 'inline-block',
                minWidth: '1.25rem',
                color: selfReady ? 'rgba(251, 146, 60, 0.95)' : undefined,
              }}
            >
              [1]
            </span>
            Rest by the fire
            <span style={{ opacity: 0.7, fontWeight: 400 }}>
              — heal {EXPLORE_FIRE_PIT_HEAL_SELF_HP} HP and satiate hunger
            </span>
          </span>
          <span className="flex items-center gap-1" style={{ opacity: 0.85 }}>
            <img src={MEAT_ICON} alt="" width={14} height={14} />
            {EXPLORE_FIRE_PIT_HEAL_MEAT_COST} meat
          </span>
        </button>
        <button
          type="button"
          className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
          style={{
            color: alliesReady ? 'rgba(255, 230, 210, 0.95)' : 'rgba(140, 150, 170, 0.65)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            pointerEvents: alliesReady ? 'auto' : 'none',
          }}
          onClick={() => alliesReady && onHeal('allies')}
        >
          <span className="flex items-center gap-2">
            <span
              style={{
                display: 'inline-block',
                minWidth: '1.25rem',
                color: alliesReady ? 'rgba(251, 146, 60, 0.95)' : undefined,
              }}
            >
              [2]
            </span>
            Feed the ancestors
            <span style={{ opacity: 0.7, fontWeight: 400 }}>
              — all Spirit Lounge allies to full HP
            </span>
          </span>
          <span className="flex items-center gap-1" style={{ opacity: 0.85 }}>
            <img src={MEAT_ICON} alt="" width={14} height={14} />
            {EXPLORE_FIRE_PIT_HEAL_MEAT_COST} meat
          </span>
        </button>
      </div>
    </div>
  );
}
