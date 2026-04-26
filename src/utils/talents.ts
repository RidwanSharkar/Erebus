import type { AbilityLoadout } from '@/utils/weaponAbilities';
import { Vector3 } from '@/utils/three-exports';
import { WeaponType } from '@/components/dragon/weapons';

export const TALENT_WRATH_STRIKE = 'WRATH_STRIKE' as const;
export const TALENT_INFESTED_STRIKE = 'INFESTED_STRIKE' as const;
export const TALENT_WRATHFUL_TALONS = 'WRATHFUL_TALONS' as const;
export const TALENT_EXECUTE = 'EXECUTE' as const;
export const TALENT_EXPLOSIVE_TALONS = 'EXPLOSIVE_TALONS' as const;
export const TALENT_STORED_CHARGE = 'STORED_CHARGE' as const;
export const TALENT_STAGGERING_STRIKE = 'STAGGERING_STRIKE' as const;
export const TALENT_STAGGERING_COMBO = 'STAGGERING_COMBO' as const;
export const TALENT_STAGGERING_SWIPES = 'STAGGERING_SWIPES' as const;
export const TALENT_TRINITY = 'TRINITY' as const;
export const TALENT_INFESTED_SMITE = 'INFESTED_SMITE' as const;
export const TALENT_STAGGERING_SMITE = 'STAGGERING_SMITE' as const;
export const TALENT_INFERNAL_SMITE = 'INFERNAL_SMITE' as const;
export const TALENT_VENGEANCE = 'VENGEANCE' as const;
export const TALENT_STAGGER_SHOT = 'STAGGER_SHOT' as const;
export const TALENT_CONCENTRATED_VOLLEY = 'CONCENTRATED_VOLLEY' as const;
export const TALENT_WRATHFUL_BITE = 'WRATHFUL_BITE' as const;
export const TALENT_WYVERN_BITE = 'WYVERN_BITE' as const;
export const TALENT_INFERNO = 'INFERNO' as const;
export const TALENT_REAPER = 'REAPER' as const;
export const TALENT_DUAL_COIL = 'DUAL_COIL' as const;
export const TALENT_WYVERN_STING = 'WYVERN_STING' as const;
/** Reaping Talons — detonate remaining Cobra / Concentrated Venom DoT on hit. */
export const TALENT_WYVERN_TALONS = 'WYVERN_TALONS' as const;
export const TALENT_WRAITH_GUARD = 'WRAITH_GUARD' as const;
export const TALENT_FROSTPATH = 'FROSTPATH' as const;
export const TALENT_SOLAR_RECHARGE = 'SOLAR_RECHARGE' as const;
export const TALENT_WINDFURY = 'WINDFURY' as const;
export const TALENT_BLADE_RUSH = 'BLADE_RUSH' as const;
export const TALENT_COLOSSUS_GUARD = 'COLOSSUS_GUARD' as const;
export const TALENT_WRATHFUL_COMBO = 'WRATHFUL_COMBO' as const;
export const TALENT_INFESTED_COMBO = 'INFESTED_COMBO' as const;
export const TALENT_GUARD_COMBO = 'GUARD_COMBO' as const;
export const TALENT_DASH_GUARD = 'DASH_GUARD' as const;
export const TALENT_EXECUTIONER = 'EXECUTIONER' as const;
export const TALENT_DOUBLE_STRIKE = 'DOUBLE_STRIKE' as const;
export const TALENT_CRUSADER = 'CRUSADER' as const;
export const TALENT_BLIZZARD = 'BLIZZARD' as const;
export const TALENT_SPELLBLADE = 'SPELLBLADE' as const;
export const TALENT_TEMPEST_ROUNDS = 'TEMPEST_ROUNDS' as const;
export const TALENT_ICEBEAM = 'ICEBEAM' as const;

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

/** Runeblade Smite — flat self-heal when the beam hits at least one target (stacks with Infested Smite). */
export const RUNEBLADE_SMITE_BASE_HEAL = 10;

/** Reaping Talons — HP healed when each soul fragment returns to the player. */
export const REAPING_TALONS_RETURN_HEAL_PER_ORB = 4;

/** Runeblade — HP healed per successful LMB swing while Storm Shroud (Flurry) is active (Windfury / ability). */
export const RUNEBLADE_FLURRY_HEAL_PER_SLASH = 3;

/** Infernal Smite — Ignite DoT: this fraction of the smite hit damage over INFERNAL_SMITE_DURATION_MS. */
export const INFERNAL_SMITE_DOT_FRACTION = 0.7;
export const INFERNAL_SMITE_DURATION_MS = 3000;
export const INFERNAL_SMITE_TICKS = 3;
/** Infernal Smite — additive critical strike chance on each Smite beam (crit damage multiplier unchanged). */
export const INFERNAL_SMITE_CRIT_CHANCE_ADD = 0.4;

