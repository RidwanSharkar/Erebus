import type { AbilityLoadout } from '@/utils/weaponAbilities';
import { Vector3 } from '@/utils/three-exports';

export const TALENT_WRATH_STRIKE = 'WRATH_STRIKE' as const;
export const TALENT_INFESTED_STRIKE = 'INFESTED_STRIKE' as const;
export const TALENT_WRATHFUL_TALONS = 'WRATHFUL_TALONS' as const;
export const TALENT_EXECUTE = 'EXECUTE' as const;
export const TALENT_STORED_CHARGE = 'STORED_CHARGE' as const;
export const TALENT_STAGGERING_STRIKE = 'STAGGERING_STRIKE' as const;
export const TALENT_STAGGERING_COMBO = 'STAGGERING_COMBO' as const;
export const TALENT_STAGGERING_SWIPES = 'STAGGERING_SWIPES' as const;
export const TALENT_TRINITY = 'TRINITY' as const;
export const TALENT_INFESTED_SMITE = 'INFESTED_SMITE' as const;
export const TALENT_STAGGERING_SMITE = 'STAGGERING_SMITE' as const;
export const TALENT_INFERNAL_SMITE = 'INFERNAL_SMITE' as const;
export const TALENT_STAGGER_SHOT = 'STAGGER_SHOT' as const;
export const TALENT_CONCENTRATED_VOLLEY = 'CONCENTRATED_VOLLEY' as const;
export const TALENT_WRATHFUL_BITE = 'WRATHFUL_BITE' as const;
export const TALENT_INFERNO = 'INFERNO' as const;
export const TALENT_REAPER = 'REAPER' as const;
export const TALENT_DUAL_COIL = 'DUAL_COIL' as const;
export const TALENT_WRAITH_GUARD = 'WRAITH_GUARD' as const;
export const TALENT_FROSTPATH = 'FROSTPATH' as const;
export const TALENT_SOLAR_RECHARGE = 'SOLAR_RECHARGE' as const;
export const TALENT_WINDFURY = 'WINDFURY' as const;
export const TALENT_BLADE_RUSH = 'BLADE_RUSH' as const;
export const TALENT_COLOSSUS_GUARD = 'COLOSSUS_GUARD' as const;
export const TALENT_WRATHFUL_COMBO = 'WRATHFUL_COMBO' as const;
export const TALENT_INFESTED_COMBO = 'INFESTED_COMBO' as const;
export const TALENT_GUARD_COMBO = 'GUARD_COMBO' as const;

/** Blade Rush — double-tap forward Charge on Runeblade; separate from E-key Charge cooldown. */
export const BLADE_RUSH_CHARGE_COOLDOWN_SEC = 3;

/** Crossentropy (`SCYTHE_R`) base hit damage before Reaper stack bonus. */
export const CROSSENTROPY_BASE_DAMAGE = 370;
/** Reaper: +1 base damage per enemy kill (session). */
export const CROSSENTROPY_REAPER_DAMAGE_PER_KILL = 1;
/**
 * Max world units the Crossentropy bolt travels (matches legacy VFX in CrossentropyBolt).
 * Reaper uses this for ECS `maxDistance` so the pierce line does not outrange normal Crossentropy.
 */
export const CROSSENTROPY_MAX_TRAVEL_DISTANCE = 20;

/** Scythe Q — Sunwell (Reanimate) self-heal and ally heal amount (HP). */
export const REANIMATE_SUNWELL_HEAL = 30;

/** Scythe Q — Sunwell (Reanimate) cooldown in seconds. */
export const REANIMATE_SUNWELL_COOLDOWN_SEC = 5;

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
  | typeof TALENT_EXECUTE
  | typeof TALENT_STORED_CHARGE
  | typeof TALENT_STAGGERING_STRIKE
  | typeof TALENT_STAGGERING_COMBO
  | typeof TALENT_STAGGERING_SWIPES
  | typeof TALENT_TRINITY
  | typeof TALENT_INFESTED_SMITE
  | typeof TALENT_STAGGERING_SMITE
  | typeof TALENT_INFERNAL_SMITE
  | typeof TALENT_STAGGER_SHOT
  | typeof TALENT_CONCENTRATED_VOLLEY
  | typeof TALENT_WRATHFUL_BITE
  | typeof TALENT_INFERNO
  | typeof TALENT_REAPER
  | typeof TALENT_DUAL_COIL
  | typeof TALENT_WRAITH_GUARD
  | typeof TALENT_FROSTPATH
  | typeof TALENT_SOLAR_RECHARGE
  | typeof TALENT_WINDFURY
  | typeof TALENT_BLADE_RUSH
  | typeof TALENT_COLOSSUS_GUARD
  | typeof TALENT_WRATHFUL_COMBO
  | typeof TALENT_INFESTED_COMBO
  | typeof TALENT_GUARD_COMBO;

