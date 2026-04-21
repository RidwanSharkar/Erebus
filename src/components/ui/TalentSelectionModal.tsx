'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import type { AbilityLoadout } from '@/utils/weaponAbilities';
import type { TalentLoadout } from '@/utils/talents';
import {
  createDefaultTalentLoadout,
  infestedStrikeTalentDefinition,
  isChargeInLoadout,
  isReapingTalonsInLoadout,
  isWraithStrikeInLoadout,
  staggeringStrikeTalentDefinition,
  storedChargeTalentDefinition,
  wrathStrikeTalentDefinition,
  wrathfulTalonsTalentDefinition,
} from '@/utils/talents';

interface TalentSelectionModalProps {
  selectedWeapon: WeaponType;
  abilityLoadout: AbilityLoadout | null;
  initialTalentLoadout?: TalentLoadout | null;
  onConfirm: (loadout: TalentLoadout) => void;
  onBack: () => void;
}

const WEAPON_LABELS: Record<WeaponType, string> = {
  [WeaponType.RUNEBLADE]: 'Sword',
  [WeaponType.BOW]: 'Bow',
  [WeaponType.SCYTHE]: 'Scythe',
  [WeaponType.SABRES]: 'Sabres',
  [WeaponType.SPEAR]: 'Spear',
  [WeaponType.SWORD]: 'Sword (Classic)',
  [WeaponType.KNIGHT]: 'Knight',
};

const WEAPON_COLORS: Record<WeaponType, { border: string; bg: string; text: string }> = {
  [WeaponType.RUNEBLADE]: { border: 'border-sky-400', bg: 'bg-sky-900/30', text: 'text-sky-300' },
  [WeaponType.BOW]: { border: 'border-green-400', bg: 'bg-green-900/30', text: 'text-green-300' },
  [WeaponType.SCYTHE]: { border: 'border-purple-400', bg: 'bg-purple-900/30', text: 'text-purple-300' },
  [WeaponType.SABRES]: { border: 'border-red-400', bg: 'bg-red-900/30', text: 'text-red-300' },
  [WeaponType.SPEAR]: { border: 'border-gray-300', bg: 'bg-gray-700/30', text: 'text-gray-200' },
  [WeaponType.SWORD]: { border: 'border-yellow-400', bg: 'bg-yellow-900/30', text: 'text-yellow-300' },
  [WeaponType.KNIGHT]: { border: 'border-amber-400', bg: 'bg-amber-900/30', text: 'text-amber-300' },
};

