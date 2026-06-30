import type { AbilityLoadout } from '@/utils/weaponAbilities';
import { Vector3 } from '@/utils/three-exports';
import { WeaponType } from '@/components/dragon/weapons';
import type { Entity } from '@/ecs/Entity';
import { Shield } from '@/ecs/components/Shield';
import type { PlayerStats } from '@/utils/StatSystem';

export const TALENT_WRATH_STRIKE = 'WRATH_STRIKE' as const;
export const TALENT_INFESTED_STRIKE = 'INFESTED_STRIKE' as const;
export const TALENT_WRATHFUL_TALONS = 'WRATHFUL_TALONS' as const;
export const TALENT_EXECUTE = 'EXECUTE' as const;
export const TALENT_EXPLOSIVE_TALONS = 'EXPLOSIVE_TALONS' as const;
export const TALENT_CYCLONE_RUSH = 'CYCLONE_RUSH' as const;
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
export const TALENT_ENTANGLEMENT = 'ENTANGLEMENT' as const;
export const TALENT_INFERNO = 'INFERNO' as const;
export const TALENT_REAPER = 'REAPER' as const;
/** Crossentropy (`SCYTHE_R`) talent: 50% on-hit meteor proc from randomized sky origin. */
export const TALENT_METEOR = 'METEOR' as const;
/** Crossentropy (`SCYTHE_R`) talent: 50% on-hit ricochet to another enemy within range. */
export const TALENT_FRAGMENTATION = 'FRAGMENTATION' as const;
export const TALENT_DUAL_COIL = 'DUAL_COIL' as const;
/** Bow — slower full LMB charge but stronger powershot / perfect shot and thicker perfect beam VFX. */
export const TALENT_HIGH_CALIBER = 'HIGH_CALIBER' as const;
export const TALENT_WYVERN_STING = 'WYVERN_STING' as const;
/** Reaping Talons — detonate remaining Cobra / Concentrated Venom DoT on hit. */
export const TALENT_WYVERN_TALONS = 'WYVERN_TALONS' as const;
/** Bow purple room — perfect shot spawns Arctic Shards–style blizzard on first hit (ICD). */
export const TALENT_ARCTIC_STING = 'ARCTIC_STING' as const;
/** Bow purple room — Barrage chill stacks (Frostbite equipped). */
export const TALENT_GLACIAL_BITE = 'GLACIAL_BITE' as const;
/** Bow purple room — Reaping Talons vs frozen (E equipped). */
export const TALENT_GLACIAL_TALONS = 'GLACIAL_TALONS' as const;
export const TALENT_WRAITH_GUARD = 'WRAITH_GUARD' as const;
export const TALENT_FROSTPATH = 'FROSTPATH' as const;
export const TALENT_SOLAR_RECHARGE = 'SOLAR_RECHARGE' as const;
/** Scythe class talent — Entropic Bolt base damage scales with Intellect; faster fire rate. */
export const TALENT_ARCANE_SYNERGY = 'ARCANE_SYNERGY' as const;
export const TALENT_WINDFURY = 'WINDFURY' as const;
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
export const TALENT_BREATH_WEAPON = 'BREATH_WEAPON' as const;
/** Runeblade class talent — every 4th LMB swing fires a Mortal Strike arc slash. */
export const TALENT_MORTAL_STRIKE = 'MORTAL_STRIKE' as const;
export const TALENT_STAGGERING_BITE = 'STAGGERING_BITE' as const;
export const TALENT_STAGGERING_TALONS = 'STAGGERING_TALONS' as const;
export const TALENT_WRATHFUL_SHOTS = 'WRATHFUL_SHOTS' as const;
/** Scythe LMB Entropic Bolt + Icebeam paired boons (mutex with each other). */
export const TALENT_WRATHFUL_ENTROPIC = 'WRATHFUL_ENTROPIC' as const;
export const TALENT_STAGGERING_ENTROPIC = 'STAGGERING_ENTROPIC' as const;
export const TALENT_INFESTING_ENTROPIC = 'INFESTING_ENTROPIC' as const;
/** Mantra (Summon Totem, `SCYTHE_F`): bolt tint + stagger / crit / zombies (mutex with each other). */
export const TALENT_WRATHFUL_TOTEM = 'WRATHFUL_TOTEM' as const;
export const TALENT_STAGGERING_TOTEM = 'STAGGERING_TOTEM' as const;
export const TALENT_INFESTING_TOTEM = 'INFESTING_TOTEM' as const;
/** Crossentropy (`SCYTHE_R`) room boon: blue stagger theme + VFX. */
export const TALENT_CROSSENTROPY_TEMPEST = 'CROSSENTROPY_TEMPEST' as const;
/** Crossentropy (`SCYTHE_R`) room boon: green damage theme + VFX. */
export const TALENT_CROSSENTROPY_PLAGUE = 'CROSSENTROPY_PLAGUE' as const;
/** Purple room — Entropic LMB: deep blue bolts; 15% hit proc concentrated blizzard. */
export const TALENT_ARCTIC_SHARDS = 'ARCTIC_SHARDS' as const;
/** Purple room — Crossentropy: deep blue (unless Inferno); each hit spawns blizzard + coldsnap. */
export const TALENT_GLACIAL_STORM = 'GLACIAL_STORM' as const;
/** Purple room — Mantra totem: deep blue bolts; double damage vs frozen; chill on hit. */
export const TALENT_FROST_TOTEM = 'FROST_TOTEM' as const;
/** SHAMAN — extra Mantra (`SCYTHE_F`) charge (same staggered recharge as Double Strike). */
export const TALENT_SHAMAN = 'SHAMAN' as const;
/** Superconductor — Mantra totems periodically arc lightning at their current target. */
export const TALENT_SUPERCONDUCTOR = 'SUPERCONDUCTOR' as const;
/** Accelerator — while Mantra + Crossentropy are in loadout: faster Crossentropy cooldown near your totems. */
export const TALENT_ACCELERATOR = 'ACCELERATOR' as const;
/** Giantkiller — Reaping Talons (`BOW_R`): return hit on a target also hit by the forward leg deals extra % max HP damage. */
export const TALENT_GIANTKILLER = 'GIANTKILLER' as const;
/** Bow class — LMB minimum charge damage 10 → 40; uncharged projectile VFX tint red. */
export const TALENT_TRIGGER_FINGER = 'TRIGGER_FINGER' as const;
/** Bow class — LMB primary hits have a 20% chance to rain 4–8 poison arrows on the struck enemy. */
export const TALENT_CLOUDKILL = 'CLOUDKILL' as const;
/** Bow class boon — Reaping Talons (`BOW_R`) holds 2 staggered charges (same pattern as Double Stab). */
export const TALENT_DOUBLE_TALONS = 'DOUBLE_TALONS' as const;
/** Healing Stream — while Mantra totems (`SCYTHE_F`) are up: heal per second per owned totem within horizontal range (same radius as ACCELERATOR). */
export const TALENT_HEALING_STREAM = 'HEALING_STREAM' as const;

/** Sabres Backstab (`SABRES_Q`) room boons — mutex with each other. */
export const TALENT_STAGGERING_STAB = 'STAGGERING_STAB' as const;
export const TALENT_WRATHFUL_STAB = 'WRATHFUL_STAB' as const;
/** Killing an enemy with Backstab raises a zombie — same rules as Infested Strike; not INFESTED_STRIKE (Runeblade E). */
export const TALENT_INFESTED_BACKSTAB = 'INFESTED_BACKSTAB' as const;
/** Sabres LMB room boons — mutex with staggering swipes line. */
export const TALENT_WRATHFUL_SABRES_SWIPES = 'WRATHFUL_SABRES_SWIPES' as const;
export const TALENT_INFESTING_SABRES_SWIPES = 'INFESTING_SABRES_SWIPES' as const;
/** Sabres Flourish (`SABRES_E`) room boons — mutex with each other. */
export const TALENT_STAGGERING_FLOURISH = 'STAGGERING_FLOURISH' as const;
export const TALENT_WRATHFUL_FLOURISH = 'WRATHFUL_FLOURISH' as const;
export const TALENT_INFESTED_FLOURISH = 'INFESTED_FLOURISH' as const;
/** Sabres purple room — LMB each blade can proc shared Aegis-like shield (mutex with other swipe room boons). */
export const TALENT_GUARD_SABRES_SWIPES = 'GUARD_SABRES_SWIPES' as const;
/** Sabres purple room — Backstab hits proc shield (mutex with other Backstab room boons). */
export const TALENT_GUARD_SABRES_STAB = 'GUARD_SABRES_STAB' as const;
/** Sabres purple room — Flourish / Sunder hits proc shield (mutex with other Flourish room boons). */
export const TALENT_GUARD_SABRES_FLOURISH = 'GUARD_SABRES_FLOURISH' as const;
/** Sabres class talent — every 3rd swing fires a 150-damage crescent slash AoE; stacks freely with other boons. */
export const TALENT_CRESCENT_BLADES = 'CRESCENT_BLADES' as const;
/** Sabres class talent — every LMB swing fires a forward wind slash projectile for 40 damage (first hit only). */
export const TALENT_WIND_SHEAR = 'WIND_SHEAR' as const;
/** Sabres class talent — each LMB blade hit procs bonus psionic damage scaled by Intellect. */
export const TALENT_PSIONIC_BLADES = 'PSIONIC_BLADES' as const;

/** Sabres class boons — Backstab (`SABRES_Q`) session stacking / on-kill (see room boons for palette picks). */
export const TALENT_KILLSTREAK = 'KILLSTREAK' as const;
export const TALENT_RELENTLESS = 'RELENTLESS' as const;
/** Sabres class boon — Backstab becomes a forward piercing wind gust beam. */
export const TALENT_VORPAL_GUST = 'VORPAL_GUST' as const;
/** Sabres class boon — Flourish (`SABRES_E`) casts a fan of three Shade-style daggers forward. */
export const TALENT_FAN_OF_KNIVES = 'FAN_OF_KNIVES' as const;
/** Sabres class boon — Flourish shield restore on cast + passive STR/INT. */
export const TALENT_PARRY = 'PARRY' as const;
/** Sabres class boon — Backstab (`SABRES_Q`) holds 2 staggered charges (same pattern as Double Strike). */
export const TALENT_DOUBLE_STAB = 'DOUBLE_STAB' as const;

/** Backstab (`SABRES_Q`) base cooldown in seconds (single charge or per-charge recharge with Double Stab). */
export const BACKSTAB_COOLDOWN_SEC = 3.875;
/** Double Stab — max stored Backstab uses; recharges one charge at a time at `BACKSTAB_COOLDOWN_SEC`. */
export const BACKSTAB_DOUBLE_STAB_MAX_CHARGES = 2;
/** Double Stab — minimum gap between spending charges (same staggered pattern as SHAMAN Mantra). */
export const BACKSTAB_DOUBLE_STAB_INTERNAL_COOLDOWN_SEC = 0.75;

/** Wind Shear — projectile tuning (local + replicated). */
export const WIND_SHEAR_BASE_DAMAGE = 36;
export const WIND_SHEAR_DAMAGE_PER_STRENGTH = 3;
export const WIND_SHEAR_MAX_DISTANCE_UNITS = 8;
/** Psionic Blades — flat proc damage per blade hit + Intellect scaling. */
export const PSIONIC_BLADES_BASE_DAMAGE = 10;
export const PSIONIC_BLADES_DAMAGE_PER_INTELLECT = 2;
export const WIND_SHEAR_PROJECTILE_SPEED = 32;
export const WIND_SHEAR_PROJECTILE_LIFETIME_SEC = 3;

/** Fan of Knives — projectile tuning (local + replicated). */
export const FAN_OF_KNIVES_BASE_DAMAGE = 25;
export const FAN_OF_KNIVES_DAMAGE_PER_AGILITY = 3;
export const FAN_OF_KNIVES_MAX_DISTANCE_UNITS = 7;
export const FAN_OF_KNIVES_PROJECTILE_SPEED = 32;
export const FAN_OF_KNIVES_PROJECTILE_LIFETIME_SEC = 3;

/** VFX palette key for Fan of Knives tint (from Flourish room boons + default). */
export type FanOfKnivesFlourishTint = 'default' | 'staggering' | 'wrathful' | 'infested' | 'guard';

/** Green co-op room: affects any player zombie raised by infesting / Wyvern / etc.; weapon-agnostic. */
export const TALENT_PACK_HUNTER = 'PACK_HUNTER' as const;
export const TALENT_BERSERKER_STRAIN = 'BERSERKER_STRAIN' as const;
export const TALENT_JUGGERNAUT_STRAIN = 'JUGGERNAUT_STRAIN' as const;
export const TALENT_EXPLODER_STRAIN = 'EXPLODER_STRAIN' as const;
/** Weapon-agnostic colored room dash boons — mutually exclusive for the run. */
export const TALENT_INFERNAL_DASH = 'INFERNAL_DASH' as const;
export const TALENT_GLACIAL_DASH = 'GLACIAL_DASH' as const;
export const TALENT_MENDING_DASH = 'MENDING_DASH' as const;
export const TALENT_STAGGERING_DASH = 'STAGGERING_DASH' as const;
/** Weapon-agnostic colored room combat boons. */
export const TALENT_GUARDBREAK = 'GUARDBREAK' as const;
export const TALENT_OVERSHOCK = 'OVERSHOCK' as const;
export const TALENT_UNSTABLE_ENERGY = 'UNSTABLE_ENERGY' as const;
export const TALENT_BLOODLEECH = 'BLOODLEECH' as const;
/** Red room universal passive — retaliate with fire when taking damage from an enemy. */
export const TALENT_REBUKE = 'REBUKE' as const;
/** Green room universal active boon — instant zombie summon on R key (15s cooldown). */
export const TALENT_RAISE_DEAD = 'RAISE_DEAD' as const;
/** Red room universal active boon — calls down a meteor on a nearby target on R key (8s cooldown). */
export const TALENT_METEOR_STRIKE = 'METEOR_STRIKE' as const;
/** Purple room universal active boon — conjures an ice vortex that freezes nearby enemies on R key (12s cooldown). */
export const TALENT_COLDSNAP_ROOM = 'COLDSNAP_ROOM' as const;
/** Blue room universal active boon — calls down a lightning bolt on the highest-priority enemy on R key (3s cooldown). */
export const TALENT_LIGHTNING_BOLT_ROOM = 'LIGHTNING_BOLT_ROOM' as const;
/** Purple room universal active boon — manually cast Aegis deflect + invulnerability on R key (8s cooldown). */
export const TALENT_AEGIS_ROOM = 'AEGIS_ROOM' as const;
/** Purple room universal passive — restore a dash charge when taking damage from an enemy. */
export const TALENT_MOMENTUM_RIFT = 'MOMENTUM_RIFT' as const;
/** Purple room universal passive — restore shield when expending a dash charge (scales with Intellect). */
export const TALENT_MANA_SHIELD = 'MANA_SHIELD' as const;
/** Green room universal passive — spend a dash charge to heal when taking damage from an enemy. */
export const TALENT_ORB_SHIELD = 'ORB_SHIELD' as const;

/** Cyclone Rush — double-tap forward Charge on Runeblade; separate from E-key Charge cooldown. */
export const CYCLONE_RUSH_CHARGE_COOLDOWN_SEC = 3;
/** RAISE DEAD active boon — cooldown after summoning a zombie via R key. */
export const RAISE_DEAD_COOLDOWN_SEC = 15;
/** METEOR active boon — cooldown after calling a meteor via R key. */
export const METEOR_STRIKE_COOLDOWN_SEC = 8;
/** AEGIS room boon — cooldown after manually casting Aegis via R key. */
export const AEGIS_ROOM_COOLDOWN_SEC = 8;
/** AEGIS room boon — deflect + invulnerability duration (seconds). */
export const AEGIS_ROOM_DURATION_SEC = 3;
/** MANA SHIELD room boon — shield restored per effective Intellect per dash charge spent. */
export const MANA_SHIELD_RESTORE_PER_INTELLECT = 2;

export const INFERNAL_DASH_DAMAGE = 195;
export const INFERNAL_DASH_RADIUS = 3.25;
/** REBUKE room boon — burst damage on the attacking enemy. */
export const REBUKE_DAMAGE = 200;
/** REBUKE — Ignite DoT: this fraction of the burst damage over REBUKE_IGNITE_DURATION_MS. */
export const REBUKE_IGNITE_DOT_FRACTION = 0.95;
export const REBUKE_IGNITE_DURATION_MS = 4000;
export const REBUKE_IGNITE_TICKS = 4;
/** REBUKE — min seconds between procs when repeatedly taking damage. */
export const REBUKE_ICD_SEC = 2.5;
/** ORB SHIELD room boon — flat heal on proc before Stamina scaling. */
export const ORB_SHIELD_BASE_HEAL = 50;
/** ORB SHIELD — min seconds between procs when repeatedly taking damage. */
export const ORB_SHIELD_ICD_SEC = 3;
export const GLACIAL_DASH_RADIUS = 3.0;
export const GLACIAL_DASH_FREEZE_DURATION_MS = 3000;
export const GLACIAL_DASH_COOLDOWN_MS = 1000;
export const MENDING_DASH_COOLDOWN_MS = 7000;
export const STAGGERING_DASH_RANGE = 10;
export const STAGGERING_DASH_MIN_DAMAGE = 100;
export const STAGGERING_DASH_MAX_DAMAGE = 240;
export const STAGGERING_DASH_MIN_STAGGER = 80;
export const STAGGERING_DASH_MAX_STAGGER = 135;
export const STAGGERING_DASH_COOLDOWN_MS = 200;
/** Blue room Lightning Bolt (`SPEAR_R`) — fixed hit damage and stagger. */
export const LIGHTNING_BOLT_ROOM_DAMAGE = 117;
export const LIGHTNING_BOLT_ROOM_STAGGER = 75;
/** GUARDBREAK room boon — stagger lightning proc damage (base is `STAGGER_PROC_DAMAGE`). */
export const GUARDBREAK_STAGGER_PROC_DAMAGE = 300;
/** OVERSHOCK room boon — stagger lightning proc stun duration (base is `STAGGER_PROC_STUN_SECONDS`). */
export const OVERSHOCK_STAGGER_PROC_STUN_SECONDS = 2.5;
/** UNSTABLE ENERGY room boon — stagger lightning proc base damage per Agility point. */
export const UNSTABLE_ENERGY_AGILITY_DAMAGE_PER_POINT = 8;

/** Crossentropy (`SCYTHE_R`) ability cooldown after starting a bolt (seconds). */
export const CROSSENTROPY_COOLDOWN_SEC = 8;
/** Accelerator — horizontal distance (xz) within which each owned totem counts toward Crossentropy recharge. */
export const ACCELERATOR_TOTEM_AURA_RADIUS_UNITS = 5;

/** GIANTKILLER — extra damage vs non-boss: fraction of target max HP on Reaping Talons return hit after a forward hit on the same target. */
export const GIANTKILLER_MAX_HP_DAMAGE_FRAC = 0.15;
/** GIANTKILLER — same vs bosses (`EnemyType.BOSS`, including co-op boss variants mapped to BOSS). */
export const GIANTKILLER_MAX_HP_DAMAGE_FRAC_BOSS = 0.1;
/**
 * HEALING STREAM — HP healed per second per owned totem in range.
 * Range matches `ACCELERATOR_TOTEM_AURA_RADIUS_UNITS` (horizontal xz).
 */
export const HEALING_STREAM_HP_PER_SEC_PER_TOTEM = 2;

/** Crossentropy (`SCYTHE_R`) base hit damage before Reaper stack bonus. */
export const CROSSENTROPY_BASE_DAMAGE = 335;
/** PLAGUE boon: Crossentropy base hit damage before Reaper stack bonus. */
export const CROSSENTROPY_PLAGUE_DAMAGE = 500;
/** PLAGUE Crossentropy — ground venom-style VFX at explosion (matches VenomEffect one-shot ms). */
export const CROSSENTROPY_PLAGUE_VENOM_MS = 2000;
/** TEMPEST boon: stagger added per Crossentropy hit. */
export const CROSSENTROPY_TEMPEST_STAGGER = 100;
/** METEOR talent — weighted strike count on each eligible Crossentropy impact. */
export const CROSSENTROPY_METEOR_SINGLE_CHANCE = 0.8;
export const CROSSENTROPY_METEOR_DOUBLE_CHANCE = 0.15;
export const CROSSENTROPY_METEOR_TRIPLE_CHANCE = 0.05;
/** METEOR talent — delay between sequential meteor calls from one Crossentropy hit. */
export const CROSSENTROPY_METEOR_STAGGER_MS = 500;
/** METEOR talent — AoE damage at meteor impact. */
export const CROSSENTROPY_METEOR_DAMAGE = 240;
/** METEOR talent — horizontal AoE radius in world units. */
export const CROSSENTROPY_METEOR_AOE_RADIUS = 2.99;
/** METEOR talent — minimum randomized horizontal spawn offset from impact center. */
export const CROSSENTROPY_METEOR_SKY_OFFSET_MIN = 2.5;
/** METEOR talent — maximum randomized horizontal spawn offset from impact center. */
export const CROSSENTROPY_METEOR_SKY_OFFSET_MAX = 8;
/** METEOR talent — randomized spawn height range in world units. */
export const CROSSENTROPY_METEOR_SKY_HEIGHT_MIN = 44;
export const CROSSENTROPY_METEOR_SKY_HEIGHT_MAX = 66;
/** METEOR talent — warning ring lead-in before meteor appears. */
export const CROSSENTROPY_METEOR_WARNING_MS = 100;
/** METEOR talent — meteor travel speed toward impact point. */
export const CROSSENTROPY_METEOR_SPEED = 31;

export function rollCrossentropyMeteorStrikeCount(): 1 | 2 | 3 {
  const roll = Math.random();
  if (roll < CROSSENTROPY_METEOR_SINGLE_CHANCE) return 1;
  if (roll < CROSSENTROPY_METEOR_SINGLE_CHANCE + CROSSENTROPY_METEOR_DOUBLE_CHANCE) return 2;
  return 3;
}
/** Cloudkill (`BOW_BASIC` class boon) — per-hit proc chance on LMB primary enemy hits. */
export const CLOUDKILL_PROC_CHANCE = 0.2;
/** Cloudkill — damage per falling arrow impact. */
export const CLOUDKILL_DAMAGE = 35;
/** Cloudkill — AoE radius at each arrow impact (horizontal). */
export const CLOUDKILL_AOE_RADIUS = 1.5;
/** Cloudkill — minimum arrows per proc volley. */
export const CLOUDKILL_ARROW_COUNT_MIN = 4;
/** Cloudkill — maximum arrows per proc volley. */
export const CLOUDKILL_ARROW_COUNT_MAX = 8;
/** Cloudkill — delay between sequential arrows in one volley. */
export const CLOUDKILL_ARROW_DELAY_MS = 125;
/** Cloudkill — arrow fall speed (units per second). */
export const CLOUDKILL_ARROW_SPEED = 26.5;
/** Cloudkill — warning ring duration before arrow appears (ms). */
export const CLOUDKILL_WARNING_MS = 100;
/** Cloudkill — sky spawn height min above target. */
export const CLOUDKILL_SKY_HEIGHT_MIN = 50;
/** Cloudkill — sky spawn height max above target. */
export const CLOUDKILL_SKY_HEIGHT_MAX = 70;

