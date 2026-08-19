'use client';

import React from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import {
  EXPLORE_RESEARCH_UPGRADES,
  EXPLORE_SPIRIT_LINEAGE_MAX_RANK,
  getExploreResearchFlowCost,
  getSpiritLineageDescription,
  getSpiritLineageLabel,
  getSpiritLineageNextCost,
  isExploreResearchPurchased,
  type ExploreResearchState,
  type ExploreResearchUpgradeId,
} from '@/utils/exploreBuildings';

interface ResearchStationPanelProps {
  open: boolean;
  flow: number;
  research: ExploreResearchState;
  onPurchase: (id: ExploreResearchUpgradeId) => void;
  widthPercent?: number;
}

const DEFAULT_WIDTH_PERCENT = 72;

export default function ResearchStationPanel({
  open,
  flow,
  research,
  onPurchase,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: ResearchStationPanelProps) {
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
              'linear-gradient(90deg, transparent, rgba(168,85,247,0.5) 25%, rgba(216,180,254,0.85) 50%, rgba(168,85,247,0.5) 75%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <p
          className="text-center text-xs font-semibold tracking-wide m-0"
          style={{
            color: 'rgba(220, 200, 255, 0.95)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          Research Station — choose an upgrade
        </p>
        {EXPLORE_RESEARCH_UPGRADES.map((upgrade) => {
          if (upgrade.id === 'spirit-lineage') {
            const rank = research.spiritLineage ?? 0;
            const maxed = rank >= EXPLORE_SPIRIT_LINEAGE_MAX_RANK;
            const cost = getSpiritLineageNextCost(rank);
            const label = maxed ? 'Spirit Lineage Level IV' : getSpiritLineageLabel(rank);
            const description = maxed
              ? 'Max Spirit Lounge ally cap (5)'
              : getSpiritLineageDescription(rank);
            const selectable = !maxed && cost != null && flow >= cost;
            const dimmed = maxed || !selectable;
            return (
              <button
                key={upgrade.id}
                type="button"
                className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
                style={{
                  color: dimmed ? 'rgba(140, 150, 170, 0.65)' : 'rgba(240, 230, 255, 0.95)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                  pointerEvents: selectable ? 'auto' : 'none',
                }}
                onClick={() => selectable && onPurchase(upgrade.id)}
              >
                <span className="flex items-center gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      minWidth: '1.25rem',
                      color: selectable ? 'rgba(200, 160, 255, 0.95)' : undefined,
                    }}
                  >
                    [{upgrade.hotkey}]
                  </span>
                  {label}
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>— {description}</span>
                </span>
                <span style={{ opacity: 0.85 }}>
                  {maxed ? 'Researched' : `${cost} flow`}
                </span>
              </button>
            );
          }

          const purchased = isExploreResearchPurchased(upgrade.id, research);
          const cost = getExploreResearchFlowCost(upgrade.id);
          const selectable = flow >= cost && !purchased;
          const dimmed = purchased || !selectable;
          return (
            <button
              key={upgrade.id}
              type="button"
              className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
              style={{
                color: dimmed ? 'rgba(140, 150, 170, 0.65)' : 'rgba(240, 230, 255, 0.95)',
                textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                pointerEvents: selectable ? 'auto' : 'none',
              }}
              onClick={() => selectable && onPurchase(upgrade.id)}
            >
              <span className="flex items-center gap-2">
                <span
                  style={{
                    display: 'inline-block',
                    minWidth: '1.25rem',
                    color: selectable ? 'rgba(200, 160, 255, 0.95)' : undefined,
                  }}
                >
                  [{upgrade.hotkey}]
                </span>
                {upgrade.label}
                <span style={{ opacity: 0.7, fontWeight: 400 }}>— {upgrade.description}</span>
              </span>
              <span style={{ opacity: 0.85 }}>
                {purchased ? 'Researched' : `${cost} flow`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
