'use client';

import React, { useEffect, useState } from 'react';

import type { CoopAllyKind } from '@/utils/coopAllyTargeting';

export type { CoopAllyKind };

interface AccentTheme {
  border: string;
  bg: string;
  text: string;
  dimBorder: string;
  cardHovered: string;
  cardIdle: string;
  headerBg: string;
}

const KNIGHT_ACCENT: AccentTheme = {
  border: 'border-amber-400',
  bg: 'bg-amber-950/70',
  text: 'text-amber-200',
  dimBorder: 'border-amber-800/50',
  cardHovered: 'border-amber-400 bg-amber-950/60 shadow-lg shadow-amber-900/60',
  cardIdle: 'border-amber-800/50 bg-gray-950/80',
  headerBg: 'bg-amber-950/40',
};

const HUNTRESS_ACCENT: AccentTheme = {
  border: 'border-lime-400',
  bg: 'bg-lime-950/70',
  text: 'text-lime-200',
  dimBorder: 'border-lime-800/50',
  cardHovered: 'border-lime-400 bg-lime-950/60 shadow-lg shadow-lime-900/60',
  cardIdle: 'border-lime-800/50 bg-gray-950/80',
  headerBg: 'bg-lime-950/40',
};

const PHANTOM_ACCENT: AccentTheme = {
  border: 'border-yellow-400',
  bg: 'bg-yellow-950/70',
  text: 'text-yellow-200',
  dimBorder: 'border-yellow-800/50',
  cardHovered: 'border-yellow-400 bg-yellow-950/60 shadow-lg shadow-yellow-900/60',
  cardIdle: 'border-yellow-800/50 bg-gray-950/80',
  headerBg: 'bg-yellow-950/40',
};

const DEMON_ACCENT: AccentTheme = {
  border: 'border-red-400',
  bg: 'bg-red-950/70',
  text: 'text-red-200',
  dimBorder: 'border-red-800/50',
  cardHovered: 'border-red-400 bg-red-950/60 shadow-lg shadow-red-900/60',
  cardIdle: 'border-red-800/50 bg-gray-950/80',
  headerBg: 'bg-red-950/40',
};

const ENCHANTRESS_ACCENT: AccentTheme = {
  border: 'border-emerald-400',
  bg: 'bg-emerald-950/70',
  text: 'text-emerald-200',
  dimBorder: 'border-emerald-800/50',
  cardHovered: 'border-emerald-400 bg-emerald-950/60 shadow-lg shadow-emerald-900/60',
  cardIdle: 'border-emerald-800/50 bg-gray-950/80',
  headerBg: 'bg-emerald-950/40',
};

interface AllyCardDef {
  kind: CoopAllyKind;
  title: string;
  role: string;
  emblem: string;
  accent: AccentTheme;
  stats: readonly string[];
  description: string;
}

const ALLY_CARDS: readonly AllyCardDef[] = [
  {
    kind: 'knight',
    title: 'Knight',
    role: 'Melee Guardian',
    emblem: '🛡',
    accent: KNIGHT_ACCENT,
    stats: ['500 HP', '50 Melee Damage', '~1.4s Attack Speed', 'Colossus Smite AoE'],
    description:
      'A stalwart frontline ally who draws enemy attention, cleaves nearby foes, and unleashes a devastating AoE smite when charged.',
  },
  {
    kind: 'huntress',
    title: 'Huntress',
    role: 'Ranged Marksman',
    emblem: '🏹',
    accent: HUNTRESS_ACCENT,
    stats: ['450 HP', '65 Piercing Damage', '1.0s Attack Speed', '20 Range'],
    description:
      'An agile archer who actively hunts targets within range and favors shots that pierce through multiple enemies for maximum damage.',
  },
  {
    kind: 'phantom',
    title: 'Phantom',
    role: 'Shadow Assassin',
    emblem: '👻',
    accent: PHANTOM_ACCENT,
    stats: ['400 HP', '40 Dagger Damage', '4.0s Blink Combo', '10 Range'],
    description:
      'A spectral ally who follows you until foes draw near, then blinks in and hurls a volley of golden daggers.',
  },
  {
    kind: 'demon',
    title: 'Demon',
    role: 'Aggressive Hunter',
    emblem: '💀',
    accent: DEMON_ACCENT,
    stats: ['500 HP', '48 Melee Damage', '900ms Attack Speed', 'Leap Stun'],
    description:
      'A relentless melee hunter that actively seeks out enemies, closes with a crushing leap, and tears through the front line.',
  },
  {
    kind: 'enchantress',
    title: 'Enchantress',
    role: 'Nature Caster',
    emblem: '🌿',
    accent: ENCHANTRESS_ACCENT,
    stats: ['400 HP', '105 Earth Shock', '2.25 Move Speed', 'Grasping Vines Root'],
    description:
      'A verdant spellcaster who stays close to you, hurls earth-shock bolts at nearby foes, and roots enemies with grasping vines.',
  },
];

