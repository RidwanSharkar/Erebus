'use client';

import React, { useMemo } from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import {
  EXPLORE_BEAST_TEMPLE_UPGRADE_GOLD,
  EXPLORE_BEAST_TEMPLE_UPGRADE_WOOD,
  EXPLORE_SIEGE_WYRM_GOLD,
  EXPLORE_SIEGE_WYRM_MEAT,
} from '@/utils/exploreBuildings';
import {
  FAE_BEAST_KIND_LABELS,
  type FaeBeastCompanionKind,
} from '@/utils/faeBeastCompanion';
import {
  getPetCompanionUpgradeDefinition,
  getPetCompanionUpgradeOptionsForKind,
  type PetCompanionUpgradeId,
} from '@/utils/petCompanionUpgrades';

export interface BeastTempleOwnedCompanion {
  kind: FaeBeastCompanionKind;
  upgradeId: PetCompanionUpgradeId | null;
}

interface BeastTemplePanelProps {
  open: boolean;
  wood: number;
  gold: number;
  meat?: number;
  hasLiveCathedral?: boolean;
  siegeWyrmAlive?: boolean;
  companions: readonly BeastTempleOwnedCompanion[];
  onPurchase: (upgradeId: PetCompanionUpgradeId) => void;
  onSummonSiegeWyrm?: () => void;
  widthPercent?: number;
}

const DEFAULT_WIDTH_PERCENT = 72;
const KIND_ORDER: readonly FaeBeastCompanionKind[] = [
  'tiger',
  'wolf',
  'bear',
  'serpent',
  'spider',
];

export default function BeastTemplePanel({
  open,
  wood,
  gold,
  meat = 0,
  hasLiveCathedral = false,
  siegeWyrmAlive = false,
  companions,
  onPurchase,
  onSummonSiegeWyrm,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: BeastTemplePanelProps) {
  const rows = useMemo(() => {
    const byKind = new Map<FaeBeastCompanionKind, BeastTempleOwnedCompanion>();
    for (const c of companions) {
      if (!byKind.has(c.kind)) byKind.set(c.kind, c);
    }
    const out: Array<{
      kind: FaeBeastCompanionKind;
      upgradeId: PetCompanionUpgradeId | null;
      option: PetCompanionUpgradeId;
      hotkey: string;
    }> = [];
    let hotkeyIdx = 1;
    for (const kind of KIND_ORDER) {
      const owned = byKind.get(kind);
      if (!owned) continue;
      for (const option of getPetCompanionUpgradeOptionsForKind(kind)) {
        out.push({
          kind,
          upgradeId: owned.upgradeId,
          option,
          hotkey: String(hotkeyIdx),
        });
        hotkeyIdx += 1;
      }
    }
    return out;
  }, [companions]);

  const siegeWyrmHotkey = String(rows.length + 1);
  const siegeWyrmAffordable =
    gold >= EXPLORE_SIEGE_WYRM_GOLD && meat >= EXPLORE_SIEGE_WYRM_MEAT;
  const siegeWyrmSelectable =
    hasLiveCathedral && !siegeWyrmAlive && siegeWyrmAffordable;

  if (!open) return null;

  const affordable =
    wood >= EXPLORE_BEAST_TEMPLE_UPGRADE_WOOD
    && gold >= EXPLORE_BEAST_TEMPLE_UPGRADE_GOLD;

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
              'linear-gradient(90deg, transparent, rgba(251,146,60,0.5) 25%, rgba(254,215,170,0.85) 50%, rgba(251,146,60,0.5) 75%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <p
          className="text-center text-xs font-semibold tracking-wide m-0"
          style={{
            color: 'rgba(255, 210, 160, 0.95)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          Beast Temple — companion upgrades ({EXPLORE_BEAST_TEMPLE_UPGRADE_WOOD} wood · {EXPLORE_BEAST_TEMPLE_UPGRADE_GOLD} gold each)
        </p>
        {rows.length === 0 ? (
          <p
            className="text-center text-xs m-0"
            style={{ color: 'rgba(180, 190, 210, 0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
          >
            Defeat a wilderness boss to gain a beast companion
          </p>
        ) : (
          rows.map((row) => {
            const def = getPetCompanionUpgradeDefinition(row.option);
            const owned = row.upgradeId != null;
            const selected = row.upgradeId === row.option;
            const lockedOther = owned && !selected;
            const selectable = !owned && affordable;
            const dimmed = owned ? !selected : !affordable;
            return (
              <button
                key={`${row.kind}-${row.option}`}
                type="button"
                className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
                style={{
                  color: dimmed ? 'rgba(140, 150, 170, 0.65)' : 'rgba(255, 235, 210, 0.95)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                  pointerEvents: selectable ? 'auto' : 'none',
                }}
                onClick={() => selectable && onPurchase(row.option)}
              >
                <span className="flex items-center gap-2 text-left">
                  <span
                    style={{
                      display: 'inline-block',
                      minWidth: '1.25rem',
                      color: selectable ? 'rgba(251, 146, 60, 0.95)' : undefined,
                    }}
                  >
                    [{row.hotkey}]
                  </span>
                  {FAE_BEAST_KIND_LABELS[row.kind]} · {def.name}
                  <span style={{ opacity: 0.7, fontWeight: 400 }}>— {def.description}</span>
                </span>
                <span style={{ opacity: 0.85, whiteSpace: 'nowrap' }}>
                  {selected
                    ? 'Owned'
                    : lockedOther
                      ? 'Locked'
                      : `${EXPLORE_BEAST_TEMPLE_UPGRADE_WOOD} wood · ${EXPLORE_BEAST_TEMPLE_UPGRADE_GOLD} gold`}
                </span>
              </button>
            );
          })
        )}
        <button
          type="button"
          className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
          style={{
            color: siegeWyrmSelectable
              ? 'rgba(255, 235, 210, 0.95)'
              : 'rgba(140, 150, 170, 0.65)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
            pointerEvents: siegeWyrmSelectable ? 'auto' : 'none',
          }}
          onClick={() => siegeWyrmSelectable && onSummonSiegeWyrm?.()}
        >
          <span className="flex items-center gap-2 text-left">
            <span
              style={{
                display: 'inline-block',
                minWidth: '1.25rem',
                color: siegeWyrmSelectable ? 'rgba(251, 146, 60, 0.95)' : undefined,
              }}
            >
              [{siegeWyrmHotkey}]
            </span>
            Siege Wyrm
            <span style={{ opacity: 0.7, fontWeight: 400 }}>
              — 2150 HP · 98 melee · piercing firebolt
            </span>
          </span>
          <span style={{ opacity: 0.85, whiteSpace: 'nowrap' }}>
            {siegeWyrmAlive
              ? 'Alive'
              : !hasLiveCathedral
                ? 'Requires Cathedral'
                : `${EXPLORE_SIEGE_WYRM_GOLD} gold · ${EXPLORE_SIEGE_WYRM_MEAT} meat`}
          </span>
        </button>
      </div>
    </div>
  );
}
