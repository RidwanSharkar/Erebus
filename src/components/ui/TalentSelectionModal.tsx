'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import type { AbilityLoadout } from '@/utils/weaponAbilities';
import type { TalentId, TalentLoadout } from '@/utils/talents';
import {
  createDefaultTalentLoadout,
  infestedSmiteTalentDefinition,
  infernalSmiteTalentDefinition,
  vengeanceSmiteTalentDefinition,
  VENGEANCE_SMITE_MAX_EXTRA_DAMAGE_MULT,
  infestedStrikeTalentDefinition,
  staggeringSmiteTalentDefinition,
  INFERNAL_SMITE_CRIT_CHANCE_ADD,
  INFERNAL_SMITE_DOT_FRACTION,
  INFERNAL_SMITE_DURATION_MS,
  INFERNAL_SMITE_TICKS,
  infernoTalentDefinition,
  reaperTalentDefinition,
  crossentropyTempestTalentDefinition,
  crossentropyPlagueTalentDefinition,
  CROSSENTROPY_TEMPEST_STAGGER,
  CROSSENTROPY_PLAGUE_DAMAGE,
  frostPathTalentDefinition,
  FROSTPATH_PROC_CHANCE,
  FROST_SOLAR_PROC_EFFECT_ICD_MS,
  solarRechargeTalentDefinition,
  SOLAR_RECHARGE_PROC_CHANCE,
  windFuryTalentDefinition,
  WINDFURY_PROC_CHANCE,
  isCrossentropyInLoadout,
  isMantraInLoadout,
  concentratedVolleyTalentDefinition,
  WRATHFUL_BITE_BARRAGE_CRIT_CHANCE_ADD,
  WRATHFUL_BITE_BARRAGE_CRIT_DAMAGE_MULT_ADD,
  wrathfulBiteTalentDefinition,
  wyvernBiteTalentDefinition,
  WYVERN_BITE_CONCENTRATED_VENOM_DPS_PER_STACK,
  WYVERN_BITE_CONCENTRATED_VENOM_MAX_STACKS,
  WYVERN_BITE_CONCENTRATED_VENOM_DURATION_SEC,
  isChargeInLoadout,
  isColossusSmiteInLoadout,
  isFrostBiteInLoadout,
  isReapingTalonsInLoadout,
  isWraithStrikeInLoadout,
  staggeringStrikeTalentDefinition,
  staggeringComboTalentDefinition,
  staggeringSwipesTalentDefinition,
  storedChargeTalentDefinition,
  bladeRushTalentDefinition,
  wrathfulComboTalentDefinition,
  infestedComboTalentDefinition,
  guardComboTalentDefinition,
  dashGuardTalentDefinition,
  executionerTalentDefinition,
  GUARD_COMBO_PROC_CHANCE,
  GUARD_COMBO_DURATION_SEC,
  DASH_GUARD_DURATION_SEC,
  EXECUTIONER_POST_DASH_WINDOW_MS,
  EXECUTIONER_BASE_DAMAGE_ADD,
  crusaderTalentDefinition,
  CRUSADER_PROC_CHANCE,
  CRUSADER_DURATION_SEC,
  CRUSADER_LMB_FLAT_BONUS,
  blizzardTalentDefinition,
  BLIZZARD_PROC_CHANCE,
  BLIZZARD_DURATION_SEC,
  BLIZZARD_DPS_PER_TICK,
  CHILL_STACK_DURATION_SEC,
  CHILL_SLOW_PER_STACK,
  CHILL_STACKS_TO_FREEZE,
  BLIZZARD_FREEZE_DURATION_SEC,
  WRATHFUL_COMBO_CRIT_CHANCE_ADD,
  WRATHFUL_COMBO_CRIT_DAMAGE_MULT_ADD,
  INFESTED_COMBO_LIFESTEAL,
  BLADE_RUSH_CHARGE_COOLDOWN_SEC,
  trinityTalentDefinition,
  colossusGuardTalentDefinition,
  COLOSSUS_GUARD_PROC_CHANCE,
  COLOSSUS_GUARD_STACK_SEC,
  COLOSSUS_GUARD_MAX_REMAINING_SEC,
  STAGGERING_SMITE_BEAM_STAGGER,
  STAGGER_SHOT_CHARGED_STAGGER,
  STAGGER_SHOT_PERFECT_STAGGER,
  STAGGER_SHOT_TEMPEST_ROUND_STAGGER,
  STAGGER_SHOT_UNCHARGED_STAGGER,
  staggerShotTalentDefinition,
  staggeringBiteTalentDefinition,
  staggeringTalonsTalentDefinition,
  STAGGERING_BITE_BARRAGE_STAGGER_PER_HIT,
  STAGGERING_TALONS_HIT_STAGGER,
  wrathfulShotsTalentDefinition,
  WRATHFUL_SHOTS_PERFECT_CRIT_CHANCE_ADD,
  WRATHFUL_SHOTS_PERFECT_CRIT_DAMAGE_MULT_ADD,
  dualCoilTalentDefinition,
  wyvernStingTalentDefinition,
  wyvernTalonsTalentDefinition,
  WYVERN_STING_COOLDOWN_SEC,
  wrathStrikeTalentDefinition,
  wraithGuardTalentDefinition,
  doubleStrikeTalentDefinition,
  spellbladeTalentDefinition,
  SPELLBLADE_INTELLECT_BONUS,
  SPELLBLADE_WRAITH_STRIKE_SHIELD_RESTORE,
  WRAITH_STRIKE_COOLDOWN_SEC,
  WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES,
  breathWeaponTalentDefinition,
  BREATH_WEAPON_DAMAGE,
  AFTERSHOCK_STRIP_LENGTH,
  AFTERSHOCK_STRIP_HALF_WIDTH,
  AFTERSHOCK_DETONATION_DELAY_MS,
  wrathfulTalonsTalentDefinition,
  executeTalentDefinition,
  explosiveTalonsTalentDefinition,
  EXPLOSIVE_TALONS_EXPLOSION_DAMAGE,
  EXPLOSIVE_TALONS_EXPLOSION_RADIUS,
  REAPING_TALONS_MAX_TRAVEL_DISTANCE,
  EXPLOSIVE_TALONS_REAPING_TALONS_MAX_TRAVEL_DISTANCE,
  tempestRoundsTalentDefinition,
  icebeamTalentDefinition,
  getTalentIconSrc,
  wrathfulEntropicTalentDefinition,
  staggeringEntropicTalentDefinition,
  infestingEntropicTalentDefinition,
  wrathfulTotemTalentDefinition,
  staggeringTotemTalentDefinition,
  infestingTotemTalentDefinition,
  staggeringStabTalentDefinition,
  wrathfulStabTalentDefinition,
  infestedBackstabTalentDefinition,
  wrathfulSabresSwipesTalentDefinition,
  infestingSabresSwipesTalentDefinition,
  staggeringFlourishTalentDefinition,
  wrathfulFlourishTalentDefinition,
  infestedFlourishTalentDefinition,
  STAGGERING_FLOURISH_STAGGER,
  WRATHFUL_FLOURISH_CRIT_CHANCE_ADD,
  WRATHFUL_FLOURISH_CRIT_DAMAGE_MULT_ADD,
  STAGGERING_STAB_BACKSTAB_STAGGER,
  WRATHFUL_STAB_CRIT_CHANCE_ADD,
  WRATHFUL_STAB_CRIT_DAMAGE_MULT_ADD,
  WRATHFUL_SABRES_SWIPES_CRIT_CHANCE_ADD,
  WRATHFUL_SABRES_SWIPES_CRIT_DAMAGE_MULT_ADD,
  INFESTING_SABRES_SWIPES_LEFT_DAMAGE,
  INFESTING_SABRES_SWIPES_RIGHT_DAMAGE,
  BACKSTAB_KILLSTREAK_DAMAGE_PER_KILL,
  RELENTLESS_BACKSTAB_KILL_HEAL,
  killstreakTalentDefinition,
  relentlessTalentDefinition,
} from '@/utils/talents';

