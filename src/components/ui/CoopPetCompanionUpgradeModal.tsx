'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { FaeBeastCompanionKind } from '@/utils/faeBeastCompanion';
import {
  FAE_BEAST_KIND_LABELS,
  getFaeBeastCompanionIconSrc,
} from '@/utils/faeBeastCompanion';
import type { PetCompanionUpgradeId } from '@/utils/petCompanionUpgrades';
import {
  getPetCompanionUpgradeDefinition,
  getPetCompanionUpgradeIconSrc,
  getPetCompanionUpgradeOptionsForKind,
} from '@/utils/petCompanionUpgrades';

interface AccentTheme {
  border: string;
  bg: string;
  text: string;
  dimBorder: string;
  cardHovered: string;
  cardIdle: string;
  headerBg: string;
}

const BEAST_ACCENT: Record<FaeBeastCompanionKind, AccentTheme> = {
  bear: {
    border: 'border-amber-500', bg: 'bg-amber-950/70', text: 'text-amber-200',
    dimBorder: 'border-amber-800/50', cardHovered: 'border-amber-400 bg-amber-950/60 shadow-lg shadow-amber-900/60',
    cardIdle: 'border-amber-800/50 bg-gray-950/80', headerBg: 'bg-amber-950/40',
  },
  serpent: {
    border: 'border-emerald-400', bg: 'bg-emerald-950/70', text: 'text-emerald-200',
    dimBorder: 'border-emerald-800/50', cardHovered: 'border-emerald-400 bg-emerald-950/60 shadow-lg shadow-emerald-900/60',
    cardIdle: 'border-emerald-800/50 bg-gray-950/80', headerBg: 'bg-emerald-950/40',
  },
  spider: {
    border: 'border-stone-300', bg: 'bg-stone-900/70', text: 'text-stone-100',
    dimBorder: 'border-stone-700/50', cardHovered: 'border-stone-300 bg-stone-900/60 shadow-lg shadow-stone-700/60',
    cardIdle: 'border-stone-700/50 bg-gray-950/80', headerBg: 'bg-stone-900/40',
  },
  tiger: {
    border: 'border-orange-400', bg: 'bg-orange-950/70', text: 'text-orange-200',
    dimBorder: 'border-orange-800/50', cardHovered: 'border-orange-400 bg-orange-950/60 shadow-lg shadow-orange-900/60',
    cardIdle: 'border-orange-800/50 bg-gray-950/80', headerBg: 'bg-orange-950/40',
  },
  wolf: {
    border: 'border-sky-400', bg: 'bg-sky-950/70', text: 'text-sky-200',
    dimBorder: 'border-sky-800/50', cardHovered: 'border-sky-400 bg-sky-950/60 shadow-lg shadow-sky-900/60',
    cardIdle: 'border-sky-800/50 bg-gray-950/80', headerBg: 'bg-sky-950/40',
  },
};

function DiamondFrame({
  iconSrc,
  accentBorder,
  accentBg,
}: {
  iconSrc: string | null;
  accentBorder: string;
  accentBg: string;
}) {
  return (
    <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
      <div className={`absolute w-9 h-9 rotate-45 border-2 ${accentBorder} ${accentBg}`} />
      {iconSrc ? (
        <img
          src={iconSrc}
          alt=""
          className="relative z-10 w-7 h-7 object-contain pointer-events-none select-none"
        />
      ) : (
        <span className="relative z-10 text-xl leading-none select-none pointer-events-none">✦</span>
      )}
    </div>
  );
}

interface CoopPetCompanionUpgradeModalProps {
  beastKind: FaeBeastCompanionKind;
  options?: readonly PetCompanionUpgradeId[];
  onPick: (id: PetCompanionUpgradeId) => void;
  onClose?: () => void;
}

