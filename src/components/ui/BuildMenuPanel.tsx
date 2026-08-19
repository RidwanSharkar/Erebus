'use client';

import React, { useCallback, useState } from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import { HotkeyTooltip, type TooltipContent } from './hotkeyTalentSlot';
import {
  EMPTY_EXPLORE_RESEARCH,
  EXPLORE_BUILDING_DEFS,
  EXPLORE_BUILDING_ROOT_ORDER,
  EXPLORE_TOWER_CATEGORY_HOTKEY,
  EXPLORE_TOWER_PICK_ORDER,
  exploreBuildingRequiresSpiritLounge,
  exploreBuildingRequiresShrineOrObelisk,
  getExploreBuildingDef,
  getExploreBuildingIconSrc,
  getExploreBuildingWoodCost,
  type ExploreBuildMenuIconId,
  type ExploreBuildMenuView,
  type ExploreBuildingKind,
  type ExploreResearchState,
} from '@/utils/exploreBuildings';

interface BuildMenuPanelProps {
  open: boolean;
  wood: number;
  flow?: number;
  stone?: number;
  view?: ExploreBuildMenuView;
  hasLiveSpiritLounge?: boolean;
  hasLiveShrineOrObelisk?: boolean;
  exploreResearch?: ExploreResearchState;
}

function canAffordBuilding(
  wood: number,
  flow: number,
  stone: number,
  kind: ExploreBuildingKind,
  research: ExploreResearchState,
): boolean {
  const def = getExploreBuildingDef(kind);
  const woodCost = getExploreBuildingWoodCost(kind, research);
  if (wood < woodCost) return false;
  if ((def.stoneCost ?? 0) > 0 && stone < (def.stoneCost ?? 0)) return false;
  const flowCost = def.flowCost ?? 0;
  return flow >= flowCost;
}

function formatBuildingCost(kind: ExploreBuildingKind, research: ExploreResearchState): string {
  const def = getExploreBuildingDef(kind);
  const parts: string[] = [];
  const woodCost = getExploreBuildingWoodCost(kind, research);
  if (woodCost > 0) parts.push(`${woodCost} wood`);
  if ((def.stoneCost ?? 0) > 0) parts.push(`${def.stoneCost} stone`);
  if ((def.flowCost ?? 0) > 0) parts.push(`${def.flowCost} flow`);
  parts.push(`${def.maxHp} HP`);
  return parts.join(' · ');
}

function joinTooltipLines(lines: string[]): string {
  return lines.filter(Boolean).join(' · ');
}

interface BuildSlotProps {
  hotkey: string;
  label: string;
  iconId: ExploreBuildMenuIconId;
  description: string;
  selectable: boolean;
  dimmed: boolean;
  onHover: (e: React.MouseEvent, content: TooltipContent) => void;
  onLeave: () => void;
}

function BuildSlot({
  hotkey,
  label,
  iconId,
  description,
  selectable,
  dimmed,
  onHover,
  onLeave,
}: BuildSlotProps) {
  const slotBorder = dimmed
    ? '1px solid rgba(80,80,100,0.35)'
    : selectable
      ? '1px solid rgba(100,160,255,0.55)'
      : '1px solid rgba(100,100,130,0.38)';
  const slotBg = dimmed
    ? 'rgba(10,10,20,0.6)'
    : 'linear-gradient(135deg, rgba(12,20,42,0.7), rgba(8,10,24,0.55))';
  const slotShadow = dimmed
    ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
    : '0 0 10px rgba(80,140,255,0.18), inset 0 1px 0 rgba(255,255,255,0.07)';

  return (
    <div
      className="relative w-12 h-12 rounded-lg transition-all duration-200 flex items-center justify-center cursor-default"
      style={{
        background: slotBg,
        border: slotBorder,
        boxShadow: slotShadow,
        opacity: dimmed ? 0.45 : 1,
      }}
      onMouseEnter={(e) => onHover(e, { name: label, description })}
      onMouseLeave={onLeave}
    >
      <div
        className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-px text-[10px] font-mono font-bold"
        style={{
          background: 'rgba(18,18,34,0.97)',
          border: selectable && !dimmed
            ? '1px solid rgba(255,200,120,0.55)'
            : '1px solid rgba(120,120,160,0.4)',
          color: selectable && !dimmed
            ? 'rgba(255,200,120,0.95)'
            : 'rgba(180,180,200,0.8)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap',
        }}
      >
        {hotkey}
      </div>
      <img
        src={getExploreBuildingIconSrc(iconId)}
        alt=""
        className="h-7 w-7 object-contain"
        style={{
          filter: dimmed
            ? 'opacity(0.7)'
            : 'drop-shadow(0 0 4px rgba(120,180,255,0.45))',
        }}
      />
    </div>
  );
}

