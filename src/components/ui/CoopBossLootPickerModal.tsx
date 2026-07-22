'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { DreamLayerStockItem } from '@/contexts/MultiplayerContext';
import type { InventoryItem } from '@/contexts/MultiplayerContext';
import {
  getDreamLayerItemDescription,
  getDreamLayerItemIconPath,
  isUniqueDreamLayerItem,
} from '@/utils/dreamLayerItems';

const WARDING_PENDANT_ICON = '/icons/items/wardingPendant.svg';

const ACCENT = {
  border: 'border-sky-400',
  bg: 'bg-sky-950/70',
  text: 'text-sky-200',
  dimBorder: 'border-sky-800/50',
  cardHovered: 'border-sky-400 bg-sky-950/60 shadow-lg shadow-sky-900/60',
  cardIdle: 'border-sky-800/50 bg-gray-950/80',
  headerBg: 'bg-sky-950/40',
} as const;

const SLOT_LABELS: Record<string, string> = {
  warding_pendant: 'Warding Pendant',
  ring: 'Ring',
  exodia: 'Relic',
};

function getLootIconPath(entry: DreamLayerStockItem): string | undefined {
  if (entry.kind === 'warding_pendant') return WARDING_PENDANT_ICON;
  const type = entry.item?.type;
  if (!type) return undefined;
  return getDreamLayerItemIconPath(type);
}

function isEntryOwned(entry: DreamLayerStockItem, inventory: InventoryItem[]): boolean {
  const type = entry.item?.type;
  if (!type) return false;
  if (!isUniqueDreamLayerItem(type)) return false;
  return inventory.some((item) => item.type === type);
}

interface CoopBossLootPickerModalProps {
  options: readonly DreamLayerStockItem[];
  inventory: InventoryItem[];
  onPick: (stockId: string) => void;
  onClose?: () => void;
}

