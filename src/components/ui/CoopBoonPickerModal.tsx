'use client';

import React from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import type { TalentId } from '@/utils/talents';
import { getTalentBoonDefinition } from '@/utils/talents';

export type CoopBoonKind = 'class' | 'room';

const WEAPON_ACCENT: Record<
  WeaponType,
  { border: string; bg: string; text: string; card: string }
> = {
  [WeaponType.NONE]: {
    border: 'border-violet-400',
    bg: 'bg-violet-900/40',
    text: 'text-violet-200',
    card: 'bg-slate-900/80 border-violet-500/50 hover:border-violet-400',
  },
  [WeaponType.RUNEBLADE]: {
    border: 'border-sky-400',
    bg: 'bg-sky-900/40',
    text: 'text-sky-200',
    card: 'bg-slate-900/80 border-sky-500/50 hover:border-sky-400',
  },
  [WeaponType.BOW]: {
    border: 'border-green-400',
    bg: 'bg-green-900/40',
    text: 'text-green-200',
    card: 'bg-slate-900/80 border-green-500/50 hover:border-green-400',
  },
  [WeaponType.SCYTHE]: {
    border: 'border-purple-400',
    bg: 'bg-purple-900/40',
    text: 'text-purple-200',
    card: 'bg-slate-900/80 border-purple-500/50 hover:border-purple-400',
  },
  [WeaponType.SABRES]: {
    border: 'border-red-400',
    bg: 'bg-red-900/40',
    text: 'text-red-200',
    card: 'bg-slate-900/80 border-red-500/50 hover:border-red-400',
  },
  [WeaponType.SPEAR]: {
    border: 'border-gray-300',
    bg: 'bg-gray-800/40',
    text: 'text-gray-100',
    card: 'bg-slate-900/80 border-gray-500/50 hover:border-gray-300',
  },
  [WeaponType.SWORD]: {
    border: 'border-yellow-400',
    bg: 'bg-yellow-900/40',
    text: 'text-yellow-200',
    card: 'bg-slate-900/80 border-yellow-500/50 hover:border-yellow-400',
  },
  [WeaponType.KNIGHT]: {
    border: 'border-amber-400',
    bg: 'bg-amber-900/40',
    text: 'text-amber-200',
    card: 'bg-slate-900/80 border-amber-500/50 hover:border-amber-400',
  },
};

const ROOM_ACCENT: Record<string, { border: string; bg: string; text: string; card: string }> = {
  blue: {
    border: 'border-blue-400',
    bg: 'bg-blue-950/50',
    text: 'text-blue-200',
    card: 'bg-slate-900/80 border-blue-500/50 hover:border-blue-400',
  },
  green: {
    border: 'border-emerald-400',
    bg: 'bg-emerald-950/50',
    text: 'text-emerald-200',
    card: 'bg-slate-900/80 border-emerald-500/50 hover:border-emerald-400',
  },
  purple: {
    border: 'border-violet-400',
    bg: 'bg-violet-950/50',
    text: 'text-violet-200',
    card: 'bg-slate-900/80 border-violet-500/50 hover:border-violet-400',
  },
  red: {
    border: 'border-orange-500',
    bg: 'bg-orange-950/50',
    text: 'text-orange-200',
    card: 'bg-slate-900/80 border-orange-500/50 hover:border-orange-400',
  },
};

interface CoopBoonPickerModalProps {
  kind: CoopBoonKind;
  /** Class boon: used for frame color. Room boon: uses `roomColor` if set. */
  weapon?: WeaponType;
  /** Room boon: `blue` | `green` | `purple` | `red` for accent. */
  roomColor?: string | null;
  options: readonly TalentId[];
  onPick: (id: TalentId) => void;
}

export default function CoopBoonPickerModal({
  kind,
  weapon = WeaponType.RUNEBLADE,
  roomColor,
  options,
  onPick,
}: CoopBoonPickerModalProps) {
  const rc = String(roomColor ?? '').toLowerCase();
  const accent =
    kind === 'room' && ROOM_ACCENT[rc]
      ? ROOM_ACCENT[rc]!
      : WEAPON_ACCENT[weapon] ?? WEAPON_ACCENT[WeaponType.RUNEBLADE];

  const title = kind === 'class' ? 'Class boon' : 'Room boon';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 px-4 py-8">
      <div
        className={`w-full max-w-4xl rounded-xl border-2 ${accent.border} ${accent.bg} p-6 shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="coop-boon-title"
      >
        <h2 id="coop-boon-title" className={`mb-1 text-center text-2xl font-semibold tracking-wide ${accent.text}`}>
          {title}
        </h2>
        <p className="mb-6 text-center text-sm text-slate-400">Choose one blessing</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {options.map((id) => {
            const def = getTalentBoonDefinition(id);
            const name = def?.name ?? id;
            const description = def?.description ?? '';
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPick(id)}
                className={`flex min-h-[220px] flex-col rounded-lg border-2 p-4 text-left transition ${accent.card}`}
              >
                <span className={`mb-2 text-lg font-bold ${accent.text}`}>{name}</span>
                <span className="text-xs leading-relaxed text-slate-300 line-clamp-[10]">{description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