export function rollCloudkillArrowCount(): number {
  return (
    CLOUDKILL_ARROW_COUNT_MIN +
    Math.floor(Math.random() * (CLOUDKILL_ARROW_COUNT_MAX - CLOUDKILL_ARROW_COUNT_MIN + 1))
  );
}
/** FRAGMENTATION talent — per-hit proc chance to bounce a second Crossentropy bolt. */
export const CROSSENTROPY_FRAGMENTATION_PROC_CHANCE = 0.5;
/** FRAGMENTATION talent — horizontal (xz) max distance from struck enemy to ricochet target. */
export const CROSSENTROPY_FRAGMENTATION_NEAR_RADIUS_UNITS = 15;
/** FRAGMENTATION talent — Entropic Bolt: proc chance for 3rd target (after guaranteed 2nd). */
export const ENTROPIC_FRAGMENTATION_SECOND_HOP_CHANCE = 0.5;
/** FRAGMENTATION talent — Entropic Bolt: proc chance for 4th target (after 3rd). */
export const ENTROPIC_FRAGMENTATION_THIRD_HOP_CHANCE = 0.3;

/** Whether an Entropic Bolt fragmentation chain should spawn the next hop (hop 0 → always). */
export function shouldEntropicFragmentationChain(fragmentHop: number): boolean {
  if (fragmentHop === 0) return true;
  if (fragmentHop === 1) return Math.random() < ENTROPIC_FRAGMENTATION_SECOND_HOP_CHANCE;
  if (fragmentHop === 2) return Math.random() < ENTROPIC_FRAGMENTATION_THIRD_HOP_CHANCE;
  return false;
}
/** Reaper: +1 base damage per enemy kill (session). */
export const CROSSENTROPY_REAPER_DAMAGE_PER_KILL = 5;
/** Killstreak (Sabres): +base Backstab damage per Backstab kill this session (server-synced in co-op). */
export const BACKSTAB_KILLSTREAK_DAMAGE_PER_KILL = 25;
/** Relentless (Sabres): base HP healed when Backstab kills an enemy. */
export const RELENTLESS_BACKSTAB_KILL_BASE = 30;
/** Relentless (Sabres): additional HP healed per point of Stamina (all sources). */
export const RELENTLESS_BACKSTAB_KILL_HEAL_PER_STAMINA = 5;
/** Vorpal Gust — piercing beam along horizontal camera forward (XZ). */
export const VORPAL_GUST_BEAM_LENGTH = 6;
export const VORPAL_GUST_BEAM_RADIUS = 1;
export const VORPAL_GUST_BEAM_ORIGIN_FORWARD_OFFSET = 0.5;
/** Beam VFX origin height in DragonUnit local space (weapon root; ~bow/chest). */
export const VORPAL_GUST_BEAM_ORIGIN_Y_LOCAL = 0.9;

/**
 * Horizontal beam hit-test for Vorpal Gust (shared by ControlSystem + co-op remote damage).
 * `forward` is typically camera world direction; XZ component is normalized for the ray.
 */
export function evaluateVorpalGustBeamHit(
  origin: Vector3,
  forward: Vector3,
  targetXZ: Vector3,
): { ok: boolean; t: number } {
  let fx = forward.x;
  let fz = forward.z;
  const flen = Math.hypot(fx, fz);
  if (flen < 1e-8) {
    return { ok: false, t: 0 };
  }
  fx /= flen;
  fz /= flen;
  const ox = origin.x + fx * VORPAL_GUST_BEAM_ORIGIN_FORWARD_OFFSET;
  const oz = origin.z + fz * VORPAL_GUST_BEAM_ORIGIN_FORWARD_OFFSET;
  const dx = targetXZ.x - ox;
  const dz = targetXZ.z - oz;
  const t = dx * fx + dz * fz;
  if (t <= 0 || t > VORPAL_GUST_BEAM_LENGTH) {
    return { ok: false, t };
  }
  const px = dx - t * fx;
  const pz = dz - t * fz;
  const dist = Math.hypot(px, pz);
  return { ok: dist <= VORPAL_GUST_BEAM_RADIUS, t };
}

/** Beam segment length (world units) at max range treated as tip (Explosive Talons-style end-zone). */
export const VORPAL_GUST_TIP_ZONE_WORLD_UNITS = 1.5;
/** Minimum projected `t` from `evaluateVorpalGustBeamHit` to count as hitting near the gust tip. */
export const VORPAL_GUST_TIP_ZONE_START = VORPAL_GUST_BEAM_LENGTH - VORPAL_GUST_TIP_ZONE_WORLD_UNITS;
/** Tip zone: non-positional hit base (normally 95). */
export const BACKSTAB_VORPAL_TIP_DAMAGE_FRONT = 333;
/** Tip zone: positional Backstab vs PvE (normally 285). */
export const BACKSTAB_VORPAL_TIP_DAMAGE_BACKSTAB = 666;
/** Tip zone: positional Backstab vs PvP tier (normally 175), scaled vs PvE 285→420 uplift. */
export const BACKSTAB_VORPAL_TIP_DAMAGE_BACKSTAB_PVP = Math.round((BACKSTAB_VORPAL_TIP_DAMAGE_BACKSTAB * 175) / 285);

export function isVorpalGustTipHit(t: number): boolean {
  return t >= VORPAL_GUST_TIP_ZONE_START;
}

/** Reaper: HP healed to the caster per enemy hit by piercing Crossentropy (client-applied; excludes training dummy in co-op). */
export const CROSSENTROPY_REAPER_HIT_HEAL = 2;
/**
 * Max world units the Crossentropy bolt travels (matches legacy VFX in CrossentropyBolt).
 * Reaper uses this for ECS `maxDistance` so the pierce line does not outrange normal Crossentropy.
 */
export const CROSSENTROPY_MAX_TRAVEL_DISTANCE = 20;

/** Arctic Shards — Entropic hit chance to spawn concentrated blizzard. */
export const ARCTIC_SHARDS_PROC_CHANCE = 0.15;
/** Arctic Shards — fixed entropic bolt damage (purple room LMB line). */
export const ARCTIC_ENTROPIC_BOLT_DAMAGE = 36;
/** Arctic / Glacial ground blizzard — duration at fixed point (seconds). */
export const ARCTIC_BLIZZARD_DURATION_SEC = 6;
/** Damage tick interval for concentrated arctic blizzard (ms). */
export const ARCTIC_BLIZZARD_TICK_MS = 500;
export const ARCTIC_BLIZZARD_DAMAGE_PER_TICK = 30;
/** XZ radius for arctic ground blizzard ticks. */
export const ARCTIC_BLIZZARD_HIT_RADIUS = 3;
/** At 5 chill stacks from arctic blizzard ticks — freeze duration (seconds). */
export const ARCTIC_CHILL_FREEZE_DURATION_SEC = 4;

/** Boss / boss-skeleton — max freeze duration (seconds); longer CC is clamped. */
export const BOSS_MAX_FREEZE_DURATION_SEC = 1;
export const BOSS_MAX_FREEZE_DURATION_MS = BOSS_MAX_FREEZE_DURATION_SEC * 1000;

/** Scythe Q — Sunwell (Reanimate) self-heal and ally heal amount (HP). */
export const REANIMATE_SUNWELL_HEAL = 15;

/** Scythe Q — Sunwell (Reanimate) cooldown in seconds. */
export const REANIMATE_SUNWELL_COOLDOWN_SEC = 5;

/** Infested Smite — heal per enemy hit per Smite beam. */
export const INFESTED_SMITE_HEAL_PER_TARGET = 10;

/** Runeblade Smite — flat self-heal when the beam hits at least one target (stacks with Infested Smite). */
export const RUNEBLADE_SMITE_BASE_HEAL = 10;

/** Reaping Talons — HP healed when each soul fragment returns to the player. */
export const REAPING_TALONS_RETURN_HEAL_PER_ORB = 4;

/** Runeblade — HP healed per successful LMB swing while Storm Shroud (Flurry) is active (Windfury / ability). */
export const RUNEBLADE_FLURRY_HEAL_PER_SLASH = 2;

/** Runeblade only: `effectiveFireRate /=` this while Flurry is active (Spear/Sword use 1.5). */
export const RUNEBLADE_FLURRY_ATTACK_SPEED_FACTOR = 1.35;

/** Min ms between Flurry heal floating VFX (ControlSystem). */
export const FLURRY_HEAL_VFX_MIN_INTERVAL_MS = 300;
/** Min ms between flurry heal damage numbers and co-op healing broadcast. */
export const FLURRY_HEAL_NUMBER_MIN_INTERVAL_MS = 350;

/** Infernal Smite — Ignite DoT: this fraction of the smite hit damage over INFERNAL_SMITE_DURATION_MS. */
export const INFERNAL_SMITE_DOT_FRACTION = 0.70;
export const INFERNAL_SMITE_DURATION_MS = 4000;
export const INFERNAL_SMITE_TICKS = 4;
/** Infernal Smite — additive critical strike chance on each Smite beam (crit damage multiplier unchanged). */
export const INFERNAL_SMITE_CRIT_CHANCE_ADD = 0.2;

/** Vengeance — Colossus Smite: max extra damage multiplier at 0 HP (+200% → 3× total vs full HP). Linear in missing health fraction. */
export const VENGEANCE_SMITE_MAX_EXTRA_DAMAGE_MULT = 2.5;

export type TalentId =
  | typeof TALENT_WRATH_STRIKE
  | typeof TALENT_INFESTED_STRIKE
  | typeof TALENT_WRATHFUL_TALONS
  | typeof TALENT_EXECUTE
  | typeof TALENT_EXPLOSIVE_TALONS
  | typeof TALENT_CYCLONE_RUSH
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
  | typeof TALENT_ENTANGLEMENT
  | typeof TALENT_INFERNO
  | typeof TALENT_REAPER
  | typeof TALENT_METEOR
  | typeof TALENT_FRAGMENTATION
  | typeof TALENT_DUAL_COIL
  | typeof TALENT_HIGH_CALIBER
  | typeof TALENT_WYVERN_STING
  | typeof TALENT_WYVERN_TALONS
  | typeof TALENT_ARCTIC_STING
  | typeof TALENT_GLACIAL_BITE
  | typeof TALENT_GLACIAL_TALONS
  | typeof TALENT_WRAITH_GUARD
  | typeof TALENT_FROSTPATH
  | typeof TALENT_SOLAR_RECHARGE
  | typeof TALENT_ARCANE_SYNERGY
  | typeof TALENT_WINDFURY
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
  | typeof TALENT_ICEBEAM
  | typeof TALENT_BREATH_WEAPON
  | typeof TALENT_MORTAL_STRIKE
  | typeof TALENT_STAGGERING_BITE
  | typeof TALENT_STAGGERING_TALONS
  | typeof TALENT_WRATHFUL_SHOTS
  | typeof TALENT_WRATHFUL_ENTROPIC
  | typeof TALENT_STAGGERING_ENTROPIC
  | typeof TALENT_INFESTING_ENTROPIC
  | typeof TALENT_WRATHFUL_TOTEM
  | typeof TALENT_STAGGERING_TOTEM
  | typeof TALENT_INFESTING_TOTEM
  | typeof TALENT_CROSSENTROPY_TEMPEST
  | typeof TALENT_CROSSENTROPY_PLAGUE
  | typeof TALENT_ARCTIC_SHARDS
  | typeof TALENT_GLACIAL_STORM
  | typeof TALENT_FROST_TOTEM
  | typeof TALENT_SHAMAN
  | typeof TALENT_SUPERCONDUCTOR
  | typeof TALENT_ACCELERATOR
  | typeof TALENT_GIANTKILLER
  | typeof TALENT_DOUBLE_TALONS
  | typeof TALENT_TRIGGER_FINGER
  | typeof TALENT_CLOUDKILL
  | typeof TALENT_HEALING_STREAM
  | typeof TALENT_STAGGERING_STAB
  | typeof TALENT_WRATHFUL_STAB
  | typeof TALENT_INFESTED_BACKSTAB
  | typeof TALENT_WRATHFUL_SABRES_SWIPES
  | typeof TALENT_INFESTING_SABRES_SWIPES
  | typeof TALENT_STAGGERING_FLOURISH
  | typeof TALENT_WRATHFUL_FLOURISH
  | typeof TALENT_INFESTED_FLOURISH
  | typeof TALENT_GUARD_SABRES_SWIPES
  | typeof TALENT_GUARD_SABRES_STAB
  | typeof TALENT_GUARD_SABRES_FLOURISH
  | typeof TALENT_CRESCENT_BLADES
  | typeof TALENT_WIND_SHEAR
  | typeof TALENT_PSIONIC_BLADES
  | typeof TALENT_KILLSTREAK
  | typeof TALENT_RELENTLESS
  | typeof TALENT_VORPAL_GUST
  | typeof TALENT_FAN_OF_KNIVES
  | typeof TALENT_PARRY
  | typeof TALENT_DOUBLE_STAB
  | typeof TALENT_PACK_HUNTER
  | typeof TALENT_BERSERKER_STRAIN
  | typeof TALENT_JUGGERNAUT_STRAIN
  | typeof TALENT_EXPLODER_STRAIN
  | typeof TALENT_INFERNAL_DASH
  | typeof TALENT_GLACIAL_DASH
  | typeof TALENT_MENDING_DASH
  | typeof TALENT_STAGGERING_DASH
  | typeof TALENT_GUARDBREAK
  | typeof TALENT_OVERSHOCK
  | typeof TALENT_UNSTABLE_ENERGY
  | typeof TALENT_BLOODLEECH
  | typeof TALENT_REBUKE
  | typeof TALENT_RAISE_DEAD
  | typeof TALENT_METEOR_STRIKE
  | typeof TALENT_COLDSNAP_ROOM
  | typeof TALENT_LIGHTNING_BOLT_ROOM
  | typeof TALENT_AEGIS_ROOM
  | typeof TALENT_MOMENTUM_RIFT
  | typeof TALENT_MANA_SHIELD
  | typeof TALENT_ORB_SHIELD;

/** Crossentropy bolt / explosion palette (Inferno overrides Glacial / Tempest / Plague). */
export type CrossentropyVisualTheme = 'default' | 'inferno' | 'tempest' | 'plague' | 'glacial';

/** Mantra totem bolt visual + damage tuning (exclusive in boon UX). */
export type TotemBoltVariant = 'wrathful' | 'staggering' | 'infesting' | 'frost';

/** Scythe entropic room boon bolt kind (LMB). */
export type EntropicBoltBoonKind = 'wrathful' | 'staggering' | 'infesting' | 'arctic';

/** Wraith Strike (`RUNEBLADE_E`) base cooldown in seconds (single charge or per-charge recharge with Double Strike). */
export const WRAITH_STRIKE_COOLDOWN_SEC = 4.5;
/** Double Strike — max stored Wraith Strike uses; recharges one charge at a time at `WRAITH_STRIKE_COOLDOWN_SEC`. */
export const WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES = 2;

/** SHAMAN — max stored Mantra (`SCYTHE_F`) uses; recharges one charge at a time at summon totem cooldown (see ControlSystem `summonTotemFireRate`). */
export const MANTRA_SHAMAN_MAX_CHARGES = 2;
/** SHAMAN — minimum delay between spending stored Mantra charges. */
export const MANTRA_SHAMAN_INTERNAL_COOLDOWN_SEC = 0.75;
/** Superconductor — bonus Mantra totem lightning damage. */
export const SUPERCONDUCTOR_TOTEM_DAMAGE = 90;
/** Superconductor + Infesting Totem — shock base damage before crit. */
export const SUPERCONDUCTOR_INFESTING_DAMAGE = 125;
/** Superconductor + Staggering Totem — stagger per shock (totem bolts use `STAGGERING_TOTEM_STAGGER`). */
export const SUPERCONDUCTOR_STAGGERING_STRIKE_STAGGER = 15;
/** Superconductor + Wrathful Totem — additive crit chance on shock (crit damage multiplier unchanged). */
export const SUPERCONDUCTOR_WRATHFUL_CRIT_CHANCE_ADD = 0.5;
/** Superconductor — seconds between bonus lightning casts per totem. */
export const SUPERCONDUCTOR_TOTEM_COOLDOWN_SEC = 1.75;

/** SPELLBLADE — +effective intellect while Wraith Strike is in loadout (+2 max shield per point, see StatSystem). */
export const SPELLBLADE_INTELLECT_BONUS = 10;
export const SPELLBLADE_WRAITH_STRIKE_SHIELD_RESTORE = 36;
/** SPELLBLADE — additive Wraith Strike base damage per effective Intellect (allocated + Spellblade bonus). */
export const SPELLBLADE_WRAITH_DAMAGE_PER_INTELLECT = 3;

/** Sabres PARRY — +effective intellect / strength while Flourish (`SABRES_E`) is in loadout (same derived-stat plumbing as Spellblade); shield chunk on Flourish cast. */

export const PARRY_INTELLECT_BONUS = 10;
export const PARRY_STRENGTH_BONUS = 10;
export const PARRY_FLOURISH_SHIELD_RESTORE = 35;

/** Aftershock (talent id `BREATH_WEAPON`) — Wraith Strike ground strip; detonation after delay. */
export const BREATH_WEAPON_DAMAGE = 125;
export const AFTERSHOCK_STRIP_LENGTH = 7.5;
export const AFTERSHOCK_DETONATION_DELAY_MS = 1000;
/** Lateral distance from strip centerline (XZ) for hit and VFX width. */
export const AFTERSHOCK_STRIP_HALF_WIDTH = 1;
/** Rounded end-cap radius for ground strip VFX. */
export const AFTERSHOCK_STRIP_CORNER_RADIUS = 0.45;
/** Time for eruption wave to travel from cast origin to strip far end (ms). */
export const AFTERSHOCK_ERUPTION_WAVE_MS = 400;
/** Infested Strike — bonus Aftershock detonation damage. */
export const AFTERSHOCK_INFESTED_DAMAGE_BONUS = 100;
/** Wraith Guard — bonus Aftershock detonation damage. */
export const AFTERSHOCK_GUARD_DAMAGE_BONUS = 50;
/** Wrathful Strike — additive crit chance on Aftershock detonation. */
export const AFTERSHOCK_WRATHFUL_CRIT_CHANCE_ADD = 0.8;
/** Staggering Strike — stagger applied per enemy hit by Aftershock detonation. */
export const AFTERSHOCK_STAGGERING_STAGGER = 50;

/** Modifies Wraith Strike (`RUNEBLADE_E`) when equipped in Q/E/R. */
export const WRATH_STRIKE_CRIT_CHANCE_ADD = 0.5;
export const WRATH_STRIKE_CRIT_DAMAGE_MULT_ADD = 0.5;

/** Reaping Talons (`BOW_R`) return arrow only — preset crit roll in useViperSting. */
export const WRATHFUL_TALONS_RETURN_CRIT_CHANCE_ADD = 0.5;
export const WRATHFUL_TALONS_RETURN_CRIT_DAMAGE_MULT_ADD = 1.0;
/** Wrathful Talons + Explosive Talons — end-of-range detonation preset crit (chance only). */
export const WRATHFUL_TALONS_EXPLOSION_CRIT_CHANCE_ADD = 0.3;

/** EXECUTE — Reaping Talons (`BOW_R`) first forward hit: bonus when a dash charge is consumed (useViperSting + Movement). */
export const EXECUTE_REAPING_TALONS_BONUS_DAMAGE = 220;

/** Reaping Talons (`BOW_R`) forward leg max travel in `useViperSting` (return-arrow variant). */
export const REAPING_TALONS_MAX_TRAVEL_DISTANCE = 20;
/** Explosive Talons: shorter forward leg before end-of-range detonation (same hook). */
export const EXPLOSIVE_TALONS_REAPING_TALONS_MAX_TRAVEL_DISTANCE = 13;

/** EXPLOSIVE TALONS — Reaping Talons (`BOW_R`) end-of-range detonation in useViperSting / PVP manager. */
export const EXPLOSIVE_TALONS_EXPLOSION_DAMAGE = 400;
export const EXPLOSIVE_TALONS_EXPLOSION_RADIUS = 4.0;

/** Reaping Talons (`BOW_R`) base cooldown in seconds (single charge or per-charge recharge with Double Talons). */
export const REAPING_TALONS_COOLDOWN_SEC = 7.0;
/** Double Talons — max stored Reaping Talons uses; recharges one charge at a time at `REAPING_TALONS_COOLDOWN_SEC`. */
export const REAPING_TALONS_DOUBLE_TALONS_MAX_CHARGES = 2;
/** Double Talons — minimum gap between spending charges (same staggered pattern as SHAMAN Mantra). */
export const REAPING_TALONS_DOUBLE_TALONS_INTERNAL_COOLDOWN_SEC = 0.75;

/** Bow LMB tap (uncharged primary) base damage without Trigger Finger. */
export const BOW_UNCHARGED_PROJECTILE_DAMAGE = 10;
/** Bow LMB tap base damage with Trigger Finger class talent. */
export const BOW_TRIGGER_FINGER_UNCHARGED_DAMAGE = 50;

/** Wrathful Bite — Frostbite / Barrage (`BOW_Q`) hits use these additive crit modifiers in CombatSystem. */
export const WRATHFUL_BITE_BARRAGE_CRIT_CHANCE_ADD = 0.4;
export const WRATHFUL_BITE_BARRAGE_CRIT_DAMAGE_MULT_ADD = 0.75;

/** Wyvern Bite — Concentrated Venom from Barrage hits (co-op server + local ECS). */
export const WYVERN_BITE_CONCENTRATED_VENOM_DPS_PER_STACK = 31;
export const WYVERN_BITE_CONCENTRATED_VENOM_MAX_STACKS = 5;
export const WYVERN_BITE_CONCENTRATED_VENOM_DURATION_SEC = 8;

/** Entanglement — Barrage hits root the target and squeeze for fixed damage. */
export const ENTANGLEMENT_DURATION_MS = 5000;
export const ENTANGLEMENT_DAMAGE_PER_SECOND = 20;

/** Cobra Shot — impact and venom DPS (same value). */
export const COBRA_SHOT_VENOM_DAMAGE_PER_SECOND = 29;
export const COBRA_SHOT_VENOM_DURATION_SEC = 6;
export const COBRA_SHOT_HIT_DAMAGE = COBRA_SHOT_VENOM_DAMAGE_PER_SECOND;

/** Wyvern Sting — Cobra venom DPS scales with allocated Intellect while talent is active. */
export const WYVERN_STING_VENOM_BASE_DPS = COBRA_SHOT_VENOM_DAMAGE_PER_SECOND;
export const WYVERN_STING_VENOM_PER_INTELLECT = 3;

export function getWyvernStingVenomDamagePerSecond(allocatedIntellect: number): number {
  return WYVERN_STING_VENOM_BASE_DPS + WYVERN_STING_VENOM_PER_INTELLECT * Math.max(0, allocatedIntellect);
}

export function getWyvernStingVenomMaxBurst(allocatedIntellect: number): number {
  return getWyvernStingVenomDamagePerSecond(allocatedIntellect) * COBRA_SHOT_VENOM_DURATION_SEC;
}
 
/** Wraith Guard — Wraith Strike (`RUNEBLADE_E`) enemy hits can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const WRAITH_GUARD_PROC_CHANCE = 1.0;
export const WRAITH_GUARD_DURATION_SEC = 2.25;

/** Colossus Guard — Colossus Smite (`RUNEBLADE_R`) beam hits on PvE enemies can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const COLOSSUS_GUARD_PROC_CHANCE = 1.0;
/** Seconds added to remaining talent shield time per successful proc (cap on remaining). */
export const COLOSSUS_GUARD_STACK_SEC = 3;
export const COLOSSUS_GUARD_MAX_REMAINING_SEC = 6;