/** Modifies Wraith Strike (`RUNEBLADE_E`) when equipped in Q/E/R. */
export const WRATH_STRIKE_CRIT_CHANCE_ADD = 0.5;
export const WRATH_STRIKE_CRIT_DAMAGE_MULT_ADD = 0.5;

/** Reaping Talons (`BOW_R`) return arrow only — preset crit roll in useViperSting. */
export const WRATHFUL_TALONS_RETURN_CRIT_CHANCE_ADD = 0.5;
export const WRATHFUL_TALONS_RETURN_CRIT_DAMAGE_MULT_ADD = 1.0;

/** EXECUTE — Reaping Talons (`BOW_R`) first forward hit: bonus when a dash charge is consumed (useViperSting + Movement). */
export const EXECUTE_REAPING_TALONS_BONUS_DAMAGE = 200;

/** Wrathful Bite — Frostbite / Barrage (`BOW_Q`) hits use these additive crit modifiers in CombatSystem. */
export const WRATHFUL_BITE_BARRAGE_CRIT_CHANCE_ADD = 0.4;
export const WRATHFUL_BITE_BARRAGE_CRIT_DAMAGE_MULT_ADD = 0.4;
 
/** Wraith Guard — Wraith Strike (`RUNEBLADE_E`) enemy hits can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const WRAITH_GUARD_PROC_CHANCE = 0.4;
export const WRAITH_GUARD_DURATION_SEC = 3;

/** Colossus Guard — Colossus Smite (`RUNEBLADE_R`) beam hits on PvE enemies can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const COLOSSUS_GUARD_PROC_CHANCE = 0.5;
/** Seconds added to remaining talent shield time per successful proc (cap on remaining). */
export const COLOSSUS_GUARD_STACK_SEC = 2;
export const COLOSSUS_GUARD_MAX_REMAINING_SEC = 6;

/** Wrathful Combo — Runeblade basic 3rd hit only: additive crit chance and crit damage multiplier. */
export const WRATHFUL_COMBO_CRIT_CHANCE_ADD = 0.5;
export const WRATHFUL_COMBO_CRIT_DAMAGE_MULT_ADD = 1.0;

/** Infested Combo — heal fraction of final hit damage dealt (after crit) on each left-click hit. */
export const INFESTED_COMBO_LIFESTEAL = 0.1;

/** Guard Combo — Runeblade basic hits can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const GUARD_COMBO_PROC_CHANCE = 0.2;
export const GUARD_COMBO_DURATION_SEC = 2;

/** Frostpath — Entropic Bolt (scythe LMB) hits on PvE enemies can proc Coldsnap at impact (no E cooldown). */
export const FROSTPATH_PROC_CHANCE = 0.2;

/** Solar Recharge — Entropic Bolt hits on PvE enemies can proc Sunwell (Reanimate) (no Q cooldown; does not require Sunwell in loadout). */
export const SOLAR_RECHARGE_PROC_CHANCE = 0.1;

/** Windfury — Spear primary attacks that hit an enemy can proc Storm Shroud (Flurry) without F cooldown. */
export const WINDFURY_PROC_CHANCE = 0.15;

/** Staggering Strike — Wraith Strike (`RUNEBLADE_E`) builds stagger; at 100, proc lightning + damage + stun. */
export const STAGGERING_STRIKE_WRAITH_STAGGER_ADD = 60;
export const STAGGER_MAX = 100;
export const STAGGER_PROC_DAMAGE = 150;
export const STAGGER_PROC_STUN_SECONDS = 2;

/** Staggering Combo — Runeblade basic attack combo adds stagger per hit (same 100 cap / proc as Staggering Strike). */
export const STAGGERING_COMBO_HIT1_STAGGER = 20;
export const STAGGERING_COMBO_HIT2_STAGGER = 25;
export const STAGGERING_COMBO_HIT3_STAGGER = 30;

/** Staggering Swipes — Sabres basic dual swing: 15 stagger total per swing (split across blades). Same 100 cap / proc as other stagger talents. */
export const STAGGERING_SWIPES_LEFT_BLADE_STAGGER = 10;
export const STAGGERING_SWIPES_RIGHT_BLADE_STAGGER = 10;

/** Staggering Smite — each Colossus Smite beam adds this stagger per enemy hit (same 100 cap / proc as other stagger talents). */
export const STAGGERING_SMITE_BEAM_STAGGER = 40;

