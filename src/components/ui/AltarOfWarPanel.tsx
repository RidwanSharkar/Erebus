'use client';

import React from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import {
  EXPLORE_SIEGE_GOLEM_GOLD,
  EXPLORE_SIEGE_GOLEM_STONE,
} from '@/utils/exploreBuildings';

interface AltarOfWarPanelProps {
  open: boolean;
  stone: number;
  gold: number;
  onSummon: () => void;
  widthPercent?: number;
}

const DEFAULT_WIDTH_PERCENT = 72;

export default function AltarOfWarPanel({
  open,
  stone,
  gold,
  onSummon,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: AltarOfWarPanelProps) {
  if (!open) return null;

  const affordable =
    stone >= EXPLORE_SIEGE_GOLEM_STONE && gold >= EXPLORE_SIEGE_GOLEM_GOLD;

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
              'linear-gradient(90deg, transparent, rgba(239,68,68,0.5) 25%, rgba(252,165,165,0.85) 50%, rgba(239,68,68,0.5) 75%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <p
          className="text-center text-xs font-semibold tracking-wide m-0"
          style={{
            color: 'rgba(255, 190, 190, 0.95)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          Altar of War — summon a Siege Golem
        </p>
        <button
          type="button"
          className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
          style={{
            color: affordable ? 'rgba(255, 230, 230, 0.95)' : 'rgba(140, 150, 170, 0.65)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            pointerEvents: affordable ? 'auto' : 'none',
          }}
          onClick={() => affordable && onSummon()}
        >
          <span className="flex items-center gap-2">
            <span
              style={{
                display: 'inline-block',
                minWidth: '1.25rem',
                color: affordable ? 'rgba(248, 113, 113, 0.95)' : undefined,
              }}
            >
              [1]
            </span>
            Siege Golem
            <span style={{ opacity: 0.7, fontWeight: 400 }}>
              — 7500 HP · 100 melee · marches on enemy towns
            </span>
          </span>
          <span style={{ opacity: 0.85 }}>
            {EXPLORE_SIEGE_GOLEM_STONE} stone · {EXPLORE_SIEGE_GOLEM_GOLD} gold
          </span>
        </button>
      </div>
    </div>
  );
}