/** Wrathful Combo — Runeblade basic 3rd hit only: additive crit chance and crit damage multiplier. */
export const WRATHFUL_COMBO_CRIT_CHANCE_ADD = 0.40;
export const WRATHFUL_COMBO_CRIT_DAMAGE_MULT_ADD = 1.25;

/** Infested Combo — heal fraction of final hit damage dealt (after crit) on each left-click hit. */
export const INFESTED_COMBO_LIFESTEAL = 0.02;

/** Guard Combo — Runeblade basic hits can proc Aegis-like barrier + invuln (no Aegis cooldown). */
export const GUARD_COMBO_PROC_CHANCE = 0.35;
export const GUARD_COMBO_DURATION_SEC = 4;

/** Guard Sabres Swipes — each LMB blade (`sabre_left` / `sabre_right`) rolls independently (see ControlSystem). */
export const GUARD_SABRES_SWIPES_PROC_CHANCE = 0.2;
/** Sabres purple guard shield duration (shared barrier channel for swipe / stab / flourish procs). */
export const GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC = WRAITH_GUARD_DURATION_SEC;

/** Dash Guard — double-tap dash (Movement.startDash) grants Aegis-like barrier + invuln (no Aegis cooldown). */
export const DASH_GUARD_DURATION_SEC = 2.0;

/** EXECUTIONER — after a real dash (Movement.startDash), next Runeblade LMB within this window is treated as combo hit 3. */
export const EXECUTIONER_POST_DASH_WINDOW_MS = 4000;
/** Additive base damage on that EXECUTIONER swing (before crit), before Strength scaling. */
export const EXECUTIONER_BASE_DAMAGE_ADD = 70;
/** EXECUTIONER — flat damage per point of effective Strength (inventory + talent bonuses). */
export const EXECUTIONER_DAMAGE_PER_STRENGTH = 3;

export function getExecutionerFlatDamageBonus(effectiveStrength: number): number {
  return EXECUTIONER_BASE_DAMAGE_ADD + EXECUTIONER_DAMAGE_PER_STRENGTH * Math.max(0, effectiveStrength);
}

/** Frostpath — Entropic Bolt (scythe LMB) hits on PvE enemies can proc Coldsnap at impact (no E cooldown). */
export const FROSTPATH_PROC_CHANCE = 0.125;

/** Solar Recharge — Entropic Bolt hits on PvE enemies can proc Sunwell (Reanimate) (no Q cooldown; does not require Sunwell in loadout). */
export const SOLAR_RECHARGE_PROC_CHANCE = 0.135;

/** Min wall-clock ms between successful Frostpath Coldsnap execution or Solar Recharge Sunwell proc (separate per talent). */
export const FROST_SOLAR_PROC_EFFECT_ICD_MS = 2500;

/** Windfury — Spear primary or Runeblade left-click combo hits that damage an enemy can proc Storm Shroud (Flurry) without F cooldown. */
export const WINDFURY_PROC_CHANCE = 0.15;

/** Crusader — Runeblade left-click hits that damage an enemy; matches Windfury proc rate. */
export const CRUSADER_PROC_CHANCE = 0.1625;
export const CRUSADER_DURATION_SEC = 5;
export const CRUSADER_LMB_FLAT_BONUS = 55;

/** Blizzard — Runeblade LMB hits that damage an enemy; matches Windfury proc rate. */
export const BLIZZARD_PROC_CHANCE = 0.175;
export const BLIZZARD_DURATION_SEC = 7;
export const BLIZZARD_DPS_PER_TICK = 42;
/** World units: enemies within this radius (XZ, see Blizzard.tsx) of the storm center take tick damage; ≥ melee arc range so LMB hits align with storm. */
export const BLIZZARD_STORM_HIT_RADIUS = 4.5;
export const CHILL_STACK_DURATION_SEC = 4;
export const CHILL_SLOW_PER_STACK = 0.15;
export const CHILL_STACKS_TO_FREEZE = 6;
export const BLIZZARD_FREEZE_DURATION_SEC = 6;

/** Mortal Strike — Runeblade class talent: every Nth LMB swing fires a forward arc slash. */
export const MORTAL_STRIKE_BASE_DAMAGE = 120;
export const MORTAL_STRIKE_ATTACK_INTERVAL = 4;
export const MORTAL_STRIKE_RANGE = 4.75;
export const MORTAL_STRIKE_ARC_ANGLE = Math.PI / 2;
export const MORTAL_STRIKE_WRATHFUL_CRIT_CHANCE_ADD = 0.5;
export const MORTAL_STRIKE_STAGGERING_DAMAGE = 135;
export const MORTAL_STRIKE_STAGGERING_STAGGER = 35;
export const MORTAL_STRIKE_INFESTED_DAMAGE = 185;
export const MORTAL_STRIKE_GUARD_DAMAGE = 240;

export type MortalStrikeTheme = 'default' | 'wrathful' | 'staggering' | 'infested' | 'wraith_guard';

/** Staggering Strike — Wraith Strike (`RUNEBLADE_E`) builds stagger; at 100, proc lightning + damage + stun. */
export const STAGGERING_STRIKE_WRAITH_STAGGER_ADD = 80;
/** Non-boss PvE: stagger needed for lightning proc + stun (co-op server must match). */
export const STAGGER_MAX = 100;
/** Co-op bosses (`boss`, `boss2`, `boss3`): same proc at this buildup (see `backend/gameRoom.js`). */
export const STAGGER_MAX_BOSS = 300;
export const STAGGER_PROC_DAMAGE = 150;
export const STAGGER_PROC_STUN_SECONDS = 1.25;

/** Staggering Combo — Runeblade basic attack combo adds stagger per hit (same 100 cap / proc as Staggering Strike). */
export const STAGGERING_COMBO_HIT1_STAGGER = 15;
export const STAGGERING_COMBO_HIT2_STAGGER = 20;
export const STAGGERING_COMBO_HIT3_STAGGER = 25;

/** Staggering Swipes — Sabres basic dual swing: 15 stagger total per swing (split across blades). Same 100 cap / proc as other stagger talents. */
export const STAGGERING_SWIPES_LEFT_BLADE_STAGGER = 12;
export const STAGGERING_SWIPES_RIGHT_BLADE_STAGGER = 13;

/** Staggering Stab — Backstab applies this stagger server-side (`damageType` `backstab`). */
export const STAGGERING_STAB_BACKSTAB_STAGGER = 80;
/** Wrathful Stab — Backstab additive crit (see `calculateDamage`). */
export const WRATHFUL_STAB_CRIT_CHANCE_ADD = 0.3;
export const WRATHFUL_STAB_CRIT_DAMAGE_MULT_ADD = 0.8;
/** Wrathful Sabres Swipes — LMB dual blades additive crit (see `calculateDamage`). */
export const WRATHFUL_SABRES_SWIPES_CRIT_CHANCE_ADD = 0.2;
export const WRATHFUL_SABRES_SWIPES_CRIT_DAMAGE_MULT_ADD = 1.0;
/** Infesting Swipes — non-stealth LMB base damage (left / right sabre); stealth branch unchanged in ControlSystem. */
export const INFESTING_SABRES_SWIPES_LEFT_DAMAGE = 37;
export const INFESTING_SABRES_SWIPES_RIGHT_DAMAGE = 31;

/** Staggering Flourish — Sunder (`damageType` `sunder`) stagger server-side. */
export const STAGGERING_FLOURISH_STAGGER = 40;
/** Wrathful Flourish — Flourish additive crit (see `calculateDamage` in ControlSystem). */
export const WRATHFUL_FLOURISH_CRIT_CHANCE_ADD = 0.35;
export const WRATHFUL_FLOURISH_CRIT_DAMAGE_MULT_ADD = 0.15;

/** Staggering Smite — each Colossus Smite beam adds this stagger per enemy hit (same 100 cap / proc as other stagger talents). */
export const STAGGERING_SMITE_BEAM_STAGGER = 100;

/** Stagger Shot — Bow LMB: uncharged, charged, perfect, and Tempest Rounds burst (same 100 cap / proc as other stagger talents). */
export const STAGGER_SHOT_UNCHARGED_STAGGER = 10;
export const STAGGER_SHOT_CHARGED_STAGGER = 25;
export const STAGGER_SHOT_PERFECT_STAGGER = 30;
export const STAGGER_SHOT_TEMPEST_ROUND_STAGGER = 10;

/** Staggering Bite — each Barrage arrow (Frostbite) adds this stagger. Same 100 cap / proc as other stagger talents. */
export const STAGGERING_BITE_BARRAGE_STAGGER_PER_HIT = 20;
/** Staggering Talons — Reaping Talons forward and return hits. */
export const STAGGERING_TALONS_HIT_STAGGER = 50;
/** Staggering Talons + Explosive Talons — end-of-range detonation AoE hit. */
export const STAGGERING_TALONS_EXPLOSION_STAGGER = 70;
/** Wrathful Shots — perfect-timing bow primary only. */
export const WRATHFUL_SHOTS_PERFECT_CRIT_CHANCE_ADD = 0.4;
export const WRATHFUL_SHOTS_PERFECT_CRIT_DAMAGE_MULT_ADD = 0.65;
/** Wrathful Shots — Tempest Rounds burst arrows. */
export const WRATHFUL_SHOTS_TEMPEST_CRIT_CHANCE_ADD = 0.2;
export const WRATHFUL_SHOTS_TEMPEST_CRIT_DAMAGE_MULT_ADD = 0.2;

/** Dual Coil — left/right offset for the twin Bow LMB spawns and perfect-shot beams (world units, half the pair’s separation is this distance from center). */
export const DUAL_COIL_LATERAL_OFFSET = 0.16;

/** Wyvern Sting — internal cooldown after a perfect shot procs a bonus Cobra Shot (separate from BOW_E). */
export const WYVERN_STING_COOLDOWN_SEC = 5;
/** Arctic Sting — min seconds between perfect-shot blizzard spawns. */
export const ARCTIC_STING_BLIZZARD_ICD_SEC = 4;

/** Wrathful Entropic — bolts + beam additive crit (crit damage multiplier unchanged). */
export const WRATHFUL_ENTROPIC_BOLT_CRIT_CHANCE_ADD = 0.25;
export const WRATHFUL_ENTROPIC_BEAM_CRIT_CHANCE_ADD = 0.3;
/** Staggering Entropic — bolt hit stagger and beam tick stagger (same cap/proc as other stagger talents). */
export const STAGGERING_ENTROPIC_BOLT_STAGGER = 15;
export const STAGGERING_ENTROPIC_BEAM_STAGGER_PER_TICK = 5;
/** Infesting Entropic — bolt base damage when talent active; beam heal on kill. */
export const INFESTING_ENTROPIC_BOLT_DAMAGE = 53;
export const INFESTED_ENTROPIC_BEAM_KILL_HEAL = 5;
/** Entropic Bolt — default LMB fire interval (seconds between bolts). */
export const ENTROPIC_BOLT_FIRE_RATE_SEC = 0.725;
/** Arcane Synergy — faster Entropic Bolt fire interval. */
export const ARCANE_SYNERGY_ENTROPIC_BOLT_FIRE_RATE_SEC = 0.5;
/** Arcane Synergy — additive base damage per effective Intellect on Entropic Bolt. */
export const ARCANE_SYNERGY_ENTROPIC_BOLT_DAMAGE_PER_INTELLECT = 2;
/** Staggering Totem — stagger per bolt hit (`enemy-damage` entropic stagger path). */
export const STAGGERING_TOTEM_STAGGER = 10;

/** Wider lateral offset at hit point so paired floating damage numbers read side-by-side. */
export const DUAL_COIL_DAMAGE_NUMBER_LATERAL_OFFSET = 0.35;

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
    'Wraith Strike gains +20% critical strike chance and +50% critical strike damage.',
  modifiesAbilityId: 'Wraith Strike (Q)',
};

export const infestedStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_STRIKE,
  name: 'Infested Strike',
  description:
    'Wraith Strike gains increased base damage; killing an enemy with Wraith Strike raises a ZOMBIE ally for 30s (max 3).',
  modifiesAbilityId: 'Wraith Strike (E)',
};

export const wrathfulTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_TALONS,
  name: 'Wrathful Talons',
  description:
    'Reaping Talons\' backward return arrow gains +50% critical strike chance and +100% critical strike damage.',
  modifiesAbilityId: 'Reaping Talons (E)',
};

export const executeTalentDefinition: TalentDefinition = {
  id: TALENT_EXECUTE,
  name: 'Execute',
  description:
    'Reaping Talons\' forward arrow hit consumes one available DASH CHARGE to deal an additional 200 damage.',
  modifiesAbilityId: 'Reaping Talons (E)',
};

export const explosiveTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_EXPLOSIVE_TALONS,
  name: 'Explosive Talons',
  description:
    'Reaping Talons\' forward shot no longer returns. When the shot reaches maximum range, it explodes in a small area for 400 damage.',
  modifiesAbilityId: 'Reaping Talons (E)',
};

export const cycloneRushTalentDefinition: TalentDefinition = {
  id: TALENT_CYCLONE_RUSH,
  name: 'Cyclone Rush',
  description:
    'Double-tapping W to dash forward performs a whirlwind spin with your Runeblade, dealing damage to enemies 4 times.',
  modifiesAbilityId: 'Forward Dash (double-tap W)',
};

export const trinityTalentDefinition: TalentDefinition = {
  id: TALENT_TRINITY,
  name: 'Trinity',
  description:
    'Smite consumes up to two available DASH CHARGES to call up to two additional strikes at nearby points during the same cast.',
  modifiesAbilityId: 'Colossus Strike (R)',
};

export const infestedSmiteTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_SMITE,
  name: 'Infested Smite',
  description:
    'Each Smite beam heals you for 5 health per enemy hit by that beam. Killing an enemy with Smite raises a ZOMBIE ally for 30s (max 3)..',
  modifiesAbilityId: 'Colossus Strike (R)',
};

export const staggeringSmiteTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_SMITE,
  name: 'Tempest Smite',
  description:
    'Each Smite beam applies stagger to enemies hit by that beam. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Colossus Strike (R)',
};

export const infernalSmiteTalentDefinition: TalentDefinition = {
  id: TALENT_INFERNAL_SMITE,
  name: 'Infernal Smite',
  description:
    'Each Smite beam gains +50% critical strike chance and applies IGNITE: dealing bonus damage equal to 80% of that beam’s hit damage over 4 seconds.',
  modifiesAbilityId: 'Colossus Strike (R)',
};

export const vengeanceSmiteTalentDefinition: TalentDefinition = {
  id: TALENT_VENGEANCE,
  name: 'Vengeance',
  description:
    'Smite deals increased damage based on how much health you are missing. The lower your health, the more damage each beam deals, up to +200% extra damage.',
  modifiesAbilityId: 'Colossus Strike (R)',
};

export const colossusGuardTalentDefinition: TalentDefinition = {
  id: TALENT_COLOSSUS_GUARD,
  name: 'Colossus Guard',
  description:
    'Hitting an enemy with Smite now grants Aegis INVULNERABILITY for 3 seconds per beam hit.',
  modifiesAbilityId: 'Colossus Strike (R)',
};

export const staggeringStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_STRIKE,
  name: 'Storm Strike',
  description:
    'Wraith Strike now applies stagger to enemies. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Wraith Strike (Q)',
};

export const wraithGuardTalentDefinition: TalentDefinition = {
  id: TALENT_WRAITH_GUARD,
  name: 'Wraith Guard',
  description:
    'Wraith Strike now grants 2 seconds of Aegis INVULNERABILITY when it hits an enemy.',
  modifiesAbilityId: 'Wraith Strike (Q)',
};

export const doubleStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_DOUBLE_STRIKE,
  name: 'Death Knight',
  description:
    'Wraith Strike now holds 2 charges for use.',
  modifiesAbilityId: 'Wraith Strike (Q)',
};

export const shamanTalentDefinition: TalentDefinition = {
  id: TALENT_SHAMAN,
  name: 'Shaman',
  description:
    'Mantra now holds 2 charges for use.',
  modifiesAbilityId: 'Mantra (Q)',
};

export const superconductorTalentDefinition: TalentDefinition = {
  id: TALENT_SUPERCONDUCTOR,
  name: 'Superconductor',
  description:
    'Mantra Totems now continuiously zaps targets with lightning for 90 damage.',
  modifiesAbilityId: 'Mantra (Q)',
};

export const acceleratorTalentDefinition: TalentDefinition = {
  id: TALENT_ACCELERATOR,
  name: 'Accelerator',
  description:
    'Crossentropy recharges faster for each nearby Totem. Each Totem in range doubles the recharge rate of Crossentropy, up to 6 seconds faster.',
  modifiesAbilityId: 'Mantra (Q)',
};

export const giantKillerTalentDefinition: TalentDefinition = {
  id: TALENT_GIANTKILLER,
  name: 'Giantkiller',
  description:
    'Reaping Talons\' return shot deals additional damage equal to 15% of the target\'s maximum health (10% on bosses).',
  modifiesAbilityId: 'Reaping Talons (E)',
};

export const doubleTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_DOUBLE_TALONS,
  name: 'Falcon Aspect',
  description:
    'Reaping Talons now holds 2 charges for use.',
  modifiesAbilityId: 'Reaping Talons (E)',
};

export const healingStreamTalentDefinition: TalentDefinition = {
  id: TALENT_HEALING_STREAM,
  name: 'HEALING STREAM',
  description:
    'You heal 2 HP per second for each of your Totems within range.',
  modifiesAbilityId: 'Mantra (Q)',
};

export const spellbladeTalentDefinition: TalentDefinition = {
  id: TALENT_SPELLBLADE,
  name: 'Spellblade',
  description:
    'Wraith Strike now deals +3 base damage per point of INTELECT. Hitting an enemy with Wraith Strike restores 36 SHIELD. Permanent grants +10 INTELECT.',
  modifiesAbilityId: 'Wraith Strike (Q)',
};

export const breathWeaponTalentDefinition: TalentDefinition = {
  id: TALENT_BREATH_WEAPON,
  name: 'Aftershock',
  description:
    'When you cast Wraith Strike, scorch the ground in a line in front of you. After 1 second, the strip erupts in flame pillars, dealing 125 damage to all enemies in the area.',
  modifiesAbilityId: 'Wraith Strike (Q)',
};

export const mortalStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_MORTAL_STRIKE,
  name: 'Mortal Strike',
  description:
    `Every ${MORTAL_STRIKE_ATTACK_INTERVAL}th Runeblade left-click attack unleashes a sweeping arc slash that deals ${MORTAL_STRIKE_BASE_DAMAGE} damage to enemies in front of you, in addition to the normal combo hit.`,
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const staggeringComboTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_COMBO,
  name: 'Charged Combo',
  description:
    'Your Runeblade basic attacks now apply stagger. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const wrathfulComboTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_COMBO,
  name: 'Wrathful Combo',
  description:
    'Your Runeblade basic attacks now gain +50% critical strike chance and +125% critical strike damage on the third hit of the combo.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const infestedComboTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_COMBO,
  name: 'Infested Combo',
  description:
    'Your Runeblade basic attacks now heal you for 10% of damage dealt. Killing an enemy with these attacks raises a ZOMBIE ally for 30s (max 3).',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const guardComboTalentDefinition: TalentDefinition = {
  id: TALENT_GUARD_COMBO,
  name: 'Guard Combo',
  description:
    'Your Runeblade basic attacks have a 35% chance per enemy hit to grant 3 seconds of Aegis INVULNERABILITY.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const dashGuardTalentDefinition: TalentDefinition = {
  id: TALENT_DASH_GUARD,
  name: 'Divine Dash',
  description:
    `Each time you dash, gain ${DASH_GUARD_DURATION_SEC} seconds of Aegis INVULNERABILITY.`,
  modifiesAbilityId: 'Dash (double-tap W/A/S/D)',
};

export const executionerTalentDefinition: TalentDefinition = {
  id: TALENT_EXECUTIONER,
  name: 'Executioner',
  description:
    `After a DASH, your next Runeblade basic attack (left-click) within ${EXECUTIONER_POST_DASH_WINDOW_MS / 1000} seconds resolves as the third combo hit and deals +${EXECUTIONER_BASE_DAMAGE_ADD} + ${EXECUTIONER_DAMAGE_PER_STRENGTH} base damage per STRENGTH.`,
  modifiesAbilityId: 'Dash (double-tap W/A/S/D)',
};

export const staggeringSwipesTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_SWIPES,
  name: 'Charged Blades',
  description:
    'Your Sabres\' basic attacks now apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const staggeringStabTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_STAB,
  name: 'Charged Stab',
  description:
    'Backstab now applies 80 STAGGER on hit. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Backstab (Q)',
};

export const wrathfulStabTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_STAB,
  name: 'Wrathful Stab',
  description:
    'Backstab now gains +30% critical strike chance and +80% critical strike damage.',
  modifiesAbilityId: 'Backstab (Q)',
};

export const infestedBackstabTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_BACKSTAB,
  name: 'Infested Stab',
  description:
    'Killing an enemy with Backstab raises a ZOMBIE ally for 30s (max 3).',
  modifiesAbilityId: 'Backstab (Q)',
};

export const killstreakTalentDefinition: TalentDefinition = {
  id: TALENT_KILLSTREAK,
  name: 'Killstreak',
  description:
    'Each enemy kill with Backstab grants +' +
    BACKSTAB_KILLSTREAK_DAMAGE_PER_KILL +
    'permanent base damage to Backstab.',
  modifiesAbilityId: 'Backstab (Q)',
};

export const relentlessTalentDefinition: TalentDefinition = {
  id: TALENT_RELENTLESS,
  name: 'Relentless',
  description:
    `Killing an enemy with Backstab fully resets Backstab cooldown and heals you for ${RELENTLESS_BACKSTAB_KILL_BASE} + ${RELENTLESS_BACKSTAB_KILL_HEAL_PER_STAMINA} HP per point of STAMINA.`,
  modifiesAbilityId: 'Backstab (Q)',
};

export const doubleStabTalentDefinition: TalentDefinition = {
  id: TALENT_DOUBLE_STAB,
  name: 'Repeat Offender',
  description:
    'Backstab now holds 2 charges for use.',
  modifiesAbilityId: 'Backstab (Q)',
};

export const vorpalGustTalentDefinition: TalentDefinition = {
  id: TALENT_VORPAL_GUST,
  name: 'Vorpal Gust',
  description:
    'Backstab becomes a piercing wind gust up to ' +
    String(VORPAL_GUST_BEAM_LENGTH) +
    ' units in a line forward, hitting every enemy in its path. Targets in the gust tip (~' +
    String(VORPAL_GUST_TIP_ZONE_WORLD_UNITS) +
    ' units at max range) take higher base Backstab tiers: frontal ' +
    String(BACKSTAB_VORPAL_TIP_DAMAGE_FRONT) +
    ' (vs ' +
    String(333) +
    '), positional stab ' +
    String(BACKSTAB_VORPAL_TIP_DAMAGE_BACKSTAB) +
    ' (vs ' +
    String(666) +
    ') on PvE.',
  modifiesAbilityId: 'Backstab (Q)',
};