/** Stagger Shot — Bow LMB: uncharged, charged, perfect, and Tempest Rounds burst (same 100 cap / proc as other stagger talents). */
export const STAGGER_SHOT_UNCHARGED_STAGGER = 10;
export const STAGGER_SHOT_CHARGED_STAGGER = 25;
export const STAGGER_SHOT_PERFECT_STAGGER = 40;
export const STAGGER_SHOT_TEMPEST_ROUND_STAGGER = 15;

/** Dual Coil — left/right offset for the twin Bow LMB spawns and perfect-shot beams (world units, half the pair’s separation is this distance from center). */
export const DUAL_COIL_LATERAL_OFFSET = 0.16;

/** Wider lateral offset at hit point so paired floating damage numbers read side-by-side. */
export const DUAL_COIL_DAMAGE_NUMBER_LATERAL_OFFSET = 0.48;

/** Unit lateral × `lateralScale` (default: projectile/beam pair spacing). */
export function getDualCoilLateralVector(
  direction: Vector3,
  lateralScale: number = DUAL_COIL_LATERAL_OFFSET
): Vector3 {
  const worldUp = new Vector3(0, 1, 0);
  const lateral = new Vector3().crossVectors(direction, worldUp);
  if (lateral.lengthSq() < 1e-8) {
    lateral.crossVectors(direction, new Vector3(1, 0, 0));
  }
  return lateral.normalize().multiplyScalar(lateralScale);
}

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

export const executeTalentDefinition: TalentDefinition = {
  id: TALENT_EXECUTE,
  name: 'EXECUTE',
  description:
    'While Reaping Talons is in your ability loadout, the first forward hit consumes one available dash charge (if any) and deals 200 additional damage. The return arrow is unaffected.',
  modifiesAbilityId: 'BOW_R',
};

export const storedChargeTalentDefinition: TalentDefinition = {
  id: TALENT_STORED_CHARGE,
  name: 'STORED CHARGE',
  description:
    'While Charge is in your ability loadout (or while you have the Blade Rush talent), after the dash your Runeblade completes three full spins instead of one and a half, dealing Charge damage to nearby enemies for each full rotation.',
  modifiesAbilityId: 'SWORD_E',
};

export const bladeRushTalentDefinition: TalentDefinition = {
  id: TALENT_BLADE_RUSH,
  name: 'Blade Rush',
  description:
    'Double-tapping W to dash forward on the Runeblade performs Charge (forward dash and damage spin) when Blade Rush’s cooldown allows, consuming one dash charge. Does not require Charge in your loadout. While Blade Rush is on cooldown, the input uses a normal forward dash. E-key Charge keeps its own cooldown.',
  modifiesAbilityId: 'RUNEBLADE_BASIC',
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

export const colossusGuardTalentDefinition: TalentDefinition = {
  id: TALENT_COLOSSUS_GUARD,
  name: 'Colossus Guard',
  description:
    'Colossus Smite has a 50% chance per beam hit on enemies to grant Aegis deflection and invulnerability. Each successful proc adds 2 seconds to the remaining shield duration (up to 6 seconds). Does not put Aegis on cooldown and does not require Aegis in your loadout.',
  modifiesAbilityId: 'RUNEBLADE_R',
};

export const staggeringStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_STRIKE,
  name: 'STAGGERING STRIKE',
  description:
    'Wraith Strike applies stagger to enemies. At 100 stagger, a blue bolt strikes from above for 125 damage and stuns the target for 3 seconds. Each Wraith Strike adds 40 stagger.',
  modifiesAbilityId: 'RUNEBLADE_E',
};

export const wraithGuardTalentDefinition: TalentDefinition = {
  id: TALENT_WRAITH_GUARD,
  name: 'Wraith Guard',
  description:
    'Wraith Strike has a 33% chance per enemy hit to grant 2 seconds of Aegis deflection and invulnerability. Does not put Aegis on cooldown and does not require Aegis in your loadout.',
  modifiesAbilityId: 'RUNEBLADE_E',
};

export const staggeringComboTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_COMBO,
  name: 'STAGGERING COMBO',
  description:
    'Your Runeblade basic attack combo applies stagger: 30 on the first hit, 30 on the second, and 40 on the third. Uses the same stagger threshold and lightning proc as Staggering Strike.',
  modifiesAbilityId: 'RUNEBLADE_BASIC',
};

export const wrathfulComboTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_COMBO,
  name: 'Wrathful Combo',
  description:
    'Your Runeblade left-click combo’s third hit gains +50% critical strike chance and +100% critical strike damage.',
  modifiesAbilityId: 'RUNEBLADE_BASIC',
};

