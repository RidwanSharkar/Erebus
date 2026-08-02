'use client';

import React, { useCallback, useRef, useState } from 'react';
import { InventoryItem } from '@/contexts/MultiplayerContext';
import { ITEM_RARITY_COLORS, formatRarityLabel, isItemRarity } from '@/utils/itemRarity';
import { StatSystem, type StatKey } from '@/utils/StatSystem';
import {
  ARCHMAGE_SET_TYPES,
  DREAM_LAYER_ITEM_META,
  EXODIA_ARMOR_TYPES,
  HEXMETAL_SET_TYPES,
  getArchmageSetCount,
  getDreamLayerItemDescription,
  getExodiaSetCount,
  getHexmetalSetCount,
} from '@/utils/dreamLayerItems';
import { BOSS_RELIC_ICON_PATHS } from '@/utils/bossRelicItems';

interface InventoryPanelProps {
  inventory?: InventoryItem[];
}

const MAX_SLOTS = 7;
const WARDING_PENDANT_ICON = '/icons/items/wardingPendant.svg';

const WARD_ICON_BY_TYPE: Record<string, string> = {
  HUNTERS_MARK: '/icons/items/huntersMark.svg',
  SOUL_WARD: '/icons/items/soulWard.svg',
};

function getWardIconPath(ward: InventoryItem): string {
  if (ward.iconPath) return ward.iconPath;
  if (WARD_ICON_BY_TYPE[ward.type]) return WARD_ICON_BY_TYPE[ward.type];
  const metaIcon = DREAM_LAYER_ITEM_META[ward.type]?.iconPath;
  if (metaIcon) return metaIcon;
  return WARDING_PENDANT_ICON;
}

function getWardTooltip(ward: InventoryItem): string {
  const meta = DREAM_LAYER_ITEM_META[ward.type];
  if (meta) return `${meta.label}: ${meta.description}`;
  return ward.label;
}

const BOSS_ITEM_ICON_PATHS: Record<string, string> = {
  ...Object.fromEntries(
    Object.entries(DREAM_LAYER_ITEM_META).map(([type, meta]) => [type, meta.iconPath]),
  ),
  ...BOSS_RELIC_ICON_PATHS,
};

interface SlotItem {
  id: string;
  icon: string;
  iconIsImage: boolean;
  label: string;
  borderColor: string;
  tooltipTitle: string;
  tooltipLines: string[];
}

function getBossItemIcon(type: string): { icon: string; iconIsImage: boolean } {
  const path = BOSS_ITEM_ICON_PATHS[type];
  if (path) return { icon: path, iconIsImage: true };
  return { icon: '👑', iconIsImage: false };
}

function bossDropsToSlots(bossDrops: InventoryItem[]): SlotItem[] {
  return bossDrops.map((item, idx) => {
    const rarityColor =
      item.rarity && isItemRarity(item.rarity)
        ? ITEM_RARITY_COLORS[item.rarity]
        : '#fbbf24';
    const { icon, iconIsImage } = getBossItemIcon(item.type);
    const bonusLine =
      item.stat != null && item.statBonus != null
        ? `+${item.statBonus} ${StatSystem.getStatDisplayName(item.stat)}`
        : '';
    const lines: string[] = [];
    if (item.rarity && isItemRarity(item.rarity)) {
      lines.push(formatRarityLabel(item.rarity));
    }
    const effectDesc = getDreamLayerItemDescription(item.type);
    if (effectDesc) lines.push(effectDesc);
    if (bonusLine) lines.push(bonusLine);
    return {
      id: `${item.id}-${idx}`,
      icon,
      iconIsImage,
      label: item.label,
      borderColor: rarityColor,
      tooltipTitle: item.label,
      tooltipLines: lines,
    };
  });
}

const TOOLTIP_WIDTH = 220;
const VIEWPORT_PAD = 12;

function getClampedTooltipStyle(anchorX: number, anchorY: number): React.CSSProperties {
  const halfW = TOOLTIP_WIDTH / 2;
  let left = anchorX;
  let transform = 'translate(-50%, -100%)';

  if (anchorX < halfW + VIEWPORT_PAD) {
    left = VIEWPORT_PAD;
    transform = 'translate(0, -100%)';
  } else if (anchorX + halfW > window.innerWidth - VIEWPORT_PAD) {
    left = window.innerWidth - VIEWPORT_PAD;
    transform = 'translate(-100%, -100%)';
  }

  return { left, top: anchorY - 8, transform, width: TOOLTIP_WIDTH };
}