/** Vengeance — Colossus Smite: max extra damage multiplier at 0 HP (+200% → 3× total vs full HP). Linear in missing health fraction. */
export const VENGEANCE_SMITE_MAX_EXTRA_DAMAGE_MULT = 2.5;

export type TalentId =
  | typeof TALENT_WRATH_STRIKE
  | typeof TALENT_INFESTED_STRIKE
  | typeof TALENT_WRATHFUL_TALONS
  | typeof TALENT_EXECUTE
  | typeof TALENT_EXPLOSIVE_TALONS
  | typeof TALENT_STORED_CHARGE
  | typeof TALENT_STAGGERING_STRIKE
  | typeof TALENT_STAGGERING_COMBO
  | typeof TALENT_STAGGERING_SWIPES
  | typeof TALENT_TRINITY
  | typeof TALENT_INFESTED_SMITE
  | typeof TALENT_STAGGERING_SMITE
  | typeof TALENT_INFERNAL_SMITE
  | typeof TALENT_VENGEANCE
  | typeof TALENT_STAGGER_SHOT
  | typeof TALENT_CONCENTRATED_VOLLEY
  | typeof TALENT_WRATHFUL_BITE
  | typeof TALENT_WYVERN_BITE
  | typeof TALENT_INFERNO
  | typeof TALENT_REAPER
  | typeof TALENT_DUAL_COIL
  | typeof TALENT_WYVERN_STING
  | typeof TALENT_WYVERN_TALONS
  | typeof TALENT_WRAITH_GUARD
  | typeof TALENT_FROSTPATH
  | typeof TALENT_SOLAR_RECHARGE
  | typeof TALENT_WINDFURY
  | typeof TALENT_BLADE_RUSH
  | typeof TALENT_COLOSSUS_GUARD
  | typeof TALENT_WRATHFUL_COMBO
  | typeof TALENT_INFESTED_COMBO
  | typeof TALENT_GUARD_COMBO
  | typeof TALENT_DASH_GUARD
  | typeof TALENT_EXECUTIONER
  | typeof TALENT_DOUBLE_STRIKE
  | typeof TALENT_CRUSADER
  | typeof TALENT_BLIZZARD
  | typeof TALENT_SPELLBLADE
  | typeof TALENT_TEMPEST_ROUNDS
  | typeof TALENT_ICEBEAM;

/** Wraith Strike (`RUNEBLADE_E`) base cooldown in seconds (single charge or per-charge recharge with Double Strike). */
export const WRAITH_STRIKE_COOLDOWN_SEC = 4.5;
/** Double Strike — max stored Wraith Strike uses; recharges one charge at a time at `WRAITH_STRIKE_COOLDOWN_SEC`. */
export const WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES = 2;

/** SPELLBLADE — +effective intellect while Wraith Strike is in loadout (+2 max shield per point, see StatSystem). */
export const SPELLBLADE_INTELLECT_BONUS = 10;
export const SPELLBLADE_WRAITH_STRIKE_SHIELD_RESTORE = 30;

/** Modifies Wraith Strike (`RUNEBLADE_E`) when equipped in Q/E/R. */
export const WRATH_STRIKE_CRIT_CHANCE_ADD = 0.5;
export const WRATH_STRIKE_CRIT_DAMAGE_MULT_ADD = 0.5;

/** Reaping Talons (`BOW_R`) return arrow only — preset crit roll in useViperSting. */
export const WRATHFUL_TALONS_RETURN_CRIT_CHANCE_ADD = 0.5;
export const WRATHFUL_TALONS_RETURN_CRIT_DAMAGE_MULT_ADD = 1.0;

/** EXECUTE — Reaping Talons (`BOW_R`) first forward hit: bonus when a dash charge is consumed (useViperSting + Movement). */
export const EXECUTE_REAPING_TALONS_BONUS_DAMAGE = 200;

/** Reaping Talons (`BOW_R`) forward leg max travel in `useViperSting` (return-arrow variant). */
export const REAPING_TALONS_MAX_TRAVEL_DISTANCE = 20;
/** Explosive Talons: shorter forward leg before end-of-range detonation (same hook). */
export const EXPLOSIVE_TALONS_REAPING_TALONS_MAX_TRAVEL_DISTANCE = 13;

/** EXPLOSIVE TALONS — Reaping Talons (`BOW_R`) end-of-range detonation in useViperSting / PVP manager. */
export const EXPLOSIVE_TALONS_EXPLOSION_DAMAGE = 400;
export const EXPLOSIVE_TALONS_EXPLOSION_RADIUS = 4.0;

