import type { AbilityLoadout } from '@/utils/weaponAbilities';

export const TALENT_WRATH_STRIKE = 'WRATH_STRIKE' as const;
export const TALENT_INFESTED_STRIKE = 'INFESTED_STRIKE' as const;
export const TALENT_WRATHFUL_TALONS = 'WRATHFUL_TALONS' as const;
export const TALENT_STORED_CHARGE = 'STORED_CHARGE' as const;
export const TALENT_STAGGERING_STRIKE = 'STAGGERING_STRIKE' as const;
export const TALENT_STAGGERING_COMBO = 'STAGGERING_COMBO' as const;
export const TALENT_STAGGERING_SWIPES = 'STAGGERING_SWIPES' as const;
export const TALENT_TRINITY = 'TRINITY' as const;
export const TALENT_INFESTED_SMITE = 'INFESTED_SMITE' as const;
export const TALENT_STAGGERING_SMITE = 'STAGGERING_SMITE' as const;
export const TALENT_INFERNAL_SMITE = 'INFERNAL_SMITE' as const;
export const TALENT_STAGGER_SHOT = 'STAGGER_SHOT' as const;

/** Infested Smite — heal per enemy hit per Smite beam. */
export const INFESTED_SMITE_HEAL_PER_TARGET = 10;

/** Infernal Smite — Ignite DoT: this fraction of the smite hit damage over INFERNAL_SMITE_DURATION_MS. */
export const INFERNAL_SMITE_DOT_FRACTION = 0.8;
export const INFERNAL_SMITE_DURATION_MS = 3000;
export const INFERNAL_SMITE_TICKS = 3;
/** Infernal Smite — additive critical strike chance on each Smite beam (crit damage multiplier unchanged). */
export const INFERNAL_SMITE_CRIT_CHANCE_ADD = 0.4;

export type TalentId =
  | typeof TALENT_WRATH_STRIKE
  | typeof TALENT_INFESTED_STRIKE
  | typeof TALENT_WRATHFUL_TALONS
  | typeof TALENT_STORED_CHARGE
  | typeof TALENT_STAGGERING_STRIKE
  | typeof TALENT_STAGGERING_COMBO
  | typeof TALENT_STAGGERING_SWIPES
  | typeof TALENT_TRINITY
  | typeof TALENT_INFESTED_SMITE
  | typeof TALENT_STAGGERING_SMITE
  | typeof TALENT_INFERNAL_SMITE
  | typeof TALENT_STAGGER_SHOT;

/** Modifies Wraith Strike (`RUNEBLADE_E`) when equipped in Q/E/R. */
export const WRATH_STRIKE_CRIT_CHANCE_ADD = 0.5;
export const WRATH_STRIKE_CRIT_DAMAGE_MULT_ADD = 0.5;

/** Reaping Talons (`BOW_R`) return arrow only — preset crit roll in useViperSting. */
export const WRATHFUL_TALONS_RETURN_CRIT_CHANCE_ADD = 0.5;
export const WRATHFUL_TALONS_RETURN_CRIT_DAMAGE_MULT_ADD = 1.0;

/** Staggering Strike — Wraith Strike (`RUNEBLADE_E`) builds stagger; at 100, proc lightning + damage + stun. */
export const STAGGERING_STRIKE_WRAITH_STAGGER_ADD = 60;
export const STAGGER_MAX = 100;
export const STAGGER_PROC_DAMAGE = 160;
export const STAGGER_PROC_STUN_SECONDS = 2;

/** Staggering Combo — Runeblade basic attack combo adds stagger per hit (same 100 cap / proc as Staggering Strike). */
export const STAGGERING_COMBO_HIT1_STAGGER = 20;
export const STAGGERING_COMBO_HIT2_STAGGER = 25;
export const STAGGERING_COMBO_HIT3_STAGGER = 30;

/** Staggering Swipes — Sabres basic dual swing: 15 stagger total per swing (split across blades). Same 100 cap / proc as other stagger talents. */
export const STAGGERING_SWIPES_LEFT_BLADE_STAGGER = 10;
export const STAGGERING_SWIPES_RIGHT_BLADE_STAGGER = 10;