export const infestedComboTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_COMBO,
  name: 'Infested Combo',
  description:
    'Your Runeblade left-click attacks heal you for 10% of damage dealt. Killing an enemy with these attacks raises a zombie ally for 30s (max 3), same as Infested Strike and Infested Smite.',
  modifiesAbilityId: 'RUNEBLADE_BASIC',
};

export const guardComboTalentDefinition: TalentDefinition = {
  id: TALENT_GUARD_COMBO,
  name: 'Guard Combo',
  description:
    'Your Runeblade left-click attacks have a 20% chance per enemy hit to grant 2 seconds of Aegis deflection and invulnerability. Does not put Aegis on cooldown and does not require Aegis in your loadout.',
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

export const dualCoilTalentDefinition: TalentDefinition = {
  id: TALENT_DUAL_COIL,
  name: 'Dual Coil',
  description:
    'Bow primary fire launches two projectiles at once, slightly offset to each side. Applies to tap fire, charged and perfect shots, and to each arrow in a Tempest Rounds burst; perfect timing also spawns a second matching beam VFX alongside the first.',
  modifiesAbilityId: 'BOW_BASIC',
};

export const concentratedVolleyTalentDefinition: TalentDefinition = {
  id: TALENT_CONCENTRATED_VOLLEY,
  name: 'CONCENTRATED VOLLEY',
  description:
    'While Frostbite is in your ability loadout, Barrage fires all five arrows in a straight line forward instead of in a spreading fan.',
  modifiesAbilityId: 'BOW_Q',
};

export const wrathfulBiteTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_BITE,
  name: 'WRATHFUL BITE',
  description:
    'While Frostbite is in your ability loadout, Barrage gains +40% critical strike chance and +40% critical strike damage, and Barrage arrows use a red theme instead of blue.',
  modifiesAbilityId: 'BOW_Q',
};

export const infernoTalentDefinition: TalentDefinition = {
  id: TALENT_INFERNO,
  name: 'INFERNO',
  description:
    'While Crossentropy is in your ability loadout, Crossentropy gains +40% critical strike chance (crit damage unchanged). Crossentropy applies Ignite: bonus damage equal to 80% of the hit’s damage, dealt in three ticks over 3 seconds. Bolt and impact use a red fiery theme.',
  modifiesAbilityId: 'SCYTHE_R',
};

export const reaperTalentDefinition: TalentDefinition = {
  id: TALENT_REAPER,
  name: 'Reaper',
  description:
    'While Crossentropy is in your ability loadout, the bolt travels to full range, pierces all enemies, and no longer spawns an explosion on hit. Killing an enemy with Crossentropy grants +1 base damage to Crossentropy for the rest of the session (stacks).',
  modifiesAbilityId: 'SCYTHE_R',
};

export const frostPathTalentDefinition: TalentDefinition = {
  id: TALENT_FROSTPATH,
  name: 'Frostpath',
  description:
    'Each Entropic Bolt that hits a PvE enemy has a 20% chance to trigger a Coldsnap-style burst centered on that enemy (freeze and VFX; does not require or consume the Coldsnap ability).',
  modifiesAbilityId: 'SCYTHE_BASIC',
};

export const solarRechargeTalentDefinition: TalentDefinition = {
  id: TALENT_SOLAR_RECHARGE,
  name: 'Solar Recharge',
  description:
    'Each Entropic Bolt that hits a PvE enemy has a 10% chance to trigger Sunwell (Reanimate): self-heal, ally healing in range, and VFX (does not require or consume the Sunwell ability on Q).',
  modifiesAbilityId: 'SCYTHE_BASIC',
};

export const windFuryTalentDefinition: TalentDefinition = {
  id: TALENT_WINDFURY,
  name: 'Windfury',
  description:
    'Each spear primary attack that hits an enemy has a 15% chance to grant Storm Shroud (Flurry) for 5 seconds: increased attack speed, tornado VFX, and 15 HP healed per enemy hit. Does not put Storm Shroud (F) on cooldown.',
  modifiesAbilityId: 'SPEAR_F',
};

export interface TalentLoadout {
  wrathStrike: boolean;
  infestedStrike: boolean;
  wraithGuard: boolean;
  staggeringStrike: boolean;
  staggeringCombo: boolean;
  staggeringSwipes: boolean;
  wrathfulTalons: boolean;
  execute: boolean;
  storedCharge: boolean;
  trinity: boolean;
  infestedSmite: boolean;
  staggeringSmite: boolean;
  infernalSmite: boolean;
  colossusGuard: boolean;
  staggerShot: boolean;
  concentratedVolley: boolean;
  wrathfulBite: boolean;
  inferno: boolean;
  reaper: boolean;
  frostPath: boolean;
  solarRecharge: boolean;
  windFury: boolean;
  dualCoil: boolean;
  bladeRush: boolean;
  wrathfulCombo: boolean;
  infestedCombo: boolean;
  guardCombo: boolean;
}