export default function BuildMenuPanel({
  open,
  wood,
  flow = 0,
  stone = 0,
  view = 'root',
  hasLiveSpiritLounge = false,
  hasLiveShrineOrObelisk = false,
  exploreResearch = EMPTY_EXPLORE_RESEARCH,
}: BuildMenuPanelProps) {
  const [tooltipContent, setTooltipContent] = useState<TooltipContent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleHover = useCallback((e: React.MouseEvent, content: TooltipContent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent(content);
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const handleLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  if (!open) return null;

  const watchWoodCost = getExploreBuildingWoodCost('watch-tower', exploreResearch);
  const mageDef = EXPLORE_BUILDING_DEFS.tower;
  const siegeDef = EXPLORE_BUILDING_DEFS['siege-tower'];
  const towerSelectable = EXPLORE_TOWER_PICK_ORDER.some((kind) => {
    const def = getExploreBuildingDef(kind);
    return def.enabled && canAffordBuilding(wood, flow, stone, kind, exploreResearch);
  });

  const slots: BuildSlotProps[] =
    view === 'towers'
      ? EXPLORE_TOWER_PICK_ORDER.map((kind) => {
          const def = getExploreBuildingDef(kind);
          const affordable = canAffordBuilding(wood, flow, stone, kind, exploreResearch);
          const selectable = def.enabled && affordable;
          const notes: string[] = [];
          if (!def.enabled) notes.push('Coming soon');
          else if (!affordable) notes.push('Cannot afford');
          return {
            hotkey: def.hotkey,
            label: def.label,
            iconId: kind,
            description: joinTooltipLines([formatBuildingCost(kind, exploreResearch), ...notes]),
            selectable,
            dimmed: !def.enabled || !affordable,
            onHover: handleHover,
            onLeave: handleLeave,
          };
        })
      : EXPLORE_BUILDING_ROOT_ORDER.flatMap((kind) => {
          const def = getExploreBuildingDef(kind);
          const affordable = canAffordBuilding(wood, flow, stone, kind, exploreResearch);
          const needsLounge = exploreBuildingRequiresSpiritLounge(kind);
          const loungeBlocked = needsLounge && !hasLiveSpiritLounge;
          const needsShrineOrObelisk = exploreBuildingRequiresShrineOrObelisk(kind);
          const shrineBlocked = needsShrineOrObelisk && !hasLiveShrineOrObelisk;
          const selectable = def.enabled && affordable && !loungeBlocked && !shrineBlocked;
          const notes: string[] = [];
          if (!def.enabled) notes.push('Coming soon');
          else if (loungeBlocked) notes.push('Requires Spirit Lounge');
          else if (shrineBlocked) notes.push('Requires Shrine or Obelisk');
          else if (!affordable) notes.push('Cannot afford');
          const buildingSlot: BuildSlotProps = {
            hotkey: def.hotkey,
            label: def.label,
            iconId: kind,
            description: joinTooltipLines([formatBuildingCost(kind, exploreResearch), ...notes]),
            selectable,
            dimmed: !def.enabled || !affordable || loungeBlocked || shrineBlocked,
            onHover: handleHover,
            onLeave: handleLeave,
          };
          if (kind !== 'barracks') return [buildingSlot];
          const towerSlot: BuildSlotProps = {
            hotkey: EXPLORE_TOWER_CATEGORY_HOTKEY,
            label: 'Tower',
            iconId: 'tower-category',
            description: joinTooltipLines([
              `${watchWoodCost} / ${mageDef.woodCost} / ${siegeDef.woodCost} wood`,
              towerSelectable ? 'Press H to choose a tower' : 'Cannot afford any tower',
            ]),
            selectable: towerSelectable,
            dimmed: !towerSelectable,
            onHover: handleHover,
            onLeave: handleLeave,
          };
          return [buildingSlot, towerSlot];
        });

  return (
    <>
      <div className="select-none">
        <div
          className="backdrop-blur-md px-4 pt-5 pb-3"
          style={{
            position: 'relative',
            background: HUD_PANEL_BG,
            border: HUD_PANEL_BORDER,
            clipPath: HUD_PANEL_CLIP,
            boxShadow: HUD_PANEL_SHADOW,
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
                'linear-gradient(90deg, transparent, rgba(100,160,255,0.5) 25%, rgba(180,220,255,0.85) 50%, rgba(100,160,255,0.5) 75%, transparent)',
              pointerEvents: 'none',
            }}
          />
          <p
            className="text-center text-[10px] font-semibold tracking-wide m-0 mb-3"
            style={{
              color: 'rgba(180, 210, 255, 0.95)',
              textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            }}
          >
            {view === 'towers'
              ? 'Tower — press 1, 2 or 3, Esc to go back'
              : 'Building — press B to close'}
          </p>
          <div className="flex flex-nowrap items-center justify-center gap-1.5">
            {slots.map((slot) => (
              <BuildSlot key={`${slot.hotkey}-${slot.label}`} {...slot} />
            ))}
          </div>
        </div>
      </div>
      {tooltipContent && (
        <HotkeyTooltip
          content={tooltipContent}
          visible
          x={tooltipPosition.x}
          y={tooltipPosition.y}
        />
      )}
    </>
  );
}