/** Staggering Smite — each Colossus Smite beam adds this stagger per enemy hit (same 100 cap / proc as other stagger talents). */
export const STAGGERING_SMITE_BEAM_STAGGER = 50;

/** Stagger Shot — Bow LMB: uncharged, charged, perfect, and Tempest Rounds burst (same 100 cap / proc as other stagger talents). */
export const STAGGER_SHOT_UNCHARGED_STAGGER = 10;
export const STAGGER_SHOT_CHARGED_STAGGER = 35;
export const STAGGER_SHOT_PERFECT_STAGGER = 50;
export const STAGGER_SHOT_TEMPEST_ROUND_STAGGER = 25;

export interface TalentDefinition {
  id: TalentId;
  name: string;
  description: string;
  /** Universal ability id this talent augments. */
  modifiesAbilityId: string;
}

export const wrathStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_WRATH_STRIKE,
  name: 'Wrathful Strike',
  description:
    'While Wraith Strike is in your ability loadout, Wraith Strike gains +20% critical strike chance and +50% critical strike damage.',
  modifiesAbilityId: 'RUNEBLADE_E',
};

export const infestedStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_STRIKE,
  name: 'INFESTED STRIKE',
  description:
    'Wraith Strike deals 190 damage and gains a green soul effect. Killing an enemy with Wraith Strike raises a zombie ally for 30s (max 3). Zombies attack nearby foes or follow you.',
  modifiesAbilityId: 'RUNEBLADE_E',
};

export const wrathfulTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_TALONS,
  name: 'WRATHFUL TALONS',
  description:
    'While Reaping Talons is in your ability loadout, the backward return arrow gains +40% critical strike chance and +100% critical strike damage when it hits a target.',
  modifiesAbilityId: 'BOW_R',
};

export const storedChargeTalentDefinition: TalentDefinition = {
  id: TALENT_STORED_CHARGE,
  name: 'STORED CHARGE',
  description:
    'While Charge is in your ability loadout, after the dash your Runeblade completes three full spins instead of one and a half, dealing Charge damage to nearby enemies for each full rotation.',
  modifiesAbilityId: 'SWORD_E',
};

export const trinityTalentDefinition: TalentDefinition = {
  id: TALENT_TRINITY,
  name: 'TRINITY',
  description:
    'Colossus Smite consumes up to two available dash charges to call up to two additional strikes at nearby points during the same cast. Each strike deals 165 damage.',
  modifiesAbilityId: 'RUNEBLADE_R',
};

export const infestedSmiteTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_SMITE,
  name: 'Infested Smite',
  description:
    'Colossus Smite bolts use a green theme. Each Smite beam heals you for 5 health per enemy hit by that beam. Killing an enemy with Smite raises a zombie ally for 30s (max 3), same as Infested Strike.',
  modifiesAbilityId: 'RUNEBLADE_R',
};

export const staggeringSmiteTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_SMITE,
  name: 'Staggering Smite',
  description:
    'Colossus Smite bolts use a blue theme. Each Smite beam applies stagger to enemies hit by that beam. Uses the same stagger buildup, cap, and lightning proc as Staggering Strike and Staggering Combo.',
  modifiesAbilityId: 'RUNEBLADE_R',
};

export const infernalSmiteTalentDefinition: TalentDefinition = {
  id: TALENT_INFERNAL_SMITE,
  name: 'Infernal Smite',
  description:
    'Colossus Smite bolts use a red fiery orange theme. Each beam gains +50% critical strike chance (same magnitude as Wrathful Strike’s crit chance bonus on Wraith Strike; crit damage unchanged). Each beam applies Ignite: bonus damage equal to 80% of that beam’s hit damage, dealt in three ticks over 3 seconds (after 1s, 2s, and 3s).',
  modifiesAbilityId: 'RUNEBLADE_R',
};

export const staggeringStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_STRIKE,
  name: 'STAGGERING STRIKE',
  description:
    'Wraith Strike applies stagger to enemies. At 100 stagger, a blue bolt strikes from above for 125 damage and stuns the target for 3 seconds. Each Wraith Strike adds 40 stagger.',
  modifiesAbilityId: 'RUNEBLADE_E',
};