export const fanOfKnivesTalentDefinition: TalentDefinition = {
  id: TALENT_FAN_OF_KNIVES,
  name: 'Fan of Knives',
  description:
    `Flourish now fires 3 daggers in a forward fan for ${FAN_OF_KNIVES_BASE_DAMAGE} + ${FAN_OF_KNIVES_DAMAGE_PER_AGILITY} damage per point of AGILITY each.`,
  modifiesAbilityId: 'Flourish (E)',
};

export const parryTalentDefinition: TalentDefinition = {
  id: TALENT_PARRY,
  name: 'Parry',
  description:
    `Flourish restores ${PARRY_FLOURISH_SHIELD_RESTORE} shield when cast. Permanently grants +${PARRY_INTELLECT_BONUS} INTELECT and +${PARRY_STRENGTH_BONUS} STRENGTH.`,
  modifiesAbilityId: 'Flourish (E)',
};

export const packHunterTalentDefinition: TalentDefinition = {
  id: TALENT_PACK_HUNTER,
  name: 'Pack Hunter',
  description:
    'Each of your ZOMBIES deals +15 damage for each ZOMBIE you control, including itself (1 ZOMBIE: 60, 2: 75, 3: 90 base damage).',
  modifiesAbilityId: 'Eldritch Boons',
};

export const berserkerStrainTalentDefinition: TalentDefinition = {
  id: TALENT_BERSERKER_STRAIN,
  name: 'Berserker Strain',
  description: 'ZOMBIES from any source have double HEALTH and double MOVEMENT SPEED.',
  modifiesAbilityId: 'Eldritch Boons',
};

export const juggernautStrainTalentDefinition: TalentDefinition = {
  id: TALENT_JUGGERNAUT_STRAIN,
  name: 'Juggernaut Strain',
  description:
    '33% chance when any ZOMBIE is raised to summon a JUGGERNAUT instead: larger, stronger, and more durable.',
  modifiesAbilityId: 'Eldritch Boons',
};

export const exploderStrainTalentDefinition: TalentDefinition = {
  id: TALENT_EXPLODER_STRAIN,
  name: 'Exploder Strain',
  description:
    'Your ZOMBIES detonate on their first hit, dealing damage equal to their maximum health in a small area and dying instantly. Enemies killed by the blast raise a new ZOMBIE.',
  modifiesAbilityId: 'Eldritch Boons',
};

export const infernalDashTalentDefinition: TalentDefinition = {
  id: TALENT_INFERNAL_DASH,
  name: 'Infernal Dash',
  description:
    'Forward dashes erupt in fiery pillars at your destination, dealing 195 damage and inflicting IGNITE to enemies in the area, dealing 80% of the damage dealt over 4 seconds.',
  modifiesAbilityId: 'Forward Dash (double-tap W)',
};

export const glacialDashTalentDefinition: TalentDefinition = {
  id: TALENT_GLACIAL_DASH,
  name: 'Glacial Dash',
  description:
    'Backward dashes leave a Frost Nova at your origin, applying FREEZE to enemies in the area for 3 seconds.',
  modifiesAbilityId: 'Backward Dash (double-tap S)',
};

export const mendingDashTalentDefinition: TalentDefinition = {
  id: TALENT_MENDING_DASH,
  name: 'Mending Dash',
  description:
    'Any dash releases a Sunwell burst, healing you for your current amount of STAMINA.',
  modifiesAbilityId: 'Dash (double-tap W/A/S/D)',
};

export const orbShieldTalentDefinition: TalentDefinition = {
  id: TALENT_ORB_SHIELD,
  name: 'Orb Shield',
  description:
    'Whenever you take damage from an enemy, spend 1 DASH CHARGE to heal for 50 + your current STAMINA.',
  modifiesAbilityId: 'Dash (double-tap W/A/S/D)',
};

export const staggeringDashTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_DASH,
  name: 'Storm Dash',
  description:
    'Any dash arcs lightning to the nearest enemy, dealing 40-240 damage and applying STAGGER to the target. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Dash (double-tap W/A/S/D)',
};

export const guardbreakTalentDefinition: TalentDefinition = {
  id: TALENT_GUARDBREAK,
  name: 'Guardbreak',
  description:
    `STAGGER lightning procs deal ${GUARDBREAK_STAGGER_PROC_DAMAGE} damage (up from ${STAGGER_PROC_DAMAGE}).`,
  modifiesAbilityId: 'Tempest Boons',
};

export const overshockTalentDefinition: TalentDefinition = {
  id: TALENT_OVERSHOCK,
  name: 'Paralysis',
  description:
    `STAGGER lightning procs stun enemies for ${OVERSHOCK_STAGGER_PROC_STUN_SECONDS} seconds (up from ${STAGGER_PROC_STUN_SECONDS}).`,
  modifiesAbilityId: 'Tempest Boons',
};

export const unstableEnergyTalentDefinition: TalentDefinition = {
  id: TALENT_UNSTABLE_ENERGY,
  name: 'Unstable Plasma',
  description:
    `STAGGER lightning procs can now critically strike and deal +${UNSTABLE_ENERGY_AGILITY_DAMAGE_PER_POINT} damage per point of AGILITY.`,
  modifiesAbilityId: 'Tempest Boons',
};

export const bloodleechTalentDefinition: TalentDefinition = {
  id: TALENT_BLOODLEECH,
  name: 'Blood Leech',
  description:
    'Critical strikes you deal to enemies now HEAL you for your current STRENGTH points.',
  modifiesAbilityId: 'Infernal Boons',
};

export const rebukeTalentDefinition: TalentDefinition = {
  id: TALENT_REBUKE,
  name: 'Rebuke',
  description:
    'Whenever you take damage from an enemy, that enemy erupts in flames, taking 200 damage and is inflicted with IGNITE, dealing 80% of the damage dealt over 4 seconds.',
  modifiesAbilityId: 'Infernal Boons',
};

export const raiseDeadTalentDefinition: TalentDefinition = {
  id: TALENT_RAISE_DEAD,
  name: 'Raise Dead',
  description:
    'Instantly summons one ZOMBIE ally at your position. Subject to the 3-ZOMBIE cap and benefits from all ZOMBIE boons.',
  modifiesAbilityId: 'Spell (R)',
};

export const meteorStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_METEOR_STRIKE,
  name: 'Meteor Strike',
  description:
    'Calls down 1 meteor on the nearest enemy within range, with a 15% chance to call a second and a 5% chance to call a third. Meteors deal 240 base damage.',
  modifiesAbilityId: 'Spell (R)',
};

export const coldsnapRoomTalentDefinition: TalentDefinition = {
  id: TALENT_COLDSNAP_ROOM,
  name: 'Coldsnap',
  description:
    'Conjures an explosive ice vortex that applies FREEZE to nearby enemies, immobilizing them for 6 seconds. 12s cooldown.',
  modifiesAbilityId: 'Spell (R)',
};

export const lightningBoltRoomTalentDefinition: TalentDefinition = {
  id: TALENT_LIGHTNING_BOLT_ROOM,
  name: 'Lightning Bolt',
  description:
    `Calls down a lightning bolt on the highest priority enemy in range, dealing ${LIGHTNING_BOLT_ROOM_DAMAGE} damage and applying STAGGER to the target. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.`,
  modifiesAbilityId: 'Spell (R)',
};

export const aegisRoomTalentDefinition: TalentDefinition = {
  id: TALENT_AEGIS_ROOM,
  name: 'Aegis',
  description:
    `Creates a protective barrier that provides INVULNERABILITY, blocking all incoming damage for ${AEGIS_ROOM_DURATION_SEC} seconds. ${AEGIS_ROOM_COOLDOWN_SEC}s cooldown.`,
  modifiesAbilityId: 'Spell (R)',
};

export const momentumRiftTalentDefinition: TalentDefinition = {
  id: TALENT_MOMENTUM_RIFT,
  name: 'Momentum Rift',
  description:
    'Whenever you take damage from an enemy, restore 1 dash charge if any charge is on cooldown.',
  modifiesAbilityId: 'Abyssal Boons',
};

export const manaShieldRoomTalentDefinition: TalentDefinition = {
  id: TALENT_MANA_SHIELD,
  name: 'Mana Shield',
  description:
    `Whenever you expend a dash charge, restore shield equal to ${MANA_SHIELD_RESTORE_PER_INTELLECT} × your INTELECT per charge spent.`,
  modifiesAbilityId: 'Abyssal Boons',
};

export const wrathfulSabresSwipesTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_SABRES_SWIPES,
  name: 'Wrathful Blades',
  description:
    'Sabres basic attacks now gain +20% critical strike chance and +100% critical strike damage.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const infestingSabresSwipesTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTING_SABRES_SWIPES,
  name: 'Infested Blades',
  description:
    'Sabres basic attacks gain increased base damage. Killing an enemy with these attacks raises a ZOMBIE ally for 30s (max 3).',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const staggeringFlourishTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_FLOURISH,
  name: 'Storm Flourish',
  description:
    `Flourish now applies STAGGER on hit. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.`,
  modifiesAbilityId: 'Flourish (E)',
};

export const wrathfulFlourishTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_FLOURISH,
  name: 'Wrathful Flourish',
  description:
    `Flourish gains +${WRATHFUL_FLOURISH_CRIT_CHANCE_ADD * 100}% critical strike chance and +${WRATHFUL_FLOURISH_CRIT_DAMAGE_MULT_ADD * 100}% critical strike damage.`,
  modifiesAbilityId: 'Flourish (E)',
};

export const infestedFlourishTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_FLOURISH,
  name: 'Infested Flourish',
  description:
    'Killing an enemy with Flourish raises a ZOMBIE ally for 30s (max 3).',
  modifiesAbilityId: 'Flourish (E)',
};

export const guardSabresSwipesTalentDefinition: TalentDefinition = {
  id: TALENT_GUARD_SABRES_SWIPES,
  name: 'Divine Blades',
  description:
    `Sabres basic attacks have a ${GUARD_SABRES_SWIPES_PROC_CHANCE * 100}% chance to grant ${GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC} seconds of Aegis INVULNERABILITY.`,
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const guardSabresStabTalentDefinition: TalentDefinition = {
  id: TALENT_GUARD_SABRES_STAB,
  name: 'Divine Stab',
  description:
    `Damaging an enemy with Backstab grants ${GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC} seconds of Aegis INVULNERABILITY.`,
  modifiesAbilityId: 'Backstab (Q)',
};

export const guardSabresFlourishTalentDefinition: TalentDefinition = {
  id: TALENT_GUARD_SABRES_FLOURISH,
  name: 'Divine Flourish',
  description:
    `Damaging an enemy with Flourish grants ${GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC} seconds of Aegis INVULNERABILITY.`,
  modifiesAbilityId: 'Flourish (E)',
};

export const crescentBladesTalentDefinition: TalentDefinition = {
  id: TALENT_CRESCENT_BLADES,
  name: 'Crescent Flare',
  description:
    'Every 3rd Sabres basic attack unleashes a crescent slash that deals 150 damage to all enemies in the arc in front of you, in addition to the normal dual-blade hit.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const windShearTalentDefinition: TalentDefinition = {
  id: TALENT_WIND_SHEAR,
  name: 'Wind Shear',
  description:
    `Every Sabres basic attack fires a wind slash projectile that travels forward, dealing ${WIND_SHEAR_BASE_DAMAGE} + ${WIND_SHEAR_DAMAGE_PER_STRENGTH} damage per point of STRENGTH to the first enemy it strikes.`,
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const psionicBladesTalentDefinition: TalentDefinition = {
  id: TALENT_PSIONIC_BLADES,
  name: 'Psionic Blades',
  description:
    `Each Sabres basic attack hit (left and right) deals an additional ${PSIONIC_BLADES_BASE_DAMAGE} + ${PSIONIC_BLADES_DAMAGE_PER_INTELLECT} damage per point of INTELECT.`,
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const staggerShotTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGER_SHOT,
  name: 'Charged Shots',
  description:
    `Bow basic attacks apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.`,
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const dualCoilTalentDefinition: TalentDefinition = {
  id: TALENT_DUAL_COIL,
  name: 'Dual Coil',
  description:
    'Bow basic attacks now launch two projectiles at once, side by side.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const highCaliberTalentDefinition: TalentDefinition = {
  id: TALENT_HIGH_CALIBER,
  name: 'High Caliber',
  description:
    'Bow left-click takes 1.5× as long to reach full charge but Perfect Shots now deal double the base damage.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const triggerFingerTalentDefinition: TalentDefinition = {
  id: TALENT_TRIGGER_FINGER,
  name: 'Quick Draw',
  description:
    'Uncharged basic attacks gain +50 base damage.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const cloudkillTalentDefinition: TalentDefinition = {
  id: TALENT_CLOUDKILL,
  name: 'Cloudkill',
  description:
    'Bow basic attacks have a 20% chance on each enemy hit to rain 4–8 poison arrows onto that enemy. Each arrow deals 40 damage to enemies in the impact area.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const tempestRoundsTalentDefinition: TalentDefinition = {
  id: TALENT_TEMPEST_ROUNDS,
  name: 'Tempest Rounds',
  description:
    'Replaces the Bow\'s basic attack with a rapid three round burst attack.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const icebeamTalentDefinition: TalentDefinition = {
  id: TALENT_ICEBEAM,
  name: 'Particle Beam',
  description:
    'Replaces the Scythe\'s basic attack with a channeled Particle Beam that gets stronger the longer it is held. The beam has an 8 second cooldown if overloaded..',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const wyvernStingTalentDefinition: TalentDefinition = {
  id: TALENT_WYVERN_STING,
  name: 'Wyvern Sting',
  description:
    `When you release a Perfect Shot, you also fire a venemous arrow that applies VENOM to enemies hit, dealing ${WYVERN_STING_VENOM_BASE_DPS} + ${WYVERN_STING_VENOM_PER_INTELLECT} damage per INTELLECT per second for ${COBRA_SHOT_VENOM_DURATION_SEC} seconds. Enemmies killed by VENOM raise an infested ZOMBIE ally.`,
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const concentratedVolleyTalentDefinition: TalentDefinition = {
  id: TALENT_CONCENTRATED_VOLLEY,
  name: 'Concentrated Volley',
  description:
    'Frostbite fires all five arrows in a straight line forward instead of spreading out.',
  modifiesAbilityId: 'Frostbite (Q)',
};

export const wrathfulBiteTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_BITE,
  name: 'Wrathful Bite',
  description:
    'Frostbite arrows gain +40% critical strike chance and +40% critical strike damage.',
  modifiesAbilityId: 'Frostbite (Q)',
};

export const wyvernBiteTalentDefinition: TalentDefinition = {
  id: TALENT_WYVERN_BITE,
  name: 'Wyvern Bite',
  description:
    'Each Frostbite arrow hit now applies Concentrated VENOM: 31 damage per second per stack (max 5 stacks) over 8 seconds.',
  modifiesAbilityId: 'Frostbite (Q)',
};

export const entanglementTalentDefinition: TalentDefinition = {
  id: TALENT_ENTANGLEMENT,
  name: 'Entanglement',
  description:
    'Each Frostbite arrow hit Entangles its target for 5 seconds: the target cannot move, but can still cast, attack, dash, and blink. Green roots squeeze the target for 20 damage per second.',
  modifiesAbilityId: 'Frostbite (Q)',
};

export const staggeringBiteTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_BITE,
  name: 'Staggering Bite',
  description:
    'Each Frostbite arrow hit now applies STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Frostbite (Q)',
};

export const staggeringTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_TALONS,
  name: 'Storm Talons',
  description:
    'Reaping Talons\' (E) forward and return hits each apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Reaping Talons (E)',
};

export const wrathfulShotsTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_SHOTS,
  name: 'Wrathful Shots',
  description:
    `Perfectly-timed basic attacks now gain +40% critical strike chance and +50% critical strike damage.`,
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const wyvernTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_WYVERN_TALONS,
  name: 'Wyvern Talons',
  description:
    'Reaping Talons (E) now detonates active VENOM, dealing all remaining DoT damage and instantly ending the effect. Reaping Talons and detonation kills raise an infested ZOMBIE ally for 30s (max 3).',
  modifiesAbilityId: 'Reaping Talons (E)',
};

export const arcticStingTalentDefinition: TalentDefinition = {
  id: TALENT_ARCTIC_STING,
  name: 'Arctic Sting',
  description:
    `The first enemy hit by Perfect Shot spawns a concentrated BLIZZARD that deals 30 damage every 0.5 seconds to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 6 seconds.`,
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const glacialBiteTalentDefinition: TalentDefinition = {
  id: TALENT_GLACIAL_BITE,
  name: 'Glacial Bite',
  description:
    'Each Frostbite (Q) arrow hit now applies 1 stack of CHILL; at 5 stacks the target is FROZEN for 6 seconds.',
  modifiesAbilityId: 'Frostbite (Q)',
};

export const glacialTalonsTalentDefinition: TalentDefinition = {
  id: TALENT_GLACIAL_TALONS,
  name: 'Glacial Talons',
  description:
    'Spawns a concentrated BLIZZARD on the first enemy hit, dealing 30 damage every 0.5 seconds to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 6 seconds. Reaping Talons now deals double damage to FROZEN enemies.',
  modifiesAbilityId: 'Reaping Talons (E)',
};

export const infernoTalentDefinition: TalentDefinition = {
  id: TALENT_INFERNO,
  name: 'Inferno',
  description:
    'Crossentropy gains +40% critical strike chance and applies IGNITE, dealing bonus damage equal to 80% of the total damage dealt over 3 seconds.',
  modifiesAbilityId: 'Crossentropy (E)',
};

export const reaperTalentDefinition: TalentDefinition = {
  id: TALENT_REAPER,
  name: 'Reaper',
  description:
    'Crossentropy travels to full range and pierces through all enemies in its path.Each enemy hit by the bolt heals you for 2 HP. Killing an enemy with Crossentropy grants +5 permanent base damage.',
  modifiesAbilityId: 'Crossentropy (E)',
};

export const meteorTalentDefinition: TalentDefinition = {
  id: TALENT_METEOR,
  name: 'Meteor',
  description:
    'Crossentropy now calls down 1 meteor, with a 15% chance to call a second and a 5% chance to call a third, dealing 240 base damage to enemies in the area.',
  modifiesAbilityId: 'Crossentropy (E)',
};

export const fragmentationTalentDefinition: TalentDefinition = {
  id: TALENT_FRAGMENTATION,
  name: 'Fragmentation',
  description:
    'Entropic Bolts and Crossentropy now ricochets to the next nearest enemy, then have a 50% chance to bounce to a third target and a 30% chance to bounce to a fourth.',
  modifiesAbilityId: 'Entropic Bolts (Left-click) and Crossentropy (E)',
};

export const crossentropyTempestTalentDefinition: TalentDefinition = {
  id: TALENT_CROSSENTROPY_TEMPEST,
  name: 'Tempest',
  description:
    'Crossentropy now applies 100 STAGGER on hit. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Crossentropy (E)',
};

export const crossentropyPlagueTalentDefinition: TalentDefinition = {
  id: TALENT_CROSSENTROPY_PLAGUE,
  name: 'Plague',
  description:
    'Crossentropy now deals 500 base damage. Each enemy killed by Crossentropy raises up to two ZOMBIE allies for 30s (max 3).',
  modifiesAbilityId: 'Crossentropy (E)',
};

export const arcticShardsTalentDefinition: TalentDefinition = {
  id: TALENT_ARCTIC_SHARDS,
  name: 'Arctic Shards',
  description:
    'Each bolt that hits an enemy has a 15% chance to summon a concentrated BLIZZARD that deals 30 damage every 0.5s to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 4 seconds.',
  modifiesAbilityId: 'Entropic Bolts (Left-click)',
};

export const glacialStormTalentDefinition: TalentDefinition = {
  id: TALENT_GLACIAL_STORM,
  name: 'Glacial Storm',
  description:
    'Crossentropy now spawns a FROST NOVA at the impact zone, leaving a concentrated BLIZZARD that deals 30 damage every 0.5s to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 4 seconds.',
  modifiesAbilityId: 'Crossentropy (E)',
};

export const frostTotemTalentDefinition: TalentDefinition = {
  id: TALENT_FROST_TOTEM,
  name: 'Frost Totem',
  description:
    'Mantra\'s Totem shots now apply CHILL; at 5 stacks the target can be FROZEN for 4 seconds. Frost totems deal double damage to FROZEN enemies.',
  modifiesAbilityId: 'Mantra (Q)',
};

export const frostPathTalentDefinition: TalentDefinition = {
  id: TALENT_FROSTPATH,
  name: 'Frostpath',
  description:
    'Each Entropic Bolt hit has a 20% chance to trigger a FROST NOVA burst centered on that enemy that applies FREEZE for 4 seconds. Cannot occur more than once every 2.5 seconds.',
  modifiesAbilityId: 'Entropic Bolts (Left-click)',
};

export const solarRechargeTalentDefinition: TalentDefinition = {
  id: TALENT_SOLAR_RECHARGE,
  name: 'Solar Recharge',
  description:
    'Each Entropic Bolt hit has a 15% chance to trigger Sunwell that HEALS you and nearby allies for 15 HP. Cannot occur more than once every 2.5 seconds.',
  modifiesAbilityId: 'Entropic Bolts (Left-click)',
};

export const arcaneSynergyTalentDefinition: TalentDefinition = {
  id: TALENT_ARCANE_SYNERGY,
  name: 'Arcane Synergy',
  description:
    `Entropic Bolts gain +${ARCANE_SYNERGY_ENTROPIC_BOLT_DAMAGE_PER_INTELLECT} base damage per point of INTELLECT and fire 30% faster.`,
  modifiesAbilityId: 'Entropic Bolts (Left-click)',
};

export const wrathfulEntropicTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_ENTROPIC,
  name: 'Wrathful Bolts',
  description:
    'Entropic Bolts gain +40% critical strike chance.',
  modifiesAbilityId: 'Entropic Bolts (Left-click)',
};

export const staggeringEntropicTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_ENTROPIC,
  name: 'Charged Bolts',
  description:
    'Entropic Bolts now apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Entropic Bolts (Left-click)',
};

export const infestingEntropicTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTING_ENTROPIC,
  name: 'Infesting Bolts',
  description:
    'Enemies killed by Entropic Bolts raise an allied ZOMBIE ally. While Icebeam is your primary, beam kills raise a zombie and heal you for 5 HP.',
  modifiesAbilityId: 'Entropic Bolts (Left-click)',
};

export const wrathfulTotemTalentDefinition: TalentDefinition = {
  id: TALENT_WRATHFUL_TOTEM,
  name: 'Wrathful Totem',
  description:
    'Mantra\'s Totem shots now gain increased base damage and +40% critical strike chance.',
  modifiesAbilityId: 'Mantra (Q)',
};

export const staggeringTotemTalentDefinition: TalentDefinition = {
  id: TALENT_STAGGERING_TOTEM,
  name: 'Storm Totem',
  description:
    'Mantra\'s Totem shots now apply STAGGER. At 100 STAGGER, the target is struck by a Lightning Bolt that inflicts STUN for 1.0 seconds.',
  modifiesAbilityId: 'Mantra (Q)',
};

export const infestingTotemTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTING_TOTEM,
  name: 'Plague Totem',
  description:
    'Mantra\'s Totem shots now gain increased base damage. Enemies killed by Totem shots raise an allied ZOMBIE for 30s (max 3).',
  modifiesAbilityId: 'Mantra (Q)',
};