export default function CoopPetCompanionUpgradeModal({
  beastKind,
  options,
  onPick,
  onClose,
}: CoopPetCompanionUpgradeModalProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [openingFlash, setOpeningFlash] = useState(true);

  const displayOptions = useMemo(() => {
    const pool = options?.length
      ? options
      : getPetCompanionUpgradeOptionsForKind(beastKind);
    const seen = new Set<PetCompanionUpgradeId>();
    const out: PetCompanionUpgradeId[] = [];
    for (const id of pool) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }, [beastKind, options]);

  useEffect(() => {
    setHoveredIdx(null);
  }, [displayOptions]);

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
      const id = displayOptions[idx];
      if (!id) return;
      e.preventDefault();
      onPick(id);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [displayOptions, onClose, onPick]);

  const accent = BEAST_ACCENT[beastKind] ?? BEAST_ACCENT.wolf;
  const beastLabel = FAE_BEAST_KIND_LABELS[beastKind];
  const emblemSrc = getFaeBeastCompanionIconSrc(beastKind);
  const hoveredId = hoveredIdx !== null ? displayOptions[hoveredIdx] : undefined;
  const hoveredDef = hoveredId ? getPetCompanionUpgradeDefinition(hoveredId) : null;

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
            background: 'rgba(52, 211, 153, 0.35)',
            animation: 'coop-pet-upgrade-open-flash 0.3s ease-out forwards',
          }}
        />
      )}
      <style jsx>{`
        @keyframes coop-pet-upgrade-open-flash {
          0% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
      <div className="relative w-full max-w-3xl flex gap-5 items-start">
        <div className="flex-1 min-w-0">
          <div className={`rounded-t-xl border-2 ${accent.border} ${accent.headerBg} px-6 pt-5 pb-4 mb-0 relative`}>
            <div className={`absolute top-3 right-3 w-9 h-9 flex items-center justify-center border ${accent.border} ${accent.bg} rounded overflow-hidden`}>
              {emblemSrc ? (
                <img src={emblemSrc} alt="" className="w-7 h-7 object-contain" />
              ) : (
                <span className="text-lg">🐾</span>
              )}
            </div>
            <div className="flex items-center gap-3 mb-1 pr-12">
              <div className="flex-1 h-px opacity-50 bg-gradient-to-r from-transparent to-slate-400" />
              <h1 className={`text-xl font-bold tracking-[0.3em] uppercase ${accent.text} whitespace-nowrap px-1`}>
                Spirit Animal Upgrade
              </h1>
              <div className="flex-1 h-px opacity-50 bg-gradient-to-l from-transparent to-slate-400" />
            </div>
            <p className="text-center text-xs text-gray-400 uppercase tracking-[0.18em] italic">
              Empower your {beastLabel}
            </p>
          </div>

          <div className={`border-x-2 ${accent.border} bg-gray-950/60 px-6 py-2 flex items-center gap-3`}>
            <span className={`text-sm font-bold tracking-[0.2em] uppercase ${accent.text}`}>
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

          <div className={`border-x-2 border-b-2 ${accent.border} rounded-b-xl overflow-hidden`}>
            {displayOptions.map((id, idx) => {
              const def = getPetCompanionUpgradeDefinition(id);
              const isHovered = hoveredIdx === idx;
              const isLast = idx === displayOptions.length - 1;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPick(id)}
                  onMouseEnter={() => {
                    window.audioSystem?.playBoonHoverSound?.();
                    setHoveredIdx(idx);
                  }}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`
                    relative w-full flex items-center gap-4 px-5 py-4 text-left
                    border-2 transition-all duration-150 cursor-pointer
                    ${isHovered ? accent.cardHovered : accent.cardIdle}
                    ${!isLast ? 'border-b border-t-0 border-x-0' : 'border-0'}
                  `}
                  style={{ borderColor: isHovered ? undefined : 'transparent' }}
                >
                  <div className={`
                    absolute top-2 left-2 w-4 h-4 flex items-center justify-center
                    text-[10px] font-bold rounded-full
                    ${isHovered ? `${accent.text} border ${accent.border}` : 'text-gray-600 border border-gray-700'}
                    bg-gray-950/80
                  `}>
                    {idx + 1}
                  </div>
                  <DiamondFrame
                    iconSrc={getPetCompanionUpgradeIconSrc(id)}
                    accentBorder={isHovered ? accent.border : accent.dimBorder}
                    accentBg={isHovered ? accent.bg : 'bg-gray-900/60'}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className={`text-sm font-bold tracking-[0.18em] uppercase leading-snug ${isHovered ? accent.text : 'text-gray-200'} transition-colors duration-150`}>
                        {def.name}
                      </span>
                      <span className={`text-xs font-bold tracking-widest uppercase shrink-0 ${accent.text}`}>
                        Companion
                      </span>
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                      {def.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div
          className={`w-60 shrink-0 transition-opacity duration-200 ${hoveredDef ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!hoveredDef}
        >
          {hoveredDef && (
            <div className={`border-2 ${accent.border} ${accent.bg} rounded-xl overflow-hidden`}>
              <div className={`px-4 py-3 border-b ${accent.dimBorder} bg-black/30`}>
                <div className={`text-xs font-bold uppercase tracking-widest ${accent.text} mb-0.5`}>
                  {hoveredDef.name}
                </div>
                <div className="text-gray-600 text-[10px] uppercase tracking-widest font-mono">
                  {beastLabel} Upgrade
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-gray-300 text-xs leading-relaxed">
                  {hoveredDef.description}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
