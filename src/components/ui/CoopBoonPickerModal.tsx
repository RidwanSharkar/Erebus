'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import type { TalentId } from '@/utils/talents';
import { getTalentBoonDefinition, getTalentIconSrc } from '@/utils/talents';

export type CoopBoonKind = 'class' | 'room';

interface AccentTheme {
  border: string;
  bg: string;
  text: string;
  dimBorder: string;
  cardHovered: string;
  cardIdle: string;
  headerBg: string;
}

const WEAPON_ACCENT: Record<WeaponType, AccentTheme> = {
  [WeaponType.NONE]: {
    border: 'border-violet-400', bg: 'bg-violet-950/70', text: 'text-violet-200',
    dimBorder: 'border-violet-800/50', cardHovered: 'border-violet-400 bg-violet-950/60 shadow-lg shadow-violet-900/60',
    cardIdle: 'border-violet-800/50 bg-gray-950/80', headerBg: 'bg-violet-950/40',
  },
  [WeaponType.RUNEBLADE]: {
    border: 'border-sky-400', bg: 'bg-sky-950/70', text: 'text-sky-200',
    dimBorder: 'border-sky-800/50', cardHovered: 'border-sky-400 bg-sky-950/60 shadow-lg shadow-sky-900/60',
    cardIdle: 'border-sky-800/50 bg-gray-950/80', headerBg: 'bg-sky-950/40',
  },
  [WeaponType.BOW]: {
    border: 'border-green-400', bg: 'bg-green-950/70', text: 'text-green-200',
    dimBorder: 'border-green-800/50', cardHovered: 'border-green-400 bg-green-950/60 shadow-lg shadow-green-900/60',
    cardIdle: 'border-green-800/50 bg-gray-950/80', headerBg: 'bg-green-950/40',
  },
  [WeaponType.SCYTHE]: {
    border: 'border-purple-400', bg: 'bg-purple-950/70', text: 'text-purple-200',
    dimBorder: 'border-purple-800/50', cardHovered: 'border-purple-400 bg-purple-950/60 shadow-lg shadow-purple-900/60',
    cardIdle: 'border-purple-800/50 bg-gray-950/80', headerBg: 'bg-purple-950/40',
  },
  [WeaponType.SABRES]: {
    border: 'border-red-400', bg: 'bg-red-950/70', text: 'text-red-200',
    dimBorder: 'border-red-800/50', cardHovered: 'border-red-400 bg-red-950/60 shadow-lg shadow-red-900/60',
    cardIdle: 'border-red-800/50 bg-gray-950/80', headerBg: 'bg-red-950/40',
  },
  [WeaponType.SPEAR]: {
    border: 'border-slate-300', bg: 'bg-slate-900/70', text: 'text-slate-100',
    dimBorder: 'border-slate-700/50', cardHovered: 'border-slate-300 bg-slate-900/60 shadow-lg shadow-slate-700/60',
    cardIdle: 'border-slate-700/50 bg-gray-950/80', headerBg: 'bg-slate-900/40',
  },
  [WeaponType.SWORD]: {
    border: 'border-yellow-400', bg: 'bg-yellow-950/70', text: 'text-yellow-200',
    dimBorder: 'border-yellow-800/50', cardHovered: 'border-yellow-400 bg-yellow-950/60 shadow-lg shadow-yellow-900/60',
    cardIdle: 'border-yellow-800/50 bg-gray-950/80', headerBg: 'bg-yellow-950/40',
  },
  [WeaponType.KNIGHT]: {
    border: 'border-amber-400', bg: 'bg-amber-950/70', text: 'text-amber-200',
    dimBorder: 'border-amber-800/50', cardHovered: 'border-amber-400 bg-amber-950/60 shadow-lg shadow-amber-900/60',
    cardIdle: 'border-amber-800/50 bg-gray-950/80', headerBg: 'bg-amber-950/40',
  },
};

