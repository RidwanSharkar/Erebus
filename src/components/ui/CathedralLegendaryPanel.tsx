'use client';

import React from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import type { ExploreCathedralOfferEntry } from '@/utils/exploreBuildings';

interface CathedralLegendaryPanelProps {
  open: boolean;
  options: readonly ExploreCathedralOfferEntry[];
  onSelect: (itemType: string) => void;
  widthPercent?: number;
}

const DEFAULT_WIDTH_PERCENT = 72;

export default function CathedralLegendaryPanel({
  open,
  options,
  onSelect,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: CathedralLegendaryPanelProps) {
  if (!open || options.length === 0) return null;

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
              'linear-gradient(90deg, transparent, rgba(255,200,120,0.45) 20%, rgba(230,190,90,0.85) 50%, rgba(255,200,120,0.45) 80%, transparent)',
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
          Cathedral — choose one legendary (building is spent after)
        </p>
        {options.map((entry, index) => {
          const hotkey = String(index + 1);
          return (
            <button
              key={entry.type}
              type="button"
              className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
              style={{
                color: 'rgba(255, 240, 210, 0.95)',
                textShadow: '0 1px 6px rgba(0,0,0,0.9)',
              }}
              onClick={() => onSelect(entry.type)}
            >
              <span className="flex items-center gap-2">
                <span
                  style={{
                    display: 'inline-block',
                    minWidth: '1.25rem',
                    color: 'rgba(255, 200, 120, 0.95)',
                  }}
                >
                  [{hotkey}]
                </span>
                {entry.label}
                <span style={{ opacity: 0.7, fontWeight: 400 }}>— {entry.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