export default function InventoryPanel({ inventory = [] }: InventoryPanelProps) {
  const [tooltip, setTooltip] = useState<{
    title: string;
    lines: string[];
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bossDrops = inventory.filter((i) => i.category === 'boss_drop');
  const wards = inventory.filter((i) => i.category === 'ward');
  const slotItems: SlotItem[] = bossDropsToSlots(bossDrops);

  const slots: Array<SlotItem | 'empty'> = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    slots.push(i < slotItems.length ? slotItems[i] : 'empty');
  }

  const showTooltip = useCallback((item: SlotItem, e: React.MouseEvent) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      title: item.tooltipTitle,
      lines: item.tooltipLines,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    tooltipTimerRef.current = setTimeout(() => setTooltip(null), 80);
  }, []);

  const exodiaCount = getExodiaSetCount(inventory);
  const hexmetalCount = getHexmetalSetCount(inventory);
  const archmageCount = getArchmageSetCount(inventory);

  return (
    <div className="select-none" data-block-game-input>
      {(exodiaCount > 0 || hexmetalCount > 0 || archmageCount > 0) && (
        <div className="flex items-center gap-3 px-2 pb-1 tracking-wide">
          {exodiaCount > 0 && (
            <div className="text-[10px] text-orange-300/80">
              Exodia {exodiaCount}/{EXODIA_ARMOR_TYPES.length}
            </div>
          )}
          {hexmetalCount > 0 && (
            <div className="text-[10px] text-cyan-300/80">
              Hexmetal {hexmetalCount}/{HEXMETAL_SET_TYPES.length}
            </div>
          )}
          {archmageCount > 0 && (
            <div className="text-[10px] text-violet-300/80">
              Archmage {archmageCount}/{ARCHMAGE_SET_TYPES.length}
            </div>
          )}
        </div>
      )}
      <div
        className="flex items-center gap-1 px-2 py-2"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,12,28,0.92) 0%, rgba(4,6,16,0.96) 100%)',
          border: '1px solid rgba(60,140,220,0.25)',
          clipPath: 'polygon(12px 0%, 100% 0%, 100% 100%, 0% 100%, 0% 12px)',
          boxShadow:
            '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(100,180,255,0.08)',
          minWidth: 380,
        }}
      >
        <span className="text-white/20 text-xs px-0.5 select-none">‹</span>

        <div className="flex items-center gap-1.5 flex-1">
          {slots.map((slot, idx) => {
            if (slot === 'empty') {
              return (
                <div
                  key={`empty-${idx}`}
                  className="relative flex-shrink-0"
                  style={{ width: 44, height: 44 }}
                >
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                      background: 'rgba(0,0,0,0.4)',
                      border: '1px dashed rgba(255,255,255,0.12)',
                      borderRadius: '4px',
                    }}
                  />
                </div>
              );
            }

            return (
              <div
                key={slot.id}
                className="relative flex-shrink-0 cursor-default"
                style={{ width: 44, height: 44 }}
                onMouseEnter={(e) => showTooltip(slot, e)}
                onMouseLeave={hideTooltip}
              >
                <div
                  className="w-full h-full flex items-center justify-center text-lg"
                  style={{
                    background: `linear-gradient(145deg, ${slot.borderColor}18 0%, rgba(0,0,0,0.6) 100%)`,
                    border: `1px solid ${slot.borderColor}55`,
                    borderRadius: '4px',
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 8px ${slot.borderColor}22`,
                  }}
                >
                  {slot.iconIsImage ? (
                    <img src={slot.icon} alt="" className="h-7 w-7 object-contain" aria-hidden />
                  ) : (
                    slot.icon
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <span className="text-white/30 text-xs px-0.5 select-none">›</span>
      </div>

      {wards.length > 0 && (
        <div
          className="mt-1 flex items-center gap-1.5 px-2 py-1.5"
          style={{
            background: 'rgba(4,6,16,0.85)',
            border: '1px solid rgba(96,165,250,0.2)',
            borderRadius: '4px',
          }}
        >
          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-300/70 mr-1">
            Wards
          </span>
          {wards.map((ward) => (
            <div
              key={ward.id}
              className="relative flex-shrink-0"
              style={{ width: 32, height: 32 }}
              title={getWardTooltip(ward)}
            >
              <div
                className="w-full h-full flex items-center justify-center"
                style={{
                  background: 'linear-gradient(145deg, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0.6) 100%)',
                  border: '1px solid rgba(96,165,250,0.45)',
                  borderRadius: '4px',
                }}
              >
                <img
                  src={getWardIconPath(ward)}
                  alt=""
                  className="h-5 w-5 object-contain"
                  aria-hidden
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {tooltip && (
        <div
          className="fixed z-[60] text-white text-sm pointer-events-none"
          style={{
            ...getClampedTooltipStyle(tooltip.x, tooltip.y),
            background: 'rgba(6,6,18,0.97)',
            border: '1px solid rgba(100,140,255,0.3)',
            borderTop: '2px solid rgba(120,160,255,0.75)',
            borderRadius: '8px',
            padding: '10px 14px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.75)',
          }}
        >
          <div className="font-semibold text-blue-300 mb-1 text-[13px]">{tooltip.title}</div>
          {tooltip.lines.map((line, i) => (
            <div key={i} className="text-gray-400 text-xs leading-relaxed">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