/** Wrathful Bite — Frostbite / Barrage (`BOW_Q`) hits use these additive crit modifiers in CombatSystem. */
export const WRATHFUL_BITE_BARRAGE_CRIT_CHANCE_ADD = 0.4;
export const WRATHFUL_BITE_BARRAGE_CRIT_DAMAGE_MULT_ADD = 0.75;

/** Wyvern Bite — Concentrated Venom from Barrage hits (co-op server + local ECS). */
export const WYVERN_BITE_CONCENTRATED_VENOM_DPS_PER_STACK = 17;
export const WYVERN_BITE_CONCENTRATED_VENOM_MAX_STACKS = 5;
export const WYVERN_BITE_CONCENTRATED_VENOM_DURATION_SEC = 8;

/** Cobra Shot — impact and venom DPS (same value). */
export const COBRA_SHOT_VENOM_DAMAGE_PER_SECOND = 29;
export const COBRA_SHOT_VENOM_DURATION_SEC = 6;
export const COBRA_SHOT_HIT_DAMAGE = COBRA_SHOT_VENOM_DAMAGE_PER_SECOND;
 
/** Wraith Guard — Wraith Strike (`RUNEBLADE_E`) enemy hits can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const WRAITH_GUARD_PROC_CHANCE = 0.75;
export const WRAITH_GUARD_DURATION_SEC = 2;

/** Colossus Guard — Colossus Smite (`RUNEBLADE_R`) beam hits on PvE enemies can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const COLOSSUS_GUARD_PROC_CHANCE = 1.0;
/** Seconds added to remaining talent shield time per successful proc (cap on remaining). */
export const COLOSSUS_GUARD_STACK_SEC = 2;
export const COLOSSUS_GUARD_MAX_REMAINING_SEC = 6;

/** Wrathful Combo — Runeblade basic 3rd hit only: additive crit chance and crit damage multiplier. */
export const WRATHFUL_COMBO_CRIT_CHANCE_ADD = 0.35;
export const WRATHFUL_COMBO_CRIT_DAMAGE_MULT_ADD = 1.0;

/** Infested Combo — heal fraction of final hit damage dealt (after crit) on each left-click hit. */
export const INFESTED_COMBO_LIFESTEAL = 0.05;

/** Guard Combo — Runeblade basic hits can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const GUARD_COMBO_PROC_CHANCE = 0.25;
export const GUARD_COMBO_DURATION_SEC = 2;

/** Dash Guard — double-tap dash (Movement.startDash) grants Aegis-like barrier + invuln (no Aegis cooldown). */
export const DASH_GUARD_DURATION_SEC = 1.0;

/** EXECUTIONER — after a real dash (Movement.startDash), next Runeblade LMB within this window is treated as combo hit 3. */
export const EXECUTIONER_POST_DASH_WINDOW_MS = 3000;
/** Additive base damage on that EXECUTIONER swing (before crit). */
export const EXECUTIONER_BASE_DAMAGE_ADD = 40;

/** Frostpath — Entropic Bolt (scythe LMB) hits on PvE enemies can proc Coldsnap at impact (no E cooldown). */
export const FROSTPATH_PROC_CHANCE = 0.15;

/** Solar Recharge — Entropic Bolt hits on PvE enemies can proc Sunwell (Reanimate) (no Q cooldown; does not require Sunwell in loadout). */
export const SOLAR_RECHARGE_PROC_CHANCE = 0.15;

/** Windfury — Spear primary or Runeblade left-click combo hits that damage an enemy can proc Storm Shroud (Flurry) without F cooldown. */
export const WINDFURY_PROC_CHANCE = 0.15;

/** Crusader — Runeblade left-click hits that damage an enemy; matches Windfury proc rate. */
export const CRUSADER_PROC_CHANCE = 0.15;
export const CRUSADER_DURATION_SEC = 5;
export const CRUSADER_LMB_FLAT_BONUS = 50;

/** Blizzard — Runeblade LMB hits that damage an enemy; matches Windfury proc rate. */
export const BLIZZARD_PROC_CHANCE = 0.15;
export const BLIZZARD_DURATION_SEC = 7;
export const BLIZZARD_DPS_PER_TICK = 42;
export const CHILL_STACK_DURATION_SEC = 4;
export const CHILL_SLOW_PER_STACK = 0.2;
export const CHILL_STACKS_TO_FREEZE = 5;
export const BLIZZARD_FREEZE_DURATION_SEC = 4;

/** Staggering Strike — Wraith Strike (`RUNEBLADE_E`) builds stagger; at 100, proc lightning + damage + stun. */
export const STAGGERING_STRIKE_WRAITH_STAGGER_ADD = 60;
export const STAGGER_MAX = 100;
export const STAGGER_PROC_DAMAGE = 150;
export const STAGGER_PROC_STUN_SECONDS = 2;

