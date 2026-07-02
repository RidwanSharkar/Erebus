// Control system for player input handling
import { Vector3, Matrix4 } from '@/utils/three-exports';
import { PerspectiveCamera } from '@/utils/three-exports';

import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { Shield } from '@/ecs/components/Shield';
import { Enemy, EnemyType, capFreezeMsForEnemy } from '@/ecs/components/Enemy';
import { Renderer } from '@/ecs/components/Renderer';
import { Collider } from '@/ecs/components/Collider';
import { Projectile } from '@/ecs/components/Projectile';
import { InputManager } from '@/core/InputManager';
import { World } from '@/ecs/World';
import { CameraSystem } from './CameraSystem';
import { ProjectileSystem } from './ProjectileSystem';
import { AudioSystem } from './AudioSystem';
import { CombatSystem } from './CombatSystem';
import { CollisionSystem } from './CollisionSystem';
import { WeaponSubclass, WeaponType } from '@/components/dragon/weapons';
import { DeflectBarrier } from '@/components/weapons/DeflectBarrier';
import { spawnArcticGroundBlizzardAtFromReact } from '@/components/weapons/Blizzard/arcticBlizzardSpawnBridge';
import { SkillPointSystem, SkillPointData } from '@/utils/SkillPointSystem';
import type { PlayerStats } from '@/utils/StatSystem';
import { AbilityLoadout } from '@/utils/weaponAbilities';
import {
  ICEBEAM_MAX_HOLD_SEC,
  ICEBEAM_COOLDOWN_AFTER_RELEASE_SEC,
  ICEBEAM_COOLDOWN_AFTER_MAX_HOLD_SEC,
} from '@/utils/icebeamConstants';
import { MELEE_ARC_MIN_DOT, MELEE_ARC_RANGE } from '@/utils/meleeArcConstants';
import type { DamageCalcOptions } from '@/core/DamageCalculator';
import {
  TalentLoadout,
  createDefaultTalentLoadout,
  normalizeTalentLoadout,
  isWraithStrikeInLoadout,
  shouldApplyTrinityTalent as computeTrinityTalentActive,
  shouldApplyInfestedSmiteTalent as computeInfestedSmiteTalentActive,
  shouldApplyInfernalSmiteTalent as computeInfernalSmiteTalentActive,
  shouldApplyVengeanceSmiteTalent,
  getVengeanceSmiteOutgoingDamageMultiplier,
  shouldApplyStaggeringSmiteTalent as computeStaggeringSmiteTalentActive,
  shouldApplyWrathfulTalonsTalent as computeWrathfulTalonsTalentActive,
  shouldApplyExplosiveTalonsTalent,
  shouldApplyConcentratedVolleyTalent as computeConcentratedVolleyTalentActive,
  shouldApplyWrathfulBiteTalent,
  shouldApplyWyvernBiteTalent,
  shouldApplyStaggeringBiteTalent,
  shouldApplyEntanglementTalent,
  shouldApplyInfernoTalent,
  shouldApplyReaperTalent,
  shouldApplyMeteorTalent,
  shouldApplyFragmentationTalent,
  shouldApplyCrossentropyTempestTalent,
  shouldApplyCrossentropyPlagueTalent,
  shouldApplyWrathfulEntropicTalent,
  shouldApplyStaggeringEntropicTalent,
  shouldApplyInfestingEntropicTalent,
  INFESTING_ENTROPIC_BOLT_DAMAGE,
  shouldApplyArcticShardsEntropicTalent,
  ARCTIC_SHARDS_PROC_CHANCE,
  ARCTIC_ENTROPIC_BOLT_DAMAGE,
  shouldApplyGlacialStormTalent,
  shouldApplyWraithGuardTalent,
  shouldApplyDoubleStrikeTalent,
  shouldApplyDoubleStabTalent,
  shouldApplyDoubleTalonsTalent,
  REAPING_TALONS_DOUBLE_TALONS_MAX_CHARGES,
  REAPING_TALONS_DOUBLE_TALONS_INTERNAL_COOLDOWN_SEC,
  shouldApplyColossusGuardTalent,
  shouldApplyGuardComboTalent,
  shouldApplyDashGuardTalent,
  shouldApplyGuardSabresSwipesTalent,
  shouldApplyGuardSabresStabTalent,
  shouldApplyGuardSabresFlourishTalent,
  shouldApplyInfernalDashTalent,
  shouldApplyGlacialDashTalent,
  shouldApplyMendingDashTalent,
  shouldApplyStaggeringDashTalent,
  shouldApplyBloodOrbsTalent,
  BLOOD_ORBS_DASH_HP_COST,
  shouldApplyBloodleechTalent,
  GLACIAL_DASH_COOLDOWN_MS,
  MENDING_DASH_COOLDOWN_MS,
  STAGGERING_DASH_COOLDOWN_MS,
  shouldApplyExecutionerTalent,
  shouldApplyFrostpathTalent,
  shouldApplySolarRechargeTalent,
  getEntropicBoltFireRateSec,
  getArcaneSynergyEntropicBoltFlatDamageBonus,
  shouldApplyWindfuryTalent,
  shouldApplyCrusaderTalent,
  shouldApplyBlizzardTalent,
  FROSTPATH_PROC_CHANCE,
  SOLAR_RECHARGE_PROC_CHANCE,
  WINDFURY_PROC_CHANCE,
  CRUSADER_PROC_CHANCE,
  CRUSADER_DURATION_SEC,
  CRUSADER_LMB_FLAT_BONUS,
  BLIZZARD_PROC_CHANCE,
  BLIZZARD_DURATION_SEC,
  FROST_SOLAR_PROC_EFFECT_ICD_MS,
  RUNEBLADE_FLURRY_ATTACK_SPEED_FACTOR,
  FLURRY_HEAL_VFX_MIN_INTERVAL_MS,
  FLURRY_HEAL_NUMBER_MIN_INTERVAL_MS,
  WRAITH_GUARD_DURATION_SEC,
  WRAITH_GUARD_PROC_CHANCE,
  GUARD_COMBO_DURATION_SEC,
  GUARD_COMBO_PROC_CHANCE,
  GUARD_SABRES_SWIPES_PROC_CHANCE,
  GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC,
  COLOSSUS_GUARD_PROC_CHANCE,
  COLOSSUS_GUARD_STACK_SEC,
  COLOSSUS_GUARD_MAX_REMAINING_SEC,
  DASH_GUARD_DURATION_SEC,
  EXECUTIONER_POST_DASH_WINDOW_MS,
  getEffectiveStrengthWithTalentBonuses,
  getExecutionerFlatDamageBonus,
  getCrossentropyBaseDamage,
  CROSSENTROPY_REAPER_DAMAGE_PER_KILL,
  CROSSENTROPY_MAX_TRAVEL_DISTANCE,
  CROSSENTROPY_COOLDOWN_SEC,
  ACCELERATOR_TOTEM_AURA_RADIUS_UNITS,
  shouldApplyAcceleratorTalent,
  shouldApplyHealingStreamTalent,
  HEALING_STREAM_HP_PER_SEC_PER_TOTEM,
  REANIMATE_SUNWELL_HEAL,
  REANIMATE_SUNWELL_COOLDOWN_SEC,
  WRATHFUL_BITE_BARRAGE_CRIT_CHANCE_ADD,
  WRATHFUL_BITE_BARRAGE_CRIT_DAMAGE_MULT_ADD,
  INFERNAL_SMITE_CRIT_CHANCE_ADD,
  INFESTED_SMITE_HEAL_PER_TARGET,
  RUNEBLADE_SMITE_BASE_HEAL,
  RUNEBLADE_FLURRY_HEAL_PER_SLASH,
  STAGGERING_SMITE_BEAM_STAGGER,
  STAGGERING_STRIKE_WRAITH_STAGGER_ADD,
  STAGGERING_SWIPES_LEFT_BLADE_STAGGER,
  STAGGERING_SWIPES_RIGHT_BLADE_STAGGER,
  STAGGER_SHOT_CHARGED_STAGGER,
  STAGGER_SHOT_PERFECT_STAGGER,
  STAGGER_SHOT_TEMPEST_ROUND_STAGGER,
  STAGGER_SHOT_UNCHARGED_STAGGER,
  STAGGERING_BITE_BARRAGE_STAGGER_PER_HIT,
  WRATH_STRIKE_CRIT_CHANCE_ADD,
  WRATH_STRIKE_CRIT_DAMAGE_MULT_ADD,
  getDualCoilLateralVector,
  shouldApplyDualCoilTalent,
  shouldApplyHighCaliberTalent,
  shouldApplyTriggerFingerTalent,
  shouldApplyCloudkillTalent,
  BOW_UNCHARGED_PROJECTILE_DAMAGE,
  BOW_TRIGGER_FINGER_UNCHARGED_DAMAGE,
  shouldApplyWyvernStingTalent,
  WYVERN_STING_COOLDOWN_SEC,
  ARCTIC_STING_BLIZZARD_ICD_SEC,
  shouldApplyArcticStingTalent,
  shouldApplyGlacialBiteTalent,
  shouldApplyWrathfulShotsTalent,
  WRATHFUL_SHOTS_PERFECT_CRIT_CHANCE_ADD,
  WRATHFUL_SHOTS_PERFECT_CRIT_DAMAGE_MULT_ADD,
  WRATHFUL_SHOTS_TEMPEST_CRIT_CHANCE_ADD,
  WRATHFUL_SHOTS_TEMPEST_CRIT_DAMAGE_MULT_ADD,
  resolveTempestBurstTheme,
  CYCLONE_RUSH_CHARGE_COOLDOWN_SEC,
  shouldApplyCycloneRushTalent,
  WRAITH_STRIKE_COOLDOWN_SEC,
  WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES,
  BACKSTAB_COOLDOWN_SEC,
  BACKSTAB_DOUBLE_STAB_MAX_CHARGES,
  BACKSTAB_DOUBLE_STAB_INTERNAL_COOLDOWN_SEC,
  MANTRA_SHAMAN_MAX_CHARGES,
  MANTRA_SHAMAN_INTERNAL_COOLDOWN_SEC,
  shouldApplyShamanTalent,
  shouldApplySpellbladeTalent,
  getSpellbladeWraithStrikeFlatDamageBonus,
  shouldApplyParryTalent,
  SPELLBLADE_WRAITH_STRIKE_SHIELD_RESTORE,
  PARRY_FLOURISH_SHIELD_RESTORE,
  shouldApplyBreathWeaponTalent,
  BREATH_WEAPON_DAMAGE,
  AFTERSHOCK_STRIP_LENGTH,
  AFTERSHOCK_DETONATION_DELAY_MS,
  AFTERSHOCK_STRIP_HALF_WIDTH,
  AFTERSHOCK_INFESTED_DAMAGE_BONUS,
  AFTERSHOCK_GUARD_DAMAGE_BONUS,
  AFTERSHOCK_WRATHFUL_CRIT_CHANCE_ADD,
  AFTERSHOCK_STAGGERING_STAGGER,
  STAGGERING_STAB_BACKSTAB_STAGGER,
  WRATHFUL_STAB_CRIT_CHANCE_ADD,
  WRATHFUL_STAB_CRIT_DAMAGE_MULT_ADD,
  INFESTING_SABRES_SWIPES_LEFT_DAMAGE,
  INFESTING_SABRES_SWIPES_RIGHT_DAMAGE,
  shouldApplyStaggeringStabTalent,
  shouldApplyWrathfulStabTalent,
  shouldApplyInfestedBackstabTalent,
  BACKSTAB_KILLSTREAK_DAMAGE_PER_KILL,
  getRelentlessBackstabKillHeal,
  shouldApplyKillstreakTalent,
  shouldApplyRelentlessTalent,
  evaluateVorpalGustBeamHit,
  isVorpalGustTipHit,
  VORPAL_GUST_BEAM_LENGTH,
  BACKSTAB_VORPAL_TIP_DAMAGE_BACKSTAB,
  BACKSTAB_VORPAL_TIP_DAMAGE_BACKSTAB_PVP,
  BACKSTAB_VORPAL_TIP_DAMAGE_FRONT,
  shouldApplyVorpalGustTalent,
  shouldApplyWrathfulSabresSwipesTalent,
  shouldApplyInfestingSabresSwipesTalent,
  shouldApplyCrescentBladesTalent,
  shouldApplyMortalStrikeTalent,
  resolveMortalStrikeDamageBundle,
  MORTAL_STRIKE_ATTACK_INTERVAL,
  MORTAL_STRIKE_RANGE,
  MORTAL_STRIKE_ARC_ANGLE,
  shouldApplyWindShearTalent,
  shouldApplyPsionicBladesTalent,
  getPsionicBladesProcDamage,
  getWindShearProjectileDamage,
  WIND_SHEAR_MAX_DISTANCE_UNITS,
  WIND_SHEAR_PROJECTILE_SPEED,
  WIND_SHEAR_PROJECTILE_LIFETIME_SEC,
  STAGGERING_FLOURISH_STAGGER,
  WRATHFUL_FLOURISH_CRIT_CHANCE_ADD,
  WRATHFUL_FLOURISH_CRIT_DAMAGE_MULT_ADD,
  shouldApplyStaggeringFlourishTalent,
  shouldApplyWrathfulFlourishTalent,
  shouldApplyInfestedFlourishTalent,
  shouldApplyFanOfKnivesTalent,
  shouldApplyFireAffinityTalent,
  getFanOfKnivesFlourishTintFromLoadout,
  getFanOfKnivesProjectileDamage,
  getFireAffinityStormDamage,
  FAN_OF_KNIVES_MAX_DISTANCE_UNITS,
  FAN_OF_KNIVES_PROJECTILE_SPEED,
  FAN_OF_KNIVES_PROJECTILE_LIFETIME_SEC,
  FIRE_AFFINITY_STORM_RADIUS,
  FIRE_AFFINITY_STORM_ICD_SEC,
  RAISE_DEAD_COOLDOWN_SEC,
  METEOR_STRIKE_COOLDOWN_SEC,
  AEGIS_ROOM_COOLDOWN_SEC,
  AEGIS_ROOM_DURATION_SEC,
  applyManaShieldRestoreForDashCharges,
  shouldApplyBloodmageTalent,
  shouldApplyOverrideTalent,
  BLOODMAGE_BYPASS_ICD_SEC,
  OVERRIDE_BYPASS_ICD_SEC,
} from '@/utils/talents';
import { DEFAULT_ENTROPIC_COLOR_VARIANT } from '@/utils/entropicColorThemes';
import type { AegisPaletteVariant } from '@/utils/aegisShieldPalette';
import { triggerGlobalFrostNova, addGlobalFrozenEnemy } from '@/components/weapons/FrostNovaManager';
import { triggerGlobalFireStorm } from '@/components/weapons/fireStormSpawnBridge';
import { addGlobalStunnedEnemy } from '@/components/weapons/StunManager';
import { triggerGlobalCobraShot } from '@/components/projectiles/CobraShotManager';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';
import { triggerGlobalRejuvenatingShot } from '@/components/projectiles/RejuvenatingShotManager';
import {
  setGlobalCriticalRuneCount,
  setGlobalCritDamageRuneCount,
  getGlobalRuneCounts,
  setControlSystem,
  calculateDamage,
  DamageResult,
} from '@/core/DamageCalculator';
import {
  acceleratorOwnedTotemFlatXYZ,
  acceleratorOwnedTotemTripletCount,
} from '@/components/projectiles/SummonTotemManager';
import { MAIN_ARENA_BOUNDS, MAIN_MAP_HALF_X, MAIN_MAP_HALF_Z, MAIN_MAP_RADIUS, isInsideMainArenaXZ } from '@/utils/mapConstants';
import { computeBowPrimaryScaledDamage, getBowFullChargeMs, isBowPerfectShotProgress } from '@/utils/bowConstants';
import { CASTLE_WALL_HALF_THICKNESS, CASTLE_WALL_X_OFFSET, CASTLE_WALL_Z_OFFSET } from '@/components/environment/CastleWalls';

export type RoomBoomDashVariant = 'infernal' | 'glacial' | 'mending' | 'staggering';
export type RoomBoomDashKey = 'w' | 'a' | 's' | 'd';

export interface RoomBoomDashPayload {
  variant: RoomBoomDashVariant;
  key: RoomBoomDashKey;
  origin: Vector3;
  destination: Vector3;
  direction: Vector3;
}

export class ControlSystem extends System {
  public readonly requiredComponents = [Transform, Movement];
  private inputManager: InputManager;
  private camera: PerspectiveCamera;
  private world: World;
  private projectileSystem: ProjectileSystem;
  private audioSystem: AudioSystem | null = null;
  private playerEntity: Entity | null = null;
  private cameraSystem: CameraSystem | null = null;

  // Input control
  private inputDisabled: boolean = false;
  private freeLookBasisLocked = false;
  private freeLookCameraForward = new Vector3();
  private freeLookCameraRight = new Vector3();
  private orbitBasisForward = new Vector3();
  private orbitBasisRight = new Vector3();
  private movementWorldDirection = new Vector3();
  private readonly movementZeroDirection = new Vector3(0, 0, 0);
  private meleeAttackDirection = new Vector3();
  private meleeQueryToEnemy = new Vector3();
  private meleeQueryToEnemyFlat = new Vector3();
  private backstabPlayerDirection = new Vector3();
  private backstabDirectionToTarget = new Vector3();

  private static readonly DASH_DIR_FORWARD = new Vector3(0, 0, -1);
  private static readonly DASH_DIR_BACK = new Vector3(0, 0, 1);
  private static readonly DASH_DIR_LEFT = new Vector3(-1, 0, 0);
  private static readonly DASH_DIR_RIGHT = new Vector3(1, 0, 0);
  private static readonly DASH_DIRECTIONS: ReadonlyArray<{ key: RoomBoomDashKey; direction: Vector3 }> = [
    { key: 'w', direction: ControlSystem.DASH_DIR_FORWARD },
    { key: 's', direction: ControlSystem.DASH_DIR_BACK },
    { key: 'a', direction: ControlSystem.DASH_DIR_LEFT },
    { key: 'd', direction: ControlSystem.DASH_DIR_RIGHT },
  ];

  /** Max horizontal distance from origin for dash/charge (matches PhysicsSystem map boundary). */
  private playableRadius = MAIN_MAP_RADIUS;
  private arenaBoundaryMode: 'circle' | 'square' | 'hex' = 'square';

  /** When false, sword charge uses throne pillar circles instead of castle wall AABBs. */
  private castleWallChargeEnabled = true;

  private thronePillarChargeObstacles: Array<{ x: number; z: number; radius: number }> = [];

  /** Optional circular XZ obstacles for charge collision (typically empty). */
  private chargeCornerMountains: Array<{ x: number; z: number; radius: number }> = [];
  
  // Callback for bow release effects
  private onBowReleaseCallback?: (finalProgress: number, isPerfectShot?: boolean) => void;
  
  
  // Callback for projectile creation
  private onProjectileCreatedCallback?: (projectileType: string, position: Vector3, direction: Vector3, config: any) => void;
  
  // Callback for Viper Sting activation
  private onViperStingCallback?: (
    position: Vector3,
    direction: Vector3,
    meta?: { explosiveTalons?: boolean },
  ) => void;

  // Callback for Rejuvenating Shot activation
  private onRejuvenatingShotCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Barrage activation
  private onBarrageCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Reanimate healing effect
  private onReanimateCallback?: () => void;

  // Callback for creating damage numbers
  private onDamageNumbersUpdate?: (damageNumbers: Array<{
    id: string;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    timestamp: number;
    damageType?: string;
  }>) => void;

  // Callback for broadcasting healing in PVP
  private onBroadcastHealing?: (healingAmount: number, healingType: string, position: Vector3, targetPlayerId?: string) => void;
  
  // Callback for Frost Nova activation
  private onFrostNovaCallback?: (position: Vector3, direction: Vector3) => void;

  private onRoomBoomDashCallback?: (payload: RoomBoomDashPayload) => void;

  private onBloodOrbDashCallback?: () => void;

  // Callback for Cobra Shot activation
  private onCobraShotCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for Summon Totem activation
  private onSummonTotemCallback?: (position: Vector3) => void;

  // Callback for Charge activation
  private onChargeCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Deflect activation
  private onDeflectCallback?: (
    position: Vector3,
    direction: Vector3,
    extra?: { aegisRoomBoon?: boolean },
  ) => void;
  
  // Callback for broadcasting debuff effects in PVP
  private onDebuffCallback?: (targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', duration: number, position: Vector3) => void;
  
  // Callback for applying status effects to enemies in multiplayer (public so CombatSystem can access)
  public onApplyEnemyStatusEffectCallback?: (enemyId: string, effectType: string, duration: number) => void;
  
  // Callback for Skyfall ability
  private onSkyfallCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Backstab ability
  private onBackstabCallback?: (position: Vector3, direction: Vector3, damage: number, isBackstab: boolean) => void;
  
  // Callback for Sunder ability
  private onSunderCallback?: (position: Vector3, direction: Vector3, damage: number, stackCount: number) => void;

  // Callback for Smite ability (optional meta: TRINITY extra strike positions + stagger delays)
  private onSmiteCallback?: (
    position: Vector3,
    direction: Vector3,
    onDamageDealt?: (totalDamage: number, meta?: { targetsHit: number }) => void,
    meta?: { extraStrikes?: Array<{ position: Vector3; delaySec: number }> },
  ) => void;

  // Callback for Colossus Strike ability
  private onColossusStrikeCallback?: (position: Vector3, direction: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => void;

  // Callback for Wind Shear ability
  private onWindShearCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for DeathGrasp ability
  private onDeathGraspCallback?: (position: Vector3, direction: Vector3) => void;

  // Callback for WraithStrike ability
  private onWraithStrikeCallback?: (
    position: Vector3,
    direction: Vector3,
    meta?: {
      wrathfulStrike: boolean;
      infestedStrike: boolean;
      staggeringStrike?: boolean;
      wraithGuard?: boolean;
      breathWeapon?: boolean;
    },
  ) => void;

  /** Local VFX: mirrored slash impact on each Wraith Strike hit (DragonRenderer activeEffects). */
  private onWraithStrikeSlashImpact?: (
    enemyPosition: Vector3,
    forwardXZ: Vector3,
    meta?: {
      wrathfulStrike?: boolean;
      infestedStrike?: boolean;
      wraithGuard?: boolean;
      staggeringStrike?: boolean;
    },
  ) => void;

  // Callback for creating Sabre Reaper Mist effect
  private onCreateSabreMistEffectCallback?: (position: Vector3) => void;

  // Callback for Stealth ability
  private onStealthCallback?: (position: Vector3, isActivating: boolean) => void;

  // Callback for broadcasting Sabre Reaper Mist effects in PVP
  private onBroadcastSabreMistCallback?: (position: Vector3, effectType: 'stealth' | 'skyfall') => void;

  // Callback for creating local debuff effects in PVP
  private onCreateLocalDebuffCallback?: (playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', position: Vector3, duration: number) => void;

  // Callback for Haunted Soul effect (WraithStrike): wrathful = red talent, infested = green talent
  private onHauntedSoulEffectCallback?: (position: Vector3, wrathfulStrike?: boolean, infestedStrike?: boolean) => void;

  // Callback for WindShear Tornado effect
  private onWindShearTornadoCallback?: (playerId: string, duration: number) => void;

  // Callback for broadcasting melee attack sounds in PVP
  private onBroadcastMeleeAttackCallback?: (attackType: string, position: Vector3, comboStep?: number) => void;

  // Callback for Whirlwind ability
  private onWhirlwindCallback?: (position: Vector3, direction: Vector3, damage: number) => void;

  // Callback for Throw Spear ability
  private onThrowSpearCallback?: (position: Vector3, direction: Vector3, chargeTime: number) => void;

  // Callback for Flurry ability
  private onFlurryCallback?: (position: Vector3) => void;

  // Callback for Flurry healing effect
  private onFlurryHealingEffectCallback?: (position: Vector3) => void;
  // Callback for Whirlwind radial wave effect
  private onWhirlwindRadialWaveCallback?: (playerId: string, duration: number) => void;
  // Callback for Lightning Storm ability
  private onLightningStormCallback?: (position: Vector3) => void;

  // Local socket ID for identifying the local player
  private localSocketId: string | null = null;

  // Rate limiting for projectile firing
  private lastBowFireTime = 0; // Bow projectiles
  private lastScytheFireTime = 0; // Scythe entropic bolts
  private lastSwordFireTime = 0; // Sword melee attacks
  private lastRunebladeFireTime = 0; // Runeblade melee attacks
  private lastSabresFireTime = 0; // Sabres melee attacks
  private lastReanimateTime = 0; // Separate tracking for Reanimate ability

  // Icebeam state tracking
  private isIcebeaming = false;
  private icebeamStartTime = 0;
  private lastIcebeamTime = 0;
  private icebeamCooldownDurationSec = ICEBEAM_COOLDOWN_AFTER_RELEASE_SEC;
  private onIcebeamStateChangeCallback?: (isActive: boolean) => void;
  private lastViperStingTime = 0;
  private lastFrostNovaTime = 0; // Separate tracking for Frost Nova ability
  private lastCobraShotTime = 0; // Separate tracking for Cobra Shot ability
  private lastWyvernStingTime = 0; // Wyvern Sting talent: bonus Cobra on perfect shot (separate from BOW_E)
  private perfectShotVolleySerial = 0;
  private lastArcticStingBlizzardTimeSec = 0;
  private pendingArcticStingVolleyId: number | null = null;
  private lastSummonTotemTime = 0; // Separate tracking for Summon Totem ability
  private lastRejuvenatingShotTime = 0; // Separate tracking for Rejuvenating Shot ability
  private fireRate = 0.2125; // Default for bow
  private swordFireRate = 0.825; // Rate for sword attacks
  private runebladeFireRate = 0.875; // Runeblade attack rate
  private sabresFireRate = 0.625; // Sabres dual attack rate (600ms between attacks)
  private crescentBladesAttackCount = 0; // Tracks swings toward Crescent Blades special (resets at 3)
  private mortalStrikeAttackCount = 0; // Tracks swings toward Mortal Strike special (resets at 4)
  private summonTotemFireRate = 6.5; // Summon Totem cooldown
  private viperStingFireRate = 7.0; // Viper Sting rate (2 seconds cooldown)
  private frostNovaFireRate = 12.0; // Frost Nova rate (12 seconds cooldown)
  private cobraShotFireRate = 5.0; // Cobra Shot rate (2 seconds cooldown)
  private rejuvenatingShotFireRate = 3.0; // Rejuvenating Shot rate (4 seconds cooldown)
  private lastBurstFireTime = 0; // Separate tracking for Bow burst fire
  private burstFireRate = 0.925; // 1 second cooldown between bursts
  /** Monotonic id per Tempest Rounds arrow (EtherBow muzzle flash + PVP sync). */
  private tempestBurstShotSeq = 0;
  
  // Current weapon configuration
  private currentWeapon: WeaponType;
  private currentSubclass: WeaponSubclass;
  private currentLevel = 1;
  
  // Weapon-specific states
  private isCharging = false;
  private chargeProgress = 0;
  /** Wall-clock start for normal bow primary charge; null when not holding LMB charge. */
  private bowPrimaryChargeStartMs: number | null = null;
  private isSwinging = false;
  
  // Viper Sting charging state
  private isViperStingCharging = false;
  private viperStingChargeProgress = 0;
  /** Double Talons talent: staggered Reaping Talons charge recharge (one timer at a time). */
  private viperStingDoubleTalonsActive = false;
  private viperStingCharges = 0;
  private viperStingNextChargeAt: number | null = null;
  private lastViperStingDoubleTalonsChargeSpendTime = Number.NEGATIVE_INFINITY;
  
  // Barrage charging state
  private isBarrageCharging = false;
  private barrageChargeProgress = 0;
  private lastBarrageTime = 0;
  private barrageFireRate = 8.0; // 5 second cooldown (keeping as requested)
  /** Invalidates staggered barrage timeouts on new volleys / weapon reset */
  private barrageVolleyGeneration = 0;
  private fanOfKnivesVolleyGeneration = 0;
  private static readonly BARRAGE_ARROW_STAGGER_MS = 100;
  
  // Cobra Shot charging state
  private isCobraShotCharging = false;
  private cobraShotChargeProgress = 0;

  // Rejuvenating Shot charging state
  private isRejuvenatingShotCharging = false;
  private rejuvenatingShotChargeProgress = 0;

  // Crossentropy Bolt charging state
  private isCrossentropyCharging = false;
  private crossentropyChargeProgress = 0;
  /** Recharge accumulator for Crossentropy (0 … full); Accelerator scales effective dt toward full. */
  private crossentropyRechargeAccumulator = CROSSENTROPY_COOLDOWN_SEC;
  private crossentropyCooldownReconcileWallSec: number | null = null;

  // Summon Totem charging state
  private isSummonTotemCharging = false;
  private summonTotemChargeProgress = 0;
  /** SHAMAN talent: staggered Mantra charge recharge (one timer at a time). */
  private summonTotemShamanActive = false;
  private summonTotemCharges = 0;
  private summonTotemNextChargeAt: number | null = null;
  private lastSummonTotemShamanChargeSpendTime = Number.NEGATIVE_INFINITY;

  // Sword-specific states
  private swordComboStep: 1 | 2 | 3 = 1;
  private lastSwordAttackTime = 0;
  private swordComboResetTime = 1; // Reset combo after 1 seconds
  
  
  // Charge ability state
  private isSwordCharging = false;
  private lastChargeTime = 0;
  /** Double-tap Cyclone Rush (Runeblade) — separate from E-key `lastChargeTime`. */
  private lastCycloneRushChargeTime = 0;
  private chargeCooldown = 5.0; // 8 second cooldown
  
  // Deflect ability state
  private isDeflecting = false;
  private lastDeflectTime = 0;
  private deflectCooldown = AEGIS_ROOM_COOLDOWN_SEC;
  private deflectDuration = AEGIS_ROOM_DURATION_SEC;
  private aegisRoomDeflectActive = false;
  private deflectBarrier: DeflectBarrier;
  /** Wraith Guard talent: barrier spawned without Aegis; separate from `isDeflecting` for UI/cooldown. */
  private wraithGuardShieldActive = false;
  private wraithGuardOwnsBarrier = false;
  private wraithGuardBarrierEndMs = 0;
  /** Colossus Guard talent: same barrier path as Wraith Guard; stacked remaining time capped at max. */
  private colossusGuardShieldActive = false;
  private colossusGuardOwnsBarrier = false;
  private colossusGuardBarrierEndMs = 0;
  /** Guard Combo talent: Runeblade basic-hit proc; same barrier path as Wraith Guard. */
  private guardComboShieldActive = false;
  private guardComboOwnsBarrier = false;
  private guardComboBarrierEndMs = 0;
  /** Dash Guard talent: double-tap dash; same barrier path as Wraith Guard. */
  private dashGuardShieldActive = false;
  private dashGuardOwnsBarrier = false;
  private dashGuardBarrierEndMs = 0;
  /** Sabres purple-room guard talents (swipe/stab/flourish): shared barrier channel. */
  private sabresPurpleGuardShieldActive = false;
  private sabresPurpleGuardOwnsBarrier = false;
  private sabresPurpleGuardBarrierEndMs = 0;

  /** EXECUTIONER: next Runeblade LMB after startDash within window; 0 = inactive. */
  private executionerBuffDeadlineMs = 0;
  private runebladeExecutionerFlatBonusPending = 0;
  /** Crusader talent: LMB flat damage + blade theme while Date.now() < this. */
  private runebladeCrusaderBuffEndMs = 0;
  private runebladeBlizzardEndMs = 0;
  /** Single teardown timer for talent-spawned deflect shields (max of end times). */
  private talentBarrierEndTimeout: ReturnType<typeof setTimeout> | null = null;
  /** Tracked ability/setTimeout handles — cleared in dispose(). */
  private scheduledAbilityTimeouts = new Set<ReturnType<typeof setTimeout>>();
  
  // Skyfall ability state (Sabres)
  private isSkyfalling = false;
  private skyfallPhase: 'none' | 'ascending' | 'descending' | 'landing' = 'none';
  private lastSkyfallTime = 0;
  private skyfallCooldown = 7.25; // 4 second cooldown
  private skyfallStartTime = 0;
  private skyfallStartPosition = new Vector3();
  private skyfallTargetHeight = 0;
  private skyfallOriginalGravity = 0;
  
  // Backstab ability state (Sabres)
  private lastBackstabTime = 0;
  private backstabCooldown = BACKSTAB_COOLDOWN_SEC;
  private isBackstabbing = false;
  /** Double Stab talent: staggered charge recharge (one timer at a time). */
  private backstabDoubleStabActive = false;
  private backstabCharges = 0;
  private backstabNextChargeAt: number | null = null;
  private lastBackstabDoubleStabChargeSpendTime = Number.NEGATIVE_INFINITY;
  private backstabStartTime = 0;
  private backstabDuration = 1.0; // Total animation duration (0.3 + 0.4 + 0.3 seconds)
  private backstabTargetRotations = new Map<number, number>(); // Store target rotations at start of backstab
  
  // Sunder ability state (Sabres)
  private lastSunderTime = 0;
  private sunderCooldown = 1.75; // 1.5 second cooldown
  private isSundering = false;
  private sunderStartTime = 0;
  private sunderDuration = 1.0; // Same animation duration as backstab
  private sunderDamageApplied = false; // Track if damage has been applied during current sunder
  private lastFireAffinityStormTime = 0;
  
  // Stealth ability state (Sabres)
  private lastStealthTime = 0;
  private stealthCooldown = 10.0; // 10 second cooldown
  private isStealthing = false;

  // Whirlwind ability state (Spear)
  private lastWhirlwindTime = 0;
  private whirlwindCooldown = 3.0; // 3 second cooldown
  private isWhirlwindCharging = false;
  private whirlwindChargeProgress = 0;
  private isWhirlwinding = false;
  private whirlwindStartTime = 0;
  private whirlwindDuration = 0.8; // Duration of the spin animation

  // Throw Spear ability state (Spear)
  private lastThrowSpearTime = 0;
  private throwSpearCooldown = 8.0; // 4 second cooldown
  private isThrowSpearCharging = false;
  private throwSpearChargeProgress = 0;
  private throwSpearChargeStartTime = 0;
  private isThrowSpearReleasing = false;
  private throwSpearReleaseTime = 0;

  // Flurry ability state (Spear)
  private lastFlurryTime = 0;
  private flurryCooldown = 10.0; // 10 second cooldown
  private isFlurryActive = false;
  private flurryStartTime = 0;
  private flurryDuration = 5.0; // 5 second duration
  private lastFrostpathProcEffectWallClockMs = 0;
  private lastSolarRechargeProcEffectWallClockMs = 0;
  private lastFlurryHealVfxWallClockMs = 0;
  private lastFlurryHealNumberWallClockMs = 0;
  private healingStreamHealCarry = 0;
  private lastHealingStreamHealNumberWallClockMs = 0;

  // Lightning Storm ability state (Spear)
  private lastLightningStormTime = 0;
  private lightningStormCooldown = 6.0; // 3 second cooldown

  // Raise Dead active boon ability (green room R key)
  private lastRaiseDeadTime = 0;

  // Meteor Strike active boon ability (red room R key)
  private lastMeteorStrikeTime = 0;

  // Public getter for stealth state
  public getIsStealthing(): boolean {
    return this.isStealthing;
  }

  // Public getter for invisibility state
  public getIsInvisible(): boolean {
    return this.isInvisible;
  }
  private stealthStartTime = 0;
  private stealthDelayDuration = 0.5; // 0.5 second delay before invisibility
  private stealthInvisibilityDuration = 5.0; // 5 seconds of invisibility
  private isInvisible = false;
  
  // Sunder stack tracking - Map of entity ID to stack data
  private sunderStacks = new Map<number, { stacks: number; lastApplied: number; duration: number }>();

  // Active debuff effects tracking for PVP players - Map of entity ID to debuff data
  private activeDebuffEffects = new Map<number, { debuffType: string; startTime: number; duration: number }[]>();

  // Smite ability state (Runeblade)
  private lastSmiteTime = 0;
  private smiteCooldown = 8.0; // 2 second cooldown
  private isSmiting = false;
  /** BLOODMAGE room boon — last dash-charge E-ability cooldown bypass. */
  private lastBloodmageTriggerTime = Number.NEGATIVE_INFINITY;
  /** OVERRIDE room boon — last shield-drain Q-ability cooldown bypass. */
  private lastOverrideTriggerTime = Number.NEGATIVE_INFINITY;
  /** TRINITY: max `sequenceDelaySec` on follow-up strikes; used with `onSmiteComplete` / smite duration. */
  private lastSmiteMaxFollowUpDelaySec = 0;

  // Colossus Strike ability state (Sword)
  private lastColossusStrikeTime = 0;
  private colossusStrikeCooldown = 8.0; // 2 second cooldown
  private isColossusStriking = false;

  // Wind Shear ability state (Sword)
  private lastWindShearTime = 0;
  private windShearCooldown = 2.0; // 2 second cooldown
  private isWindShearing = false;

  // Wind Shear charging state
  private isWindShearCharging = false;
  private windShearChargeProgress = 0;


  // DeathGrasp ability state (Runeblade)
  private lastDeathGraspTime = 0;
  private deathGraspCooldown = 5.0; // 5 second cooldown
  private isDeathGrasping = false;

  // WraithStrike ability state (Runeblade)
  private lastWraithStrikeTime = 0;
  private wraithStrikeCooldown = WRAITH_STRIKE_COOLDOWN_SEC;
  private isWraithStriking = false;
  /** Double Strike talent: staggered charge recharge (one timer at a time). */
  private wraithStrikeDoubleStrikeActive = false;
  private wraithStrikeCharges = 0;
  private wraithStrikeNextChargeAt: number | null = null;

  // Corrupted Aura ability state (Runeblade)
  private corruptedAuraActive = false;
  private corruptedAuraRange = 2.0;
  private lastCorruptedAuraAuraCheckMs = 0;
  private readonly corruptedAuraCheckIntervalMs = 100; 
  private corruptedAuraSlowEffect = 0.5; // 50% slow (multiply movement speed by this)
  private corruptedAuraSlowedEntities = new Map<number, boolean>(); // Track slowed entities
  private lastCorruptedAuraTime = 0;
  private corruptedAuraCooldown = 6.0; // 6 second cooldown
  private corruptedAuraDuration = 4.0; // 4 second duration
  private corruptedAuraStartTime = 0;

  // Store original rune counts to restore when corrupted aura deactivates
  private originalCriticalRunes = 0;
  private originalCritDamageRunes = 0;

  // Store base rune counts for Sabres passive (level-based only, not including passive bonus)
  private sabresBaseCriticalRunes = 0;
  private sabresPassiveCriticalBonus = 0; // Track how much the passive adds

  // Selected weapons mapping for hotkeys
  private selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null;

  // Damage number ID counter
  private nextDamageNumberId: number = 0;

  // Skill point system data
  private skillPointData: SkillPointData;

  /** Allocated STR/STA/AGI/INT (co-op leveling / pedestals); feeds Spellblade Wraith Strike scaling. */
  private allocatedPlayerStats: PlayerStats = { strength: 0, stamina: 0, agility: 0, intellect: 0 };

  // Ability loadout (universal ability selection per slot Q/E/R)
  private abilityLoadout: AbilityLoadout | null = null;

  private talentLoadout: TalentLoadout = createDefaultTalentLoadout();
  private lastGlacialDashRoomBoomMs = 0;
  private lastMendingDashRoomBoomMs = 0;
  private lastStaggeringDashRoomBoomMs = 0;

  /** Reaper: +damage per Crossentropy kill this session (server-synchronized in co-op). */
  private reaperCrossentropyStack = 0;

  /** Killstreak: +Backstab base damage per Backstab kill this session (server-synchronized in co-op). */
  private backstabKillstreakStack = 0;

  // Titanheart passive tracking
  private titanheartMaxHealthApplied = false;

  // Death state tracking
  private isPlayerDead = false;
  private playerStunnedUntilMs = 0;

  constructor(
    camera: PerspectiveCamera,
    inputManager: InputManager,
    world: World,
    projectileSystem: ProjectileSystem,
    audioSystem?: AudioSystem | null,
    selectedWeapons?: {
      primary: WeaponType;
      secondary: WeaponType;
    } | null
  ) {
    super();
    this.camera = camera;
    this.inputManager = inputManager;
    this.world = world;
    this.projectileSystem = projectileSystem;
    this.audioSystem = audioSystem || null;
    this.selectedWeapons = selectedWeapons;
    this.deflectBarrier = new DeflectBarrier(world);
    this.priority = 5; // Run early for input handling

    // Initialize skill point system
    this.skillPointData = SkillPointSystem.getInitialSkillPointData();

    // Initialize weapon and subclass based on selected weapons
    this.currentWeapon = selectedWeapons?.primary ?? WeaponType.NONE;
    this.currentSubclass = this.getDefaultSubclassForWeapon(this.currentWeapon);

    // Set reference in DamageCalculator for passive ability checks
    setControlSystem(this);
  }

  private getDefaultSubclassForWeapon(weapon: WeaponType): WeaponSubclass {
    switch (weapon) {
      case WeaponType.NONE:
        return WeaponSubclass.ELEMENTAL;
      case WeaponType.SWORD:
        return WeaponSubclass.DIVINITY;
      case WeaponType.BOW:
        return WeaponSubclass.ELEMENTAL;
      case WeaponType.SCYTHE:
        return WeaponSubclass.CHAOS;
      case WeaponType.SABRES:
        return WeaponSubclass.FROST;
      case WeaponType.RUNEBLADE:
        return WeaponSubclass.ARCANE;
      case WeaponType.SPEAR:
        return WeaponSubclass.STORM;
      default:
        return WeaponSubclass.ELEMENTAL;
    }
  }

  public setPlayer(entity: Entity): void {
    this.playerEntity = entity;
  }

  public getAudioSystem(): AudioSystem | null {
    return this.audioSystem;
  }

  public setPlayableRadius(radius: number): void {
    this.playableRadius = Math.max(1, radius);
  }

  public setCameraSystem(cameraSystem: CameraSystem): void {
    this.cameraSystem = cameraSystem;
  }

  public setCastleWallChargeCollision(enabled: boolean): void {
    this.castleWallChargeEnabled = enabled;
    this.arenaBoundaryMode = enabled ? 'square' : 'circle';
  }

  public setArenaBoundaryMode(mode: 'circle' | 'square' | 'hex'): void {
    this.arenaBoundaryMode = mode;
  }

  public setThroneChargePillars(obstacles: Array<{ x: number; z: number; radius: number }> | null): void {
    this.thronePillarChargeObstacles = obstacles && obstacles.length > 0 ? obstacles.slice() : [];
  }

  public setChargeCornerMountains(
    obstacles: Array<{ x: number; z: number; radius: number }> | null,
  ): void {
    this.chargeCornerMountains = obstacles && obstacles.length > 0 ? obstacles.slice() : [];
  }

  public setInputDisabled(disabled: boolean): void {
    this.inputDisabled = disabled;
  }

  public stunPlayer(durationMs: number): void {
    this.playerStunnedUntilMs = Math.max(this.playerStunnedUntilMs, Date.now() + durationMs);
  }

  public isLocalPlayerStunned(): boolean {
    return Date.now() < this.playerStunnedUntilMs;
  }

  public setAllowAllInput(allow: boolean): void {
    this.inputManager.setAllowAllInput(allow);
  }

  /** Read current keyboard state (lowercase key names, same as movement checks). */
  public isKeyPressed(key: string): boolean {
    return this.inputManager.isKeyPressed(key);
  }

  /**
   * Update loadout slots used by 1/2 switching and passives. If `primary` changes, runs the same
   * transition as a normal weapon swap (reset abilities, apply passives).
   */
  public setSelectedWeapons(weapons: { primary: WeaponType; secondary: WeaponType } | null): void {
    const prevPrimary = this.selectedWeapons?.primary;
    this.selectedWeapons = weapons;
    if (!weapons) return;
    if (weapons.primary !== prevPrimary) {
      this.switchToWeapon(weapons.primary, Date.now() / 1000);
    }
  }

  public update(entities: Entity[], deltaTime: number): void {
    if (!this.playerEntity) return;

    const playerTransform = this.playerEntity.getComponent(Transform);
    const playerMovement = this.playerEntity.getComponent(Movement);

    if (!playerTransform || !playerMovement) return;

    const crossentropyWallNowSec = Date.now() / 1000;
    const playerWorldPos = playerTransform.getWorldPosition();
    this.reconcileCrossentropyCooldown(crossentropyWallNowSec, playerWorldPos);
    this.tickHealingStreamTalent(deltaTime, playerWorldPos);

    // If input is disabled (e.g., chat / modal open), skip input processing but clear locomotion so
    // stale moveDirection/inputStrength is not reapplied by PhysicsSystem.
    if (this.inputDisabled) {
      playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      playerMovement.velocity.x = 0;
      playerMovement.velocity.z = 0;
      playerMovement.acceleration.set(0, 0, 0);
      this.clearMovementControlState();
      this.audioSystem?.setFootstepsPlaying(false);
      return;
    }

    const playerHealth = this.playerEntity.getComponent(Health);

    // If player is dead, completely block all input and movement
    if (this.isPlayerDead || playerHealth?.isDead) {
      // Update debuff states even when dead (for visual effects)
      if (typeof playerMovement.updateDebuffs === 'function') {
        playerMovement.updateDebuffs();
      }
      playerMovement.haltLocomotion();
      this.clearMovementControlState();
      // Block all input - don't process anything else
      this.audioSystem?.setFootstepsPlaying(false);
      return;
    }

    // Update debuff states first
    if (typeof playerMovement.updateDebuffs === 'function') {
      playerMovement.updateDebuffs();
    }

    if (this.isLocalPlayerStunned()) {
      playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      playerMovement.velocity.x = 0;
      playerMovement.velocity.z = 0;
      playerMovement.acceleration.set(0, 0, 0);
      if (playerMovement.isDashing) {
        playerMovement.cancelDash();
      }
      if (playerMovement.isCharging) {
        playerMovement.cancelCharge();
        this.onChargeComplete();
      }
      this.clearMovementControlState();
      this.audioSystem?.setFootstepsPlaying(false);
      return;
    }

    if (playerMovement.isFrozen) {
      playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      this.clearMovementControlState();
      if (playerMovement.isDashing) {
        playerMovement.cancelDash();
      }
      if (playerMovement.isCharging) {
        playerMovement.cancelCharge();
        this.onChargeComplete();
      }
    }

    // Clean up expired Sunder stacks periodically
    this.cleanupSunderStacks();

    // Handle weapon switching
    this.handleWeaponSwitching();

    // Handle knockback movement first (overrides regular movement)
    this.handleKnockbackMovement(playerMovement, playerTransform);

    // Handle dash movement (overrides regular movement)
    this.handleDashMovement(playerMovement, playerTransform);

    // Handle charge movement (overrides regular movement)
    this.handleChargeMovement(playerMovement, playerTransform);

    // Handle player movement input (only prevent for abilities that truly override movement)
    // Most abilities should allow movement - only prevent for dashing, charging, and debuffs
    if (!playerMovement.isDashing && !playerMovement.isCharging && !playerMovement.isFrozen && !playerMovement.isKnockbacked) {
      this.handleMovementInput(playerMovement);
    } else {
      this.clearMovementControlState();
    }

    // Handle combat input
    this.handleCombatInput(playerTransform);

    // Update deflect barrier position if active
    this.updateDeflectBarrier(playerTransform);

    // Recompute attack-cast slow flag every frame
    this.updateAttackSlowState(playerMovement);

    const md = playerMovement.moveDirection;
    const moveLenSq = md.x * md.x + md.z * md.z;
    const wantsFootsteps =
      playerMovement.isGrounded &&
      !playerMovement.isDashing &&
      !playerMovement.isCharging &&
      !playerMovement.isFrozen &&
      playerMovement.inputStrength > 0.05 &&
      moveLenSq > 0.0001 &&
      !(playerMovement.isAttackSlowed || playerMovement.isIcebeaming);
    this.audioSystem?.setFootstepsPlaying(wantsFootsteps);
  }

  private updateAttackSlowState(movement: Movement): void {
    const isScytheEntropicFiring =
      this.currentWeapon === WeaponType.SCYTHE &&
      !this.isIcebeaming &&
      !this.isCrossentropyCharging &&
      !this.isSummonTotemCharging &&
      this.inputManager.isMouseButtonPressed(0);

    const isBowLmbAttacking =
      this.currentWeapon === WeaponType.BOW &&
      this.inputManager.isMouseButtonPressed(0);

    const isRunebladeLmbHeld =
      this.currentWeapon === WeaponType.RUNEBLADE &&
      this.inputManager.isMouseButtonPressed(0);

    const isSpearLmbHeld =
      this.currentWeapon === WeaponType.SPEAR &&
      this.inputManager.isMouseButtonPressed(0);

    movement.isAttackSlowed =
      // Sword — ColossusStrike duration
      this.isColossusStriking ||
      // Runeblade — Smite (aka Colossus Strike on Runeblade) duration
      this.isSmiting ||
      // Bow — LMB charged shot and Tempest Rounds rapidfire, plus Q/E/R abilities
      isBowLmbAttacking ||
      // Runeblade / Spear — LMB held during primary melee (matches bow / scythe entropic stream)
      isRunebladeLmbHeld ||
      isSpearLmbHeld ||
      this.isBarrageCharging ||
      this.isCobraShotCharging ||
      this.isViperStingCharging ||
      // Scythe — CrossEntropy charge or Entropic Bolt stream
      this.isCrossentropyCharging ||
      isScytheEntropicFiring ||
      // Spear — Tempest Flourish (Whirlwind) and Wind Shear (ThrowSpear) charging
      this.isWhirlwindCharging ||
      this.isWhirlwinding ||
      this.isThrowSpearCharging;
  }

  private handleMovementInput(movement: Movement): void {
    if (!this.playerEntity) return;

    const playerTransform = this.playerEntity.getComponent(Transform);
    if (!playerTransform) return;

    // Check for double-tap dashes first (before processing regular movement)
    this.checkForDashInput(movement, playerTransform);

    const { inputDirection, hasInput } = this.getMovementInputDirection();

    // Convert input to world space based on camera orientation
    if (hasInput) {
      const freeLookActive = this.isFreeLookMoveLockInputActive();
      const { cameraForward, cameraRight } = this.getMovementBasisForInput(freeLookActive);

      // Transform input direction to world space
      this.movementWorldDirection.set(0, 0, 0);
      this.movementWorldDirection.addScaledVector(cameraRight, inputDirection.x);
      this.movementWorldDirection.addScaledVector(cameraForward, -inputDirection.z);
      this.movementWorldDirection.normalize();

      // Walking backwards or backward-diagonal (A+S / D+S, angle > 112.5° from camera forward) is 50% speed.
      const fwdDot = cameraForward.dot(this.movementWorldDirection);
      const fwdCrossY =
        cameraForward.x * this.movementWorldDirection.z -
        cameraForward.z * this.movementWorldDirection.x;
      const moveAngle = Math.atan2(fwdCrossY, fwdDot);
      const backwardsMultiplier = Math.abs(moveAngle) > (5 * Math.PI) / 8 ? 0.5 : 1.0;

      if (freeLookActive) {
        movement.setMoveDirection(this.movementWorldDirection, backwardsMultiplier);
      } else {
        this.clearFreeLookMoveLock();
        movement.setMoveDirection(this.movementWorldDirection, backwardsMultiplier);
      }
    } else {
      this.clearFreeLookMoveLock();
      movement.setMoveDirection(this.movementZeroDirection, 0);
    }

    // Handle jumping
    if (this.inputManager.isKeyPressed(' ')) { // Spacebar
      movement.jump();
    }
  }

  private getMovementInputDirection(): { inputDirection: Vector3; hasInput: boolean } {
    const inputDirection = new Vector3(0, 0, 0);
    let hasInput = false;

    if (this.inputManager.isKeyPressed('w') || this.inputManager.isKeyPressed('arrowup')) {
      inputDirection.z -= 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('s') || this.inputManager.isKeyPressed('arrowdown')) {
      inputDirection.z += 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('a') || this.inputManager.isKeyPressed('arrowleft')) {
      inputDirection.x -= 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('d') || this.inputManager.isKeyPressed('arrowright')) {
      inputDirection.x += 1;
      hasInput = true;
    }

    if (inputDirection.length() > 0) {
      inputDirection.normalize();
    }

    return { inputDirection, hasInput };
  }

  private getCameraMovementBasis(): { cameraForward: Vector3; cameraRight: Vector3 } {
    if (this.cameraSystem) {
      const { forward, right } = this.cameraSystem.getOrbitMovementBasis();
      this.orbitBasisForward.copy(forward);
      this.orbitBasisRight.copy(right);
      return { cameraForward: this.orbitBasisForward, cameraRight: this.orbitBasisRight };
    }

    const cameraDirection = new Vector3();
    this.camera.getWorldDirection(cameraDirection);

    const cameraRight = new Vector3();
    cameraRight.crossVectors(cameraDirection, new Vector3(0, 1, 0)).normalize();

    const cameraForward = new Vector3();
    cameraForward.crossVectors(new Vector3(0, 1, 0), cameraRight).normalize();

    return { cameraForward, cameraRight };
  }

  private getMovementBasisForInput(freeLookActive: boolean): { cameraForward: Vector3; cameraRight: Vector3 } {
    const { cameraForward, cameraRight } = this.getCameraMovementBasis();

    if (!freeLookActive) {
      return { cameraForward, cameraRight };
    }

    if (!this.freeLookBasisLocked) {
      this.freeLookCameraForward.copy(cameraForward);
      this.freeLookCameraRight.copy(cameraRight);
      this.freeLookBasisLocked = true;
    }

    return {
      cameraForward: this.freeLookCameraForward,
      cameraRight: this.freeLookCameraRight
    };
  }

  private isFreeLookMoveLockInputActive(): boolean {
    return (
      this.inputManager.isKeyPressed('shift') &&
      this.inputManager.isMouseButtonPressed(2) &&
      !this.getMovementInputDirection().hasInput
    );
  }

  private clearFreeLookMoveLock(): void {
    this.freeLookBasisLocked = false;
    this.freeLookCameraForward.set(0, 0, 0);
    this.freeLookCameraRight.set(0, 0, 0);
  }

  private clearMovementControlState(): void {
    this.clearFreeLookMoveLock();
  }

  private lastWeaponSwitchTime = 0;
  private weaponSwitchCooldown = 1.5; // 200ms cooldown to prevent rapid switching

  private handleWeaponSwitching(): void {
    // Prevent weapon switching while dead and waiting to respawn
    if (this.isPlayerDead) {
      return;
    }

    const currentTime = Date.now() / 1000;

    // Prevent rapid weapon switching
    if (currentTime - this.lastWeaponSwitchTime < this.weaponSwitchCooldown) {
      return;
    }

    // Handle weapon switching with number keys based on selected weapons
    if (
      this.inputManager.isKeyPressed('1') &&
      this.selectedWeapons?.primary &&
      this.selectedWeapons.primary !== WeaponType.NONE
    ) {
      if (this.currentWeapon !== this.selectedWeapons.primary) {
        this.switchToWeapon(this.selectedWeapons.primary, currentTime);
      }
    } else if (
      this.inputManager.isKeyPressed('2') &&
      this.selectedWeapons?.secondary &&
      this.selectedWeapons.secondary !== WeaponType.NONE
    ) {
      if (this.currentWeapon !== this.selectedWeapons.secondary) {
        this.switchToWeapon(this.selectedWeapons.secondary, currentTime);
      }
    }
  }

  private switchToWeapon(weaponType: WeaponType, currentTime: number): void {
    this.resetAllAbilityStates(); // Reset all ability states when switching weapons
    this.resetAllPassiveEffects(); // Reset all passive effects when switching weapons

    // Update current weapon
    this.currentWeapon = weaponType;

    // Set appropriate subclass and fire rate based on weapon type
    switch (weaponType) {
      case WeaponType.SWORD:
        this.currentSubclass = WeaponSubclass.DIVINITY;
        this.fireRate = this.swordFireRate;
        this.swordComboStep = 1; // Reset combo when switching to sword
        break;
      case WeaponType.BOW:
        this.currentSubclass = WeaponSubclass.ELEMENTAL;
        this.fireRate = 0.225; // Bow fire rate
        break;
      case WeaponType.SCYTHE:
        this.currentSubclass = WeaponSubclass.CHAOS;
        this.fireRate = this.getEntropicBoltFireRateSec();
        break;
      case WeaponType.SABRES:
        this.currentSubclass = WeaponSubclass.FROST;
        this.fireRate = this.sabresFireRate;
        break;
      case WeaponType.RUNEBLADE:
        this.currentSubclass = WeaponSubclass.ARCANE;
        this.fireRate = this.runebladeFireRate;
        this.swordComboStep = 1; // Reset combo when switching to runeblade
        break;
      case WeaponType.SPEAR:
        this.currentSubclass = WeaponSubclass.STORM;
        break;
      case WeaponType.NONE:
        this.currentSubclass = WeaponSubclass.ELEMENTAL;
        break;
    }

    this.lastWeaponSwitchTime = currentTime;

    // Apply passive abilities for the new weapon
    this.applyPassiveAbilities(weaponType);
  }

  private applyPassiveAbilities(weaponType: WeaponType): void {
    // First, apply global passive effects that persist regardless of current weapon
    this.applyGlobalPassiveEffects();

    if (weaponType === WeaponType.NONE) return;

    // Determine weapon slot
    let weaponSlot: 'primary' | 'secondary' | null = null;
    if (this.selectedWeapons) {
      if (weaponType === this.selectedWeapons.primary) {
        weaponSlot = 'primary';
      } else if (weaponType === this.selectedWeapons.secondary) {
        weaponSlot = 'secondary';
      }
    }

    if (!weaponSlot) return;

    // Apply weapon-specific passive effects
    switch (weaponType) {
      case WeaponType.SABRES:
        this.applySabresPassive(weaponSlot);
        break;
      case WeaponType.SWORD:
        this.applySwordPassive(weaponSlot);
        break;
      case WeaponType.BOW:
        this.applyBowPassive(weaponSlot);
        break;
      case WeaponType.SCYTHE:
        this.applyScythePassive(weaponSlot);
        break;
      case WeaponType.RUNEBLADE:
        this.applyRunebladePassive(weaponSlot);
        break;
    }
  }

  private applyGlobalPassiveEffects(): void {
    // Apply Titanheart max health bonus if unlocked anywhere
    const hasTitanheartPrimary = SkillPointSystem.isAbilityUnlocked(this.skillPointData, WeaponType.SWORD, 'P', 'primary');
    const hasTitanheartSecondary = SkillPointSystem.isAbilityUnlocked(this.skillPointData, WeaponType.SWORD, 'P', 'secondary');

    if ((hasTitanheartPrimary || hasTitanheartSecondary) && !this.titanheartMaxHealthApplied) {
      if (this.playerEntity) {
        const health = this.playerEntity.getComponent(Health);
        if (health) {
          // Store original max health if not already stored
          if (!health.hasOwnProperty('originalMaxHealth')) {
            (health as any).originalMaxHealth = health.maxHealth;
          }

          // Increase max health by 350 once
          health.setMaxHealth(health.maxHealth + 350);
          this.titanheartMaxHealthApplied = true;
        }
      }
    }
  }

  private applySabresPassive(weaponSlot: 'primary' | 'secondary'): void {
    if (this.isPassiveAbilityUnlocked('P', WeaponType.SABRES, weaponSlot)) {
      // Lethality: Increase movement speed from 3.65 to 4.25 and grant 10 critical strike chance runes
      if (this.playerEntity) {
        const movement = this.playerEntity.getComponent(Movement);
        if (movement) {
          // Store original speed if not already stored
          if (!movement.hasOwnProperty('originalMaxSpeed')) {
            (movement as any).originalMaxSpeed = movement.maxSpeed;
          }
          movement.maxSpeed = 4.25;
        }
      }

      // Store base critical rune count (level-based only) if not already stored for this passive
      if (this.sabresBaseCriticalRunes === 0) {
        const currentRuneCounts = getGlobalRuneCounts();
        // The base should be the current total minus any previous passive bonus
        this.sabresBaseCriticalRunes = currentRuneCounts.criticalRunes - this.sabresPassiveCriticalBonus;
      }

      // Add +10 critical runes as permanent passive bonus (only add if not already applied)
      if (this.sabresPassiveCriticalBonus === 0) {
        this.sabresPassiveCriticalBonus = 10;
        const currentRuneCounts = getGlobalRuneCounts();
        const newCriticalRunes = currentRuneCounts.criticalRunes + 10;
        setGlobalCriticalRuneCount(newCriticalRunes);
      }
    } else {
      // Reset to original state if passive is not unlocked
      this.resetSabresPassive();
    }
  }

  private resetSabresPassive(): void {
    if (this.playerEntity) {
      const movement = this.playerEntity.getComponent(Movement);
      if (movement && (movement as any).originalMaxSpeed) {
        movement.maxSpeed = (movement as any).originalMaxSpeed;
      }
    }

    // Remove the passive critical rune bonus (restore to base level-based runes only)
    if (this.sabresPassiveCriticalBonus > 0) {
      const currentRuneCounts = getGlobalRuneCounts();
      const newCriticalRunes = Math.max(0, currentRuneCounts.criticalRunes - this.sabresPassiveCriticalBonus);
      setGlobalCriticalRuneCount(newCriticalRunes);

      this.sabresPassiveCriticalBonus = 0;
      this.sabresBaseCriticalRunes = 0; // Reset stored values
    }
  }

  private applySwordPassive(weaponSlot: 'primary' | 'secondary'): void {
    // Check if Titanheart passive is unlocked for this sword slot
    const isTitanheartUnlocked = this.isPassiveAbilityUnlocked('P', WeaponType.SWORD, weaponSlot);

    if (this.playerEntity) {
      const health = this.playerEntity.getComponent(Health);
      if (health) {
        // Apply enhanced regeneration only when sword is currently equipped
        if (isTitanheartUnlocked) {
          // Store original regeneration values if not already stored
          if (!health.hasOwnProperty('originalRegenerationRate')) {
            (health as any).originalRegenerationRate = health.regenerationRate;
          }
          if (!health.hasOwnProperty('originalRegenerationDelay')) {
            (health as any).originalRegenerationDelay = health.regenerationDelay;
          }

          // Set regeneration to 30 HP per second after 5 seconds
          health.regenerationRate = 30.0;
          health.enableRegeneration(30.0, 5.0); // 5 second delay
        } else {
          // Reset regeneration to normal if sword is not equipped but Titanheart was previously active
          this.resetSwordRegeneration();
        }
      }
    }
  }

  private resetSwordPassive(): void {
    // Only reset regeneration, keep the max health bonus
    this.resetSwordRegeneration();

    // Note: We don't reset max health here - it stays permanently increased once Titanheart is unlocked
  }

  private resetSwordRegeneration(): void {
    if (this.playerEntity) {
      const health = this.playerEntity.getComponent(Health);
      if (health) {
        // Restore original regeneration settings if they were stored
        if ((health as any).originalRegenerationRate && (health as any).originalRegenerationDelay) {
          health.regenerationRate = (health as any).originalRegenerationRate;
          health.enableRegeneration((health as any).originalRegenerationRate, (health as any).originalRegenerationDelay);
        }
      }
    }
  }

  private applyBowPassive(weaponSlot: 'primary' | 'secondary'): void {
    // Sharpshooter: +5% critical hit chance (handled in DamageCalculator)
    // This is a global effect that doesn't need specific application
  }

  private applyScythePassive(weaponSlot: 'primary' | 'secondary'): void {
    // Icebeam: replaces primary attack input flow when unlocked
  }

  private applyRunebladePassive(weaponSlot: 'primary' | 'secondary'): void {
    // Bloodpact: heals for 15% of attack damage dealt (handled in CombatSystem)
  }

  private resetAllPassiveEffects(): void {
    // Reset all passive effects to their base values
    this.resetSabresPassive();
    this.resetSwordPassive();
    // Bow, Scythe, and Runeblade passives are global and don't need resetting
  }

  /**
   * Handle Q/E/R key presses by routing to the ability assigned in the loadout.
   * This is called after the per-weapon primary attack handler every frame.
   */
  private handleLoadoutAbilityKeys(playerTransform: Transform): void {
    if (!this.abilityLoadout) return;
    const slots: Array<'Q' | 'E' | 'R'> = ['Q', 'E', 'R'];
    const keys = ['q', 'e', 'r'] as const;
    for (let i = 0; i < slots.length; i++) {
      const abilityId = this.abilityLoadout[slots[i]];
      if (abilityId && this.inputManager.isKeyPressed(keys[i])) {
        this.dispatchAbility(abilityId, playerTransform);
      }
    }
  }

  /** Dispatch an ability by its universal id, executing the corresponding perform method. */
  private dispatchAbility(abilityId: string, playerTransform: Transform): void {
    switch (abilityId) {
      // ── RUNEBLADE ─────────────────────────────────────────────────────
      case 'RUNEBLADE_Q': // Aegis (Deflect)
        if (!this.isDeflecting && !this.isSmiting && !this.isSwinging && !this.isWraithStriking) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performDeflect(playerTransform);
        }
        break;
      case 'RUNEBLADE_E': // Wraith Strike
        if (!this.isWraithStriking && !this.isSmiting && !this.isSwinging && !this.isDeathGrasping) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performWraithStrike(playerTransform);
        }
        break;
      case 'RUNEBLADE_R': // Colossus Strike (Smite)
        if (!this.isSmiting && !this.isSwinging && !this.isDeathGrasping && !this.isWraithStriking) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performSmite(playerTransform);
        }
        break;
      // ── SWORD (Classic) ───────────────────────────────────────────────
      case 'SWORD_E': // Charge (dash)
        if (
          !this.isSwordCharging &&
          !this.isDeflecting &&
          !this.isSwinging &&
          !this.isSmiting &&
          !this.isDeathGrasping &&
          !this.isWraithStriking &&
          !this.isBarrageCharging &&
          !this.isViperStingCharging &&
          !this.isCobraShotCharging
        ) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performCharge(playerTransform);
        }
        break;
      // ── BOW ───────────────────────────────────────────────────────────
      case 'BOW_Q': // Frost Bite (Barrage)
        if (!this.isBarrageCharging && !this.isCharging && !this.isViperStingCharging)
          this.performBarrage(playerTransform);
        break;
      case 'BOW_E': // Viper Sting (Cobra Shot)
        if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging)
          this.performCobraShot(playerTransform);
        break;
      case 'BOW_R': // Reaping Talons (Viper Sting)
        if (!this.isViperStingCharging && !this.isCharging)
          this.performViperSting(playerTransform);
        break;
      // ── SCYTHE ────────────────────────────────────────────────────────
      case 'SCYTHE_Q': // Sunwell (Reanimate)
        if (!this.isIcebeaming) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performReanimateAbility(playerTransform);
        }
        break;
      case 'SCYTHE_E': // Coldsnap (Frost Nova)
        if (!this.isIcebeaming)
          this.performFrostNovaAbility(playerTransform);
        break;
      case 'SCYTHE_R': // Crossentropy
        if (!this.isIcebeaming && !this.isCrossentropyCharging) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performCrossentropyAbility(playerTransform);
        }
        break;
      // ── SABRES ────────────────────────────────────────────────────────
      case 'SABRES_Q': // Backstab
        if (
          !this.isSwinging &&
          !this.isSkyfalling &&
          !this.isSundering &&
          (!this.backstabDoubleStabActive || !this.isBackstabbing)
        ) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performBackstab(playerTransform);
        }
        break;
      case 'SABRES_E': // Flourish (Sunder)
        if (!this.isSkyfalling && !this.isSundering) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performSunder(playerTransform);
        }
        break;
      case 'SABRES_R': // Divebomb (Skyfall)
        if (!this.isSkyfalling && !this.isSundering)
          this.performSkyfall(playerTransform);
        break;
      // ── SPEAR ─────────────────────────────────────────────────────────
      case 'SPEAR_Q': // Wind Shear (Throw Spear)
        if (!this.isSwinging && !this.isWhirlwindCharging && !this.isWhirlwinding && !this.isThrowSpearCharging) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performThrowSpear(playerTransform);
        }
        break;
      case 'SPEAR_E': // Tempest Sweep (Whirlwind)
        if (!this.isSwinging && !this.isWhirlwindCharging && !this.isWhirlwinding && !this.isThrowSpearCharging) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performWhirlwind(playerTransform);
        }
        break;
      case 'SPEAR_R': // Lightning Bolt
        if (!this.isSwinging && !this.isWhirlwindCharging && !this.isWhirlwinding && !this.isThrowSpearCharging && !this.isFlurryActive)
          this.performLightningStorm(playerTransform);
        break;
      // ── UNIVERSAL ─────────────────────────────────────────────────────
      case 'DEATH_GRASP':
        if (!this.isDeathGrasping) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performDeathGrasp(playerTransform);
        }
        break;
      // ── FORMERLY F-KEY (now in universal loadout pool) ────────────────
      case 'RUNEBLADE_F': // Aura (Corrupted Aura toggle)
        this.toggleCorruptedAura(playerTransform);
        break;
      case 'BOW_F': // Rejuvenating Shot
        if (!this.isBarrageCharging && !this.isViperStingCharging && !this.isCobraShotCharging)
          this.performRejuvenatingShot(playerTransform);
        break;
      case 'BOW_P': // Tempest Rounds — passive, no active dispatch needed
        break;
      case 'SCYTHE_F': // Mantra (Summon Totem)
        if (!this.isIcebeaming) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performSummonTotemAbility(playerTransform);
        }
        break;
      case 'SABRES_F': // Accretion (Stealth)
        if (!this.isSkyfalling && !this.isSundering)
          this.performStealth(playerTransform);
        break;
      case 'SPEAR_F': // Storm Shroud (Flurry)
        if (!this.isSwinging && !this.isWhirlwindCharging && !this.isWhirlwinding && !this.isThrowSpearCharging) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performFlurry(playerTransform);
        }
        break;
      case 'RAISE_DEAD':
        this.performRaiseDead(playerTransform);
        break;
      case 'METEOR_STRIKE':
        this.performMeteorStrike(playerTransform);
        break;
      case 'AEGIS_ROOM':
        if (!this.isDeflecting && !this.isSmiting && !this.isSwinging && !this.isWraithStriking) {
          window.dispatchEvent(new CustomEvent('character-ability-cast'));
          this.performDeflect(playerTransform, { fromAegisRoom: true });
        }
        break;
    }
  }

  /**
   * Update ongoing ability states for abilities that may be active on any weapon.
   * These were previously only updated inside their weapon-specific handlers,
   * but now run every frame to support cross-weapon ability usage.
   */
  private updateCrossWeaponStates(playerTransform: Transform, currentTime: number): void {
    // Spear states
    if (this.isThrowSpearCharging) {
      this.updateThrowSpearCharging(playerTransform, currentTime);
    }
    if (this.isThrowSpearReleasing) {
      if (currentTime - this.throwSpearReleaseTime >= 0.15) {
        this.isThrowSpearReleasing = false;
        this.throwSpearReleaseTime = 0;
      }
    }
    if (this.isWhirlwindCharging) {
      this.updateWhirlwindCharging(playerTransform, currentTime);
    }
    if (this.isWhirlwinding) {
      this.updateWhirlwindSpinning(currentTime);
    }
    if (this.isFlurryActive) {
      this.updateFlurryState(currentTime);
    }
    // Sabres states
    if (this.isSkyfalling) {
      this.updateSkyfallMovement(playerTransform);
    }
    if (this.isBackstabbing) {
      this.updateBackstabState(playerTransform);
    }
    if (this.isSundering) {
      this.updateSunderState(playerTransform);
    }
    if (this.isStealthing) {
      this.updateStealthState(playerTransform);
    }
    // Runeblade states
    if (this.corruptedAuraActive) {
      // Auto-expire after duration
      if (currentTime - this.corruptedAuraStartTime >= this.corruptedAuraDuration) {
        this.deactivateCorruptedAura();
      } else {
        this.updateCorruptedAuraEffects(playerTransform);
      }
    }
  }

  /** Sync Double Strike charge mode with talent + loadout; init or clear charge state on transitions. */
  private syncWraithStrikeDoubleStrikeMode(): boolean {
    const active = shouldApplyDoubleStrikeTalent(this.talentLoadout, this.abilityLoadout);
    if (!active) {
      if (this.wraithStrikeDoubleStrikeActive) {
        this.wraithStrikeDoubleStrikeActive = false;
        this.wraithStrikeCharges = 0;
        this.wraithStrikeNextChargeAt = null;
      }
      return false;
    }
    if (!this.wraithStrikeDoubleStrikeActive) {
      this.wraithStrikeDoubleStrikeActive = true;
      this.wraithStrikeCharges = WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES;
      this.wraithStrikeNextChargeAt = null;
    }
    return true;
  }

  /** Apply completed Wraith Strike charge timers (Double Strike only). */
  private advanceWraithStrikeChargeRecharges(now: number): void {
    const maxC = WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES;
    while (
      this.wraithStrikeNextChargeAt !== null &&
      now >= this.wraithStrikeNextChargeAt &&
      this.wraithStrikeCharges < maxC
    ) {
      this.wraithStrikeCharges++;
      if (this.wraithStrikeCharges < maxC) {
        this.wraithStrikeNextChargeAt += this.wraithStrikeCooldown;
      } else {
        this.wraithStrikeNextChargeAt = null;
      }
    }
  }

  private getWraithStrikeCooldownInfo(
    currentTime: number,
  ): { current: number; max: number; isActive: boolean; charges?: number; maxCharges?: number } {
    if (this.syncWraithStrikeDoubleStrikeMode()) {
      this.advanceWraithStrikeChargeRecharges(currentTime);
      const maxC = WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES;
      if (this.wraithStrikeCharges > 0) {
        return {
          current: 0,
          max: this.wraithStrikeCooldown,
          isActive: this.isWraithStriking,
          charges: this.wraithStrikeCharges,
          maxCharges: maxC,
        };
      }
      const until =
        this.wraithStrikeNextChargeAt != null
          ? Math.max(0, this.wraithStrikeNextChargeAt - currentTime)
          : this.wraithStrikeCooldown;
      return {
        current: until,
        max: this.wraithStrikeCooldown,
        isActive: this.isWraithStriking,
        charges: 0,
        maxCharges: maxC,
      };
    }
    return {
      current: Math.max(0, this.wraithStrikeCooldown - (currentTime - this.lastWraithStrikeTime)),
      max: this.wraithStrikeCooldown,
      isActive: this.isWraithStriking,
    };
  }

  /** Sync Double Stab charge mode with talent + loadout; init or clear charge state on transitions. */
  private syncBackstabDoubleStabMode(): boolean {
    const active = shouldApplyDoubleStabTalent(this.talentLoadout, this.abilityLoadout);
    if (!active) {
      if (this.backstabDoubleStabActive) {
        this.backstabDoubleStabActive = false;
        this.backstabCharges = 0;
        this.backstabNextChargeAt = null;
        this.lastBackstabDoubleStabChargeSpendTime = Number.NEGATIVE_INFINITY;
      }
      return false;
    }
    if (!this.backstabDoubleStabActive) {
      this.backstabDoubleStabActive = true;
      this.backstabCharges = BACKSTAB_DOUBLE_STAB_MAX_CHARGES;
      this.backstabNextChargeAt = null;
      this.lastBackstabDoubleStabChargeSpendTime = Number.NEGATIVE_INFINITY;
    }
    return true;
  }

  /** Apply completed Backstab charge timers (Double Stab only). */
  private advanceBackstabChargeRecharges(now: number): void {
    const maxC = BACKSTAB_DOUBLE_STAB_MAX_CHARGES;
    while (
      this.backstabNextChargeAt !== null &&
      now >= this.backstabNextChargeAt &&
      this.backstabCharges < maxC
    ) {
      this.backstabCharges++;
      if (this.backstabCharges < maxC) {
        this.backstabNextChargeAt += this.backstabCooldown;
      } else {
        this.backstabNextChargeAt = null;
      }
    }
  }

  private getBackstabCooldownInfo(
    currentTime: number,
  ): { current: number; max: number; isActive: boolean; charges?: number; maxCharges?: number } {
    if (this.syncBackstabDoubleStabMode()) {
      this.advanceBackstabChargeRecharges(currentTime);
      const maxC = BACKSTAB_DOUBLE_STAB_MAX_CHARGES;
      if (this.backstabCharges > 0) {
        const internalCooldownRemaining = Math.max(
          0,
          BACKSTAB_DOUBLE_STAB_INTERNAL_COOLDOWN_SEC -
            (currentTime - this.lastBackstabDoubleStabChargeSpendTime),
        );
        return {
          current: internalCooldownRemaining,
          max:
            internalCooldownRemaining > 0
              ? BACKSTAB_DOUBLE_STAB_INTERNAL_COOLDOWN_SEC
              : this.backstabCooldown,
          isActive: this.isBackstabbing,
          charges: this.backstabCharges,
          maxCharges: maxC,
        };
      }
      const until =
        this.backstabNextChargeAt != null
          ? Math.max(0, this.backstabNextChargeAt - currentTime)
          : this.backstabCooldown;
      return {
        current: until,
        max: this.backstabCooldown,
        isActive: this.isBackstabbing,
        charges: 0,
        maxCharges: maxC,
      };
    }
    return {
      current: Math.max(0, this.backstabCooldown - (currentTime - this.lastBackstabTime)),
      max: this.backstabCooldown,
      isActive: this.isBackstabbing,
    };
  }

  /** Sync Double Talons charge mode with talent + loadout; init or clear charge state on transitions. */
  private syncViperStingDoubleTalonsMode(): boolean {
    const active = shouldApplyDoubleTalonsTalent(this.talentLoadout, this.abilityLoadout);
    if (!active) {
      if (this.viperStingDoubleTalonsActive) {
        this.viperStingDoubleTalonsActive = false;
        this.viperStingCharges = 0;
        this.viperStingNextChargeAt = null;
        this.lastViperStingDoubleTalonsChargeSpendTime = Number.NEGATIVE_INFINITY;
      }
      return false;
    }
    if (!this.viperStingDoubleTalonsActive) {
      this.viperStingDoubleTalonsActive = true;
      this.viperStingCharges = REAPING_TALONS_DOUBLE_TALONS_MAX_CHARGES;
      this.viperStingNextChargeAt = null;
      this.lastViperStingDoubleTalonsChargeSpendTime = Number.NEGATIVE_INFINITY;
    }
    return true;
  }

  /** Apply completed Reaping Talons charge timers (Double Talons only). */
  private advanceViperStingChargeRecharges(now: number): void {
    const maxC = REAPING_TALONS_DOUBLE_TALONS_MAX_CHARGES;
    while (
      this.viperStingNextChargeAt !== null &&
      now >= this.viperStingNextChargeAt &&
      this.viperStingCharges < maxC
    ) {
      this.viperStingCharges++;
      if (this.viperStingCharges < maxC) {
        this.viperStingNextChargeAt += this.viperStingFireRate;
      } else {
        this.viperStingNextChargeAt = null;
      }
    }
  }

  private getViperStingCooldownInfo(
    currentTime: number,
  ): { current: number; max: number; isActive: boolean; charges?: number; maxCharges?: number } {
    if (this.syncViperStingDoubleTalonsMode()) {
      this.advanceViperStingChargeRecharges(currentTime);
      const maxC = REAPING_TALONS_DOUBLE_TALONS_MAX_CHARGES;
      if (this.viperStingCharges > 0) {
        const internalCooldownRemaining = Math.max(
          0,
          REAPING_TALONS_DOUBLE_TALONS_INTERNAL_COOLDOWN_SEC -
            (currentTime - this.lastViperStingDoubleTalonsChargeSpendTime),
        );
        return {
          current: internalCooldownRemaining,
          max:
            internalCooldownRemaining > 0
              ? REAPING_TALONS_DOUBLE_TALONS_INTERNAL_COOLDOWN_SEC
              : this.viperStingFireRate,
          isActive: this.isViperStingCharging,
          charges: this.viperStingCharges,
          maxCharges: maxC,
        };
      }
      const until =
        this.viperStingNextChargeAt != null
          ? Math.max(0, this.viperStingNextChargeAt - currentTime)
          : this.viperStingFireRate;
      return {
        current: until,
        max: this.viperStingFireRate,
        isActive: this.isViperStingCharging,
        charges: 0,
        maxCharges: maxC,
      };
    }
    return {
      current: Math.max(0, this.viperStingFireRate - (currentTime - this.lastViperStingTime)),
      max: this.viperStingFireRate,
      isActive: this.isViperStingCharging,
    };
  }

  /** Sync SHAMAN charge mode with talent + loadout; init or clear charge state on transitions. */
  private syncSummonTotemShamanMode(): boolean {
    const active = shouldApplyShamanTalent(this.talentLoadout, this.abilityLoadout);
    if (!active) {
      if (this.summonTotemShamanActive) {
        this.summonTotemShamanActive = false;
        this.summonTotemCharges = 0;
        this.summonTotemNextChargeAt = null;
        this.lastSummonTotemShamanChargeSpendTime = Number.NEGATIVE_INFINITY;
      }
      return false;
    }
    if (!this.summonTotemShamanActive) {
      this.summonTotemShamanActive = true;
      this.summonTotemCharges = MANTRA_SHAMAN_MAX_CHARGES;
      this.summonTotemNextChargeAt = null;
      this.lastSummonTotemShamanChargeSpendTime = Number.NEGATIVE_INFINITY;
    }
    return true;
  }

  /** Apply completed Mantra charge timers (SHAMAN only). */
  private advanceSummonTotemChargeRecharges(now: number): void {
    const maxC = MANTRA_SHAMAN_MAX_CHARGES;
    while (
      this.summonTotemNextChargeAt !== null &&
      now >= this.summonTotemNextChargeAt &&
      this.summonTotemCharges < maxC
    ) {
      this.summonTotemCharges++;
      if (this.summonTotemCharges < maxC) {
        this.summonTotemNextChargeAt += this.summonTotemFireRate;
      } else {
        this.summonTotemNextChargeAt = null;
      }
    }
  }

  private getSummonTotemCooldownInfo(
    currentTime: number,
  ): { current: number; max: number; isActive: boolean; charges?: number; maxCharges?: number } {
    if (this.syncSummonTotemShamanMode()) {
      this.advanceSummonTotemChargeRecharges(currentTime);
      const maxC = MANTRA_SHAMAN_MAX_CHARGES;
      if (this.summonTotemCharges > 0) {
        const internalCooldownRemaining = Math.max(
          0,
          MANTRA_SHAMAN_INTERNAL_COOLDOWN_SEC - (currentTime - this.lastSummonTotemShamanChargeSpendTime),
        );
        return {
          current: internalCooldownRemaining,
          max: internalCooldownRemaining > 0 ? MANTRA_SHAMAN_INTERNAL_COOLDOWN_SEC : this.summonTotemFireRate,
          isActive: false,
          charges: this.summonTotemCharges,
          maxCharges: maxC,
        };
      }
      const until =
        this.summonTotemNextChargeAt != null
          ? Math.max(0, this.summonTotemNextChargeAt - currentTime)
          : this.summonTotemFireRate;
      return {
        current: until,
        max: this.summonTotemFireRate,
        isActive: false,
        charges: 0,
        maxCharges: maxC,
      };
    }
    return {
      current: Math.max(0, this.summonTotemFireRate - (currentTime - this.lastSummonTotemTime)),
      max: this.summonTotemFireRate,
      isActive: false,
    };
  }

  private countAcceleratorTotemsInRangeXZ(px: number, pz: number): number {
    const R = ACCELERATOR_TOTEM_AURA_RADIUS_UNITS;
    const r2 = R * R;
    const nTrip = acceleratorOwnedTotemTripletCount;
    const buf = acceleratorOwnedTotemFlatXYZ;
    let c = 0;
    for (let i = 0, ix = 0; i < nTrip; i++, ix += 3) {
      const dx = buf[ix] - px;
      const dz = buf[ix + 2] - pz;
      if (dx * dx + dz * dz <= r2) {
        c++;
      }
    }
    return c;
  }

  private tickHealingStreamTalent(deltaTime: number, playerPos: Vector3): void {
    if (!shouldApplyHealingStreamTalent(this.talentLoadout, this.abilityLoadout)) {
      return;
    }
    if (this.isPlayerDead || !this.playerEntity) {
      return;
    }
    const health = this.playerEntity.getComponent(Health);
    if (!health || health.isDead) {
      return;
    }
    if (health.currentHealth >= health.maxHealth) {
      this.healingStreamHealCarry = 0;
      return;
    }
    const n = this.countAcceleratorTotemsInRangeXZ(playerPos.x, playerPos.z);
    if (n <= 0) {
      return;
    }
    this.healingStreamHealCarry += deltaTime * HEALING_STREAM_HP_PER_SEC_PER_TOTEM * n;
    let whole = Math.floor(this.healingStreamHealCarry);
    this.healingStreamHealCarry -= whole;
    if (whole <= 0) {
      return;
    }
    const cap = Math.max(0, health.maxHealth - health.currentHealth);
    whole = Math.min(whole, cap);
    if (whole <= 0) {
      return;
    }
    const didHeal = health.heal(whole);
    if (!didHeal) {
      return;
    }
    const healingPosition = playerPos.clone();
    healingPosition.y += 1.5;
    const wallNow = Date.now();
    const showNumbers =
      wallNow - this.lastHealingStreamHealNumberWallClockMs >= FLURRY_HEAL_NUMBER_MIN_INTERVAL_MS;
    if (showNumbers && this.onDamageNumbersUpdate) {
      this.lastHealingStreamHealNumberWallClockMs = wallNow;
      this.onDamageNumbersUpdate([
        {
          id: this.nextDamageNumberId.toString(),
          damage: whole,
          position: healingPosition,
          isCritical: false,
          timestamp: wallNow,
          damageType: 'healing_stream',
        },
      ]);
      this.nextDamageNumberId++;
    }
    if (showNumbers && this.onBroadcastHealing) {
      this.onBroadcastHealing(whole, 'healing_stream', healingPosition);
    }
  }

  /** Wall-clock reconcile; call from `update` / cooldown queries so Accelerator tracks time outside ECS gaps. */
  private reconcileCrossentropyCooldown(now: number, playerPos: Vector3): void {
    if (this.crossentropyCooldownReconcileWallSec === null) {
      this.crossentropyCooldownReconcileWallSec = now;
      return;
    }
    let dt = now - this.crossentropyCooldownReconcileWallSec;
    if (dt < 0) {
      dt = 0;
    }
    dt = Math.min(dt, 0.25);
    this.crossentropyCooldownReconcileWallSec = now;

    const maxSec = CROSSENTROPY_COOLDOWN_SEC;
    if (this.crossentropyRechargeAccumulator >= maxSec) {
      return;
    }

    let mult = 1;
    if (shouldApplyAcceleratorTalent(this.talentLoadout, this.abilityLoadout)) {
      mult = Math.pow(2, this.countAcceleratorTotemsInRangeXZ(playerPos.x, playerPos.z));
    }

    this.crossentropyRechargeAccumulator = Math.min(
      maxSec,
      this.crossentropyRechargeAccumulator + dt * mult,
    );
  }

  private getCrossentropyCooldownHud(currentTime: number): {
    current: number;
    max: number;
    isActive: boolean;
  } {
    const pt = this.playerEntity?.getComponent(Transform);
    const p = pt?.getWorldPosition();
    if (p) {
      this.reconcileCrossentropyCooldown(currentTime, p);
    }
    const maxSec = CROSSENTROPY_COOLDOWN_SEC;
    const remaining = Math.max(0, maxSec - this.crossentropyRechargeAccumulator);
    return {
      current: remaining,
      max: maxSec,
      isActive: this.isCrossentropyCharging,
    };
  }

  /** Return the cooldown info for a specific universal ability id. */
  private getCooldownForAbility(
    abilityId: string,
    currentTime: number,
  ): { current: number; max: number; isActive: boolean; charges?: number; maxCharges?: number } {
    switch (abilityId) {
      case 'DEATH_GRASP':
      case 'RUNEBLADE_Q': return { current: Math.max(0, this.deathGraspCooldown - (currentTime - this.lastDeathGraspTime)), max: this.deathGraspCooldown, isActive: this.isDeathGrasping };
      case 'RUNEBLADE_E': return this.getWraithStrikeCooldownInfo(currentTime);
      case 'RUNEBLADE_R': return { current: Math.max(0, this.smiteCooldown - (currentTime - this.lastSmiteTime)), max: this.smiteCooldown, isActive: this.isSmiting };
      case 'BOW_Q':       return { current: Math.max(0, this.barrageFireRate - (currentTime - this.lastBarrageTime)), max: this.barrageFireRate, isActive: this.isBarrageCharging };
      case 'BOW_E':       return { current: Math.max(0, this.cobraShotFireRate - (currentTime - this.lastCobraShotTime)), max: this.cobraShotFireRate, isActive: this.isCobraShotCharging };
      case 'BOW_R':       return this.getViperStingCooldownInfo(currentTime);
      case 'SCYTHE_Q':    return { current: Math.max(0, REANIMATE_SUNWELL_COOLDOWN_SEC - (currentTime - this.lastReanimateTime)), max: REANIMATE_SUNWELL_COOLDOWN_SEC, isActive: false };
      case 'SCYTHE_E':    return { current: Math.max(0, this.frostNovaFireRate - (currentTime - this.lastFrostNovaTime)), max: this.frostNovaFireRate, isActive: false };
      case 'SCYTHE_R':    return this.getCrossentropyCooldownHud(currentTime);
      case 'SABRES_Q':    return this.getBackstabCooldownInfo(currentTime);
      case 'SABRES_E':    return { current: Math.max(0, this.sunderCooldown - (currentTime - this.lastSunderTime)), max: this.sunderCooldown, isActive: this.isSundering };
      case 'SABRES_R':    return { current: Math.max(0, this.skyfallCooldown - (currentTime - this.lastSkyfallTime)), max: this.skyfallCooldown, isActive: this.isSkyfalling };
      case 'SPEAR_Q':     return { current: Math.max(0, this.throwSpearCooldown - (currentTime - this.lastThrowSpearTime)), max: this.throwSpearCooldown, isActive: this.isThrowSpearCharging };
      case 'SPEAR_E':     return { current: Math.max(0, this.whirlwindCooldown - (currentTime - this.lastWhirlwindTime)), max: this.whirlwindCooldown, isActive: this.isWhirlwindCharging || this.isWhirlwinding };
      case 'SPEAR_R':     return { current: Math.max(0, this.lightningStormCooldown - (currentTime - this.lastLightningStormTime)), max: this.lightningStormCooldown, isActive: false };
      // ── Formerly F-key abilities ──────────────────────────────────────
      case 'RUNEBLADE_F': return { current: Math.max(0, this.corruptedAuraCooldown - (currentTime - this.lastCorruptedAuraTime)), max: this.corruptedAuraCooldown, isActive: this.corruptedAuraActive };
      case 'SWORD_E':     return { current: Math.max(0, this.chargeCooldown - (currentTime - this.lastChargeTime)), max: this.chargeCooldown, isActive: this.isSwordCharging };
      case 'BOW_F':       return { current: Math.max(0, this.rejuvenatingShotFireRate - (currentTime - this.lastRejuvenatingShotTime)), max: this.rejuvenatingShotFireRate, isActive: false };
      case 'BOW_P':       return { current: 0, max: 0, isActive: false };
      case 'SCYTHE_F':    return this.getSummonTotemCooldownInfo(currentTime);
      case 'SABRES_F':    return { current: Math.max(0, this.stealthCooldown - (currentTime - this.lastStealthTime)), max: this.stealthCooldown, isActive: this.isStealthing };
      case 'SPEAR_F':     return { current: Math.max(0, this.flurryCooldown - (currentTime - this.lastFlurryTime)), max: this.flurryCooldown, isActive: this.isFlurryActive };
      case 'RAISE_DEAD':  return { current: Math.max(0, RAISE_DEAD_COOLDOWN_SEC - (currentTime - this.lastRaiseDeadTime)), max: RAISE_DEAD_COOLDOWN_SEC, isActive: false };
      case 'METEOR_STRIKE': return { current: Math.max(0, METEOR_STRIKE_COOLDOWN_SEC - (currentTime - this.lastMeteorStrikeTime)), max: METEOR_STRIKE_COOLDOWN_SEC, isActive: false };
      case 'AEGIS_ROOM':  return { current: Math.max(0, AEGIS_ROOM_COOLDOWN_SEC - (currentTime - this.lastDeflectTime)), max: AEGIS_ROOM_COOLDOWN_SEC, isActive: this.isDeflecting };
      default:            return { current: 0, max: 1, isActive: false };
    }
  }

  private handleCombatInput(playerTransform: Transform): void {
    // Prevent combat actions while dead and waiting to respawn
    if (this.isPlayerDead) {
      return;
    }

    if (this.currentWeapon !== WeaponType.NONE) {
    if (this.currentWeapon === WeaponType.BOW) {
      this.handleBowInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SCYTHE) {
      this.handleScytheInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SWORD) {
      this.handleSwordInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SABRES) {
      this.handleSabresInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.RUNEBLADE) {
      this.handleRunebladeInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SPEAR) {
      this.handleSpearInput(playerTransform);
    }
    }

    // Dispatch Q/E/R to the player's chosen ability loadout (cross-weapon)
    this.handleLoadoutAbilityKeys(playerTransform);

    // Update ongoing ability states regardless of current weapon
    this.updateCrossWeaponStates(playerTransform, Date.now() / 1000);
  }

  private handleBowInput(playerTransform: Transform): void {
    const bowSlot: 'primary' | 'secondary' =
      this.currentWeapon === this.selectedWeapons?.primary ? 'primary' : 'secondary';
    const hasRapidfirePassive =
      this.isPassiveAbilityUnlocked('P', WeaponType.BOW, bowSlot) ||
      (this.currentWeapon === WeaponType.BOW && this.talentLoadout.tempestRounds === true);

    // Q/E/R abilities are now handled by handleLoadoutAbilityKeys via the universal dispatch.

    // Handle bow input based on whether RAPIDFIRE passive is unlocked
    if (hasRapidfirePassive) {
      // RAPIDFIRE MODE: Burst fire without charging
      // Ensure charging state is reset since we don't use charging in burst mode
      this.isCharging = false;
      this.chargeProgress = 0;
      this.bowPrimaryChargeStartMs = null;

      if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button pressed
        const currentTime = Date.now() / 1000; // Convert to seconds

        // Check cooldown
        if (currentTime - this.lastBurstFireTime >= this.burstFireRate) {
          // Fire burst attack - use same direction calculation as regular projectiles
          // Get dragon's facing direction (same as camera direction since dragon faces camera)
          const direction = new Vector3();
          this.camera.getWorldDirection(direction);
          direction.normalize();

          // Apply downward angle compensation to account for restricted camera bounds
          const compensationAngle = Math.PI / 6; // 30 degrees downward compensation

          // Create a rotation matrix to apply the downward angle around the camera's right axis
          const cameraRight = new Vector3();
          cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();

          // Apply rotation around the right axis to tilt the direction downward
          const rotationMatrix = new Matrix4();
          rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
          direction.applyMatrix4(rotationMatrix);
          direction.normalize();

          this.fireBurstAttack(playerTransform.position, direction);
        }
      }
    } else {
      // NORMAL MODE: Charge-based firing
      if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button held
        if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging && !this.isRejuvenatingShotCharging) {
          this.isCharging = true;
          this.chargeProgress = 0;
          this.bowPrimaryChargeStartMs = performance.now();

          // Play bow draw sound when starting to charge
          this.audioSystem?.playBowDrawSound(playerTransform.position);
        }
        if (!this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging && !this.isRejuvenatingShotCharging) {
          if (this.bowPrimaryChargeStartMs != null) {
            this.chargeProgress = Math.min(
              1,
              (performance.now() - this.bowPrimaryChargeStartMs) /
                getBowFullChargeMs(
                  this.currentWeapon === WeaponType.BOW &&
                    shouldApplyHighCaliberTalent(this.talentLoadout),
                ),
            );
          }
        }
      } else if (this.isCharging) {
        // Check if any ability is charging - if so, cancel the regular bow shot
        if (this.isViperStingCharging || this.isBarrageCharging || this.isCobraShotCharging || this.isRejuvenatingShotCharging) {
          this.isCharging = false;
          this.chargeProgress = 0;
          this.bowPrimaryChargeStartMs = null;
          return;
        }

        // Store charge progress before resetting for visual effects
        const finalChargeProgress = this.chargeProgress;

        // Stop the bow draw sound before attempting release
        this.audioSystem?.stopSound('bow_draw');

        // Release the bow
        const didFireProjectile = this.fireProjectile(playerTransform);
        if (didFireProjectile) {
          this.audioSystem?.playBowReleaseSound(
            playerTransform.position,
            finalChargeProgress,
            isBowPerfectShotProgress(finalChargeProgress)
          );
        }
        this.isCharging = false;
        this.chargeProgress = 0;
        this.bowPrimaryChargeStartMs = null;

        // Trigger visual effects callback with the stored charge progress
        this.triggerBowReleaseEffects(finalChargeProgress);
      }
    }
  }

  private handleScytheInput(playerTransform: Transform): void {
    const weaponSlot: 'primary' | 'secondary' = this.currentWeapon === this.selectedWeapons?.primary ? 'primary' : 'secondary';
    const isIcebeamUnlocked =
      this.isPassiveAbilityUnlocked('P', WeaponType.SCYTHE, weaponSlot) ||
      (this.currentWeapon === WeaponType.SCYTHE && this.talentLoadout.icebeam === true);

    // Handle Scythe left click:
    // - default: Entropic Bolt primary
    // - passive unlocked: Icebeam replaces primary
    if (isIcebeamUnlocked) {
      if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button held
        if (!this.isIcebeaming) {
          // Check cooldown
          const currentTime = Date.now() / 1000;
          if (currentTime - this.lastIcebeamTime < this.icebeamCooldownDurationSec) {
            return; // On cooldown
          }

          this.isIcebeaming = true;
          this.icebeamStartTime = Date.now();

          // Apply movement and camera speed debuffs
          const playerMovement = this.playerEntity?.getComponent(Movement);
          if (playerMovement) {
            playerMovement.isIcebeaming = true;
          }

          // Apply camera rotation speed debuff
          const cameraSystem = (window as any).cameraSystem;
          if (cameraSystem && cameraSystem.setIceBeamActive) {
            cameraSystem.setIceBeamActive(true);
          }

          // Start spinning animation
          if (!this.isCharging) {
            this.isCharging = true;
            this.chargeProgress = 0;
          }

          // Trigger Icebeam state change callback
          if (this.onIcebeamStateChangeCallback) {
            this.onIcebeamStateChangeCallback(true);
          }
        } else {
          // Continue spinning animation while Icebeaming
          this.chargeProgress += 0.03; // Continuously increase for spinning
          const heldSec = (Date.now() - this.icebeamStartTime) / 1000;
          if (heldSec >= ICEBEAM_MAX_HOLD_SEC) {
            this.stopIcebeam(true);
          }
        }
      } else if (this.isIcebeaming) {
        // Stop Icebeam when mouse is released
        this.stopIcebeam();
      }
    } else {
      // Ensure Icebeam is fully reset if passive is not unlocked
      if (this.isIcebeaming) {
        this.stopIcebeam();
      }

      // Default Scythe primary attack: Entropic Bolt
      if (this.inputManager.isMouseButtonPressed(0) && !this.isCrossentropyCharging && !this.isSummonTotemCharging) {
        this.fireEntropicBoltProjectile(playerTransform);
      }
    }
    
    // Q/E/R abilities are now handled by handleLoadoutAbilityKeys via the universal dispatch.
  }

  private stopIcebeam(endedByMaxHold = false): void {
    this.isIcebeaming = false;
    this.icebeamStartTime = 0;
    this.icebeamCooldownDurationSec = endedByMaxHold
      ? ICEBEAM_COOLDOWN_AFTER_MAX_HOLD_SEC
      : ICEBEAM_COOLDOWN_AFTER_RELEASE_SEC;
    this.lastIcebeamTime = Date.now() / 1000;
    // Remove movement and camera speed debuffs
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (playerMovement) {
      playerMovement.isIcebeaming = false;
    }

    // Remove camera rotation speed debuff
    const cameraSystem = (window as any).cameraSystem;
    if (cameraSystem && cameraSystem.setIceBeamActive) {
      cameraSystem.setIceBeamActive(false);
    }

    // Stop spinning animation
    this.isCharging = false;
    this.chargeProgress = 0;

    // Trigger Icebeam state change callback
    if (this.onIcebeamStateChangeCallback) {
      this.onIcebeamStateChangeCallback(false);
    }
  }

  private fireProjectile(playerTransform: Transform): boolean {
    // Rate limiting - prevent spam clicking
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastBowFireTime < this.fireRate) {
      return false;
    }
    this.lastBowFireTime = currentTime;
    
    // Get dragon's facing direction (same as camera direction since dragon faces camera)
    // This ensures arrows fire outward from where the dragon is facing
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply downward angle compensation to account for restricted camera bounds
    // Since camera can't look down much due to bounds, we add a fixed downward angle
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    
    // Create a rotation matrix to apply the downward angle around the camera's right axis
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    const isPerfectShot = isBowPerfectShotProgress(this.chargeProgress);
    
    // Check if bow is fully charged for special projectile
    if (this.chargeProgress >= 1.0) {
      this.createChargedArrowProjectile(playerTransform.position.clone(), direction);
    } else if (isPerfectShot) {
      this.createPerfectShotProjectile(playerTransform.position.clone(), direction);
    } else {
      // Debug: Log the firing angle to verify it's changing with camera rotation
      const angle = Math.atan2(direction.x, direction.z);
      this.createProjectile(playerTransform.position.clone(), direction);
    }
    return true;
  }

  private getEntropicBoltFireRateSec(): number {
    return getEntropicBoltFireRateSec(this.talentLoadout);
  }

  private fireEntropicBoltProjectile(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const entropicFireRate = this.getEntropicBoltFireRateSec();
    if (currentTime - this.lastScytheFireTime < entropicFireRate) {
      return;
    }
    this.lastScytheFireTime = currentTime;

    // Play entropic bolt sound
    this.audioSystem?.playEntropicBoltSound(playerTransform.position);

    // Get dragon's facing direction
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Apply downward angle compensation (same as bow projectiles)
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();

    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();

    const spinStatus = this.isCharging ? ' (SPINNING)' : '';

    this.createEntropicBoltProjectile(playerTransform.position.clone(), direction);
  }

  private performCrossentropyAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;

    const currentTime = Date.now() / 1000;
    const ppos = playerTransform.getWorldPosition();
    this.reconcileCrossentropyCooldown(currentTime, ppos);
    const eps = 1e-6;
    let isBloodmageBypass = false;
    if (this.crossentropyRechargeAccumulator + eps < CROSSENTROPY_COOLDOWN_SEC) {
      if (!this.tryBloodmageDashBypass(currentTime)) return;
      isBloodmageBypass = true;
    }

    this.isCrossentropyCharging = true;
    this.crossentropyChargeProgress = 0;
    if (!isBloodmageBypass) {
      this.crossentropyRechargeAccumulator = 0;
    }

    // Play crossentropy sound at the start of the ability
    this.audioSystem?.playCrossentropySound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 1000; // 1 second charge time

    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.crossentropyChargeProgress = Math.min(elapsed / chargeDuration, 1.0);

      if (this.crossentropyChargeProgress >= 1.0) {
        this.clearTrackedAbilityInterval(chargeInterval);
        this.fireCrossentropyBoltAbilityAfterCharge(playerTransform);
        this.isCrossentropyCharging = false;
        this.crossentropyChargeProgress = 0;
      }
    }, 16); // ~60fps updates
    this.trackAbilityInterval(chargeInterval);
  }

  private fireCrossentropyBoltAbilityAfterCharge(playerTransform: Transform): void {
    // Rate limiting was already checked in performCrossentropyAbility()
    // No need to check again here - we just finished charging

    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    if (direction.y < 0) direction.y = 0;
    if (direction.lengthSq() < 1e-8) {
      direction.copy(playerTransform.getForward());
      direction.y = 0;
      if (direction.lengthSq() < 1e-8) direction.set(0, 0, -1);
    }
    direction.normalize();

    this.createCrossentropyBoltProjectile(playerTransform.position.clone(), direction);
  }

  private performSummonTotemAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;

    const currentTime = Date.now() / 1000;

    if (this.syncSummonTotemShamanMode()) {
      this.advanceSummonTotemChargeRecharges(currentTime);
      if (this.summonTotemCharges <= 0) {
        return;
      }
      if (currentTime - this.lastSummonTotemShamanChargeSpendTime < MANTRA_SHAMAN_INTERNAL_COOLDOWN_SEC) {
        return;
      }
    } else if (currentTime - this.lastSummonTotemTime < this.summonTotemFireRate) {
      return;
    }

    if (this.summonTotemShamanActive) {
      this.summonTotemCharges--;
      this.lastSummonTotemShamanChargeSpendTime = currentTime;
      if (
        this.summonTotemCharges < MANTRA_SHAMAN_MAX_CHARGES &&
        this.summonTotemNextChargeAt === null
      ) {
        this.summonTotemNextChargeAt = currentTime + this.summonTotemFireRate;
      }
    } else {
      this.lastSummonTotemTime = currentTime;
    }

    // Play mantra sound when totem is summoned
    this.audioSystem?.playScytheMantraSound(playerTransform.getWorldPosition());

    // Get player's world position
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825; // Summon at chest level

    // Trigger Summon Totem callback for remote players
    if (this.onSummonTotemCallback) {
      this.onSummonTotemCallback(playerPosition);
    }
  }

  private createWindShearProjectile(position: Vector3, direction: Vector3): Entity {
    if (!this.playerEntity) return null as any;

    // Offset projectile spawn position forward to avoid immediate collision with player or close enemies
    const spawnPosition = position.clone().add(direction.clone().multiplyScalar(2.0));

    // Wind Shear projectile config - 120 piercing damage, 15 unit range, increased speed
    const projectileConfig = {
      speed: 32.5, // Increased projectile speed by 30% (matches visual speed)
      damage: 120, // 120 piercing damage 
      lifetime: 2.0, // 2 seconds lifetime (enough for 15 units at 32.5 speed)
      piercing: true, // Piercing damage - hits multiple targets as it travels
      explosive: false,
      maxDistance: 15, // 15 unit range
      projectileType: 'wind_shear', // Custom projectile type for identification
      sourcePlayerId: 'unknown' // Will be set by broadcasting system if needed
    };

    // Create the projectile entity
    const projectileEntity = this.projectileSystem.createProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      projectileConfig
    );

    // Mark as wind shear projectile for visual identification
    const renderer = projectileEntity.getComponent(Renderer) as Renderer;
    if (renderer?.mesh) {
      renderer.mesh.userData.projectileType = 'wind_shear';
    }

    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('wind_shear', spawnPosition, direction, projectileConfig);
    }

    return projectileEntity;
  }

  private createProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Check if there are any valid targets in the world before creating projectiles
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);
    const validTargets = potentialTargets.filter(target => 
      target.id !== this.playerEntity!.id && // Not the player itself
      !target.getComponent(Health)?.isDead // Not dead
    );
    
    // In multiplayer mode, only create projectiles if there are valid targets or if we need to broadcast to other players
    const hasValidTargets = validTargets.length > 0;
    const shouldBroadcast = this.onProjectileCreatedCallback !== undefined;
    
    if (!hasValidTargets && !shouldBroadcast) {
      return;
    }
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const baseSpawn = position.clone();
    baseSpawn.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    baseSpawn.y += 0.75; // Slightly higher

    const spawns: Vector3[] = this.shouldApplyDualCoilForBow()
      ? (() => {
          const d = getDualCoilLateralVector(direction);
          return [baseSpawn.clone().add(d), baseSpawn.clone().sub(d)];
        })()
      : [baseSpawn];
    
    const bowPrimaryDamage = computeBowPrimaryScaledDamage(
      this.chargeProgress,
      this.bowUnchargedProjectileBaseDamage(),
      this.bowPowershotBaseDamage(),
    );

    // Create projectile using the ProjectileSystem with current weapon config
    const projectileConfig = {
      speed: 25,
      damage: bowPrimaryDamage,
      lifetime: 3,
      maxDistance: 25, // Limit bow arrows to 25 units distance
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0,
      sourcePlayerId: this.playerEntity.userData?.playerId || 'unknown',
      ...(this.shouldApplyStaggerShotTalent() ? { staggerToAdd: STAGGER_SHOT_UNCHARGED_STAGGER } : {}),
      ...(this.bowTriggerFingerUnchargedActive() ? { triggerFingerUncharged: true as const } : {}),
    };
    
    const useDualCoil = this.shouldApplyDualCoilForBow();
    for (let i = 0; i < spawns.length; i++) {
      const spawnPosition = spawns[i];
      this.projectileSystem.createProjectile(
        this.world,
        spawnPosition,
        direction,
        this.playerEntity.id,
        { ...projectileConfig, ...(useDualCoil ? { dualCoilLane: i as 0 | 1 } : {}) }
      );
      if (this.onProjectileCreatedCallback) {
        this.onProjectileCreatedCallback('regular_arrow', spawnPosition, direction, projectileConfig);
      }
    }
  }

  private createBurstProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;

    // Bump before target/broadcast gating so EtherBow muzzle VFX & getTempestBurstShotSeq() still advance
    // when there are no valid targets and no PVP callback (solo / empty world).
    const tempestBurstSeq = ++this.tempestBurstShotSeq;

    // Check if there are any valid targets in the world before creating projectiles
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);
    const validTargets = potentialTargets.filter(target =>
      target.id !== this.playerEntity!.id && // Not the player itself
      !target.getComponent(Health)?.isDead // Not dead
    );

    // In multiplayer mode, only create projectiles if there are valid targets or if we need to broadcast to other players
    const hasValidTargets = validTargets.length > 0;
    const shouldBroadcast = this.onProjectileCreatedCallback !== undefined;

    if (!hasValidTargets && !shouldBroadcast) {
      return;
    }

    const baseSpawn = position.clone();
    baseSpawn.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    baseSpawn.y += 0.75; // Slightly higher

    const spawns: Vector3[] = this.shouldApplyDualCoilForBow()
      ? (() => {
          const d = getDualCoilLateralVector(direction);
          return [baseSpawn.clone().add(d), baseSpawn.clone().sub(d)];
        })()
      : [baseSpawn];

    const tempestTheme = resolveTempestBurstTheme(this.talentLoadout);
    const tempestBurstWrathful = tempestTheme === 'wrathful';
    const tempestBurstArcticChill = tempestTheme === 'arctic';
    const tempestBurstWyvernZombie = shouldApplyWyvernStingTalent(this.talentLoadout);

    const projectileConfig = {
      speed: 35,
      damage: 25, // Burst arrows deal 25 damage each
      lifetime: 3,
      maxDistance: 20,
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0,
      projectileType: 'burst_arrow' as const,
      sourcePlayerId: this.playerEntity.userData?.playerId || 'unknown',
      tempestBurstSeq,
      tempestBurstTheme: tempestTheme,
      ...(tempestBurstWrathful ? { tempestBurstWrathful: true as const } : {}),
      ...(tempestBurstArcticChill ? { tempestBurstArcticChill: true as const } : {}),
      ...(tempestBurstWyvernZombie ? { tempestBurstWyvernZombie: true as const } : {}),
      ...(this.shouldApplyStaggerShotTalent() ? { staggerToAdd: STAGGER_SHOT_TEMPEST_ROUND_STAGGER } : {}),
    };

    const useDualCoil = this.shouldApplyDualCoilForBow();
    for (let i = 0; i < spawns.length; i++) {
      const spawnPosition = spawns[i];
      this.projectileSystem.createProjectile(
        this.world,
        spawnPosition,
        direction,
        this.playerEntity.id,
        { ...projectileConfig, ...(useDualCoil ? { dualCoilLane: i as 0 | 1 } : {}) }
      );
      if (this.onProjectileCreatedCallback) {
        this.onProjectileCreatedCallback('burst_arrow', spawnPosition, direction, projectileConfig);
      }
    }

    this.audioSystem?.playBowReleaseSound(spawns[0]);
  }

  private fireBurstAttack(position: Vector3, direction: Vector3): void {
    // Fire 3 projectiles in rapid succession with small delays
    const currentTime = Date.now() / 1000; // Convert to seconds

    // Fire first projectile immediately
    this.createBurstProjectile(position, direction);

    // Fire second projectile after 0.1 seconds
    this.scheduleAbilityTimeout(() => {
      this.createBurstProjectile(position, direction);
    }, 100);

    // Fire third projectile after 0.2 seconds
    this.scheduleAbilityTimeout(() => {
      this.createBurstProjectile(position, direction);
    }, 200);

    // Update burst fire cooldown
    this.lastBurstFireTime = currentTime;
  }

  private createEntropicBoltProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;

    // Check if there are any valid targets in the world before creating projectiles
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);
    const validTargets = potentialTargets.filter(target =>
      target.id !== this.playerEntity!.id && // Not the player itself
      !target.getComponent(Health)?.isDead // Not dead
    );

    // In multiplayer mode, only create projectiles if there are valid targets or if we need to broadcast to other players
    const hasValidTargets = validTargets.length > 0;
    const shouldBroadcast = this.onProjectileCreatedCallback !== undefined;

    if (!hasValidTargets && !shouldBroadcast) {
      return;
    }

    // Offset spawn forward slightly more so the longer celestial bolt mesh clears the player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1.14));
    spawnPosition.y += 1; // Slightly higher
    
    const wrathEnt = shouldApplyWrathfulEntropicTalent(this.talentLoadout);
    const stagEnt = shouldApplyStaggeringEntropicTalent(this.talentLoadout);
    const infestEnt = shouldApplyInfestingEntropicTalent(this.talentLoadout);
    const arcticEnt = shouldApplyArcticShardsEntropicTalent(this.talentLoadout);

    let boltVariant: {
      colorVariant: typeof DEFAULT_ENTROPIC_COLOR_VARIANT | 'purple' | 'blue' | 'red' | 'green' | 'arctic';
      damage: number;
    };
    let entropicBoltTalent: 'wrathful' | 'staggering' | 'infesting' | 'arctic' | undefined;
    if (wrathEnt) {
      boltVariant = { colorVariant: 'red', damage: 53 };
      entropicBoltTalent = 'wrathful';
    } else if (stagEnt) {
      boltVariant = { colorVariant: 'blue', damage: 47 };
      entropicBoltTalent = 'staggering';
    } else if (infestEnt) {
      boltVariant = { colorVariant: 'green', damage: INFESTING_ENTROPIC_BOLT_DAMAGE };
      entropicBoltTalent = 'infesting';
    } else if (arcticEnt) {
      boltVariant = { colorVariant: 'arctic', damage: ARCTIC_ENTROPIC_BOLT_DAMAGE };
      entropicBoltTalent = 'arctic';
    } else {
      boltVariant = { colorVariant: DEFAULT_ENTROPIC_COLOR_VARIANT, damage: 47 };
    }

    const damage =
      boltVariant.damage +
      getArcaneSynergyEntropicBoltFlatDamageBonus(
        this.talentLoadout,
        this.allocatedPlayerStats.intellect ?? 0,
      );

    const entropicBaseConfig = {
      speed: 20,
      damage,
      piercing: false,
      explosive: false,
      explosionRadius: 0,
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0,
      colorVariant: boltVariant.colorVariant,
      entropicBoltTalent,
      entropicFragmentation: shouldApplyFragmentationTalent(this.talentLoadout, this.abilityLoadout),
      entropicFragmentHop: 0,
      sourcePlayerId: this.playerEntity?.userData?.playerId || 'unknown',
    };

    this.projectileSystem.createEntropicBoltProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      entropicBaseConfig,
    );

    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('entropic_bolt', spawnPosition, direction, entropicBaseConfig);
    }
  }

  private createCrossentropyBoltProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 1; // Slightly higher
    
    const reaper = shouldApplyReaperTalent(this.talentLoadout, this.abilityLoadout);
    const speed = 25;
    const lifetime = 2.5;
    const stackBonus = reaper ? this.reaperCrossentropyStack * CROSSENTROPY_REAPER_DAMAGE_PER_KILL : 0;
    const baseDamage = getCrossentropyBaseDamage(this.talentLoadout, this.abilityLoadout);
    const crossentropyTempest = shouldApplyCrossentropyTempestTalent(this.talentLoadout, this.abilityLoadout);
    const crossentropyPlague = shouldApplyCrossentropyPlagueTalent(this.talentLoadout, this.abilityLoadout);
    const crossentropyGlacial = shouldApplyGlacialStormTalent(this.talentLoadout, this.abilityLoadout);
    const crossentropyMeteor = shouldApplyMeteorTalent(this.talentLoadout, this.abilityLoadout);
    const crossentropyFragmentation = shouldApplyFragmentationTalent(
      this.talentLoadout,
      this.abilityLoadout,
    );

    // Create CrossentropyBolt projectile using the existing method
    const crossentropyConfig = {
      speed,
      damage: baseDamage + stackBonus,
      lifetime,
      ...(reaper
        ? { maxDistance: CROSSENTROPY_MAX_TRAVEL_DISTANCE, reaperCrossentropy: true, piercing: true }
        : { piercing: false }),
      explosive: false, // Disabled explosion effect for performance
      explosionRadius: 0, // No explosion radius
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0,
      sourcePlayerId: this.playerEntity?.userData?.playerId || 'unknown', // CRITICAL FIX: Include sourcePlayerId for proper damage attribution
      infernoCrossentropy: shouldApplyInfernoTalent(this.talentLoadout, this.abilityLoadout),
      crossentropyTempest,
      crossentropyPlague,
      crossentropyGlacial,
      crossentropyMeteor,
      crossentropyFragmentation,
    };
    
    this.projectileSystem.createCrossentropyBoltProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      crossentropyConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('crossentropy_bolt', spawnPosition, direction, crossentropyConfig);
    }
  }

  private performReanimateAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    const currentTime = Date.now() / 1000;
    let isOverrideBypass = false;
    if (currentTime - this.lastReanimateTime < REANIMATE_SUNWELL_COOLDOWN_SEC) {
      if (!this.tryOverrideShieldBypass(currentTime)) return;
      isOverrideBypass = true;
    }
    if (!isOverrideBypass) {
      this.lastReanimateTime = currentTime;
    }
    
    // Play sunwell sound when reanimate is cast
    this.audioSystem?.playScytheSunwellSound(playerTransform.getWorldPosition());

    // Always trigger the visual effect first, regardless of healing success
    this.triggerReanimateEffect(playerTransform);
    
    const healthComponent = this.playerEntity.getComponent(Health);
    if (healthComponent) {
      healthComponent.heal(REANIMATE_SUNWELL_HEAL);
    }

    this.healNearbyAllies(playerTransform, REANIMATE_SUNWELL_HEAL, 5.0);
  }

  /**
   * Solar Recharge talent: same Sunwell outcome as `performReanimateAbility` but does not check or
   * advance Q cooldown (independent of manual Sunwell usage).
   */
  private performReanimateAsSolarRechargeProc(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    this.audioSystem?.playScytheSunwellSound(playerTransform.getWorldPosition());
    this.triggerReanimateEffect(playerTransform);
    const healthComponent = this.playerEntity.getComponent(Health);
    if (healthComponent) {
      healthComponent.heal(REANIMATE_SUNWELL_HEAL);
    }
    this.healNearbyAllies(playerTransform, REANIMATE_SUNWELL_HEAL, 5.0);
  }

  private triggerReanimateEffect(playerTransform: Transform): void {
    // Trigger the visual healing effect

    if (this.onReanimateCallback) {
      this.onReanimateCallback();
    }

    // Create healing damage number above player head
    const playerPosition = playerTransform.position.clone();
    playerPosition.y += 1.5; // Position above player's head

    if (this.onDamageNumbersUpdate) {
      this.onDamageNumbersUpdate([{
        id: this.nextDamageNumberId.toString(),
        damage: REANIMATE_SUNWELL_HEAL,
        position: playerPosition,
        isCritical: false,
        timestamp: Date.now(),
        damageType: 'reanimate_healing'
      }]);
      this.nextDamageNumberId++;
    }
  }

  private healNearbyAllies(playerTransform: Transform, healAmount: number, radius: number): void {
    // Get all entities in the world
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    
    // Get local socket ID to avoid healing ourselves again
    const localSocketId = (window as any).localSocketId;
    const serverPlayerEntities = (window as any).serverPlayerEntities;
    
    if (!serverPlayerEntities || !serverPlayerEntities.current) {
      return; // No multiplayer context
    }
    
    let healedCount = 0;
    
    // Iterate through all entities to find nearby players
    allEntities.forEach(entity => {
      // Skip ourselves
      if (entity === this.playerEntity) return;
      
      const entityTransform = entity.getComponent(Transform);
      const entityHealth = entity.getComponent(Health);
      
      if (!entityTransform || !entityHealth || entityHealth.isDead) return;
      
      // Check if this entity is a player (not an enemy)
      let isPlayer = false;
      let targetPlayerId: string | null = null;
      
      serverPlayerEntities.current.forEach((localEntityId: number, playerId: string) => {
        if (localEntityId === entity.id) {
          isPlayer = true;
          targetPlayerId = playerId;
        }
      });
      
      // Only heal other players, not enemies
      if (!isPlayer || !targetPlayerId) return;
      
      // Check distance
      const distance = playerPosition.distanceTo(entityTransform.position);
      if (distance > radius) return;
      
      // Heal this ally
      const didHeal = entityHealth.heal(healAmount);
      
      if (didHeal) {
        healedCount++;
        
        // Create healing number for this ally
        const allyPosition = entityTransform.position.clone();
        allyPosition.y += 1.5;
        
        if (this.onDamageNumbersUpdate) {
          this.onDamageNumbersUpdate([{
            id: this.nextDamageNumberId.toString(),
            damage: healAmount,
            position: allyPosition,
            isCritical: false,
            timestamp: Date.now(),
            damageType: 'reanimate_healing'
          }]);
          this.nextDamageNumberId++;
        }
        
        // Broadcast healing for this ally with targetPlayerId
        if (this.onBroadcastHealing) {
          this.onBroadcastHealing(healAmount, 'reanimate_ally', allyPosition, targetPlayerId);
        }
        
        console.log(`💚 Reanimate healed ally ${targetPlayerId} for ${healAmount} HP (${distance.toFixed(1)} units away)`);
      }
    });
    
    if (healedCount > 0) {
      console.log(`💚 Reanimate healed ${healedCount} nearby allies!`);
    }
  }

  private performFrostNovaAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFrostNovaTime < this.frostNovaFireRate) {
      return;
    }
    
    this.lastFrostNovaTime = currentTime;

    // Play frost nova sound at the start of the ability
    this.audioSystem?.playFrostNovaSound(playerTransform.position);

    // Get player position and direction
    const playerPosition = playerTransform.getWorldPosition();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Trigger Frost Nova callback for visual effects
    if (this.onFrostNovaCallback) {
      this.onFrostNovaCallback(playerPosition, direction);
    }
    
    // Find all enemies within 5 unit radius and freeze them
    this.freezeEnemiesInRadius(playerPosition, 6.0, currentTime);
    
    // Trigger global frost nova visual effect
    triggerGlobalFrostNova(playerPosition);
  }

  /**
   * Frostpath talent: Coldsnap burst at world position (no SCYTHE_E cooldown).
   * Uses the same freeze radius and networking as `performFrostNovaAbility`, but centered on `impact`.
   */
  private triggerFrostpathAtImpact(impact: Vector3): void {
    if (!this.playerEntity) return;

    const currentTime = Date.now() / 1000;
    this.audioSystem?.playFrostNovaSound(impact);

    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    if (this.onFrostNovaCallback) {
      this.onFrostNovaCallback(impact, direction);
    }

    this.freezeEnemiesInRadius(impact, 6.0, currentTime);
    triggerGlobalFrostNova(impact);
  }

  /**
   * Called from CombatSystem when an Entropic Bolt hits a PvE enemy; rolls proc and attributes to local player projectiles only.
   */
  public tryProcFrostpathOnEntropicHit(target: Entity, projectileSource: Entity): void {
    if (!this.playerEntity) return;
    if (!shouldApplyFrostpathTalent(this.talentLoadout)) return;
    const now = Date.now();
    if (now - this.lastFrostpathProcEffectWallClockMs < FROST_SOLAR_PROC_EFFECT_ICD_MS) return;
    if (Math.random() >= FROSTPATH_PROC_CHANCE) return;

    if (!target.getComponent(Enemy)) return;

    const proj = projectileSource.getComponent(Projectile);
    if (!proj || proj.owner !== this.playerEntity.id) return;

    const targetTransform = target.getComponent(Transform);
    if (!targetTransform) return;

    this.lastFrostpathProcEffectWallClockMs = now;
    this.triggerFrostpathAtImpact(targetTransform.getWorldPosition());
  }

  /**
   * Solar Recharge talent: Sunwell (Reanimate) on Entropic hit vs PvE; roll independent of Q cooldown.
   */
  public tryProcSolarRechargeOnEntropicHit(target: Entity, projectileSource: Entity): void {
    if (!this.playerEntity) return;
    if (!shouldApplySolarRechargeTalent(this.talentLoadout)) return;
    const now = Date.now();
    if (now - this.lastSolarRechargeProcEffectWallClockMs < FROST_SOLAR_PROC_EFFECT_ICD_MS) return;
    if (Math.random() >= SOLAR_RECHARGE_PROC_CHANCE) return;

    if (!target.getComponent(Enemy)) return;

    const proj = projectileSource.getComponent(Projectile);
    if (!proj || proj.owner !== this.playerEntity.id) return;

    const playerTransform = this.playerEntity.getComponent(Transform);
    if (!playerTransform) return;

    this.lastSolarRechargeProcEffectWallClockMs = now;
    this.performReanimateAsSolarRechargeProc(playerTransform);
  }

  private spawnArcticGroundBlizzardAt(worldPosition: Vector3): void {
    spawnArcticGroundBlizzardAtFromReact(worldPosition);
  }

  /** Arctic Shards room boon — 15% proc (roll in ControlSystem; CombatSystem gates talent + owner). */
  public tryProcArcticShardsOnEntropicHit(target: Entity, projectileSource: Entity): void {
    if (!this.playerEntity) return;
    if (!shouldApplyArcticShardsEntropicTalent(this.talentLoadout)) return;
    if (Math.random() >= ARCTIC_SHARDS_PROC_CHANCE) return;
    if (!target.getComponent(Enemy)) return;
    const proj = projectileSource.getComponent(Projectile);
    if (!proj || proj.owner !== this.playerEntity.id) return;
    const tt = target.getComponent(Transform);
    if (!tt) return;
    const p = tt.getWorldPosition().clone();
    p.y = Math.max(1.5, p.y);
    this.spawnArcticGroundBlizzardAt(p);
  }

  /** Glacial Storm — each Crossentropy hit: same concentrated blizzard + 4s coldsnap burst. */
  public applyGlacialStormOnCrossentropyHit(impact: Vector3): void {
    if (!this.playerEntity) return;
    if (!shouldApplyGlacialStormTalent(this.talentLoadout, this.abilityLoadout)) return;
    const p = impact.clone();
    p.y = Math.max(1.5, p.y);
    this.spawnArcticGroundBlizzardAt(p);

    const currentTime = Date.now() / 1000;
    this.audioSystem?.playFrostNovaSound(p);
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    if (this.onFrostNovaCallback) {
      this.onFrostNovaCallback(p, direction);
    }
    this.freezeEnemiesInRadius(p, 6.0, currentTime, 4);
    triggerGlobalFrostNova(p);
  }

  public getPlayerEntity(): Entity | null {
    return this.playerEntity;
  }

  private performCobraShot(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastCobraShotTime < this.cobraShotFireRate) {
      return;
    }

    this.isCobraShotCharging = true;
    this.cobraShotChargeProgress = 0;
    this.lastCobraShotTime = currentTime;

    // Play bow draw sound when starting to charge
    this.audioSystem?.playBowDrawSound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 750; // 0.75 second charge time (between Viper Sting and Barrage)
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.cobraShotChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.cobraShotChargeProgress >= 1.0) {
        this.clearTrackedAbilityInterval(chargeInterval);

        this.fireCobraShot(playerTransform);
        this.isCobraShotCharging = false;
        this.cobraShotChargeProgress = 0;
      }
    }, 16); // ~60fps updates
    this.trackAbilityInterval(chargeInterval);
  }

  /** Shared Cobra Shot emit: BOW_E after charge and Wyvern Sting on perfect shot. */
  private emitCobraShotFromPlayerTransform(playerTransform: Transform): void {
    this.audioSystem?.playCobraShotReleaseSound(playerTransform.position);

    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825; // Shoot from chest level like Viper Sting

    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();

    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();

    const spawnPosition = playerPosition.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward

    if (this.onCobraShotCallback) {
      this.onCobraShotCallback(spawnPosition, direction);
    }

    triggerGlobalCobraShot(spawnPosition, direction);

    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('cobra_shot_projectile', spawnPosition, direction, {
        speed: 20, // Consistent speed for PVP
        damage: 29, // Use consistent damage value
        lifetime: 8,
        venomDuration: 6
      });
    }
  }

  private fireCobraShot(playerTransform: Transform): void {
    this.emitCobraShotFromPlayerTransform(playerTransform);
  }

  private freezeEnemiesInRadius(centerPosition: Vector3, radius: number, currentTime: number, freezeDurationSec = 6): void {
    // Get all entities in the world
    const allEntities = this.world.getAllEntities();
    let frozenCount = 0;
    let damagedPlayers = 0;
    
    // Get local socket ID to prevent self-targeting
    const localSocketId = (window as any).localSocketId;
    
    allEntities.forEach(entity => {
      const entityTransform = entity.getComponent(Transform);
      const entityHealth = entity.getComponent(Health);
      
      if (!entityTransform || !entityHealth || entityHealth.isDead) return;
      
      // Skip self (local player entity)
      if (entity.id === this.playerEntity?.id) return;
      
      const entityPosition = entityTransform.position;
      const distance = centerPosition.distanceTo(entityPosition);
      
      // Check if entity is within freeze radius
      if (distance <= radius) {
        const enemy = entity.getComponent(Enemy);
        
        if (enemy) {
          if (
            entity.userData?.isCoopAlliedUnit ||
            entity.userData?.coopServerEnemyType === 'allied-knight'
          ) {
            return;
          }
          const sk = entity.userData?.coopServerEnemyType as string | undefined;
          // This is an enemy - freeze it (single player mode)
          enemy.freeze(freezeDurationSec, currentTime, sk);
          frozenCount++;

          const freezeMs = capFreezeMsForEnemy(enemy, freezeDurationSec * 1000, sk);
          // Add frozen visual effect for this enemy
          addGlobalFrozenEnemy(entity.id.toString(), entityPosition, freezeMs);

          // Send freeze status to server for multiplayer (co-op mode)
          if (this.onApplyEnemyStatusEffectCallback && entity.userData?.serverEnemyId) {
            this.onApplyEnemyStatusEffectCallback(
              entity.userData.serverEnemyId,
              'freeze',
              freezeMs,
            );
          }
        } else {
          // This is likely another player in PVP mode - deal damage and freeze
          // CRITICAL FIX: First check if this entity represents the local player
          const serverPlayerEntities = (window as any).serverPlayerEntities;
          let targetPlayerId: string | null = null;
          
          if (serverPlayerEntities && serverPlayerEntities.current) {
            serverPlayerEntities.current.forEach((localEntityId: number, playerId: string) => {
              if (localEntityId === entity.id) {
                targetPlayerId = playerId;
              }
            });
          }
          
          // NEVER damage or debuff ourselves
          if (targetPlayerId && targetPlayerId === localSocketId) {
            return; // Skip this entity completely
          }
          
          const combatSystem = this.world.getSystem(CombatSystem);
          if (combatSystem && this.playerEntity && targetPlayerId) {
            const frostNovaDamage = 51; // Frost Nova damage
            combatSystem.queueDamage(entity, frostNovaDamage, this.playerEntity, 'frost_nova', this.playerEntity?.userData?.playerId);
            damagedPlayers++;
            
            // Broadcast freeze effect to the target player so they get frozen on their end
            if (this.onDebuffCallback) {
              this.onDebuffCallback(entity.id, 'frozen', freezeDurationSec * 1000, entityPosition);
            }
          }
        }
      }
    });
    
  }

  private createChargedArrowProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    const baseSpawn = position.clone();
    baseSpawn.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    baseSpawn.y += 0.5; // Slightly higher

    const spawns: Vector3[] = this.shouldApplyDualCoilForBow()
      ? (() => {
          const d = getDualCoilLateralVector(direction);
          return [baseSpawn.clone().add(d), baseSpawn.clone().sub(d)];
        })()
      : [baseSpawn];
    
    const chargedArrowConfig = {
      speed: 35, // Faster than regular arrows (25)
      damage: this.bowPowershotBaseDamage(),
      lifetime: 2, // Longer lifetime than regular arrows (3)
      piercing: true, // Charged arrows can pierce through enemies
      explosive: false, // No explosion, but could add special effects
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0,
      sourcePlayerId: this.playerEntity.userData?.playerId || 'unknown',
      ...(this.shouldApplyStaggerShotTalent() ? { staggerToAdd: STAGGER_SHOT_CHARGED_STAGGER } : {}),
    };
    
    const useDualCoil = this.shouldApplyDualCoilForBow();
    for (let i = 0; i < spawns.length; i++) {
      const spawnPosition = spawns[i];
      this.projectileSystem.createChargedArrowProjectile(
        this.world,
        spawnPosition,
        direction,
        this.playerEntity.id,
        { ...chargedArrowConfig, ...(useDualCoil ? { dualCoilLane: i as 0 | 1 } : {}) }
      );
      if (this.onProjectileCreatedCallback) {
        this.onProjectileCreatedCallback('charged_arrow', spawnPosition, direction, chargedArrowConfig);
      }
    }
  }

  private createPerfectShotProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    const baseSpawn = position.clone();
    baseSpawn.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    baseSpawn.y += 1.0; // Slightly higher

    const spawns: Vector3[] = this.shouldApplyDualCoilForBow()
      ? (() => {
          const d = getDualCoilLateralVector(direction);
          return [baseSpawn.clone().add(d), baseSpawn.clone().sub(d)];
        })()
      : [baseSpawn];

    const volleyId = ++this.perfectShotVolleySerial;
    if (shouldApplyArcticStingTalent(this.talentLoadout)) {
      this.pendingArcticStingVolleyId = volleyId;
    }

    const perfectShotDamage = this.bowPerfectShotBaseDamage();

    const perfectConfig = {
      speed: 40, // Faster than regular charged arrows (35)
      damage: perfectShotDamage,
      lifetime: 6, // Longer lifetime than regular charged arrows (5)
      piercing: true, // Perfect shots can pierce through enemies
      explosive: false, // No explosion, but has special visual effects
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0,
      sourcePlayerId: this.playerEntity.userData?.playerId || 'unknown',
      isPerfectShot: true,
      perfectShotVolleyId: volleyId,
      ...(this.shouldApplyStaggerShotTalent() ? { staggerToAdd: STAGGER_SHOT_PERFECT_STAGGER } : {}),
    };
    
    const useDualCoil = this.shouldApplyDualCoilForBow();
    for (let i = 0; i < spawns.length; i++) {
      const spawnPosition = spawns[i];
      this.projectileSystem.createChargedArrowProjectile(
        this.world,
        spawnPosition,
        direction,
        this.playerEntity.id,
        { ...perfectConfig, ...(useDualCoil ? { dualCoilLane: i as 0 | 1 } : {}) }
      );
      if (this.onProjectileCreatedCallback) {
        this.onProjectileCreatedCallback('perfect_shot', spawnPosition, direction, {
          speed: 40,
          damage: perfectShotDamage,
          lifetime: 6,
          piercing: true,
          subclass: this.currentSubclass,
          level: this.currentLevel,
          opacity: 1.0,
        });
      }
    }

    if (this.shouldApplyWyvernStingForBow()) {
      const now = Date.now() / 1000;
      if (now - this.lastWyvernStingTime >= WYVERN_STING_COOLDOWN_SEC) {
        const playerTransform = this.playerEntity.getComponent(Transform) as Transform | undefined;
        if (playerTransform) {
          this.lastWyvernStingTime = now;
          this.emitCobraShotFromPlayerTransform(playerTransform);
        }
      }
    }
  }

  /** Arctic Sting: first enemy hit per perfect-shot volley may spawn concentrated blizzard (ICD). */
  public tryArcticStingBlizzardOnPerfectShotFirstHit(volleyId: number | undefined, target: Entity): void {
    if (!this.playerEntity || volleyId == null) return;
    if (!shouldApplyArcticStingTalent(this.talentLoadout) || this.currentWeapon !== WeaponType.BOW) return;
    if (this.pendingArcticStingVolleyId !== volleyId) return;
    if (!target.getComponent(Enemy)) return;

    this.pendingArcticStingVolleyId = null;

    const now = Date.now() / 1000;
    if (now - this.lastArcticStingBlizzardTimeSec < ARCTIC_STING_BLIZZARD_ICD_SEC) return;

    const tt = target.getComponent(Transform);
    if (!tt) return;
    const p = tt.getWorldPosition().clone();
    p.y = Math.max(1.5, p.y);
    this.lastArcticStingBlizzardTimeSec = now;
    this.spawnArcticGroundBlizzardAt(p);
  }

  // Methods to configure weapon for testing
  public setWeaponSubclass(subclass: WeaponSubclass): void {
    this.currentSubclass = subclass;
  }

  // Method to set bow release callback
  public setBowReleaseCallback(callback: (finalProgress: number, isPerfectShot?: boolean) => void): void {
    this.onBowReleaseCallback = callback;
  }
  
  
  public setProjectileCreatedCallback(callback: (projectileType: string, position: Vector3, direction: Vector3, config: any) => void): void {
    this.onProjectileCreatedCallback = callback;
  }
  
  public setViperStingCallback(
    callback: (position: Vector3, direction: Vector3, meta?: { explosiveTalons?: boolean }) => void,
  ): void {
    this.onViperStingCallback = callback;
  }

  public setRejuvenatingShotCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onRejuvenatingShotCallback = callback;
  }

  public setBarrageCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onBarrageCallback = callback;
  }

  public setReanimateCallback(callback: () => void): void {
    this.onReanimateCallback = callback;
  }
  
  public setFrostNovaCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onFrostNovaCallback = callback;
  }
  
  public setRoomBoomDashCallback(callback: (payload: RoomBoomDashPayload) => void): void {
    this.onRoomBoomDashCallback = callback;
  }

  public setBloodOrbDashCallback(callback: () => void): void {
    this.onBloodOrbDashCallback = callback;
  }

  public setCobraShotCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onCobraShotCallback = callback;
  }

  public setSummonTotemCallback(callback: (position: Vector3) => void): void {
    this.onSummonTotemCallback = callback;
  }
  
  public setChargeCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onChargeCallback = callback;
  }
  
  public setDeflectCallback(callback: (
    position: Vector3,
    direction: Vector3,
    extra?: { aegisRoomBoon?: boolean },
  ) => void): void {
    this.onDeflectCallback = callback;
  }
  
  public setSkyfallCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onSkyfallCallback = callback;
  }
  
  public setBackstabCallback(callback: (position: Vector3, direction: Vector3, damage: number, isBackstab: boolean) => void): void {
    this.onBackstabCallback = callback;
  }
  
  public setSunderCallback(callback: (position: Vector3, direction: Vector3, damage: number, stackCount: number) => void): void {
    this.onSunderCallback = callback;
  }

  public setSmiteCallback(
    callback: (
      position: Vector3,
      direction: Vector3,
      onDamageDealt?: (totalDamage: number, meta?: { targetsHit: number }) => void,
      meta?: { extraStrikes?: Array<{ position: Vector3; delaySec: number }> },
    ) => void,
  ): void {
    this.onSmiteCallback = callback;
  }

  public setColossusStrikeCallback(callback: (position: Vector3, direction: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => void): void {
    this.onColossusStrikeCallback = callback;
  }

  public setWindShearCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onWindShearCallback = callback;
  }

  // Method to reduce Charge cooldown when WindShear hits a player
  public reduceChargeCooldownFromWindShear(playerId: string): void {
    const currentTime = Date.now() / 1000;
    const timeSinceLastCharge = currentTime - this.lastChargeTime;
    const remainingCooldown = Math.max(0, this.chargeCooldown - timeSinceLastCharge);

    if (remainingCooldown > 0) {
      // Reduce the cooldown by 4 seconds (or to 0 if less than 4 seconds remaining)
      const reductionAmount = Math.min(4.0, remainingCooldown);
      this.lastChargeTime -= reductionAmount; // Move the last charge time back to effectively reduce cooldown
    }
  }

  public setDeathGraspCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onDeathGraspCallback = callback;
  }

  public setWraithStrikeCallback(
    callback: (
      position: Vector3,
      direction: Vector3,
      meta?: {
        wrathfulStrike: boolean;
        infestedStrike: boolean;
        staggeringStrike?: boolean;
        wraithGuard?: boolean;
        breathWeapon?: boolean;
      },
    ) => void,
  ): void {
    this.onWraithStrikeCallback = callback;
  }

  public setWraithStrikeSlashImpactCallback(
    callback:
      | ((
          enemyPosition: Vector3,
          forwardXZ: Vector3,
          meta?: {
            wrathfulStrike?: boolean;
            infestedStrike?: boolean;
            wraithGuard?: boolean;
            staggeringStrike?: boolean;
          },
        ) => void)
      | undefined,
  ): void {
    this.onWraithStrikeSlashImpact = callback;
  }

  public setCreateSabreMistEffectCallback(callback: (position: Vector3) => void): void {
    this.onCreateSabreMistEffectCallback = callback;
  }

  public setStealthCallback(callback: (position: Vector3, isActivating: boolean) => void): void {
    this.onStealthCallback = callback;
  }

  public setBroadcastSabreMistCallback(callback: (position: Vector3, effectType: 'stealth' | 'skyfall') => void): void {
    this.onBroadcastSabreMistCallback = callback;
  }

  public setCreateLocalDebuffCallback(callback: (playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', position: Vector3, duration: number) => void): void {
    this.onCreateLocalDebuffCallback = callback;
  }

  public setHauntedSoulEffectCallback(
    callback: (position: Vector3, wrathfulStrike?: boolean, infestedStrike?: boolean) => void,
  ): void {
    this.onHauntedSoulEffectCallback = callback;
  }

  public setWindShearTornadoCallback(callback: (playerId: string, duration: number) => void): void {
    this.onWindShearTornadoCallback = callback;
  }

  public setBroadcastMeleeAttackCallback(callback: (attackType: string, position: Vector3, comboStep?: number) => void): void {
    this.onBroadcastMeleeAttackCallback = callback;
  }

  public setWhirlwindCallback(callback: (position: Vector3, direction: Vector3, damage: number) => void): void {
    this.onWhirlwindCallback = callback;
  }

  public setThrowSpearCallback(callback: (position: Vector3, direction: Vector3, chargeTime: number) => void): void {
    this.onThrowSpearCallback = callback;
  }

  public setFlurryCallback(callback: (position: Vector3) => void): void {
    this.onFlurryCallback = callback;
  }

  public setFlurryHealingEffectCallback(callback: (position: Vector3) => void): void {
    this.onFlurryHealingEffectCallback = callback;
  }

  public setWhirlwindRadialWaveCallback(callback: (playerId: string, duration: number) => void): void {
    this.onWhirlwindRadialWaveCallback = callback;
  }

  public setLightningStormCallback(callback: (position: Vector3) => void): void {
    this.onLightningStormCallback = callback;
  }

  public setDamageNumbersCallback(callback: (damageNumbers: Array<{
    id: string;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    timestamp: number;
    damageType?: string;
  }>) => void): void {
    this.onDamageNumbersUpdate = callback;
  }

  public setBroadcastHealingCallback(callback: (healingAmount: number, healingType: string, position: Vector3, targetPlayerId?: string) => void): void {
    this.onBroadcastHealing = callback;
  }

  public setDebuffCallback(callback: (targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', duration: number, position: Vector3) => void): void {
    // Store the original callback
    const originalCallback = callback;

    // Create a wrapper callback that also tracks debuffs internally
    this.onDebuffCallback = (targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', duration: number, position: Vector3) => {
      // Track the debuff effect internally for stun detection
      this.trackDebuffEffect(targetEntityId, debuffType, duration);

      // Call the original callback
      if (originalCallback) {
        originalCallback(targetEntityId, debuffType, duration, position);
      }
    };
  }

  public setApplyEnemyStatusEffectCallback(callback: (enemyId: string, effectType: string, duration: number) => void): void {
    this.onApplyEnemyStatusEffectCallback = callback;
  }

  public setLocalSocketId(socketId: string): void {
    this.localSocketId = socketId;
  }

  // Internal method to track debuff effects for stun detection
  private trackDebuffEffect(entityId: number, debuffType: string, duration: number): void {
    const currentTime = Date.now();
    const effect = {
      debuffType,
      startTime: currentTime,
      duration
    };

    // Get existing effects for this entity
    const existingEffects = this.activeDebuffEffects.get(entityId) || [];

    // Add the new effect
    existingEffects.push(effect);

    // Update the map
    this.activeDebuffEffects.set(entityId, existingEffects);

    // Schedule cleanup of expired effect
    this.scheduleAbilityTimeout(() => {
      const currentEffects = this.activeDebuffEffects.get(entityId) || [];
      const filteredEffects = currentEffects.filter(e => e !== effect);
      if (filteredEffects.length === 0) {
        this.activeDebuffEffects.delete(entityId);
      } else {
        this.activeDebuffEffects.set(entityId, filteredEffects);
      }
    }, duration);
  }

  // Method to check if a player/entity is currently stunned or frozen
  private isPlayerStunned(entityId: number): boolean {
    const currentTime = Date.now();
    const effects = this.activeDebuffEffects.get(entityId);

    if (!effects) return false;

    // Check if any active effect is a stun or freeze effect
    return effects.some(effect =>
      (effect.debuffType === 'stunned' || effect.debuffType === 'frozen') &&
      (currentTime - effect.startTime) < effect.duration
    );
  }

  // Method to trigger bow release effects
  private triggerBowReleaseEffects(finalChargeProgress: number): void {
    if (this.onBowReleaseCallback) {
      this.onBowReleaseCallback(finalChargeProgress, isBowPerfectShotProgress(finalChargeProgress));
    }
  }

  public setWeaponLevel(level: number): void {
    this.currentLevel = level;
  }

  public getCurrentWeaponConfig(): { weapon: WeaponType; subclass: WeaponSubclass; level: number } {
    return {
      weapon: this.currentWeapon,
      subclass: this.currentSubclass,
      level: this.currentLevel
    };
  }

  // Getters for weapon state (for UI/rendering)
  public getCurrentWeapon(): WeaponType {
    return this.currentWeapon;
  }

  public getCurrentSubclass(): WeaponSubclass {
    return this.currentSubclass;
  }

  public isWeaponCharging(): boolean {
    return this.isCharging;
  }

  public getChargeProgress(): number {
    return this.chargeProgress;
  }

  public isViperStingChargingActive(): boolean {
    return this.isViperStingCharging;
  }

  public getViperStingChargeProgress(): number {
    return this.viperStingChargeProgress;
  }

  public isBarrageChargingActive(): boolean {
    return this.isBarrageCharging;
  }

  public getBarrageChargeProgress(): number {
    return this.barrageChargeProgress;
  }

  public isCobraShotChargingActive(): boolean {
    return this.isCobraShotCharging;
  }

  public getCobraShotChargeProgress(): number {
    return this.cobraShotChargeProgress;
  }

  public isRejuvenatingShotChargingActive(): boolean {
    return this.isRejuvenatingShotCharging;
  }

  public getRejuvenatingShotChargeProgress(): number {
    return this.rejuvenatingShotChargeProgress;
  }

  public isCrossentropyChargingActive(): boolean {
    return this.isCrossentropyCharging;
  }

  public getCrossentropyChargeProgress(): number {
    return this.crossentropyChargeProgress;
  }

  public isSummonTotemChargingActive(): boolean {
    return this.isSummonTotemCharging;
  }

  public getSummonTotemChargeProgress(): number {
    return this.summonTotemChargeProgress;
  }

  public isWeaponSwinging(): boolean {
    return this.isSwinging;
  }

  // Sword-specific getters
  public getSwordComboStep(): 1 | 2 | 3 {
    return this.swordComboStep;
  }

  /** Runeblade EXECUTIONER: additive base damage for current swing (consumed once per performSwingDamage). */
  public getAndClearRunebladeExecutionerFlatBonus(): number {
    const v = this.runebladeExecutionerFlatBonusPending;
    this.runebladeExecutionerFlatBonusPending = 0;
    return v;
  }

  public isRunebladeCrusaderBuffActive(): boolean {
    if (!shouldApplyCrusaderTalent(this.talentLoadout)) return false;
    if (this.runebladeCrusaderBuffEndMs <= 0) return false;
    return Date.now() < this.runebladeCrusaderBuffEndMs;
  }

  public isRunebladeBlizzardTalentActive(): boolean {
    if (!shouldApplyBlizzardTalent(this.talentLoadout)) return false;
    if (this.runebladeBlizzardEndMs <= 0) return false;
    return Date.now() < this.runebladeBlizzardEndMs;
  }

  public getRunebladeCrusaderLmbFlatBonus(): number {
    if (!this.isRunebladeCrusaderBuffActive()) return 0;
    return CRUSADER_LMB_FLAT_BONUS;
  }

  public isChargeActive(): boolean {
    return this.isSwordCharging;
  }

  public isDeflectActive(): boolean {
    return this.isDeflecting;
  }
  
  public isSkyfallActive(): boolean {
    return this.isSkyfalling;
  }
  
  public isBackstabActive(): boolean {
    return this.isBackstabbing;
  }
  
  public isSunderActive(): boolean {
    return this.isSundering;
  }
  
  public isStealthActive(): boolean {
    return this.isStealthing;
  }
  
  public isPlayerInvisible(): boolean {
    return this.isInvisible;
  }

  public isSmiteActive(): boolean {
    return this.isSmiting;
  }

  /** Vengeance talent: 1 at full HP, up to 3× at 0 HP (+200% extra). */
  public getVengeanceSmiteDamageMultiplier(): number {
    if (!shouldApplyVengeanceSmiteTalent(this.talentLoadout, this.abilityLoadout)) return 1;
    const h = this.playerEntity?.getComponent(Health);
    if (!h || h.maxHealth <= 0) return 1;
    return getVengeanceSmiteOutgoingDamageMultiplier(h.currentHealth, h.maxHealth);
  }

  public isColossusStrikeActive(): boolean {
    return this.isColossusStriking;
  }

  public isWindShearActive(): boolean {
    return this.isWindShearing;
  }

  public isWindShearChargingActive(): boolean {
    return this.isWindShearCharging;
  }

  public getWindShearChargeProgress(): number {
    return this.windShearChargeProgress;
  }

  public isDeathGraspActive(): boolean {
    return this.isDeathGrasping;
  }

  public isWraithStrikeActive(): boolean {
    return this.isWraithStriking;
  }

  public isCorruptedAuraActive(): boolean {
    return this.corruptedAuraActive;
  }

  public isIcebeamActive(): boolean {
    return this.isIcebeaming;
  }

  // Returns true when the scythe is firing Entropic Bolts (LMB held, no IceBeam passive).
  public isEntropicBoltActive(): boolean {
    if (this.currentWeapon !== WeaponType.SCYTHE) return false;
    const weaponSlot: 'primary' | 'secondary' = this.currentWeapon === this.selectedWeapons?.primary ? 'primary' : 'secondary';
    const isIcebeamUnlocked = this.isPassiveAbilityUnlocked('P', WeaponType.SCYTHE, weaponSlot);
    return !isIcebeamUnlocked && this.inputManager.isMouseButtonPressed(0);
  }

  public isWhirlwindChargingActive(): boolean {
    return this.isWhirlwindCharging;
  }

  public getWhirlwindChargeProgress(): number {
    return this.whirlwindChargeProgress;
  }

  public isWhirlwindActive(): boolean {
    return this.isWhirlwinding;
  }

  public isThrowSpearChargingActive(): boolean {
    return this.isThrowSpearCharging;
  }

  public getThrowSpearChargeProgress(): number {
    return this.throwSpearChargeProgress;
  }

  public isThrowSpearReleasingActive(): boolean {
    return this.isThrowSpearReleasing;
  }

  public getIsFlurryActive(): boolean {
    return this.isFlurryActive;
  }

  public setIcebeamStateChangeCallback(callback: (isActive: boolean) => void): void {
    this.onIcebeamStateChangeCallback = callback;
  }

  public forceStopIcebeam(): void {
    if (this.isIcebeaming) {
      this.stopIcebeam();
    }
  }


  private handleSwordInput(playerTransform: Transform): void {
    // Handle sword melee attacks
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isSwordCharging && !this.isDeflecting) {
      this.performSwordMeleeAttack(playerTransform);
    }

    // Q/E/R abilities are now handled by handleLoadoutAbilityKeys via the universal dispatch.

    // Check for combo reset
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSwordAttackTime > this.swordComboResetTime) {
      this.swordComboStep = 1;
    }
  }

  private handleRunebladeInput(playerTransform: Transform): void {
    // Handle runeblade melee attacks
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isSmiting && !this.isDeathGrasping && !this.isWraithStriking && !this.isSwordCharging) {
      this.performRunebladeMeleeAttack(playerTransform);
    }

    // Q/E/R abilities are now handled by handleLoadoutAbilityKeys via the universal dispatch.
    // Corrupted Aura and combo reset are handled below / in updateCrossWeaponStates.

    // Check for combo reset
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSwordAttackTime > this.swordComboResetTime) {
      this.swordComboStep = 1;
    }
  }

  private performSwordMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use sword-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSwordFireTime < this.swordFireRate) {
      return;
    }
    this.lastSwordFireTime = currentTime;
    this.lastSwordAttackTime = currentTime;

    // Play sword swing sound based on current combo step
    this.audioSystem?.playSwordSwingSound(this.swordComboStep, playerTransform.position);

    // Set swinging state - completion will be handled by sword component callback
    // Animation state broadcasting will handle sound synchronization for other players
    this.isSwinging = true;

    // Cone hit preview only — actual damage is applied in Sword.tsx (performSwingDamage) to avoid double hits
    this.performMeleeDamage(playerTransform, false);

    // Note: Swing completion and combo advancement is now handled by onSwordSwingComplete callback
  }

  private performRunebladeMeleeAttack(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    let effectiveFireRate = this.runebladeFireRate;
    if (this.isFlurryActive) {
      effectiveFireRate /= RUNEBLADE_FLURRY_ATTACK_SPEED_FACTOR;
    }
    if (currentTime - this.lastRunebladeFireTime < effectiveFireRate) {
      return;
    }

    if (
      shouldApplyExecutionerTalent(this.talentLoadout) &&
      this.executionerBuffDeadlineMs > 0 &&
      Date.now() < this.executionerBuffDeadlineMs
    ) {
      this.executionerBuffDeadlineMs = 0;
      this.swordComboStep = 3;
      this.runebladeExecutionerFlatBonusPending = getExecutionerFlatDamageBonus(
        getEffectiveStrengthWithTalentBonuses(
          this.allocatedPlayerStats,
          this.talentLoadout,
          this.abilityLoadout,
        ),
      );
    }

    this.lastRunebladeFireTime = currentTime;
    this.lastSwordAttackTime = currentTime;

    // Mortal Strike: every 4th swing fires a bonus arc slash AoE
    if (shouldApplyMortalStrikeTalent(this.talentLoadout)) {
      this.mortalStrikeAttackCount++;
      if (this.mortalStrikeAttackCount >= MORTAL_STRIKE_ATTACK_INTERVAL) {
        this.mortalStrikeAttackCount = 0;
        this.performMortalStrike(playerTransform);
      }
    }

    // Set swinging state - completion will be handled by runeblade component callback
    this.isSwinging = true;

    // Cone hit preview only — actual damage is applied in Runeblade.tsx (performSwingDamage) to avoid double hits
    const enemiesHit = this.performMeleeDamage(playerTransform, false);
    if (enemiesHit > 0) {
      // Hit sound: crit vs non-crit after damage resolves in CombatSystem (sword_swing_1–3 vs runeblade_swing)
      this.world.getSystem(CombatSystem)?.armRunebladeLmbHitSound(
        this.swordComboStep,
        playerTransform.position,
      );
    } else {
      // Missed — play the appropriate miss sound (swordMiss2 on 3rd combo step)
      this.audioSystem?.playRunebladeMissSound(this.swordComboStep, playerTransform.position);
    }

    // Note: Swing completion and combo advancement is now handled by onSwordSwingComplete callback
  }

  private performSmite(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    let isBloodmageBypass = false;
    if (currentTime - this.lastSmiteTime < this.smiteCooldown) {
      if (!this.tryBloodmageDashBypass(currentTime)) return;
      isBloodmageBypass = true;
    }

    // Check if already smiting
    if (this.isSmiting) {
      return;
    }

    if (!isBloodmageBypass) {
      this.lastSmiteTime = currentTime;
    }
    this.isSmiting = true;

    // Play colossus strike sound instead of smite sound
    this.audioSystem?.playColossusStrikeSound(playerTransform.position);

    // Stop player movement immediately when casting Smite
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        playerMovement.velocity.x = 0;
        playerMovement.velocity.z = 0;
        playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      }
    }

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Offset the smite position slightly forward to look like it's coming from the runeblade swing
    const smitePosition = position.clone().add(direction.clone().multiplyScalar(2.5));

    // NOTE: Damage detection is now handled by the Smite visual component
    // to prevent double damage. The visual component's damage detection is more
    // accurate and properly timed with the animation.

    // The healing will be triggered by the visual component's onDamageDealt callback
    // instead of the ControlSystem's performSmiteDamage method.

    let extraStrikes: Array<{ position: Vector3; delaySec: number }> | undefined;
    if (
      this.currentWeapon === WeaponType.RUNEBLADE &&
      computeTrinityTalentActive(this.talentLoadout, this.abilityLoadout) &&
      this.playerEntity
    ) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        const consumed = playerMovement.consumeDashChargesWithoutDash(2, currentTime);
        if (consumed > 0) {
          this.tryManaShieldOnDashChargeExpended(consumed);
          const perp = new Vector3(-direction.z, 0, direction.x);
          if (perp.lengthSq() < 1e-8) perp.set(1, 0, 0);
          else perp.normalize();
          const spread = 0.65;
          extraStrikes = [];
          if (consumed >= 1) {
            extraStrikes.push({
              position: smitePosition.clone().add(perp.clone().multiplyScalar(spread)),
              delaySec: 0.18,
            });
          }
          if (consumed >= 2) {
            extraStrikes.push({
              position: smitePosition.clone().add(perp.clone().multiplyScalar(-spread)),
              delaySec: 0.36,
            });
          }
        }
      }
    }

    if (this.onSmiteCallback) {
      this.onSmiteCallback(
        smitePosition,
        direction,
        (_totalDamage: number, meta?: { targetsHit: number }) => {
          const targetsHit = meta?.targetsHit ?? 0;
          if (targetsHit <= 0) return;
          const infested = computeInfestedSmiteTalentActive(this.talentLoadout, this.abilityLoadout);
          const totalHeal =
            RUNEBLADE_SMITE_BASE_HEAL +
            (infested ? targetsHit * INFESTED_SMITE_HEAL_PER_TARGET : 0);
          this.performSmiteHealingFixedAmount(totalHeal);
        },
        extraStrikes?.length ? { extraStrikes } : undefined,
      );
    }

    const maxStrikeDelaySec = extraStrikes?.length
      ? Math.max(...extraStrikes.map((s) => s.delaySec))
      : 0;
    this.lastSmiteMaxFollowUpDelaySec = maxStrikeDelaySec;

    // Smite VFX ~1s after each strike's gate; TRINITY delays follow-up gates (see `onSmiteComplete`)
    this.scheduleAbilityTimeout(() => {
      this.isSmiting = false;
      this.lastSmiteMaxFollowUpDelaySec = 0;
    }, 1000 + maxStrikeDelaySec * 1000 + 200);
  }

  private performColossusStrike(playerTransform: Transform): void {
    // Check if using Sword
    if (this.currentWeapon !== WeaponType.SWORD) {
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastColossusStrikeTime < this.colossusStrikeCooldown) {
      return; // Still on cooldown
    }

    // Check if already colossus striking
    if (this.isColossusStriking) {
      return;
    }

    const totalDamage = 300;

    this.lastColossusStrikeTime = currentTime;
    this.isColossusStriking = true;

    // Play colossus strike sound at the start of the ability
    this.audioSystem?.playColossusStrikeSound(playerTransform.position);

    // Stop player movement immediately when casting Colossus Strike
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        playerMovement.velocity.x = 0;
        playerMovement.velocity.z = 0;
        playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      }
    }

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Offset the colossus strike position slightly forward to look like it's coming from the sword swing
    const strikePosition = position.clone().add(direction.clone().multiplyScalar(2.5));

    // Trigger colossus strike callback with calculated damage
    if (this.onColossusStrikeCallback) {
      this.onColossusStrikeCallback(strikePosition, direction, totalDamage, (damageDealtFlag: boolean) => {
        // Handle any effects when damage is dealt by the visual component
      });
    }

    // Reset colossus striking state after animation duration (same as the ColossusStrike component)
    this.scheduleAbilityTimeout(() => {
      this.isColossusStriking = false;
    }, 1200); // 1.2 seconds matches the updated animation duration
  }

  private performWindShear(playerTransform: Transform): void {
    // Check if using Sword
    if (this.currentWeapon !== WeaponType.SWORD) {
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastWindShearTime < this.windShearCooldown) {
      return; // Still on cooldown
    }

    // Check if already wind shearing or charging
    if (this.isWindShearing || this.isWindShearCharging) {
      return;
    }

    this.isWindShearCharging = true;
    this.windShearChargeProgress = 0;
    this.lastWindShearTime = currentTime;

    // Play windshear sound for the duration of the charge
    this.audioSystem?.playWindshearSound(playerTransform.position);

    // Trigger tornado effect (1.25 seconds duration)
    if (this.onWindShearTornadoCallback) {
      const playerId = this.localSocketId || 'local'; // Use actual socket ID if available, fallback to 'local'
      this.onWindShearTornadoCallback(playerId, 1250); // 1.25 seconds
    }

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 1000; // 0.75 second charge time

    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.windShearChargeProgress = Math.min(elapsed / chargeDuration, 1.0);

      if (this.windShearChargeProgress >= 1.0) {
        this.clearTrackedAbilityInterval(chargeInterval);
        this.fireWindShear(playerTransform);
        this.isWindShearCharging = false;
        this.windShearChargeProgress = 0;
      }
    }, 16); // ~60fps updates
    this.trackAbilityInterval(chargeInterval);
  }

  private fireWindShear(playerTransform: Transform): void {
    this.isWindShearing = true;

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);

    // Keep direction horizontal (remove Y component to fire on flat plane)
    direction.y = 0;
    direction.normalize();

    // Set position to chest level (player position + 1 unit up)
    const chestLevelPosition = position.clone();
    chestLevelPosition.y += 1.0;

    // Offset the wind shear position slightly forward from chest level
    const shearPosition = chestLevelPosition.add(direction.clone().multiplyScalar(1.5));

    // Trigger wind shear visual effect via callback
    if (this.onWindShearCallback) {
      this.onWindShearCallback(shearPosition, direction);
    }

    // Also create ECS projectile for damage calculations
    this.createWindShearProjectile(shearPosition, direction);

    // Reset the wind shearing state after a short delay
    this.scheduleAbilityTimeout(() => {
      this.isWindShearing = false;
    }, 200); // 200ms delay to prevent spamming
  }

  private performSmiteDamage(smitePosition: Vector3): { damageDealt: boolean; totalDamage: number } {
    if (!this.playerEntity) return { damageDealt: false, totalDamage: 0 };

    const baseSmiteDamage = 165;
    const damageRadius = 3.0; // Small radius around impact location
    let damageDealt = false;
    let totalDamage = 0;

    // Get all entities in the world to check for enemies/players
    const allEntities = this.world.getAllEntities();

    allEntities.forEach(entity => {
      if (entity.id === this.playerEntity?.id) return; // Don't damage self

      const entityTransform = entity.getComponent(Transform);
      const entityHealth = entity.getComponent(Health);

      if (!entityTransform || !entityHealth || entityHealth.isDead) return;

      const distance = smitePosition.distanceTo(entityTransform.position);

      if (distance <= damageRadius) {
        // Entity is within damage radius - calculate actual damage and queue it
        const combatSystem = this.world.getSystem(CombatSystem);
        if (combatSystem && this.playerEntity) {
          // Calculate actual damage with critical hit mechanics (Infernal Smite: +50% crit chance, no crit damage add)
          const infernalSmiteCrit = computeInfernalSmiteTalentActive(this.talentLoadout, this.abilityLoadout);
          const damageResult: DamageResult = infernalSmiteCrit
            ? calculateDamage(baseSmiteDamage, this.currentWeapon, { critChanceAdd: INFERNAL_SMITE_CRIT_CHANCE_ADD })
            : calculateDamage(baseSmiteDamage, this.currentWeapon);
          const actualDamage = damageResult.damage;

          combatSystem.queueDamage(
            entity,
            actualDamage,
            this.playerEntity,
            'smite',
            this.playerEntity?.userData?.playerId,
            damageResult.isCritical,
            undefined,
            computeStaggeringSmiteTalentActive(this.talentLoadout, this.abilityLoadout)
              ? STAGGERING_SMITE_BEAM_STAGGER
              : undefined,
            computeInfestedSmiteTalentActive(this.talentLoadout, this.abilityLoadout),
            infernalSmiteCrit,
          );
          damageDealt = true;
          totalDamage += actualDamage;
        }
      }
    });

    // NOTE: PVP player damage detection is now handled by the Smite visual component
    // to prevent double damage. The visual component properly handles PVP damage
    // through the broadcastPlayerDamage system.

    return { damageDealt, totalDamage };
  }

  /** Runeblade Smite self-heal (base + optional Infested sum); fixed HP via `heal()`. */
  private performSmiteHealingFixedAmount(healAmount: number): void {
    if (!this.playerEntity || healAmount <= 0) {
      return;
    }

    const healthComponent = this.playerEntity.getComponent(Health);
    if (healthComponent) {
      const actualHealingAmount = Math.floor(healAmount);
      const didHeal = healthComponent.heal(actualHealingAmount);

      if (didHeal) {
        const playerTransform = this.playerEntity.getComponent(Transform);
        if (playerTransform && this.onDamageNumbersUpdate) {
          const healingPosition = playerTransform.position.clone();
          healingPosition.y += 1.5;

          this.onDamageNumbersUpdate([{
            id: this.nextDamageNumberId.toString(),
            damage: actualHealingAmount,
            position: healingPosition,
            isCritical: false,
            timestamp: Date.now(),
            damageType: 'smite_healing'
          }]);
          this.nextDamageNumberId++;

          if (this.onBroadcastHealing) {
            this.onBroadcastHealing(actualHealingAmount, 'smite', healingPosition);
          }
        }
      }
    } else {
      try {
        const gameUI = (window as any).gameUI;
        if (gameUI && typeof gameUI.gainHealth === 'function') {
          gameUI.gainHealth(healAmount);
        }
      } catch {
        // ignore
      }
    }
  }

  private performDeathGrasp(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    let isOverrideBypass = false;
    if (currentTime - this.lastDeathGraspTime < this.deathGraspCooldown) {
      if (!this.tryOverrideShieldBypass(currentTime)) return;
      isOverrideBypass = true;
    }

    // Check if already death grasping
    if (this.isDeathGrasping) {
      return;
    }

    if (!isOverrideBypass) {
      this.lastDeathGraspTime = currentTime;
    }
    this.isDeathGrasping = true;

    // Play void grasp sound
    this.audioSystem?.playRunebladeVoidGraspSound(playerTransform.position);

    // Stop player movement immediately when casting Death Grasp
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        playerMovement.velocity.x = 0;
        playerMovement.velocity.z = 0;
        playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      }
    }

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Trigger death grasp callback
    if (this.onDeathGraspCallback) {
      this.onDeathGraspCallback(position, direction);
    }

    // Reset death grasping state after animation duration
    this.scheduleAbilityTimeout(() => {
      this.isDeathGrasping = false;
    }, 1200); // 1.2 seconds matches the animation duration
  }

  private performWraithStrike(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;

    if (this.syncWraithStrikeDoubleStrikeMode()) {
      this.advanceWraithStrikeChargeRecharges(currentTime);
      if (this.wraithStrikeCharges <= 0) {
        return;
      }
    } else if (currentTime - this.lastWraithStrikeTime < this.wraithStrikeCooldown) {
      return;
    }

    // Check if already wraith striking
    if (this.isWraithStriking) {
      return;
    }

    if (this.wraithStrikeDoubleStrikeActive) {
      this.wraithStrikeCharges--;
      if (
        this.wraithStrikeCharges < WRAITH_STRIKE_DOUBLE_STRIKE_MAX_CHARGES &&
        this.wraithStrikeNextChargeAt === null
      ) {
        this.wraithStrikeNextChargeAt = currentTime + this.wraithStrikeCooldown;
      }
    } else {
      this.lastWraithStrikeTime = currentTime;
    }
    this.isWraithStriking = true;

    if (shouldApplySpellbladeTalent(this.talentLoadout, this.abilityLoadout) && this.playerEntity) {
      const shieldComponent = this.playerEntity.getComponent(Shield);
      if (shieldComponent) {
        const newShieldValue = Math.min(
          shieldComponent.maxShield,
          shieldComponent.currentShield + SPELLBLADE_WRAITH_STRIKE_SHIELD_RESTORE,
        );
        shieldComponent.setShield(newShieldValue, shieldComponent.maxShield);
      }
    }

    // Play wraithblade sound
    this.audioSystem?.playRunebladeWraithbladeSound(playerTransform.position);

    // Stop player movement immediately when casting Wraith Strike
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        playerMovement.velocity.x = 0;
        playerMovement.velocity.z = 0;
        playerMovement.setMoveDirection(new Vector3(0, 0, 0), 0);
      }
    }

    // Get player position and direction
    const position = playerTransform.position.clone();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Perform wraith strike damage and apply corrupted debuff
    this.performWraithStrikeDamage(playerTransform);
    if (this.shouldApplyBreathWeaponTalent()) {
      this.scheduleAftershockDetonation(playerTransform);
    }

    // Trigger wraith strike callback
    if (this.onWraithStrikeCallback) {
      this.onWraithStrikeCallback(position, direction, {
        wrathfulStrike: this.shouldApplyWrathStrikeTalent(),
        infestedStrike: this.shouldApplyInfestedStrikeTalent(),
        staggeringStrike: this.shouldApplyStaggeringStrikeTalent(),
        wraithGuard: shouldApplyWraithGuardTalent(this.talentLoadout, this.abilityLoadout),
        breathWeapon: this.shouldApplyBreathWeaponTalent(),
      });
    }

    // Reset wraith striking state after animation duration (same as 2nd swing)
    this.scheduleAbilityTimeout(() => {
      this.isWraithStriking = false;
    }, 750); // 0.75 seconds matches the 2nd swing animation duration
  }

  private performWraithStrikeDamage(playerTransform: Transform): void {
    // Get all entities in the world to check for enemies/players
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    
    // Get player facing direction (camera direction)
    const playerDirection = new Vector3();
    this.camera.getWorldDirection(playerDirection);
    playerDirection.normalize();

    const forwardXZ = playerDirection.clone();
    forwardXZ.y = 0;
    if (forwardXZ.lengthSq() < 1e-8) {
      forwardXZ.set(0, 0, 1);
    } else {
      forwardXZ.normalize();
    }

    const wraithStrikeRange = 5.0; // Same range as melee attacks
    const wraithStrikeAngle = Math.PI / 2; // 90 degree cone
    const wraithStrikeBaseDamage =
      (this.shouldApplyInfestedStrikeTalent() ? 190 : 140) +
      getSpellbladeWraithStrikeFlatDamageBonus(
        this.talentLoadout,
        this.abilityLoadout,
        this.allocatedPlayerStats.intellect,
      );

    let hitCount = 0;
    const currentTime = Date.now() / 1000;

    const wraithStrikeSlashImpactMeta = {
      wrathfulStrike: this.shouldApplyWrathStrikeTalent(),
      infestedStrike: this.shouldApplyInfestedStrikeTalent(),
      wraithGuard: shouldApplyWraithGuardTalent(this.talentLoadout, this.abilityLoadout),
      staggeringStrike: this.shouldApplyStaggeringStrikeTalent(),
    };

    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      
      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      
      // Check if target is in range
      const distance = playerPosition.distanceTo(targetTransform.position);
      if (distance > wraithStrikeRange) continue;
      
      // Check if target is in front of player (cone attack)
      const directionToTarget = new Vector3()
        .subVectors(targetTransform.position, playerPosition)
        .normalize();
      
      const dotProduct = playerDirection.dot(directionToTarget);
      const angleThreshold = Math.cos(wraithStrikeAngle / 2);
      
      if (dotProduct < angleThreshold) continue;
      
      // Apply damage
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        let dmg = wraithStrikeBaseDamage;
        let critPreset: boolean | undefined = undefined;
        if (this.shouldApplyWrathStrikeTalent()) {
          const r = calculateDamage(wraithStrikeBaseDamage, this.getCurrentWeapon(), {
            critChanceAdd: WRATH_STRIKE_CRIT_CHANCE_ADD,
            critDamageMultAdd: WRATH_STRIKE_CRIT_DAMAGE_MULT_ADD,
          });
          dmg = r.damage;
          critPreset = r.isCritical;
        }
        combatSystem.queueDamage(
          entity,
          dmg,
          this.playerEntity!,
          'wraith_strike',
          this.playerEntity?.userData?.playerId,
          critPreset,
          this.shouldApplyInfestedStrikeTalent(),
          this.shouldApplyStaggeringStrikeTalent() ? STAGGERING_STRIKE_WRAITH_STAGGER_ADD : undefined,
        );
        hitCount++;

        this.onWraithStrikeSlashImpact?.(
          targetTransform.position.clone(),
          forwardXZ.clone(),
          wraithStrikeSlashImpactMeta,
        );

        const struckEnemy = entity.getComponent(Enemy);
        if (
          struckEnemy &&
          shouldApplyWraithGuardTalent(this.talentLoadout, this.abilityLoadout) &&
          Math.random() < WRAITH_GUARD_PROC_CHANCE
        ) {
          this.applyWraithGuardEffect(playerTransform);
        }
        
        // Apply Corrupted debuff
        this.applyCorruptedDebuff(entity, targetTransform.position, currentTime);
      }
    }
  }

  /** Aftershock (Breath Weapon): damage at +1s to enemies still inside the forward ground strip (cast-time snapshot zone). */
  private scheduleAftershockDetonation(playerTransform: Transform): void {
    const combatSystem = this.world.getSystem(CombatSystem);
    if (!combatSystem || !this.playerEntity) return;

    const origin = new Vector3(
      playerTransform.position.x,
      0,
      playerTransform.position.z,
    );
    const stripDir = new Vector3();
    this.camera.getWorldDirection(stripDir);
    stripDir.y = 0;
    if (stripDir.lengthSq() < 1e-8) {
      stripDir.set(0, 0, 1);
    } else {
      stripDir.normalize();
    }

    const playerEntity = this.playerEntity;
    const world = this.world;
    const playerId = playerEntity.userData?.playerId;

    const wrathful = this.shouldApplyWrathStrikeTalent();
    const infested = this.shouldApplyInfestedStrikeTalent();
    const staggering = this.shouldApplyStaggeringStrikeTalent();
    const wraithGuard = shouldApplyWraithGuardTalent(this.talentLoadout, this.abilityLoadout);
    const weapon = this.getCurrentWeapon();

    this.scheduleAbilityTimeout(() => {
      const cs = world.getSystem(CombatSystem);
      if (!cs || !playerEntity) return;

      const allEntities = world.getAllEntities();
      for (const entity of allEntities) {
        if (entity === playerEntity) continue;

        const targetHealth = entity.getComponent(Health);
        const targetTransform = entity.getComponent(Transform);
        const targetEnemy = entity.getComponent(Enemy);
        if (!targetHealth || !targetTransform || !targetEnemy || targetHealth.isDead) continue;

        const px = targetTransform.position.x;
        const pz = targetTransform.position.z;
        const ox = origin.x;
        const oz = origin.z;
        const dx = stripDir.x;
        const dz = stripDir.z;

        const wx = px - ox;
        const wz = pz - oz;
        const along = wx * dx + wz * dz;
        if (along < 0 || along > AFTERSHOCK_STRIP_LENGTH) continue;

        const cx = ox + dx * along;
        const cz = oz + dz * along;
        const lateral = Math.hypot(px - cx, pz - cz);
        if (lateral > AFTERSHOCK_STRIP_HALF_WIDTH) continue;

        let damage = BREATH_WEAPON_DAMAGE;
        if (infested) damage += AFTERSHOCK_INFESTED_DAMAGE_BONUS;
        if (wraithGuard) damage += AFTERSHOCK_GUARD_DAMAGE_BONUS;

        let isCritical: boolean | undefined;
        if (wrathful) {
          const r = calculateDamage(damage, weapon, {
            critChanceAdd: AFTERSHOCK_WRATHFUL_CRIT_CHANCE_ADD,
          });
          damage = r.damage;
          isCritical = r.isCritical;
        }

        const staggerToAdd = staggering ? AFTERSHOCK_STAGGERING_STAGGER : undefined;

        cs.queueDamage(
          entity,
          damage,
          playerEntity,
          'breath_weapon',
          playerId,
          isCritical,
          undefined,
          staggerToAdd,
        );
      }
    }, AFTERSHOCK_DETONATION_DELAY_MS);
  }

  private applyCorruptedDebuff(entity: Entity, position: Vector3, currentTime: number): void {
    const enemy = entity.getComponent(Enemy);
    const coopServerType = entity.userData?.coopServerEnemyType as string | undefined;
    if (
      enemy &&
      (enemy.type === EnemyType.BOSS || coopServerType === 'boss-skeleton')
    ) {
      return;
    }

    if (enemy) {
      // This is an enemy - apply corrupted debuff directly
      enemy.applyCorrupted(8.0, currentTime); // 8 second duration
      
      this.triggerHauntedSoulEffect(
        position,
        this.shouldApplyWrathStrikeTalent(),
        this.shouldApplyInfestedStrikeTalent(),
      );
      
      // Send corrupted status to server for multiplayer (co-op mode)
      if (this.onApplyEnemyStatusEffectCallback && entity.userData?.serverEnemyId) {
        this.onApplyEnemyStatusEffectCallback(entity.userData.serverEnemyId, 'corrupted', 8000); // 8 seconds in ms
      }
    } else {
      // This is likely another player in PVP mode - broadcast corrupted debuff
      const localSocketId = (window as any).localSocketId;
      const serverPlayerEntities = (window as any).serverPlayerEntities;
      let targetPlayerId: string | null = null;
      
      if (serverPlayerEntities && serverPlayerEntities.current) {
        serverPlayerEntities.current.forEach((localEntityId: number, playerId: string) => {
          if (localEntityId === entity.id) {
            targetPlayerId = playerId;
          }
        });
      }
      
      // NEVER broadcast debuff to ourselves
      if (targetPlayerId && targetPlayerId !== localSocketId) {
            // Broadcast corrupted effect to the target player
            if (this.onDebuffCallback) {
              this.onDebuffCallback(entity.id, 'corrupted', 8000, position); // 8 seconds in milliseconds
            }
        
        this.triggerHauntedSoulEffect(
          position,
          this.shouldApplyWrathStrikeTalent(),
          this.shouldApplyInfestedStrikeTalent(),
        );
      }
    }
  }

  private triggerHauntedSoulEffect(position: Vector3, wrathfulStrike?: boolean, infestedStrike?: boolean): void {
    if (this.onHauntedSoulEffectCallback) {
      this.onHauntedSoulEffectCallback(position, wrathfulStrike, infestedStrike);
    }
  }

  // Called by sword component when swing animation completes
  public onSwordSwingComplete(): void {
    if (!this.isSwinging) return; // Prevent multiple calls

    // Reset swinging state
    this.isSwinging = false;

    // Advance combo step for next attack
    this.swordComboStep = (this.swordComboStep % 3 + 1) as 1 | 2 | 3;

  }

  // Called by spear component when swing animation completes
  public onSpearSwingComplete(): void {
    if (!this.isSwinging) return; // Prevent multiple calls

    // Reset swinging state
    this.isSwinging = false;
  }

  // Called by runeblade component when smite animation completes
  public onSmiteComplete(): void {
    if (!this.isSmiting) return; // Prevent multiple calls

    // TRINITY follow-up bolts still animating — keep `isSmiting` until `performSmite` timeout
    if (this.lastSmiteMaxFollowUpDelaySec <= 0) {
      this.isSmiting = false;
    }
  }

  // Called by sword component when colossus strike animation completes
  public onColossusStrikeComplete(): void {
    if (!this.isColossusStriking) return; // Prevent multiple calls

    // Reset colossus striking state
    this.isColossusStriking = false;
  }

  // Called by runeblade component when death grasp animation completes
  public onDeathGraspComplete(): void {
    if (!this.isDeathGrasping) return; // Prevent multiple calls

    // Reset death grasping state
    this.isDeathGrasping = false;
  }

  // Called by runeblade component when wraith strike animation completes
  public onWraithStrikeComplete(): void {
    if (!this.isWraithStriking) return; // Prevent multiple calls

    // Reset wraith striking state
    this.isWraithStriking = false;
  }

  // Called by sabres component when backstab animation completes
  public onBackstabComplete(): void {
    if (!this.isBackstabbing) return;

    this.isBackstabbing = false;
  }

  private handleSabresInput(playerTransform: Transform): void {
    // Handle left click for dual sabre attack
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isSkyfalling && !this.isSundering) {
      this.performSabresMeleeAttack(playerTransform);
    }

    // Q/E/R abilities are now handled by handleLoadoutAbilityKeys via the universal dispatch.
    // Ongoing states (Skyfall, Backstab, Sunder, Stealth) are updated by updateCrossWeaponStates.
  }

  private handleSpearInput(playerTransform: Transform): void {
    // Handle left click for spear thrust attack
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isWhirlwindCharging && !this.isWhirlwinding && !this.isThrowSpearCharging) {
      this.performSpearMeleeAttack(playerTransform);
    }

    // Q/E/R abilities are now handled by handleLoadoutAbilityKeys via the universal dispatch.
    // Ongoing states (ThrowSpear, Whirlwind, Flurry) are updated by updateCrossWeaponStates.
  }

  private performSpearMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking
    const currentTime = Date.now() / 1000;

    // Base fire rate
    let effectiveFireRate = this.swordFireRate;

    // Apply Flurry speed boost (halved fire rate)
    if (this.isFlurryActive) {
      effectiveFireRate /= 1.5;
    }

    if (currentTime - this.lastSwordFireTime < effectiveFireRate) {
      return;
    }
    this.lastSwordFireTime = currentTime;

    // Set swinging state - completion will be handled by spear component callback
    this.isSwinging = true;

    // Broadcast melee attack sound in PVP
    this.onBroadcastMeleeAttackCallback?.('spear', playerTransform.position);

    // Perform damage detection and play hit vs miss sound based on result
    const enemiesHit = this.performSpearMeleeDamage(playerTransform);
    if (enemiesHit > 0) {
      this.audioSystem?.playSpearSwingSound(playerTransform.position);
    } else {
      this.audioSystem?.playWeaponMissSound(playerTransform.position);
    }
  }

  private tryWindfuryProcAfterPrimaryHit(playerTransform: Transform): void {
    if (!shouldApplyWindfuryTalent(this.talentLoadout)) return;
    if (Math.random() >= WINDFURY_PROC_CHANCE) return;
    this.applyStormShroudFlurry(playerTransform, 'windfury', Date.now() / 1000);
  }

  private tryCrusaderProcFromRunebladePrimaryHit(playerTransform: Transform): void {
    if (!shouldApplyCrusaderTalent(this.talentLoadout)) return;
    if (Math.random() >= CRUSADER_PROC_CHANCE) return;
    this.runebladeCrusaderBuffEndMs = Date.now() + CRUSADER_DURATION_SEC * 1000;
    this.audioSystem?.playCrusaderProcSound(playerTransform.position);
  }

  private tryBlizzardProcFromRunebladePrimaryHit(_playerTransform: Transform): void {
    if (!shouldApplyBlizzardTalent(this.talentLoadout)) return;
    if (Math.random() >= BLIZZARD_PROC_CHANCE) return;
    const now = Date.now();
    const extendFrom = Math.max(this.runebladeBlizzardEndMs, now);
    this.runebladeBlizzardEndMs = extendFrom + BLIZZARD_DURATION_SEC * 1000;
  }

  private applyFlurryHealingForPrimaryHits(playerTransform: Transform, enemiesHit: number): void {
    if (!this.isFlurryActive || enemiesHit <= 0 || !this.playerEntity) return;
    const totalHealing =
      this.currentWeapon === WeaponType.RUNEBLADE
        ? RUNEBLADE_FLURRY_HEAL_PER_SLASH
        : 15 * enemiesHit;
    const playerHealth = this.playerEntity.getComponent(Health);
    if (!playerHealth) return;
    const didHeal = playerHealth.heal(totalHealing);

    if (didHeal) {
      const healingPosition = playerTransform.position.clone();
      healingPosition.y += 1.5;
      const wallNow = Date.now();

      const showNumbers =
        wallNow - this.lastFlurryHealNumberWallClockMs >= FLURRY_HEAL_NUMBER_MIN_INTERVAL_MS;
      const showFlurryVfx =
        wallNow - this.lastFlurryHealVfxWallClockMs >= FLURRY_HEAL_VFX_MIN_INTERVAL_MS;

      if (showNumbers && this.onDamageNumbersUpdate) {
        this.lastFlurryHealNumberWallClockMs = wallNow;
        this.onDamageNumbersUpdate([{
          id: this.nextDamageNumberId.toString(),
          damage: totalHealing,
          position: healingPosition,
          isCritical: false,
          timestamp: wallNow,
          damageType: 'flurry_healing'
        }]);
        this.nextDamageNumberId++;
      }

      if (showFlurryVfx && this.onFlurryHealingEffectCallback) {
        this.lastFlurryHealVfxWallClockMs = wallNow;
        this.onFlurryHealingEffectCallback(playerTransform.position.clone());
      }

      if (showNumbers && this.onBroadcastHealing) {
        this.onBroadcastHealing(totalHealing, 'flurry', healingPosition);
      }
    }
  }

  private performSpearMeleeDamage(playerTransform: Transform): number {
    // Get all entities in the world to check for enemies
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;

    // Get player facing direction (camera direction)
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();

    // Spear attack parameters - longer range than melee
    const spearRange = 6.75; // Longer range for spear
    const spearAngle = Math.PI / 2; // 60 degree cone

    // Get combat system to apply damage
    const combatSystem = this.world.getSystem(CombatSystem);

    let enemiesHit = 0;

    allEntities.forEach(entity => {
      // Check if entity has enemy component and health
      const enemyTransform = entity.getComponent(Transform);
      const enemyHealth = entity.getComponent(Health);
      if (!enemyTransform || !enemyHealth || entity.id === this.playerEntity?.id) return;

      const enemyPosition = enemyTransform.position;
      const toEnemy = enemyPosition.clone().sub(playerPosition);
      const distance = toEnemy.length();

      // Check if enemy is within range
      if (distance <= spearRange) {
        // Check if enemy is within attack cone
        toEnemy.normalize();
        const angle = direction.angleTo(toEnemy);

        if (angle <= spearAngle / 2) {
          // Enemy is within attack cone - calculate distance-scaled damage
          if (combatSystem && this.playerEntity) {
            // Scale damage based on distance: 30-60 damage (0 to 6.75 units)
            const minDamage = 30;
            const maxDamage = 60;
            const distanceRatio = Math.min(distance / spearRange, 1.0);
            const scaledDamage = minDamage + (distanceRatio * (maxDamage - minDamage));

            // Calculate damage using DamageCalculator to get critical hit information
            const damageResult = calculateDamage(scaledDamage, this.currentWeapon);
            const actualDamage = damageResult.damage;

            // Queue damage through combat system (which will route to multiplayer for enemies)
            combatSystem.queueDamage(entity, actualDamage, this.playerEntity, 'melee', this.playerEntity?.userData?.playerId, damageResult.isCritical);
            enemiesHit++;
          }
        }
      }
    });

    if (enemiesHit > 0) {
      this.tryWindfuryProcAfterPrimaryHit(playerTransform);
    }
    this.applyFlurryHealingForPrimaryHits(playerTransform, enemiesHit);

    return enemiesHit;
  }

  private performWhirlwind(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;

    // Check cooldown
    if (currentTime - this.lastWhirlwindTime < this.whirlwindCooldown) {
      return;
    }

    // Start charging
    this.isWhirlwindCharging = true;
    this.whirlwindChargeProgress = 0;
    this.whirlwindStartTime = currentTime;

    // Play whirlwind charge sound
    this.audioSystem?.playWhirlwindChargeSound(playerTransform.position);
  }

  private updateWhirlwindCharging(playerTransform: Transform, currentTime: number): void {
    const maxChargeTime = 2.5; // Max 2 seconds charge
    const chargeTime = currentTime - this.whirlwindStartTime;
    
    // Update charge progress (0 to 1)
    this.whirlwindChargeProgress = Math.min(chargeTime / maxChargeTime, 1.0);

    // Check if E key is released or max charge reached
    if (!this.inputManager.isKeyPressed('e') || this.whirlwindChargeProgress >= 1.0) {
      // Release and execute Whirlwind
      this.executeWhirlwind(playerTransform, currentTime);
    }
  }

  private executeWhirlwind(playerTransform: Transform, currentTime: number): void {
    // Stop charging
    this.isWhirlwindCharging = false;

    // Calculate damage based on charge progress (50 to 200)
    const minDamage = 100;
    const maxDamage = 400;
    const chargeDamage = minDamage + (maxDamage - minDamage) * this.whirlwindChargeProgress;

    // Start spinning
    this.isWhirlwinding = true;
    this.whirlwindStartTime = currentTime;
    this.lastWhirlwindTime = currentTime;

    // Trigger radial wave effect during active whirlwind phase
    if (this.onWhirlwindRadialWaveCallback) {
      console.log('🌪️ Calling onWhirlwindRadialWaveCallback for Whirlwind');
      this.onWhirlwindRadialWaveCallback(this.localSocketId || 'local', this.whirlwindDuration * 1000);
    }

    // Get camera direction for attack
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    // Trigger visual effect callback
    if (this.onWhirlwindCallback) {
      this.onWhirlwindCallback(playerTransform.position.clone(), direction, chargeDamage);
    }

    // Stop charge sound and play release sound
    this.audioSystem?.stopSound('whirlwind_charge');
    this.audioSystem?.playWhirlwindReleaseSound(playerTransform.position);

    // Apply damage to all enemies in range immediately
    this.performWhirlwindDamage(playerTransform, chargeDamage);
  }

  private performWhirlwindDamage(playerTransform: Transform, baseDamage: number): void {
    // Get all entities that could be damaged
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    const whirlwindRadius = 4.5; // 3.5 unit radius for damage

    // Get combat system
    const combatSystem = this.world.getSystem(CombatSystem);
    if (!combatSystem) return;

    let enemiesHit = 0;

    allEntities.forEach(entity => {
      // Check if entity has enemy component and health
      const enemyTransform = entity.getComponent(Transform);
      const enemyHealth = entity.getComponent(Health);
      if (!enemyTransform || !enemyHealth || entity.id === this.playerEntity?.id) return;

      const enemyPosition = enemyTransform.position;
      const distance = playerPosition.distanceTo(enemyPosition);

      // Check if enemy is within Whirlwind radius
      if (distance <= whirlwindRadius) {
        // Calculate damage with critical hits
        const damageResult = calculateDamage(baseDamage, this.currentWeapon);
        const actualDamage = damageResult.damage;

        // Queue damage through combat system
        combatSystem.queueDamage(
          entity,
          actualDamage,
          this.playerEntity || undefined,
          'whirlwind',
          this.playerEntity?.userData?.playerId,
          damageResult.isCritical
        );
        enemiesHit++;
      }
    });

    // Log hits for debugging
    if (enemiesHit > 0) {
      console.log(`Whirlwind hit ${enemiesHit} enemies for ${baseDamage} base damage each`);
    }
  }

  private updateWhirlwindSpinning(currentTime: number): void {
    // Check if spinning animation is complete
    if (currentTime - this.whirlwindStartTime >= this.whirlwindDuration) {
      this.isWhirlwinding = false;
      this.whirlwindChargeProgress = 0;
    }
  }

  public onWhirlwindComplete(): void {
    this.isWhirlwinding = false;
    this.whirlwindChargeProgress = 0;
  }

  private performThrowSpear(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;

    console.log('🎯 performThrowSpear called!');

    // Check cooldown
    if (currentTime - this.lastThrowSpearTime < this.throwSpearCooldown) {
      console.log('🎯 Throw Spear on cooldown');
      return;
    }

    console.log('🎯 Starting Throw Spear charge');

    // Start charging
    this.isThrowSpearCharging = true;
    this.throwSpearChargeProgress = 0;
    this.throwSpearChargeStartTime = currentTime;
    this.whirlwindStartTime = currentTime; // Reuse whirlwindStartTime for charge tracking

    // Play throw spear charge sound
    this.audioSystem?.playThrowSpearChargeSound(playerTransform.position);
  }

  private updateThrowSpearCharging(playerTransform: Transform, currentTime: number): void {
    const maxChargeTime = 2.0; // Max 2 seconds charge
    const chargeTime = currentTime - this.whirlwindStartTime;
    
    // Update charge progress (0 to 1)
    this.throwSpearChargeProgress = Math.min(chargeTime / maxChargeTime, 1.0);

    // Check if Q key is released or max charge reached
    // Check if we should execute: key released AND minimum hold time (0.5s) passed, OR fully charged
    const minHoldTime = 0.5; // Minimum 0.5 seconds hold time
    const hasMinHoldTime = (currentTime - this.throwSpearChargeStartTime) >= minHoldTime;

    if ((!this.inputManager.isKeyPressed('q') && hasMinHoldTime) || this.throwSpearChargeProgress >= 1.0) {
      // Release and execute Throw Spear (if minimum hold time met or fully charged)
      this.executeThrowSpear(playerTransform, currentTime);
    }
  }

  private executeThrowSpear(playerTransform: Transform, currentTime: number): void {
    console.log('🎯 executeThrowSpear called!');

    // Stop charging and start release animation
    this.isThrowSpearCharging = false;
    this.isThrowSpearReleasing = true;
    this.throwSpearReleaseTime = currentTime;

    // Stop charge sound and play release sound
    this.audioSystem?.stopSound('throw_spear_charge');
    this.audioSystem?.playThrowSpearReleaseSound(playerTransform.position);

    // Calculate charge time (0 to 2 seconds)
    const chargeTime = this.throwSpearChargeProgress * 2.0;

    console.log('🎯 Executing throw with charge time:', chargeTime);

    // Update last throw time
    this.lastThrowSpearTime = currentTime;

    // Get camera direction for throw (projected onto horizontal plane)
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.y = 0; // Zero out vertical component to throw horizontally
    direction.normalize();

    console.log('🎯 Direction (horizontal):', direction.toArray());

    // Play throw sound
    this.audioSystem?.playSwordSwingSound?.(1, playerTransform.position);

    // Trigger the throw spear callback if set
    if (this.onThrowSpearCallback) {
      console.log('🎯 Calling onThrowSpearCallback');
      this.onThrowSpearCallback(
        playerTransform.position.clone(),
        direction,
        chargeTime
      );
    } else {
      console.log('🎯 ERROR: onThrowSpearCallback is not set!');
    }

    // Reset charge progress
    this.throwSpearChargeProgress = 0;
    this.throwSpearChargeStartTime = 0;
  }

  /**
   * Storm Shroud (Flurry) — shared by SPEAR F and Windfury talent proc.
   * Ability key sets F cooldown; Windfury never touches `lastFlurryTime`.
   */
  private applyStormShroudFlurry(
    playerTransform: Transform,
    source: 'ability' | 'windfury',
    currentTime: number
  ): void {
    if (source === 'windfury') {
      if (this.isFlurryActive) {
        this.flurryStartTime = currentTime;
        return;
      }
      this.isFlurryActive = true;
      this.flurryStartTime = currentTime;
    } else {
      this.isFlurryActive = true;
      this.flurryStartTime = currentTime;
      this.lastFlurryTime = currentTime;
    }

    this.audioSystem?.playFlurrySound(playerTransform.position);

    if (this.onWindShearTornadoCallback) {
      this.onWindShearTornadoCallback(this.localSocketId || 'local', this.flurryDuration * 1000);
    }

    if (this.onFlurryCallback) {
      this.onFlurryCallback(playerTransform.position.clone());
    }
  }

  private performFlurry(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;

    if (currentTime - this.lastFlurryTime < this.flurryCooldown) {
      return;
    }

    this.applyStormShroudFlurry(playerTransform, 'ability', currentTime);
  }

  private performLightningStorm(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;

    console.log('⚡ performLightningStorm called!');

    // Check cooldown
    if (currentTime - this.lastLightningStormTime < this.lightningStormCooldown) {
      console.log('⚡ Lightning Storm on cooldown');
      return;
    }

    console.log('⚡ Activating Lightning Storm!');

    // Update cooldown
    this.lastLightningStormTime = currentTime;

    // Trigger the Lightning Storm callback if set
    if (this.onLightningStormCallback) {
      console.log('⚡ Calling onLightningStormCallback');
      this.onLightningStormCallback(playerTransform.position.clone());
    } else {
      console.log('⚡ onLightningStormCallback is not set');
    }
  }

  private performRaiseDead(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastRaiseDeadTime < RAISE_DEAD_COOLDOWN_SEC) return;
    this.lastRaiseDeadTime = currentTime;
    window.dispatchEvent(new CustomEvent('character-ability-cast'));
    window.dispatchEvent(
      new CustomEvent('raise-dead-ability', {
        detail: {
          position: {
            x: playerTransform.position.x,
            y: playerTransform.position.y,
            z: playerTransform.position.z,
          },
        },
      }),
    );
  }

  private performMeteorStrike(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastMeteorStrikeTime < METEOR_STRIKE_COOLDOWN_SEC) return;
    this.lastMeteorStrikeTime = currentTime;
    window.dispatchEvent(new CustomEvent('character-ability-cast'));
    window.dispatchEvent(
      new CustomEvent('meteor-strike-ability', {
        detail: {
          position: {
            x: playerTransform.position.x,
            y: playerTransform.position.y,
            z: playerTransform.position.z,
          },
        },
      }),
    );
  }

  private updateFlurryState(currentTime: number): void {
    // Check if Flurry duration has expired
    if (currentTime - this.flurryStartTime >= this.flurryDuration) {
      console.log('⚔️ Flurry duration expired, deactivating');
      this.isFlurryActive = false;
    }
  }

  public onFlurryComplete(): void {
    this.isFlurryActive = false;
  }

  private performSabresMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use sabres-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSabresFireTime < this.sabresFireRate) {
      return;
    }
    this.lastSabresFireTime = currentTime;

    // Crescent Blades: every 3rd swing fires a bonus crescent slash AoE
    if (shouldApplyCrescentBladesTalent(this.talentLoadout)) {
      this.crescentBladesAttackCount++;
      if (this.crescentBladesAttackCount >= 3) {
        this.crescentBladesAttackCount = 0;
        this.performCrescentSlash(playerTransform);
      }
    }

    // Wind Shear talent: every swing fires a forward wind slash projectile (first hit, non-piercing)
    if (shouldApplyWindShearTalent(this.talentLoadout)) {
      this.performSabresWindShearTalent(playerTransform);
    }

    // Set swinging state - completion will be handled by sabres component callback
    this.isSwinging = true;

    // Perform melee damage and play hit vs miss sound based on result
    const enemiesHit = this.performSabresMeleeDamage(playerTransform);
    if (enemiesHit > 0) {
      this.audioSystem?.playSabresSwingSound(playerTransform.position);
    } else {
      this.audioSystem?.playWeaponMissSound(playerTransform.position);
    }
  }

  // Called by sabres component when swing animation completes
  public onSabresSwingComplete(): void {
    if (!this.isSwinging) return; // Prevent multiple calls

    // Reset swinging state
    this.isSwinging = false;
  }

  /** Crescent Blades — wide-arc 150-damage slash fired on every 3rd LMB swing. */
  private performCrescentSlash(playerTransform: Transform): void {
    const attackRange = 4;
    const attackAngle = Math.PI / 2;
    const crescentDamage = 150;

    const attackDirection = new Vector3();
    this.camera.getWorldDirection(attackDirection);
    attackDirection.normalize();

    const allEntities = this.world.getAllEntities();
    const potentialTargets = allEntities.filter(entity =>
      entity.hasComponent(Health) &&
      entity.hasComponent(Transform) &&
      entity !== this.playerEntity
    );

    const combatSystem = this.world.getSystem(CombatSystem);
    const pid = this.playerEntity?.userData?.playerId;

    for (const target of potentialTargets) {
      const targetTransform = target.getComponent(Transform);
      const targetHealth = target.getComponent(Health);
      if (!targetTransform || !targetHealth || targetHealth.isDead) continue;

      const directionToTarget = targetTransform.position.clone().sub(playerTransform.position);
      if (directionToTarget.length() > attackRange) continue;

      directionToTarget.normalize();
      const dotProduct = attackDirection.dot(directionToTarget);
      const angleToTarget = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
      if (angleToTarget > attackAngle / 2) continue;

      if (combatSystem) {
        combatSystem.queueDamage(
          target,
          crescentDamage,
          this.playerEntity || undefined,
          'crescent_slash',
          pid,
        );
      }
    }

    if (combatSystem) {
      combatSystem.addCrescentSlashEffect(playerTransform.position, attackDirection);
    }

    this.audioSystem?.playSabresSwingSound(playerTransform.position);
  }

  /** Mortal Strike — wide-arc bonus slash fired on every 4th Runeblade LMB swing. */
  private performMortalStrike(playerTransform: Transform): void {
    const bundle = resolveMortalStrikeDamageBundle(this.talentLoadout);
    const attackRange = MORTAL_STRIKE_RANGE;
    const attackAngle = MORTAL_STRIKE_ARC_ANGLE;

    const attackDirection = new Vector3();
    this.camera.getWorldDirection(attackDirection);
    attackDirection.y = 0;
    if (attackDirection.lengthSq() < 1e-8) {
      attackDirection.set(0, 0, -1);
    } else {
      attackDirection.normalize();
    }

    const allEntities = this.world.getAllEntities();
    const potentialTargets = allEntities.filter(entity =>
      entity.hasComponent(Health) &&
      entity.hasComponent(Transform) &&
      entity !== this.playerEntity
    );

    const combatSystem = this.world.getSystem(CombatSystem);
    const pid = this.playerEntity?.userData?.playerId;

    for (const target of potentialTargets) {
      const targetTransform = target.getComponent(Transform);
      const targetHealth = target.getComponent(Health);
      if (!targetTransform || !targetHealth || targetHealth.isDead) continue;

      const directionToTarget = targetTransform.position.clone().sub(playerTransform.position);
      if (directionToTarget.length() > attackRange) continue;

      directionToTarget.normalize();
      const dotProduct = attackDirection.dot(directionToTarget);
      const angleToTarget = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
      if (angleToTarget > attackAngle / 2) continue;

      if (combatSystem) {
        let finalDamage = bundle.baseDamage;
        let isCritical = false;
        if (bundle.critChanceAdd != null) {
          const r = calculateDamage(bundle.baseDamage, WeaponType.RUNEBLADE, {
            critChanceAdd: bundle.critChanceAdd,
          });
          finalDamage = r.damage;
          isCritical = r.isCritical;
        }

        combatSystem.queueDamage(
          target,
          finalDamage,
          this.playerEntity || undefined,
          'mortal_strike',
          pid,
          isCritical,
          undefined,
          bundle.staggerToAdd,
          undefined,
          undefined,
          undefined,
          undefined,
          bundle.infestedCombo ? true : undefined,
        );
      }
    }

    if (combatSystem) {
      combatSystem.addMortalStrikeEffect(
        playerTransform.position,
        attackDirection,
        bundle.theme,
      );
    }

    this.audioSystem?.playRunebladeSwingHitSound(playerTransform.position);
  }

  /** Wind Shear talent — fires a pair of wind slash projectiles on every Sabres LMB swing.
   *  Both travel straight forward; only the crescent visual is rolled diagonally in opposing
   *  directions so the pair reads as right-hand and left-hand swings. The second is launched
   *  0.1s after the first. Non-piercing; each stops on first hit. */
  private performSabresWindShearTalent(playerTransform: Transform): void {
    if (!this.playerEntity) return;

    // Roll applied to the crescent visual so the pair leans diagonally, opposing each other.
    const diagonalRoll = Math.PI / 5; // ~36 degrees

    // Fire the right-hand slash immediately, then the left-hand slash 0.1s later.
    this.fireSabresWindShearProjectile(playerTransform, -diagonalRoll);
    this.scheduleAbilityTimeout(() => {
      this.fireSabresWindShearProjectile(playerTransform, diagonalRoll);
    }, 100);
  }

  /** Spawns a single Wind Shear talent projectile traveling forward, with `roll` (radians) applied to its visual. */
  private fireSabresWindShearProjectile(playerTransform: Transform, roll: number): void {
    if (!this.playerEntity) return;

    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825;

    const dir = new Vector3();
    this.camera.getWorldDirection(dir);

    // Slight downward compensation identical to Fan of Knives so the projectile tracks
    // enemies at ground level rather than flying over their heads.
    const compensationAngle = Math.PI / 6;
    const cameraRight = new Vector3();
    cameraRight.crossVectors(dir, new Vector3(0, 1, 0)).normalize();
    const rotationMatrix = new Matrix4().makeRotationAxis(cameraRight, compensationAngle);
    dir.applyMatrix4(rotationMatrix).normalize();

    const spawnPosition = playerPosition.clone().add(dir.clone().multiplyScalar(1));

    const projectileConfig = {
      speed: WIND_SHEAR_PROJECTILE_SPEED,
      damage: getWindShearProjectileDamage(
        this.allocatedPlayerStats,
        this.talentLoadout,
        this.abilityLoadout,
      ),
      lifetime: WIND_SHEAR_PROJECTILE_LIFETIME_SEC,
      maxDistance: WIND_SHEAR_MAX_DISTANCE_UNITS,
      piercing: false,
      projectileType: 'wind_shear',
      subclass: this.currentSubclass,
      level: 1,
      opacity: 1,
      sourcePlayerId: this.playerEntity?.userData?.playerId || 'unknown',
    };

    const projectileEntity = this.projectileSystem.createProjectile(
      this.world,
      spawnPosition,
      dir,
      this.playerEntity.id,
      projectileConfig,
    );

    const renderer = projectileEntity.getComponent(Renderer) as Renderer;
    if (renderer?.mesh) {
      renderer.mesh.userData.isWindShearProjectile = true;
      renderer.mesh.userData.windShearRoll = roll;
    }

    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback(
        'wind_shear_projectile',
        spawnPosition,
        dir,
        projectileConfig,
      );
    }
  }

  private performSabresMeleeDamage(playerTransform: Transform): number {
    const currentTime = Date.now() / 1000;

    // Get all entities that could be damaged
    const allEntities = this.world.getAllEntities();
    const potentialTargets = allEntities.filter(entity =>
      entity.hasComponent(Health) &&
      entity.hasComponent(Transform) &&
      entity !== this.playerEntity
    );

    // SABRES DAMAGE
    const attackRange = 4;
    const attackAngle = Math.PI / 2;

    // Base damage values
    let leftSabreDamage = 23;
    let rightSabreDamage = 29;

    const wrathSabreSwipes = shouldApplyWrathfulSabresSwipesTalent(this.talentLoadout);
    const infestSabreSwipes = shouldApplyInfestingSabresSwipesTalent(this.talentLoadout);
    const stagSwipeLine = this.shouldApplyStaggeringSwipesTalent();
    const useStaggerSabreBlades = stagSwipeLine && !(wrathSabreSwipes || infestSabreSwipes);

    if (!this.isStealthing && infestSabreSwipes) {
      leftSabreDamage = INFESTING_SABRES_SWIPES_LEFT_DAMAGE;
      rightSabreDamage = INFESTING_SABRES_SWIPES_RIGHT_DAMAGE;
    }

    // Apply stealth damage bonus (5 second duration)
    if (this.isStealthing) {
      leftSabreDamage = 43;  // Increased from 19 to 31
      rightSabreDamage = 57; // Increased from 23 to 41
    }
    
    // Get camera direction for attack direction
    const attackDirection = new Vector3();
    this.camera.getWorldDirection(attackDirection);
    attackDirection.normalize();
    
    let hitCount = 0;
    
    for (const target of potentialTargets) {
      const targetTransform = target.getComponent(Transform);
      const targetHealth = target.getComponent(Health);
      
      if (!targetTransform || !targetHealth || targetHealth.isDead) continue;
      
      // Calculate direction to target
      const directionToTarget = targetTransform.position.clone().sub(playerTransform.position);
      const distanceToTarget = directionToTarget.length();
      
      // Check if target is within range
      if (distanceToTarget > attackRange) continue;
      
      // Check if target is within attack cone
      directionToTarget.normalize();
      const dotProduct = attackDirection.dot(directionToTarget);
      const angleToTarget = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
      
      if (angleToTarget > attackAngle / 2) continue;
      
      // Target is within range and cone - apply damage from both sabres
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        const leftStagger = useStaggerSabreBlades ? STAGGERING_SWIPES_LEFT_BLADE_STAGGER : undefined;
        const rightStagger = useStaggerSabreBlades ? STAGGERING_SWIPES_RIGHT_BLADE_STAGGER : undefined;
        const pid = this.playerEntity?.userData?.playerId;
        // Left sabre hit (immediate)
        combatSystem.queueDamage(
          target,
          leftSabreDamage,
          this.playerEntity || undefined,
          'sabre_left',
          pid,
          undefined,
          undefined,
          leftStagger,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          wrathSabreSwipes,
          infestSabreSwipes,
        );

        this.tryGuardSabresSwipesBladeProc(playerTransform);
        this.tryPsionicBladesProc(target, attackDirection, 'left');

        // Right sabre hit (with small delay)
        this.scheduleAbilityTimeout(() => {
          if (!targetHealth.isDead) {
            combatSystem.queueDamage(
              target,
              rightSabreDamage,
              this.playerEntity || undefined,
              'sabre_right',
              pid,
              undefined,
              undefined,
              rightStagger,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              undefined,
              wrathSabreSwipes,
              infestSabreSwipes,
            );
            this.tryGuardSabresSwipesBladeProc(playerTransform);
            this.tryPsionicBladesProc(target, attackDirection, 'right');
          }
        }, 100); // 100ms delay between sabre hits

        hitCount++;
      }
    }

    return hitCount;
  }

  // Skyfall ability implementation
  private performSkyfall(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Check cooldown
    if (currentTime - this.lastSkyfallTime < this.skyfallCooldown) {
      return;
    }
    
    // Start Skyfall
    this.isSkyfalling = true;
    this.skyfallPhase = 'ascending';
    this.skyfallStartTime = currentTime;
    this.lastSkyfallTime = currentTime;
    this.skyfallStartPosition.copy(playerTransform.position);

    // Play skyfall sound
    this.audioSystem?.playSabresSkyfallSound(playerTransform.position);

    // Set target height (double jump height)
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (playerMovement) {
      this.skyfallOriginalGravity = playerMovement.gravity;
      this.skyfallTargetHeight = playerTransform.position.y + (playerMovement.jumpForce * 1.4); // Reduced height by 30% (was 2x, now 1.4x)
            
      // Apply upward velocity
      playerMovement.velocity.y = playerMovement.jumpForce * 2.0; // Stronger initial velocity
      playerMovement.gravity = 0; // Disable gravity during ascent
      // Don't disable canMove as it prevents all physics updates including gravity
      // Instead we'll control horizontal movement in the ControlSystem
    }

    
    // Trigger callback for multiplayer/visual effects
    if (this.onSkyfallCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      this.onSkyfallCallback(playerTransform.position, direction);
    }

    // Create Sabre Reaper Mist effect at player position
    if (this.onCreateSabreMistEffectCallback) {
      this.onCreateSabreMistEffectCallback(playerTransform.position.clone());
    } 
    // Broadcast mist effect to other players in PVP
    if (this.onBroadcastSabreMistCallback) {
      this.onBroadcastSabreMistCallback(playerTransform.position.clone(), 'skyfall');
    }
  }
  
  private updateSkyfallMovement(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (!playerMovement) return;
    
    const elapsedTime = currentTime - this.skyfallStartTime;
    

    
    switch (this.skyfallPhase) {
      case 'ascending':
        // Check if we've reached target height or started falling
        if (playerTransform.position.y >= this.skyfallTargetHeight || playerMovement.velocity.y <= 0) {
          this.skyfallPhase = 'descending';
          playerMovement.velocity.y = 0; // Stop at peak
          playerMovement.gravity = this.skyfallOriginalGravity * 30; // Faster descent
        }
        break;
        
      case 'descending':
        // Check if we've landed (close to original height or on ground)
        if (playerTransform.position.y <= this.skyfallStartPosition.y + 0.5) {
          this.skyfallPhase = 'landing';
          this.performSkyfallLanding(playerTransform);
        }
        break;
        
      case 'landing':
        // Landing phase complete
        this.completeSkyfallAbility(playerTransform);
        break;
    }
    
    // Safety timeout (end after 5 seconds)
    if (elapsedTime > 4.0) {
      this.completeSkyfallAbility(playerTransform);
    }
  }
  
  private performSkyfallLanding(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000; // Define currentTime for stun effects

    // Deal damage to enemies in landing area
    const allEntities = this.world.getAllEntities();
    const landingPosition = playerTransform.position;
    const damageRadius = 4.0; // 4 unit radius
    const skyfallDamage = 125; // SKYFALL DAMAGE

    let hitCount = 0;
    
    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      
      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      
      // Check distance to landing position
      const distanceToLanding = landingPosition.distanceTo(targetTransform.position);
      
      if (distanceToLanding <= damageRadius) {
        // Apply Skyfall damage
        const combatSystem = this.world.getSystem(CombatSystem);
        if (combatSystem) {
          combatSystem.queueDamage(entity, skyfallDamage, this.playerEntity || undefined, 'skyfall', this.playerEntity?.userData?.playerId);
          hitCount++;

          // Apply stun effect (2 seconds) to enemies hit by Skyfall
          const enemy = entity.getComponent(Enemy);
          if (enemy) {
            // Apply stun to enemy component for immediate movement and rotation stop
            enemy.stun(2.0, currentTime); // 2 second stun using stun mechanics

            // Add visual stun effect (different from freeze) - 2 second duration for Skyfall
            addGlobalStunnedEnemy(entity.id.toString(), targetTransform.position, 2000);

            // Send stun status to server for multiplayer enemies (co-op mode)
            if (this.onApplyEnemyStatusEffectCallback && entity.userData?.serverEnemyId) {
              this.onApplyEnemyStatusEffectCallback(entity.userData.serverEnemyId, 'stun', 2000); // 2 seconds
            } 
          } else {
            // apply stun debuff
            const localSocketId = (window as any).localSocketId;
            const serverPlayerEntities = (window as any).serverPlayerEntities;
            let targetPlayerId: string | null = null;

            if (serverPlayerEntities && serverPlayerEntities.current) {
              serverPlayerEntities.current.forEach((localEntityId: number, playerId: string) => {
                if (localEntityId === entity.id) {
                  targetPlayerId = playerId;
                }
              });
            }

            // Broadcast debuff to other players (but not ourselves)
            if (targetPlayerId && targetPlayerId !== localSocketId) {
              // Broadcast stun effect to the target player
              if (this.onDebuffCallback) {
                this.onDebuffCallback(entity.id, 'stunned', 2000, targetTransform.position);
              }
            }

            // Create local debuff effect so the caster can see the stun on the enemy
            if (this.onCreateLocalDebuffCallback && targetPlayerId) {
              this.onCreateLocalDebuffCallback(targetPlayerId, 'stunned', targetTransform.position, 2000);
            }
          }
        }
      }
    }

    // Create Sabre Reaper Mist effect at landing position
    if (this.onCreateSabreMistEffectCallback) {
      this.onCreateSabreMistEffectCallback(landingPosition.clone());
    }

    // Broadcast mist effect to other players in PVP
    if (this.onBroadcastSabreMistCallback) {
      this.onBroadcastSabreMistCallback(landingPosition.clone(), 'skyfall');
    }
  }
  
  private completeSkyfallAbility(playerTransform: Transform): void {
    // Reset all Skyfall states
    this.isSkyfalling = false;
    this.skyfallPhase = 'none';
    
    // Restore player movement
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (playerMovement) {
      playerMovement.gravity = this.skyfallOriginalGravity;
      playerMovement.velocity.y = 0; // Stop any remaining vertical movement
    }
  }
  
  private updateBackstabState(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const elapsedTime = currentTime - this.backstabStartTime;
    
    // Check if backstab animation duration has elapsed
    if (elapsedTime >= this.backstabDuration) {
      this.isBackstabbing = false;
      // Clean up captured rotations
      this.backstabTargetRotations.clear();
    }
  }
  
  // Sunder ability implementation
  private performSunder(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Check cooldown
    if (currentTime - this.lastSunderTime < this.sunderCooldown) {
      return;
    }
    
    // Flourish: shield restore only with PARRY talent
    if (shouldApplyParryTalent(this.talentLoadout, this.abilityLoadout) && this.playerEntity) {
      const shieldComponent = this.playerEntity.getComponent(Shield);
      if (shieldComponent) {
        const newShieldValue = Math.min(
          shieldComponent.maxShield,
          shieldComponent.currentShield + PARRY_FLOURISH_SHIELD_RESTORE,
        );
        shieldComponent.setShield(newShieldValue, shieldComponent.maxShield);
      }
    }

    // Set cooldown
    this.lastSunderTime = currentTime;
    
    // Start sunder animation (same as backstab)
    this.isSundering = true;
    this.sunderStartTime = currentTime;
    this.sunderDamageApplied = false; // Reset damage flag for new sunder

    // Play flourish sound
    this.audioSystem?.playSabresFlourishSound(playerTransform.position);

    // Don't perform damage immediately - wait for the right moment in animation
    // This ensures damage happens during the actual sunder animation, not just at the start
  }
  
  private updateSunderState(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const elapsedTime = currentTime - this.sunderStartTime;
    
    // Apply damage at the right moment in the animation (30% through, like backstab)
    const damageTimingPercent = 0.3; // 30% through the animation
    const damageWindow = this.sunderDuration * damageTimingPercent;
    const damageWindowEnd = damageWindow + 0.1; // Small window to ensure damage is applied
    
    if (elapsedTime >= damageWindow && elapsedTime <= damageWindowEnd) {
      // Only apply damage once during this window
      if (!this.sunderDamageApplied) {
        this.performSunderDamage(playerTransform);
        this.sunderDamageApplied = true;
      }
    }
    
    // Check if sunder animation duration has elapsed
    if (elapsedTime >= this.sunderDuration) {
      this.isSundering = false;
      this.sunderDamageApplied = false; // Reset for next use
    }
  }
  
  private performSunderDamage(playerTransform: Transform): void {
    // Get all entities in the world to check for enemies/players
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    
    // Get player facing direction (camera direction)
    const playerDirection = new Vector3();
    this.camera.getWorldDirection(playerDirection);
    playerDirection.normalize();

    this.fireFanOfKnivesFan(playerTransform);
    this.performFireAffinityStorm(playerTransform);

    const sunderRange = 4; // Same range as backstab
    let hitCount = 0;
    const currentTime = Date.now() / 1000;
    
    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      
      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      
      // Check if target is in range
      const distance = playerPosition.distanceTo(targetTransform.position);
      if (distance > sunderRange) continue;
      
      // Check if target is in front of player (cone attack)
      const directionToTarget = new Vector3()
        .subVectors(targetTransform.position, playerPosition)
        .normalize();
      
      const dotProduct = playerDirection.dot(directionToTarget);
      const angleThreshold = Math.cos(Math.PI / 4); // 60 degree cone
      
      if (dotProduct < angleThreshold) continue;
      
      // Apply Sunder stacks and calculate damage
      const { damage: rawSunderDamage, stackCount, isStunned } = this.applySunderStack(entity.id, currentTime);

      const wrathFlourish = shouldApplyWrathfulFlourishTalent(this.talentLoadout);
      let finalDamage = rawSunderDamage;
      let isCritForQueue: boolean | undefined = undefined;
      if (wrathFlourish) {
        const dr = calculateDamage(rawSunderDamage, WeaponType.SABRES, {
          critChanceAdd: WRATHFUL_FLOURISH_CRIT_CHANCE_ADD,
          critDamageMultAdd: WRATHFUL_FLOURISH_CRIT_DAMAGE_MULT_ADD,
        });
        finalDamage = dr.damage;
        isCritForQueue = dr.isCritical;
      }

      const staggeringFlourish = shouldApplyStaggeringFlourishTalent(this.talentLoadout);
      const staggerFlourishAmount = staggeringFlourish ? STAGGERING_FLOURISH_STAGGER : undefined;
      const infestedFlourishFlag = shouldApplyInfestedFlourishTalent(this.talentLoadout) ? true : undefined;

      // Apply damage
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        combatSystem.queueDamage(
          entity,
          finalDamage,
          this.playerEntity!,
          'sunder',
          this.playerEntity?.userData?.playerId,
          isCritForQueue,
          undefined,
          staggerFlourishAmount,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          infestedFlourishFlag,
        );

        if (shouldApplyGuardSabresFlourishTalent(this.talentLoadout)) {
          this.applySabresPurpleGuardEffect(playerTransform);
        }
        
        // Apply stun effect if at 2 stacks
        if (isStunned) {
          const enemy = entity.getComponent(Enemy);
          if (enemy) {
            // Apply stun to enemy component for immediate movement and rotation stop
            enemy.stun(3.5, currentTime); // 4 second stun (using stun mechanics for movement and rotation)

            // Add visual stun effect (different from freeze) - 4 second duration for Sunder
            addGlobalStunnedEnemy(entity.id.toString(), targetTransform.position, 4000);
            console.log(`⚔️ Sunder: Applied stun visual effect to enemy ${entity.id}, serverEnemyId: ${entity.userData?.serverEnemyId}`);

            // Send stun status to server for multiplayer enemies (co-op mode)
            if (this.onApplyEnemyStatusEffectCallback && entity.userData?.serverEnemyId) {
              this.onApplyEnemyStatusEffectCallback(entity.userData.serverEnemyId, 'stun', 3500); // 4 seconds
              console.log(`⚔️ Sunder: Broadcasted stun to server for enemy ${entity.userData.serverEnemyId}`);
            } else {
              console.warn(`⚔️ Sunder: Could not broadcast stun - callback: ${!!this.onApplyEnemyStatusEffectCallback}, serverEnemyId: ${entity.userData?.serverEnemyId}`);
            }
          }
          
          // Broadcast stun effect for PVP (using new 'stunned' type)
          // CRITICAL FIX: Check if we're about to target ourselves before broadcasting debuff
          if (this.onDebuffCallback) {
            const localSocketId = (window as any).localSocketId;
            const serverPlayerEntities = (window as any).serverPlayerEntities;
            let targetPlayerId: string | null = null;
            
            if (serverPlayerEntities && serverPlayerEntities.current) {
              serverPlayerEntities.current.forEach((localEntityId: number, playerId: string) => {
                if (localEntityId === entity.id) {
                  targetPlayerId = playerId;
                }
              });
            }
            
            // Broadcast debuff to other players (but not ourselves)
          if (targetPlayerId && targetPlayerId !== localSocketId) {
            this.onDebuffCallback(entity.id, 'stunned', 4000, targetTransform.position);
          }

          // Create local debuff effect so the local player can see the stun on the enemy
          if (this.onCreateLocalDebuffCallback && targetPlayerId) {
            this.onCreateLocalDebuffCallback(targetPlayerId, 'stunned', targetTransform.position, 4000);
          }
          }
        }
        
        hitCount++;
      }
      
      // Trigger callback for multiplayer/visual effects
      if (this.onSunderCallback) {
        this.onSunderCallback(playerTransform.position, playerDirection, finalDamage, stackCount);
      }
    }
  }

  private performFireAffinityStorm(playerTransform: Transform): void {
    if (!shouldApplyFireAffinityTalent(this.talentLoadout) || !this.playerEntity) return;

    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireAffinityStormTime < FIRE_AFFINITY_STORM_ICD_SEC) return;
    this.lastFireAffinityStormTime = currentTime;

    const playerPosition = playerTransform.getWorldPosition();
    const stormDamage = getFireAffinityStormDamage(
      this.allocatedPlayerStats,
      this.talentLoadout,
      this.abilityLoadout,
    );
    const combatSystem = this.world.getSystem(CombatSystem);
    if (!combatSystem) return;

    triggerGlobalFireStorm(playerPosition);
    this.audioSystem?.playWeaponSound?.('scythe_cryoflame', playerPosition, { volume: 0.8 });

    for (const entity of this.world.getAllEntities()) {
      if (entity === this.playerEntity) continue;
      if (
        entity.userData?.isCoopAlliedUnit ||
        entity.userData?.coopServerEnemyType === 'allied-knight'
      ) {
        continue;
      }
      if (!entity.getComponent(Enemy)) continue;

      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      if (playerPosition.distanceTo(targetTransform.position) > FIRE_AFFINITY_STORM_RADIUS) continue;

      combatSystem.queueDamage(
        entity,
        stormDamage,
        this.playerEntity,
        'fire_affinity_storm',
        this.playerEntity?.userData?.playerId,
      );
    }
  }
  
  private applySunderStack(entityId: number, currentTime: number): { damage: number; stackCount: number; isStunned: boolean } {
    const stackDuration = 10.0; // 10 seconds
    let currentStacks = this.sunderStacks.get(entityId);
    
    // Clean up expired stacks or initialize new entry
    if (!currentStacks || (currentTime - currentStacks.lastApplied) > stackDuration) {
      currentStacks = { stacks: 0, lastApplied: currentTime, duration: stackDuration };
    }
    
    // Calculate damage based on current stack count (before adding new stack)
    const baseDamages = [85, 125, 170, 175]; // 0, 1, 2, 3 stacks
    const damage = baseDamages[Math.min(currentStacks.stacks, 3)];
    
    let isStunned = false;
    let newStackCount = currentStacks.stacks;
    
    // Apply new stack
    if (currentStacks.stacks < 2) {
      newStackCount = currentStacks.stacks + 1;
      this.sunderStacks.set(entityId, {
        stacks: newStackCount,
        lastApplied: currentTime,
        duration: stackDuration
      });
    } else {
      // At 2 stacks, apply stun and reset to 0 stacks
      isStunned = true;
      newStackCount = 0;
      this.sunderStacks.set(entityId, {
        stacks: 0,
        lastApplied: currentTime,
        duration: stackDuration
      });
    }
    
    return { damage, stackCount: newStackCount, isStunned };
  }

  // Clean up expired Sunder stacks periodically
  private cleanupSunderStacks(): void {
    const currentTime = Date.now() / 1000;
    const stackDuration = 10.0;
    
    // Convert to array to avoid iteration issues
    const entries = Array.from(this.sunderStacks.entries());
    for (const [entityId, stackData] of entries) {
      if ((currentTime - stackData.lastApplied) > stackDuration) {
        this.sunderStacks.delete(entityId);
      }
    }
  }

  
  // Stealth ability implementation
  private performStealth(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Check cooldown
    if (currentTime - this.lastStealthTime < this.stealthCooldown) {
      return;
    }

    // Set cooldown
    this.lastStealthTime = currentTime;
    
    // Start stealth animation
    this.isStealthing = true;
    this.stealthStartTime = currentTime;

    // Play shadow step sound
    this.audioSystem?.playSabresShadowStepSound(playerTransform.position);

    // Create Sabre Reaper Mist effect at player position
    if (this.onCreateSabreMistEffectCallback) {
      this.onCreateSabreMistEffectCallback(playerTransform.position.clone());
    }

    // Broadcast mist effect to other players in PVP
    if (this.onBroadcastSabreMistCallback) {
      this.onBroadcastSabreMistCallback(playerTransform.position.clone(), 'stealth');
    }
    
    // Don't broadcast stealth state immediately - wait for invisibility activation
    
    // Schedule invisibility activation after delay
    this.scheduleAbilityTimeout(() => {
      if (this.isStealthing) { // Only activate if stealth wasn't cancelled
        this.isInvisible = true;
        
        // Broadcast invisibility state to other players
        this.broadcastStealthState(true);
      }
    }, this.stealthDelayDuration * 1000);
    
    // Schedule invisibility deactivation with proper cleanup
    const totalStealthDuration = this.stealthDelayDuration + this.stealthInvisibilityDuration;

    this.scheduleAbilityTimeout(() => {
      if (this.isStealthing) {
        // Create local reappearance mist effect
        if (this.onCreateSabreMistEffectCallback && this.playerEntity) {
          const currentPlayerTransform = this.playerEntity.getComponent(Transform);
          if (currentPlayerTransform) {
            this.onCreateSabreMistEffectCallback(currentPlayerTransform.position.clone());
          }
        }

        // Broadcast reappearance mist effect to other players
        if (this.onBroadcastSabreMistCallback && this.playerEntity) {
          const currentPlayerTransform = this.playerEntity.getComponent(Transform);
          if (currentPlayerTransform) {
            this.onBroadcastSabreMistCallback(currentPlayerTransform.position.clone(), 'stealth');
          }
        }

        // Ensure we clean up all stealth states
        this.isInvisible = false;
        this.isStealthing = false;
        this.stealthStartTime = 0;

        // Force broadcast the visibility state to ensure all clients see the player again
        this.broadcastStealthState(false);
      }
    }, totalStealthDuration * 1000);
  }
  
  private updateStealthState(playerTransform: Transform): void {
    // Only check if stealth state needs cleanup if we have an active stealth effect
    if (!this.isStealthing || this.stealthStartTime === 0) {
      return;
    }

    const currentTime = Date.now() / 1000;
    const elapsedTime = currentTime - this.stealthStartTime;
    const totalStealthDuration = this.stealthDelayDuration + this.stealthInvisibilityDuration;

    // Only clean up if the setTimeout might have failed for some reason
    // This is a safety net, not the primary cleanup mechanism
    if (elapsedTime >= totalStealthDuration + 1.0) { // Add 1 second buffer

      this.isStealthing = false;
      this.isInvisible = false;
      this.stealthStartTime = 0;

      // Emergency broadcast in case the normal broadcast failed
      this.broadcastStealthState(false);
    }
  }
  
  private broadcastStealthState(isInvisible: boolean): void {
    // Broadcast stealth state through the multiplayer system
    const multiplayerContext = (window as any).multiplayerContext;
    if (multiplayerContext && multiplayerContext.broadcastPlayerStealth) {
      multiplayerContext.broadcastPlayerStealth(isInvisible, this.isStealthing);
    }
  }
  
  private resetAllAbilityStates(): void {
    this.clearAllAbilityIntervals();
    // Reset all ability states when switching weapons
    this.isSwinging = false; // Reset swinging state to prevent sound overlap
    this.isCharging = false; // Reset bow charging state
    this.chargeProgress = 0; // Reset charge progress
    this.bowPrimaryChargeStartMs = null;
    this.isViperStingCharging = false; // Reset viper sting charging
    this.viperStingChargeProgress = 0;
    this.isBarrageCharging = false; // Reset barrage charging
    this.barrageChargeProgress = 0;
    this.barrageVolleyGeneration++;
    this.isCobraShotCharging = false; // Reset cobra shot charging
    this.cobraShotChargeProgress = 0;
    this.isRejuvenatingShotCharging = false; // Reset rejuvenating shot charging
    this.rejuvenatingShotChargeProgress = 0;
    this.isCrossentropyCharging = false; // Reset crossentropy charging
    this.crossentropyChargeProgress = 0;
    this.crossentropyRechargeAccumulator = CROSSENTROPY_COOLDOWN_SEC;
    this.crossentropyCooldownReconcileWallSec = null;
    this.isSummonTotemCharging = false; // Reset summon totem charging
    this.summonTotemChargeProgress = 0;
    this.isWindShearCharging = false; // Reset wind shear charging
    this.windShearChargeProgress = 0;
    this.isWhirlwindCharging = false; // Reset whirlwind charging
    this.whirlwindChargeProgress = 0;
    this.isWhirlwinding = false; // Reset whirlwind spinning
    this.isThrowSpearCharging = false; // Reset throw spear charging
    this.throwSpearChargeProgress = 0;
    this.throwSpearChargeStartTime = 0;
    this.isThrowSpearReleasing = false; // Reset throw spear releasing
    this.throwSpearReleaseTime = 0;
    this.isFlurryActive = false; // Reset Flurry state
    this.lastFrostpathProcEffectWallClockMs = 0;
    this.lastSolarRechargeProcEffectWallClockMs = 0;
    this.lastFlurryHealVfxWallClockMs = 0;
    this.lastFlurryHealNumberWallClockMs = 0;
    this.healingStreamHealCarry = 0;
    this.lastHealingStreamHealNumberWallClockMs = 0;
    this.isSkyfalling = false;
    this.skyfallPhase = 'none';
    this.isBackstabbing = false;
    this.isSundering = false;
    this.sunderDamageApplied = false; // Reset sunder damage flag

    // Clean up stealth state and ensure visibility is restored
    if (this.isStealthing || this.isInvisible) {
      this.isStealthing = false;
      this.isInvisible = false;
      this.stealthStartTime = 0;

      // Broadcast visibility restoration when switching weapons
      this.broadcastStealthState(false);
    }

    this.isSwordCharging = false;
    this.isDeflecting = false;
    this.isWraithStriking = false; // Reset WraithStrike when switching weapons

    this.clearTalentBarrierEndTimeout();
    this.wraithGuardShieldActive = false;
    this.wraithGuardOwnsBarrier = false;
    this.wraithGuardBarrierEndMs = 0;
    this.colossusGuardShieldActive = false;
    this.colossusGuardOwnsBarrier = false;
    this.colossusGuardBarrierEndMs = 0;
    this.guardComboShieldActive = false;
    this.guardComboOwnsBarrier = false;
    this.guardComboBarrierEndMs = 0;
    this.dashGuardShieldActive = false;
    this.dashGuardOwnsBarrier = false;
    this.dashGuardBarrierEndMs = 0;
    this.sabresPurpleGuardShieldActive = false;
    this.sabresPurpleGuardOwnsBarrier = false;
    this.sabresPurpleGuardBarrierEndMs = 0;
    this.executionerBuffDeadlineMs = 0;
    this.runebladeExecutionerFlatBonusPending = 0;
    this.runebladeCrusaderBuffEndMs = 0;
    this.runebladeBlizzardEndMs = 0;
    if (this.deflectBarrier.isBarrierActive()) {
      this.deflectBarrier.deactivate();
    }

    // Reset Corrupted Aura and restore original rune counts when switching weapons
    if (this.corruptedAuraActive) {
      this.deactivateCorruptedAura();
    }

    // Clear Sunder stacks when switching weapons
    this.sunderStacks.clear();

    // Clear Corrupted Aura slowed entities when switching weapons
    this.corruptedAuraSlowedEntities.clear();

    // Clear active debuff effects when switching weapons (for stun detection)
    this.activeDebuffEffects.clear();
  }

  private toggleCorruptedAura(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;

    if (this.corruptedAuraActive) {
      // Allow early cancellation — deactivate immediately
      this.deactivateCorruptedAura();
      return;
    }

    // Block activation while on cooldown
    if (currentTime - this.lastCorruptedAuraTime < this.corruptedAuraCooldown) {
      return;
    }

    // Activate aura
    this.corruptedAuraActive = true;
    this.corruptedAuraStartTime = currentTime;
    this.lastCorruptedAuraTime = currentTime;

    // Store original rune counts and apply crit bonuses
    const currentRuneCounts = getGlobalRuneCounts();
    this.originalCriticalRunes = currentRuneCounts.criticalRunes;
    this.originalCritDamageRunes = currentRuneCounts.critDamageRunes;
    setGlobalCriticalRuneCount(currentRuneCounts.criticalRunes + 15);
    setGlobalCritDamageRuneCount(currentRuneCounts.critDamageRunes + 6);

    this.audioSystem?.playRunebladeHeartrendSound(playerTransform.position);

    if (this.onCorruptedAuraToggleCallback) {
      this.onCorruptedAuraToggleCallback(true);
    }
  }

  private deactivateCorruptedAura(): void {
    this.corruptedAuraActive = false;
    setGlobalCriticalRuneCount(this.originalCriticalRunes);
    setGlobalCritDamageRuneCount(this.originalCritDamageRunes);
    this.corruptedAuraSlowedEntities.clear();
    if (this.onCorruptedAuraToggleCallback) {
      this.onCorruptedAuraToggleCallback(false);
    }
  }

  private updateCorruptedAuraEffects(playerTransform: Transform): void {
    const nowMs = Date.now();
    if (nowMs - this.lastCorruptedAuraAuraCheckMs < this.corruptedAuraCheckIntervalMs) {
      return;
    }
    this.lastCorruptedAuraAuraCheckMs = nowMs;
    this.applyCorruptedAuraSlow(playerTransform.position);
  }

  private applyCorruptedAuraSlow(playerPosition: Vector3): void {
    const candidates = this.queryNearbyEntities(playerPosition, this.corruptedAuraRange);

    const inRangeIds = new Set<number>();

    for (const entity of candidates) {
      if (entity.id === this.playerEntity?.id) continue;

      const entityTransform = entity.getComponent(Transform);
      const entityMovement = entity.getComponent(Movement);

      if (!entityTransform || !entityMovement) continue;

      const distance = playerPosition.distanceTo(entityTransform.position);
      if (distance > this.corruptedAuraRange) continue;

      inRangeIds.add(entity.id);
      if (!this.corruptedAuraSlowedEntities.get(entity.id)) {
        entityMovement.movementSpeedMultiplier = this.corruptedAuraSlowEffect;
        this.corruptedAuraSlowedEntities.set(entity.id, true);
      }
    }

    for (const [entityId] of Array.from(this.corruptedAuraSlowedEntities.entries())) {
      if (inRangeIds.has(entityId)) continue;
      const entity = this.world.getEntity(entityId);
      const entityMovement = entity?.getComponent(Movement);
      if (entityMovement) {
        entityMovement.movementSpeedMultiplier = 1.0;
      }
      this.corruptedAuraSlowedEntities.delete(entityId);
    }
  }

  private queryNearbyEntities(center: Vector3, radius: number): Entity[] {
    const collisionSystem = this.world.getSystem(CollisionSystem);
    if (collisionSystem) {
      return collisionSystem.queryCollidersRadius(center, radius);
    }
    return this.world.getAllEntities();
  }

  // Callback for Corrupted Aura toggle
  private onCorruptedAuraToggleCallback?: (active: boolean) => void;


  public setCorruptedAuraToggleCallback(callback: (active: boolean) => void): void {
    this.onCorruptedAuraToggleCallback = callback;
  }

  // Skill Point System Methods
  public getSkillPointData(): SkillPointData {
    return { ...this.skillPointData };
  }

  public setSkillPointData(data: SkillPointData): void {
    this.skillPointData = data;
  }

  /** Co-op: allocated stats from leveling / pedestal picks (Intellect feeds Spellblade Wraith Strike base scaling). */
  public setAllocatedPlayerStats(stats: PlayerStats): void {
    this.allocatedPlayerStats = { ...stats };
  }

  public getAllocatedPlayerStats(): PlayerStats {
    return { ...this.allocatedPlayerStats };
  }

  /** Co-op purple room MANA SHIELD — restore shield when dash charges are expended. */
  public tryManaShieldOnDashChargeExpended(consumed: number): void {
    if (consumed <= 0 || !this.playerEntity) return;
    applyManaShieldRestoreForDashCharges(
      this.playerEntity,
      this.talentLoadout,
      this.abilityLoadout,
      this.allocatedPlayerStats,
      consumed,
    );
  }

  /** Bloodmage room boon: consume a dash charge to bypass an E-ability's cooldown. Max once per BLOODMAGE_BYPASS_ICD_SEC. */
  private tryBloodmageDashBypass(currentTime: number): boolean {
    if (!shouldApplyBloodmageTalent(this.talentLoadout)) return false;
    if (currentTime - this.lastBloodmageTriggerTime < BLOODMAGE_BYPASS_ICD_SEC) return false;
    const movement = this.playerEntity?.getComponent(Movement);
    if (!movement) return false;
    const consumed = movement.consumeDashChargesWithoutDash(1, currentTime);
    if (consumed <= 0) return false;
    this.lastBloodmageTriggerTime = currentTime;
    this.tryManaShieldOnDashChargeExpended(consumed);
    return true;
  }

  /** Override room boon: drain all current shield to bypass a Q-ability's cooldown. Max once per OVERRIDE_BYPASS_ICD_SEC. */
  private tryOverrideShieldBypass(currentTime: number): boolean {
    if (!shouldApplyOverrideTalent(this.talentLoadout)) return false;
    if (currentTime - this.lastOverrideTriggerTime < OVERRIDE_BYPASS_ICD_SEC) return false;
    const shield = this.playerEntity?.getComponent(Shield);
    if (!shield || shield.currentShield <= 0) return false;
    shield.setShield(0, shield.maxShield);
    this.lastOverrideTriggerTime = currentTime;
    return true;
  }

  public setAbilityLoadout(loadout: AbilityLoadout): void {
    this.abilityLoadout = loadout;
    // If a passive was selected in the loadout menu, force-unlock it without spending skill points
    if (loadout.passive) {
      this.applyLoadoutPassive(loadout.passive);
    }
  }

  public setTalentLoadout(loadout: TalentLoadout): void {
    this.talentLoadout = normalizeTalentLoadout(loadout);
    if (this.currentWeapon === WeaponType.SCYTHE) {
      this.fireRate = this.getEntropicBoltFireRateSec();
    }
    if (!shouldApplyCrusaderTalent(this.talentLoadout)) {
      this.runebladeCrusaderBuffEndMs = 0;
    }
    if (!shouldApplyBlizzardTalent(this.talentLoadout)) {
      this.runebladeBlizzardEndMs = 0;
    }
  }

  /** Current session talents (merged with defaults in `setTalentLoadout`). */
  public getTalentLoadout(): TalentLoadout {
    return this.talentLoadout;
  }

  public setReaperCrossentropyStack(stacks: number): void {
    this.reaperCrossentropyStack = Math.max(0, Math.floor(stacks));
  }

  public getReaperCrossentropyStack(): number {
    return this.reaperCrossentropyStack;
  }

  public setBackstabKillstreakStack(stacks: number): void {
    this.backstabKillstreakStack = Math.max(0, Math.floor(stacks));
  }

  public getBackstabKillstreakStack(): number {
    return this.backstabKillstreakStack;
  }

  /** Full Backstab cooldown refresh after RELENTLESS kill (called from socket). */
  public resetBackstabCooldownForRelentless(): void {
    if (this.syncBackstabDoubleStabMode()) {
      this.backstabCharges = BACKSTAB_DOUBLE_STAB_MAX_CHARGES;
      this.backstabNextChargeAt = null;
      this.lastBackstabDoubleStabChargeSpendTime = Number.NEGATIVE_INFINITY;
    } else {
      this.lastBackstabTime = 0;
    }
  }

  /** Returns the local player's current world position, or null if unavailable. Used by socket handlers for damage number placement. */
  public getPlayerWorldPosition(): Vector3 | null {
    if (!this.playerEntity) return null;
    const transform = this.playerEntity.getComponent(Transform);
    if (!transform) return null;
    return transform.getWorldPosition().clone();
  }

  /**
   * Solo/local only: Killstreak stack increment + Relentless heal/Cooldown when Backstab kills.
   * Co-op uses server `backstab-killstreak-stack` / `sabres-relentless-backstab-kill` instead.
   */
  public applySabresBackstabKillRewards(opts: { killstreak?: boolean; relentless?: boolean }): void {
    if (!opts.killstreak && !opts.relentless) return;
    if (opts.killstreak && shouldApplyKillstreakTalent(this.talentLoadout)) {
      this.backstabKillstreakStack += 1;
    }
    if (opts.relentless && shouldApplyRelentlessTalent(this.talentLoadout)) {
      const combatSystem = this.world.getSystem(CombatSystem);
      const relentlessHeal = getRelentlessBackstabKillHeal(
        this.allocatedPlayerStats,
        this.talentLoadout,
        this.abilityLoadout,
      );
      if (this.playerEntity && combatSystem && relentlessHeal > 0) {
        combatSystem.queueHealing(this.playerEntity, relentlessHeal, this.playerEntity);
      }
      this.resetBackstabCooldownForRelentless();
    }
  }

  private shouldApplyWrathStrikeTalent(): boolean {
    return this.talentLoadout.wrathStrike && isWraithStrikeInLoadout(this.abilityLoadout);
  }

  private shouldApplyInfestedStrikeTalent(): boolean {
    return this.talentLoadout.infestedStrike && isWraithStrikeInLoadout(this.abilityLoadout);
  }

  private shouldApplyStaggeringStrikeTalent(): boolean {
    return this.talentLoadout.staggeringStrike && isWraithStrikeInLoadout(this.abilityLoadout);
  }

  private shouldApplyBreathWeaponTalent(): boolean {
    return shouldApplyBreathWeaponTalent(this.talentLoadout, this.abilityLoadout);
  }

  /** STAGGERING COMBO: Runeblade basic combo builds stagger per hit (`DragonRenderer` → CombatSystem). */
  public shouldApplyStaggeringComboTalent(): boolean {
    return this.talentLoadout.staggeringCombo === true && this.currentWeapon === WeaponType.RUNEBLADE;
  }

  /** STAGGERING SWIPES: Sabres dual-blade basic swing builds stagger (`performSabresMeleeDamage` → CombatSystem). */
  public shouldApplyStaggeringSwipesTalent(): boolean {
    return this.talentLoadout.staggeringSwipes === true && this.currentWeapon === WeaponType.SABRES;
  }

  /** Stagger Shot: Bow LMB / Tempest burst projectiles carry stagger (`ProjectileSystem` → CombatSystem). */
  public shouldApplyStaggerShotTalent(): boolean {
    return this.talentLoadout.staggerShot === true && this.currentWeapon === WeaponType.BOW;
  }

  /** Cloudkill: Bow LMB primary hits may proc poison arrow volley (`ProjectileSystem`). */
  public shouldApplyCloudkillForBow(): boolean {
    return shouldApplyCloudkillTalent(this.talentLoadout) && this.currentWeapon === WeaponType.BOW;
  }

  public shouldApplyBloodleechRoomTalent(): boolean {
    return shouldApplyBloodleechTalent(this.talentLoadout);
  }

  public broadcastRoomBoonHealing(healingAmount: number, healingType: string, position: Vector3): void {
    this.onBroadcastHealing?.(healingAmount, healingType, position);
  }

  /** Dual Coil: twin Bow LMB projectiles and paired perfect-shot beam VFX. */
  public shouldApplyDualCoilForBow(): boolean {
    return shouldApplyDualCoilTalent(this.talentLoadout) && this.currentWeapon === WeaponType.BOW;
  }

  private bowHighCaliberActive(): boolean {
    return this.currentWeapon === WeaponType.BOW && shouldApplyHighCaliberTalent(this.talentLoadout);
  }

  private bowTriggerFingerUnchargedActive(): boolean {
    return this.currentWeapon === WeaponType.BOW && shouldApplyTriggerFingerTalent(this.talentLoadout);
  }

  private bowUnchargedProjectileBaseDamage(): number {
    return this.bowTriggerFingerUnchargedActive()
      ? BOW_TRIGGER_FINGER_UNCHARGED_DAMAGE
      : BOW_UNCHARGED_PROJECTILE_DAMAGE;
  }

  private bowPowershotBaseDamage(): number {
    return this.bowHighCaliberActive() ? 100 : 50;
  }

  private bowPerfectShotBaseDamage(): number {
    return this.bowHighCaliberActive() ? 150 : 75;
  }

  /** Tempest Rounds: P passive unlock or co-op talent — used for bow crit bonus in DamageCalculator. */
  public isBowTempestRoundsActive(): boolean {
    if (this.currentWeapon !== WeaponType.BOW || !this.selectedWeapons) return false;
    const weaponSlot = this.selectedWeapons.primary === WeaponType.BOW ? 'primary' : 'secondary';
    return (
      this.isPassiveAbilityUnlocked('P', WeaponType.BOW, weaponSlot) || this.talentLoadout.tempestRounds === true
    );
  }

  /** Latest Tempest Rounds shot sequence (drives EtherBow muzzle VFX; matches `projectileConfig.tempestBurstSeq`). */
  public getTempestBurstShotSeq(): number {
    return this.tempestBurstShotSeq;
  }

  /** Wyvern Sting: bonus Cobra Shot on perfect primary shot (Bow + talent toggle). */
  private shouldApplyWyvernStingForBow(): boolean {
    return shouldApplyWyvernStingTalent(this.talentLoadout) && this.currentWeapon === WeaponType.BOW;
  }

  /** Wrathful Talons: Reaping Talons return-arrow preset crit (applied in `useViperSting`). */
  public shouldApplyWrathfulTalonsTalentActive(): boolean {
    return computeWrathfulTalonsTalentActive(this.talentLoadout, this.abilityLoadout);
  }

  /** Wrathful Shots: perfect bow primary crit modifiers (read by `CombatSystem` via `controlSystemRef`). */
  public getWrathfulShotsPerfectCritOpts(): DamageCalcOptions | undefined {
    if (this.currentWeapon !== WeaponType.BOW || !shouldApplyWrathfulShotsTalent(this.talentLoadout)) {
      return undefined;
    }
    return {
      critChanceAdd: WRATHFUL_SHOTS_PERFECT_CRIT_CHANCE_ADD,
      critDamageMultAdd: WRATHFUL_SHOTS_PERFECT_CRIT_DAMAGE_MULT_ADD,
    };
  }

  /** Wrathful Shots: Tempest Rounds burst crit modifiers (read by `CombatSystem` via `controlSystemRef`). */
  public getWrathfulShotsTempestCritOpts(): DamageCalcOptions | undefined {
    if (this.currentWeapon !== WeaponType.BOW || !shouldApplyWrathfulShotsTalent(this.talentLoadout)) {
      return undefined;
    }
    return {
      critChanceAdd: WRATHFUL_SHOTS_TEMPEST_CRIT_CHANCE_ADD,
      critDamageMultAdd: WRATHFUL_SHOTS_TEMPEST_CRIT_DAMAGE_MULT_ADD,
    };
  }

  /** Wrathful Bite: Barrage / Frostbite crit modifiers (read by `CombatSystem` via `controlSystemRef`). */
  public getBarrageCritDamageCalcOpts(): DamageCalcOptions | undefined {
    if (!shouldApplyWrathfulBiteTalent(this.talentLoadout, this.abilityLoadout)) return undefined;
    return {
      critChanceAdd: WRATHFUL_BITE_BARRAGE_CRIT_CHANCE_ADD,
      critDamageMultAdd: WRATHFUL_BITE_BARRAGE_CRIT_DAMAGE_MULT_ADD,
    };
  }

  /**
   * Directly unlocks the 'P' passive for the primary weapon slot based on the
   * selected passive ability id (e.g. 'BOW_P', 'SCYTHE_P'). Does not spend skill points.
   */
  private applyLoadoutPassive(passiveId: string): void {
    if (!this.selectedWeapons) return;
    const weaponType = this.selectedWeapons.primary;
    const slot = 'primary';
    const key = `${weaponType}_${slot}`;
    const newUnlockedAbilities = { ...this.skillPointData.unlockedAbilities };
    if (!newUnlockedAbilities[key]) {
      newUnlockedAbilities[key] = new Set(['P']);
    } else {
      const existing = new Set(newUnlockedAbilities[key]);
      existing.add('P');
      newUnlockedAbilities[key] = existing;
    }
    this.skillPointData = { ...this.skillPointData, unlockedAbilities: newUnlockedAbilities };
  }

  public setPlayerDead(isDead: boolean): void {
    this.isPlayerDead = isDead;

    // Reset stealth state when player dies
    if (isDead) {
      this.isStealthing = false;
      this.isInvisible = false;
      this.stealthStartTime = 0;
      this.broadcastStealthState(false);
      this.executionerBuffDeadlineMs = 0;
      this.runebladeExecutionerFlatBonusPending = 0;
      this.runebladeCrusaderBuffEndMs = 0;
      this.runebladeBlizzardEndMs = 0;

      const movement = this.playerEntity?.getComponent(Movement);
      if (movement) {
        movement.haltLocomotion();
      }
    }
  }


  public isPlayerDeadState(): boolean {
    return this.isPlayerDead;
  }

  public updateSkillPointsForLevel(level: number): void {
    this.skillPointData = SkillPointSystem.updateSkillPointsForLevel(this.skillPointData, level);
  }

  public unlockAbility(weaponType: WeaponType, abilityKey: 'Q' | 'E' | 'R' | 'F' | 'P', weaponSlot: 'primary' | 'secondary'): boolean {
    try {
      this.skillPointData = SkillPointSystem.unlockAbility(this.skillPointData, weaponType, abilityKey, weaponSlot);
      return true;
    } catch (error) {
      console.error('Failed to unlock ability:', error);
      return false;
    }
  }

  private isAbilityUnlocked(abilityKey: 'Q' | 'E' | 'R' | 'F'): boolean {
    if (!this.selectedWeapons) return false;

    // Determine weapon slot
    let weaponSlot: 'primary' | 'secondary';
    let weaponType: WeaponType;

    if (this.currentWeapon === this.selectedWeapons.primary) {
      weaponSlot = 'primary';
      weaponType = this.selectedWeapons.primary;
    } else if (this.currentWeapon === this.selectedWeapons.secondary) {
      weaponSlot = 'secondary';
      weaponType = this.selectedWeapons.secondary;
    } else {
      // For unknown weapon, allow abilities
      return true;
    }

    return SkillPointSystem.isAbilityUnlocked(this.skillPointData, weaponType, abilityKey, weaponSlot);
  }

  public isPassiveAbilityUnlocked(abilityKey: 'P', weaponType: WeaponType, weaponSlot: 'primary' | 'secondary'): boolean {
    if (!this.selectedWeapons) return false;

    return SkillPointSystem.isAbilityUnlocked(this.skillPointData, weaponType, abilityKey, weaponSlot);
  }


  // Backstab ability implementation
  private performBackstab(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    let isOverrideBypass = false;

    if (this.syncBackstabDoubleStabMode()) {
      this.advanceBackstabChargeRecharges(currentTime);
      if (this.backstabCharges <= 0) {
        if (!this.tryOverrideShieldBypass(currentTime)) return;
        isOverrideBypass = true;
      } else if (
        currentTime - this.lastBackstabDoubleStabChargeSpendTime <
        BACKSTAB_DOUBLE_STAB_INTERNAL_COOLDOWN_SEC
      ) {
        return;
      }
    } else if (currentTime - this.lastBackstabTime < this.backstabCooldown) {
      if (!this.tryOverrideShieldBypass(currentTime)) return;
      isOverrideBypass = true;
    }

    if (this.backstabDoubleStabActive && !isOverrideBypass) {
      this.backstabCharges--;
      this.lastBackstabDoubleStabChargeSpendTime = currentTime;
      if (
        this.backstabCharges < BACKSTAB_DOUBLE_STAB_MAX_CHARGES &&
        this.backstabNextChargeAt === null
      ) {
        this.backstabNextChargeAt = currentTime + this.backstabCooldown;
      }
    } else if (!isOverrideBypass) {
      this.lastBackstabTime = currentTime;
    }
  
    // Capture current rotations of all nearby entities BEFORE the backstab damage check
    // This prevents the boss from turning to face us during the backstab cast
    // Use visual rotation (from mesh) if available, as it lags behind server rotation
    const backstabRange = 4.75;
    const allEntities = this.queryNearbyEntities(playerTransform.position, backstabRange);
    this.backstabTargetRotations.clear();
    
    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      const visualRot = entity.userData?.visualRotation;
      const serverRot = entity.userData?.rotation;
      const rotToCapture = visualRot !== undefined ? visualRot : serverRot;
      
      if (rotToCapture !== undefined) {
        this.backstabTargetRotations.set(entity.id, rotToCapture);
      }
    }
    
    console.log(`🗡️ Captured ${this.backstabTargetRotations.size} entity rotations for backstab`);
    
    // Start backstab animation
    this.isBackstabbing = true;
    this.backstabStartTime = currentTime;

    // Play backstab sound at the start of the ability
    this.audioSystem?.playBackstabSound(playerTransform.position);

    // Trigger callback for multiplayer/visual effects - actual backstab detection happens in performBackstabDamage
    // We'll call this after damage detection, so remove this early call
    // The callback will be triggered from performBackstabDamage with the correct isBackstab value
    
    // Perform backstab damage
    this.performBackstabDamage(playerTransform);
  }

  private performBackstabDamage(playerTransform: Transform): void {
    const backstabRange = 4.75;
    const vorpalGust = shouldApplyVorpalGustTalent(this.talentLoadout);
    const queryRadius = vorpalGust ? VORPAL_GUST_BEAM_LENGTH + 1.5 : backstabRange;
    const candidates = this.queryNearbyEntities(playerTransform.position, queryRadius);
    const playerPosition = playerTransform.position;

    this.camera.getWorldDirection(this.backstabPlayerDirection);
    this.backstabPlayerDirection.normalize();

    const hitState = { hitCount: 0 };

    if (vorpalGust) {
      const beamHits: { entity: Entity; t: number }[] = [];
      for (const entity of candidates) {
        if (entity === this.playerEntity) continue;
        const targetHealth = entity.getComponent(Health);
        const targetTransform = entity.getComponent(Transform);
        if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
        const beam = evaluateVorpalGustBeamHit(
          playerPosition,
          this.backstabPlayerDirection,
          targetTransform.position,
        );
        if (beam.ok) beamHits.push({ entity, t: beam.t });
      }
      beamHits.sort((a, b) => a.t - b.t);
      for (const { entity, t } of beamHits) {
        this.applyBackstabDamageToTarget(
          entity,
          playerTransform,
          playerPosition,
          this.backstabPlayerDirection,
          hitState,
          t,
        );
      }
      return;
    }

    for (const entity of candidates) {
      if (entity === this.playerEntity) continue;

      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);

      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;

      const distance = playerPosition.distanceTo(targetTransform.position);
      if (distance > backstabRange) continue;

      this.backstabDirectionToTarget
        .subVectors(targetTransform.position, playerPosition)
        .normalize();

      const dotProduct = this.backstabPlayerDirection.dot(this.backstabDirectionToTarget);
      const angleThreshold = Math.cos(Math.PI / 3); // 60 degree cone

      if (dotProduct < angleThreshold) continue;

      this.applyBackstabDamageToTarget(
        entity,
        playerTransform,
        playerPosition,
        this.backstabPlayerDirection,
        hitState,
      );
    }
  }

  /** Positional logic + damage queue shared by melee cone Backstab and Vorpal Gust beam order. */
  private applyBackstabDamageToTarget(
    entity: Entity,
    playerTransform: Transform,
    playerPosition: Vector3,
    _playerDirection: Vector3,
    hitState: { hitCount: number },
    vorpalBeamT?: number,
  ): void {
    const targetHealth = entity.getComponent(Health);
    const targetTransform = entity.getComponent(Transform);
    if (!targetHealth || !targetTransform || targetHealth.isDead) return;

    let isBackstab = false;
    let baseDamage = 115;

    const pvpPlayers = (window as any).pvpPlayers;
    const localSocketId = (window as any).localSocketId;

    if (pvpPlayers && localSocketId) {
      let targetPlayer = null;
      for (const [playerId, player] of pvpPlayers) {
        if (playerId !== localSocketId) {
          const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
          if (playerPos.distanceTo(targetTransform.position) < 0.5) {
            targetPlayer = player;
            break;
          }
        }
      }

      if (targetPlayer) {
        const targetFacingDirection = new Vector3(
          Math.sin(targetPlayer.rotation.y),
          0,
          Math.cos(targetPlayer.rotation.y),
        ).normalize();

        const attackerDirection = new Vector3()
          .subVectors(playerPosition, targetTransform.position)
          .normalize();

        const behindDotProduct = targetFacingDirection.dot(attackerDirection);
        isBackstab = behindDotProduct < -0.3;

        if (isBackstab) {
          baseDamage = 225;
        }
      }
    } else {
      const enemy = entity.getComponent(Enemy);

      const capturedRotation = this.backstabTargetRotations.get(entity.id);
      const visualRotation = entity.userData?.visualRotation;
      const serverRotation = entity.userData?.rotation;

      const rotationToUse =
        capturedRotation !== undefined
          ? capturedRotation
          : visualRotation !== undefined
            ? visualRotation
            : serverRotation;

      console.log(`🗡️ Backstab Debug - Entity ${entity.id}:`, {
        hasEnemy: !!enemy,
        hasUserData: !!entity.userData,
        serverRotation: serverRotation,
        visualRotation: visualRotation,
        capturedRotation: capturedRotation,
        rotationToUse: rotationToUse,
        usingVisual: visualRotation !== undefined && capturedRotation === undefined,
        serverEnemyId: entity.userData?.serverEnemyId,
      });

      if (enemy && rotationToUse !== undefined) {
        const targetFacingDirection = new Vector3(
          Math.sin(rotationToUse),
          0,
          Math.cos(rotationToUse),
        ).normalize();

        const attackerDirection = new Vector3()
          .subVectors(playerPosition, targetTransform.position)
          .normalize();

        const behindDotProduct = targetFacingDirection.dot(attackerDirection);
        isBackstab = behindDotProduct < -0.3;

        console.log(`🗡️ Backstab Calculation:`, {
          entityRotation: rotationToUse,
          targetFacing: targetFacingDirection,
          attackerDirection: attackerDirection,
          behindDotProduct: behindDotProduct,
          isBackstab: isBackstab,
          threshold: -0.3,
        });

        if (isBackstab) {
          baseDamage = 285;
          console.log(`✅ BACKSTAB SUCCESS! Base damage increased to 215`);
        } else {
          console.log(`❌ Not a backstab. Dot product ${behindDotProduct.toFixed(2)} >= -0.3`);
        }
      } else {
        console.log(
          `❌ Backstab failed checks - enemy: ${!!enemy}, rotation defined: ${rotationToUse !== undefined}`,
        );
      }
    }

    if (
      shouldApplyVorpalGustTalent(this.talentLoadout) &&
      vorpalBeamT !== undefined &&
      isVorpalGustTipHit(vorpalBeamT)
    ) {
      if (!isBackstab) {
        baseDamage = BACKSTAB_VORPAL_TIP_DAMAGE_FRONT;
      } else if (baseDamage === 285) {
        baseDamage = BACKSTAB_VORPAL_TIP_DAMAGE_BACKSTAB;
      } else if (baseDamage === 225) {
        baseDamage = BACKSTAB_VORPAL_TIP_DAMAGE_BACKSTAB_PVP;
      }
    }

    if (shouldApplyKillstreakTalent(this.talentLoadout)) {
      baseDamage += this.backstabKillstreakStack * BACKSTAB_KILLSTREAK_DAMAGE_PER_KILL;
    }

    const wrathStab = shouldApplyWrathfulStabTalent(this.talentLoadout);
    const damageResult = wrathStab
      ? calculateDamage(baseDamage, WeaponType.SABRES, {
          critChanceAdd: WRATHFUL_STAB_CRIT_CHANCE_ADD,
          critDamageMultAdd: WRATHFUL_STAB_CRIT_DAMAGE_MULT_ADD,
        })
      : calculateDamage(baseDamage, WeaponType.SABRES);
    const damage = damageResult.damage;

    console.log(`🗡️ Final Backstab Damage:`, {
      baseDamage: baseDamage,
      isBackstab: isBackstab,
      finalDamage: damage,
      isCritical: damageResult.isCritical,
    });

    const combatSystem = this.world.getSystem(CombatSystem);
    if (combatSystem) {
      const staggeringStab = shouldApplyStaggeringStabTalent(this.talentLoadout);
      const infestedBackstab = shouldApplyInfestedBackstabTalent(this.talentLoadout);
      const killstreakBackstab = shouldApplyKillstreakTalent(this.talentLoadout);
      const relentlessBackstab = shouldApplyRelentlessTalent(this.talentLoadout);
      combatSystem.queueDamage(
        entity,
        damage,
        this.playerEntity!,
        'backstab',
        this.playerEntity?.userData?.playerId,
        damageResult.isCritical,
        undefined,
        staggeringStab ? STAGGERING_STAB_BACKSTAB_STAGGER : undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        infestedBackstab,
        undefined,
        killstreakBackstab ? true : undefined,
        relentlessBackstab ? true : undefined,
      );

      if (shouldApplyGuardSabresStabTalent(this.talentLoadout)) {
        this.applySabresPurpleGuardEffect(playerTransform);
      }

      hitState.hitCount++;

      if (this.onBackstabCallback && hitState.hitCount === 1) {
        const direction = new Vector3();
        this.camera.getWorldDirection(direction);
        this.onBackstabCallback(playerTransform.position, direction, damage, isBackstab);
      }
    }
  }

  /**
   * @param dealDamage - When false, only counts enemies in the melee cone (for swing/miss audio). Weapon meshes apply real damage.
   */
  private performMeleeDamage(playerTransform: Transform, dealDamage: boolean = true): number {
    const playerPosition = playerTransform.position;
    const candidates = this.queryNearbyEntities(playerPosition, MELEE_ARC_RANGE);

    this.camera.getWorldDirection(this.meleeAttackDirection);
    this.meleeAttackDirection.y = 0;
    if (this.meleeAttackDirection.lengthSq() < 1e-8) {
      this.meleeAttackDirection.set(0, 0, 1);
    } else {
      this.meleeAttackDirection.normalize();
    }
    const direction = this.meleeAttackDirection;

    const meleeRange = MELEE_ARC_RANGE;
    
    // Base damage values based on combo step and weapon type
    let baseDamage = 50; // Default base damage

    // Weapon-specific damage scaling
    if (this.currentWeapon === WeaponType.SWORD) {
      // Sword damage values
      switch (this.swordComboStep) {
        case 1: baseDamage = 50; break;
        case 2: baseDamage = 60; break;
        case 3: baseDamage = 70; break; // Finisher does more damage
      }
    } else if (this.currentWeapon === WeaponType.RUNEBLADE) {
      // Runeblade damage values
      switch (this.swordComboStep) {
        case 1: baseDamage = 50; break;
        case 2: baseDamage = 60; break;
        case 3: baseDamage = 70; break; // Finisher does more damage
      }
    }
    
    // Get combat system to apply damage
    const combatSystem = this.world.getSystem(CombatSystem);
    let enemiesHit = 0;

    for (const entity of candidates) {
      // Check if entity has enemy component and health
      const enemyTransform = entity.getComponent(Transform);
      const enemyHealth = entity.getComponent(Health);
      if (!enemyTransform || !enemyHealth || entity.id === this.playerEntity?.id) continue;

      const enemyPosition = enemyTransform.position;
      this.meleeQueryToEnemy.subVectors(enemyPosition, playerPosition);
      const distance = this.meleeQueryToEnemy.length();

      if (distance <= meleeRange) {
        this.meleeQueryToEnemyFlat.copy(this.meleeQueryToEnemy);
        this.meleeQueryToEnemyFlat.y = 0;
        if (this.meleeQueryToEnemyFlat.lengthSq() < 1e-8) {
          enemiesHit++;
          if (dealDamage && combatSystem && this.playerEntity) {
            const damageResult = calculateDamage(baseDamage, this.currentWeapon);
            const actualDamage = damageResult.damage;
            combatSystem.queueDamage(entity, actualDamage, this.playerEntity, 'melee', this.playerEntity?.userData?.playerId, damageResult.isCritical);
          }
        } else {
          this.meleeQueryToEnemyFlat.normalize();
          if (this.meleeQueryToEnemyFlat.dot(direction) > MELEE_ARC_MIN_DOT) {
            enemiesHit++;
            if (dealDamage && combatSystem && this.playerEntity) {
              const damageResult = calculateDamage(baseDamage, this.currentWeapon);
              const actualDamage = damageResult.damage;
              combatSystem.queueDamage(entity, actualDamage, this.playerEntity, 'melee', this.playerEntity?.userData?.playerId, damageResult.isCritical);
            }
          }
        }
      }
    }

    return enemiesHit;
  }

  /** Same readiness as `dispatchAbility` → `SWORD_E` (Charge). */
  private canAttemptSwordChargeMovement(): boolean {
    return (
      !this.isSwordCharging &&
      !this.isDeflecting &&
      !this.isSwinging &&
      !this.isSmiting &&
      !this.isDeathGrasping &&
      !this.isWraithStriking &&
      !this.isBarrageCharging &&
      !this.isViperStingCharging &&
      !this.isCobraShotCharging
    );
  }

  private checkForDashInput(movement: Movement, transform: Transform): void {
    // Prevent dashing while dead and waiting to respawn
    if (this.isPlayerDead) {
      return;
    }

    // Check for double-tap on movement keys
    const dashDirections = ControlSystem.DASH_DIRECTIONS;

    for (const { key, direction } of dashDirections) {
      if (this.inputManager.checkDoubleTap(key)) {
        const worldDirection = this.getWorldSpaceDirection(direction);
        const currentTime = Date.now() / 1000;

        let handled = false;
        if (
          key === 'w' &&
          this.currentWeapon === WeaponType.RUNEBLADE &&
          shouldApplyCycloneRushTalent(this.talentLoadout) &&
          currentTime - this.lastCycloneRushChargeTime >= CYCLONE_RUSH_CHARGE_COOLDOWN_SEC &&
          this.canAttemptSwordChargeMovement() &&
          movement.getAvailableDashCharges() >= 1
        ) {
          if (this.performBladeRushChargeFromForwardDash(transform)) {
            const consumed = movement.consumeDashChargesWithoutDash(1, currentTime);
            this.tryManaShieldOnDashChargeExpended(consumed);
            handled = true;
          }
        }

        if (!handled) {
          let dashStarted = movement.startDash(worldDirection, transform.position, currentTime);
          let bloodOrbDash = false;

          if (
            !dashStarted &&
            shouldApplyBloodOrbsTalent(this.talentLoadout) &&
            movement.getAvailableDashCharges() === 0
          ) {
            const health = this.playerEntity?.getComponent(Health);
            if (
              health &&
              !health.isDead &&
              health.currentHealth > BLOOD_ORBS_DASH_HP_COST
            ) {
              dashStarted = movement.startDashWithoutCharge(
                worldDirection,
                transform.position,
                currentTime,
              );
              if (dashStarted) {
                bloodOrbDash = true;
                this.onBloodOrbDashCallback?.();
              }
            }
          }

          if (dashStarted) {
            if (!bloodOrbDash) {
              this.tryManaShieldOnDashChargeExpended(1);
            }
            this.audioSystem?.playUIDashSound();
            this.tryTriggerRoomBoomDashTalent(key, movement, transform.position, worldDirection);
            if (
              (this.currentWeapon === WeaponType.RUNEBLADE ||
                this.currentWeapon === WeaponType.SABRES) &&
              shouldApplyDashGuardTalent(this.talentLoadout)
            ) {
              this.applyDashGuardEffect(transform);
            }
            if (
              this.currentWeapon === WeaponType.RUNEBLADE &&
              shouldApplyExecutionerTalent(this.talentLoadout)
            ) {
              this.executionerBuffDeadlineMs = Date.now() + EXECUTIONER_POST_DASH_WINDOW_MS;
            }
          }
        }

        if (handled || movement.isDashing) {
          this.inputManager.resetDoubleTap(key);
        }

        break;
      }
    }
  }

  private tryTriggerRoomBoomDashTalent(
    key: RoomBoomDashKey,
    movement: Movement,
    originPosition: Vector3,
    worldDirection: Vector3,
  ): void {
    if (!this.onRoomBoomDashCallback) return;

    const nowMs = Date.now();
    let variant: RoomBoomDashVariant | null = null;

    if (key === 'w' && shouldApplyInfernalDashTalent(this.talentLoadout)) {
      variant = 'infernal';
    } else if (
      key === 's' &&
      shouldApplyGlacialDashTalent(this.talentLoadout) &&
      nowMs - this.lastGlacialDashRoomBoomMs >= GLACIAL_DASH_COOLDOWN_MS
    ) {
      variant = 'glacial';
    } else if (
      shouldApplyMendingDashTalent(this.talentLoadout) &&
      nowMs - this.lastMendingDashRoomBoomMs >= MENDING_DASH_COOLDOWN_MS
    ) {
      variant = 'mending';
    } else if (
      shouldApplyStaggeringDashTalent(this.talentLoadout) &&
      nowMs - this.lastStaggeringDashRoomBoomMs >= STAGGERING_DASH_COOLDOWN_MS
    ) {
      variant = 'staggering';
    }

    if (!variant) return;

    const origin = originPosition.clone();
    const direction = worldDirection.clone().normalize();
    const destination = origin.clone().add(direction.clone().multiplyScalar(movement.dashDistance));

    if (!this.isInsidePlayableArena(destination.x, destination.z, this.playableRadius)) {
      return;
    }

    if (variant === 'glacial') this.lastGlacialDashRoomBoomMs = nowMs;
    else if (variant === 'mending') this.lastMendingDashRoomBoomMs = nowMs;
    else if (variant === 'staggering') this.lastStaggeringDashRoomBoomMs = nowMs;

    this.onRoomBoomDashCallback({
      variant,
      key,
      origin,
      destination,
      direction,
    });
  }

  private handleKnockbackMovement(movement: Movement, transform: Transform): void {
    if (!movement.isKnockbacked) return;

    const currentTime = Date.now() / 1000;
    const knockbackResult = movement.updateKnockback(currentTime);

    if (knockbackResult.newPosition) {
      transform.position.copy(knockbackResult.newPosition);
    }
  }

  private handleDashMovement(movement: Movement, transform: Transform): void {
    if (!movement.isDashing) return;

    const currentTime = Date.now() / 1000; // Convert to seconds
    const dashResult = movement.updateDash(currentTime);

    if (dashResult.newPosition) {
      const MAX_DASH_BOUNDS = this.playableRadius;
      const { x, z } = dashResult.newPosition;

      if (this.isInsidePlayableArena(x, z, MAX_DASH_BOUNDS)) {
        transform.position.copy(dashResult.newPosition);
      } else {
        // Cancel dash if it would move too far from origin
        // console.warn(`Dash cancelled: would move too far from origin (${distanceFromOrigin.toFixed(2)} > ${MAX_DASH_BOUNDS})`);
        movement.cancelDash();
      }
    }
  }

  private handleChargeMovement(movement: Movement, transform: Transform): void {
    if (!movement.isCharging) return;

    // If player died during charge, cancel it
    if (this.isPlayerDead) {
      movement.cancelCharge();
      return;
    }

    const currentTime = Date.now() / 1000; // Convert to seconds
    
    // Check if charge was stopped by collision
    if (this.chargeStoppedByCollision) {
      movement.cancelCharge();
      return;
    }
    
    const chargeResult = movement.updateCharge(currentTime);

    if (chargeResult.newPosition) {
      const MAX_CHARGE_BOUNDS = this.playableRadius;
      const { x, z } = chargeResult.newPosition;

      // Check for pillar collision
      const pillarCollision = this.checkPillarCollision(chargeResult.newPosition);

      if (!this.isInsidePlayableArena(x, z, MAX_CHARGE_BOUNDS)) {
        // Cancel charge if it would move too far from origin
        movement.cancelCharge();
        // Notify sword component that charge was cancelled
        this.onChargeComplete();
      } else if (pillarCollision.hasCollision) {
        // Cancel charge if it would collide with a pillar
        movement.cancelCharge();
        // Notify sword component that charge was cancelled
        this.onChargeComplete();
      } else if (!this.chargeStoppedByCollision) {
        // Only update position if not stopped by collision
        transform.position.copy(chargeResult.newPosition);
      }
    }

    if (chargeResult.isComplete || this.chargeStoppedByCollision) {
      // Notify sword component that charge is complete
      this.onChargeComplete();
    }
  }

  // Castle wall segments — mirrors CastleWalls perimeter (AABB half-extents)
  private readonly WALL_SEGMENTS = [
    { cx: 0,   cz:  CASTLE_WALL_Z_OFFSET,  hx: MAIN_MAP_HALF_X + CASTLE_WALL_HALF_THICKNESS * 2, hz: CASTLE_WALL_HALF_THICKNESS },
    { cx: 0,   cz: -CASTLE_WALL_Z_OFFSET,  hx: MAIN_MAP_HALF_X + CASTLE_WALL_HALF_THICKNESS * 2, hz: CASTLE_WALL_HALF_THICKNESS },
    { cx:  CASTLE_WALL_X_OFFSET, cz: 0,  hx: CASTLE_WALL_HALF_THICKNESS, hz: MAIN_MAP_HALF_Z + CASTLE_WALL_HALF_THICKNESS * 2 },
    { cx: -CASTLE_WALL_X_OFFSET, cz: 0,  hx: CASTLE_WALL_HALF_THICKNESS, hz: MAIN_MAP_HALF_Z + CASTLE_WALL_HALF_THICKNESS * 2 },
  ];
  private readonly WALL_PLAYER_RADIUS = 0.5;

  private isInsidePlayableArena(x: number, z: number, radius: number): boolean {
    if (this.arenaBoundaryMode === 'hex') {
      const apothem = radius * Math.cos(Math.PI / 6) - this.WALL_PLAYER_RADIUS;
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        if (x * Math.cos(a) + z * Math.sin(a) > apothem) return false;
      }
      return true;
    }
    if (this.arenaBoundaryMode === 'square') {
      return isInsideMainArenaXZ(x, z, MAIN_ARENA_BOUNDS);
    }
    return isInsideMainArenaXZ(x, z, radius);
  }

  private checkPillarCollision(position: Vector3): { hasCollision: boolean; normal: Vector3; pillarCenter: Vector3 } {
    if (this.castleWallChargeEnabled) {
      const mtn = this.checkCornerMountainChargeCollision(position);
      if (mtn.hasCollision) {
        return mtn;
      }
      const wallResult = this.checkWallCollision(position);
      return {
        hasCollision: wallResult.hasCollision,
        normal: wallResult.normal,
        pillarCenter: new Vector3(position.x, 0, position.z),
      };
    }

    const horizontalPos = new Vector3(position.x, 0, position.z);
    for (const p of this.thronePillarChargeObstacles) {
      const center = new Vector3(p.x, 0, p.z);
      const dist = horizontalPos.distanceTo(center);
      if (dist < p.radius + this.WALL_PLAYER_RADIUS) {
        let normal = horizontalPos.clone().sub(center);
        if (normal.lengthSq() < 1e-6) {
          normal.set(1, 0, 0);
        } else {
          normal.normalize();
        }
        return { hasCollision: true, normal, pillarCenter: center };
      }
    }

    return { hasCollision: false, normal: new Vector3(), pillarCenter: new Vector3() };
  }

  private checkCornerMountainChargeCollision(
    position: Vector3,
  ): { hasCollision: boolean; normal: Vector3; pillarCenter: Vector3 } {
    const horizontalPos = new Vector3(position.x, 0, position.z);
    const r = this.WALL_PLAYER_RADIUS;
    for (const p of this.chargeCornerMountains) {
      const center = new Vector3(p.x, 0, p.z);
      const dist = horizontalPos.distanceTo(center);
      if (dist < p.radius + r) {
        let normal = horizontalPos.clone().sub(center);
        if (normal.lengthSq() < 1e-6) {
          normal.set(1, 0, 0);
        } else {
          normal.normalize();
        }
        return { hasCollision: true, normal, pillarCenter: center };
      }
    }
    return { hasCollision: false, normal: new Vector3(), pillarCenter: new Vector3() };
  }

  private checkWallCollision(position: Vector3): { hasCollision: boolean; normal: Vector3 } {
    const r = this.WALL_PLAYER_RADIUS;
    for (const wall of this.WALL_SEGMENTS) {
      const dx = Math.abs(position.x - wall.cx);
      const dz = Math.abs(position.z - wall.cz);
      if (dx < wall.hx + r && dz < wall.hz + r) {
        // Find the axis with the smallest overlap to determine the push normal
        const overlapX = (wall.hx + r) - dx;
        const overlapZ = (wall.hz + r) - dz;
        let normal: Vector3;
        if (overlapX < overlapZ) {
          normal = new Vector3(position.x > wall.cx ? 1 : -1, 0, 0);
        } else {
          normal = new Vector3(0, 0, position.z > wall.cz ? 1 : -1);
        }
        return { hasCollision: true, normal };
      }
    }
    return { hasCollision: false, normal: new Vector3() };
  }

  private getWorldSpaceDirection(inputDirection: Vector3): Vector3 {
    const { cameraForward, cameraRight } = this.getCameraMovementBasis();

    const worldDirection = new Vector3();
    worldDirection.addScaledVector(cameraRight, inputDirection.x);
    worldDirection.addScaledVector(cameraForward, -inputDirection.z);
    worldDirection.normalize();

    return worldDirection;
  }



  private performCharge(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastChargeTime < this.chargeCooldown) {
      return;
    }
    if (!this.executeChargeCore(playerTransform, currentTime)) {
      return;
    }
    this.lastChargeTime = currentTime;
  }

  /** Cyclone Rush: Charge movement without advancing E-key cooldown; gated by `lastCycloneRushChargeTime`. */
  private performBladeRushChargeFromForwardDash(playerTransform: Transform): boolean {
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastCycloneRushChargeTime < CYCLONE_RUSH_CHARGE_COOLDOWN_SEC) {
      return false;
    }
    if (!this.executeChargeCore(playerTransform, currentTime)) {
      return false;
    }
    this.lastCycloneRushChargeTime = currentTime;
    return true;
  }

  /** Shared Charge execution after cooldown checks. Sets `isSwordCharging` only if `startCharge` succeeds. */
  private executeChargeCore(playerTransform: Transform, currentTime: number): boolean {
    this.audioSystem?.playSwordChargeSound(playerTransform.position);
    this.chargeStoppedByCollision = false;

    if (this.onChargeCallback) {
      const cbDir = new Vector3();
      this.camera.getWorldDirection(cbDir);
      cbDir.normalize();
      this.onChargeCallback(playerTransform.position.clone(), cbDir);
    }

    if (!this.playerEntity) {
      return false;
    }
    const playerMovement = this.playerEntity.getComponent(Movement);
    if (!playerMovement) {
      return false;
    }

    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();

    const chargeStarted = playerMovement.startCharge(direction, playerTransform.position, currentTime);
    if (!chargeStarted) {
      return false;
    }

    this.isSwordCharging = true;
    this.scheduleChargeDamage(playerTransform, direction, currentTime);
    return true;
  }

  // Track charge hit entities to prevent multiple hits and enable collision stopping
  private chargeHitEntities = new Set<number>();
  private activeAbilityIntervals = new Set<ReturnType<typeof setInterval>>();

  private trackAbilityInterval(interval: ReturnType<typeof setInterval>): void {
    this.activeAbilityIntervals.add(interval);
  }

  private clearTrackedAbilityInterval(interval: ReturnType<typeof setInterval>): void {
    clearInterval(interval);
    this.activeAbilityIntervals.delete(interval);
  }

  private clearAllAbilityIntervals(): void {
    for (const interval of Array.from(this.activeAbilityIntervals)) {
      clearInterval(interval);
    }
    this.activeAbilityIntervals.clear();
  }
  private chargeStoppedByCollision = false;

  // Schedule damage detection during charge movement
  private scheduleChargeDamage(playerTransform: Transform, chargeDirection: Vector3, startTime: number): void {
    const chargeDuration = 0.6; 
    const damageCheckInterval = 50; // Check for damage every 50ms for better collision detection
    const chargeDamage = 75; // Damage for charge ability
    const chargeRadius = 3.5; // Damage radius around player during charge
    
    // Reset charge hit tracking
    this.chargeHitEntities.clear();
    this.chargeStoppedByCollision = false;
    
    const damageInterval = setInterval(() => {
      const currentTime = Date.now() / 1000;
      
      // Stop if charge is complete, cancelled, or stopped by collision
      if (!this.isSwordCharging || currentTime - startTime > chargeDuration || this.chargeStoppedByCollision) {
        this.clearTrackedAbilityInterval(damageInterval);
        return;
      }
      
      // Get nearby entities for charge collision / damage
      const playerPosition = playerTransform.position;
      const chargeQueryRadius = chargeRadius + 2.5;
      const candidates = this.queryNearbyEntities(playerPosition, chargeQueryRadius);

      let hitSomething = false;
      
      // Debug: Log all entities in the world during charge
      
      // ENHANCED: Also check against server player positions directly as a fallback
      // This ensures we don't miss collisions due to entity sync issues
      const serverPlayers = (window as any).pvpPlayers || new Map();
      const localSocketId = (window as any).localSocketId;
            
      serverPlayers.forEach((serverPlayer: any, playerId: string) => {
        // Skip self
        if (playerId === localSocketId) return;
        
        // Skip already hit players (use hash of player ID for tracking)
        const playerIdHash = playerId.length * 1000 + playerId.charCodeAt(0);
        if (this.chargeHitEntities.has(playerIdHash)) return;
        
        const serverPlayerPos = new Vector3(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
        const distance = playerPosition.distanceTo(serverPlayerPos);
        const stopDistance = 0.9 + 1.0; // Player collision radius + buffer
        
        
        if (distance <= stopDistance && serverPlayer.health > 0) {
          this.chargeHitEntities.add(playerIdHash);
          hitSomething = true;
          
          // Apply damage through PVP system if available
          if (this.onProjectileCreatedCallback) {
            this.onProjectileCreatedCallback('sword_charge_hit', playerPosition.clone(), chargeDirection.clone(), {
              damage: chargeDamage,
              targetId: playerId,
              hitPosition: {
                x: serverPlayerPos.x,
                y: serverPlayerPos.y,
                z: serverPlayerPos.z
              }
            });
          }
        }
      });
      
      candidates.forEach(entity => {
        // Skip self
        if (entity.id === this.playerEntity?.id) return;
        
        // Skip already hit entities
        if (this.chargeHitEntities.has(entity.id)) return;
        
        // Check if entity has transform and health (could be enemy or player)
        const entityTransform = entity.getComponent(Transform);
        const entityHealth = entity.getComponent(Health);
        const entityCollider = entity.getComponent(Collider);
        
        // Debug: Log entity details
        const enemy = entity.getComponent(Enemy);
        const entityType = enemy ? `Enemy(${enemy.getDisplayName()})` : `Player(${entity.id})`;
        
        if (!entityTransform || !entityHealth || entityHealth.isDead) return;
        
        const entityPosition = entityTransform.position;
        const distance = playerPosition.distanceTo(entityPosition);
        
        // Check if entity is within charge damage radius
        // In PVP, we want to stop just before hitting the enemy, not overlap with them
        const stopDistance = entityCollider ? entityCollider.radius + 1.0 : chargeRadius; // Stop 1 unit away from enemy edge
        
        // Debug: Log position and distance information
        
        if (distance <= stopDistance) {
          // Mark as hit to prevent multiple hits
          this.chargeHitEntities.add(entity.id);
          hitSomething = true;
          
          // Apply damage through combat system
          const combatSystem = this.world.getSystem(CombatSystem);
          if (combatSystem && this.playerEntity) {
            combatSystem.queueDamage(entity, chargeDamage, this.playerEntity, 'charge', this.playerEntity?.userData?.playerId);
            
            const enemy = entity.getComponent(Enemy);
            const entityType = enemy ? `Enemy(${enemy.getDisplayName()})` : `Player(${entity.id})`;
            
            // Broadcast charge attack for PVP (includes damage and animation)
            if (this.onProjectileCreatedCallback) {
              this.onProjectileCreatedCallback('sword_charge_hit', playerPosition.clone(), chargeDirection.clone(), {
                damage: chargeDamage,
                targetId: entity.id,
                hitPosition: {
                  x: entityPosition.x,
                  y: entityPosition.y,
                  z: entityPosition.z
                }
              });
            }
          }
        }
      });
      
      // In PVP mode, stop charge when hitting something
      if (hitSomething) {
        this.chargeStoppedByCollision = true;
        
        // Stop the charge movement immediately
        if (this.playerEntity) {
          const playerMovement = this.playerEntity.getComponent(Movement);
          if (playerMovement) {
            playerMovement.cancelCharge();
          }
        }
        
        // Clear the damage interval immediately to prevent further hits
        this.clearTrackedAbilityInterval(damageInterval);
        
        // Trigger charge completion
        this.onChargeComplete();
      }
    }, damageCheckInterval);
    this.trackAbilityInterval(damageInterval);
  }

  // Called by sword component when Charge completes
  public onChargeComplete(): void {
    this.isSwordCharging = false;
  }

  private performDeflect(
    playerTransform: Transform,
    options?: { fromAegisRoom?: boolean },
  ): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    let isOverrideBypass = false;
    if (currentTime - this.lastDeflectTime < this.deflectCooldown) {
      if (!this.tryOverrideShieldBypass(currentTime)) return;
      isOverrideBypass = true;
    }

    this.clearTalentBarrierEndTimeout();
    this.wraithGuardOwnsBarrier = false;
    this.wraithGuardShieldActive = false;
    this.wraithGuardBarrierEndMs = 0;
    this.colossusGuardOwnsBarrier = false;
    this.colossusGuardShieldActive = false;
    this.colossusGuardBarrierEndMs = 0;
    this.guardComboOwnsBarrier = false;
    this.guardComboShieldActive = false;
    this.guardComboBarrierEndMs = 0;
    this.dashGuardOwnsBarrier = false;
    this.dashGuardShieldActive = false;
    this.dashGuardBarrierEndMs = 0;
    this.sabresPurpleGuardOwnsBarrier = false;
    this.sabresPurpleGuardShieldActive = false;
    this.sabresPurpleGuardBarrierEndMs = 0;
    if (this.deflectBarrier.isBarrierActive()) {
      this.deflectBarrier.deactivate();
    }

    this.isDeflecting = true;
    this.aegisRoomDeflectActive = options?.fromAegisRoom === true;
    if (!isOverrideBypass) {
      this.lastDeflectTime = currentTime;
    }

    // Play deflect sound
    this.audioSystem?.playSwordDeflectSound(playerTransform.position);

    // Trigger Deflect callback for multiplayer
    if (this.onDeflectCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.normalize();
      this.onDeflectCallback(
        playerTransform.position.clone(),
        direction,
        this.aegisRoomDeflectActive ? { aegisRoomBoon: true } : undefined,
      );
    }
    
    // Set up deflect barrier that blocks damage and reflects projectiles
    this.setupDeflectBarrier(playerTransform, this.deflectDuration);
    
    // Auto-complete deflect after duration
    this.scheduleAbilityTimeout(() => {
      this.onDeflectComplete();
    }, this.deflectDuration * 1000);
  }

  private performViperSting(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    let isBloodmageBypass = false;

    if (this.syncViperStingDoubleTalonsMode()) {
      this.advanceViperStingChargeRecharges(currentTime);
      if (this.viperStingCharges <= 0) {
        if (!this.tryBloodmageDashBypass(currentTime)) return;
        isBloodmageBypass = true;
      } else if (
        currentTime - this.lastViperStingDoubleTalonsChargeSpendTime <
        REAPING_TALONS_DOUBLE_TALONS_INTERNAL_COOLDOWN_SEC
      ) {
        return;
      }
    } else if (currentTime - this.lastViperStingTime < this.viperStingFireRate) {
      if (!this.tryBloodmageDashBypass(currentTime)) return;
      isBloodmageBypass = true;
    }

    if (this.viperStingDoubleTalonsActive && !isBloodmageBypass) {
      this.viperStingCharges--;
      this.lastViperStingDoubleTalonsChargeSpendTime = currentTime;
      if (
        this.viperStingCharges < REAPING_TALONS_DOUBLE_TALONS_MAX_CHARGES &&
        this.viperStingNextChargeAt === null
      ) {
        this.viperStingNextChargeAt = currentTime + this.viperStingFireRate;
      }
    } else if (!isBloodmageBypass) {
      this.lastViperStingTime = currentTime;
    }

    this.isViperStingCharging = true;
    this.viperStingChargeProgress = 0;

    // Play bow draw sound when starting to charge
    this.audioSystem?.playBowDrawSound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 1000; // 1 second charge time
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.viperStingChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.viperStingChargeProgress >= 1.0) {
        this.clearTrackedAbilityInterval(chargeInterval);

        // Play viper sting release sound when firing
        this.audioSystem?.playViperStingReleaseSound(playerTransform.position);

        this.fireViperSting(playerTransform);
        this.isViperStingCharging = false;
        this.viperStingChargeProgress = 0;
      }
    }, 16); // ~60fps updates
    this.trackAbilityInterval(chargeInterval);
  }

  private fireViperSting(playerTransform: Transform): void {
    
    // Get player position and direction
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825; // Shoot from chest level
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply same downward angle compensation as other projectiles
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Offset spawn position slightly forward to avoid collision with player
    const spawnPosition = playerPosition.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    
    // Note: Viper Sting damage is handled by ViperStingManager, not ECS projectiles
    // This prevents duplicate projectiles and damage
    
    // Trigger Viper Sting callback for visual effects
    if (this.onViperStingCallback) {
      const explosiveTalons = shouldApplyExplosiveTalonsTalent(this.talentLoadout, this.abilityLoadout);
      this.onViperStingCallback(playerPosition, direction, { explosiveTalons });
    }
    
    // Trigger the global Viper Sting manager for visual effects
    triggerGlobalViperSting();
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('viper_sting_projectile', spawnPosition, direction, {
        speed: 18,
        damage: 91,
        lifetime: 5,
        isReturning: false,
        explosiveTalons: shouldApplyExplosiveTalonsTalent(this.talentLoadout, this.abilityLoadout),
      });
    }
  }

  private performRejuvenatingShot(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastRejuvenatingShotTime < this.rejuvenatingShotFireRate) {
      return;
    }

    this.isRejuvenatingShotCharging = true;
    this.rejuvenatingShotChargeProgress = 0;
    this.lastRejuvenatingShotTime = currentTime;

    // Play bow draw sound when starting to charge (same as other bow abilities)
    this.audioSystem?.playBowDrawSound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 700; // 0.8 second charge time (shorter than Barrage)

    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.rejuvenatingShotChargeProgress = Math.min(elapsed / chargeDuration, 1.0);

      if (this.rejuvenatingShotChargeProgress >= 1.0) {
        this.clearTrackedAbilityInterval(chargeInterval);
        this.fireRejuvenatingShot(playerTransform);
        this.isRejuvenatingShotCharging = false;
        this.rejuvenatingShotChargeProgress = 0;
      }
    }, 16); // ~60fps updates
    this.trackAbilityInterval(chargeInterval);
  }

  private fireRejuvenatingShot(playerTransform: Transform): void {
    // Get player position and direction (same as other projectiles)
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 0.825; // Shoot from chest level like Cobra Shot
    
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply same downward angle compensation as other projectiles
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Offset spawn position slightly forward to avoid collision with player
    const spawnPosition = playerPosition.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward

    // Play bow release sound (reuse existing bow sound)
    this.audioSystem?.playBowReleaseSound(playerTransform.position);

    // Trigger Rejuvenating Shot callback for multiplayer broadcast
    if (this.onRejuvenatingShotCallback) {
      this.onRejuvenatingShotCallback(spawnPosition, direction);
    }
    
    // Trigger global rejuvenating shot for local visual effects
    triggerGlobalRejuvenatingShot(spawnPosition, direction);
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('rejuvenating_shot_projectile', spawnPosition, direction, {
        speed: 20, // Consistent speed for multiplayer
        healAmount: 80,
        lifetime: 8
      });
    }
  }

  private performBarrage(playerTransform: Transform): void {
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    let isOverrideBypass = false;
    if (currentTime - this.lastBarrageTime < this.barrageFireRate) {
      if (!this.tryOverrideShieldBypass(currentTime)) return;
      isOverrideBypass = true;
    }

    this.isBarrageCharging = true;
    this.barrageChargeProgress = 0;
    if (!isOverrideBypass) {
      this.lastBarrageTime = currentTime;
    }

    // Play bow draw sound when starting to charge
    this.audioSystem?.playBowDrawSound(playerTransform.position);

    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 500; // 1 second charge time
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.barrageChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.barrageChargeProgress >= 1.0) {
        this.clearTrackedAbilityInterval(chargeInterval);

        // Play barrage release sound when firing
        this.audioSystem?.playBarrageReleaseSound(playerTransform.position);

        this.fireBarrage(playerTransform);
        this.isBarrageCharging = false;
        this.barrageChargeProgress = 0;
      }
    }, 16); // ~60fps updates
    this.trackAbilityInterval(chargeInterval);
  }

  private fireBarrage(playerTransform: Transform): void {
    this.barrageVolleyGeneration++;
    const volleyGeneration = this.barrageVolleyGeneration;

    const getCompensatedAim = (): { playerPosition: Vector3; direction: Vector3 } => {
      const playerPosition = playerTransform.getWorldPosition();
      playerPosition.y += 0.825; // Shoot from chest level
      const dir = new Vector3();
      this.camera.getWorldDirection(dir);
      const compensationAngle = Math.PI / 6; // 30 degrees — same as projectile system
      const cameraRight = new Vector3();
      cameraRight.crossVectors(dir, new Vector3(0, 1, 0)).normalize();
      const rotationMatrix = new Matrix4().makeRotationAxis(cameraRight, compensationAngle);
      dir.applyMatrix4(rotationMatrix);
      dir.normalize();
      return { playerPosition, direction: dir };
    };

    const { playerPosition: initialPos, direction: initialDir } = getCompensatedAim();

    // Fan left→right: far left (+30°), left (+15°), center, right (−15°), far right (−30°)
    const fanAngles = [
      Math.PI / 6,
      Math.PI / 12,
      0,
      -Math.PI / 12,
      -Math.PI / 6,
    ];
    const angles = computeConcentratedVolleyTalentActive(this.talentLoadout, this.abilityLoadout)
      ? Array.from({ length: 5 }, () => 0)
      : fanAngles;

    const wrathfulBiteBarrage = shouldApplyWrathfulBiteTalent(this.talentLoadout, this.abilityLoadout);
    const wyvernBiteBarrage = shouldApplyWyvernBiteTalent(this.talentLoadout, this.abilityLoadout);
    const staggeringBiteBarrage = shouldApplyStaggeringBiteTalent(this.talentLoadout, this.abilityLoadout);
    const glacialBiteBarrage = shouldApplyGlacialBiteTalent(this.talentLoadout, this.abilityLoadout);
    const entanglementBarrage = shouldApplyEntanglementTalent(this.talentLoadout, this.abilityLoadout);

    if (this.onBarrageCallback) {
      this.onBarrageCallback(initialPos.clone(), initialDir.clone());
    }

    for (let index = 0; index < angles.length; index++) {
      const angle = angles[index]!;
      this.scheduleAbilityTimeout(() => {
        if (volleyGeneration !== this.barrageVolleyGeneration) return;
        if (!this.playerEntity) return;

        const { playerPosition, direction: baseDirection } = getCompensatedAim();
        const projectileDirection = baseDirection.clone();
        const yRot = new Matrix4().makeRotationY(angle);
        projectileDirection.applyMatrix4(yRot);
        projectileDirection.normalize();

        const spawnPosition = playerPosition.clone();
        spawnPosition.add(projectileDirection.clone().multiplyScalar(1));

        const projectileConfig = {
          speed: 30, // Slightly faster than regular arrows (20)
          damage: 79, // High damage for barrage arrows
          lifetime: 8,
          maxDistance: 16, // Limit barrage arrows to 25 units distance (same as regular arrows)
          piercing: false,
          subclass: this.currentSubclass,
          level: 1,
          opacity: 1.0,
          sourcePlayerId: this.playerEntity?.userData?.playerId || 'unknown',
          wrathfulBiteBarrage,
          wyvernBiteBarrage,
          staggeringBiteBarrage,
          glacialBiteBarrage,
          entanglementBarrage,
          ...(staggeringBiteBarrage ? { staggerToAdd: STAGGERING_BITE_BARRAGE_STAGGER_PER_HIT } : {}),
        };

        const projectileEntity = this.projectileSystem.createProjectile(
          this.world,
          spawnPosition,
          projectileDirection,
          this.playerEntity.id,
          projectileConfig
        );

        const renderer = projectileEntity.getComponent(Renderer) as Renderer;
        if (renderer?.mesh) {
          renderer.mesh.userData.isBarrageArrow = true;
          renderer.mesh.userData.isRegularArrow = false;
          if (wrathfulBiteBarrage) {
            renderer.mesh.userData.barrageWrathfulBite = true;
          }
          if (wyvernBiteBarrage) {
            renderer.mesh.userData.barrageWyvernBite = true;
          }
          if (staggeringBiteBarrage) {
            renderer.mesh.userData.barrageStaggeringBite = true;
          }
          if (glacialBiteBarrage) {
            renderer.mesh.userData.barrageGlacialBite = true;
          }
          if (entanglementBarrage) {
            renderer.mesh.userData.barrageEntanglement = true;
          }
        }

        if (this.onProjectileCreatedCallback) {
          this.onProjectileCreatedCallback(
            'barrage_projectile',
            spawnPosition,
            projectileDirection,
            projectileConfig,
          );
        }
      }, index * ControlSystem.BARRAGE_ARROW_STAGGER_MS);
    }
  }

  private fireFanOfKnivesFan(playerTransform: Transform): void {
    if (!shouldApplyFanOfKnivesTalent(this.talentLoadout) || !this.playerEntity) return;

    this.fanOfKnivesVolleyGeneration++;
    const volleyGeneration = this.fanOfKnivesVolleyGeneration;

    const getCompensatedAim = (): { playerPosition: Vector3; direction: Vector3 } => {
      const playerPosition = playerTransform.getWorldPosition();
      playerPosition.y += 0.825;
      const dir = new Vector3();
      this.camera.getWorldDirection(dir);
      const compensationAngle = Math.PI / 6;
      const cameraRight = new Vector3();
      cameraRight.crossVectors(dir, new Vector3(0, 1, 0)).normalize();
      const rotationMatrix = new Matrix4().makeRotationAxis(cameraRight, compensationAngle);
      dir.applyMatrix4(rotationMatrix);
      dir.normalize();
      return { playerPosition, direction: dir };
    };

    const fanAnglesRad = [-Math.PI / 12, 0, Math.PI / 12];
    const flourishTint = getFanOfKnivesFlourishTintFromLoadout(this.talentLoadout);
    const staggeringFlourishKnives =
      shouldApplyStaggeringFlourishTalent(this.talentLoadout) ? STAGGERING_FLOURISH_STAGGER : undefined;
    const infestedFlourishFanKnives = shouldApplyInfestedFlourishTalent(this.talentLoadout) ? true : undefined;

    for (let index = 0; index < fanAnglesRad.length; index++) {
      const angle = fanAnglesRad[index]!;
      this.scheduleAbilityTimeout(() => {
        if (volleyGeneration !== this.fanOfKnivesVolleyGeneration) return;
        if (!this.playerEntity) return;

        const { playerPosition, direction: baseDirection } = getCompensatedAim();
        const projectileDirection = baseDirection.clone();
        const yRot = new Matrix4().makeRotationY(angle);
        projectileDirection.applyMatrix4(yRot);
        projectileDirection.normalize();

        const spawnPosition = playerPosition.clone();
        spawnPosition.add(projectileDirection.clone().multiplyScalar(1));

        const projectileConfig = {
          speed: FAN_OF_KNIVES_PROJECTILE_SPEED,
          damage: getFanOfKnivesProjectileDamage(
            this.allocatedPlayerStats,
            this.talentLoadout,
            this.abilityLoadout,
          ),
          lifetime: FAN_OF_KNIVES_PROJECTILE_LIFETIME_SEC,
          maxDistance: FAN_OF_KNIVES_MAX_DISTANCE_UNITS,
          piercing: false,
          projectileType: 'fan_of_knives',
          subclass: this.currentSubclass,
          level: 1,
          opacity: 1,
          sourcePlayerId: this.playerEntity?.userData?.playerId || 'unknown',
          fanOfKnivesFlourishTint: flourishTint,
          ...(staggeringFlourishKnives != null ? { staggerToAdd: staggeringFlourishKnives } : {}),
          ...(infestedFlourishFanKnives ? { infestedFlourishFanKnives: true as const } : {}),
        };

        const projectileEntity = this.projectileSystem.createProjectile(
          this.world,
          spawnPosition,
          projectileDirection,
          this.playerEntity.id,
          projectileConfig,
        );

        const renderer = projectileEntity.getComponent(Renderer) as Renderer;
        if (renderer?.mesh) {
          renderer.mesh.userData.isFanOfKnivesDagger = true;
          renderer.mesh.userData.fanOfKnivesFlourishTint = flourishTint;
          if (infestedFlourishFanKnives) {
            renderer.mesh.userData.infestedFlourishFanKnives = true;
          }
        }

        if (this.onProjectileCreatedCallback) {
          this.onProjectileCreatedCallback(
            'fan_of_knives_projectile',
            spawnPosition,
            projectileDirection,
            projectileConfig,
          );
        }
      }, index * ControlSystem.BARRAGE_ARROW_STAGGER_MS);
    }
  }

  private setupDeflectBarrier(playerTransform: Transform, invulnerableDurationSec: number = 3): void {
    // Activate the deflect barrier
    const playerPosition = playerTransform.getWorldPosition();
    const playerRotation = new Vector3(0, 0, 0);
    
    // Use SAME rotation logic as DragonRenderer for consistency with visual shield
    if (this.playerEntity) {
      const movement = this.playerEntity.getComponent(Movement);
      if (movement && movement.inputStrength > 0.1) {
        // Player is actively moving - use movement direction (same as DragonRenderer)
        const moveDir = movement.moveDirection;
        if (moveDir.length() > 0.1) {
          const moveAngle = Math.atan2(moveDir.x, moveDir.z);
          playerRotation.y = moveAngle;
        }
      } else {
        // Not moving - use camera direction (same as DragonRenderer fallback)
        const cameraDirection = new Vector3();
        this.camera.getWorldDirection(cameraDirection);
        playerRotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
      }
    }
    
    this.deflectBarrier.activate(
      playerPosition,
      playerRotation,
      this.playerEntity || undefined,
      invulnerableDurationSec,
    );
  }

  private clearTalentBarrierEndTimeout(): void {
    if (this.talentBarrierEndTimeout !== null) {
      clearTimeout(this.talentBarrierEndTimeout);
      this.talentBarrierEndTimeout = null;
    }
  }

  private finishTalentBarrierTeardown(): void {
    if (
      !this.isDeflecting &&
      (this.wraithGuardOwnsBarrier ||
        this.colossusGuardOwnsBarrier ||
        this.guardComboOwnsBarrier ||
        this.dashGuardOwnsBarrier ||
        this.sabresPurpleGuardOwnsBarrier)
    ) {
      if (this.deflectBarrier.isBarrierActive()) {
        this.deflectBarrier.deactivate();
      }
    }
    this.wraithGuardOwnsBarrier = false;
    this.wraithGuardShieldActive = false;
    this.wraithGuardBarrierEndMs = 0;
    this.colossusGuardOwnsBarrier = false;
    this.colossusGuardShieldActive = false;
    this.colossusGuardBarrierEndMs = 0;
    this.guardComboOwnsBarrier = false;
    this.guardComboShieldActive = false;
    this.guardComboBarrierEndMs = 0;
    this.dashGuardOwnsBarrier = false;
    this.dashGuardShieldActive = false;
    this.dashGuardBarrierEndMs = 0;
    this.sabresPurpleGuardOwnsBarrier = false;
    this.sabresPurpleGuardShieldActive = false;
    this.sabresPurpleGuardBarrierEndMs = 0;
  }

  private onTalentBarrierTeardown(): void {
    this.talentBarrierEndTimeout = null;
    if (this.isDeflecting) {
      return;
    }
    const now = Date.now();
    let maxEnd = 0;
    if (this.wraithGuardShieldActive && this.wraithGuardBarrierEndMs > now) {
      maxEnd = Math.max(maxEnd, this.wraithGuardBarrierEndMs);
    }
    if (this.colossusGuardShieldActive && this.colossusGuardBarrierEndMs > now) {
      maxEnd = Math.max(maxEnd, this.colossusGuardBarrierEndMs);
    }
    if (this.guardComboShieldActive && this.guardComboBarrierEndMs > now) {
      maxEnd = Math.max(maxEnd, this.guardComboBarrierEndMs);
    }
    if (this.dashGuardShieldActive && this.dashGuardBarrierEndMs > now) {
      maxEnd = Math.max(maxEnd, this.dashGuardBarrierEndMs);
    }
    if (this.sabresPurpleGuardShieldActive && this.sabresPurpleGuardBarrierEndMs > now) {
      maxEnd = Math.max(maxEnd, this.sabresPurpleGuardBarrierEndMs);
    }
    if (maxEnd > now) {
      this.talentBarrierEndTimeout = this.scheduleAbilityTimeout(
        () => this.onTalentBarrierTeardown(),
        maxEnd - now,
      );
      return;
    }
    this.finishTalentBarrierTeardown();
  }

  private rescheduleTalentBarrierTeardown(): void {
    this.clearTalentBarrierEndTimeout();
    if (this.isDeflecting) {
      return;
    }
    const now = Date.now();
    let maxEnd = 0;
    if (this.wraithGuardShieldActive) {
      maxEnd = Math.max(maxEnd, this.wraithGuardBarrierEndMs);
    }
    if (this.colossusGuardShieldActive) {
      maxEnd = Math.max(maxEnd, this.colossusGuardBarrierEndMs);
    }
    if (this.guardComboShieldActive) {
      maxEnd = Math.max(maxEnd, this.guardComboBarrierEndMs);
    }
    if (this.dashGuardShieldActive) {
      maxEnd = Math.max(maxEnd, this.dashGuardBarrierEndMs);
    }
    if (this.sabresPurpleGuardShieldActive) {
      maxEnd = Math.max(maxEnd, this.sabresPurpleGuardBarrierEndMs);
    }
    if (maxEnd <= now) {
      this.finishTalentBarrierTeardown();
      return;
    }
    this.talentBarrierEndTimeout = this.scheduleAbilityTimeout(
      () => this.onTalentBarrierTeardown(),
      maxEnd - now,
    );
  }

  private applyWraithGuardEffect(playerTransform: Transform): void {
    this.audioSystem?.playSwordDeflectSound(playerTransform.position);
    const health = this.playerEntity?.getComponent(Health);

    if (this.deflectBarrier.isBarrierActive()) {
      if (health) {
        health.addInvulnerabilityTime(WRAITH_GUARD_DURATION_SEC, true);
      }
      if (this.isDeflecting) {
        return;
      }
      this.wraithGuardShieldActive = true;
      this.wraithGuardBarrierEndMs = Date.now() + WRAITH_GUARD_DURATION_SEC * 1000;
      this.rescheduleTalentBarrierTeardown();
      return;
    }

    this.wraithGuardOwnsBarrier = true;
    this.wraithGuardShieldActive = true;
    this.wraithGuardBarrierEndMs = Date.now() + WRAITH_GUARD_DURATION_SEC * 1000;
    this.setupDeflectBarrier(playerTransform, WRAITH_GUARD_DURATION_SEC);
    this.rescheduleTalentBarrierTeardown();
  }

  public tryColossusGuardProcFromSmiteBeamHit(): void {
    if (!this.playerEntity) return;
    const playerTransform = this.playerEntity.getComponent(Transform);
    if (!playerTransform) return;
    if (!shouldApplyColossusGuardTalent(this.talentLoadout, this.abilityLoadout)) return;
    if (Math.random() >= COLOSSUS_GUARD_PROC_CHANCE) return;
    this.applyColossusGuardEffect(playerTransform);
  }

  public tryGuardComboProcFromRunebladeBasicHit(): void {
    if (!this.playerEntity) return;
    if (this.currentWeapon !== WeaponType.RUNEBLADE) return;
    if (!shouldApplyGuardComboTalent(this.talentLoadout)) return;
    if (Math.random() >= GUARD_COMBO_PROC_CHANCE) return;
    const playerTransform = this.playerEntity.getComponent(Transform);
    if (!playerTransform) return;
    this.applyGuardComboEffect(playerTransform);
  }

  private tryGuardSabresSwipesBladeProc(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    if (this.currentWeapon !== WeaponType.SABRES) return;
    if (!shouldApplyGuardSabresSwipesTalent(this.talentLoadout)) return;
    if (Math.random() >= GUARD_SABRES_SWIPES_PROC_CHANCE) return;
    this.applySabresPurpleGuardEffect(playerTransform);
  }

  /** Psionic Blades — bonus Intellect-scaled damage + slice VFX on each LMB blade hit. */
  private tryPsionicBladesProc(
    target: Entity,
    attackDirection: Vector3,
    bladeSide: 'left' | 'right',
  ): void {
    if (!this.playerEntity) return;
    if (this.currentWeapon !== WeaponType.SABRES) return;
    if (!shouldApplyPsionicBladesTalent(this.talentLoadout)) return;

    const targetHealth = target.getComponent(Health);
    if (!targetHealth || targetHealth.isDead) return;

    const intellect = this.allocatedPlayerStats.intellect ?? 0;
    const procDamage = getPsionicBladesProcDamage(intellect);
    const combatSystem = this.world.getSystem(CombatSystem);
    if (!combatSystem) return;

    const pid = this.playerEntity.userData?.playerId;
    combatSystem.queueDamage(
      target,
      procDamage,
      this.playerEntity,
      'psionic_blades',
      pid,
      false,
    );

    combatSystem.addPsionicBladeSliceEffect(
      target.id.toString(),
      attackDirection,
      bladeSide,
    );
  }

  /** Windfury proc + Flurry heal — called once per Runeblade swing after real hits (Runeblade.tsx). */
  public notifyRunebladePrimaryHits(enemiesHit: number): void {
    if (!this.playerEntity) return;
    if (this.currentWeapon !== WeaponType.RUNEBLADE) return;
    const playerTransform = this.playerEntity.getComponent(Transform);
    if (!playerTransform) return;
    if (enemiesHit > 0) {
      this.tryWindfuryProcAfterPrimaryHit(playerTransform);
      this.tryCrusaderProcFromRunebladePrimaryHit(playerTransform);
      this.tryBlizzardProcFromRunebladePrimaryHit(playerTransform);
    }
    this.applyFlurryHealingForPrimaryHits(playerTransform, enemiesHit);
  }

  private applyGuardComboEffect(playerTransform: Transform): void {
    this.audioSystem?.playSwordDeflectSound(playerTransform.position);
    const health = this.playerEntity?.getComponent(Health);

    if (this.deflectBarrier.isBarrierActive()) {
      if (health) {
        health.addInvulnerabilityTime(GUARD_COMBO_DURATION_SEC, true);
      }
      if (this.isDeflecting) {
        return;
      }
      this.guardComboShieldActive = true;
      this.guardComboBarrierEndMs = Date.now() + GUARD_COMBO_DURATION_SEC * 1000;
      this.rescheduleTalentBarrierTeardown();
      return;
    }

    this.guardComboOwnsBarrier = true;
    this.guardComboShieldActive = true;
    this.guardComboBarrierEndMs = Date.now() + GUARD_COMBO_DURATION_SEC * 1000;
    this.setupDeflectBarrier(playerTransform, GUARD_COMBO_DURATION_SEC);
    this.rescheduleTalentBarrierTeardown();
  }

  private applyDashGuardEffect(playerTransform: Transform): void {
    this.audioSystem?.playSwordDeflectSound(playerTransform.position);
    const health = this.playerEntity?.getComponent(Health);

    if (this.deflectBarrier.isBarrierActive()) {
      if (health) {
        health.addInvulnerabilityTime(DASH_GUARD_DURATION_SEC, true);
      }
      if (this.isDeflecting) {
        return;
      }
      this.dashGuardShieldActive = true;
      this.dashGuardBarrierEndMs = Date.now() + DASH_GUARD_DURATION_SEC * 1000;
      this.rescheduleTalentBarrierTeardown();
      return;
    }

    this.dashGuardOwnsBarrier = true;
    this.dashGuardShieldActive = true;
    this.dashGuardBarrierEndMs = Date.now() + DASH_GUARD_DURATION_SEC * 1000;
    this.setupDeflectBarrier(playerTransform, DASH_GUARD_DURATION_SEC);
    this.rescheduleTalentBarrierTeardown();
  }

  private applySabresPurpleGuardEffect(playerTransform: Transform): void {
    this.audioSystem?.playSwordDeflectSound(playerTransform.position);
    const health = this.playerEntity?.getComponent(Health);

    if (this.deflectBarrier.isBarrierActive()) {
      if (health) {
        health.addInvulnerabilityTime(GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC, true);
      }
      if (this.isDeflecting) {
        return;
      }
      this.sabresPurpleGuardShieldActive = true;
      this.sabresPurpleGuardBarrierEndMs =
        Date.now() + GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC * 1000;
      this.rescheduleTalentBarrierTeardown();
      return;
    }

    this.sabresPurpleGuardOwnsBarrier = true;
    this.sabresPurpleGuardShieldActive = true;
    this.sabresPurpleGuardBarrierEndMs =
      Date.now() + GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC * 1000;
    this.setupDeflectBarrier(playerTransform, GUARD_SABRES_PURPLE_SHIELD_DURATION_SEC);
    this.rescheduleTalentBarrierTeardown();
  }

  private applyColossusGuardEffect(playerTransform: Transform): void {
    this.audioSystem?.playSwordDeflectSound(playerTransform.position);
    const health = this.playerEntity?.getComponent(Health);
    const now = Date.now();
    const currentColRem = this.colossusGuardShieldActive
      ? Math.max(0, (this.colossusGuardBarrierEndMs - now) / 1000)
      : 0;
    const newRem = Math.min(currentColRem + COLOSSUS_GUARD_STACK_SEC, COLOSSUS_GUARD_MAX_REMAINING_SEC);
    if (newRem <= 0) return;

    const invulnDelta = newRem - currentColRem;
    this.colossusGuardBarrierEndMs = now + newRem * 1000;
    this.colossusGuardShieldActive = true;

    if (this.deflectBarrier.isBarrierActive()) {
      if (health && invulnDelta > 0) {
        health.addInvulnerabilityTime(invulnDelta, true);
      }
      if (this.isDeflecting) {
        return;
      }
      this.rescheduleTalentBarrierTeardown();
      return;
    }

    this.colossusGuardOwnsBarrier = true;
    this.setupDeflectBarrier(playerTransform, newRem);
    this.rescheduleTalentBarrierTeardown();
  }

  private updateDeflectBarrier(playerTransform: Transform): void {
    // Update deflect barrier position if it's active
    if (this.deflectBarrier.isBarrierActive()) {
      const playerPosition = playerTransform.getWorldPosition();
      const playerRotation = new Vector3(0, 0, 0);
      
      // Use SAME rotation logic as DragonRenderer for consistency with visual shield
      if (this.playerEntity) {
        const movement = this.playerEntity.getComponent(Movement);
        if (movement && movement.inputStrength > 0.1) {
          // Player is actively moving - use movement direction (same as DragonRenderer)
          const moveDir = movement.moveDirection;
          if (moveDir.length() > 0.1) {
            const moveAngle = Math.atan2(moveDir.x, moveDir.z);
            playerRotation.y = moveAngle;
          }
        } else {
          // Not moving - use camera direction (same as DragonRenderer fallback)
          const cameraDirection = new Vector3();
          this.camera.getWorldDirection(cameraDirection);
          playerRotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
        }
      }
      
      // Update barrier position to follow player
      this.deflectBarrier.updatePosition(playerPosition, playerRotation);
    }
  }

  // Called by sword component when Deflect completes
  public onDeflectComplete(): void {
    this.isDeflecting = false;
    this.aegisRoomDeflectActive = false;
    this.clearTalentBarrierEndTimeout();
    this.wraithGuardOwnsBarrier = false;
    this.wraithGuardShieldActive = false;
    this.wraithGuardBarrierEndMs = 0;
    this.colossusGuardOwnsBarrier = false;
    this.colossusGuardShieldActive = false;
    this.colossusGuardBarrierEndMs = 0;
    this.guardComboOwnsBarrier = false;
    this.guardComboShieldActive = false;
    this.guardComboBarrierEndMs = 0;
    this.dashGuardOwnsBarrier = false;
    this.dashGuardShieldActive = false;
    this.dashGuardBarrierEndMs = 0;
    this.sabresPurpleGuardOwnsBarrier = false;
    this.sabresPurpleGuardShieldActive = false;
    this.sabresPurpleGuardBarrierEndMs = 0;
    this.deflectBarrier.deactivate();
  }

  public isWraithGuardShieldActive(): boolean {
    return this.wraithGuardShieldActive;
  }

  public isColossusGuardShieldActive(): boolean {
    return this.colossusGuardShieldActive;
  }

  public isGuardComboShieldActive(): boolean {
    return this.guardComboShieldActive;
  }

  public isDashGuardShieldActive(): boolean {
    return this.dashGuardShieldActive;
  }

  public isSabresPurpleGuardShieldActive(): boolean {
    return this.sabresPurpleGuardShieldActive;
  }

  public isAegisRoomDeflectActive(): boolean {
    return this.aegisRoomDeflectActive;
  }

  /** DeflectShield palette for local player — purple room boon uses distinct Scythe/Bow themes. */
  public getAegisShieldPaletteVariant(): AegisPaletteVariant {
    if (!this.aegisRoomDeflectActive) return 'default';
    if (
      this.currentWeapon === WeaponType.SCYTHE ||
      this.currentWeapon === WeaponType.BOW
    ) {
      return 'purple_room_boon';
    }
    return 'default';
  }

  /** Duration (seconds) for local DeflectShield VFX while Aegis or talent guard shield is showing. */
  public getDeflectShieldDurationSec(): number {
    if (this.isDeflecting) {
      return this.deflectDuration;
    }
    const now = Date.now();
    let maxRem = 0;
    if (this.wraithGuardShieldActive) {
      maxRem = Math.max(maxRem, Math.max(0, (this.wraithGuardBarrierEndMs - now) / 1000));
    }
    if (this.colossusGuardShieldActive) {
      maxRem = Math.max(maxRem, Math.max(0, (this.colossusGuardBarrierEndMs - now) / 1000));
    }
    if (this.guardComboShieldActive) {
      maxRem = Math.max(maxRem, Math.max(0, (this.guardComboBarrierEndMs - now) / 1000));
    }
    if (this.dashGuardShieldActive) {
      maxRem = Math.max(maxRem, Math.max(0, (this.dashGuardBarrierEndMs - now) / 1000));
    }
    if (this.sabresPurpleGuardShieldActive) {
      maxRem = Math.max(maxRem, Math.max(0, (this.sabresPurpleGuardBarrierEndMs - now) / 1000));
    }
    if (maxRem > 0) {
      return Math.max(maxRem, 0.25);
    }
    return this.deflectDuration;
  }



  // Public methods to get cooldown information for UI
  public getWeaponSwitchCooldown(): { current: number; max: number } {
    const currentTime = Date.now() / 1000;
    return {
      current: Math.max(0, this.weaponSwitchCooldown - (currentTime - this.lastWeaponSwitchTime)),
      max: this.weaponSwitchCooldown
    };
  }

  public switchWeaponBySlot(slot: 1 | 2): void {
    const currentTime = Date.now() / 1000;

    // Prevent rapid weapon switching
    if (currentTime - this.lastWeaponSwitchTime < this.weaponSwitchCooldown) {
      return;
    }

    let weaponType: WeaponType | undefined;

    if (slot === 1 && this.selectedWeapons?.primary) {
      weaponType = this.selectedWeapons.primary;
    } else if (slot === 2 && this.selectedWeapons?.secondary) {
      weaponType = this.selectedWeapons.secondary;
    }

    if (weaponType && this.currentWeapon !== weaponType) {
      this.switchToWeapon(weaponType, currentTime);
    }
  }

  public getAbilityCooldowns(): Record<
    string,
    { current: number; max: number; isActive: boolean; charges?: number; maxCharges?: number }
  > {
    const currentTime = Date.now() / 1000;
    const cooldowns: Record<string, { current: number; max: number; isActive: boolean }> = {};

    // If a loadout is assigned, return per-slot cooldowns based on it
    if (this.abilityLoadout) {
      const slots: Array<'Q' | 'E' | 'R'> = ['Q', 'E', 'R'];
      for (const slot of slots) {
        const id = this.abilityLoadout[slot];
        if (id) {
          cooldowns[slot] = this.getCooldownForAbility(id, currentTime);
        }
      }
      return cooldowns;
    }

    // Legacy fallback: weapon-type-based cooldowns (used when no loadout is set)
    if (this.currentWeapon === WeaponType.SWORD) {
      cooldowns['Q'] = {
        current: Math.max(0, this.deflectCooldown - (currentTime - this.lastDeflectTime)),
        max: this.deflectCooldown,
        isActive: this.isDeflecting
      };
      cooldowns['E'] = {
        current: Math.max(0, this.chargeCooldown - (currentTime - this.lastChargeTime)),
        max: this.chargeCooldown,
        isActive: this.isSwordCharging
      };
      cooldowns['R'] = {
        current: Math.max(0, this.colossusStrikeCooldown - (currentTime - this.lastColossusStrikeTime)),
        max: this.colossusStrikeCooldown,
        isActive: this.isColossusStriking
      };
      cooldowns['F'] = {
        current: Math.max(0, this.windShearCooldown - (currentTime - this.lastWindShearTime)),
        max: this.windShearCooldown,
        isActive: this.isWindShearCharging
      };
    } else if (this.currentWeapon === WeaponType.BOW) {
      cooldowns['Q'] = {
        current: Math.max(0, this.barrageFireRate - (currentTime - this.lastBarrageTime)),
        max: this.barrageFireRate,
        isActive: this.isBarrageCharging
      };
      cooldowns['E'] = {
        current: Math.max(0, this.cobraShotFireRate - (currentTime - this.lastCobraShotTime)),
        max: this.cobraShotFireRate,
        isActive: false
      };
      cooldowns['R'] = this.getViperStingCooldownInfo(currentTime);
      cooldowns['F'] = {
        current: Math.max(0, this.rejuvenatingShotFireRate - (currentTime - this.lastRejuvenatingShotTime)),
        max: this.rejuvenatingShotFireRate,
        isActive: this.isRejuvenatingShotCharging
      };
    } else if (this.currentWeapon === WeaponType.SCYTHE) {
      cooldowns['Q'] = {
        current: Math.max(0, REANIMATE_SUNWELL_COOLDOWN_SEC - (currentTime - this.lastReanimateTime)),
        max: REANIMATE_SUNWELL_COOLDOWN_SEC,
        isActive: false
      };
      cooldowns['E'] = {
        current: Math.max(0, this.frostNovaFireRate - (currentTime - this.lastFrostNovaTime)),
        max: this.frostNovaFireRate,
        isActive: false
      };
      cooldowns['R'] = this.getCrossentropyCooldownHud(currentTime);
      cooldowns['F'] = this.getSummonTotemCooldownInfo(currentTime);
      cooldowns['F'].isActive = this.isSummonTotemCharging;
    } else if (this.currentWeapon === WeaponType.SABRES) {
      cooldowns['Q'] = this.getBackstabCooldownInfo(currentTime);
      cooldowns['E'] = {
        current: Math.max(0, this.sunderCooldown - (currentTime - this.lastSunderTime)),
        max: this.sunderCooldown,
        isActive: this.isSundering
      };
      cooldowns['R'] = {
        current: Math.max(0, this.skyfallCooldown - (currentTime - this.lastSkyfallTime)),
        max: this.skyfallCooldown,
        isActive: this.isSkyfalling
      };
      cooldowns['F'] = {
        current: Math.max(0, this.stealthCooldown - (currentTime - this.lastStealthTime)),
        max: this.stealthCooldown,
        isActive: this.isStealthing
      };
    } else if (this.currentWeapon === WeaponType.RUNEBLADE) {
      // RUNEBLADE abilities
      cooldowns['Q'] = {
        current: Math.max(0, this.deathGraspCooldown - (currentTime - this.lastDeathGraspTime)),
        max: this.deathGraspCooldown,
        isActive: this.isDeathGrasping
      };
      cooldowns['E'] = this.getWraithStrikeCooldownInfo(currentTime);
      cooldowns['R'] = {
        current: Math.max(0, this.smiteCooldown - (currentTime - this.lastSmiteTime)),
        max: this.smiteCooldown,
        isActive: this.isSmiting
      };
      cooldowns['F'] = {
        current: this.corruptedAuraActive ? 0 : 0, // No cooldown, just active/inactive state
        max: 1,
        isActive: this.corruptedAuraActive
      };
    } else if (this.currentWeapon === WeaponType.SPEAR) {
      // SPEAR abilities
      cooldowns['Q'] = {
        current: Math.max(0, this.throwSpearCooldown - (currentTime - this.lastThrowSpearTime)),
        max: this.throwSpearCooldown,
        isActive: this.isThrowSpearCharging
      };
      cooldowns['E'] = {
        current: Math.max(0, this.whirlwindCooldown - (currentTime - this.lastWhirlwindTime)),
        max: this.whirlwindCooldown,
        isActive: this.isWhirlwindCharging || this.isWhirlwinding
      };
      cooldowns['F'] = {
        current: Math.max(0, this.flurryCooldown - (currentTime - this.lastFlurryTime)),
        max: this.flurryCooldown,
        isActive: this.isFlurryActive
      };
      cooldowns['R'] = {
        current: Math.max(0, this.lightningStormCooldown - (currentTime - this.lastLightningStormTime)),
        max: this.lightningStormCooldown,
        isActive: false // Lightning Storm is instant, no active state
      };
    }

    return cooldowns;
  }

  /** Register a timeout so dispose() can clear orphaned ability timers. */
  private scheduleAbilityTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout> {
    const id = setTimeout(() => {
      this.scheduledAbilityTimeouts.delete(id);
      callback();
    }, delayMs);
    this.scheduledAbilityTimeouts.add(id);
    return id;
  }

  private clearScheduledAbilityTimeouts(): void {
    for (const id of Array.from(this.scheduledAbilityTimeouts)) {
      clearTimeout(id);
    }
    this.scheduledAbilityTimeouts.clear();
    this.talentBarrierEndTimeout = null;
  }

  public dispose(): void {
    this.clearScheduledAbilityTimeouts();
  }

  public onDisable(): void {
    this.dispose();
  }
}