export const windFuryTalentDefinition: TalentDefinition = {
  id: TALENT_WINDFURY,
  name: 'Windfury',
  description:
    'Each Runeblade basic attack that damages an enemy has a 15% chance to grant 30% additional ATTACK SPEED for 5 seconds. While Windfury is active, each basic attack also heals you for 3 HP.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const crusaderTalentDefinition: TalentDefinition = {
  id: TALENT_CRUSADER,
  name: 'Crusader',
  description:
    'Each Runeblade basic attack that damages an enemy has a 20% chance to grant +50 base damage to each attack for 5 seconds.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
};

export const blizzardTalentDefinition: TalentDefinition = {
  id: TALENT_BLIZZARD,
  name: 'Blizzard',
  description:
    'Each Runeblade basic attack that damages an enemy has a 20% chance to spawn a BLIZZARD around you for 7 seconds, dealing 42 damage every 0.5 seconds to enemies within. Each tick applies CHILL; at 5 stacks the target is FROZEN for 6 seconds.',
  modifiesAbilityId: 'Primary Attack (Left-click)',
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
  cycloneRush: boolean;
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
  entanglement: boolean;
  inferno: boolean;
  reaper: boolean;
  meteor: boolean;
  fragmentation: boolean;
  frostPath: boolean;
  solarRecharge: boolean;
  /** Arcane Synergy — Entropic Bolt Intellect scaling + faster fire rate. */
  arcaneSynergy: boolean;
  windFury: boolean;
  dualCoil: boolean;
  /** HIGH CALIBER — bow LMB slower full charge (+90/60), powershot/perfect doubled damage, thicker perfect beam. */
  highCaliber: boolean;
  /** TRIGGER FINGER — bow LMB uncharged damage + red projectile VFX. */
  triggerFinger: boolean;
  /** Cloudkill — bow LMB primary 20% on-hit poison arrow volley. */
  cloudkill: boolean;
  wyvernSting: boolean;
  wyvernTalons: boolean;
  arcticSting: boolean;
  glacialBite: boolean;
  glacialTalons: boolean;
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
  breathWeapon: boolean;
  staggeringBite: boolean;
  staggeringTalons: boolean;
  wrathfulShots: boolean;
  wrathfulEntropic: boolean;
  staggeringEntropic: boolean;
  infestingEntropic: boolean;
  wrathfulTotem: boolean;
  staggeringTotem: boolean;
  infestingTotem: boolean;
  crossentropyTempest: boolean;
  crossentropyPlague: boolean;
  arcticShards: boolean;
  glacialStorm: boolean;
  frostTotem: boolean;
  shaman: boolean;
  superconductor: boolean;
  accelerator: boolean;
  giantKiller: boolean;
  /** Double Talons — Reaping Talons holds 2 staggered charges while Reaping Talons is in loadout. */
  doubleTalons: boolean;
  healingStream: boolean;
  staggeringStab: boolean;
  wrathfulStab: boolean;
  infestedBackstab: boolean;
  wrathfulSabresSwipes: boolean;
  infestingSabresSwipes: boolean;
  staggeringFlourish: boolean;
  wrathfulFlourish: boolean;
  infestedFlourish: boolean;
  guardSabresSwipes: boolean;
  guardSabresStab: boolean;
  guardSabresFlourish: boolean;
  /** Crescent Blades — every 3rd Sabres LMB swing fires a 150-damage crescent slash AoE. */
  crescentBlades: boolean;
  /** Wind Shear — every Sabres LMB swing fires a forward wind slash for 40 damage (first hit only). */
  windShear: boolean;
  /** Psionic Blades — each LMB blade hit procs bonus damage scaled by Intellect. */
  psionicBlades: boolean;
  /** Mortal Strike — every 4th Runeblade LMB swing fires a bonus arc slash. */
  mortalStrike: boolean;
  killstreak: boolean;
  relentless: boolean;
  vorpalGust: boolean;
  /** Flourish (`SABRES_E`) — fan of three daggers forward. */
  fanOfKnives: boolean;
  /** Sabres Flourish — on-cast shield restore + passive STR/INT (see `PARRY_*` constants). */
  parry: boolean;
  /** Double Stab — Backstab holds 2 staggered charges while Backstab is in loadout. */
  doubleStab: boolean;
  /** Co-op green room — Pack Hunter zombie pack damage bonus. */
  packHunterRoom: boolean;
  /** Co-op green room — zombies have double HP and double move speed. */
  berserkerStrainRoom: boolean;
  /** Co-op green room — roll for juggernaut zombie substitution. */
  juggernautStrainRoom: boolean;
  /** Co-op green room — zombies detonate on first hit for max-HP AoE damage. */
  exploderStrainRoom: boolean;
  /** Co-op red room — forward dash creates an infernal flame strike at the destination. */
  infernalDashRoom: boolean;
  /** Co-op purple room — backward dash leaves a frozen nova at the origin. */
  glacialDashRoom: boolean;
  /** Co-op green room — any dash heals for current Stamina points. */
  mendingDashRoom: boolean;
  /** Co-op blue room — any dash arcs lightning to a nearby enemy. */
  staggeringDashRoom: boolean;
  /** Co-op blue room — stagger lightning procs deal bonus damage. */
  guardbreakRoom: boolean;
  /** Co-op blue room — stagger lightning procs stun longer. */
  overshockRoom: boolean;
  /** Co-op blue room — stagger lightning procs can crit and gain +8 damage per Agility. */
  unstableEnergyRoom: boolean;
  /** Co-op red room — your critical strikes heal for current Strength points. */
  bloodleechRoom: boolean;
  /** Co-op red room — retaliate with fire when taking damage from an enemy. */
  rebukeRoom: boolean;
  /** Co-op green room active boon — player can summon a zombie via R key (15s cooldown). */
  raiseDeadRoom: boolean;
  /** Co-op red room active boon — player can call a meteor on a nearby enemy via R key (8s cooldown). */
  meteorStrikeRoom: boolean;
  /** Co-op purple room active boon — player can cast Coldsnap (frost nova) via R key (12s cooldown). */
  coldsnapRoom: boolean;
  /** Co-op blue room active boon — player can call a lightning bolt on the top-priority enemy via R key (3s cooldown). */
  lightningBoltRoom: boolean;
  /** Co-op purple room active boon — player can cast Aegis deflect + invulnerability via R key (8s cooldown). */
  aegisRoom: boolean;
  /** Co-op purple room passive — restore a dash charge when taking damage from an enemy. */
  momentumRiftRoom: boolean;
  /** Co-op purple room passive — restore shield when expending a dash charge (scales with Intellect). */
  manaShieldRoom: boolean;
  /** Co-op green room passive — spend a dash charge to heal when taking damage from an enemy. */
  orbShieldRoom: boolean;
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
    cycloneRush: false,
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
    entanglement: false,
    inferno: false,
    reaper: false,
    meteor: false,
    fragmentation: false,
    frostPath: false,
    solarRecharge: false,
    arcaneSynergy: false,
    windFury: false,
    dualCoil: false,
    highCaliber: false,
    triggerFinger: false,
    cloudkill: false,
    wyvernSting: false,
    wyvernTalons: false,
    arcticSting: false,
    glacialBite: false,
    glacialTalons: false,
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
    breathWeapon: false,
    staggeringBite: false,
    staggeringTalons: false,
    wrathfulShots: false,
    wrathfulEntropic: false,
    staggeringEntropic: false,
    infestingEntropic: false,
    wrathfulTotem: false,
    staggeringTotem: false,
    infestingTotem: false,
    crossentropyTempest: false,
    crossentropyPlague: false,
    arcticShards: false,
    glacialStorm: false,
    frostTotem: false,
    shaman: false,
    superconductor: false,
    accelerator: false,
    giantKiller: false,
    doubleTalons: false,
    healingStream: false,
    staggeringStab: false,
    wrathfulStab: false,
    infestedBackstab: false,
    wrathfulSabresSwipes: false,
    infestingSabresSwipes: false,
    staggeringFlourish: false,
    wrathfulFlourish: false,
    infestedFlourish: false,
    guardSabresSwipes: false,
    guardSabresStab: false,
    guardSabresFlourish: false,
    crescentBlades: false,
    windShear: false,
    psionicBlades: false,
    mortalStrike: false,
    killstreak: false,
    relentless: false,
    vorpalGust: false,
    fanOfKnives: false,
    parry: false,
    doubleStab: false,
    packHunterRoom: false,
    berserkerStrainRoom: false,
    juggernautStrainRoom: false,
    exploderStrainRoom: false,
    infernalDashRoom: false,
    glacialDashRoom: false,
    mendingDashRoom: false,
    staggeringDashRoom: false,
    guardbreakRoom: false,
    overshockRoom: false,
    unstableEnergyRoom: false,
    bloodleechRoom: false,
    rebukeRoom: false,
    raiseDeadRoom: false,
    meteorStrikeRoom: false,
    coldsnapRoom: false,
    lightningBoltRoom: false,
    aegisRoom: false,
    momentumRiftRoom: false,
    manaShieldRoom: false,
    orbShieldRoom: false,
  };
}

/** Merge partial loadouts and migrate legacy Blade Rush / Stored Charge flags to Cyclone Rush. */
export function normalizeTalentLoadout(
  raw: Partial<TalentLoadout> & { bladeRush?: boolean; storedCharge?: boolean },
): TalentLoadout {
  const merged = { ...createDefaultTalentLoadout(), ...raw };
  merged.cycloneRush = !!(merged.cycloneRush || raw.bladeRush || raw.storedCharge);
  return merged;
}

// DEFAULT TALENTS DEFAULTTALENTS
export function isWraithStrikeInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'RUNEBLADE_E' || loadout.E === 'RUNEBLADE_E' || loadout.R === 'RUNEBLADE_E';
}

export function isSabresFlourishInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'SABRES_E' || loadout.E === 'SABRES_E' || loadout.R === 'SABRES_E';
}

export function isBackstabInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'SABRES_Q' || loadout.E === 'SABRES_Q' || loadout.R === 'SABRES_Q';
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

/** Mantra / Summon Totem (`SCYTHE_F`) in any universal slot. */
export function isMantraInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'SCYTHE_F' || loadout.E === 'SCYTHE_F' || loadout.R === 'SCYTHE_F';
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

export function shouldApplyCycloneRushTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.cycloneRush;
}

/** Cyclone Rush — 3 full post-Charge spins + per-rotation damage on all Charge paths. */
export function shouldApplyCycloneRushChargeSpin(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.cycloneRush;
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

export function shouldApplyDoubleStabTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.doubleStab && isBackstabInLoadout(abilityLoadout);
}

export function shouldApplyShamanTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.shaman && isMantraInLoadout(abilityLoadout);
}

export function shouldApplySuperconductorTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.superconductor && isMantraInLoadout(abilityLoadout);
}

export function shouldApplyAcceleratorTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return (
    !!talentLoadout?.accelerator &&
    isMantraInLoadout(abilityLoadout) &&
    isCrossentropyInLoadout(abilityLoadout)
  );
}

export function shouldApplyGiantKillerTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.giantKiller && isReapingTalonsInLoadout(abilityLoadout);
}

export function shouldApplyDoubleTalonsTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.doubleTalons && isReapingTalonsInLoadout(abilityLoadout);
}

export function shouldApplyHealingStreamTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.healingStream && isMantraInLoadout(abilityLoadout);
}

export function shouldApplySpellbladeTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.spellblade && isWraithStrikeInLoadout(abilityLoadout);
}

/** Additive base damage for Wraith Strike when Spellblade is active (effective Intellect = allocated + talent bonus). */
export function getSpellbladeWraithStrikeFlatDamageBonus(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
  allocatedIntellect: number,
): number {
  if (!shouldApplySpellbladeTalent(talentLoadout, abilityLoadout)) return 0;
  const intellect = allocatedIntellect + SPELLBLADE_INTELLECT_BONUS;
  return intellect * SPELLBLADE_WRAITH_DAMAGE_PER_INTELLECT;
}

export function shouldApplyParryTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.parry && isSabresFlourishInLoadout(abilityLoadout);
}

export function shouldApplyBreathWeaponTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.breathWeapon && isWraithStrikeInLoadout(abilityLoadout);
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

export function shouldApplyInfernalDashTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.infernalDashRoom;
}

export function shouldApplyGlacialDashTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.glacialDashRoom;
}

export function shouldApplyMendingDashTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.mendingDashRoom;
}

export function shouldApplyStaggeringDashTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggeringDashRoom;
}

export function shouldApplyGuardbreakTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.guardbreakRoom;
}

export function shouldApplyOvershockTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.overshockRoom;
}

export function shouldApplyUnstableEnergyTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.unstableEnergyRoom;
}

/** Stagger lightning proc flat base (150 or 300 with GUARDBREAK; no Agility bonus). */
export function getStaggerProcDamage(talentLoadout: TalentLoadout | null | undefined): number {
  return shouldApplyGuardbreakTalent(talentLoadout)
    ? GUARDBREAK_STAGGER_PROC_DAMAGE
    : STAGGER_PROC_DAMAGE;
}

/** Stagger lightning proc base damage including UNSTABLE ENERGY Agility scaling. */
export function getStaggerProcBaseDamage(
  talentLoadout: TalentLoadout | null | undefined,
  agility: number = 0,
): number {
  let base = getStaggerProcDamage(talentLoadout);
  if (shouldApplyUnstableEnergyTalent(talentLoadout)) {
    base += Math.max(0, agility) * UNSTABLE_ENERGY_AGILITY_DAMAGE_PER_POINT;
  }
  return base;
}

/** Combat snapshot for UNSTABLE ENERGY stagger proc (mirrors `DamageCalculator` formulas). */
export function getUnstableEnergyStaggerProcCombatSnapshot(params: {
  agility: number;
  strength: number;
  criticalRuneCount: number;
  critDamageRuneCount: number;
}): { agility: number; critChance: number; critDamageMult: number } {
  const agility = Math.max(0, params.agility);
  const strength = Math.max(0, params.strength);
  const criticalRuneCount = Math.max(0, params.criticalRuneCount);
  const critDamageRuneCount = Math.max(0, params.critDamageRuneCount);
  return {
    agility,
    critChance: 0.11 + criticalRuneCount * 0.03 + agility * 0.01,
    critDamageMult: 2.0 + critDamageRuneCount * 0.15 + strength * 0.05,
  };
}

/** Stagger lightning proc stun duration in milliseconds. */
export function getStaggerProcStunMs(talentLoadout: TalentLoadout | null | undefined): number {
  const sec = shouldApplyOvershockTalent(talentLoadout)
    ? OVERSHOCK_STAGGER_PROC_STUN_SECONDS
    : STAGGER_PROC_STUN_SECONDS;
  return Math.round(sec * 1000);
}

export function shouldApplyBloodleechTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.bloodleechRoom;
}

export function shouldApplyRebukeTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.rebukeRoom;
}

export function shouldApplyMomentumRiftTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.momentumRiftRoom;
}

export function shouldApplyManaShieldRoomTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.manaShieldRoom;
}

export function getEffectiveIntellectWithTalentBonuses(
  stats: PlayerStats,
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): number {
  let intellect = stats.intellect;
  if (shouldApplySpellbladeTalent(talentLoadout, abilityLoadout)) {
    intellect += SPELLBLADE_INTELLECT_BONUS;
  }
  if (shouldApplyParryTalent(talentLoadout, abilityLoadout)) {
    intellect += PARRY_INTELLECT_BONUS;
  }
  return intellect;
}

export function getEffectiveStrengthWithTalentBonuses(
  stats: PlayerStats,
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): number {
  let strength = stats.strength;
  if (shouldApplyParryTalent(talentLoadout, abilityLoadout)) {
    strength += PARRY_STRENGTH_BONUS;
  }
  return strength;
}

export function getEffectiveAgilityWithTalentBonuses(
  stats: PlayerStats,
  _talentLoadout?: TalentLoadout | null,
  _abilityLoadout?: AbilityLoadout | null,
): number {
  return stats.agility;
}

export function getEffectiveStaminaWithTalentBonuses(
  stats: PlayerStats,
  _talentLoadout?: TalentLoadout | null,
  _abilityLoadout?: AbilityLoadout | null,
): number {
  return stats.stamina;
}

export function getRelentlessBackstabKillHeal(
  stats: PlayerStats,
  talentLoadout?: TalentLoadout | null,
  abilityLoadout?: AbilityLoadout | null,
): number {
  const stamina = getEffectiveStaminaWithTalentBonuses(stats, talentLoadout, abilityLoadout);
  return (
    RELENTLESS_BACKSTAB_KILL_BASE +
    RELENTLESS_BACKSTAB_KILL_HEAL_PER_STAMINA * Math.max(0, stamina)
  );
}

export function getFanOfKnivesProjectileDamage(
  stats: PlayerStats,
  talentLoadout?: TalentLoadout | null,
  abilityLoadout?: AbilityLoadout | null,
): number {
  const agility = getEffectiveAgilityWithTalentBonuses(stats, talentLoadout, abilityLoadout);
  return FAN_OF_KNIVES_BASE_DAMAGE + FAN_OF_KNIVES_DAMAGE_PER_AGILITY * Math.max(0, agility);
}

export function getWindShearProjectileDamage(
  stats: PlayerStats,
  talentLoadout?: TalentLoadout | null,
  abilityLoadout?: AbilityLoadout | null,
): number {
  const strength = getEffectiveStrengthWithTalentBonuses(stats, talentLoadout, abilityLoadout);
  return WIND_SHEAR_BASE_DAMAGE + WIND_SHEAR_DAMAGE_PER_STRENGTH * Math.max(0, strength);
}

export function getManaShieldRestoreAmount(
  effectiveIntellect: number,
  chargesConsumed: number,
): number {
  if (chargesConsumed <= 0) return 0;
  return Math.max(0, Math.floor(effectiveIntellect)) * MANA_SHIELD_RESTORE_PER_INTELLECT * chargesConsumed;
}

export function applyManaShieldRestoreForDashCharges(
  entity: Entity | null | undefined,
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
  effectiveStats: PlayerStats,
  chargesConsumed: number,
): number {
  if (!entity || chargesConsumed <= 0) return 0;
  if (!shouldApplyManaShieldRoomTalent(talentLoadout)) return 0;

  const shieldComponent = entity.getComponent(Shield);
  if (!shieldComponent) return 0;

  const intellect = getEffectiveIntellectWithTalentBonuses(effectiveStats, talentLoadout, abilityLoadout);
  const restore = getManaShieldRestoreAmount(intellect, chargesConsumed);
  if (restore <= 0) return 0;

  const newShieldValue = Math.min(
    shieldComponent.maxShield,
    shieldComponent.currentShield + restore,
  );
  shieldComponent.setShield(newShieldValue, shieldComponent.maxShield);
  return restore;
}

export function shouldApplyOrbShieldTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.orbShieldRoom;
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

export function shouldApplyHighCaliberTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.highCaliber;
}

/** Bow LMB uncharged damage + tint; talent toggle only (use with Bow equipped). */
export function shouldApplyTriggerFingerTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.triggerFinger;
}

/** Bow perfect-shot bonus Cobra Shot; talent toggle only (use with Bow equipped). */
export function shouldApplyWyvernStingTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.wyvernSting;
}

/** Bow perfect-shot Arctic Sting blizzard; talent toggle only (Bow checked at call sites). */
export function shouldApplyArcticStingTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.arcticSting;
}

export function shouldApplyGlacialBiteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.glacialBite && isFrostBiteInLoadout(abilityLoadout);
}

export function shouldApplyGlacialTalonsTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.glacialTalons && isReapingTalonsInLoadout(abilityLoadout);
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

export function shouldApplyEntanglementTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.entanglement && isFrostBiteInLoadout(abilityLoadout);
}

export function shouldApplyStaggeringBiteTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.staggeringBite && isFrostBiteInLoadout(abilityLoadout);
}

export function shouldApplyStaggeringTalonsTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.staggeringTalons && isReapingTalonsInLoadout(abilityLoadout);
}

/** Bow perfect-shot crit; talent toggle — use with Bow equipped (ControlSystem checks current weapon). */
export function shouldApplyWrathfulShotsTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.wrathfulShots;
}

/** Tempest Rounds burst arrow visual theme (primary room boons beat Wyvern green). */
export type TempestBurstTheme = 'wrathful' | 'arctic' | 'stagger' | 'wyvern' | 'default';

export function resolveTempestBurstTheme(
  talentLoadout: TalentLoadout | null | undefined,
): TempestBurstTheme {
  if (!talentLoadout) return 'default';
  if (talentLoadout.wrathfulShots) return 'wrathful';
  if (talentLoadout.arcticSting) return 'arctic';
  if (talentLoadout.staggerShot) return 'stagger';
  if (talentLoadout.wyvernSting) return 'wyvern';
  return 'default';
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

export function shouldApplyMeteorTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.meteor && isCrossentropyInLoadout(abilityLoadout);
}

export function shouldApplyFragmentationTalent(
  talentLoadout: TalentLoadout | null | undefined,
  _abilityLoadout?: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.fragmentation;
}

export function shouldApplyCloudkillTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.cloudkill;
}

export function shouldApplyCrossentropyTempestTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.crossentropyTempest && isCrossentropyInLoadout(abilityLoadout);
}

export function shouldApplyCrossentropyPlagueTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.crossentropyPlague && isCrossentropyInLoadout(abilityLoadout);
}

/** Base Crossentropy hit damage before Reaper kill stacks (PLAGUE uses higher base). */
export function getCrossentropyBaseDamage(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): number {
  if (shouldApplyCrossentropyPlagueTalent(talentLoadout, abilityLoadout)) {
    return CROSSENTROPY_PLAGUE_DAMAGE;
  }
  return CROSSENTROPY_BASE_DAMAGE;
}

/** Inferno wins, then Glacial, Tempest, Plague, else default orange fire. */
export function resolveCrossentropyVisualTheme(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): CrossentropyVisualTheme {
  if (shouldApplyInfernoTalent(talentLoadout, abilityLoadout)) return 'inferno';
  if (shouldApplyGlacialStormTalent(talentLoadout, abilityLoadout)) return 'glacial';
  if (shouldApplyCrossentropyTempestTalent(talentLoadout, abilityLoadout)) return 'tempest';
  if (shouldApplyCrossentropyPlagueTalent(talentLoadout, abilityLoadout)) return 'plague';
  return 'default';
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

/** Arcane Synergy — Entropic Bolt Intellect scaling + faster fire rate; toggle only. */
export function shouldApplyArcaneSynergyTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.arcaneSynergy;
}

export function getEntropicBoltFireRateSec(
  talentLoadout: TalentLoadout | null | undefined,
): number {
  return shouldApplyArcaneSynergyTalent(talentLoadout)
    ? ARCANE_SYNERGY_ENTROPIC_BOLT_FIRE_RATE_SEC
    : ENTROPIC_BOLT_FIRE_RATE_SEC;
}

export function getArcaneSynergyEntropicBoltFlatDamageBonus(
  talentLoadout: TalentLoadout | null | undefined,
  effectiveIntellect: number,
): number {
  if (!shouldApplyArcaneSynergyTalent(talentLoadout)) return 0;
  return ARCANE_SYNERGY_ENTROPIC_BOLT_DAMAGE_PER_INTELLECT * Math.max(0, effectiveIntellect);
}

