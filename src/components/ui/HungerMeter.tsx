'use client';

import React from 'react';
import { EXPLORE_HUNGER_MAX } from '@/utils/exploreBuildings';

const WIDTH = 180;
const MEAT_ICON = '/icons/meat.svg';

interface HungerMeterProps {
  hunger: number;
  starvingCritical?: boolean;
}

function fillColors(pct: number, starvingCritical: boolean): { from: string; to: string } {
  if (starvingCritical) {
    return { from: '#7f1d1d', to: '#ef4444' };
  }
  if (pct >= 80) {
    return { from: '#9f1239', to: '#f43f5e' };
  }
  if (pct >= 40) {
    return { from: '#c2410c', to: '#f97316' };
  }
  return { from: '#854d0e', to: '#eab308' };
}

export default function HungerMeter({ hunger, starvingCritical = false }: HungerMeterProps) {
  const value = Math.max(0, Math.min(EXPLORE_HUNGER_MAX, Math.floor(hunger)));
  const pct = EXPLORE_HUNGER_MAX > 0 ? (value / EXPLORE_HUNGER_MAX) * 100 : 0;
  const atMax = value >= EXPLORE_HUNGER_MAX;
  const { from, to } = fillColors(pct, starvingCritical);

  return (
    <div
      className="pointer-events-none select-none flex items-center gap-1.5 rounded-md border bg-black/55 px-2 py-1 shadow-[0_0_18px_rgba(244,63,94,0.12)]"
      style={{
        width: WIDTH,
        borderColor: starvingCritical
          ? 'rgba(239,68,68,0.55)'
          : atMax
            ? 'rgba(244,63,94,0.45)'
            : 'rgba(234,179,8,0.28)',
      }}
      data-block-game-input
    >
      <img src={MEAT_ICON} alt="" width={14} height={14} className="shrink-0 opacity-90" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className="font-semibold tracking-widest"
            style={{
              fontSize: 9,
              color: starvingCritical ? 'rgba(254,202,202,0.95)' : 'rgba(254,215,170,0.9)',
            }}
          >
            HUNGER
          </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: 9,
              color: starvingCritical ? 'rgba(254,202,202,0.85)' : 'rgba(253,186,116,0.8)',
            }}
          >
            {value}/{EXPLORE_HUNGER_MAX}
          </span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-sm"
          style={{ background: 'rgba(0,0,0,0.55)', boxShadow: 'inset 0 0 0 1px rgba(248,250,252,0.08)' }}
        >
          <div
            className={atMax || starvingCritical ? 'animate-pulse' : undefined}
            style={{
              width: `${pct}%`,
              height: '100%',
              background: `linear-gradient(90deg, ${from}, ${to})`,
              boxShadow: starvingCritical ? '0 0 8px rgba(239,68,68,0.7)' : '0 0 6px rgba(244,63,94,0.35)',
              transition: 'width 200ms linear',
            }}
          />
        </div>
      </div>
    </div>
  );
}