function DiamondFrame({
  fallbackGlyph,
  accentBorder,
  accentBg,
}: {
  fallbackGlyph: string;
  accentBorder: string;
  accentBg: string;
}) {
  return (
    <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
      <div className={`absolute w-10 h-10 rotate-45 border-2 ${accentBorder} ${accentBg}`} />
      <span className="relative z-10 text-2xl leading-none select-none pointer-events-none">{fallbackGlyph}</span>
    </div>
  );
}

interface AllyChoiceModalProps {
  offer: readonly CoopAllyKind[];
  onPick: (allyKind: CoopAllyKind) => void;
}

export default function AllyChoiceModal({ offer, onPick }: AllyChoiceModalProps) {
  const visibleCards = ALLY_CARDS.filter((card) => offer.includes(card.kind));
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [openingFlash, setOpeningFlash] = useState(true);

  useEffect(() => {
    setOpeningFlash(true);
    const timer = window.setTimeout(() => setOpeningFlash(false), 300);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const cards = ALLY_CARDS.filter((card) => offer.includes(card.kind));
      const idx = parseInt(e.key, 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < cards.length) {
        const card = cards[idx];
        if (card) onPick(card.kind);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onPick, offer]);

  const handlePick = (kind: CoopAllyKind) => {
    window.audioSystem?.playUISelectionSound?.();
    onPick(kind);
  };

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
            background: 'rgba(255, 248, 220, 0.72)',
            animation: 'ally-choice-open-flash 0.3s ease-out forwards',
          }}
        />
      )}
      <style jsx>{`
        @keyframes ally-choice-open-flash {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>

      <div className="relative w-full max-w-5xl">
        <div className="rounded-t-xl border-2 border-violet-400 bg-violet-950/40 px-6 pt-5 pb-4 mb-0 relative">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="flex-1 h-px opacity-50"
              style={{ background: 'linear-gradient(to right, transparent, #94a3b8)' }}
            />
            <h1 className="text-xl font-bold tracking-[0.3em] uppercase text-violet-200 whitespace-nowrap px-1">
              Choose Your Ally
            </h1>
            <div
              className="flex-1 h-px opacity-50"
              style={{ background: 'linear-gradient(to left, transparent, #94a3b8)' }}
            />
          </div>
          <p className="text-center text-xs text-gray-400 uppercase tracking-[0.18em] italic">
            One companion will fight at your side for the rest of this run.
          </p>
        </div>

        <div className="border-x-2 border-violet-400 bg-gray-950/60 px-6 py-2 flex items-center gap-3">
          <span className="text-sm font-bold tracking-[0.2em] uppercase text-violet-200">
            Choose One:
          </span>
          <div className="flex-1 h-px bg-gray-700/60" />
          <span className="text-gray-600 text-xs tracking-widest">
            Press&nbsp;
            {visibleCards.map((_, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <>&nbsp;·&nbsp;</>}
                <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 font-mono text-xs">
                  {idx + 1}
                </kbd>
              </React.Fragment>
            ))}
          </span>
        </div>

        <div className="border-x-2 border-b-2 border-violet-400 rounded-b-xl overflow-hidden grid grid-cols-1 md:grid-cols-3">
          {visibleCards.map((card, idx) => {
            const isHovered = hoveredIdx === idx;
            const accent = card.accent;
            const borderClass =
              idx % 3 !== 2 ? 'md:border-r border-b md:border-b-0 border-t-0 border-x-0' : 'border-0';

            return (
              <button
                key={card.kind}
                type="button"
                onClick={() => handlePick(card.kind)}
                onMouseEnter={() => {
                  window.audioSystem?.playBoonHoverSound?.();
                  setHoveredIdx(idx);
                }}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`
                  relative flex flex-col gap-4 px-5 py-5 text-left
                  border-2 transition-all duration-150 cursor-pointer h-full
                  ${isHovered ? accent.cardHovered : accent.cardIdle}
                  ${borderClass}
                `}
                style={{ borderColor: isHovered ? undefined : 'transparent' }}
              >
                <div
                  className={`
                    absolute top-2 left-2 w-4 h-4 flex items-center justify-center
                    text-[10px] font-bold rounded-full
                    ${isHovered ? `${accent.text} border ${accent.border}` : 'text-gray-600 border border-gray-700'}
                    bg-gray-950/80
                  `}
                >
                  {idx + 1}
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <DiamondFrame
                    fallbackGlyph={card.emblem}
                    accentBorder={isHovered ? accent.border : accent.dimBorder}
                    accentBg={isHovered ? accent.bg : 'bg-gray-900/60'}
                  />
                  <div className="min-w-0">
                    <div className={`text-sm font-bold tracking-[0.18em] uppercase ${isHovered ? accent.text : 'text-gray-200'}`}>
                      {card.title}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-gray-500 mt-0.5">
                      {card.role}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {card.stats.map((stat) => (
                    <div
                      key={stat}
                      className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold tracking-wide uppercase ${accent.dimBorder} ${isHovered ? accent.text : 'text-gray-300'}`}
                    >
                      {stat}
                    </div>
                  ))}
                </div>

                <p className="text-gray-400 text-xs leading-relaxed">
                  {card.description}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