/** Wrathful Bolts — fixed red bolts + wrathful beam crit when Icebeam replaces LMB. */
export function shouldApplyWrathfulEntropicTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.wrathfulEntropic;
}

/** Staggering Bolts — fixed blue bolts + stagger on bolts/beam ticks. */
export function shouldApplyStaggeringEntropicTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.staggeringEntropic;
}

/** Infesting Bolts — fixed green bolts + zombie on kill; beam kill heal + zombie with Icebeam. */
export function shouldApplyInfestingEntropicTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.infestingEntropic;
}

/** Purple room — deep blue entropic bolts + Arctic Shards procs. */
export function shouldApplyArcticShardsEntropicTalent(
  talentLoadout: TalentLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.arcticShards;
}

/** Purple room — Glacial Crossentropy (requires R in loadout for full effect). */
export function shouldApplyGlacialStormTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.glacialStorm && isCrossentropyInLoadout(abilityLoadout);
}

/** Purple room — Frost totem (requires Mantra in loadout). */
export function shouldApplyFrostTotemTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.frostTotem && isMantraInLoadout(abilityLoadout);
}

export function getTotemBoltVariantFromTalentLoadout(
  talentLoadout: TalentLoadout | null | undefined,
): TotemBoltVariant | undefined {
  if (!talentLoadout) return undefined;
  if (talentLoadout.wrathfulTotem) return 'wrathful';
  if (talentLoadout.staggeringTotem) return 'staggering';
  if (talentLoadout.infestingTotem) return 'infesting';
  if (talentLoadout.frostTotem) return 'frost';
  return undefined;
}

export function shouldApplyWrathfulTotemTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.wrathfulTotem && isMantraInLoadout(abilityLoadout);
}

export function shouldApplyStaggeringTotemTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.staggeringTotem && isMantraInLoadout(abilityLoadout);
}

export function shouldApplyInfestingTotemTalent(
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
): boolean {
  return !!talentLoadout?.infestingTotem && isMantraInLoadout(abilityLoadout);
}

/** Scythe colored-room boons: Wrathful / Staggering / Infesting Entropic (one branch per run). */
const SCYTHE_ENTROPIC_BOON_MUTEX_GROUP: readonly TalentId[] = [
  TALENT_WRATHFUL_ENTROPIC,
  TALENT_STAGGERING_ENTROPIC,
  TALENT_INFESTING_ENTROPIC,
  TALENT_ARCTIC_SHARDS,
];

export function getScytheEntropicBoonMutexSlot(id: TalentId): 'entropic' | null {
  return SCYTHE_ENTROPIC_BOON_MUTEX_GROUP.includes(id) ? 'entropic' : null;
}

export function expandScytheEntropicExclusionsAfterPick(picked: TalentId): TalentId[] {
  if (!SCYTHE_ENTROPIC_BOON_MUTEX_GROUP.includes(picked)) return [];
  return [...SCYTHE_ENTROPIC_BOON_MUTEX_GROUP];
}

/** Scythe Mantra boons: Wrathful / Staggering / Infesting Totem (one branch per run). */
const SCYTHE_TOTEM_BOON_MUTEX_GROUP: readonly TalentId[] = [
  TALENT_WRATHFUL_TOTEM,
  TALENT_STAGGERING_TOTEM,
  TALENT_INFESTING_TOTEM,
  TALENT_FROST_TOTEM,
];

export function getScytheTotemBoonMutexSlot(id: TalentId): 'totem' | null {
  return SCYTHE_TOTEM_BOON_MUTEX_GROUP.includes(id) ? 'totem' : null;
}

export function expandScytheTotemExclusionsAfterPick(picked: TalentId): TalentId[] {
  if (!SCYTHE_TOTEM_BOON_MUTEX_GROUP.includes(picked)) return [];
  return [...SCYTHE_TOTEM_BOON_MUTEX_GROUP];
}

/** Scythe Crossentropy (`SCYTHE_R`) room boons — Tempest / Plague / Inferno / Glacial Storm (one branch per run). */
const SCYTHE_CROSSENTROPY_BOON_MUTEX_GROUP: readonly TalentId[] = [
  TALENT_CROSSENTROPY_TEMPEST,
  TALENT_CROSSENTROPY_PLAGUE,
  TALENT_INFERNO,
  TALENT_GLACIAL_STORM,
];

export function expandScytheCrossentropyExclusionsAfterPick(picked: TalentId): TalentId[] {
  if (!SCYTHE_CROSSENTROPY_BOON_MUTEX_GROUP.includes(picked)) return [];
  return [...SCYTHE_CROSSENTROPY_BOON_MUTEX_GROUP];
}

/** Sabres colored-room boons: Backstab branch. */
const SABRES_BACKSTAB_BOON_MUTEX_GROUP: readonly TalentId[] = [
  TALENT_STAGGERING_STAB,
  TALENT_WRATHFUL_STAB,
  TALENT_INFESTED_BACKSTAB,
  TALENT_GUARD_SABRES_STAB,
];

/** Sabres colored-room boons: LMB swipes branch (includes Staggering Swipes). */
const SABRES_SWIPES_BOON_MUTEX_GROUP: readonly TalentId[] = [
  TALENT_STAGGERING_SWIPES,
  TALENT_WRATHFUL_SABRES_SWIPES,
  TALENT_INFESTING_SABRES_SWIPES,
  TALENT_GUARD_SABRES_SWIPES,
];

/** Sabres colored-room boons: Flourish (`SABRES_E`) branch. */
const SABRES_FLOURISH_BOON_MUTEX_GROUP: readonly TalentId[] = [
  TALENT_STAGGERING_FLOURISH,
  TALENT_WRATHFUL_FLOURISH,
  TALENT_INFESTED_FLOURISH,
  TALENT_GUARD_SABRES_FLOURISH,
];

export function expandSabresBackstabRoomBoonExclusionsAfterPick(picked: TalentId): TalentId[] {
  if (!SABRES_BACKSTAB_BOON_MUTEX_GROUP.includes(picked)) return [];
  return [...SABRES_BACKSTAB_BOON_MUTEX_GROUP];
}

export function expandSabresSwipesRoomBoonExclusionsAfterPick(picked: TalentId): TalentId[] {
  if (!SABRES_SWIPES_BOON_MUTEX_GROUP.includes(picked)) return [];
  return [...SABRES_SWIPES_BOON_MUTEX_GROUP];
}

export function expandSabresFlourishRoomBoonExclusionsAfterPick(picked: TalentId): TalentId[] {
  if (!SABRES_FLOURISH_BOON_MUTEX_GROUP.includes(picked)) return [];
  return [...SABRES_FLOURISH_BOON_MUTEX_GROUP];
}

export function shouldApplyStaggeringStabTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggeringStab;
}

export function shouldApplyWrathfulStabTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.wrathfulStab;
}

export function shouldApplyInfestedBackstabTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.infestedBackstab;
}

export function shouldApplyKillstreakTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.killstreak;
}

export function shouldApplyRelentlessTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.relentless;
}

export function shouldApplyVorpalGustTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.vorpalGust;
}

export function shouldApplyFanOfKnivesTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.fanOfKnives;
}

/**
 * Guard > Stagger > Wrath > Infested > default (mutex room boons normally pick one; order handles debug multi-toggle).
 */
export function getFanOfKnivesFlourishTintFromLoadout(
  talentLoadout: TalentLoadout | null | undefined,
): FanOfKnivesFlourishTint {
  if (!talentLoadout) return 'default';
  if (talentLoadout.guardSabresFlourish) return 'guard';
  if (talentLoadout.staggeringFlourish) return 'staggering';
  if (talentLoadout.wrathfulFlourish) return 'wrathful';
  if (talentLoadout.infestedFlourish) return 'infested';
  return 'default';
}

export interface FanOfKnivesDaggerColors {
  dagger: string;
  glow: string;
  trail: string;
  light: string;
}

export function getFanOfKnivesDaggerColorsFromTint(tint: FanOfKnivesFlourishTint): FanOfKnivesDaggerColors {
  switch (tint) {
    case 'guard':
      return { dagger: '#9944ee', glow: '#cc66ff', trail: '#5500aa', light: '#9944ee' };
    case 'staggering':
      return { dagger: '#4488ff', glow: '#66aaff', trail: '#2266cc', light: '#4488ff' };
    case 'wrathful':
      return { dagger: '#dd2222', glow: '#ff4444', trail: '#881111', light: '#dd2222' };
    case 'infested':
      return { dagger: '#33cc66', glow: '#66ff88', trail: '#118844', light: '#33cc66' };
    default:
      return { dagger: '#ff8888', glow: '#ffaaaa', trail: '#cc5555', light: '#ff8888' };
  }
}

export function shouldApplyWrathfulSabresSwipesTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.wrathfulSabresSwipes;
}

export function shouldApplyInfestingSabresSwipesTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.infestingSabresSwipes;
}

export function shouldApplyStaggeringFlourishTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.staggeringFlourish;
}

export function shouldApplyWrathfulFlourishTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.wrathfulFlourish;
}

export function shouldApplyInfestedFlourishTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.infestedFlourish;
}

export function shouldApplyGuardSabresSwipesTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.guardSabresSwipes;
}

export function shouldApplyCrescentBladesTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.crescentBlades;
}

export function shouldApplyMortalStrikeTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.mortalStrike;
}

export function resolveMortalStrikeTheme(
  talentLoadout: TalentLoadout | null | undefined,
): MortalStrikeTheme {
  if (talentLoadout?.wrathfulCombo) return 'wrathful';
  if (talentLoadout?.staggeringCombo) return 'staggering';
  if (talentLoadout?.infestedCombo) return 'infested';
  if (talentLoadout?.guardCombo) return 'wraith_guard';
  return 'default';
}

export type MortalStrikeDamageBundle = {
  baseDamage: number;
  theme: MortalStrikeTheme;
  critChanceAdd?: number;
  staggerToAdd?: number;
  infestedCombo?: boolean;
};

export function resolveMortalStrikeDamageBundle(
  talentLoadout: TalentLoadout | null | undefined,
): MortalStrikeDamageBundle {
  const theme = resolveMortalStrikeTheme(talentLoadout);
  switch (theme) {
    case 'wrathful':
      return {
        baseDamage: MORTAL_STRIKE_BASE_DAMAGE,
        theme,
        critChanceAdd: MORTAL_STRIKE_WRATHFUL_CRIT_CHANCE_ADD,
      };
    case 'staggering':
      return {
        baseDamage: MORTAL_STRIKE_STAGGERING_DAMAGE,
        theme,
        staggerToAdd: MORTAL_STRIKE_STAGGERING_STAGGER,
      };
    case 'infested':
      return {
        baseDamage: MORTAL_STRIKE_INFESTED_DAMAGE,
        theme,
        infestedCombo: true,
      };
    case 'wraith_guard':
      return {
        baseDamage: MORTAL_STRIKE_GUARD_DAMAGE,
        theme,
      };
    default:
      return {
        baseDamage: MORTAL_STRIKE_BASE_DAMAGE,
        theme,
      };
  }
}

export function shouldApplyWindShearTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.windShear;
}

export function getPsionicBladesProcDamage(allocatedIntellect: number): number {
  return PSIONIC_BLADES_BASE_DAMAGE + PSIONIC_BLADES_DAMAGE_PER_INTELLECT * Math.max(0, allocatedIntellect);
}

export function shouldApplyPsionicBladesTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.psionicBlades;
}

export function shouldApplyGuardSabresStabTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.guardSabresStab;
}

/** Vorpal Gust beam palette when a Sabres backstab room boon is active (mutex group). */
export type VorpalGustStabBoonBeamTheme = 'default' | 'wrathful' | 'staggering' | 'infested' | 'guard';

export function getVorpalGustStabBoonBeamTheme(
  talentLoadout: TalentLoadout | null | undefined,
): VorpalGustStabBoonBeamTheme {
  if (shouldApplyWrathfulStabTalent(talentLoadout)) return 'wrathful';
  if (shouldApplyStaggeringStabTalent(talentLoadout)) return 'staggering';
  if (shouldApplyInfestedBackstabTalent(talentLoadout)) return 'infested';
  if (shouldApplyGuardSabresStabTalent(talentLoadout)) return 'guard';
  return 'default';
}