export function createDefaultTalentLoadout(): TalentLoadout {
  return {
    wrathStrike: false,
    infestedStrike: false,
    wraithGuard: false,
    staggeringStrike: false,
    staggeringCombo: false,
    staggeringSwipes: false,
    wrathfulTalons: false,
    execute: false,
    storedCharge: false,
    trinity: false,
    infestedSmite: false,
    staggeringSmite: false,
    infernalSmite: false,
    colossusGuard: false,
    staggerShot: false,
    concentratedVolley: false,
    wrathfulBite: false,
    inferno: false,
    reaper: false,
    frostPath: false,
    solarRecharge: false,
    windFury: false,
    dualCoil: false,
    bladeRush: false,
    wrathfulCombo: false,
    infestedCombo: false,
    guardCombo: false,
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

export function isFrostBiteInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'BOW_Q' || loadout.E === 'BOW_Q' || loadout.R === 'BOW_Q';
}

/** Crossentropy (`SCYTHE_R`) in any universal slot. */
export function isCrossentropyInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'SCYTHE_R' || loadout.E === 'SCYTHE_R' || loadout.R === 'SCYTHE_R';
}

/** Coldsnap / Scythe E (`SCYTHE_E`) in any universal slot. */
export function isColdsnapInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'SCYTHE_E' || loadout.E === 'SCYTHE_E' || loadout.R === 'SCYTHE_E';
}

export function shouldApplyWrathfulTalonsTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.wrathfulTalons && isReapingTalonsInLoadout(abilityLoadout);
}

export function shouldApplyExecuteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.execute && isReapingTalonsInLoadout(abilityLoadout);
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

export function shouldApplyBladeRushTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.bladeRush;
}

/** Stored Charge spin count / charge spin broadcasts: Charge in loadout or Blade Rush (Charge-like dash without SWORD_E). */
export function shouldApplyRunebladeStoredChargeSpin(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  if (!talentLoadout?.storedCharge) return false;
  return isChargeInLoadout(abilityLoadout) || !!talentLoadout.bladeRush;
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

export function shouldApplyWraithGuardTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.wraithGuard && isWraithStrikeInLoadout(abilityLoadout);
}

export function shouldApplyColossusGuardTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.colossusGuard && isColossusSmiteInLoadout(abilityLoadout);
}

/** Basic-attack stagger; no ability slot requirement — talent toggle only (use with Runeblade). */
export function shouldApplyStaggeringComboTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggeringCombo;
}

/** Runeblade basic 3rd-hit crit; talent toggle only. */
export function shouldApplyWrathfulComboTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.wrathfulCombo;
}

/** Runeblade basic lifesteal + infested zombie on kill; talent toggle only. */
export function shouldApplyInfestedComboTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.infestedCombo;
}

/** Runeblade basic Aegis-style proc; talent toggle only. */
export function shouldApplyGuardComboTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.guardCombo;
}

/** Sabres basic-attack stagger; talent toggle only (use with Sabres equipped). */
export function shouldApplyStaggeringSwipesTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggeringSwipes;
}

/** Bow LMB stagger; talent toggle only (use with Bow equipped). */
export function shouldApplyStaggerShotTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggerShot;
}

export function shouldApplyDualCoilTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.dualCoil;
}

export function shouldApplyConcentratedVolleyTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.concentratedVolley && isFrostBiteInLoadout(abilityLoadout);
}

export function shouldApplyWrathfulBiteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.wrathfulBite && isFrostBiteInLoadout(abilityLoadout);
}

export function shouldApplyInfernoTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.inferno && isCrossentropyInLoadout(abilityLoadout);
}

export function shouldApplyReaperTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.reaper && isCrossentropyInLoadout(abilityLoadout);
}

/** Toggle only — use with scythe Entropic Bolts; no ability slot requirement. */
export function shouldApplyFrostpathTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.frostPath;
}

/** Toggle only — use with scythe Entropic Bolts; no ability slot requirement. */
export function shouldApplySolarRechargeTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.solarRecharge;
}

/** Toggle only — Spear primary (ControlSystem) only; no F slot requirement. */
export function shouldApplyWindfuryTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.windFury;
}