const ROOM_ACCENT: Record<string, AccentTheme> = {
  blue: {
    border: 'border-blue-400', bg: 'bg-blue-950/70', text: 'text-blue-200',
    dimBorder: 'border-blue-800/50', cardHovered: 'border-blue-400 bg-blue-950/60 shadow-lg shadow-blue-900/60',
    cardIdle: 'border-blue-800/50 bg-gray-950/80', headerBg: 'bg-blue-950/40',
  },
  green: {
    border: 'border-emerald-400', bg: 'bg-emerald-950/70', text: 'text-emerald-200',
    dimBorder: 'border-emerald-800/50', cardHovered: 'border-emerald-400 bg-emerald-950/60 shadow-lg shadow-emerald-900/60',
    cardIdle: 'border-emerald-800/50 bg-gray-950/80', headerBg: 'bg-emerald-950/40',
  },
  purple: {
    border: 'border-violet-400', bg: 'bg-violet-950/70', text: 'text-violet-200',
    dimBorder: 'border-violet-800/50', cardHovered: 'border-violet-400 bg-violet-950/60 shadow-lg shadow-violet-900/60',
    cardIdle: 'border-violet-800/50 bg-gray-950/80', headerBg: 'bg-violet-950/40',
  },
  red: {
    border: 'border-orange-500', bg: 'bg-orange-950/70', text: 'text-orange-200',
    dimBorder: 'border-orange-800/50', cardHovered: 'border-orange-500 bg-orange-950/60 shadow-lg shadow-orange-900/60',
    cardIdle: 'border-orange-800/50 bg-gray-950/80', headerBg: 'bg-orange-950/40',
  },
};

const WEAPON_NAMES: Record<WeaponType, string> = {
  [WeaponType.NONE]:      'Warrior',
  [WeaponType.RUNEBLADE]: 'Runeblade',
  [WeaponType.BOW]:       'Bow',
  [WeaponType.SCYTHE]:    'Scythe',
  [WeaponType.SABRES]:    'Sabres',
  [WeaponType.SPEAR]:     'Spear',
  [WeaponType.SWORD]:     'Sword',
  [WeaponType.KNIGHT]:    'Knight',
};

const WEAPON_EMBLEMS: Record<WeaponType, string> = {
  [WeaponType.NONE]:      '⚔',
  [WeaponType.RUNEBLADE]: '🗡',
  [WeaponType.BOW]:       '🏹',
  [WeaponType.SCYTHE]:    '⚔',
  [WeaponType.SABRES]:    '⚔',
  [WeaponType.SPEAR]:     '🔱',
  [WeaponType.SWORD]:     '⚔',
  [WeaponType.KNIGHT]:    '🛡',
};

const ABILITY_LABELS: Record<string, string> = {
  RUNEBLADE_E:     'Wraith Strike',
  RUNEBLADE_R:     'Colossus Smite',
  RUNEBLADE_BASIC: 'Combo Attacks',
  RUNEBLADE_DASH:  'Dash',
  BOW_R:           'Reaping Talons',
  BOW_Q:           'Barrage',
  BOW_BASIC:       'Primary Shot',
  SCYTHE_R:        'Crossentropy',
  SCYTHE_F:        'Mantra',
  SCYTHE_BASIC:    'Entropic Bolt',
  SABRES_BASIC:    'Swipes',
  SABRES_Q:        'Backstab',
  SABRES_E:        'Flourish',
  SWORD_E:         'Charge',
  SPEAR_F:         'Storm Shroud',
};

const FLAVOR_SUBTITLES: Record<string, string> = {
  class:  'A power that shall define your fighting style for this run.',
  room:   'A blessing earned through the blood of your enemies.',
  blue:   'The lightning does not strike twice — but the stagger might.',
  green:  'Nature reclaims what was taken from it by force.',
  purple: 'Ice settles where steel fell — chill first, then silence.',
  red:    'Those who walk through fire emerge forever changed.',
};

const ROOM_TRIAL_TITLES: Record<string, string> = {
  blue:   'Storm Trial Gifts',
  green:  'Necro Trial Gifts',
  red:    'Infernal Trial Gifts',
  purple: 'Glacial Trial Gifts',
};

interface RarityStyle {
  label: string;
  text: string;
}

function getRarity(kind: CoopBoonKind, roomColor?: string | null): RarityStyle {
  if (kind === 'room' && String(roomColor ?? '').toLowerCase() === 'red') {
    return { label: 'Epic', text: 'text-violet-300' };
  }
  return { label: 'Rare', text: 'text-sky-300' };
}

function DiamondFrame({
  iconSrc,
  fallbackGlyph,
  accentBorder,
  accentBg,
}: {
  iconSrc: string | null;
  fallbackGlyph: string;
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
        <span className="relative z-10 text-xl leading-none select-none pointer-events-none">{fallbackGlyph}</span>
      )}
    </div>
  );
}

/** Build `options` with talents already granted this run removed (`excludeOwnedTalentsFromBoonPool` in `@/utils/talents`). */
interface CoopBoonPickerModalProps {
  kind: CoopBoonKind;
  weapon?: WeaponType;
  roomColor?: string | null;
  /** Up to three distinct picks; callers should omit owned talents — duplicate ids here are stripped in display order. */
  options: readonly TalentId[];
  onPick: (id: TalentId) => void;
  onReroll?: () => void;
}