export function shouldApplyGuardSabresFlourishTalent(talentLoadout: TalentLoadout | null | undefined): boolean {
  return !!talentLoadout?.guardSabresFlourish;
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

export type CoopRoomColor = 'blue' | 'green' | 'purple' | 'red';

function isCoopRoomColor(s: string | null | undefined): s is CoopRoomColor {
  return s === 'blue' || s === 'green' || s === 'purple' || s === 'red';
}

/** Universal green coop room zombie boons — merged into weapon-specific green pools (and standalone for weapons without a green line). */
export const GREEN_COOP_UNIVERSAL_ZOMBIE_BOONS: readonly TalentId[] = [
  TALENT_PACK_HUNTER,
  TALENT_BERSERKER_STRAIN,
  TALENT_JUGGERNAUT_STRAIN,
  TALENT_EXPLODER_STRAIN,
];

const UNIVERSAL_GREEN_ZOMBIE_BOON_SET = new Set<TalentId>(GREEN_COOP_UNIVERSAL_ZOMBIE_BOONS);

/** After picking a universal green zombie room boon, exclude that id from future green pools this co-op arena session (see page.tsx ref). */
export function expandUniversalGreenZombieBoonIdsAfterPick(picked: TalentId): TalentId[] {
  return UNIVERSAL_GREEN_ZOMBIE_BOON_SET.has(picked) ? [picked] : [];
}

export const ROOM_BOOM_DASH_BOON_MUTEX_GROUP: readonly TalentId[] = [
  TALENT_INFERNAL_DASH,
  TALENT_GLACIAL_DASH,
  TALENT_MENDING_DASH,
  TALENT_STAGGERING_DASH,
];

export function expandRoomBoomDashExclusionsAfterPick(picked: TalentId): TalentId[] {
  return ROOM_BOOM_DASH_BOON_MUTEX_GROUP.includes(picked)
    ? [...ROOM_BOOM_DASH_BOON_MUTEX_GROUP]
    : [];
}

/** Payload for `coop-zombie-room-boons` Socket.IO sync (server applies to raised zombies). */
export function getCoopZombieRoomBoonsPayload(loadout: TalentLoadout): {
  packHunter: boolean;
  berserkerStrain: boolean;
  juggernautStrain: boolean;
  exploderStrain: boolean;
} {
  return {
    packHunter: !!loadout.packHunterRoom,
    berserkerStrain: !!loadout.berserkerStrainRoom,
    juggernautStrain: !!loadout.juggernautStrainRoom,
    exploderStrain: !!loadout.exploderStrainRoom,
  };
}

export interface CoopStaggerRoomBoonsPayload {
  guardbreak: boolean;
  overshock: boolean;
  unstableEnergy: boolean;
  /** Effective Stamina from all sources (Relentless Backstab kill heal on server). */
  stamina?: number;
  agility?: number;
  critChance?: number;
  critDamageMult?: number;
}

/** Payload for `coop-stagger-room-boons` Socket.IO sync (server applies at stagger lightning proc). */
export function getCoopStaggerRoomBoonsPayload(
  loadout: TalentLoadout,
  combatSnapshot?: {
    agility: number;
    strength: number;
    stamina: number;
    criticalRuneCount: number;
    critDamageRuneCount: number;
  },
): CoopStaggerRoomBoonsPayload {
  const unstableEnergy = !!loadout.unstableEnergyRoom;
  const payload: CoopStaggerRoomBoonsPayload = {
    guardbreak: !!loadout.guardbreakRoom,
    overshock: !!loadout.overshockRoom,
    unstableEnergy,
  };
  if (combatSnapshot) {
    payload.stamina = Math.max(0, combatSnapshot.stamina);
  }
  if (unstableEnergy && combatSnapshot) {
    const snap = getUnstableEnergyStaggerProcCombatSnapshot(combatSnapshot);
    payload.agility = snap.agility;
    payload.critChance = snap.critChance;
    payload.critDamageMult = snap.critDamageMult;
  }
  return payload;
}

/** Runeblade class boon pool. */
export function buildRunebladeClassBoonPool(
  _talentLoadout?: TalentLoadout | null,
): TalentId[] {
  return [
    TALENT_TRINITY,
    TALENT_VENGEANCE,
    TALENT_CRUSADER,
    TALENT_WINDFURY,
    TALENT_BLIZZARD,
    TALENT_CYCLONE_RUSH,
    TALENT_DOUBLE_STRIKE,
    TALENT_SPELLBLADE,
    TALENT_BREATH_WEAPON, // Aftershock
    TALENT_MORTAL_STRIKE,
    TALENT_EXECUTIONER,
  ];
}

/** Bow class boon pool (co-op). */
export function buildBowClassBoonPool(): TalentId[] {
  return [
    TALENT_EXECUTE,
    TALENT_EXPLOSIVE_TALONS,
    TALENT_CONCENTRATED_VOLLEY,
    TALENT_ENTANGLEMENT,
    TALENT_DUAL_COIL,
    TALENT_HIGH_CALIBER,
    TALENT_TRIGGER_FINGER,
    TALENT_TEMPEST_ROUNDS,
    TALENT_GIANTKILLER,
    TALENT_DOUBLE_TALONS,
    TALENT_CLOUDKILL,
    TALENT_WYVERN_STING,
  ];
}

/** Scythe class boon pool (co-op): core kit — colored Wrath/Stagger/Infest totem & entropic lines come from room boons. */
export function buildScytheClassBoonPool(): TalentId[] {
  return [
    TALENT_ICEBEAM,
    TALENT_REAPER,
    TALENT_FROSTPATH,
    TALENT_SOLAR_RECHARGE,
    TALENT_ARCANE_SYNERGY,
    TALENT_SHAMAN,
    TALENT_SUPERCONDUCTOR,
    TALENT_ACCELERATOR,
    TALENT_HEALING_STREAM,
    TALENT_METEOR,
    TALENT_FRAGMENTATION,
  ];
}

/** Sabres class boon pool (co-op): Backstab-focused talents + LMB augments (Crescent Blades, Wind Shear). */
export function buildSabresClassBoonPool(): TalentId[] {
  return [TALENT_KILLSTREAK, TALENT_RELENTLESS, TALENT_DOUBLE_STAB, TALENT_VORPAL_GUST, TALENT_FAN_OF_KNIVES, TALENT_PARRY, TALENT_CRESCENT_BLADES, TALENT_WIND_SHEAR, TALENT_PSIONIC_BLADES];
}

export function buildClassBoonPoolForWeapon(
  weapon: WeaponType,
  talentLoadout?: TalentLoadout | null,
): TalentId[] {
  if (weapon === WeaponType.NONE) return [];
  if (weapon === WeaponType.RUNEBLADE) return buildRunebladeClassBoonPool(talentLoadout);
  if (weapon === WeaponType.BOW) return buildBowClassBoonPool();
  if (weapon === WeaponType.SCYTHE) return buildScytheClassBoonPool();
  if (weapon === WeaponType.SABRES) return buildSabresClassBoonPool();
  return [];
}

/** Picks one random class-boon for a weapon (late-join / merchant auto-grant). */
export function pickRandomClassBoonForWeapon(
  weapon: WeaponType,
  talentLoadout?: TalentLoadout | null,
): TalentId | null {
  const pool = excludeOwnedTalentsFromBoonPool(
    buildClassBoonPoolForWeapon(weapon, talentLoadout),
    talentLoadout,
  );
  const [id] = pickRandomDistinctFromPool(pool, 1);
  return id ?? null;
}

/** Post–first-room boon pool from the camp color of the cleared wave (weapon-specific + universal greens). */
export function buildRoomBoonPoolForColor(
  color: string | null | undefined,
  weapon: WeaponType,
): TalentId[] {
  const k = String(color ?? '').toLowerCase();
  if (!isCoopRoomColor(k)) return [];

  let pool: TalentId[] = [];

  if (weapon === WeaponType.BOW) {
    switch (k) {
      case 'blue':
        pool = [TALENT_STAGGER_SHOT, TALENT_STAGGERING_BITE, TALENT_STAGGERING_TALONS];
        break;
      case 'green':
        pool = [TALENT_WYVERN_STING, TALENT_WYVERN_BITE, TALENT_WYVERN_TALONS];
        break;
      case 'purple':
        pool = [TALENT_ARCTIC_STING, TALENT_GLACIAL_BITE, TALENT_GLACIAL_TALONS];
        break;
      case 'red':
        pool = [TALENT_WRATHFUL_SHOTS, TALENT_WRATHFUL_BITE, TALENT_WRATHFUL_TALONS];
        break;
      default:
        pool = [];
    }
  } else if (weapon === WeaponType.SCYTHE) {
    switch (k) {
      case 'blue':
        pool = [
          TALENT_CROSSENTROPY_TEMPEST,
          TALENT_STAGGERING_ENTROPIC,
          TALENT_STAGGERING_TOTEM,
        ];
        break;
      case 'green':
        pool = [
          TALENT_CROSSENTROPY_PLAGUE,
          TALENT_INFESTING_ENTROPIC,
          TALENT_INFESTING_TOTEM,
        ];
        break;
      case 'purple':
        pool = [TALENT_ARCTIC_SHARDS, TALENT_GLACIAL_STORM, TALENT_FROST_TOTEM];
        break;
      case 'red':
        pool = [TALENT_WRATHFUL_ENTROPIC, TALENT_WRATHFUL_TOTEM, TALENT_INFERNO];
        break;
      default:
        pool = [];
    }
  } else if (weapon === WeaponType.RUNEBLADE) {
    switch (k) {
      case 'blue':
        pool = [TALENT_STAGGERING_SMITE, TALENT_STAGGERING_COMBO, TALENT_STAGGERING_STRIKE];
        break;
      case 'green':
        pool = [TALENT_INFESTED_COMBO, TALENT_INFESTED_STRIKE, TALENT_INFESTED_SMITE];
        break;
      case 'purple':
        pool = [TALENT_GUARD_COMBO, TALENT_COLOSSUS_GUARD, TALENT_WRAITH_GUARD, TALENT_DASH_GUARD];
        break;
      case 'red':
        pool = [TALENT_WRATHFUL_COMBO, TALENT_WRATH_STRIKE, TALENT_INFERNAL_SMITE, TALENT_EXECUTIONER];
        break;
      default:
        pool = [];
    }
  } else if (weapon === WeaponType.SABRES) {
    switch (k) {
      case 'blue':
        pool = [TALENT_STAGGERING_STAB, TALENT_STAGGERING_SWIPES, TALENT_STAGGERING_FLOURISH];
        break;
      case 'green':
        pool = [TALENT_INFESTED_BACKSTAB, TALENT_INFESTING_SABRES_SWIPES, TALENT_INFESTED_FLOURISH];
        break;
      case 'purple':
        pool = [
          TALENT_GUARD_SABRES_SWIPES,
          TALENT_GUARD_SABRES_STAB,
          TALENT_GUARD_SABRES_FLOURISH,
          TALENT_DASH_GUARD,
        ];
        break;
      case 'red':
        pool = [TALENT_WRATHFUL_STAB, TALENT_WRATHFUL_SABRES_SWIPES, TALENT_WRATHFUL_FLOURISH];
        break;
      default:
        pool = [];
    }
  }

  if (k === 'green') {
    return [...pool, TALENT_MENDING_DASH, TALENT_ORB_SHIELD, ...GREEN_COOP_UNIVERSAL_ZOMBIE_BOONS, TALENT_RAISE_DEAD];
  }

  switch (k) {
    case 'red':
      return [...pool, TALENT_INFERNAL_DASH, TALENT_BLOODLEECH, TALENT_REBUKE, TALENT_METEOR_STRIKE];
    case 'purple':
      return [...pool, TALENT_GLACIAL_DASH, TALENT_COLDSNAP_ROOM, TALENT_AEGIS_ROOM, TALENT_MOMENTUM_RIFT, TALENT_MANA_SHIELD];
    case 'blue':
      return [...pool, TALENT_STAGGERING_DASH, TALENT_GUARDBREAK, TALENT_OVERSHOCK, TALENT_UNSTABLE_ENERGY, TALENT_LIGHTNING_BOLT_ROOM];
    default:
      return pool;
  }
}

/** Bow colored-room boons: primary / Q / E branches (mutually exclusive per slot for the run). */
export type BowRoomBoonMutexSlot = 'primary' | 'q' | 'e';

/** Primary bow LMB room boons — mutually exclusive with each other (Wyvern Sting stacks freely). */
const BOW_PRIMARY_ROOM_BOONS: readonly TalentId[] = [
  TALENT_STAGGER_SHOT,
  TALENT_ARCTIC_STING,
  TALENT_WRATHFUL_SHOTS,
];

const BOW_ROOM_BOON_MUTEX_BY_SLOT: Record<BowRoomBoonMutexSlot, readonly TalentId[]> = {
  primary: BOW_PRIMARY_ROOM_BOONS,
  q: [TALENT_WYVERN_BITE, TALENT_WRATHFUL_BITE, TALENT_STAGGERING_BITE, TALENT_GLACIAL_BITE],
  e: [TALENT_WYVERN_TALONS, TALENT_WRATHFUL_TALONS, TALENT_STAGGERING_TALONS, TALENT_GLACIAL_TALONS],
};

export function getBowRoomBoonMutexSlot(id: TalentId): BowRoomBoonMutexSlot | null {
  switch (id) {
    case TALENT_STAGGER_SHOT:
    case TALENT_ARCTIC_STING:
    case TALENT_WRATHFUL_SHOTS:
      return 'primary';
    case TALENT_WYVERN_BITE:
    case TALENT_WRATHFUL_BITE:
    case TALENT_STAGGERING_BITE:
    case TALENT_GLACIAL_BITE:
      return 'q';
    case TALENT_WYVERN_TALONS:
    case TALENT_WRATHFUL_TALONS:
    case TALENT_STAGGERING_TALONS:
    case TALENT_GLACIAL_TALONS:
      return 'e';
    default:
      return null;
  }
}

export function getBowRoomBoonMutexGroupForSlot(slot: BowRoomBoonMutexSlot): readonly TalentId[] {
  return BOW_ROOM_BOON_MUTEX_BY_SLOT[slot];
}

/** After a room-boon pick, all ids in that slot are excluded from future room pools for the run. Wyvern Sting has no slot and excludes nothing. */
export function expandBowRoomBoonExclusionsAfterPick(picked: TalentId): TalentId[] {
  if (picked === TALENT_WYVERN_STING) return [];
  const slot = getBowRoomBoonMutexSlot(picked);
  if (!slot) return [];
  return [...getBowRoomBoonMutexGroupForSlot(slot)];
}

/** Runeblade colored-room boons: one branch per run for LMB combo, Wraith Strike, and Colossus Smite (12 ids). */
export type RunebladeRoomBoonMutexSlot = 'combo' | 'strike' | 'smite';

const RUNEBLADE_ROOM_BOON_MUTEX_BY_SLOT: Record<RunebladeRoomBoonMutexSlot, readonly TalentId[]> = {
  combo: [TALENT_INFESTED_COMBO, TALENT_WRATHFUL_COMBO, TALENT_STAGGERING_COMBO, TALENT_GUARD_COMBO],
  strike: [TALENT_INFESTED_STRIKE, TALENT_WRATH_STRIKE, TALENT_STAGGERING_STRIKE, TALENT_WRAITH_GUARD],
  smite: [TALENT_INFESTED_SMITE, TALENT_INFERNAL_SMITE, TALENT_STAGGERING_SMITE, TALENT_COLOSSUS_GUARD],
};

export function getRunebladeRoomBoonMutexSlot(id: TalentId): RunebladeRoomBoonMutexSlot | null {
  switch (id) {
    case TALENT_INFESTED_COMBO:
    case TALENT_WRATHFUL_COMBO:
    case TALENT_STAGGERING_COMBO:
    case TALENT_GUARD_COMBO:
      return 'combo';
    case TALENT_INFESTED_STRIKE:
    case TALENT_WRATH_STRIKE:
    case TALENT_STAGGERING_STRIKE:
    case TALENT_WRAITH_GUARD:
      return 'strike';
    case TALENT_INFESTED_SMITE:
    case TALENT_INFERNAL_SMITE:
    case TALENT_STAGGERING_SMITE:
    case TALENT_COLOSSUS_GUARD:
      return 'smite';
    default:
      return null;
  }
}

export function getRunebladeRoomBoonMutexGroupForSlot(
  slot: RunebladeRoomBoonMutexSlot,
): readonly TalentId[] {
  return RUNEBLADE_ROOM_BOON_MUTEX_BY_SLOT[slot];
}

/** After a room-boon pick, all four ids in that slot are excluded from future room pools for the run. EXECUTIONER has no slot and excludes nothing. */
export function expandRunebladeRoomBoonExclusionsAfterPick(picked: TalentId): TalentId[] {
  if (picked === TALENT_EXECUTIONER) return [];
  const slot = getRunebladeRoomBoonMutexSlot(picked);
  if (!slot) return [];
  return [...getRunebladeRoomBoonMutexGroupForSlot(slot)];
}

export function filterTalentIdsByExclusionSet(
  pool: readonly TalentId[],
  excluded: ReadonlySet<TalentId>,
): TalentId[] {
  return pool.filter((id) => !excluded.has(id));
}

function appendAvailableTalentIds(
  out: TalentId[],
  available: ReadonlySet<TalentId>,
  candidates: readonly TalentId[],
): void {
  for (const id of candidates) {
    if (available.has(id) && !out.includes(id)) {
      out.push(id);
    }
  }
}

function isAbilityIdInLoadout(
  loadout: AbilityLoadout | null | undefined,
  abilityId: string,
): boolean {
  if (!loadout) return false;
  return loadout.Q === abilityId || loadout.E === abilityId || loadout.R === abilityId;
}

function buildPrioritizedRoomBoonIdsForLoadout(
  pool: readonly TalentId[],
  weapon: WeaponType,
  abilityLoadout: AbilityLoadout | null | undefined,
): TalentId[] {
  const available = new Set(pool);
  const priority: TalentId[] = [];

  if (weapon === WeaponType.BOW) {
    appendAvailableTalentIds(priority, available, BOW_ROOM_BOON_MUTEX_BY_SLOT.primary);
    if (isFrostBiteInLoadout(abilityLoadout)) {
      appendAvailableTalentIds(priority, available, BOW_ROOM_BOON_MUTEX_BY_SLOT.q);
    }
    if (isReapingTalonsInLoadout(abilityLoadout)) {
      appendAvailableTalentIds(priority, available, BOW_ROOM_BOON_MUTEX_BY_SLOT.e);
    }
  } else if (weapon === WeaponType.SCYTHE) {
    appendAvailableTalentIds(priority, available, SCYTHE_ENTROPIC_BOON_MUTEX_GROUP);
    if (isCrossentropyInLoadout(abilityLoadout)) {
      appendAvailableTalentIds(priority, available, SCYTHE_CROSSENTROPY_BOON_MUTEX_GROUP);
    }
    if (isMantraInLoadout(abilityLoadout)) {
      appendAvailableTalentIds(priority, available, SCYTHE_TOTEM_BOON_MUTEX_GROUP);
    }
  } else if (weapon === WeaponType.RUNEBLADE) {
    appendAvailableTalentIds(priority, available, RUNEBLADE_ROOM_BOON_MUTEX_BY_SLOT.combo);
    if (isWraithStrikeInLoadout(abilityLoadout)) {
      appendAvailableTalentIds(priority, available, RUNEBLADE_ROOM_BOON_MUTEX_BY_SLOT.strike);
    }
    if (isColossusSmiteInLoadout(abilityLoadout)) {
      appendAvailableTalentIds(priority, available, RUNEBLADE_ROOM_BOON_MUTEX_BY_SLOT.smite);
    }
  } else if (weapon === WeaponType.SABRES) {
    appendAvailableTalentIds(priority, available, SABRES_SWIPES_BOON_MUTEX_GROUP);
    if (isAbilityIdInLoadout(abilityLoadout, 'SABRES_Q')) {
      appendAvailableTalentIds(priority, available, SABRES_BACKSTAB_BOON_MUTEX_GROUP);
    }
    if (isSabresFlourishInLoadout(abilityLoadout)) {
      appendAvailableTalentIds(priority, available, SABRES_FLOURISH_BOON_MUTEX_GROUP);
    }
  }

  return priority;
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
 * Room boons favor the player's active attack branches first, then fall back to
 * utility / universal room talents from the same already-filtered pool.
 */
export function pickPrioritizedRoomBoonOptions(
  pool: readonly TalentId[],
  color: string | null | undefined,
  weapon: WeaponType,
  abilityLoadout: AbilityLoadout | null | undefined,
  count: number = 3,
  rng: () => number = Math.random,
): TalentId[] {
  if (pool.length === 0) return [];
  if (!isCoopRoomColor(String(color ?? '').toLowerCase())) {
    return pickRandomDistinctFromPool(pool, count, rng);
  }

  const priorityPool = buildPrioritizedRoomBoonIdsForLoadout(pool, weapon, abilityLoadout);
  const pickedPriority = pickRandomDistinctFromPool(priorityPool, count, rng);
  const remainingCount = count - pickedPriority.length;

  if (remainingCount <= 0) {
    return pickedPriority;
  }

  const pickedSet = new Set(pickedPriority);
  const fallbackPool = pool.filter((id) => !pickedSet.has(id) && !priorityPool.includes(id));
  return [
    ...pickedPriority,
    ...pickRandomDistinctFromPool(fallbackPool, remainingCount, rng),
  ];
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
    case TALENT_CYCLONE_RUSH:
      next.cycloneRush = true;
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
    case TALENT_ENTANGLEMENT:
      next.entanglement = true;
      return next;
    case TALENT_INFERNO:
      next.inferno = true;
      return next;
    case TALENT_REAPER:
      next.reaper = true;
      return next;
    case TALENT_METEOR:
      next.meteor = true;
      return next;
    case TALENT_FRAGMENTATION:
      next.fragmentation = true;
      return next;
    case TALENT_DUAL_COIL:
      next.dualCoil = true;
      return next;
    case TALENT_HIGH_CALIBER:
      next.highCaliber = true;
      return next;
    case TALENT_TRIGGER_FINGER:
      next.triggerFinger = true;
      return next;
    case TALENT_CLOUDKILL:
      next.cloudkill = true;
      return next;
    case TALENT_WYVERN_STING:
      next.wyvernSting = true;
      return next;
    case TALENT_WYVERN_TALONS:
      next.wyvernTalons = true;
      return next;
    case TALENT_ARCTIC_STING:
      next.arcticSting = true;
      return next;
    case TALENT_GLACIAL_BITE:
      next.glacialBite = true;
      return next;
    case TALENT_GLACIAL_TALONS:
      next.glacialTalons = true;
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
    case TALENT_ARCANE_SYNERGY:
      next.arcaneSynergy = true;
      return next;
    case TALENT_WINDFURY:
      next.windFury = true;
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
    case TALENT_BREATH_WEAPON:
      next.breathWeapon = true;
      return next;
    case TALENT_STAGGERING_BITE:
      next.staggeringBite = true;
      return next;
    case TALENT_STAGGERING_TALONS:
      next.staggeringTalons = true;
      return next;
    case TALENT_WRATHFUL_SHOTS:
      next.wrathfulShots = true;
      return next;
    case TALENT_WRATHFUL_ENTROPIC:
      next.wrathfulEntropic = true;
      return next;
    case TALENT_STAGGERING_ENTROPIC:
      next.staggeringEntropic = true;
      return next;
    case TALENT_INFESTING_ENTROPIC:
      next.infestingEntropic = true;
      return next;
    case TALENT_WRATHFUL_TOTEM:
      next.wrathfulTotem = true;
      return next;
    case TALENT_STAGGERING_TOTEM:
      next.staggeringTotem = true;
      return next;
    case TALENT_INFESTING_TOTEM:
      next.infestingTotem = true;
      return next;
    case TALENT_CROSSENTROPY_TEMPEST:
      next.crossentropyTempest = true;
      return next;
    case TALENT_CROSSENTROPY_PLAGUE:
      next.crossentropyPlague = true;
      return next;
    case TALENT_ARCTIC_SHARDS:
      next.arcticShards = true;
      return next;
    case TALENT_GLACIAL_STORM:
      next.glacialStorm = true;
      return next;
    case TALENT_FROST_TOTEM:
      next.frostTotem = true;
      return next;
    case TALENT_SHAMAN:
      next.shaman = true;
      return next;
    case TALENT_SUPERCONDUCTOR:
      next.superconductor = true;
      return next;
    case TALENT_ACCELERATOR:
      next.accelerator = true;
      return next;
    case TALENT_GIANTKILLER:
      next.giantKiller = true;
      return next;
    case TALENT_DOUBLE_TALONS:
      next.doubleTalons = true;
      return next;
    case TALENT_HEALING_STREAM:
      next.healingStream = true;
      return next;
    case TALENT_STAGGERING_STAB:
      next.staggeringStab = true;
      return next;
    case TALENT_WRATHFUL_STAB:
      next.wrathfulStab = true;
      return next;
    case TALENT_INFESTED_BACKSTAB:
      next.infestedBackstab = true;
      return next;
    case TALENT_WRATHFUL_SABRES_SWIPES:
      next.wrathfulSabresSwipes = true;
      return next;
    case TALENT_INFESTING_SABRES_SWIPES:
      next.infestingSabresSwipes = true;
      return next;
    case TALENT_STAGGERING_FLOURISH:
      next.staggeringFlourish = true;
      return next;
    case TALENT_WRATHFUL_FLOURISH:
      next.wrathfulFlourish = true;
      return next;
    case TALENT_INFESTED_FLOURISH:
      next.infestedFlourish = true;
      return next;
    case TALENT_GUARD_SABRES_SWIPES:
      next.guardSabresSwipes = true;
      return next;
    case TALENT_CRESCENT_BLADES:
      next.crescentBlades = true;
      return next;
    case TALENT_WIND_SHEAR:
      next.windShear = true;
      return next;
    case TALENT_PSIONIC_BLADES:
      next.psionicBlades = true;
      return next;
    case TALENT_MORTAL_STRIKE:
      next.mortalStrike = true;
      return next;
    case TALENT_GUARD_SABRES_STAB:
      next.guardSabresStab = true;
      return next;
    case TALENT_GUARD_SABRES_FLOURISH:
      next.guardSabresFlourish = true;
      return next;
    case TALENT_KILLSTREAK:
      next.killstreak = true;
      return next;
    case TALENT_RELENTLESS:
      next.relentless = true;
      return next;
    case TALENT_DOUBLE_STAB:
      next.doubleStab = true;
      return next;
    case TALENT_VORPAL_GUST:
      next.vorpalGust = true;
      return next;
    case TALENT_FAN_OF_KNIVES:
      next.fanOfKnives = true;
      return next;
    case TALENT_PARRY:
      next.parry = true;
      return next;
    case TALENT_PACK_HUNTER:
      next.packHunterRoom = true;
      return next;
    case TALENT_BERSERKER_STRAIN:
      next.berserkerStrainRoom = true;
      return next;
    case TALENT_JUGGERNAUT_STRAIN:
      next.juggernautStrainRoom = true;
      return next;
    case TALENT_EXPLODER_STRAIN:
      next.exploderStrainRoom = true;
      return next;
    case TALENT_INFERNAL_DASH:
      next.infernalDashRoom = true;
      return next;
    case TALENT_GLACIAL_DASH:
      next.glacialDashRoom = true;
      return next;
    case TALENT_MENDING_DASH:
      next.mendingDashRoom = true;
      return next;
    case TALENT_STAGGERING_DASH:
      next.staggeringDashRoom = true;
      return next;
    case TALENT_GUARDBREAK:
      next.guardbreakRoom = true;
      return next;
    case TALENT_OVERSHOCK:
      next.overshockRoom = true;
      return next;
    case TALENT_UNSTABLE_ENERGY:
      next.unstableEnergyRoom = true;
      return next;
    case TALENT_BLOODLEECH:
      next.bloodleechRoom = true;
      return next;
    case TALENT_REBUKE:
      next.rebukeRoom = true;
      return next;
    case TALENT_RAISE_DEAD:
      next.raiseDeadRoom = true;
      return next;
    case TALENT_METEOR_STRIKE:
      next.meteorStrikeRoom = true;
      return next;
    case TALENT_COLDSNAP_ROOM:
      next.coldsnapRoom = true;
      return next;
    case TALENT_LIGHTNING_BOLT_ROOM:
      next.lightningBoltRoom = true;
      return next;
    case TALENT_AEGIS_ROOM:
      next.aegisRoom = true;
      return next;
    case TALENT_MOMENTUM_RIFT:
      next.momentumRiftRoom = true;
      return next;
    case TALENT_MANA_SHIELD:
      next.manaShieldRoom = true;
      return next;
    case TALENT_ORB_SHIELD:
      next.orbShieldRoom = true;
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
  [TALENT_ARCANE_SYNERGY]: arcaneSynergyTalentDefinition,
  [TALENT_WINDFURY]: windFuryTalentDefinition,
  [TALENT_CYCLONE_RUSH]: cycloneRushTalentDefinition,
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
  [TALENT_ENTANGLEMENT]: entanglementTalentDefinition,
  [TALENT_INFERNO]: infernoTalentDefinition,
  [TALENT_REAPER]: reaperTalentDefinition,
  [TALENT_METEOR]: meteorTalentDefinition,
  [TALENT_FRAGMENTATION]: fragmentationTalentDefinition,
  [TALENT_DUAL_COIL]: dualCoilTalentDefinition,
  [TALENT_HIGH_CALIBER]: highCaliberTalentDefinition,
  [TALENT_TRIGGER_FINGER]: triggerFingerTalentDefinition,
  [TALENT_CLOUDKILL]: cloudkillTalentDefinition,
  [TALENT_WYVERN_STING]: wyvernStingTalentDefinition,
  [TALENT_WYVERN_TALONS]: wyvernTalonsTalentDefinition,
  [TALENT_ARCTIC_STING]: arcticStingTalentDefinition,
  [TALENT_GLACIAL_BITE]: glacialBiteTalentDefinition,
  [TALENT_GLACIAL_TALONS]: glacialTalonsTalentDefinition,
  [TALENT_SPELLBLADE]: spellbladeTalentDefinition,
  [TALENT_TEMPEST_ROUNDS]: tempestRoundsTalentDefinition,
  [TALENT_ICEBEAM]: icebeamTalentDefinition,
  [TALENT_BREATH_WEAPON]: breathWeaponTalentDefinition,
  [TALENT_MORTAL_STRIKE]: mortalStrikeTalentDefinition,
  [TALENT_STAGGERING_BITE]: staggeringBiteTalentDefinition,
  [TALENT_STAGGERING_TALONS]: staggeringTalonsTalentDefinition,
  [TALENT_WRATHFUL_SHOTS]: wrathfulShotsTalentDefinition,
  [TALENT_WRATHFUL_ENTROPIC]: wrathfulEntropicTalentDefinition,
  [TALENT_STAGGERING_ENTROPIC]: staggeringEntropicTalentDefinition,
  [TALENT_INFESTING_ENTROPIC]: infestingEntropicTalentDefinition,
  [TALENT_WRATHFUL_TOTEM]: wrathfulTotemTalentDefinition,
  [TALENT_STAGGERING_TOTEM]: staggeringTotemTalentDefinition,
  [TALENT_INFESTING_TOTEM]: infestingTotemTalentDefinition,
  [TALENT_CROSSENTROPY_TEMPEST]: crossentropyTempestTalentDefinition,
  [TALENT_CROSSENTROPY_PLAGUE]: crossentropyPlagueTalentDefinition,
  [TALENT_ARCTIC_SHARDS]: arcticShardsTalentDefinition,
  [TALENT_GLACIAL_STORM]: glacialStormTalentDefinition,
  [TALENT_FROST_TOTEM]: frostTotemTalentDefinition,
  [TALENT_SHAMAN]: shamanTalentDefinition,
  [TALENT_SUPERCONDUCTOR]: superconductorTalentDefinition,
  [TALENT_ACCELERATOR]: acceleratorTalentDefinition,
  [TALENT_GIANTKILLER]: giantKillerTalentDefinition,
  [TALENT_DOUBLE_TALONS]: doubleTalonsTalentDefinition,
  [TALENT_HEALING_STREAM]: healingStreamTalentDefinition,
  [TALENT_STAGGERING_STAB]: staggeringStabTalentDefinition,
  [TALENT_WRATHFUL_STAB]: wrathfulStabTalentDefinition,
  [TALENT_INFESTED_BACKSTAB]: infestedBackstabTalentDefinition,
  [TALENT_WRATHFUL_SABRES_SWIPES]: wrathfulSabresSwipesTalentDefinition,
  [TALENT_INFESTING_SABRES_SWIPES]: infestingSabresSwipesTalentDefinition,
  [TALENT_STAGGERING_FLOURISH]: staggeringFlourishTalentDefinition,
  [TALENT_WRATHFUL_FLOURISH]: wrathfulFlourishTalentDefinition,
  [TALENT_INFESTED_FLOURISH]: infestedFlourishTalentDefinition,
  [TALENT_GUARD_SABRES_SWIPES]: guardSabresSwipesTalentDefinition,
  [TALENT_GUARD_SABRES_STAB]: guardSabresStabTalentDefinition,
  [TALENT_GUARD_SABRES_FLOURISH]: guardSabresFlourishTalentDefinition,
  [TALENT_CRESCENT_BLADES]: crescentBladesTalentDefinition,
  [TALENT_WIND_SHEAR]: windShearTalentDefinition,
  [TALENT_PSIONIC_BLADES]: psionicBladesTalentDefinition,
  [TALENT_KILLSTREAK]: killstreakTalentDefinition,
  [TALENT_RELENTLESS]: relentlessTalentDefinition,
  [TALENT_DOUBLE_STAB]: doubleStabTalentDefinition,
  [TALENT_VORPAL_GUST]: vorpalGustTalentDefinition,
  [TALENT_FAN_OF_KNIVES]: fanOfKnivesTalentDefinition,
  [TALENT_PARRY]: parryTalentDefinition,
  [TALENT_PACK_HUNTER]: packHunterTalentDefinition,
  [TALENT_BERSERKER_STRAIN]: berserkerStrainTalentDefinition,
  [TALENT_JUGGERNAUT_STRAIN]: juggernautStrainTalentDefinition,
  [TALENT_EXPLODER_STRAIN]: exploderStrainTalentDefinition,
  [TALENT_INFERNAL_DASH]: infernalDashTalentDefinition,
  [TALENT_GLACIAL_DASH]: glacialDashTalentDefinition,
  [TALENT_MENDING_DASH]: mendingDashTalentDefinition,
  [TALENT_STAGGERING_DASH]: staggeringDashTalentDefinition,
  [TALENT_GUARDBREAK]: guardbreakTalentDefinition,
  [TALENT_OVERSHOCK]: overshockTalentDefinition,
  [TALENT_UNSTABLE_ENERGY]: unstableEnergyTalentDefinition,
  [TALENT_BLOODLEECH]: bloodleechTalentDefinition,
  [TALENT_REBUKE]: rebukeTalentDefinition,
  [TALENT_RAISE_DEAD]: raiseDeadTalentDefinition,
  [TALENT_METEOR_STRIKE]: meteorStrikeTalentDefinition,
  [TALENT_COLDSNAP_ROOM]: coldsnapRoomTalentDefinition,
  [TALENT_LIGHTNING_BOLT_ROOM]: lightningBoltRoomTalentDefinition,
  [TALENT_AEGIS_ROOM]: aegisRoomTalentDefinition,
  [TALENT_MOMENTUM_RIFT]: momentumRiftTalentDefinition,
  [TALENT_MANA_SHIELD]: manaShieldRoomTalentDefinition,
  [TALENT_ORB_SHIELD]: orbShieldTalentDefinition,
};

/** Official room-type icons used as defaults when a room boon has no dedicated asset. */
export const COOP_ROOM_TYPE_ICON_SRC: Record<CoopRoomColor, string> = {
  blue: '/icons/storm.svg',
  purple: '/icons/glacial.svg',
  green: '/icons/necro.svg',
  red: '/icons/infernal.svg',
};

/**
 * Public URL path for talent picker / HUD icons (`public/icons/*.svg`).
 * `null` when no dedicated asset exists; room boons may fall back to `COOP_ROOM_TYPE_ICON_SRC`.
 */
export const TALENT_ICON_SRC: Record<TalentId, string | null> = {
  [TALENT_WRATH_STRIKE]: '/icons/strike.svg',
  [TALENT_INFESTED_STRIKE]: '/icons/strike.svg',
  [TALENT_WRATHFUL_TALONS]: '/icons/talon.svg',
  [TALENT_EXECUTE]: '/icons/execute.svg',
  [TALENT_EXPLOSIVE_TALONS]: '/icons/explosiveTalons.svg',
  [TALENT_CYCLONE_RUSH]: '/icons/storedCharge.svg',
  [TALENT_STAGGERING_STRIKE]: '/icons/strike.svg',
  [TALENT_STAGGERING_COMBO]: '/icons/combo.svg',
  [TALENT_STAGGERING_SWIPES]: '/icons/swipes.svg',
  [TALENT_TRINITY]: '/icons/trinity.svg',
  [TALENT_INFESTED_SMITE]: '/icons/smite.svg',
  [TALENT_STAGGERING_SMITE]: '/icons/smite.svg',
  [TALENT_INFERNAL_SMITE]: '/icons/smite.svg',
  [TALENT_VENGEANCE]: '/icons/vengeance.svg',
  [TALENT_STAGGER_SHOT]: '/icons/shot.svg',
  [TALENT_CONCENTRATED_VOLLEY]: '/icons/concentratedVolley.svg',
  [TALENT_WRATHFUL_BITE]: '/icons/bite.svg',
  [TALENT_WYVERN_BITE]: '/icons/bite.svg',
  [TALENT_ENTANGLEMENT]: '/icons/entanglement.svg',
  [TALENT_INFERNO]: '/icons/crossentropy.svg',
  [TALENT_REAPER]: '/icons/reaper.svg',
  [TALENT_METEOR]: '/icons/meteor.svg',
  [TALENT_FRAGMENTATION]: '/icons/fragmentation.svg',
  [TALENT_DUAL_COIL]: '/icons/dualCoil.svg',
  [TALENT_HIGH_CALIBER]: '/icons/highcaliber.svg',
  [TALENT_TRIGGER_FINGER]: '/icons/triggerfinger.svg',
  [TALENT_CLOUDKILL]: '/icons/cloudkill.svg',
  [TALENT_WYVERN_STING]: '/icons/wyvernSting.svg',
  [TALENT_WYVERN_TALONS]: '/icons/talon.svg',
  [TALENT_ARCTIC_STING]: '/icons/shot.svg',
  [TALENT_GLACIAL_BITE]: '/icons/bite.svg',
  [TALENT_GLACIAL_TALONS]: '/icons/talon.svg',
  [TALENT_WRAITH_GUARD]: '/icons/strike.svg',
  [TALENT_FROSTPATH]: '/icons/frostpath.svg',
  [TALENT_SOLAR_RECHARGE]: '/icons/solarRecharge.svg',
  [TALENT_ARCANE_SYNERGY]: '/icons/bolt0.svg',
  [TALENT_WINDFURY]: '/icons/windFury.svg',
  [TALENT_COLOSSUS_GUARD]: '/icons/smite.svg',
  [TALENT_WRATHFUL_COMBO]: '/icons/combo.svg',
  [TALENT_INFESTED_COMBO]: '/icons/combo.svg',
  [TALENT_GUARD_COMBO]: '/icons/combo.svg',
  [TALENT_DASH_GUARD]: null,
  [TALENT_EXECUTIONER]: '/icons/dash.svg',
  [TALENT_DOUBLE_STRIKE]: '/icons/doubleStrike.svg',
  [TALENT_CRUSADER]: '/icons/crusader.svg',
  [TALENT_BLIZZARD]: '/icons/blizzard.svg',
  [TALENT_SPELLBLADE]: '/icons/spellblade.svg',
  [TALENT_TEMPEST_ROUNDS]: '/icons/tempestRounds.svg',
  [TALENT_ICEBEAM]: '/icons/icebeam.svg',
  [TALENT_BREATH_WEAPON]: '/icons/aftershock.svg',
  [TALENT_MORTAL_STRIKE]: '/icons/strike.svg',
  [TALENT_STAGGERING_BITE]: '/icons/bite.svg',
  [TALENT_STAGGERING_TALONS]: '/icons/talon.svg',
  [TALENT_WRATHFUL_SHOTS]: '/icons/shot.svg',
  [TALENT_WRATHFUL_ENTROPIC]: '/icons/bolt.svg',
  [TALENT_STAGGERING_ENTROPIC]: '/icons/bolt.svg',
  [TALENT_INFESTING_ENTROPIC]: '/icons/bolt.svg',
  [TALENT_WRATHFUL_TOTEM]: '/icons/totem.svg',
  [TALENT_STAGGERING_TOTEM]: '/icons/totem.svg',
  [TALENT_INFESTING_TOTEM]: '/icons/totem.svg',
  [TALENT_CROSSENTROPY_TEMPEST]: '/icons/crossentropy.svg',
  [TALENT_CROSSENTROPY_PLAGUE]: '/icons/crossentropy.svg',
  [TALENT_ARCTIC_SHARDS]: '/icons/bolt.svg',
  [TALENT_GLACIAL_STORM]: '/icons/crossentropy.svg',
  [TALENT_FROST_TOTEM]: '/icons/totem.svg',
  [TALENT_SHAMAN]: '/icons/shaman.svg',
  [TALENT_SUPERCONDUCTOR]: '/icons/superconductor.svg',
  [TALENT_ACCELERATOR]: '/icons/accelerator.svg',
  [TALENT_GIANTKILLER]: '/icons/giantkiller.svg',
  [TALENT_DOUBLE_TALONS]: '/icons/doubleTalons.svg',
  [TALENT_HEALING_STREAM]: '/icons/healingStream.svg',
  [TALENT_STAGGERING_STAB]: '/icons/stab.svg',
  [TALENT_WRATHFUL_STAB]: '/icons/stab.svg',
  [TALENT_INFESTED_BACKSTAB]: '/icons/stab.svg',
  [TALENT_WRATHFUL_SABRES_SWIPES]: '/icons/swipes.svg',
  [TALENT_INFESTING_SABRES_SWIPES]: '/icons/swipes.svg',
  [TALENT_STAGGERING_FLOURISH]: '/icons/flourish.svg',
  [TALENT_WRATHFUL_FLOURISH]: '/icons/flourish.svg',
  [TALENT_INFESTED_FLOURISH]: '/icons/flourish.svg',
  [TALENT_GUARD_SABRES_SWIPES]: '/icons/swipes.svg',
  [TALENT_GUARD_SABRES_STAB]: '/icons/stab.svg',
  [TALENT_GUARD_SABRES_FLOURISH]: '/icons/flourish.svg',
  [TALENT_CRESCENT_BLADES]: '/icons/crescentFlare.svg',
  [TALENT_WIND_SHEAR]: '/icons/windShear.svg',
  [TALENT_PSIONIC_BLADES]: '/icons/psionicBlades.svg',
  [TALENT_KILLSTREAK]: '/icons/killstreak.svg',
  [TALENT_RELENTLESS]: '/icons/relentless.svg',
  [TALENT_DOUBLE_STAB]: '/icons/doubleStab.svg',
  [TALENT_VORPAL_GUST]: '/icons/vorpalGust.svg',
  [TALENT_FAN_OF_KNIVES]: '/icons/fanofknives.svg',
  [TALENT_PARRY]: '/icons/parry.svg',
  [TALENT_PACK_HUNTER]: null,
  [TALENT_BERSERKER_STRAIN]: null,
  [TALENT_JUGGERNAUT_STRAIN]: null,
  [TALENT_EXPLODER_STRAIN]: null,
  [TALENT_INFERNAL_DASH]: null,
  [TALENT_GLACIAL_DASH]: null,
  [TALENT_MENDING_DASH]: null,
  [TALENT_STAGGERING_DASH]: null,
  [TALENT_GUARDBREAK]: null,
  [TALENT_OVERSHOCK]: null,
  [TALENT_UNSTABLE_ENERGY]: null,
  [TALENT_BLOODLEECH]: null,
  [TALENT_REBUKE]: null,
  [TALENT_RAISE_DEAD]: null,
  [TALENT_METEOR_STRIKE]: '/icons/meteor.svg',
  [TALENT_COLDSNAP_ROOM]: null,
  [TALENT_LIGHTNING_BOLT_ROOM]: null,
  [TALENT_AEGIS_ROOM]: null,
  [TALENT_MOMENTUM_RIFT]: null,
  [TALENT_MANA_SHIELD]: null,
  [TALENT_ORB_SHIELD]: null,
};

const COOP_ROOM_COLOR_BY_TALENT: Partial<Record<TalentId, CoopRoomColor>> = (() => {
  const map: Partial<Record<TalentId, CoopRoomColor>> = {};
  const colors: CoopRoomColor[] = ['blue', 'green', 'purple', 'red'];
  const weapons = [WeaponType.RUNEBLADE, WeaponType.BOW, WeaponType.SCYTHE, WeaponType.SABRES];
  for (const color of colors) {
    for (const weapon of weapons) {
      for (const id of buildRoomBoonPoolForColor(color, weapon)) {
        map[id] = color;
      }
    }
  }
  return map;
})();

export function getCoopRoomColorForTalent(id: TalentId): CoopRoomColor | null {
  return COOP_ROOM_COLOR_BY_TALENT[id] ?? null;
}

export function getTalentIconSrc(id: TalentId, roomColor?: string | null): string | null {
  const explicit = TALENT_ICON_SRC[id] ?? null;
  if (explicit) return explicit;

  const normalized = String(roomColor ?? '').toLowerCase();
  const fromArg = isCoopRoomColor(normalized) ? normalized : null;
  const color = fromArg ?? COOP_ROOM_COLOR_BY_TALENT[id] ?? null;
  return color ? COOP_ROOM_TYPE_ICON_SRC[color] : null;
}

/** All enabled talent ids for HUD / tooltips (order matches loadout field declaration). */
export function getEnabledTalentIds(loadout: TalentLoadout): TalentId[] {
  const out: TalentId[] = [];
  if (loadout.wrathStrike) out.push(TALENT_WRATH_STRIKE);
  if (loadout.infestedStrike) out.push(TALENT_INFESTED_STRIKE);
  if (loadout.wraithGuard) out.push(TALENT_WRAITH_GUARD);
  if (loadout.staggeringStrike) out.push(TALENT_STAGGERING_STRIKE);
  if (loadout.staggeringCombo) out.push(TALENT_STAGGERING_COMBO);
  if (loadout.staggeringSwipes) out.push(TALENT_STAGGERING_SWIPES);
  if (loadout.wrathfulTalons) out.push(TALENT_WRATHFUL_TALONS);
  if (loadout.execute) out.push(TALENT_EXECUTE);
  if (loadout.explosiveTalons) out.push(TALENT_EXPLOSIVE_TALONS);
  if (loadout.cycloneRush) out.push(TALENT_CYCLONE_RUSH);
  if (loadout.trinity) out.push(TALENT_TRINITY);
  if (loadout.infestedSmite) out.push(TALENT_INFESTED_SMITE);
  if (loadout.staggeringSmite) out.push(TALENT_STAGGERING_SMITE);
  if (loadout.infernalSmite) out.push(TALENT_INFERNAL_SMITE);
  if (loadout.vengeanceSmite) out.push(TALENT_VENGEANCE);
  if (loadout.colossusGuard) out.push(TALENT_COLOSSUS_GUARD);
  if (loadout.staggerShot) out.push(TALENT_STAGGER_SHOT);
  if (loadout.concentratedVolley) out.push(TALENT_CONCENTRATED_VOLLEY);
  if (loadout.wrathfulBite) out.push(TALENT_WRATHFUL_BITE);
  if (loadout.wyvernBite) out.push(TALENT_WYVERN_BITE);
  if (loadout.entanglement) out.push(TALENT_ENTANGLEMENT);
  if (loadout.inferno) out.push(TALENT_INFERNO);
  if (loadout.reaper) out.push(TALENT_REAPER);
  if (loadout.meteor) out.push(TALENT_METEOR);
  if (loadout.fragmentation) out.push(TALENT_FRAGMENTATION);
  if (loadout.frostPath) out.push(TALENT_FROSTPATH);
  if (loadout.solarRecharge) out.push(TALENT_SOLAR_RECHARGE);
  if (loadout.arcaneSynergy) out.push(TALENT_ARCANE_SYNERGY);
  if (loadout.windFury) out.push(TALENT_WINDFURY);
  if (loadout.dualCoil) out.push(TALENT_DUAL_COIL);
  if (loadout.highCaliber) out.push(TALENT_HIGH_CALIBER);
  if (loadout.triggerFinger) out.push(TALENT_TRIGGER_FINGER);
  if (loadout.cloudkill) out.push(TALENT_CLOUDKILL);
  if (loadout.wyvernSting) out.push(TALENT_WYVERN_STING);
  if (loadout.wyvernTalons) out.push(TALENT_WYVERN_TALONS);
  if (loadout.arcticSting) out.push(TALENT_ARCTIC_STING);
  if (loadout.glacialBite) out.push(TALENT_GLACIAL_BITE);
  if (loadout.glacialTalons) out.push(TALENT_GLACIAL_TALONS);
  if (loadout.wrathfulCombo) out.push(TALENT_WRATHFUL_COMBO);
  if (loadout.infestedCombo) out.push(TALENT_INFESTED_COMBO);
  if (loadout.guardCombo) out.push(TALENT_GUARD_COMBO);
  if (loadout.dashGuard) out.push(TALENT_DASH_GUARD);
  if (loadout.executioner) out.push(TALENT_EXECUTIONER);
  if (loadout.doubleStrike) out.push(TALENT_DOUBLE_STRIKE);
  if (loadout.crusader) out.push(TALENT_CRUSADER);
  if (loadout.blizzard) out.push(TALENT_BLIZZARD);
  if (loadout.spellblade) out.push(TALENT_SPELLBLADE);
  if (loadout.tempestRounds) out.push(TALENT_TEMPEST_ROUNDS);
  if (loadout.icebeam) out.push(TALENT_ICEBEAM);
  if (loadout.breathWeapon) out.push(TALENT_BREATH_WEAPON);
  if (loadout.mortalStrike) out.push(TALENT_MORTAL_STRIKE);
  if (loadout.staggeringBite) out.push(TALENT_STAGGERING_BITE);
  if (loadout.staggeringTalons) out.push(TALENT_STAGGERING_TALONS);
  if (loadout.wrathfulShots) out.push(TALENT_WRATHFUL_SHOTS);
  if (loadout.wrathfulEntropic) out.push(TALENT_WRATHFUL_ENTROPIC);
  if (loadout.staggeringEntropic) out.push(TALENT_STAGGERING_ENTROPIC);
  if (loadout.infestingEntropic) out.push(TALENT_INFESTING_ENTROPIC);
  if (loadout.wrathfulTotem) out.push(TALENT_WRATHFUL_TOTEM);
  if (loadout.staggeringTotem) out.push(TALENT_STAGGERING_TOTEM);
  if (loadout.infestingTotem) out.push(TALENT_INFESTING_TOTEM);
    if (loadout.crossentropyTempest) out.push(TALENT_CROSSENTROPY_TEMPEST);
    if (loadout.crossentropyPlague) out.push(TALENT_CROSSENTROPY_PLAGUE);
    if (loadout.arcticShards) out.push(TALENT_ARCTIC_SHARDS);
    if (loadout.glacialStorm) out.push(TALENT_GLACIAL_STORM);
    if (loadout.frostTotem) out.push(TALENT_FROST_TOTEM);
    if (loadout.shaman) out.push(TALENT_SHAMAN);
  if (loadout.superconductor) out.push(TALENT_SUPERCONDUCTOR);
  if (loadout.accelerator) out.push(TALENT_ACCELERATOR);
  if (loadout.giantKiller) out.push(TALENT_GIANTKILLER);
  if (loadout.doubleTalons) out.push(TALENT_DOUBLE_TALONS);
  if (loadout.healingStream) out.push(TALENT_HEALING_STREAM);
  if (loadout.staggeringStab) out.push(TALENT_STAGGERING_STAB);
  if (loadout.wrathfulStab) out.push(TALENT_WRATHFUL_STAB);
  if (loadout.infestedBackstab) out.push(TALENT_INFESTED_BACKSTAB);
  if (loadout.wrathfulSabresSwipes) out.push(TALENT_WRATHFUL_SABRES_SWIPES);
  if (loadout.infestingSabresSwipes) out.push(TALENT_INFESTING_SABRES_SWIPES);
  if (loadout.staggeringFlourish) out.push(TALENT_STAGGERING_FLOURISH);
  if (loadout.wrathfulFlourish) out.push(TALENT_WRATHFUL_FLOURISH);
  if (loadout.infestedFlourish) out.push(TALENT_INFESTED_FLOURISH);
  if (loadout.guardSabresSwipes) out.push(TALENT_GUARD_SABRES_SWIPES);
  if (loadout.guardSabresStab) out.push(TALENT_GUARD_SABRES_STAB);
  if (loadout.guardSabresFlourish) out.push(TALENT_GUARD_SABRES_FLOURISH);
  if (loadout.crescentBlades) out.push(TALENT_CRESCENT_BLADES);
  if (loadout.windShear) out.push(TALENT_WIND_SHEAR);
  if (loadout.psionicBlades) out.push(TALENT_PSIONIC_BLADES);
  if (loadout.killstreak) out.push(TALENT_KILLSTREAK);
  if (loadout.relentless) out.push(TALENT_RELENTLESS);
  if (loadout.doubleStab) out.push(TALENT_DOUBLE_STAB);
  if (loadout.vorpalGust) out.push(TALENT_VORPAL_GUST);
  if (loadout.fanOfKnives) out.push(TALENT_FAN_OF_KNIVES);
  if (loadout.parry) out.push(TALENT_PARRY);
  if (loadout.packHunterRoom) out.push(TALENT_PACK_HUNTER);
  if (loadout.berserkerStrainRoom) out.push(TALENT_BERSERKER_STRAIN);
  if (loadout.juggernautStrainRoom) out.push(TALENT_JUGGERNAUT_STRAIN);
  if (loadout.exploderStrainRoom) out.push(TALENT_EXPLODER_STRAIN);
  if (loadout.infernalDashRoom) out.push(TALENT_INFERNAL_DASH);
  if (loadout.glacialDashRoom) out.push(TALENT_GLACIAL_DASH);
  if (loadout.mendingDashRoom) out.push(TALENT_MENDING_DASH);
  if (loadout.staggeringDashRoom) out.push(TALENT_STAGGERING_DASH);
  if (loadout.guardbreakRoom) out.push(TALENT_GUARDBREAK);
  if (loadout.overshockRoom) out.push(TALENT_OVERSHOCK);
  if (loadout.unstableEnergyRoom) out.push(TALENT_UNSTABLE_ENERGY);
  if (loadout.bloodleechRoom) out.push(TALENT_BLOODLEECH);
  if (loadout.rebukeRoom) out.push(TALENT_REBUKE);
  if (loadout.raiseDeadRoom) out.push(TALENT_RAISE_DEAD);
  if (loadout.meteorStrikeRoom) out.push(TALENT_METEOR_STRIKE);
  if (loadout.coldsnapRoom) out.push(TALENT_COLDSNAP_ROOM);
  if (loadout.lightningBoltRoom) out.push(TALENT_LIGHTNING_BOLT_ROOM);
  if (loadout.aegisRoom) out.push(TALENT_AEGIS_ROOM);
  if (loadout.momentumRiftRoom) out.push(TALENT_MOMENTUM_RIFT);
  if (loadout.manaShieldRoom) out.push(TALENT_MANA_SHIELD);
  if (loadout.orbShieldRoom) out.push(TALENT_ORB_SHIELD);
  return out;
}

const COOP_ROOM_COLORS: CoopRoomColor[] = ['blue', 'green', 'purple', 'red'];

/** All talent ids that can belong to a weapon (class boons + room boons across colors). */
export function buildWeaponTalentIdSet(
  weapon: WeaponType,
  talentLoadoutForPool?: TalentLoadout | null,
): Set<TalentId> {
  const set = new Set<TalentId>();
  for (const id of buildClassBoonPoolForWeapon(weapon, talentLoadoutForPool)) {
    set.add(id);
  }
  for (const color of COOP_ROOM_COLORS) {
    for (const id of buildRoomBoonPoolForColor(color, weapon)) {
      set.add(id);
    }
  }
  return set;
}

/** Enabled talent ids visible for the currently equipped weapon (HUD filtering). */
export function getEnabledTalentIdsForWeapon(
  loadout: TalentLoadout,
  weapon: WeaponType,
  talentLoadoutForPool?: TalentLoadout | null,
): TalentId[] {
  if (weapon === WeaponType.NONE) return [];
  const allowed = buildWeaponTalentIdSet(weapon, talentLoadoutForPool);
  return getEnabledTalentIds(loadout).filter((id) => allowed.has(id));
}

/** Remove talents the player already has this run before rolling co-op class/room boon choices. */
export function excludeOwnedTalentsFromBoonPool(
  pool: readonly TalentId[],
  talentLoadout: TalentLoadout | null | undefined,
): TalentId[] {
  if (talentLoadout == null) return pool.slice();
  return filterTalentIdsByExclusionSet(pool, new Set(getEnabledTalentIds(talentLoadout)));
}

/** UI copy for co-op 3-boon picks (falls back to id if missing). */
export function getTalentBoonDefinition(id: TalentId): TalentDefinition | null {
  return BOON_TALENT_DEFINITIONS[id] ?? null;
}