interface TalentSelectionModalProps {
  selectedWeapon: WeaponType;
  abilityLoadout: AbilityLoadout | null;
  initialTalentLoadout?: TalentLoadout | null;
  onConfirm: (loadout: TalentLoadout) => void;
  onBack: () => void;
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

function TalentRowIcon({ id, dimmed }: { id: TalentId; dimmed?: boolean }) {
  const src = getTalentIconSrc(id);
  return (
    <div
      className={`mt-0.5 w-10 h-10 shrink-0 rounded border flex items-center justify-center ${
        dimmed ? 'border-gray-700 bg-gray-900/50 opacity-55' : 'border-gray-600/70 bg-gray-900/85'
      }`}
    >
      {src ? <img src={src} alt="" className="w-7 h-7 object-contain" /> : <span className="text-[15px] leading-none text-gray-500 select-none">✦</span>}
    </div>
  );
}

const WEAPON_COLORS: Record<WeaponType, { border: string; bg: string; text: string }> = {
  [WeaponType.NONE]: { border: 'border-violet-400', bg: 'bg-violet-900/30', text: 'text-violet-200' },
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
    wraithGuard: initialTalentLoadout?.wraithGuard ?? def.wraithGuard,
    staggeringStrike: initialTalentLoadout?.staggeringStrike ?? def.staggeringStrike,
    staggeringCombo: initialTalentLoadout?.staggeringCombo ?? def.staggeringCombo,
    staggeringSwipes: initialTalentLoadout?.staggeringSwipes ?? def.staggeringSwipes,
    wrathfulTalons: initialTalentLoadout?.wrathfulTalons ?? def.wrathfulTalons,
    execute: initialTalentLoadout?.execute ?? def.execute,
    explosiveTalons: initialTalentLoadout?.explosiveTalons ?? def.explosiveTalons,
    storedCharge: initialTalentLoadout?.storedCharge ?? def.storedCharge,
    trinity: initialTalentLoadout?.trinity ?? def.trinity,
    infestedSmite: initialTalentLoadout?.infestedSmite ?? def.infestedSmite,
    staggeringSmite: initialTalentLoadout?.staggeringSmite ?? def.staggeringSmite,
    infernalSmite: initialTalentLoadout?.infernalSmite ?? def.infernalSmite,
    vengeanceSmite: initialTalentLoadout?.vengeanceSmite ?? def.vengeanceSmite,
    colossusGuard: initialTalentLoadout?.colossusGuard ?? def.colossusGuard,
    staggerShot: initialTalentLoadout?.staggerShot ?? def.staggerShot,
    concentratedVolley: initialTalentLoadout?.concentratedVolley ?? def.concentratedVolley,
    wrathfulBite: initialTalentLoadout?.wrathfulBite ?? def.wrathfulBite,
    wyvernBite: initialTalentLoadout?.wyvernBite ?? def.wyvernBite,
    inferno: initialTalentLoadout?.inferno ?? def.inferno,
    reaper: initialTalentLoadout?.reaper ?? def.reaper,
    frostPath: initialTalentLoadout?.frostPath ?? def.frostPath,
    solarRecharge: initialTalentLoadout?.solarRecharge ?? def.solarRecharge,
    windFury: initialTalentLoadout?.windFury ?? def.windFury,
    dualCoil: initialTalentLoadout?.dualCoil ?? def.dualCoil,
    wyvernSting: initialTalentLoadout?.wyvernSting ?? def.wyvernSting,
    wyvernTalons: initialTalentLoadout?.wyvernTalons ?? def.wyvernTalons,
    bladeRush: initialTalentLoadout?.bladeRush ?? def.bladeRush,
    wrathfulCombo: initialTalentLoadout?.wrathfulCombo ?? def.wrathfulCombo,
    infestedCombo: initialTalentLoadout?.infestedCombo ?? def.infestedCombo,
    guardCombo: initialTalentLoadout?.guardCombo ?? def.guardCombo,
    dashGuard: initialTalentLoadout?.dashGuard ?? def.dashGuard,
    executioner: initialTalentLoadout?.executioner ?? def.executioner,
    crusader: initialTalentLoadout?.crusader ?? def.crusader,
    blizzard: initialTalentLoadout?.blizzard ?? def.blizzard,
    doubleStrike: initialTalentLoadout?.doubleStrike ?? def.doubleStrike,
    spellblade: initialTalentLoadout?.spellblade ?? def.spellblade,
    tempestRounds: initialTalentLoadout?.tempestRounds ?? def.tempestRounds,
    icebeam: initialTalentLoadout?.icebeam ?? def.icebeam,
    breathWeapon: initialTalentLoadout?.breathWeapon ?? def.breathWeapon,
    staggeringBite: initialTalentLoadout?.staggeringBite ?? def.staggeringBite,
    staggeringTalons: initialTalentLoadout?.staggeringTalons ?? def.staggeringTalons,
    wrathfulShots: initialTalentLoadout?.wrathfulShots ?? def.wrathfulShots,
    wrathfulEntropic: initialTalentLoadout?.wrathfulEntropic ?? def.wrathfulEntropic,
    staggeringEntropic: initialTalentLoadout?.staggeringEntropic ?? def.staggeringEntropic,
    infestingEntropic: initialTalentLoadout?.infestingEntropic ?? def.infestingEntropic,
    wrathfulTotem: initialTalentLoadout?.wrathfulTotem ?? def.wrathfulTotem,
    staggeringTotem: initialTalentLoadout?.staggeringTotem ?? def.staggeringTotem,
    infestingTotem: initialTalentLoadout?.infestingTotem ?? def.infestingTotem,
    crossentropyTempest: initialTalentLoadout?.crossentropyTempest ?? def.crossentropyTempest,
    crossentropyPlague: initialTalentLoadout?.crossentropyPlague ?? def.crossentropyPlague,
    shaman: initialTalentLoadout?.shaman ?? def.shaman,
    staggeringStab: initialTalentLoadout?.staggeringStab ?? def.staggeringStab,
    wrathfulStab: initialTalentLoadout?.wrathfulStab ?? def.wrathfulStab,
    infestedBackstab: initialTalentLoadout?.infestedBackstab ?? def.infestedBackstab,
    wrathfulSabresSwipes: initialTalentLoadout?.wrathfulSabresSwipes ?? def.wrathfulSabresSwipes,
    infestingSabresSwipes: initialTalentLoadout?.infestingSabresSwipes ?? def.infestingSabresSwipes,
    staggeringFlourish: initialTalentLoadout?.staggeringFlourish ?? def.staggeringFlourish,
    wrathfulFlourish: initialTalentLoadout?.wrathfulFlourish ?? def.wrathfulFlourish,
    infestedFlourish: initialTalentLoadout?.infestedFlourish ?? def.infestedFlourish,
    killstreak: initialTalentLoadout?.killstreak ?? def.killstreak,
    relentless: initialTalentLoadout?.relentless ?? def.relentless,
  };
  const [loadout, setLoadout] = useState<TalentLoadout>(() => merged);

  const wraithEquipped = useMemo(() => isWraithStrikeInLoadout(abilityLoadout), [abilityLoadout]);
  const reapingEquipped = useMemo(() => isReapingTalonsInLoadout(abilityLoadout), [abilityLoadout]);
  const frostbiteEquipped = useMemo(() => isFrostBiteInLoadout(abilityLoadout), [abilityLoadout]);
  const chargeEquipped = useMemo(() => isChargeInLoadout(abilityLoadout), [abilityLoadout]);
  const smiteEquipped = useMemo(() => isColossusSmiteInLoadout(abilityLoadout), [abilityLoadout]);
  const crossentropyEquipped = useMemo(() => isCrossentropyInLoadout(abilityLoadout), [abilityLoadout]);
  const mantraEquipped = useMemo(() => isMantraInLoadout(abilityLoadout), [abilityLoadout]);
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

  const toggleWraithGuard = useCallback(() => {
    if (!wraithEquipped) return;
    setLoadout((prev) => ({ ...prev, wraithGuard: !prev.wraithGuard }));
  }, [wraithEquipped]);

  const toggleDoubleStrike = useCallback(() => {
    if (!wraithEquipped) return;
    setLoadout((prev) => ({ ...prev, doubleStrike: !prev.doubleStrike }));
  }, [wraithEquipped]);

  const toggleSpellblade = useCallback(() => {
    if (!wraithEquipped) return;
    setLoadout((prev) => ({ ...prev, spellblade: !prev.spellblade }));
  }, [wraithEquipped]);

  const toggleBreathWeapon = useCallback(() => {
    if (!wraithEquipped) return;
    setLoadout((prev) => ({ ...prev, breathWeapon: !prev.breathWeapon }));
  }, [wraithEquipped]);

  const toggleWrathfulTalons = useCallback(() => {
    if (!reapingEquipped) return;
    setLoadout((prev) => ({ ...prev, wrathfulTalons: !prev.wrathfulTalons }));
  }, [reapingEquipped]);

