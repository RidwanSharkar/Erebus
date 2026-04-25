'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import {
  universalAbilityPool,
  UniversalAbility,
  AbilityLoadout,
  getDefaultLoadoutForWeapon,
  isAbilityLoadoutCompleteForWeapon,
} from '@/utils/weaponAbilities';

interface AbilitySelectionModalProps {
  selectedWeapon: WeaponType;
  /** When set, Q/E/R/passive are kept if still valid for this weapon. */
  initialLoadout?: AbilityLoadout | null;
  onConfirm: (loadout: AbilityLoadout) => void;
  onBack: () => void;
}

function mergeSavedLoadout(weapon: WeaponType, saved: AbilityLoadout | null | undefined): AbilityLoadout {
  const def = getDefaultLoadoutForWeapon(weapon);
  if (!saved) return { ...def };

  const slotOk = (id: string | null | undefined, slot: 'Q' | 'E' | 'R'): string | null => {
    if (id == null) return def[slot];
    const a = universalAbilityPool.find((x) => x.id === id);
    return a && a.allowedWeapons.includes(weapon) ? id : def[slot];
  };

  const passiveOk =
    saved.passive &&
    saved.passive !== 'BOW_P' &&
    saved.passive !== 'SCYTHE_P' &&
    universalAbilityPool.some(
      (a) => a.id === saved.passive && a.sourceKey === 'P' && a.allowedWeapons.includes(weapon),
    )
      ? saved.passive
      : null;

  return {
    Q: slotOk(saved.Q, 'Q'),
    E: slotOk(saved.E, 'E'),
    R: slotOk(saved.R, 'R'),
    passive: passiveOk,
  };
}

function computeInitialActiveSlot(weapon: WeaponType, merged: AbilityLoadout): 'Q' | 'E' | 'R' | null {
  if (merged.Q == null) return 'Q';
  if (merged.E == null) return 'E';
  if (getDefaultLoadoutForWeapon(weapon).R !== null && merged.R == null) return 'R';
  return null;
}

const WEAPON_LABELS: Record<WeaponType, string> = {
  [WeaponType.NONE]: 'Unarmed',
  [WeaponType.RUNEBLADE]: 'Sword',
  [WeaponType.BOW]: 'Bow',
  [WeaponType.SCYTHE]: 'Scythe',
  [WeaponType.SABRES]: 'Sabres',
  [WeaponType.SPEAR]: 'Spear',
  [WeaponType.SWORD]: 'Sword (Classic)',
  [WeaponType.KNIGHT]: 'Knight',
};

const WEAPON_COLORS: Record<WeaponType, { border: string; bg: string; text: string; badge: string }> = {
  [WeaponType.NONE]: { border: 'border-violet-400', bg: 'bg-violet-900/30', text: 'text-violet-200', badge: 'bg-violet-600' },
  [WeaponType.RUNEBLADE]: { border: 'border-sky-400', bg: 'bg-sky-900/30', text: 'text-sky-300', badge: 'bg-sky-600' },
  [WeaponType.BOW]:       { border: 'border-green-400', bg: 'bg-green-900/30', text: 'text-green-300', badge: 'bg-green-600' },
  [WeaponType.SCYTHE]:    { border: 'border-purple-400', bg: 'bg-purple-900/30', text: 'text-purple-300', badge: 'bg-purple-600' },
  [WeaponType.SABRES]:    { border: 'border-red-400', bg: 'bg-red-900/30', text: 'text-red-300', badge: 'bg-red-600' },
  [WeaponType.SPEAR]:     { border: 'border-gray-300', bg: 'bg-gray-700/30', text: 'text-gray-200', badge: 'bg-gray-500' },
  [WeaponType.SWORD]:     { border: 'border-yellow-400', bg: 'bg-yellow-900/30', text: 'text-yellow-300', badge: 'bg-yellow-600' },
  [WeaponType.KNIGHT]:    { border: 'border-amber-400', bg: 'bg-amber-900/30', text: 'text-amber-300', badge: 'bg-amber-600' },
};