export default function TalentSelectionModal({
  selectedWeapon,
  abilityLoadout,
  initialTalentLoadout,
  onConfirm,
  onBack,
}: TalentSelectionModalProps) {
  const def = createDefaultTalentLoadout();
  const merged: TalentLoadout = {
    wrathStrike: initialTalentLoadout?.wrathStrike ?? def.wrathStrike,
    infestedStrike: initialTalentLoadout?.infestedStrike ?? def.infestedStrike,
    staggeringStrike: initialTalentLoadout?.staggeringStrike ?? def.staggeringStrike,
    wrathfulTalons: initialTalentLoadout?.wrathfulTalons ?? def.wrathfulTalons,
    storedCharge: initialTalentLoadout?.storedCharge ?? def.storedCharge,
  };
  const [loadout, setLoadout] = useState<TalentLoadout>(() => merged);

  const wraithEquipped = useMemo(() => isWraithStrikeInLoadout(abilityLoadout), [abilityLoadout]);
  const reapingEquipped = useMemo(() => isReapingTalonsInLoadout(abilityLoadout), [abilityLoadout]);
  const chargeEquipped = useMemo(() => isChargeInLoadout(abilityLoadout), [abilityLoadout]);
  const wc = WEAPON_COLORS[selectedWeapon];

  const toggleWrath = useCallback(() => {
    if (!wraithEquipped) return;
    setLoadout((prev) => ({ ...prev, wrathStrike: !prev.wrathStrike }));
  }, [wraithEquipped]);

  const toggleInfested = useCallback(() => {
    if (!wraithEquipped) return;
    setLoadout((prev) => ({ ...prev, infestedStrike: !prev.infestedStrike }));
  }, [wraithEquipped]);

  const toggleStaggering = useCallback(() => {
    if (!wraithEquipped) return;
    setLoadout((prev) => ({ ...prev, staggeringStrike: !prev.staggeringStrike }));
  }, [wraithEquipped]);

  const toggleWrathfulTalons = useCallback(() => {
    if (!reapingEquipped) return;
    setLoadout((prev) => ({ ...prev, wrathfulTalons: !prev.wrathfulTalons }));
  }, [reapingEquipped]);

  const toggleStoredCharge = useCallback(() => {
    if (!chargeEquipped) return;
    setLoadout((prev) => ({ ...prev, storedCharge: !prev.storedCharge }));
  }, [chargeEquipped]);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] overflow-y-auto py-4">
      <div className="bg-gray-900/98 border-2 border-amber-500 rounded-xl p-6 max-w-lg w-11/12 mx-auto">
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-amber-400 mb-1">TALENTS</h2>
          <p className="text-gray-400 text-sm">
            Talents modify your equipped abilities. Current weapon:{' '}
            <span className={`font-semibold ${wc.text}`}>{WEAPON_LABELS[selectedWeapon]}</span>.
          </p>
        </div>

        <div
          className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wraithEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="talent-wrath-strike"
              checked={loadout.wrathStrike}
              onChange={toggleWrath}
              disabled={!wraithEquipped}
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="talent-wrath-strike" className={`flex-1 ${wraithEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <div className="text-white font-semibold">{wrathStrikeTalentDefinition.name}</div>
              <p className="text-gray-400 text-sm mt-1">{wrathStrikeTalentDefinition.description}</p>
              <p className="text-amber-200/90 text-xs mt-2 font-mono">+20% crit chance · +50% crit damage on Wraith Strike</p>
            </label>
          </div>
          {!wraithEquipped && (
            <p className="text-gray-500 text-xs mt-3 pl-7">
              Equip <span className="text-gray-300">Wraith Strike</span> in your ability loadout at the other east pillar to enable this talent.
            </p>
          )}
        </div>

        <div
          className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wraithEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="talent-infested-strike"
              checked={loadout.infestedStrike}
              onChange={toggleInfested}
              disabled={!wraithEquipped}
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="talent-infested-strike" className={`flex-1 ${wraithEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <div className="text-white font-semibold">{infestedStrikeTalentDefinition.name}</div>
              <p className="text-gray-400 text-sm mt-1">{infestedStrikeTalentDefinition.description}</p>
              <p className="text-emerald-200/90 text-xs mt-2 font-mono">190 damage · green VFX · zombies on kill (max 3)</p>
            </label>
          </div>
        </div>

        <div
          className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wraithEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
        >
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="talent-staggering-strike"
              checked={loadout.staggeringStrike}
              onChange={toggleStaggering}
              disabled={!wraithEquipped}
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="talent-staggering-strike" className={`flex-1 ${wraithEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <div className="text-white font-semibold">{staggeringStrikeTalentDefinition.name}</div>
              <p className="text-gray-400 text-sm mt-1">{staggeringStrikeTalentDefinition.description}</p>
              <p className="text-sky-200/90 text-xs mt-2 font-mono">+40 stagger · 100 = lightning + 125 dmg + 3s stun</p>
            </label>
          </div>
        </div>

        {selectedWeapon === WeaponType.RUNEBLADE && (
          <div
            className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${chargeEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="talent-stored-charge"
                checked={loadout.storedCharge}
                onChange={toggleStoredCharge}
                disabled={!chargeEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="talent-stored-charge" className={`flex-1 ${chargeEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="text-white font-semibold">{storedChargeTalentDefinition.name}</div>
                <p className="text-gray-400 text-sm mt-1">{storedChargeTalentDefinition.description}</p>
                <p className="text-sky-200/90 text-xs mt-2 font-mono">3 full spins · Charge damage per rotation</p>
              </label>
            </div>
            {!chargeEquipped && (
              <p className="text-gray-500 text-xs mt-3 pl-7">
                Equip <span className="text-gray-300">Charge</span> in your ability loadout at the other east pillar to enable this talent.
              </p>
            )}
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div
            className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${reapingEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="talent-wrathful-talons"
                checked={loadout.wrathfulTalons}
                onChange={toggleWrathfulTalons}
                disabled={!reapingEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="talent-wrathful-talons" className={`flex-1 ${reapingEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="text-white font-semibold">{wrathfulTalonsTalentDefinition.name}</div>
                <p className="text-gray-400 text-sm mt-1">{wrathfulTalonsTalentDefinition.description}</p>
                <p className="text-green-200/90 text-xs mt-2 font-mono">+40% crit chance · +100% crit damage on return arrow hit</p>
              </label>
            </div>
            {!reapingEquipped && (
              <p className="text-gray-500 text-xs mt-3 pl-7">
                Equip <span className="text-gray-300">Reaping Talons</span> in your ability loadout at the other east pillar to enable this talent.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2 rounded-lg border border-gray-500 text-gray-300 hover:bg-gray-800 transition-colors"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => onConfirm(loadout)}
            className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
