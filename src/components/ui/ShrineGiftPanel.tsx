'use client';

import React from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import {
  EXPLORE_SHRINE_GIFTS,
  type ExploreShrineGiftId,
} from '@/utils/exploreBuildings';

interface ShrineGiftPanelProps {
  open: boolean;
  onSelect: (id: ExploreShrineGiftId) => void;
  widthPercent?: number;
}

const DEFAULT_WIDTH_PERCENT = 72;

const GIFT_ACCENT: Record<ExploreShrineGiftId, string> = {
  inferno: 'rgba(255, 140, 80, 0.95)',
  tempest: 'rgba(120, 180, 255, 0.95)',
  abyss: 'rgba(180, 140, 255, 0.95)',
  plague: 'rgba(120, 220, 150, 0.95)',
};

export default function ShrineGiftPanel({
  open,
  onSelect,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: ShrineGiftPanelProps) {
  if (!open) return null;

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
              'linear-gradient(90deg, transparent, rgba(255,140,80,0.45) 20%, rgba(180,140,255,0.85) 50%, rgba(120,220,150,0.45) 80%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <p
          className="text-center text-xs font-semibold tracking-wide m-0"
          style={{
            color: 'rgba(230, 210, 255, 0.95)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          Shrine — choose one gift (building is spent after)
        </p>
        {EXPLORE_SHRINE_GIFTS.map((gift) => (
          <button
            key={gift.id}
            type="button"
            className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
            style={{
              color: 'rgba(240, 230, 255, 0.95)',
              textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            }}
            onClick={() => onSelect(gift.id)}
          >
            <span className="flex items-center gap-2">
              <span
                style={{
                  display: 'inline-block',
                  minWidth: '1.25rem',
                  color: GIFT_ACCENT[gift.id],
                }}
              >
                [{gift.hotkey}]
              </span>
              {gift.label}
              <span style={{ opacity: 0.7, fontWeight: 400 }}>— {gift.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