  const toggleExecute = useCallback(() => {
    if (!reapingEquipped) return;
    setLoadout((prev) => ({ ...prev, execute: !prev.execute }));
  }, [reapingEquipped]);

  const toggleExplosiveTalons = useCallback(() => {
    if (!reapingEquipped) return;
    setLoadout((prev) => ({ ...prev, explosiveTalons: !prev.explosiveTalons }));
  }, [reapingEquipped]);

  const toggleWyvernTalons = useCallback(() => {
    if (!reapingEquipped) return;
    setLoadout((prev) => ({ ...prev, wyvernTalons: !prev.wyvernTalons }));
  }, [reapingEquipped]);

  const toggleStaggeringTalons = useCallback(() => {
    if (!reapingEquipped) return;
    setLoadout((prev) => ({ ...prev, staggeringTalons: !prev.staggeringTalons }));
  }, [reapingEquipped]);

  const toggleStoredCharge = useCallback(() => {
    setLoadout((prev) => {
      if (!chargeEquipped && !prev.bladeRush) return prev;
      return { ...prev, storedCharge: !prev.storedCharge };
    });
  }, [chargeEquipped]);

  const toggleBladeRush = useCallback(() => {
    setLoadout((prev) => ({ ...prev, bladeRush: !prev.bladeRush }));
  }, []);

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

  const toggleVengeanceSmite = useCallback(() => {
    if (!smiteEquipped) return;
    setLoadout((prev) => ({ ...prev, vengeanceSmite: !prev.vengeanceSmite }));
  }, [smiteEquipped]);

  const toggleColossusGuard = useCallback(() => {
    if (!smiteEquipped) return;
    setLoadout((prev) => ({ ...prev, colossusGuard: !prev.colossusGuard }));
  }, [smiteEquipped]);

  const toggleStaggeringCombo = useCallback(() => {
    setLoadout((prev) => ({ ...prev, staggeringCombo: !prev.staggeringCombo }));
  }, []);

  const toggleWrathfulCombo = useCallback(() => {
    setLoadout((prev) => ({ ...prev, wrathfulCombo: !prev.wrathfulCombo }));
  }, []);

  const toggleInfestedCombo = useCallback(() => {
    setLoadout((prev) => ({ ...prev, infestedCombo: !prev.infestedCombo }));
  }, []);

  const toggleGuardCombo = useCallback(() => {
    setLoadout((prev) => ({ ...prev, guardCombo: !prev.guardCombo }));
  }, []);

  const toggleDashGuard = useCallback(() => {
    setLoadout((prev) => ({ ...prev, dashGuard: !prev.dashGuard }));
  }, []);

  const toggleExecutioner = useCallback(() => {
    setLoadout((prev) => ({ ...prev, executioner: !prev.executioner }));
  }, []);

  const toggleCrusader = useCallback(() => {
    setLoadout((prev) => ({ ...prev, crusader: !prev.crusader }));
  }, []);

  const toggleBlizzard = useCallback(() => {
    setLoadout((prev) => ({ ...prev, blizzard: !prev.blizzard }));
  }, []);

  const toggleStaggeringSwipes = useCallback(() => {
    setLoadout((prev) => ({ ...prev, staggeringSwipes: !prev.staggeringSwipes }));
  }, []);

  const toggleStaggeringStab = useCallback(() => {
    setLoadout((prev) => ({ ...prev, staggeringStab: !prev.staggeringStab }));
  }, []);

  const toggleWrathfulStab = useCallback(() => {
    setLoadout((prev) => ({ ...prev, wrathfulStab: !prev.wrathfulStab }));
  }, []);

  const toggleInfestedBackstab = useCallback(() => {
    setLoadout((prev) => ({ ...prev, infestedBackstab: !prev.infestedBackstab }));
  }, []);

  const toggleWrathfulSabresSwipes = useCallback(() => {
    setLoadout((prev) => ({ ...prev, wrathfulSabresSwipes: !prev.wrathfulSabresSwipes }));
  }, []);

  const toggleInfestingSabresSwipes = useCallback(() => {
    setLoadout((prev) => ({ ...prev, infestingSabresSwipes: !prev.infestingSabresSwipes }));
  }, []);

  const toggleStaggeringFlourish = useCallback(() => {
    setLoadout((prev) => ({ ...prev, staggeringFlourish: !prev.staggeringFlourish }));
  }, []);

  const toggleWrathfulFlourish = useCallback(() => {
    setLoadout((prev) => ({ ...prev, wrathfulFlourish: !prev.wrathfulFlourish }));
  }, []);

  const toggleInfestedFlourish = useCallback(() => {
    setLoadout((prev) => ({ ...prev, infestedFlourish: !prev.infestedFlourish }));
  }, []);

  const toggleKillstreak = useCallback(() => {
    setLoadout((prev) => ({ ...prev, killstreak: !prev.killstreak }));
  }, []);

  const toggleRelentless = useCallback(() => {
    setLoadout((prev) => ({ ...prev, relentless: !prev.relentless }));
  }, []);

  const toggleStaggerShot = useCallback(() => {
    setLoadout((prev) => ({ ...prev, staggerShot: !prev.staggerShot }));
  }, []);

  const toggleWrathfulShots = useCallback(() => {
    setLoadout((prev) => ({ ...prev, wrathfulShots: !prev.wrathfulShots }));
  }, []);

  const toggleDualCoil = useCallback(() => {
    setLoadout((prev) => ({ ...prev, dualCoil: !prev.dualCoil }));
  }, []);

  const toggleWyvernSting = useCallback(() => {
    setLoadout((prev) => ({ ...prev, wyvernSting: !prev.wyvernSting }));
  }, []);

  const toggleConcentratedVolley = useCallback(() => {
    if (!frostbiteEquipped) return;
    setLoadout((prev) => ({ ...prev, concentratedVolley: !prev.concentratedVolley }));
  }, [frostbiteEquipped]);

  const toggleWrathfulBite = useCallback(() => {
    if (!frostbiteEquipped) return;
    setLoadout((prev) => ({ ...prev, wrathfulBite: !prev.wrathfulBite }));
  }, [frostbiteEquipped]);

  const toggleStaggeringBite = useCallback(() => {
    if (!frostbiteEquipped) return;
    setLoadout((prev) => ({ ...prev, staggeringBite: !prev.staggeringBite }));
  }, [frostbiteEquipped]);

  const toggleWyvernBite = useCallback(() => {
    if (!frostbiteEquipped) return;
    setLoadout((prev) => ({ ...prev, wyvernBite: !prev.wyvernBite }));
  }, [frostbiteEquipped]);

  const toggleInferno = useCallback(() => {
    if (!crossentropyEquipped) return;
    setLoadout((prev) => ({ ...prev, inferno: !prev.inferno }));
  }, [crossentropyEquipped]);

  const toggleReaper = useCallback(() => {
    if (!crossentropyEquipped) return;
    setLoadout((prev) => ({ ...prev, reaper: !prev.reaper }));
  }, [crossentropyEquipped]);

  const toggleCrossentropyTempest = useCallback(() => {
    if (!crossentropyEquipped) return;
    setLoadout((prev) => {
      const on = !prev.crossentropyTempest;
      if (!on) return { ...prev, crossentropyTempest: false };
      return { ...prev, crossentropyTempest: true, crossentropyPlague: false };
    });
  }, [crossentropyEquipped]);

  const toggleCrossentropyPlague = useCallback(() => {
    if (!crossentropyEquipped) return;
    setLoadout((prev) => {
      const on = !prev.crossentropyPlague;
      if (!on) return { ...prev, crossentropyPlague: false };
      return { ...prev, crossentropyPlague: true, crossentropyTempest: false };
    });
  }, [crossentropyEquipped]);

  const toggleFrostPath = useCallback(() => {
    setLoadout((prev) => ({ ...prev, frostPath: !prev.frostPath }));
  }, []);

  const toggleSolarRecharge = useCallback(() => {
    setLoadout((prev) => ({ ...prev, solarRecharge: !prev.solarRecharge }));
  }, []);

  const toggleWindFury = useCallback(() => {
    setLoadout((prev) => ({ ...prev, windFury: !prev.windFury }));
  }, []);

  const toggleTempestRounds = useCallback(() => {
    setLoadout((prev) => ({ ...prev, tempestRounds: !prev.tempestRounds }));
  }, []);

  const toggleIcebeam = useCallback(() => {
    setLoadout((prev) => ({ ...prev, icebeam: !prev.icebeam }));
  }, []);

