'use client';

import React from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import {
  EXPLORE_BUILDING_DEFS,
  EXPLORE_BUILDING_ROOT_ORDER,
  EXPLORE_TOWER_CATEGORY_HOTKEY,
  EXPLORE_TOWER_PICK_ORDER,
  exploreBuildingRequiresSpiritLounge,
  getExploreBuildingDef,
  type ExploreBuildMenuView,
} from '@/utils/exploreBuildings';

interface BuildMenuPanelProps {
  open: boolean;
  wood: number;
  flow?: number;
  stone?: number;
  view?: ExploreBuildMenuView;
  hasLiveSpiritLounge?: boolean;
  widthPercent?: number;
}

function canAffordBuilding(
  wood: number,
  flow: number,
  stone: number,
  def: ReturnType<typeof getExploreBuildingDef>,
): boolean {
  if (wood < def.woodCost) return false;
  if ((def.stoneCost ?? 0) > 0 && stone < (def.stoneCost ?? 0)) return false;
  const flowCost = def.flowCost ?? 0;
  return flow >= flowCost;
}

function formatBuildingCost(def: ReturnType<typeof getExploreBuildingDef>): string {
  const parts: string[] = [];
  if (def.woodCost > 0) parts.push(`${def.woodCost} wood`);
  if ((def.stoneCost ?? 0) > 0) parts.push(`${def.stoneCost} stone`);
  if ((def.flowCost ?? 0) > 0) parts.push(`${def.flowCost} flow`);
  parts.push(`${def.maxHp} HP`);
  return parts.join(' · ');
}

const DEFAULT_WIDTH_PERCENT = 65;

function MenuRow({
  hotkey,
  label,
  suffix,
  detail,
  selectable,
  dimmed,
}: {
  hotkey: string;
  label: string;
  suffix?: string;
  detail: string;
  selectable: boolean;
  dimmed: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide"
      style={{
        color: dimmed ? 'rgba(140, 150, 170, 0.65)' : 'rgba(220, 230, 255, 0.92)',
        textShadow: '0 1px 6px rgba(0,0,0,0.9)',
      }}
    >
      <span>
        <span
          style={{
            display: 'inline-block',
            minWidth: '1.25rem',
            color: selectable ? 'rgba(255, 200, 120, 0.95)' : undefined,
          }}
        >
          [{hotkey}]
        </span>
        {' '}
        {label}
        {suffix || ''}
      </span>
      <span style={{ opacity: 0.85 }}>{detail}</span>
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
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: BuildMenuPanelProps) {
  if (!open) return null;

  const watchDef = EXPLORE_BUILDING_DEFS['watch-tower'];
  const mageDef = EXPLORE_BUILDING_DEFS.tower;
  const siegeDef = EXPLORE_BUILDING_DEFS['siege-tower'];
  const towerSelectable = EXPLORE_TOWER_PICK_ORDER.some((kind) => {
    const def = getExploreBuildingDef(kind);
    return def.enabled && canAffordBuilding(wood, flow, stone, def);
  });

  return (
    <div style={{ width: `${widthPercent}%`, margin: '0 auto' }}>
      <div
        className="backdrop-blur-md flex flex-col justify-center gap-1.5"
        style={{
          position: 'relative',
          minHeight: 68,
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
              'linear-gradient(90deg, transparent, rgba(100,160,255,0.5) 25%, rgba(180,220,255,0.85) 50%, rgba(100,160,255,0.5) 75%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <p
          className="text-center text-xs font-semibold tracking-wide m-0"
          style={{
            color: 'rgba(180, 210, 255, 0.95)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          {view === 'towers'
            ? 'Tower — press 1, 2 or 3, Esc to go back'
            : 'Building — press B to close'}
        </p>
        {view === 'towers' ? (
          EXPLORE_TOWER_PICK_ORDER.map((kind) => {
            const def = getExploreBuildingDef(kind);
            const affordable = canAffordBuilding(wood, flow, stone, def);
            const selectable = def.enabled && affordable;
            return (
              <MenuRow
                key={kind}
                hotkey={def.hotkey}
                label={def.label}
                suffix={!def.enabled ? ' — coming soon' : ''}
                detail={formatBuildingCost(def)}
                selectable={selectable}
                dimmed={!def.enabled || !affordable}
              />
            );
          })
        ) : (
          <>
            {EXPLORE_BUILDING_ROOT_ORDER.map((kind) => {
              const def = getExploreBuildingDef(kind);
              const affordable = canAffordBuilding(wood, flow, stone, def);
              const needsLounge = exploreBuildingRequiresSpiritLounge(kind);
              const loungeBlocked = needsLounge && !hasLiveSpiritLounge;
              const selectable = def.enabled && affordable && !loungeBlocked;
              const row = (
                <MenuRow
                  key={kind}
                  hotkey={def.hotkey}
                  label={def.label}
                  suffix={!def.enabled ? ' — coming soon' : loungeBlocked ? ' — requires Spirit Lounge' : ''}
                  detail={formatBuildingCost(def)}
                  selectable={selectable}
                  dimmed={!def.enabled || !affordable || loungeBlocked}
                />
              );
              if (kind !== 'barracks') return row;
              return (
                <React.Fragment key={`${kind}-tower`}>
                  {row}
                  <MenuRow
                    hotkey={EXPLORE_TOWER_CATEGORY_HOTKEY}
                    label="Tower"
                    detail={`${watchDef.woodCost} / ${mageDef.woodCost} / ${siegeDef.woodCost} wood`}
                    selectable={towerSelectable}
                    dimmed={!towerSelectable}
                  />
                </React.Fragment>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