/** Staggering Combo — Runeblade basic attack combo adds stagger per hit (same 100 cap / proc as Staggering Strike). */
export const STAGGERING_COMBO_HIT1_STAGGER = 15;
export const STAGGERING_COMBO_HIT2_STAGGER = 20;
export const STAGGERING_COMBO_HIT3_STAGGER = 25;

/** Staggering Swipes — Sabres basic dual swing: 15 stagger total per swing (split across blades). Same 100 cap / proc as other stagger talents. */
export const STAGGERING_SWIPES_LEFT_BLADE_STAGGER = 10;
export const STAGGERING_SWIPES_RIGHT_BLADE_STAGGER = 10;

/** Staggering Smite — each Colossus Smite beam adds this stagger per enemy hit (same 100 cap / proc as other stagger talents). */
export const STAGGERING_SMITE_BEAM_STAGGER = 40;

/** Stagger Shot — Bow LMB: uncharged, charged, perfect, and Tempest Rounds burst (same 100 cap / proc as other stagger talents). */
export const STAGGER_SHOT_UNCHARGED_STAGGER = 10;
export const STAGGER_SHOT_CHARGED_STAGGER = 25;
export const STAGGER_SHOT_PERFECT_STAGGER = 30;
export const STAGGER_SHOT_TEMPEST_ROUND_STAGGER = 15;

/** Dual Coil — left/right offset for the twin Bow LMB spawns and perfect-shot beams (world units, half the pair’s separation is this distance from center). */
export const DUAL_COIL_LATERAL_OFFSET = 0.16;

/** Wyvern Sting — internal cooldown after a perfect shot procs a bonus Cobra Shot (separate from BOW_E). */
export const WYVERN_STING_COOLDOWN_SEC = 5;

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

export const explosiveTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_EXPLOSIVE_TALONS,
  name: 'EXPLOSIVE TALONS',
  description:
    'While Reaping Talons is in your ability loadout, the forward shot no longer returns. When the shot reaches maximum range, it explodes in a small area for 400 damage. Forward hits still deal normal Reaping Talons damage.',
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

export const vengeanceSmiteTalentDefinition: TalentDefinition = {
  id: TALENT_VENGEANCE,
  name: 'VENGEANCE',
  description:
    'Colossus Smite deals increased damage based on how much health you are missing. The lower your health, the more damage each beam deals, up to +200% extra damage at 0 health.',
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

export const doubleStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_DOUBLE_STRIKE,
  name: 'DOUBLE STRIKE',
  description:
    'While Wraith Strike is in your ability loadout, Wraith Strike holds 2 charges. Each charge has its own 4.5 second cooldown; only one charge recharges at a time.',
  modifiesAbilityId: 'RUNEBLADE_E',
};

