'use client';

import React from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import { ALLY_CHOICE_CARDS, ALLY_ANCESTOR_ICON_SRC } from '@/utils/coopAllyChoice';
import { EXPLORE_BARRACKS_ALLY_GOLD_COST } from '@/utils/exploreBuildings';
import type { CoopAllyKind } from '@/utils/coopAllyTargeting';

interface BarracksRecruitPanelProps {
  open: boolean;
  gold: number;
  allyCount: number;
  allyCap: number;
  onRecruit: (kind: CoopAllyKind) => void;
  widthPercent?: number;
}

const DEFAULT_WIDTH_PERCENT = 72;

export default function BarracksRecruitPanel({
  open,
  gold,
  allyCount,
  allyCap,
  onRecruit,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: BarracksRecruitPanelProps) {
  if (!open) return null;

  const affordable = gold >= EXPLORE_BARRACKS_ALLY_GOLD_COST;
  const atCap = allyCount >= allyCap;

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
              'linear-gradient(90deg, transparent, rgba(251,191,36,0.5) 25%, rgba(255,230,160,0.85) 50%, rgba(251,191,36,0.5) 75%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <p
          className="text-center text-xs font-semibold tracking-wide m-0"
          style={{
            color: 'rgba(255, 220, 160, 0.95)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          Spirit Lounge — recruit an ancestor ({EXPLORE_BARRACKS_ALLY_GOLD_COST} gold each)
        </p>
        <p
          className="text-center text-xs m-0"
          style={{ color: 'rgba(180, 190, 210, 0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
        >
          Allies {allyCount}/{allyCap}
        </p>
        {atCap ? (
          <p
            className="text-center text-xs m-0"
            style={{ color: 'rgba(180, 190, 210, 0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
          >
            Party is full. Purchase another if they fall.
          </p>
        ) : (
          ALLY_CHOICE_CARDS.map((card, index) => {
            const selectable = affordable && !atCap;
            const dimmed = !selectable;
            return (
              <button
                key={card.kind}
                type="button"
                className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
                style={{
                  color: dimmed ? 'rgba(140, 150, 170, 0.65)' : 'rgba(240, 230, 210, 0.95)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                  pointerEvents: selectable ? 'auto' : 'none',
                }}
                onClick={() => selectable && onRecruit(card.kind)}
              >
                <span className="flex items-center gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      minWidth: '1.25rem',
                      color: selectable ? 'rgba(255, 200, 120, 0.95)' : undefined,
                    }}
                  >
                    [{index + 1}]
                  </span>
                  <img
                    src={ALLY_ANCESTOR_ICON_SRC[card.kind]}
                    alt=""
                    width={20}
                    height={20}
                    style={{ borderRadius: 4, opacity: dimmed ? 0.45 : 1 }}
                  />
                  {card.title}
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>— {card.role}</span>
                </span>
                <span style={{ opacity: 0.85 }}>{EXPLORE_BARRACKS_ALLY_GOLD_COST} gold</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