  const toggleWrathfulEntropic = useCallback(() => {
    setLoadout((prev) => {
      const on = !prev.wrathfulEntropic;
      if (!on) return { ...prev, wrathfulEntropic: false };
      return {
        ...prev,
        wrathfulEntropic: true,
        staggeringEntropic: false,
        infestingEntropic: false,
      };
    });
  }, []);

  const toggleStaggeringEntropic = useCallback(() => {
    setLoadout((prev) => {
      const on = !prev.staggeringEntropic;
      if (!on) return { ...prev, staggeringEntropic: false };
      return {
        ...prev,
        staggeringEntropic: true,
        wrathfulEntropic: false,
        infestingEntropic: false,
      };
    });
  }, []);

  const toggleInfestingEntropic = useCallback(() => {
    setLoadout((prev) => {
      const on = !prev.infestingEntropic;
      if (!on) return { ...prev, infestingEntropic: false };
      return {
        ...prev,
        infestingEntropic: true,
        wrathfulEntropic: false,
        staggeringEntropic: false,
      };
    });
  }, []);

  const toggleWrathfulTotem = useCallback(() => {
    if (!mantraEquipped) return;
    setLoadout((prev) => {
      const on = !prev.wrathfulTotem;
      if (!on) return { ...prev, wrathfulTotem: false };
      return {
        ...prev,
        wrathfulTotem: true,
        staggeringTotem: false,
        infestingTotem: false,
      };
    });
  }, [mantraEquipped]);

  const toggleStaggeringTotem = useCallback(() => {
    if (!mantraEquipped) return;
    setLoadout((prev) => {
      const on = !prev.staggeringTotem;
      if (!on) return { ...prev, staggeringTotem: false };
      return {
        ...prev,
        staggeringTotem: true,
        wrathfulTotem: false,
        infestingTotem: false,
      };
    });
  }, [mantraEquipped]);