export const spellbladeTalentDefinition: TalentDefinition = {
  id: TALENT_SPELLBLADE,
  name: 'SPELLBLADE',
  description:
    'While Wraith Strike is in your ability loadout, gain +10 Intellect (+20 max shield). Each Wraith Strike use restores 30 shield.',
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

export const dashGuardTalentDefinition: TalentDefinition = {
  id: TALENT_DASH_GUARD,
  name: 'DASH GUARD',
  description:
    'Each time you dash (double-tap W/A/S/D), gain 1 second of Aegis deflection and invulnerability. Does not put Aegis on cooldown and does not require Aegis in your loadout. Blade Rush forward uses Charge, not a dash — it does not trigger this talent.',
  modifiesAbilityId: 'RUNEBLADE_DASH',
};

export const executionerTalentDefinition: TalentDefinition = {
  id: TALENT_EXECUTIONER,
  name: 'EXECUTIONER',
  description:
    'After a real dash (double-tap W/A/S/D; not Blade Rush), your next Runeblade left-click within 3 seconds resolves as the third combo hit and deals +25 base damage before critical strikes. Blade Rush does not arm this buff.',
  modifiesAbilityId: 'RUNEBLADE_DASH',
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

export const tempestRoundsTalentDefinition: TalentDefinition = {
  id: TALENT_TEMPEST_ROUNDS,
  name: 'Tempest Rounds',
  description:
    'Replaces bow primary with a rapid burst attack (same behavior as the legacy P passive). Skill-tree / loadout P unlock still works as an alternative.',
  modifiesAbilityId: 'BOW_BASIC',
};

export const icebeamTalentDefinition: TalentDefinition = {
  id: TALENT_ICEBEAM,
  name: 'Icebeam',
  description:
    'Replaces Scythe Entropic Bolt primary with channeled Icebeam on hold LMB (same behavior as the legacy P passive). Skill-tree / loadout P unlock still works as an alternative.',
  modifiesAbilityId: 'SCYTHE_BASIC',
};

export const wyvernStingTalentDefinition: TalentDefinition = {
  id: TALENT_WYVERN_STING,
  name: 'Wyvern Sting',
  description:
    'When you release a perfect-timing bow primary shot, you also fire Cobra Shot: same damage, venom, beam, and VFX as the ability. Does not require Cobra Shot in your loadout. This bonus Cobra Shot has its own 5 second cooldown, separate from the E ability.',
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

export const wyvernBiteTalentDefinition: TalentDefinition = {
  id: TALENT_WYVERN_BITE,
  name: 'WYVERN BITE',
  description:
    'While Frostbite is in your ability loadout, each Barrage arrow hit applies Concentrated Venom: 17 damage per second per stack (max 5 stacks) for 8 seconds, and Barrage arrows use a green theme.',
  modifiesAbilityId: 'BOW_Q',
};

export const wyvernTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_WYVERN_TALONS,
  name: 'Wyvern Talons',
  description:
    'While Reaping Talons is in your ability loadout, each hit detonates active Cobra Shot venom or Wyvern Bite Concentrated Venom: deals all remaining DoT damage instantly and ends the effect.',
  modifiesAbilityId: 'BOW_R',
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
    'Each spear primary attack or Runeblade left-click combo hit that damages an enemy has a 15% chance to grant Storm Shroud (Flurry) for 5 seconds: increased attack speed, tornado VFX, and 15 HP healed per enemy hit. Does not put Storm Shroud (F) on cooldown.',
  modifiesAbilityId: 'SPEAR_F',
};

export const crusaderTalentDefinition: TalentDefinition = {
  id: TALENT_CRUSADER,
  name: 'Crusader',
  description:
    'Each Runeblade left-click combo hit that damages an enemy has a 15% chance to grant Crusader for 5 seconds: +50 base damage to each attack in the chain and corrupted-aura blade colors (F-key Corrupted Aura is unchanged).',
  modifiesAbilityId: 'RUNEBLADE_BASIC',
};

export const blizzardTalentDefinition: TalentDefinition = {
  id: TALENT_BLIZZARD,
  name: 'Blizzard',
  description:
    'Each Runeblade left-click combo hit that damages an enemy has a 15% chance to summon a 7-second ice storm around you: 42 damage per second to nearby enemies. Each tick applies a stack of Chill (20% slow per stack, 4 second refresh); at 5 stacks the target is frozen for 4 seconds.',
  modifiesAbilityId: 'RUNEBLADE_BASIC',
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
  explosiveTalons: boolean;
  storedCharge: boolean;
  trinity: boolean;
  infestedSmite: boolean;
  staggeringSmite: boolean;
  infernalSmite: boolean;
  vengeanceSmite: boolean;
  colossusGuard: boolean;
  staggerShot: boolean;
  concentratedVolley: boolean;
  wrathfulBite: boolean;
  wyvernBite: boolean;
  inferno: boolean;
  reaper: boolean;
  frostPath: boolean;
  solarRecharge: boolean;
  windFury: boolean;
  dualCoil: boolean;
  wyvernSting: boolean;
  wyvernTalons: boolean;
  bladeRush: boolean;
  wrathfulCombo: boolean;
  infestedCombo: boolean;
  guardCombo: boolean;
  dashGuard: boolean;
  executioner: boolean;
  doubleStrike: boolean;
  crusader: boolean;
  blizzard: boolean;
  spellblade: boolean;
  tempestRounds: boolean;
  icebeam: boolean;
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
    explosiveTalons: false,
    storedCharge: false,
    trinity: false,
    infestedSmite: false,
    staggeringSmite: false,
    infernalSmite: false,
    vengeanceSmite: false,
    colossusGuard: false,
    staggerShot: false,
    concentratedVolley: false,
    wrathfulBite: false,
    wyvernBite: false,
    inferno: false,
    reaper: false,
    frostPath: false,
    solarRecharge: false,
    windFury: false,
    dualCoil: false,
    wyvernSting: false,
    wyvernTalons: false,
    bladeRush: false,
    wrathfulCombo: false,
    infestedCombo: false,
    guardCombo: false,
    dashGuard: false,
    executioner: false,
    doubleStrike: false,
    crusader: false,
    blizzard: false,
    spellblade: false,
    tempestRounds: false,
    icebeam: false,
  };
}
// DEFAULT TALENTS DEFAULTTALENTS
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

export function shouldApplyExplosiveTalonsTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.explosiveTalons && isReapingTalonsInLoadout(abilityLoadout);
}

export function shouldApplyWyvernTalonsTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.wyvernTalons && isReapingTalonsInLoadout(abilityLoadout);
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

export function shouldApplyVengeanceSmiteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.vengeanceSmite && isColossusSmiteInLoadout(abilityLoadout);
}