export default function CoopBossLootPickerModal({
  options,
  inventory,
  onPick,
  onClose,
}: CoopBossLootPickerModalProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [openingFlash, setOpeningFlash] = useState(true);

  const displayOptions = useMemo(
    () => options.filter((entry) => entry?.id && !entry.sold),
    [options],
  );

  useEffect(() => {
    setHoveredIdx(null);
  }, [options]);

  useEffect(() => {
    setOpeningFlash(true);
    const timer = window.setTimeout(() => setOpeningFlash(false), 300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
        return;
      }
      const idx = parseInt(e.key, 10) - 1;
      if (Number.isNaN(idx) || idx < 0 || idx >= displayOptions.length) return;
      const entry = displayOptions[idx];
      if (!entry || isEntryOwned(entry, inventory)) return;
      e.preventDefault();
      onPick(entry.id);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [displayOptions, inventory, onClose, onPick]);

  const hoveredEntry = hoveredIdx !== null ? displayOptions[hoveredIdx] : undefined;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6"
      data-block-game-input
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.96) 100%)',
      }}
    >
      {openingFlash && (
        <div
          className="pointer-events-none fixed inset-0 z-[201]"
          style={{
            background: 'rgba(136, 221, 255, 0.45)',
            animation: 'coop-boss-loot-open-flash 0.3s ease-out forwards',
          }}
        />
      )}
      <style jsx>{`
        @keyframes coop-boss-loot-open-flash {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
      <div className="relative w-full max-w-3xl flex gap-5 items-start">
        <div className="flex-1 min-w-0">
          <div className={`rounded-t-xl border-2 ${ACCENT.border} ${ACCENT.headerBg} px-6 pt-5 pb-4 mb-0 relative`}>
            <div className={`absolute top-3 right-3 w-9 h-9 flex items-center justify-center border ${ACCENT.border} ${ACCENT.bg} rounded text-lg`}>
              ✦
            </div>
            <div className="flex items-center gap-3 mb-1 pr-12">
              <div className="flex-1 h-px opacity-50 bg-gradient-to-r from-transparent to-sky-400/50" />
              <h1 className={`text-xl font-bold tracking-[0.3em] uppercase ${ACCENT.text} whitespace-nowrap px-1`}>
                Architect&apos;s Gift
              </h1>
              <div className="flex-1 h-px opacity-50 bg-gradient-to-l from-transparent to-sky-400/50" />
            </div>
            <p className="text-center text-xs text-gray-400 uppercase tracking-[0.18em] italic">
              Choose one relic — yours to keep, free of charge
            </p>
          </div>

          <div className={`border-x-2 ${ACCENT.border} bg-gray-950/60 px-6 py-2 flex items-center gap-3`}>
            <span className={`text-sm font-bold tracking-[0.2em] uppercase ${ACCENT.text}`}>
              Choose One:
            </span>
            <div className="flex-1 h-px bg-gray-700/60" />
            <span className="text-gray-600 text-xs tracking-widest">
              Press&nbsp;
              <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 font-mono text-xs">1</kbd>
              &nbsp;·&nbsp;
              <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 font-mono text-xs">2</kbd>
              &nbsp;·&nbsp;
              <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 font-mono text-xs">3</kbd>
            </span>
          </div>

          <div className={`border-x-2 border-b-2 ${ACCENT.border} rounded-b-xl overflow-hidden`}>
            {displayOptions.map((entry, idx) => {
              const owned = isEntryOwned(entry, inventory);
              const label = entry.label ?? entry.item?.label ?? 'Relic';
              const description =
                entry.description
                ?? (entry.item?.type ? getDreamLayerItemDescription(entry.item.type) : '');
              const iconPath = getLootIconPath(entry);
              const slotLabel = SLOT_LABELS[entry.kind] ?? 'Relic';
              const isHovered = hoveredIdx === idx;
              const isLast = idx === displayOptions.length - 1;

              return (
                <button
                  key={entry.id}
                  type="button"
                  disabled={owned}
                  onClick={() => {
                    if (owned) return;
                    onPick(entry.id);
                  }}
                  onMouseEnter={() => {
                    if (owned) return;
                    window.audioSystem?.playBoonHoverSound?.();
                    setHoveredIdx(idx);
                  }}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`
                    relative w-full flex items-center gap-4 px-5 py-4 text-left
                    border-2 transition-all duration-150
                    ${owned ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'}
                    ${isHovered && !owned ? ACCENT.cardHovered : ACCENT.cardIdle}
                    ${!isLast ? 'border-b border-t-0 border-x-0' : 'border-0'}
                  `}
                  style={{ borderColor: isHovered && !owned ? undefined : 'transparent' }}
                >
                  <div className={`
                    absolute top-2 left-2 w-4 h-4 flex items-center justify-center
                    text-[10px] font-bold rounded-full
                    ${isHovered && !owned ? `${ACCENT.text} border ${ACCENT.border}` : 'text-gray-600 border border-gray-700'}
                    bg-gray-950/80
                  `}>
                    {idx + 1}
                  </div>

                  <div
                    className={`
                      w-14 h-14 shrink-0 flex items-center justify-center rounded-lg border-2
                      ${isHovered && !owned ? `${ACCENT.border} ${ACCENT.bg}` : `${ACCENT.dimBorder} bg-gray-900/60`}
                    `}
                  >
                    {iconPath ? (
                      <img src={iconPath} alt="" className="h-9 w-9 object-contain" aria-hidden />
                    ) : (
                      <span className="text-xl">✦</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className={`text-sm font-bold tracking-[0.18em] uppercase leading-snug ${isHovered && !owned ? ACCENT.text : 'text-gray-200'} transition-colors duration-150`}>
                        {label}
                      </span>
                      <span className="text-xs font-bold tracking-widest uppercase shrink-0 text-sky-300/80">
                        {owned ? 'Owned' : slotLabel}
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed line-clamp-3">
                      {description}
                    </p>
                    {!owned && (
                      <p className="mt-1.5 text-xs text-emerald-400/90 font-semibold tracking-wide uppercase">
                        Free
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`w-60 shrink-0 transition-opacity duration-200 ${hoveredEntry ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!hoveredEntry}
        >
          {hoveredEntry && (
            <div className={`border-2 ${ACCENT.border} ${ACCENT.bg} rounded-xl overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${ACCENT.dimBorder} bg-black/30`}>
                <div className={`text-xs font-bold uppercase tracking-widest ${ACCENT.text} mb-0.5`}>
                  {SLOT_LABELS[hoveredEntry.kind] ?? 'Relic'}
                </div>
                <div className="text-gray-300 text-sm font-semibold tracking-wide">
                  {hoveredEntry.label ?? hoveredEntry.item?.label}
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-gray-300 text-xs leading-relaxed">
                  {hoveredEntry.description
                    ?? (hoveredEntry.item?.type
                      ? getDreamLayerItemDescription(hoveredEntry.item.type)
                      : '')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