  const toggleInfestingTotem = useCallback(() => {
    if (!mantraEquipped) return;
    setLoadout((prev) => {
      const on = !prev.infestingTotem;
      if (!on) return { ...prev, infestingTotem: false };
      return {
        ...prev,
        infestingTotem: true,
        wrathfulTotem: false,
        staggeringTotem: false,
      };
    });
  }, [mantraEquipped]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black/80 p-4">
      <div className="flex max-h-[min(90vh,calc(100vh-2rem))] min-h-0 w-full max-w-lg flex-col rounded-xl border-2 border-amber-500 bg-gray-900/98 p-6 shadow-xl">
        <div className="mb-5 shrink-0 text-center">
          <h2 className="text-xl font-bold text-amber-400 mb-1">TALENTS</h2>
          <p className="text-gray-400 text-sm">
            Talents modify your equipped abilities. Current weapon:{' '}
            <span className={`font-semibold ${wc.text}`}>{WEAPON_LABELS[selectedWeapon]}</span>.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-2">
        <div
          className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wraithEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
        >
          <div className="flex items-start gap-3">
            <TalentRowIcon id={wrathStrikeTalentDefinition.id} dimmed={!wraithEquipped} />
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
            <TalentRowIcon id={infestedStrikeTalentDefinition.id} dimmed={!wraithEquipped} />
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
            <TalentRowIcon id={staggeringStrikeTalentDefinition.id} dimmed={!wraithEquipped} />
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

        <div
          className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wraithEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
        >
          <div className="flex items-start gap-3">
            <TalentRowIcon id={wraithGuardTalentDefinition.id} dimmed={!wraithEquipped} />
            <input
              type="checkbox"
              id="talent-wraith-guard"
              checked={loadout.wraithGuard}
              onChange={toggleWraithGuard}
              disabled={!wraithEquipped}
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="talent-wraith-guard" className={`flex-1 ${wraithEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <div className="text-white font-semibold">{wraithGuardTalentDefinition.name}</div>
              {loadout.wraithGuard && (
                <>
                  <p className="text-gray-400 text-sm mt-1">{wraithGuardTalentDefinition.description}</p>
                  <p className="text-amber-200/90 text-xs mt-2 font-mono">33% per enemy hit · 2s deflect + invuln · no Aegis cooldown</p>
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
            <TalentRowIcon id={doubleStrikeTalentDefinition.id} dimmed={!wraithEquipped} />
            <input
              type="checkbox"
              id="talent-double-strike"
              checked={loadout.doubleStrike}
              onChange={toggleDoubleStrike}
              disabled={!wraithEquipped}
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="talent-double-strike" className={`flex-1 ${wraithEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <div className="text-white font-semibold">{doubleStrikeTalentDefinition.name}</div>
              {loadout.doubleStrike && (
                <>
                  <p className="text-gray-400 text-sm mt-1">{doubleStrikeTalentDefinition.description}</p>
                  <p className="text-amber-200/90 text-xs mt-2 font-mono">
                    {WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES} charges · {WRAITH_STRIKE_COOLDOWN_SEC}s per charge · one recharge at a time
                  </p>
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
            <TalentRowIcon id={spellbladeTalentDefinition.id} dimmed={!wraithEquipped} />
            <input
              type="checkbox"
              id="talent-spellblade"
              checked={loadout.spellblade}
              onChange={toggleSpellblade}
              disabled={!wraithEquipped}
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="talent-spellblade" className={`flex-1 ${wraithEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <div className="text-white font-semibold">{spellbladeTalentDefinition.name}</div>
              {loadout.spellblade && (
                <>
                  <p className="text-gray-400 text-sm mt-1">{spellbladeTalentDefinition.description}</p>
                  <p className="text-amber-200/90 text-xs mt-2 font-mono">
                    +{SPELLBLADE_INTELLECT_BONUS} intellect (+{SPELLBLADE_INTELLECT_BONUS * 2} max shield) · +{SPELLBLADE_WRAITH_STRIKE_SHIELD_RESTORE} shield per Wraith Strike
                  </p>
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
            <TalentRowIcon id={breathWeaponTalentDefinition.id} dimmed={!wraithEquipped} />
            <input
              type="checkbox"
              id="talent-aftershock"
              checked={loadout.breathWeapon}
              onChange={toggleBreathWeapon}
              disabled={!wraithEquipped}
              className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
            />
            <label htmlFor="talent-aftershock" className={`flex-1 ${wraithEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <div className="text-white font-semibold">{breathWeaponTalentDefinition.name}</div>
              {loadout.breathWeapon && (
                <>
                  <p className="text-gray-400 text-sm mt-1">{breathWeaponTalentDefinition.description}</p>
                  <p className="text-emerald-200/90 text-xs mt-2 font-mono">
                    +{BREATH_WEAPON_DAMAGE} damage after {AFTERSHOCK_DETONATION_DELAY_MS / 1000}s · {AFTERSHOCK_STRIP_LENGTH}u × {AFTERSHOCK_STRIP_HALF_WIDTH * 2}u strip · flame pillar detonation VFX
                  </p>
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
                <TalentRowIcon id={staggeringComboTalentDefinition.id} />
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
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={wrathfulComboTalentDefinition.id} />
                <input
                  type="checkbox"
                  id="talent-wrathful-combo"
                  checked={loadout.wrathfulCombo}
                  onChange={toggleWrathfulCombo}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-wrathful-combo" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{wrathfulComboTalentDefinition.name}</div>
                  {loadout.wrathfulCombo && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{wrathfulComboTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        3rd hit only · +{Math.round(WRATHFUL_COMBO_CRIT_CHANCE_ADD * 100)}% crit chance · +
                        {Math.round(WRATHFUL_COMBO_CRIT_DAMAGE_MULT_ADD * 100)}% crit damage
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={infestedComboTalentDefinition.id} />
                <input
                  type="checkbox"
                  id="talent-infested-combo"
                  checked={loadout.infestedCombo}
                  onChange={toggleInfestedCombo}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-infested-combo" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{infestedComboTalentDefinition.name}</div>
                  {loadout.infestedCombo && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{infestedComboTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        {Math.round(INFESTED_COMBO_LIFESTEAL * 100)}% lifesteal per hit · zombie on kill (same as Infested Smite)
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={blizzardTalentDefinition.id} />
                <input
                  type="checkbox"
                  id="talent-blizzard"
                  checked={loadout.blizzard}
                  onChange={toggleBlizzard}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-blizzard" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{blizzardTalentDefinition.name}</div>
                  {loadout.blizzard && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{blizzardTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        {BLIZZARD_PROC_CHANCE * 100}% per Runeblade combo hit (enemy damaged) · {BLIZZARD_DURATION_SEC}s
                        storm · {BLIZZARD_DPS_PER_TICK} DPS in radius · Chill {CHILL_SLOW_PER_STACK * 100}% slow per stack (
                        {CHILL_STACK_DURATION_SEC}s refresh) · {CHILL_STACKS_TO_FREEZE} stacks →{' '}
                        {BLIZZARD_FREEZE_DURATION_SEC}s freeze
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={guardComboTalentDefinition.id} />
                <input
                  type="checkbox"
                  id="talent-guard-combo"
                  checked={loadout.guardCombo}
                  onChange={toggleGuardCombo}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-guard-combo" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{guardComboTalentDefinition.name}</div>
                  {loadout.guardCombo && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{guardComboTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        {Math.round(GUARD_COMBO_PROC_CHANCE * 100)}% per enemy hit · {GUARD_COMBO_DURATION_SEC}s deflect + invuln · no Aegis cooldown
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={dashGuardTalentDefinition.id} />
                <input
                  type="checkbox"
                  id="talent-dash-guard"
                  checked={loadout.dashGuard}
                  onChange={toggleDashGuard}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-dash-guard" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{dashGuardTalentDefinition.name}</div>
                  {loadout.dashGuard && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{dashGuardTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        {DASH_GUARD_DURATION_SEC}s deflect + invuln on dash · no Aegis cooldown
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={executionerTalentDefinition.id} />
                <input
                  type="checkbox"
                  id="talent-executioner"
                  checked={loadout.executioner}
                  onChange={toggleExecutioner}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-executioner" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{executionerTalentDefinition.name}</div>
                  {loadout.executioner && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{executionerTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        Real dash only (not Blade Rush) · {EXECUTIONER_POST_DASH_WINDOW_MS / 1000}s window · 3rd-hit combo · +
                        {EXECUTIONER_BASE_DAMAGE_ADD} base before crit
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={crusaderTalentDefinition.id} />
                <input
                  type="checkbox"
                  id="talent-crusader"
                  checked={loadout.crusader}
                  onChange={toggleCrusader}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-crusader" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{crusaderTalentDefinition.name}</div>
                  {loadout.crusader && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{crusaderTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        {CRUSADER_PROC_CHANCE * 100}% per Runeblade combo hit (enemy damaged) · {CRUSADER_DURATION_SEC}s · +
                        {CRUSADER_LMB_FLAT_BONUS} base per swing · corrupted blade colors (F unchanged) · refresh on
                        proc
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${wc.border} ${wc.bg}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={bladeRushTalentDefinition.id} />
                <input
                  type="checkbox"
                  id="talent-blade-rush"
                  checked={loadout.bladeRush}
                  onChange={toggleBladeRush}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="talent-blade-rush" className="flex-1 cursor-pointer">
                  <div className="text-white font-semibold">{bladeRushTalentDefinition.name}</div>
                  {loadout.bladeRush && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{bladeRushTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">
                        Double-tap W · 1 dash charge · Charge path · {BLADE_RUSH_CHARGE_COOLDOWN_SEC}s between Blade Rush charges
                      </p>
                    </>
                  )}
                </label>
              </div>
            </div>
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${chargeEquipped || loadout.bladeRush ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={storedChargeTalentDefinition.id} dimmed={!(chargeEquipped || loadout.bladeRush)} />
                <input
                  type="checkbox"
                  id="talent-stored-charge"
                  checked={loadout.storedCharge}
                  onChange={toggleStoredCharge}
                  disabled={!chargeEquipped && !loadout.bladeRush}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label
                  htmlFor="talent-stored-charge"
                  className={`flex-1 ${chargeEquipped || loadout.bladeRush ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                >
                  <div className="text-white font-semibold">{storedChargeTalentDefinition.name}</div>
                  {loadout.storedCharge && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{storedChargeTalentDefinition.description}</p>
                      <p className="text-sky-200/90 text-xs mt-2 font-mono">3 full spins · Charge damage per rotation</p>
                    </>
                  )}
                </label>
              </div>
              {!chargeEquipped && !loadout.bladeRush && (
                <p className="text-gray-500 text-xs mt-3 pl-7">
                  Equip <span className="text-gray-300">Charge</span> in your ability loadout or enable <span className="text-gray-300">Blade Rush</span> to use this talent.
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
                <TalentRowIcon id={trinityTalentDefinition.id} dimmed={!smiteEquipped} />
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
                <TalentRowIcon id={infestedSmiteTalentDefinition.id} dimmed={!smiteEquipped} />
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
                <TalentRowIcon id={staggeringSmiteTalentDefinition.id} dimmed={!smiteEquipped} />
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
                <TalentRowIcon id={infernalSmiteTalentDefinition.id} dimmed={!smiteEquipped} />
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
            <div
              className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${smiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
            >
              <div className="flex items-start gap-3">
                <TalentRowIcon id={vengeanceSmiteTalentDefinition.id} dimmed={!smiteEquipped} />
                <input
                  type="checkbox"
                  id="talent-vengeance-smite"
                  checked={loadout.vengeanceSmite}
                  onChange={toggleVengeanceSmite}
                  disabled={!smiteEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-vengeance-smite" className={`flex-1 ${smiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{vengeanceSmiteTalentDefinition.name}</div>
                  {loadout.vengeanceSmite && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{vengeanceSmiteTalentDefinition.description}</p>
                      <p className="text-rose-200/90 text-xs mt-2 font-mono">
                        Up to +{VENGEANCE_SMITE_MAX_EXTRA_DAMAGE_MULT * 100}% damage at 0 HP · scales with missing health
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
                <TalentRowIcon id={colossusGuardTalentDefinition.id} dimmed={!smiteEquipped} />
                <input
                  type="checkbox"
                  id="talent-colossus-guard"
                  checked={loadout.colossusGuard}
                  onChange={toggleColossusGuard}
                  disabled={!smiteEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-colossus-guard" className={`flex-1 ${smiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{colossusGuardTalentDefinition.name}</div>
                  {loadout.colossusGuard && (
                    <>
                      <p className="text-gray-400 text-sm mt-1">{colossusGuardTalentDefinition.description}</p>
                      <p className="text-cyan-200/90 text-xs mt-2 font-mono">
                        {COLOSSUS_GUARD_PROC_CHANCE * 100}% per beam hit on enemies · +{COLOSSUS_GUARD_STACK_SEC}s per proc (max{' '}
                        {COLOSSUS_GUARD_MAX_REMAINING_SEC}s remaining) · no Aegis cooldown
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
            <div className="text-gray-400 text-xs font-semibold tracking-wide uppercase mb-3">Class boons</div>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={killstreakTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-killstreak"
                checked={loadout.killstreak}
                onChange={toggleKillstreak}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-killstreak" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{killstreakTalentDefinition.name}</div>
                {loadout.killstreak && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{killstreakTalentDefinition.description}</p>
                    <p className="text-rose-200/90 text-xs mt-2 font-mono">
                      +{BACKSTAB_KILLSTREAK_DAMAGE_PER_KILL} base Backstab damage per Backstab kill this run (positional hit)
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={relentlessTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-relentless"
                checked={loadout.relentless}
                onChange={toggleRelentless}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-relentless" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{relentlessTalentDefinition.name}</div>
                {loadout.relentless && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{relentlessTalentDefinition.description}</p>
                    <p className="text-emerald-200/90 text-xs mt-2 font-mono">
                      Full Backstab cooldown refresh · +{RELENTLESS_BACKSTAB_KILL_HEAL} HP on kill
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {selectedWeapon === WeaponType.SABRES && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="text-gray-400 text-xs font-semibold tracking-wide uppercase mb-3">Backstab (Q)</div>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={staggeringStabTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-staggering-stab"
                checked={loadout.staggeringStab}
                onChange={toggleStaggeringStab}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-staggering-stab" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{staggeringStabTalentDefinition.name}</div>
                {loadout.staggeringStab && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{staggeringStabTalentDefinition.description}</p>
                    <p className="text-sky-200/90 text-xs mt-2 font-mono">{STAGGERING_STAB_BACKSTAB_STAGGER} stagger on Backstab</p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={wrathfulStabTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-wrathful-stab"
                checked={loadout.wrathfulStab}
                onChange={toggleWrathfulStab}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-wrathful-stab" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{wrathfulStabTalentDefinition.name}</div>
                {loadout.wrathfulStab && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{wrathfulStabTalentDefinition.description}</p>
                    <p className="text-red-200/90 text-xs mt-2 font-mono">
                      +{(WRATHFUL_STAB_CRIT_CHANCE_ADD * 100).toFixed(0)}% crit chance · +{(WRATHFUL_STAB_CRIT_DAMAGE_MULT_ADD * 100).toFixed(0)}% crit damage mult
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={infestedBackstabTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-infested-backstab"
                checked={loadout.infestedBackstab}
                onChange={toggleInfestedBackstab}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-infested-backstab" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{infestedBackstabTalentDefinition.name}</div>
                {loadout.infestedBackstab && (
                  <p className="text-gray-400 text-sm mt-1">{infestedBackstabTalentDefinition.description}</p>
                )}
              </label>
            </div>

            <div className="text-gray-400 text-xs font-semibold tracking-wide uppercase mt-6 mb-3">Swipes (LMB)</div>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={staggeringSwipesTalentDefinition.id} />
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
                    <p className="text-sky-200/90 text-xs mt-2 font-mono">10 + 10 stagger per swing · 100 = lightning + proc</p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={wrathfulSabresSwipesTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-wrathful-sabres-swipes"
                checked={loadout.wrathfulSabresSwipes}
                onChange={toggleWrathfulSabresSwipes}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-wrathful-sabres-swipes" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{wrathfulSabresSwipesTalentDefinition.name}</div>
                {loadout.wrathfulSabresSwipes && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{wrathfulSabresSwipesTalentDefinition.description}</p>
                    <p className="text-red-200/90 text-xs mt-2 font-mono">
                      +{(WRATHFUL_SABRES_SWIPES_CRIT_CHANCE_ADD * 100).toFixed(0)}% crit chance · +{(WRATHFUL_SABRES_SWIPES_CRIT_DAMAGE_MULT_ADD * 100).toFixed(0)}% crit damage mult
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={infestingSabresSwipesTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-infesting-sabres-swipes"
                checked={loadout.infestingSabresSwipes}
                onChange={toggleInfestingSabresSwipes}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-infesting-sabres-swipes" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{infestingSabresSwipesTalentDefinition.name}</div>
                {loadout.infestingSabresSwipes && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{infestingSabresSwipesTalentDefinition.description}</p>
                    <p className="text-emerald-200/90 text-xs mt-2 font-mono">
                      {INFESTING_SABRES_SWIPES_LEFT_DAMAGE} / {INFESTING_SABRES_SWIPES_RIGHT_DAMAGE} base (non-stealth) · zombie on kill
                    </p>
                  </>
                )}
              </label>
            </div>

            <div className="text-gray-400 text-xs font-semibold tracking-wide uppercase mt-6 mb-3">Flourish (E)</div>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={staggeringFlourishTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-staggering-flourish"
                checked={loadout.staggeringFlourish}
                onChange={toggleStaggeringFlourish}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-staggering-flourish" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{staggeringFlourishTalentDefinition.name}</div>
                {loadout.staggeringFlourish && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{staggeringFlourishTalentDefinition.description}</p>
                    <p className="text-sky-200/90 text-xs mt-2 font-mono">{STAGGERING_FLOURISH_STAGGER} stagger on Flourish</p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={wrathfulFlourishTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-wrathful-flourish"
                checked={loadout.wrathfulFlourish}
                onChange={toggleWrathfulFlourish}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-wrathful-flourish" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{wrathfulFlourishTalentDefinition.name}</div>
                {loadout.wrathfulFlourish && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{wrathfulFlourishTalentDefinition.description}</p>
                    <p className="text-red-200/90 text-xs mt-2 font-mono">
                      +{(WRATHFUL_FLOURISH_CRIT_CHANCE_ADD * 100).toFixed(0)}% crit chance · +{(WRATHFUL_FLOURISH_CRIT_DAMAGE_MULT_ADD * 100).toFixed(0)}% crit damage mult
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={infestedFlourishTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-infested-flourish"
                checked={loadout.infestedFlourish}
                onChange={toggleInfestedFlourish}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-infested-flourish" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{infestedFlourishTalentDefinition.name}</div>
                {loadout.infestedFlourish && (
                  <p className="text-gray-400 text-sm mt-1">{infestedFlourishTalentDefinition.description}</p>
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
              <TalentRowIcon id={wrathfulTalonsTalentDefinition.id} dimmed={!reapingEquipped} />
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
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={executeTalentDefinition.id} dimmed={!reapingEquipped} />
              <input
                type="checkbox"
                id="talent-execute"
                checked={loadout.execute}
                onChange={toggleExecute}
                disabled={!reapingEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="talent-execute" className={`flex-1 ${reapingEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="text-white font-semibold">{executeTalentDefinition.name}</div>
                {loadout.execute && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{executeTalentDefinition.description}</p>
                    <p className="text-green-200/90 text-xs mt-2 font-mono">First forward hit · 1 dash charge → +200 damage</p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={explosiveTalonsTalentDefinition.id} dimmed={!reapingEquipped} />
              <input
                type="checkbox"
                id="talent-explosive-talons"
                checked={loadout.explosiveTalons}
                onChange={toggleExplosiveTalons}
                disabled={!reapingEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="talent-explosive-talons" className={`flex-1 ${reapingEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="text-white font-semibold">{explosiveTalonsTalentDefinition.name}</div>
                {loadout.explosiveTalons && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{explosiveTalonsTalentDefinition.description}</p>
                    <p className="text-green-200/90 text-xs mt-2 font-mono">
                      Forward {EXPLOSIVE_TALONS_REAPING_TALONS_MAX_TRAVEL_DISTANCE} (base {REAPING_TALONS_MAX_TRAVEL_DISTANCE}) · {EXPLOSIVE_TALONS_EXPLOSION_DAMAGE} dmg · radius {EXPLOSIVE_TALONS_EXPLOSION_RADIUS}
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={wyvernTalonsTalentDefinition.id} dimmed={!reapingEquipped} />
              <input
                type="checkbox"
                id="talent-wyvern-talons"
                checked={loadout.wyvernTalons}
                onChange={toggleWyvernTalons}
                disabled={!reapingEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="talent-wyvern-talons" className={`flex-1 ${reapingEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="text-white font-semibold">{wyvernTalonsTalentDefinition.name}</div>
                {loadout.wyvernTalons && (
                  <p className="text-gray-400 text-sm mt-1">{wyvernTalonsTalentDefinition.description}</p>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={staggeringTalonsTalentDefinition.id} dimmed={!reapingEquipped} />
              <input
                type="checkbox"
                id="talent-staggering-talons"
                checked={loadout.staggeringTalons}
                onChange={toggleStaggeringTalons}
                disabled={!reapingEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="talent-staggering-talons" className={`flex-1 ${reapingEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="text-white font-semibold">{staggeringTalonsTalentDefinition.name}</div>
                {loadout.staggeringTalons && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{staggeringTalonsTalentDefinition.description}</p>
                    <p className="text-amber-200/90 text-xs mt-2 font-mono">
                      {STAGGERING_TALONS_HIT_STAGGER} stagger forward/return per hit · 100 = lightning + proc
                    </p>
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

        {selectedWeapon === WeaponType.BOW && (
          <div
            className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${frostbiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
          >
            <div className="flex items-start gap-3">
              <TalentRowIcon id={concentratedVolleyTalentDefinition.id} dimmed={!frostbiteEquipped} />
              <input
                type="checkbox"
                id="talent-concentrated-volley"
                checked={loadout.concentratedVolley}
                onChange={toggleConcentratedVolley}
                disabled={!frostbiteEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="talent-concentrated-volley"
                className={`flex-1 ${frostbiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <div className="text-white font-semibold">{concentratedVolleyTalentDefinition.name}</div>
                {loadout.concentratedVolley && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{concentratedVolleyTalentDefinition.description}</p>
                    <p className="text-sky-200/90 text-xs mt-2 font-mono">Five Frostbite arrows · same forward direction</p>
                  </>
                )}
              </label>
            </div>
            {!frostbiteEquipped && (
              <p className="text-gray-500 text-xs mt-3 pl-7">
                Equip <span className="text-gray-300">Frostbite</span> in your ability loadout at the other east pillar to enable this talent.
              </p>
            )}
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div
            className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${frostbiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
          >
            <div className="flex items-start gap-3">
              <TalentRowIcon id={wrathfulBiteTalentDefinition.id} dimmed={!frostbiteEquipped} />
              <input
                type="checkbox"
                id="talent-wrathful-bite"
                checked={loadout.wrathfulBite}
                onChange={toggleWrathfulBite}
                disabled={!frostbiteEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="talent-wrathful-bite"
                className={`flex-1 ${frostbiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <div className="text-white font-semibold">{wrathfulBiteTalentDefinition.name}</div>
                {loadout.wrathfulBite && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{wrathfulBiteTalentDefinition.description}</p>
                    <p className="text-red-200/90 text-xs mt-2 font-mono">
                      +{WRATHFUL_BITE_BARRAGE_CRIT_CHANCE_ADD * 100}% crit chance · +{WRATHFUL_BITE_BARRAGE_CRIT_DAMAGE_MULT_ADD * 100}% crit damage · red Barrage
                    </p>
                  </>
                )}
              </label>
            </div>
            {!frostbiteEquipped && (
              <p className="text-gray-500 text-xs mt-3 pl-7">
                Equip <span className="text-gray-300">Frostbite</span> in your ability loadout at the other east pillar to enable this talent.
              </p>
            )}
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div
            className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${frostbiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
          >
            <div className="flex items-start gap-3">
              <TalentRowIcon id={wyvernBiteTalentDefinition.id} dimmed={!frostbiteEquipped} />
              <input
                type="checkbox"
                id="talent-wyvern-bite"
                checked={loadout.wyvernBite}
                onChange={toggleWyvernBite}
                disabled={!frostbiteEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="talent-wyvern-bite"
                className={`flex-1 ${frostbiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <div className="text-white font-semibold">{wyvernBiteTalentDefinition.name}</div>
                {loadout.wyvernBite && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{wyvernBiteTalentDefinition.description}</p>
                    <p className="text-emerald-200/90 text-xs mt-2 font-mono">
                      +1 Concentrated Venom stack per Barrage hit · {WYVERN_BITE_CONCENTRATED_VENOM_DPS_PER_STACK} DPS per stack · max{' '}
                      {WYVERN_BITE_CONCENTRATED_VENOM_MAX_STACKS} · {WYVERN_BITE_CONCENTRATED_VENOM_DURATION_SEC}s · green Barrage
                    </p>
                  </>
                )}
              </label>
            </div>
            {!frostbiteEquipped && (
              <p className="text-gray-500 text-xs mt-3 pl-7">
                Equip <span className="text-gray-300">Frostbite</span> in your ability loadout at the other east pillar to enable this talent.
              </p>
            )}
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div
            className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${frostbiteEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
          >
            <div className="flex items-start gap-3">
              <TalentRowIcon id={staggeringBiteTalentDefinition.id} dimmed={!frostbiteEquipped} />
              <input
                type="checkbox"
                id="talent-staggering-bite"
                checked={loadout.staggeringBite}
                onChange={toggleStaggeringBite}
                disabled={!frostbiteEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="talent-staggering-bite"
                className={`flex-1 ${frostbiteEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <div className="text-white font-semibold">{staggeringBiteTalentDefinition.name}</div>
                {loadout.staggeringBite && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{staggeringBiteTalentDefinition.description}</p>
                    <p className="text-amber-200/90 text-xs mt-2 font-mono">
                      {STAGGERING_BITE_BARRAGE_STAGGER_PER_HIT} stagger per Barrage hit · 100 = lightning + proc
                    </p>
                  </>
                )}
              </label>
            </div>
            {!frostbiteEquipped && (
              <p className="text-gray-500 text-xs mt-3 pl-7">
                Equip <span className="text-gray-300">Frostbite</span> in your ability loadout at the other east pillar to enable this talent.
              </p>
            )}
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={staggerShotTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-stagger-shot"
                checked={loadout.staggerShot}
                onChange={toggleStaggerShot}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-stagger-shot" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{staggerShotTalentDefinition.name}</div>
                {loadout.staggerShot && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{staggerShotTalentDefinition.description}</p>
                    <p className="text-green-200/90 text-xs mt-2 font-mono">
                      {STAGGER_SHOT_UNCHARGED_STAGGER} / {STAGGER_SHOT_CHARGED_STAGGER} / {STAGGER_SHOT_PERFECT_STAGGER} stagger (tap / full / perfect) ·{' '}
                      {STAGGER_SHOT_TEMPEST_ROUND_STAGGER} per Tempest burst arrow · 100 = lightning + proc
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={wrathfulShotsTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-wrathful-shots"
                checked={loadout.wrathfulShots}
                onChange={toggleWrathfulShots}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-wrathful-shots" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{wrathfulShotsTalentDefinition.name}</div>
                {loadout.wrathfulShots && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{wrathfulShotsTalentDefinition.description}</p>
                    <p className="text-rose-200/90 text-xs mt-2 font-mono">
                      +{WRATHFUL_SHOTS_PERFECT_CRIT_CHANCE_ADD * 100}% crit chance · +{WRATHFUL_SHOTS_PERFECT_CRIT_DAMAGE_MULT_ADD * 100}% crit damage on perfect LMB
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={dualCoilTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-dual-coil"
                checked={loadout.dualCoil}
                onChange={toggleDualCoil}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-dual-coil" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{dualCoilTalentDefinition.name}</div>
                {loadout.dualCoil && (
                  <p className="text-gray-400 text-sm mt-1">{dualCoilTalentDefinition.description}</p>
                )}
              </label>
            </div>
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={wyvernStingTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-wyvern-sting"
                checked={loadout.wyvernSting}
                onChange={toggleWyvernSting}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-wyvern-sting" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{wyvernStingTalentDefinition.name}</div>
                {loadout.wyvernSting && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{wyvernStingTalentDefinition.description}</p>
                    <p className="text-emerald-200/90 text-xs mt-2 font-mono">
                      Bonus Cobra Shot internal cooldown: {WYVERN_STING_COOLDOWN_SEC}s (separate from Cobra Shot on E)
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        {selectedWeapon === WeaponType.BOW && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={tempestRoundsTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-tempest-rounds"
                checked={loadout.tempestRounds}
                onChange={toggleTempestRounds}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-tempest-rounds" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{tempestRoundsTalentDefinition.name}</div>
                {loadout.tempestRounds && (
                  <p className="text-gray-400 text-sm mt-1">{tempestRoundsTalentDefinition.description}</p>
                )}
              </label>
            </div>
          </div>
        )}

        {selectedWeapon === WeaponType.SCYTHE && (
          <div
            className={`
            rounded-xl border-2 p-4 mb-6 transition-all
            ${crossentropyEquipped ? `${wc.border} ${wc.bg}` : 'border-gray-600 bg-gray-800/40 opacity-70'}
          `}
          >
            <div className="flex items-start gap-3">
              <TalentRowIcon id={infernoTalentDefinition.id} dimmed={!crossentropyEquipped} />
              <input
                type="checkbox"
                id="talent-inferno"
                checked={loadout.inferno}
                onChange={toggleInferno}
                disabled={!crossentropyEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="talent-inferno" className={`flex-1 ${crossentropyEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="text-white font-semibold">{infernoTalentDefinition.name}</div>
                {loadout.inferno && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{infernoTalentDefinition.description}</p>
                    <p className="text-orange-200/90 text-xs mt-2 font-mono">
                      +{INFERNAL_SMITE_CRIT_CHANCE_ADD * 100}% crit chance (hit damage) · Ignite {INFERNAL_SMITE_DOT_FRACTION * 100}% of hit over{' '}
                      {INFERNAL_SMITE_DURATION_MS / 1000}s in {INFERNAL_SMITE_TICKS} ticks
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={reaperTalentDefinition.id} dimmed={!crossentropyEquipped} />
              <input
                type="checkbox"
                id="talent-reaper"
                checked={loadout.reaper}
                onChange={toggleReaper}
                disabled={!crossentropyEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label htmlFor="talent-reaper" className={`flex-1 ${crossentropyEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                <div className="text-white font-semibold">{reaperTalentDefinition.name}</div>
                {loadout.reaper && <p className="text-gray-400 text-sm mt-1">{reaperTalentDefinition.description}</p>}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={crossentropyTempestTalentDefinition.id} dimmed={!crossentropyEquipped} />
              <input
                type="checkbox"
                id="talent-crossentropy-tempest"
                checked={loadout.crossentropyTempest}
                onChange={toggleCrossentropyTempest}
                disabled={!crossentropyEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="talent-crossentropy-tempest"
                className={`flex-1 ${crossentropyEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <div className="text-white font-semibold">{crossentropyTempestTalentDefinition.name}</div>
                {loadout.crossentropyTempest && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{crossentropyTempestTalentDefinition.description}</p>
                    <p className="text-sky-200/90 text-xs mt-2 font-mono">
                      +{CROSSENTROPY_TEMPEST_STAGGER} stagger per hit · mutually exclusive with {crossentropyPlagueTalentDefinition.name}
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={crossentropyPlagueTalentDefinition.id} dimmed={!crossentropyEquipped} />
              <input
                type="checkbox"
                id="talent-crossentropy-plague"
                checked={loadout.crossentropyPlague}
                onChange={toggleCrossentropyPlague}
                disabled={!crossentropyEquipped}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
              />
              <label
                htmlFor="talent-crossentropy-plague"
                className={`flex-1 ${crossentropyEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}
              >
                <div className="text-white font-semibold">{crossentropyPlagueTalentDefinition.name}</div>
                {loadout.crossentropyPlague && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{crossentropyPlagueTalentDefinition.description}</p>
                    <p className="text-emerald-200/90 text-xs mt-2 font-mono">
                      Base hit damage {CROSSENTROPY_PLAGUE_DAMAGE} (before Reaper stacks) · mutually exclusive with {crossentropyTempestTalentDefinition.name}
                    </p>
                  </>
                )}
              </label>
            </div>
            {!crossentropyEquipped && (
              <p className="text-gray-500 text-xs mt-3 pl-7">
                Equip <span className="text-gray-300">Crossentropy</span> in your ability loadout at the other east pillar to enable this talent.
              </p>
            )}
          </div>
        )}

        {selectedWeapon === WeaponType.SCYTHE && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={frostPathTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-frostpath"
                checked={loadout.frostPath}
                onChange={toggleFrostPath}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-frostpath" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{frostPathTalentDefinition.name}</div>
                {loadout.frostPath && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{frostPathTalentDefinition.description}</p>
                    <p className="text-cyan-200/90 text-xs mt-2 font-mono">
                      {FROSTPATH_PROC_CHANCE * 100}% per Entropic Bolt hit on PvE enemies · Coldsnap-style burst at impact · min {FROST_SOLAR_PROC_EFFECT_ICD_MS / 1000}s between procs
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={solarRechargeTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-solar-recharge"
                checked={loadout.solarRecharge}
                onChange={toggleSolarRecharge}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-solar-recharge" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{solarRechargeTalentDefinition.name}</div>
                {loadout.solarRecharge && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{solarRechargeTalentDefinition.description}</p>
                    <p className="text-orange-200/90 text-xs mt-2 font-mono">
                      {SOLAR_RECHARGE_PROC_CHANCE * 100}% per Entropic Bolt hit on PvE enemies · Sunwell (Reanimate) heal and VFX · does not put Q on cooldown · min {FROST_SOLAR_PROC_EFFECT_ICD_MS / 1000}s between procs
                    </p>
                  </>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={icebeamTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-icebeam"
                checked={loadout.icebeam}
                onChange={toggleIcebeam}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-icebeam" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{icebeamTalentDefinition.name}</div>
                {loadout.icebeam && (
                  <p className="text-gray-400 text-sm mt-1">{icebeamTalentDefinition.description}</p>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={wrathfulEntropicTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-wrathful-entropic"
                checked={loadout.wrathfulEntropic}
                onChange={toggleWrathfulEntropic}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-wrathful-entropic" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{wrathfulEntropicTalentDefinition.name}</div>
                {loadout.wrathfulEntropic && (
                  <p className="text-gray-400 text-sm mt-1">{wrathfulEntropicTalentDefinition.description}</p>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={staggeringEntropicTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-staggering-entropic"
                checked={loadout.staggeringEntropic}
                onChange={toggleStaggeringEntropic}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-staggering-entropic" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{staggeringEntropicTalentDefinition.name}</div>
                {loadout.staggeringEntropic && (
                  <p className="text-gray-400 text-sm mt-1">{staggeringEntropicTalentDefinition.description}</p>
                )}
              </label>
            </div>
            <div className="flex items-start gap-3 mt-4">
              <TalentRowIcon id={infestingEntropicTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-infesting-entropic"
                checked={loadout.infestingEntropic}
                onChange={toggleInfestingEntropic}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-infesting-entropic" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{infestingEntropicTalentDefinition.name}</div>
                {loadout.infestingEntropic && (
                  <p className="text-gray-400 text-sm mt-1">{infestingEntropicTalentDefinition.description}</p>
                )}
              </label>
            </div>
            <div className="mt-6 border-t border-purple-500/30 pt-5">
              <p className="text-purple-300/90 text-xs font-semibold uppercase tracking-wide mb-3">Mantra</p>
              <div className={`flex items-start gap-3 ${!mantraEquipped ? 'opacity-60' : ''}`}>
                <TalentRowIcon id={wrathfulTotemTalentDefinition.id} dimmed={!mantraEquipped} />
                <input
                  type="checkbox"
                  id="talent-wrathful-totem"
                  checked={loadout.wrathfulTotem}
                  onChange={toggleWrathfulTotem}
                  disabled={!mantraEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-wrathful-totem" className={`flex-1 ${mantraEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{wrathfulTotemTalentDefinition.name}</div>
                  {loadout.wrathfulTotem && (
                    <p className="text-gray-400 text-sm mt-1">{wrathfulTotemTalentDefinition.description}</p>
                  )}
                </label>
              </div>
              <div className={`flex items-start gap-3 mt-4 ${!mantraEquipped ? 'opacity-60' : ''}`}>
                <TalentRowIcon id={staggeringTotemTalentDefinition.id} dimmed={!mantraEquipped} />
                <input
                  type="checkbox"
                  id="talent-staggering-totem"
                  checked={loadout.staggeringTotem}
                  onChange={toggleStaggeringTotem}
                  disabled={!mantraEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-staggering-totem" className={`flex-1 ${mantraEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{staggeringTotemTalentDefinition.name}</div>
                  {loadout.staggeringTotem && (
                    <p className="text-gray-400 text-sm mt-1">{staggeringTotemTalentDefinition.description}</p>
                  )}
                </label>
              </div>
              <div className={`flex items-start gap-3 mt-4 ${!mantraEquipped ? 'opacity-60' : ''}`}>
                <TalentRowIcon id={infestingTotemTalentDefinition.id} dimmed={!mantraEquipped} />
                <input
                  type="checkbox"
                  id="talent-infesting-totem"
                  checked={loadout.infestingTotem}
                  onChange={toggleInfestingTotem}
                  disabled={!mantraEquipped}
                  className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                />
                <label htmlFor="talent-infesting-totem" className={`flex-1 ${mantraEquipped ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                  <div className="text-white font-semibold">{infestingTotemTalentDefinition.name}</div>
                  {loadout.infestingTotem && (
                    <p className="text-gray-400 text-sm mt-1">{infestingTotemTalentDefinition.description}</p>
                  )}
                </label>
              </div>
              {!mantraEquipped && (
                <p className="text-gray-500 text-xs mt-3 pl-7">
                  Equip <span className="text-gray-300">Mantra</span> in your universal ability loadout to enable these talents.
                </p>
              )}
            </div>
          </div>
        )}

        {(selectedWeapon === WeaponType.SPEAR || selectedWeapon === WeaponType.RUNEBLADE) && (
          <div className={`rounded-xl border-2 p-4 mb-6 transition-all ${wc.border} ${wc.bg}`}>
            <div className="flex items-start gap-3">
              <TalentRowIcon id={windFuryTalentDefinition.id} />
              <input
                type="checkbox"
                id="talent-windfury"
                checked={loadout.windFury}
                onChange={toggleWindFury}
                className="mt-1 h-4 w-4 rounded border-gray-500 text-amber-500 focus:ring-amber-500"
              />
              <label htmlFor="talent-windfury" className="flex-1 cursor-pointer">
                <div className="text-white font-semibold">{windFuryTalentDefinition.name}</div>
                {loadout.windFury && (
                  <>
                    <p className="text-gray-400 text-sm mt-1">{windFuryTalentDefinition.description}</p>
                    <p className="text-cyan-200/90 text-xs mt-2 font-mono">
                      {WINDFURY_PROC_CHANCE * 100}% per spear primary or Runeblade combo hit (that damages an enemy) · Storm Shroud (Flurry) VFX, attack speed, heal on hit · does not put F on cooldown
                    </p>
                  </>
                )}
              </label>
            </div>
          </div>
        )}

        </div>

        <div className="mt-4 flex shrink-0 justify-center gap-3 border-t border-gray-700/80 pt-4">
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