/** Outgoing damage multiplier for Vengeance (1 at full HP, 1+VENGEANCE_SMITE_MAX_EXTRA_DAMAGE_MULT at 0 HP). */
export function getVengeanceSmiteOutgoingDamageMultiplier(currentHealth: number, maxHealth: number): number {
  if (maxHealth <= 0) return 1;
  const hpFrac = Math.max(0, Math.min(1, currentHealth / maxHealth));
  const missingFrac = 1 - hpFrac;
  return 1 + VENGEANCE_SMITE_MAX_EXTRA_DAMAGE_MULT * missingFrac;
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

export function shouldApplyDoubleStrikeTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.doubleStrike && isWraithStrikeInLoadout(abilityLoadout);
}

export function shouldApplySpellbladeTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.spellblade && isWraithStrikeInLoadout(abilityLoadout);
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

/** Dash Guard — double-tap dash on Runeblade; talent toggle only. */
export function shouldApplyDashGuardTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.dashGuard;
}

/** EXECUTIONER — post-dash empowered Runeblade LMB; talent toggle only. */
export function shouldApplyExecutionerTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.executioner;
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

/** Bow perfect-shot bonus Cobra Shot; talent toggle only (use with Bow equipped). */
export function shouldApplyWyvernStingTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.wyvernSting;
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

export function shouldApplyWyvernBiteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.wyvernBite && isFrostBiteInLoadout(abilityLoadout);
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

/** Toggle only — Spear primary or Runeblade combo (ControlSystem + Runeblade.tsx); no F slot requirement. */
export function shouldApplyWindfuryTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.windFury;
}

/** Toggle only — Runeblade LMB (ControlSystem + Runeblade.tsx); no ability slot requirement. */
export function shouldApplyCrusaderTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.crusader;
}

/** Toggle only — Runeblade LMB Blizzard storm (ControlSystem + Runeblade.tsx); no ability slot requirement. */
export function shouldApplyBlizzardTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.blizzard;
}

/** localStorage: after picking the Blade Rush class boon once, future runs offer Stored Charge instead. */
export const EREBUS_META_BLADE_RUSH_BOON_STORAGE_KEY = 'erebus_meta_blade_rush_boon_unlocked';

