'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import type { AbilityLoadout } from '@/utils/weaponAbilities';
import type { TalentLoadout } from '@/utils/talents';
import {
  createDefaultTalentLoadout,
  infestedSmiteTalentDefinition,
  infernalSmiteTalentDefinition,
  infestedStrikeTalentDefinition,
  staggeringSmiteTalentDefinition,
  INFERNAL_SMITE_CRIT_CHANCE_ADD,
  INFERNAL_SMITE_DOT_FRACTION,
  INFERNAL_SMITE_DURATION_MS,
  INFERNAL_SMITE_TICKS,
  isChargeInLoadout,
  isColossusSmiteInLoadout,
  isReapingTalonsInLoadout,
  isWraithStrikeInLoadout,
  staggeringStrikeTalentDefinition,
  staggeringComboTalentDefinition,
  staggeringSwipesTalentDefinition,
  storedChargeTalentDefinition,
  trinityTalentDefinition,
  STAGGERING_SMITE_BEAM_STAGGER,
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
    staggeringCombo: initialTalentLoadout?.staggeringCombo ?? def.staggeringCombo,
    staggeringSwipes: initialTalentLoadout?.staggeringSwipes ?? def.staggeringSwipes,
    wrathfulTalons: initialTalentLoadout?.wrathfulTalons ?? def.wrathfulTalons,
    storedCharge: initialTalentLoadout?.storedCharge ?? def.storedCharge,
    trinity: initialTalentLoadout?.trinity ?? def.trinity,
    infestedSmite: initialTalentLoadout?.infestedSmite ?? def.infestedSmite,
    staggeringSmite: initialTalentLoadout?.staggeringSmite ?? def.staggeringSmite,
    infernalSmite: initialTalentLoadout?.infernalSmite ?? def.infernalSmite,
  };
  const [loadout, setLoadout] = useState<TalentLoadout>(() => merged);

  const wraithEquipped = useMemo(() => isWraithStrikeInLoadout(abilityLoadout), [abilityLoadout]);
  const reapingEquipped = useMemo(() => isReapingTalonsInLoadout(abilityLoadout), [abilityLoadout]);
  const chargeEquipped = useMemo(() => isChargeInLoadout(abilityLoadout), [abilityLoadout]);
  const smiteEquipped = useMemo(() => isColossusSmiteInLoadout(abilityLoadout), [abilityLoadout]);
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

  const toggleTrinity = useCallback(() => {
    if (!smiteEquipped) return;
    setLoadout((prev) => ({ ...prev, trinity: !prev.trinity }));
  }, [smiteEquipped]);

  const toggleInfestedSmite = useCallback(() => {
    if (!smiteEquipped) return;
    setLoadout((prev) => ({ ...prev, infestedSmite: !prev.infestedSmite }));
  }, [smiteEquipped]);

  const toggleStaggeringSmite = useCallback(() => {
    if (!smiteEquipped) return;
    setLoadout((prev) => ({ ...prev, staggeringSmite: !prev.staggeringSmite }));
  }, [smiteEquipped]);

  const toggleInfernalSmite = useCallback(() => {
    if (!smiteEquipped) return;
    setLoadout((prev) => ({ ...prev, infernalSmite: !prev.infernalSmite }));
  }, [smiteEquipped]);

  const toggleStaggeringCombo = useCallback(() => {
    setLoadout((prev) => ({ ...prev, staggeringCombo: !prev.staggeringCombo }));
  }, []);

  const toggleStaggeringSwipes = useCallback(() => {
    setLoadout((prev) => ({ ...prev, staggeringSwipes: !prev.staggeringSwipes }));
  }, []);

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
              {loadout.wrathStrike && (
                <>
                  <p className="text-gray-400 text-sm mt-1">{wrathStrikeTalentDefinition.description}</p>
                  <p className="text-amber-200/90 text-xs mt-2 font-mono">+20% crit chance · +50% crit damage on Wraith Strike</p>
                </>
              )}
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
              {loadout.infestedStrike && (
                <>
                  <p className="text-gray-400 text-sm mt-1">{infestedStrikeTalentDefinition.description}</p>
                  <p className="text-emerald-200/90 text-xs mt-2 font-mono">190 damage · green VFX · zombies on kill (max 3)</p>
                </>
              )}
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
              {loadout.staggeringStrike && (
                <>
                  <p className="text-gray-400 text-sm mt-1">{staggeringStrikeTalentDefinition.description}</p>
                  <p className="text-sky-200/90 text-xs mt-2 font-mono">+40 stagger · 100 = lightning + 125 dmg + 3s stun</p>
                </>
              )}
            </label>
          </div>
        </div>

        {selectedWeapon === WeaponType.RUNEBLADE && (
          <>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="talent-staggering-combo"
                  checked={loadout.staggeringCombo}
                  onChange={toggleStaggeringCombo}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-staggering-combo" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{staggeringComboTalentDefinition.name}</div>
                  {loadout.staggeringCombo && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{staggeringComboTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">30 + 30 + 40 stagger per combo · 100 = lightning + proc</p>
                    </>
                  )}
                </label>
              </div>
            </div>
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
                  {loadout.storedCharge && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{storedChargeTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">3 full spins · Charge damage per rotation</p>
                    </>
                  )}
                </label>
              </div>
              {!chargeEquipped && (
                <p className="text-gray-500 text-xs mt-3 pl-7">
                  Equip <span className="text-gray-300">Charge</span> in your ability loadout at the other east pillar to enable this talent.
                </p>
              )}
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${smiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="talent-trinity"
                  checked={loadout.trinity}
                  onChange={toggleTrinity}
                  disabled={!smiteEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-trinity" className={`flex-1 ${smiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{trinityTalentDefinition.name}</div>
                  {loadout.trinity && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{trinityTalentDefinition.description}</p>
                      <p className="text-amber-200/90 text-xs mt-2 font-mono">Up to 2 dash charges · up to 2 bonus strikes at 165 each</p>
                    </>
                  )}
                </label>
              </div>
              {!smiteEquipped && (
                <p className="text-gray-500 text-xs mt-3 pl-7">
                  Equip <span className="text-gray-300">Colossus Strike</span> (Runeblade R) in your ability loadout at the other east pillar to enable this talent.
                </p>
              )}
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${smiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="talent-infested-smite"
                  checked={loadout.infestedSmite}
                  onChange={toggleInfestedSmite}
                  disabled={!smiteEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-infested-smite" className={`flex-1 ${smiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{infestedSmiteTalentDefinition.name}</div>
                  {loadout.infestedSmite && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{infestedSmiteTalentDefinition.description}</p>
                      <p className="text-emerald-200/90 text-xs mt-2 font-mono">Green bolts · 5 heal per hit per beam · Smite kills spawn zombies (max 3)</p>
                    </>
                  )}
                </label>
              </div>
              {!smiteEquipped && (
                <p className="text-gray-500 text-xs mt-3 pl-7">
                  Equip <span className="text-gray-300">Colossus Strike</span> (Runeblade R) in your ability loadout at the other east pillar to enable this talent.
                </p>
              )}
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${smiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="talent-staggering-smite"
                  checked={loadout.staggeringSmite}
                  onChange={toggleStaggeringSmite}
                  disabled={!smiteEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-staggering-smite" className={`flex-1 ${smiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{staggeringSmiteTalentDefinition.name}</div>
                  {loadout.staggeringSmite && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{staggeringSmiteTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        Blue bolts · {STAGGERING_SMITE_BEAM_STAGGER} stagger per enemy per beam · same 100 cap / proc as other stagger talents
                      </p>
                    </>
                  )}
                </label>
              </div>
              {!smiteEquipped && (
                <p className="text-gray-500 text-xs mt-3 pl-7">
                  Equip <span className="text-gray-300">Colossus Strike</span> (Runeblade R) in your ability loadout at the other east pillar to enable this talent.
                </p>
              )}
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${smiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="talent-infernal-smite"
                  checked={loadout.infernalSmite}
                  onChange={toggleInfernalSmite}
                  disabled={!smiteEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-infernal-smite" className={`flex-1 ${smiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{infernalSmiteTalentDefinition.name}</div>
                  {loadout.infernalSmite && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{infernalSmiteTalentDefinition.description}</p>
                      <p className="text-orange-200/90 text-xs mt-2 font-mono">
                        Fiery bolts · +{INFERNAL_SMITE_CRIT_CHANCE_ADD * 100}% Smite crit chance · Ignite:{' '}
                        {INFERNAL_SMITE_DOT_FRACTION * 100}% of beam hit damage over {INFERNAL_SMITE_DURATION_MS / 1000}s ({INFERNAL_SMITE_TICKS}{' '}
                        ticks)
                      </p>
                    </>
                  )}
                </label>
              </div>
              {!smiteEquipped && (
                <p className="text-gray-500 text-xs mt-3 pl-7">
                  Equip <span className="text-gray-300">Colossus Strike</span> (Runeblade R) in your ability loadout at the other east pillar to enable this talent.
                </p>
              )}
            </div>
          </>
        )}

        {selectedWeapon === WeaponType.SABRES && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="talent-staggering-swipes"
                checked={loadout.staggeringSwipes}
                onChange={toggleStaggeringSwipes}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-staggering-swipes" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{staggeringSwipesTalentDefinition.name}</div>
                {loadout.staggeringSwipes && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{staggeringSwipesTalentDefinition.description}</p>
                    <p className="text-sky-200/90 text-xs mt-2 font-mono">7 + 8 stagger per swing · 100 = lightning + proc</p>
                  </>
                )}
              </label>
            </div>
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
                {loadout.wrathfulTalons && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{wrathfulTalonsTalentDefinition.description}</p>
                    <p className="text-green-200/90 text-xs mt-2 font-mono">+40% crit chance · +100% crit damage on return arrow hit</p>
                  </>
                )}
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