export const staggeringComboTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_COMBO,
  name: 'STAGGERING COMBO',
  description:
    'Your Runeblade basic attack combo applies stagger: 30 on the first hit, 30 on the second, and 40 on the third. Uses the same stagger threshold and lightning proc as Staggering Strike.',
  modifiesAbilityId: 'RUNEBLADE_BASIC',
};

export const staggeringSwipesTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_SWIPES,
  name: 'STAGGERING SWIPES',
  description:
    'Sabres basic attacks apply stagger from each blade (15 total per swing). At 100 stagger, the same lightning strike, bonus damage, and stun proc as Staggering Strike / Staggering Combo.',
  modifiesAbilityId: 'SABRES_BASIC',
};

export const staggerShotTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGER_SHOT,
  name: 'STAGGER SHOT',
  description:
    'Bow primary attacks apply stagger by shot type (uncharged, fully charged, perfect timing). With Tempest Rounds, each burst arrow applies stagger. Uses the same buildup, cap, and lightning proc as other stagger talents.',
  modifiesAbilityId: 'BOW_BASIC',
};

export interface TalentLoadout {
  wrathStrike: boolean;
  infestedStrike: boolean;
  staggeringStrike: boolean;
  staggeringCombo: boolean;
  staggeringSwipes: boolean;
  wrathfulTalons: boolean;
  storedCharge: boolean;
  trinity: boolean;
  infestedSmite: boolean;
  staggeringSmite: boolean;
  infernalSmite: boolean;
  staggerShot: boolean;
}

export function createDefaultTalentLoadout(): TalentLoadout {
  return {
    wrathStrike: false,
    infestedStrike: false,
    staggeringStrike: false,
    staggeringCombo: false,
    staggeringSwipes: false,
    wrathfulTalons: false,
    storedCharge: false,
    trinity: false,
    infestedSmite: false,
    staggeringSmite: false,
    infernalSmite: false,
    staggerShot: false,
  };
}

export function isWraithStrikeInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'RUNEBLADE_E' || loadout.E === 'RUNEBLADE_E' || loadout.R === 'RUNEBLADE_E';
}

export function isReapingTalonsInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'BOW_R' || loadout.E === 'BOW_R' || loadout.R === 'BOW_R';
}

export function shouldApplyWrathfulTalonsTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.wrathfulTalons && isReapingTalonsInLoadout(abilityLoadout);
}

export function isChargeInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'SWORD_E' || loadout.E === 'SWORD_E' || loadout.R === 'SWORD_E';
}

export function shouldApplyStoredChargeTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.storedCharge && isChargeInLoadout(abilityLoadout);
}

/** Colossus Smite / Runeblade R (`RUNEBLADE_R`) in any universal slot. */
export function isColossusSmiteInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'RUNEBLADE_R' || loadout.E === 'RUNEBLADE_R' || loadout.R === 'RUNEBLADE_R';
}

export function shouldApplyTrinityTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.trinity && isColossusSmiteInLoadout(abilityLoadout);
}

export function shouldApplyInfestedSmiteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.infestedSmite && isColossusSmiteInLoadout(abilityLoadout);
}

export function shouldApplyStaggeringSmiteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.staggeringSmite && isColossusSmiteInLoadout(abilityLoadout);
}

export function shouldApplyInfernalSmiteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.infernalSmite && isColossusSmiteInLoadout(abilityLoadout);
}

export function shouldApplyStaggeringStrikeTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.staggeringStrike && isWraithStrikeInLoadout(abilityLoadout);
}

/** Basic-attack stagger; no ability slot requirement — talent toggle only (use with Runeblade). */
export function shouldApplyStaggeringComboTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggeringCombo;
}

/** Sabres basic-attack stagger; talent toggle only (use with Sabres equipped). */
export function shouldApplyStaggeringSwipesTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggeringSwipes;
}

/** Bow LMB stagger; talent toggle only (use with Bow equipped). */
export function shouldApplyStaggerShotTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggerShot;
}