export function readBladeRushBoonMetaUnlocked(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(EREBUS_META_BLADE_RUSH_BOON_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function writeBladeRushBoonMetaUnlocked(unlocked: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (unlocked) window.localStorage.setItem(EREBUS_META_BLADE_RUSH_BOON_STORAGE_KEY, '1');
    else window.localStorage.removeItem(EREBUS_META_BLADE_RUSH_BOON_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export type CoopRoomColor = 'blue' | 'green' | 'purple' | 'red';

function isCoopRoomColor(s: string | null | undefined): s is CoopRoomColor {
  return s === 'blue' || s === 'green' || s === 'purple' || s === 'red';
}

/** Runeblade class boon pool (v1). Blade Rush is replaced by Stored Charge after meta unlock. */
export function buildRunebladeClassBoonPool(): TalentId[] {
  const rushOrStored = readBladeRushBoonMetaUnlocked() ? TALENT_STORED_CHARGE : TALENT_BLADE_RUSH;
  return [
    TALENT_TRINITY,
    TALENT_VENGEANCE,
    TALENT_CRUSADER,
    TALENT_WINDFURY,
    TALENT_BLIZZARD,
    rushOrStored,
    TALENT_DOUBLE_STRIKE,
    TALENT_SPELLBLADE,
  ];
}

/** Bow class boon pool (co-op). */
export function buildBowClassBoonPool(): TalentId[] {
  return [
    TALENT_EXECUTE,
    TALENT_EXPLOSIVE_TALONS,
    TALENT_CONCENTRATED_VOLLEY,
    TALENT_DUAL_COIL,
    TALENT_TEMPEST_ROUNDS,
  ];
}

/** Scythe class boon pool (co-op). */
export function buildScytheClassBoonPool(): TalentId[] {
  return [TALENT_FROSTPATH, TALENT_ICEBEAM, TALENT_SOLAR_RECHARGE, TALENT_REAPER];
}

export function buildClassBoonPoolForWeapon(weapon: WeaponType): TalentId[] {
  if (weapon === WeaponType.NONE) return [];
  if (weapon === WeaponType.RUNEBLADE) return buildRunebladeClassBoonPool();
  if (weapon === WeaponType.BOW) return buildBowClassBoonPool();
  if (weapon === WeaponType.SCYTHE) return buildScytheClassBoonPool();
  return [];
}

/** Post–first-room boon pool from the camp color of the cleared wave (weapon-specific). */
export function buildRoomBoonPoolForColor(
  color: string | null | undefined,
  weapon: WeaponType,
): TalentId[] {
  const k = String(color ?? '').toLowerCase();
  if (!isCoopRoomColor(k)) return [];

  if (weapon === WeaponType.BOW) {
    switch (k) {
      case 'blue':
        return [TALENT_STAGGER_SHOT];
      case 'green':
        return [];
      case 'purple':
        return [TALENT_WYVERN_STING, TALENT_WYVERN_BITE, TALENT_WYVERN_TALONS];
      case 'red':
        return [TALENT_WRATHFUL_BITE, TALENT_WRATHFUL_TALONS];
      default:
        return [];
    }
  }

  if (weapon === WeaponType.SCYTHE) {
    switch (k) {
      case 'red':
        return [TALENT_INFERNO];
      default:
        return [];
    }
  }

  if (weapon === WeaponType.RUNEBLADE) {
    switch (k) {
      case 'blue':
        return [TALENT_STAGGERING_SMITE, TALENT_STAGGERING_COMBO, TALENT_STAGGERING_STRIKE];
      case 'green':
        return [TALENT_INFESTED_STRIKE, TALENT_INFESTED_SMITE, TALENT_INFESTED_COMBO];
      case 'purple':
        return [TALENT_GUARD_COMBO, TALENT_COLOSSUS_GUARD, TALENT_WRAITH_GUARD, TALENT_DASH_GUARD];
      case 'red':
        return [TALENT_WRATHFUL_COMBO, TALENT_WRATH_STRIKE, TALENT_INFERNAL_SMITE, TALENT_EXECUTIONER];
      default:
        return [];
    }
  }

  return [];
}

/**
 * Picks up to `count` distinct ids from a pool. If the pool is smaller than `count`, returns all in random order.
 * Uses a simple LCG for deterministic tests if `rng` is provided as () => 0-1.
 */
export function pickRandomDistinctFromPool(
  pool: readonly TalentId[],
  count: number = 3,
  rng: () => number = Math.random,
): TalentId[] {
  if (pool.length === 0) return [];
  const n = Math.min(count, pool.length);
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = idx[i]!;
    idx[i] = idx[j]!;
    idx[j] = t;
  }
  return idx.slice(0, n).map((i) => pool[i]!);
}

/**
 * Set exactly one `TalentLoadout` flag to true for the given `TalentId`. Intentionally does not turn off other talents
 * (Hades-style stacking across picks).
 */
export function applyTalentIdToLoadout(prev: TalentLoadout, id: TalentId): TalentLoadout {
  const next: TalentLoadout = { ...prev };
  switch (id) {
    case TALENT_WRATH_STRIKE:
      next.wrathStrike = true;
      return next;
    case TALENT_INFESTED_STRIKE:
      next.infestedStrike = true;
      return next;
    case TALENT_WRATHFUL_TALONS:
      next.wrathfulTalons = true;
      return next;
    case TALENT_EXECUTE:
      next.execute = true;
      return next;
    case TALENT_EXPLOSIVE_TALONS:
      next.explosiveTalons = true;
      return next;
    case TALENT_STORED_CHARGE:
      next.storedCharge = true;
      return next;
    case TALENT_STAGGERING_STRIKE:
      next.staggeringStrike = true;
      return next;
    case TALENT_STAGGERING_COMBO:
      next.staggeringCombo = true;
      return next;
    case TALENT_STAGGERING_SWIPES:
      next.staggeringSwipes = true;
      return next;
    case TALENT_TRINITY:
      next.trinity = true;
      return next;
    case TALENT_INFESTED_SMITE:
      next.infestedSmite = true;
      return next;
    case TALENT_STAGGERING_SMITE:
      next.staggeringSmite = true;
      return next;
    case TALENT_INFERNAL_SMITE:
      next.infernalSmite = true;
      return next;
    case TALENT_VENGEANCE:
      next.vengeanceSmite = true;
      return next;
    case TALENT_STAGGER_SHOT:
      next.staggerShot = true;
      return next;
    case TALENT_CONCENTRATED_VOLLEY:
      next.concentratedVolley = true;
      return next;
    case TALENT_WRATHFUL_BITE:
      next.wrathfulBite = true;
      return next;
    case TALENT_WYVERN_BITE:
      next.wyvernBite = true;
      return next;
    case TALENT_INFERNO:
      next.inferno = true;
      return next;
    case TALENT_REAPER:
      next.reaper = true;
      return next;
    case TALENT_DUAL_COIL:
      next.dualCoil = true;
      return next;
    case TALENT_WYVERN_STING:
      next.wyvernSting = true;
      return next;
    case TALENT_WYVERN_TALONS:
      next.wyvernTalons = true;
      return next;
    case TALENT_WRAITH_GUARD:
      next.wraithGuard = true;
      return next;
    case TALENT_FROSTPATH:
      next.frostPath = true;
      return next;
    case TALENT_SOLAR_RECHARGE:
      next.solarRecharge = true;
      return next;
    case TALENT_WINDFURY:
      next.windFury = true;
      return next;
    case TALENT_BLADE_RUSH:
      next.bladeRush = true;
      return next;
    case TALENT_COLOSSUS_GUARD:
      next.colossusGuard = true;
      return next;
    case TALENT_WRATHFUL_COMBO:
      next.wrathfulCombo = true;
      return next;
    case TALENT_INFESTED_COMBO:
      next.infestedCombo = true;
      return next;
    case TALENT_GUARD_COMBO:
      next.guardCombo = true;
      return next;
    case TALENT_DASH_GUARD:
      next.dashGuard = true;
      return next;
    case TALENT_EXECUTIONER:
      next.executioner = true;
      return next;
    case TALENT_DOUBLE_STRIKE:
      next.doubleStrike = true;
      return next;
    case TALENT_CRUSADER:
      next.crusader = true;
      return next;
    case TALENT_BLIZZARD:
      next.blizzard = true;
      return next;
    case TALENT_SPELLBLADE:
      next.spellblade = true;
      return next;
    case TALENT_TEMPEST_ROUNDS:
      next.tempestRounds = true;
      return next;
    case TALENT_ICEBEAM:
      next.icebeam = true;
      return next;
    default:
      return next;
  }
}

const BOON_TALENT_DEFINITIONS: Partial<Record<TalentId, TalentDefinition>> = {
  [TALENT_WRATH_STRIKE]: wrathStrikeTalentDefinition,
  [TALENT_INFESTED_STRIKE]: infestedStrikeTalentDefinition,
  [TALENT_STAGGERING_STRIKE]: staggeringStrikeTalentDefinition,
  [TALENT_STAGGERING_COMBO]: staggeringComboTalentDefinition,
  [TALENT_STAGGERING_SWIPES]: staggeringSwipesTalentDefinition,
  [TALENT_TRINITY]: trinityTalentDefinition,
  [TALENT_INFESTED_SMITE]: infestedSmiteTalentDefinition,
  [TALENT_STAGGERING_SMITE]: staggeringSmiteTalentDefinition,
  [TALENT_INFERNAL_SMITE]: infernalSmiteTalentDefinition,
  [TALENT_VENGEANCE]: vengeanceSmiteTalentDefinition,
  [TALENT_WRAITH_GUARD]: wraithGuardTalentDefinition,
  [TALENT_FROSTPATH]: frostPathTalentDefinition,
  [TALENT_SOLAR_RECHARGE]: solarRechargeTalentDefinition,
  [TALENT_WINDFURY]: windFuryTalentDefinition,
  [TALENT_BLADE_RUSH]: bladeRushTalentDefinition,
  [TALENT_STORED_CHARGE]: storedChargeTalentDefinition,
  [TALENT_COLOSSUS_GUARD]: colossusGuardTalentDefinition,
  [TALENT_WRATHFUL_COMBO]: wrathfulComboTalentDefinition,
  [TALENT_INFESTED_COMBO]: infestedComboTalentDefinition,
  [TALENT_GUARD_COMBO]: guardComboTalentDefinition,
  [TALENT_DASH_GUARD]: dashGuardTalentDefinition,
  [TALENT_EXECUTIONER]: executionerTalentDefinition,
  [TALENT_DOUBLE_STRIKE]: doubleStrikeTalentDefinition,
  [TALENT_CRUSADER]: crusaderTalentDefinition,
  [TALENT_BLIZZARD]: blizzardTalentDefinition,
  [TALENT_WRATHFUL_TALONS]: wrathfulTalonsTalentDefinition,
  [TALENT_EXECUTE]: executeTalentDefinition,
  [TALENT_EXPLOSIVE_TALONS]: explosiveTalonsTalentDefinition,
  [TALENT_STAGGER_SHOT]: staggerShotTalentDefinition,
  [TALENT_CONCENTRATED_VOLLEY]: concentratedVolleyTalentDefinition,
  [TALENT_WRATHFUL_BITE]: wrathfulBiteTalentDefinition,
  [TALENT_WYVERN_BITE]: wyvernBiteTalentDefinition,
  [TALENT_INFERNO]: infernoTalentDefinition,
  [TALENT_REAPER]: reaperTalentDefinition,
  [TALENT_DUAL_COIL]: dualCoilTalentDefinition,
  [TALENT_WYVERN_STING]: wyvernStingTalentDefinition,
  [TALENT_WYVERN_TALONS]: wyvernTalonsTalentDefinition,
  [TALENT_SPELLBLADE]: spellbladeTalentDefinition,
  [TALENT_TEMPEST_ROUNDS]: tempestRoundsTalentDefinition,
  [TALENT_ICEBEAM]: icebeamTalentDefinition,
};

/** UI copy for co-op 3-boon picks (falls back to id if missing). */
export function getTalentBoonDefinition(id: TalentId): TalentDefinition | null {
  return BOON_TALENT_DEFINITIONS[id] ?? null;
}