const SLOT_COLORS: Record<'Q' | 'E' | 'R', { ring: string; bg: string; text: string }> = {
  Q: { ring: 'ring-blue-400',   bg: 'bg-blue-900/60',   text: 'text-blue-300' },
  E: { ring: 'ring-emerald-400', bg: 'bg-emerald-900/60', text: 'text-emerald-300' },
  R: { ring: 'ring-orange-400', bg: 'bg-orange-900/60', text: 'text-orange-300' },
};

const SOURCE_WEAPON_ORDER: WeaponType[] = [
  WeaponType.RUNEBLADE,
  WeaponType.SWORD,
  WeaponType.BOW,
  WeaponType.SCYTHE,
  WeaponType.SABRES,
  WeaponType.SPEAR,
];

export default function AbilitySelectionModal({
  selectedWeapon,
  initialLoadout,
  onConfirm,
  onBack,
}: AbilitySelectionModalProps) {
  const [loadout, setLoadout] = useState<AbilityLoadout>(() => mergeSavedLoadout(selectedWeapon, initialLoadout));
  const [activeSlot, setActiveSlot] = useState<'Q' | 'E' | 'R' | null>(() =>
    computeInitialActiveSlot(selectedWeapon, mergeSavedLoadout(selectedWeapon, initialLoadout)),
  );

  // Only show active abilities (non-passive) that are allowed for the currently selected weapon, grouped by source
  const abilityGroups = useMemo(() => {
    return SOURCE_WEAPON_ORDER
      .map(weapon => ({
        weapon,
        abilities: universalAbilityPool.filter(
          a => a.sourceWeapon === weapon && a.allowedWeapons.includes(selectedWeapon) && a.sourceKey !== 'P'
        ),
      }))
      .filter(group => group.abilities.length > 0);
  }, [selectedWeapon]);

  // Passive abilities available for this weapon (shown separately, not assignable to Q/E/R)
  const passiveAbilities = useMemo(() => {
    return universalAbilityPool.filter(
      (a) =>
        a.sourceKey === 'P' &&
        a.allowedWeapons.includes(selectedWeapon) &&
        a.id !== 'BOW_P' &&
        a.id !== 'SCYTHE_P',
    );
  }, [selectedWeapon]);
  const defaultLoadout = getDefaultLoadoutForWeapon(selectedWeapon);
  const baselineExpectsR = defaultLoadout.R !== null;
  const [hoveredAbility, setHoveredAbility] = useState<UniversalAbility | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const isComplete = isAbilityLoadoutCompleteForWeapon(selectedWeapon, loadout);
  const requiredSlotCount = baselineExpectsR ? 3 : 2;
  const filledRequiredCount = [loadout.Q, loadout.E, ...(baselineExpectsR ? [loadout.R] : [])].filter(Boolean).length;

  const getSlotAbility = useCallback((slot: 'Q' | 'E' | 'R'): UniversalAbility | null => {
    const id = loadout[slot];
    return id ? universalAbilityPool.find(a => a.id === id) ?? null : null;
  }, [loadout]);

  const isAssigned = useCallback((abilityId: string): 'Q' | 'E' | 'R' | null => {
    if (loadout.Q === abilityId) return 'Q';
    if (loadout.E === abilityId) return 'E';
    if (loadout.R === abilityId) return 'R';
    return null;
  }, [loadout]);

  const handleAbilityClick = useCallback((ability: UniversalAbility) => {
    const alreadyInSlot = isAssigned(ability.id);

    if (alreadyInSlot) {
      // Clicking an already-assigned ability removes it
      setLoadout(prev => ({ ...prev, [alreadyInSlot]: null }));
      setActiveSlot(alreadyInSlot);
      return;
    }

    if (!activeSlot) return;

    setLoadout(prev => {
      // If something else was in this slot, don't remove the old — just overwrite
      return { ...prev, [activeSlot]: ability.id };
    });

    // Advance to next unfilled slot
    const slots: Array<'Q' | 'E' | 'R'> = ['Q', 'E', 'R'];
    const newLoadout = { ...loadout, [activeSlot]: ability.id };
    const nextEmpty = slots.find(s => s !== activeSlot && newLoadout[s] === null);
    setActiveSlot(nextEmpty ?? null);
  }, [activeSlot, isAssigned, loadout]);

  const handlePassiveClick = useCallback((ability: UniversalAbility) => {
    setLoadout(prev => ({
      ...prev,
      passive: prev.passive === ability.id ? null : ability.id,
    }));
  }, []);

  const handleSlotClick = useCallback((slot: 'Q' | 'E' | 'R') => {
    setActiveSlot(slot);
  }, []);

  const handleMouseEnter = useCallback((e: React.MouseEvent, ability: UniversalAbility) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setHoveredAbility(ability);
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top });
  }, []);

  const handleMouseLeave = useCallback(() => {
    setHoveredAbility(null);
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] overflow-y-auto py-4">
      <div className="bg-gray-900/98 border-2 border-green-500 rounded-xl p-6 max-w-3xl w-11/12 mx-auto">

        {/* Header */}
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-green-400 mb-1">ABILITY LOADOUT</h2>
          <p className="text-gray-400 text-sm">
            Showing abilities available to your{' '}
            <span className={`font-semibold ${WEAPON_COLORS[selectedWeapon].text}`}>
              {WEAPON_LABELS[selectedWeapon]}
            </span>
            . Assign one ability each to{' '}
            <span className="text-white font-semibold">Q</span> and{' '}
            <span className="text-white font-semibold">E</span>
            {baselineExpectsR ? (
              <>
                , and one to <span className="text-white font-semibold">R</span>.
              </>
            ) : (
              <>
                . <span className="text-white font-semibold">R</span> is optional and unlocks later in the run.
              </>
            )}
          </p>
        </div>

        {/* Assignment Slots */}
        <div className="flex justify-center gap-4 mb-6">
          {(['Q', 'E', 'R'] as const).map(slot => {
            const assigned = getSlotAbility(slot);
            const sc = SLOT_COLORS[slot];
            const isActive = activeSlot === slot;
            return (
              <div
                key={slot}
                onClick={() => handleSlotClick(slot)}
                className={`
                  relative w-32 h-28 rounded-xl border-2 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-1 px-2
                  ${isActive ? `${sc.ring} ring-2 border-transparent ${sc.bg}` : assigned ? 'border-gray-500 bg-gray-800/60' : 'border-dashed border-gray-600 bg-gray-800/30 hover:border-gray-400'}
                `}
              >
                {/* Key badge */}
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded font-bold text-sm ${sc.bg} ${sc.text} border ${sc.ring}`}>
                  {slot}
                </div>

                {assigned ? (
                  <>
                    <div className="text-2xl">{assigned.icon}</div>
                    <div className="text-white text-xs font-semibold text-center leading-tight">{assigned.name}</div>
                    <div className="text-gray-400 text-xs">{assigned.cooldown}s CD</div>
                    <div className={`text-xs ${WEAPON_COLORS[assigned.sourceWeapon].text}`}>
                      {WEAPON_LABELS[assigned.sourceWeapon]}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500 text-xs text-center">
                    {isActive ? <span className="text-green-400 animate-pulse">Click an ability →</span> : 'Empty'}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Ability Grid — grouped by weapon */}
        <div className="space-y-1 max-h-140 overflow-y-auto pr-1 custom-scrollbar">
          {abilityGroups.map(({ weapon, abilities }) => {
            const colors = WEAPON_COLORS[weapon];
            return (
              <div key={weapon}>

                <div className="grid grid-cols-3 gap-2">
                  {abilities.map(ability => {
                    const assignedSlot = isAssigned(ability.id);
                    const slotColor = assignedSlot ? SLOT_COLORS[assignedSlot] : null;

                    return (
                      <div
                        key={ability.id}
                        onClick={() => handleAbilityClick(ability)}
                        onMouseEnter={(e) => handleMouseEnter(e, ability)}
                        onMouseLeave={handleMouseLeave}
                        className={`
                          relative flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-150
                          ${assignedSlot
                            ? `${slotColor!.ring} ring-1 border-transparent ${slotColor!.bg}`
                            : `${colors.border} ${colors.bg} hover:brightness-125 border-opacity-50`
                          }
                        `}
                      >
                        <div className="text-xl shrink-0">{ability.icon}</div>
                        <div className="min-w-0">
                          <div className="text-white text-xs font-semibold truncate">{ability.name}</div>
                          <div className="text-gray-400 text-xs">{ability.cooldown}s CD</div>
                        </div>
                        {assignedSlot && (
                          <div className={`absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${slotColor!.bg} ${slotColor!.text} border ${slotColor!.ring}`}>
                            {assignedSlot}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Passive Abilities — shown separately, no hotkey assignment */}
        {passiveAbilities.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 pl-1">
              Passive Ability <span className="text-gray-500 normal-case font-normal">(optional — replaces primary attack)</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {passiveAbilities.map(ability => {
                const isSelected = loadout.passive === ability.id;
                const colors = WEAPON_COLORS[ability.sourceWeapon];
                return (
                  <div
                    key={ability.id}
                    onClick={() => handlePassiveClick(ability)}
                    onMouseEnter={(e) => handleMouseEnter(e, ability)}
                    onMouseLeave={handleMouseLeave}
                    className={`
                      relative flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all duration-150
                      ${isSelected
                        ? 'ring-1 ring-violet-400 border-transparent bg-violet-900/60'
                        : `${colors.border} ${colors.bg} hover:brightness-125 border-opacity-50`
                      }
                    `}
                  >
                    <div className="text-xl shrink-0">{ability.icon}</div>
                    <div className="min-w-0">
                      <div className="text-white text-xs font-semibold">{ability.name}</div>
                      <div className="text-violet-400 text-xs">PASSIVE</div>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-violet-700 text-violet-200 border border-violet-400">
                        ✓
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(selectedWeapon === WeaponType.BOW || selectedWeapon === WeaponType.SCYTHE) && (
          <p className="mt-3 text-gray-500 text-xs pl-1">
            {selectedWeapon === WeaponType.BOW
              ? 'Tempest Rounds is granted by the co-op class boon or dev talent pillar, not this passive row.'
              : 'Icebeam is granted by the co-op class boon or dev talent pillar, not this passive row.'}
          </p>
        )}

        {/* Footer */}
        <div className="flex gap-3 mt-5 justify-between items-center">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-700 transition-colors text-sm"
          >
            ← Back
          </button>

          <div className="text-gray-500 text-xs">
            {isComplete ? (
              <span className="text-green-400">✓ Loadout ready</span>
            ) : (
              <span>
                {filledRequiredCount} / {requiredSlotCount} required slots filled
              </span>
            )}
          </div>

          <button
            onClick={() => isComplete && onConfirm(loadout)}
            disabled={!isComplete}
            className={`px-6 py-2 rounded-lg font-bold text-sm transition-all duration-200 ${
              isComplete
                ? 'bg-green-600 hover:bg-green-500 text-white hover:-translate-y-0.5'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            CONFIRM LOADOUT
          </button>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredAbility && (
        <div
          className="fixed z-[210] pointer-events-none bg-gray-900 border border-gray-600 rounded-lg p-3 max-w-xs text-sm"
          style={{ left: tooltipPos.x - 120, top: Math.max(8, tooltipPos.y - 120) }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl">{hoveredAbility.icon}</span>
            <span className="font-semibold text-white">{hoveredAbility.name}</span>
          </div>
          <div className="text-yellow-400 text-xs mb-1">Cooldown: {hoveredAbility.cooldown}s</div>
          <div className="text-gray-300 text-xs leading-relaxed">{hoveredAbility.description}</div>
          <div className={`text-xs mt-1 ${WEAPON_COLORS[hoveredAbility.sourceWeapon].text}`}>
            Source: {WEAPON_LABELS[hoveredAbility.sourceWeapon]}
          </div>
        </div>
      )}
    </div>
  );
}
