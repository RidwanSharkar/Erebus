'use client';

import React, { useMemo } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';
import { EXPLORE_OBELISK_TALENT_GOLD_COST } from '@/utils/exploreBuildings';
import {
  RULEBOOK_CLASS_TALENTS,
  type CoopRulebookWeapon,
} from '@/data/rulebookContent';
import {
  getEnabledTalentIds,
  getTalentBoonDefinition,
  type TalentId,
  type TalentLoadout,
} from '@/utils/talents';

interface ObeliskShopPanelProps {
  open: boolean;
  gold: number;
  currentWeapon: WeaponType;
  talentLoadout: TalentLoadout | null;
  onPurchase: (id: TalentId) => void;
  widthPercent?: number;
}

const DEFAULT_WIDTH_PERCENT = 72;

function isRulebookWeapon(weapon: WeaponType): weapon is CoopRulebookWeapon {
  return weapon === WeaponType.RUNEBLADE
    || weapon === WeaponType.SABRES
    || weapon === WeaponType.BOW
    || weapon === WeaponType.SCYTHE;
}

export default function ObeliskShopPanel({
  open,
  gold,
  currentWeapon,
  talentLoadout,
  onPurchase,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: ObeliskShopPanelProps) {
  const owned = useMemo(
    () => new Set(talentLoadout ? getEnabledTalentIds(talentLoadout) : []),
    [talentLoadout],
  );
  const catalog = isRulebookWeapon(currentWeapon) ? RULEBOOK_CLASS_TALENTS[currentWeapon] : [];
  const affordable = gold >= EXPLORE_OBELISK_TALENT_GOLD_COST;

  if (!open) return null;

  return (
    <div style={{ width: `${widthPercent}%`, margin: '0 auto' }}>
      <div
        className="backdrop-blur-md flex flex-col justify-center gap-1.5"
        style={{
          position: 'relative',
          minHeight: 88,
          maxHeight: 280,
          overflowY: 'auto',
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
          Obelisk — class talents ({EXPLORE_OBELISK_TALENT_GOLD_COST} gold each)
        </p>
        {catalog.length === 0 ? (
          <p
            className="text-center text-xs m-0"
            style={{ color: 'rgba(180, 190, 210, 0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
          >
            Equip a weapon to browse class talents.
          </p>
        ) : (
          catalog.map((entry, index) => {
            const purchased = owned.has(entry.id);
            const selectable = affordable && !purchased;
            const dimmed = purchased || !selectable;
            const def = getTalentBoonDefinition(entry.id);
            const hotkey = index < 9 ? String(index + 1) : null;
            return (
              <button
                key={entry.id}
                type="button"
                className="flex items-center justify-between gap-3 text-xs font-medium tracking-wide w-full bg-transparent border-0 cursor-pointer p-0"
                style={{
                  color: dimmed ? 'rgba(140, 150, 170, 0.65)' : 'rgba(240, 230, 210, 0.95)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                  pointerEvents: selectable ? 'auto' : 'none',
                }}
                onClick={() => selectable && onPurchase(entry.id)}
              >
                <span className="flex items-center gap-2">
                  <span
                    style={{
                      display: 'inline-block',
                      minWidth: '1.25rem',
                      color: selectable ? 'rgba(255, 200, 120, 0.95)' : undefined,
                    }}
                  >
                    {hotkey ? `[${hotkey}]` : ''}
                  </span>
                  {def?.name ?? entry.id}
                </span>
                <span style={{ opacity: 0.85 }}>
                  {purchased ? 'Owned' : `${EXPLORE_OBELISK_TALENT_GOLD_COST} gold`}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