export default function CoopBoonPickerModal({
  kind,
  weapon = WeaponType.RUNEBLADE,
  roomColor,
  options,
  onPick,
  onReroll,
}: CoopBoonPickerModalProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const displayOptions = useMemo(() => {
    const seen = new Set<TalentId>();
    const out: TalentId[] = [];
    for (const id of options) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
    return out;
  }, [options]);

  useEffect(() => {
    setHoveredIdx(null);
  }, [options]);

  const rc = String(roomColor ?? '').toLowerCase();
  const accent: AccentTheme =
    kind === 'room' && ROOM_ACCENT[rc]
      ? ROOM_ACCENT[rc]!
      : WEAPON_ACCENT[weapon] ?? WEAPON_ACCENT[WeaponType.RUNEBLADE];

  const rarity = getRarity(kind, roomColor);

  const weaponName = WEAPON_NAMES[weapon] ?? 'Warrior';
  const emblem = WEAPON_EMBLEMS[weapon] ?? '⚔';
  const title =
    kind === 'class'
      ? `Talents of the ${weaponName}`
      : ROOM_TRIAL_TITLES[rc] ?? `${rc.charAt(0).toUpperCase()}${rc.slice(1)} Trial Gifts`;

  const flavorKey = kind === 'room' && FLAVOR_SUBTITLES[rc] ? rc : kind;
  const flavorText = FLAVOR_SUBTITLES[flavorKey] ?? FLAVOR_SUBTITLES.class;

  // Keyboard shortcuts: 1/2/3 pick, R reroll
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (onReroll && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        onReroll();
        return;
      }
      const idx = parseInt(e.key, 10) - 1;
      if (!isNaN(idx) && idx >= 0 && idx < displayOptions.length) {
        const id = displayOptions[idx];
        if (id !== undefined) onPick(id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [displayOptions, onPick, onReroll]);

  const hoveredId =
    hoveredIdx !== null ? displayOptions[hoveredIdx] : undefined;
  const hoveredDef = hoveredId !== undefined ? getTalentBoonDefinition(hoveredId) : null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4 py-6"
      style={{
        background:
          'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.96) 100%)',
      }}
    >
      <div className="relative w-full max-w-3xl flex gap-5 items-start">
        {/* ── Main panel ── */}
        <div className="flex-1 min-w-0">

          {/* Ornate header */}
          <div className={`rounded-t-xl border-2 ${accent.border} ${accent.headerBg} px-6 pt-5 pb-4 mb-0 relative`}>
            {/* Decorative top corner badge */}
            <div className={`absolute top-3 right-3 w-9 h-9 flex items-center justify-center border ${accent.border} ${accent.bg} rounded text-lg`}>
              {emblem}
            </div>

            {/* Title with flanking lines */}
            <div className="flex items-center gap-3 mb-1 pr-12">
              <div
                className={`flex-1 h-px opacity-50`}
                style={{ background: 'linear-gradient(to right, transparent, var(--line-color, #94a3b8))' }}
              />
              <h1 className={`text-xl font-bold tracking-[0.3em] uppercase ${accent.text} whitespace-nowrap px-1`}>
                {title}
              </h1>
              <div
                className={`flex-1 h-px opacity-50`}
                style={{ background: 'linear-gradient(to left, transparent, var(--line-color, #94a3b8))' }}
              />
            </div>

            {/* Flavor subtitle */}
            <p className="text-center text-xs text-gray-400 uppercase tracking-[0.18em] italic">
              {flavorText}
            </p>
          </div>

          {/* Separator with Choose One label */}
          <div className={`border-x-2 ${accent.border} bg-gray-950/60 px-6 py-2 flex items-center gap-3`}>
            <span className={`text-sm font-bold tracking-[0.2em] uppercase ${accent.text}`}>
              Choose One:
            </span>
            {onReroll && (
              <button
                type="button"
                onClick={onReroll}
                aria-label="Reroll boon options"
                className={`
                  shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md
                  border text-xs font-bold tracking-widest uppercase
                  transition-all duration-150 cursor-pointer
                  ${accent.dimBorder} ${accent.text} ${accent.bg}
                  hover:brightness-125 hover:shadow-md hover:shadow-black/40
                `}
              >
                <span className="text-sm leading-none" aria-hidden="true">🎲</span>
                Reroll
              </button>
            )}
            <div className="flex-1 h-px bg-gray-700/60" />
            <span className="text-gray-600 text-xs tracking-widest">
              Press&nbsp;
              <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 font-mono text-xs">1</kbd>
              &nbsp;·&nbsp;
              <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 font-mono text-xs">2</kbd>
              &nbsp;·&nbsp;
              <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 font-mono text-xs">3</kbd>
              {onReroll && (
                <>
                  &nbsp;·&nbsp;
                  <kbd className="px-1 py-0.5 rounded bg-gray-800 border border-gray-600 text-gray-400 font-mono text-xs">R</kbd>
                </>
              )}
            </span>
          </div>

          {/* Boon cards */}
          <div className={`border-x-2 border-b-2 ${accent.border} rounded-b-xl overflow-hidden`}>
            {displayOptions.map((id, idx) => {
              const def = getTalentBoonDefinition(id);
              const name = def?.name ?? id;
              const description = def?.description ?? '';
              const abilityId = def?.modifiesAbilityId ?? '';
              const iconSrc = getTalentIconSrc(id);
              const abilityLabel = ABILITY_LABELS[abilityId] ?? abilityId;
              const isHovered = hoveredIdx === idx;
              const isLast = idx === options.length - 1;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPick(id)}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`
                    relative w-full flex items-center gap-4 px-5 py-4 text-left
                    border-2 transition-all duration-150 cursor-pointer
                    ${isHovered ? accent.cardHovered : accent.cardIdle}
                    ${!isLast ? 'border-b border-t-0 border-x-0' : 'border-0'}
                  `}
                  style={{ borderColor: isHovered ? undefined : 'transparent' }}
                >
                  {/* Key number */}
                  <div className={`
                    absolute top-2 left-2 w-4 h-4 flex items-center justify-center
                    text-[10px] font-bold rounded-full
                    ${isHovered ? `${accent.text} border ${accent.border}` : 'text-gray-600 border border-gray-700'}
                    bg-gray-950/80
                  `}>
                    {idx + 1}
                  </div>

                  {/* Diamond icon */}
                  <DiamondFrame
                    iconSrc={iconSrc}
                    fallbackGlyph="✦"
                    accentBorder={isHovered ? accent.border : accent.dimBorder}
                    accentBg={isHovered ? accent.bg : 'bg-gray-900/60'}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Name row */}
                    <div className="flex items-baseline justify-between gap-3 mb-1">
                      <span className={`text-sm font-bold tracking-[0.18em] uppercase leading-snug ${isHovered ? accent.text : 'text-gray-200'} transition-colors duration-150`}>
                        {name}
                      </span>
                      <span className={`text-xs font-bold tracking-widest uppercase shrink-0 ${rarity.text}`}>
                        {rarity.label}
                      </span>
                    </div>

                    {/* Description */}
                    <p className="text-gray-400 text-xs leading-relaxed line-clamp-2">
                      {description}
                    </p>

                    {/* Stat line */}
                    {abilityLabel && (
                      <p className="mt-1.5 text-xs">
                        <span className="text-gray-600">▸ </span>
                        <span className="text-gray-500">Modifies: </span>
                        <span className={`font-semibold ${isHovered ? accent.text : 'text-gray-300'} transition-colors duration-150`}>
                          {abilityLabel}
                        </span>
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right detail panel ── */}
        <div
          className={`w-60 shrink-0 transition-opacity duration-200 ${hoveredDef ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!hoveredDef}
        >
          {hoveredDef && (
            <div className={`border-2 ${accent.border} ${accent.bg} rounded-xl overflow-hidden`}>
              {/* Panel header */}
              <div className={`px-4 py-3 border-b ${accent.dimBorder} bg-black/30`}>
                <div className={`text-xs font-bold uppercase tracking-widest ${accent.text} mb-0.5`}>
                  {ABILITY_LABELS[hoveredDef.modifiesAbilityId] ?? 'Ability'}
                </div>
                <div className="text-gray-600 text-[10px] uppercase tracking-widest font-mono">
                  {hoveredDef.modifiesAbilityId}
                </div>
              </div>

              {/* Panel body */}
              <div className="px-4 py-3">
                <p className="text-gray-300 text-xs leading-relaxed">
                  {hoveredDef.description}
                </p>
              </div>
            </div>
          )}

          {/* Placeholder when nothing hovered */}
          {!hoveredDef && (
            <div className={`border-2 ${accent.dimBorder} rounded-xl px-4 py-3 opacity-0`}>
              <div className="h-4" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
