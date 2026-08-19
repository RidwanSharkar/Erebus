'use client';

import '@/utils/installAssetLoadQueue';
import React, { Profiler, useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Matrix4, Camera, PerspectiveCamera, Scene, WebGLRenderer, PCFSoftShadowMap, Color, Quaternion, Euler, Group, AdditiveBlending, MeshBasicMaterial, Mesh, MeshStandardMaterial, FogExp2 } from '@/utils/three-exports';
import { ENABLE_REALTIME_SHADOWS } from '@/utils/renderConfig';
import DragonRenderer from './dragon/DragonRenderer';
import CharacterRenderer from './character/CharacterRenderer';
import { warmupCharacterIdleGltf, warmupCharacterLocomotionGltf } from '@/components/character/CharacterModel';
import SummonedBossSkeleton from './enemies/SummonedBossSkeleton';
import KnightRenderer from './enemies/KnightRenderer';
import AlliedKnightRenderer from './enemies/AlliedKnightRenderer';
import AlliedHealerRenderer from './enemies/AlliedHealerRenderer';
import GreaterHealBeamEffect from './enemies/GreaterHealBeamEffect';
import ShadeRenderer from './enemies/ShadeRenderer';
import ViperArrowProjectile, { VIPER_ARROW_MAX_RANGE } from './enemies/ViperArrowProjectile';
import ViperShotTelegraphLine from './enemies/ViperShotTelegraphLine';
import WeaverRenderer from './enemies/WeaverRenderer';
import WeaverHealEffect from './enemies/WeaverHealEffect';
import WeaverLightningStrike from './enemies/WeaverLightningStrike';
import GhoulRenderer from './enemies/GhoulRenderer';
import MartyrRenderer from './enemies/MartyrRenderer';
import TentacleSpineRenderer from './enemies/TentacleSpineRenderer';
import MartyrDetonationTelegraph from './enemies/MartyrDetonationTelegraph';
import MartyrDetonationExplosion from './enemies/MartyrDetonationExplosion';
import DeathFlashExplosion, { type DeathFlashScale } from './enemies/DeathFlashExplosion';
import ZombieRenderer from './enemies/ZombieRenderer';
import GhoulSummonRitual from './enemies/GhoulSummonRitual';
import InfestedZombieRiseVFX from './enemies/InfestedZombieRiseVFX';
import VenomEffect from './projectiles/VenomEffect';
import EnemySummonFlameVFX from './enemies/EnemySummonFlameVFX';
import StaggerProcLightning from './enemies/StaggerProcLightning';
import KnightSmiteLightning, { type KnightSmiteLightningVariant } from './enemies/KnightSmiteLightning';
import KnightFrostProjectile, { KnightFrostImpact } from './enemies/KnightFrostProjectile';
import KnightDeathGraspProjectile from './enemies/KnightDeathGraspProjectile';
import WarlockProjectile from './enemies/WarlockProjectile';
import WarlockFlameStrike from './enemies/WarlockFlameStrike';
import WarlockVoidBoltExplosion from './enemies/WarlockVoidBoltExplosion';
import GreedFireProjectile from './enemies/GreedFireProjectile';
import GreedEmberPatch from './enemies/GreedEmberPatch';
import Meteor from './enemies/Meteor';
import CrossentropyMeteor from './projectiles/CrossentropyMeteor';
import CrossentropyExplosion from './projectiles/CrossentropyExplosion';
import CloudkillArrow from './projectiles/CloudkillArrow';
import BossLeapTelegraph from './enemies/BossLeapTelegraph';
import BossSpearProjectile from './enemies/BossSpearProjectile';
import BossLeapShockwave, { type LeapShockwaveVariant } from './enemies/BossLeapShockwave';
import Boss2ArchonLightning from './enemies/Boss2ArchonLightning';
import Boss3NovaDiscs, { type Boss3NovaBurst } from './enemies/Boss3NovaDiscs';
import TitanStompShockwave, { type TitanStompShockwaveBurst } from './enemies/TitanStompShockwave';
import TitanCannonAbility from './enemies/TitanCannonAbility';
import GoldPileDropEffect from './enemies/GoldPileDropEffect';
import WoodPileDropEffect from './environment/WoodPileDropEffect';
import StonePileDropEffect from './environment/StonePileDropEffect';
import MeatPileDropEffect from './environment/MeatPileDropEffect';
import GoldCollectMoteEffect from './enemies/GoldCollectMoteEffect';
import BowShotImpact from './weapons/BowShotImpact';
import EntropicBoltImpact from './weapons/EntropicBoltImpact';
import SabreImpactEffect from './weapons/SabreImpactEffect';
import MortalStrikeEffect from './weapons/MortalStrikeEffect';
import PsionicBladeSliceEffect from './weapons/PsionicBladeSliceEffect';
import PlayerHitBurst from './weapons/PlayerHitBurst';
import FrozenEffect from './weapons/FrozenEffect';
import StunnedEffect from './weapons/StunnedEffect';
import type { ImpactEffectEvent } from '@/utils/ImpactEffectManager';
import { DEFAULT_ENTROPIC_COLOR_VARIANT } from '@/utils/entropicColorThemes';
import {
  EREBUS_PLAYER_DAMAGE_FEEDBACK_EVENT,
  type PlayerDamageFeedbackTone,
} from '@/utils/playerDamageFeedbackEvent';
import {
  applyIncomingCoopDamage,
  isLocalPlayerMeleeTelegraphTarget,
  setPetEvasionChanceProvider,
  showIncomingAttackMissNumber,
} from '@/utils/applyIncomingCoopDamage';
import {
  dispatchMeleeHitStop,
  meleeImpactDirection,
  meleeImpactPosition,
  meleeShakeForWeightClass,
  normalizeMeleeWeightClass,
  playIncomingMeleeImpactSound,
  playIncomingMeleeWhiffSound,
} from '@/utils/meleeHitFeel';
import {
  PET_UPGRADE_EVASION_CHANCE,
  PET_UPGRADE_EVASION_RANGE,
  PET_UPGRADE_PERSISTENCE_HUNTER_RANGE,
} from '@/utils/petCompanionUpgrades';
import { resolveFaeBeastCompanionId } from '@/utils/faeBeastCompanion';
import {
  POST_SPIKE_CRACK_HOLD_MS,
  SPIKE_CRACK_FADE_MS,
} from './enemies/BossTectonicSpikeTelegraph';
import CoopProjectileLayer, { type CoopProjectileLayerHandle } from './coop/CoopProjectileLayer';
import CoopBossTelegraphLayer, { type CoopBossTelegraphLayerHandle } from './coop/CoopBossTelegraphLayer';
import CoopGroundTelegraphLayer, { type CoopGroundTelegraphLayerHandle } from './coop/CoopGroundTelegraphLayer';
import CoopBossMechanicLayer, { type CoopBossMechanicLayerHandle } from './coop/CoopBossMechanicLayer';
import CoopExplosionBurstLayer, { type CoopExplosionBurstLayerHandle } from './coop/CoopExplosionBurstLayer';
import CoopLightningBurstLayer, { type CoopLightningBurstLayerHandle } from './coop/CoopLightningBurstLayer';
import CoopGroundHazardLayer, { type CoopGroundHazardLayerHandle } from './coop/CoopGroundHazardLayer';
import CoopSummonRitualLayer, { type CoopSummonRitualLayerHandle } from './coop/CoopSummonRitualLayer';
import CoopAllyCombatLayer, { type CoopAllyCombatLayerHandle } from './coop/CoopAllyCombatLayer';
import CoopCombatFeedbackLayer, { type CoopCombatFeedbackLayerHandle } from './coop/CoopCombatFeedbackLayer';
import CoopEnvironmentVfxLayer, { type CoopEnvironmentVfxLayerHandle } from './coop/CoopEnvironmentVfxLayer';
import CoopTentacleSpineLayer, { type CoopTentacleSpineLayerHandle } from './coop/CoopTentacleSpineLayer';
import CoopEnemyRenderLayer from './coop/layers/CoopEnemyRenderLayer';
import CoopEnvironmentSceneLayer from './coop/layers/CoopEnvironmentSceneLayer';
import { SKY_INDIGO_NIGHT } from './environment/CustomSky';
import CoopPvpAbilityLayer, { type CoopPvpAbilityLayerHandle } from './coop/CoopPvpAbilityLayer';
import type {
  BossLeapShockwaveState,
  BossSpearState,
  CloudkillArrowState,
  CrossentropyMeteorState,
  DeflectSmiteEffectState,
  LocustProjectileEffectState,
  DualityBlizzardState,
  GoldCollectMoteState,
  KnightFrostProjectileState,
  MeteorState,
  ShadeDaggerState,
  ViperArrowState,
  WarlockFlameStrikeState,
  WarlockProjectileState,
  MedusaProjectileState,
  WeaverLightningState,
} from './coop/coopVfxLayerTypes';
import { applyPlayerMove, getPlayerLivePosition, getPlayerLiveRotation } from '@/utils/playerLiveTransform';
import { EXPLORE_PLAYER_VIEW_RADIUS, exploreFog } from '@/utils/exploreFogOfWar';
import { setExploreObstacleListener } from '@/utils/exploreObstacles';
import {
  EXPLORE_CAMP_INTERACT_RADIUS,
  exploreCampCollideRadius,
  type ExploreCampPublic,
} from '@/utils/exploreCamps';
import { setExploreMushroomListener } from '@/utils/exploreMushrooms';
import { setExploreTreeListener } from '@/utils/exploreTrees';
import { setExploreRootListener } from '@/utils/exploreRoots';
import { setExploreRockListener, type ExploreRockInstance } from '@/utils/exploreRocks';
import { setExploreSpineListener, type ExploreSpineInstance } from '@/utils/exploreSpines';
import type { ExploreTreeInstance } from '@/utils/exploreTreeLayout';
import type { ExploreRootInstance } from '@/utils/exploreGroundPropLayout';
import BuildPlacementGhost from '@/components/environment/BuildPlacementGhost';
import {
  EXPLORE_BUILDING_DEFS,
  EXPLORE_BUILDING_ROOT_ORDER,
  EXPLORE_TOWER_CATEGORY_HOTKEY,
  EXPLORE_TOWER_PICK_ORDER,
  EXPLORE_BARRACKS_INTERACT_RADIUS,
  EXPLORE_FIRE_PIT_INTERACT_RADIUS,
  EXPLORE_FIRE_PIT_HEAL_MEAT_COST,
  EXPLORE_MEAT_STACK_CAP,
  EXPLORE_RESEARCH_INTERACT_RADIUS,
  EXPLORE_RESEARCH_UPGRADES,
  EXPLORE_SHRINE_INTERACT_RADIUS,
  EXPLORE_OBELISK_INTERACT_RADIUS,
  EXPLORE_CATHEDRAL_INTERACT_RADIUS,
  EXPLORE_SHRINE_GIFTS,
  FIRE_PIT_HULL_RADIUS,
  EXPLORE_TOWER_HULL_RADIUS,
  RESEARCH_STATION_HULL_RADIUS,
  SHRINE_HULL_RADIUS,
  OBELISK_HULL_RADIUS,
  CATHEDRAL_HULL_RADIUS,
  EXPLORE_OBELISK_TALENT_GOLD_COST,
  exploreBuildingRequiresSpiritLounge,
  exploreBuildingRequiresShrineOrObelisk,
  getExploreLowHungerMaxEnergyBonus,
  isExploreTowerType,
  isPlayerExploreBuildingType,
  type ExploreBuildingKind,
  type ExploreCathedralOfferEntry,
} from '@/utils/exploreBuildings';
import type { ExploreBuildingPlacementRules, ExploreObstacleDisc } from '@/utils/exploreBuildingPlacement';
import { getExploreMushroom } from '@/utils/exploreWorldGen';
import { useMultiplayerActions, useMultiplayerRoom, Player, EnemyDamageMeta, type Enemy as ServerEnemy, type GoldDrop, type WoodDrop, type StoneDrop, type MeatDrop, type PlayerMovementDirection, type BroadcastPlayerAttackAnimationData } from '@/contexts/MultiplayerContext';
import { ALLY_CHOICE_CARDS } from '@/utils/coopAllyChoice';
import type { CoopAllyKind } from '@/utils/coopAllyTargeting';
import { RULEBOOK_CLASS_TALENTS, type CoopRulebookWeapon } from '@/data/rulebookContent';
import {
  findNearestSelectableAllyCandidate,
  getAllyRecruitHintLabel,
  type IntroAllyChoiceEncounterRef,
} from '@/utils/coopAllyChoice';
import {
  isSunkenSentinelSelectable,
  type SunkenSentinelEncounterRef,
} from '@/utils/sunkenSentinelEncounter';
import {
  isEternityPalaceLootSelectable,
  type EternityPalaceEncounterRef,
} from '@/utils/eternityPalaceEncounter';
import { SkillPointData } from '@/utils/SkillPointSystem';
import {
  AbilityLoadout,
  getDefaultLoadoutForWeapon,
  syncBowLoadoutRForAspect,
  syncRunebladeLoadoutRForAspect,
  syncSabresLoadoutRForAspect,
  isDeathGraspPullImmune,
  DEATH_GRASP_TAUNT_MS,
  DEATH_GRASP_PULL_DURATION_MS,
  DEATH_GRASP_STANDOFF,
} from '@/utils/weaponAbilities';
import {
  TENTACLE_GROUND_TELEGRAPH_LEAD_MS,
  TENTACLE_SPINE_IMPACT_TELEGRAPH_MS,
  TENTACLE_SPINE_TELEGRAPH_COLOR,
  TENTACLE_SPINE_TELEGRAPH_STRIP_WIDTH,
  TENTACLE_SPINE_WINDUP_MS,
} from '@/utils/tentacleSpineClientConstants';
import {
  shouldApplyInfestedSmiteTalent,
  shouldApplyInfernalSmiteTalent,
  shouldApplyVengeanceSmiteTalent,
  shouldApplyStaggeringSmiteTalent,
  shouldApplyCycloneRushChargeSpin,
  shouldApplyStaggeringComboTalent,
  shouldApplyWrathfulComboTalent,
  shouldApplyInfestedComboTalent,
  shouldApplyGuardComboTalent,
  shouldApplyWrathfulTalonsTalent,
  shouldApplyExecuteTalent,
  shouldApplyGiantKillerTalent,
  shouldApplyStaggeringTalonsTalent,
  shouldApplyExplosiveTalonsTalent,
  shouldApplyWyvernTalonsTalent,
  shouldApplyGlacialTalonsTalent,
  shouldApplyArcticStingTalent,
  shouldApplyHighCaliberTalent,
  getStaggerProcBaseDamage,
  getEnabledTalentIds,
  getArcticBlizzardDamagePerTickFromStats,
  getArcticBlizzardHitRadius,
  getRunebladeBlizzardStormHitRadius,
  getBlizzardParticleSpawnMultiplier,
  getDualCoilLateralVector,
  CROSSENTROPY_MAX_TRAVEL_DISTANCE,
  REANIMATE_SUNWELL_HEAL,
  shouldApplyBlizzardTalent,
  shouldApplyTitansGripTalent,
  shouldApplyPsionicBladesTalent,
  getRunebladeBlizzardDamagePerTickFromStats,
  shouldApplySpellbladeTalent,
  SPELLBLADE_INTELLECT_BONUS,
  shouldApplyParryTalent,
  PARRY_INTELLECT_BONUS,
  PARRY_STRENGTH_BONUS,
  shouldApplyBreathWeaponTalent,
  STAGGERING_BITE_BARRAGE_STAGGER_PER_HIT,
  getTotemBoltVariantFromTalentLoadout,
  shouldApplySuperconductorTalent,
  shouldApplyInfernalDashTalent,
  shouldApplyGlacialDashTalent,
  shouldApplyMendingDashTalent,
  shouldApplyStaggeringDashTalent,
  shouldApplyBloodleechTalent,
  shouldApplyRebukeTalent,
  shouldApplyTyrantsCloakTalent,
  shouldApplyMomentumRiftTalent,
  shouldApplyOrbShieldTalent,
  shouldApplyFatebreakerTalent,
  shouldApplyDivineColdTalent,
  DIVINE_COLD_BLIZZARD_ICD_MS,
  DIVINE_COLD_FORWARD_RANGE,
  DIVINE_COLD_FORWARD_CONE_HALF_ANGLE_DEG,
  BLOOD_ORBS_DASH_HP_COST,
  getDashChargeRechargeRateMultiplier,
  shouldApplyFrostQueenTalent,
  shouldApplyMonsoonTalent,
  shouldApplyVorpalGustTalent,
  ARCTIC_BLIZZARD_DAMAGE_PER_TICK,
  ARCTIC_BLIZZARD_DURATION_SEC,
  ARCTIC_BLIZZARD_TICK_MS,
  getVorpalGustStabBoonBeamTheme,
  type VorpalGustStabBoonBeamTheme,
  evaluateVorpalGustBeamHit,
  INFERNAL_DASH_DAMAGE,
  INFERNAL_DASH_RADIUS,
  REBUKE_DAMAGE,
  REBUKE_ICD_SEC,
  TYRANTS_CLOAK_ICD_SEC,
  ORB_SHIELD_BASE_HEAL,
  ORB_SHIELD_ICD_SEC,
  GLACIAL_DASH_FREEZE_DURATION_MS,
  GLACIAL_DASH_RADIUS,
  STAGGERING_DASH_RANGE,
  STAGGERING_DASH_MIN_DAMAGE,
  STAGGERING_DASH_MAX_DAMAGE,
  STAGGERING_DASH_MIN_STAGGER,
  STAGGERING_DASH_MAX_STAGGER,
  LIGHTNING_BOLT_ROOM_DAMAGE,
  LIGHTNING_BOLT_ROOM_DAMAGE_PER_AGILITY,
  LIGHTNING_BOLT_ROOM_STAGGER,
  getLightningBoltRoomDamage,
  BOW_UNCHARGED_PROJECTILE_DAMAGE,
  FAN_OF_KNIVES_BASE_DAMAGE,
  FAN_OF_KNIVES_MAX_DISTANCE_UNITS,
  FAN_OF_KNIVES_PROJECTILE_SPEED,
  FAN_OF_KNIVES_PROJECTILE_LIFETIME_SEC,
  WIND_SHEAR_MAX_DISTANCE_UNITS,
  WIND_SHEAR_PROJECTILE_SPEED,
  WIND_SHEAR_PROJECTILE_LIFETIME_SEC,
  type FanOfKnivesFlourishTint,
  CROSSENTROPY_PLAGUE_VENOM_MS,
  resolveWraithStrikeThemeFromMeta,
  normalizeTalentLoadout,
  type TalentLoadout,
  DEFLECT_SHIFT_DURATION_SEC,
  computeDeflectSmiteDamage,
  SHIFT_ENERGY_HALO_PULSE_MS,
  computeLocustMissileDamage,
  LOCUST_ENERGY_PER_VOLLEY,
  LOCUST_HOMING_DELAY_SEC,
  LOCUST_MISSILE_INTERVAL_SEC,
  LOCUST_MISSILES_PER_VOLLEY,
  LOCUST_TARGET_RADIUS,
  ENTANGLEMENT_DURATION_MS,
} from '@/utils/talents';
import {
  EXODIA_GREAVES,
  EXODIA_HELM,
  EXODIA_PLATE,
  HEXMETAL_CLOAK,
  HEXMETAL_LEGGINGS,
  HEXMETAL_ATTACK_SLOW_MULT,
  HEXMETAL_DAMAGE_CAP,
  HEXMETAL_SET_3_BONUS_DASH_CHARGES,
  JAGUAR_EMERALD,
  INFINITE_AMBER,
  INFINITE_AMBER_ENERGY_REGEN_MULT,
  KAISER_ICD_SEC,
  KAISER_PILLAR_DAMAGE,
  PERSEPHONE,
  getArchmageSetCount,
  getArchmageSetStatBonuses,
  getDefaultDreamShardCount,
  getExodiaSetCount,
  getExodiaSetStatBonuses,
  getHexmetalSetCount,
  getSleepwalkerDreamShardCount,
  inventoryToOwnedTypes,
  hasOwnedItem,
  isUniqueDreamLayerItem,
  setJaguarEmeraldOwnedGlobal,
} from '@/utils/dreamLayerItems';
import {
  isUpgradeableBossRelic,
  resolveBossRelicPickup,
} from '@/utils/bossRelicItems';
import { StatSystem, StatPointData, type PlayerStats } from '@/utils/StatSystem';
import { ITEM_RARITY_COLORS, isItemRarity } from '@/utils/itemRarity';
import { setGlobalAgilityStatPoints, setGlobalStrengthStatPoints } from '@/core/DamageCalculator';
import { logJsHeapSnapshotDev } from '@/utils/coopMemoryDebug';
import { isBowPerfectShotProgress } from '@/utils/bowConstants';
import { getRuneCountForWeapon } from '@/utils/runeCount';
import { registerEnemyAttackTelegraphSounds } from '@/utils/enemyTelegraphSound';
import { registerBeastAudioSounds } from '@/utils/beastAudioSounds';
import { registerKnightAnimationSocketListeners } from '@/utils/knightAnimationDispatch';
import { registerWolfAnimationSocketListeners } from '@/utils/wolfAnimationDispatch';
import { registerAssassinAnimationSocketListeners } from '@/utils/assassinAnimationDispatch';
import { registerValkyrieAnimationSocketListeners } from '@/utils/valkyrieAnimationDispatch';
import { registerSkeletonMoveSocketListeners } from '@/utils/skeletonMoveDispatch';
import { VALKYRIE_JUDGMENT_FALL_MS } from '@/utils/valkyrieJudgmentConstants';
import {
  FROST_QUEEN_TELEPORT_LOCK_MS,
} from '@/utils/frostQueenCoopAbilitiesConstants';
import { addEnemyHitDamageNumber } from '@/utils/enemyDamageNumber';
import { registerMedusaVoidWarp } from '@/utils/medusaVoidWarpState';
import type { DamageNumberManager } from '@/utils/DamageNumberManager';
import { isCoopPlayerAllyEntity } from '@/utils/coopAllyTargeting';
import {
  scheduleKnightStyleMiss,
  cancelKnightStyleMiss,
  playKnightStyleHit,
  clearAllKnightStyleMissTimers,
} from '@/utils/knightStyleMeleeSound';

const ZERO_PLAYER_STATS: PlayerStats = { strength: 0, stamina: 0, agility: 0, intellect: 0 };

// Import our ECS systems
import { Engine } from '@/core/Engine';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { DestructibleMushroom } from '@/ecs/components/DestructibleMushroom';
import { DestructibleTree } from '@/ecs/components/DestructibleTree';
import { DestructibleRoot } from '@/ecs/components/DestructibleRoot';
import { DestructibleRock } from '@/ecs/components/DestructibleRock';
import { DestructibleSpine } from '@/ecs/components/DestructibleSpine';
import { Shield } from '@/ecs/components/Shield';
import { Energy } from '@/ecs/components/Energy';
import { Enemy, EnemyType, capFreezeMsForEnemy } from '@/ecs/components/Enemy';
import { isImmuneToPlayerStunAndFreeze } from '@/utils/enemyStatusImmunity';

import { Renderer } from '@/ecs/components/Renderer';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Entity } from '@/ecs/Entity';
import { InterpolationBuffer } from '@/ecs/components/Interpolation';
import { RenderSystem } from '@/systems/RenderSystem';
import { ControlSystem, type RoomBoomDashKey, type RoomBoomDashPayload, type RoomBoomDashVariant } from '@/systems/ControlSystem';
import { AudioSystem } from '@/systems/AudioSystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { ProjectileSystem, DEFAULT_PROJECTILE_ORIGIN_CULL_RADIUS } from '@/systems/ProjectileSystem';
import { PhysicsSystem } from '@/systems/PhysicsSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';
import { CombatSystem } from '@/systems/CombatSystem';
import { InterpolationSystem } from '@/systems/InterpolationSystem';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import { ReanimateRef } from '@/components/weapons/Reanimate';
import FrostNova from '@/components/weapons/FrostNova';
import TotemSuperconductorLightning from '@/components/projectiles/TotemSuperconductorLightning';

import LightningStorm from '@/components/weapons/LightningStorm';
import SmiteComponent from '@/components/weapons/Smite';
import SabreReaperMistEffect from '@/components/weapons/SabreReaperMistEffect';
import FlurryHealingEffect from '@/components/weapons/FlurryHealingEffect';

import WindShearProjectileManager, { triggerWindShearProjectile } from '@/components/projectiles/WindShearProjectile';
import WindShearTornadoEffect, { WhirlwindRadialWaveEffect } from '@/components/projectiles/WindShearTornadoEffect';

import UnifiedProjectileManager from '@/components/managers/UnifiedProjectileManager';
import IcebeamManager from '@/components/managers/IcebeamManager';
import IncinerationBeamManager, {
  type IncinerationBeamManagerHandle,
  type IncinerationDetonatePayload,
} from '@/components/managers/IncinerationBeamManager';
import BowPowershotManager from '@/components/projectiles/BowPowershotManager';
import FrostNovaManager, { addGlobalFrozenEnemy } from '@/components/weapons/FrostNovaManager';
import ArcticBlizzardManager from '@/components/weapons/Blizzard/ArcticBlizzardManager';
import { spawnArcticGroundBlizzardAtFromReact } from '@/components/weapons/Blizzard/arcticBlizzardSpawnBridge';
import AvalancheEffectManager from '@/components/weapons/Avalanche/AvalancheEffectManager';
import FrostQueenPlayerIceStormManager from '@/components/weapons/Avalanche/FrostQueenPlayerIceStormManager';
import Blizzard from '@/components/weapons/Blizzard/Blizzard';
import StunManager, { addGlobalStunnedEnemy } from '@/components/weapons/StunManager';
import HuntersMarkManager, {
  addGlobalHuntersMark,
  clearGlobalHuntersMark,
} from '@/components/enemies/HuntersMarkManager';
import EntangleManager, { addGlobalEntangledEnemy, addGlobalEntangledPlayer } from '@/components/weapons/EntangleManager';
import IgniteEffectManager from '@/components/weapons/IgniteEffectManager';
import FireStormManager from '@/components/weapons/FireStormManager';
import FrostShatterSpikeManager from '@/components/weapons/FrostShatterSpikeManager';
import {
  setFrostShatterSpikeBroadcaster,
  spawnFrostShatterSpike,
} from '@/components/weapons/frostShatterSpikeSpawnBridge';

import CobraShotManager from '@/components/projectiles/CobraShotManager';
import { addGlobalVenomousEnemy } from '@/components/projectiles/VenomEffectManager';

import RejuvenatingShotManager from '@/components/projectiles/RejuvenatingShotManager';
import ThrowSpearManager, { triggerGlobalThrowSpear } from '@/components/projectiles/ThrowSpearManager';
import {
  useOptimizedPVPEffects
} from '@/components/pvp/OptimizedPVPManagers';
import { pvpObjectPool } from '@/utils/PVPObjectPool';
import { pvpStateBatcher, PVPStateUpdateHelpers } from '@/utils/PVPStateBatcher';
import { onTabBecameVisible, shouldDropRemoteVfx } from '@/utils/tabVisibility';
import DeflectShieldManager, { triggerGlobalDeflectShield } from '@/components/weapons/DeflectShieldManager';
import DeathGraspProjectile from '@/components/weapons/DeathGraspProjectile';
import DeathEffect from '@/components/weapons/DeathEffect';
import HauntedSoulEffect from '@/components/weapons/HauntedSoulEffect';
import DragonBreath from '@/components/weapons/DragonBreath';
import PlayerHealthBar from '@/components/ui/PlayerHealthBar';
import EnhancedGround from '@/components/environment/EnhancedGround';


import { DamageNumberData } from '@/components/DamageNumbers';
import { setGlobalCriticalRuneCount, setGlobalCritDamageRuneCount, setControlSystem } from '@/core/DamageCalculator';
import Environment from '@/components/environment/Environment';
import DriftingMist from '@/components/environment/DriftingMist';
import { CoopMainArenaPortals } from '@/components/environment/CoopMainArenaPortals';
import ThroneRoom, {
  COOP_DEV_LOCALHOST_FEATURES,
  COOP_THRONE_ROOM_RADIUS,
  THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS,
  THRONE_ABILITY_PEDESTAL_POSITION,
  THRONE_TALENT_PEDESTAL_POSITION,
  THRONE_PORTAL_POSITION,
  THRONE_PORTAL_POSITIONS,
  THRONE_EXPLORE_PORTAL_POSITION,
  THRONE_EXPLORE_PORTAL_RADIUS,
  THRONE_VOID_PORTAL_POSITION,
  THRONE_VOID_PORTAL_RADIUS,
  THRONE_DEFENSE_PORTAL_POSITION,
  THRONE_DEFENSE_PORTAL_RADIUS,
  THRONE_DUNGEON_PORTAL_POSITION,
  THRONE_DUNGEON_PORTAL_RADIUS,
  THRONE_SKY_TEMPLE_PORTAL_POSITION,
  THRONE_SKY_TEMPLE_PORTAL_RADIUS,
  DEFENSE_ROOM_RADIUS,
  MAIN_COMBAT_CHOICE_PORTAL_POSITIONS,
  CASTLE_ROOM_CHOICE_PORTAL_POSITIONS,
  MAIN_COMBAT_BOSS_PORTAL_POSITION,
  MAIN_COMBAT_PEDESTAL_POSITION,
  MAIN_COMBAT_PEDESTAL_INTERACT_RADIUS,
  MERCHANT_SHOP_INTERACT_DEFS,
  MERCHANT_SHOP_INTERACT_RADIUS,
  DREAM_LAYER_SHOP_INTERACT_DEFS,
  DREAM_LAYER_SHOP_INTERACT_RADIUS,
  THRONE_PILLAR_POSITIONS,
  THRONE_WEAPON_INTERACT_DEFS,
  THRONE_WEAPON_INTERACT_RADIUS,
  THRONE_ARCHETYPE_INTERACT_DEFS,
  THRONE_ARCHETYPE_INTERACT_RADIUS,
  normalizeCoopPortalKind,
  getThronePrepPhysicsObstacles,
} from '@/components/environment/ThroneRoom';
import {
  type Archetype,
  ARCHETYPE_NONE,
  isSelectableArchetype,
} from '@/utils/archetypes';
import {
  type WeaponAspect,
  ASPECT_LEGIONNAIRE,
  cycleWeaponAspect,
  getFireAffinityMaxEnergyBonus,
  getShowcaseWeaponAspect,
  normalizeWeaponAspect,
  POISON_DART_RANGE,
  resolveMaxDashCharges,
  THRONE_ASPECT_SHOWCASE_INTERVAL_MS,
} from '@/utils/weaponAspects';
import CombatArenaPedestal from '@/components/environment/CombatArenaPedestal';
import {
  getMerchantShopHintLabel,
  getMerchantShopStockId,
} from '@/components/environment/MerchantShopPedestals';
import PillarCollision from '@/components/environment/PillarCollision';
import { MAIN_ARENA_HEX_RADIUS, MAIN_MAP_RADIUS, CASTLE_ROOM_BOUNDS, HEX_ARENA_RADIUS, FAE_REALM_HEX_RADIUS, ETERNITY_PALACE_HEX_RADIUS, PENTAGON_ARENA_RADIUS, clampToMainArenaXZ, isInsideHexArenaXZ } from '@/utils/mapConstants';
import { getOxygenMaxEnergy, isMerchantSlotTaken } from '@/utils/merchantShopUtils';
import {
  getDreamLayerShopHintLabel,
  getDreamLayerShopStockId,
  isDreamLayerSlotTaken,
} from '@/utils/dreamLayerShopUtils';
import { VOID_PORTAL_INTERACT_RADIUS, voidPortalInteractRadius } from '@/components/environment/VoidPortal';
import { HEALING_FOUNTAIN_INTERACT_RADIUS } from '@/components/environment/HealingFountain';
import { EDEN_FINALE_DAISY_INTERACT_RADIUS } from '@/components/environment/EdenFinaleDaisy';
import { COOP_MAIN_ENTRY_Z, rotationYTowardArenaCenter } from '@/utils/coopArenaLayout';
import { getDefenseTowerObstacles } from '@/utils/defenseLayout';
import {
  DUNGEON_CAMERA_FAR,
  DUNGEON_FOG_COLOR,
  DUNGEON_FOG_DENSITY,
  DUNGEON_PLAYABLE_AABB,
  DUNGEON_SPAWN,
  resolveDungeonPlayerCenterY,
  subscribeDungeonMeshCollider,
} from '@/utils/dungeonLayout';
import { SKY_TEMPLE_PLAYABLE_AABB, SKY_TEMPLE_SPAWN } from '@/utils/skyTempleLayout';
import { KNIGHT_FROST_FREEZE_MS, KNIGHT_SMITE_RADIUS_BASE } from '@/utils/knightCoopAbilitiesConstants';
import { MUSHROOM_COUNT, buildMushroomInstances, getMushroomColliderCenter, type MushroomInstance } from '@/utils/mushroomLayout';
import { MUSHROOM_MAX_HP } from '@/utils/mushroomConstants';
import {
  EXPLORE_TREE_COMBAT_CENTER_Y,
  EXPLORE_ROOT_COMBAT_CENTER_Y,
  EXPLORE_ROCK_COMBAT_CENTER_Y,
  EXPLORE_SPINE_COMBAT_CENTER_Y,
  exploreTreeCombatRadius,
  exploreTreeMaxHpFromScale,
  exploreRootCombatRadius,
  exploreRootMaxHpFromScale,
  exploreRockCombatRadius,
  exploreRockMaxHpFromScale,
  exploreSpineCombatRadius,
  exploreSpineMaxHpFromScale,
} from '@/utils/exploreTreeConstants';
import MushroomEruptionVfx from '@/components/environment/MushroomEruptionVfx';

/** Default main combat entry Z (ring centered here; matches server `teleportAllPlayersToCombatSpawn`). */
const COOP_MAIN_DEFAULT_SPAWN_Z = COOP_MAIN_ENTRY_Z;
/** Client grace window after portal enter — align with backend `COOP_POST_TELEPORT_POSITION_GUARD_MS`. */
const COOP_POST_PORTAL_POSITION_GRACE_MS = 1500;
/** Spawn height when descending into the next combat room. */
const VOID_PORTAL_FALL_SPAWN_Y = 20;
const THRONE_VOID_PORTAL_DELAY_MS = 4000;
const THRONE_VOID_PORTAL_OPEN_DURATION_MS = 900;
/** Natural-speed takeoff-to-peak duration for portal-fall jump (ms). */
const PORTAL_FALL_RISE_DURATION_MS = 2550;
/** Abort rise if combat-arena-entered never arms the fall. */
const PORTAL_FALL_RISE_TIMEOUT_MS = PORTAL_FALL_RISE_DURATION_MS + 6000;
/** Abort fall if physics never reports a landing (background tab / stuck Y). */
const PORTAL_FALL_LANDING_TIMEOUT_MS = 4000;
/** Ground Y used for portal-fall animation progress (matches PhysicsSystem ground clamp). */
const PORTAL_FALL_GROUND_Y = 0.52;
/** Fraction of Jump clip duration treated as peak of arc (tune by eye). */
const PORTAL_FALL_PEAK_FRACTION = 0.45;
/** Remote locomotion falls back to Idle if no player-moved packet arrives. */
const REMOTE_PLAYER_MOVE_STALE_MS = 500;
import { createGlobalPowershotEffect as createPowershotEffect } from '@/components/projectiles/useBowPowershot';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';
import PVPSummonTotemManager from '@/components/projectiles/PVPSummonTotemManager';
import { ExperienceSystem } from '@/utils/ExperienceSystem';
import DynamicLightPool, { PooledEffectLight, useDynamicLight } from '@/components/effects/DynamicLightPool';
import { calculationCache } from '@/utils/CalculationCache';
import { ENEMY_HP_BAR_BG_GEO } from '@/utils/sharedEnemyUiGeometry';
import { isDevPerformanceHudEnabled } from '@/utils/isDevPerformanceHudEnabled';
import { devPerformanceStore, recordReactProfilerCommit } from '@/utils/devPerformanceStore';
import { logGpuResourceAudit } from '@/utils/gpuResourceAudit';
import {
  installWebGlDiagnostics,
  recordWebGlContextLost,
  recordWebGlContextRestored,
} from '@/utils/webglDiagnostics';
import { Text } from '@react-three/drei';

const BossRenderer = React.lazy(() => import('./enemies/BossRenderer'));
const Boss2Renderer = React.lazy(() => import('./enemies/Boss2Renderer'));
const Boss3Renderer = React.lazy(() => import('./enemies/Boss3Renderer'));
const DestinyRenderer = React.lazy(() => import('./enemies/DestinyRenderer'));
const TemplarRenderer = React.lazy(() => import('./enemies/TemplarRenderer'));
const TitanRenderer = React.lazy(() => import('./enemies/TitanRenderer'));
const ViperRenderer = React.lazy(() => import('./enemies/ViperRenderer'));
const WarlockRenderer = React.lazy(() => import('./enemies/WarlockRenderer'));
const GreedRenderer = React.lazy(() => import('./enemies/GreedRenderer'));

function knightSmiteVariantFromSoulType(soulType?: string): KnightSmiteLightningVariant {
  switch (soulType) {
    case 'blue':
      return 'enemy-blue';
    case 'green':
      return 'enemy-green';
    case 'purple':
      return 'enemy-purple';
    default:
      return 'enemy-red';
  }
}

/** Pin compiled shader programs during initial warmup so first-room combat avoids recompile hitches. */
const SHADER_PROGRAM_PIN_MS = 120_000;

/**
 * Always-on render helpers: optional shader program pin + throttled shadow refresh.
 * Programs are pinned only during the warmup window so transient VFX shaders can be
 * evicted afterward instead of accumulating for the entire session.
 */
function RenderPerfHelpers() {
  const gl = useThree((s) => s.gl);
  const frame = useRef(0);
  const pinUntilMs = useRef(
    typeof performance !== 'undefined' ? performance.now() + SHADER_PROGRAM_PIN_MS : 0,
  );

  useFrame(() => {
    const f = (frame.current = (frame.current + 1) % 1_000_000);

    const shouldPin = performance.now() < pinUntilMs.current;
    const programs = gl.info.programs;
    if (shouldPin && programs) {
      for (let i = 0; i < programs.length; i++) {
        (programs[i] as { usedTimes: number }).usedTimes = 1e9;
      }
    }

    if (ENABLE_REALTIME_SHADOWS && !gl.shadowMap.autoUpdate) {
      gl.shadowMap.needsUpdate = f % 2 === 0;
    }
  });

  return null;
}

function handleCoopSceneProfilerRender(
  _id: string,
  phase: 'mount' | 'update' | 'nested-update',
  actualDuration: number,
  baseDuration: number,
): void {
  if (!isDevPerformanceHudEnabled()) return;
  if (phase === 'mount') return;
  recordReactProfilerCommit(actualDuration, baseDuration);
}

function CoopSceneContentProfiler({ children }: { children: React.ReactNode }) {
  if (!isDevPerformanceHudEnabled()) return <>{children}</>;
  return (
    <Profiler id="coop-scene" onRender={handleCoopSceneProfilerRender}>
      {children}
    </Profiler>
  );
}

function sampleSceneComplexity(scene: Scene): {
  sceneObjects: number;
  meshes: number;
  instancedMeshes: number;
  lights: number;
  shadowCasters: number;
} {
  let sceneObjects = 0;
  let meshes = 0;
  let instancedMeshes = 0;
  let lights = 0;
  let shadowCasters = 0;
  scene.traverse((o) => {
    sceneObjects++;
    const obj = o as {
      isInstancedMesh?: boolean;
      isMesh?: boolean;
      isSkinnedMesh?: boolean;
      isLight?: boolean;
      castShadow?: boolean;
    };
    if (obj.isInstancedMesh) instancedMeshes++;
    else if (obj.isMesh || obj.isSkinnedMesh) meshes++;
    if (obj.isLight) lights++;
    if (obj.castShadow) shadowCasters++;
  });
  return { sceneObjects, meshes, instancedMeshes, lights, shadowCasters };
}

/**
 * Localhost dev collector: samples gl.info + scene complexity into devPerformanceStore.
 * Also exposes window.erebusMemStats() for manual console snapshots.
 */
function DevPerformanceCollector() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const frame = useRef(0);
  const seenProgramKeys = useRef<Set<string>>(new Set());
  const enabled = isDevPerformanceHudEnabled();

  useEffect(() => {
    installWebGlDiagnostics();
    if (!enabled || typeof window === 'undefined') return;
    type ErebusDevWindow = Window & {
      erebusMemStats?: () => Record<string, unknown>;
      erebusGpuAudit?: () => ReturnType<typeof logGpuResourceAudit>;
    };
    const win = window as ErebusDevWindow;

    win.erebusMemStats = () => {
      const complexity = sampleSceneComplexity(scene);
      const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      const stats = {
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 'n/a',
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        ...complexity,
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        points: gl.info.render.points,
        lines: gl.info.render.lines,
        calcCache: calculationCache.getStats?.() ?? 'n/a',
      };
      // eslint-disable-next-line no-console
      console.table(stats);
      // eslint-disable-next-line no-console
      console.log(
        `[erebusMemStats] drawCalls=${stats.drawCalls} triangles=${stats.triangles} ` +
          `instancedMeshes=${complexity.instancedMeshes} meshes=${complexity.meshes}`,
      );
      return stats;
    };

    win.erebusGpuAudit = () => logGpuResourceAudit(gl, scene);

    return () => {
      delete win.erebusMemStats;
      delete win.erebusGpuAudit;
      devPerformanceStore.reset();
    };
  }, [enabled, gl, scene]);

  useFrame(() => {
    if (!enabled) return;
    const f = (frame.current = (frame.current + 1) % 1_000_000);

    // Log shader program churn in dev when new variants appear after warmup.
    const programs = gl.info.programs as Array<{ cacheKey?: string }> | null;
    if (programs) {
      const fresh: string[] = [];
      for (let i = 0; i < programs.length; i++) {
        const key = programs[i].cacheKey;
        if (key && !seenProgramKeys.current.has(key)) {
          seenProgramKeys.current.add(key);
          fresh.push(key);
        }
      }
      if (fresh.length > 0 && seenProgramKeys.current.size > fresh.length) {
        let nPoint = 0;
        let nDir = 0;
        let nSpot = 0;
        let nShadow = 0;
        scene.traverse((o) => {
          const obj = o as {
            visible?: boolean;
            isLight?: boolean;
            isPointLight?: boolean;
            isDirectionalLight?: boolean;
            isSpotLight?: boolean;
            castShadow?: boolean;
          };
          if (!obj.visible || !obj.isLight) return;
          if (obj.isPointLight) nPoint++;
          else if (obj.isDirectionalLight) nDir++;
          else if (obj.isSpotLight) nSpot++;
          if (obj.castShadow) nShadow++;
        });
        // eslint-disable-next-line no-console
        console.warn(
          `[perf] +${fresh.length} new programs (total ${seenProgramKeys.current.size}). ` +
            `lights: point=${nPoint} dir=${nDir} spot=${nSpot} shadow=${nShadow}`,
          fresh.map((k) => k.slice(0, 120)),
        );
      }
    }

    // Sample render + scene stats ~4x/sec.
    if (f % 15 !== 0) return;

    if (f % 60 === 0) {
      const posAttr = ENEMY_HP_BAR_BG_GEO.getAttribute('position');
      if (!posAttr || posAttr.count < 1) {
        // eslint-disable-next-line no-console
        console.warn(
          '[gpu] ENEMY_HP_BAR_BG_GEO position buffer invalid — shared geometry may have been disposed',
        );
      }
    }

    const info = gl.info;
    const complexity = sampleSceneComplexity(scene);
    const mem = (performance as {
      memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };
    }).memory;
    const calcStats = calculationCache.getStats();

    devPerformanceStore.publish({
      drawCalls: info.render.calls,
      triangles: info.render.triangles,
      points: info.render.points,
      lines: info.render.lines,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      dpr: gl.getPixelRatio(),
      heapUsedMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null,
      heapTotalMB: mem ? Math.round(mem.totalJSHeapSize / 1048576) : null,
      heapLimitMB: mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : null,
      heapPercent:
        mem && mem.jsHeapSizeLimit > 0
          ? (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100
          : null,
      ...complexity,
      calcCacheEntries: calcStats.totalCached,
    });
  });

  return null;
}

/** Listens for WebGL context loss/restoration and installs disconnect-correlation diagnostics. */
function WebGLResilienceMonitor() {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    installWebGlDiagnostics();
    const canvas = gl.domElement;

    const onLost = (event: Event) => {
      event.preventDefault();
      recordWebGlContextLost('webglcontextlost on canvas');
      gl.setRenderTarget(null);
    };

    const onRestored = () => {
      recordWebGlContextRestored('webglcontextrestored on canvas');
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [gl]);

  return null;
}

/**
 * Renders death/spawn VFX once, far offscreen, during the loading window so their shader
 * variants (transparent / depth / additive) compile behind the loading screen instead of
 * stalling the first time they appear in gameplay (e.g. the first ally death). The
 * program-pin in RenderPerfHelpers keeps compiled programs resident during the first
 * ~120s warmup window, then allows eviction so transient VFX shaders don't accumulate.
 *
 * Mounted only while warming up; the VFX just need to be rendered once to compile.
 */
function ShaderWarmup() {
  const warmupPos = useMemo(() => new Vector3(0, -3000, 0), []);
  const noop = useCallback(() => {}, []);
  return (
    <group position={warmupPos}>
      {/* Player/ally death VFX — the confirmed first-compile hitch on ally death. */}
      <DeathEffect position={warmupPos} duration={600000} onComplete={noop} />
      {/* troika text shader — every enemy health bar mounts a <Text>; compiling its
          derived shader here means the first enemy spawn doesn't stall on it. */}
      <Text fontSize={0.16} color="#ccffcc" anchorX="center" anchorY="middle" fontWeight="bold">
        {'\u{1F9DF} 0/0'}
      </Text>

      {/* Transparent emissive double-sided material — used by ritual circles, VFX
          ground decals, and rune overlays across all room themes. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.01, 0.01]} />
        <meshStandardMaterial
          color="#86efac"
          emissive="#86efac"
          emissiveIntensity={1}
          transparent
          opacity={0.5}
          depthWrite={false}
          side={2}
        />
      </mesh>

      {/* Additive-blended emissive transparent — charge trails, particle VFX,
          chain-lightning sparks, wraith-strike effects. */}
      <mesh>
        <sphereGeometry args={[0.005, 4, 4]} />
        <meshStandardMaterial
          color="#B5B010"
          emissive="#B5B010"
          emissiveIntensity={3}
          transparent
          opacity={0.8}
          blending={2 /* AdditiveBlending */}
          depthWrite={false}
        />
      </mesh>

      {/* High-emissive orb glow — weapon orbs, soul fragments, and boss VFX
          all use this material variant (high emissiveIntensity + transparency). */}
      <mesh>
        <sphereGeometry args={[0.005, 6, 6]} />
        <meshStandardMaterial
          color="#1097B5"
          emissive="#1097B5"
          emissiveIntensity={30}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Standard opaque — enemy bodies, props, arena geometry. */}
      <mesh {...(ENABLE_REALTIME_SHADOWS ? { castShadow: true, receiveShadow: true } : {})}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial color="#4a5b6c" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Low-metalness opaque — wooden/stone surfaces, handle wrappings, floor tiles. */}
      <mesh {...(ENABLE_REALTIME_SHADOWS ? { castShadow: true, receiveShadow: true } : {})}>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial color="#2a3b4c" roughness={0.7} metalness={0.0} />
      </mesh>
    </group>
  );
}

type CoopWeaponStateSnapshot = {
  currentWeapon: WeaponType;
  currentSubclass: WeaponSubclass;
  isCharging: boolean;
  chargeProgress: number;
  isSwinging: boolean;
  isSpinning: boolean;
  swordComboStep: 1 | 2 | 3;
  isSwordCharging: boolean;
  isDeflecting: boolean;
  deflectShieldActive: boolean;
  deflectShieldDurationSec: number;
  deflectShieldPaletteVariant: import('@/utils/aegisShieldPalette').AegisPaletteVariant;
  /** Shift-tap Deflect-Block — independent gold shield, unrelated to the Q-Aegis fields above. */
  isBlockingDeflect: boolean;
  isViperStingCharging: boolean;
  viperStingChargeProgress: number;
  isBarrageCharging: boolean;
  barrageChargeProgress: number;
  isCobraShotCharging: boolean;
  cobraShotChargeProgress: number;
  isRejuvenatingShotCharging: boolean;
  rejuvenatingShotChargeProgress: number;
  isSkyfalling: boolean;
  isBackstabbing: boolean;
  isSundering: boolean;
  isCorruptedAuraActive: boolean;
  isFrozen: boolean;
  isIcebeaming: boolean;
  tempestBurstShotSeq: number;
};

const PROGRESS_EPSILON = 0.03;

// Remote-peer animation/ability state mirrored from socket broadcasts.
type RemotePlayerAnimState = {
  isCharging: boolean;
  chargeProgress: number;
  isSwinging: boolean;
  swordComboStep: 1 | 2 | 3;
  isSpinning: boolean;
  isSwordCharging: boolean;
  isDeflecting: boolean;
  /** Shift-tap Deflect-Block — independent gold shield, unrelated to the Q-Aegis `isDeflecting` above. */
  isBlockingDeflect?: boolean;
  isViperStingCharging: boolean;
  viperStingChargeProgress: number;
  isBarrageCharging: boolean;
  barrageChargeProgress: number;
  isCobraShotCharging: boolean;
  cobraShotChargeProgress: number;
  isRejuvenatingShotCharging?: boolean;
  rejuvenatingShotChargeProgress?: number;
  isSkyfalling: boolean;
  isBackstabbing: boolean;
  backstabVorpalGust?: boolean;
  backstabVorpalGustTheme?: VorpalGustStabBoonBeamTheme;
  isSmiting: boolean;
  isColossusStriking?: boolean;
  isWindShearing?: boolean;
  isWindShearCharging?: boolean;
  windShearChargeProgress?: number;
  isDeathGrasping: boolean;
  isWraithStriking: boolean;
  isCorruptedAuraActive: boolean;
  isSundering?: boolean;
  isCrossentropyCharging?: boolean;
  isSummonTotemCharging?: boolean;
  summonTotemChargeProgress?: number;
  isFrozen?: boolean;
  lastAttackType?: string;
  lastAttackTime?: number;
  lastAnimationUpdate?: number;
  runebladeStoredCharge?: boolean;
  tempestBurstShotSeq?: number;
  crusaderBladeThemeActive?: boolean;
  titansGripBladeThemeActive?: boolean;
  psionicBladesBladeThemeActive?: boolean;
  deflectShieldActive?: boolean;
  deflectShieldPaletteVariant?: import('@/utils/aegisShieldPalette').AegisPaletteVariant;
  deflectShieldDurationSec?: number;
  isRunebladeBlizzardActive?: boolean;
};

const DEFAULT_REMOTE_PLAYER_ANIM_STATE: Readonly<RemotePlayerAnimState> = Object.freeze({
  isCharging: false,
  chargeProgress: 0,
  isSwinging: false,
  swordComboStep: 1 as 1 | 2 | 3,
  isSpinning: false,
  isSwordCharging: false,
  isDeflecting: false,
  isBlockingDeflect: false,
  isViperStingCharging: false,
  viperStingChargeProgress: 0,
  isBarrageCharging: false,
  barrageChargeProgress: 0,
  isCobraShotCharging: false,
  cobraShotChargeProgress: 0,
  isRejuvenatingShotCharging: false,
  rejuvenatingShotChargeProgress: 0,
  isSkyfalling: false,
  isBackstabbing: false,
  isSmiting: false,
  isDeathGrasping: false,
  isWraithStriking: false,
  isCorruptedAuraActive: false,
  isCrossentropyCharging: false,
  isSummonTotemCharging: false,
  summonTotemChargeProgress: 0,
  isFrozen: false,
  runebladeStoredCharge: false,
  tempestBurstShotSeq: 0,
  crusaderBladeThemeActive: false,
  titansGripBladeThemeActive: false,
  psionicBladesBladeThemeActive: false,
  deflectShieldActive: false,
  deflectShieldPaletteVariant: 'default',
  deflectShieldDurationSec: 3,
  isRunebladeBlizzardActive: false,
});

const REMOTE_PEER_VISUAL_SMOOTH_RATE = 18;
const REMOTE_PEER_VISUAL_TELEPORT_SNAP_SQ = 15 * 15;
const RELAYED_PLAYER_IMPACT_TYPES = new Set([
  'crescent-slash-effect',
  'mortal-strike-effect',
  'psionic-blade-slice',
]);

function lerpShortestAngle(from: number, to: number, t: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}

function mapLocalEntityIdToServerEnemyId(
  localEntityId: string,
  serverEnemyEntities: Map<string, number>,
): string | undefined {
  const numeric = Number(localEntityId);
  for (const [serverId, entityId] of serverEnemyEntities) {
    if (entityId === numeric) return serverId;
  }
  return undefined;
}

function readEnemyIsStunned(world: World | undefined | null, entityId: number): boolean {
  if (!world) return false;
  const entity = world.getEntity(entityId);
  const enemyComponent = entity?.getComponent(Enemy);
  return enemyComponent ? enemyComponent.isStunned : false;
}

function remoteAnimStateNeedsReactUpdate(
  prev: Record<string, unknown>,
  next: Record<string, unknown>,
): boolean {
  const keyList = Array.from(
    new Set([...Object.keys(prev), ...Object.keys(next)]),
  );
  for (const key of keyList) {
    if (key === 'lastAnimationUpdate' || key === 'lastAttackTime') continue;
    if (prev[key] !== next[key]) return true;
  }
  return false;
}

function weaponStateNeedsReactUpdate(
  prev: CoopWeaponStateSnapshot,
  next: CoopWeaponStateSnapshot,
): boolean {
  if (prev.currentWeapon !== next.currentWeapon) return true;
  if (prev.currentSubclass !== next.currentSubclass) return true;
  if (prev.swordComboStep !== next.swordComboStep) return true;
  if (prev.tempestBurstShotSeq !== next.tempestBurstShotSeq) return true;
  if (prev.deflectShieldDurationSec !== next.deflectShieldDurationSec) return true;
  if (prev.deflectShieldPaletteVariant !== next.deflectShieldPaletteVariant) return true;

  const boolKeys: Array<keyof CoopWeaponStateSnapshot> = [
    'isCharging',
    'isSwinging',
    'isSpinning',
    'isSwordCharging',
    'isDeflecting',
    'deflectShieldActive',
    'isBlockingDeflect',
    'isViperStingCharging',
    'isBarrageCharging',
    'isCobraShotCharging',
    'isRejuvenatingShotCharging',
    'isSkyfalling',
    'isBackstabbing',
    'isSundering',
    'isCorruptedAuraActive',
    'isFrozen',
    'isIcebeaming',
  ];
  for (const key of boolKeys) {
    if (prev[key] !== next[key]) return true;
  }

  if (Math.abs(prev.chargeProgress - next.chargeProgress) > PROGRESS_EPSILON) {
    const wasPerfect = isBowPerfectShotProgress(prev.chargeProgress);
    const isPerfect = isBowPerfectShotProgress(next.chargeProgress);
    if (wasPerfect !== isPerfect) return true;
  }
  // Skip routine chargeProgress / viper / barrage / cobra deltas — local weapons read controlSystemRef in useFrame.

  return false;
}

function RoomBoomMendingEffect({
  position,
  onComplete,
}: {
  position: Vector3;
  onComplete: () => void;
}) {
  const duration = 1.5;
  const timeRef = useRef(0);
  const hasCompletedRef = useRef(false);

  // Mesh/material refs — animation is driven imperatively each frame so the
  // subtree is never re-rendered and geometries/materials are created once.
  const ringMeshes = useRef<(Mesh | null)[]>([]);
  const ringMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const sphereMesh = useRef<Mesh>(null);
  const sphereMat = useRef<MeshStandardMaterial>(null);
  const particleMeshes = useRef<(Mesh | null)[]>([]);
  const particleMats = useRef<(MeshStandardMaterial | null)[]>([]);
  const mendingLight = useDynamicLight({ color: '#22c95e', distance: 5, decay: 2, priority: 1 });

  const rings = useMemo(() => [...Array(3)], []);
  const particles = useMemo(() => [...Array(12)], []);

  useFrame((_, delta) => {
    const time = timeRef.current + delta;
    timeRef.current = time;

    const progress = Math.min(1, time / duration);
    const opacity = Math.sin(progress * Math.PI);
    const scale = 1 + progress * 2;

    for (let i = 0; i < 3; i++) {
      const m = ringMeshes.current[i];
      if (m) {
        m.position.y = progress * 2 + i * 0.5;
        m.rotation.z = time * 2;
      }
      const mat = ringMats.current[i];
      if (mat) mat.opacity = opacity * (1 - i * 0.2);
    }

    if (sphereMesh.current) sphereMesh.current.scale.setScalar(scale);
    if (sphereMat.current) sphereMat.current.opacity = opacity * 0.3;

    const radius = 0.75 + progress;
    const yOffset = progress * 2;
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const m = particleMeshes.current[i];
      if (m) {
        m.position.set(
          (Math.cos(angle + time * 2) * radius) / 1.1,
          yOffset + Math.sin(time * 3 + i) * 0.5,
          (Math.sin(angle + time * 2) * radius) / 1.1,
        );
      }
      const mat = particleMats.current[i];
      if (mat) mat.opacity = opacity * 0.8;
    }

    const light = mendingLight.current;
    if (light?.active) {
      light.setPosition(position.x, position.y, position.z);
      light.setIntensity(4 * opacity);
    }

    if (time >= duration && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={position.toArray()}>
      {rings.map((_, i) => (
        <mesh
          key={`mending-ring-${i}`}
          ref={(el) => { ringMeshes.current[i] = el; }}
          position={[0, i * 0.5, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[0.8 - i * 0.2, 0.05, 16, 32]} />
          <meshStandardMaterial
            ref={(el) => { ringMats.current[i] = el; }}
            color="#88ffaa"
            emissive="#22c95e"
            emissiveIntensity={2}
            transparent
            opacity={0}
          />
        </mesh>
      ))}

      <mesh ref={sphereMesh}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          ref={sphereMat}
          color="#aaf8c8"
          emissive="#1db954"
          emissiveIntensity={3}
          transparent
          opacity={0}
        />
      </mesh>

      {particles.map((_, i) => (
        <mesh
          key={`mending-particle-${i}`}
          ref={(el) => { particleMeshes.current[i] = el; }}
        >
          <sphereGeometry args={[0.095, 8, 8]} />
          <meshStandardMaterial
            ref={(el) => { particleMats.current[i] = el; }}
            color="#88ffaa"
            emissive="#22c95e"
            emissiveIntensity={2}
            transparent
            opacity={0}
          />
        </mesh>
      ))}
    </group>
  );
}

function defaultSubclassForThroneWeapon(w: WeaponType): WeaponSubclass {
  switch (w) {
    case WeaponType.NONE:
      return WeaponSubclass.ELEMENTAL;
    case WeaponType.RUNEBLADE:
      return WeaponSubclass.ARCANE;
    case WeaponType.SCYTHE:
      return WeaponSubclass.CHAOS;
    case WeaponType.SABRES:
      return WeaponSubclass.FROST;
    case WeaponType.SPEAR:
      return WeaponSubclass.STORM;
    case WeaponType.BOW:
    default:
      return WeaponSubclass.ELEMENTAL;
  }
}

const preloadedEnemyModelTypes = new Set<string>();

function scheduleIdleTask(task: () => void, timeout = 3000): void {
  if (typeof window === 'undefined') return;
  const win = window as Window & {
    requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  };
  if (win.requestIdleCallback) {
    win.requestIdleCallback(task, { timeout });
    return;
  }
  win.setTimeout(task, Math.min(timeout, 1500));
}

function preloadEnemyModelsForTypes(types: Iterable<string>): void {
  const nextTypes = new Set(types);
  nextTypes.delete('training-dummy');

  nextTypes.forEach((type) => {
    if (preloadedEnemyModelTypes.has(type)) return;
    preloadedEnemyModelTypes.add(type);

    scheduleIdleTask(() => {
      switch (type) {
        case 'knight':
        case 'allied-knight':
          void import('./enemies/KnightModel').then(mod => mod.preloadKnightModels());
          break;
        case 'allied-huntress':
        case 'viper':
          void import('./enemies/ViperModel').then(mod => mod.preloadViperModels());
          break;
        case 'allied-phantom':
        case 'shade':
          void import('./enemies/ShadeModel').then(mod => mod.preloadShadeModels());
          break;
        case 'allied-healer':
          void import('./enemies/AlliedHealerModel').then(mod => mod.preloadAlliedHealerModels());
          break;
        case 'allied-tower':
        case 'tower':
          void import('./environment/DefenseTower').then(mod => mod.preloadDefenseTower());
          break;
        case 'watch-tower':
          void import('./environment/WatchTower').then(mod => mod.preloadWatchTower());
          break;
        case 'siege-tower':
          void import('./environment/SiegeTower').then(mod => mod.preloadSiegeTower());
          break;
        case 'barracks':
          void import('./environment/SpiritLounge').then(mod => mod.preloadSpiritLounge());
          break;
        case 'research-station':
          void import('./environment/ResearchStation').then(mod => mod.preloadResearchStation());
          break;
        case 'shrine':
          void import('./environment/Shrine').then(mod => mod.preloadShrine());
          break;
        case 'obelisk':
          void import('./environment/Obelisk').then(mod => mod.preloadObelisk());
          break;
        case 'shield-battery':
          void import('./environment/ShieldBattery').then(mod => mod.preloadShieldBattery());
          break;
        case 'cathedral':
          void import('./environment/Cathedral').then(mod => mod.preloadCathedral());
          break;
        case 'allied-demon':
        case 'ghoul':
          void import('./enemies/GhoulModel').then(mod => mod.preloadGhoulModels());
          break;
        case 'allied-tiger':
          void import('./enemies/TigerModel').then(mod => mod.preloadTigerModels());
          break;
        case 'allied-wolf':
          void import('./enemies/WolfModel').then(mod => mod.preloadWolfModels());
          break;
        case 'allied-bear':
          void import('./enemies/BearModel').then(mod => mod.preloadBearModels());
          break;
        case 'allied-serpent':
          void import('./enemies/SerpentModel').then(mod => mod.preloadSerpentModels());
          break;
        case 'allied-spider':
          void import('./enemies/BoneSpiderModel').then(mod => mod.preloadBoneSpiderModels());
          break;
        case 'allied-enchantress':
        case 'greed':
          void import('./enemies/GreedModel').then(mod => mod.preloadGreedModels());
          break;
        case 'warlock':
        case 'boss2':
          void import('./enemies/WarlockModel').then(mod => mod.preloadWarlockModels());
          break;
        case 'templar':
          void import('./enemies/TemplarModel').then(mod => mod.preloadTemplarModels());
          break;
        case 'weaver':
        case 'boss3':
          void import('./enemies/WeaverModel').then(mod => mod.preloadWeaverModels());
          void import('./enemies/GroundSpikeModel').then(mod => mod.preloadGroundSpikeModel());
          break;
        case 'zombie':
        case 'player-zombie':
          void import('./enemies/ZombieModel').then(mod => mod.preloadZombieModels());
          break;
        case 'vengeful-spirit':
          void import('./enemies/VengefulSpiritModel').then(mod => mod.preloadVengefulSpiritModels());
          break;
        case 'martyr':
          void import('./enemies/MartyrModel').then(mod => mod.preloadMartyrModels());
          break;
        case 'wraith':
          void import('./enemies/WraithModel').then(mod => mod.preloadWraithModels());
          break;
        case 'titan':
          void import('./enemies/TitanModel').then(mod => mod.preloadTitanModels());
          break;
        case 'spectre':
          void import('./enemies/SpectreModel').then(mod => mod.preloadSpectreModels());
          break;
        case 'death-knight':
          void import('./enemies/DeathKnightModel').then(mod => mod.preloadDeathKnightModels());
          break;
        case 'shaman':
          void import('./enemies/ShamanModel').then(mod => mod.preloadShamanModels());
          break;
        case 'assassin':
          void import('./enemies/AssassinModel').then(mod => mod.preloadAssassinModels());
          break;
        case 'serpent':
        case 'boss-serpent':
          void import('./enemies/SerpentModel').then(mod => mod.preloadSerpentModels());
          break;
        case 'tiger':
        case 'boss-tiger':
          void import('./enemies/TigerModel').then(mod => mod.preloadTigerModels());
          break;
        case 'wolf':
        case 'boss-wolf':
          void import('./enemies/WolfModel').then(mod => mod.preloadWolfModels());
          break;
        case 'bear':
        case 'boss-bear':
          void import('./enemies/BearModel').then(mod => mod.preloadBearModels());
          break;
        case 'skyray':
          void import('./enemies/SkyRayModel').then(mod => mod.preloadSkyRayModels());
          break;
        case 'frost-queen':
          void import('./enemies/FrostQueenModel').then(mod => mod.preloadFrostQueenModels());
          break;
        case 'medusa':
          void import('./enemies/MedusaModel').then(mod => mod.preloadMedusaModels());
          break;
        case 'terrorhawk':
          void import('./enemies/TerrorhawkModel').then(mod => mod.preloadTerrorhawkModels());
          break;
        case 'wyvern':
          void import('./enemies/WyvernModel').then(mod => mod.preloadWyvernModels());
          break;
        case 'destiny':
          void import('./enemies/DestinyModel').then(mod => mod.preloadDestinyModels());
          break;
        case 'bone-spider':
          void import('./enemies/BoneSpiderModel').then(mod => mod.preloadBoneSpiderModels());
          break;
        case 'sentinel':
          void import('./enemies/SentinelModel').then(mod => mod.preloadSentinelModels());
          break;
        case 'nemesis':
          void import('./enemies/NemesisModel').then(mod => mod.preloadNemesisModels());
          break;
        case 'stone-giant':
          void import('./enemies/StoneGiantModel').then(mod => mod.preloadStoneGiantModels());
          break;
        case 'eternal-oak':
          void import('./enemies/EternalOakModel').then(mod => mod.preloadEternalOakModels());
          break;
        case 'colossus':
          void import('./enemies/ColossusModel').then(mod => mod.preloadColossusModels());
          break;
        case 'valkyrie':
          void import('./enemies/ValkyrieModel').then(mod => mod.preloadValkyrieModels());
          break;
        case 'boss':
          void import('./enemies/BossGlbModel').then(mod => mod.preloadBossModels());
          void import('./enemies/GroundSpikeModel').then(mod => mod.preloadGroundSpikeModel());
          break;
        case 'tentacle-spine':
          void import('./enemies/TentacleSpineModel').then(mod => mod.preloadTentacleSpineModels());
          break;
      }
    }, 1200);
  });
}

/**
 * Eagerly load the JS chunks for all React.lazy renderer components so their
 * code is available in the browser cache before any enemy of that type spawns.
 * Keeps React.lazy (no bundle-size regression) while eliminating the chunk-fetch
 * stall on first mount.
 */
async function warmupLazyRendererChunks(): Promise<void> {
  await Promise.all([
    import('./enemies/BossRenderer'),
    import('./enemies/Boss2Renderer'),
    import('./enemies/Boss3Renderer'),
    import('./enemies/DestinyRenderer'),
    import('./enemies/TemplarRenderer'),
    import('./enemies/TitanRenderer'),
    import('./enemies/SpectreRenderer'),
    import('./enemies/DeathKnightRenderer'),
    import('./enemies/ShamanRenderer'),
    import('./enemies/AssassinRenderer'),
    import('./enemies/SerpentRenderer'),
    import('./enemies/FrostQueenRenderer'),
    import('./enemies/MedusaRenderer'),
    import('./enemies/WyvernRenderer'),
    import('./enemies/TerrorhawkRenderer'),
    import('./enemies/EnemyTigerRenderer'),
    import('./enemies/WolfRenderer'),
    import('./enemies/SkyRayRenderer'),
    import('./enemies/BoneSpiderRenderer'),
    import('./enemies/SentinelRenderer'),
    import('./enemies/NemesisRenderer'),
    import('./enemies/StoneGiantRenderer'),
    import('./enemies/EternalOakRenderer'),
    import('./enemies/ColossusRenderer'),
    import('./enemies/ValkyrieRenderer'),
    import('./enemies/ViperRenderer'),
    import('./enemies/WarlockRenderer'),
    import('./enemies/GreedRenderer'),
  ]).catch((e) => console.warn('Lazy renderer chunk warmup failed (non-fatal):', e));
}

/**
 * Fire all enemy + ally model preloads during the initial loading screen so
 * GLTF network downloads begin immediately rather than when the first enemy of
 * that type spawns.  We await only the dynamic import() resolutions (JS chunks);
 * the actual GLTF parses stream in the background and will be done well before
 * any room is entered.
 *
 * Also fires warmupKnightModels / warmupAlliedHealerModels as non-blocking
 * side-effects so the portal overlay no longer needs to wait for them.
 */
async function preloadAllEnemyModels(): Promise<void> {
  await Promise.all([
    import('./enemies/KnightModel').then((mod) => {
      mod.preloadKnightModels();
      void mod.warmupKnightModels();
    }),
    import('./enemies/AlliedHealerModel').then((mod) => {
      mod.preloadAlliedHealerModels();
      void mod.warmupAlliedHealerModels();
    }),
    import('./enemies/GreedModel').then((mod) => {
      mod.preloadGreedModels();
      void mod.warmupGreedModels();
    }),
    import('./enemies/GhoulModel').then((mod) => { mod.preloadGhoulModels(); }),
    import('./enemies/ShadeModel').then((mod) => { mod.preloadShadeModels(); }),
    import('./enemies/WarlockModel').then((mod) => { mod.preloadWarlockModels(); }),
    import('./enemies/TemplarModel').then((mod) => { mod.preloadTemplarModels(); }),
    import('./enemies/WeaverModel').then((mod) => { mod.preloadWeaverModels(); }),
    import('./enemies/ViperModel').then((mod) => { mod.preloadViperModels(); }),
    import('./enemies/ZombieModel').then((mod) => { mod.preloadZombieModels(); }),
    import('./enemies/VengefulSpiritModel').then((mod) => { mod.preloadVengefulSpiritModels(); }),
    import('./enemies/MartyrModel').then((mod) => { mod.preloadMartyrModels(); }),
    import('./enemies/BossGlbModel').then((mod) => { mod.preloadBossModels(); }),
    import('./enemies/TitanModel').then((mod) => { mod.preloadTitanModels(); }),
    import('./enemies/SpectreModel').then((mod) => { mod.preloadSpectreModels(); }),
    import('./enemies/DeathKnightModel').then((mod) => { mod.preloadDeathKnightModels(); }),
    import('./enemies/ShamanModel').then((mod) => { mod.preloadShamanModels(); }),
    import('./enemies/AssassinModel').then((mod) => { mod.preloadAssassinModels(); }),
    import('./enemies/SerpentModel').then((mod) => { mod.preloadSerpentModels(); }),
    import('./enemies/FrostQueenModel').then((mod) => { mod.preloadFrostQueenModels(); }),
    import('./enemies/MedusaModel').then((mod) => { mod.preloadMedusaModels(); }),
    import('./enemies/WyvernModel').then((mod) => { mod.preloadWyvernModels(); }),
    import('./enemies/TerrorhawkModel').then((mod) => { mod.preloadTerrorhawkModels(); }),
    import('./enemies/TigerModel').then((mod) => { mod.preloadTigerModels(); }),
    import('./enemies/WolfModel').then((mod) => { mod.preloadWolfModels(); }),
    import('./enemies/BearModel').then((mod) => { mod.preloadBearModels(); }),
    import('./enemies/SkyRayModel').then((mod) => { mod.preloadSkyRayModels(); }),
    import('./enemies/BoneSpiderModel').then((mod) => { mod.preloadBoneSpiderModels(); }),
    import('./enemies/SentinelModel').then((mod) => { mod.preloadSentinelModels(); }),
    import('./enemies/NemesisModel').then((mod) => { mod.preloadNemesisModels(); }),
    import('./enemies/StoneGiantModel').then((mod) => { mod.preloadStoneGiantModels(); }),
    import('./enemies/EternalOakModel').then((mod) => { mod.preloadEternalOakModels(); }),
    import('./enemies/ColossusModel').then((mod) => { mod.preloadColossusModels(); }),
    import('./enemies/ValkyrieModel').then((mod) => { mod.preloadValkyrieModels(); }),
  ]).catch((e) => console.warn('Enemy model preload failed (non-fatal):', e));
}


interface CoopGameSceneProps {
  onDamageNumbersUpdate?: (damageNumbers: DamageNumberData[]) => void;
  /** Wyvern Talons detonation floats — separate pool from main damage numbers. */
  onWyvernTalonsDetonationDamageNumbersUpdate?: (damageNumbers: DamageNumberData[]) => void;
  onDamageNumberComplete?: (id: string) => void;
  onCameraUpdate?: (camera: Camera, size: { width: number; height: number }) => void;
  onGameStateUpdate?: (gameState: {
    playerHealth: number;
    maxHealth: number;
    playerShield: number;
    maxShield: number;
    playerEnergy: number;
    maxEnergy: number;
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
  }) => void;
  onControlSystemUpdate?: (controlSystem: any) => void;
  onExperienceUpdate?: (experience: number, level: number) => void;
  onPlayerLevelUp?: (level: number) => void;
  onEssenceUpdate?: (essence: number) => void;
  onGoldUpdate?: (gold: number) => void;
  onFlowUpdate?: (flow: number) => void;
  onWoodUpdate?: (wood: number) => void;
  onStoneUpdate?: (stone: number) => void;
  onMeatUpdate?: (meat: number) => void;
  onHungerUpdate?: (hunger: number, starvingCritical: boolean) => void;
  /** Live hunger 0–100 from page (explore). Used for the low-hunger max-energy bonus. */
  playerHunger?: number;
  onFateUpdate?: (fate: number) => void;
  onMerchantUIUpdate?: (isVisible: boolean) => void;
  onSceneReady?: () => void;
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null;
  skillPointData?: SkillPointData;
  statPointData?: StatPointData;
  abilityLoadout?: AbilityLoadout | null;
  /** Parent overlay: throne prep UI (ability and/or talent modal) — when true, gameplay keys are disabled. */
  throneAbilityModalOpen?: boolean;
  /** Full-screen overlays (merchant, rules, tutorial, defeat, modals) — disables movement + combat input. */
  uiBlocksGameInput?: boolean;
  /** Open ability customization for the given throne weapon (co-op prep room). */
  onRequestThroneAbilityModal?: (weapon: WeaponType) => void;
  /** Open talent customization for the given throne weapon (co-op prep room). */
  onRequestThroneTalentModal?: (weapon: WeaponType) => void;
  /** After equipping a weapon from a throne pedestal (co-op prep) — e.g. roll class boons. */
  onThroneWeaponEquipped?: (weapon: WeaponType) => void;
  /** True after class talent has been picked for the currently equipped weapon — enables aspect cycling on that pedestal. */
  canCycleWeaponAspect?: boolean;
  /** Fired when the local player cycles weapon aspect in the throne room. */
  onWeaponAspectCycled?: (aspect: WeaponAspect) => void;
  /** When true (dev), `T` near the talent pillar opens the talent modal without competing with `X` + ability pillar. */
  throneDevTalentShortcutEnabled?: boolean;
  /** True when the room is cleared and the combat pedestal is waiting to be interacted with (aura shown). */
  pedestalBoonReady?: boolean;
  /** True after the player has interacted with the pedestal and picked (or skipped) the boon — portals become colored and usable. */
  portalsUnlocked?: boolean;
  /** Called when the player presses X near the combat pedestal in the main arena. */
  onCombatArenaPedestalInteract?: (rewardKind?: string | null) => void;
  /** Called when the player presses X near a cleared explore reward camp prop. */
  onExploreCampInteract?: (camp: ExploreCampPublic) => void;
  /** Called when the player presses X near the sunken temple sentinel (room IV). */
  onSunkenSentinelInteract?: () => void;
  /** Called when the player presses X near the Eternity's Palace Architect (room IV). */
  onEternityPalaceArchitectInteract?: () => void;
  /** Merchant dash charge purchased this run — grants a 4th dash orbital. */
  extraDashChargePurchased?: boolean;
  /** Proximity hint above the HUD health bar ("Press 'x' to interact"). */
  onInteractHintChange?: (hint: string | null) => void;
  /** Explore build menu open state (B key). */
  onBuildMenuChange?: (open: boolean, view?: 'root' | 'towers') => void;
  /** Explore barracks recruit panel visibility. */
  onBarracksRecruitOpenChange?: (open: boolean) => void;
  /** Explore research station panel visibility. */
  onResearchPanelOpenChange?: (open: boolean) => void;
  /** Explore shrine gift panel visibility. */
  onShrinePanelOpenChange?: (open: boolean) => void;
  /** Explore cathedral legendary panel visibility. */
  onCathedralPanelOpenChange?: (open: boolean, offer?: ExploreCathedralOfferEntry[]) => void;
  /** Explore obelisk shop panel visibility. */
  onObeliskPanelOpenChange?: (open: boolean) => void;
  /** Explore fire-pit cook panel visibility. */
  onFirePitHealOpenChange?: (open: boolean) => void;
  /** Local player died — e.g. show defeat UI. */
  onLocalPlayerDefeated?: () => void;
  /** Local player respawned/revived — e.g. hide defeat UI. */
  onLocalPlayerRevived?: () => void;
}

const COOP_INTERACT_HINT_TEXT = "Press 'x' to interact";

/** X / click pickup radius for gold and boss artifact drops (XZ). */
const COOP_GROUND_ITEM_PICKUP_RADIUS = 6;
/** Tighter auto-pickup radius for rune amulets only (XZ). */
const COOP_RUNE_AUTO_PICKUP_RADIUS = 2.5;

function getDreamShardCountForEnemyType(enemyType?: string | null, sleepwalker = false): number {
  if (sleepwalker) return getSleepwalkerDreamShardCount(enemyType);
  return getDefaultDreamShardCount(enemyType);
}

function isRuneAmuletItem(item: { type?: string; category?: string }) {
  return item.category !== 'boss_drop'
    && typeof item.type === 'string'
    && item.type.startsWith('AMULET_OF');
}

/** Skip auto-pickup when local inventory cannot usefully acquire this boss drop. */
function canLocalPlayerAcquireBossDrop(
  item: { type?: string; category?: string; rarity?: string },
  inventory: Array<{ type: string; rarity?: string }>,
): boolean {
  if (item.category !== 'boss_drop' || !item.type) return true;
  const existing = inventory.find((i) => i.type === item.type);
  if (isUpgradeableBossRelic(item.type)) {
    return resolveBossRelicPickup(existing?.rarity, item.rarity) !== 'discard';
  }
  if (isUniqueDreamLayerItem(item.type) && existing) return false;
  if (existing) return false;
  return true;
}

// Taunt Effect Indicator Component
function TauntEffectIndicator({ position, yOffset = 0 }: { position: { x: number; y: number; z: number }; yOffset?: number }) {
  const meshRef = useRef<any>(null);
  const ringRef = useRef<any>(null);

  useFrame((state) => {
    if (meshRef.current) {
      // Rotate the skull indicator
      meshRef.current.rotation.y = state.clock.elapsedTime * 2;
      // Pulse the size
      const scale = 1 + Math.sin(state.clock.elapsedTime * 4) * 0.1;
      meshRef.current.scale.setScalar(scale);
    }
    if (ringRef.current) {
      // Rotate the ring
      ringRef.current.rotation.z = state.clock.elapsedTime * 3;
      // Pulse opacity
      const material = ringRef.current.material as MeshBasicMaterial;
      material.opacity = 0.3 + Math.sin(state.clock.elapsedTime * 6) * 0.2;
    }
  });

  return (
    <group position={[position.x, position.y + yOffset, position.z]}>
      {/* Taunt indicator - rotating skull-like sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.9} />
      </mesh>

      {/* Pulsing ring effect */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.8, 1.2, 16]} />
        <meshBasicMaterial
          color="#ff0000"
          transparent
          opacity={0.5}
          side={2}
        />
      </mesh>

      {/* Warning indicator lines */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.8} />
      </mesh>
      <mesh position={[0.3, -0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.8} />
      </mesh>
      <mesh position={[-0.3, -0.5, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        <meshBasicMaterial color="#ffff00" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

// Amulet stat color map
const AMULET_COLORS: Record<string, string> = {
  strength:  '#ef4444',
  stamina:   '#22c55e',
  agility:   '#3b82f6',
  intellect: '#a855f7',
};

// Boss world mesh fallback when rarity missing (legacy drops)
const BOSS_DROP_FALLBACK_COLOR = '#fbbf24';

interface DroppedItemMeshProps {
  item: {
    id: string;
    type: string;
    stat?: string;
    label: string;
    category?: string;
    rarity?: string;
    position: { x: number; y: number; z: number };
  };
  playerPositionRef: React.MutableRefObject<Vector3>;
  onPickup: (itemId: string) => void;
}

function DroppedItemMesh({ item, playerPositionRef, onPickup }: DroppedItemMeshProps) {
  const groupRef = useRef<any>(null);
  const ringRef = useRef<any>(null);
  const glowRef = useRef<any>(null);
  const isBossDrop = item.category === 'boss_drop';
  const isRuneAmulet = isRuneAmuletItem(item);
  const rarityColor =
    isBossDrop && item.rarity && isItemRarity(item.rarity)
      ? ITEM_RARITY_COLORS[item.rarity]
      : null;
  const color =
    rarityColor ??
    (item.stat ? AMULET_COLORS[item.stat] : null) ??
    (!isBossDrop ? '#ffffff' : BOSS_DROP_FALLBACK_COLOR);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (groupRef.current) {
      groupRef.current.position.y = item.position.y + Math.sin(t * 2) * 0.15;
      groupRef.current.rotation.y = t * 1.5;
    }
    if (glowRef.current) {
      glowRef.current.material.opacity = 0.25 + Math.sin(t * 3) * 0.15;
    }
  });

  const handleClick = (e: any) => {
    if (isRuneAmulet) return;
    e.stopPropagation();
    const itemPos = new Vector3(item.position.x, item.position.y, item.position.z);
    const playerPos = playerPositionRef.current;
    const dist = playerPos.distanceTo(itemPos);
    if (dist <= COOP_GROUND_ITEM_PICKUP_RADIUS) {
      onPickup(item.id);
    }
  };

  return (
    <group
      ref={groupRef}
      position={[item.position.x, item.position.y, item.position.z]}
      onClick={isRuneAmulet ? undefined : handleClick}
    >
      {/* Outer glow sphere — larger for boss drops */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[isBossDrop ? 0.7 : 0.45, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={isBossDrop ? 0.35 : 0.3} depthWrite={false} />
      </mesh>

      {isBossDrop ? (
        <>
          {/* Boss drop: spinning diamond (dodecahedron) */}
          <mesh ref={ringRef}>
            <dodecahedronGeometry args={[0.28, 0]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.8} metalness={0.9} roughness={0.1} />
          </mesh>
          {/* Outer ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.4, 0.05, 8, 24]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Stronger glow for boss items */}
          <PooledEffectLight color={color} intensity={3.0} distance={5} />
        </>
      ) : (
        <>
          {/* Amulet ring (torus) */}
          <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.22, 0.06, 8, 20]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Center gem */}
          <mesh position={[0, 0, 0]}>
            <octahedronGeometry args={[0.1, 0]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} metalness={0.5} roughness={0.1} />
          </mesh>
          <PooledEffectLight color={color} intensity={1.5} distance={3} />
        </>
      )}
    </group>
  );
}

/** PhysicsSystem clamps player Y to sphere center at ~0.5; mirror for remote ECS Movement (humanoid locomotion clips). */
const REMOTE_PLAYER_CHARACTER_GROUND_Y = 0.5;
const scratchRemoteMovementXZ = new Vector3();
const scratchRemoteDashDirectionXZ = new Vector3();
const _remoteInterpPosScratch = new Vector3();
const _remoteInterpRotScratch = new Quaternion();
const _remoteInterpEulerScratch = new Euler();

function buildPlayerMovementDirectionPayload(
  movement: Movement,
  extras?: { isStunned?: boolean },
): PlayerMovementDirection {
  const isStunned = Boolean(extras?.isStunned);
  const immobilized = isStunned || movement.isFrozen || movement.isEntangled;
  const isDashing = !immobilized && movement.isDashing && movement.dashDirection.lengthSq() > 0.0001;
  const locomotionDirection = isDashing ? movement.dashDirection : movement.moveDirection;
  const hasLocomotionDirection = !immobilized && locomotionDirection.lengthSq() > 0.0001;
  const inputStrength = immobilized
    ? 0
    : isDashing
      ? Math.max(1, movement.inputStrength)
      : movement.inputStrength;

  return {
    x: hasLocomotionDirection ? locomotionDirection.x : 0,
    y: hasLocomotionDirection ? locomotionDirection.y : 0,
    z: hasLocomotionDirection ? locomotionDirection.z : 0,
    inputStrength,
    isGrounded: movement.isGrounded,
    isDashing: immobilized ? false : movement.isDashing,
    dashDirection: {
      x: immobilized ? 0 : movement.dashDirection.x,
      y: immobilized ? 0 : movement.dashDirection.y,
      z: immobilized ? 0 : movement.dashDirection.z,
    },
    isAttackSlowed: movement.isAttackSlowed,
    isIcebeaming: movement.isIcebeaming,
    isPrimeMateriaActive: movement.isPrimeMateriaActive,
    isIncinerationCharging: movement.isIncinerationCharging,
    isIncinerationArmed: movement.isIncinerationArmed,
    isLocustChanneling: movement.isLocustChanneling,
    isSprinting: immobilized ? false : movement.isSprinting,
    isStunned,
    isFrozen: movement.isFrozen,
    isEntangled: movement.isEntangled,
    isSlowed: movement.isSlowed,
    isCorrupted: movement.isCorrupted,
  };
}

// Module-level scratch for camera direction fallback in useFrame (avoids per-frame allocation).
const _camDirScratch = new Vector3();

const ZERO_PLAYER_MOVEMENT_DIRECTION: PlayerMovementDirection = {
  x: 0,
  y: 0,
  z: 0,
  inputStrength: 0,
  isGrounded: true,
  isDashing: false,
  dashDirection: { x: 0, y: 0, z: 0 },
  isAttackSlowed: false,
  isIcebeaming: false,
  isPrimeMateriaActive: false,
  isIncinerationCharging: false,
  isIncinerationArmed: false,
  isLocustChanneling: false,
  isSprinting: false,
  isStunned: false,
  isFrozen: false,
  isEntangled: false,
  isSlowed: false,
  isCorrupted: false,
};

/** Remote players use `movement.canMove = false`; PhysicsMovement never fills `Movement`. CharacterRenderer animates off `Movement`. */
function syncRemoteMovementForHumanoidAnimations(
  movement: Movement,
  serverPlayer: { position: { x: number; y: number; z: number }; movementDirection?: PlayerMovementDirection },
  options?: { stale?: boolean },
): void {
  movement.velocity.set(0, 0, 0);
  movement.acceleration.set(0, 0, 0);
  const md = serverPlayer.movementDirection;
  if (!md || options?.stale) {
    movement.isGrounded = serverPlayer.position.y <= REMOTE_PLAYER_CHARACTER_GROUND_Y + 0.002;
    movement.moveDirection.set(0, 0, 0);
    movement.inputStrength = 0;
    movement.isDashing = false;
    movement.dashDirection.set(0, 0, 0);
    movement.isAttackSlowed = false;
    movement.isIcebeaming = false;
    movement.isPrimeMateriaActive = false;
    movement.isIncinerationCharging = false;
    movement.isIncinerationArmed = false;
    movement.isLocustChanneling = false;
    movement.isSprinting = false;
    return;
  }
  const immobilized = Boolean(md.isStunned || md.isFrozen || md.isEntangled);
  movement.isGrounded = md.isGrounded ?? (serverPlayer.position.y <= REMOTE_PLAYER_CHARACTER_GROUND_Y + 0.002);
  movement.isDashing = immobilized ? false : Boolean(md.isDashing);
  movement.isAttackSlowed = Boolean(md.isAttackSlowed);
  movement.isIcebeaming = Boolean(md.isIcebeaming);
  movement.isPrimeMateriaActive = Boolean(md.isPrimeMateriaActive);
  movement.isIncinerationCharging = Boolean(md.isIncinerationCharging);
  movement.isIncinerationArmed = Boolean(md.isIncinerationArmed);
  movement.isLocustChanneling = Boolean(md.isLocustChanneling);
  movement.isSprinting = immobilized ? false : Boolean(md.isSprinting);

  const dd = md.dashDirection;
  if (!immobilized && dd) {
    scratchRemoteDashDirectionXZ.set(dd.x, 0, dd.z);
    if (scratchRemoteDashDirectionXZ.lengthSq() > 0.0001) {
      movement.dashDirection.copy(scratchRemoteDashDirectionXZ.normalize());
    } else {
      movement.dashDirection.set(0, 0, 0);
    }
  } else {
    movement.dashDirection.set(0, 0, 0);
  }

  if (immobilized) {
    movement.moveDirection.set(0, 0, 0);
    movement.inputStrength = 0;
    return;
  }

  scratchRemoteMovementXZ.set(md.x, 0, md.z);
  const len = scratchRemoteMovementXZ.length();
  const inputStrength = md.inputStrength ?? Math.min(1, len);
  if (len > 0.01 && inputStrength > 0.01) {
    movement.setMoveDirection(scratchRemoteMovementXZ, inputStrength);
  } else {
    movement.moveDirection.set(0, 0, 0);
    movement.inputStrength = 0;
  }
}

export function CoopGameScene({
  onDamageNumbersUpdate,
  onWyvernTalonsDetonationDamageNumbersUpdate,
  onDamageNumberComplete,
  onCameraUpdate,
  onGameStateUpdate,
  onControlSystemUpdate,
  onExperienceUpdate,
  onPlayerLevelUp,
  onEssenceUpdate,
  onGoldUpdate,
  onFlowUpdate,
  onWoodUpdate,
  onStoneUpdate,
  onMeatUpdate,
  onHungerUpdate,
  playerHunger = 0,
  onFateUpdate,
  onMerchantUIUpdate,
  onSceneReady,
  selectedWeapons,
  skillPointData,
  statPointData,
  abilityLoadout,
  throneAbilityModalOpen = false,
  uiBlocksGameInput = false,
  onRequestThroneAbilityModal,
  onRequestThroneTalentModal,
  onThroneWeaponEquipped,
  canCycleWeaponAspect = false,
  onWeaponAspectCycled,
  throneDevTalentShortcutEnabled = false,
  pedestalBoonReady = false,
  portalsUnlocked = false,
  onCombatArenaPedestalInteract,
  onExploreCampInteract,
  onSunkenSentinelInteract,
  onEternityPalaceArchitectInteract,
  extraDashChargePurchased = false,
  onInteractHintChange,
  onBuildMenuChange,
  onBarracksRecruitOpenChange,
  onResearchPanelOpenChange,
  onShrinePanelOpenChange,
  onCathedralPanelOpenChange,
  onObeliskPanelOpenChange,
  onFirePitHealOpenChange,
  onLocalPlayerDefeated,
  onLocalPlayerRevived,
}: CoopGameSceneProps = {}) {
  const { camera, gl, scene } = useThree();
  const {
    socket,
    playersRef: contextPlayersRef,
    playersTransformsRef,
    enemiesRef,
    enemyTransformsRef,
    setPlayers,
    enterCombatArena,
    useCoopFountain,
    chooseCoopAlly,
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerArchetype,
    updatePlayerWeaponAspect,
    updatePlayerHealth,
    updatePlayerShield,
    updatePlayerEnergy,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerAnimationState,
    broadcastPlayerEffect, // For broadcasting venom effects
    broadcastPlayerDamage, // For broadcasting player damage
    broadcastPlayerHealing, // For broadcasting player healing
    broadcastAlliedHealing, // For broadcasting allied unit healing
    broadcastPlayerDebuff, // For broadcasting debuff effects
    broadcastPlayerStealth, // For broadcasting stealth state
    broadcastPlayerTornadoEffect, // For broadcasting tornado effects
    broadcastPlayerDeathEffect, // For broadcasting death effects
    broadcastPlayerKnockback, // For broadcasting knockback effects
    damageEnemy, // New function for enemy damage with source player tracking
    subscribeEnemyDamage,
    damageMushroom,
    damageTree,
    damageRoot,
    damageRock,
    damageSpine,
    placeBuilding,
    barracksRecruitAlly,
    researchPurchase,
    shrineClaim,
    cathedralClaim,
    obeliskBuyTalent,
    firePitHeal,
    detonateWyvernConcentratedVenom,
    triggerTyrantsCloakStrike,
    triggerDeathdealerStaggerProc,
    applyStatusEffect, // For applying status effects to enemies (freeze, slow, corrupted)
    updatePlayerEssence,
    updatePlayerFlow,
    openChat,
    closeChat,
    setSelectedWeapons,
    setSelectedArchetype,
    rememberWeaponAspect,
    setAbilityLoadout,
    pickupItem,
    pickupGoldDrop,
    pickupWoodDrop,
    pickupStoneDrop,
    pickupMeatDrop,
    registerMerchantPurchaseSuccessHandler,
    registerMerchantNpcGreetHandler,
    registerPlayerGoldChangedHandler,
    registerPlayerFlowChangedHandler,
    registerPlayerWoodChangedHandler,
    registerPlayerStoneChangedHandler,
    registerPlayerMeatChangedHandler,
    registerPlayerHungerChangedHandler,
    registerPlayerFateChangedHandler,
    purchaseMerchantItem,
    purchaseMerchantHeal,
    purchaseDreamLayerItem,
    purchaseDreamLayerHeal,
    resetLocalPositionEmitThrottle,
    coopTransitionOverlayRef,
    coopPendingPortalSnapRef,
    coopRoomEntryTokenRef,
    coopCombatArenaEnterAtRef,
    hideCoopPortalTransition,
    endCoopPortalTransition,
    claimDeepSanctumReward,
    chooseEternityPalaceLoot,
  } = useMultiplayerActions();

  const {
    players,
    playerRosterMetaRev,
    enemies,
    gameStarted,
    combatArenaActive,
    gameMode,
    isInRoom,
    currentRoomId,
    mushroomState,
    treeState,
    rootState,
    rockState,
    spineState,
    exploreResearch,
    isChatOpen,
    talentLoadout,
    droppedItems,
    goldDrops,
    woodDrops,
    stoneDrops,
    meatDrops,
    inventory,
    campTypes,
    thronePortalOffer,
    coopMainArenaPortalPhase,
    coopBossThroneArena,
    coopCombatArenaEnterSeq,
    coopMainArenaIntermissionSeq,
    coopIntroIntermissionSeq,
    coopSunkenIntermissionSeq,
    coopEternityIntermissionSeq,
    coopFaeRealmIntermissionSeq,
    coopIntroPortalOpen,
    coopIntroFountainPhase,
    coopIntroFountainUsed,
    coopIntroAllyChoiceMade,
    coopFaeRealmPortalOpen,
    coopSunkenPortalOpen,
    coopSunkenFountainPhase,
    coopSunkenFountainUsed,
    coopSunkenLootClaimedPlayerIds,
    coopSunkenLootPhaseComplete,
    coopEternityPortalOpen,
    coopEternityFountainPhase,
    coopEternityFountainUsed,
    coopEternityLootOffer,
    coopEternityLootClaimedPlayerIds,
    coopEternityLootPhaseComplete,
    coopPetCompanionUpgrade,
    coopEternityCompleted,
    coopEternityActive,
    coopEternityRoomIndex,
    coopFaeRealmRoomIndex,
    coopSunkenRoomIndex,
    coopAllyOffer,
    coopAllyKind,
    coopFaeBeastCompanionGranted,
    coopFaeBeastCompanionKind,
    coopVoidPortalOffered,
    coopDeepSanctumLevel,
    deepSanctumRewardKind,
    coopDeepSanctumIntermissionSeq,
    coopEdenFountainUsed,
    coopEdenResumeKind,
    coopEdenIntermissionSeq,
    coopFalseEdenCleared,
    deliriumStructure,
    coopDeliriumActive,
    coopDeliriumEventEnded,
    coopDeliriumSuccess,
    coopTransitionOverlay,
    coopClearedRoomColor,
    coopTerrainTheme,
    coopSkyPresetIndex,
    coopGrassPresetIndex,
    coopCurrentRoomKind,
    coopExploreSeed,
    exploreCamps,
    coopClearedRoomKind,
    coopDefenseFountainActive,
    coopDefenseFountainUsed,
    selectedArchetype,
    selectedWeaponAspect,
    weaponAspectByWeapon,
    merchantInventory,
    merchantPurchaseState,
    dreamLayerInventory,
    dreamLayerPurchaseState,
  } = useMultiplayerRoom();

  const playersRef = useRef(players);
  playersRef.current = players;
  // Mirror context ref for remote-player interpolation (60 Hz position bypasses React state).
  void contextPlayersRef;

  const playerIdsKey = useMemo(
    () => Array.from(players.keys()).sort().join(','),
    [players],
  );

  const enemyIdsKey = useMemo(
    () => Array.from(enemies.keys()).sort().join(','),
    [enemies],
  );

  const enemiesList = useMemo(() => Array.from(enemies.values()), [enemyIdsKey, enemies]);
  const enemyTypesKey = useMemo(
    () => Array.from(new Set(enemiesList.map((enemy) => enemy.type))).sort().join(','),
    [enemiesList],
  );
  const enemiesByType = useMemo(() => {
    const byType = new Map<string, ServerEnemy[]>();
    for (const enemy of enemiesList) {
      const list = byType.get(enemy.type) ?? [];
      list.push(enemy);
      byType.set(enemy.type, list);
    }
    return byType;
  }, [enemiesList]);

  const inventorySnapshotRef = useRef(inventory);
  inventorySnapshotRef.current = inventory;

  /** Persephone ownership for the local lethal-save hook (cleared immediately on consume). */
  const hasPersephoneRef = useRef(false);
  hasPersephoneRef.current = inventory.some((item) => item.type === PERSEPHONE);

  const talentLoadoutRef = useRef(talentLoadout);
  const lastRebukeTimeSecRef = useRef(0);
  const lastTyrantsCloakTimeSecRef = useRef(0);
  const lastOrbShieldTimeSecRef = useRef(0);
  const lastDivineColdProcAtRef = useRef(0);
  const abilityLoadoutRef = useRef(abilityLoadout ?? null);
  useEffect(() => {
    talentLoadoutRef.current = talentLoadout;
  }, [talentLoadout]);
  useEffect(() => {
    abilityLoadoutRef.current = abilityLoadout ?? null;
  }, [abilityLoadout]);

  const effectiveCombatStats = useMemo(
    (): PlayerStats =>
      statPointData
        ? StatSystem.getEffectiveStatsWithInventory(statPointData.stats, inventory)
        : ZERO_PLAYER_STATS,
    [inventory, statPointData],
  );

  const exodiaSetCount = useMemo(() => getExodiaSetCount(inventory), [inventory]);
  const exodiaSetBonuses = useMemo(() => getExodiaSetStatBonuses(exodiaSetCount), [exodiaSetCount]);
  const hexmetalSetCount = useMemo(() => getHexmetalSetCount(inventory), [inventory]);
  const archmageSetCount = useMemo(() => getArchmageSetCount(inventory), [inventory]);
  const archmageSetBonuses = useMemo(
    () => getArchmageSetStatBonuses(archmageSetCount),
    [archmageSetCount],
  );
  const ownedItemTypes = useMemo(() => inventoryToOwnedTypes(inventory), [inventory]);

  const dreamLayerCombatStats = useMemo(
    (): PlayerStats => ({
      strength: effectiveCombatStats.strength + exodiaSetBonuses.strength,
      stamina: effectiveCombatStats.stamina + exodiaSetBonuses.stamina,
      agility: effectiveCombatStats.agility,
      intellect:
        effectiveCombatStats.intellect +
        exodiaSetBonuses.intellect +
        archmageSetBonuses.intellect,
    }),
    [effectiveCombatStats, exodiaSetBonuses, archmageSetBonuses],
  );

  const lastKaiserProcSecRef = useRef(0);

  const roomBoomGhostTrailColor = useMemo(() => {
    if (shouldApplyInfernalDashTalent(talentLoadout)) return '#ff2f18';
    if (shouldApplyGlacialDashTalent(talentLoadout)) return '#a855ff';
    if (shouldApplyMendingDashTalent(talentLoadout)) return '#22ff66';
    if (shouldApplyStaggeringDashTalent(talentLoadout)) return '#73d8ff';
    return undefined;
  }, [talentLoadout]);

  const inThroneRoom = useMemo(
    () => gameMode === 'coop' && gameStarted && !combatArenaActive,
    [gameMode, gameStarted, combatArenaActive],
  );

  /** Stripped throne shell: boss fight + post-boss portal pause (server `coopBossThroneArena`). */
  const inBossThroneArena = useMemo(
    () => gameMode === 'coop' && gameStarted && combatArenaActive && coopBossThroneArena,
    [gameMode, gameStarted, combatArenaActive, coopBossThroneArena],
  );
  const isHexCombatArena =
    coopCurrentRoomKind === 'stat'
    || coopCurrentRoomKind === 'trial'
    || coopCurrentRoomKind === 'merchant'
    || coopCurrentRoomKind === 'eden'
    || coopCurrentRoomKind === 'false_eden'
    || coopCurrentRoomKind === 'dream_layer'
    || coopCurrentRoomKind === 'eden_finale';
  const isCastleRoom =
    coopCurrentRoomKind === 'intro' || coopCurrentRoomKind === 'deep_sanctum';
  const isSunkenTemple = coopCurrentRoomKind === 'sunken_temple';
  const isEternityPalace = coopCurrentRoomKind === 'eternity_palace';
  const isFaeRealm = coopCurrentRoomKind === 'fae_realm';
  const isExplore = coopCurrentRoomKind === 'explore';
  const isDefense = coopCurrentRoomKind === 'defense';
  const isDungeon = coopCurrentRoomKind === 'dungeon';
  const isSkyTemple = coopCurrentRoomKind === 'sky_temple';
  const isMeshWalkRoom = isDungeon || isSkyTemple;
  const isErebusGate = coopCurrentRoomKind === 'erebus_gate';
  const isIntroCastleRoom = coopCurrentRoomKind === 'intro';
  const hexArenaVariant =
    coopCurrentRoomKind === 'dream_layer'
      ? 'dream_layer' as const
      : (coopCurrentRoomKind === 'eden' || coopCurrentRoomKind === 'false_eden' || coopCurrentRoomKind === 'eden_finale')
        ? 'eden' as const
        : coopCurrentRoomKind === 'merchant'
          ? 'merchant' as const
          : coopCurrentRoomKind === 'trial'
            ? 'trial' as const
            : 'stat' as const;

  const coopArenaClampBounds = useMemo(() => {
    if (isExplore) return null;
    if (isDungeon) return null;
    if (isSkyTemple) return null;
    if (isDefense) return DEFENSE_ROOM_RADIUS;
    if (inThroneRoom || inBossThroneArena) return COOP_THRONE_ROOM_RADIUS;
    if (isFaeRealm) return FAE_REALM_HEX_RADIUS;
    if (isEternityPalace) return ETERNITY_PALACE_HEX_RADIUS;
    if (isSunkenTemple) return PENTAGON_ARENA_RADIUS;
    if (isErebusGate) return CASTLE_ROOM_BOUNDS.halfX;
    if (isCastleRoom) return CASTLE_ROOM_BOUNDS;
    if (isHexCombatArena) return HEX_ARENA_RADIUS;
    return MAIN_ARENA_HEX_RADIUS;
  }, [inThroneRoom, inBossThroneArena, isCastleRoom, isFaeRealm, isExplore, isDefense, isDungeon, isSkyTemple, isEternityPalace, isSunkenTemple, isErebusGate, isHexCombatArena]);

  const dimThroneLikeLighting = inThroneRoom || inBossThroneArena || isDefense || isDungeon || isSkyTemple;

  const isColoredCoopRoom =
    coopCurrentRoomKind === 'blue'
    || coopCurrentRoomKind === 'green'
    || coopCurrentRoomKind === 'red'
    || coopCurrentRoomKind === 'purple';
  const mushroomsEnabled =
    !inThroneRoom
    && !inBossThroneArena
    && !isCastleRoom
    && !isSunkenTemple
    && !isEternityPalace
    && !isErebusGate
    && !isDefense
    && !isDungeon
    && !isSkyTemple
    && !isColoredCoopRoom;

  const [exploreMushrooms, setExploreMushrooms] = useState<MushroomInstance[]>([]);
  const [exploreTrees, setExploreTrees] = useState<ExploreTreeInstance[]>([]);
  const [exploreRoots, setExploreRoots] = useState<ExploreRootInstance[]>([]);
  const [exploreRocks, setExploreRocks] = useState<ExploreRockInstance[]>([]);
  const [exploreSpines, setExploreSpines] = useState<ExploreSpineInstance[]>([]);
  useEffect(() => {
    if (!isExplore) {
      setExploreMushroomListener(null);
      setExploreTreeListener(null);
      setExploreRootListener(null);
      setExploreRockListener(null);
      setExploreSpineListener(null);
      setExploreMushrooms([]);
      setExploreTrees([]);
      setExploreRoots([]);
      setExploreRocks([]);
      setExploreSpines([]);
      return;
    }
    setExploreMushroomListener((instances) => {
      setExploreMushrooms([...instances]);
    });
    setExploreTreeListener((instances) => {
      setExploreTrees([...instances]);
    });
    setExploreRootListener((instances) => {
      setExploreRoots([...instances]);
    });
    setExploreRockListener((instances) => {
      setExploreRocks([...instances]);
    });
    setExploreSpineListener((instances) => {
      setExploreSpines([...instances]);
    });
    return () => {
      setExploreMushroomListener(null);
      setExploreTreeListener(null);
      setExploreRootListener(null);
      setExploreRockListener(null);
      setExploreSpineListener(null);
    };
  }, [isExplore]);

  const effectiveMushroomHealth = useMemo(() => {
    if (mushroomState?.health?.length === MUSHROOM_COUNT) return mushroomState.health;
    return Array.from({ length: MUSHROOM_COUNT }, () => MUSHROOM_MAX_HP);
  }, [mushroomState]);

  const mushroomHiddenIndices = useMemo(() => {
    const s = new Set<number>();
    if (isExplore) {
      const eh = mushroomState?.exploreHealth;
      if (eh) {
        for (const [k, h] of Object.entries(eh)) {
          if (h <= 0) s.add(Number(k));
        }
      }
      return s;
    }
    effectiveMushroomHealth.forEach((h, i) => {
      if (h <= 0) s.add(i);
    });
    return s;
  }, [isExplore, mushroomState, effectiveMushroomHealth]);

  const treeHiddenIndices = useMemo(() => {
    const s = new Set<number>();
    if (!isExplore) return s;
    const eh = treeState?.exploreHealth;
    if (eh) {
      for (const [k, h] of Object.entries(eh)) {
        if (h <= 0) s.add(Number(k));
      }
    }
    return s;
  }, [isExplore, treeState]);

  const rootHiddenIndices = useMemo(() => {
    const s = new Set<number>();
    if (!isExplore) return s;
    const eh = rootState?.exploreHealth;
    if (eh) {
      for (const [k, h] of Object.entries(eh)) {
        if (h <= 0) s.add(Number(k));
      }
    }
    return s;
  }, [isExplore, rootState]);

  const rockHiddenIndices = useMemo(() => {
    const s = new Set<number>();
    if (!isExplore) return s;
    const eh = rockState?.exploreHealth;
    if (eh) {
      for (const [k, h] of Object.entries(eh)) {
        if (h <= 0) s.add(Number(k));
      }
    }
    return s;
  }, [isExplore, rockState]);

  const spineHiddenIndices = useMemo(() => {
    const s = new Set<number>();
    if (!isExplore) return s;
    const eh = spineState?.exploreHealth;
    if (eh) {
      for (const [k, h] of Object.entries(eh)) {
        if (h <= 0) s.add(Number(k));
      }
    }
    return s;
  }, [isExplore, spineState]);

  const destroyedTreeHealthMap = useMemo(() => {
    const map = new Map<number, number>();
    const eh = treeState?.exploreHealth;
    if (!eh) return map;
    for (const [k, h] of Object.entries(eh)) {
      map.set(Number(k), h);
    }
    return map;
  }, [treeState?.exploreHealth]);

  const destroyedRootHealthMap = useMemo(() => {
    const map = new Map<number, number>();
    const eh = rootState?.exploreHealth;
    if (!eh) return map;
    for (const [k, h] of Object.entries(eh)) {
      map.set(Number(k), h);
    }
    return map;
  }, [rootState?.exploreHealth]);

  const mushroomTargetsForMelee = useMemo(() => {
    const out: Array<{ index: number; position: Vector3 }> = [];
    if (isExplore) {
      for (const inst of exploreMushrooms) {
        const hp = mushroomState?.exploreHealth?.[inst.index];
        if (hp !== undefined && hp <= 0) continue;
        const c = getMushroomColliderCenter(inst);
        out.push({ index: inst.index, position: new Vector3(c.x, c.y, c.z) });
      }
      return out;
    }
    const instances = buildMushroomInstances();
    for (const inst of instances) {
      if (effectiveMushroomHealth[inst.index] > 0) {
        const c = getMushroomColliderCenter(inst);
        out.push({ index: inst.index, position: new Vector3(c.x, c.y, c.z) });
      }
    }
    return out;
  }, [isExplore, exploreMushrooms, mushroomState, effectiveMushroomHealth]);

  const treeTargetsForMelee = useMemo(() => {
    const out: Array<{ index: number; position: Vector3; radius: number }> = [];
    if (!isExplore) return out;
    for (const inst of exploreTrees) {
      const hp = treeState?.exploreHealth?.[inst.index];
      if (hp !== undefined && hp <= 0) continue;
      out.push({
        index: inst.index,
        position: new Vector3(inst.x, EXPLORE_TREE_COMBAT_CENTER_Y, inst.z),
        radius: exploreTreeCombatRadius(inst.scale),
      });
    }
    return out;
  }, [isExplore, exploreTrees, treeState]);

  const rootTargetsForMelee = useMemo(() => {
    const out: Array<{ index: number; position: Vector3; radius: number }> = [];
    if (!isExplore) return out;
    for (const inst of exploreRoots) {
      const hp = rootState?.exploreHealth?.[inst.index];
      if (hp !== undefined && hp <= 0) continue;
      out.push({
        index: inst.index,
        position: new Vector3(inst.x, EXPLORE_ROOT_COMBAT_CENTER_Y, inst.z),
        radius: exploreRootCombatRadius(inst.scale),
      });
    }
    return out;
  }, [isExplore, exploreRoots, rootState]);

  const rockTargetsForMelee = useMemo(() => {
    const out: Array<{ index: number; position: Vector3; radius: number }> = [];
    if (!isExplore || !exploreResearch.stoneBreaker) return out;
    for (const inst of exploreRocks) {
      const hp = rockState?.exploreHealth?.[inst.index];
      if (hp !== undefined && hp <= 0) continue;
      out.push({
        index: inst.index,
        position: new Vector3(inst.x, EXPLORE_ROCK_COMBAT_CENTER_Y, inst.z),
        radius: exploreRockCombatRadius(inst.radius),
      });
    }
    return out;
  }, [isExplore, exploreResearch.stoneBreaker, exploreRocks, rockState]);

  const spineTargetsForMelee = useMemo(() => {
    const out: Array<{ index: number; position: Vector3; radius: number }> = [];
    if (!isExplore || !exploreResearch.soulStealer) return out;
    for (const inst of exploreSpines) {
      const hp = spineState?.exploreHealth?.[inst.index];
      if (hp !== undefined && hp <= 0) continue;
      out.push({
        index: inst.index,
        position: new Vector3(inst.x, EXPLORE_SPINE_COMBAT_CENTER_Y, inst.z),
        radius: exploreSpineCombatRadius(inst.radius),
      });
    }
    return out;
  }, [isExplore, exploreResearch.soulStealer, exploreSpines, spineState]);

  const prevMushroomHealthRef = useRef<number[] | null>(null);
    // Reset the health snapshot whenever we enter a new combat room so the diff
  // effect below does not treat freshly-restored mushrooms as newly destroyed.
  useEffect(() => {
    prevMushroomHealthRef.current = null;
  }, [coopCombatArenaEnterSeq]);

  useEffect(() => {
    if (isExplore) return;
    // When prev is null (first render after a room enter) default to the current
    // snapshot so the diff produces no eruptions — the authoritative state just
    // arrived from the server and nothing has changed yet.
    const prev =
      prevMushroomHealthRef.current && prevMushroomHealthRef.current.length === effectiveMushroomHealth.length
        ? prevMushroomHealthRef.current
        : [...effectiveMushroomHealth];
    const spawned: Array<{ id: string; pos: Vector3 }> = [];
    for (let i = 0; i < effectiveMushroomHealth.length; i++) {
      if (prev[i] > 0 && effectiveMushroomHealth[i] <= 0) {
        const inst = buildMushroomInstances()[i];
        if (inst) {
          const id = `mushroom-erupt-${i}-${Date.now()}`;
          spawned.push({ id, pos: new Vector3(inst.x, 0.1, inst.z) });
        }
      }
    }
    prevMushroomHealthRef.current = [...effectiveMushroomHealth];
    if (spawned.length > 0) {
      environmentVfxLayerRef.current?.addMushroomEruptions(spawned.map(({ id, pos }) => ({ id, pos })));
    }
  }, [effectiveMushroomHealth, isExplore]);

  const prevExploreMushroomHealthRef = useRef<Record<number, number>>({});
  useEffect(() => {
    if (!isExplore) {
      prevExploreMushroomHealthRef.current = {};
      return;
    }
    const cur = mushroomState?.exploreHealth ?? {};
    const prev = prevExploreMushroomHealthRef.current;
    const spawned: Array<{ id: string; pos: Vector3 }> = [];
    for (const [k, h] of Object.entries(cur)) {
      const idx = Number(k);
      const wasAlive = prev[idx] === undefined || prev[idx]! > 0;
      if (wasAlive && h <= 0) {
        const inst =
          exploreMushrooms.find((m) => m.index === idx)
          ?? getExploreMushroom(coopExploreSeed || 1, idx);
        if (inst) {
          spawned.push({
            id: `mushroom-erupt-${idx}-${Date.now()}`,
            pos: new Vector3(inst.x, 0.1, inst.z),
          });
        }
      }
    }
    prevExploreMushroomHealthRef.current = { ...cur };
    if (spawned.length > 0) {
      environmentVfxLayerRef.current?.addMushroomEruptions(spawned.map(({ id, pos }) => ({ id, pos })));
    }
  }, [isExplore, mushroomState?.exploreHealth, exploreMushrooms, coopExploreSeed]);

  const onMushroomMeleeHit = useCallback(
    (index: number, baseDamage: number) => {
      damageMushroom(index, baseDamage, socket?.id);
    },
    [damageMushroom, socket?.id],
  );

  const onTreeMeleeHit = useCallback(
    (index: number, baseDamage: number) => {
      damageTree(index, baseDamage, socket?.id);
    },
    [damageTree, socket?.id],
  );

  const onRootMeleeHit = useCallback(
    (index: number, baseDamage: number) => {
      damageRoot(index, baseDamage, socket?.id);
    },
    [damageRoot, socket?.id],
  );

  const onRockMeleeHit = useCallback(
    (index: number, baseDamage: number) => {
      damageRock(index, baseDamage, socket?.id);
    },
    [damageRock, socket?.id],
  );

  const onSpineMeleeHit = useCallback(
    (index: number, baseDamage: number) => {
      damageSpine(index, baseDamage, socket?.id);
    },
    [damageSpine, socket?.id],
  );

  // Debug multiplayer state
  useEffect(() => {
  }, [gameStarted, isInRoom, currentRoomId, socket?.connected, socket?.id, players.size, enemies.size]);

  // ==================== MEMORY MANAGEMENT ====================
  /** Chrome: trigger emergency cleanup when heap is near the tab limit (ratio), not a fixed 800MB. */
  const EMERGENCY_HEAP_USE_RATIO = 0.88;
  /** If `jsHeapSizeLimit` is missing, use this byte floor so dev still gets relief under pressure. */
  const MEMORY_CRITICAL_HEAP_FALLBACK = 1.5 * 1024 * 1024 * 1024;
  /** Soft warning: ~70% of limit (Chrome only). */
  const MEMORY_WARNING_HEAP_RATIO = 0.7;
  const EMERGENCY_CLEANUP_COOLDOWN = 10000; // 10 seconds between emergency cleanups
  
  // Refs for memory tracking
  const lastEmergencyCleanup = useRef(0);
  const lastMemoryCheck = useRef(0);
  const lastDevPerfEngineSample = useRef(0);
  const previousEnemyStates = useRef<Map<string, any>>(new Map());

  const engineRef = useRef<Engine | null>(null);
  const playerEntityRef = useRef<number | null>(null);
  const controlSystemRef = useRef<ControlSystem | null>(null);
  const wraithStrikeSlashImpactQueueRef = useRef<
    | ((
        pos: Vector3,
        dir: Vector3,
        meta?: {
          wrathfulStrike?: boolean;
          infestedStrike?: boolean;
          wraithGuard?: boolean;
          staggeringStrike?: boolean;
        },
      ) => void)
    | null
  >(null);
  // Track current stat data in a ref for use inside event handler closures
  const playerStatDataRef = useRef<StatPointData | undefined>(statPointData);
  // Track previous effective stamina to detect increases and apply healing
  const prevEffectiveStaminaRef = useRef<number>(0);
  const cameraSystemRef = useRef<CameraSystem | null>(null);
  const localStunCameraUnlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // summonedUnitSystemRef removed - using server-authoritative summoned units
  const reanimateRef = useRef<ReanimateRef>(null);
  const damagePlayerCallbackRef = useRef<((playerId: string, damage: number, damageType?: string, isCritical?: boolean) => void) | null>(null);
  const isInitialized = useRef(false);
  const coopGameSetupInitializedRef = useRef(false);
  const lastAnimationBroadcast = useRef(0);
  const lastMeleeSoundTime = useRef(new Map<string, number>());
  // Knight/Templar miss-sound scheduling: cancel timer when damage event confirms a hit
  const knightPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const templarPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const spectrePendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const deathKnightPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const shamanPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const serpentPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const tigerPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const wolfPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const bearPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const boneSpiderPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const skyrayPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const terrorhawkPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const wyvernPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Throttle fan-volley firebolt impact SFX so 5 bolts don't stack 5 sounds. */
  const breathImpactSfxAtRef = useRef(new Map<string, number>());
  const bossPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nemesisPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const titanPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const stoneGiantPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const eternalOakPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const colossusPendingMissTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Viper shotId → targetPlayerId so miss text only shows for the targeted local player. */
  const viperPendingShotTargetsRef = useRef(new Map<string, string>());
  /** Pending Viper line + arrow setTimeouts; cleared on socket effect cleanup. */
  const viperAttackScheduleTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** tentacle ground telegraph: per-enemy windup/impact timers */
  const tentacleSpinePendingByEnemyRef = useRef<
    Map<
      string,
      {
        tAdd?: ReturnType<typeof setTimeout>;
        tFail?: ReturnType<typeof setTimeout>;
        tImpact?: ReturnType<typeof setTimeout>;
        lineId: string;
      }
    >
  >(new Map());
  /** Last slam timestamp per trap — ignore stale windup packets after slam */
  const tentacleSpineLastSlamAtRef = useRef<Map<string, number>>(new Map());
  // Alternating damage-sound variant (1 or 2) for knight and templar
  const knightDamageVariant = useRef<1 | 2>(1);
  const templarDamageVariant = useRef<1 | 2>(1);
  const shadeDamageVariant = useRef<1 | 2 | 3>(1);
  const lastTitanBladestormWhirwindAt = useRef(0);
  const realTimePlayerPositionRef = useRef<Vector3>(new Vector3(0, 0.5, COOP_MAIN_DEFAULT_SPAWN_Z));
  const runebladeWhirlwindInstanceRef = useRef<number | undefined>(undefined);
  const localWhirlwindFailsafeTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const remotePlayerWhirlwindInstancesRef = useRef<Map<string, number>>(new Map());
  const remotePlayerWhirlwindStartTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const remotePlayerWhirlwindFailsafeTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const stopLocalRunebladeWhirlwind = useCallback(() => {
    if (localWhirlwindFailsafeTimeoutRef.current !== undefined) {
      clearTimeout(localWhirlwindFailsafeTimeoutRef.current);
      localWhirlwindFailsafeTimeoutRef.current = undefined;
    }
    const instance = runebladeWhirlwindInstanceRef.current;
    window.audioSystem?.stopRunebladeWhirlwindSound?.(instance);
    runebladeWhirlwindInstanceRef.current = undefined;
  }, []);
  const _lastSetPlayerPositionMs = useRef<number>(0);
  const _scratchCamDir = useRef<Vector3>(new Vector3());
  const pendingPortalSnapRef = coopPendingPortalSnapRef;
  const lastAppliedCombatEnterSeqRef = useRef(0);
  const lastAppliedIntermissionSeqRef = useRef(0);
  /** One-shot halt when portal overlay ref flips true (before React disables input). */
  const portalOverlayLocomotionHaltedRef = useRef(false);
  const resetLocalPositionEmitThrottleRef = useRef(resetLocalPositionEmitThrottle);
  resetLocalPositionEmitThrottleRef.current = resetLocalPositionEmitThrottle;
  /** Blocks authoritative server Y snaps while the local player is falling into an intro room. */
  const voidPortalFallActiveRef = useRef(false);
  /** Timestamp (ms) when portal-fall rise phase began. */
  const portalFallRiseStartMsRef = useRef(0);
  /** Timestamp (ms) when the current portal overlay session started. */
  const portalOverlayStartedAtRef = useRef(0);
  /** Timestamp (ms) when portal-fall switched from rise to fall. */
  const portalFallFallStartMsRef = useRef(0);
  /** Y position captured when portal-fall transitions from rise to fall. */
  const portalFallStartYRef = useRef(VOID_PORTAL_FALL_SPAWN_Y);
  const applyDungeonGroundSnapRef = useRef<
    (x: number, z: number, rotation?: { x: number; y: number; z: number } | null) => boolean
  >(() => false);

  useEffect(() => {
    const playWhenReady = (play: () => void) => {
      const tryPlay = () => {
        if (coopTransitionOverlayRef.current) {
          window.setTimeout(tryPlay, 100);
          return;
        }
        play();
      };
      window.setTimeout(tryPlay, 400);
    };

    const unregisterGreet = registerMerchantNpcGreetHandler(({ kind }) => {
      if (kind !== 'arrival') return;
      playWhenReady(() => {
        window.audioSystem?.playMerchantArrivalGreet?.();
      });
    });

    const unregisterPurchase = registerMerchantPurchaseSuccessHandler((payload) => {
      const isHeal = payload.healingAmount != null || payload.stockId === 'merchant_heal_100';
      if (isHeal) {
        window.audioSystem?.playFountainSound?.();
      } else {
        window.audioSystem?.playMerchantPurchaseGreet?.();
      }
    });

    return () => {
      unregisterGreet();
      unregisterPurchase();
    };
  }, [registerMerchantNpcGreetHandler, registerMerchantPurchaseSuccessHandler]);
  // Real-time position refs for enemy players to enable ghost trail updates
  const enemyPlayerPositionRefs = useRef<Map<string, { current: Vector3 }>>(new Map());
  const enemyPlayerSmoothedPositionRefs = useRef<Map<string, { current: Vector3 }>>(new Map());
  const enemyPlayerSmoothedRotationRefs = useRef<Map<string, { current: { x: number; y: number; z: number } }>>(new Map());
  const remotePlayerPosScratchRef = useRef<Map<string, Vector3>>(new Map());
  const [playerEntity, setPlayerEntity] = useState<any>(null);

  useEffect(() => {
    playerEntityRef.current = playerEntity?.id ?? null;
  }, [playerEntity]);

  // Install Persephone lethal-save hook on the local player's Health so every damage path can save.
  useEffect(() => {
    if (!playerEntity) return;
    const health = playerEntity.getComponent?.(Health) as Health | undefined;
    if (!health) return;

    health.lethalSaveHook = () => {
      if (!hasPersephoneRef.current) return false;
      hasPersephoneRef.current = false;

      // Health.takeDamage restores HP when we return true; sync + notify server after.
      queueMicrotask(() => {
        health.isDead = false;
        updatePlayerHealth(health.currentHealth, health.maxHealth);
        if (socket && currentRoomId) {
          socket.emit('persephone-consumed', {
            roomId: currentRoomId,
            newHealth: health.currentHealth,
            maxHealth: health.maxHealth,
          });
        }
      });
      return true;
    };

    return () => {
      if (health.lethalSaveHook) {
        health.lethalSaveHook = null;
      }
    };
  }, [playerEntity, socket, currentRoomId, updatePlayerHealth]);

  /** Warlock orb wind-up duration — keep aligned with WarlockRenderer LAUNCH_ANIMATION_DURATION & warlock_launch.glb */
  const WARLOCK_ORB_CHARGE_MS = 1400;

  const projectileLayerRef = useRef<CoopProjectileLayerHandle>(null);
  const bossTelegraphLayerRef = useRef<CoopBossTelegraphLayerHandle>(null);
  const groundTelegraphLayerRef = useRef<CoopGroundTelegraphLayerHandle>(null);
  const pvpAbilityLayerRef = useRef<CoopPvpAbilityLayerHandle>(null);
  const bossMechanicLayerRef = useRef<CoopBossMechanicLayerHandle>(null);
  const explosionBurstLayerRef = useRef<CoopExplosionBurstLayerHandle>(null);
  const lightningBurstLayerRef = useRef<CoopLightningBurstLayerHandle>(null);
  const spawnTitansGripStunLightning = useCallback((position: Vector3) => {
    lightningBurstLayerRef.current?.addKnightSmiteLightning({
      id: `titans-grip-stun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      position: position.clone(),
      variant: 'titans-grip',
    });
  }, []);
  const spawnDeathdealerStaggerLightning = useCallback((position: Vector3) => {
    (window as any).audioSystem?.playLightningBoltSound(position);
    lightningBurstLayerRef.current?.addStaggerProcEffect({
      id: `deathdealer-stagger-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      position: position.clone(),
    });
  }, []);
  const groundHazardLayerRef = useRef<CoopGroundHazardLayerHandle>(null);
  const summonRitualLayerRef = useRef<CoopSummonRitualLayerHandle>(null);
  const allyCombatLayerRef = useRef<CoopAllyCombatLayerHandle>(null);
  const incinerationBeamManagerRef = useRef<IncinerationBeamManagerHandle>(null);
  const combatFeedbackLayerRef = useRef<CoopCombatFeedbackLayerHandle>(null);
  const nextPlayerHitBurstId = useRef(0);
  const greaterHealImpactTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const environmentVfxLayerRef = useRef<CoopEnvironmentVfxLayerHandle>(null);
  const tentacleSpineLayerRef = useRef<CoopTentacleSpineLayerHandle>(null);
  const tentacleSpineFxRef = useRef<Map<string, { windSeq: number; slamSeq: number; dir: { x: number; z: number }; windupAt?: number; slamAt?: number }>>(new Map());

  const flushCombatVfx = useCallback(() => {
    if (engineRef.current) {
      const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
      projectileSystem?.clearAllProjectiles();
    }
    projectileLayerRef.current?.clearAll();
    groundTelegraphLayerRef.current?.clearAll();
    bossTelegraphLayerRef.current?.clearAll();
    bossMechanicLayerRef.current?.clearAll();
    explosionBurstLayerRef.current?.clearAll();
    lightningBurstLayerRef.current?.clearAll();
    groundHazardLayerRef.current?.clearAll();
    summonRitualLayerRef.current?.clearAll();
    allyCombatLayerRef.current?.clearAll();
    combatFeedbackLayerRef.current?.clearAll();
    tentacleSpineLayerRef.current?.clearAll();
    tentacleSpineFxRef.current.clear();
    pvpAbilityLayerRef.current?.clearAll();
    environmentVfxLayerRef.current?.clearAll();
  }, []);

  const clearTentacleSpineGroundTelegraph = useCallback((enemyId: string) => {
    const p = tentacleSpinePendingByEnemyRef.current.get(enemyId);
    if (p) {
      if (p.tAdd) clearTimeout(p.tAdd);
      if (p.tFail) clearTimeout(p.tFail);
      if (p.tImpact) clearTimeout(p.tImpact);
      tentacleSpinePendingByEnemyRef.current.delete(enemyId);
    }
    groundTelegraphLayerRef.current?.removeTentacleSpineTelegraphsByEnemyId(enemyId);
  }, []);

  const clearAllTentacleSpinePendingTimers = useCallback(() => {
    tentacleSpinePendingByEnemyRef.current.forEach((p, enemyId) => {
      if (p.tAdd) clearTimeout(p.tAdd);
      if (p.tFail) clearTimeout(p.tFail);
      if (p.tImpact) clearTimeout(p.tImpact);
      groundTelegraphLayerRef.current?.removeTentacleSpineTelegraphsByEnemyId(enemyId);
    });
    tentacleSpinePendingByEnemyRef.current.clear();
    tentacleSpineLastSlamAtRef.current.clear();
  }, []);

  const coopServerEnemyLiving = useCallback((serverEnemyId: string): boolean => {
    if (!engineRef.current) return false;
    const world = engineRef.current.getWorld();
    for (const entity of world.getAllEntities()) {
      if (entity.userData?.serverEnemyId === serverEnemyId) {
        const health = entity.getComponent(Health);
        return !!(health && !health.isDead);
      }
    }
    return false;
  }, []);

  /** Horizontal XZ cull radius for coop enemy React trees (~45 units). */
  const isExploreRef = useRef(false);
  isExploreRef.current = isExplore;
  const isDungeonRef = useRef(false);
  isDungeonRef.current = isMeshWalkRoom;
  const isCoopEnemyVisibleForRender = useCallback(
    (enemyX: number, enemyZ: number) => {
      if (playerEntityRef.current === null) return true;
      const playerPos = realTimePlayerPositionRef.current;
      if (!playerPos) return true;
      if (isExploreRef.current) {
        return exploreFog.isEnemyVisible(enemyX, enemyZ, playerPos.x, playerPos.z);
      }
      // Dungeon corridor is longer than the default 45u arena cull; pack sits ~80u from spawn.
      if (isDungeonRef.current) return true;
      const dx = enemyX - playerPos.x;
      const dz = enemyZ - playerPos.z;
      return dx * dx + dz * dz <= 45 * 45;
    },
    [],
  );

  const portalUseSentRef = useRef(false);
  /** `useFrame` must read latest portal offer (set on `game-started`), not a stale render closure. */
  const thronePortalOfferRef = useRef<string[]>([]);
  thronePortalOfferRef.current = thronePortalOffer;
  const coopMainArenaPortalPhaseRef = useRef<typeof coopMainArenaPortalPhase>(null);
  coopMainArenaPortalPhaseRef.current = coopMainArenaPortalPhase;
  const combatArenaActiveRef = useRef(combatArenaActive);
  combatArenaActiveRef.current = combatArenaActive;
  const throneAbilityModalOpenRef = useRef(false);
  throneAbilityModalOpenRef.current = throneAbilityModalOpen;
  const isChatOpenRef = useRef(false);
  isChatOpenRef.current = isChatOpen;
  const uiBlocksGameInputRef = useRef(false);
  uiBlocksGameInputRef.current = uiBlocksGameInput;
  const onRequestThroneAbilityModalRef = useRef(onRequestThroneAbilityModal);
  onRequestThroneAbilityModalRef.current = onRequestThroneAbilityModal;
  const onRequestThroneTalentModalRef = useRef(onRequestThroneTalentModal);
  onRequestThroneTalentModalRef.current = onRequestThroneTalentModal;
  const onThroneWeaponEquippedRef = useRef(onThroneWeaponEquipped);
  onThroneWeaponEquippedRef.current = onThroneWeaponEquipped;
  const canCycleWeaponAspectRef = useRef(canCycleWeaponAspect);
  canCycleWeaponAspectRef.current = canCycleWeaponAspect;
  const onWeaponAspectCycledRef = useRef(onWeaponAspectCycled);
  onWeaponAspectCycledRef.current = onWeaponAspectCycled;
  const throneInteractKeyPrevRef = useRef(false);
  const throneTalentInteractKeyPrevRef = useRef(false);
  const throneDevTalentShortcutEnabledRef = useRef(false);
  throneDevTalentShortcutEnabledRef.current = throneDevTalentShortcutEnabled;
  const mainArenaInteractKeyPrevRef = useRef(false);
  const pedestalBoonReadyRef = useRef(pedestalBoonReady);
  pedestalBoonReadyRef.current = pedestalBoonReady;
  const portalsUnlockedRef = useRef(portalsUnlocked);
  portalsUnlockedRef.current = portalsUnlocked;
  const coopClearedRoomKindRef = useRef<typeof coopClearedRoomKind>(null);
  coopClearedRoomKindRef.current = coopClearedRoomKind;
  const coopCurrentRoomKindRef = useRef<typeof coopCurrentRoomKind>(null);
  coopCurrentRoomKindRef.current = coopCurrentRoomKind;
  const merchantInventoryRef = useRef(merchantInventory);
  merchantInventoryRef.current = merchantInventory;
  const merchantPurchaseStateRef = useRef(merchantPurchaseState);
  merchantPurchaseStateRef.current = merchantPurchaseState;
  const dreamLayerInventoryRef = useRef(dreamLayerInventory);
  dreamLayerInventoryRef.current = dreamLayerInventory;
  const dreamLayerPurchaseStateRef = useRef(dreamLayerPurchaseState);
  dreamLayerPurchaseStateRef.current = dreamLayerPurchaseState;
  const purchaseMerchantItemRef = useRef(purchaseMerchantItem);
  purchaseMerchantItemRef.current = purchaseMerchantItem;
  const purchaseMerchantHealRef = useRef(purchaseMerchantHeal);
  purchaseMerchantHealRef.current = purchaseMerchantHeal;
  const purchaseDreamLayerItemRef = useRef(purchaseDreamLayerItem);
  purchaseDreamLayerItemRef.current = purchaseDreamLayerItem;
  const purchaseDreamLayerHealRef = useRef(purchaseDreamLayerHeal);
  purchaseDreamLayerHealRef.current = purchaseDreamLayerHeal;
  const onCombatArenaPedestalInteractRef = useRef(onCombatArenaPedestalInteract);
  onCombatArenaPedestalInteractRef.current = onCombatArenaPedestalInteract;
  const droppedItemsRef = useRef(droppedItems);
  droppedItemsRef.current = droppedItems;
  const goldDropsRef = useRef(goldDrops);
  goldDropsRef.current = goldDrops;
  const pickupItemRef = useRef(pickupItem);
  pickupItemRef.current = pickupItem;
  const pickupGoldDropRef = useRef(pickupGoldDrop);
  pickupGoldDropRef.current = pickupGoldDrop;
  const woodDropsRef = useRef(woodDrops);
  woodDropsRef.current = woodDrops;
  const pickupWoodDropRef = useRef(pickupWoodDrop);
  pickupWoodDropRef.current = pickupWoodDrop;
  const stoneDropsRef = useRef(stoneDrops);
  stoneDropsRef.current = stoneDrops;
  const pickupStoneDropRef = useRef(pickupStoneDrop);
  pickupStoneDropRef.current = pickupStoneDrop;
  const meatDropsRef = useRef(meatDrops);
  meatDropsRef.current = meatDrops;
  const pickupMeatDropRef = useRef(pickupMeatDrop);
  pickupMeatDropRef.current = pickupMeatDrop;
  /** Prevents spamming `pickup-gold-drop` each frame while waiting for server ack / expiry. */
  const pendingGoldAutoPickupRef = useRef(new Set<string>());
  /** Prevents spamming `pickup-wood-drop` each frame while waiting for server ack. */
  const pendingWoodAutoPickupRef = useRef(new Set<string>());
  /** Prevents spamming `pickup-stone-drop` each frame while waiting for server ack. */
  const pendingStoneAutoPickupRef = useRef(new Set<string>());
  /** Prevents spamming `pickup-meat-drop` each frame while waiting for server ack. */
  const pendingMeatAutoPickupRef = useRef(new Set<string>());
  /** Prevents spamming `pickup-item` for rune amulets while waiting for server ack / expiry. */
  const pendingRuneAutoPickupRef = useRef(new Set<string>());
  const onInteractHintChangeRef = useRef(onInteractHintChange);
  onInteractHintChangeRef.current = onInteractHintChange;
  const onBuildMenuChangeRef = useRef(onBuildMenuChange);
  onBuildMenuChangeRef.current = onBuildMenuChange;
  const buildModeRef = useRef<'idle' | 'menu' | 'tower-pick' | 'placing'>('idle');
  const buildKeyPrevRef = useRef(false);
  const buildEscKeyPrevRef = useRef(false);
  const buildFKeyPrevRef = useRef(false);
  const buildPlacementPosRef = useRef({ x: 0, z: 0, valid: false });
  const buildLeftMousePrevRef = useRef(false);
  const buildHotkeyPrevRef = useRef<Record<string, boolean>>({});
  const placeBuildingRef = useRef(placeBuilding);
  placeBuildingRef.current = placeBuilding;
  const barracksRecruitAllyRef = useRef(barracksRecruitAlly);
  barracksRecruitAllyRef.current = barracksRecruitAlly;
  const researchPurchaseRef = useRef(researchPurchase);
  researchPurchaseRef.current = researchPurchase;
  const shrineClaimRef = useRef(shrineClaim);
  shrineClaimRef.current = shrineClaim;
  const cathedralClaimRef = useRef(cathedralClaim);
  cathedralClaimRef.current = cathedralClaim;
  const obeliskBuyTalentRef = useRef(obeliskBuyTalent);
  obeliskBuyTalentRef.current = obeliskBuyTalent;
  const firePitHealRef = useRef(firePitHeal);
  firePitHealRef.current = firePitHeal;
  const onBarracksRecruitOpenChangeRef = useRef(onBarracksRecruitOpenChange);
  onBarracksRecruitOpenChangeRef.current = onBarracksRecruitOpenChange;
  const onResearchPanelOpenChangeRef = useRef(onResearchPanelOpenChange);
  onResearchPanelOpenChangeRef.current = onResearchPanelOpenChange;
  const onShrinePanelOpenChangeRef = useRef(onShrinePanelOpenChange);
  onShrinePanelOpenChangeRef.current = onShrinePanelOpenChange;
  const onCathedralPanelOpenChangeRef = useRef(onCathedralPanelOpenChange);
  onCathedralPanelOpenChangeRef.current = onCathedralPanelOpenChange;
  const onObeliskPanelOpenChangeRef = useRef(onObeliskPanelOpenChange);
  onObeliskPanelOpenChangeRef.current = onObeliskPanelOpenChange;
  const onFirePitHealOpenChangeRef = useRef(onFirePitHealOpenChange);
  onFirePitHealOpenChangeRef.current = onFirePitHealOpenChange;
  const nearBarracksRef = useRef(false);
  const nearResearchRef = useRef(false);
  const nearShrineRef = useRef(false);
  const nearCathedralRef = useRef(false);
  const nearCathedralOfferRef = useRef<ExploreCathedralOfferEntry[]>([]);
  const nearObeliskRef = useRef(false);
  const nearFirePitRef = useRef(false);
  const [buildPlacementActive, setBuildPlacementActive] = useState(false);
  const [buildPlacementKind, setBuildPlacementKind] = useState<ExploreBuildingKind>('fire-pit');
  const buildPlacementKindRef = useRef<ExploreBuildingKind>('fire-pit');
  buildPlacementKindRef.current = buildPlacementKind;
  const exploreChunkDiscsRef = useRef<Array<{ x: number; z: number; radius: number }>>([]);
  const buildPlacementExtraDiscsRef = useRef<ExploreObstacleDisc[]>([]);
  const buildPlacementRulesRef = useRef<ExploreBuildingPlacementRules>({ firePits: [], liveTowerCount: 0, hasLiveSpiritLounge: false, hasLiveShrineOrObelisk: false });
  const lastInteractHintRef = useRef<string | null>(null);
  const initialWeaponsForEngineRef = useRef(
    selectedWeapons ?? { primary: WeaponType.NONE, secondary: WeaponType.NONE },
  );
  const selectedWeaponsRef = useRef(selectedWeapons ?? initialWeaponsForEngineRef.current);
  selectedWeaponsRef.current = selectedWeapons ?? initialWeaponsForEngineRef.current;
  const selectedArchetypeRef = useRef<Archetype>(selectedArchetype ?? ARCHETYPE_NONE);
  selectedArchetypeRef.current = selectedArchetype ?? ARCHETYPE_NONE;
  const selectedWeaponAspectRef = useRef<WeaponAspect>(
    selectedWeaponAspect ?? ASPECT_LEGIONNAIRE,
  );
  selectedWeaponAspectRef.current = selectedWeaponAspect ?? ASPECT_LEGIONNAIRE;

  const coopIntroPortalOpenRef = useRef(coopIntroPortalOpen);
  coopIntroPortalOpenRef.current = coopIntroPortalOpen;
  const coopIntroFountainPhaseRef = useRef(coopIntroFountainPhase);
  coopIntroFountainPhaseRef.current = coopIntroFountainPhase;
  const coopIntroFountainUsedRef = useRef(coopIntroFountainUsed);
  coopIntroFountainUsedRef.current = coopIntroFountainUsed;
  const coopEdenFountainUsedRef = useRef(coopEdenFountainUsed);
  coopEdenFountainUsedRef.current = coopEdenFountainUsed;
  const coopEdenResumeKindRef = useRef(coopEdenResumeKind);
  coopEdenResumeKindRef.current = coopEdenResumeKind;
  const coopFalseEdenClearedRef = useRef(coopFalseEdenCleared);
  coopFalseEdenClearedRef.current = coopFalseEdenCleared;
  const coopIntroAllyChoiceMadeRef = useRef(coopIntroAllyChoiceMade);
  coopIntroAllyChoiceMadeRef.current = coopIntroAllyChoiceMade;
  const coopFaeRealmPortalOpenRef = useRef(coopFaeRealmPortalOpen);
  coopFaeRealmPortalOpenRef.current = coopFaeRealmPortalOpen;
  const coopSunkenPortalOpenRef = useRef(coopSunkenPortalOpen);
  coopSunkenPortalOpenRef.current = coopSunkenPortalOpen;
  const coopSunkenFountainPhaseRef = useRef(coopSunkenFountainPhase);
  coopSunkenFountainPhaseRef.current = coopSunkenFountainPhase;
  const coopSunkenFountainUsedRef = useRef(coopSunkenFountainUsed);
  coopSunkenFountainUsedRef.current = coopSunkenFountainUsed;
  const coopSunkenLootPhaseCompleteRef = useRef(coopSunkenLootPhaseComplete);
  coopSunkenLootPhaseCompleteRef.current = coopSunkenLootPhaseComplete;
  const coopSunkenLootClaimedPlayerIdsRef = useRef(coopSunkenLootClaimedPlayerIds);
  coopSunkenLootClaimedPlayerIdsRef.current = coopSunkenLootClaimedPlayerIds;
  const coopEternityPortalOpenRef = useRef(coopEternityPortalOpen);
  coopEternityPortalOpenRef.current = coopEternityPortalOpen;
  const coopEternityFountainPhaseRef = useRef(coopEternityFountainPhase);
  coopEternityFountainPhaseRef.current = coopEternityFountainPhase;
  const coopEternityFountainUsedRef = useRef(coopEternityFountainUsed);
  coopEternityFountainUsedRef.current = coopEternityFountainUsed;
  const coopDefenseFountainActiveRef = useRef(coopDefenseFountainActive);
  coopDefenseFountainActiveRef.current = coopDefenseFountainActive;
  const coopDefenseFountainUsedRef = useRef(coopDefenseFountainUsed);
  coopDefenseFountainUsedRef.current = coopDefenseFountainUsed;
  const coopEternityLootPhaseCompleteRef = useRef(coopEternityLootPhaseComplete);
  coopEternityLootPhaseCompleteRef.current = coopEternityLootPhaseComplete;
  const coopPetCompanionUpgradeRef = useRef(coopPetCompanionUpgrade);
  coopPetCompanionUpgradeRef.current = coopPetCompanionUpgrade;
  const coopEternityLootClaimedPlayerIdsRef = useRef(coopEternityLootClaimedPlayerIds);
  coopEternityLootClaimedPlayerIdsRef.current = coopEternityLootClaimedPlayerIds;
  const coopVoidPortalOfferedRef = useRef(coopVoidPortalOffered);
  coopVoidPortalOfferedRef.current = coopVoidPortalOffered;
  const deepSanctumRewardKindRef = useRef(deepSanctumRewardKind);
  deepSanctumRewardKindRef.current = deepSanctumRewardKind;
  const claimDeepSanctumRewardRef = useRef(claimDeepSanctumReward);
  claimDeepSanctumRewardRef.current = claimDeepSanctumReward;
  const useCoopFountainRef = useRef(useCoopFountain);
  useCoopFountainRef.current = useCoopFountain;
  const chooseCoopAllyRef = useRef(chooseCoopAlly);
  chooseCoopAllyRef.current = chooseCoopAlly;
  const introAllyChoiceEncounterRef = useRef<IntroAllyChoiceEncounterRef | null>(null);
  const sunkenSentinelEncounterRef = useRef<SunkenSentinelEncounterRef | null>(null);
  const onSunkenSentinelInteractRef = useRef(onSunkenSentinelInteract);
  onSunkenSentinelInteractRef.current = onSunkenSentinelInteract;
  const eternityPalaceEncounterRef = useRef<EternityPalaceEncounterRef | null>(null);
  const onEternityPalaceArchitectInteractRef = useRef(onEternityPalaceArchitectInteract);
  onEternityPalaceArchitectInteractRef.current = onEternityPalaceArchitectInteract;
  const throneVoidPortalOpenAtRef = useRef<number | null>(null);
  const [throneVoidPortalOpenProgress, setThroneVoidPortalOpenProgress] = useState(0);
  const [throneVoidPortalOpen, setThroneVoidPortalOpen] = useState(false);
  const throneVoidPortalOpenRef = useRef(false);
  throneVoidPortalOpenRef.current = throneVoidPortalOpen;
  const [showcaseTick, setShowcaseTick] = useState(0);
  const showcaseTickRef = useRef(0);
  showcaseTickRef.current = showcaseTick;

  const [engineReady, setEngineReady] = useState(false); // Track when engine is ready
  // Shader warmup: mount hidden death/spawn VFX while the scene loads so they compile
  // behind the loading screen, then drop the rig once they've had a few seconds to render.
  const [shaderWarmupActive, setShaderWarmupActive] = useState(true);
  useEffect(() => {
    if (!engineReady) return;
    const id = window.setTimeout(() => setShaderWarmupActive(false), 5000);
    return () => window.clearTimeout(id);
  }, [engineReady]);
  /** Bumps once when a remote peer ECS entity is registered so JSX reads `serverPlayerEntities` ids. */
  const [remotePlayerEntityRevision, setRemotePlayerEntityRevision] = useState(0);
  const idleGltfWarmupStartedRef = useRef(false);

  /** Start idle GLB decode as soon as the canvas scene exists — overlaps socket / `gameStarted` wait. */
  useEffect(() => {
    if (idleGltfWarmupStartedRef.current) return;
    idleGltfWarmupStartedRef.current = true;
    void warmupCharacterIdleGltf();
  }, []);

  useEffect(() => {
    if (!gameStarted || !engineReady) return;
    preloadEnemyModelsForTypes(Array.from(new Set(enemyTypesKey.split(',').filter(Boolean))));
  }, [gameStarted, engineReady, enemyTypesKey, coopCombatArenaEnterSeq, coopMainArenaIntermissionSeq]);

  useEffect(() => {
    if (!isDungeon) return;
    void import('@/components/environment/DungeonNexusMap').then((mod) => {
      mod.preloadDungeonNexusMap();
    });
  }, [isDungeon]);

  useEffect(() => {
    if (!isSkyTemple) return;
    void import('@/components/environment/SkyTempleMap').then((mod) => {
      mod.preloadSkyTempleMap();
    });
  }, [isSkyTemple]);

  useEffect(() => {
    if (!isDefense) return;
    void import('@/components/environment/DefenseArenaMap').then((mod) => {
      mod.preloadDefenseArenaMap();
    });
    void import('@/components/environment/DefenseCenterPlatform').then((mod) => {
      mod.preloadDefenseCenterPlatform();
    });
    void import('./environment/DefenseTower').then((mod) => {
      mod.preloadDefenseTower();
    });
  }, [isDefense]);

  useEffect(() => {
    if (!isExplore) return;
    void import('./environment/DefenseTower').then((mod) => {
      mod.preloadDefenseTower();
    });
    void import('./environment/WatchTower').then((mod) => {
      mod.preloadWatchTower();
    });
    void import('./environment/SiegeTower').then((mod) => {
      mod.preloadSiegeTower();
    });
    void import('./environment/SpiritLounge').then((mod) => {
      mod.preloadSpiritLounge();
    });
    void import('./environment/ResearchStation').then((mod) => {
      mod.preloadResearchStation();
    });
    void import('./environment/ShieldBattery').then((mod) => {
      mod.preloadShieldBattery();
    });
    void import('./environment/Cathedral').then((mod) => {
      mod.preloadCathedral();
    });
  }, [isExplore]);

  useEffect(() => {
    if (inThroneRoom) {
      portalUseSentRef.current = false;
      void import('@/components/environment/DungeonNexusMap').then((mod) => {
        mod.preloadDungeonNexusMap();
      });
      void import('@/components/environment/SkyTempleMap').then((mod) => {
        mod.preloadSkyTempleMap();
      });
      void import('@/components/environment/ThroneStatueDecor').then((mod) => {
        mod.preloadThroneStatueDecor();
      });
      void import('@/components/environment/ThronePerimeterPylonDecor').then((mod) => {
        mod.preloadThronePerimeterPylonDecor();
      });
      void import('@/components/environment/ThroneFireplaceDecor').then((mod) => {
        mod.preloadThroneFireplaceDecor();
      });
      // Necromancer spirits may spawn on dummy hits — warm Summon/Attack clips early.
      void import('./enemies/VengefulSpiritModel').then((mod) => {
        mod.preloadVengefulSpiritModels();
      });
    }
  }, [inThroneRoom]);

  useEffect(() => {
    if (!isFaeRealm) return;
    void import('@/components/environment/FaeRealmDecor').then((mod) => {
      mod.preloadFaeRealmDecor();
    });
    void import('@/components/environment/ThronePerimeterPylonDecor').then((mod) => {
      mod.preloadThronePerimeterPylonDecor();
    });
  }, [isFaeRealm]);

  useEffect(() => {
    if (!inThroneRoom) {
      setShowcaseTick(0);
      showcaseTickRef.current = 0;
      return;
    }
    setShowcaseTick(0);
    showcaseTickRef.current = 0;
    const id = window.setInterval(() => {
      setShowcaseTick((t) => {
        const next = t + 1;
        showcaseTickRef.current = next;
        return next;
      });
    }, THRONE_ASPECT_SHOWCASE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [inThroneRoom]);

  useEffect(() => {
    if (coopMainArenaPortalPhase) {
      portalUseSentRef.current = false;
    }
  }, [coopMainArenaPortalPhase]);

  useEffect(() => {
    if (!inThroneRoom) {
      throneVoidPortalOpenAtRef.current = null;
      setThroneVoidPortalOpen(false);
      setThroneVoidPortalOpenProgress(0);
      return;
    }
    const weapon = selectedWeaponsRef.current?.primary;
    if (!weapon || weapon === WeaponType.NONE) {
      throneVoidPortalOpenAtRef.current = null;
      setThroneVoidPortalOpen(false);
      setThroneVoidPortalOpenProgress(0);
      return;
    }
    if (throneVoidPortalOpenAtRef.current == null) {
      throneVoidPortalOpenAtRef.current = Date.now() + THRONE_VOID_PORTAL_DELAY_MS;
    }
    const tick = () => {
      const openAt = throneVoidPortalOpenAtRef.current;
      if (openAt == null) return;
      const remaining = openAt - Date.now();
      if (remaining > 0) {
        setThroneVoidPortalOpen(false);
        setThroneVoidPortalOpenProgress(0);
        requestAnimationFrame(tick);
        return;
      }
      const elapsed = -remaining;
      const progress = Math.min(1, elapsed / THRONE_VOID_PORTAL_OPEN_DURATION_MS);
      setThroneVoidPortalOpen(progress >= 1);
      setThroneVoidPortalOpenProgress(progress);
      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [inThroneRoom, selectedWeapons?.primary]);

  useEffect(() => {
    portalUseSentRef.current = false;
  }, [coopCombatArenaEnterSeq, coopMainArenaIntermissionSeq, coopIntroIntermissionSeq, coopSunkenIntermissionSeq, coopEternityIntermissionSeq, coopFaeRealmIntermissionSeq, coopDeepSanctumIntermissionSeq, coopEdenIntermissionSeq, coopIntroPortalOpen, coopIntroFountainPhase, coopIntroFountainUsed, coopIntroAllyChoiceMade, coopFaeRealmPortalOpen, coopSunkenPortalOpen, coopSunkenFountainPhase, coopSunkenFountainUsed, coopSunkenLootPhaseComplete, coopEternityPortalOpen, coopEternityFountainPhase, coopEternityFountainUsed, coopEternityLootPhaseComplete]);

  // Layout: apply before paint so physics boundary mode matches the active arena shell.
  useLayoutEffect(() => {
    if (!gameStarted) return;
    if (!engineRef.current) {
      if (isExplore) {
        scene.fog = new FogExp2(SKY_INDIGO_NIGHT.horizon, 0.045);
        if (camera instanceof PerspectiveCamera) {
          camera.far = 600;
          camera.updateProjectionMatrix();
        }
      } else if (isDungeon) {
        scene.fog = new FogExp2(DUNGEON_FOG_COLOR, DUNGEON_FOG_DENSITY);
        if (camera instanceof PerspectiveCamera) {
          camera.far = DUNGEON_CAMERA_FAR;
          camera.updateProjectionMatrix();
        }
      }
      return;
    }
    const world = engineRef.current.getWorld();
    const phys = world.getSystem(PhysicsSystem);
    const r =
      inThroneRoom || inBossThroneArena
        ? COOP_THRONE_ROOM_RADIUS + 2
        : isExplore || isMeshWalkRoom
          ? 9999
        : isDefense
          ? DEFENSE_ROOM_RADIUS + 2
        : isFaeRealm
          ? FAE_REALM_HEX_RADIUS
        : isEternityPalace
          ? ETERNITY_PALACE_HEX_RADIUS
        : isSunkenTemple
          ? PENTAGON_ARENA_RADIUS
        : isErebusGate
          ? CASTLE_ROOM_BOUNDS.halfX
        : isCastleRoom
          ? CASTLE_ROOM_BOUNDS.halfX
          : isHexCombatArena
            ? HEX_ARENA_RADIUS
            : MAIN_ARENA_HEX_RADIUS;
    const mainCoopRoom = !inThroneRoom && !inBossThroneArena && !isHexCombatArena && !isCastleRoom && !isSunkenTemple && !isErebusGate && !isFaeRealm && !isEternityPalace && !isExplore && !isDefense && !isDungeon && !isSkyTemple;
    const boundaryMode = isExplore || isMeshWalkRoom
      ? 'none'
      : isCastleRoom || isSunkenTemple || isErebusGate
        ? 'circle'
        : (isHexCombatArena || isFaeRealm || isEternityPalace)
          ? 'hex'
          : 'circle';
    phys?.setMapRadius(r);
    phys?.setArenaBoundaryMode?.(boundaryMode);
    const throneObstacles = inThroneRoom ? getThronePrepPhysicsObstacles() : null;
    const castleWallsOn = false;
    phys?.setCastleWallPhysicsEnabled(castleWallsOn);
    phys?.setArenaBoundaryMode?.(boundaryMode);
    phys?.setTreeCollisionEnabled?.(!mainCoopRoom);
    phys?.setThronePillarObstacles(throneObstacles);
    phys?.setCornerMountainObstacles(null);
    controlSystemRef.current?.setPlayableRadius(r);
    controlSystemRef.current?.setCastleWallChargeCollision(castleWallsOn);
    controlSystemRef.current?.setArenaBoundaryMode?.(boundaryMode);
    controlSystemRef.current?.setThroneChargePillars(throneObstacles);
    controlSystemRef.current?.setChargeCornerMountains(null);
    world.getSystem(ProjectileSystem)?.setOriginCullRadius(isExplore || isMeshWalkRoom ? null : DEFAULT_PROJECTILE_ORIGIN_CULL_RADIUS);
    const roomFog = isExplore
      ? new FogExp2(SKY_INDIGO_NIGHT.horizon, 0.045)
      : isDungeon
        ? new FogExp2(DUNGEON_FOG_COLOR, DUNGEON_FOG_DENSITY)
        : null;
    const render = world.getSystem(RenderSystem);
    if (render) {
      render.setFog(roomFog);
    } else {
      scene.fog = roomFog;
    }
    if (camera instanceof PerspectiveCamera) {
      camera.far = isExplore ? 600 : isDungeon ? DUNGEON_CAMERA_FAR : 1000;
      camera.updateProjectionMatrix();
    }
    return () => {
      world.getSystem(ProjectileSystem)?.setOriginCullRadius(DEFAULT_PROJECTILE_ORIGIN_CULL_RADIUS);
      const renderNow = world.getSystem(RenderSystem);
      if (renderNow) {
        renderNow.setFog(null);
      } else if (scene.fog === roomFog) {
        scene.fog = null;
      }
      if (camera instanceof PerspectiveCamera) {
        camera.far = 1000;
        camera.updateProjectionMatrix();
      }
    };
  }, [inThroneRoom, inBossThroneArena, isHexCombatArena, isCastleRoom, isFaeRealm, isExplore, isDefense, isDungeon, isSkyTemple, isMeshWalkRoom, isEternityPalace, isSunkenTemple, isErebusGate, gameStarted, engineReady, camera, scene, playerEntity]);

  const exploreCampsRef = useRef(exploreCamps);
  exploreCampsRef.current = exploreCamps;
  const onExploreCampInteractRef = useRef(onExploreCampInteract);
  onExploreCampInteractRef.current = onExploreCampInteract;

  useEffect(() => {
    if (isDefense) {
      const discs = getDefenseTowerObstacles();
      engineRef.current?.getWorld().getSystem(PhysicsSystem)?.setStreamedObstacles(discs);
      controlSystemRef.current?.setStreamedObstacles(discs);
      return () => {
        engineRef.current?.getWorld().getSystem(PhysicsSystem)?.setStreamedObstacles(null);
        controlSystemRef.current?.setStreamedObstacles(null);
      };
    }
    if (isMeshWalkRoom) {
      const phys = engineRef.current?.getWorld().getSystem(PhysicsSystem);
      phys?.setPlayableAabb(isDungeon ? DUNGEON_PLAYABLE_AABB : SKY_TEMPLE_PLAYABLE_AABB);
      const unsub = subscribeDungeonMeshCollider((collider) => {
        engineRef.current?.getWorld().getSystem(PhysicsSystem)?.setMeshCollider(collider);
        if (!collider || playerEntityRef.current === null || !socket?.id) return;
        const ent = engineRef.current?.getWorld().getEntity(playerEntityRef.current);
        const tr = ent?.getComponent(Transform);
        if (!tr) return;
        const movement = ent?.getComponent(Movement);
        const groundY = resolveDungeonPlayerCenterY(
          tr.position.x,
          tr.position.z,
          0.5,
          isSkyTemple ? SKY_TEMPLE_SPAWN.y : undefined,
        );
        const needsSnap =
          tr.position.y > groundY + 0.35
          || movement?.isPortalFalling
          || voidPortalFallActiveRef.current
          || (movement != null && !movement.isGrounded && tr.position.y > groundY + 0.15);
        if (needsSnap) {
          const me = contextPlayersRef.current.get(socket.id);
          applyDungeonGroundSnapRef.current(tr.position.x, tr.position.z, me?.rotation);
        }
      });
      return () => {
        unsub();
        const p = engineRef.current?.getWorld().getSystem(PhysicsSystem);
        p?.setMeshCollider(null);
        p?.setPlayableAabb(null);
      };
    }
    if (!isExplore) {
      setExploreObstacleListener(null);
      engineRef.current?.getWorld().getSystem(PhysicsSystem)?.setStreamedObstacles(null);
      controlSystemRef.current?.setStreamedObstacles(null);
      return;
    }

    const chunkDiscsRef = exploreChunkDiscsRef;
    const applyMerged = () => {
      const campDiscs: Array<{ x: number; z: number; radius: number }> = [];
      for (const camp of exploreCampsRef.current) {
        if (!camp.collides) continue;
        const radius = exploreCampCollideRadius(camp.kind);
        if (radius <= 0) continue;
        campDiscs.push({ x: camp.x, z: camp.z, radius });
      }
      const buildingDiscs: ExploreObstacleDisc[] = [];
      const firePits: Array<{ x: number; z: number }> = [];
      let liveTowerCount = 0;
      let hasLiveSpiritLounge = false;
      let hasLiveShrineOrObelisk = false;
      for (const enemy of enemiesRef.current.values()) {
        if (!isPlayerExploreBuildingType(enemy.type)) continue;
        if (enemy.isDying || (enemy.health ?? 0) <= 0) continue;
        const radius = typeof enemy.hullRadius === 'number' ? enemy.hullRadius : FIRE_PIT_HULL_RADIUS;
        buildingDiscs.push({ x: enemy.position.x, z: enemy.position.z, radius, kind: enemy.type });
        if (enemy.type === 'fire-pit') firePits.push({ x: enemy.position.x, z: enemy.position.z });
        if (enemy.type === 'barracks') hasLiveSpiritLounge = true;
        if (enemy.type === 'shrine' || enemy.type === 'obelisk') hasLiveShrineOrObelisk = true;
        if (isExploreTowerType(enemy.type)) liveTowerCount += 1;
      }
      const merged = [
        ...chunkDiscsRef.current,
        ...campDiscs,
        ...buildingDiscs,
      ];
      buildPlacementExtraDiscsRef.current = merged;
      buildPlacementRulesRef.current = { firePits, liveTowerCount, hasLiveSpiritLounge, hasLiveShrineOrObelisk };
      engineRef.current?.getWorld().getSystem(PhysicsSystem)?.setStreamedObstacles(merged);
      controlSystemRef.current?.setStreamedObstacles(merged);
    };

    setExploreObstacleListener((discs) => {
      chunkDiscsRef.current = discs ?? [];
      applyMerged();
    });
    applyMerged();

    return () => {
      setExploreObstacleListener(null);
      exploreChunkDiscsRef.current = [];
      engineRef.current?.getWorld().getSystem(PhysicsSystem)?.setStreamedObstacles(null);
      controlSystemRef.current?.setStreamedObstacles(null);
    };
  }, [isExplore, isDefense, isDungeon, isSkyTemple, isMeshWalkRoom, engineReady, exploreCamps, enemies]);

  useEffect(() => {
    if (isExplore) return;
    buildModeRef.current = 'idle';
    setBuildPlacementActive(false);
    controlSystemRef.current?.setBuildPlacementActive(false);
    controlSystemRef.current?.setBuildMenuHotkeysActive(false);
    onBuildMenuChangeRef.current?.(false);
  }, [isExplore]);

  const prevInThroneRef = useRef(inThroneRoom);
  // Place the local player at their server throne spawn ONCE per throne entry, then let the
  // local control system own the position. Keeping `players` in deps lets us retry until the
  // local entry exists, but the guard prevents continuous server-position resets that would
  // otherwise fight local movement (stuck-at-spawn + jitter for mid-session joiners).
  const throneSpawnAppliedRef = useRef(false);
  useEffect(() => {
    if (!inThroneRoom) {
      throneSpawnAppliedRef.current = false;
      return;
    }
    if (throneSpawnAppliedRef.current) return;
    if (!engineRef.current || !engineReady || !gameStarted || !socket?.id) return;
    if (playerEntityRef.current === null) return;
    const me = players.get(socket.id);
    if (!me) return;
    const ent = engineRef.current.getWorld().getEntity(playerEntityRef.current);
    const tr = ent?.getComponent(Transform);
    if (tr) {
      tr.setPosition(me.position.x, me.position.y ?? 0.5, me.position.z);
    }
    cameraSystemRef.current?.snapToTarget();
    throneSpawnAppliedRef.current = true;
  }, [inThroneRoom, gameStarted, engineReady, socket?.id, players]);

  /** Snap the local hero onto explore wilderness ground and keep the floor-follower ref aligned. */
  const applyExploreLateJoinGroundSnap = useCallback((
    x: number,
    z: number,
    rotation?: { x: number; y: number; z: number } | null,
  ) => {
    if (!engineRef.current || playerEntityRef.current === null || !socket?.id) return false;
    const y = PORTAL_FALL_GROUND_Y;
    const ent = engineRef.current.getWorld().getEntity(playerEntityRef.current);
    const tr = ent?.getComponent(Transform);
    if (tr) {
      tr.setPosition(x, y, z);
    }
    const movement = ent?.getComponent(Movement);
    if (movement) {
      movement.haltLocomotion();
      movement.isGrounded = true;
      movement.isPortalFalling = false;
      movement.portalFallPhase = 'rise';
      movement.portalFallProgress = 0;
    }
    voidPortalFallActiveRef.current = false;
    pendingPortalSnapRef.current = false;
    realTimePlayerPositionRef.current.set(x, y, z);
    const rot = rotation ?? { x: 0, y: 0, z: 0 };
    applyPlayerMove(playersTransformsRef, contextPlayersRef, {
      playerId: socket.id,
      position: { x, y, z },
      rotation: rot,
      movementDirection: { x: 0, y: 0, z: 0 },
    });
    resetLocalPositionEmitThrottleRef.current({ x, y, z }, rot);
    cameraSystemRef.current?.snapToTarget();
    exploreFog.markExplored(x, z, EXPLORE_PLAYER_VIEW_RADIUS);
    return true;
  }, [socket?.id, playersTransformsRef, contextPlayersRef]);

  /** Snap the local hero onto dungeon mesh ground when the lair collider becomes available. */
  const applyDungeonGroundSnap = useCallback((
    x: number,
    z: number,
    rotation?: { x: number; y: number; z: number } | null,
  ) => {
    if (!engineRef.current || playerEntityRef.current === null || !socket?.id) return false;
    const y = resolveDungeonPlayerCenterY(
      x,
      z,
      0.5,
      isSkyTemple ? SKY_TEMPLE_SPAWN.y : undefined,
    );
    const ent = engineRef.current.getWorld().getEntity(playerEntityRef.current);
    const tr = ent?.getComponent(Transform);
    if (tr) {
      tr.setPosition(x, y, z);
    }
    const movement = ent?.getComponent(Movement);
    if (movement) {
      movement.haltLocomotion();
      movement.isGrounded = true;
      movement.isPortalFalling = false;
      movement.portalFallPhase = 'rise';
      movement.portalFallProgress = 0;
      movement.velocity.y = 0;
    }
    voidPortalFallActiveRef.current = false;
    pendingPortalSnapRef.current = false;
    realTimePlayerPositionRef.current.set(x, y, z);
    const rot = rotation ?? { x: 0, y: 0, z: 0 };
    applyPlayerMove(playersTransformsRef, contextPlayersRef, {
      playerId: socket.id,
      position: { x, y, z },
      rotation: rot,
      movementDirection: { x: 0, y: 0, z: 0 },
    });
    resetLocalPositionEmitThrottleRef.current({ x, y, z }, rot);
    cameraSystemRef.current?.snapToTarget();
    return true;
  }, [socket?.id, playersTransformsRef, contextPlayersRef, pendingPortalSnapRef, isSkyTemple]);

  applyDungeonGroundSnapRef.current = applyDungeonGroundSnap;

  /** Late join into an active explore session: snap to the server wilderness position on the ground. */
  const exploreLateJoinSpawnAppliedRef = useRef(false);
  if (isExplore && !exploreLateJoinSpawnAppliedRef.current && socket?.id) {
    const seedPos = players.get(socket.id)?.position ?? contextPlayersRef.current.get(socket.id)?.position;
    const sx = seedPos?.x;
    const sz = seedPos?.z;
    if (typeof sx === 'number' && typeof sz === 'number' && Number.isFinite(sx) && Number.isFinite(sz)) {
      realTimePlayerPositionRef.current.set(sx, PORTAL_FALL_GROUND_Y, sz);
    }
  }
  useLayoutEffect(() => {
    if (!isExplore) {
      exploreLateJoinSpawnAppliedRef.current = false;
      return;
    }
    const me = socket?.id
      ? (players.get(socket.id) ?? contextPlayersRef.current.get(socket.id))
      : undefined;
    const x = me?.position?.x;
    const z = me?.position?.z;
    if (!exploreLateJoinSpawnAppliedRef.current
      && typeof x === 'number'
      && typeof z === 'number'
      && Number.isFinite(x)
      && Number.isFinite(z)) {
      realTimePlayerPositionRef.current.set(x, PORTAL_FALL_GROUND_Y, z);
    }
    if (exploreLateJoinSpawnAppliedRef.current) return;
    // Party portal enter uses the combat-enter path. Late join never starts that overlay.
    if (coopTransitionOverlayRef.current) {
      exploreLateJoinSpawnAppliedRef.current = true;
      return;
    }
    if (!engineRef.current || !engineReady || !gameStarted || !socket?.id) return;
    if (playerEntityRef.current === null) return;
    if (typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) return;
    if (!applyExploreLateJoinGroundSnap(x, z, me?.rotation)) return;
    exploreLateJoinSpawnAppliedRef.current = true;
  }, [isExplore, gameStarted, engineReady, socket?.id, players, playerEntity, applyExploreLateJoinGroundSnap, contextPlayersRef]);

  useEffect(() => {
    if (prevInThroneRef.current && !inThroneRoom) {
      if (process.env.NODE_ENV === 'development') {
        logJsHeapSnapshotDev('Coop: left prep throne (after portal) — JS heap snapshot');
      }
      // Position snap is handled by the combat-enter layout effect; only refresh camera here.
      if (playerEntityRef.current !== null && engineRef.current) {
        cameraSystemRef.current?.snapToTarget();
      }
    }
    prevInThroneRef.current = inThroneRoom;
  }, [inThroneRoom]);

  // Clear every live projectile and room-scoped combat VFX when entering a new combat room
  // so stale explosions, telegraphs, and summon rituals from the previous room cannot carry over.
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady) return;
    if (coopCombatArenaEnterSeq === 0) return;
    flushCombatVfx();
  }, [coopCombatArenaEnterSeq, gameStarted, engineReady, flushCombatVfx]);

  useEffect(() => {
    return onTabBecameVisible(() => {
      if (!gameStarted || !engineReady) return;
      flushCombatVfx();
    });
  }, [gameStarted, engineReady, flushCombatVfx]);

  /** `combat-arena-entered` (server teleports) or `coop-main-arena-intermission` (server state sync, no entry snap); align local ECS. */
  useLayoutEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady) return;
    if (playerEntityRef.current === null || !socket?.id) return;
    if (coopCombatArenaEnterSeq === 0 && coopMainArenaIntermissionSeq === 0) return;

    const combatEnterChanged =
      coopCombatArenaEnterSeq > 0 &&
      coopCombatArenaEnterSeq !== lastAppliedCombatEnterSeqRef.current;
    const intermissionChanged =
      coopMainArenaIntermissionSeq > 0 &&
      coopMainArenaIntermissionSeq !== lastAppliedIntermissionSeqRef.current;
    if (!combatEnterChanged && !intermissionChanged) return;

    if (combatEnterChanged) {
      const exploreLateJoinGround =
        isExplore && !coopTransitionOverlayRef.current;
      const dungeonGroundSnap = isMeshWalkRoom;

      if (!exploreLateJoinGround && !dungeonGroundSnap) {
        pendingPortalSnapRef.current = true;
      }

      const me = players.get(socket.id) ?? contextPlayersRef.current.get(socket.id);
      const exploreServerPos =
        isExplore
        && me?.position
        && Number.isFinite(me.position.x)
        && Number.isFinite(me.position.z)
          ? { x: me.position.x, y: PORTAL_FALL_GROUND_Y, z: me.position.z }
          : null;
      const dungeonServerPos =
        isMeshWalkRoom
        && me?.position
        && Number.isFinite(me.position.x)
        && Number.isFinite(me.position.z)
          ? {
              x: me.position.x,
              y: resolveDungeonPlayerCenterY(
                me.position.x,
                me.position.z,
                0.5,
                isSkyTemple ? SKY_TEMPLE_SPAWN.y : undefined,
              ),
              z: me.position.z,
            }
          : null;
      const refPlayer = contextPlayersRef.current.get(socket.id);
      const hasLiveTransform = playersTransformsRef.current.has(socket.id);
      const ent = engineRef.current.getWorld().getEntity(playerEntityRef.current);
      const tr = ent?.getComponent(Transform);
      const fallbackSpawn = isSkyTemple ? SKY_TEMPLE_SPAWN : DUNGEON_SPAWN;
      const livePos = exploreServerPos
        ?? dungeonServerPos
        ?? ((refPlayer || hasLiveTransform)
          ? getPlayerLivePosition(
              socket.id,
              playersTransformsRef,
              refPlayer?.position,
            )
          : tr
            ? { x: tr.position.x, y: tr.position.y, z: tr.position.z }
            : { x: fallbackSpawn.x, y: fallbackSpawn.y, z: fallbackSpawn.z });
      const liveRot = me?.rotation ?? getPlayerLiveRotation(
        socket.id,
        playersTransformsRef,
        refPlayer?.rotation,
      );

      const tabHidden = typeof document !== 'undefined' && document.hidden;
      const c = coopArenaClampBounds == null
        ? { x: livePos.x, z: livePos.z }
        : clampToMainArenaXZ(livePos.x, livePos.z, coopArenaClampBounds);
      const spawnY = exploreLateJoinGround || tabHidden
        ? PORTAL_FALL_GROUND_Y
        : dungeonGroundSnap
          ? resolveDungeonPlayerCenterY(
            c.x,
            c.z,
            0.5,
            isSkyTemple ? SKY_TEMPLE_SPAWN.y : undefined,
          )
          : VOID_PORTAL_FALL_SPAWN_Y;
      const snappedPos = {
        x: c.x,
        y: spawnY,
        z: c.z,
      };
      const snappedRot = liveRot ?? { x: 0, y: 0, z: 0 };
      if (tr) {
        tr.setPosition(snappedPos.x, snappedPos.y, snappedPos.z);
      }
      const movement = ent?.getComponent(Movement);
      if (movement) {
        movement.haltLocomotion();
        if (tabHidden || exploreLateJoinGround || dungeonGroundSnap) {
          movement.isGrounded = true;
          movement.isPortalFalling = false;
          movement.portalFallPhase = 'rise';
          movement.portalFallProgress = 0;
          voidPortalFallActiveRef.current = false;
          if (exploreLateJoinGround || dungeonGroundSnap) {
            pendingPortalSnapRef.current = false;
          }
        } else {
          movement.isGrounded = false;
          voidPortalFallActiveRef.current = true;
        }
      }
      realTimePlayerPositionRef.current.set(snappedPos.x, snappedPos.y, snappedPos.z);
      applyPlayerMove(playersTransformsRef, contextPlayersRef, {
        playerId: socket.id,
        position: snappedPos,
        rotation: snappedRot,
        movementDirection: { x: 0, y: 0, z: 0 },
      });
      resetLocalPositionEmitThrottleRef.current(snappedPos, snappedRot);
      cameraSystemRef.current?.snapToTarget();
      if (exploreLateJoinGround) {
        exploreFog.markExplored(snappedPos.x, snappedPos.z, EXPLORE_PLAYER_VIEW_RADIUS);
      }

      lastAppliedCombatEnterSeqRef.current = coopCombatArenaEnterSeq;
    }
    if (intermissionChanged) {
      lastAppliedIntermissionSeqRef.current = coopMainArenaIntermissionSeq;
    }
  }, [coopCombatArenaEnterSeq, coopMainArenaIntermissionSeq, gameStarted, engineReady, socket?.id, coopArenaClampBounds, contextPlayersRef, playersTransformsRef, pendingPortalSnapRef, isExplore, isDungeon, isSkyTemple, isMeshWalkRoom, playerEntity, players]);

  /**
   * Local hero rotation follows the camera. Default orbit (theta=0) puts the camera on the "wrong" side
   * of the entry ring, so the character looks back toward the rim. Orbit 180° behind the facing-into-arena
   * yaw on each combat segment enter (teleport) so the first frame match server-facing remotes.
   * Explore has no arena center — skip this yaw so reclaim/late join does not spin toward origin.
   */
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady) return;
    if (coopCombatArenaEnterSeq === 0) return;
    if (isExplore) return;
    if (playerEntityRef.current === null || !socket?.id) return;
    if (!cameraSystemRef.current) return;
    const livePos = getPlayerLivePosition(
      socket.id,
      playersTransformsRef,
      contextPlayersRef.current.get(socket.id)?.position,
    );
    const c = coopArenaClampBounds == null
      ? { x: livePos.x, z: livePos.z }
      : clampToMainArenaXZ(livePos.x, livePos.z, coopArenaClampBounds);
    const faceY = rotationYTowardArenaCenter(c.x, c.z);
    const phi = cameraSystemRef.current.getVerticalAngle();
    cameraSystemRef.current.setAngles(faceY + Math.PI, phi);
    cameraSystemRef.current.snapToTarget();
  }, [coopCombatArenaEnterSeq, gameStarted, engineReady, socket?.id, coopArenaClampBounds, contextPlayersRef, playersTransformsRef, isExplore]);

  // PVP Kill Counter - tracks kills for all players
  const [playerKills, setPlayerKills] = useState<Map<string, number>>(new Map());


  // Keyboard: chat via Enter when focus is not in an input
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !isChatOpen && event.target === document.body) {
        event.preventDefault();
        openChat();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isChatOpen, openChat]);

  // Disable control system input when chat, full-screen UI, or portal transition overlay is active
  useEffect(() => {
    const uiBlocksGame = isChatOpen || uiBlocksGameInput || coopTransitionOverlay;
    if (controlSystemRef.current) {
      controlSystemRef.current.setInputDisabled(uiBlocksGame);
      controlSystemRef.current.setAllowAllInput(isChatOpen);
    }
    engineRef.current?.getInputManager().setGameInputBlocked(uiBlocksGame);
    if (coopTransitionOverlay) {
      if (!portalOverlayStartedAtRef.current) {
        portalOverlayStartedAtRef.current = Date.now();
      }
    } else {
      portalOverlayLocomotionHaltedRef.current = false;
      portalOverlayStartedAtRef.current = 0;
    }
  }, [isChatOpen, uiBlocksGameInput, coopTransitionOverlay]);

  useEffect(() => {
    return () => {
      if (localStunCameraUnlockTimeoutRef.current) {
        clearTimeout(localStunCameraUnlockTimeoutRef.current);
        localStunCameraUnlockTimeoutRef.current = null;
      }
    };
  }, []);

  // Function to increment kill count for a player
  const incrementKillCount = useCallback((playerId: string) => {
    setPlayerKills(prev => {
      const newKills = new Map(prev);
      const currentKills = newKills.get(playerId) || 0;
      newKills.set(playerId, currentKills + 1);
      return newKills;
    });
  }, []);

  // Clean up expired venom effects on players
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setPlayers((prev: Map<string, Player>) => {
        const newPlayers = new Map(prev);
        let hasChanges = false;
        
        newPlayers.forEach((player: Player, playerId: string) => {
          if (player.isVenomed && player.venomedUntil && now > player.venomedUntil) {
            newPlayers.set(playerId, {
              ...player,
              isVenomed: false,
              venomedUntil: undefined
            });
            hasChanges = true;
          }
        });
        
        return hasChanges ? newPlayers : prev;
      });
    }, 1000); // Check every second

    return () => clearInterval(cleanupInterval);
  }, []); // Remove setPlayers dependency to prevent infinite re-renders


  const handleWraithStrikeSlashImpactQueueReady = useCallback(
    (
      queue:
        | ((
            pos: Vector3,
            dir: Vector3,
            meta?: {
              wrathfulStrike?: boolean;
              infestedStrike?: boolean;
              wraithGuard?: boolean;
              staggeringStrike?: boolean;
            },
          ) => void)
        | null,
    ) => {
      wraithStrikeSlashImpactQueueRef.current = queue;
    },
    [],
  );

  const summonTotemEnemyData = useMemo(
    () => [
      ...(gameMode === 'coop'
        ? []
        : Array.from(players.values())
          .filter((p: Player) => p.id !== socket?.id)
          .map((p: Player) => ({
            id: p.id,
            position: new Vector3(p.position.x, p.position.y, p.position.z),
            health: p.health,
          }))),
      ...Array.from(enemies.values())
        .filter((e) => !e.isDying && e.health > 0 && e.alliedUnit !== true && e.type !== 'allied-knight' && e.type !== 'allied-huntress' && e.type !== 'allied-phantom' && e.type !== 'allied-demon' && e.type !== 'allied-enchantress' && e.type !== 'allied-healer' && e.type !== 'allied-tiger' && e.type !== 'allied-wolf' && e.type !== 'allied-bear' && e.type !== 'allied-serpent' && e.type !== 'allied-spider' && e.type !== 'player-zombie' && e.type !== 'vengeful-spirit')
        .map((e) => {
          const live = enemyTransformsRef.current.get(e.id);
          const p = live?.position ?? e.position;
          return {
            id: e.id,
            position: new Vector3(p.x, p.y, p.z),
            health: e.health,
          };
        }),
    ],
    [gameMode, players, enemies, socket?.id, enemyTransformsRef],
  );

  const getLiveCoopEnemyData = useCallback(() => {
    return Array.from(enemiesRef.current.values())
      .filter((e) => !e.isDying && e.health > 0 && e.alliedUnit !== true && e.type !== 'allied-knight' && e.type !== 'allied-huntress' && e.type !== 'allied-phantom' && e.type !== 'allied-demon' && e.type !== 'allied-enchantress' && e.type !== 'allied-healer' && e.type !== 'allied-tiger' && e.type !== 'allied-wolf' && e.type !== 'allied-bear' && e.type !== 'allied-serpent' && e.type !== 'allied-spider' && e.type !== 'player-zombie' && e.type !== 'vengeful-spirit')
      .map((e) => {
        const live = enemyTransformsRef.current.get(e.id);
        const p = live?.position ?? e.position;
        return {
          id: e.id,
          position: new Vector3(p.x, p.y, p.z),
          health: e.health,
          maxHealth: e.maxHealth,
          type: e.type,
          isBoss1EliteKnight: e.isBoss1EliteKnight === true,
        };
      });
  }, [enemiesRef, enemyTransformsRef]);

  const getArcticBlizzardEnemyData = useCallback(() => {
    const base = summonTotemEnemyData;
    if (base.length > 0 || gameMode === 'coop') {
      return base;
    }
    const world = engineRef.current?.getWorld();
    if (!world) return base;
    const out = [...base];
    const seen = new Set(out.map((e) => e.id));
    for (const entity of world.queryEntities([Health, Enemy])) {
      const health = entity.getComponent(Health);
      const enemy = entity.getComponent(Enemy);
      if (!health || !enemy || health.isDead) continue;
      if (entity.userData?.isCoopAlliedUnit) continue;
      const id = (entity.userData?.serverEnemyId as string | undefined) ?? String(entity.id);
      if (seen.has(id)) continue;
      seen.add(id);
      const t = entity.getComponent(Transform);
      if (!t) continue;
      out.push({
        id,
        position: new Vector3(t.position.x, t.position.y, t.position.z),
        health: health.currentHealth,
      });
    }
    return out;
  }, [summonTotemEnemyData, gameMode]);

  const getEntangledPlayerPositions = useCallback(() => {
    const out: Array<{ id: string; position: Vector3; health: number }> = [];
    const localId = socket?.id;
    const localEntityId = playerEntityRef.current;
    const world = engineRef.current?.getWorld();

    players.forEach((player, playerId) => {
      if (!player || player.health <= 0) return;
      if (playerId === localId && localEntityId != null && world) {
        const entity = world.getEntity(localEntityId);
        const transform = entity?.getComponent(Transform);
        if (transform) {
          out.push({
            id: playerId,
            position: transform.position.clone(),
            health: player.health,
          });
          return;
        }
      }
      out.push({
        id: playerId,
        position: new Vector3(player.position.x, player.position.y, player.position.z),
        health: player.health,
      });
    });

    return out;
  }, [players, socket?.id]);

  const getArcticBlizzardDamagePerTick = useCallback(
    () =>
      getArcticBlizzardDamagePerTickFromStats(
        effectiveCombatStats,
        talentLoadoutRef.current,
        abilityLoadoutRef.current,
      ),
    [effectiveCombatStats],
  );

  const getArcticBlizzardHitRadiusCallback = useCallback(
    () => getArcticBlizzardHitRadius(talentLoadoutRef.current),
    [],
  );

  const getArcticBlizzardParticleMultiplier = useCallback(
    () => getBlizzardParticleSpawnMultiplier(talentLoadoutRef.current),
    [],
  );

  const getRunebladeBlizzardStormHitRadiusCallback = useCallback(
    () => getRunebladeBlizzardStormHitRadius(talentLoadoutRef.current),
    [],
  );

  const getRunebladeBlizzardParticleMultiplier = useCallback(
    () => getBlizzardParticleSpawnMultiplier(talentLoadoutRef.current),
    [],
  );

  const resolveTotemEnemyFrozen = useCallback((targetId: string) => {
    const world = engineRef.current?.getWorld();
    if (!world) return false;
    const now = Date.now() / 1000;
    for (const entity of world.queryEntities([Health, Enemy])) {
      const health = entity.getComponent(Health);
      const enemy = entity.getComponent(Enemy);
      if (!health || !enemy || health.isDead) continue;
      const id = (entity.userData?.serverEnemyId as string | undefined) ?? String(entity.id);
      if (id !== targetId) continue;
      enemy.updateFreezeStatus(now);
      return enemy.isFrozen;
    }
    return false;
  }, []);

  const handleSummonTotemDamage = useCallback(
    (
      targetId: string,
      damage: number,
      _impactPosition: Vector3,
      isCritical?: boolean,
      coopEnemyDamageMeta?: EnemyDamageMeta,
    ) => {
      if (!socket?.id) return;
      if (gameMode === 'coop' && players.has(targetId)) return;
      if (enemies.has(targetId)) {
        damageEnemy(targetId, damage, socket.id, coopEnemyDamageMeta);
        if (isCritical && shouldApplyBloodleechTalent(talentLoadout)) {
          const str = StatSystem.getEffectiveStatsWithInventory(
            playerStatDataRef.current?.stats ?? ZERO_PLAYER_STATS,
            inventorySnapshotRef.current,
          ).strength;
          const strengthHeal = Math.max(0, Math.floor(str));
          const world = engineRef.current?.getWorld();
          const playerEntity = playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
          const health = playerEntity?.getComponent(Health);
          const transform = playerEntity?.getComponent(Transform);
          const position = transform
            ? transform.position.clone().add(new Vector3(0, 1.6, 0))
            : _impactPosition.clone();
          if (health && strengthHeal > 0 && health.heal(strengthHeal)) {
            updatePlayerHealth(health.currentHealth, health.maxHealth);
            broadcastPlayerHealing(strengthHeal, 'room_boon_bloodleech', position);
          }
        }
      } else {
        broadcastPlayerDamage(targetId, damage, 'summon_totem', isCritical);
      }
    },
    [
      broadcastPlayerDamage,
      broadcastPlayerHealing,
      damageEnemy,
      enemies,
      gameMode,
      players,
      socket?.id,
      talentLoadout,
      updatePlayerHealth,
    ],
  );

  const addTotemFloatingDamage = useCallback(
    (damage: number, isCritical: boolean, position: Vector3) => {
      const world = engineRef.current?.getWorld();
      if (!world) return;
      const combatSystem = world.getSystem(CombatSystem) as CombatSystem | undefined;
      combatSystem?.getDamageNumberManager().addDamageNumber(
        damage,
        isCritical,
        position,
        'summon_totem',
      );
    },
    [],
  );

  // Create a ref for the Viper Sting manager that includes position and rotation
  const viperStingParentRef = useRef({
    position: new Vector3(0, 0.5, COOP_MAIN_DEFAULT_SPAWN_Z),
    quaternion: { x: 0, y: 0, z: 0, w: 1 }
  });

  // Ref for ViperStingManager damage number ID (moved to top level to avoid hook rule violations)
  const viperStingDamageNumberIdRef = useRef(0);
  
  // Track server player to local ECS entity mapping for PVP damage
  const serverPlayerEntities = useRef<Map<string, number>>(new Map());
  
  // Track server enemy to local ECS entity mapping for co-op damage
  const serverEnemyEntities = useRef<Map<string, number>>(new Map());
  /** Sync ref-only enemy positions into ECS before Engine world.update (projectile/collision spatial hash). */
  const syncCoopEnemyEcsTransformsRef = useRef<() => void>(() => {});
  /** Emit local player position from Engine loop (independent of R3F render frameloop). */
  const syncLocalPlayerNetworkPositionRef = useRef<() => void>(() => {});
  /** Drive portal-fall jump animation progress each engine tick. */
  const syncPortalFallAnimationProgressRef = useRef<() => void>(() => {});
  /** One-shot ECS death-freeze per enemy (co-op death VFX window). */
  const coopEnemyDeathFrozenRef = useRef<Set<string>>(new Set());
  const mushroomEntityByIndexRef = useRef<Map<number, number>>(new Map());
  const treeEntityByIndexRef = useRef<Map<number, number>>(new Map());
  const rootEntityByIndexRef = useRef<Map<number, number>>(new Map());
  const rockEntityByIndexRef = useRef<Map<number, number>>(new Map());
  const spineEntityByIndexRef = useRef<Map<number, number>>(new Map());

  // Track stealth states for players
  const playerStealthStates = useRef<Map<string, boolean>>(new Map());

  // Track player deaths and respawn timers for PVP
  const [playerDeathStates, setPlayerDeathStates] = useState<Map<string, {
    isDead: boolean;
    deathTime: number;
    killerId?: string;
    deathPosition: Vector3;
  }>>(new Map());
  const playerDeathStatesRef = useRef(playerDeathStates);
  playerDeathStatesRef.current = playerDeathStates;


  // Experience system state
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [lastExperienceAwardTime, setLastExperienceAwardTime] = useState(0);
  const onPlayerLevelUpRef = useRef(onPlayerLevelUp);
  onPlayerLevelUpRef.current = onPlayerLevelUp;

  // Track current weapon
  const [currentWeapon, setCurrentWeapon] = useState<WeaponType>(WeaponType.NONE);

  const nextRoomBoomEffectId = useRef(0);

  // PVP Reanimate Effect Management (ref-only — no JSX; local uses reanimateRef)
  const pvpReanimateEffectsRef = useRef<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextReanimateEffectId = useRef(0);

  const nextSmiteEffectId = useRef(0);

  // PVP Colossus Strike Effect Management (ref-only — animation on DragonRenderer)
  const pvpColossusStrikeEffectsRef = useRef<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    damage: number;
    startTime: number;
    duration: number;
    onDamageDealt?: (damageDealt: boolean) => void;
  }>>([]);
  const nextColossusStrikeEffectId = useRef(0);

  const nextLightningStormEffectId = useRef(0);
  const nextDeflectSmiteEffectId = useRef(0);
  const nextLocustEffectId = useRef(0);

  // PVP Wind Shear Effect Management (ref-only — UnifiedProjectileManager renders)
  const pvpWindShearEffectsRef = useRef<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    direction: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextWindShearEffectId = useRef(0);

  const nextWindShearTornadoEffectId = useRef(0);

  const nextWhirlwindRadialWaveEffectId = useRef(0);

  const nextDeathGraspEffectId = useRef(0);
  /** Active Death Grasp enemy pulls: client lerp while return VFX plays. */
  const deathGraspPullsRef = useRef<Map<string, {
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
    startTime: number;
    durationMs: number;
  }>>(new Map());

  const isDeathGraspPullImmuneEnemy = useCallback((enemyId: string) => {
    const enemy = enemiesRef.current.get(enemyId);
    return isDeathGraspPullImmune(enemy);
  }, [enemiesRef]);

  const getDeathGraspPulledEnemyPosition = useCallback((enemyId: string): Vector3 | null => {
    const pull = deathGraspPullsRef.current.get(enemyId);
    if (!pull) return null;
    const t = Math.min(1, (Date.now() - pull.startTime) / pull.durationMs);
    return new Vector3(
      pull.from.x + (pull.to.x - pull.from.x) * t,
      pull.from.y + (pull.to.y - pull.from.y) * t,
      pull.from.z + (pull.to.z - pull.from.z) * t,
    );
  }, []);

  const onDeathGraspEnemyPullFrame = useCallback((enemyId: string, position: Vector3) => {
    const existing = enemyTransformsRef.current.get(enemyId);
    enemyTransformsRef.current.set(enemyId, {
      position: { x: position.x, y: position.y, z: position.z },
      rotation: existing?.rotation ?? 0,
    });
    const enemy = enemiesRef.current.get(enemyId);
    if (enemy) {
      enemy.position = { x: position.x, y: position.y, z: position.z };
    }
  }, [enemiesRef, enemyTransformsRef]);


  // PVP Summon Totem Effect Management (ref-only — never rendered)
  const pvpSummonTotemEffectsRef = useRef<Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>>([]);

  const nextFlurryHealingEffectId = useRef(0);

  // PVP Venom Effect Management (ref-only — DoT handled via timers, no JSX)
  const pvpVenomEffectsRef = useRef<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextVenomEffectId = useRef(0);
  const pvpVenomIntervalsRef = useRef<Map<number, ReturnType<typeof setInterval>>>(new Map());
  const pvpVenomTimeoutsRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const clearAllPvpVenomTimers = useCallback(() => {
    Array.from(pvpVenomIntervalsRef.current.values()).forEach((id) => clearInterval(id));
    Array.from(pvpVenomTimeoutsRef.current.values()).forEach((id) => clearTimeout(id));
    pvpVenomIntervalsRef.current.clear();
    pvpVenomTimeoutsRef.current.clear();
  }, []);

  useEffect(() => () => clearAllPvpVenomTimers(), [clearAllPvpVenomTimers]);

  // PVP Debuff Management (ref-only — movement debuff applied directly, no JSX)
  const pvpDebuffEffectsRef = useRef<Array<{
    id: number;
    playerId: string;
    debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'entangled';
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextDebuffEffectId = useRef(0);
  const nextLocalPlayerFrozenEffectId = useRef(0);
  const nextLocalPlayerStunnedEffectId = useRef(0);

  const applyLocalPlayerStun = useCallback((
    durationMs: number,
    source: string,
    options?: { broadcast?: boolean },
  ) => {
    controlSystemRef.current?.stunPlayer(durationMs);
    const engine = engineRef.current;
    const playerEntityLocal = playerEntityRef.current !== null && engine
      ? engine.getWorld().getEntity(playerEntityRef.current)
      : null;
    playerEntityLocal?.getComponent(Movement)?.haltLocomotion();

    pvpAbilityLayerRef.current?.addLocalPlayerStunned({
      id: nextLocalPlayerStunnedEffectId.current++,
      startTime: Date.now(),
      duration: durationMs,
    });

    if (socket?.id && cameraSystemRef.current) {
      const cameraLockId = `${source}:${socket.id}`;
      if (localStunCameraUnlockTimeoutRef.current) {
        clearTimeout(localStunCameraUnlockTimeoutRef.current);
      }
      cameraSystemRef.current.setCameraRotationDisabled(true, cameraLockId);
      localStunCameraUnlockTimeoutRef.current = setTimeout(() => {
        if (
          cameraSystemRef.current?.getCameraRotationDisabledBy() === cameraLockId &&
          !controlSystemRef.current?.isPlayerDeadState()
        ) {
          cameraSystemRef.current.setCameraRotationDisabled(false, cameraLockId);
        }
        localStunCameraUnlockTimeoutRef.current = null;
      }, durationMs);
    }

    if (options?.broadcast === false || !socket?.id || !broadcastPlayerDebuff) return;

    const transform = playerEntityLocal?.getComponent(Transform);
    const pos = transform?.position ?? realTimePlayerPositionRef.current;
    broadcastPlayerDebuff(socket.id, 'stunned', durationMs, {
      position: { x: pos.x, y: pos.y, z: pos.z },
      source,
    });

    if (transform) {
      const cameraSystem = (window as Window & {
        cameraSystem?: { getOrbitHorizontalFacingAngle?: () => number };
      }).cameraSystem;
      const cameraAngle =
        typeof cameraSystem?.getOrbitHorizontalFacingAngle === 'function'
          ? cameraSystem.getOrbitHorizontalFacingAngle()
          : 0;
      const movement = playerEntityLocal?.getComponent(Movement);
      updatePlayerPosition(
        transform.position,
        { x: 0, y: cameraAngle, z: 0 },
        movement
          ? buildPlayerMovementDirectionPayload(movement, { isStunned: true })
          : ZERO_PLAYER_MOVEMENT_DIRECTION,
        { force: true },
      );
    }
  }, [socket?.id, broadcastPlayerDebuff, updatePlayerPosition]);

  // Track active debuff indicators to prevent visual overcrowding
  // Key format: "playerId:debuffType" -> debuff effect id
  const activeDebuffIndicators = useRef<Map<string, number>>(new Map());
  const judgmentCorruptionStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valkyrieJudgmentFallTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const stopJudgmentCorruptionSound = useCallback(() => {
    if (judgmentCorruptionStopTimerRef.current) {
      clearTimeout(judgmentCorruptionStopTimerRef.current);
      judgmentCorruptionStopTimerRef.current = null;
    }
    window.audioSystem?.setJudgmentCorruptionPlaying?.(false);
  }, []);

  const scheduleJudgmentCorruptionStop = useCallback((durationMs: number) => {
    if (judgmentCorruptionStopTimerRef.current) {
      clearTimeout(judgmentCorruptionStopTimerRef.current);
    }
    judgmentCorruptionStopTimerRef.current = setTimeout(() => {
      judgmentCorruptionStopTimerRef.current = null;
      window.audioSystem?.setJudgmentCorruptionPlaying?.(false);
    }, durationMs);
  }, []);

  // PVP Frost Nova Effect Management (ref-only — FrostNovaManager renders locally)
  const pvpFrostNovaEffectsRef = useRef<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextFrostNovaEffectId = useRef(0);

  // PVP Crossentropy Explosion Effect Management (ref-only — never populated)
  const pvpCrossentropyExplosionsRef = useRef<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);

  // PVP Summon Totem Explosion Effect Management (ref-only — never populated)
  const pvpSummonTotemExplosionsRef = useRef<Array<{
    id: number;
    playerId: string;
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);

  const nextHauntedSoulEffectId = useRef(0);

  // Enemy Taunt Effect Management (for Deathgrasp) — ref-backed to avoid VFX state churn
  const enemyTauntEffectsRef = useRef<Array<{
    id: number;
    enemyId: string;
    startTime: number;
    duration: number;
  }>>([]);
  const [tauntFxRevision, setTauntFxRevision] = useState(0);
  const nextTauntEffectId = useRef(0);
  const isEnemyTaunted = useCallback((enemyId: string) => {
    const now = Date.now();
    return enemyTauntEffectsRef.current.some(
      (effect) => effect.enemyId === enemyId && now < effect.startTime + effect.duration,
    );
  }, [tauntFxRevision]);

  useEffect(() => {
    return subscribeEnemyDamage((event) => {
      if (!event.wasKilled) return;
      const enemy = enemiesRef.current.get(event.enemyId);
      if (!enemy) return;
      const isBoss = enemy.type === 'boss' || enemy.type === 'boss2' || enemy.type === 'boss3' || enemy.type === 'destiny';
      const isTitanScale =
        enemy.type === 'titan'
        || enemy.type === 'stone-giant'
        || enemy.type === 'eternal-oak'
        || enemy.type === 'colossus';
      if (!isBoss && !isTitanScale) return;
      explosionBurstLayerRef.current?.addDeathFlashExplosion({
        id: `death-flash-${event.enemyId}-${event.timestamp}`,
        position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
        scale: isTitanScale ? 'titan' : 'boss',
      });
    });
  }, [subscribeEnemyDamage]);

  // Function to create enemy taunt effect (for Deathgrasp)
  const createEnemyTauntEffect = useCallback((enemyId: string, duration: number = 10000) => {
    const tauntEffect = {
      id: nextTauntEffectId.current++,
      enemyId,
      startTime: Date.now(),
      duration
    };

    enemyTauntEffectsRef.current = [...enemyTauntEffectsRef.current, tauntEffect];
    setTauntFxRevision((r) => r + 1);

    setTimeout(() => {
      enemyTauntEffectsRef.current = enemyTauntEffectsRef.current.filter((e) => e.id !== tauntEffect.id);
      setTauntFxRevision((r) => r + 1);
    }, duration);
  }, []);

  // Function to create venom effect on PVP players
  // Function to create debuff effect on PVP players
  const createPvpDebuffEffect = useCallback((
    playerId: string,
    debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted' | 'entangled',
    position: Vector3,
    duration: number = 5000,
    options?: { source?: string },
  ) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    const isJudgmentCorruption =
      isLocalPlayer && debuffType === 'corrupted' && options?.source === 'valkyrie_judgment';
    
    // Check if there's already an active debuff indicator for this player and debuff type
    const indicatorKey = `${playerId}:${debuffType}`;
    const existingIndicatorId = activeDebuffIndicators.current.get(indicatorKey);
    
    // If there's already an active indicator, extend its duration instead of creating a new one
    if (existingIndicatorId !== undefined) {
      let extendedDuration = duration;
      // Find and update the existing debuff effect
      pvpDebuffEffectsRef.current = pvpDebuffEffectsRef.current.map(effect => {
        if (effect.id === existingIndicatorId) {
          extendedDuration = Math.max(effect.duration, duration);
          return {
            ...effect,
            duration: extendedDuration,
            position: position.clone(),
          };
        }
        return effect;
      });
      
      // Apply the debuff to the local player if this is targeting us
      if (isLocalPlayer) {
        if (debuffType === 'stunned') {
          applyLocalPlayerStun(extendedDuration, 'server-stun', { broadcast: false });
        } else if (playerEntity) {
          const playerMovement = playerEntity.getComponent(Movement);
          if (playerMovement) {
            if (debuffType === 'frozen') {
              playerMovement.freeze(extendedDuration);
            } else if (debuffType === 'entangled') {
              playerMovement.entangle(extendedDuration);
            } else if (debuffType === 'slowed') {
              playerMovement.slow(extendedDuration, 0.5); // 50% speed reduction
            } else if (debuffType === 'corrupted') {
              playerMovement.applyCorrupted(extendedDuration); // Apply corrupted debuff with gradual recovery
            }
          }
        }
        if (isJudgmentCorruption) {
          window.audioSystem?.setJudgmentCorruptionPlaying?.(true);
          scheduleJudgmentCorruptionStop(extendedDuration);
        }
      }

      if (debuffType === 'entangled') {
        addGlobalEntangledPlayer(playerId, position.clone(), extendedDuration);
      }
      if (debuffType === 'frozen' || (debuffType === 'stunned' && !isLocalPlayer)) {
        let posRef = isLocalPlayer
          ? realTimePlayerPositionRef
          : enemyPlayerPositionRefs.current.get(playerId);
        if (!isLocalPlayer && !posRef) {
          posRef = { current: position.clone() };
          enemyPlayerPositionRefs.current.set(playerId, posRef);
        }
        if (debuffType === 'frozen') {
          pvpAbilityLayerRef.current?.addLocalPlayerFrozen({
            id: nextLocalPlayerFrozenEffectId.current++,
            startTime: Date.now(),
            duration: extendedDuration,
            positionRef: isLocalPlayer ? undefined : posRef,
          });
        } else {
          pvpAbilityLayerRef.current?.addLocalPlayerStunned({
            id: nextLocalPlayerStunnedEffectId.current++,
            startTime: Date.now(),
            duration: extendedDuration,
            positionRef: posRef,
          });
        }
      }
      
      return; // Exit early, don't create a new indicator
    }
    
    const debuffEffect = {
      id: nextDebuffEffectId.current++,
      playerId,
      debuffType,
      position: position.clone(),
      startTime: Date.now(),
      duration
    };

    if (debuffType === 'frozen') {
      (window as any).audioSystem?.playFrozenStatusSound?.(position);
    }
    if (isJudgmentCorruption) {
      window.audioSystem?.setJudgmentCorruptionPlaying?.(true);
      scheduleJudgmentCorruptionStop(duration);
    }
    
    // Track this new debuff indicator
    activeDebuffIndicators.current.set(indicatorKey, debuffEffect.id);
    pvpDebuffEffectsRef.current.push(debuffEffect);
    
    // Apply the debuff to the local player if this is targeting us
    if (isLocalPlayer) {
      if (debuffType === 'stunned') {
        applyLocalPlayerStun(duration, 'server-stun', { broadcast: false });
      } else if (playerEntity) {
        const playerMovement = playerEntity.getComponent(Movement);
        if (playerMovement) {
          if (debuffType === 'frozen') {
            playerMovement.freeze(duration);
          } else if (debuffType === 'entangled') {
            playerMovement.entangle(duration);
          } else if (debuffType === 'slowed') {
            playerMovement.slow(duration, 0.5); // 50% speed reduction
          } else if (debuffType === 'corrupted') {
            playerMovement.applyCorrupted(duration); // Apply corrupted debuff with gradual recovery
          }
        }
      }
    }

    if (debuffType === 'entangled') {
      addGlobalEntangledPlayer(playerId, position.clone(), duration);
    }
    if (debuffType === 'frozen' || (debuffType === 'stunned' && !isLocalPlayer)) {
      let posRef = isLocalPlayer
        ? realTimePlayerPositionRef
        : enemyPlayerPositionRefs.current.get(playerId);
      if (!isLocalPlayer && !posRef) {
        posRef = { current: position.clone() };
        enemyPlayerPositionRefs.current.set(playerId, posRef);
      }
      if (debuffType === 'frozen') {
        pvpAbilityLayerRef.current?.addLocalPlayerFrozen({
          id: nextLocalPlayerFrozenEffectId.current++,
          startTime: Date.now(),
          duration,
          positionRef: isLocalPlayer ? undefined : posRef,
        });
      } else {
        pvpAbilityLayerRef.current?.addLocalPlayerStunned({
          id: nextLocalPlayerStunnedEffectId.current++,
          startTime: Date.now(),
          duration,
          positionRef: posRef,
        });
      }
    }
    
    // Clean up debuff effect after duration using batched updates
    setTimeout(() => {
      // Remove from tracking map
      const indicatorKey = `${debuffEffect.playerId}:${debuffEffect.debuffType}`;
      activeDebuffIndicators.current.delete(indicatorKey);
      pvpDebuffEffectsRef.current = pvpDebuffEffectsRef.current.filter(
        effect => effect.id !== debuffEffect.id,
      );
    }, debuffEffect.duration);
  }, [socket?.id, playerEntity, applyLocalPlayerStun, scheduleJudgmentCorruptionStop]);

  // Function to create frozen effect on PVP players (called by PVPFrostNovaManager)
  const createPvpFrozenEffect = useCallback((playerId: string, position: Vector3) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // Create the frozen debuff effect (3 second freeze)
    createPvpDebuffEffect(playerId, 'frozen', position, 5000);
    
    // Broadcast debuff effect to all players so they can see it
    if (broadcastPlayerDebuff) {
      broadcastPlayerDebuff(playerId, 'frozen', 5000, {
        position: { x: position.x, y: position.y, z: position.z }
      });
    }
  }, [createPvpDebuffEffect, broadcastPlayerDebuff]);

  // Function to create reanimate effect on PVP players
  const createPvpReanimateEffect = useCallback((playerId: string, position: Vector3) => {

    const reanimateEffect = {
      id: nextReanimateEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1500 // 1.5 seconds reanimate duration (matches Reanimate component)
    };

    pvpReanimateEffectsRef.current.push(reanimateEffect);

    // Clean up reanimate effect after duration
    setTimeout(() => {
      pvpReanimateEffectsRef.current = pvpReanimateEffectsRef.current.filter(
        e => e.id !== reanimateEffect.id,
      );
    }, reanimateEffect.duration);
  }, []);

  // Function to create smite effect on PVP players
  const createPvpSmiteEffect = useCallback((
    playerId: string,
    position: Vector3,
    onDamageDealt?: (totalDamage: number, meta?: { targetsHit: number }) => void,
    opts?: {
      sequenceDelaySec?: number;
      infestedSmite?: boolean;
      staggeringSmite?: boolean;
      infernalSmite?: boolean;
      vengeanceSmite?: boolean;
      weaponAspect?: WeaponAspect;
    },
  ) => {
    const sequenceDelaySec = opts?.sequenceDelaySec ?? 0;
    const baseCleanupMs = 1200;
    const duration = baseCleanupMs + sequenceDelaySec * 1000;

    const smiteEffect = {
      id: nextSmiteEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration,
      onDamageDealt,
      sequenceDelaySec,
      infestedSmite: !!opts?.infestedSmite,
      staggeringSmite: !!opts?.staggeringSmite,
      infernalSmite: !!opts?.infernalSmite,
      vengeanceSmite: !!opts?.vengeanceSmite,
      ...(opts?.weaponAspect ? { weaponAspect: opts.weaponAspect } : {}),
    };

    pvpAbilityLayerRef.current?.addSmite(smiteEffect);

    // Clean up smite effect after duration
    setTimeout(() => {
      pvpAbilityLayerRef.current?.removeSmite(smiteEffect.id);
    }, smiteEffect.duration);
  }, []);

  const onSmiteBeamEnemyHitColossusGuard = useCallback(() => {
    controlSystemRef.current?.tryColossusGuardProcFromSmiteBeamHit();
  }, []);

  const getCoopEnemyTypeById = useCallback(
    (enemyId: string) => enemiesRef.current.get(enemyId)?.type,
    [],
  );

  const onPvpSmiteHitEnemy = useCallback((targetId: string, damage: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-hit-enemy', {
        roomId: currentRoomId,
        enemyId: targetId,
        damage,
        isCritical: false,
      });
    }
  }, [socket, currentRoomId]);
  const onPvpLightningStormHitEnemy = useCallback((targetId: string, damage: number) => {
    if (socket && currentRoomId) {
      socket.emit('player-hit-enemy', {
        roomId: currentRoomId,
        enemyId: targetId,
        damage,
        isCritical: false,
      });
    }
  }, [socket, currentRoomId]);
  const onPvpLocustHitEnemy = useCallback((targetId: string, damage: number) => {
    const liveEnemy = getLiveCoopEnemyData().find((e) => e.id === targetId);
    const damageNumberManager = (window as { damageNumberManager?: DamageNumberManager }).damageNumberManager;
    if (damageNumberManager && liveEnemy) {
      const numPos = liveEnemy.position.clone();
      numPos.y += 1.35;
      addEnemyHitDamageNumber(damageNumberManager, {
        enemyId: targetId,
        enemyType: enemiesRef.current.get(targetId)?.type,
        damage,
        isCritical: false,
        position: numPos,
        damageType: 'locust',
      });
    }
    damageEnemy(targetId, damage, socket?.id, { damageType: 'locust' });
  }, [damageEnemy, enemiesRef, getLiveCoopEnemyData, socket]);
  const onPvpDeathGraspHitEnemy = useCallback((
    enemyId: string,
    hitPosition: Vector3,
    attackerId: string,
    castPosition: Vector3,
    direction: Vector3,
  ) => {
    // Only the casting client reports the hit for validation
    if (!socket || !currentRoomId || attackerId !== socket.id) return;

    const enemy = enemiesRef.current.get(enemyId);
    if (enemy && !isDeathGraspPullImmune(enemy)) {
      const pdx = hitPosition.x - castPosition.x;
      const pdz = hitPosition.z - castPosition.z;
      const pLen = Math.hypot(pdx, pdz) || 1;
      const to = {
        x: castPosition.x + (pdx / pLen) * DEATH_GRASP_STANDOFF,
        y: hitPosition.y,
        z: castPosition.z + (pdz / pLen) * DEATH_GRASP_STANDOFF,
      };
      deathGraspPullsRef.current.set(enemyId, {
        from: { x: hitPosition.x, y: hitPosition.y, z: hitPosition.z },
        to,
        startTime: Date.now(),
        durationMs: DEATH_GRASP_PULL_DURATION_MS,
      });
      setTimeout(() => {
        deathGraspPullsRef.current.delete(enemyId);
      }, DEATH_GRASP_PULL_DURATION_MS + 100);
    }

    socket.emit('player-deathgrasp-hit', {
      roomId: currentRoomId,
      enemyId,
      castPosition: { x: castPosition.x, y: castPosition.y, z: castPosition.z },
      direction: { x: direction.x, y: direction.y, z: direction.z },
      hitPosition: { x: hitPosition.x, y: hitPosition.y, z: hitPosition.z },
    });
  }, [socket, currentRoomId, enemiesRef]);
  const getVengeanceSmiteDamageMultiplier = useCallback(
    () => controlSystemRef.current?.getVengeanceSmiteDamageMultiplier() ?? 1,
    [],
  );

  // Function to trigger Flurry healing effect
  const triggerFlurryHealingEffect = useCallback((position: Vector3) => {
    const healingEffect = {
      id: nextFlurryHealingEffectId.current++,
      position: position.clone(),
      startTime: Date.now()
    };

    pvpAbilityLayerRef.current?.addFlurryHealing(healingEffect);

    // Clean up healing effect after 800ms (duration of the effect)
    setTimeout(() => {
      pvpAbilityLayerRef.current?.removeFlurryHealing(healingEffect.id);
    }, 800);
  }, []);

  const createPvpColossusStrikeEffect = useCallback((playerId: string, position: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => {

    const colossusStrikeEffect = {
      id: nextColossusStrikeEffectId.current++,
      playerId,
      position: position.clone(),
      damage: damage,
      startTime: Date.now(),
      duration: 1200, // 1.2 seconds - extended to account for start delay (0.05s) + animation (1.0s) + buffer (0.15s)
      onDamageDealt: onDamageDealt
    };

    pvpColossusStrikeEffectsRef.current.push(colossusStrikeEffect);

    setTimeout(() => {
      pvpColossusStrikeEffectsRef.current = pvpColossusStrikeEffectsRef.current.filter(
        e => e.id !== colossusStrikeEffect.id,
      );
    }, colossusStrikeEffect.duration);
  }, []);

  // Function to create Lightning Storm effect
  const createLightningStormEffect = useCallback((playerId: string, position: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => {
    const lightningStormEffect = {
      id: nextLightningStormEffectId.current++,
      playerId,
      position: position.clone(),
      damage: damage,
      startTime: Date.now(),
      duration: 1000, // 1.0 seconds
      onDamageDealt: onDamageDealt
    };

    pvpAbilityLayerRef.current?.addLightningStorm(lightningStormEffect);

    setTimeout(() => {
      pvpAbilityLayerRef.current?.removeLightningStorm(lightningStormEffect.id);
    }, lightningStormEffect.duration);
  }, []);

  // Function to create wind shear effect on PVP players
  const createPvpWindShearEffect = useCallback((playerId: string, position: Vector3, direction: Vector3) => {
    // Trigger the visual projectile effect
    triggerWindShearProjectile(position, direction);

    const windShearEffect = {
      id: nextWindShearEffectId.current++,
      playerId,
      position: position.clone(),
      direction: direction.clone(),
      startTime: Date.now(),
      duration: 2200 // 2.2 seconds (slightly longer than projectile lifetime)
    };

    pvpWindShearEffectsRef.current.push(windShearEffect);

    setTimeout(() => {
      pvpWindShearEffectsRef.current = pvpWindShearEffectsRef.current.filter(
        e => e.id !== windShearEffect.id,
      );
    }, windShearEffect.duration);
  }, []);

  // Function to create wind shear tornado effect on PVP players
  const createPvpWindShearTornadoEffect = useCallback((playerId: string, duration: number) => {
    // Debug: Log all players in the map

    // For local player (socket.id or 'local'), use the actual player entity position
    let initialPosition = new Vector3();
    let player = players.get(playerId);

    // Check if this is for the local player
    const isLocalPlayer = playerId === socket?.id || playerId === 'local';
    
    if (isLocalPlayer && playerEntity) {
      const transform = playerEntity.getComponent(Transform);
      if (transform) {
        initialPosition = transform.position.clone();
      }
    } else if (player) {
      initialPosition = new Vector3(player.position.x, player.position.y, player.position.z);
    } else {
      // Try to find the local player by socket ID if playerId was 'local'
      if (playerId === 'local' && socket?.id) {
        player = players.get(socket.id);
        if (player) {
          initialPosition = new Vector3(player.position.x, player.position.y, player.position.z);
        }
      }
    }

    const tornadoEffect = {
      id: nextWindShearTornadoEffectId.current++,
      playerId,
      position: initialPosition,
      startTime: Date.now(),
      duration
    };

    pvpAbilityLayerRef.current?.addWindShearTornado(tornadoEffect);

    setTimeout(() => {
      pvpAbilityLayerRef.current?.removeWindShearTornado(tornadoEffect.id);
    }, duration);
  }, [players, socket?.id, playerEntity]);

  // Function to create whirlwind radial wave effect on PVP players
  const createPvpWhirlwindRadialWaveEffect = useCallback((playerId: string, duration: number) => {
    // For local player (socket.id or 'local'), use the actual player entity position
    let initialPosition = new Vector3();
    let player = players.get(playerId);

    // Check if this is for the local player
    const isLocalPlayer = playerId === socket?.id || playerId === 'local';

    if (isLocalPlayer && playerEntity) {
      const transform = playerEntity.getComponent(Transform);
      if (transform) {
        initialPosition = transform.position.clone();
      }
    } else if (player) {
      initialPosition = new Vector3(player.position.x, player.position.y, player.position.z);
    }

    const radialWaveEffect = {
      id: nextWhirlwindRadialWaveEffectId.current++,
      playerId,
      position: initialPosition,
      startTime: Date.now(),
      duration
    };

    pvpAbilityLayerRef.current?.addWhirlwindRadialWave(radialWaveEffect);

    setTimeout(() => {
      pvpAbilityLayerRef.current?.removeWhirlwindRadialWave(radialWaveEffect.id);
    }, duration);
  }, [players, socket?.id, playerEntity]);

  // Function to create death grasp effect on PVP players
  const createPvpDeathGraspEffect = useCallback((playerId: string, startPosition: Vector3, direction: Vector3) => {

    const deathGraspEffect = {
      id: nextDeathGraspEffectId.current++,
      playerId,
      startPosition: startPosition.clone(),
      direction: direction.clone(),
      startTime: Date.now(),
      duration: 1200, // 1.2 seconds death grasp duration (matches DeathGraspProjectile component)
      pullTriggered: false
    };

    pvpAbilityLayerRef.current?.addDeathGrasp(deathGraspEffect);

    setTimeout(() => {
      pvpAbilityLayerRef.current?.removeDeathGrasp(deathGraspEffect.id);
    }, deathGraspEffect.duration);
  }, []);


  // Function to create frost nova effect on PVP players
  const createPvpFrostNovaEffect = useCallback((playerId: string, position: Vector3) => {

    const frostNovaEffect = {
      id: nextFrostNovaEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 1200 // 1.2 seconds frost nova duration (matches FrostNovaManager)
    };

    pvpFrostNovaEffectsRef.current.push(frostNovaEffect);

    setTimeout(() => {
      pvpFrostNovaEffectsRef.current = pvpFrostNovaEffectsRef.current.filter(
        e => e.id !== frostNovaEffect.id,
      );
    }, frostNovaEffect.duration);
  }, []);


  const createRoomBoomDashVfx = useCallback((
    variant: RoomBoomDashVariant,
    origin: Vector3,
    destination: Vector3,
    lightningTarget?: Vector3,
    key?: RoomBoomDashKey,
    options?: { vfxOnly?: boolean },
  ) => {
    const id = nextRoomBoomEffectId.current++;
    if (variant === 'infernal') {
      bossTelegraphLayerRef.current?.addRoomBoomFlameStrike({ id, position: destination.clone() });
      (window as any).audioSystem?.playWeaponSound?.('scythe_cryoflame', destination, { volume: 0.75 });
    } else if (variant === 'glacial') {
      if (key === 'w') {
        if (options?.vfxOnly) {
          const p = destination.clone();
          p.y = Math.max(1.5, p.y);
          bossTelegraphLayerRef.current?.addRoomBoomArcticBlizzard({ id, position: p });
        }
      } else {
        bossTelegraphLayerRef.current?.addRoomBoomFrostNova({ id, position: origin.clone(), startTime: Date.now(), duration: 1200 });
        (window as any).audioSystem?.playFrostNovaSound?.(origin);
      }
    } else if (variant === 'mending') {
      pvpAbilityLayerRef.current?.addRoomBoomMending({ id, position: destination.clone() });
      (window as any).audioSystem?.playScytheSunwellSound?.(destination);
    } else if (variant === 'staggering' && lightningTarget) {
      lightningBurstLayerRef.current?.addRoomBoomLightningEffect({
        id,
        from: destination.clone().add(new Vector3(0, 0.75, 0)),
        to: lightningTarget.clone().add(new Vector3(0, 0.9, 0)),
      });
      (window as any).audioSystem?.playWeaponSound?.('scythe_cryoflame', destination, { volume: 0.45, rate: 1.4 });
    }
  }, []);

  const handleRoomBoomDash = useCallback((payload: RoomBoomDashPayload) => {
    const world = engineRef.current?.getWorld();
    const sourceEntity = playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
    const combatSystem = world?.getSystem(CombatSystem) as CombatSystem | undefined;
    const sourcePlayerId = socket?.id;
    const nowSec = Date.now() / 1000;

    const applyEnemyStatus = (entity: Entity, enemy: Enemy, position: Vector3, effectType: 'ignite' | 'freeze', durationMs: number) => {
      if (effectType === 'ignite') {
        // Local VFX only — server applies Ignite from infernalDashRoom hitMeta on enemy-damage.
        // Emitting apply-status-effect here raced ahead of that path and suppressed Pyromania
        // (hadActiveIgnite=true by the time the attributed ignite arrived).
        enemy.applyIgnite(durationMs, nowSec, entity.id.toString(), position.clone());
        return;
      }
      const sk = entity.userData?.coopServerEnemyType as string | undefined;
      if (isImmuneToPlayerStunAndFreeze(sk)) return;
      const cappedMs = capFreezeMsForEnemy(enemy, durationMs, sk);
      enemy.freeze(cappedMs / 1000, nowSec, sk);
      addGlobalFrozenEnemy(entity.id.toString(), position.clone(), cappedMs);
      const serverEnemyId = entity.userData?.serverEnemyId as string | undefined;
      if (serverEnemyId) {
        applyStatusEffect(serverEnemyId, effectType, durationMs);
      }
    };

    const damageEnemiesInRadius = (
      center: Vector3,
      radius: number,
      damage: number,
      status?: { type: 'ignite' | 'freeze'; durationMs: number },
      damageType?: string,
      infernalDashRoom?: boolean,
    ) => {
      if (!world || !combatSystem) return;
      for (const entity of world.queryEntities([Enemy, Transform, Health])) {
        const enemy = entity.getComponent(Enemy);
        const transform = entity.getComponent(Transform);
        const health = entity.getComponent(Health);
        if (!enemy || !transform || !health || health.isDead || enemy.isDead) continue;
        if (isCoopPlayerAllyEntity(entity)) continue;
        const dx = transform.position.x - center.x;
        const dz = transform.position.z - center.z;
        if (Math.hypot(dx, dz) > radius) continue;
        if (damage > 0) {
          combatSystem.queueDamage(
            entity,
            damage,
            sourceEntity,
            damageType,
            sourcePlayerId,
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
            infernalDashRoom,
          );
        }
        if (status) {
          applyEnemyStatus(entity, enemy, transform.position, status.type, status.durationMs);
        }
      }
    };

    const findNearestEnemy = (center: Vector3, range: number): { entity: Entity; position: Vector3 } | null => {
      if (!world) return null;
      let nearest: { entity: Entity; position: Vector3; distSq: number } | null = null;
      for (const entity of world.queryEntities([Enemy, Transform, Health])) {
        const enemy = entity.getComponent(Enemy);
        const transform = entity.getComponent(Transform);
        const health = entity.getComponent(Health);
        if (!enemy || !transform || !health || health.isDead || enemy.isDead) continue;
        if (isCoopPlayerAllyEntity(entity)) continue;
        const dx = transform.position.x - center.x;
        const dz = transform.position.z - center.z;
        const distSq = dx * dx + dz * dz;
        if (distSq > range * range) continue;
        if (!nearest || distSq < nearest.distSq) {
          nearest = { entity, position: transform.position.clone(), distSq };
        }
      }
      return nearest ? { entity: nearest.entity, position: nearest.position } : null;
    };

    let lightningTarget: Vector3 | undefined;

    if (payload.variant === 'infernal') {
      damageEnemiesInRadius(
        payload.destination,
        INFERNAL_DASH_RADIUS,
        INFERNAL_DASH_DAMAGE,
        { type: 'ignite', durationMs: 4000 },
        'infernal_dash',
        true,
      );
    } else if (payload.variant === 'glacial') {
      if (payload.key === 'w') {
        const p = payload.destination.clone();
        p.y = Math.max(1.5, p.y);
        spawnArcticGroundBlizzardAtFromReact(p);
      } else {
        damageEnemiesInRadius(payload.origin, GLACIAL_DASH_RADIUS, 0, {
          type: 'freeze',
          durationMs: GLACIAL_DASH_FREEZE_DURATION_MS,
        });
      }
    } else if (payload.variant === 'mending') {
      const sta = StatSystem.getEffectiveStatsWithInventory(
        playerStatDataRef.current?.stats ?? ZERO_PLAYER_STATS,
        inventorySnapshotRef.current,
      ).stamina;
      const staminaHeal = Math.max(0, Math.floor(sta));
      const health = sourceEntity?.getComponent(Health);
      if (health && staminaHeal > 0 && health.heal(staminaHeal)) {
        updatePlayerHealth(health.currentHealth, health.maxHealth);
        broadcastPlayerHealing(staminaHeal, 'room_boom_mending_dash', payload.destination);
      }
    } else if (payload.variant === 'staggering') {
      const target = findNearestEnemy(payload.destination, STAGGERING_DASH_RANGE);
      if (target && combatSystem) {
        const damage = Math.floor(STAGGERING_DASH_MIN_DAMAGE + Math.random() * (STAGGERING_DASH_MAX_DAMAGE - STAGGERING_DASH_MIN_DAMAGE + 1));
        const stagger = Math.floor(STAGGERING_DASH_MIN_STAGGER + Math.random() * (STAGGERING_DASH_MAX_STAGGER - STAGGERING_DASH_MIN_STAGGER + 1));
        combatSystem.queueDamage(target.entity, damage, sourceEntity, 'projectile', sourcePlayerId, false, undefined, stagger);
        lightningTarget = target.position;
      }
    }

    createRoomBoomDashVfx(payload.variant, payload.origin, payload.destination, lightningTarget, payload.key);
    broadcastPlayerAbility('room_boom_dash', payload.destination, payload.direction, undefined, {
      variant: payload.variant,
      key: payload.key,
      origin: { x: payload.origin.x, y: payload.origin.y, z: payload.origin.z },
      destination: { x: payload.destination.x, y: payload.destination.y, z: payload.destination.z },
      lightningTarget: lightningTarget ? { x: lightningTarget.x, y: lightningTarget.y, z: lightningTarget.z } : undefined,
    });
  }, [
    applyStatusEffect,
    broadcastPlayerAbility,
    broadcastPlayerHealing,
    createRoomBoomDashVfx,
    socket?.id,
    updatePlayerHealth,
  ]);

  const handleRoomBoomDashRef = useRef(handleRoomBoomDash);
  useEffect(() => {
    handleRoomBoomDashRef.current = handleRoomBoomDash;
  }, [handleRoomBoomDash]);



  // Function to create haunted soul effect (for WraithStrike)
  const createPvpHauntedSoulEffect = useCallback(
    (position: Vector3, wrathfulStrike?: boolean, infestedStrike?: boolean) => {
      const hauntedSoulEffect = {
        id: nextHauntedSoulEffectId.current++,
        position: position.clone(),
        startTime: Date.now(),
        wrathfulStrike: !!wrathfulStrike,
        infestedStrike: !!infestedStrike,
      };

      pvpAbilityLayerRef.current?.addHauntedSoul(hauntedSoulEffect);
    },
    [],
  );

  useEffect(() => {
    return subscribeEnemyDamage((event) => {
      if (event.damageType !== 'prime_materia' || !event.position || !(event.damage > 0)) return;
      const pos = new Vector3(
        event.position.x,
        Math.max(1.5, event.position.y),
        event.position.z,
      );
      window.audioSystem?.playAlchemySound(pos);
      createPvpHauntedSoulEffect(pos);
    });
  }, [subscribeEnemyDamage, createPvpHauntedSoulEffect]);

  const createBreathWeaponEffect = useCallback((
    position: Vector3,
    direction: Vector3,
    paletteMeta?: {
      wrathfulStrike?: boolean;
      infestedStrike?: boolean;
      wraithGuard?: boolean;
      staggeringStrike?: boolean;
    },
  ) => {
    const origin = position.clone();

    pvpAbilityLayerRef.current?.addBreathWeapon({
      id: `breath-weapon-${Date.now()}-${Math.random()}`,
      position: origin,
      direction: direction.clone(),
      startTime: Date.now(),
      wrathfulStrike: paletteMeta?.wrathfulStrike,
      infestedStrike: paletteMeta?.infestedStrike,
      wraithGuard: paletteMeta?.wraithGuard,
      staggeringStrike: paletteMeta?.staggeringStrike,
    });
  }, []);

  const createPvpVenomEffect = useCallback((playerId: string, position: Vector3, casterId?: string) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // SAFETY CHECK: Don't create venom effects on the local player
    if (isLocalPlayer) {
      return;
    }
    
    const venomEffect = {
      id: nextVenomEffectId.current++,
      playerId,
      position: position.clone(),
      startTime: Date.now(),
      duration: 6000 // 6 seconds venom duration
    };
    
    pvpVenomEffectsRef.current.push(venomEffect);
    
    // Apply DoT damage over time
    const venomDamagePerSecond = 17;
    const tickInterval = 1000; // 1 second per tick
    let tickCount = 0;
    const maxTicks = 6; // 6 seconds total
    
    const venomInterval = setInterval(() => {
      tickCount++;
      if (tickCount > maxTicks) {
        clearInterval(venomInterval);
        pvpVenomIntervalsRef.current.delete(venomEffect.id);
        return;
      }
      
      // Apply venom damage
      if (broadcastPlayerDamage) {
        broadcastPlayerDamage(playerId, venomDamagePerSecond, 'cobra_shot');
      }

      // Create local damage numbers for the caster to see their venom DoT
      if (casterId === socket?.id) {
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        if (damageNumberManager && damageNumberManager.addDamageNumber) {
          const targetPlayer = players.get(playerId);
          if (targetPlayer) {
            const damagePosition = new Vector3(
              targetPlayer.position.x,
              targetPlayer.position.y + 1.5,
              targetPlayer.position.z
            );
            damageNumberManager.addDamageNumber(
              venomDamagePerSecond,
              false, // Not critical
              damagePosition,
              'cobra_shot' // Green color for venom DoT damage
            );
          }
        }
      }
    }, tickInterval);
    pvpVenomIntervalsRef.current.set(venomEffect.id, venomInterval);
    
    // Clean up venom effect after duration using batched updates
    const venomCleanupTimeout = setTimeout(() => {
      clearInterval(venomInterval);
      pvpVenomIntervalsRef.current.delete(venomEffect.id);
      pvpVenomTimeoutsRef.current.delete(venomEffect.id);
      pvpVenomEffectsRef.current = pvpVenomEffectsRef.current.filter(
        e => e.id !== venomEffect.id,
      );
    }, venomEffect.duration);
    pvpVenomTimeoutsRef.current.set(venomEffect.id, venomCleanupTimeout);
  }, [socket?.id, broadcastPlayerDamage]);

  // Function to handle player respawn after death timer
  const handlePlayerRespawn = useCallback((respawnPlayerId: string) => {
    if (!socket || respawnPlayerId !== socket.id) return;

    // Check if there are any other alive players in the room
    // Respawn is only allowed if at least one other player is alive
    const alivePlayers = Array.from(players.values()).filter(player => 
      player.id !== respawnPlayerId && player.health > 0
    );

    if (alivePlayers.length === 0) {
      console.log(`⚠️ Cannot respawn player ${respawnPlayerId} - no other alive players in the room`);
      // Keep the death effect active but don't respawn
      return;
    }

    console.log(`🔄 Respawning player ${respawnPlayerId} at map center (${alivePlayers.length} alive players available)`);

    // Clear death state
    setPlayerDeathStates(prev => {
      const newState = new Map(prev);
      newState.delete(respawnPlayerId);
      return newState;
    });

    // Clear death effect
    environmentVfxLayerRef.current?.removeDeathEffect(respawnPlayerId);

    // Revive the player entity
    if (playerEntityRef.current !== null && engineRef.current) {
      const world = engineRef.current.getWorld();
      const playerEntity = world.getEntity(playerEntityRef.current);
      if (playerEntity) {
        const health = playerEntity.getComponent(Health);
        const transform = playerEntity.getComponent(Transform);
        
        if (health && transform) {
          // Revive with full health
          health.revive();
          
          // Teleport back to south-edge spawn point
          transform.setPosition(0, 0.5, COOP_MAIN_DEFAULT_SPAWN_Z);

          const movement = playerEntity.getComponent(Movement);
          if (movement) {
            movement.canMove = true;
          }
          realTimePlayerPositionRef.current.set(0, 0.5, COOP_MAIN_DEFAULT_SPAWN_Z);
          
          console.log(`✅ Player respawned at main entry: (0, 0.5, ${COOP_MAIN_DEFAULT_SPAWN_Z}) with ${health.currentHealth}/${health.maxHealth} HP`);
        }
      }
    }

    // Re-enable control system
    if (controlSystemRef.current) {
      controlSystemRef.current.setPlayerDead(false);
    }

    // Re-enable camera rotation
    if (cameraSystemRef.current && socket.id) {
      cameraSystemRef.current.setDeathCameraDisabled(false, socket.id);
    }

    // Notify server of respawn
    if (socket && currentRoomId) {
      const world = engineRef.current?.getWorld();
      const playerEntity = world?.getEntity(playerEntityRef.current!);
      const health = playerEntity?.getComponent(Health);
      
      socket.emit('player-respawn', {
        roomId: currentRoomId,
        playerId: respawnPlayerId,
        position: { x: 0, y: 0.5, z: 0 },
        health: health?.currentHealth || health?.maxHealth,
        maxHealth: health?.maxHealth
      });
    }

    onLocalPlayerRevived?.();
  }, [socket, currentRoomId, playerEntityRef, engineRef, controlSystemRef, cameraSystemRef, players, onLocalPlayerRevived]);

  // Function to handle player death in PVP
  const handlePlayerDeath = useCallback((deadPlayerId: string, killerId: string | undefined) => {
    console.log(`💀 handlePlayerDeath called for player ${deadPlayerId}, killed by ${killerId || 'unknown'}`);
    
    // Get the death position - for local player use ECS position, for remote players use players Map
    let deathPosition: Vector3;
    
    if (deadPlayerId === socket?.id) {
      // Local player - use accurate ECS position
      const world = engineRef.current?.getWorld();
      const localPlayerEntity = world?.getEntity(playerEntityRef.current!);
      const transform = localPlayerEntity?.getComponent(Transform);
      
      if (transform && transform.position) {
        deathPosition = transform.position.clone();
        console.log(`💀 Local player death - using ECS position: (${deathPosition.x.toFixed(2)}, ${deathPosition.y.toFixed(2)}, ${deathPosition.z.toFixed(2)})`);
      } else {
        // Fallback to players Map if transform not available
        const player = players.get(deadPlayerId);
        deathPosition = player ? new Vector3(player.position.x, player.position.y, player.position.z) : new Vector3(0, 0.5, COOP_MAIN_DEFAULT_SPAWN_Z);
        console.log(`💀 Local player death - fallback to players Map: (${deathPosition.x.toFixed(2)}, ${deathPosition.y.toFixed(2)}, ${deathPosition.z.toFixed(2)})`);
      }
    } else {
      // Remote player - use players Map position
      const player = players.get(deadPlayerId);
      deathPosition = player ? new Vector3(player.position.x, player.position.y, player.position.z) : new Vector3(0, 0.5, COOP_MAIN_DEFAULT_SPAWN_Z);
      console.log(`💀 Remote player ${deadPlayerId} death - using players Map: (${deathPosition.x.toFixed(2)}, ${deathPosition.y.toFixed(2)}, ${deathPosition.z.toFixed(2)})`);
    }
    
    // Mark player as dead
    setPlayerDeathStates(prev => {
      const newState = new Map(prev);
      newState.set(deadPlayerId, {
        isDead: true,
        deathTime: Date.now(),
        killerId,
        deathPosition: deathPosition.clone()
      });
      return newState;
    });

    // Start death effect locally with accurate position
    console.log(`💀 Creating death effect for player ${deadPlayerId} at position (${deathPosition.x.toFixed(2)}, ${deathPosition.y.toFixed(2)}, ${deathPosition.z.toFixed(2)})`);
    
    environmentVfxLayerRef.current?.setDeathEffect(deadPlayerId, {
      playerId: deadPlayerId,
      position: deathPosition.clone(),
      startTime: Date.now(),
    });

    // Broadcast death effect to other players
    broadcastPlayerDeathEffect(deadPlayerId, deathPosition, true);

    // Set death state in ControlSystem to prevent movement and abilities
    if (deadPlayerId === socket?.id && controlSystemRef.current) {
      console.log(`💀 Setting player dead state in ControlSystem for ${deadPlayerId}`);
      controlSystemRef.current.setPlayerDead(true);
      stopJudgmentCorruptionSound();

      // Play death sound effect
      if (engineRef.current) {
        const world = engineRef.current.getWorld();
        const audioSystem = world.getSystem(AudioSystem);
        if (audioSystem) {
          audioSystem.playDefeatSound();
        }
      }

      onLocalPlayerDefeated?.();
      // Also disable camera rotation during death
      if (cameraSystemRef.current) {
        cameraSystemRef.current.setDeathCameraDisabled(true, socket.id);
      }

      // Also set the Health component's isDead flag and make player invulnerable
      if (playerEntityRef.current !== null && engineRef.current) {
        const world = engineRef.current.getWorld();
        const playerEntity = world.getEntity(playerEntityRef.current);
        if (playerEntity) {
          const health = playerEntity.getComponent(Health);
          const transform = playerEntity.getComponent(Transform);
          const movement = playerEntity.getComponent(Movement);
          if (health) {
            health.isDead = true; // Ensure Health component knows player is dead
            health.setInvulnerable(31.0); // Make invulnerable for 31 seconds (1 second longer than respawn)
          }
          if (transform) {
            transform.setPosition(deathPosition.x, deathPosition.y, deathPosition.z);
          }
          if (movement) {
            movement.haltLocomotion();
            movement.canMove = false;
          }
          realTimePlayerPositionRef.current.copy(deathPosition);
        }
      }

      // Note: Respawn is triggered by DeathEffect onComplete callback after 30 seconds
    } else {
      console.log(`💀 Skipped death state setup for ${deadPlayerId} (not local player or no control system)`);
    }

    // Note: Experience rewards for kills are handled in handlePlayerDamaged
    // This function only handles the death of the local player

  }, [socket, players, playerEntityRef, engineRef, controlSystemRef, cameraSystemRef, broadcastPlayerDeathEffect, handlePlayerRespawn, onLocalPlayerDefeated, stopJudgmentCorruptionSound]);


  // Function to handle wave completion (legacy multiplayer mode - wave experience removed)
  const handleWaveComplete = useCallback(() => {
    // Wave experience has been removed - no EXP is awarded for wave completions
  }, []);

  // Function to handle PVP wave completion (wave experience removed)
  const handlePvpWaveComplete = useCallback((eventData: any) => {
    const { winnerPlayerId, defeatedPlayerId, isLocalPlayerWinner, waveId } = eventData;

    // Award 10 essence when any enemy player's wave is defeated (even if we didn't win)
    if (defeatedPlayerId && defeatedPlayerId !== socket?.id) {
      updatePlayerEssence(socket?.id!, 10);
    }

    if (isLocalPlayerWinner) {
      // Local player won - no experience awarded (wave experience system removed)
    } else {
      // Opponent won - no experience for local player
    }
  }, [socket, updatePlayerEssence]);

  // Listen for wave completion events from server
  useEffect(() => {
    const handleWaveCompletedEvent = (event: CustomEvent) => {
      handleWaveComplete();
    };

    const handlePvpWaveCompletedEvent = (event: CustomEvent) => {
      handlePvpWaveComplete(event.detail);
    };

    // Listen for both legacy multiplayer and PVP wave completion events
    window.addEventListener('wave-completed', handleWaveCompletedEvent as EventListener);
    window.addEventListener('pvp-wave-completed', handlePvpWaveCompletedEvent as EventListener);

    return () => {
      window.removeEventListener('wave-completed', handleWaveCompletedEvent as EventListener);
      window.removeEventListener('pvp-wave-completed', handlePvpWaveCompletedEvent as EventListener);
    };
  }, [handleWaveComplete, handlePvpWaveComplete]);

  // Relay Raise Dead and Meteor Strike active boon ability events to the server
  useEffect(() => {
    if (!socket || !currentRoomId) return;

    const handleRaiseDeadAbility = (event: CustomEvent<{ position: { x: number; y: number; z: number } }>) => {
      socket.emit('raise-dead-ability', {
        roomId: currentRoomId,
        position: event.detail.position,
        playerId: socket.id,
      });
    };

    const handleMeteorStrikeAbility = (event: CustomEvent<{ position: { x: number; y: number; z: number } }>) => {
      socket.emit('meteor-strike-ability', {
        roomId: currentRoomId,
        position: event.detail.position,
        playerId: socket.id,
      });
    };

    window.addEventListener('raise-dead-ability', handleRaiseDeadAbility as EventListener);
    window.addEventListener('meteor-strike-ability', handleMeteorStrikeAbility as EventListener);

    return () => {
      window.removeEventListener('raise-dead-ability', handleRaiseDeadAbility as EventListener);
      window.removeEventListener('meteor-strike-ability', handleMeteorStrikeAbility as EventListener);
    };
  }, [socket, currentRoomId]);

  // Notify parent component of experience updates
  React.useEffect(() => {
    if (onExperienceUpdate) {
      onExperienceUpdate(playerExperience, playerLevel);
    }
  }, [playerExperience, playerLevel, onExperienceUpdate]);

  // Update runes when level or primary weapon changes
  React.useEffect(() => {
    const primaryWeapon = selectedWeapons?.primary ?? WeaponType.NONE;
    const runeCount = getRuneCountForWeapon(primaryWeapon, playerLevel);
    setGlobalCriticalRuneCount(runeCount);
    setGlobalCritDamageRuneCount(runeCount);
  }, [playerLevel, selectedWeapons?.primary]);

  // Sync stat data ref and apply stat-driven effects whenever statPointData changes
  React.useEffect(() => {
    playerStatDataRef.current = statPointData;

    if (!statPointData) return;

    setGlobalAgilityStatPoints(dreamLayerCombatStats.agility);

    const spellbladeActive = shouldApplySpellbladeTalent(talentLoadout, abilityLoadout ?? null);
    const parryActive = shouldApplyParryTalent(talentLoadout, abilityLoadout ?? null);
    let statsForShield = { ...dreamLayerCombatStats };
    if (spellbladeActive) {
      statsForShield = { ...statsForShield, intellect: statsForShield.intellect + SPELLBLADE_INTELLECT_BONUS };
    }
    if (parryActive) {
      statsForShield = {
        ...statsForShield,
        intellect: statsForShield.intellect + PARRY_INTELLECT_BONUS,
        strength: statsForShield.strength + PARRY_STRENGTH_BONUS,
      };
    }
    setGlobalStrengthStatPoints(statsForShield.strength);
    const newMaxShield = StatSystem.getMaxShieldFromStats(statsForShield);

    const prevStamina = prevEffectiveStaminaRef.current;
    const staminaDelta = dreamLayerCombatStats.stamina - prevStamina;
    prevEffectiveStaminaRef.current = dreamLayerCombatStats.stamina;

    const playerEntity = engineRef.current?.getWorld().getEntity(playerEntityRef.current ?? -1);
    if (playerEntity) {
      const health = playerEntity.getComponent(Health);
      if (health) {
        const baseMaxHealth = ExperienceSystem.getMaxHealthForLevel(playerLevel);
        const staminaBonus = StatSystem.getBonusMaxHealth(dreamLayerCombatStats);
        const newMaxHealth = baseMaxHealth + staminaBonus;
        if (health.maxHealth !== newMaxHealth) {
          health.maxHealth = newMaxHealth;
          health.currentHealth = Math.min(health.currentHealth, newMaxHealth);
        }
        // Heal the player by 10 HP per stamina point gained
        if (staminaDelta > 0) {
          health.currentHealth = Math.min(
            health.currentHealth + staminaDelta * StatSystem.STAMINA_HEALTH_PER_POINT,
            health.maxHealth,
          );
        }
      }

      const shieldComp = playerEntity.getComponent(Shield);
      if (shieldComp && shieldComp.maxShield !== newMaxShield) {
        const gained = newMaxShield - shieldComp.maxShield;
        shieldComp.maxShield = newMaxShield;
        shieldComp.currentShield = Math.min(newMaxShield, shieldComp.currentShield + gained);
      }
    }
  }, [statPointData, playerLevel, talentLoadout, abilityLoadout, dreamLayerCombatStats]);

  useEffect(() => {
    if (!controlSystemRef.current) return;
    controlSystemRef.current.setOwnedDreamLayerItems(
      ownedItemTypes,
      exodiaSetCount,
      dreamLayerCombatStats,
      exodiaSetBonuses.maxEnergy,
    );
  }, [ownedItemTypes, exodiaSetCount, dreamLayerCombatStats, exodiaSetBonuses.maxEnergy, engineReady]);

  useEffect(() => {
    setJaguarEmeraldOwnedGlobal(hasOwnedItem(ownedItemTypes, JAGUAR_EMERALD));
  }, [ownedItemTypes]);

  // Hexmetal Cloak / Leggings / 2pc walk — sync onto local player Health + Movement
  useEffect(() => {
    if (!engineReady || playerEntityRef.current === null) return;
    const world = engineRef.current?.getWorld();
    const ent = world?.getEntity(playerEntityRef.current);
    if (!ent) return;
    const health = ent.getComponent(Health);
    const movement = ent.getComponent(Movement);
    if (health) {
      health.incomingDamageCap = hasOwnedItem(ownedItemTypes, HEXMETAL_CLOAK)
        ? HEXMETAL_DAMAGE_CAP
        : null;
    }
    if (movement) {
      movement.attackSlowMultiplier = hasOwnedItem(ownedItemTypes, HEXMETAL_LEGGINGS)
        ? HEXMETAL_ATTACK_SLOW_MULT
        : 0.5;
      movement.hexmetalWalkSpeedActive = hexmetalSetCount >= 2;
    }
  }, [ownedItemTypes, hexmetalSetCount, engineReady]);

  const applyPlayerMaxDashCharges = useCallback(() => {
    if (!engineReady || playerEntityRef.current === null) return;
    const world = engineRef.current?.getWorld();
    const ent = world?.getEntity(playerEntityRef.current);
    const movement = ent?.getComponent(Movement);
    if (!movement) return;
    const weapon =
      controlSystemRef.current?.getCurrentWeapon?.() ??
      selectedWeapons?.primary ??
      WeaponType.NONE;
    const aspect = selectedWeaponAspectRef.current;
    const hexmetalBonus =
      hexmetalSetCount >= 3 ? HEXMETAL_SET_3_BONUS_DASH_CHARGES : 0;
    const target = resolveMaxDashCharges(
      weapon,
      aspect,
      extraDashChargePurchased,
      hexmetalBonus,
    );
    if (movement.maxDashCharges !== target) {
      movement.setMaxDashCharges(target);
    }
  }, [engineReady, extraDashChargePurchased, selectedWeapons?.primary, hexmetalSetCount]);

  useEffect(() => {
    applyPlayerMaxDashCharges();
  }, [applyPlayerMaxDashCharges, selectedWeaponAspect, engineReady]);

  useEffect(() => {
    if (!engineReady || playerEntityRef.current === null) return;
    const world = engineRef.current?.getWorld();
    const ent = world?.getEntity(playerEntityRef.current);
    const energy = ent?.getComponent(Energy);
    const movement = ent?.getComponent(Movement);
    const oxygenPurchases = merchantPurchaseState.oxygenPurchases;
    const warpdrivePurchases = merchantPurchaseState.warpdrivePurchases;

    if (energy) {
      const newMaxEnergy =
        getOxygenMaxEnergy(oxygenPurchases) +
        exodiaSetBonuses.maxEnergy +
        getFireAffinityMaxEnergyBonus(selectedWeaponAspect) +
        getExploreLowHungerMaxEnergyBonus(playerHunger, isExplore);
      const baseRegen = 40;
      energy.regenRate = hasOwnedItem(ownedItemTypes, INFINITE_AMBER)
        ? baseRegen * INFINITE_AMBER_ENERGY_REGEN_MULT
        : baseRegen;
      if (energy.maxEnergy !== newMaxEnergy) {
        const nextCurrent = newMaxEnergy > energy.maxEnergy
          ? energy.currentEnergy + (newMaxEnergy - energy.maxEnergy)
          : Math.min(energy.currentEnergy, newMaxEnergy);
        energy.setEnergy(nextCurrent, newMaxEnergy);
        updatePlayerEnergy(socket?.id || '', energy.currentEnergy, energy.maxEnergy);
      }
    }

    if (movement) {
      movement.setWarpdrivePurchases(warpdrivePurchases, selectedWeaponAspect);
    }
  }, [
    merchantPurchaseState.oxygenPurchases,
    merchantPurchaseState.warpdrivePurchases,
    selectedWeaponAspect,
    exodiaSetBonuses.maxEnergy,
    ownedItemTypes,
    engineReady,
    socket?.id,
    updatePlayerEnergy,
    playerHunger,
    isExplore,
  ]);

  useEffect(() => {
    if (!engineReady || playerEntityRef.current === null) return;
    const world = engineRef.current?.getWorld();
    const ent = world?.getEntity(playerEntityRef.current);
    const movement = ent?.getComponent(Movement);
    if (movement) {
      movement.setDashChargeRechargeRateMultiplier(getDashChargeRechargeRateMultiplier(talentLoadout));
    }
  }, [talentLoadout, engineReady]);

  const [weaponState, setWeaponState] = useState({
    currentWeapon: WeaponType.NONE,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    isCharging: false,
    chargeProgress: 0,
    chargeDirection: new Vector3(0, 0, -1), // Default forward direction
    isSwinging: false,
    isSpinning: false,
    swordComboStep: 1 as 1 | 2 | 3,
    isSwordCharging: false,
    isDeflecting: false,
    deflectShieldActive: false,
    deflectShieldDurationSec: 3,
    deflectShieldPaletteVariant: 'default' as import('@/utils/aegisShieldPalette').AegisPaletteVariant,
    isBlockingDeflect: false,
    isViperStingCharging: false,
    viperStingChargeProgress: 0,
    isBarrageCharging: false,
    barrageChargeProgress: 0,
    isCobraShotCharging: false,
    cobraShotChargeProgress: 0,
    isRejuvenatingShotCharging: false,
    rejuvenatingShotChargeProgress: 0,
    isSkyfalling: false,
    isBackstabbing: false,
    isSundering: false,
    isCorruptedAuraActive: false,
    isFrozen: false,
    isIcebeaming: false,
    tempestBurstShotSeq: 0,
  });

  // Use a ref to store current weapon state to avoid infinite re-renders
  const weaponStateRef = useRef(weaponState);
  // Independent copy — must not alias weaponStateRef, which is mutated in-place every frame
  const lastCommittedWeaponStateRef = useRef({ ...weaponState });
  const lastWeaponStateUpdate = useRef(0);

  // Update weapon state when selectedWeapons changes
  useEffect(() => {
    if (selectedWeapons) {
      setWeaponState(prev => ({
        ...prev,
        currentWeapon: selectedWeapons.primary,
        currentSubclass: defaultSubclassForThroneWeapon(selectedWeapons.primary),
      }));
    }
  }, [selectedWeapons]);

  // Throttling refs to prevent infinite re-renders in useFrame
  const lastDamageNumbersUpdate = useRef(0);
  const lastImpactEffectsPoll = useRef(0);
  const lastCameraUpdate = useRef(0);
  const lastGameStateUpdate = useRef(0);
  const lastEmittedDamageNumbersRef = useRef<DamageNumberData[] | null>(null);
  const lastEmittedCameraRef = useRef<{ camera: Camera | null; width: number; height: number }>({
    camera: null,
    width: 0,
    height: 0,
  });
  const lastEmittedGameStateRef = useRef<{
    playerHealth: number;
    maxHealth: number;
    playerShield: number;
    maxShield: number;
    playerEnergy: number;
    maxEnergy: number;
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
  } | null>(null);
  const lastEmittedNetworkHealthRef = useRef<{ health: number; maxHealth: number } | null>(null);
  const lastEmittedNetworkShieldRef = useRef<{ shield: number; maxShield: number } | null>(null);
  const lastEmittedNetworkEnergyRef = useRef<{ energy: number; maxEnergy: number } | null>(null);

  // Re-broadcast true HP/shield when the roster changes so late joiners aren't stuck on the join snapshot.
  useEffect(() => {
    lastEmittedNetworkHealthRef.current = null;
    lastEmittedNetworkShieldRef.current = null;
  }, [playerIdsKey]);

  const triggerLocalPlayerDamageFeedback = useCallback(({
    damage,
    damageType = 'physical',
    position,
    shieldOnly = false,
    fatal = false,
    weightClass,
  }: {
    damage: number;
    damageType?: string;
    position?: Vector3;
    shieldOnly?: boolean;
    fatal?: boolean;
    weightClass?: string;
  }) => {
    const intensity = Math.min(1, Math.max(0.18, damage / 85));
    const tone: PlayerDamageFeedbackTone = fatal ? 'fatal' : shieldOnly ? 'shield' : 'health';
    const wc = normalizeMeleeWeightClass(weightClass);
    const weightShake = meleeShakeForWeightClass(wc, intensity);
    const shakeIntensity = shieldOnly
      ? intensity * 0.11
      : 0.08 + weightShake.intensity * 0.22;
    const shakeDuration = fatal
      ? 0.28
      : Math.min(0.32, weightShake.duration + intensity * 0.08);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EREBUS_PLAYER_DAMAGE_FEEDBACK_EVENT, {
        detail: {
          damage,
          damageType,
          tone,
          intensity: shieldOnly ? intensity * 0.55 : intensity,
          durationMs: fatal ? 320 : undefined,
        },
      }));
    }

    cameraSystemRef.current?.addDamageShake(shakeIntensity, shakeDuration);

    if (!shieldOnly) {
      (window as any).audioSystem?.playPlayerHurtSound?.(damage, damageType);
    }

    if (position && damageType !== 'warlock_chaos_orb') {
      const id = `player-hit-${nextPlayerHitBurstId.current++}`;
      combatFeedbackLayerRef.current?.addPlayerHitBurst({
          id,
          position: position.clone(),
          damageType: shieldOnly ? 'shield' : damageType,
          intensity: shieldOnly ? intensity * 0.55 : intensity,
        });
    }
  }, []);

  const getCoopEnemyPositionByServerId = useCallback((serverEnemyId: string): Vector3 | null => {
    const world = engineRef.current?.getWorld();
    if (!world) return null;
    for (const entity of world.getAllEntities()) {
      if (entity.userData?.serverEnemyId !== serverEnemyId) continue;
      const transform = entity.getComponent(Transform);
      if (transform) return transform.position.clone();
    }
    const serverEnemy = enemiesRef.current.get(serverEnemyId);
    if (serverEnemy?.position) {
      return new Vector3(serverEnemy.position.x, serverEnemy.position.y, serverEnemy.position.z);
    }
    return null;
  }, []);

  const spawnRebukeFlameStrikeVfx = useCallback((strikePos: Vector3) => {
    (window as any).audioSystem?.playWarlockImmolateSound(strikePos);
    bossTelegraphLayerRef.current?.addWarlockFlameStrike({ id: `rebuke-flame-${Date.now()}-${Math.random()}`, position: strikePos.clone() });
  }, []);

  const tryHatemailVestOnDamageTaken = useCallback((
    attackerServerEnemyId: string | undefined,
    damageApplied: boolean,
    incomingDamage: number,
  ) => {
    if (!damageApplied || !attackerServerEnemyId || !socket?.id || incomingDamage <= 0) return;
    if (!hasOwnedItem(ownedItemTypes, EXODIA_PLATE)) return;
    if (!coopServerEnemyLiving(attackerServerEnemyId)) return;
    damageEnemy(attackerServerEnemyId, incomingDamage * 3, socket.id, { damageType: 'hatemail' });
  }, [coopServerEnemyLiving, damageEnemy, ownedItemTypes, socket?.id]);

  const tryRebukeOnDamageTaken = useCallback((
    attackerServerEnemyId: string | undefined,
    damageApplied: boolean,
  ) => {
    if (!damageApplied || !attackerServerEnemyId || !socket?.id) return;
    if (!shouldApplyRebukeTalent(talentLoadoutRef.current)) return;
    if (!coopServerEnemyLiving(attackerServerEnemyId)) return;

    const nowSec = Date.now() / 1000;
    if (nowSec - lastRebukeTimeSecRef.current < REBUKE_ICD_SEC) return;
    lastRebukeTimeSecRef.current = nowSec;

    const strikePos = getCoopEnemyPositionByServerId(attackerServerEnemyId);
    if (!strikePos) return;

    spawnRebukeFlameStrikeVfx(strikePos);
    damageEnemy(attackerServerEnemyId, REBUKE_DAMAGE, socket.id, {
      damageType: 'rebuke',
      rebukeRoom: true,
    });
    broadcastPlayerAbility('rebuke', strikePos, undefined, attackerServerEnemyId);
  }, [
    broadcastPlayerAbility,
    coopServerEnemyLiving,
    damageEnemy,
    getCoopEnemyPositionByServerId,
    socket?.id,
    spawnRebukeFlameStrikeVfx,
  ]);

  const tryTyrantsCloakOnDamageTaken = useCallback((
    attackerServerEnemyId: string | undefined,
    damageApplied: boolean,
  ) => {
    if (!damageApplied || !attackerServerEnemyId || !socket?.id) return;
    if (!shouldApplyTyrantsCloakTalent(talentLoadoutRef.current)) return;
    if (!coopServerEnemyLiving(attackerServerEnemyId)) return;

    const nowSec = Date.now() / 1000;
    if (nowSec - lastTyrantsCloakTimeSecRef.current < TYRANTS_CLOAK_ICD_SEC) return;
    lastTyrantsCloakTimeSecRef.current = nowSec;

    triggerTyrantsCloakStrike(attackerServerEnemyId);
  }, [
    coopServerEnemyLiving,
    socket?.id,
    triggerTyrantsCloakStrike,
  ]);

  const tryMomentumRiftOnDamageTaken = useCallback((
    attackerServerEnemyId: string | undefined,
    damageApplied: boolean,
  ) => {
    if (!damageApplied || !attackerServerEnemyId) return;
    if (!shouldApplyMomentumRiftTalent(talentLoadoutRef.current)) return;

    const world = engineRef.current?.getWorld();
    const ent = playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
    const movement = ent?.getComponent(Movement);
    if (!movement) return;

    movement.restoreDashCharge();
  }, [engineRef, playerEntityRef]);

  const tryOrbShieldOnDamageTaken = useCallback((
    attackerServerEnemyId: string | undefined,
    damageApplied: boolean,
  ) => {
    if (!damageApplied || !attackerServerEnemyId) return;
    if (!shouldApplyOrbShieldTalent(talentLoadoutRef.current)) return;

    const nowSec = Date.now() / 1000;
    if (nowSec - lastOrbShieldTimeSecRef.current < ORB_SHIELD_ICD_SEC) return;

    const world = engineRef.current?.getWorld();
    const ent = playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
    const movement = ent?.getComponent(Movement);
    const health = ent?.getComponent(Health);
    const transform = ent?.getComponent(Transform);
    if (!movement || !health || health.isDead) return;
    if (health.currentHealth >= health.maxHealth) return;
    if (movement.getAvailableDashCharges() <= 0) return;

    const stamina = StatSystem.getEffectiveStatsWithInventory(
      playerStatDataRef.current?.stats ?? ZERO_PLAYER_STATS,
      inventorySnapshotRef.current,
    ).stamina;
    const healAmount = ORB_SHIELD_BASE_HEAL + Math.max(0, Math.floor(stamina));
    if (healAmount <= 0) return;

    const consumed = movement.consumeDashChargesWithoutDash(1, nowSec);
    if (consumed === 0) return;
    controlSystemRef.current?.tryManaShieldOnDashChargeExpended(consumed);
    if (!health.heal(healAmount)) return;

    lastOrbShieldTimeSecRef.current = nowSec;

    const position = transform
      ? transform.position.clone().add(new Vector3(0, 1.6, 0))
      : new Vector3(0, 1.6, 0);
    const vfxPosition = transform ? transform.position.clone() : new Vector3();

    updatePlayerHealth(health.currentHealth, health.maxHealth);
    broadcastPlayerHealing(healAmount, 'room_boon_orb_shield', position);

    const id = nextRoomBoomEffectId.current++;
    pvpAbilityLayerRef.current?.addRoomBoomMending({ id, position: vfxPosition });
    (window as any).audioSystem?.playScytheSunwellSound?.(vfxPosition);
  }, [
    broadcastPlayerHealing,
    engineRef,
    playerEntityRef,
    updatePlayerHealth,
  ]);

  const tryBloodOrbDashCost = useCallback(() => {
    const world = engineRef.current?.getWorld();
    const ent = playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
    const health = ent?.getComponent(Health);
    const transform = ent?.getComponent(Transform);
    if (!health || health.isDead) return;
    if (health.currentHealth <= BLOOD_ORBS_DASH_HP_COST) return;

    const damageApplied = health.takeDamage(BLOOD_ORBS_DASH_HP_COST, Date.now() / 1000, ent, false, true);
    if (!damageApplied) return;

    const position = transform
      ? transform.position.clone().add(new Vector3(0, 1.6, 0))
      : new Vector3(0, 1.6, 0);

    updatePlayerHealth(health.currentHealth, health.maxHealth);
    if (socket?.id) {
      broadcastPlayerDamage(socket.id, BLOOD_ORBS_DASH_HP_COST, 'blood_orbs');
    }
    triggerLocalPlayerDamageFeedback({
      damage: BLOOD_ORBS_DASH_HP_COST,
      damageType: 'blood_orbs',
      position,
      fatal: health.isDead,
    });
    onDamageNumbersUpdate?.([{
      id: `room-boon-blood-orbs-${Date.now()}-${Math.random()}`,
      damage: BLOOD_ORBS_DASH_HP_COST,
      position,
      isCritical: false,
      timestamp: Date.now(),
      damageType: 'blood_orbs',
    }]);
  }, [
    broadcastPlayerDamage,
    engineRef,
    onDamageNumbersUpdate,
    playerEntityRef,
    socket?.id,
    triggerLocalPlayerDamageFeedback,
    updatePlayerHealth,
  ]);

  const tryBloodOrbDashCostRef = useRef(tryBloodOrbDashCost);
  useEffect(() => {
    tryBloodOrbDashCostRef.current = tryBloodOrbDashCost;
  }, [tryBloodOrbDashCost]);

  /** FATEBREAKER (duo: green + purple) — heal 2 + STAMINA + INTELLECT on every successful AEGIS block. */
  const tryFatebreakerOnAegisBlock = useCallback(() => {
    if (!shouldApplyFatebreakerTalent(talentLoadoutRef.current)) return;

    const world = engineRef.current?.getWorld();
    const ent = playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
    const health = ent?.getComponent(Health);
    const transform = ent?.getComponent(Transform);
    if (!health || health.isDead) return;

    const stats = StatSystem.getEffectiveStatsWithInventory(
      playerStatDataRef.current?.stats ?? ZERO_PLAYER_STATS,
      inventorySnapshotRef.current,
    );
    const healAmount = 2 + Math.max(0, Math.floor(stats.stamina)) + Math.max(0, Math.floor(stats.intellect));
    if (healAmount <= 0) return;
    if (!health.heal(healAmount)) return;

    const position = transform
      ? transform.position.clone().add(new Vector3(0, 1.6, 0))
      : new Vector3(0, 1.6, 0);

    updatePlayerHealth(health.currentHealth, health.maxHealth);
    broadcastPlayerHealing(healAmount, 'room_boon_fatebreaker', position);
  }, [
    broadcastPlayerHealing,
    engineRef,
    playerEntityRef,
    updatePlayerHealth,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAegisBlock = () => tryFatebreakerOnAegisBlock();
    window.addEventListener('aegis-block', onAegisBlock);
    return () => window.removeEventListener('aegis-block', onAegisBlock);
  }, [tryFatebreakerOnAegisBlock]);

  /**
   * Shift-Deflect — first negated hit: fully restores Energy, plays the smite SFX, and
   * strikes a gold sky beam at the deflected attacker (falling back to the nearest live enemy).
   */
  const tryFireDeflectSmite = useCallback((sourceEnemyId?: string) => {
    const world = engineRef.current?.getWorld();
    const ent = playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
    if (!ent) return;

    const energy = ent.getComponent(Energy);
    energy?.restoreEnergy();

    const liveEnemies = getLiveCoopEnemyData().filter((e) => e.health > 0);
    let targetEnemyId: string | null =
      sourceEnemyId && liveEnemies.some((e) => e.id === sourceEnemyId) ? sourceEnemyId : null;

    if (!targetEnemyId) {
      const transform = ent.getComponent(Transform);
      if (!transform) return;
      const origin = transform.position;
      let bestId: string | null = null;
      let bestDistSq = Infinity;
      for (const e of liveEnemies) {
        const distSq = e.position.distanceToSquared(origin);
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestId = e.id;
        }
      }
      targetEnemyId = bestId;
    }

    const targetEnemy = targetEnemyId ? liveEnemies.find((e) => e.id === targetEnemyId) : undefined;
    if (!targetEnemy) return;

    const strikePosition = targetEnemy.position.clone();
    const stats = StatSystem.getEffectiveStatsWithInventory(statPointData?.stats ?? ZERO_PLAYER_STATS, inventory);
    const damage = computeDeflectSmiteDamage(stats);

    window.audioSystem?.playColossusStrikeSound?.(strikePosition);

    window.dispatchEvent(
      new CustomEvent('shift-energy-halo-pulse', {
        detail: { durationMs: SHIFT_ENERGY_HALO_PULSE_MS.DEFLECT_SMITE },
      }),
    );

    const baseCleanupMs = 1200;
    const deflectSmiteEffect: DeflectSmiteEffectState = {
      id: nextDeflectSmiteEffectId.current++,
      playerId: socket?.id ?? 'local',
      position: strikePosition,
      damage,
      startTime: Date.now(),
      duration: baseCleanupMs,
    };
    pvpAbilityLayerRef.current?.addDeflectSmite(deflectSmiteEffect);

    setTimeout(() => {
      pvpAbilityLayerRef.current?.removeDeflectSmite(deflectSmiteEffect.id);
    }, deflectSmiteEffect.duration);

    if (socket && currentRoomId) {
      broadcastPlayerAbility('deflectSmite', strikePosition, undefined, targetEnemyId ?? undefined, { damage });
    }
  }, [broadcastPlayerAbility, currentRoomId, getLiveCoopEnemyData, inventory, socket, statPointData?.stats]);

  const findNearestLocustTarget = useCallback((origin: Vector3): string | null => {
    const liveEnemies = getLiveCoopEnemyData().filter((e) => e.health > 0);
    let bestId: string | null = null;
    let bestDistSq = Infinity;
    const radiusSq = LOCUST_TARGET_RADIUS * LOCUST_TARGET_RADIUS;
    for (const enemy of liveEnemies) {
      const distSq = enemy.position.distanceToSquared(origin);
      if (distSq > radiusSq || distSq >= bestDistSq) continue;
      bestDistSq = distSq;
      bestId = enemy.id;
    }
    return bestId;
  }, [getLiveCoopEnemyData]);

  const spawnLocustProjectile = useCallback((payload: {
    startPosition: Vector3;
    spreadIndex: number;
    volleyId: number;
    forward: Vector3;
    damage: number;
  }) => {
    const targetEnemyId = findNearestLocustTarget(payload.startPosition);
    const liveEnemies = getLiveCoopEnemyData().filter((e) => e.health > 0);
    const targetEnemy = targetEnemyId ? liveEnemies.find((e) => e.id === targetEnemyId) : undefined;
    const fallbackTargetPosition = targetEnemy
      ? targetEnemy.position.clone()
      : payload.startPosition.clone().add(payload.forward.clone().multiplyScalar(2.5));

    const locustEffect: LocustProjectileEffectState = {
      id: nextLocustEffectId.current++,
      playerId: socket?.id ?? 'local',
      startPosition: payload.startPosition,
      initialDirection: payload.forward.clone(),
      spreadIndex: payload.spreadIndex,
      volleyId: payload.volleyId,
      targetEnemyId,
      fallbackTargetPosition,
      damage: payload.damage,
    };
    pvpAbilityLayerRef.current?.addLocustProjectile(locustEffect);
    window.audioSystem?.playLocustSound?.();

    if (socket && currentRoomId) {
      broadcastPlayerAbility('locustMissile', payload.startPosition, payload.forward, targetEnemyId ?? undefined, {
        spreadIndex: payload.spreadIndex,
        volleyId: payload.volleyId,
        damage: payload.damage,
      });
    }
  }, [broadcastPlayerAbility, currentRoomId, findNearestLocustTarget, getLiveCoopEnemyData, socket]);

  const spawnLocustProjectileRef = useRef(spawnLocustProjectile);
  useEffect(() => {
    spawnLocustProjectileRef.current = spawnLocustProjectile;
  }, [spawnLocustProjectile]);

  const detonateIncineration = useCallback((payload: IncinerationDetonatePayload) => {
    incinerationBeamManagerRef.current?.detonate(payload);
    window.dispatchEvent(
      new CustomEvent('shift-energy-halo-pulse', {
        detail: { durationMs: SHIFT_ENERGY_HALO_PULSE_MS.INCINERATION_BEAM },
      }),
    );
    if (socket && currentRoomId) {
      socket.emit('incineration-beam', {
        roomId: currentRoomId,
        origin: payload.origin,
        direction: payload.direction,
        charge: payload.charge,
        isPlasma: payload.isPlasma ?? false,
        shieldDrained: payload.shieldDrained ?? 0,
      });
    }
  }, [currentRoomId, socket]);

  const detonateIncinerationRef = useRef(detonateIncineration);
  useEffect(() => {
    detonateIncinerationRef.current = detonateIncineration;
  }, [detonateIncineration]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onDeflectNegated = (e: Event) => {
      const detail = (e as CustomEvent).detail as { sourceEnemyId?: string } | undefined;
      tryFireDeflectSmite(detail?.sourceEnemyId);
    };
    window.addEventListener('deflect-negated', onDeflectNegated);
    return () => window.removeEventListener('deflect-negated', onDeflectNegated);
  }, [tryFireDeflectSmite]);

  /** DIVINE COLD (ultimate: purple) — Aegis invuln proc spawns arctic blizzard on enemy in front. */
  const tryDivineColdOnAegisInvulnGranted = useCallback(() => {
    if (!shouldApplyDivineColdTalent(talentLoadoutRef.current)) return;
    if (!socket || !currentRoomId) return;

    const now = Date.now();
    if (now - lastDivineColdProcAtRef.current < DIVINE_COLD_BLIZZARD_ICD_MS) return;

    const world = engineRef.current?.getWorld();
    const ent = playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
    const transform = ent?.getComponent(Transform);
    if (!world || !transform) return;

    const forward = new Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return;
    forward.normalize();

    const origin = transform.position.clone();
    const cosThreshold = Math.cos((DIVINE_COLD_FORWARD_CONE_HALF_ANGLE_DEG * Math.PI) / 180);
    const maxRangeSq = DIVINE_COLD_FORWARD_RANGE * DIVINE_COLD_FORWARD_RANGE;
    let best: { position: Vector3; distSq: number } | null = null;

    for (const entity of world.queryEntities([Enemy, Transform, Health])) {
      const enemy = entity.getComponent(Enemy);
      const enemyTransform = entity.getComponent(Transform);
      const health = entity.getComponent(Health);
      if (!enemy || !enemyTransform || !health || health.isDead || enemy.isDead) continue;
      if (isCoopPlayerAllyEntity(entity)) continue;

      const toEnemy = new Vector3(
        enemyTransform.position.x - origin.x,
        0,
        enemyTransform.position.z - origin.z,
      );
      const distSq = toEnemy.lengthSq();
      if (distSq <= 0 || distSq > maxRangeSq) continue;
      toEnemy.normalize();
      if (forward.dot(toEnemy) < cosThreshold) continue;
      if (!best || distSq < best.distSq) {
        best = { position: enemyTransform.position.clone(), distSq };
      }
    }

    if (!best) return;

    lastDivineColdProcAtRef.current = now;
    socket.emit('divine-cold-proc', {
      roomId: currentRoomId,
      targetPosition: {
        x: best.position.x,
        y: best.position.y,
        z: best.position.z,
      },
      direction: { x: forward.x, y: 0, z: forward.z },
    });
  }, [camera, currentRoomId, engineRef, playerEntityRef, socket]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAegisInvulnGranted = () => tryDivineColdOnAegisInvulnGranted();
    window.addEventListener('aegis-invuln-granted', onAegisInvulnGranted);
    return () => window.removeEventListener('aegis-invuln-granted', onAegisInvulnGranted);
  }, [tryDivineColdOnAegisInvulnGranted]);

  const triggerAppliedLocalPlayerDamageFeedback = useCallback(({
    damage,
    damageType = 'physical',
    damageApplied,
    health,
    healthBefore,
    shield,
    shieldBefore,
    position,
    attackerServerEnemyId,
    weightClass,
    hitStopMs,
    impactDirection,
  }: {
    damage: number;
    damageType?: string;
    damageApplied: boolean;
    health: Health;
    healthBefore: number;
    shield?: Shield | null;
    shieldBefore?: number;
    position?: Vector3;
    attackerServerEnemyId?: string;
    weightClass?: string;
    hitStopMs?: number;
    impactDirection?: { x?: number; y?: number; z?: number };
  }) => {
    if (!damageApplied) return;

    if (attackerServerEnemyId) {
      window.audioSystem?.playDamageBreathSound?.();
    }

    const shieldAfter = shield?.currentShield ?? 0;
    const shieldOnly =
      health.currentHealth >= healthBefore &&
      shieldBefore !== undefined &&
      shieldBefore > shieldAfter;

    triggerLocalPlayerDamageFeedback({
      damage,
      damageType,
      position,
      shieldOnly,
      fatal: health.isDead,
      weightClass,
    });

    dispatchMeleeHitStop(attackerServerEnemyId, hitStopMs);

    // Subtle contact-point gash on the side the blow came from
    if (position && impactDirection) {
      const dir = meleeImpactDirection({ impactDirection });
      const wc = normalizeMeleeWeightClass(weightClass);
      combatFeedbackLayerRef.current?.addImpacts?.([
        {
          id: `melee-gash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type: 'melee-contact-gash',
          position: position.clone(),
          direction: dir,
          weightClass: wc,
          timestamp: Date.now(),
        },
      ]);
      // Hit reactions should appear this frame — bypass the 100ms mount throttle.
      if (combatFeedbackLayerRef.current?.flushPendingImpacts?.()) {
        combatFeedbackLayerRef.current.mountImpactsNow?.();
      }
    }

    tryRebukeOnDamageTaken(attackerServerEnemyId, damageApplied);
    tryHatemailVestOnDamageTaken(attackerServerEnemyId, damageApplied, damage);
    tryTyrantsCloakOnDamageTaken(attackerServerEnemyId, damageApplied);
    tryOrbShieldOnDamageTaken(attackerServerEnemyId, damageApplied);
    tryMomentumRiftOnDamageTaken(attackerServerEnemyId, damageApplied);
  }, [triggerLocalPlayerDamageFeedback, tryRebukeOnDamageTaken, tryHatemailVestOnDamageTaken, tryTyrantsCloakOnDamageTaken, tryOrbShieldOnDamageTaken, tryMomentumRiftOnDamageTaken]);

  const getLocalPlayerPosition = useCallback((): Vector3 | null => {
    if (!playerEntity) return null;
    const t = playerEntity.getComponent(Transform);
    return t ? t.position.clone() : null;
  }, [playerEntity]);

  /** Floating "MISS" above the local player when an enemy swing/shot fails to connect. */
  const showLocalPlayerMissNumber = useCallback(() => {
    const id = playerEntityRef.current;
    if (id == null || !engineRef.current) return;
    const entity = engineRef.current.getWorld().getEntity(id);
    if (!entity) return;
    const transform = entity.getComponent(Transform);
    const damageNumberManager = engineRef.current.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
    if (!transform || !damageNumberManager?.addDamageNumber) return;
    const pos = transform.position.clone();
    pos.y -= 0.5;
    showIncomingAttackMissNumber(damageNumberManager, pos);
  }, []);

  const spawnDreamShardFromDeath = useCallback((
    deathPos: { x: number; y: number; z: number },
    enemyId: string,
    timestamp?: number,
    enemyType?: string,
  ) => {
    const enemy = enemyType ? null : enemiesRef.current.get(enemyId);
    const resolvedType = enemyType ?? enemy?.type;
    const sleepwalker = hasOwnedItem(ownedItemTypes, EXODIA_GREAVES);
    const shardCount = getDreamShardCountForEnemyType(resolvedType, sleepwalker);
    if (shardCount <= 0) return;

    const playerPos = realTimePlayerPositionRef.current;
    const start = new Vector3(deathPos.x, deathPos.y + 0.85, deathPos.z);
    const baseBurstDir = new Vector3(start.x - playerPos.x, 0, start.z - playerPos.z);
    if (baseBurstDir.lengthSq() < 0.04) {
      const angle = Math.random() * Math.PI * 2;
      baseBurstDir.set(Math.cos(angle), 0, Math.sin(angle));
    }
    baseBurstDir.normalize();

    const yAxis = new Vector3(0, 1, 0);
    for (let i = 0; i < shardCount; i++) {
      const angle = shardCount === 1
        ? (Math.random() - 0.5) * 0.6
        : (i / shardCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const burstDir = baseBurstDir.clone().applyAxisAngle(yAxis, angle);
      burstDir.y = 0.4;
      burstDir.normalize();

      const offset = shardCount > 1
        ? new Vector3(
            Math.cos(angle) * 0.25,
            (Math.random() - 0.5) * 0.15,
            Math.sin(angle) * 0.25,
          )
        : new Vector3();

      environmentVfxLayerRef.current?.addDreamShard({
        id: `dream-shard-${enemyId}-${timestamp ?? Date.now()}-${i}`,
        startPosition: start.clone().add(offset),
        initialDirection: burstDir,
      });
    }
  }, [ownedItemTypes]);

  useEffect(() => {
    const onSpineFlowReward = (event: Event) => {
      const detail = (event as CustomEvent<{
        position?: { x: number; y: number; z: number };
        flow?: number;
        index?: number;
      }>).detail;
      const pos = detail?.position;
      const flow = Math.max(0, Math.floor(detail?.flow ?? 0));
      if (!pos || flow <= 0) return;

      const playerPos = realTimePlayerPositionRef.current;
      const start = new Vector3(pos.x, (pos.y ?? 0) + 0.85, pos.z);
      const baseBurstDir = new Vector3(start.x - playerPos.x, 0, start.z - playerPos.z);
      if (baseBurstDir.lengthSq() < 0.04) {
        const angle = Math.random() * Math.PI * 2;
        baseBurstDir.set(Math.cos(angle), 0, Math.sin(angle));
      }
      baseBurstDir.normalize();

      const yAxis = new Vector3(0, 1, 0);
      const stamp = Date.now();
      const index = detail.index ?? 0;
      for (let i = 0; i < flow; i++) {
        const angle = flow === 1
          ? (Math.random() - 0.5) * 0.6
          : (i / flow) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
        const burstDir = baseBurstDir.clone().applyAxisAngle(yAxis, angle);
        burstDir.y = 0.4;
        burstDir.normalize();

        const offset = flow > 1
          ? new Vector3(
              Math.cos(angle) * 0.25,
              (Math.random() - 0.5) * 0.15,
              Math.sin(angle) * 0.25,
            )
          : new Vector3();

        environmentVfxLayerRef.current?.addDreamShard({
          id: `spine-flow-shard-${index}-${stamp}-${i}`,
          startPosition: start.clone().add(offset),
          initialDirection: burstDir,
        });
      }
    };

    window.addEventListener('explore-spine-flow-reward', onSpineFlowReward);
    return () => {
      window.removeEventListener('explore-spine-flow-reward', onSpineFlowReward);
    };
  }, []);

  useEffect(() => {
    const triggerKaiser = (target: Entity, _sourcePlayerId?: string) => {
      if (!hasOwnedItem(ownedItemTypes, EXODIA_HELM)) return;
      const nowSec = Date.now() / 1000;
      if (nowSec - lastKaiserProcSecRef.current < KAISER_ICD_SEC) return;
      lastKaiserProcSecRef.current = nowSec;

      const transform = target.getComponent(Transform);
      const serverEnemyId = target.userData?.serverEnemyId as string | undefined;
      if (!transform || !serverEnemyId || !socket?.id) return;

      const strikePos = transform.position.clone();
      bossTelegraphLayerRef.current?.addRoomBoomFlameStrike({
        id: nextRoomBoomEffectId.current++,
        position: strikePos,
      });
      (window as any).audioSystem?.playWeaponSound?.('scythe_cryoflame', strikePos, { volume: 0.75 });

      const world = engineRef.current?.getWorld();
      if (!world) return;
      for (const entity of world.queryEntities([Enemy, Transform, Health])) {
        const enemy = entity.getComponent(Enemy);
        const entTransform = entity.getComponent(Transform);
        const health = entity.getComponent(Health);
        if (!enemy || !entTransform || !health || health.isDead) continue;
        if (isCoopPlayerAllyEntity(entity)) continue;
        const dx = entTransform.position.x - strikePos.x;
        const dz = entTransform.position.z - strikePos.z;
        if (dx * dx + dz * dz > INFERNAL_DASH_RADIUS * INFERNAL_DASH_RADIUS) continue;
        const sid = entity.userData?.serverEnemyId as string | undefined;
        if (!sid) continue;
        damageEnemy(sid, KAISER_PILLAR_DAMAGE, socket.id, {
          damageType: 'infernal_dash',
          infernalDashRoom: true,
        });
      }
    };

    (window as any).dreamLayerKaiserOnCrit = triggerKaiser;
    (window as any).dreamLayerColdGraceShatter = (serverEnemyId: string) => {
      applyStatusEffect(serverEnemyId, 'freeze', 0);
    };
    (window as any).archmageFlamePillarVfx = (position: Vector3) => {
      if (!position) return;
      const strikePos = position.clone();
      (window as any).audioSystem?.playWarlockImmolateSound?.(strikePos);
      bossTelegraphLayerRef.current?.addWarlockFlameStrike({
        id: `archmage-flame-pillar-local-${nextRoomBoomEffectId.current++}`,
        position: strikePos,
      });
    };

    return () => {
      delete (window as any).dreamLayerKaiserOnCrit;
      delete (window as any).dreamLayerColdGraceShatter;
      delete (window as any).archmageFlamePillarVfx;
    };
  }, [applyStatusEffect, damageEnemy, ownedItemTypes, socket?.id]);

  useEffect(() => {
    return subscribeEnemyDamage((event) => {
      if (!event.wasKilled) return;
      const enemy = enemiesRef.current.get(event.enemyId);
      if (enemy?.type === 'training-dummy') return;
      const pos = event.position ?? enemy?.position;
      if (!pos) return;
      spawnDreamShardFromDeath(pos, event.enemyId, event.timestamp, enemy?.type);
    });
  }, [subscribeEnemyDamage, spawnDreamShardFromDeath]);

  useEffect(() => {
    (window as any).spawnDreamShardEffect = (
      deathPos: { x: number; y: number; z: number },
      enemyId: string,
      enemyType?: string,
    ) => {
      spawnDreamShardFromDeath(deathPos, enemyId, undefined, enemyType);
    };
    return () => {
      delete (window as any).spawnDreamShardEffect;
    };
  }, [spawnDreamShardFromDeath]);

  const onMeteorPlayerImpact = useCallback((damage: number, position: Vector3, sourceEnemyId?: string) => {
    if (!playerEntity) return;
    const localPlayerTransform = playerEntity.getComponent(Transform);
    if (!localPlayerTransform) return;
    const playerGroundPos = new Vector3(localPlayerTransform.position.x, 0, localPlayerTransform.position.z);
    const meteorGroundPos = new Vector3(position.x, 0, position.z);
    if (playerGroundPos.distanceTo(meteorGroundPos) > 2.99) return;

    const health = playerEntity.getComponent(Health);
    if (!health) return;
    const currentTime = Date.now() / 1000;
    const shield = playerEntity.getComponent(Shield);
    const healthBefore = health.currentHealth;
    const shieldBefore = shield?.currentShield;
    const damageApplied = health.takeDamage(damage, currentTime, playerEntity);

    const damageNumberManager = (window as { damageNumberManager?: { addDamageNumber: (...args: unknown[]) => void } }).damageNumberManager;
    if (damageNumberManager) {
      const damagePosition = localPlayerTransform.getWorldPosition().clone();
      damagePosition.y += 2;
      damageNumberManager.addDamageNumber(damage, false, damagePosition, 'meteor');
    }

    triggerAppliedLocalPlayerDamageFeedback({
      damage,
      damageType: 'meteor',
      damageApplied,
      health,
      healthBefore,
      shield,
      shieldBefore,
      position: localPlayerTransform.position,
      attackerServerEnemyId: sourceEnemyId,
    });
  }, [playerEntity, triggerAppliedLocalPlayerDamageFeedback]);

  const onBossSpearHitPlayer = useCallback((damage: number, bossId: string) => {
    if (!playerEntity) return;
    const deathState = playerDeathStatesRef.current.get(socket?.id ?? '');
    if (deathState?.isDead) return;
    const health = playerEntity.getComponent(Health);
    if (!health) return;
    const wasAlive = !health.isDead;
    applyLocalPlayerStun(2000, 'boss-spear-stun');
    const shield = playerEntity.getComponent(Shield);
    const healthBefore = health.currentHealth;
    const shieldBefore = shield?.currentShield;
    const damageApplied = health.takeDamage(damage, Date.now() / 1000, playerEntity, false);
    const transform = playerEntity.getComponent(Transform);
    triggerAppliedLocalPlayerDamageFeedback({
      damage,
      damageType: 'boss',
      damageApplied,
      health,
      healthBefore,
      shield,
      shieldBefore,
      position: transform?.position ?? new Vector3(),
      attackerServerEnemyId: bossId,
    });
    if (wasAlive && health.isDead && socket?.id) {
      handlePlayerDeath(socket.id, 'boss-spear');
    }
  }, [playerEntity, socket?.id, applyLocalPlayerStun, triggerAppliedLocalPlayerDamageFeedback, handlePlayerDeath]);

  const onWeaverLightningImpact = useCallback((damage: number, position: Vector3, strike: WeaverLightningState) => {
    if (!playerEntity) return;
    const localPlayerTransform = playerEntity.getComponent(Transform);
    if (!localPlayerTransform) return;
    const playerGroundPos = new Vector3(localPlayerTransform.position.x, 0, localPlayerTransform.position.z);
    const hitGround = new Vector3(position.x, 0, position.z);
    if (playerGroundPos.distanceTo(hitGround) > strike.radius) return;

    applyLocalPlayerStun(2000, 'weaver-lightning-stun');
    const health = playerEntity.getComponent(Health);
    if (!health) return;
    const currentTime = Date.now() / 1000;
    const shield = playerEntity.getComponent(Shield);
    const healthBefore = health.currentHealth;
    const shieldBefore = shield?.currentShield;
    const damageApplied = health.takeDamage(damage, currentTime, playerEntity);
    const damageNumberManager = (window as { damageNumberManager?: { addDamageNumber: (...args: unknown[]) => void } }).damageNumberManager;
    if (damageNumberManager) {
      const damagePosition = localPlayerTransform.getWorldPosition().clone();
      damagePosition.y += 2;
      damageNumberManager.addDamageNumber(damage, false, damagePosition, 'meteor');
    }
    triggerAppliedLocalPlayerDamageFeedback({
      damage,
      damageType: 'lightning',
      damageApplied,
      health,
      healthBefore,
      shield,
      shieldBefore,
      position: localPlayerTransform.position,
      attackerServerEnemyId: strike.weaverId,
    });
  }, [playerEntity, applyLocalPlayerStun, triggerAppliedLocalPlayerDamageFeedback]);

  // Track previous weapon state for change detection
  const prevWeaponRef = useRef<{ weapon: WeaponType; subclass: WeaponSubclass }>({
    weapon: WeaponType.NONE,
    subclass: WeaponSubclass.ELEMENTAL
  });
  
  // Track multiplayer player states for animations
  const multiplayerPlayerStatesRef = useRef<Map<string, RemotePlayerAnimState>>(new Map());
  const [multiplayerPlayerStates, setMultiplayerPlayerStates] = useState<Map<string, RemotePlayerAnimState>>(
    () => new Map(),
  );
  
  // Optimized PVP effects with object pooling
  const { createOptimizedVenomEffect, createOptimizedDebuffEffect, getPoolStats } = useOptimizedPVPEffects();

  // Sync currentWeapon with weaponState
  useEffect(() => {
    setCurrentWeapon(weaponState.currentWeapon);
  }, [weaponState.currentWeapon]);

  useEffect(() => {
    if (!socket) return;

    // Viper-only draw/strip timing. The backend adds projectile flight time before applying Viper arrow damage.
    // Tentacle-spine warning strips are scheduled by `handleTentacleSpineWindup` with separate constants.
    const VIPER_DRAWBOW_DURATION = 1000;
    const VIPER_GROUND_TELEGRAPH_LEAD_MS = 400;
    const VIPER_TELEGRAPH_GROUND_CLEARANCE = 0.25;

    const handleViperAttackTelegraph = (data: {
      viperId: string;
      shotId?: string;
      targetPlayerId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
      maxRange?: number;
      endPosition?: { x: number; y: number; z: number };
    }) => {
      if (data.shotId && data.targetPlayerId) {
        viperPendingShotTargetsRef.current.set(data.shotId, data.targetPlayerId);
      }
      const start = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const staleTarget = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);
      const range = data.maxRange ?? VIPER_ARROW_MAX_RANGE;

      const groundY = data.startPosition.y - 1.5 + VIPER_TELEGRAPH_GROUND_CLEARANCE;
      const { x: sx, z: sz } = data.startPosition;
      const from = new Vector3(sx, groundY, sz);
      const to = data.endPosition
        ? new Vector3(data.endPosition.x, groundY, data.endPosition.z)
        : (() => {
            const { x: tx, z: tz } = data.targetPosition;
            const dxh = tx - sx;
            const dzh = tz - sz;
            const hLen = Math.hypot(dxh, dzh) || 1e-6;
            return new Vector3(
              sx + (dxh / hLen) * range,
              groundY,
              sz + (dzh / hLen) * range
            );
          })();

      const eventTime = Date.now();
      const lineId = `viper-telegraph-${data.viperId}-${eventTime}`;
      const endAt = eventTime + VIPER_DRAWBOW_DURATION;

      (window as any).audioSystem?.playViperBowDrawSound(start);

      const lineDelay = Math.max(0, VIPER_DRAWBOW_DURATION - VIPER_GROUND_TELEGRAPH_LEAD_MS);
      const tLine = setTimeout(() => {
        const startedAt = Date.now();
        groundTelegraphLayerRef.current?.addViperShotTelegraph({ id: lineId, start: from.clone(), end: to.clone(), endAt, startedAt });
      }, lineDelay);
      viperAttackScheduleTimeoutsRef.current.push(tLine);

      const tArrow = setTimeout(() => {
        (window as any).audioSystem?.playViperBowReleaseSound(start);
        groundTelegraphLayerRef.current?.removeViperShotTelegraph(lineId);
        projectileLayerRef.current?.addViperArrow({
            id: `viper-arrow-${data.viperId}-${Date.now()}`,
            shotId: data.shotId,
            startPosition: start.clone(),
            targetPosition: staleTarget.clone(),
            damage: data.damage,
            maxRange: data.maxRange,
          });
      }, VIPER_DRAWBOW_DURATION);
      viperAttackScheduleTimeoutsRef.current.push(tArrow);
    };

    const handleViperArrowOutcome = (data: {
      viperId: string;
      shotId?: string;
      hit: boolean;
      position?: { x: number; y: number; z: number };
    }) => {
      const soundPosition = data.position
        ? new Vector3(data.position.x, data.position.y, data.position.z)
        : new Vector3(0, 0, 0);
      const targetedPlayerId = data.shotId
        ? viperPendingShotTargetsRef.current.get(data.shotId)
        : undefined;
      if (data.shotId) {
        viperPendingShotTargetsRef.current.delete(data.shotId);
      }
      if (data.hit) {
        (window as any).audioSystem?.playViperImpactSound?.(soundPosition);
      } else {
        (window as any).audioSystem?.playViperMissSound?.(soundPosition);
        if (targetedPlayerId && targetedPlayerId === socket?.id) {
          showLocalPlayerMissNumber();
        }
      }
    };

    socket.on('viper-attack-telegraph', handleViperAttackTelegraph);
    socket.on('viper-arrow-outcome', handleViperArrowOutcome);

    return () => {
      viperAttackScheduleTimeoutsRef.current.forEach(t => { clearTimeout(t); });
      viperAttackScheduleTimeoutsRef.current = [];
      viperPendingShotTargetsRef.current.clear();
      socket.off('viper-attack-telegraph', handleViperAttackTelegraph);
      socket.off('viper-arrow-outcome', handleViperArrowOutcome);
    };
  }, [socket, showLocalPlayerMissNumber]);

  // Pet companion upgrades: Tiger Evasion chance provider + Persistence Hunter walk buff.
  useEffect(() => {
    const isNearFaeBeast = (range: number): boolean => {
      const localId = socket?.id;
      if (!localId || playerEntityRef.current == null || !engineRef.current) return false;
      const entity = engineRef.current.getWorld().getEntity(playerEntityRef.current);
      const transform = entity?.getComponent(Transform);
      if (!transform) return false;
      const beast = enemiesRef.current.get(resolveFaeBeastCompanionId(localId));
      if (!beast || beast.isDying || (beast.health ?? 0) <= 0) return false;
      const dx = transform.position.x - (beast.position?.x ?? 0);
      const dz = transform.position.z - (beast.position?.z ?? 0);
      return dx * dx + dz * dz <= range * range;
    };

    setPetEvasionChanceProvider(() => {
      if (coopPetCompanionUpgradeRef.current !== 'tiger_evasion') return 0;
      return isNearFaeBeast(PET_UPGRADE_EVASION_RANGE) ? PET_UPGRADE_EVASION_CHANCE : 0;
    });

    const tickId = window.setInterval(() => {
      if (playerEntityRef.current == null || !engineRef.current) return;
      const entity = engineRef.current.getWorld().getEntity(playerEntityRef.current);
      const movement = entity?.getComponent(Movement);
      if (!movement) return;
      const active =
        coopPetCompanionUpgradeRef.current === 'wolf_persistence_hunter'
        && isNearFaeBeast(PET_UPGRADE_PERSISTENCE_HUNTER_RANGE);
      if (movement.persistenceHunterActive !== active) {
        movement.persistenceHunterActive = active;
      }
    }, 100);

    return () => {
      setPetEvasionChanceProvider(null);
      window.clearInterval(tickId);
      if (playerEntityRef.current != null && engineRef.current) {
        const entity = engineRef.current.getWorld().getEntity(playerEntityRef.current);
        const movement = entity?.getComponent(Movement);
        if (movement) movement.persistenceHunterActive = false;
      }
    };
  }, [socket?.id, enemiesRef]);

  // Set up PVP event listeners for player actions and damage
  useEffect(() => {
    if (!socket) return;

    const cosmeticOffs: Array<() => void> = [];
    const onCosmetic = (event: string, handler: (...args: any[]) => void) => {
      const gated = (...args: any[]) => {
        if (shouldDropRemoteVfx()) return;
        handler(...args);
      };
      socket.on(event, gated);
      cosmeticOffs.push(() => socket.off(event, gated));
    };

    const getLocalPlayerEntity = () => {
      const id = playerEntityRef.current;
      if (id == null || !engineRef.current) return null;
      return engineRef.current.getWorld().getEntity(id) ?? null;
    };

    const unregisterEnemyTelegraphSounds = registerEnemyAttackTelegraphSounds(socket, {
      getEnemyPosition: (enemyId) => enemiesRef.current.get(enemyId)?.position,
    });
    const unregisterBeastAudioSounds = registerBeastAudioSounds(socket, {
      getEnemyPosition: (enemyId) => enemiesRef.current.get(enemyId)?.position,
    });
    const unregisterKnightAnimationListeners = registerKnightAnimationSocketListeners(socket);
    const unregisterWolfAnimationListeners = registerWolfAnimationSocketListeners(socket);
    const unregisterAssassinAnimationListeners = registerAssassinAnimationSocketListeners(socket);
    const unregisterValkyrieAnimationListeners = registerValkyrieAnimationSocketListeners(socket);
    const unregisterSkeletonMoveListeners = registerSkeletonMoveSocketListeners(socket);

    const handleCoopRoomWhisper = (data: { roomColor?: string }) => {
      const c = data.roomColor?.toLowerCase();
      if (c === 'red' || c === 'blue' || c === 'green' || c === 'purple') {
        window.audioSystem?.playCoopRoomWhisperSound(c);
      }
    };

    const blockLocalDamageDuringCoopPortal = () => coopTransitionOverlayRef.current;

    /** Server AOE subtracts HP before client mitigation; restore server HP when local player survives. */
    const reconcileLivingServerHealth = (health: Health, data: { newHealth?: number }) => {
      if (typeof data.newHealth !== 'number') return;
      if (health.isDead || health.currentHealth <= 0) return;
      if (data.newHealth === health.currentHealth) return;

      updatePlayerHealth(health.currentHealth, health.maxHealth);
      lastEmittedNetworkHealthRef.current = {
        health: health.currentHealth,
        maxHealth: health.maxHealth,
      };
    };

    const blockAuthoritativePositionDuringCoopPortal = (eventRoomToken?: number) => {
      if (voidPortalFallActiveRef.current) return true;
      if (coopTransitionOverlayRef.current) return true;
      if (pendingPortalSnapRef.current) return true;

      const expectedToken = coopRoomEntryTokenRef.current;
      if (expectedToken > 0) {
        const token = eventRoomToken ?? 0;
        if (token !== expectedToken) return true;
      }

      const enteredAt = coopCombatArenaEnterAtRef.current;
      if (enteredAt > 0 && Date.now() - enteredAt < COOP_POST_PORTAL_POSITION_GRACE_MS) {
        return true;
      }

      return false;
    };

    const handlePlayerAttack = (data: any) => {
      // CRITICAL FIX: Never process our own attacks to prevent duplicate projectiles and damage
      if (data.playerId === socket.id) {
        return;
      }

      const stopRemoteRunebladeWhirlwind = (playerId: string) => {
        const pending = remotePlayerWhirlwindStartTimeoutsRef.current.get(playerId);
        if (pending !== undefined) {
          clearTimeout(pending);
          remotePlayerWhirlwindStartTimeoutsRef.current.delete(playerId);
        }
        const failsafe = remotePlayerWhirlwindFailsafeTimeoutsRef.current.get(playerId);
        if (failsafe !== undefined) {
          clearTimeout(failsafe);
          remotePlayerWhirlwindFailsafeTimeoutsRef.current.delete(playerId);
        }
        const instance = remotePlayerWhirlwindInstancesRef.current.get(playerId);
        if (instance !== undefined) {
          window.audioSystem?.stopRunebladeWhirlwindSound?.(instance);
          remotePlayerWhirlwindInstancesRef.current.delete(playerId);
        } else {
          window.audioSystem?.stopLoopingWeaponSound?.('runeblade_whirlwind');
        }
      };
      
      if (engineRef.current) {
        // NOTE: bow_release attacks are no longer broadcast to avoid duplicate damage
        // Perfect shot visual effects are now handled via the projectile system broadcasts
        
        // Handle special ability projectiles that need custom visual effects
        if (data.attackType === 'viper_sting_projectile') {

          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          // Create the ECS projectile for damage (this is needed for collision detection)
          const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
          if (projectileSystem) {
            const attackerEntityId = serverPlayerEntities.current.get(data.playerId) || -Math.abs(data.playerId.length * 1000 + Date.now() % 1000);

            // Create Viper Sting projectile for damage
            projectileSystem.createProjectile(
              engineRef.current.getWorld(),
              position,
              direction,
              attackerEntityId,
              { speed: 18, damage: 93, lifetime: 5, piercing: true, opacity: 0.8, projectileType: 'viper_sting', sourcePlayerId: data.playerId }
            );
          }
          
          // For PVP broadcasts, normalize the position and direction to be flat for visual effect
          const flatPosition = position.clone();
          flatPosition.y = 1.5; // Fixed height for visual consistency
          
          const flatDirection = direction.clone();
          flatDirection.y = 0; // Remove vertical component
          flatDirection.normalize(); // Ensure it's still a unit vector
          
          // Create visual effect from the remote player's position but with flat trajectory
          // This will show the Viper Sting projectile coming from the correct player but flat
          const exp = !!data.animationData?.projectileConfig?.explosiveTalons;
          const success = triggerGlobalViperSting(flatPosition, flatDirection, data.playerId, {
            explosiveTalons: exp,
          });
          if (success) {
          }
          
          return;
        }
        
        if (data.attackType === 'cobra_shot_projectile') {
          // Note: Cobra Shot damage is handled by PVPCobraShotManager through visual projectiles
          // No need to create ECS projectiles that show up as regular arrows
          
          // Trigger visual effect for Cobra Shot projectile (this creates the visual projectile that PVPCobraShotManager monitors)
          const { triggerGlobalCobraShot } = require('@/components/projectiles/CobraShotManager');
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          triggerGlobalCobraShot(position, direction);
          
          return;
        }
        
        if (data.attackType === 'rejuvenating_shot_projectile') {
          // Trigger visual effect for Rejuvenating Shot projectile (non-authoritative — heal handled on shooter client)
          const { triggerGlobalRejuvenatingShot } = require('@/components/projectiles/RejuvenatingShotManager');
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          triggerGlobalRejuvenatingShot(position, direction, { authoritative: false });
          
          return;
        }
        
        if (data.attackType === 'throw_spear') {
          // Trigger visual effect for Throw Spear projectile
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          const chargeTime = data.animationData?.chargeTime || 0;
          triggerGlobalThrowSpear(position, direction, chargeTime);
          
          return;
        }
        
        // Handle sword charge hit attacks
        if (data.attackType === 'sword_charge_hit') {
          
          // Validate animationData object exists and has required properties
          if (!data.animationData || typeof data.animationData.damage !== 'number' || typeof data.animationData.targetId !== 'number') {
            return;
          }
          
          // Check if this hit targets the local player
          const targetEntityId = serverPlayerEntities.current.get(socket?.id || '');
          if (targetEntityId === data.animationData.targetId) {
            // Apply damage directly to local player
            const playerEntity = getLocalPlayerEntity();
            if (playerEntity && broadcastPlayerDamage && socket?.id) {
              const health = playerEntity.getComponent(Health);
              if (health) {
                // Apply damage through PVP system
                broadcastPlayerDamage(socket.id, data.animationData.damage);
              }
            }
          }
          
          return; // Don't process as regular projectile
        }
        
        // Handle regular projectile attacks - create projectiles that can hit the local player
        const projectileTypes = ['regular_arrow', 'charged_arrow', 'entropic_bolt', 'crossentropy_bolt', 'perfect_shot', 'barrage_projectile', 'fan_of_knives_projectile', 'wind_shear_projectile', 'burst_arrow', 'scorpion_shard', 'poison_dart'];
        if (projectileTypes.includes(data.attackType)) {
          // Skip creating projectiles for the local player's own attacks to prevent duplicates
          const localSocketId = socket?.id;
          if (data.playerId === localSocketId) {
            return; // Local player already created this projectile
          }

          // Create a projectile that can damage the local player
          const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
          if (projectileSystem) {
            // Use pooled Vector3 objects for better performance
            const position = pvpObjectPool.acquireVector3(data.position.x, data.position.y, data.position.z);
            const direction = pvpObjectPool.acquireVector3(data.direction.x, data.direction.y, data.direction.z);
            
            // Get the attacker's local ECS entity ID (if it exists) or use a unique negative ID
            const attackerEntityId = serverPlayerEntities.current.get(data.playerId) || -Math.abs(data.playerId.length * 1000 + Date.now() % 1000);
            
            // Create appropriate projectile type with PVP damage enabled
            switch (data.attackType) {
              case 'regular_arrow': {
                const pc = data.animationData?.projectileConfig ?? {};
                const stagger =
                  typeof pc.staggerToAdd === 'number' && pc.staggerToAdd > 0
                    ? { staggerToAdd: pc.staggerToAdd }
                    : {};
                const dual =
                  pc.dualCoilLane === 0 || pc.dualCoilLane === 1
                    ? { dualCoilLane: pc.dualCoilLane as 0 | 1 }
                    : {};
                const triggerFinger =
                  pc.triggerFingerUncharged === true ? { triggerFingerUncharged: true as const } : {};
                projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed: typeof pc.speed === 'number' ? pc.speed : 25,
                    damage: typeof pc.damage === 'number' ? pc.damage : BOW_UNCHARGED_PROJECTILE_DAMAGE,
                    lifetime: typeof pc.lifetime === 'number' ? pc.lifetime : 3,
                    maxDistance: typeof pc.maxDistance === 'number' ? pc.maxDistance : 25,
                    opacity: typeof pc.opacity === 'number' ? pc.opacity : 0.8,
                    sourcePlayerId: data.playerId,
                    ...(pc.subclass != null ? { subclass: pc.subclass } : {}),
                    ...(typeof pc.level === 'number' ? { level: pc.level } : {}),
                    ...stagger,
                    ...dual,
                    ...triggerFinger,
                  },
                );
                break;
              }
              case 'charged_arrow':
                // Only create visual effect for charged arrows - no damage-dealing projectile
                // The local player already created the damage-dealing projectile
                
                // Create charged arrow visual effect for other players with flat positioning
                const chargedPlayer = players.get(data.playerId);
                const chargedSubclass = chargedPlayer?.subclass || WeaponSubclass.ELEMENTAL;
                
                // For PVP broadcasts, normalize the position and direction to be flat
                const chargedFlatPosition = position.clone();
                chargedFlatPosition.y = 1.5; // Fixed height for visual consistency
                
                const chargedFlatDirection = direction.clone();
                chargedFlatDirection.y = 0; // Remove vertical component
                chargedFlatDirection.normalize(); // Ensure it's still a unit vector
                
                createPowershotEffect(
                  chargedFlatPosition,
                  chargedFlatDirection,
                  chargedSubclass,
                  false, // not a perfect shot
                  true   // isElementalShotsUnlocked
                );
                break;
              case 'entropic_bolt':
                // Use broadcast config data if available, otherwise fall back to defaults
                const entropicConfig = data.animationData?.projectileConfig || {};
                const isCryoflame = entropicConfig.isCryoflame || false;
                
                projectileSystem.createEntropicBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  { 
                    speed: entropicConfig.speed || 20, 
                    damage: entropicConfig.damage || 20, 
                    lifetime: entropicConfig.lifetime || 1.75, 
                    piercing: entropicConfig.piercing ?? false, 
                    opacity: entropicConfig.opacity || 0.8,
                    colorVariant: entropicConfig.colorVariant || DEFAULT_ENTROPIC_COLOR_VARIANT,
                    ...(entropicConfig.entropicBoltTalent
                      ? { entropicBoltTalent: entropicConfig.entropicBoltTalent }
                      : {}),
                    ...(entropicConfig.entropicFragmentation
                      ? { entropicFragmentation: true as const }
                      : {}),
                    ...(typeof entropicConfig.entropicFragmentHop === 'number'
                      ? { entropicFragmentHop: entropicConfig.entropicFragmentHop }
                      : {}),
                    isCryoflame: isCryoflame // Pass Cryoflame state to projectile system
                  }
                );
                break;
              case 'crossentropy_bolt': {
                const crossCfg = data.animationData?.projectileConfig || {};
                const reaper = !!crossCfg.reaperCrossentropy;
                const blitzCannon = !!crossCfg.blitzCannon;
                const speed = crossCfg.speed ?? 15;
                const lifetime = crossCfg.lifetime ?? 2.5;
                const remoteAspect =
                  crossCfg.weaponAspect ??
                  players.get(data.playerId)?.weaponAspect;
                projectileSystem.createCrossentropyBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed,
                    damage: crossCfg.damage ?? 90,
                    lifetime,
                    maxDistance:
                      crossCfg.maxDistance ??
                      (reaper ? CROSSENTROPY_MAX_TRAVEL_DISTANCE : undefined),
                    piercing: reaper || (crossCfg.piercing ?? false),
                    opacity: crossCfg.opacity ?? 0.8,
                    sourcePlayerId: data.playerId,
                    infernoCrossentropy: !!crossCfg.infernoCrossentropy,
                    reaperCrossentropy: reaper,
                    crossentropyTempest: !!crossCfg.crossentropyTempest,
                    crossentropyPlague: !!crossCfg.crossentropyPlague,
                    crossentropyGlacial: !!crossCfg.crossentropyGlacial,
                    crossentropyMeteor: !!crossCfg.crossentropyMeteor,
                    crossentropyFragmentation: !!crossCfg.crossentropyFragmentation,
                    crossentropySuppressFragmentation: !!crossCfg.crossentropySuppressFragmentation,
                    ...(blitzCannon ? { blitzCannon: true } : {}),
                    ...(remoteAspect ? { weaponAspect: remoteAspect } : {}),
                  }
                );
                break;
              }
              case 'perfect_shot':
                // Only create visual effect — damage projectile omitted for receiver.
                // Position/direction are spawn + aim from shooter (same as local perfect shot).
                const perfectPlayer = players.get(data.playerId);
                const perfectSubclass = perfectPlayer?.subclass || WeaponSubclass.ELEMENTAL;
                const perfectDir = direction.clone();
                if (perfectDir.lengthSq() > 1e-10) perfectDir.normalize();

                createPowershotEffect(
                  position.clone(),
                  perfectDir,
                  perfectSubclass,
                  true,
                  true,
                  false,
                  !!data.animationData?.highCaliberPerfectBeam,
                );
                break;
              case 'barrage_projectile': {
                const barrageCfg = data.animationData?.projectileConfig || {};
                const wrathfulBiteBarrage = !!barrageCfg.wrathfulBiteBarrage;
                const wyvernBiteBarrage = !!barrageCfg.wyvernBiteBarrage;
                const staggeringBiteBarrage = !!barrageCfg.staggeringBiteBarrage;
                const glacialBiteBarrage = !!barrageCfg.glacialBiteBarrage;
                const entanglementBarrage = !!barrageCfg.entanglementBarrage;
                const barrageEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed: typeof barrageCfg.speed === 'number' ? barrageCfg.speed : 30,
                    damage: typeof barrageCfg.damage === 'number' ? barrageCfg.damage : 79,
                    lifetime: typeof barrageCfg.lifetime === 'number' ? barrageCfg.lifetime : 8,
                    maxDistance: typeof barrageCfg.maxDistance === 'number' ? barrageCfg.maxDistance : 16,
                    piercing: false,
                    opacity: typeof barrageCfg.opacity === 'number' ? barrageCfg.opacity : 1.0,
                    projectileType: 'barrage',
                    sourcePlayerId: data.playerId,
                    wrathfulBiteBarrage,
                    wyvernBiteBarrage,
                    staggeringBiteBarrage,
                    glacialBiteBarrage,
                    entanglementBarrage,
                    ...(staggeringBiteBarrage ? { staggerToAdd: STAGGERING_BITE_BARRAGE_STAGGER_PER_HIT } : {}),
                  }
                );
                
                // Mark as barrage arrow for proper visual rendering
                const renderer = barrageEntity.getComponent(Renderer);
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
                break;
              }
              case 'fan_of_knives_projectile': {
                const fcfg = data.animationData?.projectileConfig || {};
                const fanTintRaw = fcfg.fanOfKnivesFlourishTint as unknown;
                const ALL_FAN_TINTS: readonly FanOfKnivesFlourishTint[] = [
                  'default',
                  'guard',
                  'staggering',
                  'wrathful',
                  'infested',
                ];
                const fanTintValid: FanOfKnivesFlourishTint = ALL_FAN_TINTS.includes(
                  fanTintRaw as FanOfKnivesFlourishTint,
                )
                  ? (fanTintRaw as FanOfKnivesFlourishTint)
                  : 'default';
                const stag =
                  typeof fcfg.staggerToAdd === 'number' && fcfg.staggerToAdd > 0 ? fcfg.staggerToAdd : undefined;
                const fanEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed: typeof fcfg.speed === 'number' ? fcfg.speed : FAN_OF_KNIVES_PROJECTILE_SPEED,
                    damage: typeof fcfg.damage === 'number' ? fcfg.damage : FAN_OF_KNIVES_BASE_DAMAGE,
                    lifetime: typeof fcfg.lifetime === 'number' ? fcfg.lifetime : FAN_OF_KNIVES_PROJECTILE_LIFETIME_SEC,
                    maxDistance:
                      typeof fcfg.maxDistance === 'number' ? fcfg.maxDistance : FAN_OF_KNIVES_MAX_DISTANCE_UNITS,
                    piercing: false,
                    opacity: typeof fcfg.opacity === 'number' ? fcfg.opacity : 1,
                    sourcePlayerId: data.playerId,
                    projectileType: 'fan_of_knives',
                    fanOfKnivesFlourishTint: fanTintValid,
                    ...(typeof stag === 'number' && stag > 0 ? { staggerToAdd: stag } : {}),
                    ...(fcfg.infestedFlourishFanKnives === true ? { infestedFlourishFanKnives: true as const } : {}),
                  },
                );
                const fanRen = fanEntity.getComponent(Renderer);
                if (fanRen?.mesh) {
                  fanRen.mesh.userData.isFanOfKnivesDagger = true;
                  fanRen.mesh.userData.fanOfKnivesFlourishTint = fanTintValid;
                  if (fcfg.infestedFlourishFanKnives === true) {
                    fanRen.mesh.userData.infestedFlourishFanKnives = true;
                  }
                }
                break;
              }
              case 'wind_shear_projectile': {
                const wcfg = data.animationData?.projectileConfig || {};
                const windEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed: typeof wcfg.speed === 'number' ? wcfg.speed : WIND_SHEAR_PROJECTILE_SPEED,
                    damage: typeof wcfg.damage === 'number' ? wcfg.damage : 0,
                    lifetime: typeof wcfg.lifetime === 'number' ? wcfg.lifetime : WIND_SHEAR_PROJECTILE_LIFETIME_SEC,
                    maxDistance:
                      typeof wcfg.maxDistance === 'number' ? wcfg.maxDistance : WIND_SHEAR_MAX_DISTANCE_UNITS,
                    piercing: false,
                    opacity: typeof wcfg.opacity === 'number' ? wcfg.opacity : 1,
                    sourcePlayerId: data.playerId,
                    projectileType: 'wind_shear',
                  },
                );
                const windRen = windEntity.getComponent(Renderer);
                if (windRen?.mesh) {
                  windRen.mesh.userData.isWindShearProjectile = true;
                  windRen.mesh.userData.windShearRoll =
                    typeof wcfg.windShearRoll === 'number' ? wcfg.windShearRoll : 0;
                }
                break;
              }
              case 'burst_arrow': {
                const burstCfg = data.animationData?.projectileConfig || {};
                const tempestBurstTheme = burstCfg.tempestBurstTheme;
                const burstEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed: 35,
                    damage: 25,
                    lifetime: 3,
                    maxDistance: 22,
                    piercing: false,
                    opacity: 0.8,
                    projectileType: 'burst_arrow',
                    sourcePlayerId: data.playerId,
                    ...(tempestBurstTheme ? { tempestBurstTheme } : {}),
                    ...(burstCfg.tempestBurstWrathful ? { tempestBurstWrathful: true as const } : {}),
                    ...(burstCfg.tempestBurstArcticChill ? { tempestBurstArcticChill: true as const } : {}),
                    ...(burstCfg.tempestBurstWyvernZombie ? { tempestBurstWyvernZombie: true as const } : {}),
                    ...(typeof burstCfg.staggerToAdd === 'number' && burstCfg.staggerToAdd > 0
                      ? { staggerToAdd: burstCfg.staggerToAdd }
                      : {}),
                  }
                );

                const burstRenderer = burstEntity.getComponent(Renderer);
                if (burstRenderer?.mesh) {
                  burstRenderer.mesh.userData.isBurstArrow = true;
                  burstRenderer.mesh.userData.isRegularArrow = false;
                  if (tempestBurstTheme) {
                    burstRenderer.mesh.userData.tempestBurstTheme = tempestBurstTheme;
                  }
                }
                break;
              }
              case 'scorpion_shard':
              case 'poison_dart': {
                const shardCfg = data.animationData?.projectileConfig || {};
                const defaultRange = data.attackType === 'poison_dart' ? POISON_DART_RANGE : 7;
                projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed: typeof shardCfg.speed === 'number' ? shardCfg.speed : 28,
                    damage: typeof shardCfg.damage === 'number' ? shardCfg.damage : 0,
                    lifetime: typeof shardCfg.lifetime === 'number' ? shardCfg.lifetime : 1.5,
                    maxDistance: typeof shardCfg.maxDistance === 'number' ? shardCfg.maxDistance : defaultRange,
                    piercing: true,
                    opacity: typeof shardCfg.opacity === 'number' ? shardCfg.opacity : 1,
                    projectileType: data.attackType,
                    sourcePlayerId: data.playerId,
                  },
                );
                break;
              }
            }
            
            // Release pooled Vector3 objects back to pool after use
            pvpObjectPool.releaseVector3(position);
            pvpObjectPool.releaseVector3(direction);
          }
        }
        
        // Update the player state to show attack animation using batched updates
        const animationData = data.animationData || {};
        const animationUpdateTime = Date.now();
        const burstSeqFromConfig =
          (animationData as { projectileConfig?: { tempestBurstSeq?: number } }).projectileConfig?.tempestBurstSeq;
        
        const chargeStoredSpin = !!animationData.storedCharge;

        if (chargeStoredSpin) {
          const chargeSpinPos = new Vector3(data.position.x, data.position.y, data.position.z);
          if (data.attackType === 'sword_charge_start') {
            stopRemoteRunebladeWhirlwind(data.playerId);
            const playerId = data.playerId;
            const SPIN_ROTATION_SPEED = 26.5;
            const targetRotations = chargeStoredSpin ? 3 : 1.5;
            const spinDurationMs = (targetRotations * 2 * Math.PI) / SPIN_ROTATION_SPEED * 1000;
            const CHARGE_SPIN_SOUND_DELAY_MS = 450;
            const timeoutId = setTimeout(() => {
              remotePlayerWhirlwindStartTimeoutsRef.current.delete(playerId);
              const instance = window.audioSystem?.playRunebladeWhirlwindSound(chargeSpinPos);
              if (instance !== undefined) {
                remotePlayerWhirlwindInstancesRef.current.set(playerId, instance);
              }
            }, CHARGE_SPIN_SOUND_DELAY_MS);
            remotePlayerWhirlwindStartTimeoutsRef.current.set(playerId, timeoutId);
            const failsafeId = setTimeout(() => {
              remotePlayerWhirlwindFailsafeTimeoutsRef.current.delete(playerId);
              stopRemoteRunebladeWhirlwind(playerId);
            }, CHARGE_SPIN_SOUND_DELAY_MS + spinDurationMs);
            remotePlayerWhirlwindFailsafeTimeoutsRef.current.set(playerId, failsafeId);
          } else if (data.attackType === 'sword_charge_spin') {
            stopRemoteRunebladeWhirlwind(data.playerId);
          }
        }

        PVPStateUpdateHelpers.batchPlayerStateUpdates(setMultiplayerPlayerStates, [{
          playerId: data.playerId,
          stateUpdate: {
            isSwinging: data.attackType.includes('swing') || (data.attackType.includes('sword') && !data.attackType.includes('charge')),
            isCharging: data.attackType.includes('bow') && data.attackType.includes('charge'),
            isSpinning: data.attackType.includes('scythe') || data.attackType.includes('entropic_bolt') || data.attackType.includes('crossentropy_bolt') || data.attackType.includes('sword_charge_spin') || animationData.isSpinning || false,
            isSwordCharging: data.attackType === 'sword_charge_spin' || data.attackType === 'sword_charge_start' || animationData.isSpinning || animationData.isSwordCharging || false,
            swordComboStep: animationData.comboStep || 1,
            chargeProgress: animationData.chargeProgress || 0,
            lastAttackType: data.attackType,
            lastAttackTime: animationUpdateTime,
            lastAnimationUpdate: animationUpdateTime,
            ...(data.attackType === 'sword_charge_start' ? { runebladeStoredCharge: chargeStoredSpin } : {}),
            ...(data.attackType === 'burst_arrow' && typeof burstSeqFromConfig === 'number'
              ? { tempestBurstShotSeq: burstSeqFromConfig }
              : {}),
          }
        }]);
          
          // Get the player's weapon and subclass for proper animation timing
          const player = players.get(data.playerId);
          const playerWeapon = player?.weapon ?? WeaponType.NONE;
          const playerSubclass = player?.subclass;
          
          // Calculate weapon-specific animation duration based on actual weapon timing
          // These durations match the real animation calculations in each weapon component
          let resetDuration = 100; // Default
          
          // Special handling for sword charge attacks
          if (data.attackType === 'sword_charge_spin') {
            const SPIN_ROTATION_SPEED = 26.5;
            const targetRotations = chargeStoredSpin ? 3 : 1.5;
            resetDuration = (targetRotations * 2 * Math.PI) / SPIN_ROTATION_SPEED * 1000;
          } else if (data.attackType === 'sword_charge_start') {
            // Charge movement lasts about 1.5 seconds (matches ControlSystem chargeDuration)
            resetDuration = 450;
          } else {
            switch (playerWeapon) {
              case WeaponType.SCYTHE:
                // Check if dual wielding (Abyssal subclass level 2+)
                if (playerSubclass === WeaponSubclass.ABYSSAL) {
                  // Dual scythe timing: similar to Sabres with delays
                  resetDuration = 350;
                } else {
                  // Single scythe: swingProgress += delta * 8 until >= Math.PI * 0.85
                  // At 60fps: (Math.PI * 0.85) / 8 / (1/60) ≈ 335ms
                  resetDuration = 167.5;
                }
                break;
              case WeaponType.SWORD:
                // swingProgress += delta * 6.75 until >= Math.PI * 0.55 (or 0.9 for combo step 3)
                // At 60fps: (Math.PI * 0.55) / 6.75 / (1/60) ≈ 400ms
                // Note: 3rd combo hit takes longer but we use average timing for multiplayer sync
                resetDuration = 80
                break;
            case WeaponType.SABRES:
              // Two swings with delays - total duration roughly 350ms
              resetDuration = 275;
              break;
            case WeaponType.RUNEBLADE:
              // Same timing as sword: swingProgress += delta * 6.75 until >= Math.PI * 0.55 (or 0.9 for combo step 3)
              // At 60fps: (Math.PI * 0.55) / 6.75 / (1/60) ≈ 400ms
              // Note: 3rd combo hit takes longer but we use average timing for multiplayer sync
              resetDuration = 80;
              break;
            case WeaponType.BOW:
              resetDuration = 300; // Quick shots
              break;
            default:
              resetDuration = 100; // Default for other weapons
            }
          }
          
          // Schedule animation reset using batched updates
          setTimeout(() => {
            PVPStateUpdateHelpers.batchPlayerStateUpdates(setMultiplayerPlayerStates, [{
              playerId: data.playerId,
              stateUpdate: {
                isSwinging: false,
                isCharging: false,
                isSpinning: false,
                isSwordCharging: false
              }
            }]);
          }, resetDuration);
      }

      // Play enemy sound effects at 50% volume
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      if (window.audioSystem) {
        switch (data.attackType) {
          case 'viper_sting_projectile':
            window.audioSystem.playEnemyViperStingReleaseSound(position);
            break;
          case 'cobra_shot_projectile':
            // Cobra shot uses bow release sound
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'rejuvenating_shot_projectile':
            // Rejuvenating shot uses bow release sound
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'throw_spear':
            // Throw spear uses throw spear release sound
            window.audioSystem.playEnemyThrowSpearReleaseSound(position);
            break;
          case 'regular_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'charged_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'perfect_shot':
            window.audioSystem.playEnemyBowReleaseSound(position, 1.0, true);
            break;
          case 'barrage_projectile':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'burst_arrow':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'entropic_bolt':
            window.audioSystem.playEnemyEntropicBoltSound(position);
            break;
          case 'crossentropy_bolt':
            window.audioSystem.playEnemyCrossentropySound(position);
            break;
          case 'sword_swing':
            window.audioSystem.playEnemySwordSwingSound(data.animationData?.comboStep || 1, position);
            break;
          case 'runeblade_swing':
            window.audioSystem.playEnemyRunebladeSwingHitSound(
              position,
              players.get(data.playerId)?.weaponAspect === 'DEATHDEALER',
            );
            break;
          case 'sabres_swing':
            window.audioSystem.playEnemySabresSwingSound(position);
            break;
        }
      }
    };

    const handlePlayerAbility = (data: any) => {
      if (data.playerId !== socket.id) {
        // Handle special abilities like Viper Sting, Barrage
        if (data.abilityType === 'viper_sting') {

          // Create Viper Sting visual effect from the remote player's position and direction
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // For PVP broadcasts, normalize the position and direction to be flat
          const flatPosition = position.clone();
          flatPosition.y = 1.5; // Fixed height for visual consistency
          
          const flatDirection = direction.clone();
          flatDirection.y = 0; // Remove vertical component
          flatDirection.normalize(); // Ensure it's still a unit vector
          
          // Trigger Viper Sting visual effect with flat position and direction
          // This will create the projectile from the correct player's position but flat
          // Pass caster ID so projectile returns to the correct player
          const success = triggerGlobalViperSting(flatPosition, flatDirection, data.playerId, {
            explosiveTalons: !!data.extraData?.explosiveTalons,
          });
          if (success) {
          }
          
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isViperStingCharging: true,
              viperStingChargeProgress: 1.0 // Full charge when triggered
            });
            
            // Reset Viper Sting state after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isViperStingCharging: false,
                    viperStingChargeProgress: 0
                  });
                }
                return updated;
              });
            }, 2000); // Viper Sting lasts 2 seconds
            
            return updated;
          });
        } else if (data.abilityType === 'frost_nova') {
          // Create frost nova visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpFrostNovaEffect(data.playerId, position);
          
          // Note: PVP damage and freeze effects are now handled by PVPFrostNovaManager
        } else if (data.abilityType === 'reanimate') {

          // Create reanimate visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          createPvpReanimateEffect(data.playerId, position);
        } else if (data.abilityType === 'room_boom_dash') {
          const variant = data.extraData?.variant as RoomBoomDashVariant | undefined;
          const rawOrigin = data.extraData?.origin;
          const rawDestination = data.extraData?.destination ?? data.position;
          if (variant && rawOrigin && rawDestination) {
            const origin = new Vector3(rawOrigin.x, rawOrigin.y, rawOrigin.z);
            const destination = new Vector3(rawDestination.x, rawDestination.y, rawDestination.z);
            const rawLightningTarget = data.extraData?.lightningTarget;
            const lightningTarget = rawLightningTarget
              ? new Vector3(rawLightningTarget.x, rawLightningTarget.y, rawLightningTarget.z)
              : undefined;
            const key = data.extraData?.key as RoomBoomDashKey | undefined;
            createRoomBoomDashVfx(variant, origin, destination, lightningTarget, key, { vfxOnly: true });
          }
        } else if (data.abilityType === 'rebuke') {
          if (data.playerId === socket?.id) return;
          const strikePos = new Vector3(data.position.x, data.position.y, data.position.z);
          spawnRebukeFlameStrikeVfx(strikePos);
        } else if (data.abilityType === 'smite') {

          // Create smite visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const infestedSmite = !!(data.extraData && data.extraData.infestedSmite);
          const staggeringSmite = !!(data.extraData && data.extraData.staggeringSmite);
          const infernalSmite = !!(data.extraData && data.extraData.infernalSmite);
          const vengeanceSmite = !!(data.extraData && data.extraData.vengeanceSmite);
          const remoteSmiteAspect =
            (data.extraData?.weaponAspect as WeaponAspect | undefined) ??
            players.get(data.playerId)?.weaponAspect;
          createPvpSmiteEffect(data.playerId, position, undefined, {
            sequenceDelaySec: 0,
            infestedSmite,
            staggeringSmite,
            infernalSmite,
            vengeanceSmite,
            ...(remoteSmiteAspect ? { weaponAspect: remoteSmiteAspect } : {}),
          });
          const trinityExtras = data.extraData?.trinityExtras as
            | Array<{ position: { x: number; y: number; z: number }; delaySec?: number }>
            | undefined;
          if (trinityExtras?.length) {
            for (const ex of trinityExtras) {
              createPvpSmiteEffect(
                data.playerId,
                new Vector3(ex.position.x, ex.position.y, ex.position.z),
                undefined,
                {
                  sequenceDelaySec: ex.delaySec ?? 0,
                  infestedSmite,
                  staggeringSmite,
                  infernalSmite,
                  vengeanceSmite,
                  ...(remoteSmiteAspect ? { weaponAspect: remoteSmiteAspect } : {}),
                },
              );
            }
          }

          // Update player state to show smiting animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isSmiting: true
            });

            // Reset smite state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSmiting: false
                  });
                }
                return updated;
              });
            }, 900); // Smite animation duration

            return updated;
          });
        } else if (data.abilityType === 'colossusStrike') {

          // Create colossus strike visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const damage = (data.extraData && data.extraData.damage) ? data.extraData.damage : 100;
          createPvpColossusStrikeEffect(data.playerId, position, damage, undefined); // No healing callback for remote players

        } else if (data.abilityType === 'lightningStorm') {

          // Create lightning storm visual effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const damage = (data.extraData && data.extraData.damage) ? data.extraData.damage : LIGHTNING_BOLT_ROOM_DAMAGE;
          createLightningStormEffect(data.playerId, position, damage, undefined); // No healing callback for remote players

          // Update player state to show colossus striking animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isCrossentropyCharging: false,
              crossentropyChargeProgress: 0,
              isSmiting: false,
              isColossusStriking: false,
              isDeathGrasping: false,
              isCorruptedAuraActive: false,
              isWraithStriking: false,
              isSkyfalling: false,
              isBackstabbing: false,
              isSundering: false,
              isStealthing: false,
              isInvisible: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isColossusStriking: true
            });

            // Reset colossus strike state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isColossusStriking: false
                  });
                }
                return updated;
              });
            }, 1200); // Colossus Strike animation duration

            return updated;
          });
        } else if (data.abilityType === 'windShear') {

          // Create wind shear projectile visual effect
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          createPvpWindShearEffect(data.playerId, position, direction);

          // Update player state to show wind shearing animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isCrossentropyCharging: false,
              crossentropyChargeProgress: 0,
              isSmiting: false,
              isColossusStriking: false,
              isWindShearing: false,
              isWindShearCharging: false,
              windShearChargeProgress: 0,
              isDeathGrasping: false,
              isCorruptedAuraActive: false,
              isWraithStriking: false,
              isSkyfalling: false,
              isBackstabbing: false,
              isSundering: false,
              isStealthing: false,
              isInvisible: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isWindShearing: true
            });

            // Reset wind shear state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isWindShearing: false,
                    isWindShearCharging: false,
                    windShearChargeProgress: 0
                  });
                }
                return updated;
              });
            }, 200); // Wind shear animation duration

            return updated;
          });
        } else if (data.abilityType === 'deathgrasp') {

          // Create death grasp visual effect (taunt/pull applied on confirmed hit)
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          createPvpDeathGraspEffect(data.playerId, position, direction);

          // Update player state to show death grasping animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isDeathGrasping: true
            });

            // Reset death grasp state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isDeathGrasping: false
                  });
                }
                return updated;
              });
            }, 1200); // Death grasp animation duration

            return updated;
          });
        } else if (data.abilityType === 'wraith_strike') {

          // Update player state to show wraith striking animation
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isWraithStriking: true
            });

            // Reset wraith strike state after animation duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isWraithStriking: false
                  });
                }
                return updated;
              });
            }, 550); // Wraith strike animation duration

            return updated;
          });

          // Create Haunted Soul effect for remote players (caster talent → red VFX)
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const wrathfulStrike = !!(data.extraData && data.extraData.wrathfulStrike);
          const infestedStrike = !!(data.extraData && data.extraData.infestedStrike);
          pvpAbilityLayerRef.current?.addHauntedSoul({
            id: Date.now(),
            playerId: data.playerId,
            position: position,
            startTime: Date.now(),
            duration: 800,
            wrathfulStrike,
            infestedStrike,
          });

          const wraithDirection = data.direction
            ? new Vector3(data.direction.x, data.direction.y, data.direction.z)
            : new Vector3(0, 0, 1);
          wraithDirection.y = 0;
          if (wraithDirection.lengthSq() < 1e-8) {
            wraithDirection.set(0, 0, 1);
          } else {
            wraithDirection.normalize();
          }

          const wraithStrikeTheme = resolveWraithStrikeThemeFromMeta(
            {
              wrathfulStrike,
              infestedStrike,
              wraithGuard: !!(data.extraData && data.extraData.wraithGuard),
              staggeringStrike: !!(data.extraData && data.extraData.staggeringStrike),
            },
            players.get(data.playerId)?.weaponAspect,
          );

          const remoteWraithStrikeImpact: ImpactEffectEvent = {
            id: `wraith_strike_remote_${Date.now()}_${Math.random()}`,
            type: 'wraith-strike-effect',
            position: position.clone(),
            direction: wraithDirection,
            timestamp: Date.now(),
            colorVariant: wraithStrikeTheme,
          };
          combatFeedbackLayerRef.current?.addImpacts([remoteWraithStrikeImpact]);
          if (combatFeedbackLayerRef.current?.flushPendingImpacts()) {
            combatFeedbackLayerRef.current?.mountImpacts();
          }

          if (data.extraData?.breathWeapon) {
            const breathDirection = data.direction
              ? new Vector3(data.direction.x, data.direction.y, data.direction.z)
              : new Vector3(0, 0, 1);
            createBreathWeaponEffect(position, breathDirection, {
              wrathfulStrike: !!(data.extraData && data.extraData.wrathfulStrike),
              infestedStrike: !!(data.extraData && data.extraData.infestedStrike),
              staggeringStrike: !!(data.extraData && data.extraData.staggeringStrike),
              wraithGuard: !!(data.extraData && data.extraData.wraithGuard),
            });
          }
        } else if (data.abilityType === 'charge') {
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSwordCharging: true
            });
            
            // Reset Charge state after duration (charge lasts about 2 seconds)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSwordCharging: false
                  });
                }
                return updated;
              });
            }, 2000);
            
            return updated;
          });
        } else if (data.abilityType === 'deflect') {
          
          // Trigger visual Deflect Shield effect at the player's position
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Calculate rotation from direction for shield positioning
          const rotation = new Vector3(0, Math.atan2(direction.x, direction.z), 0);
          const remoteWeapon = players.get(data.playerId)?.weapon ?? WeaponType.RUNEBLADE;
          triggerGlobalDeflectShield(
            position,
            rotation,
            data.playerId,
            remoteWeapon,
            data.extraData?.aegisRoomBoon ? 'purple_room_boon' : 'default',
          );
          
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isDeflecting: true
            });
            
            // Reset Deflect state after duration (deflect lasts 3 seconds)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isDeflecting: false
                  });
                }
                return updated;
              });
            }, 3000);
            
            return updated;
          });
        } else if (data.abilityType === 'deflectShift') {
          // Shift-tap Deflect-Block (remote peer) — independent gold shield rendered directly by
          // DragonRenderer via `isBlockingDeflect`, no global shield-manager trigger needed here.
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isBlockingDeflect: true
            });

            // Reset Deflect-Block state after its duration (Shift-Deflect lasts 1 second).
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isBlockingDeflect: false
                  });
                }
                return updated;
              });
            }, DEFLECT_SHIFT_DURATION_SEC * 1000);

            return updated;
          });
        } else if (data.abilityType === 'deflectSmite') {
          // Remote peer's Shift-Deflect smite — visual-only mirror; damage stays client-authoritative
          // on the caster's machine (via `enemy-damage`), so no onHit callback fires here.
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const baseCleanupMs = 1200;
          const remoteDeflectSmiteEffect: DeflectSmiteEffectState = {
            id: nextDeflectSmiteEffectId.current++,
            playerId: data.playerId,
            position,
            damage: 0,
            startTime: Date.now(),
            duration: baseCleanupMs,
          };
          pvpAbilityLayerRef.current?.addDeflectSmite(remoteDeflectSmiteEffect);
          setTimeout(() => {
            pvpAbilityLayerRef.current?.removeDeflectSmite(remoteDeflectSmiteEffect.id);
          }, remoteDeflectSmiteEffect.duration);
        } else if (data.abilityType === 'locustMissile') {
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = data.direction
            ? new Vector3(data.direction.x, data.direction.y, data.direction.z)
            : new Vector3(0, 0, -1);
          const extra = data.extraData ?? {};
          const remoteTargetEnemyId: string | null =
            typeof data.target === 'string' ? data.target : null;
          const remoteLiveEnemies = getLiveCoopEnemyData().filter((e) => e.health > 0);
          const remoteTargetEnemy = remoteTargetEnemyId
            ? remoteLiveEnemies.find((e) => e.id === remoteTargetEnemyId)
            : undefined;
          const remoteFallbackTargetPosition = remoteTargetEnemy
            ? remoteTargetEnemy.position.clone()
            : position.clone().add(direction.clone().multiplyScalar(2.5));

          const remoteLocustEffect: LocustProjectileEffectState = {
            id: nextLocustEffectId.current++,
            playerId: data.playerId,
            startPosition: position,
            initialDirection: direction,
            spreadIndex: typeof extra.spreadIndex === 'number' ? extra.spreadIndex : 0,
            volleyId: typeof extra.volleyId === 'number' ? extra.volleyId : 0,
            targetEnemyId: remoteTargetEnemyId,
            fallbackTargetPosition: remoteFallbackTargetPosition,
            damage: typeof extra.damage === 'number' ? extra.damage : 0,
          };
          pvpAbilityLayerRef.current?.addLocustProjectile(remoteLocustEffect);
        } else if (data.abilityType === 'skyfall') {
          
          // Set the skyfall animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSkyfalling: true
            });
            
            // Reset Skyfall state after duration (skyfall lasts about 3-4 seconds total)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSkyfalling: false
                  });
                }
                return updated;
              });
            }, 1750); // Skyfall duration
            
            return updated;
          });
        } else if (data.abilityType === 'backstab') {
          
          // Backstab is an instant melee attack, so we need to:
          // 1. Calculate damage based on position relative to targets
          // 2. Apply damage to players in range
          // 3. Show brief animation state
          
          const attackerPosition = new Vector3(data.position.x, data.position.y, data.position.z);
          const attackerDirection = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          
          // Set the backstab animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isDeflecting: false,
              isSwordCharging: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            // Set backstab animation state
            updated.set(data.playerId, {
              ...currentState,
              isBackstabbing: true,
              backstabVorpalGust: !!data.extraData?.vorpalGust,
              backstabVorpalGustTheme: (() => {
                const raw = data.extraData?.vorpalGustTheme;
                const ok =
                  raw === 'wrathful' ||
                  raw === 'staggering' ||
                  raw === 'infested' ||
                  raw === 'guard';
                return ok ? raw : 'default';
              })(),
            });
            
            // Reset backstab animation after duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const currentState = updated.get(data.playerId);
                if (currentState) {
                  updated.set(data.playerId, {
                    ...currentState,
                    isBackstabbing: false,
                    backstabVorpalGust: false,
                    backstabVorpalGustTheme: undefined,
                  });
                }
                return updated;
              });
            }, 1000); // Match backstab duration
            
            return updated;
          });
          
          // Find the attacker player to get their rotation
          const attackerPlayer = players.get(data.playerId);
          if (attackerPlayer) {
            // Check if local player is in range and calculate damage
            const localPlayer = players.get(socket?.id || '');
            if (localPlayer && socket?.id !== data.playerId) {
              const localPlayerPos = new Vector3(
                localPlayer.position.x,
                localPlayer.position.y,
                localPlayer.position.z,
              );
              const vorpalRemote = !!data.extraData?.vorpalGust;
              let inAttackShape = false;
              if (vorpalRemote) {
                const beam = evaluateVorpalGustBeamHit(
                  attackerPosition,
                  attackerDirection,
                  localPlayerPos,
                );
                inAttackShape = beam.ok;
              } else {
                const distance = attackerPosition.distanceTo(localPlayerPos);
                if (distance <= 2.5) {
                  const directionToLocal = new Vector3()
                    .subVectors(localPlayerPos, attackerPosition)
                    .normalize();
                  const dotProduct = attackerDirection.dot(directionToLocal);
                  const angleThreshold = Math.cos(Math.PI / 3);
                  inAttackShape = dotProduct >= angleThreshold;
                }
              }

              if (inAttackShape) {
                  // Local player is in the attack cone, calculate backstab damage
                  let damage = 75; // Base damage
                  let isBackstab = false;
                  
                  // Calculate local player's facing direction from their rotation
                  const localFacingDirection = new Vector3(
                    Math.sin(localPlayer.rotation.y),
                    0,
                    Math.cos(localPlayer.rotation.y)
                  ).normalize();
                  
                  // Vector from local player to attacker
                  const attackerDirectionFromLocal = new Vector3()
                    .subVectors(attackerPosition, localPlayerPos)
                    .normalize();
                  
                  // Check if attacker is behind local player (dot product < 0 means opposite direction)
                  const behindDotProduct = localFacingDirection.dot(attackerDirectionFromLocal);
                  isBackstab = behindDotProduct < -0.3; // 70 degree cone behind target
                  
                  if (isBackstab) {
                    damage = 150; // Backstab damage
                  }
                  
                  // Apply damage to local player
                  if (broadcastPlayerDamage && socket?.id) {
                    broadcastPlayerDamage(socket.id, damage, 'backstab');
                  }
              }
            }
          }
          
          // Show brief backstab animation state
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isFrozen: false
            };
            
            updated.set(data.playerId, {
              ...currentState,
              isSwinging: true // Brief swing animation for backstab
            });
            
            // Reset swing state after brief duration
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSwinging: false
                  });
                }
                return updated;
              });
            }, 300); // Brief 300ms animation
            
            return updated;
          });
        } else if (data.abilityType === 'sunder') {

          // Set the sunder animation state for the attacking player
          setMultiplayerPlayerStates(prev => {
            const updated = new Map(prev);
            const currentState = updated.get(data.playerId) || {
              isCharging: false,
              chargeProgress: 0,
              isSwinging: false,
              swordComboStep: 1 as 1 | 2 | 3,
              isSpinning: false,
              isSwordCharging: false,
              isDeflecting: false,
              isViperStingCharging: false,
              viperStingChargeProgress: 0,
              isBarrageCharging: false,
              barrageChargeProgress: 0,
              isCobraShotCharging: false,
              cobraShotChargeProgress: 0,
              isSkyfalling: false,
              isBackstabbing: false,
              // Add missing Runeblade animation states
              isSmiting: false,
              isDeathGrasping: false,
              isWraithStriking: false,
              isCorruptedAuraActive: false,
              isSundering: false,
              isFrozen: false
            };

            updated.set(data.playerId, {
              ...currentState,
              isSundering: true
            });

            // Reset sunder animation after duration (match the 1.5 second duration from ControlSystem)
            setTimeout(() => {
              setMultiplayerPlayerStates(prev => {
                const updated = new Map(prev);
                const state = updated.get(data.playerId);
                if (state) {
                  updated.set(data.playerId, {
                    ...state,
                    isSundering: false
                  });
                }
                return updated;
              });
            }, 1500); // Sunder animation duration

            return updated;
          });
        } else if (data.abilityType === 'summon_totem') {
          // Trigger remote totem creation via PVPSummonTotemManager

          if ((window as any).triggerGlobalSummonTotem) {
            const position = new Vector3(data.position.x, data.position.y, data.position.z);
            const totemBoltVariant = data.extraData?.totemBoltVariant as ReturnType<
              typeof getTotemBoltVariantFromTalentLoadout
            > | undefined;
            const superconductor = data.extraData?.superconductor === true;
            const remoteAspect =
              (data.extraData?.weaponAspect as WeaponAspect | undefined) ??
              players.get(data.playerId)?.weaponAspect;
            (window as any).triggerGlobalSummonTotem(
              position,
              undefined, // Let PVPSummonTotemManager handle enemy data
              undefined, // Let PVPSummonTotemManager handle damage callback
              undefined, // Let PVPSummonTotemManager handle effects
              undefined, // Let PVPSummonTotemManager handle active effects
              undefined, // Let PVPSummonTotemManager handle damage numbers
              undefined, // Let PVPSummonTotemManager handle damage number ID
              data.playerId, // Remote caster ID (visual-only damage; local client does not apply hits)
              totemBoltVariant,
              superconductor,
              undefined,
              remoteAspect,
            );
          }
        }
      }

      // Play enemy ability sound effects at 50% volume
      const position = new Vector3(data.position.x, data.position.y, data.position.z);
      if (window.audioSystem) {
        switch (data.abilityType) {
          case 'rejuvenating_shot':
            window.audioSystem.playEnemyBowReleaseSound(position, data.animationData?.chargeProgress);
            break;
          case 'frost_nova':
            window.audioSystem.playEnemyFrostNovaSound(position);
            break;
          case 'reanimate':
            // Reanimate doesn't have a specific sound, uses healing sound which is handled separately
            break;
          case 'smite':
            window.audioSystem.playEnemyRunebladeSmiteSound(position);
            break;
          case 'colossusStrike':
            window.audioSystem.playEnemyColossusStrikeSound(position);
            break;
          case 'lightningStorm':
            window.audioSystem.playEnemyColossusStrikeSound(position); // Reuse colossus strike sound for lightning storm
            break;
          case 'windShear':
            window.audioSystem.playEnemyWindshearSound(position);
            break;
          case 'deathgrasp':
            window.audioSystem.playEnemyRunebladeVoidGraspSound(position);
            break;
          case 'wraith_strike':
            window.audioSystem.playEnemyRunebladeWraithbladeSound(position);
            break;
          case 'charge':
            window.audioSystem.playEnemySwordChargeSound(position);
            break;
          case 'deflect':
            window.audioSystem.playEnemySwordDeflectSound(position);
            break;
          case 'skyfall':
            window.audioSystem.playEnemySabresSkyfallSound(position);
            break;
          case 'backstab':
            window.audioSystem.playEnemyBackstabSound(position);
            break;
          case 'sunder':
            window.audioSystem.playEnemySabresFlourishSound(position);
            break;
          case 'stealth':
            window.audioSystem.playEnemySabresShadowStepSound(position);
            break;
        }
      }
    };

    const handlePlayerDamaged = (data: any) => {
      let targetActuallyDied = false;
      let localPlayerDamageApplied: boolean | null = null;
      const playerEntity = getLocalPlayerEntity();

      // If we are the target, apply damage to our player
      if (data.targetPlayerId === socket?.id && playerEntity && socket?.id) {
        // Check if player is already in death state - if so, ignore damage
        const deathState = playerDeathStates.get(socket.id);
        if (deathState?.isDead) {
          return;
        }

        if (data.damageType !== 'hunger' && blockLocalDamageDuringCoopPortal()) {
          const healthForPortal = playerEntity.getComponent(Health);
          if (healthForPortal) {
            reconcileLivingServerHealth(healthForPortal, data);
          }
          return;
        }
        const health = playerEntity.getComponent(Health);
        const shield = playerEntity.getComponent(Shield);
        if (health) {
          // Track if player was alive before damage
          const wasAlive = !health.isDead;

          if (data.damageType === 'hunger') {
            const applied =
              typeof data.damage === 'number'
                ? data.damage
                : Math.max(0, health.currentHealth - (typeof data.newHealth === 'number' ? data.newHealth : health.currentHealth));
            if (typeof data.newHealth === 'number') {
              health.currentHealth = Math.max(0, data.newHealth);
            } else {
              health.currentHealth = Math.max(0, health.currentHealth - applied);
            }
            if (health.currentHealth <= 0) {
              health.isDead = true;
            }
            lastEmittedNetworkHealthRef.current = {
              health: health.currentHealth,
              maxHealth: health.maxHealth,
            };

            const transform = playerEntity.getComponent(Transform);
            const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
            if (transform && damageNumberManager && applied > 0) {
              const pos = transform.position.clone();
              pos.y -= 0.5;
              damageNumberManager.addDamageNumber(applied, false, pos, 'hunger', true);
            }

            if (wasAlive && health.isDead) {
              targetActuallyDied = true;
              handlePlayerDeath(socket.id, data.sourcePlayerId);
            }
            return;
          } else if (data.persephoneTriggered) {
            const savedHp = typeof data.newHealth === 'number'
              ? data.newHealth
              : Math.floor(health.maxHealth * 0.9);
            health.currentHealth = Math.min(health.maxHealth, Math.max(1, savedHp));
            health.isDead = false;
            updatePlayerHealth(health.currentHealth, health.maxHealth);
            reconcileLivingServerHealth(health, data);
            return;
          }

          if (data.wasSoulBond || data.damageType === 'soul_bond_blocked') {
            const transform = playerEntity.getComponent(Transform);
            const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
            if (transform && damageNumberManager) {
              const pos = transform.position.clone();
              pos.y -= 0.5;
              damageNumberManager.addDamageNumber(
                0,
                false,
                pos,
                'soul_bond_blocked',
                true,
                undefined,
                undefined,
                'SOUL BOND',
              );
            }
            reconcileLivingServerHealth(health, data);
            return;
          }

          if (data.wasDodged || data.damageType === 'dodge_blocked') {
            const transform = playerEntity.getComponent(Transform);
            const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
            if (transform && damageNumberManager) {
              const pos = transform.position.clone();
              pos.y -= 0.5;
              damageNumberManager.addDamageNumber(
                0,
                false,
                pos,
                'dodge_blocked',
                true,
                undefined,
                undefined,
                'DODGE',
              );
            }
            reconcileLivingServerHealth(health, data);
            return;
          }

          const transform = playerEntity.getComponent(Transform);
          const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
          const incomingDamagePosition = transform?.position.clone();
          if (incomingDamagePosition) {
            incomingDamagePosition.y -= 0.5;
          }

          const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
            damage: data.damage,
            damageType: data.damageType ?? 'default',
            isCritical: data.isCritical || false,
            sourceEnemyId: data.sourceEnemyId,
            playerEntity,
            health,
            shield,
            allowPvpIframeBypass: true,
            damageNumberManager,
            damageNumberPosition: incomingDamagePosition,
          });
          localPlayerDamageApplied = damageApplied;

          if (transform) {
              triggerAppliedLocalPlayerDamageFeedback({
                damage: data.damage,
                damageType: data.damageType,
                damageApplied,
                health,
                healthBefore,
                shield,
                shieldBefore,
                position: transform.position,
                attackerServerEnemyId: data.sourceEnemyId,
              });

              if (data.damageType === 'shade_dagger' && damageApplied) {
                window.audioSystem?.playShadeDamageSound(
                  transform.position,
                  shadeDamageVariant.current,
                );
                shadeDamageVariant.current =
                  shadeDamageVariant.current === 3 ? 1 : ((shadeDamageVariant.current + 1) as 1 | 2 | 3);
              }

              if (data.damageType === 'titan_bladestorm' && damageApplied) {
                const now = Date.now();
                if (now - lastTitanBladestormWhirwindAt.current >= 1000) {
                  lastTitanBladestormWhirwindAt.current = now;
                  window.audioSystem?.playTitanBladestormDamageSound(transform.position);
                }
              }

              if (data.damageType === 'titan_stomp' && damageApplied) {
                applyLocalPlayerStun(2100, 'titan-stomp-stun');
              }

              if (data.damageType === 'sentinel_void_orb' && damageApplied) {
                window.audioSystem?.playEnemyFireboltSound(transform.position);
              }
          }

          // Broadcast shield changes to other players
          if (shield) {
            updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
          }

          // Check if player just died
          if (wasAlive && health.isDead) {
            targetActuallyDied = true;
            handlePlayerDeath(socket.id, data.sourcePlayerId);
          } else {
            reconcileLivingServerHealth(health, data);
          }
        }
      }

      // Check if we are the source of damage that killed another player
      // Only award experience if our damage ACTUALLY killed the target (not just what backend thought)
      if (data.sourcePlayerId === socket.id && data.targetPlayerId !== socket.id) {
        // For remote players, we need to check if they actually died
        // STRICT VALIDATION: Only award experience if backend says wasKilled AND health is exactly 0
        const remotePlayerDied = !targetActuallyDied && data.wasKilled && data.newHealth === 0;

        // Additional validation: Check if target player is actually removed from players map (truly dead)
        const targetPlayerStillExists = players.has(data.targetPlayerId);
        
        // All EXP awards are now handled by the server via player-experience-gained events
        // The frontend no longer does any kill detection or EXP calculation
        if (targetActuallyDied || remotePlayerDied) {
        }
      }

      // Check if we are the source of damage that killed a summoned unit
      if (data.sourcePlayerId === socket.id && data.damageType === 'summoned_unit_kill') {
        // EXP award is now handled by the server via player-experience-gained event
      }

      // Check if we are the source of damage that killed an enemy
      if (data.sourcePlayerId === socket.id && data.damageType === 'enemy_kill') {
        // EXP award is now handled by the server via player-experience-gained event
      }

      // Legacy R3F damage numbers — only when damage actually landed (blocked hits use CombatSystem VFX above).
      if (
        onDamageNumbersUpdate &&
        socket.id &&
        data.targetPlayerId === socket.id &&
        localPlayerDamageApplied === true
      ) {
        // Get the position of the local player (who was damaged)
        const localPlayer = players.get(socket.id);
        if (localPlayer) {
          const damagePosition = new Vector3(
            localPlayer.position.x,
            localPlayer.position.y + 1.5, // Offset above player
            localPlayer.position.z
          );

          const damageNumberId = Math.random().toString(36).substr(2, 9);
          onDamageNumbersUpdate([{
            id: damageNumberId,
            damage: data.damage,
            position: damagePosition,
            isCritical: false, // PVP damage doesn't have crits currently
            timestamp: Date.now(),
            damageType: data.damageType || 'default' // Use the damage type from the broadcast
          }]);
        }
      }
    };

    const handleBossSkeletonAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      // If we are the target, apply damage to our player
      if (data.targetPlayerId === socket?.id && playerEntity && socket?.id) {
        if (blockLocalDamageDuringCoopPortal()) return;
        // Check if player is already in death state - if so, ignore damage
        const deathState = playerDeathStates.get(socket.id);
        if (deathState?.isDead) {
          return;
        }

        const health = playerEntity.getComponent(Health);
        const shield = playerEntity.getComponent(Shield);
        if (health) {
          // Track if player was alive before damage
          const wasAlive = !health.isDead;

          // Apply damage from boss skeleton (treat as physical damage from enemy)
          // Use standard invulnerability rules for enemy damage
          const healthBefore = health.currentHealth;
          const shieldBefore = shield?.currentShield;
          const damageApplied = health.takeDamage(data.damage, Date.now() / 1000, playerEntity, false);

          // Display incoming damage numbers
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              // Boss skeleton damage is not critical
              const isCritical = false;

              // Directly add damage numbers using the combat system's damage number manager
              const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
              if (damageNumberManager && damageNumberManager.addDamageNumber) {
                const incomingDamagePosition = transform.position.clone();
                incomingDamagePosition.y -= 0.5; // Position below player's feet

                damageNumberManager.addDamageNumber(
                  data.damage,
                  isCritical,
                  incomingDamagePosition,
                  'physical', // Boss skeleton damage type
                  true // isIncomingDamage = true
                );
              }

              triggerAppliedLocalPlayerDamageFeedback({
                damage: data.damage,
                damageType: 'physical',
                damageApplied,
                health,
                healthBefore,
                shield,
                shieldBefore,
                position: transform.position,
                attackerServerEnemyId: data.skeletonId,
              });
            }
          }

          // Broadcast shield changes to other players
          if (shield) {
            updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
          }

          // Check if player died from this damage
          if (wasAlive && health.isDead) {
            // Handle player death from boss skeleton attack
            handlePlayerDeath(socket.id, data.skeletonId);
          }
        }
      }
    };

    // Knight telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleKnightAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      // Server applies damage after ~1000ms — wait slightly longer before calling it a miss
      const timer = setTimeout(() => {
        knightPendingMissTimers.current.delete(data.knightId);
        window.audioSystem?.playKnightMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 1000) + 50);
      knightPendingMissTimers.current.set(data.knightId, timer);
    };

    // Allied knight melee — all clients hear swing miss/hit (reuses enemy knight SFX)
    const handleAlliedKnightAttackTelegraph = (data: {
      knightId?: string;
      position?: { x: number; y: number; z: number };
    }) => {
      if (!data.knightId) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      scheduleKnightStyleMiss(data.knightId, pos);
    };

    // Ghoul / allied-demon telegraph — schedule knight miss; cancel on hit
    const handleGhoulAttackTelegraph = (data: {
      ghoulId?: string;
      targetPlayerId?: string;
      targetCombatAllyId?: string;
      position?: { x: number; y: number; z: number };
    }) => {
      if (!data.ghoulId) return;
      const attacker = enemiesRef.current.get(data.ghoulId);
      const attackerType = attacker?.type;
      const isAlliedDemon = attackerType === 'allied-demon';
      const isEnemyGhoul = attackerType === 'ghoul' || !attacker;
      if (isAlliedDemon) {
        const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
        scheduleKnightStyleMiss(data.ghoulId, pos);
        return;
      }
      // Enemy ghoul: only the targeted local player schedules miss (same as knight)
      if (!isEnemyGhoul || !isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      scheduleKnightStyleMiss(data.ghoulId, pos, 1100, showLocalPlayerMissNumber);
    };

    const handlePlayerZombieAttackTelegraph = (data: {
      zombieId?: string;
      position?: { x: number; y: number; z: number };
    }) => {
      if (!data.zombieId) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      scheduleKnightStyleMiss(data.zombieId, pos);
    };

    const clearTentacleSpineGroundTelegraphForSocket = clearTentacleSpineGroundTelegraph;

    const handleTentacleSpineWindup = (data: {
      enemyId?: string;
      dirX?: number;
      dirZ?: number;
      position?: { x: number; y: number; z: number };
      lineLength?: number;
      timestamp?: number;
    }) => {
      const enemyId = data?.enemyId;
      if (!enemyId || !data.position) return;
      const eventTime = data.timestamp ?? Date.now();
      const endAt = eventTime + TENTACLE_SPINE_WINDUP_MS;
      if (endAt <= Date.now()) return;
      const lastSlamAt = tentacleSpineLastSlamAtRef.current.get(enemyId);
      if (lastSlamAt !== undefined && eventTime <= lastSlamAt) return;

      const lineLen = data.lineLength ?? 10;
      const dirX = data.dirX ?? 0;
      const dirZ = data.dirZ ?? 1;
      const hLen = Math.hypot(dirX, dirZ) || 1e-6;
      const nx = dirX / hLen;
      const nz = dirZ / hLen;
      const { x, y, z } = data.position;
      const groundY = y + 0.03;
      const from = new Vector3(x, groundY, z);
      const to = new Vector3(x + nx * lineLen, groundY, z + nz * lineLen);
      const lineId = `tentacle-tg-${enemyId}-${eventTime}`;
      const startedAt = eventTime;

      clearTentacleSpineGroundTelegraphForSocket(enemyId);

      {
        const prevFx = tentacleSpineFxRef.current.get(enemyId) ?? { windSeq: 0, slamSeq: 0, dir: { x: 0, z: 1 } };
        const nextFx = {
          windSeq: prevFx.windSeq + 1,
          slamSeq: prevFx.slamSeq,
          dir: { x: data.dirX ?? 0, z: data.dirZ ?? 1 },
          windupAt: eventTime,
          slamAt: undefined as number | undefined,
        };
        tentacleSpineLayerRef.current?.updateFx(enemyId, nextFx);
        tentacleSpineFxRef.current.set(enemyId, nextFx);
      }

      const lineDelay = Math.max(0, TENTACLE_SPINE_WINDUP_MS - TENTACLE_GROUND_TELEGRAPH_LEAD_MS);
      const removeIn = Math.max(0, endAt - Date.now());
      const addTelegraph = () => {
        groundTelegraphLayerRef.current?.addTentacleSpineTelegraph({
          id: lineId,
          enemyId,
          start: from.clone(),
          end: to.clone(),
          endAt,
          startedAt,
        });
      };
      const tAdd = setTimeout(addTelegraph, lineDelay);
      const tFail = setTimeout(() => {
        groundTelegraphLayerRef.current?.removeTentacleSpineTelegraph(lineId);
        if (tentacleSpinePendingByEnemyRef.current.get(enemyId)?.lineId === lineId) {
          tentacleSpinePendingByEnemyRef.current.delete(enemyId);
        }
      }, removeIn);
      tentacleSpinePendingByEnemyRef.current.set(enemyId, { tAdd, tFail, lineId });
    };

    const handleTentacleSpineSlamSocket = (data: {
      enemyId?: string;
      dirX?: number;
      dirZ?: number;
      position?: { x: number; y: number; z: number };
      lineLength?: number;
      timestamp?: number;
    }) => {
      const enemyId = data?.enemyId;
      if (!enemyId) return;
      const impactTime = data.timestamp ?? Date.now();
      tentacleSpineLastSlamAtRef.current.set(enemyId, impactTime);
      clearTentacleSpineGroundTelegraphForSocket(enemyId);
      const dirX = data.dirX ?? 0;
      const dirZ = data.dirZ ?? 1;
      {
        const prevFx = tentacleSpineFxRef.current.get(enemyId) ?? { windSeq: 0, slamSeq: 0, dir: { x: 0, z: 1 } };
        const nextFx = {
          ...prevFx,
          slamSeq: prevFx.slamSeq + 1,
          dir: { x: dirX, z: dirZ },
          slamAt: impactTime,
        };
        tentacleSpineLayerRef.current?.updateFx(enemyId, nextFx);
        tentacleSpineFxRef.current.set(enemyId, nextFx);
      }
      if (data.position) {
        const hLen = Math.hypot(dirX, dirZ) || 1e-6;
        const nx = dirX / hLen;
        const nz = dirZ / hLen;
        const lineLen = data.lineLength ?? 10;
        const { x, y, z } = data.position;
        const groundY = y + 0.03;
        const lineId = `tentacle-impact-tg-${enemyId}-${impactTime}`;
        const endAt = impactTime + TENTACLE_SPINE_IMPACT_TELEGRAPH_MS;
        const removeIn = Math.max(0, endAt - Date.now());
        const finalLine = {
          id: lineId,
          enemyId,
          start: new Vector3(x, groundY, z),
          end: new Vector3(x + nx * lineLen, groundY, z + nz * lineLen),
          endAt,
          startedAt: impactTime,
        };
        groundTelegraphLayerRef.current?.addTentacleSpineTelegraph(finalLine);
        const tImpact = setTimeout(() => {
          groundTelegraphLayerRef.current?.removeTentacleSpineTelegraph(lineId);
          if (tentacleSpinePendingByEnemyRef.current.get(enemyId)?.lineId === lineId) {
            tentacleSpinePendingByEnemyRef.current.delete(enemyId);
          }
        }, removeIn);
        tentacleSpinePendingByEnemyRef.current.set(enemyId, { tImpact, lineId });
      }
    };

    const handleKnightAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      // Cancel pending miss sound — this attack connected
      const pendingMiss = knightPendingMissTimers.current.get(data.knightId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        knightPendingMissTimers.current.delete(data.knightId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.knightId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
          window.audioSystem?.playKnightDamageSound(pos, knightDamageVariant.current);
          knightDamageVariant.current = knightDamageVariant.current === 1 ? 2 : 1;
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.knightId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.knightId);
        }
      }
    };

    const handleKnightFrostProjectile = (data: {
      knightId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      travelMs: number;
    }) => {
      const start = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const end = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      window.audioSystem?.playEnemyFrostRaySound(start);
      projectileLayerRef.current?.addKnightFrostProjectile({
          id: `knight-frost-proj-${data.knightId}-${Date.now()}`,
          startPosition: start.clone(),
          endPosition: end.clone(),
          travelMs: data.travelMs,
        });
    };

    const handleKnightDeathGraspProjectile = (data: {
      knightId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      travelMs: number;
    }) => {
      const start = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const end = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      const projectileId = `knight-dg-proj-${data.knightId}-${Date.now()}`;
      // const telegraphId = `knight-dg-telegraph-${data.knightId}-${Date.now()}`;
      // const groundY = data.startPosition.y - 1.5 + 0.2;
      // const stripStart = new Vector3(data.startPosition.x, groundY, data.startPosition.z);
      // const stripEnd = new Vector3(data.endPosition.x, groundY, data.endPosition.z);
      window.audioSystem?.playEnemyRunebladeVoidGraspSound(start);
      // setKnightDeathGraspTelegraphs(prev => [
      //   ...prev,
      //   {
      //     id: telegraphId,
      //     start: stripStart,
      //     end: stripEnd,
      //   },
      // ]);
      projectileLayerRef.current?.addKnightDeathGraspProjectile({
          id: projectileId,
          startPosition: start.clone(),
          endPosition: end.clone(),
          travelMs: data.travelMs,
        });
    };

    const applyServerDeathGraspPull = (data: {
      targetPlayerId: string;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      coopRoomEntryToken?: number;
    }) => {
      if (blockAuthoritativePositionDuringCoopPortal(data.coopRoomEntryToken)) return;

      setPlayers(prev => {
        const updated = new Map(prev);
        const pl = updated.get(data.targetPlayerId);
        if (pl) {
          updated.set(data.targetPlayerId, {
            ...pl,
            position: { ...data.position },
            rotation: { ...data.rotation },
          });
        }
        return updated;
      });

      if (data.targetPlayerId === socket?.id) {
        if (playerEntityRef.current !== null && engineRef.current) {
          const world = engineRef.current.getWorld();
          const ent = world.getEntity(playerEntityRef.current);
          if (ent) {
            const transform = ent.getComponent(Transform);
            if (transform) {
              transform.setPosition(data.position.x, data.position.y, data.position.z);
            }
            const movement = ent.getComponent(Movement);
            if (movement) {
              movement.velocity.set(0, 0, 0);
              movement.acceleration.set(0, 0, 0);
            }
          }
        }
        updatePlayerPosition(data.position, data.rotation, { x: 0, y: 0, z: 0 });
      }
    };

    const handleKnightDeathGraspPull = (data: {
      knightId: string;
      targetPlayerId: string;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      coopRoomEntryToken?: number;
    }) => {
      applyServerDeathGraspPull(data);
    };

    const handleBoss2DeathGraspProjectiles = (data: {
      bossId: string;
      projectiles: {
        startPosition: { x: number; y: number; z: number };
        endPosition: { x: number; y: number; z: number };
      }[];
      travelMs: number;
      timestamp: number;
    }) => {
      const projectiles = data.projectiles ?? [];
      if (projectiles.length === 0) return;

      const soundStart = projectiles[0].startPosition;
      window.audioSystem?.playEnemyRunebladeVoidGraspSound(
        new Vector3(soundStart.x, soundStart.y, soundStart.z)
      );

      projectileLayerRef.current?.addKnightDeathGraspProjectiles(
        projectiles.map((projectile, index) => {
          const start = new Vector3(
            projectile.startPosition.x,
            projectile.startPosition.y,
            projectile.startPosition.z
          );
          const end = new Vector3(
            projectile.endPosition.x,
            projectile.endPosition.y,
            projectile.endPosition.z
          );

          return {
            id: `boss2-dg-proj-${data.bossId}-${data.timestamp}-${index}`,
            startPosition: start,
            endPosition: end,
            travelMs: data.travelMs,
          };
        }),
      );
    };

    const handleBoss2DeathGraspPull = (data: {
      bossId: string;
      targetPlayerId: string;
      position: { x: number; y: number; z: number };
      rotation: { x: number; y: number; z: number };
      coopRoomEntryToken?: number;
    }) => {
      applyServerDeathGraspPull(data);
    };

    const handlePlayerDeathGraspHit = (data: {
      playerId: string;
      enemyId: string;
      hitPosition: { x: number; y: number; z: number };
      pulled: boolean;
      pullPosition?: { x: number; y: number; z: number } | null;
      timestamp: number;
    }) => {
      if (!data?.enemyId) return;
      createEnemyTauntEffect(data.enemyId, DEATH_GRASP_TAUNT_MS);

      if (data.pulled && data.pullPosition) {
        const from = data.hitPosition || {
          x: data.pullPosition.x,
          y: data.pullPosition.y,
          z: data.pullPosition.z,
        };
        deathGraspPullsRef.current.set(data.enemyId, {
          from: { x: from.x, y: from.y, z: from.z },
          to: {
            x: data.pullPosition.x,
            y: data.pullPosition.y,
            z: data.pullPosition.z,
          },
          startTime: Date.now(),
          durationMs: DEATH_GRASP_PULL_DURATION_MS,
        });
        setTimeout(() => {
          deathGraspPullsRef.current.delete(data.enemyId);
        }, DEATH_GRASP_PULL_DURATION_MS + 100);
      }
    };

    const handlePlayerDeathGraspPull = (data: {
      enemyId: string;
      casterId: string;
      pullPosition: { x: number; y: number; z: number };
      durationMs?: number;
      timestamp?: number;
    }) => {
      if (!data?.enemyId || !data.pullPosition) return;
      const durationMs = data.durationMs ?? DEATH_GRASP_PULL_DURATION_MS;
      const existing = deathGraspPullsRef.current.get(data.enemyId);
      const live = enemyTransformsRef.current.get(data.enemyId);
      const enemy = enemiesRef.current.get(data.enemyId);
      const from = existing?.from ?? live?.position ?? enemy?.position ?? data.pullPosition;
      deathGraspPullsRef.current.set(data.enemyId, {
        from: { x: from.x, y: from.y, z: from.z },
        to: {
          x: data.pullPosition.x,
          y: data.pullPosition.y,
          z: data.pullPosition.z,
        },
        startTime: existing?.startTime ?? Date.now(),
        durationMs,
      });

      setTimeout(() => {
        const existingTf = enemyTransformsRef.current.get(data.enemyId);
        enemyTransformsRef.current.set(data.enemyId, {
          position: { ...data.pullPosition },
          rotation: existingTf?.rotation ?? 0,
        });
        const e = enemiesRef.current.get(data.enemyId);
        if (e) {
          e.position = { ...data.pullPosition };
        }
        deathGraspPullsRef.current.delete(data.enemyId);
      }, durationMs + 50);
    };

    // Knight Smite — physical damage (themed by soulType; wider post-Boss-2)
    const handleKnightSmite = (data: any) => {
      if (data.targetPosition) {
        const p = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);
        const variant = knightSmiteVariantFromSoulType(data.soulType);
        const widthScale =
          (typeof data.radius === 'number' ? data.radius : KNIGHT_SMITE_RADIUS_BASE) /
          KNIGHT_SMITE_RADIUS_BASE;
        lightningBurstLayerRef.current?.addKnightSmiteLightning({
            id: `knight-smite-${data.knightId}-${Date.now()}`,
            position: p.clone(),
            variant,
            widthScale
        });
        window.audioSystem?.playEnemyKnightSmiteSound(p);
      } else if (data.position) {
        window.audioSystem?.playEnemyKnightSmiteSound(
          new Vector3(data.position.x, data.position.y, data.position.z),
        );
      }

      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.knightId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.knightId,
          });
        }

        if (shield) updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        if (wasAlive && health.isDead) handlePlayerDeath(socket.id, data.knightId);
      }
    };

    const handleAlliedKnightSmiteImpact = (data: {
      knightId?: string;
      position?: { x: number; y: number; z: number };
      timestamp?: number;
    }) => {
      if (!data.position) return;
      const p = new Vector3(data.position.x, data.position.y + 1.0, data.position.z);
      lightningBurstLayerRef.current?.addKnightSmiteLightning({
        id: `allied-knight-smite-${data.knightId || 'allied-knight'}-${data.timestamp || Date.now()}`,
        position: p,
        variant: 'ally-gold',
      });
      window.audioSystem?.playEnemyKnightSmiteSound?.(p);
    };

    const handleAlliedHealerGreaterHeal = (data: {
      healerId?: string;
      targetKind?: 'player' | 'ally';
      targetId?: string;
      targetPosition?: { x: number; y: number; z: number };
      impactAt?: number;
      castMs?: number;
      healcastMs?: number;
      timestamp?: number;
    }) => {
      if (!data.targetPosition) return;
      const delay = typeof data.impactAt === 'number'
        ? Math.max(0, data.impactAt - Date.now())
        : Math.max(0, (data.castMs ?? 900) + (data.healcastMs ?? 1100));
      const timer = setTimeout(() => {
        const p = new Vector3(data.targetPosition!.x, data.targetPosition!.y, data.targetPosition!.z);
        allyCombatLayerRef.current?.addGreaterHealBeam({
            id: `greater-heal-${data.healerId || 'allied-healer'}-${data.timestamp || Date.now()}`,
            position: p,
            targetKind: data.targetKind,
            targetId: data.targetId
        });
        window.audioSystem?.playGreaterHealSound?.(p);
      }, delay);
      greaterHealImpactTimers.current.push(timer);
    };

    // Blue Knight — Frost Ray (magic damage + 2s movement freeze)
    const handleKnightFrost = (data: any) => {
      if (data.targetPosition) {
        const p = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);
        allyCombatLayerRef.current?.addKnightFrostImpact({
          id: `knight-frost-impact-${data.knightId}-${Date.now()}`,
          position: p.clone(),
        });
        window.audioSystem?.playFireboltImpactSound(p);
      }

      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'magical',
          sourceEnemyId: data.knightId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'frost',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.knightId,
          });
        }

        if (shield) updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        if (wasAlive && health.isDead) handlePlayerDeath(socket.id, data.knightId);

        if (damageApplied) {
          const movement = playerEntity.getComponent(Movement);
          if (movement) {
            const freezeDuration = data.slowDuration ?? KNIGHT_FROST_FREEZE_MS;
            movement.freeze(freezeDuration);
            pvpAbilityLayerRef.current?.addLocalPlayerFrozen({
              id: nextLocalPlayerFrozenEffectId.current++,
              startTime: Date.now(),
              duration: freezeDuration,
            });
            const freezePos = playerEntity.getComponent(Transform)?.position ?? realTimePlayerPositionRef.current;
            broadcastPlayerDebuff(socket.id, 'frozen', freezeDuration, {
              position: { x: freezePos.x, y: freezePos.y, z: freezePos.z },
            });
          }
        }
      }
    };

    // Frost Queen — Ice Shards (2x frost ray projectiles)
    const handleFrostQueenIceShardsProjectile = (data: {
      frostQueenId: string;
      shardIndex?: number;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      travelMs: number;
    }) => {
      const start = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const end = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      window.audioSystem?.playEnemyFrostRaySound(start);
      projectileLayerRef.current?.addKnightFrostProjectile({
        id: `frost-queen-shard-${data.frostQueenId}-${data.shardIndex ?? 0}-${Date.now()}`,
        startPosition: start.clone(),
        endPosition: end.clone(),
        travelMs: data.travelMs,
      });
    };

    const handleFrostQueenIceShardsHit = (data: any) => {
      if (data.targetPosition) {
        const p = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);
        allyCombatLayerRef.current?.addKnightFrostImpact({
          id: `frost-queen-shard-impact-${data.frostQueenId}-${data.shardIndex ?? 0}-${Date.now()}`,
          position: p.clone(),
        });
      }

      // Ally-targeted shards: impact VFX only (server applies damage + hostileFreeze).
      if (data.targetCombatAllyId) return;

      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'magical',
          sourceEnemyId: data.frostQueenId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'frost',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.frostQueenId,
          });
        }

        if (shield) updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        if (wasAlive && health.isDead) handlePlayerDeath(socket.id, data.frostQueenId);

        if (damageApplied) {
          const movement = playerEntity.getComponent(Movement);
          if (movement) {
            const freezeDuration = data.slowDuration ?? KNIGHT_FROST_FREEZE_MS;
            movement.freeze(freezeDuration);
            pvpAbilityLayerRef.current?.addLocalPlayerFrozen({
              id: nextLocalPlayerFrozenEffectId.current++,
              startTime: Date.now(),
              duration: freezeDuration,
            });
            const freezePos = playerEntity.getComponent(Transform)?.position ?? realTimePlayerPositionRef.current;
            broadcastPlayerDebuff(socket.id, 'frozen', freezeDuration, {
              position: { x: freezePos.x, y: freezePos.y, z: freezePos.z },
            });
          }
        }
      }
    };

    // Templar telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleTemplarAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        templarPendingMissTimers.current.delete(data.templarId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 1000) + 50);
      templarPendingMissTimers.current.set(data.templarId, timer);
    };

    const handleTemplarAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      // Cancel pending miss sound — this attack connected
      const pendingMiss = templarPendingMissTimers.current.get(data.templarId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        templarPendingMissTimers.current.delete(data.templarId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.templarId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.templarId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.templarId);
        }
      }
    };

    // Spectre telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleSpectreAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        spectrePendingMissTimers.current.delete(data.spectreId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 1000) + 50);
      spectrePendingMissTimers.current.set(data.spectreId, timer);
    };

    const handleSpectreAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = spectrePendingMissTimers.current.get(data.spectreId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        spectrePendingMissTimers.current.delete(data.spectreId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.spectreId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.spectreId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.spectreId);
        }
      }
    };

    // Death Knight telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleDeathKnightAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        deathKnightPendingMissTimers.current.delete(data.deathKnightId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 750) + 50);
      deathKnightPendingMissTimers.current.set(data.deathKnightId, timer);
    };

    const handleDeathKnightAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = deathKnightPendingMissTimers.current.get(data.deathKnightId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        deathKnightPendingMissTimers.current.delete(data.deathKnightId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.deathKnightId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.deathKnightId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.deathKnightId);
        }
      }
    };

    // Shaman telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleShamanAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        shamanPendingMissTimers.current.delete(data.shamanId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 800) + 50);
      shamanPendingMissTimers.current.set(data.shamanId, timer);
    };

    const handleShamanAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = shamanPendingMissTimers.current.get(data.shamanId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        shamanPendingMissTimers.current.delete(data.shamanId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.shamanId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.shamanId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.shamanId);
        }
      }
    };

    // Serpent telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleSerpentAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        serpentPendingMissTimers.current.delete(data.serpentId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 750) + 50);
      serpentPendingMissTimers.current.set(data.serpentId, timer);
    };

    const handleSerpentAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = serpentPendingMissTimers.current.get(data.serpentId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        serpentPendingMissTimers.current.delete(data.serpentId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.serpentId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.serpentId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.serpentId);
        }
      }
    };

    // Wyvern telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleWyvernAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        wyvernPendingMissTimers.current.delete(data.wyvernId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 1300) + 50);
      wyvernPendingMissTimers.current.set(data.wyvernId, timer);
    };

    const handleWyvernAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = wyvernPendingMissTimers.current.get(data.wyvernId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        wyvernPendingMissTimers.current.delete(data.wyvernId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.wyvernId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.wyvernId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.wyvernId);
        }
      }
    };

    const handleDestinyAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        wyvernPendingMissTimers.current.delete(data.destinyId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 1200) + 50);
      wyvernPendingMissTimers.current.set(data.destinyId, timer);
    };

    const handleDestinyAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = wyvernPendingMissTimers.current.get(data.destinyId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        wyvernPendingMissTimers.current.delete(data.destinyId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.destinyId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.destinyId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.destinyId);
        }
      }
    };

    // Tiger telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleTigerAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        tigerPendingMissTimers.current.delete(data.tigerId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 750) + 50);
      tigerPendingMissTimers.current.set(data.tigerId, timer);
    };

    const handleTigerAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = tigerPendingMissTimers.current.get(data.tigerId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        tigerPendingMissTimers.current.delete(data.tigerId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.tigerId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.tigerId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.tigerId);
        }
      }
    };

    const handleWolfAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        wolfPendingMissTimers.current.delete(data.wolfId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 650) + 50);
      wolfPendingMissTimers.current.set(data.wolfId, timer);
    };

    const handleWolfAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = wolfPendingMissTimers.current.get(data.wolfId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        wolfPendingMissTimers.current.delete(data.wolfId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.wolfId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.wolfId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.wolfId);
        }
      }
    };

    const handleBearAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        bearPendingMissTimers.current.delete(data.bearId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 750) + 50);
      bearPendingMissTimers.current.set(data.bearId, timer);
    };

    const handleBearAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = bearPendingMissTimers.current.get(data.bearId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        bearPendingMissTimers.current.delete(data.bearId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.bearId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.bearId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.bearId);
        }
      }
    };

    const handleBoneSpiderAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        boneSpiderPendingMissTimers.current.delete(data.spiderId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 900) + 50);
      boneSpiderPendingMissTimers.current.set(data.spiderId, timer);
    };

    const handleBoneSpiderAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = boneSpiderPendingMissTimers.current.get(data.spiderId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        boneSpiderPendingMissTimers.current.delete(data.spiderId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.spiderId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.spiderId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.spiderId);
        }
      }
    };

    // Skyray telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleSkyrayAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        skyrayPendingMissTimers.current.delete(data.skyrayId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 900) + 50);
      skyrayPendingMissTimers.current.set(data.skyrayId, timer);
    };

    const handleSkyrayAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = skyrayPendingMissTimers.current.get(data.skyrayId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        skyrayPendingMissTimers.current.delete(data.skyrayId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.skyrayId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.skyrayId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.skyrayId);
        }
      }
    };

    // Terrorhawk telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleTerrorhawkAttackTelegraph = (data: any) => {
      if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        terrorhawkPendingMissTimers.current.delete(data.terrorhawkId);
        window.audioSystem?.playTemplarMissSound(pos);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 900) + 50);
      terrorhawkPendingMissTimers.current.set(data.terrorhawkId, timer);
    };

    const handleTerrorhawkAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      const pendingMiss = terrorhawkPendingMissTimers.current.get(data.terrorhawkId);
      if (pendingMiss) {
        clearTimeout(pendingMiss);
        terrorhawkPendingMissTimers.current.delete(data.terrorhawkId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;
        const transform = playerEntity.getComponent(Transform);
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform?.position.clone();
        if (incomingPos) incomingPos.y -= 0.5;

        const { damageApplied, healthBefore, shieldBefore } = applyIncomingCoopDamage({
          damage: data.damage,
          damageType: 'physical',
          sourceEnemyId: data.terrorhawkId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });

        if (damageApplied) {
          playIncomingMeleeImpactSound(data, templarDamageVariant);
        }

        if (transform) {
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'physical',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            weightClass: data.weightClass,
            hitStopMs: data.hitStopMs,
            impactDirection: data.impactDirection,
            attackerServerEnemyId: data.terrorhawkId,
          });
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.terrorhawkId);
        }
      }
    };

    const handlePlayerAnimationState = (data: any) => {
      if (data.playerId !== socket.id) {
        const defaultState = {
          isCharging: false,
          chargeProgress: 0,
          isSwinging: false,
          swordComboStep: 1 as 1 | 2 | 3,
          isSpinning: false,
          isSwordCharging: false,
          isDeflecting: false,
          isViperStingCharging: false,
          viperStingChargeProgress: 0,
          isBarrageCharging: false,
          barrageChargeProgress: 0,
          isCobraShotCharging: false,
          cobraShotChargeProgress: 0,
          isRejuvenatingShotCharging: false,
          rejuvenatingShotChargeProgress: 0,
          isBackstabbing: false,
          isSmiting: false,
          isDeathGrasping: false,
          isWraithStriking: false,
          isCorruptedAuraActive: false,
          isSundering: false,
          isCrossentropyCharging: false,
          isSummonTotemCharging: false,
          isFrozen: false,
          isSkyfalling: false,
        };
        const currentState = multiplayerPlayerStatesRef.current.get(data.playerId) || defaultState;
        const newState = {
          ...currentState,
          ...data.animationState,
          lastAnimationUpdate: Date.now(),
        };

        if (!remoteAnimStateNeedsReactUpdate(currentState, newState)) {
          multiplayerPlayerStatesRef.current.set(data.playerId, newState);
          return;
        }

        multiplayerPlayerStatesRef.current.set(data.playerId, newState);
        setMultiplayerPlayerStates(new Map(multiplayerPlayerStatesRef.current));

          // Play enemy animation sound effects at 25% volume
          const position = new Vector3(data.position?.x || 0, data.position?.y || 0, data.position?.z || 0);
          if (window.audioSystem && data.animationState) {
            // Handle melee attack sounds - prevent duplicate sounds within 100ms
            if (data.animationState.isSwinging) {
              const now = Date.now();
              const lastSoundTime = lastMeleeSoundTime.current.get(data.playerId) || 0;
              if (now - lastSoundTime > 50) { // 100ms cooldown to prevent double sounds
                lastMeleeSoundTime.current.set(data.playerId, now);

                // Get the player's weapon type to determine which sound to play
                const player = players.get(data.playerId);
                const weaponType = player?.weapon ?? WeaponType.NONE;

                switch (weaponType) {
                  case WeaponType.SWORD:
                    // Use swordComboStep if available, otherwise default to 1
                    const swordComboStep = data.animationState.swordComboStep || 1;
                    window.audioSystem.playEnemySwordSwingSound(swordComboStep, position);
                    break;
                  case WeaponType.SABRES:
                    window.audioSystem.playEnemySabresSwingSound(position);
                    break;
                  case WeaponType.SCYTHE:
                    // Scythe melee attacks use entropic bolt sound
                    window.audioSystem.playEnemyEntropicBoltSound(position);
                    break;
                case WeaponType.RUNEBLADE:
                  window.audioSystem.playEnemyRunebladeSwingHitSound(
                    position,
                    player?.weaponAspect === 'DEATHDEALER',
                  );
                  break;
                }
              }
            }

            // Handle charging sounds - only play when charging starts (transitions from false to true)
            if (data.animationState.isCharging && !currentState.isCharging) {
              const player = players.get(data.playerId);
              const weaponType = player?.weapon ?? WeaponType.NONE;

              switch (weaponType) {
                case WeaponType.BOW:
                  window.audioSystem.playEnemyBowDrawSound(position);
                  break;
                case WeaponType.SWORD:
                  window.audioSystem.playEnemySwordChargeSound(position);
                  break;
              }
            }
          }
      }
    };

    const handlePlayerEffect = (data: any) => {
      if (data.effect?.type === 'mist') {
        const { effectType, position, duration } = data.effect;

        // Create Sabre Reaper Mist effect at the specified position
        if (position) {
          const mistPosition = new Vector3(position.x, position.y, position.z);

          const effectId = `mist_${data.playerId}_${Date.now()}_${Math.random()}`;
          const newEffect = {
            id: effectId,
            position: mistPosition,
            startTime: Date.now(),
            effectType
          };

          groundHazardLayerRef.current?.addMistEffect(newEffect);

          setTimeout(() => {
            groundHazardLayerRef.current?.removeMistEffect(effectId);
          }, duration || 1000);
        }
      }

      if (data.effect?.type === 'frost_shatter') {
        const { position } = data.effect;
        if (position) {
          const shatterPosition = new Vector3(position.x, position.y, position.z);
          spawnFrostShatterSpike(shatterPosition);
          (window as any).audioSystem?.playSabresShatterSound?.(shatterPosition, 0.6);
        }
      }

      if (data.effect?.type === 'impact_fx' && Array.isArray(data.effect.impacts)) {
        const events: ImpactEffectEvent[] = [];
        for (const raw of data.effect.impacts) {
          if (!raw || !RELAYED_PLAYER_IMPACT_TYPES.has(raw.type)) continue;
          let enemyEntityId: string | undefined;
          if (raw.type === 'psionic-blade-slice') {
            const serverEnemyId = typeof raw.enemyServerId === 'string' ? raw.enemyServerId : undefined;
            if (!serverEnemyId) continue;
            const localId = serverEnemyEntities.current.get(serverEnemyId);
            if (localId == null) continue;
            enemyEntityId = String(localId);
          }
          events.push({
            id: `${data.playerId}_${raw.id ?? `${raw.type}_${Date.now()}`}`,
            type: raw.type,
            position: new Vector3(raw.position?.x ?? 0, raw.position?.y ?? 0, raw.position?.z ?? 0),
            direction: new Vector3(raw.direction?.x ?? 0, raw.direction?.y ?? 0, raw.direction?.z ?? 0),
            timestamp: typeof raw.timestamp === 'number' ? raw.timestamp : Date.now(),
            ...(raw.colorVariant ? { colorVariant: raw.colorVariant } : {}),
            ...(raw.weaponAspect ? { weaponAspect: raw.weaponAspect } : {}),
            ...(raw.bladeSide === 'left' || raw.bladeSide === 'right' ? { bladeSide: raw.bladeSide } : {}),
            ...(enemyEntityId ? { enemyEntityId } : {}),
          });
        }
        if (events.length > 0) {
          combatFeedbackLayerRef.current?.addImpacts(events);
          combatFeedbackLayerRef.current?.mountImpactsNow();
        }
      }

      if (data.effect?.type === 'arctic_sting_blizzard' && data.effect.position) {
        spawnArcticGroundBlizzardAtFromReact(new Vector3(
          data.effect.position.x,
          data.effect.position.y,
          data.effect.position.z,
        ));
      }

      if (data.effect?.type === 'flurry_healing' && data.effect.position) {
        triggerFlurryHealingEffect(new Vector3(
          data.effect.position.x,
          data.effect.position.y,
          data.effect.position.z,
        ));
      }

      if (data.effect?.type === 'whirlwind_radial_wave') {
        const duration = typeof data.effect.duration === 'number' ? data.effect.duration : 800;
        createPvpWhirlwindRadialWaveEffect(data.playerId, duration);
      }

    };

    const handlePlayerDebuff = (data: any) => {

      const { targetPlayerId, debuffType, duration, effectData } = data;
      
      if (targetPlayerId && debuffType && duration) {
        let position: Vector3;
        
        // If this is the local player being debuffed, use the local player entity position for accuracy
        if (targetPlayerId === socket?.id) {
          const playerEntity = getLocalPlayerEntity();
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              position = transform.position.clone();
            } else {
              // Fallback to current player position from state
              position = realTimePlayerPositionRef.current.clone();
            }
          } else {
            position = realTimePlayerPositionRef.current.clone();
          }
        } else {
          // For other players, use the multiplayer context or effectData
          const targetPlayer = players.get(targetPlayerId);
          position = targetPlayer 
            ? new Vector3(targetPlayer.position.x, targetPlayer.position.y, targetPlayer.position.z)
            : (effectData?.position 
                ? new Vector3(effectData.position.x, effectData.position.y, effectData.position.z)
                : new Vector3(0, 0, 0));
        }
        
        createPvpDebuffEffect(targetPlayerId, debuffType, position, duration, {
          source: effectData?.source,
        });
      }
    };

    const handlePlayerStealth = (data: any) => {

      if (!data || !data.playerId) {
        return;
      }

      const { playerId, isInvisible } = data;

      // Update stealth state for the player
      const previousState = playerStealthStates.current.get(playerId);
      playerStealthStates.current.set(playerId, isInvisible);


    };

    const handlePlayerTornadoEffect = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, duration } = data;

      // Create the tornado effect for the remote player
      createPvpWindShearTornadoEffect(playerId, duration);
    };

    const handlePlayerDeathEffect = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, position, isStarting } = data;

      if (isStarting) {
        const deathPos = new Vector3(position.x, position.y, position.z);
        setPlayerDeathStates(prev => {
          const newState = new Map(prev);
          newState.set(playerId, {
            isDead: true,
            deathTime: Date.now(),
            deathPosition: deathPos.clone(),
          });
          return newState;
        });
        // Start death effect
        environmentVfxLayerRef.current?.setDeathEffect(playerId, {
            playerId,
            position: deathPos.clone(),
            startTime: Date.now(),
          });
      } else {
        // Stop death effect
        environmentVfxLayerRef.current?.removeDeathEffect(playerId);
      }
    };

    const handlePlayerRespawned = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, health, maxHealth, position } = data;

      console.log(`🔄 Player ${playerId} respawned at (${position?.x}, ${position?.y}, ${position?.z})`);

      // Clear death state for this player
      setPlayerDeathStates(prev => {
        const newState = new Map(prev);
        newState.delete(playerId);
        return newState;
      });

      // Clear death effect
      environmentVfxLayerRef.current?.removeDeathEffect(playerId);

      // If this is the local player respawning, update their entity and re-enable controls
      if (playerId === socket?.id) {
        console.log(`✅ Local player respawned - re-enabling controls and updating position`);
        
        // Re-enable control system
        if (controlSystemRef.current) {
          controlSystemRef.current.setPlayerDead(false);
          console.log(`✅ Controls re-enabled for local player`);
        }

        // Re-enable camera rotation
        if (cameraSystemRef.current) {
          cameraSystemRef.current.setDeathCameraDisabled(false, playerId);
          console.log(`✅ Camera rotation re-enabled for local player`);
        }

        // Update the player entity's position
        if (playerEntityRef.current !== null && engineRef.current) {
          const world = engineRef.current.getWorld();
          const playerEntity = world.getEntity(playerEntityRef.current);
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            const healthComp = playerEntity.getComponent(Health);
            
            if (transform && position) {
              // Set position to center of map
              transform.setPosition(position.x || 0, position.y || 0.5, position.z || 0);
              console.log(`✅ Player entity moved to respawn position: (${position.x || 0}, ${position.y || 0.5}, ${position.z || 0})`);
            }

            const movement = playerEntity.getComponent(Movement);
            if (movement) {
              movement.canMove = true;
            }
            realTimePlayerPositionRef.current.set(
              position?.x ?? 0,
              position?.y ?? 0.5,
              position?.z ?? 0,
            );

            if (healthComp) {
              // Ensure health is restored
              healthComp.isDead = false;
              healthComp.currentHealth = health || maxHealth || healthComp.maxHealth;
              console.log(`✅ Player health restored: ${healthComp.currentHealth}/${healthComp.maxHealth}`);
            }
          }
        }

        onLocalPlayerRevived?.();
      }

      // Update player health and position in players state
      setPlayers(prevPlayers => {
        const newPlayers = new Map(prevPlayers);
        const player = newPlayers.get(playerId);
        if (player) {
          newPlayers.set(playerId, {
            ...player,
            health: health || maxHealth,
            maxHealth: maxHealth,
            position: position || { x: 0, y: 0.5, z: 0 }
          });
        }
        return newPlayers;
      });
    };

    const handlePlayerShieldChanged = (data: any) => {
      if (!data || !data.playerId) {
        return;
      }

      const { playerId, shield, maxShield } = data;

      // Sync local player ECS shield when server (e.g. Storm Shield) updates shield.
      if (playerId === socket?.id && playerEntityRef.current !== null && engineRef.current) {
        const playerEntity = engineRef.current.getWorld().getEntity(playerEntityRef.current);
        const shieldComp = playerEntity?.getComponent(Shield);
        if (shieldComp) {
          shieldComp.setShield(shield, maxShield ?? shieldComp.maxShield);
        }
      }

      // Update the player's shield in the players state
      setPlayers(prevPlayers => {
        const newPlayers = new Map(prevPlayers);
        const player = newPlayers.get(playerId);
        if (player) {
          newPlayers.set(playerId, {
            ...player,
            shield: shield,
            maxShield: maxShield ?? player.maxShield
          });
        }
        return newPlayers;
      });
    };

    const handlePlayerKnockback = (data: any) => {
      if (!data || !data.targetPlayerId) {
        return;
      }
      if (blockAuthoritativePositionDuringCoopPortal(data.coopRoomEntryToken)) {
        return;
      }

      const { targetPlayerId, direction, distance, duration } = data;

      // Find the target player entity
      const targetEntityId = serverPlayerEntities.current.get(targetPlayerId);
      if (!targetEntityId) {
        return;
      }

      // Get the entity from the world
      const world = engineRef.current?.getWorld();
      if (!world) {
        return;
      }

      const targetEntity = world.getEntity(targetEntityId);
      if (!targetEntity) {
        return;
      }

      // Get the movement component
      const targetMovement = targetEntity.getComponent(Movement);
      if (!targetMovement) {
        return;
      }

      // Get the transform component for current position
      const targetTransform = targetEntity.getComponent(Transform);
      if (!targetTransform) {
        return;
      }

      // Apply knockback
      const knockbackDirection = new Vector3(direction.x, direction.y, direction.z);
      const currentTime = Date.now() / 1000; // Convert to seconds

      targetMovement.applyKnockback(
        knockbackDirection,
        distance,
        targetTransform.position.clone(),
        currentTime,
        duration
      );
    };

    const handlePlayerKill = (data: any) => {
      if (!data || !data.killerId || !data.victimId) {
        return;
      }

      const { killerId, victimId } = data;

      // Increment kill counter for the killer
      incrementKillCount(killerId);

      // Award 20 essence for player kills
      updatePlayerEssence(killerId, 20);
    };

    const handlePillarDestroyed = (data: any) => {
      if (!data || !data.destroyerId) {
        return;
      }

      const { destroyerId } = data;

      // Award 150 essence to the player who destroyed the pillar
      updatePlayerEssence(destroyerId, 150);
    };

    const handlePlayerEssenceChanged = (data: any) => {
      if (!data || !data.playerId || typeof data.essence !== 'number') {
        return;
      }

      const { playerId, essence } = data;

      // Update the players map with new essence
      setPlayers(prevPlayers => {
        const newPlayers = new Map(prevPlayers);
        const player = newPlayers.get(playerId);
        if (player) {
          newPlayers.set(playerId, {
            ...player,
            essence
          });
        }
        return newPlayers;
      });

      // If this is the local player, notify parent component
      if (playerId === socket?.id && onEssenceUpdate) {
        onEssenceUpdate(essence);
      }
    };

    const handlePlayerGoldChanged = (data: { playerId: string; gold: number }) => {
      if (data.playerId === socket?.id && onGoldUpdate) {
        onGoldUpdate(data.gold);
      }
    };

    const handlePlayerFlowChanged = (data: { playerId: string; flow: number }) => {
      if (data.playerId === socket?.id && onFlowUpdate) {
        onFlowUpdate(data.flow);
      }
    };

    const handlePlayerWoodChanged = (data: { playerId: string; wood: number }) => {
      if (data.playerId === socket?.id && onWoodUpdate) {
        onWoodUpdate(data.wood);
      }
    };

    const handlePlayerStoneChanged = (data: { playerId: string; stone: number }) => {
      if (data.playerId === socket?.id && onStoneUpdate) {
        onStoneUpdate(data.stone);
      }
    };

    const handlePlayerMeatChanged = (data: { playerId: string; meat: number }) => {
      if (data.playerId === socket?.id && onMeatUpdate) {
        onMeatUpdate(data.meat);
      }
    };

    const handlePlayerHungerChanged = (data: {
      playerId: string;
      hunger: number;
      starvingCritical?: boolean;
    }) => {
      if (data.playerId === socket?.id && onHungerUpdate) {
        onHungerUpdate(data.hunger, data.starvingCritical === true);
      }
    };

    const handlePlayerFateChanged = (data: { playerId: string; fate: number }) => {
      if (data.playerId === socket?.id && onFateUpdate) {
        onFateUpdate(data.fate);
      }
    };

    const enqueueLocalPickupFloatingNumber = (
      amount: number,
      damageType: 'experience_gain' | 'gold_pickup' | 'wood_pickup' | 'stone_pickup' | 'meat_pickup',
    ) => {
      if (!engineRef.current || playerEntityRef.current === null) return;
      const world = engineRef.current.getWorld();
      const combatSystem = world.getSystem(CombatSystem);
      const localEntity = world.getEntity(playerEntityRef.current);
      const transform = localEntity?.getComponent(Transform);
      const damageNumberManager = combatSystem?.getDamageNumberManager();
      if (!damageNumberManager?.addDamageNumber || !transform) return;
      const pos = transform.position.clone();
      pos.y += 1.2;
      damageNumberManager.addDamageNumber(
        amount,
        false,
        pos,
        damageType,
        false,
        undefined,
        undefined,
        undefined,
        'pickup',
      );
    };

    const handleGoldPickedUp = (data: {
      dropId: string;
      drop?: GoldDrop;
      allocations?: Array<{ playerId: string; amount: number }>;
    }) => {
      pendingGoldAutoPickupRef.current.delete(data.dropId);
      if (!socket?.id) return;
      const gained = (data.allocations || []).find(a => a.playerId === socket.id)?.amount || 0;
      if (gained <= 0) return;

      enqueueLocalPickupFloatingNumber(gained, 'gold_pickup');

      const dropPos = data.drop?.position;
      if (!dropPos) return;

      (window as any).audioSystem?.playUIGoldPickupSound?.();

      const moteCount = Math.max(3, Math.min(12, gained));
      const startTime = Date.now();
      const center = new Vector3(dropPos.x, dropPos.y + 0.2, dropPos.z);
      const nextMotes: GoldCollectMoteState[] = [];
      for (let i = 0; i < moteCount; i += 1) {
        const a = (i / moteCount) * Math.PI * 2;
        const r = 0.2 + Math.random() * 0.26;
        const start = new Vector3(
          center.x + Math.cos(a) * r,
          center.y + Math.random() * 0.25,
          center.z + Math.sin(a) * r,
        );
        nextMotes.push({
          id: `gold-mote-${data.dropId}-${startTime}-${i}`,
          startPosition: start,
          startTime: startTime + i * 18,
          duration: 420 + i * 12,
        });
      }
      environmentVfxLayerRef.current?.addGoldCollectMotes(nextMotes);
    };

    const handleWoodPickedUp = (data: {
      dropId: string;
      pickerPlayerId?: string;
      drop?: WoodDrop;
      amount?: number;
    }) => {
      pendingWoodAutoPickupRef.current.delete(data.dropId);
      if (!socket?.id || data.pickerPlayerId !== socket.id) return;
      const gained = data.amount ?? data.drop?.amount ?? 0;
      if (gained <= 0) return;

      enqueueLocalPickupFloatingNumber(gained, 'wood_pickup');

      const dropPos = data.drop?.position;
      if (!dropPos) return;

      const moteCount = Math.max(1, Math.min(20, gained));
      const startTime = Date.now();
      const center = new Vector3(dropPos.x, dropPos.y + 0.2, dropPos.z);
      const motes = [];
      for (let i = 0; i < moteCount; i += 1) {
        const a = (i / moteCount) * Math.PI * 2;
        const r = 0.18 + Math.random() * 0.22;
        motes.push({
          startPosition: new Vector3(
            center.x + Math.cos(a) * r,
            center.y + Math.random() * 0.2,
            center.z + Math.sin(a) * r,
          ),
          startTime: startTime + i * 16,
          duration: 400 + i * 10,
        });
      }
      environmentVfxLayerRef.current?.addWoodCollectBatch({
        batchId: `wood-batch-${data.dropId}-${startTime}`,
        motes,
      });
    };

    const handleStonePickedUp = (data: {
      dropId: string;
      pickerPlayerId?: string;
      drop?: StoneDrop;
      amount?: number;
    }) => {
      pendingStoneAutoPickupRef.current.delete(data.dropId);
      if (!socket?.id || data.pickerPlayerId !== socket.id) return;
      const gained = data.amount ?? data.drop?.amount ?? 0;
      if (gained <= 0) return;

      enqueueLocalPickupFloatingNumber(gained, 'stone_pickup');

      const dropPos = data.drop?.position;
      if (!dropPos) return;

      const moteCount = Math.max(1, Math.min(20, gained));
      const startTime = Date.now();
      const center = new Vector3(dropPos.x, dropPos.y + 0.2, dropPos.z);
      const motes = [];
      for (let i = 0; i < moteCount; i += 1) {
        const a = (i / moteCount) * Math.PI * 2;
        const r = 0.18 + Math.random() * 0.22;
        motes.push({
          startPosition: new Vector3(
            center.x + Math.cos(a) * r,
            center.y + Math.random() * 0.2,
            center.z + Math.sin(a) * r,
          ),
          startTime: startTime + i * 16,
          duration: 400 + i * 10,
        });
      }
      environmentVfxLayerRef.current?.addStoneCollectBatch({
        batchId: `stone-batch-${data.dropId}-${startTime}`,
        motes,
      });
    };

    const handleMeatPickedUp = (data: {
      dropId: string;
      pickerPlayerId?: string;
      drop?: MeatDrop;
      amount?: number;
    }) => {
      pendingMeatAutoPickupRef.current.delete(data.dropId);
      if (!socket?.id || data.pickerPlayerId !== socket.id) return;
      const gained = data.amount ?? data.drop?.amount ?? 0;
      if (gained <= 0) return;

      enqueueLocalPickupFloatingNumber(gained, 'meat_pickup');

      const dropPos = data.drop?.position;
      if (!dropPos) return;

      const moteCount = Math.max(1, Math.min(10, gained));
      const startTime = Date.now();
      const center = new Vector3(dropPos.x, dropPos.y + 0.2, dropPos.z);
      const motes = [];
      for (let i = 0; i < moteCount; i += 1) {
        const a = (i / moteCount) * Math.PI * 2;
        const r = 0.16 + Math.random() * 0.2;
        motes.push({
          startPosition: new Vector3(
            center.x + Math.cos(a) * r,
            center.y + Math.random() * 0.2,
            center.z + Math.sin(a) * r,
          ),
          startTime: startTime + i * 16,
          duration: 400 + i * 10,
        });
      }
      environmentVfxLayerRef.current?.addMeatCollectBatch({
        batchId: `meat-batch-${data.dropId}-${startTime}`,
        motes,
      });
    };

    const handleGoldExpired = (data: { dropId?: string }) => {
      if (data?.dropId) pendingGoldAutoPickupRef.current.delete(data.dropId);
    };

    const handleItemPickedUpForVfx = (data: {
      itemId: string;
      playerId: string;
      item: { type?: string; category?: string; stat?: string };
    }) => {
      pendingRuneAutoPickupRef.current.delete(data.itemId);
      if (!socket?.id || data.playerId !== socket.id) return;
      if (!isRuneAmuletItem(data.item)) return;

      const playerPos = realTimePlayerPositionRef.current;
      const stat = data.item.stat;
      const color = (stat && AMULET_COLORS[stat]) || '#ffffff';
      const startTime = Date.now();
      environmentVfxLayerRef.current?.addRunePickupRise({
        id: `rune-rise-${data.itemId}-${startTime}`,
        position: new Vector3(playerPos.x, playerPos.y, playerPos.z),
        color,
        startTime,
      });
    };

    const handleItemExpired = (data: { itemId?: string }) => {
      if (data?.itemId) pendingRuneAutoPickupRef.current.delete(data.itemId);
    };


    const handlePlayerHealing = (data: any) => {
      const { healingAmount, healingType, position, targetPlayerId, sourcePlayerId } = data;
      const lesserHealTypes = new Set(['smite', 'flurry', 'healing_stream', 'viper_sting', 'room_boon_fatebreaker', 'room_boon_force_of_nature', 'relentless_backstab']);
      if (lesserHealTypes.has(healingType) && position) {
        (window as any).audioSystem?.playLesserHealSound?.(
          new Vector3(position.x, position.y, position.z),
        );
      }

      // If this healing is for the local player, apply it to their health
      if (socket.id && targetPlayerId === socket.id && playerEntityRef.current !== null && engineRef.current) {
        const world = engineRef.current.getWorld();
        const localPlayerEntity = world.getEntity(playerEntityRef.current);
        if (localPlayerEntity) {
          const healthComponent = localPlayerEntity.getComponent(Health);
          if (healthComponent) {
            healthComponent.heal(healingAmount);
          }
        }
        
        // If this is Reanimate healing for the local player from another player, show the visual effect
        if (healingType === 'reanimate' && sourcePlayerId !== socket.id && reanimateRef.current) {
          reanimateRef.current.triggerHealingEffect();
        }
      }

      // Create damage numbers for ALL healing events
      // This ensures the visual feedback appears for everyone who sees the healing
      const damageNumberManager = (window as any).damageNumberManager;
      if (damageNumberManager && position) {
        const healingPosition = new Vector3(position.x, position.y, position.z);
        damageNumberManager.addDamageNumber(
          healingAmount,
          false, // Not critical
          healingPosition,
          `${healingType}_healing`, // This will be 'rejuvenating_shot_healing', 'reanimate_healing', etc.
          false // Not incoming damage
        );
      }
      
      // If this is Reanimate healing for another player, create a visual effect at their position
      if (healingType === 'reanimate' && targetPlayerId !== socket.id && position) {
        const healedPosition = new Vector3(position.x, position.y - 1.5, position.z); // Adjust back to ground level
        createPvpReanimateEffect(targetPlayerId, healedPosition);
      }
    };

    const handleEnemyHealed = (data: {
      enemyId?: string;
      healAmount?: number;
      healingType?: string;
      position?: { x: number; y: number; z: number };
      heals?: Array<{
        enemyId?: string;
        healAmount?: number;
        healingType?: string;
        position?: { x: number; y: number; z: number };
      }>;
    }) => {
      const entries = Array.isArray(data.heals) ? data.heals : [data];
      for (const entry of entries) {
        const healAmount = entry.healAmount ?? 0;
        if (
          healAmount <= 0
          || (entry.healingType !== 'rejuvenating_shot' && entry.healingType !== 'beast_regen_wolf')
        ) continue;

        let healingPosition: Vector3 | null = null;
        if (entry.position) {
          healingPosition = new Vector3(entry.position.x, entry.position.y, entry.position.z);
        } else if (entry.enemyId) {
          const enemy = enemiesRef.current.get(entry.enemyId);
          if (enemy?.position) {
            healingPosition = new Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
          }
        }
        if (!healingPosition) continue;

        healingPosition.y += 1.6;

        const damageNumberManager = (window as any).damageNumberManager;
        if (damageNumberManager?.addDamageNumber) {
          damageNumberManager.addDamageNumber(
            healAmount,
            false,
            healingPosition,
            entry.healingType === 'beast_regen_wolf' ? 'beast_regen_healing' : 'rejuvenating_shot_healing',
            false,
          );
        }
      }
    };

    const handlePlayerExperienceGained = (data: any) => {
      const { playerId, experienceGained, source, timestamp } = data;

      // Only award EXP to the local player
      if (playerId === socket?.id) {
        if (typeof experienceGained === 'number' && experienceGained > 0) {
          enqueueLocalPickupFloatingNumber(experienceGained, 'experience_gain');
        }
        setPlayerExperience(prev => {
          const newExp = prev + experienceGained;

          // Check for level up
          const currentLevel = ExperienceSystem.getLevelFromExperience(prev);
          const newLevel = ExperienceSystem.getLevelFromExperience(newExp);

          if (newLevel > currentLevel) {
            setPlayerLevel(newLevel);
            onPlayerLevelUpRef.current?.(newLevel);
            (window as any).audioSystem?.playLevelUpSound?.();

            // Update ControlSystem level for rune calculations
            if (controlSystemRef.current) {
              controlSystemRef.current.setWeaponLevel(newLevel);
            }

            // Update max health based on new level
            const playerEntity = getLocalPlayerEntity();
            if (playerEntity) {
              const health = playerEntity.getComponent(Health);
              if (health) {
                const newMaxHealth = ExperienceSystem.getMaxHealthForLevel(newLevel);
                health.maxHealth = newMaxHealth;
              }
            }
          }

          return newExp;
        });
      }
    };

    const handleBossAttackTelegraph = (data: {
      bossId?: string;
      targetPlayerId?: string;
      targetCombatAllyId?: string;
      position?: { x: number; y: number; z: number };
      hitDelayMs?: number;
    }) => {
      if (!data.bossId || !isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const existing = bossPendingMissTimers.current.get(data.bossId);
      if (existing) clearTimeout(existing);
      // Server hit delay is BOSS_MELEE_HIT_DELAY_MS (875) — wait slightly longer
      const timer = setTimeout(() => {
        bossPendingMissTimers.current.delete(data.bossId!);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 975) + 50);
      bossPendingMissTimers.current.set(data.bossId, timer);
    };

    const handleBossAttack = (data: {
      bossId: string;
      targetPlayerId: string;
      damage: number;
      meleeIndex?: number;
    }) => {
      const { targetPlayerId, damage } = data;
      const playerEntity = getLocalPlayerEntity();

      if (targetPlayerId === socket?.id && playerEntity) {
        if (blockLocalDamageDuringCoopPortal()) return;

        // Cancel pending miss — this attack connected
        const pendingMiss = bossPendingMissTimers.current.get(data.bossId);
        if (pendingMiss) {
          clearTimeout(pendingMiss);
          bossPendingMissTimers.current.delete(data.bossId);
        }

        // Apply damage to local player
        const health = playerEntity.getComponent(Health);
        if (health) {
          const currentTime = Date.now() / 1000;
          const shield = playerEntity.getComponent(Shield);
          const healthBefore = health.currentHealth;
          const shieldBefore = shield?.currentShield;
          const damageApplied = health.takeDamage(damage, currentTime, playerEntity);

          // Display incoming damage numbers (like boss skeleton does)
          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              // Boss damage is not critical
              const isCritical = false;

              // Directly add damage numbers using the combat system's damage number manager
              const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
              if (damageNumberManager && damageNumberManager.addDamageNumber) {
                const incomingDamagePosition = transform.position.clone();
                incomingDamagePosition.y -= 0.5; // Position below player's feet

                damageNumberManager.addDamageNumber(
                  damage,
                  isCritical,
                  incomingDamagePosition,
                  'physical', // Boss damage type
                  true // isIncomingDamage = true
                );
              }
              triggerAppliedLocalPlayerDamageFeedback({
                damage,
                damageType: 'boss',
                damageApplied,
                health,
                healthBefore,
                shield,
                shieldBefore,
                position: transform.position,
                attackerServerEnemyId: data.bossId,
              });
            }
          }
        }
      }
    };

    const handleBossDefeated = (data: any) => {
      const { killedBy } = data;
      console.log(`🎉 BOSS DEFEATED! Killed by player ${killedBy}`);
    };

    const handleBossMeteorCast = (data: {
      bossId?: string;
      meteorId: string;
      targetPositions: { x: number; y: number; z: number }[];
      startPositions?: { x: number; y: number; z: number }[];
      timestamp: number;
      damage?: number;
      staggerIntervalMs?: number;
    }) => {
      if (data.bossId) {
        const src = enemiesRef.current.get(data.bossId);
        if (src?.type === 'boss') return;
      }
      const { meteorId, targetPositions, startPositions, timestamp, damage, staggerIntervalMs } = data;
      const stepMs = staggerIntervalMs !== undefined && staggerIntervalMs >= 0 ? staggerIntervalMs : 1000;

      const newMeteors: MeteorState[] = targetPositions.map((pos, index) => ({
        id: `${meteorId}_${index}`,
        targetPosition: new Vector3(pos.x, pos.y, pos.z),
        timestamp: timestamp + (index * stepMs),
        ...(damage !== undefined ? { damage } : {}),
        ...(data.bossId ? { sourceEnemyId: data.bossId } : {}),
        ...(startPositions?.[index]
          ? {
              startPosition: new Vector3(
                startPositions[index].x,
                startPositions[index].y,
                startPositions[index].z,
              ),
            }
          : {}),
      }));

      projectileLayerRef.current?.addMeteors(newMeteors);
    };

    const handleCrossentropyMeteorCast = (data: {
      meteorId: string;
      targetPosition: { x: number; y: number; z: number };
      startPosition?: { x: number; y: number; z: number };
      timestamp: number;
      damage?: number;
    }) => {
      const next: CrossentropyMeteorState = {
        id: data.meteorId,
        targetPosition: new Vector3(
          data.targetPosition.x,
          data.targetPosition.y,
          data.targetPosition.z,
        ),
        timestamp: data.timestamp,
        ...(typeof data.damage === 'number' ? { damage: data.damage } : {}),
        ...(data.startPosition
          ? {
              startPosition: new Vector3(
                data.startPosition.x,
                data.startPosition.y,
                data.startPosition.z,
              ),
            }
          : {}),
      };
      projectileLayerRef.current?.addCrossentropyMeteor(next);
    };

    const handleDualityBlizzardCast = (data: {
      blizzardId: string;
      position: { x: number; y: number; z: number };
      durationMs?: number;
      tickMs?: number;
      radius?: number;
      timestamp: number;
    }) => {
      const next: DualityBlizzardState = {
        id: data.blizzardId,
        position: new Vector3(data.position.x, data.position.y, data.position.z),
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : ARCTIC_BLIZZARD_DURATION_SEC * 1000,
        tickMs: typeof data.tickMs === 'number' ? data.tickMs : ARCTIC_BLIZZARD_TICK_MS,
        radius: typeof data.radius === 'number' ? data.radius : 3,
      };
      bossTelegraphLayerRef.current?.addDualityBlizzard(next);
    };

    const handleSpellThiefDashRestore = () => {
      const world = engineRef.current?.getWorld();
      const ent =
        playerEntityRef.current != null ? world?.getEntity(playerEntityRef.current) : undefined;
      ent?.getComponent(Movement)?.restoreDashCharge();
    };

    const handleCloudkillCast = (data: {
      castId: string;
      targetPosition: { x: number; y: number; z: number };
      startPosition?: { x: number; y: number; z: number };
      timestamp: number;
      delayMs?: number;
      damage?: number;
    }) => {
      const next: CloudkillArrowState = {
        id: data.castId,
        targetPosition: new Vector3(
          data.targetPosition.x,
          data.targetPosition.y,
          data.targetPosition.z,
        ),
        timestamp: data.timestamp,
        ...(typeof data.delayMs === 'number' ? { delayMs: data.delayMs } : {}),
        ...(data.startPosition
          ? {
              startPosition: new Vector3(
                data.startPosition.x,
                data.startPosition.y,
                data.startPosition.z,
              ),
            }
          : {}),
      };
      projectileLayerRef.current?.addCloudkillArrow(next);
    };

    const handleBossLeapStart = (data: {
      bossId: string;
      landPosition: { x: number; y: number; z: number };
      durationMs?: number;
      timestamp: number;
    }) => {
      const d = data.durationMs ?? 1325;
      const id = `leap-tg-${data.bossId}-${data.timestamp}`;
      groundTelegraphLayerRef.current?.addBossLeapTelegraph({ id, x: data.landPosition.x, y: data.landPosition.y, z: data.landPosition.z, durationMs: d });
    };

    const handleBossLeapLand = (data: { bossId: string; landPosition?: { x: number; y: number; z: number } }) => {
      groundTelegraphLayerRef.current?.removeBossLeapByEntityId(data.bossId);
      if (data.landPosition) {
        const land = data.landPosition;
        bossTelegraphLayerRef.current?.addBossLeapShockwave({
            id: `shockwave-${data.bossId}-${Date.now()}`,
            x: land.x,
            z: land.z,
            variant: 'boss',
          });
        window.audioSystem?.playExplosionSound(
          new Vector3(land.x, land.y, land.z),
        );
      }
    };

    const handleGhoulLeapStart = (data: {
      ghoulId: string;
      landPosition: { x: number; y: number; z: number };
      durationMs?: number;
      timestamp: number;
    }) => {
      const d = data.durationMs ?? 1100;
      const id = `ghoul-leap-tg-${data.ghoulId}-${data.timestamp}`;
      groundTelegraphLayerRef.current?.addMobLeapTelegraph({ id, x: data.landPosition.x, y: data.landPosition.y, z: data.landPosition.z, durationMs: d, theme: 'boss' });
    };

    const handleGhoulLeapLand = (data: {
      ghoulId: string;
      landPosition?: { x: number; y: number; z: number };
    }) => {
      groundTelegraphLayerRef.current?.removeMobLeapByEntityId(data.ghoulId);
      if (data.landPosition) {
        const land = data.landPosition;
        bossTelegraphLayerRef.current?.addBossLeapShockwave({
            id: `ghoul-shockwave-${data.ghoulId}-${Date.now()}`,
            x: land.x,
            z: land.z,
            variant: 'ghoul',
          });
        window.audioSystem?.playExplosionSound(
          new Vector3(land.x, land.y, land.z),
        );
      }
    };

    const handleTemplarLeapStart = (data: {
      templarId: string;
      landPosition: { x: number; y: number; z: number };
      durationMs?: number;
      timestamp: number;
    }) => {
      const d = data.durationMs ?? 1100;
      const id = `templar-leap-tg-${data.templarId}-${data.timestamp}`;
      groundTelegraphLayerRef.current?.addMobLeapTelegraph({ id, x: data.landPosition.x, y: data.landPosition.y, z: data.landPosition.z, durationMs: d, theme: 'templar' });
    };

    const handleTemplarLeapLand = (data: {
      templarId: string;
      landPosition?: { x: number; y: number; z: number };
    }) => {
      groundTelegraphLayerRef.current?.removeMobLeapByEntityId(data.templarId);
      if (data.landPosition) {
        const land = data.landPosition;
        bossTelegraphLayerRef.current?.addBossLeapShockwave({
            id: `templar-shockwave-${data.templarId}-${Date.now()}`,
            x: land.x,
            z: land.z,
            variant: 'templar',
          });
        window.audioSystem?.playExplosionSound(
          new Vector3(land.x, land.y, land.z),
        );
      }
    };

    const handleTigerPounceStart = (_data: {
      tigerId: string;
      landPosition: { x: number; y: number; z: number };
      durationMs?: number;
      timestamp: number;
    }) => {
      // Tiger pounce: no Templar-style ground telegraph / leap shockwave.
    };

    const handleTigerPounceLand = (data: {
      tigerId: string;
      landPosition?: { x: number; y: number; z: number };
    }) => {
      if (data.landPosition) {
        const land = data.landPosition;
        window.audioSystem?.playWeaponSound?.(
          'beast_tiger_attack',
          new Vector3(land.x, land.y, land.z),
          { volume: 0.5 },
        );
      }
    };

    const handleTitanStompShockwave = (data: {
      titanId: string;
      soulType?: 'green' | 'red' | 'blue' | 'purple';
      origin: { x: number; y: number; z: number };
      direction: { ux: number; uz: number };
      maxRange: number;
      travelMs: number;
      timestamp: number;
    }) => {
      window.audioSystem?.playEnemyTitanStompSound(
        new Vector3(data.origin.x, data.origin.y, data.origin.z),
      );
      explosionBurstLayerRef.current?.addTitanStompShockwave({
          id: `titan-stomp-${data.titanId}-${data.timestamp}`,
          origin: data.origin,
          direction: data.direction,
          maxRange: data.maxRange,
          travelMs: data.travelMs,
          soulType: data.soulType ?? 'green',
        });
    };

    const handleTitanCannonWindup = (data: {
      titanId: string;
      soulType?: 'green' | 'red' | 'blue' | 'purple';
      origin: { x: number; y: number; z: number };
      rotation: number;
      range: number;
      halfWidth: number;
      strikeAt: number;
      timestamp: number;
    }) => {
      const pos = new Vector3(data.origin.x, data.origin.y, data.origin.z);
      window.audioSystem?.playBoss3BeamTelegraphSound(pos);
      groundTelegraphLayerRef.current?.addTitanCannonAbility({
          id: `titan-cannon-${data.titanId}-${data.timestamp}`,
          soulType: data.soulType ?? 'green',
          origin: pos,
          rotation: data.rotation,
          range: data.range,
          halfWidth: data.halfWidth,
          strikeAt: data.strikeAt,
        });
    };

    const handleBossThrowSpear = (data: {
      bossId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
      timestamp: number;
    }) => {
      const start = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const target = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);
      projectileLayerRef.current?.addBossSpear({
          id: `boss-spear-${data.bossId}-${data.timestamp}`,
          bossId: data.bossId,
          startPosition: start,
          targetPosition: target,
          damage: data.damage,
        });
    };

    const handleBossTectonicSpikeTelegraph = (data: {
      bossId: string;
      spikeId: string;
      position: { x: number; y: number; z: number };
      warningMs?: number;
      timestamp: number;
    }) => {
      const w = data.warningMs !== undefined && data.warningMs >= 0 ? data.warningMs : 750;
      groundTelegraphLayerRef.current?.addBossTectonicTelegraph({
          id: `tg-${data.spikeId}`,
          x: data.position.x,
          y: data.position.y,
          z: data.position.z,
          durationMs: w,
        });
      bossMechanicLayerRef.current?.addTectonicSpikeGroundCrack({
          id: `cracks-${data.spikeId}`,
          x: data.position.x,
          y: data.position.y,
          z: data.position.z,
          seed: data.spikeId,
          visibleMs: w + POST_SPIKE_CRACK_HOLD_MS,
          fadeMs: SPIKE_CRACK_FADE_MS,
          theme: 'earth',
        });
    };

    const handleBossTectonicSpikeAppear = (data: {
      bossId: string;
      spikeId: string;
      position: { x: number; y: number; z: number };
      timestamp: number;
    }) => {
      const id = `spike-${data.spikeId}`;
      const pos = new Vector3(data.position.x, data.position.y, data.position.z);
      bossMechanicLayerRef.current?.addBossTectonicSpike({ id, position: pos });
    };

    const handleBoss2ArchonLightning = (data: {
      bossId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      beams?: { startPosition: { x: number; y: number; z: number }; targetPosition: { x: number; y: number; z: number } }[];
      strikeAt: number;
      halfWidth?: number;
      timestamp: number;
    }) => {
      const beams =
        data.beams && data.beams.length > 0
          ? data.beams.map((b) => ({
              startPosition: new Vector3(b.startPosition.x, b.startPosition.y, b.startPosition.z),
              targetPosition: new Vector3(b.targetPosition.x, b.targetPosition.y, b.targetPosition.z),
            }))
          : [
              {
                startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
                targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
              },
            ];
      lightningBurstLayerRef.current?.addBoss2ArchonLightning({
          id: `boss2-archon-${data.bossId}-${data.timestamp}`,
          beams,
          strikeAt: data.strikeAt,
          halfWidth: data.halfWidth ?? 1.0
        });
    };

    const handleWarlockArchonShock = (data: {
      warlockId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      beams?: { startPosition: { x: number; y: number; z: number }; targetPosition: { x: number; y: number; z: number } }[];
      strikeAt: number;
      halfWidth?: number;
      timestamp: number;
    }) => {
      const beams =
        data.beams && data.beams.length > 0
          ? data.beams.map((b) => ({
              startPosition: new Vector3(b.startPosition.x, b.startPosition.y, b.startPosition.z),
              targetPosition: new Vector3(b.targetPosition.x, b.targetPosition.y, b.targetPosition.z),
            }))
          : [
              {
                startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
                targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
              },
            ];
      lightningBurstLayerRef.current?.addWarlockArchonShock({
          id: `warlock-archon-shock-${data.warlockId}-${data.timestamp}`,
          beams,
          strikeAt: data.strikeAt,
          halfWidth: data.halfWidth ?? 1.0,
        });
    };

    const handleKnightStormLashZap = (data: {
      knightId: string;
      beams?: { startPosition: { x: number; y: number; z: number }; targetPosition: { x: number; y: number; z: number } }[];
      strikeAt: number;
      halfWidth?: number;
      vfxScale?: number;
      timestamp: number;
    }) => {
      const beams =
        data.beams && data.beams.length > 0
          ? data.beams.map((b) => ({
              startPosition: new Vector3(b.startPosition.x, b.startPosition.y, b.startPosition.z),
              targetPosition: new Vector3(b.targetPosition.x, b.targetPosition.y, b.targetPosition.z),
            }))
          : [];
      if (beams.length === 0) return;
      lightningBurstLayerRef.current?.addKnightStormLashZap({
          id: `knight-storm-lash-${data.knightId}-${data.timestamp}`,
          beams,
          strikeAt: data.strikeAt,
          halfWidth: data.halfWidth ?? 1.0,
          vfxScale: data.vfxScale ?? 1,
        });
    };

    const handleShamanStormShockZap = (data: {
      shamanId: string;
      beams?: { startPosition: { x: number; y: number; z: number }; targetPosition: { x: number; y: number; z: number } }[];
      strikeAt: number;
      halfWidth?: number;
      vfxScale?: number;
      timestamp: number;
    }) => {
      const beams =
        data.beams && data.beams.length > 0
          ? data.beams.map((b) => ({
              startPosition: new Vector3(b.startPosition.x, b.startPosition.y, b.startPosition.z),
              targetPosition: new Vector3(b.targetPosition.x, b.targetPosition.y, b.targetPosition.z),
            }))
          : [];
      if (beams.length === 0) return;
      lightningBurstLayerRef.current?.addShamanStormShockZap({
          id: `shaman-storm-shock-${data.shamanId}-${data.timestamp}`,
          beams,
          strikeAt: data.strikeAt,
          halfWidth: data.halfWidth ?? 1.0,
          vfxScale: data.vfxScale ?? 1,
        });
    };

    const handleShamanSpiritWolvesCast = (data: {
      shamanId: string;
      position?: { x: number; y: number; z: number };
      timestamp?: number;
    }) => {
      if (!data.position) return;
      const pos = new Vector3(data.position.x, data.position.y ?? 0, data.position.z);
      window.audioSystem?.playWolfPackHowlsSound?.(pos);
    };

    const handleBoss3NovaRelease = (data: {
      bossId: string;
      origin: { x: number; z: number };
      directions: { ux: number; uz: number }[];
      maxRange: number;
      travelMs: number;
      timestamp: number;
      roundIndex?: number;
      burstRounds?: number;
    }) => {
      const o = new Vector3(data.origin.x, 0, data.origin.z);
      window.audioSystem?.playBoss3DiscSound(o);
      const roundIndex = typeof data.roundIndex === 'number' ? data.roundIndex : 0;
      bossMechanicLayerRef.current?.addBoss3NovaBurst({
          id: `boss3-nova-${data.bossId}-${data.timestamp}-r${roundIndex}`,
          origin: o,
          directions: data.directions ?? [],
          maxRange: data.maxRange,
          travelMs: data.travelMs,
          roundIndex,
          burstRounds: data.burstRounds,
        });
    };

    const handleTemplarTeleport = (data: any) => {
      const { templarId, startPosition, endPosition, timestamp } = data;
      explosionBurstLayerRef.current?.addTeleportEffect({
          id: `${templarId}-teleport-start-${timestamp}`,
          position: new Vector3(startPosition.x, startPosition.y, startPosition.z),
          type: 'start' as const,
          timestamp,
          variant: 'templar',
          theme: 'red',
        });
      explosionBurstLayerRef.current?.addTeleportEffect({
          id: `${templarId}-teleport-end-${timestamp}`,
          position: new Vector3(endPosition.x, endPosition.y, endPosition.z),
          type: 'end' as const,
          timestamp,
          variant: 'templar',
          theme: 'red',
        });
    };

    const handleFrostQueenTeleport = (data: {
      frostQueenId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      timestamp?: number;
    }) => {
      const ts = data.timestamp ?? Date.now();
      const start = new Vector3(
        data.startPosition.x,
        data.startPosition.y ?? 0,
        data.startPosition.z,
      );
      const end = new Vector3(
        data.endPosition.x,
        data.endPosition.y ?? 0,
        data.endPosition.z,
      );

      window.audioSystem?.playEnemyFrostNovaSound?.(start);
      allyCombatLayerRef.current?.addKnightFrostImpact({
        id: `${data.frostQueenId}-tp-start-${ts}`,
        position: start.clone(),
      });

      const arrivalDelay = Math.round(FROST_QUEEN_TELEPORT_LOCK_MS * 0.45);
      setTimeout(() => {
        window.audioSystem?.playEnemyFrostRaySound?.(end);
        allyCombatLayerRef.current?.addKnightFrostImpact({
          id: `${data.frostQueenId}-tp-end-${ts}`,
          position: end.clone(),
        });
      }, arrivalDelay);
    };

    const handleTemplarBlinkSmiteImpact = (data: any) => {
      const { templarId, position, radius, damage, timestamp } = data;
      const id = `templar-blink-smite-${templarId}-${timestamp}`;
      const pos = new Vector3(position.x, position.y, position.z);
      explosionBurstLayerRef.current?.addTemplarBlinkSmiteStrike({ id, position: pos, timestamp });

      const playerEntity = getLocalPlayerEntity();
      if (!playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;
      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;
      const transform = playerEntity.getComponent(Transform);
      if (!transform) return;
      const playerGroundPos = new Vector3(transform.position.x, 0, transform.position.z);
      const smiteGroundPos = new Vector3(pos.x, 0, pos.z);
      const inRadius = playerGroundPos.distanceTo(smiteGroundPos) <= radius;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (!health) return;
      const wasAlive = !health.isDead;

      let damageApplied = false;
      let healthBefore = health.currentHealth;
      let shieldBefore = shield?.currentShield;

      if (inRadius) {
        const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
        const incomingPos = transform.position.clone();
        incomingPos.y -= 0.5;

        const result = applyIncomingCoopDamage({
          damage,
          damageType: 'smite',
          sourceEnemyId: templarId,
          playerEntity,
          health,
          shield,
          damageNumberManager,
          damageNumberPosition: incomingPos,
        });
        damageApplied = result.damageApplied;
        healthBefore = result.healthBefore;
        shieldBefore = result.shieldBefore;

        if (damageApplied) {
          window.audioSystem?.playEnemyTemplarSmiteSound(pos);
        }

        triggerAppliedLocalPlayerDamageFeedback({
          damage,
          damageType: 'smite',
          damageApplied,
          health,
          healthBefore,
          shield,
          shieldBefore,
          position: transform.position,
          attackerServerEnemyId: templarId,
        });
      } else {
        window.audioSystem?.playEnemyTemplarSmiteSound(pos);
      }

      if (shield) {
        updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
      }

      if (wasAlive && health.isDead) {
        handlePlayerDeath(socket.id, templarId);
      }
    };

    const handleMartyrDetonationTelegraph = (data: {
      martyrId: string;
      position: { x: number; y: number; z: number };
      detonateAt: number;
      timestamp: number;
    }) => {
      const { martyrId, position, detonateAt, timestamp } = data;
      const id = `martyr-tel-${martyrId}-${timestamp}`;
      groundTelegraphLayerRef.current?.addMartyrDetonationTelegraph({
          id,
          martyrId,
          position: new Vector3(position.x, position.y, position.z),
          endAt: detonateAt
        });
    };

    const handleMartyrDetonationImpact = (data: {
      martyrId: string;
      position: { x: number; y: number; z: number };
      radius: number;
      damage: number;
      timestamp: number;
    }) => {
      const { martyrId, position, radius, damage, timestamp } = data;
      const boomId = `martyr-boom-${martyrId}-${timestamp}`;
      groundTelegraphLayerRef.current?.removeMartyrDetonationByMartyrId(martyrId);
      explosionBurstLayerRef.current?.addMartyrDetonationExplosion({
        id: boomId,
        position: { ...position },
        radius,
      });

      window.audioSystem?.playExplosionSound(
        new Vector3(position.x, position.y, position.z),
      );

      const playerEntity = getLocalPlayerEntity();
      if (!playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;
      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;
      const transform = playerEntity.getComponent(Transform);
      if (!transform) return;
      const playerGroundPos = new Vector3(transform.position.x, 0, transform.position.z);
      const blastGroundPos = new Vector3(position.x, 0, position.z);
      if (playerGroundPos.distanceTo(blastGroundPos) > radius) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (!health) return;
      const wasAlive = !health.isDead;

      const healthBefore = health.currentHealth;
      const shieldBefore = shield?.currentShield;
      const damageApplied = health.takeDamage(damage, Date.now() / 1000, playerEntity, false);

      if (playerEntity) {
        const t = playerEntity.getComponent(Transform);
        if (t) {
          const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
          if (damageNumberManager && damageNumberManager.addDamageNumber) {
            const p = t.position.clone();
            p.y -= 0.5;
            damageNumberManager.addDamageNumber(damage, false, p, 'physical', true);
          }
          triggerAppliedLocalPlayerDamageFeedback({
            damage,
            damageType: 'martyr',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: t.position,
            attackerServerEnemyId: martyrId,
          });
        }
      }

      if (shield) {
        updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
      }

      if (wasAlive && health.isDead) {
        handlePlayerDeath(socket.id, martyrId);
      }
    };

    const spawnWraithMistEffect = (wraithId: string, position: { x: number; y?: number; z: number }) => {
      const mistPosition = new Vector3(position.x, position.y ?? 1.0, position.z);
      const effectId = `wraith-mist-${wraithId}-${Date.now()}`;
      groundHazardLayerRef.current?.addMistEffect({
        id: effectId,
        position: mistPosition,
        startTime: Date.now(),
      });
      setTimeout(() => {
        groundHazardLayerRef.current?.removeMistEffect(effectId);
      }, 1000);
    };

    const spawnDreamshroudMistEffect = (
      assassinId: string,
      position: { x: number; y?: number; z: number },
    ) => {
      const mistPosition = new Vector3(position.x, position.y ?? 1.0, position.z);
      const effectId = `dreamshroud-mist-${assassinId}-${Date.now()}`;
      groundHazardLayerRef.current?.addMistEffect({
        id: effectId,
        position: mistPosition,
        startTime: Date.now(),
        color: '#44FF88',
      });
      setTimeout(() => {
        groundHazardLayerRef.current?.removeMistEffect(effectId);
      }, 1000);
    };

    const handleWraithStealthCloak = (data: {
      wraithId: string;
      position: { x: number; y?: number; z: number };
    }) => {
      if (!data?.wraithId || !data.position) return;
      spawnWraithMistEffect(data.wraithId, data.position);
    };

    const handleWraithStealthReveal = (data: {
      wraithId: string;
      position: { x: number; y?: number; z: number };
    }) => {
      if (!data?.wraithId || !data.position) return;
      spawnWraithMistEffect(data.wraithId, data.position);
    };

    const handleAssassinDreamshroudCloak = (data: {
      assassinId: string;
      position: { x: number; y?: number; z: number };
    }) => {
      if (!data?.assassinId || !data.position) return;
      spawnDreamshroudMistEffect(data.assassinId, data.position);
    };

    const handleAssassinDreamshroudReveal = (data: {
      assassinId: string;
      position: { x: number; y?: number; z: number };
    }) => {
      if (!data?.assassinId || !data.position) return;
      spawnDreamshroudMistEffect(data.assassinId, data.position);
    };

    const handleFissionDetonation = (data: {
      position: { x: number; y: number; z: number };
      radius: number;
      timestamp: number;
    }) => {
      const { position, timestamp } = data;
      const boomId = `fission-boom-${timestamp}-${Math.random().toString(36).slice(2, 8)}`;
      const pos = new Vector3(position.x, position.y, position.z);
      explosionBurstLayerRef.current?.addFissionDetonation({ id: boomId, position: pos });
      window.audioSystem?.playExplosionSound(pos);
    };

    const handleEnemyStatusEffect = (data: any) => {
      const { enemyId, effectType, duration, timestamp, source } = data;
      
      if (!engineRef.current) {
        return;
      }

      const world = engineRef.current.getWorld();
      
      // Find the enemy entity by its server ID
      const allEntities = world.getAllEntities();
      
      for (const entity of allEntities) {
        if (entity.userData?.serverEnemyId === enemyId) {
          const isAlly = isCoopPlayerAllyEntity(entity);
          if (isAlly && effectType !== 'hostileRoot' && effectType !== 'hostileFreeze') break;

          const enemy = entity.getComponent(Enemy);
          if (enemy) {
            const currentTime = Date.now() / 1000;
            const sk = entity.userData?.coopServerEnemyType as string | undefined;
            
            // Apply the appropriate status effect based on type
            if (effectType === 'stun') {
              if (isImmuneToPlayerStunAndFreeze(sk)) break;
              enemy.stun(duration / 1000, currentTime, sk); // Convert ms to seconds
              
              // Add visual stun effect
              const transform = entity.getComponent(Transform);
              if (transform) {
                addGlobalStunnedEnemy(entity.id.toString(), transform.position, duration);
                if (source === 'titans_grip') {
                  spawnTitansGripStunLightning(transform.position);
                }
              }
            } else if (effectType === 'freeze' || effectType === 'hostileFreeze') {
              if (effectType === 'freeze' && isImmuneToPlayerStunAndFreeze(sk)) break;
              const freezeMs = capFreezeMsForEnemy(enemy, duration, sk);
              enemy.freeze(duration / 1000, currentTime, sk);

              // Add visual freeze effect
              const transform = entity.getComponent(Transform);
              if (transform) {
                addGlobalFrozenEnemy(entity.id.toString(), transform.position, freezeMs);
              }
            } else if (effectType === 'corrupted') {
              const sk = entity.userData?.coopServerEnemyType;
              if (enemy.type === EnemyType.BOSS || sk === 'boss-skeleton') {
                break;
              }
              enemy.applyCorrupted(duration / 1000, currentTime);
            } else if (effectType === 'ignite') {
              const transform = entity.getComponent(Transform);
              if (transform) {
                enemy.applyIgnite(duration, currentTime, entity.id.toString(), transform.position.clone());
              }
            } else if (effectType === 'shadowflame') {
              const transform = entity.getComponent(Transform);
              if (transform) {
                enemy.applyShadowflame(duration, currentTime, entity.id.toString(), transform.position.clone());
              }
            } else if (effectType === 'entangle' || effectType === 'hostileRoot') {
              enemy.entangle(duration / 1000, currentTime);
              const transform = entity.getComponent(Transform);
              if (transform) {
                const theme = (data as any)?.entangleTheme === 'spider' ? 'spider' : 'default';
                addGlobalEntangledEnemy(entity.id.toString(), transform.position.clone(), duration, theme);
              }
            } else if (effectType === 'huntersMark') {
              const transform = entity.getComponent(Transform);
              if (!transform) break;
              if (!duration || duration <= 0) {
                clearGlobalHuntersMark(entity.id.toString());
              } else {
                addGlobalHuntersMark(entity.id.toString(), transform.position.clone(), duration);
              }
            }
          }
          break;
        }
      }
      // Silently ignore if enemy not found - it may have died already
    };

    const handleEnemyChillSync = (data: { enemyId: string; stacks: number; expiresAt: number }) => {
      if (!engineRef.current) return;
      const world = engineRef.current.getWorld();
      for (const entity of world.getAllEntities()) {
        if (entity.userData?.serverEnemyId === data.enemyId) {
          const enemy = entity.getComponent(Enemy);
          if (enemy) {
            enemy.syncChillFromServer(data.stacks, data.expiresAt);
          }
          break;
        }
      }
    };

    const handleKnightDeathVortex = (data: { enemyId: string; position: { x: number; y: number; z: number }; soulType?: 'red' | 'purple' | 'green' | 'blue' | null }) => {
      summonRitualLayerRef.current?.addKnightDeathVortex({ id: `vortex-${data.enemyId}-${Date.now()}`, position: data.position, soulType: data.soulType },
      );
    };

    const handleEnemyStaggerProc = (data: {
      enemyId: string;
      position: { x: number; y: number; z: number };
      damage?: number;
      isCritical?: boolean;
      magmaCurrent?: boolean;
      forceOfNature?: boolean;
      stormShield?: boolean;
      fromPlayerId?: string | null;
    }) => {
      const p = new Vector3(data.position.x, data.position.y, data.position.z);
      (window as any).audioSystem?.playLightningBoltSound(p);
      const dmg =
        typeof data.damage === 'number'
          ? data.damage
          : getStaggerProcBaseDamage(talentLoadout, effectiveCombatStats.agility);
      const isCritical = !!data.isCritical;
      const numPos = p.clone();
      numPos.y += 1.35;
      const damageNumberManager = (window as any).damageNumberManager as DamageNumberManager | undefined;
      if (damageNumberManager) {
        const enemyType = enemiesRef.current.get(data.enemyId)?.type;
        addEnemyHitDamageNumber(damageNumberManager, {
          enemyId: data.enemyId,
          enemyType,
          damage: dmg,
          isCritical,
          position: numPos,
          damageType: 'stagger_break',
        });
      }
      lightningBurstLayerRef.current?.addStaggerProcEffect({
          id: `stagger-proc-${data.enemyId}-${Date.now()}`,
          position: p.clone(),
          magmaCurrent: !!data.magmaCurrent,
          forceOfNature: !!data.forceOfNature,
          stormShield: !!data.stormShield,
        });
    };

    // How long (ms) into the shade throw animation the daggers are released.
    // 350 ms earlier than the prior sync to match shadeThrow.mp3 / throw clip release.
    // Keep aligned with ShadeRenderer ATTACK_DURATION and backend enemyAI SHADE_THROW_ANIMATION_MS.
    const SHADE_THROW_DURATION = 650;
    // Delay between each successive dagger in the 3-dagger volley.
    const SHADE_DAGGER_INTERVAL = 250;

    const handleShadeAttackTelegraph = (data: {
      shadeId: string;
      targetPlayerId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
      maxRange?: number;
      endPosition?: { x: number; y: number; z: number };
    }) => {
      // Telegraph snapshot if React enemy state has not updated yet.
      const packetStart = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const staleTarget = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);

      const shadeEnemy = enemiesRef.current.get(data.shadeId);
      const isAlliedPhantom = shadeEnemy?.type === 'allied-phantom' || data.shadeId === 'allied-phantom';
      const isYellowShade = shadeEnemy?.soulType === 'yellow' || isAlliedPhantom;
      const isBlueShade = !isYellowShade && shadeEnemy?.soulType === 'blue';
      const daggerCount = isBlueShade ? 2 : 3;

      // Spawn daggers staggered after the throw animation release point.
      // Each dagger samples live player aim at launch; spawn origin uses live shade
      // position (+1.5 Y hand offset, matching enemyAI telegraphShadeAttack) so post-boss
      // blink timing cannot desync projectile start from the mesh.
      for (let i = 0; i < daggerCount; i++) {
        setTimeout(() => {
          let target = staleTarget.clone();
          if (!isAlliedPhantom) {
            const playerEntity = getLocalPlayerEntity();
            if (playerEntity) {
              const t = playerEntity.getComponent(Transform);
              if (t) {
                target = new Vector3(t.position.x, data.targetPosition.y, t.position.z);
              }
            }
          }

          const liveShade = enemiesRef.current.get(data.shadeId);
          const start =
            liveShade?.position != null
              ? new Vector3(
                  liveShade.position.x,
                  liveShade.position.y + 1.5,
                  liveShade.position.z,
                )
              : packetStart.clone();

          (window as any).audioSystem?.playShadeThrowSound(start);

          projectileLayerRef.current?.addShadeDagger({
              id: `shade-dagger-${data.shadeId}-${Date.now()}-${i}`,
              startPosition: start.clone(),
              targetPosition: target,
              damage: data.damage,
              soulType: isYellowShade ? 'yellow' : (liveShade?.soulType ?? shadeEnemy?.soulType),
              daggerIndex: i,
            });
        }, SHADE_THROW_DURATION + i * SHADE_DAGGER_INTERVAL);
      }
    };

    // Shade blink VFX — centralized here (one listener) instead of per-shade BossTeleportEffect.
    const SHADE_BLINK_DURATION_MS = 600;
    const handleShadeBlinkTelegraph = (data: {
      shadeId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation?: number;
      timestamp?: number;
    }) => {
      const endPosition = {
        x: data.endPosition.x,
        y: data.endPosition.y,
        z: data.endPosition.z,
      };
      const rotation = data.rotation ?? enemiesRef.current.get(data.shadeId)?.rotation ?? 0;

      const existingTransform = enemyTransformsRef.current.get(data.shadeId);
      if (existingTransform) {
        existingTransform.position = endPosition;
        existingTransform.rotation = rotation;
      } else {
        enemyTransformsRef.current.set(data.shadeId, {
          position: endPosition,
          rotation,
        });
      }

      const enemy = enemiesRef.current.get(data.shadeId);
      if (enemy) {
        enemy.position = endPosition;
        enemy.rotation = rotation;
      }

      const ts = data.timestamp ?? Date.now();
      const shadeEnemy = enemiesRef.current.get(data.shadeId);
      const isAlliedPhantom = shadeEnemy?.type === 'allied-phantom' || data.shadeId === 'allied-phantom';
      const theme = isAlliedPhantom || shadeEnemy?.soulType === 'yellow'
        ? 'yellow'
        : shadeEnemy?.soulType === 'blue'
          ? 'blue'
          : 'purple';

      explosionBurstLayerRef.current?.addTeleportEffect({
        id: `${data.shadeId}-blink-start-${ts}`,
        position: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
        type: 'start',
        timestamp: ts,
        variant: 'shade',
        theme,
      });

      const arrivalDelay = Math.round(SHADE_BLINK_DURATION_MS * 0.4);
      setTimeout(() => {
        explosionBurstLayerRef.current?.addTeleportEffect({
          id: `${data.shadeId}-blink-end-${ts}`,
          position: new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z),
          type: 'end',
          timestamp: ts,
          variant: 'shade',
          theme,
        });
      }, arrivalDelay);
    };

    // Warlock / Boss2 blink VFX — centralized (one listener) instead of per-warlock WarlockTeleportEffect.
    const WARLOCK_BLINK_DURATION_MS = 800;
    const handleWarlockBlinkTelegraph = (data: {
      warlockId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      timestamp?: number;
    }) => {
      const ts = data.timestamp ?? Date.now();

      explosionBurstLayerRef.current?.addTeleportEffect({
        id: `${data.warlockId}-blink-start-${ts}`,
        position: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
        type: 'start',
        timestamp: ts,
        variant: 'warlock',
      });

      const arrivalDelay = Math.round(WARLOCK_BLINK_DURATION_MS * 0.45);
      setTimeout(() => {
        explosionBurstLayerRef.current?.addTeleportEffect({
          id: `${data.warlockId}-blink-end-${ts}`,
          position: new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z),
          type: 'end',
          timestamp: ts,
          variant: 'warlock',
        });
      }, arrivalDelay);
    };

    onCosmetic('player-attacked', handlePlayerAttack);
    onCosmetic('player-used-ability', handlePlayerAbility);
    socket.on('player-damaged', handlePlayerDamaged);
    socket.on('player-healing', handlePlayerHealing);
    socket.on('enemy-healed', handleEnemyHealed);
    socket.on('player-experience-gained', handlePlayerExperienceGained);
    socket.on('player-kill', handlePlayerKill);
    socket.on('pillar-destroyed', handlePillarDestroyed);
    socket.on('player-essence-changed', handlePlayerEssenceChanged);
    const unregisterGoldHandler = registerPlayerGoldChangedHandler(handlePlayerGoldChanged);
    const unregisterFlowHandler = registerPlayerFlowChangedHandler(handlePlayerFlowChanged);
    const unregisterWoodHandler = registerPlayerWoodChangedHandler(handlePlayerWoodChanged);
    const unregisterStoneHandler = registerPlayerStoneChangedHandler(handlePlayerStoneChanged);
    const unregisterMeatHandler = registerPlayerMeatChangedHandler(handlePlayerMeatChanged);
    const unregisterHungerHandler = registerPlayerHungerChangedHandler(handlePlayerHungerChanged);
    const unregisterFateHandler = registerPlayerFateChangedHandler(handlePlayerFateChanged);
    socket.on('gold-picked-up', handleGoldPickedUp);
    socket.on('gold-expired', handleGoldExpired);
    socket.on('wood-picked-up', handleWoodPickedUp);
    socket.on('stone-picked-up', handleStonePickedUp);
    socket.on('meat-picked-up', handleMeatPickedUp);
    socket.on('item-picked-up', handleItemPickedUpForVfx);
    socket.on('item-expired', handleItemExpired);
    socket.on('player-animation-state', handlePlayerAnimationState);
    onCosmetic('player-effect', handlePlayerEffect);
    socket.on('player-debuff', handlePlayerDebuff);
    socket.on('player-stealth', handlePlayerStealth);
    onCosmetic('player-tornado-effect', handlePlayerTornadoEffect);
    onCosmetic('player-death-effect', handlePlayerDeathEffect);
    socket.on('player-respawned', handlePlayerRespawned);
    socket.on('player-shield-changed', handlePlayerShieldChanged);
    socket.on('player-knockback', handlePlayerKnockback);
    onCosmetic('boss-attack', handleBossAttack);
    socket.on('boss-defeated', handleBossDefeated);
    onCosmetic('boss-meteor-cast', handleBossMeteorCast);
    onCosmetic('crossentropy-meteor-cast', handleCrossentropyMeteorCast);
    onCosmetic('duality-blizzard-cast', handleDualityBlizzardCast);
    socket.on('spell-thief-dash-restore', handleSpellThiefDashRestore);
    onCosmetic('cloudkill-cast', handleCloudkillCast);
    onCosmetic('boss-leap-start', handleBossLeapStart);
    onCosmetic('boss-leap-land', handleBossLeapLand);
    onCosmetic('ghoul-leap-start', handleGhoulLeapStart);
    onCosmetic('ghoul-leap-land', handleGhoulLeapLand);
    onCosmetic('templar-leap-start', handleTemplarLeapStart);
    onCosmetic('templar-leap-land', handleTemplarLeapLand);
    onCosmetic('tiger-pounce-start', handleTigerPounceStart);
    onCosmetic('tiger-pounce-land', handleTigerPounceLand);
    onCosmetic('titan-stomp-shockwave', handleTitanStompShockwave);
    onCosmetic('titan-cannon-windup', handleTitanCannonWindup);

    const handleIncinerationBeam = (data: {
      playerId: string;
      origin: { x: number; y: number; z: number };
      direction: { x: number; y: number; z: number };
      charge: number;
      isPlasma?: boolean;
      shieldDrained?: number;
    }) => {
      if (data.playerId === socket.id) return;
      incinerationBeamManagerRef.current?.spawnVfxOnly({
        origin: data.origin,
        direction: data.direction,
        charge: data.charge,
        isPlasma: data.isPlasma ?? false,
        shieldDrained: data.shieldDrained ?? 0,
      });
    };

    onCosmetic('incineration-beam', handleIncinerationBeam);
    socket.on('boss-throw-spear', handleBossThrowSpear);
    socket.on('boss-tectonic-spike-telegraph', handleBossTectonicSpikeTelegraph);
    socket.on('boss-tectonic-spike-appear', handleBossTectonicSpikeAppear);
    socket.on('boss2-archon-lightning', handleBoss2ArchonLightning);
    socket.on('warlock-archon-shock', handleWarlockArchonShock);
    socket.on('knight-storm-lash-zap', handleKnightStormLashZap);
    socket.on('shaman-storm-shock-zap', handleShamanStormShockZap);
    socket.on('shaman-spirit-wolves-cast', handleShamanSpiritWolvesCast);
    socket.on('boss3-nova-release', handleBoss3NovaRelease);
    socket.on('templar-teleport', handleTemplarTeleport);
    socket.on('frost-queen-teleport', handleFrostQueenTeleport);
    socket.on('templar-blink-smite-impact', handleTemplarBlinkSmiteImpact);
    socket.on('martyr-detonation-telegraph', handleMartyrDetonationTelegraph);
    socket.on('martyr-detonation-impact', handleMartyrDetonationImpact);
    socket.on('wraith-stealth-cloak', handleWraithStealthCloak);
    socket.on('wraith-stealth-reveal', handleWraithStealthReveal);
    socket.on('assassin-dreamshroud-cloak', handleAssassinDreamshroudCloak);
    socket.on('assassin-dreamshroud-reveal', handleAssassinDreamshroudReveal);
    socket.on('fission-detonation', handleFissionDetonation);
    socket.on('boss-skeleton-attack', handleBossSkeletonAttack);
    socket.on('knight-attack-telegraph', handleKnightAttackTelegraph);
    socket.on('allied-knight-attack-telegraph', handleAlliedKnightAttackTelegraph);
    socket.on('ghoul-attack-telegraph', handleGhoulAttackTelegraph);
    socket.on('player-zombie-attack-telegraph', handlePlayerZombieAttackTelegraph);
    socket.on('tentacle-spine-windup', handleTentacleSpineWindup);
    socket.on('tentacle-spine-slam', handleTentacleSpineSlamSocket);
    socket.on('knight-attack', handleKnightAttack);
    socket.on('knight-spin-hit', handleKnightAttack);
    const handleAssassinSpinHit = (data: any) => handleKnightAttack({ ...data, knightId: data.assassinId });
    socket.on('assassin-spin-hit', handleAssassinSpinHit);
    const handleValkyrieLungeHit = (data: any) => handleKnightAttack({ ...data, knightId: data.valkyrieId });
    const handleValkyrieJudgmentCast = (data: {
      valkyrieId: string;
      targetPosition?: { x: number; y: number; z: number };
      strikeAt?: number;
      hoverMs?: number;
      fallMs?: number;
      skyHeight?: number;
    }) => {
      if (!coopServerEnemyLiving(data.valkyrieId)) return;

      // Cast wind-up phase (no strike target yet)
      if (!data.targetPosition) {
        const valkyrie = enemiesRef.current.get(data.valkyrieId);
        const live = enemyTransformsRef.current.get(data.valkyrieId);
        const pos = live?.position ?? valkyrie?.position;
        if (pos) {
          window.audioSystem?.playValkyrieJudgmentCastSound?.(
            new Vector3(pos.x, pos.y, pos.z),
          );
        }
        return;
      }

      if (data.strikeAt == null) return;

      const strikeId = `valkyrie-judgment-${data.valkyrieId}-${data.strikeAt}`;
      const strikePos = new Vector3(
        data.targetPosition.x,
        data.targetPosition.y,
        data.targetPosition.z,
      );
      explosionBurstLayerRef.current?.addValkyrieJudgmentStrike({
        id: strikeId,
        position: strikePos,
        strikeAt: data.strikeAt,
        hoverMs: data.hoverMs,
        fallMs: data.fallMs,
        skyHeight: data.skyHeight,
      });

      const fallMs = data.fallMs ?? VALKYRIE_JUDGMENT_FALL_MS;
      const fallStart = data.strikeAt - fallMs;
      const delay = Math.max(0, fallStart - Date.now());
      const existing = valkyrieJudgmentFallTimeoutsRef.current.get(strikeId);
      if (existing) clearTimeout(existing);
      const timeoutId = setTimeout(() => {
        valkyrieJudgmentFallTimeoutsRef.current.delete(strikeId);
        window.audioSystem?.playValkyrieJudgmentFallSound?.(strikePos);
      }, delay);
      valkyrieJudgmentFallTimeoutsRef.current.set(strikeId, timeoutId);
    };
    socket.on('valkyrie-lunge-hit', handleValkyrieLungeHit);
    socket.on('valkyrie-judgment-cast', handleValkyrieJudgmentCast);
    socket.on('knight-smite',  handleKnightSmite);
    socket.on('allied-knight-smite-impact', handleAlliedKnightSmiteImpact);
    socket.on('allied-healer-greater-heal', handleAlliedHealerGreaterHeal);
    socket.on('knight-frost',  handleKnightFrost);
    socket.on('knight-frost-projectile', handleKnightFrostProjectile);
    socket.on('frost-queen-ice-shards-projectile', handleFrostQueenIceShardsProjectile);
    socket.on('frost-queen-ice-shards-hit', handleFrostQueenIceShardsHit);
    socket.on('knight-deathgrasp-projectile', handleKnightDeathGraspProjectile);
    socket.on('knight-deathgrasp-pull', handleKnightDeathGraspPull);
    socket.on('boss2-deathgrasp-projectiles', handleBoss2DeathGraspProjectiles);
    socket.on('boss2-deathgrasp-pull', handleBoss2DeathGraspPull);
    socket.on('player-deathgrasp-hit', handlePlayerDeathGraspHit);
    socket.on('player-deathgrasp-pull', handlePlayerDeathGraspPull);
    socket.on('templar-attack-telegraph', handleTemplarAttackTelegraph);
    socket.on('templar-attack', handleTemplarAttack);
    socket.on('spectre-attack-telegraph', handleSpectreAttackTelegraph);
    socket.on('spectre-attack', handleSpectreAttack);
    socket.on('death-knight-attack-telegraph', handleDeathKnightAttackTelegraph);
    socket.on('death-knight-attack', handleDeathKnightAttack);
    socket.on('shaman-attack-telegraph', handleShamanAttackTelegraph);
    socket.on('shaman-attack', handleShamanAttack);
    socket.on('serpent-attack-telegraph', handleSerpentAttackTelegraph);
    socket.on('serpent-attack', handleSerpentAttack);
    socket.on('wyvern-attack-telegraph', handleWyvernAttackTelegraph);
    socket.on('wyvern-attack', handleWyvernAttack);
    socket.on('destiny-attack-telegraph', handleDestinyAttackTelegraph);
    socket.on('destiny-attack', handleDestinyAttack);
    socket.on('tiger-attack-telegraph', handleTigerAttackTelegraph);
    socket.on('tiger-attack', handleTigerAttack);
    socket.on('wolf-attack-telegraph', handleWolfAttackTelegraph);
    socket.on('wolf-attack', handleWolfAttack);
    socket.on('bear-attack-telegraph', handleBearAttackTelegraph);
    socket.on('bear-attack', handleBearAttack);
    socket.on('bone-spider-attack-telegraph', handleBoneSpiderAttackTelegraph);
    socket.on('bone-spider-attack', handleBoneSpiderAttack);
    socket.on('skyray-attack-telegraph', handleSkyrayAttackTelegraph);
    socket.on('skyray-attack', handleSkyrayAttack);
    socket.on('terrorhawk-attack-telegraph', handleTerrorhawkAttackTelegraph);
    socket.on('terrorhawk-attack', handleTerrorhawkAttack);

    // Centralized melee whiff: cancel pending miss timer, play whoosh + MISS floater immediately
    const meleeWhiffBindings: Array<{
      event: string;
      idField: string;
      timers: React.MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>;
    }> = [
      { event: 'knight-attack-whiff', idField: 'knightId', timers: knightPendingMissTimers },
      { event: 'templar-attack-whiff', idField: 'templarId', timers: templarPendingMissTimers },
      { event: 'spectre-attack-whiff', idField: 'spectreId', timers: spectrePendingMissTimers },
      { event: 'death-knight-attack-whiff', idField: 'deathKnightId', timers: deathKnightPendingMissTimers },
      { event: 'shaman-attack-whiff', idField: 'shamanId', timers: shamanPendingMissTimers },
      { event: 'serpent-attack-whiff', idField: 'serpentId', timers: serpentPendingMissTimers },
      { event: 'tiger-attack-whiff', idField: 'tigerId', timers: tigerPendingMissTimers },
      { event: 'wolf-attack-whiff', idField: 'wolfId', timers: wolfPendingMissTimers },
      { event: 'bear-attack-whiff', idField: 'bearId', timers: bearPendingMissTimers },
      { event: 'bone-spider-attack-whiff', idField: 'boneSpiderId', timers: boneSpiderPendingMissTimers },
      { event: 'skyray-attack-whiff', idField: 'skyrayId', timers: skyrayPendingMissTimers },
      { event: 'terrorhawk-attack-whiff', idField: 'terrorhawkId', timers: terrorhawkPendingMissTimers },
      { event: 'wyvern-attack-whiff', idField: 'wyvernId', timers: wyvernPendingMissTimers },
      { event: 'destiny-attack-whiff', idField: 'destinyId', timers: wyvernPendingMissTimers },
      { event: 'boss-attack-whiff', idField: 'bossId', timers: bossPendingMissTimers },
      { event: 'nemesis-attack-whiff', idField: 'nemesisId', timers: nemesisPendingMissTimers },
      { event: 'titan-attack-whiff', idField: 'titanId', timers: titanPendingMissTimers },
      { event: 'stone-giant-attack-whiff', idField: 'stoneGiantId', timers: stoneGiantPendingMissTimers },
      { event: 'eternal-oak-attack-whiff', idField: 'eternalOakId', timers: eternalOakPendingMissTimers },
      { event: 'colossus-attack-whiff', idField: 'colossusId', timers: colossusPendingMissTimers },
      { event: 'ghoul-attack-whiff', idField: 'ghoulId', timers: knightPendingMissTimers },
    ];

    const handleMeleeAttackWhiff = (idField: string, timers: React.MutableRefObject<Map<string, ReturnType<typeof setTimeout>>>) =>
      (data: any) => {
        if (!isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
        const id = data?.[idField];
        if (id) {
          const pending = timers.current.get(id);
          if (pending) {
            clearTimeout(pending);
            timers.current.delete(id);
          }
        }
        const pos = meleeImpactPosition(data);
        playIncomingMeleeWhiffSound(pos);
        showLocalPlayerMissNumber();
      };

    const meleeWhiffHandlers = meleeWhiffBindings.map((b) => ({
      event: b.event,
      handler: handleMeleeAttackWhiff(b.idField, b.timers),
    }));
    for (const { event, handler } of meleeWhiffHandlers) {
      socket.on(event, handler);
    }

    socket.on('enemy-status-effect', handleEnemyStatusEffect);
    socket.on('enemy-chill-sync', handleEnemyChillSync);
    socket.on('enemy-stagger-proc', handleEnemyStaggerProc);
    socket.on('knight-death-vortex', handleKnightDeathVortex);
    socket.on('shade-blink-telegraph', handleShadeBlinkTelegraph);
    socket.on('shade-attack-telegraph', handleShadeAttackTelegraph);
    socket.on('warlock-blink-telegraph', handleWarlockBlinkTelegraph);

    const handleWarlockAttackTelegraph = (data: {
      warlockId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
    }) => {
      if (!coopServerEnemyLiving(data.warlockId)) return;

      const start = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const staleTarget = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);

      projectileLayerRef.current?.addWarlockProjectile({
          id: `warlock-orb-${data.warlockId}-${Date.now()}`,
          startPosition: start.clone(),
          targetPosition: staleTarget.clone(),
          damage: data.damage,
          warlockId: data.warlockId,
        });
    };

    socket.on('warlock-attack-telegraph', handleWarlockAttackTelegraph);

    const handleWarlockOrbImpact = (data: {
      warlockId: string;
      position: { x: number; y: number; z: number };
      hit: boolean;
    }) => {
      const pos = new Vector3(data.position.x, data.position.y, data.position.z);
      explosionBurstLayerRef.current?.addWarlockVoidBoltExplosion({
          id: `void-bolt-impact-${data.warlockId}-${Date.now()}-${Math.random()}`,
          position: pos,
        });
      window.audioSystem?.playWarlockVoidboltSound(
        pos,
        data.hit ? undefined : { volume: 0.45 },
      );
    };

    socket.on('warlock-orb-impact', handleWarlockOrbImpact);

    const handleMedusaVoidWarpTelegraph = (data: {
      medusaId: string;
      durationMs: number;
      timestamp?: number;
    }) => {
      if (!data?.medusaId) return;
      registerMedusaVoidWarp(data.medusaId, data.durationMs, data.timestamp ?? Date.now());
    };

    const handleMedusaProjectileTelegraph = (data: {
      medusaId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
    }) => {
      if (!coopServerEnemyLiving(data.medusaId)) return;
      projectileLayerRef.current?.addMedusaProjectile({
        id: `medusa-bolt-${data.medusaId}-${Date.now()}-${Math.random()}`,
        startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
        targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
        damage: data.damage,
        medusaId: data.medusaId,
      } satisfies MedusaProjectileState);
    };

    const handleMedusaProjectileImpact = (data: {
      medusaId: string;
      position: { x: number; y: number; z: number };
      hit: boolean;
    }) => {
      const pos = new Vector3(data.position.x, data.position.y, data.position.z);
      explosionBurstLayerRef.current?.addWarlockVoidBoltExplosion({
        id: `medusa-bolt-impact-${data.medusaId}-${Date.now()}-${Math.random()}`,
        position: pos,
      });
    };

    socket.on('medusa-voidwarp-telegraph', handleMedusaVoidWarpTelegraph);
    socket.on('medusa-projectile-telegraph', handleMedusaProjectileTelegraph);
    socket.on('medusa-projectile-impact', handleMedusaProjectileImpact);

    const handleGreedLaunchTelegraph = (data: {
      greedId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
    }) => {
      if (!coopServerEnemyLiving(data.greedId)) return;
      projectileLayerRef.current?.addGreedFireball({
          id: `greed-fireball-${data.greedId}-${Date.now()}`,
          startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
          targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
          greedId: data.greedId,
        });
    };

    socket.on('greed-launch-telegraph', handleGreedLaunchTelegraph);

    const handleGreedFireballImpact = (data: {
      greedId: string;
      position: { x: number; y: number; z: number };
      hit: boolean;
    }) => {
      projectileLayerRef.current?.removeGreedFireballByGreedId(data.greedId);
      const pos = new Vector3(data.position.x, data.position.y ?? 0, data.position.z);
      window.audioSystem?.playFireboltImpactSound(
        pos,
        data.hit ? undefined : { volume: 0.45 },
      );
    };

    socket.on('greed-fireball-impact', handleGreedFireballImpact);

    const handleWyvernBreathFirebolt = (data: {
      wyvernId: string;
      fireboltId?: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
    }) => {
      if (!coopServerEnemyLiving(data.wyvernId)) return;
      projectileLayerRef.current?.addWyvernBreathFirebolt({
          id: data.fireboltId || `wyvern-breath-${data.wyvernId}-${Date.now()}`,
          startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
          targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
          wyvernId: data.wyvernId,
      });
    };

    socket.on('wyvern-breath-firebolt', handleWyvernBreathFirebolt);

    const BREATH_IMPACT_SFX_THROTTLE_MS = 150;
    const playThrottledBreathImpactSfx = (
      enemyId: string,
      position: { x: number; y?: number; z: number },
      hit: boolean,
    ) => {
      const now = performance.now();
      const last = breathImpactSfxAtRef.current.get(enemyId) ?? 0;
      if (now - last < BREATH_IMPACT_SFX_THROTTLE_MS) return;
      breathImpactSfxAtRef.current.set(enemyId, now);
      const pos = new Vector3(position.x, position.y ?? 0, position.z);
      window.audioSystem?.playFireboltImpactSound(
        pos,
        hit ? undefined : { volume: 0.45 },
      );
    };

    const handleWyvernBreathImpact = (data: {
      wyvernId: string;
      fireboltId?: string;
      position: { x: number; y: number; z: number };
      hit: boolean;
    }) => {
      if (data.fireboltId) {
        projectileLayerRef.current?.removeWyvernBreathFireboltById(data.fireboltId);
      } else {
        projectileLayerRef.current?.removeWyvernBreathFireboltByWyvernId(data.wyvernId);
      }
      playThrottledBreathImpactSfx(data.wyvernId, data.position, data.hit);
    };

    socket.on('wyvern-breath-impact', handleWyvernBreathImpact);

    const handleDestinyBreathFirebolt = (data: {
      destinyId: string;
      fireboltId?: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
      fromAir?: boolean;
    }) => {
      if (!coopServerEnemyLiving(data.destinyId)) return;
      projectileLayerRef.current?.addDestinyBreathFirebolt({
          id: data.fireboltId || `destiny-breath-${data.destinyId}-${Date.now()}`,
          startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
          targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
          destinyId: data.destinyId,
          fromAir: !!data.fromAir,
      });
    };

    socket.on('destiny-breath-firebolt', handleDestinyBreathFirebolt);

    const handleDestinyBreathImpact = (data: {
      destinyId: string;
      fireboltId?: string;
      position: { x: number; y: number; z: number };
      hit: boolean;
    }) => {
      if (data.fireboltId) {
        projectileLayerRef.current?.removeDestinyBreathFireboltById(data.fireboltId);
      } else {
        projectileLayerRef.current?.removeDestinyBreathFireboltByDestinyId(data.destinyId);
      }
      playThrottledBreathImpactSfx(data.destinyId, data.position, data.hit);
    };

    socket.on('destiny-breath-impact', handleDestinyBreathImpact);

    const handleSentinelOrbTelegraph = (data: {
      sentinelId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
    }) => {
      if (!coopServerEnemyLiving(data.sentinelId)) return;
      projectileLayerRef.current?.addSentinelVoidOrb({
        id: `sentinel-orb-${data.sentinelId}-${Date.now()}`,
        startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
        targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
        sentinelId: data.sentinelId,
      });
    };

    const handleSentinelOrbImpact = (data: { sentinelId: string }) => {
      projectileLayerRef.current?.removeSentinelVoidOrbBySentinelId(data.sentinelId);
    };

    socket.on('sentinel-orb-telegraph', handleSentinelOrbTelegraph);
    socket.on('sentinel-orb-impact', handleSentinelOrbImpact);

    const handleBoneSpiderEnsnaringShotTelegraph = (data: {
      spiderId: string;
      shotId?: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
    }) => {
      if (!coopServerEnemyLiving(data.spiderId)) return;
      projectileLayerRef.current?.addBoneSpiderEnsnaringShot({
        id: `bone-spider-ensnare-${data.spiderId}-${data.shotId ?? Date.now()}`,
        startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
        targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
        spiderId: data.spiderId,
        shotId: data.shotId,
      });
    };

    const handleBoneSpiderEnsnaringShotOutcome = (data: { spiderId: string }) => {
      projectileLayerRef.current?.removeBoneSpiderEnsnaringShotBySpiderId(data.spiderId);
    };

    socket.on('bone-spider-ensnaring-shot-telegraph', handleBoneSpiderEnsnaringShotTelegraph);
    socket.on('bone-spider-ensnaring-shot-outcome', handleBoneSpiderEnsnaringShotOutcome);

    const handleEnchantressEarthShockTelegraph = (data: {
      enchantressId: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      damage: number;
    }) => {
      if (!coopServerEnemyLiving(data.enchantressId)) return;
      projectileLayerRef.current?.addEnchantressEarthShock({
        id: `enchantress-earth-shock-${data.enchantressId}-${Date.now()}`,
        startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
        targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
        enchantressId: data.enchantressId,
      });
    };

    socket.on('enchantress-earth-shock-telegraph', handleEnchantressEarthShockTelegraph);

    const handleEnchantressEarthShockImpact = (data: {
      enchantressId: string;
      position: { x: number; y: number; z: number };
      hit: boolean;
    }) => {
      projectileLayerRef.current?.removeEnchantressEarthShockByEnchantressId(data.enchantressId);
    };

    socket.on('enchantress-earth-shock-impact', handleEnchantressEarthShockImpact);

    const handleAlliedSpiderEnsnaringThreadsTelegraph = (data: {
      spiderId: string;
      shotId?: string;
      startPosition: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
    }) => {
      if (!coopServerEnemyLiving(data.spiderId)) return;
      projectileLayerRef.current?.addAlliedSpiderEnsnaringThreads({
        id: `allied-spider-threads-${data.shotId || data.spiderId}-${Date.now()}`,
        startPosition: new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z),
        targetPosition: new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z),
        spiderId: data.spiderId,
        shotId: data.shotId,
      });
    };

    const handleAlliedSpiderEnsnaringThreadsImpact = (data: {
      spiderId: string;
      hit?: boolean;
      targetEnemyId?: string;
      entangleTheme?: string;
      position?: { x: number; y: number; z: number };
    }) => {
      projectileLayerRef.current?.removeAlliedSpiderEnsnaringThreadsBySpiderId(data.spiderId);
      if (data.hit && data.targetEnemyId && data.entangleTheme === 'spider' && data.position) {
        addGlobalEntangledEnemy(
          data.targetEnemyId,
          new Vector3(data.position.x, data.position.y, data.position.z),
          5000,
          'spider',
        );
      }
    };

    socket.on('allied-spider-ensnaring-threads-telegraph', handleAlliedSpiderEnsnaringThreadsTelegraph);
    socket.on('allied-spider-ensnaring-threads-impact', handleAlliedSpiderEnsnaringThreadsImpact);

    const handleAlliedBearSiegebreakerTaunt = (data: {
      bearId: string;
      enemyIds?: string[];
      durationMs?: number;
    }) => {
      const duration = typeof data.durationMs === 'number' ? data.durationMs : 6000;
      for (const enemyId of data.enemyIds || []) {
        createEnemyTauntEffect(enemyId, duration);
      }
    };

    socket.on('allied-bear-siegebreaker-taunt', handleAlliedBearSiegebreakerTaunt);

    const handleGreedEmberZoneSpawned = (data: {
      id: string;
      position: { x: number; z: number };
      radius: number;
      durationMs: number;
    }) => {
      groundHazardLayerRef.current?.addGreedEmberZone({
          id: data.id,
          position: new Vector3(data.position.x, 0, data.position.z),
          radius: data.radius,
          durationMs: data.durationMs
        });
    };

    socket.on('greed-ember-zone-spawned', handleGreedEmberZoneSpawned);

    const handleGreedEmberZoneExpired = (data: { id: string }) => {
      groundHazardLayerRef.current?.removeEmberZone(data.id);
    };

    socket.on('greed-ember-zone-expired', handleGreedEmberZoneExpired);

    const handleWarlockMeteorEmberZoneSpawned = (data: {
      id: string;
      position: { x: number; z: number };
      radius: number;
      durationMs: number;
    }) => {
      groundHazardLayerRef.current?.addWarlockMeteorEmberZone({
          id: data.id,
          position: new Vector3(data.position.x, 0, data.position.z),
          radius: data.radius,
          durationMs: data.durationMs
        });
    };

    socket.on('warlock-meteor-ember-zone-spawned', handleWarlockMeteorEmberZoneSpawned);

    const handleWarlockMeteorEmberZoneExpired = (data: { id: string }) => {
      groundHazardLayerRef.current?.removeWarlockEmberZone(data.id);
    };

    socket.on('warlock-meteor-ember-zone-expired', handleWarlockMeteorEmberZoneExpired);

    const handleDestinyEmberZoneSpawned = (data: {
      id: string;
      position: { x: number; z: number };
      radius: number;
      durationMs: number;
    }) => {
      groundHazardLayerRef.current?.addDestinyEmberZone({
          id: data.id,
          position: new Vector3(data.position.x, 0, data.position.z),
          radius: data.radius,
          durationMs: data.durationMs
        });
    };

    socket.on('destiny-ember-zone-spawned', handleDestinyEmberZoneSpawned);

    const handleDestinyEmberZoneExpired = (data: { id: string }) => {
      groundHazardLayerRef.current?.removeDestinyEmberZone(data.id);
    };

    socket.on('destiny-ember-zone-expired', handleDestinyEmberZoneExpired);

    // Blink animation duration — must match BLINK_ANIMATION_DURATION in WarlockRenderer.tsx
    const WARLOCK_BLINK_ANIM_MS = 800;

    const handleWarlockFlameStrike = (data: {
      warlockId: string;
      position: { x: number; y: number; z: number };
      damage: number;
      radius: number;
    }) => {
      // Wait until the blink slide finishes before erupting so the pillars
      // materialise exactly where the warlock lands.
      setTimeout(() => {
        if (!coopServerEnemyLiving(data.warlockId)) return;

        const strikePos = new Vector3(data.position.x, data.position.y, data.position.z);

        // Play immolate sound the moment the fire pillars erupt
        (window as any).audioSystem?.playWarlockImmolateSound(strikePos);

        // Spawn the visual effect
        bossTelegraphLayerRef.current?.addWarlockFlameStrike({ id: `flame-strike-${data.warlockId}-${Date.now()}`, position: strikePos.clone() });

        // Damage, hit audio, and floating numbers are server-authoritative via `player-damaged`.
      }, WARLOCK_BLINK_ANIM_MS);
    };

    socket.on('warlock-flame-strike', handleWarlockFlameStrike);

    const handleBoss2FlamePillar = (data: {
      bossId: string;
      position: { x: number; y: number; z: number };
      timestamp?: number;
    }) => {
      if (!coopServerEnemyLiving(data.bossId)) return;
      const strikePos = new Vector3(data.position.x, data.position.y, data.position.z);
      (window as any).audioSystem?.playWarlockImmolateSound(strikePos);
      bossTelegraphLayerRef.current?.addWarlockFlameStrike({
          id: `boss2-flame-pillar-${data.bossId}-${data.timestamp ?? Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          position: strikePos.clone(),
        });
    };

    socket.on('boss2-flame-pillar', handleBoss2FlamePillar);

    const handleDestinyWingPillar = (data: {
      destinyId: string;
      position: { x: number; y: number; z: number };
      timestamp?: number;
    }) => {
      if (!coopServerEnemyLiving(data.destinyId)) return;
      const strikePos = new Vector3(data.position.x, data.position.y, data.position.z);
      (window as any).audioSystem?.playWarlockImmolateSound(strikePos);
      bossTelegraphLayerRef.current?.addWarlockFlameStrike({
        id: `destiny-wing-pillar-${data.destinyId}-${data.timestamp ?? Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        position: strikePos.clone(),
      });
    };

    socket.on('destiny-wing-pillar', handleDestinyWingPillar);

    const handleDeathKnightFrostPillar = (data: {
      deathKnightId: string;
      position: { x: number; y: number; z: number };
      timestamp?: number;
    }) => {
      if (!coopServerEnemyLiving(data.deathKnightId)) return;
      const strikePos = new Vector3(data.position.x, data.position.y, data.position.z);
      (window as any).audioSystem?.playFrostNovaSound?.(strikePos);
      bossTelegraphLayerRef.current?.addWarlockFlameStrike({
        id: `death-knight-frost-pillar-${data.deathKnightId}-${data.timestamp ?? Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        position: strikePos.clone(),
        theme: 'frost',
      });
    };

    socket.on('death-knight-frost-pillar', handleDeathKnightFrostPillar);

    const handleArchmageFlamePillar = (data: {
      enemyId?: string;
      position: { x: number; y: number; z: number };
      fromPlayerId?: string;
    }) => {
      if (!data?.position) return;
      const strikePos = new Vector3(data.position.x, data.position.y, data.position.z);
      (window as any).audioSystem?.playWarlockImmolateSound?.(strikePos);
      bossTelegraphLayerRef.current?.addWarlockFlameStrike({
        id: `archmage-flame-pillar-${data.enemyId ?? 'x'}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        position: strikePos.clone(),
      });
    };

    socket.on('archmage-flame-pillar', handleArchmageFlamePillar);

    // ── Ghoul attack (melee damage to local player) ──────────────────────────
    const handleGhoulAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      // Cancel pending miss sound — this attack connected
      if (data.ghoulId) {
        cancelKnightStyleMiss(data.ghoulId);
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;

        const healthBefore = health.currentHealth;
        const shieldBefore = shield?.currentShield;
        const damageApplied = health.takeDamage(data.damage, Date.now() / 1000, playerEntity, false);

        if (damageApplied) {
          const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
          playKnightStyleHit(pos);
        }

        if (playerEntity) {
          const transform = playerEntity.getComponent(Transform);
          if (transform) {
            const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
            if (damageNumberManager && damageNumberManager.addDamageNumber) {
              const pos = transform.position.clone();
              pos.y -= 0.5;
              damageNumberManager.addDamageNumber(data.damage, false, pos, 'physical', true);
            }
            triggerAppliedLocalPlayerDamageFeedback({
              damage: data.damage,
              damageType: 'physical',
              damageApplied,
              health,
              healthBefore,
              shield,
              shieldBefore,
              position: transform.position,
              attackerServerEnemyId: data.ghoulId,
            });
          }
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.ghoulId);
        }
      }
    };

    // ── Titan attack (melee damage to local player; knockback via player-knockback event) ──
    const handleTitanAttackTelegraph = (data: {
      titanId?: string;
      targetPlayerId?: string;
      targetCombatAllyId?: string;
      position?: { x: number; y: number; z: number };
      hitDelayMs?: number;
    }) => {
      if (!data.titanId || !isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const existing = titanPendingMissTimers.current.get(data.titanId);
      if (existing) clearTimeout(existing);
      // Server hit delay is TITAN_HIT_DELAY_MS (875) — wait slightly longer
      const timer = setTimeout(() => {
        titanPendingMissTimers.current.delete(data.titanId!);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 975) + 50);
      titanPendingMissTimers.current.set(data.titanId, timer);
    };

    const handleNemesisAttackTelegraph = (data: {
      nemesisId?: string;
      targetPlayerId?: string;
      targetCombatAllyId?: string;
      position?: { x: number; y: number; z: number };
      hitDelayMs?: number;
    }) => {
      if (!data.nemesisId || !isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const existing = nemesisPendingMissTimers.current.get(data.nemesisId);
      if (existing) clearTimeout(existing);
      // Server hit delay is NEMESIS_HIT_DELAY_MS (437) — wait slightly longer
      const timer = setTimeout(() => {
        nemesisPendingMissTimers.current.delete(data.nemesisId!);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 550) + 50);
      nemesisPendingMissTimers.current.set(data.nemesisId, timer);
    };

    const handleStoneGiantAttackTelegraph = (data: {
      stoneGiantId?: string;
      targetPlayerId?: string;
      targetCombatAllyId?: string;
      position?: { x: number; y: number; z: number };
      hitDelayMs?: number;
    }) => {
      if (!data.stoneGiantId || !isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const existing = stoneGiantPendingMissTimers.current.get(data.stoneGiantId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        stoneGiantPendingMissTimers.current.delete(data.stoneGiantId!);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 1100) + 50);
      stoneGiantPendingMissTimers.current.set(data.stoneGiantId, timer);
    };

    const handleEternalOakAttackTelegraph = (data: {
      eternalOakId?: string;
      targetPlayerId?: string;
      targetCombatAllyId?: string;
      position?: { x: number; y: number; z: number };
      hitDelayMs?: number;
    }) => {
      if (!data.eternalOakId || !isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const existing = eternalOakPendingMissTimers.current.get(data.eternalOakId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        eternalOakPendingMissTimers.current.delete(data.eternalOakId!);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 1250) + 50);
      eternalOakPendingMissTimers.current.set(data.eternalOakId, timer);
    };

    const handleColossusAttackTelegraph = (data: {
      colossusId?: string;
      targetPlayerId?: string;
      targetCombatAllyId?: string;
      position?: { x: number; y: number; z: number };
      hitDelayMs?: number;
    }) => {
      if (!data.colossusId || !isLocalPlayerMeleeTelegraphTarget(data, socket?.id)) return;
      const existing = colossusPendingMissTimers.current.get(data.colossusId);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => {
        colossusPendingMissTimers.current.delete(data.colossusId!);
        showLocalPlayerMissNumber();
      }, (typeof data.hitDelayMs === 'number' ? data.hitDelayMs : 820) + 50);
      colossusPendingMissTimers.current.set(data.colossusId, timer);
    };

    const handleTitanAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

      // Cancel pending titan miss — this attack connected
      if (data.titanId) {
        const pendingMiss = titanPendingMissTimers.current.get(data.titanId);
        if (pendingMiss) {
          clearTimeout(pendingMiss);
          titanPendingMissTimers.current.delete(data.titanId);
        }
      }

      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;

      const health = playerEntity.getComponent(Health);
      const shield = playerEntity.getComponent(Shield);
      if (health) {
        const wasAlive = !health.isDead;

        const healthBefore = health.currentHealth;
        const shieldBefore = shield?.currentShield;
        const damageApplied = health.takeDamage(data.damage, Date.now() / 1000, playerEntity, false);

        if (playerEntity) {
          const transform = playerEntity.getComponent(Transform);
          if (transform) {
            const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
            if (damageNumberManager && damageNumberManager.addDamageNumber) {
              const pos = transform.position.clone();
              pos.y -= 0.5;
              damageNumberManager.addDamageNumber(data.damage, false, pos, 'physical', true);
            }
            triggerAppliedLocalPlayerDamageFeedback({
              damage: data.damage,
              damageType: 'physical',
              damageApplied,
              health,
              healthBefore,
              shield,
              shieldBefore,
              position: transform.position,
              attackerServerEnemyId: data.titanId,
            });
          }
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.titanId);
        }
      }
    };

    // ── Weaver heal VFX ───────────────────────────────────────────────────────
    const handleWeaverHealTelegraph = (data: {
      weaverId: string;
      targetEnemyId: string;
      weaverPosition?: { x: number; y: number; z: number };
      targetPosition: { x: number; y: number; z: number };
      timestamp?: number;
    }) => {
      const ts = data.timestamp ?? Date.now();

      if (!data.weaverPosition) {
        setTimeout(() => {
          const pos = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);
          summonRitualLayerRef.current?.addWeaverHealEffect({
            id: `weaver-heal-${data.weaverId}-${ts}`,
            position: pos,
          });
          window.audioSystem?.playGreaterHealSound?.(pos);
        }, 1800);
        return;
      }

      const from = new Vector3(data.weaverPosition.x, 0, data.weaverPosition.z);
      const to = new Vector3(data.targetPosition.x, 0, data.targetPosition.z);

      summonRitualLayerRef.current?.addWeaverHealZap({
        id: `weaver-heal-cast-${data.weaverId}-${ts}`,
        from,
        to,
        variant: 'cast',
      });

      setTimeout(() => {
        const liveTo = to.clone();
        const liveTarget = enemiesRef.current.get(data.targetEnemyId);
        if (liveTarget && !liveTarget.isDying) {
          liveTo.set(liveTarget.position.x, 0, liveTarget.position.z);
        }

        summonRitualLayerRef.current?.addWeaverHealZap({
          id: `weaver-heal-impact-${data.weaverId}-${ts}`,
          from,
          to: liveTo,
          variant: 'impact',
        });
        summonRitualLayerRef.current?.addWeaverHealEffect({
          id: `weaver-heal-${data.weaverId}-${ts}`,
          position: liveTo,
        });
        window.audioSystem?.playGreaterHealSound?.(liveTo);
      }, 1800);
    };

    // ── Weaver summon telegraph — spawn ritual circle at cast start ───────────
    // The backend now includes ritualPosition in the telegraph so the circle
    // appears on the ground the moment the weaver begins the cast animation.
    const handleWeaverSummonTelegraph = (data: {
      weaverId: string;
      ritualPosition: { x: number; y: number; z: number };
    }) => {
      if (!data.ritualPosition) return; // Guard for older server versions
      const ritualPos = new Vector3(
        data.ritualPosition.x,
        data.ritualPosition.y,
        data.ritualPosition.z
      );
      window.audioSystem?.playWeaverGhoulSummonSound(ritualPos);
      const isDeliriumSpawner = data.weaverId === 'delirium-gate-spawner';
      summonRitualLayerRef.current?.addGhoulSummonRitual({
        id: `ghoul-ritual-${data.weaverId}-${Date.now()}`,
        position: ritualPos,
        ...(isDeliriumSpawner ? { duration: 2 } : {}),
      });
    };

    const handleWeaverLightningTelegraph = (data: {
      weaverId: string;
      targetPosition: { x: number; y: number; z: number };
      strikeAt: number;
      damage: number;
      radius?: number;
      theme?: 'blue' | 'green';
      timestamp: number;
    }) => {
      const pos = new Vector3(
        data.targetPosition.x,
        data.targetPosition.y,
        data.targetPosition.z
      );
      const theme: 'blue' | 'green' = data.theme ??
        (enemiesRef.current.get(data.weaverId)?.type === 'boss3' ? 'green' : 'blue');
      bossTelegraphLayerRef.current?.addWeaverLightningStrike({
          id: `weaver-lightning-${data.weaverId}-${data.timestamp}`,
          weaverId: data.weaverId,
          targetPosition: pos,
          strikeAt: data.strikeAt,
          damage: data.damage,
          radius: data.radius ?? 2.99,
          theme,
        });
    };

    const handleWeaverImpaleSpikeTelegraph = (data: {
      weaverId: string;
      spikeId: string;
      position: { x: number; y: number; z: number };
      warningMs?: number;
      soulType?: 'blue' | 'green';
      timestamp: number;
    }) => {
      const w = data.warningMs !== undefined && data.warningMs >= 0 ? data.warningMs : 750;
      const theme = data.soulType === 'blue' ? 'blue' : 'green';
      groundTelegraphLayerRef.current?.addWeaverImpaleTelegraph({
          id: `weaver-impale-tg-${data.spikeId}`,
          x: data.position.x,
          y: data.position.y,
          z: data.position.z,
          durationMs: w,
          theme,
        });
      bossMechanicLayerRef.current?.addTectonicSpikeGroundCrack({
          id: `cracks-${data.spikeId}`,
          x: data.position.x,
          y: data.position.y,
          z: data.position.z,
          seed: data.spikeId,
          visibleMs: w + POST_SPIKE_CRACK_HOLD_MS,
          fadeMs: SPIKE_CRACK_FADE_MS,
          theme,
        });
    };

    const handleWeaverImpaleSpikeAppear = (data: {
      weaverId: string;
      spikeId: string;
      position: { x: number; y: number; z: number };
      soulType?: 'blue' | 'green';
      timestamp: number;
    }) => {
      const theme = data.soulType === 'blue' ? 'blue' : 'green';
      const pos = new Vector3(data.position.x, data.position.y, data.position.z);
      bossMechanicLayerRef.current?.addWeaverImpaleSpike({ id: `weaver-impale-spike-${data.spikeId}`, position: pos, theme });
    };

    const handleInfestedZombieSummon = (data: {
      zombieId: string;
      position: { x: number; y: number; z: number };
    }) => {
      if (!data.position) return;
      const pos = new Vector3(data.position.x, data.position.y, data.position.z);
      window.audioSystem?.playSummonZombieSound(pos);
      summonRitualLayerRef.current?.addInfestedZombieSummonVfx({ id: `infested-rise-${data.zombieId}-${Date.now()}`, position: pos },
      );
    };

    const handlePlayerZombieExplosion = (data: {
      zombieId: string;
      position: { x: number; y: number; z: number };
      radius?: number;
      timestamp?: number;
    }) => {
      if (!data.position) return;
      const pos = new Vector3(data.position.x, data.position.y, data.position.z);
      window.audioSystem?.playExplosionSound(pos);
      summonRitualLayerRef.current?.addExploderStrainVenomVfx({ id: `exploder-venom-${data.zombieId}-${data.timestamp ?? Date.now()}`, position: pos },
      );
    };

    // Flame "summoned from the abyss" burst when a wave enemy spawns into a room.
    const handleEnemySummonVfx = (data: {
      enemyId: string;
      enemyType?: string;
      position: { x: number; y: number; z: number };
    }) => {
      if (!data.position) return;
      const pos = new Vector3(data.position.x, data.position.y, data.position.z);
      window.audioSystem?.playEnemySummonSpawnSound(pos);
      summonRitualLayerRef.current?.addEnemySummonFlameVfx({ id: `enemy-summon-${data.enemyId}-${Date.now()}`, position: pos },
      );
    };

    socket.on('ghoul-attack', handleGhoulAttack);
    const handleNemesisAttack = (data: any) => {
      if (data.nemesisId) {
        const pendingMiss = nemesisPendingMissTimers.current.get(data.nemesisId);
        if (pendingMiss) {
          clearTimeout(pendingMiss);
          nemesisPendingMissTimers.current.delete(data.nemesisId);
        }
      }
      handleTitanAttack({ ...data, titanId: data.nemesisId });
    };
    const handleStoneGiantAttack = (data: any) => {
      if (data.stoneGiantId) {
        const pendingMiss = stoneGiantPendingMissTimers.current.get(data.stoneGiantId);
        if (pendingMiss) {
          clearTimeout(pendingMiss);
          stoneGiantPendingMissTimers.current.delete(data.stoneGiantId);
        }
      }
      handleTitanAttack({ ...data, titanId: data.stoneGiantId });
    };
    const handleEternalOakAttack = (data: any) => {
      if (data.eternalOakId) {
        const pendingMiss = eternalOakPendingMissTimers.current.get(data.eternalOakId);
        if (pendingMiss) {
          clearTimeout(pendingMiss);
          eternalOakPendingMissTimers.current.delete(data.eternalOakId);
        }
      }
      handleTitanAttack({ ...data, titanId: data.eternalOakId });
    };
    const handleColossusAttack = (data: any) => {
      if (data.colossusId) {
        const pendingMiss = colossusPendingMissTimers.current.get(data.colossusId);
        if (pendingMiss) {
          clearTimeout(pendingMiss);
          colossusPendingMissTimers.current.delete(data.colossusId);
        }
      }
      handleTitanAttack({ ...data, titanId: data.colossusId });
    };
    const handleEternalOakEarthbreakerImpact = (data: {
      eternalOakId?: string;
      position?: { x: number; y: number; z: number };
      radius?: number;
      stunMs?: number;
    }) => {
      if (!data.position || !socket?.id) return;
      const playerEntity = getLocalPlayerEntity();
      if (!playerEntity) return;
      const transform = playerEntity.getComponent(Transform);
      if (!transform) return;
      const radius = data.radius ?? 6;
      const dx = transform.position.x - data.position.x;
      const dz = transform.position.z - data.position.z;
      if (dx * dx + dz * dz > radius * radius) return;
      applyLocalPlayerStun(data.stunMs ?? 3300, 'eternal-oak-earthbreaker');
    };
    socket.on('boss-attack-telegraph', handleBossAttackTelegraph);
    socket.on('titan-attack-telegraph', handleTitanAttackTelegraph);
    socket.on('nemesis-attack-telegraph', handleNemesisAttackTelegraph);
    socket.on('stone-giant-attack-telegraph', handleStoneGiantAttackTelegraph);
    socket.on('eternal-oak-attack-telegraph', handleEternalOakAttackTelegraph);
    socket.on('colossus-attack-telegraph', handleColossusAttackTelegraph);
    socket.on('titan-attack', handleTitanAttack);
    socket.on('nemesis-attack', handleNemesisAttack);
    socket.on('stone-giant-attack', handleStoneGiantAttack);
    socket.on('eternal-oak-attack', handleEternalOakAttack);
    socket.on('colossus-attack', handleColossusAttack);
    socket.on('eternal-oak-earthbreaker-impact', handleEternalOakEarthbreakerImpact);
    socket.on('weaver-heal-telegraph', handleWeaverHealTelegraph);
    socket.on('weaver-summon-telegraph', handleWeaverSummonTelegraph);
    socket.on('weaver-lightning-telegraph', handleWeaverLightningTelegraph);
    socket.on('weaver-impale-spike-telegraph', handleWeaverImpaleSpikeTelegraph);
    socket.on('weaver-impale-spike-appear', handleWeaverImpaleSpikeAppear);
    socket.on('infested-zombie-summon', handleInfestedZombieSummon);
    socket.on('player-zombie-explosion', handlePlayerZombieExplosion);
    socket.on('enemy-summon-vfx', handleEnemySummonVfx);
    socket.on('coop-room-whisper', handleCoopRoomWhisper);

    return () => {
      unregisterEnemyTelegraphSounds();
      unregisterBeastAudioSounds();
      unregisterKnightAnimationListeners();
      unregisterWolfAnimationListeners();
      unregisterAssassinAnimationListeners();
      unregisterValkyrieAnimationListeners();
      unregisterSkeletonMoveListeners();
      socket.off('coop-room-whisper', handleCoopRoomWhisper);
      tentacleSpinePendingByEnemyRef.current.forEach((p, enemyId) => {
        if (p.tAdd) clearTimeout(p.tAdd);
        if (p.tFail) clearTimeout(p.tFail);
        if (p.tImpact) clearTimeout(p.tImpact);
        groundTelegraphLayerRef.current?.removeTentacleSpineTelegraphsByEnemyId(enemyId);
      });
      tentacleSpinePendingByEnemyRef.current.clear();
      tentacleSpineLastSlamAtRef.current.clear();
      greaterHealImpactTimers.current.forEach(clearTimeout);
      greaterHealImpactTimers.current = [];
      for (const off of cosmeticOffs) off();
      socket.off('player-damaged', handlePlayerDamaged);
      socket.off('player-healing', handlePlayerHealing);
      socket.off('enemy-healed', handleEnemyHealed);
      socket.off('player-experience-gained', handlePlayerExperienceGained);
      socket.off('player-kill', handlePlayerKill);
      socket.off('pillar-destroyed', handlePillarDestroyed);
      socket.off('player-essence-changed', handlePlayerEssenceChanged);
      unregisterGoldHandler();
      unregisterFlowHandler();
      unregisterWoodHandler();
      unregisterStoneHandler();
      unregisterMeatHandler();
      unregisterHungerHandler();
      unregisterFateHandler();
      socket.off('gold-picked-up', handleGoldPickedUp);
      socket.off('gold-expired', handleGoldExpired);
      socket.off('wood-picked-up', handleWoodPickedUp);
      socket.off('stone-picked-up', handleStonePickedUp);
      socket.off('meat-picked-up', handleMeatPickedUp);
      socket.off('item-picked-up', handleItemPickedUpForVfx);
      socket.off('item-expired', handleItemExpired);
      socket.off('player-animation-state', handlePlayerAnimationState);
      socket.off('player-debuff', handlePlayerDebuff);
      socket.off('player-stealth', handlePlayerStealth);
      socket.off('player-respawned', handlePlayerRespawned);
      socket.off('player-shield-changed', handlePlayerShieldChanged);
      socket.off('player-knockback', handlePlayerKnockback);
      socket.off('boss-attack-telegraph', handleBossAttackTelegraph);
      socket.off('boss-defeated', handleBossDefeated);
      socket.off('spell-thief-dash-restore', handleSpellThiefDashRestore);
      socket.off('boss-throw-spear', handleBossThrowSpear);
      socket.off('boss-tectonic-spike-telegraph', handleBossTectonicSpikeTelegraph);
      socket.off('boss-tectonic-spike-appear', handleBossTectonicSpikeAppear);
      socket.off('boss2-archon-lightning', handleBoss2ArchonLightning);
      socket.off('warlock-archon-shock', handleWarlockArchonShock);
      socket.off('knight-storm-lash-zap', handleKnightStormLashZap);
      socket.off('shaman-storm-shock-zap', handleShamanStormShockZap);
      socket.off('shaman-spirit-wolves-cast', handleShamanSpiritWolvesCast);
      socket.off('boss3-nova-release', handleBoss3NovaRelease);
      socket.off('templar-teleport', handleTemplarTeleport);
      socket.off('frost-queen-teleport', handleFrostQueenTeleport);
      socket.off('templar-blink-smite-impact', handleTemplarBlinkSmiteImpact);
      socket.off('martyr-detonation-telegraph', handleMartyrDetonationTelegraph);
      socket.off('martyr-detonation-impact', handleMartyrDetonationImpact);
      socket.off('wraith-stealth-cloak', handleWraithStealthCloak);
      socket.off('wraith-stealth-reveal', handleWraithStealthReveal);
      socket.off('assassin-dreamshroud-cloak', handleAssassinDreamshroudCloak);
      socket.off('assassin-dreamshroud-reveal', handleAssassinDreamshroudReveal);
      socket.off('fission-detonation', handleFissionDetonation);
      socket.off('boss-skeleton-attack', handleBossSkeletonAttack);
      socket.off('knight-attack-telegraph', handleKnightAttackTelegraph);
      socket.off('allied-knight-attack-telegraph', handleAlliedKnightAttackTelegraph);
      socket.off('ghoul-attack-telegraph', handleGhoulAttackTelegraph);
      socket.off('player-zombie-attack-telegraph', handlePlayerZombieAttackTelegraph);
      socket.off('tentacle-spine-windup', handleTentacleSpineWindup);
      socket.off('tentacle-spine-slam', handleTentacleSpineSlamSocket);
      socket.off('knight-attack', handleKnightAttack);
      socket.off('knight-spin-hit', handleKnightAttack);
      socket.off('assassin-spin-hit', handleAssassinSpinHit);
      socket.off('valkyrie-lunge-hit', handleValkyrieLungeHit);
      socket.off('valkyrie-judgment-cast', handleValkyrieJudgmentCast);
      valkyrieJudgmentFallTimeoutsRef.current.forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
      valkyrieJudgmentFallTimeoutsRef.current.clear();
      stopJudgmentCorruptionSound();
      socket.off('knight-smite',  handleKnightSmite);
      socket.off('allied-knight-smite-impact', handleAlliedKnightSmiteImpact);
      socket.off('allied-healer-greater-heal', handleAlliedHealerGreaterHeal);
      socket.off('knight-frost',  handleKnightFrost);
      socket.off('knight-frost-projectile', handleKnightFrostProjectile);
      socket.off('frost-queen-ice-shards-projectile', handleFrostQueenIceShardsProjectile);
      socket.off('frost-queen-ice-shards-hit', handleFrostQueenIceShardsHit);
      socket.off('knight-deathgrasp-projectile', handleKnightDeathGraspProjectile);
      socket.off('knight-deathgrasp-pull', handleKnightDeathGraspPull);
      socket.off('boss2-deathgrasp-projectiles', handleBoss2DeathGraspProjectiles);
      socket.off('boss2-deathgrasp-pull', handleBoss2DeathGraspPull);
      socket.off('player-deathgrasp-hit', handlePlayerDeathGraspHit);
      socket.off('player-deathgrasp-pull', handlePlayerDeathGraspPull);
      socket.off('templar-attack-telegraph', handleTemplarAttackTelegraph);
      socket.off('templar-attack', handleTemplarAttack);
      socket.off('spectre-attack-telegraph', handleSpectreAttackTelegraph);
      socket.off('spectre-attack', handleSpectreAttack);
      socket.off('death-knight-attack-telegraph', handleDeathKnightAttackTelegraph);
      socket.off('death-knight-attack', handleDeathKnightAttack);
      socket.off('shaman-attack-telegraph', handleShamanAttackTelegraph);
      socket.off('shaman-attack', handleShamanAttack);
      socket.off('serpent-attack-telegraph', handleSerpentAttackTelegraph);
      socket.off('serpent-attack', handleSerpentAttack);
      socket.off('wyvern-attack-telegraph', handleWyvernAttackTelegraph);
      socket.off('wyvern-attack', handleWyvernAttack);
      socket.off('destiny-attack-telegraph', handleDestinyAttackTelegraph);
      socket.off('destiny-attack', handleDestinyAttack);
      socket.off('tiger-attack-telegraph', handleTigerAttackTelegraph);
      socket.off('tiger-attack', handleTigerAttack);
      socket.off('wolf-attack-telegraph', handleWolfAttackTelegraph);
      socket.off('wolf-attack', handleWolfAttack);
      socket.off('bear-attack-telegraph', handleBearAttackTelegraph);
      socket.off('bear-attack', handleBearAttack);
      socket.off('bone-spider-attack-telegraph', handleBoneSpiderAttackTelegraph);
      socket.off('bone-spider-attack', handleBoneSpiderAttack);
      socket.off('skyray-attack-telegraph', handleSkyrayAttackTelegraph);
      socket.off('skyray-attack', handleSkyrayAttack);
      socket.off('terrorhawk-attack-telegraph', handleTerrorhawkAttackTelegraph);
      socket.off('terrorhawk-attack', handleTerrorhawkAttack);
      for (const { event, handler } of meleeWhiffHandlers) {
        socket.off(event, handler);
      }
      // Clear any pending miss timers on cleanup
      knightPendingMissTimers.current.forEach(clearTimeout);
      knightPendingMissTimers.current.clear();
      templarPendingMissTimers.current.forEach(clearTimeout);
      templarPendingMissTimers.current.clear();
      spectrePendingMissTimers.current.forEach(clearTimeout);
      spectrePendingMissTimers.current.clear();
      deathKnightPendingMissTimers.current.forEach(clearTimeout);
      deathKnightPendingMissTimers.current.clear();
      shamanPendingMissTimers.current.forEach(clearTimeout);
      shamanPendingMissTimers.current.clear();
      serpentPendingMissTimers.current.forEach(clearTimeout);
      serpentPendingMissTimers.current.clear();
      tigerPendingMissTimers.current.forEach(clearTimeout);
      tigerPendingMissTimers.current.clear();
      wolfPendingMissTimers.current.forEach(clearTimeout);
      wolfPendingMissTimers.current.clear();
      bearPendingMissTimers.current.forEach(clearTimeout);
      bearPendingMissTimers.current.clear();
      boneSpiderPendingMissTimers.current.forEach(clearTimeout);
      boneSpiderPendingMissTimers.current.clear();
      skyrayPendingMissTimers.current.forEach(clearTimeout);
      skyrayPendingMissTimers.current.clear();
      wyvernPendingMissTimers.current.forEach(clearTimeout);
      wyvernPendingMissTimers.current.clear();
      bossPendingMissTimers.current.forEach(clearTimeout);
      bossPendingMissTimers.current.clear();
      nemesisPendingMissTimers.current.forEach(clearTimeout);
      nemesisPendingMissTimers.current.clear();
      titanPendingMissTimers.current.forEach(clearTimeout);
      titanPendingMissTimers.current.clear();
      stoneGiantPendingMissTimers.current.forEach(clearTimeout);
      stoneGiantPendingMissTimers.current.clear();
      eternalOakPendingMissTimers.current.forEach(clearTimeout);
      eternalOakPendingMissTimers.current.clear();
      colossusPendingMissTimers.current.forEach(clearTimeout);
      colossusPendingMissTimers.current.clear();
      clearAllKnightStyleMissTimers();
      socket.off('enemy-status-effect', handleEnemyStatusEffect);
      socket.off('enemy-chill-sync', handleEnemyChillSync);
      socket.off('enemy-stagger-proc', handleEnemyStaggerProc);
      socket.off('knight-death-vortex', handleKnightDeathVortex);
      socket.off('shade-blink-telegraph', handleShadeBlinkTelegraph);
      socket.off('shade-attack-telegraph', handleShadeAttackTelegraph);
      socket.off('warlock-blink-telegraph', handleWarlockBlinkTelegraph);
      socket.off('warlock-attack-telegraph', handleWarlockAttackTelegraph);
      socket.off('warlock-orb-impact', handleWarlockOrbImpact);
      socket.off('medusa-voidwarp-telegraph', handleMedusaVoidWarpTelegraph);
      socket.off('medusa-projectile-telegraph', handleMedusaProjectileTelegraph);
      socket.off('medusa-projectile-impact', handleMedusaProjectileImpact);
      socket.off('greed-launch-telegraph', handleGreedLaunchTelegraph);
      socket.off('greed-fireball-impact', handleGreedFireballImpact);
      socket.off('wyvern-breath-firebolt', handleWyvernBreathFirebolt);
      socket.off('wyvern-breath-impact', handleWyvernBreathImpact);
      socket.off('destiny-breath-firebolt', handleDestinyBreathFirebolt);
      socket.off('destiny-breath-impact', handleDestinyBreathImpact);
      socket.off('enchantress-earth-shock-telegraph', handleEnchantressEarthShockTelegraph);
      socket.off('enchantress-earth-shock-impact', handleEnchantressEarthShockImpact);
      socket.off('allied-spider-ensnaring-threads-telegraph', handleAlliedSpiderEnsnaringThreadsTelegraph);
      socket.off('allied-spider-ensnaring-threads-impact', handleAlliedSpiderEnsnaringThreadsImpact);
      socket.off('allied-bear-siegebreaker-taunt', handleAlliedBearSiegebreakerTaunt);
      socket.off('greed-ember-zone-spawned', handleGreedEmberZoneSpawned);
      socket.off('greed-ember-zone-expired', handleGreedEmberZoneExpired);
      socket.off('warlock-meteor-ember-zone-spawned', handleWarlockMeteorEmberZoneSpawned);
      socket.off('warlock-meteor-ember-zone-expired', handleWarlockMeteorEmberZoneExpired);
      socket.off('destiny-ember-zone-spawned', handleDestinyEmberZoneSpawned);
      socket.off('destiny-ember-zone-expired', handleDestinyEmberZoneExpired);
      socket.off('warlock-flame-strike', handleWarlockFlameStrike);
      socket.off('boss2-flame-pillar', handleBoss2FlamePillar);
      socket.off('destiny-wing-pillar', handleDestinyWingPillar);
      socket.off('death-knight-frost-pillar', handleDeathKnightFrostPillar);
      socket.off('archmage-flame-pillar', handleArchmageFlamePillar);
      socket.off('ghoul-attack', handleGhoulAttack);
      socket.off('titan-attack', handleTitanAttack);
      socket.off('titan-attack-telegraph', handleTitanAttackTelegraph);
      socket.off('nemesis-attack', handleNemesisAttack);
      socket.off('nemesis-attack-telegraph', handleNemesisAttackTelegraph);
      socket.off('stone-giant-attack', handleStoneGiantAttack);
      socket.off('stone-giant-attack-telegraph', handleStoneGiantAttackTelegraph);
      socket.off('eternal-oak-attack', handleEternalOakAttack);
      socket.off('eternal-oak-attack-telegraph', handleEternalOakAttackTelegraph);
      socket.off('colossus-attack', handleColossusAttack);
      socket.off('colossus-attack-telegraph', handleColossusAttackTelegraph);
      socket.off('eternal-oak-earthbreaker-impact', handleEternalOakEarthbreakerImpact);
      socket.off('sentinel-orb-telegraph', handleSentinelOrbTelegraph);
      socket.off('sentinel-orb-impact', handleSentinelOrbImpact);
      socket.off('bone-spider-ensnaring-shot-telegraph', handleBoneSpiderEnsnaringShotTelegraph);
      socket.off('bone-spider-ensnaring-shot-outcome', handleBoneSpiderEnsnaringShotOutcome);
      socket.off('weaver-heal-telegraph', handleWeaverHealTelegraph);
      socket.off('weaver-summon-telegraph', handleWeaverSummonTelegraph);
      socket.off('weaver-lightning-telegraph', handleWeaverLightningTelegraph);
      socket.off('weaver-impale-spike-telegraph', handleWeaverImpaleSpikeTelegraph);
      socket.off('weaver-impale-spike-appear', handleWeaverImpaleSpikeAppear);
      socket.off('infested-zombie-summon', handleInfestedZombieSummon);
      socket.off('player-zombie-explosion', handlePlayerZombieExplosion);
      socket.off('enemy-summon-vfx', handleEnemySummonVfx);
    };
  }, [
    socket,
    setPlayers,
    updatePlayerPosition,
    createRoomBoomDashVfx,
    triggerAppliedLocalPlayerDamageFeedback,
    applyLocalPlayerStun,
    broadcastPlayerDebuff,
    onLocalPlayerRevived,
    coopServerEnemyLiving,
    onGoldUpdate,
    onFlowUpdate,
    onWoodUpdate,
    onStoneUpdate,
    onMeatUpdate,
    onHungerUpdate,
    onFateUpdate,
    spawnTitansGripStunLightning,
    stopJudgmentCorruptionSound,
    showLocalPlayerMissNumber,
  ]);

  useEffect(() => {
    const toRemove = new Set<string>();

    tentacleSpinePendingByEnemyRef.current.forEach((p, enemyId) => {
      const e = enemies.get(enemyId);
      if (!e || e.type !== 'tentacle-spine' || e.isDying) {
        toRemove.add(enemyId);
      }
    });

    enemies.forEach((e, enemyId) => {
      if (e.type === 'tentacle-spine' && e.isDying) {
        toRemove.add(enemyId);
      }
    });

    toRemove.forEach((enemyId) => {
      clearTentacleSpineGroundTelegraph(enemyId);
      tentacleSpineLayerRef.current?.removeFx(enemyId);
      tentacleSpineFxRef.current.delete(enemyId);
      tentacleSpineLastSlamAtRef.current.delete(enemyId);
    });
  }, [enemies, clearTentacleSpineGroundTelegraph]);

  // Add a cleanup effect to prevent stuck animations
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setMultiplayerPlayerStates(prev => {
        const updated = new Map(prev);
        const now = Date.now();
        let hasChanges = false;
        
        updated.forEach((state, playerId) => {
          // If an animation has been active for more than 3 seconds, force reset it
          if (state.lastAnimationUpdate && now - state.lastAnimationUpdate > 3000) {
            if (state.isSwinging || state.isCharging || state.isSpinning) {
              updated.set(playerId, {
                ...state,
                isSwinging: false,
                isCharging: false,
                isSpinning: false
              });
              hasChanges = true;
            }
          }
        });
        
        return hasChanges ? updated : prev;
      });
    }, 1000); // Check every second
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Sync server enemies with local ECS entities — create/destroy only (health/rotation via pre-world hook + enemiesRef).
  useEffect(() => {
    // Must run after the engine exists AND `initialize()` has finished (`engineReady`).
    // This effect is declared *before* the engine `useEffect` below; on first `gameStarted`
    // tick `engineRef` is still null, so without `engineReady` in deps we never create ECS
    // enemies (throne training dummy included) — arena knights "work" because `enemies` updates later.
    if (!engineRef.current || !gameStarted || !engineReady) return;

    const world = engineRef.current.getWorld();
    const liveEnemies = enemiesRef.current;

    liveEnemies.forEach((serverEnemy, enemyId) => {
      const dyingNonDummy =
        serverEnemy.isDying && serverEnemy.type !== 'training-dummy';

      if (dyingNonDummy || serverEnemyEntities.current.has(enemyId)) {
        return;
      }

      const isCoopAlliedEnemy =
        serverEnemy.alliedUnit === true ||
        serverEnemy.type === 'allied-knight' ||
        serverEnemy.type === 'allied-huntress' ||
        serverEnemy.type === 'allied-phantom' ||
        serverEnemy.type === 'allied-demon' ||
        serverEnemy.type === 'allied-enchantress' ||
        serverEnemy.type === 'allied-healer' ||
        serverEnemy.type === 'allied-tiger' ||
        serverEnemy.type === 'allied-wolf' ||
        serverEnemy.type === 'allied-bear' ||
        serverEnemy.type === 'allied-serpent' ||
        serverEnemy.type === 'allied-spider' ||
        serverEnemy.type === 'player-zombie' ||
        serverEnemy.type === 'vengeful-spirit';

      const entity = world.createEntity();

      const transform = world.createComponent(Transform);
      transform.setPosition(serverEnemy.position.x, serverEnemy.position.y, serverEnemy.position.z);
      entity.addComponent(transform);

      const health = new Health(serverEnemy.maxHealth);
      health.currentHealth = serverEnemy.health;
      if (serverEnemy.type === 'training-dummy') {
        health.isDead = false;
        health.isInvulnerable = false;
        health.invulnerabilityTimer = 0;
      }
      entity.addComponent(health);

      const enemyType = serverEnemy.type === 'boss' || serverEnemy.type === 'boss2' || serverEnemy.type === 'boss3' || serverEnemy.type === 'destiny' ? EnemyType.BOSS : EnemyType.ELITE;
      const enemy = new Enemy(enemyType, 1);
      entity.addComponent(enemy);

      const collider = world.createComponent(Collider);
      collider.type = ColliderType.SPHERE;
      collider.radius = serverEnemy.type === 'boss' ? 2.0
        : serverEnemy.type === 'boss2' || serverEnemy.type === 'boss3' ? 1.8
        : serverEnemy.type === 'destiny' ? 1.8
        : serverEnemy.type === 'boss-skeleton' ? 1.2
        : serverEnemy.type === 'allied-healer' || serverEnemy.type === 'greed' || serverEnemy.type === 'allied-enchantress' ? 0.75
        : serverEnemy.type === 'allied-tower' || isExploreTowerType(serverEnemy.type) ? EXPLORE_TOWER_HULL_RADIUS
        : serverEnemy.type === 'fire-pit' ? FIRE_PIT_HULL_RADIUS
        : serverEnemy.type === 'barracks' ? EXPLORE_BUILDING_DEFS.barracks.hullRadius
        : serverEnemy.type === 'research-station' ? RESEARCH_STATION_HULL_RADIUS
        : serverEnemy.type === 'shrine' ? SHRINE_HULL_RADIUS
        : serverEnemy.type === 'obelisk' ? OBELISK_HULL_RADIUS
        : serverEnemy.type === 'shield-battery' ? FIRE_PIT_HULL_RADIUS
        : serverEnemy.type === 'cathedral' ? CATHEDRAL_HULL_RADIUS
        : serverEnemy.type === 'allied-knight' ? 0.85
        : serverEnemy.type === 'allied-huntress' ? 0.75
        : serverEnemy.type === 'allied-phantom' ? 0.75
        : serverEnemy.type === 'allied-demon' ? 0.85
        : serverEnemy.type === 'allied-tiger' || serverEnemy.type === 'tiger' || serverEnemy.type === 'boss-tiger' ? 0.9 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'allied-wolf' ? 0.58 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'wolf' || serverEnemy.type === 'boss-wolf' ? 0.65 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'allied-bear' || serverEnemy.type === 'bear' || serverEnemy.type === 'boss-bear' ? 1.0 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'allied-serpent' ? 0.7 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'allied-spider' ? 0.55 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'knight' ? 0.85 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'templar' || serverEnemy.type === 'ghoul' || serverEnemy.type === 'skyray' ? 0.95
        : serverEnemy.type === 'terrorhawk' ? 0.76
        : serverEnemy.type === 'serpent' || serverEnemy.type === 'boss-serpent' ? 0.95 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'wyvern' ? 1.05
        : serverEnemy.type === 'bone-spider' ? 1.35
        : serverEnemy.type === 'titan' || serverEnemy.type === 'nemesis' || serverEnemy.type === 'stone-giant' || serverEnemy.type === 'eternal-oak' || serverEnemy.type === 'colossus' ? 1.2
        : serverEnemy.type === 'spectre' || serverEnemy.type === 'sentinel' || serverEnemy.type === 'death-knight' || serverEnemy.type === 'shaman' || serverEnemy.type === 'assassin' || serverEnemy.type === 'frost-queen' || serverEnemy.type === 'medusa' ? 0.9
        : serverEnemy.type === 'valkyrie' ? 0.98
        : serverEnemy.type === 'training-dummy' ? 1.85
        : serverEnemy.type === 'shade' ? 1.0
        : serverEnemy.type === 'martyr' ? 0.8
        : serverEnemy.type === 'tentacle-spine' ? 0.55
        : serverEnemy.type === 'vengeful-spirit' ? 0.7
        : 1.5;
      collider.layer = CollisionLayer.ENEMY;
      collider.isTrigger = true;
      collider.setMask(isCoopAlliedEnemy ? 0 : CollisionLayer.PROJECTILE);
      collider.setOffset(0, serverEnemy.type === 'tentacle-spine' ? 1.15 : 1, 0);
      entity.addComponent(collider);

      entity.userData = entity.userData || {};
      entity.userData.serverEnemyId = enemyId;
      entity.userData.coopServerEnemyType = serverEnemy.type;
      entity.userData.isCoopAlliedUnit = isCoopAlliedEnemy;
      entity.userData.rotation = serverEnemy.rotation || 0;
      entity.userData.coopEnemyDying = false;

      world.notifyEntityAdded(entity);
      serverEnemyEntities.current.set(enemyId, entity.id);
    });

    const currentEnemyIds = new Set(liveEnemies.keys());
    const enemiesToRemove: string[] = [];

    serverEnemyEntities.current.forEach((entityId, enemyId) => {
      if (!currentEnemyIds.has(enemyId)) {
        const entity = world.getEntity(entityId);
        if (entity) {
          world.destroyEntity(entity.id);
        }
        enemiesToRemove.push(enemyId);
        coopEnemyDeathFrozenRef.current.delete(enemyId);
      }
    });

    enemiesToRemove.forEach(enemyId => {
      serverEnemyEntities.current.delete(enemyId);
    });
  }, [enemyIdsKey, gameStarted, engineReady, enemiesRef]);

  // Co-op main map: destructible mushroom props (server HP; ECS for projectiles)
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady || gameMode !== 'coop') return;

    const world = engineRef.current.getWorld();
    const clearAllMushrooms = () => {
      mushroomEntityByIndexRef.current.forEach((eid) => {
        if (world.getEntity(eid)) world.destroyEntity(eid);
      });
      mushroomEntityByIndexRef.current.clear();
    };

    const spawnOrSyncMushroom = (inst: { index: number; x: number; z: number; h: number; cr: number }, hp: number) => {
      if (hp <= 0) return;
      const c = getMushroomColliderCenter(inst);
      if (mushroomEntityByIndexRef.current.has(inst.index)) {
        const eid = mushroomEntityByIndexRef.current.get(inst.index)!;
        const ent = world.getEntity(eid);
        if (ent) {
          const h = ent.getComponent(Health);
          if (h) {
            h.currentHealth = hp;
            h.maxHealth = MUSHROOM_MAX_HP;
            h.isDead = false;
          }
          const t = ent.getComponent(Transform);
          if (t) t.setPosition(c.x, c.y, c.z);
        }
        return;
      }

      const entity = world.createEntity();
      const transform = world.createComponent(Transform);
      transform.setPosition(c.x, c.y, c.z);
      entity.addComponent(transform);

      const health = new Health(MUSHROOM_MAX_HP);
      health.currentHealth = hp;
      health.invulnerabilityDuration = 0;
      health.invulnerabilityTimer = 0;
      health.isInvulnerable = false;
      entity.addComponent(health);

      const collider = world.createComponent(Collider);
      collider.type = ColliderType.SPHERE;
      collider.radius = 0.55;
      collider.layer = CollisionLayer.ENEMY;
      collider.isTrigger = true;
      collider.setMask(CollisionLayer.PROJECTILE);
      collider.setOffset(0, 0, 0);
      entity.addComponent(collider);

      const dm = new DestructibleMushroom(inst.index);
      entity.addComponent(dm);
      entity.userData = { ...entity.userData, mushroomIndex: inst.index };
      world.notifyEntityAdded(entity);
      mushroomEntityByIndexRef.current.set(inst.index, entity.id);
    };

    if (
      inThroneRoom
      || inBossThroneArena
      || isCastleRoom
      || isSunkenTemple
      || isErebusGate
      || isColoredCoopRoom
      || isDefense
      || isDungeon
      || isSkyTemple
    ) {
      clearAllMushrooms();
      return;
    }

    if (isExplore) {
      const live = new Set(exploreMushrooms.map((m) => m.index));
      for (const [idx, eid] of Array.from(mushroomEntityByIndexRef.current.entries())) {
        const hp = mushroomState?.exploreHealth?.[idx];
        if (!live.has(idx) || (hp !== undefined && hp <= 0)) {
          if (world.getEntity(eid)) world.destroyEntity(eid);
          mushroomEntityByIndexRef.current.delete(idx);
        }
      }
      for (const inst of exploreMushrooms) {
        const hp = mushroomState?.exploreHealth?.[inst.index];
        if (hp !== undefined && hp <= 0) continue;
        spawnOrSyncMushroom(inst, hp === undefined ? MUSHROOM_MAX_HP : hp);
      }
      return;
    }

    const instances = buildMushroomInstances();
    const healthArr = effectiveMushroomHealth;

    for (const [idx, eid] of Array.from(mushroomEntityByIndexRef.current.entries())) {
      const inst = instances[idx];
      const outsideHex =
        (isFaeRealm
        && inst
        && !isInsideHexArenaXZ(inst.x, inst.z, FAE_REALM_HEX_RADIUS, 0.5))
        || (isEternityPalace
        && inst
        && !isInsideHexArenaXZ(inst.x, inst.z, ETERNITY_PALACE_HEX_RADIUS, 0.5));
      if (healthArr[idx] <= 0 || outsideHex || !inst) {
        if (world.getEntity(eid)) world.destroyEntity(eid);
        mushroomEntityByIndexRef.current.delete(idx);
      }
    }

    for (let i = 0; i < MUSHROOM_COUNT; i++) {
      if (healthArr[i] <= 0) continue;
      const inst = instances[i]!;
      if (isFaeRealm && !isInsideHexArenaXZ(inst.x, inst.z, FAE_REALM_HEX_RADIUS, 0.5)) continue;
      if (isEternityPalace && !isInsideHexArenaXZ(inst.x, inst.z, ETERNITY_PALACE_HEX_RADIUS, 0.5)) continue;
      spawnOrSyncMushroom(inst, healthArr[i]);
    }
  }, [gameStarted, engineReady, gameMode, inThroneRoom, inBossThroneArena, isCastleRoom, isFaeRealm, isEternityPalace, isSunkenTemple, isErebusGate, isColoredCoopRoom, isDefense, isDungeon, isSkyTemple, isExplore, exploreMushrooms, mushroomState, effectiveMushroomHealth]);

  // Explore: destructible trees (server HP; ECS for projectiles)
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady || gameMode !== 'coop') return;

    const world = engineRef.current.getWorld();
    const clearAllTrees = () => {
      treeEntityByIndexRef.current.forEach((eid) => {
        if (world.getEntity(eid)) world.destroyEntity(eid);
      });
      treeEntityByIndexRef.current.clear();
    };

    if (!isExplore) {
      clearAllTrees();
      return;
    }

    const spawnOrSyncTree = (inst: ExploreTreeInstance, hp: number) => {
      if (hp <= 0) return;
      const y = EXPLORE_TREE_COMBAT_CENTER_Y;
      const maxHp = exploreTreeMaxHpFromScale(inst.scale);
      const combatRadius = exploreTreeCombatRadius(inst.scale);
      if (treeEntityByIndexRef.current.has(inst.index)) {
        const eid = treeEntityByIndexRef.current.get(inst.index)!;
        const ent = world.getEntity(eid);
        if (ent) {
          const h = ent.getComponent(Health);
          if (h) {
            h.currentHealth = hp;
            h.maxHealth = maxHp;
            h.isDead = false;
          }
          const t = ent.getComponent(Transform);
          if (t) t.setPosition(inst.x, y, inst.z);
          const c = ent.getComponent(Collider);
          if (c) {
            c.radius = combatRadius;
            c.boundsNeedUpdate = true;
          }
        }
        return;
      }

      const entity = world.createEntity();
      const transform = world.createComponent(Transform);
      transform.setPosition(inst.x, y, inst.z);
      entity.addComponent(transform);

      const health = new Health(maxHp);
      health.currentHealth = hp;
      health.invulnerabilityDuration = 0;
      health.invulnerabilityTimer = 0;
      health.isInvulnerable = false;
      entity.addComponent(health);

      const collider = world.createComponent(Collider);
      collider.type = ColliderType.SPHERE;
      collider.radius = combatRadius;
      collider.layer = CollisionLayer.ENEMY;
      collider.isTrigger = true;
      collider.setMask(CollisionLayer.PROJECTILE);
      collider.setOffset(0, 0, 0);
      entity.addComponent(collider);

      const dt = new DestructibleTree(inst.index);
      entity.addComponent(dt);
      entity.userData = { ...entity.userData, treeIndex: inst.index };
      world.notifyEntityAdded(entity);
      treeEntityByIndexRef.current.set(inst.index, entity.id);
    };

    const live = new Set(exploreTrees.map((t) => t.index));
    for (const [idx, eid] of Array.from(treeEntityByIndexRef.current.entries())) {
      const hp = treeState?.exploreHealth?.[idx];
      if (!live.has(idx) || (hp !== undefined && hp <= 0)) {
        if (world.getEntity(eid)) world.destroyEntity(eid);
        treeEntityByIndexRef.current.delete(idx);
      }
    }
    for (const inst of exploreTrees) {
      const hp = treeState?.exploreHealth?.[inst.index];
      if (hp !== undefined && hp <= 0) continue;
      spawnOrSyncTree(inst, hp === undefined ? exploreTreeMaxHpFromScale(inst.scale) : hp);
    }
  }, [gameStarted, engineReady, gameMode, isExplore, exploreTrees, treeState]);

  // Explore: destructible roots (server HP; ECS for projectiles + sabre melee)
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady || gameMode !== 'coop') return;

    const world = engineRef.current.getWorld();
    const clearAllRoots = () => {
      rootEntityByIndexRef.current.forEach((eid) => {
        if (world.getEntity(eid)) world.destroyEntity(eid);
      });
      rootEntityByIndexRef.current.clear();
    };

    if (!isExplore) {
      clearAllRoots();
      return;
    }

    const spawnOrSyncRoot = (inst: ExploreRootInstance, hp: number) => {
      if (hp <= 0) return;
      const y = EXPLORE_ROOT_COMBAT_CENTER_Y;
      const maxHp = exploreRootMaxHpFromScale(inst.scale);
      const combatRadius = exploreRootCombatRadius(inst.scale);
      if (rootEntityByIndexRef.current.has(inst.index)) {
        const eid = rootEntityByIndexRef.current.get(inst.index)!;
        const ent = world.getEntity(eid);
        if (ent) {
          const h = ent.getComponent(Health);
          if (h) {
            h.currentHealth = hp;
            h.maxHealth = maxHp;
            h.isDead = false;
          }
          const t = ent.getComponent(Transform);
          if (t) t.setPosition(inst.x, y, inst.z);
          const c = ent.getComponent(Collider);
          if (c) {
            c.radius = combatRadius;
            c.boundsNeedUpdate = true;
          }
        }
        return;
      }

      const entity = world.createEntity();
      const transform = world.createComponent(Transform);
      transform.setPosition(inst.x, y, inst.z);
      entity.addComponent(transform);

      const health = new Health(maxHp);
      health.currentHealth = hp;
      health.invulnerabilityDuration = 0;
      health.invulnerabilityTimer = 0;
      health.isInvulnerable = false;
      entity.addComponent(health);

      const collider = world.createComponent(Collider);
      collider.type = ColliderType.SPHERE;
      collider.radius = combatRadius;
      collider.layer = CollisionLayer.ENEMY;
      collider.isTrigger = true;
      collider.setMask(CollisionLayer.PROJECTILE);
      collider.setOffset(0, 0, 0);
      entity.addComponent(collider);

      const dr = new DestructibleRoot(inst.index);
      entity.addComponent(dr);
      entity.userData = { ...entity.userData, rootIndex: inst.index };
      world.notifyEntityAdded(entity);
      rootEntityByIndexRef.current.set(inst.index, entity.id);
    };

    const live = new Set(exploreRoots.map((r) => r.index));
    for (const [idx, eid] of Array.from(rootEntityByIndexRef.current.entries())) {
      const hp = rootState?.exploreHealth?.[idx];
      if (!live.has(idx) || (hp !== undefined && hp <= 0)) {
        if (world.getEntity(eid)) world.destroyEntity(eid);
        rootEntityByIndexRef.current.delete(idx);
      }
    }
    for (const inst of exploreRoots) {
      const hp = rootState?.exploreHealth?.[inst.index];
      if (hp !== undefined && hp <= 0) continue;
      spawnOrSyncRoot(inst, hp === undefined ? exploreRootMaxHpFromScale(inst.scale) : hp);
    }
  }, [gameStarted, engineReady, gameMode, isExplore, exploreRoots, rootState]);

  // Explore: destructible rocks (server HP; ECS only after Stone Breaker)
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady || gameMode !== 'coop') return;

    const world = engineRef.current.getWorld();
    const clearAllRocks = () => {
      rockEntityByIndexRef.current.forEach((eid) => {
        if (world.getEntity(eid)) world.destroyEntity(eid);
      });
      rockEntityByIndexRef.current.clear();
    };

    if (!isExplore || !exploreResearch.stoneBreaker) {
      clearAllRocks();
      return;
    }

    const spawnOrSyncRock = (inst: ExploreRockInstance, hp: number) => {
      if (hp <= 0) return;
      const y = EXPLORE_ROCK_COMBAT_CENTER_Y;
      const maxHp = exploreRockMaxHpFromScale(inst.scale);
      const combatRadius = exploreRockCombatRadius(inst.radius);
      if (rockEntityByIndexRef.current.has(inst.index)) {
        const eid = rockEntityByIndexRef.current.get(inst.index)!;
        const ent = world.getEntity(eid);
        if (ent) {
          const h = ent.getComponent(Health);
          if (h) {
            h.currentHealth = hp;
            h.maxHealth = maxHp;
            h.isDead = false;
          }
          const t = ent.getComponent(Transform);
          if (t) t.setPosition(inst.x, y, inst.z);
          const c = ent.getComponent(Collider);
          if (c) {
            c.radius = combatRadius;
            c.boundsNeedUpdate = true;
          }
        }
        return;
      }

      const entity = world.createEntity();
      const transform = world.createComponent(Transform);
      transform.setPosition(inst.x, y, inst.z);
      entity.addComponent(transform);

      const health = new Health(maxHp);
      health.currentHealth = hp;
      health.invulnerabilityDuration = 0;
      health.invulnerabilityTimer = 0;
      health.isInvulnerable = false;
      entity.addComponent(health);

      const collider = world.createComponent(Collider);
      collider.type = ColliderType.SPHERE;
      collider.radius = combatRadius;
      collider.layer = CollisionLayer.ENEMY;
      collider.isTrigger = true;
      collider.setMask(CollisionLayer.PROJECTILE);
      collider.setOffset(0, 0, 0);
      entity.addComponent(collider);

      const dr = new DestructibleRock(inst.index);
      entity.addComponent(dr);
      entity.userData = { ...entity.userData, rockIndex: inst.index };
      world.notifyEntityAdded(entity);
      rockEntityByIndexRef.current.set(inst.index, entity.id);
    };

    const live = new Set(exploreRocks.map((r) => r.index));
    for (const [idx, eid] of Array.from(rockEntityByIndexRef.current.entries())) {
      const hp = rockState?.exploreHealth?.[idx];
      if (!live.has(idx) || (hp !== undefined && hp <= 0)) {
        if (world.getEntity(eid)) world.destroyEntity(eid);
        rockEntityByIndexRef.current.delete(idx);
      }
    }
    for (const inst of exploreRocks) {
      const hp = rockState?.exploreHealth?.[inst.index];
      if (hp !== undefined && hp <= 0) continue;
      spawnOrSyncRock(inst, hp === undefined ? exploreRockMaxHpFromScale(inst.scale) : hp);
    }
  }, [gameStarted, engineReady, gameMode, isExplore, exploreRocks, rockState, exploreResearch.stoneBreaker]);

  // Explore: destructible spines (server HP; ECS only after Soul Stealer)
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady || gameMode !== 'coop') return;

    const world = engineRef.current.getWorld();
    const clearAllSpines = () => {
      spineEntityByIndexRef.current.forEach((eid) => {
        if (world.getEntity(eid)) world.destroyEntity(eid);
      });
      spineEntityByIndexRef.current.clear();
    };

    if (!isExplore || !exploreResearch.soulStealer) {
      clearAllSpines();
      return;
    }

    const spawnOrSyncSpine = (inst: ExploreSpineInstance, hp: number) => {
      if (hp <= 0) return;
      const y = EXPLORE_SPINE_COMBAT_CENTER_Y;
      const maxHp = exploreSpineMaxHpFromScale(inst.scale);
      const combatRadius = exploreSpineCombatRadius(inst.radius);
      if (spineEntityByIndexRef.current.has(inst.index)) {
        const eid = spineEntityByIndexRef.current.get(inst.index)!;
        const ent = world.getEntity(eid);
        if (ent) {
          const h = ent.getComponent(Health);
          if (h) {
            h.currentHealth = hp;
            h.maxHealth = maxHp;
            h.isDead = false;
          }
          const t = ent.getComponent(Transform);
          if (t) t.setPosition(inst.x, y, inst.z);
          const c = ent.getComponent(Collider);
          if (c) {
            c.radius = combatRadius;
            c.boundsNeedUpdate = true;
          }
        }
        return;
      }

      const entity = world.createEntity();
      const transform = world.createComponent(Transform);
      transform.setPosition(inst.x, y, inst.z);
      entity.addComponent(transform);

      const health = new Health(maxHp);
      health.currentHealth = hp;
      health.invulnerabilityDuration = 0;
      health.invulnerabilityTimer = 0;
      health.isInvulnerable = false;
      entity.addComponent(health);

      const collider = world.createComponent(Collider);
      collider.type = ColliderType.SPHERE;
      collider.radius = combatRadius;
      collider.layer = CollisionLayer.ENEMY;
      collider.isTrigger = true;
      collider.setMask(CollisionLayer.PROJECTILE);
      collider.setOffset(0, 0, 0);
      entity.addComponent(collider);

      const ds = new DestructibleSpine(inst.index);
      entity.addComponent(ds);
      entity.userData = { ...entity.userData, spineIndex: inst.index };
      world.notifyEntityAdded(entity);
      spineEntityByIndexRef.current.set(inst.index, entity.id);
    };

    const live = new Set(exploreSpines.map((s) => s.index));
    for (const [idx, eid] of Array.from(spineEntityByIndexRef.current.entries())) {
      const hp = spineState?.exploreHealth?.[idx];
      if (!live.has(idx) || (hp !== undefined && hp <= 0)) {
        if (world.getEntity(eid)) world.destroyEntity(eid);
        spineEntityByIndexRef.current.delete(idx);
      }
    }
    for (const inst of exploreSpines) {
      const hp = spineState?.exploreHealth?.[inst.index];
      if (hp !== undefined && hp <= 0) continue;
      spawnOrSyncSpine(inst, hp === undefined ? exploreSpineMaxHpFromScale(inst.scale) : hp);
    }
  }, [gameStarted, engineReady, gameMode, isExplore, exploreSpines, spineState, exploreResearch.soulStealer]);

  // Sync server players with local ECS entities — create/destroy only (positions via useFrame + playersTransformsRef).
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady) return;
    
    const world = engineRef.current.getWorld();
    
    let registeredNewRemotePeer = false;

    playersRef.current.forEach((serverPlayer, playerId) => {
      if (playerId === socket?.id) return;
      
      if (!serverPlayerEntities.current.has(playerId)) {
        const entity = world.createEntity();
        entity.userData = entity.userData || {};
        entity.userData.serverPlayerId = playerId;
        entity.userData.isCoopAllyPlayer = gameMode === 'coop';
        
        const transform = world.createComponent(Transform);
        transform.setPosition(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
        entity.addComponent(transform);

        const interpolationBuffer = world.createComponent(InterpolationBuffer);
        entity.addComponent(interpolationBuffer);
        
        const health = new Health(serverPlayer.maxHealth);
        health.currentHealth = serverPlayer.health;
        entity.addComponent(health);

        const shield = new Shield(25, 12.5, 3);
        entity.addComponent(shield);

        const energy = new Energy(100, 25, 40, 2);
        entity.addComponent(energy);

        const movement = world.createComponent(Movement);
        movement.maxSpeed = 3.575;
        movement.jumpForce = 4;
        movement.friction = 0.85;
        movement.canMove = false;
        entity.addComponent(movement);
        syncRemoteMovementForHumanoidAnimations(movement, serverPlayer);

        const collider = world.createComponent(Collider);
        collider.type = ColliderType.SPHERE;
        collider.radius = 0.9;
        collider.layer = CollisionLayer.ENEMY;
        collider.setMask(CollisionLayer.ENVIRONMENT);
        collider.setOffset(0, 0.25, 0);
        entity.addComponent(collider);
        
        world.notifyEntityAdded(entity);

        serverPlayerEntities.current.set(playerId, entity.id);
        registeredNewRemotePeer = true;
      } else {
        const entityId = serverPlayerEntities.current.get(playerId)!;
        const entity = world.getEntity(entityId);
        
        if (entity) {
          entity.userData = entity.userData || {};
          entity.userData.serverPlayerId = playerId;
          entity.userData.isCoopAllyPlayer = gameMode === 'coop';

          const health = entity.getComponent(Health);
          if (health) {
            health.maxHealth = serverPlayer.maxHealth;
            health.currentHealth = serverPlayer.health;
          }
        }
      }
    });
    
    const currentPlayerIds = new Set(playersRef.current.keys());
    const entitiesToRemove: string[] = [];
    
    serverPlayerEntities.current.forEach((entityId, playerId) => {
      if (!currentPlayerIds.has(playerId) || playerId === socket?.id) {
        if (world.getEntity(entityId)) {
          world.destroyEntity(entityId);
        }
        entitiesToRemove.push(playerId);
      }
    });
    
    entitiesToRemove.forEach(playerId => {
      serverPlayerEntities.current.delete(playerId);
      enemyPlayerPositionRefs.current.delete(playerId);
      enemyPlayerSmoothedPositionRefs.current.delete(playerId);
      enemyPlayerSmoothedRotationRefs.current.delete(playerId);
      remotePlayerPosScratchRef.current.delete(playerId);
    });

    if (registeredNewRemotePeer) {
      setRemotePlayerEntityRevision(v => v + 1);
    }
  }, [playerIdsKey, gameStarted, gameMode, socket?.id, engineReady]);

  const syncCoopEnemyEcsTransforms = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const world = engine.getWorld();

    serverEnemyEntities.current.forEach((entityId, enemyId) => {
      const serverEnemy = enemiesRef.current.get(enemyId);
      if (!serverEnemy) return;

      const entity = world.getEntity(entityId);
      if (!entity) return;

      const isCoopAlliedEnemy =
        serverEnemy.alliedUnit === true ||
        serverEnemy.type === 'allied-knight' ||
        serverEnemy.type === 'allied-huntress' ||
        serverEnemy.type === 'allied-phantom' ||
        serverEnemy.type === 'allied-demon' ||
        serverEnemy.type === 'allied-enchantress' ||
        serverEnemy.type === 'allied-healer' ||
        serverEnemy.type === 'allied-tiger' ||
        serverEnemy.type === 'allied-wolf' ||
        serverEnemy.type === 'allied-bear' ||
        serverEnemy.type === 'allied-serpent' ||
        serverEnemy.type === 'allied-spider' ||
        serverEnemy.type === 'player-zombie' ||
        serverEnemy.type === 'vengeful-spirit';
      const dyingNonDummy =
        serverEnemy.isDying && serverEnemy.type !== 'training-dummy';

      if (dyingNonDummy) {
        if (!coopEnemyDeathFrozenRef.current.has(enemyId)) {
          const healthComp = entity.getComponent(Health);
          if (healthComp) {
            healthComp.maxHealth = serverEnemy.maxHealth;
            healthComp.currentHealth = 0;
            healthComp.isDead = true;
          }
          const colliderComp = entity.getComponent(Collider);
          if (colliderComp) colliderComp.setMask(0);
          entity.userData = entity.userData || {};
          entity.userData.serverEnemyId = enemyId;
          entity.userData.coopServerEnemyType = serverEnemy.type;
          entity.userData.isCoopAlliedUnit = isCoopAlliedEnemy;
          entity.userData.rotation = serverEnemy.rotation || 0;
          entity.userData.coopEnemyDying = true;
          const t = entity.getComponent(Transform);
          if (t) {
            t.setPosition(serverEnemy.position.x, serverEnemy.position.y, serverEnemy.position.z);
          }
          coopEnemyDeathFrozenRef.current.add(enemyId);
        }
        return;
      }

      coopEnemyDeathFrozenRef.current.delete(enemyId);

      const live = enemyTransformsRef.current.get(enemyId);
      const ecsTransform = entity.getComponent(Transform);
      if (live && ecsTransform) {
        ecsTransform.setPosition(live.position.x, live.position.y, live.position.z);
      }

      const health = entity.getComponent(Health);
      if (health) {
        health.maxHealth = serverEnemy.maxHealth;
        health.currentHealth = serverEnemy.health;
        health.isDead = serverEnemy.health <= 0;
        if (serverEnemy.type === 'training-dummy') {
          health.isDead = false;
          health.isInvulnerable = false;
          health.invulnerabilityTimer = 0;
        }
      }

      // Sync server Concentrated Venom → ECS so VenomEffectManager can render the cloud.
      if (!isCoopAlliedEnemy) {
        const enemyComp = entity.getComponent(Enemy);
        if (enemyComp) {
          const prevStacks = enemyComp.concentratedVenomStacks;
          const stacks = serverEnemy.concentratedVenomStacks ?? 0;
          const expireAt = serverEnemy.concentratedVenomExpireAt;
          enemyComp.concentratedVenomStacks = stacks;
          enemyComp.concentratedVenomEndTime =
            stacks > 0 && typeof expireAt === 'number' && expireAt > 0 ? expireAt / 1000 : 0;
          if (prevStacks <= 0 && stacks > 0) {
            const pos = ecsTransform?.position ?? entity.getComponent(Transform)?.position;
            if (pos) {
              addGlobalVenomousEnemy(entity.id.toString(), pos);
            }
          }
        }
      }

      if (!entity.userData) {
        entity.userData = {};
      }
      entity.userData.rotation = live?.rotation ?? serverEnemy.rotation ?? 0;
      entity.userData.coopServerEnemyType = serverEnemy.type;
      entity.userData.isCoopAlliedUnit = isCoopAlliedEnemy;
      entity.userData.coopEnemyDying = false;

      const colliderComp = entity.getComponent(Collider);
      if (colliderComp) {
        colliderComp.setMask(isCoopAlliedEnemy ? 0 : CollisionLayer.PROJECTILE);
      }
    });
  }, [enemiesRef, enemyTransformsRef]);

  const syncLocalPlayerNetworkPosition = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.isEngineRunning() || !gameStarted) return;

    const socketId = socket?.id;
    if (playerEntityRef.current === null || !socketId) return;

    const localDeathState = playerDeathStatesRef.current.get(socketId);
    if (localDeathState?.isDead) return;

    const entity = engine.getWorld().getEntity(playerEntityRef.current);
    if (entity && voidPortalFallActiveRef.current) {
      const transform = entity.getComponent(Transform);
      const movement = entity.getComponent(Movement);
      if (transform && (movement?.isGrounded || transform.position.y <= PORTAL_FALL_GROUND_Y)) {
        voidPortalFallActiveRef.current = false;
      }
    }

    if (coopTransitionOverlayRef.current || pendingPortalSnapRef.current) return;

    if (!entity) return;

    const transform = entity.getComponent(Transform);
    if (!transform) return;

    const cameraSystem = (window as Window & {
      cameraSystem?: { getOrbitHorizontalFacingAngle?: () => number };
    }).cameraSystem;
    const cameraAngle =
      typeof cameraSystem?.getOrbitHorizontalFacingAngle === 'function'
        ? cameraSystem.getOrbitHorizontalFacingAngle()
        : 0;

    const rotation = { x: 0, y: cameraAngle, z: 0 };
    const movement = entity.getComponent(Movement);
    updatePlayerPosition(
      transform.position,
      rotation,
      movement
        ? buildPlayerMovementDirectionPayload(movement, {
            isStunned: controlSystemRef.current?.isLocalPlayerStunned() ?? false,
          })
        : undefined,
    );
  }, [
    gameStarted,
    socket?.id,
    updatePlayerPosition,
    coopTransitionOverlayRef,
    pendingPortalSnapRef,
  ]);

  const restorePortalFallInput = useCallback(() => {
    const inputBlocked =
      isChatOpenRef.current ||
      uiBlocksGameInputRef.current ||
      coopTransitionOverlayRef.current;
    controlSystemRef.current?.setInputDisabled(inputBlocked);
    engineRef.current?.getInputManager().setGameInputBlocked(inputBlocked);
  }, [coopTransitionOverlayRef]);

  const exitPortalFall = useCallback((opts?: { snapToGround?: boolean }) => {
    voidPortalFallActiveRef.current = false;
    pendingPortalSnapRef.current = false;
    const engine = engineRef.current;
    if (playerEntityRef.current === null || !engine) {
      restorePortalFallInput();
      return;
    }
    const entity = engine.getWorld().getEntity(playerEntityRef.current);
    const movement = entity?.getComponent(Movement);
    const transform = entity?.getComponent(Transform);
    if (movement) {
      movement.isPortalFalling = false;
      movement.portalFallPhase = 'rise';
      movement.portalFallProgress = 0;
      movement.isGrounded = true;
    }
    if (opts?.snapToGround !== false && transform && transform.position.y > PORTAL_FALL_GROUND_Y) {
      transform.setPosition(transform.position.x, PORTAL_FALL_GROUND_Y, transform.position.z);
      realTimePlayerPositionRef.current.set(
        transform.position.x,
        PORTAL_FALL_GROUND_Y,
        transform.position.z,
      );
    }
    restorePortalFallInput();
  }, [pendingPortalSnapRef, restorePortalFallInput]);

  const syncPortalFallAnimationProgress = useCallback(() => {
    const engine = engineRef.current;
    if (!engine?.isEngineRunning() || !gameStarted) return;
    if (playerEntityRef.current === null) return;

    const entity = engine.getWorld().getEntity(playerEntityRef.current);
    if (!entity) return;

    const movement = entity.getComponent(Movement);
    const transform = entity.getComponent(Transform);
    if (!movement || !transform) return;

    if (!movement.isPortalFalling) return;

    controlSystemRef.current?.setInputDisabled(true);
    engine.getInputManager().setGameInputBlocked(true);

    if (movement.portalFallPhase === 'rise') {
      const elapsedMs = Date.now() - portalFallRiseStartMsRef.current;
      movement.portalFallProgress = Math.min(1, elapsedMs / PORTAL_FALL_RISE_DURATION_MS);

      if (voidPortalFallActiveRef.current) {
        movement.portalFallPhase = 'fall';
        portalFallStartYRef.current = transform.position.y;
        portalFallFallStartMsRef.current = Date.now();
        movement.portalFallProgress = 0;
        return;
      }

      if (elapsedMs >= PORTAL_FALL_RISE_TIMEOUT_MS) {
        exitPortalFall({ snapToGround: true });
      }
      return;
    }

    const startY = portalFallStartYRef.current;
    const fallDistance = startY - PORTAL_FALL_GROUND_Y;
    if (fallDistance > 0.01) {
      movement.portalFallProgress = Math.max(
        0,
        Math.min(1, (startY - transform.position.y) / fallDistance),
      );
    } else {
      movement.portalFallProgress = 1;
    }

    if (!voidPortalFallActiveRef.current) {
      exitPortalFall({ snapToGround: false });
      return;
    }

    const fallElapsedMs = Date.now() - portalFallFallStartMsRef.current;
    if (fallElapsedMs >= PORTAL_FALL_LANDING_TIMEOUT_MS) {
      exitPortalFall({ snapToGround: true });
    }
  }, [gameStarted, exitPortalFall]);

  useEffect(() => {
    syncCoopEnemyEcsTransformsRef.current = syncCoopEnemyEcsTransforms;
  }, [syncCoopEnemyEcsTransforms]);

  useEffect(() => {
    syncLocalPlayerNetworkPositionRef.current = syncLocalPlayerNetworkPosition;
  }, [syncLocalPlayerNetworkPosition]);

  useEffect(() => {
    syncPortalFallAnimationProgressRef.current = syncPortalFallAnimationProgress;
  }, [syncPortalFallAnimationProgress]);

  /** Force-clear portal overlay if it stays active too long (blocks position sync + enemy AI). */
  useEffect(() => {
    const PORTAL_OVERLAY_MAX_MS = 25_000;
    const interval = window.setInterval(() => {
      const overlayActive = coopTransitionOverlayRef.current;
      const startedAt = portalOverlayStartedAtRef.current || portalFallRiseStartMsRef.current;
      if (!overlayActive) {
        const engine = engineRef.current;
        const entity = playerEntityRef.current !== null && engine
          ? engine.getWorld().getEntity(playerEntityRef.current)
          : null;
        const stuckJump = entity?.getComponent(Movement)?.isPortalFalling;
        if (stuckJump && startedAt && Date.now() - startedAt >= PORTAL_OVERLAY_MAX_MS) {
          exitPortalFall({ snapToGround: true });
        }
        return;
      }
      if (!startedAt || Date.now() - startedAt < PORTAL_OVERLAY_MAX_MS) return;
      // eslint-disable-next-line no-console
      console.warn('[Coop] Portal transition overlay stuck — forcing clear');
      exitPortalFall({ snapToGround: true });
      endCoopPortalTransition();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [coopTransitionOverlayRef, coopCombatArenaEnterAtRef, endCoopPortalTransition, exitPortalFall]);

  useEffect(() => {
    const getLocalFacingRotation = () => {
      const cameraSystem = (window as Window & {
        cameraSystem?: { getOrbitHorizontalFacingAngle?: () => number };
      }).cameraSystem;
      const cameraAngle =
        typeof cameraSystem?.getOrbitHorizontalFacingAngle === 'function'
          ? cameraSystem.getOrbitHorizontalFacingAngle()
          : 0;
      return { x: 0, y: cameraAngle, z: 0 };
    };

    const haltAndBroadcastIdle = () => {
      const engine = engineRef.current;
      if (playerEntityRef.current === null || !engine) return;
      const entity = engine.getWorld().getEntity(playerEntityRef.current);
      const movement = entity?.getComponent(Movement);
      movement?.haltLocomotion();

      if (coopTransitionOverlayRef.current || pendingPortalSnapRef.current) return;
      const socketId = socket?.id;
      if (!socketId) return;
      const localDeathState = playerDeathStatesRef.current.get(socketId);
      if (localDeathState?.isDead) return;
      const transform = entity?.getComponent(Transform);
      if (!transform) return;
      updatePlayerPosition(
        transform.position,
        getLocalFacingRotation(),
        ZERO_PLAYER_MOVEMENT_DIRECTION,
        { force: true },
      );
    };

    const completePortalFallIfInFlight = () => {
      const engine = engineRef.current;
      const entity = playerEntityRef.current !== null && engine
        ? engine.getWorld().getEntity(playerEntityRef.current)
        : null;
      const falling = voidPortalFallActiveRef.current || Boolean(entity?.getComponent(Movement)?.isPortalFalling);
      if (falling) {
        exitPortalFall({ snapToGround: true });
      }
    };

    const onVisibilityChange = () => {
      if (!document.hidden) return;
      completePortalFallIfInFlight();
      haltAndBroadcastIdle();
    };
    const onWindowBlur = () => {
      if (document.hidden) {
        completePortalFallIfInFlight();
      }
      haltAndBroadcastIdle();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [socket?.id, updatePlayerPosition, exitPortalFall, coopTransitionOverlayRef, pendingPortalSnapRef]);

  // Initialize the PVP game engine

  useEffect(() => {
    if (isInitialized.current || !gameStarted) return;
    isInitialized.current = true;


    // Initialize damage system with level-scaled runes for Bow, Sword, and Sabres
    const primaryWeapon = selectedWeapons?.primary ?? WeaponType.NONE;
    const runeCount = getRuneCountForWeapon(primaryWeapon, playerLevel);
    setGlobalCriticalRuneCount(runeCount);
    setGlobalCritDamageRuneCount(runeCount);
    
    // Create engine
    const engine = new Engine({ enableDebug: true });
    engineRef.current = engine;
    const preWorldUpdateHook = () => {
      syncCoopEnemyEcsTransformsRef.current();
      syncLocalPlayerNetworkPositionRef.current();
      syncPortalFallAnimationProgressRef.current();
    };
    engine.addPreWorldUpdateHook(preWorldUpdateHook);

    // Initialize with canvas
    const canvas = gl.domElement;
    let teardownAfterAsync = false;

    Promise.all([
      engine.initialize(canvas),
      warmupCharacterLocomotionGltf(),
      warmupLazyRendererChunks(),
      preloadAllEnemyModels(),
    ])
      .then(async () => {
        if (teardownAfterAsync) return;
        try {
          console.log('🚀 CoopGameScene: Engine initialized, starting game loop...');
          engine.start();
          console.log('✅ CoopGameScene: Engine started and ready');
          setEngineReady(true);
          try {
            const audioSystem = (window as Window & { audioSystem?: AudioSystem }).audioSystem;
            await audioSystem?.preloadWeaponSounds();
          } catch (error: unknown) {
            console.warn('Failed to preload gameplay sounds:', error);
          }
          if (teardownAfterAsync) return;
          // Pre-compile every shader program for the now-populated scene while the
          // loading screen is still up, using async/parallel compilation. Without
          // this, three.js compiles each material lazily on the first frame it's
          // rendered — a single ~1.6s synchronous stall on the first gameplay frame
          // (getUniforms/getProgramParameter force the GPU to finish linking).
          try {
            await gl.compileAsync(scene, camera);
          } catch (compileErr) {
            console.warn('Shader pre-compile failed (non-fatal):', compileErr);
          }
          if (teardownAfterAsync) return;
          onSceneReady?.();
        } catch (startErr) {
          console.error('CoopGameScene: engine.start failed:', startErr);
          onSceneReady?.();
        }
      })
      .catch((initErr: unknown) => {
        console.error('CoopGameScene: engine.initialize or character GLB warmup failed:', initErr);
        if (!teardownAfterAsync) onSceneReady?.();
      });

    return () => {
      teardownAfterAsync = true;
      isInitialized.current = false;
      setEngineReady(false);
      controlSystemRef.current?.dispose();
      cameraSystemRef.current?.dispose();
      if (engineRef.current) {
        engineRef.current.removePreWorldUpdateHook(preWorldUpdateHook);
        engineRef.current.destroy();
        engineRef.current = null;
      }
    };
  }, [gameStarted]); // Only initialize when game starts, not when players change

  // Re-warm shaders on major scene transitions (throne room ↔ combat arena). The new
  // room's geometry/materials would otherwise compile lazily on the first frame after
  // the transition, causing the same stall the initial load warmup prevents. Debounced
  // so the new content has mounted; compileAsync is non-blocking (parallel compile).
  useEffect(() => {
    if (!engineReady) return;
    let cancelled = false;
    const id = window.setTimeout(() => {
      if (cancelled) return;
      gl.compileAsync(scene, camera).catch((e) => {
        console.warn('Shader re-warm failed (non-fatal):', e);
      });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [combatArenaActive, engineReady, gl, scene, camera]);

  // ==================== EMERGENCY MEMORY CLEANUP ====================
  // Helper function to dispose pooled effects and geometries
  const disposeEffectPools = useCallback(() => {
    // Clear the PVP object pool
    pvpObjectPool.clearAll();
    
    // Clear any cached geometries (force garbage collection)
    if (typeof window !== 'undefined' && 'gc' in window) {
      try {
        (window as typeof window & { gc?: () => void }).gc?.();
      } catch {
        // GC not available in most browsers
      }
    }
  }, []);

  // Emergency cleanup: batch React updates so the game loop does not schedule ~20 separate re-renders.
  const performEmergencyCleanup = useCallback(() => {
    if (process.env.NODE_ENV === 'development') {
      console.warn('EMERGENCY: Triggering memory cleanup (VFX state cleared)…');
    }
    unstable_batchedUpdates(() => {
      enemyTauntEffectsRef.current = [];
      setTauntFxRevision((r) => r + 1);
    });

    pvpAbilityLayerRef.current?.clearAll();
    clearAllTentacleSpinePendingTimers();
    groundTelegraphLayerRef.current?.clearAll();
    bossMechanicLayerRef.current?.clearAll();
    explosionBurstLayerRef.current?.clearAll();
    lightningBurstLayerRef.current?.clearAll();
    groundHazardLayerRef.current?.clearAll();
    summonRitualLayerRef.current?.clearAll();
    allyCombatLayerRef.current?.clearAll();
    combatFeedbackLayerRef.current?.clearAll();
    environmentVfxLayerRef.current?.clearAll();
    tentacleSpineLayerRef.current?.clearAll();
    tentacleSpineFxRef.current.clear();

    pvpVenomEffectsRef.current = [];
    pvpDebuffEffectsRef.current = [];
    pvpFrostNovaEffectsRef.current = [];
    pvpCrossentropyExplosionsRef.current = [];
    pvpSummonTotemExplosionsRef.current = [];
    pvpColossusStrikeEffectsRef.current = [];
    pvpWindShearEffectsRef.current = [];
    pvpReanimateEffectsRef.current = [];
    pvpSummonTotemEffectsRef.current = [];

    previousEnemyStates.current.clear();
    activeDebuffIndicators.current.clear();

    const playerIds = Array.from(players.keys());
    enemyPlayerPositionRefs.current.forEach((_, key) => {
      if (!playerIds.includes(key)) {
        enemyPlayerPositionRefs.current.delete(key);
        enemyPlayerSmoothedPositionRefs.current.delete(key);
        enemyPlayerSmoothedRotationRefs.current.delete(key);
        remotePlayerPosScratchRef.current.delete(key);
      }
    });

    playerStealthStates.current.forEach((_, key) => {
      if (!playerIds.includes(key)) {
        playerStealthStates.current.delete(key);
      }
    });

    serverPlayerEntities.current.forEach((_, key) => {
      if (!playerIds.includes(key)) {
        serverPlayerEntities.current.delete(key);
      }
    });

    lastMeleeSoundTime.current.forEach((_, key) => {
      if (!playerIds.includes(key)) {
        lastMeleeSoundTime.current.delete(key);
      }
    });

    projectileLayerRef.current?.clearAll();
    bossTelegraphLayerRef.current?.clearAll();
    disposeEffectPools();
    clearAllPvpVenomTimers();

    if (process.env.NODE_ENV === 'development') {
      console.warn('EMERGENCY: Memory cleanup completed');
    }
  }, [players, disposeEffectPools, clearAllPvpVenomTimers, clearAllTentacleSpinePendingTimers]);

  // Dev: call `__ERE_DEBUG_HEAP()` in the console to snapshot JS heap (Chrome `performance.memory`).
  // Also logs automatically when leaving prep throne (see `prevInThroneRef` effect + `logJsHeapSnapshotDev`).
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const w = window as typeof window & {
      __ERE_DEBUG_HEAP?: () => {
        usedMB: string;
        totalMB: string;
        limitMB: string;
        usedRatio: string;
      } | null;
    };
    w.__ERE_DEBUG_HEAP = () => {
      const m = (performance as { memory?: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number } })
        .memory;
      if (!m) return null;
      return {
        usedMB: (m.usedJSHeapSize / 1024 / 1024).toFixed(1),
        totalMB: (m.totalJSHeapSize / 1024 / 1024).toFixed(1),
        limitMB: (m.jsHeapSizeLimit / 1024 / 1024).toFixed(1),
        usedRatio: (m.usedJSHeapSize / Math.max(1, m.jsHeapSizeLimit)).toFixed(3),
      };
    };
    return () => {
      delete w.__ERE_DEBUG_HEAP;
    };
  }, []);

  // Game loop integration with React Three Fiber
  useFrame((state, deltaTime) => {
    // Cancel dash/charge/knockback as soon as the portal overlay ref is set (sync, before React state).
    if (
      coopTransitionOverlayRef.current &&
      !portalOverlayLocomotionHaltedRef.current &&
      playerEntityRef.current !== null &&
      engineRef.current
    ) {
      const haltEnt = engineRef.current.getWorld().getEntity(playerEntityRef.current);
      const haltMovement = haltEnt?.getComponent(Movement);
      haltMovement?.haltLocomotion();
      if (haltMovement) {
        haltMovement.isPortalFalling = true;
        haltMovement.portalFallPhase = 'rise';
        haltMovement.portalFallProgress = 0;
        portalFallRiseStartMsRef.current = Date.now();
        portalOverlayStartedAtRef.current = portalFallRiseStartMsRef.current;
      }
      controlSystemRef.current?.setInputDisabled(true);
      engineRef.current.getInputManager().setGameInputBlocked(true);
      portalOverlayLocomotionHaltedRef.current = true;
    }

    // Remote player interpolation + ghost-trail refs (60 Hz via playersTransformsRef, no React state).
    if (engineRef.current && gameStarted && engineReady) {
      const world = engineRef.current.getWorld();
      const localSocketId = socket?.id;

      playersTransformsRef.current.forEach((live, playerId) => {
        if (playerId === localSocketId) return;

        let positionRef = enemyPlayerPositionRefs.current.get(playerId);
        if (!positionRef) {
          positionRef = { current: new Vector3(live.position.x, live.position.y, live.position.z) };
          enemyPlayerPositionRefs.current.set(playerId, positionRef);
        } else {
          positionRef.current.set(live.position.x, live.position.y, live.position.z);
        }

        let smoothedPos = enemyPlayerSmoothedPositionRefs.current.get(playerId);
        if (!smoothedPos) {
          smoothedPos = { current: new Vector3(live.position.x, live.position.y, live.position.z) };
          enemyPlayerSmoothedPositionRefs.current.set(playerId, smoothedPos);
        }
        let smoothedRot = enemyPlayerSmoothedRotationRefs.current.get(playerId);
        if (!smoothedRot) {
          smoothedRot = { current: { x: live.rotation.x, y: live.rotation.y, z: live.rotation.z } };
          enemyPlayerSmoothedRotationRefs.current.set(playerId, smoothedRot);
        }

        const snapDx = live.position.x - smoothedPos.current.x;
        const snapDy = live.position.y - smoothedPos.current.y;
        const snapDz = live.position.z - smoothedPos.current.z;
        const shouldSnapVisual =
          snapDx * snapDx + snapDy * snapDy + snapDz * snapDz > REMOTE_PEER_VISUAL_TELEPORT_SNAP_SQ;
        if (shouldSnapVisual) {
          smoothedPos.current.set(live.position.x, live.position.y, live.position.z);
          smoothedRot.current.x = live.rotation.x;
          smoothedRot.current.y = live.rotation.y;
          smoothedRot.current.z = live.rotation.z;
        } else {
          const alpha = 1 - Math.exp(-REMOTE_PEER_VISUAL_SMOOTH_RATE * deltaTime);
          smoothedPos.current.lerp(positionRef.current, alpha);
          smoothedRot.current.x = live.rotation.x;
          smoothedRot.current.y = lerpShortestAngle(smoothedRot.current.y, live.rotation.y, alpha);
          smoothedRot.current.z = live.rotation.z;
        }

        const entityId = serverPlayerEntities.current.get(playerId);
        if (!entityId) return;
        const entity = world.getEntity(entityId);
        if (!entity) return;

        const serverPlayer = playersRef.current.get(playerId);
        const deathState = playerDeathStatesRef.current.get(playerId);
        const health = entity.getComponent(Health);
        const isDeadRemote = Boolean(deathState?.isDead) || Boolean(health?.isDead);

        if (serverPlayer && health) {
          health.maxHealth = serverPlayer.maxHealth;
          health.currentHealth = serverPlayer.health;
        }

        const transform = entity.getComponent(Transform);
        const interpolationBuffer = entity.getComponent(InterpolationBuffer);
        if (!transform) return;

        if (isDeadRemote) {
          const frozen = deathState?.deathPosition ?? live.position;
          transform.setPosition(frozen.x, frozen.y, frozen.z);
          const movement = entity.getComponent(Movement);
          if (movement) {
            movement.haltLocomotion();
            syncRemoteMovementForHumanoidAnimations(movement, {
              position: { x: frozen.x, y: frozen.y, z: frozen.z },
            });
          }
          return;
        }

        _remoteInterpEulerScratch.set(live.rotation.x, live.rotation.y, live.rotation.z);
        _remoteInterpRotScratch.setFromEuler(_remoteInterpEulerScratch);
        _remoteInterpPosScratch.set(live.position.x, live.position.y, live.position.z);

        if (interpolationBuffer) {
          interpolationBuffer.addServerState(_remoteInterpPosScratch, _remoteInterpRotScratch);
        } else {
          transform.setPosition(live.position.x, live.position.y, live.position.z);
        }

        const movement = entity.getComponent(Movement);
        if (movement && serverPlayer) {
          const lastUpdatedAt = live.lastUpdatedAt;
          const stale = lastUpdatedAt != null
            && (performance.now() - lastUpdatedAt) > REMOTE_PLAYER_MOVE_STALE_MS;
          syncRemoteMovementForHumanoidAnimations(
            movement,
            {
              ...serverPlayer,
              position: live.position,
              movementDirection: live.movementDirection ?? serverPlayer.movementDirection,
            },
            { stale },
          );
        }
      });
    }

    if (engineRef.current && engineRef.current.isEngineRunning() && gameStarted) {
      // Explore build mode (B menu, F place fire pit, Escape cancel)
      if (
        isExplore
        && gameMode === 'coop'
        && controlSystemRef.current
        && !isChatOpenRef.current
        && !throneAbilityModalOpenRef.current
        && !uiBlocksGameInputRef.current
      ) {
        const cs = controlSystemRef.current;
        const bDown = cs.isKeyPressed('b');
        const bEdge = bDown && !buildKeyPrevRef.current;
        const escDown = cs.isKeyPressed('escape');
        const escEdge = escDown && !buildEscKeyPrevRef.current;
        const localWood = playersRef.current.get(socket?.id || '')?.wood ?? 0;
        const localFlow = playersRef.current.get(socket?.id || '')?.flow ?? 0;
        const localStone = playersRef.current.get(socket?.id || '')?.stone ?? 0;

        const closeBuildMenu = () => {
          buildModeRef.current = 'idle';
          cs.setBuildPlacementActive(false);
          cs.setBuildMenuHotkeysActive(false);
          setBuildPlacementActive(false);
          onBuildMenuChangeRef.current?.(false);
        };

        const enterPlacing = (kind: ExploreBuildingKind) => {
          buildModeRef.current = 'placing';
          setBuildPlacementKind(kind);
          cs.setBuildPlacementActive(true);
          cs.setBuildMenuHotkeysActive(false);
          setBuildPlacementActive(true);
          onBuildMenuChangeRef.current?.(false);
        };

        if (bEdge) {
          if (buildModeRef.current === 'placing' || buildModeRef.current === 'menu' || buildModeRef.current === 'tower-pick') {
            closeBuildMenu();
          } else {
            buildModeRef.current = 'menu';
            cs.setBuildMenuHotkeysActive(true);
            onBuildMenuChangeRef.current?.(true, 'root');
          }
        }

        if (escEdge && buildModeRef.current !== 'idle') {
          if (buildModeRef.current === 'tower-pick') {
            buildModeRef.current = 'menu';
            onBuildMenuChangeRef.current?.(true, 'root');
          } else {
            closeBuildMenu();
          }
        }

        if (buildModeRef.current === 'menu') {
          const towerKey = EXPLORE_TOWER_CATEGORY_HOTKEY.toLowerCase();
          const towerDown = cs.isKeyPressed(towerKey);
          const towerPrev = buildHotkeyPrevRef.current[towerKey] ?? false;
          const towerEdge = towerDown && !towerPrev;
          buildHotkeyPrevRef.current[towerKey] = towerDown;
          if (towerEdge) {
            buildModeRef.current = 'tower-pick';
            cs.setBuildMenuHotkeysActive(true);
            onBuildMenuChangeRef.current?.(true, 'towers');
          }
          for (const kind of EXPLORE_BUILDING_ROOT_ORDER) {
            const def = EXPLORE_BUILDING_DEFS[kind];
            const key = def.hotkey.toLowerCase();
            const keyDown = cs.isKeyPressed(key);
            const prev = buildHotkeyPrevRef.current[key] ?? false;
            const keyEdge = keyDown && !prev;
            buildHotkeyPrevRef.current[key] = keyDown;
            if (keyEdge && def.enabled && localWood >= def.woodCost && localFlow >= (def.flowCost ?? 0) && localStone >= (def.stoneCost ?? 0)) {
              if (exploreBuildingRequiresSpiritLounge(kind) && !buildPlacementRulesRef.current.hasLiveSpiritLounge) {
                continue;
              }
              if (exploreBuildingRequiresShrineOrObelisk(kind) && !buildPlacementRulesRef.current.hasLiveShrineOrObelisk) {
                continue;
              }
              enterPlacing(kind);
              break;
            }
          }
        } else if (buildModeRef.current === 'tower-pick') {
          for (const kind of EXPLORE_TOWER_PICK_ORDER) {
            const def = EXPLORE_BUILDING_DEFS[kind];
            const key = def.hotkey.toLowerCase();
            const keyDown = cs.isKeyPressed(key);
            const prev = buildHotkeyPrevRef.current[key] ?? false;
            const keyEdge = keyDown && !prev;
            buildHotkeyPrevRef.current[key] = keyDown;
            if (keyEdge && def.enabled && localWood >= def.woodCost && localFlow >= (def.flowCost ?? 0) && localStone >= (def.stoneCost ?? 0)) {
              enterPlacing(kind);
              break;
            }
          }
        } else {
          buildHotkeyPrevRef.current = {};
        }

        if (buildModeRef.current === 'placing') {
          const leftDown = cs.isMouseButtonPressed(0);
          const leftEdge = leftDown && !buildLeftMousePrevRef.current;
          if (leftEdge) {
            const pos = buildPlacementPosRef.current;
            if (pos.valid) {
              placeBuildingRef.current(buildPlacementKindRef.current, pos.x, pos.z);
              closeBuildMenu();
            }
          }
          buildLeftMousePrevRef.current = leftDown;
        } else {
          buildLeftMousePrevRef.current = cs.isMouseButtonPressed(0);
        }

        if (nearBarracksRef.current && buildModeRef.current === 'idle') {
          for (let i = 0; i < ALLY_CHOICE_CARDS.length; i += 1) {
            const digit = String(i + 1);
            const digitDown = cs.isKeyPressed(digit);
            const prev = buildHotkeyPrevRef.current[`ally-${digit}`] ?? false;
            const digitEdge = digitDown && !prev;
            buildHotkeyPrevRef.current[`ally-${digit}`] = digitDown;
            if (digitEdge) {
              barracksRecruitAllyRef.current(ALLY_CHOICE_CARDS[i]!.kind);
              break;
            }
          }
        } else if (nearShrineRef.current && buildModeRef.current === 'idle') {
          for (const gift of EXPLORE_SHRINE_GIFTS) {
            const digit = gift.hotkey;
            const digitDown = cs.isKeyPressed(digit);
            const prev = buildHotkeyPrevRef.current[`shrine-${digit}`] ?? false;
            const digitEdge = digitDown && !prev;
            buildHotkeyPrevRef.current[`shrine-${digit}`] = digitDown;
            if (digitEdge) {
              shrineClaimRef.current(gift.id);
              break;
            }
          }
        } else if (nearCathedralRef.current && buildModeRef.current === 'idle') {
          const offer = nearCathedralOfferRef.current;
          for (let i = 0; i < offer.length && i < 4; i += 1) {
            const digit = String(i + 1);
            const digitDown = cs.isKeyPressed(digit);
            const prev = buildHotkeyPrevRef.current[`cathedral-${digit}`] ?? false;
            const digitEdge = digitDown && !prev;
            buildHotkeyPrevRef.current[`cathedral-${digit}`] = digitDown;
            if (digitEdge) {
              cathedralClaimRef.current(offer[i]!.type);
              break;
            }
          }
        } else if (nearObeliskRef.current && buildModeRef.current === 'idle') {
          const weapon = selectedWeaponsRef.current?.primary;
          const catalog = weapon === WeaponType.RUNEBLADE
            || weapon === WeaponType.SABRES
            || weapon === WeaponType.BOW
            || weapon === WeaponType.SCYTHE
            ? RULEBOOK_CLASS_TALENTS[weapon as CoopRulebookWeapon]
            : [];
          const owned = new Set(getEnabledTalentIds(talentLoadoutRef.current));
          const localGold = playersRef.current.get(socket?.id || '')?.gold ?? 0;
          const maxHotkeys = Math.min(9, catalog.length);
          for (let i = 0; i < maxHotkeys; i += 1) {
            const digit = String(i + 1);
            const digitDown = cs.isKeyPressed(digit);
            const prev = buildHotkeyPrevRef.current[`obelisk-${digit}`] ?? false;
            const digitEdge = digitDown && !prev;
            buildHotkeyPrevRef.current[`obelisk-${digit}`] = digitDown;
            if (!digitEdge) continue;
            const entry = catalog[i];
            if (!entry || owned.has(entry.id) || localGold < EXPLORE_OBELISK_TALENT_GOLD_COST) break;
            obeliskBuyTalentRef.current(entry.id);
            break;
          }
        } else if (nearResearchRef.current && buildModeRef.current === 'idle') {
          for (const upgrade of EXPLORE_RESEARCH_UPGRADES) {
            const digit = upgrade.hotkey;
            const digitDown = cs.isKeyPressed(digit);
            const prev = buildHotkeyPrevRef.current[`research-${digit}`] ?? false;
            const digitEdge = digitDown && !prev;
            buildHotkeyPrevRef.current[`research-${digit}`] = digitDown;
            if (digitEdge) {
              researchPurchaseRef.current(upgrade.id);
              break;
            }
          }
        } else if (nearFirePitRef.current && buildModeRef.current === 'idle') {
          const localMeat = contextPlayersRef.current.get(socket?.id || '')?.meat ?? 0;
          const firePitActions = ['self', 'allies'] as const;
          for (let i = 0; i < firePitActions.length; i += 1) {
            const digit = String(i + 1);
            const digitDown = cs.isKeyPressed(digit);
            const prev = buildHotkeyPrevRef.current[`firepit-${digit}`] ?? false;
            const digitEdge = digitDown && !prev;
            buildHotkeyPrevRef.current[`firepit-${digit}`] = digitDown;
            if (digitEdge && localMeat >= EXPLORE_FIRE_PIT_HEAL_MEAT_COST) {
              firePitHealRef.current(firePitActions[i]!);
              break;
            }
          }
        }

        buildKeyPrevRef.current = bDown;
        buildEscKeyPrevRef.current = escDown;
      } else {
        buildKeyPrevRef.current = false;
        buildEscKeyPrevRef.current = false;
        buildHotkeyPrevRef.current = {};
      }

      if (inThroneRoom && playerEntity && controlSystemRef.current && !isChatOpen) {
        const cs = controlSystemRef.current;
        const transform = playerEntity.getComponent(Transform);
        if (transform) {
          const px = transform.position.x;
          const pz = transform.position.z;
          const rWeapon = THRONE_WEAPON_INTERACT_RADIUS;
          const rWeapon2 = rWeapon * rWeapon;
          const ax = THRONE_ABILITY_PEDESTAL_POSITION.x;
          const az = THRONE_ABILITY_PEDESTAL_POSITION.z;
          const adx = px - ax;
          const adz = pz - az;
          const ad2 = adx * adx + adz * adz;
          const rAb2 = THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS * THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS;

          const tx = THRONE_TALENT_PEDESTAL_POSITION.x;
          const tz = THRONE_TALENT_PEDESTAL_POSITION.z;
          const tdx = px - tx;
          const tdz = pz - tz;
          const td2 = tdx * tdx + tdz * tdz;

          let bestWeapon: { weapon: WeaponType; d2: number } | null = null;
          for (const def of THRONE_WEAPON_INTERACT_DEFS) {
            const dx = px - def.x;
            const dz = pz - def.z;
            const d2 = dx * dx + dz * dz;
            if (d2 <= rWeapon2 && (!bestWeapon || d2 < bestWeapon.d2)) {
              bestWeapon = { weapon: def.weapon, d2 };
            }
          }

          const rArchetype = THRONE_ARCHETYPE_INTERACT_RADIUS;
          const rArchetype2 = rArchetype * rArchetype;
          let bestArchetype: { archetype: Archetype; d2: number } | null = null;
          for (const def of THRONE_ARCHETYPE_INTERACT_DEFS) {
            const dx = px - def.x;
            const dz = pz - def.z;
            const d2 = dx * dx + dz * dz;
            if (d2 <= rArchetype2 && (!bestArchetype || d2 < bestArchetype.d2)) {
              bestArchetype = { archetype: def.archetype, d2 };
            }
          }

          const abilityInRange = COOP_DEV_LOCALHOST_FEATURES && ad2 <= rAb2;
          const talentInRange = COOP_DEV_LOCALHOST_FEATURES && td2 <= rAb2;
          const cur = selectedWeaponsRef.current?.primary;

          const xDown = cs.isKeyPressed('x');
          const xEdge = xDown && !throneInteractKeyPrevRef.current;

          /** Ability / talent pedestals: usable even while boon picker or talent UI flag `throneAbilityModalOpen`; closest pillar wins vs the other pillar only. */
          let pedestalXHandled = false;
          if (
            xEdge &&
            cur !== undefined &&
            cur !== WeaponType.NONE &&
            (abilityInRange || talentInRange)
          ) {
            type ThronePedestalPick = { kind: 'ability' | 'talent'; d2: number };
            const pedestalCandidates: ThronePedestalPick[] = [];
            if (abilityInRange && onRequestThroneAbilityModalRef.current) {
              pedestalCandidates.push({ kind: 'ability', d2: ad2 });
            }
            if (talentInRange && onRequestThroneTalentModalRef.current) {
              pedestalCandidates.push({ kind: 'talent', d2: td2 });
            }
            pedestalCandidates.sort((a, b) => a.d2 - b.d2);
            const pedestalPick = pedestalCandidates[0];
            if (pedestalPick?.kind === 'ability') {
              onRequestThroneAbilityModalRef.current?.(cur);
              pedestalXHandled = true;
              if ((window as any).audioSystem?.playUISelectionSound) {
                (window as any).audioSystem.playUISelectionSound();
              }
            } else if (pedestalPick?.kind === 'talent') {
              onRequestThroneTalentModalRef.current?.(cur);
              pedestalXHandled = true;
              if ((window as any).audioSystem?.playUISelectionSound) {
                (window as any).audioSystem.playUISelectionSound();
              }
            }
          }

          throneInteractKeyPrevRef.current = xDown;

          if (xEdge && !pedestalXHandled && !throneAbilityModalOpenRef.current) {
              type ThroneXTarget =
                | { kind: 'weapon'; d2: number; weapon: WeaponType }
                | { kind: 'aspect'; d2: number; weapon: WeaponType }
                | { kind: 'archetype'; d2: number; archetype: Archetype }
                | { kind: 'portal'; d2: number; chosen: string };
              const candidates: ThroneXTarget[] = [];
              if (bestWeapon && cur !== undefined) {
                if (bestWeapon.weapon !== cur) {
                  candidates.push({ kind: 'weapon', d2: bestWeapon.d2, weapon: bestWeapon.weapon });
                } else if (canCycleWeaponAspectRef.current) {
                  candidates.push({ kind: 'aspect', d2: bestWeapon.d2, weapon: bestWeapon.weapon });
                }
              }
              const curArchetype = selectedArchetypeRef.current;
              if (
                bestArchetype &&
                bestArchetype.archetype !== curArchetype
              ) {
                candidates.push({
                  kind: 'archetype',
                  d2: bestArchetype.d2,
                  archetype: bestArchetype.archetype,
                });
              }

              const offer = thronePortalOfferRef.current;
              const rVoid2 = voidPortalInteractRadius(THRONE_VOID_PORTAL_RADIUS) ** 2;
              const rExplore2 = voidPortalInteractRadius(THRONE_EXPLORE_PORTAL_RADIUS) ** 2;
              const rDefense2 = voidPortalInteractRadius(THRONE_DEFENSE_PORTAL_RADIUS) ** 2;
              const rDungeon2 = voidPortalInteractRadius(THRONE_DUNGEON_PORTAL_RADIUS) ** 2;
              const rSkyTemple2 = voidPortalInteractRadius(THRONE_SKY_TEMPLE_PORTAL_RADIUS) ** 2;
              const rPortal = VOID_PORTAL_INTERACT_RADIUS;
              const rPortal2 = rPortal * rPortal;
              if (
                !portalUseSentRef.current &&
                cur !== undefined &&
                cur !== WeaponType.NONE &&
                throneVoidPortalOpenRef.current
              ) {
                const edx = px - THRONE_EXPLORE_PORTAL_POSITION.x;
                const edz = pz - THRONE_EXPLORE_PORTAL_POSITION.z;
                const ed2 = edx * edx + edz * edz;
                if (ed2 < rExplore2) {
                  candidates.push({ kind: 'portal', d2: ed2, chosen: 'explore' });
                }
                const ddx = px - THRONE_DEFENSE_PORTAL_POSITION.x;
                const ddz = pz - THRONE_DEFENSE_PORTAL_POSITION.z;
                const dd2 = ddx * ddx + ddz * ddz;
                if (dd2 < rDefense2) {
                  candidates.push({ kind: 'portal', d2: dd2, chosen: 'defense' });
                }
                const gdx = px - THRONE_DUNGEON_PORTAL_POSITION.x;
                const gdz = pz - THRONE_DUNGEON_PORTAL_POSITION.z;
                const gd2 = gdx * gdx + gdz * gdz;
                if (gd2 < rDungeon2) {
                  candidates.push({ kind: 'portal', d2: gd2, chosen: 'dungeon' });
                }
                const sdx = px - THRONE_SKY_TEMPLE_PORTAL_POSITION.x;
                const sdz = pz - THRONE_SKY_TEMPLE_PORTAL_POSITION.z;
                const sd2 = sdx * sdx + sdz * sdz;
                if (sd2 < rSkyTemple2) {
                  candidates.push({ kind: 'portal', d2: sd2, chosen: 'sky_temple' });
                }
              }
              if (
                !portalUseSentRef.current &&
                cur !== undefined &&
                cur !== WeaponType.NONE &&
                throneVoidPortalOpenRef.current
              ) {
                const dx = px - THRONE_VOID_PORTAL_POSITION.x;
                const dz = pz - THRONE_VOID_PORTAL_POSITION.z;
                const d2 = dx * dx + dz * dz;
                if (d2 < rVoid2) {
                  candidates.push({ kind: 'portal', d2, chosen: 'intro' });
                }
              } else if (
                !portalUseSentRef.current &&
                cur !== undefined &&
                cur !== WeaponType.NONE &&
                curArchetype !== ARCHETYPE_NONE &&
                offer.length >= 2
              ) {
                let bestI = 0;
                let bestD2 = Infinity;
                for (let i = 0; i < THRONE_PORTAL_POSITIONS.length; i++) {
                  const pos = THRONE_PORTAL_POSITIONS[i]!;
                  const dx = px - pos.x;
                  const dz = pz - pos.z;
                  const d2 = dx * dx + dz * dz;
                  if (d2 < bestD2) {
                    bestD2 = d2;
                    bestI = i;
                  }
                }
                if (bestD2 < rPortal2) {
                  const chosen = offer[bestI] ?? offer[0];
                  if (chosen != null) {
                    candidates.push({ kind: 'portal', d2: bestD2, chosen: String(chosen) });
                  }
                }
              } else if (
                !portalUseSentRef.current &&
                cur !== undefined &&
                cur !== WeaponType.NONE &&
                curArchetype !== ARCHETYPE_NONE &&
                offer.length === 1
              ) {
                const dx = px - THRONE_PORTAL_POSITION.x;
                const dz = pz - THRONE_PORTAL_POSITION.z;
                const d2 = dx * dx + dz * dz;
                if (d2 < rPortal2 && offer[0] != null) {
                  candidates.push({ kind: 'portal', d2, chosen: String(offer[0]) });
                }
              }

              candidates.sort((a, b) => a.d2 - b.d2);

              const pick = candidates[0];
              if (pick?.kind === 'weapon') {
                const w = pick.weapon;
                const nextAspect = getShowcaseWeaponAspect(w, showcaseTickRef.current);
                setSelectedWeapons({ primary: w, secondary: w });
                rememberWeaponAspect(w, nextAspect);
                let nextLoadout = getDefaultLoadoutForWeapon(w, nextAspect);
                if (w === WeaponType.BOW) {
                  nextLoadout = syncBowLoadoutRForAspect(nextLoadout, nextAspect);
                } else if (w === WeaponType.RUNEBLADE) {
                  nextLoadout = syncRunebladeLoadoutRForAspect(nextLoadout, nextAspect);
                } else if (w === WeaponType.SABRES) {
                  nextLoadout = syncSabresLoadoutRForAspect(nextLoadout, nextAspect);
                }
                setAbilityLoadout(nextLoadout);
                // Single emit with aspect so ControlSystem rebroadcast cannot wipe to default.
                updatePlayerWeapon(w, defaultSubclassForThroneWeapon(w), nextAspect);
                onThroneWeaponEquippedRef.current?.(w);
                onWeaponAspectCycledRef.current?.(nextAspect);
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              } else if (pick?.kind === 'aspect') {
                const nextAspect = cycleWeaponAspect(
                  pick.weapon,
                  selectedWeaponAspectRef.current,
                );
                rememberWeaponAspect(pick.weapon, nextAspect);
                updatePlayerWeaponAspect(nextAspect);
                if (pick.weapon === WeaponType.BOW) {
                  const currentLoadout = abilityLoadoutRef.current ?? getDefaultLoadoutForWeapon(WeaponType.BOW, nextAspect);
                  setAbilityLoadout(syncBowLoadoutRForAspect(currentLoadout, nextAspect));
                } else if (pick.weapon === WeaponType.RUNEBLADE) {
                  const currentLoadout = abilityLoadoutRef.current ?? getDefaultLoadoutForWeapon(WeaponType.RUNEBLADE, nextAspect);
                  setAbilityLoadout(syncRunebladeLoadoutRForAspect(currentLoadout, nextAspect));
                } else if (pick.weapon === WeaponType.SABRES) {
                  const currentLoadout = abilityLoadoutRef.current ?? getDefaultLoadoutForWeapon(WeaponType.SABRES, nextAspect);
                  setAbilityLoadout(syncSabresLoadoutRForAspect(currentLoadout, nextAspect));
                }
                onWeaponAspectCycledRef.current?.(nextAspect);
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              } else if (pick?.kind === 'archetype' && isSelectableArchetype(pick.archetype)) {
                setSelectedArchetype(pick.archetype);
                updatePlayerArchetype(pick.archetype);
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              } else if (pick?.kind === 'portal') {
                portalUseSentRef.current = true;
                if (pick.chosen === 'intro') {
                  enterCombatArena();
                } else {
                  enterCombatArena(pick.chosen);
                }
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
          }

          if (throneDevTalentShortcutEnabledRef.current && onRequestThroneTalentModalRef.current) {
            const tDown = cs.isKeyPressed('t');
            const tEdge = tDown && !throneTalentInteractKeyPrevRef.current;
            throneTalentInteractKeyPrevRef.current = tDown;
            if (tEdge && talentInRange && cur !== undefined && cur !== WeaponType.NONE) {
              onRequestThroneTalentModalRef.current(cur);
              if ((window as any).audioSystem?.playUISelectionSound) {
                (window as any).audioSystem.playUISelectionSound();
              }
            }
          }
        }
      }

      // Throne prep: ground gold autocollect (main-arena loop requires combatArenaActive)
      if (
        inThroneRoom &&
        gameMode === 'coop' &&
        playerEntity &&
        socket?.id &&
        !isChatOpenRef.current &&
        !throneAbilityModalOpenRef.current
      ) {
        const transformPrepGold = playerEntity.getComponent(Transform);
        if (transformPrepGold) {
          const px = transformPrepGold.position.x;
          const pz = transformPrepGold.position.z;
          const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
          const rPick2 = rPick * rPick;
          let nearestGoldPrep: { id: string; d2: number } | null = null;
          goldDropsRef.current.forEach((drop) => {
            const dx = px - drop.position.x;
            const dz = pz - drop.position.z;
            const d2 = dx * dx + dz * dz;
            if (d2 <= rPick2 && (!nearestGoldPrep || d2 < nearestGoldPrep.d2)) {
              nearestGoldPrep = { id: drop.id, d2 };
            }
          });
          const _goldPrepFound = nearestGoldPrep as { id: string; d2: number } | null;
          if (
            _goldPrepFound &&
            !pendingGoldAutoPickupRef.current.has(_goldPrepFound.id)
          ) {
            pendingGoldAutoPickupRef.current.add(_goldPrepFound.id);
            pickupGoldDropRef.current(_goldPrepFound.id);
          }
        }
      }

      // Main arena: pedestal X-interact + X-press portal entry
      if (
        !inThroneRoom &&
        gameMode === 'coop' &&
        combatArenaActiveRef.current &&
        playerEntity &&
        socket?.id &&
        !isChatOpenRef.current &&
        !throneAbilityModalOpenRef.current
      ) {
        const cs = controlSystemRef.current;
        const transform = playerEntity.getComponent(Transform);
        if (cs && transform) {
          const px = transform.position.x;
          const pz = transform.position.z;

          const xDown = cs.isKeyPressed('x');
          const xEdge = xDown && !mainArenaInteractKeyPrevRef.current;
          mainArenaInteractKeyPrevRef.current = xDown;

          const pedDx = px - MAIN_COMBAT_PEDESTAL_POSITION.x;
          const pedDz = pz - MAIN_COMBAT_PEDESTAL_POSITION.z;
          const pedR = MAIN_COMBAT_PEDESTAL_INTERACT_RADIUS;
          const pedR2 = pedR * pedR;
          const inCastleRoom =
            coopCurrentRoomKindRef.current === 'intro'
            || coopCurrentRoomKindRef.current === 'deep_sanctum'
            || coopCurrentRoomKindRef.current === 'sunken_temple';
          const inIntroRoom = coopCurrentRoomKindRef.current === 'intro';
          const inFaeRealmRoom = coopCurrentRoomKindRef.current === 'fae_realm';
          const inSunkenRoom = coopCurrentRoomKindRef.current === 'sunken_temple';
          const inEternityRoom = coopCurrentRoomKindRef.current === 'eternity_palace';

          if (xEdge && inFaeRealmRoom && !portalUseSentRef.current) {
            if (coopFaeRealmPortalOpenRef.current) {
              const rPortal = VOID_PORTAL_INTERACT_RADIUS;
              const d2 = px * px + pz * pz;
              if (d2 < rPortal * rPortal) {
                portalUseSentRef.current = true;
                enterCombatArena();
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            }
          } else if (xEdge && inIntroRoom && !portalUseSentRef.current) {
            if (coopIntroFountainPhaseRef.current) {
              let recruitedAllyNow = false;
              if (!coopIntroAllyChoiceMadeRef.current) {
                const recruitKind = findNearestSelectableAllyCandidate(
                  px,
                  pz,
                  introAllyChoiceEncounterRef.current,
                );
                if (recruitKind) {
                  recruitedAllyNow = true;
                  chooseCoopAllyRef.current(recruitKind);
                  if ((window as any).audioSystem?.playUISelectionSound) {
                    (window as any).audioSystem.playUISelectionSound();
                  }
                }
              }
              if (!recruitedAllyNow) {
                const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
                const fountainD2 = px * px + pz * pz;
                if (!coopIntroFountainUsedRef.current && fountainD2 < fountainR2) {
                  useCoopFountainRef.current();
                  if ((window as any).audioSystem?.playFountainSound) {
                    (window as any).audioSystem.playFountainSound();
                  }
                } else if (coopIntroFountainUsedRef.current) {
                  const offer = thronePortalOfferRef.current;
                  const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                  const r2 = rPortal * rPortal;
                  if (offer.length >= 2) {
                    let bestI = 0;
                    let bestD2 = Infinity;
                    for (let i = 0; i < CASTLE_ROOM_CHOICE_PORTAL_POSITIONS.length; i++) {
                      const pos = CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[i]!;
                      const dx = px - pos.x;
                      const dz = pz - pos.z;
                      const d2 = dx * dx + dz * dz;
                      if (d2 < bestD2) {
                        bestD2 = d2;
                        bestI = i;
                      }
                    }
                    if (bestD2 < r2) {
                      portalUseSentRef.current = true;
                      const chosen = offer[bestI] ?? offer[0];
                      enterCombatArena(chosen);
                      if ((window as any).audioSystem?.playUISelectionSound) {
                        (window as any).audioSystem.playUISelectionSound();
                      }
                    }
                  }
                }
              }
            } else if (coopIntroPortalOpenRef.current) {
              const rPortal = VOID_PORTAL_INTERACT_RADIUS;
              const d2 = px * px + pz * pz;
              if (d2 < rPortal * rPortal) {
                portalUseSentRef.current = true;
                enterCombatArena();
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            }
          } else if (xEdge && inSunkenRoom && !portalUseSentRef.current) {
            if (coopSunkenFountainPhaseRef.current) {
              const localPlayerId = socket?.id;
              const localHasClaimed =
                !!localPlayerId
                && coopSunkenLootClaimedPlayerIdsRef.current.includes(localPlayerId);
              if (!coopSunkenLootPhaseCompleteRef.current && !localHasClaimed) {
                if (
                  isSunkenSentinelSelectable(
                    px,
                    pz,
                    sunkenSentinelEncounterRef.current,
                  )
                ) {
                  onSunkenSentinelInteractRef.current?.();
                  if ((window as any).audioSystem?.playUISelectionSound) {
                    (window as any).audioSystem.playUISelectionSound();
                  }
                }
              } else {
                const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
                const fountainD2 = px * px + pz * pz;
                if (!coopSunkenFountainUsedRef.current && fountainD2 < fountainR2) {
                  useCoopFountainRef.current();
                  if ((window as any).audioSystem?.playFountainSound) {
                    (window as any).audioSystem.playFountainSound();
                  }
                } else if (coopSunkenFountainUsedRef.current) {
                  const offer = thronePortalOfferRef.current;
                  const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                  const r2 = rPortal * rPortal;
                  if (offer.length >= 2) {
                    let bestI = 0;
                    let bestD2 = Infinity;
                    for (let i = 0; i < CASTLE_ROOM_CHOICE_PORTAL_POSITIONS.length; i++) {
                      const pos = CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[i]!;
                      const dx = px - pos.x;
                      const dz = pz - pos.z;
                      const d2 = dx * dx + dz * dz;
                      if (d2 < bestD2) {
                        bestD2 = d2;
                        bestI = i;
                      }
                    }
                    if (bestD2 < r2) {
                      portalUseSentRef.current = true;
                      const chosen = offer[bestI] ?? offer[0];
                      enterCombatArena(chosen);
                      if ((window as any).audioSystem?.playUISelectionSound) {
                        (window as any).audioSystem.playUISelectionSound();
                      }
                    }
                  }
                }
              }
            } else if (coopSunkenPortalOpenRef.current) {
              const rPortal = VOID_PORTAL_INTERACT_RADIUS;
              const d2 = px * px + pz * pz;
              if (d2 < rPortal * rPortal) {
                portalUseSentRef.current = true;
                enterCombatArena();
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            }
          } else if (xEdge && inEternityRoom && !portalUseSentRef.current) {
            if (coopEternityFountainPhaseRef.current) {
              const localPlayerId = socket?.id;
              const localHasClaimed =
                !!localPlayerId
                && coopEternityLootClaimedPlayerIdsRef.current.includes(localPlayerId);
              if (!coopEternityLootPhaseCompleteRef.current && !localHasClaimed) {
                if (
                  isEternityPalaceLootSelectable(
                    px,
                    pz,
                    eternityPalaceEncounterRef.current,
                  )
                ) {
                  onEternityPalaceArchitectInteractRef.current?.();
                  if ((window as any).audioSystem?.playUISelectionSound) {
                    (window as any).audioSystem.playUISelectionSound();
                  }
                }
              } else {
                const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
                const fountainD2 = px * px + pz * pz;
                if (!coopEternityFountainUsedRef.current && fountainD2 < fountainR2) {
                  useCoopFountainRef.current();
                  if ((window as any).audioSystem?.playFountainSound) {
                    (window as any).audioSystem.playFountainSound();
                  }
                } else if (coopEternityFountainUsedRef.current) {
                  const offer = thronePortalOfferRef.current;
                  const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                  const r2 = rPortal * rPortal;
                  if (offer.length >= 2) {
                    let bestI = 0;
                    let bestD2 = Infinity;
                    for (let i = 0; i < CASTLE_ROOM_CHOICE_PORTAL_POSITIONS.length; i++) {
                      const pos = CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[i]!;
                      const dx = px - pos.x;
                      const dz = pz - pos.z;
                      const d2 = dx * dx + dz * dz;
                      if (d2 < bestD2) {
                        bestD2 = d2;
                        bestI = i;
                      }
                    }
                    if (bestD2 < r2) {
                      portalUseSentRef.current = true;
                      const chosen = offer[bestI] ?? offer[0];
                      enterCombatArena(chosen);
                      if ((window as any).audioSystem?.playUISelectionSound) {
                        (window as any).audioSystem.playUISelectionSound();
                      }
                    }
                  }
                }
              }
            } else if (coopEternityPortalOpenRef.current) {
              const rPortal = VOID_PORTAL_INTERACT_RADIUS;
              const d2 = px * px + pz * pz;
              if (d2 < rPortal * rPortal) {
                portalUseSentRef.current = true;
                enterCombatArena();
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            }
          } else if (
            xEdge
            && (coopCurrentRoomKindRef.current === 'eden' || coopCurrentRoomKindRef.current === 'false_eden')
            && !portalUseSentRef.current
          ) {
            const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
            const fountainD2 = px * px + pz * pz;
            const canUseFountain =
              coopCurrentRoomKindRef.current === 'eden'
              || (coopCurrentRoomKindRef.current === 'false_eden' && coopFalseEdenClearedRef.current);
            if (canUseFountain && !coopEdenFountainUsedRef.current && fountainD2 < fountainR2) {
              useCoopFountainRef.current();
              if ((window as any).audioSystem?.playFountainSound) {
                (window as any).audioSystem.playFountainSound();
              }
            } else if (coopEdenFountainUsedRef.current) {
              const resumeKind = coopEdenResumeKindRef.current ?? thronePortalOfferRef.current[0];
              const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
              const rPortal = VOID_PORTAL_INTERACT_RADIUS;
              const dx = px - pos.x;
              const dz = pz - pos.z;
              if (resumeKind && dx * dx + dz * dz < rPortal * rPortal) {
                portalUseSentRef.current = true;
                enterCombatArena(resumeKind);
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            }
          } else if (
            xEdge
            && coopCurrentRoomKindRef.current === 'defense'
            && coopDefenseFountainActiveRef.current
            && !coopDefenseFountainUsedRef.current
          ) {
            const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
            if (px * px + pz * pz < fountainR2) {
              useCoopFountainRef.current();
              if ((window as any).audioSystem?.playFountainSound) {
                (window as any).audioSystem.playFountainSound();
              }
            }
          } else if (
            xEdge
            && coopCurrentRoomKindRef.current === 'eden_finale'
          ) {
            const daisyR2 = EDEN_FINALE_DAISY_INTERACT_RADIUS * EDEN_FINALE_DAISY_INTERACT_RADIUS;
            if (px * px + pz * pz < daisyR2) {
              window.location.reload();
            }
          } else if (
            xEdge
            && coopCurrentRoomKindRef.current === 'delirium_gate'
            && coopMainArenaPortalPhaseRef.current === 'eden_exit'
            && !portalUseSentRef.current
          ) {
            const resumeKind = coopEdenResumeKindRef.current ?? thronePortalOfferRef.current[0];
            const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
            const rPortal = VOID_PORTAL_INTERACT_RADIUS;
            const dx = px - pos.x;
            const dz = pz - pos.z;
            if (resumeKind && dx * dx + dz * dz < rPortal * rPortal) {
              portalUseSentRef.current = true;
              enterCombatArena(resumeKind);
              if ((window as any).audioSystem?.playUISelectionSound) {
                (window as any).audioSystem.playUISelectionSound();
              }
            }
          } else if (
            xEdge
            && coopCurrentRoomKindRef.current === 'erebus_gate'
            && coopMainArenaPortalPhaseRef.current === 'eden_exit'
            && !portalUseSentRef.current
          ) {
            const resumeKind = coopEdenResumeKindRef.current ?? thronePortalOfferRef.current[0];
            const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
            const rPortal = VOID_PORTAL_INTERACT_RADIUS;
            const dx = px - pos.x;
            const dz = pz - pos.z;
            if (resumeKind && dx * dx + dz * dz < rPortal * rPortal) {
              portalUseSentRef.current = true;
              enterCombatArena(resumeKind);
              if ((window as any).audioSystem?.playUISelectionSound) {
                (window as any).audioSystem.playUISelectionSound();
              }
            }
          } else if (
            xEdge &&
            !inIntroRoom &&
            coopCurrentRoomKindRef.current === 'dream_layer'
          ) {
            const rShop = DREAM_LAYER_SHOP_INTERACT_RADIUS;
            const rShop2 = rShop * rShop;
            let bestShop: { slot: (typeof DREAM_LAYER_SHOP_INTERACT_DEFS)[number]['slot']; d2: number } | null = null;
            for (const def of DREAM_LAYER_SHOP_INTERACT_DEFS) {
              const dx = px - def.x;
              const dz = pz - def.z;
              const d2 = dx * dx + dz * dz;
              if (d2 <= rShop2 && (!bestShop || d2 < bestShop.d2)) {
                bestShop = { slot: def.slot, d2 };
              }
            }
            if (bestShop) {
              const slotTaken = isDreamLayerSlotTaken(
                bestShop.slot,
                dreamLayerInventoryRef.current,
                dreamLayerPurchaseStateRef.current,
              );
              if (!slotTaken) {
                if (bestShop.slot === 'heal') {
                  purchaseDreamLayerHealRef.current();
                } else {
                  const stockId = getDreamLayerShopStockId(
                    bestShop.slot,
                    dreamLayerInventoryRef.current,
                  );
                  if (stockId) {
                    purchaseDreamLayerItemRef.current(stockId);
                  }
                }
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            } else if (
              coopMainArenaPortalPhaseRef.current === 'eden_exit'
              && !portalUseSentRef.current
            ) {
              const resumeKind = coopEdenResumeKindRef.current ?? thronePortalOfferRef.current[0];
              const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
              const rPortal = VOID_PORTAL_INTERACT_RADIUS;
              const dx = px - pos.x;
              const dz = pz - pos.z;
              if (resumeKind && dx * dx + dz * dz < rPortal * rPortal) {
                portalUseSentRef.current = true;
                enterCombatArena(resumeKind);
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            }
          } else if (
            xEdge &&
            !inIntroRoom &&
            coopCurrentRoomKindRef.current === 'merchant'
          ) {
            const rShop = MERCHANT_SHOP_INTERACT_RADIUS;
            const rShop2 = rShop * rShop;
            let bestShop: { slot: (typeof MERCHANT_SHOP_INTERACT_DEFS)[number]['slot']; d2: number } | null = null;
            for (const def of MERCHANT_SHOP_INTERACT_DEFS) {
              const dx = px - def.x;
              const dz = pz - def.z;
              const d2 = dx * dx + dz * dz;
              if (d2 <= rShop2 && (!bestShop || d2 < bestShop.d2)) {
                bestShop = { slot: def.slot, d2 };
              }
            }
            if (bestShop) {
              const slotTaken = isMerchantSlotTaken(
                bestShop.slot,
                merchantInventoryRef.current,
                merchantPurchaseStateRef.current,
              );
              if (!slotTaken) {
                if (bestShop.slot === 'heal') {
                  purchaseMerchantHealRef.current();
                } else {
                  const stockId = getMerchantShopStockId(
                    bestShop.slot,
                    merchantInventoryRef.current,
                    merchantPurchaseStateRef.current,
                  );
                  if (stockId) {
                    purchaseMerchantItemRef.current(stockId);
                  }
                }
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            } else if (
              portalsUnlockedRef.current &&
              !portalUseSentRef.current
            ) {
              const phase = coopMainArenaPortalPhaseRef.current;
              const offer = thronePortalOfferRef.current;
              if (
                (phase === 'pick_boss' || phase === 'pre_boss_merchant') &&
                offer.length >= 1 &&
                String(offer[0]).toLowerCase() === 'boss'
              ) {
                const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                const dx = px - pos.x;
                const dz = pz - pos.z;
                if (dx * dx + dz * dz < rPortal * rPortal) {
                  portalUseSentRef.current = true;
                  enterCombatArena('boss');
                  if ((window as any).audioSystem?.playUISelectionSound) {
                    (window as any).audioSystem.playUISelectionSound();
                  }
                }
              }
            }
          } else if (
            xEdge &&
            isExploreRef.current
          ) {
            const localId = socket?.id ?? null;
            const r2 = EXPLORE_CAMP_INTERACT_RADIUS * EXPLORE_CAMP_INTERACT_RADIUS;
            let best: { camp: ExploreCampPublic; d2: number } | null = null;
            for (const camp of exploreCampsRef.current) {
              if (!camp.cleared) continue;
              if (localId && camp.claimedBy.includes(localId)) continue;
              const dx = px - camp.x;
              const dz = pz - camp.z;
              const d2 = dx * dx + dz * dz;
              if (d2 > r2) continue;
              if (!best || d2 < best.d2) best = { camp, d2 };
            }
            if (best) {
              onExploreCampInteractRef.current?.(best.camp);
            }
          } else if (
            xEdge &&
            coopCurrentRoomKindRef.current === 'deep_sanctum' &&
            deepSanctumRewardKindRef.current &&
            pedDx * pedDx + pedDz * pedDz < pedR2
          ) {
            onCombatArenaPedestalInteractRef.current?.('deep_sanctum');
          } else if (
            xEdge &&
            !inCastleRoom &&
            coopCurrentRoomKindRef.current !== 'merchant' &&
            coopCurrentRoomKindRef.current !== 'fae_realm' &&
            coopCurrentRoomKindRef.current !== 'eternity_palace' &&
            pedestalBoonReadyRef.current &&
            pedDx * pedDx + pedDz * pedDz < pedR2
          ) {
            const rewardKind = coopClearedRoomKindRef.current ?? coopCurrentRoomKindRef.current;
            onCombatArenaPedestalInteractRef.current?.(rewardKind);
          } else if (
            xEdge &&
            !inCastleRoom &&
            portalsUnlockedRef.current &&
            coopMainArenaPortalPhaseRef.current &&
            !portalUseSentRef.current
          ) {
            const rPortal = 2.9;
            const r2 = rPortal * rPortal;
            const offer = thronePortalOfferRef.current;
            const phase = coopMainArenaPortalPhaseRef.current;

            if (
              (phase === 'pick_wave2' || phase === 'pick_pre_boss' || phase === 'pick_post_boss') &&
              offer.length >= 2
            ) {
              let bestPick: { kind: 'void' | 'side'; d2: number; chosen?: string } | null = null;
              if (coopVoidPortalOfferedRef.current) {
                const voidD2 = px * px + pz * pz;
                const voidR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
                if (voidD2 < voidR2) {
                  bestPick = { kind: 'void', d2: voidD2 };
                }
              }
              for (let i = 0; i < MAIN_COMBAT_CHOICE_PORTAL_POSITIONS.length; i++) {
                const pos = MAIN_COMBAT_CHOICE_PORTAL_POSITIONS[i]!;
                const dx = px - pos.x;
                const dz = pz - pos.z;
                const d2 = dx * dx + dz * dz;
                if (d2 < r2 && (!bestPick || d2 < bestPick.d2)) {
                  bestPick = { kind: 'side', d2, chosen: offer[i] ?? offer[0] };
                }
              }
              if (bestPick) {
                portalUseSentRef.current = true;
                if (bestPick.kind === 'void') {
                  enterCombatArena('void');
                } else {
                  enterCombatArena(bestPick.chosen ?? offer[0]);
                }
              }
            } else if (
              phase === 'pick_sunken_entry'
            ) {
              const voidD2 = px * px + pz * pz;
              const voidR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
              if (voidD2 < voidR2) {
                portalUseSentRef.current = true;
                enterCombatArena('void');
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            } else if (
              phase === 'pick_eternity_entry' || phase === 'pick_eternity_late_entry'
            ) {
              const voidD2 = px * px + pz * pz;
              const voidR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
              if (voidD2 < voidR2) {
                portalUseSentRef.current = true;
                enterCombatArena('void');
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            } else if (phase === 'pick_trinity_finale') {
              const voidD2 = px * px + pz * pz;
              const voidR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
              if (voidD2 < voidR2) {
                portalUseSentRef.current = true;
                enterCombatArena('void');
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              }
            } else if (
              (phase === 'pick_boss' || phase === 'pre_boss_merchant') &&
              offer.length >= 1 &&
              String(offer[0]).toLowerCase() === 'boss'
            ) {
              const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
              const dx = px - pos.x;
              const dz = pz - pos.z;
              const bossR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
              if (dx * dx + dz * dz < bossR2) {
                portalUseSentRef.current = true;
                enterCombatArena('boss');
              }
            }
          } else if (xEdge) {
            const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
            const rPick2 = rPick * rPick;
            let nearestBossItem: { id: string; d2: number } | null = null;
            droppedItemsRef.current.forEach((item) => {
              if (item.category !== 'boss_drop') return;
              if (!canLocalPlayerAcquireBossDrop(item, inventorySnapshotRef.current)) return;
              const dx = px - item.position.x;
              const dz = pz - item.position.z;
              const d2 = dx * dx + dz * dz;
              if (d2 <= rPick2 && (!nearestBossItem || d2 < nearestBossItem.d2)) {
                nearestBossItem = { id: item.id, d2 };
              }
            });
            const _bossItemFound = nearestBossItem as { id: string; d2: number } | null;
            if (_bossItemFound) {
              pickupItemRef.current(_bossItemFound.id);
            }
          }

          // Rune amulets: auto-collect when much closer (no X)
          {
            const rPick = COOP_RUNE_AUTO_PICKUP_RADIUS;
            const rPick2 = rPick * rPick;
            let nearestRune: { id: string; d2: number } | null = null;
            droppedItemsRef.current.forEach((item) => {
              if (!isRuneAmuletItem(item)) return;
              const dx = px - item.position.x;
              const dz = pz - item.position.z;
              const d2 = dx * dx + dz * dz;
              if (d2 <= rPick2 && (!nearestRune || d2 < nearestRune.d2)) {
                nearestRune = { id: item.id, d2 };
              }
            });
            const _runeFound = nearestRune as { id: string; d2: number } | null;
            if (
              _runeFound &&
              !pendingRuneAutoPickupRef.current.has(_runeFound.id)
            ) {
              pendingRuneAutoPickupRef.current.add(_runeFound.id);
              pickupItemRef.current(_runeFound.id);
            }
          }

          // Ground gold: collect when in range without pressing X
          {
            const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
            const rPick2 = rPick * rPick;
            let nearestGold: { id: string; d2: number } | null = null;
            goldDropsRef.current.forEach((drop) => {
              const dx = px - drop.position.x;
              const dz = pz - drop.position.z;
              const d2 = dx * dx + dz * dz;
              if (d2 <= rPick2 && (!nearestGold || d2 < nearestGold.d2)) {
                nearestGold = { id: drop.id, d2 };
              }
            });
            const _goldFound = nearestGold as { id: string; d2: number } | null;
            if (
              _goldFound &&
              !pendingGoldAutoPickupRef.current.has(_goldFound.id)
            ) {
              pendingGoldAutoPickupRef.current.add(_goldFound.id);
              pickupGoldDropRef.current(_goldFound.id);
            }
          }
        }
      }

      // Explore: ground wood autocollect when in range
      if (
        isExploreRef.current &&
        gameMode === 'coop' &&
        playerEntity &&
        socket?.id &&
        !isChatOpenRef.current &&
        !throneAbilityModalOpenRef.current
      ) {
        const transformWood = playerEntity.getComponent(Transform);
        if (transformWood) {
          const px = transformWood.position.x;
          const pz = transformWood.position.z;
          const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
          const rPick2 = rPick * rPick;
          let nearestWood: { id: string; d2: number } | null = null;
          woodDropsRef.current.forEach((drop) => {
            const dx = px - drop.position.x;
            const dz = pz - drop.position.z;
            const d2 = dx * dx + dz * dz;
            if (d2 <= rPick2 && (!nearestWood || d2 < nearestWood.d2)) {
              nearestWood = { id: drop.id, d2 };
            }
          });
          const _woodFound = nearestWood as { id: string; d2: number } | null;
          if (
            _woodFound &&
            !pendingWoodAutoPickupRef.current.has(_woodFound.id)
          ) {
            pendingWoodAutoPickupRef.current.add(_woodFound.id);
            pickupWoodDropRef.current(_woodFound.id);
          }
        }
      }

      // Explore: ground stone autocollect when in range
      if (
        isExploreRef.current &&
        gameMode === 'coop' &&
        playerEntity &&
        socket?.id &&
        !isChatOpenRef.current &&
        !throneAbilityModalOpenRef.current
      ) {
        const transformStone = playerEntity.getComponent(Transform);
        if (transformStone) {
          const px = transformStone.position.x;
          const pz = transformStone.position.z;
          const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
          const rPick2 = rPick * rPick;
          let nearestStone: { id: string; d2: number } | null = null;
          stoneDropsRef.current.forEach((drop) => {
            const dx = px - drop.position.x;
            const dz = pz - drop.position.z;
            const d2 = dx * dx + dz * dz;
            if (d2 <= rPick2 && (!nearestStone || d2 < nearestStone.d2)) {
              nearestStone = { id: drop.id, d2 };
            }
          });
          const _stoneFound = nearestStone as { id: string; d2: number } | null;
          if (
            _stoneFound &&
            !pendingStoneAutoPickupRef.current.has(_stoneFound.id)
          ) {
            pendingStoneAutoPickupRef.current.add(_stoneFound.id);
          pickupStoneDropRef.current(_stoneFound.id);
          }
        }
      }

      // Explore: ground meat autocollect when in range
      if (
        isExploreRef.current &&
        gameMode === 'coop' &&
        playerEntity &&
        socket?.id &&
        !isChatOpenRef.current &&
        !throneAbilityModalOpenRef.current
      ) {
        const localMeat = contextPlayersRef.current.get(socket.id)?.meat ?? 0;
        if (localMeat >= EXPLORE_MEAT_STACK_CAP) {
          pendingMeatAutoPickupRef.current.clear();
        } else {
          const transformMeat = playerEntity.getComponent(Transform);
          if (transformMeat) {
            const px = transformMeat.position.x;
            const pz = transformMeat.position.z;
            const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
            const rPick2 = rPick * rPick;
            let nearestMeat: { id: string; d2: number } | null = null;
            meatDropsRef.current.forEach((drop) => {
              const dx = px - drop.position.x;
              const dz = pz - drop.position.z;
              const d2 = dx * dx + dz * dz;
              if (d2 <= rPick2 && (!nearestMeat || d2 < nearestMeat.d2)) {
                nearestMeat = { id: drop.id, d2 };
              }
            });
            const _meatFound = nearestMeat as { id: string; d2: number } | null;
            if (
              _meatFound &&
              !pendingMeatAutoPickupRef.current.has(_meatFound.id)
            ) {
              pendingMeatAutoPickupRef.current.add(_meatFound.id);
              pickupMeatDropRef.current(_meatFound.id);
            }
          }
        }
      }

      // Update FPS counter
      updateFPSCounter(engineRef.current.getCurrentFPS());

      // Dev performance meter — engine-side samples (~2 Hz)
      if (
        isDevPerformanceHudEnabled() &&
        engineRef.current &&
        gameStarted &&
        engineReady
      ) {
        const perfNow = Date.now();
        if (perfNow - lastDevPerfEngineSample.current > 500) {
          lastDevPerfEngineSample.current = perfNow;
          const engineWorld = engineRef.current.getWorld();
          const engStats = engineRef.current.getPerformanceStats();
          const collisionSystem = engineWorld.getSystem(CollisionSystem);
          const projectileSystem = engineWorld.getSystem(ProjectileSystem);
          const collStats = collisionSystem?.getPerformanceStats();
          const poolStats = getPoolStats();
          devPerformanceStore.publish({
            fps: engStats.fps,
            frameTimeMs: engStats.fps > 0 ? Math.round((1000 / engStats.fps) * 10) / 10 : 0,
            updateTimeMs: Math.round(engStats.updateTime * 10) / 10,
            renderTimeMs: Math.round(engStats.renderTime * 10) / 10,
            ecsEntities: engineWorld.getAllEntities().length,
            enemyCount: enemiesRef.current.size,
            playerCount: playersRef.current.size,
            collisionChecks: collStats?.collisionChecks ?? 0,
            activeCollisions: collStats?.activeCollisions ?? 0,
            spatialHashCells: collStats?.spatialHashStats?.totalCells ?? 0,
            vector3PoolSize: projectileSystem?.getPoolStats().vector3 ?? 0,
            effectPoolActive: poolStats?.effectDataPool ?? 0,
          });
        }
      }

      // ==================== MEMORY MONITORING ====================
      const memoryCheckTime = Date.now();
      // Only check memory every 2 seconds to avoid performance overhead
      if (memoryCheckTime - lastMemoryCheck.current > 2000) {
        lastMemoryCheck.current = memoryCheckTime;
        
        // Check memory usage if performance.memory is available (Chrome only)
        const memoryInfo = (performance as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        if (memoryInfo) {
          const memoryUsage = memoryInfo.usedJSHeapSize;
          const limit = memoryInfo.jsHeapSizeLimit;
          const criticalBytes =
            limit > 0 ? limit * EMERGENCY_HEAP_USE_RATIO : MEMORY_CRITICAL_HEAP_FALLBACK;
          if (
            memoryUsage > criticalBytes &&
            memoryCheckTime - lastEmergencyCleanup.current > EMERGENCY_CLEANUP_COOLDOWN
          ) {
            if (process.env.NODE_ENV === 'development') {
              const limMb = limit > 0 ? Math.round(limit / 1024 / 1024) : 0;
              console.warn(
                `EMERGENCY: Memory pressure at ${Math.round(memoryUsage / 1024 / 1024)}MB` +
                  (limMb > 0 ? ` / ~${limMb}MB limit — triggering cleanup` : ' — triggering cleanup'),
              );
            }
            lastEmergencyCleanup.current = memoryCheckTime;
            performEmergencyCleanup();
          } else if (limit > 0 && memoryUsage > limit * MEMORY_WARNING_HEAP_RATIO) {
            if (Math.random() < 0.01) {
              console.warn(`Memory warning: ${Math.round(memoryUsage / 1024 / 1024)}MB used`);
            }
          }
        }
      }

      // Reset object pool temporary objects for this frame
      pvpObjectPool.resetFrameTemporaries();

      // Enemy ECS transforms sync in Engine preWorldUpdateHook (before collision/projectile systems).

      // Update player position for dragon renderer
      if (playerEntity) {
        const transform = playerEntity.getComponent(Transform);
        if (transform && transform.position) {
          const localDeathState = playerDeathStatesRef.current.get(socket?.id ?? '');
          if (localDeathState?.isDead) {
            transform.setPosition(
              localDeathState.deathPosition.x,
              localDeathState.deathPosition.y,
              localDeathState.deathPosition.z,
            );
            realTimePlayerPositionRef.current.copy(localDeathState.deathPosition);
          } else {
            realTimePlayerPositionRef.current.copy(transform.position);
          }
          const newPosition = realTimePlayerPositionRef.current;


          // Update Viper Sting parent ref with current position and camera rotation
          viperStingParentRef.current.position.copy(newPosition);

          const cameraSystem = (window as any).cameraSystem as
            | { getOrbitHorizontalFacingAngle?: () => number }
            | undefined;
          const cameraAngle =
            typeof cameraSystem?.getOrbitHorizontalFacingAngle === 'function'
              ? cameraSystem.getOrbitHorizontalFacingAngle()
              : (camera.getWorldDirection(_camDirScratch),
                 Math.atan2(_camDirScratch.x, _camDirScratch.z));

          // Update quaternion for Viper Sting direction (mutate in place — no per-frame object)
          const q = viperStingParentRef.current.quaternion;
          q.x = 0;
          q.y = Math.sin(cameraAngle / 2);
          q.z = 0;
          q.w = Math.cos(cameraAngle / 2);
        }
      }

      // Update weapon state from control system
      if (controlSystemRef.current) {
        const ws = weaponStateRef.current;
        ws.currentWeapon = controlSystemRef.current.getCurrentWeapon();
        ws.currentSubclass = controlSystemRef.current.getCurrentSubclass();
        ws.isCharging = controlSystemRef.current.isWeaponCharging();
        ws.chargeProgress = controlSystemRef.current.getChargeProgress();
        ws.isSwinging = controlSystemRef.current.isWeaponSwinging();
        ws.isSpinning = (controlSystemRef.current.isWeaponCharging() || controlSystemRef.current.isCrossentropyChargingActive() || controlSystemRef.current.isEntropicBoltActive()) && controlSystemRef.current.getCurrentWeapon() === WeaponType.SCYTHE;
        ws.swordComboStep = controlSystemRef.current.getSwordComboStep();
        ws.isSwordCharging = controlSystemRef.current.isChargeActive();
        ws.isDeflecting = controlSystemRef.current.isDeflectActive();
        ws.deflectShieldActive =
          controlSystemRef.current.isDeflectActive() ||
          controlSystemRef.current.isWraithGuardShieldActive() ||
          controlSystemRef.current.isColossusGuardShieldActive() ||
          controlSystemRef.current.isGuardComboShieldActive() ||
          controlSystemRef.current.isDashGuardShieldActive() ||
          controlSystemRef.current.isSabresPurpleGuardShieldActive();
        ws.deflectShieldDurationSec = controlSystemRef.current.getDeflectShieldDurationSec();
        ws.deflectShieldPaletteVariant = controlSystemRef.current.getAegisShieldPaletteVariant();
        ws.isBlockingDeflect = controlSystemRef.current.isBlockingDeflectActive();
        ws.isViperStingCharging = controlSystemRef.current.isViperStingChargingActive();
        ws.viperStingChargeProgress = controlSystemRef.current.getViperStingChargeProgress();
        ws.isBarrageCharging = controlSystemRef.current.isBarrageChargingActive();
        ws.barrageChargeProgress = controlSystemRef.current.getBarrageChargeProgress();
        ws.isCobraShotCharging = controlSystemRef.current.isCobraShotChargingActive();
        ws.cobraShotChargeProgress = controlSystemRef.current.getCobraShotChargeProgress();
        ws.isRejuvenatingShotCharging = controlSystemRef.current.isRejuvenatingShotChargingActive();
        ws.rejuvenatingShotChargeProgress = controlSystemRef.current.getRejuvenatingShotChargeProgress();
        ws.isSkyfalling = controlSystemRef.current.isSkyfallActive();
        ws.isBackstabbing = controlSystemRef.current.isBackstabActive();
        ws.isSundering = controlSystemRef.current.isSunderActive();
        ws.isCorruptedAuraActive = controlSystemRef.current.isCorruptedAuraActive();
        ws.isIcebeaming = controlSystemRef.current.isIcebeamActive();
        ws.tempestBurstShotSeq = controlSystemRef.current.getTempestBurstShotSeq();

        // Check for weapon changes and broadcast to other players
        const prevWeapon = prevWeaponRef.current;
        if (ws.currentWeapon !== prevWeapon.weapon ||
            ws.currentSubclass !== prevWeapon.subclass) {
          updatePlayerWeapon(
            ws.currentWeapon,
            ws.currentSubclass,
            selectedWeaponAspectRef.current,
          );
          prevWeaponRef.current = {
            weapon: ws.currentWeapon,
            subclass: ws.currentSubclass
          };
        }

        // Throttle React state updates — ref stays live every frame for weapons/HUD that
        // read weaponStateRef; React commits are for discrete visual edges only.
        const now = Date.now();
        if (
          now - lastWeaponStateUpdate.current > 100 &&
          weaponStateNeedsReactUpdate(lastCommittedWeaponStateRef.current, ws)
        ) {
          const snapshot = { ...ws, chargeDirection: ws.chargeDirection };
          setWeaponState(snapshot);
          lastCommittedWeaponStateRef.current = snapshot;
          lastWeaponStateUpdate.current = now;
        }

        // Broadcast animation state changes to other players (throttled to avoid spam)
        const animationNow = Date.now();
        if (animationNow - lastAnimationBroadcast.current > 100) { // Throttle to 10 times per second
          // Determine if scythe is spinning (IceBeam, Crossentropy, or Entropic Bolts)
          const isScytheSpinning = ws.isSpinning && ws.currentWeapon === WeaponType.SCYTHE;
          // Determine if sword is spinning during Charge
          const isSwordSpinning = ws.isSwordCharging;
          // Combine all spinning states
          const isSpinning = isScytheSpinning || isSwordSpinning;

          // Create the animation state object - only include weapon-specific fields for current weapon
          const animationStateToSend: any = {
            isCharging: ws.isCharging,
            chargeProgress: ws.chargeProgress,
            isSwinging: ws.isSwinging,
            isSpinning: isSpinning, // Broadcast spinning for scythe and sword charge
            isDeflecting: ws.isDeflecting,
            isSwordCharging: ws.isSwordCharging, // Broadcast sword charging state
            isViperStingCharging: ws.isViperStingCharging,
            viperStingChargeProgress: ws.viperStingChargeProgress,
            isBarrageCharging: ws.isBarrageCharging,
            barrageChargeProgress: ws.barrageChargeProgress,
            isCobraShotCharging: ws.isCobraShotCharging,
            cobraShotChargeProgress: ws.cobraShotChargeProgress,
            isRejuvenatingShotCharging: ws.isRejuvenatingShotCharging,
            rejuvenatingShotChargeProgress: ws.rejuvenatingShotChargeProgress,
            isBackstabbing: ws.isBackstabbing, // Broadcast backstab animation state
            // Add missing Runeblade animation states
            isSmiting: controlSystemRef.current?.isSmiteActive() || false,
            isColossusStriking: controlSystemRef.current?.isColossusStrikeActive() || false,
            isWindShearing: controlSystemRef.current?.isWindShearActive() || false,
            isWindShearCharging: controlSystemRef.current?.isWindShearChargingActive() || false,
            windShearChargeProgress: controlSystemRef.current?.getWindShearChargeProgress() || 0,
            isDeathGrasping: controlSystemRef.current?.isDeathGraspActive() || false,
            isWraithStriking: controlSystemRef.current?.isWraithStrikeActive() || false,
            isCorruptedAuraActive: controlSystemRef.current?.isCorruptedAuraActive() || false,
            isCrossentropyCharging: controlSystemRef.current?.isCrossentropyChargingActive() || false,
            isSummonTotemCharging: controlSystemRef.current?.isSummonTotemChargingActive() || false,
            crusaderBladeThemeActive: controlSystemRef.current?.isRunebladeCrusaderBuffActive() || false,
            titansGripBladeThemeActive: shouldApplyTitansGripTalent(talentLoadoutRef.current),
            psionicBladesBladeThemeActive: shouldApplyPsionicBladesTalent(talentLoadoutRef.current),
            deflectShieldActive: ws.deflectShieldActive,
            deflectShieldPaletteVariant: ws.deflectShieldPaletteVariant,
            deflectShieldDurationSec: ws.deflectShieldDurationSec,
            isRunebladeBlizzardActive: controlSystemRef.current?.isRunebladeBlizzardTalentActive() || false,
          };

          // Only include swordComboStep for weapons that actually use it (Sword and Runeblade)
          const currentWeapon = controlSystemRef.current?.getCurrentWeapon();
          if (currentWeapon === WeaponType.SWORD || currentWeapon === WeaponType.RUNEBLADE) {
            animationStateToSend.swordComboStep = ws.swordComboStep;
          }
          broadcastPlayerAnimationState(animationStateToSend);
          lastAnimationBroadcast.current = animationNow;
        }
      }

      // Throttle damage numbers update to prevent infinite re-renders (every 33ms for smooth animation)
      const damageNumbersNow = Date.now();
      if (damageNumbersNow - lastDamageNumbersUpdate.current > 33 && onDamageNumbersUpdate) {
        const combatSystem = engineRef.current.getWorld().getSystem(CombatSystem);
        if (combatSystem) {
          const newDamageNumbers = combatSystem.getDamageNumbers();
          // Same array identity from DamageNumberManager snapshot cache means no change
          if (lastEmittedDamageNumbersRef.current !== newDamageNumbers) {
            lastEmittedDamageNumbersRef.current = newDamageNumbers;
            onDamageNumbersUpdate(newDamageNumbers);
          }
          lastDamageNumbersUpdate.current = damageNumbersNow;
        }
      }

      // Bow / entropic bolt hit-feedback VFX — polled independently of damage-number HUD callback
      if (damageNumbersNow - lastImpactEffectsPoll.current > 33) {
        lastImpactEffectsPoll.current = damageNumbersNow;
        let addedImpacts = false;
        if (engineRef.current) {
          const combatSystem = engineRef.current.getWorld().getSystem(CombatSystem);
          if (combatSystem) {
            const newImpacts = combatSystem.getImpactEffects();
            if (newImpacts.length > 0) {
              combatFeedbackLayerRef.current?.addImpacts(newImpacts);
              addedImpacts = true;
              const relayed = newImpacts
                .filter((impact) => RELAYED_PLAYER_IMPACT_TYPES.has(impact.type))
                .map((impact) => {
                  const payload: Record<string, unknown> = {
                    id: impact.id,
                    type: impact.type,
                    position: { x: impact.position.x, y: impact.position.y, z: impact.position.z },
                    direction: { x: impact.direction.x, y: impact.direction.y, z: impact.direction.z },
                    timestamp: impact.timestamp,
                    ...(impact.colorVariant ? { colorVariant: impact.colorVariant } : {}),
                    ...(impact.weaponAspect ? { weaponAspect: impact.weaponAspect } : {}),
                    ...(impact.bladeSide ? { bladeSide: impact.bladeSide } : {}),
                  };
                  if (impact.type === 'psionic-blade-slice' && impact.enemyEntityId) {
                    const serverEnemyId = mapLocalEntityIdToServerEnemyId(
                      impact.enemyEntityId,
                      serverEnemyEntities.current,
                    );
                    if (!serverEnemyId) return null;
                    payload.enemyServerId = serverEnemyId;
                  }
                  return payload;
                })
                .filter((entry): entry is Record<string, unknown> => entry != null);
              if (relayed.length > 0) {
                broadcastPlayerEffect?.({ type: 'impact_fx', impacts: relayed });
              }
              combatSystem.clearConsumedImpacts();
            }
          }
        }
        if (combatFeedbackLayerRef.current?.flushPendingImpacts()) {
          addedImpacts = true;
        }
        if (addedImpacts) {
          combatFeedbackLayerRef.current?.mountImpacts();
        }
      }


      // Throttle camera update to prevent object reference changes (every 33ms for consistency)
      const cameraNow = Date.now();
      if (cameraNow - lastCameraUpdate.current > 33 && onCameraUpdate) {
        const prevCam = lastEmittedCameraRef.current;
        if (
          prevCam.camera !== camera ||
          prevCam.width !== state.size.width ||
          prevCam.height !== state.size.height
        ) {
          lastEmittedCameraRef.current = {
            camera,
            width: state.size.width,
            height: state.size.height,
          };
          onCameraUpdate(camera, state.size);
        }
        lastCameraUpdate.current = cameraNow;
      }

      // Log object pool and state batcher statistics periodically (every 5 seconds)
      const now = Date.now();
      if (now % 10000 < 16) { // Approximately every 5 seconds (accounting for frame rate)
        const poolStats = getPoolStats();
        const batcherStats = pvpStateBatcher.getStats();
      }

      // Throttle game state update to prevent infinite re-renders (every 100ms)
      const gameStateNow = Date.now();
      if (gameStateNow - lastGameStateUpdate.current > 100 && onGameStateUpdate && playerEntityRef.current !== null && engineRef.current && controlSystemRef.current) {
        const world = engineRef.current.getWorld();
        const actualPlayerEntity = world.getEntity(playerEntityRef.current);
        if (actualPlayerEntity) {
          const healthComponent = actualPlayerEntity.getComponent(Health);
          const shieldComponent = actualPlayerEntity.getComponent(Shield);
          const energyComponent = actualPlayerEntity.getComponent(Energy);
          if (healthComponent) {
            const gameState = {
              playerHealth: healthComponent.currentHealth,
              maxHealth: healthComponent.maxHealth,
              playerShield: shieldComponent ? shieldComponent.currentShield : 0,
              maxShield: shieldComponent ? shieldComponent.maxShield : 0,
              playerEnergy: energyComponent ? energyComponent.currentEnergy : 0,
              maxEnergy: energyComponent ? energyComponent.maxEnergy : 0,
              currentWeapon: controlSystemRef.current.getCurrentWeapon(),
              currentSubclass: controlSystemRef.current.getCurrentSubclass()
            };
            const prevGs = lastEmittedGameStateRef.current;
            if (
              !prevGs ||
              prevGs.playerHealth !== gameState.playerHealth ||
              prevGs.maxHealth !== gameState.maxHealth ||
              prevGs.playerShield !== gameState.playerShield ||
              prevGs.maxShield !== gameState.maxShield ||
              prevGs.playerEnergy !== gameState.playerEnergy ||
              prevGs.maxEnergy !== gameState.maxEnergy ||
              prevGs.currentWeapon !== gameState.currentWeapon ||
              prevGs.currentSubclass !== gameState.currentSubclass
            ) {
              lastEmittedGameStateRef.current = gameState;
              onGameStateUpdate(gameState);
            }

            const prevHealth = lastEmittedNetworkHealthRef.current;
            if (
              !prevHealth ||
              prevHealth.health !== healthComponent.currentHealth ||
              prevHealth.maxHealth !== healthComponent.maxHealth
            ) {
              updatePlayerHealth(healthComponent.currentHealth, healthComponent.maxHealth);
              lastEmittedNetworkHealthRef.current = {
                health: healthComponent.currentHealth,
                maxHealth: healthComponent.maxHealth,
              };
            }
            if (shieldComponent) {
              const prevShield = lastEmittedNetworkShieldRef.current;
              if (
                !prevShield ||
                prevShield.shield !== shieldComponent.currentShield ||
                prevShield.maxShield !== shieldComponent.maxShield
              ) {
                updatePlayerShield(socket?.id || '', shieldComponent.currentShield, shieldComponent.maxShield);
                lastEmittedNetworkShieldRef.current = {
                  shield: shieldComponent.currentShield,
                  maxShield: shieldComponent.maxShield,
                };
              }
            }
            if (energyComponent) {
              const prevEnergy = lastEmittedNetworkEnergyRef.current;
              if (
                !prevEnergy ||
                prevEnergy.energy !== energyComponent.currentEnergy ||
                prevEnergy.maxEnergy !== energyComponent.maxEnergy
              ) {
                updatePlayerEnergy(socket?.id || '', energyComponent.currentEnergy, energyComponent.maxEnergy);
                lastEmittedNetworkEnergyRef.current = {
                  energy: energyComponent.currentEnergy,
                  maxEnergy: energyComponent.maxEnergy,
                };
              }
            }
            lastGameStateUpdate.current = gameStateNow;
          }
        }
      }

      // Co-op: one-line proximity hint above HUD health bar
      const hi = onInteractHintChangeRef.current;
      if (hi && playerEntity && gameMode === 'coop' && buildModeRef.current === 'idle') {
        if (throneAbilityModalOpenRef.current || isChatOpenRef.current) {
          if (lastInteractHintRef.current !== null) {
            lastInteractHintRef.current = null;
            hi(null);
          }
        } else {
          const transformHint = playerEntity.getComponent(Transform);
          let nextHint: string | null = null;
          if (transformHint) {
            const px = transformHint.position.x;
            const pz = transformHint.position.z;
            const curHint = selectedWeaponsRef.current?.primary;

            if (inThroneRoom) {
              const rWeapon = THRONE_WEAPON_INTERACT_RADIUS;
              const rWeapon2 = rWeapon * rWeapon;
              const ax = THRONE_ABILITY_PEDESTAL_POSITION.x;
              const az = THRONE_ABILITY_PEDESTAL_POSITION.z;
              const adx = px - ax;
              const adz = pz - az;
              const ad2 = adx * adx + adz * adz;
              const rAb2 =
                THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS * THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS;
              const tx = THRONE_TALENT_PEDESTAL_POSITION.x;
              const tz = THRONE_TALENT_PEDESTAL_POSITION.z;
              const td2 = (px - tx) * (px - tx) + (pz - tz) * (pz - tz);

              let bestW: { weapon: WeaponType; d2: number } | null = null;
              for (const def of THRONE_WEAPON_INTERACT_DEFS) {
                const dx = px - def.x;
                const dz = pz - def.z;
                const d2 = dx * dx + dz * dz;
                if (d2 <= rWeapon2 && (!bestW || d2 < bestW.d2)) {
                  bestW = { weapon: def.weapon, d2 };
                }
              }

              let bestArchetypeH: { archetype: Archetype; d2: number } | null = null;
              const rArchetypeH = THRONE_ARCHETYPE_INTERACT_RADIUS;
              const rArchetype2H = rArchetypeH * rArchetypeH;
              for (const def of THRONE_ARCHETYPE_INTERACT_DEFS) {
                const dx = px - def.x;
                const dz = pz - def.z;
                const d2 = dx * dx + dz * dz;
                if (d2 <= rArchetype2H && (!bestArchetypeH || d2 < bestArchetypeH.d2)) {
                  bestArchetypeH = { archetype: def.archetype, d2 };
                }
              }

              const abilityInRangeH = COOP_DEV_LOCALHOST_FEATURES && ad2 <= rAb2;
              const talentInRangeH = COOP_DEV_LOCALHOST_FEATURES && td2 <= rAb2;
              const offerH = thronePortalOfferRef.current;
              const rVoid2H = voidPortalInteractRadius(THRONE_VOID_PORTAL_RADIUS) ** 2;
              const rExplore2H = voidPortalInteractRadius(THRONE_EXPLORE_PORTAL_RADIUS) ** 2;
              const rDefense2H = voidPortalInteractRadius(THRONE_DEFENSE_PORTAL_RADIUS) ** 2;
              const rDungeon2H = voidPortalInteractRadius(THRONE_DUNGEON_PORTAL_RADIUS) ** 2;
              const rSkyTemple2H = voidPortalInteractRadius(THRONE_SKY_TEMPLE_PORTAL_RADIUS) ** 2;
              const rPortal2H = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
              let portalCloseH = false;
              const curArchetypeHint = selectedArchetypeRef.current;
              if (
                !portalUseSentRef.current &&
                curHint !== undefined &&
                curHint !== WeaponType.NONE &&
                throneVoidPortalOpenRef.current
              ) {
                const edx = px - THRONE_EXPLORE_PORTAL_POSITION.x;
                const edz = pz - THRONE_EXPLORE_PORTAL_POSITION.z;
                const vdx = px - THRONE_VOID_PORTAL_POSITION.x;
                const vdz = pz - THRONE_VOID_PORTAL_POSITION.z;
                const ddx = px - THRONE_DEFENSE_PORTAL_POSITION.x;
                const ddz = pz - THRONE_DEFENSE_PORTAL_POSITION.z;
                const gdx = px - THRONE_DUNGEON_PORTAL_POSITION.x;
                const gdz = pz - THRONE_DUNGEON_PORTAL_POSITION.z;
                const sdx = px - THRONE_SKY_TEMPLE_PORTAL_POSITION.x;
                const sdz = pz - THRONE_SKY_TEMPLE_PORTAL_POSITION.z;
                portalCloseH =
                  vdx * vdx + vdz * vdz < rVoid2H
                  || edx * edx + edz * edz < rExplore2H
                  || ddx * ddx + ddz * ddz < rDefense2H
                  || gdx * gdx + gdz * gdz < rDungeon2H
                  || sdx * sdx + sdz * sdz < rSkyTemple2H;
              } else if (
                !portalUseSentRef.current &&
                curHint !== undefined &&
                curHint !== WeaponType.NONE &&
                curArchetypeHint !== ARCHETYPE_NONE
              ) {
                if (offerH.length >= 2) {
                  let bestD2h = Infinity;
                  for (const pos of THRONE_PORTAL_POSITIONS) {
                    const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                    if (d2 < bestD2h) bestD2h = d2;
                  }
                  portalCloseH = bestD2h < rPortal2H;
                } else if (offerH.length === 1) {
                  const d2 =
                    (px - THRONE_PORTAL_POSITION.x) * (px - THRONE_PORTAL_POSITION.x) +
                    (pz - THRONE_PORTAL_POSITION.z) * (pz - THRONE_PORTAL_POSITION.z);
                  portalCloseH = d2 < rPortal2H;
                }
              }

              const weaponInteractH = !!(
                bestW &&
                curHint !== undefined &&
                (bestW.weapon !== curHint ||
                  (bestW.weapon === curHint && canCycleWeaponAspectRef.current))
              );
              const archetypeInteractH = !!(
                bestArchetypeH &&
                bestArchetypeH.archetype !== curArchetypeHint
              );
              const abilityInteractH = !!(
                abilityInRangeH &&
                curHint !== undefined &&
                curHint !== WeaponType.NONE &&
                onRequestThroneAbilityModalRef.current
              );
              const talentInteractH = !!(
                talentInRangeH &&
                curHint !== undefined &&
                curHint !== WeaponType.NONE &&
                onRequestThroneTalentModalRef.current
              );

              if (weaponInteractH || archetypeInteractH || abilityInteractH || talentInteractH || portalCloseH) {
                nextHint = COOP_INTERACT_HINT_TEXT;
              }
            } else if (!inThroneRoom && combatArenaActiveRef.current) {
              const inIntroRoomHint = coopCurrentRoomKindRef.current === 'intro';
              const inFaeRealmRoomHint = coopCurrentRoomKindRef.current === 'fae_realm';
              const inSunkenRoomHint = coopCurrentRoomKindRef.current === 'sunken_temple';
              const inEternityRoomHint = coopCurrentRoomKindRef.current === 'eternity_palace';
              if (inFaeRealmRoomHint && coopFaeRealmPortalOpenRef.current) {
                const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                if (px * px + pz * pz < rPortal * rPortal) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              } else if (inIntroRoomHint && coopIntroFountainPhaseRef.current) {
                let recruitedHint = false;
                if (!coopIntroAllyChoiceMadeRef.current) {
                  const recruitKind = findNearestSelectableAllyCandidate(
                    px,
                    pz,
                    introAllyChoiceEncounterRef.current,
                  );
                  if (recruitKind) {
                    recruitedHint = true;
                    nextHint = getAllyRecruitHintLabel(recruitKind);
                  }
                }
                if (!recruitedHint) {
                  const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
                  if (!coopIntroFountainUsedRef.current && px * px + pz * pz < fountainR2) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  } else if (coopIntroFountainUsedRef.current) {
                    const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                    const r2 = rPortal * rPortal;
                    for (const pos of CASTLE_ROOM_CHOICE_PORTAL_POSITIONS) {
                      const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                      if (d2 < r2) {
                        nextHint = COOP_INTERACT_HINT_TEXT;
                        break;
                      }
                    }
                  }
                }
              } else if (inIntroRoomHint && coopIntroPortalOpenRef.current) {
                const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                if (px * px + pz * pz < rPortal * rPortal) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              } else if (inSunkenRoomHint && coopSunkenFountainPhaseRef.current) {
                const localPlayerId = socket?.id;
                const localHasClaimed =
                  !!localPlayerId
                  && coopSunkenLootClaimedPlayerIdsRef.current.includes(localPlayerId);
                if (!coopSunkenLootPhaseCompleteRef.current && !localHasClaimed) {
                  if (
                    isSunkenSentinelSelectable(
                      px,
                      pz,
                      sunkenSentinelEncounterRef.current,
                    )
                  ) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  }
                } else {
                  const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
                  if (!coopSunkenFountainUsedRef.current && px * px + pz * pz < fountainR2) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  } else if (coopSunkenFountainUsedRef.current) {
                    const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                    const r2 = rPortal * rPortal;
                    for (const pos of CASTLE_ROOM_CHOICE_PORTAL_POSITIONS) {
                      const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                      if (d2 < r2) {
                        nextHint = COOP_INTERACT_HINT_TEXT;
                        break;
                      }
                    }
                  }
                }
              } else if (inSunkenRoomHint && coopSunkenPortalOpenRef.current) {
                const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                if (px * px + pz * pz < rPortal * rPortal) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              } else if (inEternityRoomHint && coopEternityFountainPhaseRef.current) {
                const localPlayerId = socket?.id;
                const localHasClaimed =
                  !!localPlayerId
                  && coopEternityLootClaimedPlayerIdsRef.current.includes(localPlayerId);
                if (!coopEternityLootPhaseCompleteRef.current && !localHasClaimed) {
                  if (
                    isEternityPalaceLootSelectable(
                      px,
                      pz,
                      eternityPalaceEncounterRef.current,
                    )
                  ) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  }
                } else {
                  const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
                  if (!coopEternityFountainUsedRef.current && px * px + pz * pz < fountainR2) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  } else if (coopEternityFountainUsedRef.current) {
                    const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                    const r2 = rPortal * rPortal;
                    for (const pos of CASTLE_ROOM_CHOICE_PORTAL_POSITIONS) {
                      const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                      if (d2 < r2) {
                        nextHint = COOP_INTERACT_HINT_TEXT;
                        break;
                      }
                    }
                  }
                }
              } else if (inEternityRoomHint && coopEternityPortalOpenRef.current) {
                const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                if (px * px + pz * pz < rPortal * rPortal) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              } else if (
                coopCurrentRoomKindRef.current === 'eden'
                || (coopCurrentRoomKindRef.current === 'false_eden' && coopFalseEdenClearedRef.current)
              ) {
                const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
                if (!coopEdenFountainUsedRef.current && px * px + pz * pz < fountainR2) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                } else if (coopEdenFountainUsedRef.current) {
                  const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                  const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                  const dx = px - pos.x;
                  const dz = pz - pos.z;
                  if (dx * dx + dz * dz < rPortal * rPortal) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  }
                }
              } else if (
                coopCurrentRoomKindRef.current === 'defense'
                && coopDefenseFountainActiveRef.current
                && !coopDefenseFountainUsedRef.current
              ) {
                const fountainR2 = HEALING_FOUNTAIN_INTERACT_RADIUS * HEALING_FOUNTAIN_INTERACT_RADIUS;
                if (px * px + pz * pz < fountainR2) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              } else if (coopCurrentRoomKindRef.current === 'eden_finale') {
                const daisyR2 = EDEN_FINALE_DAISY_INTERACT_RADIUS * EDEN_FINALE_DAISY_INTERACT_RADIUS;
                if (px * px + pz * pz < daisyR2) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              } else if (
                coopCurrentRoomKindRef.current === 'delirium_gate'
                && coopMainArenaPortalPhaseRef.current === 'eden_exit'
              ) {
                const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                const dx = px - pos.x;
                const dz = pz - pos.z;
                if (dx * dx + dz * dz < rPortal * rPortal) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              } else if (
                coopCurrentRoomKindRef.current === 'erebus_gate'
                && coopMainArenaPortalPhaseRef.current === 'eden_exit'
              ) {
                const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                const dx = px - pos.x;
                const dz = pz - pos.z;
                if (dx * dx + dz * dz < rPortal * rPortal) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              } else if (
                coopCurrentRoomKindRef.current === 'dream_layer'
                && coopMainArenaPortalPhaseRef.current === 'eden_exit'
              ) {
                const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                const dx = px - pos.x;
                const dz = pz - pos.z;
                if (dx * dx + dz * dz < rPortal * rPortal) {
                  nextHint = COOP_INTERACT_HINT_TEXT;
                }
              }

              const pdx = px - MAIN_COMBAT_PEDESTAL_POSITION.x;
              const pdz = pz - MAIN_COMBAT_PEDESTAL_POSITION.z;
              const pedR = MAIN_COMBAT_PEDESTAL_INTERACT_RADIUS;
              if (coopCurrentRoomKindRef.current === 'merchant') {
                const rShop = MERCHANT_SHOP_INTERACT_RADIUS;
                const rShop2 = rShop * rShop;
                let bestShopHint: { slot: (typeof MERCHANT_SHOP_INTERACT_DEFS)[number]['slot']; d2: number } | null = null;
                for (const def of MERCHANT_SHOP_INTERACT_DEFS) {
                  const dx = px - def.x;
                  const dz = pz - def.z;
                  const d2 = dx * dx + dz * dz;
                  if (d2 <= rShop2 && (!bestShopHint || d2 < bestShopHint.d2)) {
                    bestShopHint = { slot: def.slot, d2 };
                  }
                }
                if (bestShopHint) {
                  nextHint = getMerchantShopHintLabel(
                    bestShopHint.slot,
                    merchantInventoryRef.current,
                    merchantPurchaseStateRef.current,
                  );
                } else if (
                  portalsUnlockedRef.current &&
                  !portalUseSentRef.current
                ) {
                  const phase = coopMainArenaPortalPhaseRef.current;
                  const offer = thronePortalOfferRef.current;
                  if (
                    (phase === 'pick_boss' || phase === 'pre_boss_merchant') &&
                    offer.length >= 1 &&
                    String(offer[0]).toLowerCase() === 'boss'
                  ) {
                    const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                    const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                    const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                    if (d2 < rPortal * rPortal) {
                      nextHint = COOP_INTERACT_HINT_TEXT;
                    }
                  }
                }
              } else if (coopCurrentRoomKindRef.current === 'dream_layer') {
                const rShop = DREAM_LAYER_SHOP_INTERACT_RADIUS;
                const rShop2 = rShop * rShop;
                let bestShopHint: { slot: (typeof DREAM_LAYER_SHOP_INTERACT_DEFS)[number]['slot']; d2: number } | null = null;
                for (const def of DREAM_LAYER_SHOP_INTERACT_DEFS) {
                  const dx = px - def.x;
                  const dz = pz - def.z;
                  const d2 = dx * dx + dz * dz;
                  if (d2 <= rShop2 && (!bestShopHint || d2 < bestShopHint.d2)) {
                    bestShopHint = { slot: def.slot, d2 };
                  }
                }
                if (bestShopHint) {
                  nextHint = getDreamLayerShopHintLabel(
                    bestShopHint.slot,
                    dreamLayerInventoryRef.current,
                  );
                } else if (
                  coopMainArenaPortalPhaseRef.current === 'eden_exit'
                  && coopEdenResumeKindRef.current
                ) {
                  const rPortal = VOID_PORTAL_INTERACT_RADIUS;
                  const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                  const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                  if (d2 < rPortal * rPortal) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  }
                }
              } else if (isExploreRef.current) {
                const localId = socket?.id ?? null;
                const barracksR2 = EXPLORE_BARRACKS_INTERACT_RADIUS * EXPLORE_BARRACKS_INTERACT_RADIUS;
                const researchR2 = EXPLORE_RESEARCH_INTERACT_RADIUS * EXPLORE_RESEARCH_INTERACT_RADIUS;
                const shrineR2 = EXPLORE_SHRINE_INTERACT_RADIUS * EXPLORE_SHRINE_INTERACT_RADIUS;
                const cathedralR2 = EXPLORE_CATHEDRAL_INTERACT_RADIUS * EXPLORE_CATHEDRAL_INTERACT_RADIUS;
                const obeliskR2 = EXPLORE_OBELISK_INTERACT_RADIUS * EXPLORE_OBELISK_INTERACT_RADIUS;
                const firePitR2 = EXPLORE_FIRE_PIT_INTERACT_RADIUS * EXPLORE_FIRE_PIT_INTERACT_RADIUS;
                type NearInteract = {
                  kind: 'barracks' | 'research' | 'shrine' | 'cathedral' | 'obelisk' | 'fire-pit';
                  distSq: number;
                  offer?: ExploreCathedralOfferEntry[];
                };
                let bestInteract: NearInteract | null = null;
                let nearUnpowered = false;
                for (const enemy of enemiesRef.current.values()) {
                  if (enemy.isDying || (enemy.health ?? 0) <= 0) continue;
                  const dx = px - enemy.position.x;
                  const dz = pz - enemy.position.z;
                  const distSq = dx * dx + dz * dz;
                  if (enemy.type === 'barracks') {
                    if (distSq > barracksR2) continue;
                    if (enemy.powered === false) {
                      nearUnpowered = true;
                      continue;
                    }
                    if (!bestInteract || distSq < bestInteract.distSq) {
                      bestInteract = { kind: 'barracks', distSq };
                    }
                    continue;
                  }
                  if (enemy.type === 'research-station') {
                    if (distSq > researchR2) continue;
                    if (enemy.powered === false) {
                      nearUnpowered = true;
                      continue;
                    }
                    if (!bestInteract || distSq < bestInteract.distSq) {
                      bestInteract = { kind: 'research', distSq };
                    }
                    continue;
                  }
                  if (enemy.type === 'shrine') {
                    if (distSq > shrineR2) continue;
                    if (enemy.powered === false) {
                      nearUnpowered = true;
                      continue;
                    }
                    if (enemy.shrineUsed) continue;
                    if (!bestInteract || distSq < bestInteract.distSq) {
                      bestInteract = { kind: 'shrine', distSq };
                    }
                    continue;
                  }
                  if (enemy.type === 'cathedral') {
                    if (distSq > cathedralR2) continue;
                    if (enemy.powered === false) {
                      nearUnpowered = true;
                      continue;
                    }
                    if (enemy.cathedralUsed) continue;
                    if (!bestInteract || distSq < bestInteract.distSq) {
                      const offer = Array.isArray(enemy.cathedralOffer) ? enemy.cathedralOffer : [];
                      bestInteract = { kind: 'cathedral', distSq, offer };
                    }
                    continue;
                  }
                  if (enemy.type === 'obelisk') {
                    if (distSq > obeliskR2) continue;
                    if (enemy.powered === false) {
                      nearUnpowered = true;
                      continue;
                    }
                    if (!bestInteract || distSq < bestInteract.distSq) {
                      bestInteract = { kind: 'obelisk', distSq };
                    }
                    continue;
                  }
                  if (enemy.type === 'fire-pit') {
                    if (distSq > firePitR2) continue;
                    if (!bestInteract || distSq < bestInteract.distSq) {
                      bestInteract = { kind: 'fire-pit', distSq };
                    }
                  }
                }
                const nearBarracks = bestInteract?.kind === 'barracks';
                const nearResearch = bestInteract?.kind === 'research';
                const nearShrine = bestInteract?.kind === 'shrine';
                const nearCathedral = bestInteract?.kind === 'cathedral';
                const nearObelisk = bestInteract?.kind === 'obelisk';
                const nearFirePit = bestInteract?.kind === 'fire-pit';
                nearBarracksRef.current = nearBarracks;
                nearResearchRef.current = nearResearch;
                nearShrineRef.current = nearShrine;
                nearCathedralRef.current = nearCathedral;
                nearCathedralOfferRef.current = nearCathedral ? (bestInteract?.offer ?? []) : [];
                nearObeliskRef.current = nearObelisk;
                nearFirePitRef.current = nearFirePit;
                onBarracksRecruitOpenChangeRef.current?.(nearBarracks);
                onResearchPanelOpenChangeRef.current?.(nearResearch);
                onShrinePanelOpenChangeRef.current?.(nearShrine);
                onCathedralPanelOpenChangeRef.current?.(nearCathedral, nearCathedral ? nearCathedralOfferRef.current : undefined);
                onObeliskPanelOpenChangeRef.current?.(nearObelisk);
                onFirePitHealOpenChangeRef.current?.(nearFirePit);
                if (nearBarracks) {
                  nextHint = 'Recruit an ancestor — press 1–5 or use the panel';
                } else if (nearShrine) {
                  nextHint = 'Choose a shrine gift — press 1–4 or use the panel';
                } else if (nearCathedral) {
                  nextHint = 'Choose a legendary — press 1–4 or use the panel';
                } else if (nearObelisk) {
                  nextHint = 'Buy a class talent — press 1–9 or use the panel';
                } else if (nearResearch) {
                  nextHint = 'Research upgrades — press 1–4 or use the panel';
                } else if (nearFirePit) {
                  nextHint = 'Cook at the fire — press 1–2 or use the panel';
                } else if (nearUnpowered) {
                  nextHint = 'Needs a nearby fire pit';
                } else {
                  const r2 = EXPLORE_CAMP_INTERACT_RADIUS * EXPLORE_CAMP_INTERACT_RADIUS;
                  let nearCamp = false;
                  for (const camp of exploreCampsRef.current) {
                    if (!camp.cleared) continue;
                    if (localId && camp.claimedBy.includes(localId)) continue;
                    const dx = px - camp.x;
                    const dz = pz - camp.z;
                    if (dx * dx + dz * dz <= r2) {
                      nearCamp = true;
                      break;
                    }
                  }
                  if (nearCamp) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  }
                }
              } else if (
                coopCurrentRoomKindRef.current === 'deep_sanctum' &&
                deepSanctumRewardKindRef.current &&
                pdx * pdx + pdz * pdz < pedR * pedR
              ) {
                nextHint = COOP_INTERACT_HINT_TEXT;
              } else if (
                !inIntroRoomHint &&
                coopCurrentRoomKindRef.current !== 'fae_realm' &&
                coopCurrentRoomKindRef.current !== 'eternity_palace' &&
                pedestalBoonReadyRef.current &&
                pdx * pdx + pdz * pdz < pedR * pedR
              ) {
                nextHint = COOP_INTERACT_HINT_TEXT;
              } else if (
                !inIntroRoomHint &&
                portalsUnlockedRef.current &&
                coopMainArenaPortalPhaseRef.current &&
                !portalUseSentRef.current
              ) {
                const rPortal = 2.9;
                const r2 = rPortal * rPortal;
                const offer = thronePortalOfferRef.current;
                const phase = coopMainArenaPortalPhaseRef.current;
                let portalClose = false;
                if (
                  (phase === 'pick_wave2' || phase === 'pick_pre_boss' || phase === 'pick_post_boss') &&
                  offer.length >= 2
                ) {
                  if (coopVoidPortalOfferedRef.current) {
                    const voidR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
                    if (px * px + pz * pz < voidR2) {
                      portalClose = true;
                    }
                  }
                  for (const pos of MAIN_COMBAT_CHOICE_PORTAL_POSITIONS) {
                    const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                    if (d2 < r2) {
                      portalClose = true;
                      break;
                    }
                  }
                } else if (phase === 'pick_sunken_entry') {
                  const voidR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
                  portalClose = px * px + pz * pz < voidR2;
                } else if (phase === 'pick_eternity_entry' || phase === 'pick_eternity_late_entry') {
                  const voidR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
                  portalClose = px * px + pz * pz < voidR2;
                } else if (phase === 'pick_trinity_finale') {
                  const voidR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
                  portalClose = px * px + pz * pz < voidR2;
                } else if (
                  (phase === 'pick_boss' || phase === 'pre_boss_merchant') &&
                  offer.length >= 1 &&
                  String(offer[0]).toLowerCase() === 'boss'
                ) {
                  const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                  const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                  const bossR2 = VOID_PORTAL_INTERACT_RADIUS * VOID_PORTAL_INTERACT_RADIUS;
                  portalClose = d2 < bossR2;
                }
                if (portalClose) nextHint = COOP_INTERACT_HINT_TEXT;
              }

              if (!nextHint && droppedItemsRef.current.size > 0) {
                const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
                const rPick2 = rPick * rPick;
                droppedItemsRef.current.forEach((item) => {
                  if (nextHint) return;
                  if (item.category !== 'boss_drop') return;
                  if (!canLocalPlayerAcquireBossDrop(item, inventorySnapshotRef.current)) return;
                  const dx = px - item.position.x;
                  const dz = pz - item.position.z;
                  if (dx * dx + dz * dz <= rPick2) {
                    nextHint = COOP_INTERACT_HINT_TEXT;
                  }
                });
              }
            }
          }

          if (nextHint !== lastInteractHintRef.current) {
            lastInteractHintRef.current = nextHint;
            hi(nextHint);
          }
        }
      }

      // Process pending summoned unit damage events
      const pendingDamage = (window as any).pendingSummonedUnitDamage;
      if (pendingDamage && pendingDamage.length > 0) {
        const combatSystem = engineRef.current?.getWorld().getSystem(CombatSystem);

        // Clear processed events
        (window as any).pendingSummonedUnitDamage = [];
      }

      // State updates are handled individually above
    }
  });

  // Initialize game setup after engine is ready
  useEffect(() => {
    if (!engineRef.current || !engineReady || !gameStarted || coopGameSetupInitializedRef.current) {
      if (!engineRef.current || !engineReady) {
        console.log('🔍 CoopGameScene: Waiting for engine to be ready...', {
          hasEngine: !!engineRef.current,
          engineReady,
        });
      }
      return;
    }

    coopGameSetupInitializedRef.current = true;
    // Create a PVP damage callback that maps local ECS entity IDs back to server player IDs
    const damagePlayerWithMapping = (entityId: string, damage: number, damageType?: string, isCritical?: boolean) => {
      // Find the server player ID that corresponds to this local ECS entity ID
      const numericEntityId = parseInt(entityId);
      let serverPlayerId: string | null = null;

      serverPlayerEntities.current.forEach((localEntityId, playerId) => {
        if (localEntityId === numericEntityId) {
          serverPlayerId = playerId;
        }
      });

      if (serverPlayerId) {
        broadcastPlayerDamage(serverPlayerId, damage, damageType, isCritical);
      }
    };

    // Store in ref for access from JSX
    damagePlayerCallbackRef.current = damagePlayerWithMapping;

    const exploreNow = isExploreRef.current;
    const localPlayerForSpawn =
      players.get(socket?.id || '') ?? contextPlayersRef.current.get(socket?.id || '');
    const spawnX = localPlayerForSpawn?.position.x ?? 0;
    const spawnZ = localPlayerForSpawn?.position.z ?? (exploreNow ? 0 : COOP_MAIN_DEFAULT_SPAWN_Z);
    const spawnY = exploreNow ? PORTAL_FALL_GROUND_Y : 0.5;
    const initialThroneMap = gameMode === 'coop' && !combatArenaActive;
    realTimePlayerPositionRef.current.set(spawnX, spawnY, spawnZ);

    const { player, controlSystem } = setupCoopGame(
      engineRef.current,
      scene,
      camera as PerspectiveCamera,
      gl,
      damagePlayerWithMapping,
      damageEnemy,
      initialWeaponsForEngineRef.current,
      skillPointData,
      cameraSystemRef,
      { initialSpawn: { x: spawnX, y: spawnY, z: spawnZ }, initialThroneMap },
    );

    realTimePlayerPositionRef.current.set(spawnX, spawnY, spawnZ);
    if (exploreNow) {
      const exploreFog3 = new FogExp2(SKY_INDIGO_NIGHT.horizon, 0.045);
      engineRef.current.getWorld().getSystem(RenderSystem)?.setFog(exploreFog3);
      scene.fog = exploreFog3;
      if (camera instanceof PerspectiveCamera) {
        camera.far = 600;
        camera.updateProjectionMatrix();
      }
      exploreFog.markExplored(spawnX, spawnZ, EXPLORE_PLAYER_VIEW_RADIUS);
    }

    // Set control system reference for damage calculations (needed for weapon passives)
    setControlSystem(controlSystem);

    // Pass control system to parent for UI cooldown updates
    if (onControlSystemUpdate) {
      onControlSystemUpdate(controlSystem);
    }

    // Set up PVP callbacks (AFTER playerEntity is set)
    controlSystem.setBowReleaseCallback((finalProgress, isPerfectShot) => {
      // NOTE: Projectile broadcasting is now handled by setProjectileCreatedCallback
      // This callback only handles visual effects to avoid duplicate damage

      // Trigger perfect shot visual effect if it was a perfect shot
      if (isPerfectShot) {

        // Get current player position from the engine
        const currentPlayerEntity = engineRef.current?.getWorld().getEntity(playerEntityRef.current!);
        if (currentPlayerEntity) {
          const transform = currentPlayerEntity.getComponent(Transform);
          if (transform) {
            // Get camera direction for effect direction
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();

            // Match ControlSystem.fireProjectile / createPerfectShotProjectile (30° down, spawn offset).
            const compensationAngle = Math.PI / 6;
            const cameraRight = new Vector3();
            cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
            const rotationMatrix = new Matrix4();
            rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
            direction.applyMatrix4(rotationMatrix);
            direction.normalize();

            const aimDir = direction.clone();
            const spawnBase = transform.position.clone().add(aimDir.clone().multiplyScalar(1));
            spawnBase.y += 1.0;

            const sub = controlSystem.getCurrentSubclass();
            const arcticStingBeam =
              shouldApplyArcticStingTalent(talentLoadout);
            const highCaliberPerfectBeam = shouldApplyHighCaliberTalent(talentLoadout);
            if (controlSystem.shouldApplyDualCoilForBow()) {
              const d = getDualCoilLateralVector(direction);
              createPowershotEffect(
                spawnBase.clone().add(d),
                direction,
                sub,
                true,
                true,
                arcticStingBeam,
                highCaliberPerfectBeam,
              );
              createPowershotEffect(
                spawnBase.clone().sub(d),
                direction,
                sub,
                true,
                true,
                arcticStingBeam,
                highCaliberPerfectBeam,
              );
            } else {
              createPowershotEffect(
                spawnBase,
                direction,
                sub,
                true,
                true,
                arcticStingBeam,
                highCaliberPerfectBeam,
              );
            }
          }
        }
      }
    });


    // Set up Viper Sting callback
    controlSystem.setViperStingCallback((position, direction, meta) => {
      broadcastPlayerAbility('viper_sting', position, direction, undefined, meta);
    });

    // Set up Barrage callback
    controlSystem.setBarrageCallback((position, direction) => {
      broadcastPlayerAbility('barrage', position, direction);
    });

    controlSystem.setOnLocalStaggerLightningCallback((position) => {
      spawnDeathdealerStaggerLightning(position);
    });

    // Set up Frost Nova callback
    controlSystem.setFrostNovaCallback((position, direction) => {
      broadcastPlayerAbility('frost_nova', position, direction);
    });

    controlSystem.setDeflectCallback((position, direction, extra) => {
      broadcastPlayerAbility('deflect', position, direction, undefined, extra);
    });

    controlSystem.setDeflectShiftCallback((position, direction) => {
      broadcastPlayerAbility('deflectShift', position, direction);
    });

    controlSystem.setLocustSpawnCallback((payload) => {
      spawnLocustProjectileRef.current(payload);
    });

    controlSystem.setPrimeMateriaStartCallback(() => {
      if (socket && currentRoomId) {
        socket.emit('prime-materia-start', { roomId: currentRoomId });
      }
    });

    controlSystem.setPrimeMateriaStopCallback(() => {
      if (socket && currentRoomId) {
        socket.emit('prime-materia-stop', { roomId: currentRoomId });
      }
    });

    controlSystem.setIncinerationDetonateCallback((payload) => {
      detonateIncinerationRef.current(payload);
    });

    controlSystem.setRoomBoomDashCallback((payload) => {
      handleRoomBoomDashRef.current(payload);
    });

    controlSystem.setBloodOrbDashCallback(() => {
      tryBloodOrbDashCostRef.current();
    });

    // Set up Summon Totem callback
    controlSystem.setSummonTotemCallback((position) => {
      const totemBoltVariant = getTotemBoltVariantFromTalentLoadout(talentLoadoutRef.current);
      const superconductor = shouldApplySuperconductorTalent(
        talentLoadoutRef.current,
        abilityLoadoutRef.current,
      );
      const casterAspect = selectedWeaponAspectRef.current;
      const summonTotemExtraData =
        totemBoltVariant != null || superconductor || casterAspect != null
          ? {
              ...(totemBoltVariant != null ? { totemBoltVariant } : {}),
              ...(superconductor ? { superconductor } : {}),
              ...(casterAspect != null ? { weaponAspect: casterAspect } : {}),
            }
          : undefined;
      broadcastPlayerAbility(
        'summon_totem',
        position,
        undefined,
        undefined,
        summonTotemExtraData,
      );

      if (socket?.id && (window as any).triggerGlobalSummonTotem) {
        (window as any).triggerGlobalSummonTotem(
          position,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          socket.id,
          totemBoltVariant,
          superconductor,
          undefined,
          casterAspect,
        );
      }
    });



    // Set up Cobra Shot callback (for local visual effects only - projectile is handled via onProjectileCreatedCallback)
    controlSystem.setCobraShotCallback((position, direction) => {
      // Don't broadcast as ability - the projectile is already broadcast via onProjectileCreatedCallback
    });

    // Set up Charge callback
    controlSystem.setChargeCallback((position, direction) => {
      // Store charge direction for trail effect
      setWeaponState(prev => ({
        ...prev,
        chargeDirection: direction.clone()
      }));
      // Broadcast as ability for state management
      broadcastPlayerAbility('charge', position, direction);
      // Also broadcast as attack for animation
      broadcastPlayerAttack('sword_charge_start', position, direction, {
        isSwordCharging: true,
        storedCharge: shouldApplyCycloneRushChargeSpin(talentLoadoutRef.current),
      });
    });



    // Set up Skyfall callback
    controlSystem.setSkyfallCallback((position, direction) => {
      broadcastPlayerAbility('skyfall', position, direction);
    });

    // Set up Rejuvenating Shot callback
    controlSystem.setRejuvenatingShotCallback((position, direction) => {
      broadcastPlayerAbility('rejuvenating_shot', position, direction);
    });

    // Set up Throw Spear callback
    controlSystem.setThrowSpearCallback((position, direction, chargeTime) => {
      // Trigger local visual effect
      triggerGlobalThrowSpear(position, direction, chargeTime);
      // Broadcast to other players
      broadcastPlayerAbility('throw_spear', position, direction, undefined, { chargeTime });
    });

    // Set up Backstab callback
    controlSystem.setBackstabCallback((position, direction, damage, isBackstab) => {
      const vorpalGust = shouldApplyVorpalGustTalent(talentLoadoutRef.current);
      const stabTheme = getVorpalGustStabBoonBeamTheme(talentLoadoutRef.current);
      broadcastPlayerAbility('backstab', position, direction, undefined, {
        vorpalGust,
        ...(vorpalGust && stabTheme !== 'default' ? { vorpalGustTheme: stabTheme } : {}),
      });
      // Note: Animation state is now broadcasted automatically in the game loop
    });

    // Set up Sunder callback
    controlSystem.setSunderCallback((position, direction, damage, stackCount) => {
      broadcastPlayerAbility('sunder', position, direction);
      // Note: Animation state is now broadcasted automatically in the game loop
    });

    // Set up SabreReaperMistEffect callback for Stealth ability
    controlSystem.setCreateSabreMistEffectCallback((position: Vector3) => {

      const effectId = `mist_${Date.now()}_${Math.random()}`;
      const newEffect = {
        id: effectId,
        position: position.clone(),
        startTime: Date.now()
      };

      groundHazardLayerRef.current?.addMistEffect(newEffect);

      setTimeout(() => {
        groundHazardLayerRef.current?.removeMistEffect(effectId);
      }, 1000);
    });

    // Set up broadcast callback for Sabre Reaper Mist effects
    controlSystem.setBroadcastSabreMistCallback((position: Vector3, effectType: 'stealth' | 'skyfall') => {
      if (broadcastPlayerEffect) {
        broadcastPlayerEffect({
          type: 'mist',
          effectType,
          position: { x: position.x, y: position.y, z: position.z },
          duration: 1000
        });
      }
    });

    controlSystem.setArcticGroundBlizzardCallback((position: Vector3) => {
      broadcastPlayerEffect?.({
        type: 'arctic_sting_blizzard',
        position: { x: position.x, y: position.y, z: position.z },
      });
    });

    // Set up callback for creating local debuff effects
    controlSystem.setCreateLocalDebuffCallback((playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', position: Vector3, duration: number) => {
      createPvpDebuffEffect(playerId, debuffType, position, duration);
    });

    // Set up Debuff callback for broadcasting freeze/slow effects
    controlSystem.setDebuffCallback((targetEntityId: number, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', duration: number, position: Vector3) => {

      // Find the server player ID that corresponds to this local ECS entity ID
      let targetPlayerId: string | null = null;
      serverPlayerEntities.current.forEach((localEntityId, playerId) => {
        if (localEntityId === targetEntityId) {
          targetPlayerId = playerId;
        }
      });

      if (targetPlayerId && broadcastPlayerDebuff) {
        broadcastPlayerDebuff(targetPlayerId, debuffType, duration, {
          position: { x: position.x, y: position.y, z: position.z }
        });
      }
    });

    // Set up enemy status effect callback for co-op mode
    controlSystem.setApplyEnemyStatusEffectCallback((
      enemyId: string,
      effectType: string,
      duration: number,
      options?: { source?: 'titans_grip' },
    ) => {
      if (applyStatusEffect) {
        applyStatusEffect(enemyId, effectType, duration, options);
      }
    });

    // Set up multiplayer context reference for ControlSystem stealth broadcasting
    (window as any).multiplayerContext = {
      broadcastPlayerStealth,
      broadcastPlayerDamage,
      broadcastPlayerHealing,
      broadcastPlayerKnockback
    };

    // Set up global control system reference for tower targeting
    (window as any).controlSystemRef = controlSystemRef;

    // Set up projectile creation callback
    controlSystem.setProjectileCreatedCallback((projectileType, position, direction, config) => {
      const animationData: any = {};

      // Add charge progress for bow projectiles
      if (projectileType.includes('arrow') || projectileType.includes('bolt')) {
        animationData.chargeProgress = controlSystem.getChargeProgress();
      }

      // Add projectile config data for special effects (like Cryoflame)
      animationData.projectileConfig = config;

      if (
        projectileType === 'perfect_shot' &&
        shouldApplyHighCaliberTalent(talentLoadoutRef.current)
      ) {
        animationData.highCaliberPerfectBeam = true;
      }

      broadcastPlayerAttack(projectileType, position, direction, animationData);
    });

    const projectileSystemForBroadcast =
      engineRef.current.getWorld().getSystem(ProjectileSystem) ?? null;
    if (projectileSystemForBroadcast) {
      projectileSystemForBroadcast.setCrossentropyBoltBroadcastCallback((position, direction, projectileConfig) => {
        const animationData: BroadcastPlayerAttackAnimationData = { projectileConfig };
        // Includes FRAGMENTATION child bolts so peers see ricochets when the shooter proc succeeds.
        broadcastPlayerAttack('crossentropy_bolt', position, direction, animationData);
      });
      projectileSystemForBroadcast.setEntropicBoltBroadcastCallback((position, direction, projectileConfig) => {
        const animationData: BroadcastPlayerAttackAnimationData = { projectileConfig };
        broadcastPlayerAttack('entropic_bolt', position, direction, animationData);
      });
    }

    // Melee attack sounds are now handled through animation state broadcasting only

    // Set up Reanimate callback
    controlSystem.setReanimateCallback(() => {
      if (reanimateRef.current) {
        reanimateRef.current.triggerHealingEffect();
      }

      // Broadcast Reanimate ability to other players
      if (player) {
        const transform = player.getComponent(Transform);
        if (transform) {
          const direction = new Vector3();
          camera.getWorldDirection(direction);
          direction.normalize();

          broadcastPlayerAbility('reanimate', transform.position, direction);

          // Broadcast Reanimate healing to ALL nearby players (within 5 units)
          // The server will determine which players are within range and heal them
          if (socket && currentRoomId) {
            socket.emit('heal-nearby-allies', {
              roomId: currentRoomId,
              healAmount: REANIMATE_SUNWELL_HEAL,
              abilityType: 'reanimate',
              position: {
                x: transform.position.x,
                y: transform.position.y,
                z: transform.position.z
              },
              radius: 5.0 // 5 units radius
            });
          }
        }
      }
    });

    // Set up Smite callback
    controlSystem.setSmiteCallback((
      position: Vector3,
      direction: Vector3,
      onDamageDealt?: (totalDamage: number, meta?: { targetsHit: number }) => void,
      meta?: { extraStrikes?: Array<{ position: Vector3; delaySec: number }> },
    ) => {
      const infestedSmite = shouldApplyInfestedSmiteTalent(
        talentLoadoutRef.current,
        abilityLoadoutRef.current,
      );
      const staggeringSmite = shouldApplyStaggeringSmiteTalent(
        talentLoadoutRef.current,
        abilityLoadoutRef.current,
      );
      const infernalSmite = shouldApplyInfernalSmiteTalent(
        talentLoadoutRef.current,
        abilityLoadoutRef.current,
      );
      const vengeanceSmite = shouldApplyVengeanceSmiteTalent(
        talentLoadoutRef.current,
        abilityLoadoutRef.current,
      );
      const smiteAspect = selectedWeaponAspectRef.current;
      const strikes: Array<{ pos: Vector3; delaySec: number }> = [
        { pos: position.clone(), delaySec: 0 },
        ...(meta?.extraStrikes?.map((s) => ({ pos: s.position.clone(), delaySec: s.delaySec })) ?? []),
      ];
      for (const s of strikes) {
        createPvpSmiteEffect(socket?.id || '', s.pos, onDamageDealt, {
          sequenceDelaySec: s.delaySec,
          infestedSmite,
          staggeringSmite,
          infernalSmite,
          vengeanceSmite,
          weaponAspect: smiteAspect,
        });
      }

      broadcastPlayerAbility('smite', position, direction, undefined, {
        infestedSmite,
        staggeringSmite,
        infernalSmite,
        vengeanceSmite,
        weaponAspect: smiteAspect,
        trinityExtras: meta?.extraStrikes?.map((s) => ({
          position: { x: s.position.x, y: s.position.y, z: s.position.z },
          delaySec: s.delaySec,
        })),
      });
    });

    // Set up Flurry healing effect callback
    controlSystem.setFlurryHealingEffectCallback((position: Vector3) => {
      triggerFlurryHealingEffect(position);
      broadcastPlayerEffect?.({
        type: 'flurry_healing',
        position: { x: position.x, y: position.y, z: position.z },
      });
    });

    // Set up damage numbers callback for healing effects
    controlSystem.setDamageNumbersCallback((damageNumbers) => {
      if (onDamageNumbersUpdate) {
        onDamageNumbersUpdate(damageNumbers);
      }
    });

    controlSystem.setWraithStrikeSlashImpactCallback((enemyPosition, forwardXZ, meta) => {
      wraithStrikeSlashImpactQueueRef.current?.(enemyPosition, forwardXZ, meta);
    });

    // Incoming damage display is now handled directly in handlePlayerDamaged to avoid R3F issues

    // Set up healing broadcast callback for PVP and co-op
    controlSystem.setBroadcastHealingCallback((healingAmount, healingType, position, targetPlayerId) => {
      broadcastPlayerHealing(healingAmount, healingType, position, targetPlayerId);
    });

    // Set up Colossus Strike callback
    controlSystem.setColossusStrikeCallback((position: Vector3, direction: Vector3, damage: number, onDamageDealt?: (damageDealt: boolean) => void) => {
      // Create local Colossus Strike effect with damage
      createPvpColossusStrikeEffect(socket?.id || '', position, damage, onDamageDealt);

      // Broadcast Colossus Strike ability to other players
      broadcastPlayerAbility('colossusStrike', position, direction, undefined, { damage });
    });

    // Set up Lightning Storm callback
    controlSystem.setLightningStormCallback((position: Vector3) => {
      const lightningRange = 10;
      const hasValidTargets = Array.from(enemiesRef.current.values()).some(enemy => {
        if (enemy.isDying || enemy.health <= 0) return false;
        if (enemy.alliedUnit === true || enemy.type === 'allied-knight' ||
            enemy.type === 'allied-huntress' ||
            enemy.type === 'allied-phantom' ||
            enemy.type === 'allied-demon' ||
            enemy.type === 'allied-enchantress' ||
            enemy.type === 'allied-healer' ||
            enemy.type === 'allied-tiger' ||
            enemy.type === 'allied-wolf' ||
            enemy.type === 'allied-bear' ||
            enemy.type === 'allied-serpent' ||
            enemy.type === 'allied-spider' ||
            enemy.type === 'player-zombie' || enemy.type === 'vengeful-spirit') return false;
        const ePos = new Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
        return ePos.distanceTo(position) <= lightningRange;
      });

      if (!hasValidTargets) return;

      window.audioSystem?.playLightningBoltSound(position);

      const boltDamage = getLightningBoltRoomDamage(
        controlSystemRef.current?.getAllocatedPlayerStats() ?? effectiveCombatStats,
        talentLoadoutRef.current,
        abilityLoadoutRef.current,
      );
      createLightningStormEffect(socket?.id || '', position, boltDamage);
      broadcastPlayerAbility('lightningStorm', position, new Vector3(0, 0, 1), undefined, { damage: boltDamage });
    });

    // Set up Wind Shear callback
    controlSystem.setWindShearCallback((position: Vector3, direction: Vector3) => {
      // Create local Wind Shear projectile effect
      createPvpWindShearEffect(socket?.id || '', position, direction);

      // Broadcast Wind Shear ability to other players
      broadcastPlayerAbility('windShear', position, direction);
    });

    // Set the local socket ID for the control system
    if (socket?.id) {
      controlSystem.setLocalSocketId(socket.id);
    }

    // Set up WindShear Tornado callback
    controlSystem.setWindShearTornadoCallback((playerId: string, duration: number) => {
      // Create local tornado effect
      createPvpWindShearTornadoEffect(playerId, duration);

      // Always broadcast tornado effect to other players when windshear is used
      if (socket?.id) {
        // Get current player position for broadcasting (should be local player position)
        const localPlayer = players.get(socket.id);
        if (localPlayer) {
          broadcastPlayerTornadoEffect(socket.id, {
            x: localPlayer.position.x,
            y: localPlayer.position.y,
            z: localPlayer.position.z
          }, duration);
        }
      }
    });

    // Set up Whirlwind Radial Wave callback
    controlSystem.setWhirlwindRadialWaveCallback((playerId: string, duration: number) => {
      // Create local radial wave effect
      createPvpWhirlwindRadialWaveEffect(playerId, duration);
      broadcastPlayerEffect?.({
        type: 'whirlwind_radial_wave',
        duration,
      });
    });

    // Set up DeathGrasp callback
    controlSystem.setDeathGraspCallback((position: Vector3, direction: Vector3) => {

      // Create local DeathGrasp projectile effect
      createPvpDeathGraspEffect(socket?.id || '', position, direction);

      // Broadcast DeathGrasp ability to other players
      broadcastPlayerAbility('deathgrasp', position, direction);
    });

    // Set up WraithStrike callback
    controlSystem.setWraithStrikeCallback((position: Vector3, direction: Vector3, meta) => {
      const breathWeapon = !!meta?.breathWeapon && shouldApplyBreathWeaponTalent(
        talentLoadoutRef.current,
        abilityLoadoutRef.current,
      );
      if (breathWeapon) {
        createBreathWeaponEffect(position, direction, {
          wrathfulStrike: meta?.wrathfulStrike,
          infestedStrike: meta?.infestedStrike,
          staggeringStrike: meta?.staggeringStrike,
          wraithGuard: meta?.wraithGuard,
        });
      }

      // Broadcast WraithStrike ability to other players (extraData: Wrathful Strike for synced VFX tint)
      broadcastPlayerAbility('wraith_strike', position, direction, undefined, {
        wrathfulStrike: !!meta?.wrathfulStrike,
        infestedStrike: !!meta?.infestedStrike,
        staggeringStrike: !!meta?.staggeringStrike,
        wraithGuard: !!meta?.wraithGuard,
        breathWeapon,
      });
    });

    // Set up Haunted Soul Effect callback (for WraithStrike)
    controlSystem.setHauntedSoulEffectCallback((position: Vector3, wrathfulStrike?: boolean, infestedStrike?: boolean) => {
      createPvpHauntedSoulEffect(position, wrathfulStrike, infestedStrike);
    });


    // Update player entity with correct socket ID for team validation
    if (socket?.id) {
      player.userData = player.userData || {};
      player.userData.playerId = socket.id;
    }

    setPlayerEntity(player);
    playerEntityRef.current = player.id;
    controlSystemRef.current = controlSystem;

    // Apply loadout immediately if it was selected before the engine was ready
    if (abilityLoadout) {
      controlSystem.setAbilityLoadout(abilityLoadout);
    }
    if (talentLoadout) {
      controlSystem.setTalentLoadout(talentLoadout);
    }
    controlSystem.setWeaponAspect(
      normalizeWeaponAspect(
        selectedWeaponAspectRef.current,
        controlSystem.getCurrentWeapon?.() ?? WeaponType.RUNEBLADE,
      ),
    );

    // Cleanup function
    return () => {
      coopGameSetupInitializedRef.current = false;
      projectileSystemForBroadcast?.setCrossentropyBoltBroadcastCallback(undefined);
      projectileSystemForBroadcast?.setEntropicBoltBroadcastCallback(undefined);
      controlSystemRef.current?.dispose();
      cameraSystemRef.current?.dispose();
      setPlayerEntity(null);
      playerEntityRef.current = null;
      controlSystemRef.current = null;
      cameraSystemRef.current = null;
    };
  }, [engineReady, socket?.id, gameStarted]);

  // `setupCoopGame` only runs once when the engine becomes ready. If that happens before the socket
  // has `currentRoomId`, the captured `damageEnemy` would never emit — keep the CombatSystem callback fresh.
  useEffect(() => {
    if (!engineRef.current || !engineReady) return;
    const combatSystem = engineRef.current.getWorld().getSystem(CombatSystem);
    if (!combatSystem) return;
    combatSystem.setEnemyDamageCallback(
      (
        enemyId: string,
        damage: number,
        sourcePlayerId?: string,
        meta?: EnemyDamageMeta,
        hitWorldPosition?: { x: number; y: number; z: number },
      ) => {
        if (meta?.damageType !== 'blizzard' && meta?.damageType !== 'icebeam') {
          if (meta?.damageType === 'crossentropy') {
            (window as any).audioSystem?.playCrossentropyImpactSound();
          } else {
            (window as any).audioSystem?.playUIHitboxSound(undefined, damage, hitWorldPosition);
          }
        }
        damageEnemy(enemyId, damage, sourcePlayerId, meta);
      },
    );
    combatSystem.setMushroomDamageCallback((index, damage, sourcePlayerId) => {
      // Mirror the blockLocalDamageDuringCoopPortal guard used for enemy hits.
      if (coopTransitionOverlayRef.current) return;
      damageMushroom(index, damage, sourcePlayerId ?? socket?.id);
    });
    combatSystem.setTreeDamageCallback((index, damage, sourcePlayerId) => {
      if (coopTransitionOverlayRef.current) return;
      damageTree(index, damage, sourcePlayerId ?? socket?.id);
    });
    combatSystem.setRootDamageCallback((index, damage, sourcePlayerId) => {
      if (coopTransitionOverlayRef.current) return;
      damageRoot(index, damage, sourcePlayerId ?? socket?.id);
    });
    combatSystem.setRockDamageCallback((index, damage, sourcePlayerId) => {
      if (coopTransitionOverlayRef.current) return;
      damageRock(index, damage, sourcePlayerId ?? socket?.id);
    });
    combatSystem.setSpineDamageCallback((index, damage, sourcePlayerId) => {
      if (coopTransitionOverlayRef.current) return;
      damageSpine(index, damage, sourcePlayerId ?? socket?.id);
    });
  }, [damageEnemy, damageMushroom, damageTree, damageRoot, damageRock, damageSpine, engineReady, socket?.id]);

  // Keep ECS weapon selection / level in sync when React state changes (e.g. throne room X-to-swap).
  useEffect(() => {
    if (!controlSystemRef.current) return;
    const sw = selectedWeapons ?? initialWeaponsForEngineRef.current;
    const pl =
      getRuneCountForWeapon(sw.primary, playerLevel) +
      getRuneCountForWeapon(sw.secondary, playerLevel);
    controlSystemRef.current.setSelectedWeapons(sw);
    controlSystemRef.current.setWeaponLevel(pl);
  }, [selectedWeapons, playerLevel]);

  useEffect(() => {
    if (!controlSystemRef.current) return;
    controlSystemRef.current.setUseArchetypeShiftRouting(gameMode === 'coop');
    controlSystemRef.current.setPlayerArchetype(selectedArchetype ?? ARCHETYPE_NONE);
  }, [gameMode, selectedArchetype, engineReady]);

  // Sync throne weapon aspect → ControlSystem (Runeblade fire rate / R ability)
  useEffect(() => {
    if (!controlSystemRef.current) return;
    const weapon =
      controlSystemRef.current.getCurrentWeapon?.() ??
      selectedWeapons?.primary ??
      WeaponType.NONE;
    controlSystemRef.current.setWeaponAspect(
      normalizeWeaponAspect(selectedWeaponAspect, weapon),
      weapon,
    );
    applyPlayerMaxDashCharges();
  }, [selectedWeaponAspect, selectedWeapons?.primary, engineReady, applyPlayerMaxDashCharges]);

  // Sync skill point data with control system when it changes
  useEffect(() => {
    if (controlSystemRef.current && skillPointData) {
      controlSystemRef.current.setSkillPointData(skillPointData);
    }
  }, [skillPointData]);

  useEffect(() => {
    setFrostShatterSpikeBroadcaster((position) => {
      broadcastPlayerEffect?.({
        type: 'frost_shatter',
        position: { x: position.x, y: position.y, z: position.z },
      });
    });
    return () => setFrostShatterSpikeBroadcaster(null);
  }, [broadcastPlayerEffect]);

  // Sync ability loadout with control system when it changes or when the engine becomes ready
  useEffect(() => {
    if (controlSystemRef.current && abilityLoadout) {
      controlSystemRef.current.setAbilityLoadout(abilityLoadout);
    }
  }, [abilityLoadout, engineReady]);

  useEffect(() => {
    if (controlSystemRef.current && talentLoadout) {
      controlSystemRef.current.setTalentLoadout(talentLoadout);
    }
  }, [talentLoadout, engineReady]);

  useEffect(() => {
    const onTalentLoadoutPicked = (event: Event) => {
      const detail = (event as CustomEvent<TalentLoadout>).detail;
      if (!detail || !controlSystemRef.current) return;
      controlSystemRef.current.setTalentLoadout(normalizeTalentLoadout(detail));
    };
    window.addEventListener('coop-talent-loadout-picked', onTalentLoadoutPicked);
    return () => window.removeEventListener('coop-talent-loadout-picked', onTalentLoadoutPicked);
  }, []);

  useEffect(() => {
    return () => {
      stopLocalRunebladeWhirlwind();
      remotePlayerWhirlwindStartTimeoutsRef.current.forEach((pending) => clearTimeout(pending));
      remotePlayerWhirlwindStartTimeoutsRef.current.clear();
      remotePlayerWhirlwindFailsafeTimeoutsRef.current.forEach((failsafe) => clearTimeout(failsafe));
      remotePlayerWhirlwindFailsafeTimeoutsRef.current.clear();
      remotePlayerWhirlwindInstancesRef.current.forEach((instance) => {
        window.audioSystem?.stopRunebladeWhirlwindSound?.(instance);
      });
      remotePlayerWhirlwindInstancesRef.current.clear();
    };
  }, [stopLocalRunebladeWhirlwind]);

  React.useEffect(() => {
    if (!controlSystemRef.current || !statPointData || !engineReady) return;
    controlSystemRef.current.setAllocatedPlayerStats(effectiveCombatStats);
  }, [engineReady, statPointData, effectiveCombatStats]);

  // Expose damage number completion handler for parent component
  useEffect(() => {
    if (onDamageNumberComplete) {
      (window as any).handleDamageNumberComplete = (id: string) => {
        const combatSystem = engineRef.current?.getWorld().getSystem(CombatSystem);
        if (combatSystem) {
          combatSystem.removeDamageNumber(id);
        }
      };
    }
    return () => {
      delete (window as any).handleDamageNumberComplete;
    };
  }, [onDamageNumberComplete]);

  return (
    <>
      <RenderPerfHelpers />
      <DevPerformanceCollector />
      <WebGLResilienceMonitor />
      <CoopSceneContentProfiler>
      <DynamicLightPool />
      {shaderWarmupActive && <ShaderWarmup />}
      {/* Don't render game world if game hasn't started */}
      {!gameStarted ? null : (
        <>
          {/* Drifting cloud mist — camera-relative overlay; thinned while enemies are active */}
          <DriftingMist
            enabled={!isCastleRoom && !isDungeon && !isSkyTemple && !isDefense}
            combatActive={combatArenaActive && enemies.size > 0}
          />
          {inThroneRoom ? (
            <>
              <ThroneRoom
                isSnowTheme={coopTerrainTheme === 'blue'}
                thronePortalOffer={thronePortalOffer}
                campTypes={campTypes}
                coopClearedRoomColor={coopClearedRoomColor}
                equippedWeapon={selectedWeapons?.primary ?? WeaponType.NONE}
                selectedArchetype={selectedArchetype ?? ARCHETYPE_NONE}
                weaponAspectByWeapon={weaponAspectByWeapon}
                showcaseTick={showcaseTick}
                playerPositionRef={realTimePlayerPositionRef}
                voidPortalOpen={throneVoidPortalOpen}
                voidPortalOpenProgress={throneVoidPortalOpenProgress}
                skyPresetIndex={coopSkyPresetIndex}
                grassPresetIndex={coopGrassPresetIndex}
              />
              {engineRef.current?.getWorld() && (
                <PillarCollision world={engineRef.current.getWorld()} positions={THRONE_PILLAR_POSITIONS} />
              )}
            </>
          ) : inBossThroneArena ? (
            <>
              <ThroneRoom
                layout="bossArena"
                isSnowTheme={coopTerrainTheme === 'blue'}
                thronePortalOffer={thronePortalOffer}
                campTypes={campTypes}
                coopClearedRoomColor={coopClearedRoomColor}
                skyPresetIndex={coopSkyPresetIndex}
                combatActive={enemies.size > 0}
              />
              {combatArenaActive && coopMainArenaPortalPhase && (
                <CoopMainArenaPortals
                  thronePortalOffer={thronePortalOffer}
                  phase={coopMainArenaPortalPhase}
                  portalsUnlocked={portalsUnlocked}
                  playerPositionRef={realTimePlayerPositionRef}
                />
              )}
              {combatArenaActive && coopMainArenaPortalPhase && coopMainArenaPortalPhase !== 'pick_trinity_finale' && (
                <CombatArenaPedestal
                  campType={normalizeCoopPortalKind(coopClearedRoomKind ?? coopCurrentRoomKind ?? 'boss')}
                  showAura={pedestalBoonReady}
                />
              )}
            </>
          ) : (
            <CoopEnvironmentSceneLayer
              inThroneRoom={inThroneRoom}
              inBossThroneArena={inBossThroneArena}
              isHexCombatArena={isHexCombatArena}
              isIntroCastleRoom={isIntroCastleRoom}
              hexArenaVariant={hexArenaVariant}
              coopCombatArenaEnterSeq={coopCombatArenaEnterSeq}
              coopDeepSanctumLevel={coopDeepSanctumLevel}
              coopSunkenRoomIndex={coopSunkenRoomIndex}
              coopFaeRealmRoomIndex={coopFaeRealmRoomIndex}
              coopEternityRoomIndex={coopEternityRoomIndex}
              coopTerrainTheme={coopTerrainTheme}
              campTypes={campTypes}
              coopCurrentRoomKind={coopCurrentRoomKind}
              coopClearedRoomKind={coopClearedRoomKind}
              coopMainArenaPortalPhase={coopMainArenaPortalPhase}
              thronePortalOffer={thronePortalOffer}
              portalsUnlocked={portalsUnlocked}
              combatArenaActive={combatArenaActive}
              enemiesCount={enemies.size}
              pedestalBoonReady={pedestalBoonReady}
              mushroomHiddenIndices={mushroomHiddenIndices}
              treeHiddenIndices={treeHiddenIndices}
              rootHiddenIndices={rootHiddenIndices}
              rockHiddenIndices={rockHiddenIndices}
              spineHiddenIndices={spineHiddenIndices}
              coopIntroPortalOpen={coopIntroPortalOpen}
              coopIntroFountainPhase={coopIntroFountainPhase}
              coopIntroFountainUsed={coopIntroFountainUsed}
              coopIntroAllyChoiceMade={coopIntroAllyChoiceMade}
              coopFaeRealmPortalOpen={coopFaeRealmPortalOpen}
              coopSunkenPortalOpen={coopSunkenPortalOpen}
              coopSunkenFountainPhase={coopSunkenFountainPhase}
              coopSunkenFountainUsed={coopSunkenFountainUsed}
              coopSunkenLootPhaseComplete={coopSunkenLootPhaseComplete}
              coopEternityPortalOpen={coopEternityPortalOpen}
              coopEternityFountainPhase={coopEternityFountainPhase}
              coopEternityFountainUsed={coopEternityFountainUsed}
              coopEternityLootPhaseComplete={coopEternityLootPhaseComplete}
              coopAllyOffer={coopAllyOffer}
              coopAllyKind={coopAllyKind}
              introAllyChoiceEncounterRef={introAllyChoiceEncounterRef}
              sunkenSentinelEncounterRef={sunkenSentinelEncounterRef}
              eternityPalaceEncounterRef={eternityPalaceEncounterRef}
              coopVoidPortalOffered={coopVoidPortalOffered}
              deepSanctumRewardKind={deepSanctumRewardKind}
              coopEdenFountainUsed={coopEdenFountainUsed}
              coopEdenResumeKind={coopEdenResumeKind}
              coopFalseEdenCleared={coopFalseEdenCleared}
              coopDefenseFountainActive={coopDefenseFountainActive}
              coopDefenseFountainUsed={coopDefenseFountainUsed}
              deliriumStructure={deliriumStructure}
              world={engineRef.current?.getWorld()}
              camera={camera as PerspectiveCamera}
              realTimePlayerPositionRef={realTimePlayerPositionRef}
              merchantInventory={merchantInventory}
              merchantPurchaseState={merchantPurchaseState}
              weaponAspect={selectedWeaponAspect}
              dreamLayerInventory={dreamLayerInventory}
              dreamLayerPurchaseState={dreamLayerPurchaseState}
              skyPresetIndex={coopSkyPresetIndex}
              coopExploreSeed={coopExploreSeed}
              onEdenFinaleDaisyInteract={() => {
                window.location.reload();
              }}
            />
          )}

          {isExplore && buildPlacementActive && (
            <BuildPlacementGhost
              active={buildPlacementActive}
              kind={buildPlacementKind}
              seed={coopExploreSeed || 1}
              extraDiscsRef={buildPlacementExtraDiscsRef}
              rulesRef={buildPlacementRulesRef}
              destroyedTreeHealth={destroyedTreeHealthMap}
              destroyedRootHealth={destroyedRootHealthMap}
              onPositionChange={(x, z, valid) => {
                buildPlacementPosRef.current = { x, z, valid };
              }}
            />
          )}

      {/* Lighting — throne room brings its own fill; keep this subtle there */}
      <ambientLight intensity={dimThroneLikeLighting ? 0.04 : 0.1} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={dimThroneLikeLighting ? 0.12 : 0.14}
        castShadow={ENABLE_REALTIME_SHADOWS}
        {...(ENABLE_REALTIME_SHADOWS
          ? {
              'shadow-mapSize-width': 2048,
              'shadow-mapSize-height': 2048,
              'shadow-camera-far': 70,
              'shadow-camera-left': -35,
              'shadow-camera-right': 35,
              'shadow-camera-top': 35,
              'shadow-camera-bottom': -35,
            }
          : {})}
      />

      {/* Enhanced Ground with textures and ambient occlusion
      <EnhancedGround radius={33} height={1} level={1} />  */}

      {/* Main Player Character Body — always the humanoid character model */}
      {playerEntity && engineRef.current && (
        <CharacterRenderer
          entityId={playerEntity.id}
          position={realTimePlayerPositionRef.current}
          positionRef={realTimePlayerPositionRef}
          world={engineRef.current.getWorld()}
          isLocalPlayer={true}
          currentWeapon={weaponState.currentWeapon}
          weaponSubclass={
            weaponState.currentWeapon === WeaponType.NONE
              ? undefined
              : weaponState.currentSubclass
          }
          isCharging={weaponState.isCharging}
          isBarrageCharging={weaponState.isBarrageCharging}
          isCobraShotCharging={weaponState.isCobraShotCharging}
          isViperStingCharging={weaponState.isViperStingCharging}
          isRejuvenatingShotCharging={weaponState.isRejuvenatingShotCharging}
          isDead={playerDeathStates.get(socket?.id ?? '')?.isDead ?? false}
        />
      )}

      {/* Main Player Weapon Renderer — weapon layer on top of the character (dragon body hidden) */}
      {playerEntity && engineRef.current && weaponState.currentWeapon !== WeaponType.KNIGHT && (
        <DragonRenderer
          entityId={playerEntity.id}
          position={realTimePlayerPositionRef.current}
          realTimePositionRef={realTimePlayerPositionRef}
          world={engineRef.current!.getWorld()}
          currentWeapon={weaponState.currentWeapon}
          currentSubclass={
            weaponState.currentWeapon === WeaponType.NONE ? undefined : weaponState.currentSubclass
          }
          roomBoomGhostTrailColor={roomBoomGhostTrailColor}
          talentLoadout={talentLoadout}
          isCharging={weaponState.isCharging}
          chargeProgress={weaponState.chargeProgress}
          chargeDirection={weaponState.chargeDirection}
          isSwinging={weaponState.isSwinging}
          isSpinning={weaponState.isSpinning}
          swordComboStep={weaponState.swordComboStep}
          isSwordCharging={weaponState.isSwordCharging}
          isDeflecting={weaponState.isDeflecting}
          deflectShieldActive={weaponState.deflectShieldActive}
          deflectShieldDurationSec={weaponState.deflectShieldDurationSec}
          deflectShieldPaletteVariant={weaponState.deflectShieldPaletteVariant}
          isBlockingDeflect={weaponState.isBlockingDeflect}
          isViperStingCharging={weaponState.isViperStingCharging}
          viperStingChargeProgress={weaponState.viperStingChargeProgress}
          isBarrageCharging={weaponState.isBarrageCharging}
          barrageChargeProgress={weaponState.barrageChargeProgress}
          isCrossentropyCharging={controlSystemRef.current?.isCrossentropyChargingActive() || false}
          isSummonTotemCharging={controlSystemRef.current?.isSummonTotemChargingActive() || false}
          isCobraShotCharging={weaponState.isCobraShotCharging}
          cobraShotChargeProgress={weaponState.cobraShotChargeProgress}
          tempestBurstShotSeq={weaponState.tempestBurstShotSeq}
          isRejuvenatingShotCharging={weaponState.isRejuvenatingShotCharging}
          rejuvenatingShotChargeProgress={weaponState.rejuvenatingShotChargeProgress}
          isWhirlwindCharging={controlSystemRef.current?.isWhirlwindChargingActive() || false}
          whirlwindChargeProgress={controlSystemRef.current?.getWhirlwindChargeProgress() || 0}
          isWhirlwinding={controlSystemRef.current?.isWhirlwindActive() || false}
          isThrowSpearCharging={controlSystemRef.current?.isThrowSpearChargingActive() || false}
          throwSpearChargeProgress={controlSystemRef.current?.getThrowSpearChargeProgress() || 0}
          isThrowSpearReleasing={controlSystemRef.current?.isThrowSpearReleasingActive() || false}
          isSkyfalling={weaponState.isSkyfalling}
          isBackstabbing={weaponState.isBackstabbing}
          showVorpalGustBeam={
            weaponState.currentWeapon === WeaponType.SABRES &&
            shouldApplyVorpalGustTalent(talentLoadout)
          }
          vorpalGustStabBoonBeamTheme={getVorpalGustStabBoonBeamTheme(talentLoadout)}
          isSundering={weaponState.isSundering}
          isSmiting={controlSystemRef.current?.isSmiteActive() || false}
          isColossusStriking={controlSystemRef.current?.isColossusStrikeActive() || false}
          isDeathGrasping={controlSystemRef.current?.isDeathGraspActive() || false}
          isWraithStriking={controlSystemRef.current?.isWraithStrikeActive() || false}
          isCorruptedAuraActive={controlSystemRef.current?.isCorruptedAuraActive() || false}
          reanimateRef={reanimateRef}
          isLocalPlayer={true}
          isStealthing={controlSystemRef.current?.getIsStealthing() || false}
          isInvisible={controlSystemRef.current?.getIsInvisible() || false}
          playerLevel={playerLevel}
          wrathfulTalonsReturnCrit={shouldApplyWrathfulTalonsTalent(talentLoadout, abilityLoadout ?? null)}
          wrathfulTalonsExplosionCrit={
            shouldApplyWrathfulTalonsTalent(talentLoadout, abilityLoadout ?? null) &&
            shouldApplyExplosiveTalonsTalent(talentLoadout, abilityLoadout ?? null)
          }
          executeReapingTalons={shouldApplyExecuteTalent(talentLoadout, abilityLoadout ?? null)}
          onDashChargeExpended={(consumed) =>
            controlSystemRef.current?.tryManaShieldOnDashChargeExpended(consumed)
          }
          giantKillerReapingTalons={shouldApplyGiantKillerTalent(talentLoadout, abilityLoadout ?? null)}
          getTerminalVelocityBonus={(horizontalDistance) =>
            controlSystemRef.current?.getTerminalVelocityBonusAtRange?.(horizontalDistance) ?? 0
          }
          explosiveTalons={shouldApplyExplosiveTalonsTalent(talentLoadout, abilityLoadout ?? null)}
          wyvernTalons={shouldApplyWyvernTalonsTalent(talentLoadout, abilityLoadout ?? null)}
          staggeringTalonsActive={shouldApplyStaggeringTalonsTalent(talentLoadout, abilityLoadout ?? null)}
          glacialTalonsTheme={shouldApplyGlacialTalonsTalent(talentLoadout, abilityLoadout ?? null)}
          detonateWyvernConcentratedVenomCoop={detonateWyvernConcentratedVenom}
          runebladeStoredCharge={shouldApplyCycloneRushChargeSpin(talentLoadout)}
          runebladeStaggeringCombo={shouldApplyStaggeringComboTalent(talentLoadout)}
          runebladeWrathfulCombo={shouldApplyWrathfulComboTalent(talentLoadout)}
          runebladeInfestedCombo={shouldApplyInfestedComboTalent(talentLoadout)}
          onRunebladeGuardComboProc={() =>
            controlSystemRef.current?.tryGuardComboProcFromRunebladeBasicHit()
          }
          onRunebladePrimaryHits={(n) =>
            controlSystemRef.current?.notifyRunebladePrimaryHits(n)
          }
          runebladeComboStepResolver={() =>
            controlSystemRef.current?.getSwordComboStep() ?? 1
          }
          getRunebladeExecutionerFlatBonus={() =>
            controlSystemRef.current?.getAndClearRunebladeExecutionerFlatBonus() ?? 0
          }
          getRunebladeCrusaderLmbFlatBonus={() =>
            controlSystemRef.current?.getRunebladeCrusaderLmbFlatBonus() ?? 0
          }
          getRunebladeTitansGripLmbFlatBonus={() =>
            controlSystemRef.current?.getRunebladeTitansGripLmbFlatBonus() ?? 0
          }
          getVicegripRunebladeComboFlatBonus={() =>
            controlSystemRef.current?.getVicegripRunebladeComboFlatBonus() ?? 0
          }
          crusaderBladeThemeActive={
            controlSystemRef.current?.isRunebladeCrusaderBuffActive() || false
          }
          titansGripBladeThemeActive={shouldApplyTitansGripTalent(talentLoadout)}
          psionicBladesBladeThemeActive={shouldApplyPsionicBladesTalent(talentLoadout)}
          weaponAspect={selectedWeaponAspect}
          onRunebladeTitansGripHit={(targetId) => {
            const pos = controlSystemRef.current?.tryTitansGripStunProcFromRunebladeHit(targetId);
            if (pos && !isInRoom) {
              spawnTitansGripStunLightning(pos);
            }
          }}
          onRunebladeDeathdealerThirdHit={(targetId) => {
            const result =
              controlSystemRef.current?.tryDeathdealerStaggerProcFromRunebladeThirdHit(targetId);
            if (!result) return;
            if (isInRoom && result.serverEnemyId) {
              triggerDeathdealerStaggerProc(result.serverEnemyId);
            } else if (!isInRoom) {
              spawnDeathdealerStaggerLightning(result.position);
            }
          }}
          getRunebladeBlizzardTalentActive={
            shouldApplyBlizzardTalent(talentLoadout)
              ? () => controlSystemRef.current?.isRunebladeBlizzardTalentActive() ?? false
              : undefined
          }
          getRunebladeBlizzardDamagePerTick={() =>
            getRunebladeBlizzardDamagePerTickFromStats(
              controlSystemRef.current?.getAllocatedPlayerStats() ?? effectiveCombatStats,
              talentLoadout,
              abilityLoadout ?? null,
            )
          }
          getRunebladeBlizzardStormHitRadius={getRunebladeBlizzardStormHitRadiusCallback}
          getRunebladeBlizzardParticleSpawnMultiplier={getRunebladeBlizzardParticleMultiplier}
          mushroomTargets={mushroomsEnabled ? mushroomTargetsForMelee : []}
          onMushroomHit={mushroomsEnabled ? onMushroomMeleeHit : undefined}
          treeTargets={isExplore ? treeTargetsForMelee : []}
          onTreeHit={isExplore ? onTreeMeleeHit : undefined}
          rootTargets={isExplore ? rootTargetsForMelee : []}
          onRootHit={isExplore ? onRootMeleeHit : undefined}
          rockTargets={isExplore ? rockTargetsForMelee : []}
          onRockHit={isExplore ? onRockMeleeHit : undefined}
          spineTargets={isExplore ? spineTargetsForMelee : []}
          onSpineHit={isExplore ? onSpineMeleeHit : undefined}
          onWraithStrikeSlashImpactQueueReady={handleWraithStrikeSlashImpactQueueReady}
          combatSystem={engineRef.current?.getWorld().getSystem(require('@/systems/CombatSystem').CombatSystem)}
          onHeal={(amount: number) => {
            // Handle healing for local player (Viper Sting soul steal, etc.)
            if (playerEntityRef.current !== null && engineRef.current) {
              const world = engineRef.current.getWorld();
              const playerEntity = world.getEntity(playerEntityRef.current);
              if (playerEntity) {
                const CombatSystemClass = require('@/systems/CombatSystem').CombatSystem;
                const combatSystem = world.getSystem(CombatSystemClass) as any;
                if (combatSystem && combatSystem.healImmediate) {
                  // Use CombatSystem to heal the player (this handles all the logic)
                  combatSystem.healImmediate(playerEntity, amount, playerEntity);
                  // The CombatSystem will handle updating the health component and triggering effects

                  // Broadcast healing to other players
                  broadcastPlayerHealing(amount, 'viper_sting', realTimePlayerPositionRef.current);
                }
              }
            }
          }}
          onBowRelease={() => {
            // This callback is now handled by the ControlSystem directly
          }}
          onScytheSwingComplete={() => {
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('scythe_swing', realTimePlayerPositionRef.current, direction, {
              isSpinning: true
            });
          }}
          onSwordSwingComplete={() => {
            controlSystemRef.current?.onSwordSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sword_swing', realTimePlayerPositionRef.current, direction, {
              comboStep: weaponState.swordComboStep
            });
          }}
          onSabresSwingComplete={() => {
            controlSystemRef.current?.onSabresSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sabres_swing', realTimePlayerPositionRef.current, direction);
          }}
          onRunebladeSwingComplete={() => {
            controlSystemRef.current?.onSwordSwingComplete(); // Reuse Sword swing complete for combo advancement
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('runeblade_swing', realTimePlayerPositionRef.current, direction, {
              comboStep: weaponState.swordComboStep
            });
          }}
          onSpearSwingComplete={() => {
            controlSystemRef.current?.onSpearSwingComplete();
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('spear_swing', realTimePlayerPositionRef.current, direction);
          }}
          onChargeComplete={() => {
            controlSystemRef.current?.onChargeComplete();
            // Broadcast charge spin animation
            const direction = new Vector3();
            camera.getWorldDirection(direction);
            direction.normalize();
            broadcastPlayerAttack('sword_charge_spin', realTimePlayerPositionRef.current, direction, {
              isSpinning: true,
              storedCharge: shouldApplyCycloneRushChargeSpin(talentLoadout),
            });
          }}
          onChargeSpinStart={() => {
            stopLocalRunebladeWhirlwind();
            const instance = window.audioSystem?.playRunebladeWhirlwindSound(
              realTimePlayerPositionRef.current,
            );
            if (instance != null) {
              runebladeWhirlwindInstanceRef.current = instance;
            }
            const SPIN_ROTATION_SPEED = 32.5;
            const spinDurationMs = (3 * 2 * Math.PI) / SPIN_ROTATION_SPEED * 1000 + 200;
            localWhirlwindFailsafeTimeoutRef.current = setTimeout(() => {
              localWhirlwindFailsafeTimeoutRef.current = undefined;
              stopLocalRunebladeWhirlwind();
            }, spinDurationMs);
          }}
          onChargeSpinEnd={() => {
            stopLocalRunebladeWhirlwind();
          }}
          onDeflectComplete={() => {
            controlSystemRef.current?.onDeflectComplete();
          }}
          onBackstabComplete={() => {
            controlSystemRef.current?.onBackstabComplete();
          }}
          onSunderComplete={() => {
            // Sunder animation completed - no need to broadcast as animation state is handled automatically
          }}
          onSmiteComplete={() => {
            controlSystemRef.current?.onSmiteComplete();
          }}
          onColossusStrikeComplete={() => {
            controlSystemRef.current?.onColossusStrikeComplete();
          }}
          onDeathGraspComplete={() => {
            controlSystemRef.current?.onDeathGraspComplete();
          }}
          onWraithStrikeComplete={() => {
            controlSystemRef.current?.onWraithStrikeComplete();
          }}
          onCorruptedAuraToggle={(active: boolean) => {
            // Update the weapon state when Corrupted Aura is toggled
            const newState = {
              ...weaponStateRef.current,
              isCorruptedAuraActive: active,
              isFrozen: weaponStateRef.current.isFrozen
            };
            weaponStateRef.current = newState;
            setWeaponState(newState);
          }}
          purchasedItems={players.get(socket?.id || '')?.purchasedItems || []}
          hasFatebreaker={shouldApplyFatebreakerTalent(talentLoadout)}
          hasFrostQueen={shouldApplyFrostQueenTalent(talentLoadout)}
          hideBody={true}
        />
      )}

      {/* Other Players Renderers */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't render our own player twice
        void remotePlayerEntityRevision;
        void playerRosterMetaRev;

        const livePlayer = contextPlayersRef.current.get(player.id) ?? player;

        // Check if player is invisible due to stealth
        const isPlayerInvisible = playerStealthStates.current.get(player.id) || false;

        // Check if player is dead
        const deathState = playerDeathStates.get(player.id);
        const isPlayerDead = deathState?.isDead || false;

        if (isPlayerInvisible) {
          return null; // Don't render invisible players
        }

        const playerState = multiplayerPlayerStates.get(player.id) || DEFAULT_REMOTE_PLAYER_ANIM_STATE;

        // Get the real-time position ref for this enemy player
        const enemyPositionRef = enemyPlayerPositionRefs.current.get(player.id);
        const enemySmoothedPositionRef = enemyPlayerSmoothedPositionRefs.current.get(player.id);
        const enemySmoothedRotationRef = enemyPlayerSmoothedRotationRefs.current.get(player.id);

        let playerPos = enemySmoothedPositionRef?.current ?? enemyPositionRef?.current;
        if (!playerPos) {
          // Fallback until the useFrame sync creates a live ref for this peer.
          let scratch = remotePlayerPosScratchRef.current.get(player.id);
          if (!scratch) {
            scratch = new Vector3();
            remotePlayerPosScratchRef.current.set(player.id, scratch);
          }
          scratch.set(player.position.x, player.position.y, player.position.z);
          playerPos = scratch;
        }

        const remotePeerEntityId = serverPlayerEntities.current.get(player.id);
        if (remotePeerEntityId == null) {
          return null;
        }

        const remotePrimaryWeaponCastHold =
          livePlayer.weapon !== WeaponType.BOW &&
          livePlayer.weapon !== WeaponType.NONE &&
          (Boolean(playerState.isSwordCharging) ||
            Boolean(playerState.isViperStingCharging) ||
            Boolean(playerState.isSwinging) ||
            Boolean(playerState.isSpinning));

        return (
          <React.Fragment key={player.id}>
            {/* Character body — always the humanoid model */}
            <CharacterRenderer
              entityId={remotePeerEntityId}
              position={playerPos}
              positionRef={enemySmoothedPositionRef}
              world={engineRef.current?.getWorld() || new World()}
              isLocalPlayer={false}
              rotation={player.rotation}
              rotationRef={enemySmoothedRotationRef}
              currentWeapon={livePlayer.weapon}
              weaponSubclass={
                livePlayer.weapon === WeaponType.NONE ? undefined : livePlayer.subclass
              }
              isCharging={playerState.isCharging}
              isBarrageCharging={playerState.isBarrageCharging}
              isCobraShotCharging={playerState.isCobraShotCharging}
              isViperStingCharging={playerState.isViperStingCharging}
              isRejuvenatingShotCharging={playerState.isRejuvenatingShotCharging ?? false}
              remotePrimaryWeaponCastHold={remotePrimaryWeaponCastHold}
              isDead={isPlayerDead}
            />

            {/* Weapon layer — dragon body hidden, only weapon rendered */}
            {livePlayer.weapon !== WeaponType.KNIGHT && (
              <DragonRenderer
                entityId={remotePeerEntityId}
                position={playerPos}
                realTimePositionRef={enemySmoothedPositionRef}
                world={engineRef.current?.getWorld() || new World()}
                currentWeapon={livePlayer.weapon}
                currentSubclass={
                  livePlayer.weapon === WeaponType.NONE ? undefined : livePlayer.subclass
                }
                weaponAspect={
                  livePlayer.weapon === WeaponType.NONE
                    ? undefined
                    : normalizeWeaponAspect(livePlayer.weaponAspect, livePlayer.weapon)
                }
                isCharging={playerState.isCharging}
                chargeProgress={playerState.chargeProgress}
                isSwinging={playerState.isSwinging}
                isSpinning={playerState.isSpinning}
                swordComboStep={playerState.swordComboStep}
                isSwordCharging={playerState.isSwordCharging}
                isDeflecting={playerState.isDeflecting}
                isBlockingDeflect={playerState.isBlockingDeflect ?? false}
                isViperStingCharging={playerState.isViperStingCharging}
                viperStingChargeProgress={playerState.viperStingChargeProgress}
                isBarrageCharging={playerState.isBarrageCharging}
                barrageChargeProgress={playerState.barrageChargeProgress}
                isCrossentropyCharging={playerState.isCrossentropyCharging || false}
                isSummonTotemCharging={playerState.isSummonTotemCharging || false}
                isCobraShotCharging={playerState.isCobraShotCharging}
                cobraShotChargeProgress={playerState.cobraShotChargeProgress}
                isRejuvenatingShotCharging={playerState.isRejuvenatingShotCharging ?? false}
                rejuvenatingShotChargeProgress={playerState.rejuvenatingShotChargeProgress ?? 0}
                tempestBurstShotSeq={playerState.tempestBurstShotSeq ?? 0}
                isSkyfalling={playerState.isSkyfalling}
                isBackstabbing={playerState.isBackstabbing}
                showVorpalGustBeam={
                  livePlayer.weapon === WeaponType.SABRES &&
                  Boolean(playerState.isBackstabbing && playerState.backstabVorpalGust)
                }
                vorpalGustStabBoonBeamTheme={
                  playerState.backstabVorpalGustTheme ?? 'default'
                }
                isSundering={playerState.isSundering || false}
                isSmiting={playerState.isSmiting || false}
                isColossusStriking={playerState.isColossusStriking || false}
                isDeathGrasping={playerState.isDeathGrasping || false}
                isWraithStriking={playerState.isWraithStriking || false}
                isCorruptedAuraActive={playerState.isCorruptedAuraActive || false}
                crusaderBladeThemeActive={playerState.crusaderBladeThemeActive || false}
                titansGripBladeThemeActive={playerState.titansGripBladeThemeActive || false}
                psionicBladesBladeThemeActive={playerState.psionicBladesBladeThemeActive || false}
                deflectShieldActive={playerState.deflectShieldActive ?? playerState.isDeflecting}
                deflectShieldPaletteVariant={playerState.deflectShieldPaletteVariant ?? 'default'}
                deflectShieldDurationSec={playerState.deflectShieldDurationSec ?? 3}
                getRunebladeBlizzardTalentActive={
                  playerState.isRunebladeBlizzardActive
                    ? () => true
                    : undefined
                }
                isDead={isPlayerDead}
                rotation={player.rotation}
                rotationRef={enemySmoothedRotationRef}
                isLocalPlayer={false}
                runebladeStoredCharge={playerState.runebladeStoredCharge ?? false}
                onBowRelease={() => {}}
                onScytheSwingComplete={() => {}}
                onSwordSwingComplete={() => {}}
                onSabresSwingComplete={() => {}}
                onRunebladeSwingComplete={() => {}}
                onBackstabComplete={() => {}}
                onSunderComplete={() => {}}
                onSmiteComplete={() => {}}
                onColossusStrikeComplete={() => {}}
                onDeathGraspComplete={() => {}}
                onWraithStrikeComplete={() => {}}
                purchasedItems={livePlayer.purchasedItems || []}
                hideBody={true}
                playerLevel={
                  livePlayer.level ??
                  ExperienceSystem.getLevelFromExperience(livePlayer.experience ?? 0)
                }
              />
            )}
          </React.Fragment>
        );
      })}

      {/* BOSS Enemy Renderer (Co-op Mode) */}
      {engineRef.current && (enemiesByType.get('boss') ?? []).map(enemy => {
        // Get the local ECS entity ID for this enemy
        const entityId = serverEnemyEntities.current.get(enemy.id);
        if (!entityId) return null; // Wait for ECS sync

        // Hide boss in undiscovered camps
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;

        // Check if this boss is currently taunted
        const isTaunted = isEnemyTaunted(enemy.id);

        return (
          <group key={enemy.id}>
            <React.Suspense fallback={null}>
              <BossRenderer
                id={enemy.id}
                entityId={entityId}
                position={enemy.position}
                world={engineRef.current!.getWorld()}
                health={enemy.health}
                maxHealth={enemy.maxHealth}
                rotation={enemy.rotation}
                isDying={!!enemy.isDying}
                staggerBuildup={enemy.staggerBuildup ?? 0}
                isStunned={readEnemyIsStunned(engineRef.current?.getWorld(), entityId)}
              />
            </React.Suspense>

            {/* Taunt Effect Indicator */}
            {isTaunted && (
              <TauntEffectIndicator
                position={enemy.position} yOffset={4}
              />
            )}
          </group>
        );
      })}

      {/* Boss 2 Enemy Renderer (Co-op Mode) */}
      {(enemiesByType.get('boss2') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        const isTaunted = isEnemyTaunted(enemy.id);

        return (
          <group key={enemy.id}>
            <React.Suspense fallback={null}>
              <Boss2Renderer
                id={enemy.id}
                position={enemy.position}
                rotation={enemy.rotation || 0}
                health={enemy.health}
                maxHealth={enemy.maxHealth}
                isDying={!!enemy.isDying}
                staggerBuildup={enemy.staggerBuildup ?? 0}
              />
            </React.Suspense>
            {isTaunted && (
              <TauntEffectIndicator
                position={enemy.position} yOffset={5.2}
              />
            )}
          </group>
        );
      })}

      {/* Boss 3 — Weaver Nexus (Co-op) */}
      {(enemiesByType.get('boss3') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        const isTaunted = isEnemyTaunted(enemy.id);

        return (
          <group key={enemy.id}>
            <React.Suspense fallback={null}>
              <Boss3Renderer
                id={enemy.id}
                position={enemy.position}
                rotation={enemy.rotation || 0}
                health={enemy.health}
                maxHealth={enemy.maxHealth}
                isDying={!!enemy.isDying}
                staggerBuildup={enemy.staggerBuildup ?? 0}
              />
            </React.Suspense>
            {isTaunted && (
              <TauntEffectIndicator
                position={enemy.position} yOffset={5.2}
              />
            )}
          </group>
        );
      })}

      {/* Destiny — dragon boss (Co-op) */}
      {(enemiesByType.get('destiny') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        const isTaunted = isEnemyTaunted(enemy.id);

        return (
          <group key={enemy.id}>
            <React.Suspense fallback={null}>
              <DestinyRenderer
                id={enemy.id}
                position={enemy.position}
                rotation={enemy.rotation || 0}
                health={enemy.health}
                maxHealth={enemy.maxHealth}
                isDying={!!enemy.isDying}
                staggerBuildup={enemy.staggerBuildup ?? 0}
                destinyPhase={enemy.destinyPhase}
              />
            </React.Suspense>
            {isTaunted && (
              <TauntEffectIndicator
                position={enemy.position} yOffset={6.5}
              />
            )}
          </group>
        );
      })}

      <CoopEnemyRenderLayer
        enemiesByType={enemiesByType}
        isCoopEnemyVisibleForRender={isCoopEnemyVisibleForRender}
      />

      <CoopProjectileLayer
        ref={projectileLayerRef}
        warlockOrbChargeMs={WARLOCK_ORB_CHARGE_MS}
        getLocalPlayerPosition={getLocalPlayerPosition}
        coopServerEnemyLiving={coopServerEnemyLiving}
        onBossSpearHitPlayer={onBossSpearHitPlayer}
        onMeteorPlayerImpact={onMeteorPlayerImpact}
      />
      <CoopBossTelegraphLayer
        ref={bossTelegraphLayerRef}
        onWeaverLightningImpact={onWeaverLightningImpact}
      />
      <CoopGroundTelegraphLayer ref={groundTelegraphLayerRef} />
      <CoopBossMechanicLayer ref={bossMechanicLayerRef} />
      <CoopExplosionBurstLayer ref={explosionBurstLayerRef} />
      <CoopLightningBurstLayer ref={lightningBurstLayerRef} />
      <CoopGroundHazardLayer ref={groundHazardLayerRef} />
      <CoopSummonRitualLayer ref={summonRitualLayerRef} />
      <CoopAllyCombatLayer
        ref={allyCombatLayerRef}
        enemiesRef={enemiesRef}
        playersRef={playersRef}
        socketId={socket?.id}
        localPlayerWorldPosRef={realTimePlayerPositionRef}
        enemyPlayerPositionRefs={enemyPlayerPositionRefs}
      />
      <CoopCombatFeedbackLayer
        ref={combatFeedbackLayerRef}
        world={engineRef.current?.getWorld() ?? null}
      />
      <CoopEnvironmentVfxLayer
        ref={environmentVfxLayerRef}
        getCurrentPlayerPosition={() => realTimePlayerPositionRef.current}
        getDeathEffectPlayerData={() => Array.from(players.values()).map(p => ({
          id: p.id,
          position: new Vector3(p.position.x, p.position.y, p.position.z),
          health: p.health,
        }))}
        localSocketId={socket?.id}
        onDeathEffectComplete={(playerId) => {
          if (playerId === socket?.id) {
            handlePlayerRespawn(playerId);
          }
        }}
        onGoldCollectMoteComplete={() => {
          window.dispatchEvent(new CustomEvent('gold-pocket-collected'));
        }}
        onDreamShardComplete={() => {
          if (socket?.id) {
            updatePlayerFlow(socket.id, 1);
          }
          window.dispatchEvent(new CustomEvent('flow-collected'));
        }}
      />

      <CoopTentacleSpineLayer
        ref={tentacleSpineLayerRef}
        enemies={enemiesByType.get("tentacle-spine") ?? []}
        isCoopEnemyVisibleForRender={isCoopEnemyVisibleForRender}
      />

      {/* Other Players Health Bars */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't show health bar for local player

        // Check if player is invisible (stealth mode) - don't show health bar
        const isInvisible = playerStealthStates.current.get(player.id);
        if (isInvisible) return null;

        // Use shield values from the synchronized player data
        const shieldAmount = player.shield ?? 0;
        const maxShieldAmount = player.maxShield ?? 25;

        return (
          <PlayerHealthBar
            key={`healthbar-${player.id}`}
            playerId={player.id}
            playerName={player.name}
            position={player.position}
            health={player.health}
            maxHealth={player.maxHealth}
            shield={shieldAmount}
            maxShield={maxShieldAmount}
            camera={camera}
            playersRef={contextPlayersRef}
            showDistance={35}
          />
        );
      })}

      <CoopPvpAbilityLayer
        ref={pvpAbilityLayerRef}
        localSocketId={socket?.id}
        currentRoomId={currentRoomId}
        talentLoadout={talentLoadout}
        abilityLoadout={abilityLoadout ?? null}
        world={engineRef.current?.getWorld() ?? null}
        playerEntity={playerEntity}
        players={players}
        weaponAspect={selectedWeaponAspect}
        realTimePlayerPositionRef={realTimePlayerPositionRef}
        getLiveCoopEnemyData={getLiveCoopEnemyData}
        getEnemyType={getCoopEnemyTypeById}
        isDeathGraspPullImmuneEnemy={isDeathGraspPullImmuneEnemy}
        getDeathGraspPulledEnemyPosition={getDeathGraspPulledEnemyPosition}
        onDeathGraspEnemyPullFrame={onDeathGraspEnemyPullFrame}
        onSmiteHitEnemy={onPvpSmiteHitEnemy}
        onDeathGraspHitEnemy={onPvpDeathGraspHitEnemy}
        onLightningStormHitEnemy={onPvpLightningStormHitEnemy}
        onLocustHitEnemy={onPvpLocustHitEnemy}
        onSmiteBeamEnemyHitColossusGuard={onSmiteBeamEnemyHitColossusGuard}
        getVengeanceSmiteDamageMultiplier={getVengeanceSmiteDamageMultiplier}
      />

      {/* Unified Managers - Single query optimization */}
      {engineRef.current && engineReady && (
        <>
          <UnifiedProjectileManager
            world={engineRef.current.getWorld()}
            onHauntedSoulAt={createPvpHauntedSoulEffect}
          />
          <IcebeamManager
            world={engineRef.current.getWorld()}
            playerRef={viperStingParentRef as any}
            isIcebeaming={weaponState.isIcebeaming}
            onIcebeamEnd={() => {
              // Force stop Icebeam in control system
              if (controlSystemRef.current) {
                controlSystemRef.current.forceStopIcebeam();
              }
            }}
          />
          <IncinerationBeamManager
            ref={incinerationBeamManagerRef}
            world={engineRef.current.getWorld()}
            sourcePlayerId={socket?.id}
            sourceEntity={
              playerEntityRef.current != null
                ? engineRef.current.getWorld().getEntity(playerEntityRef.current)
                : undefined
            }
          />
          <BowPowershotManager />
          <FrostNovaManager world={engineRef.current.getWorld()} />
          <FireStormManager world={engineRef.current.getWorld()} />
          <FrostShatterSpikeManager />
          <ArcticBlizzardManager
            world={engineRef.current.getWorld()}
            getEnemyData={getArcticBlizzardEnemyData}
            getDamagePerTick={getArcticBlizzardDamagePerTick}
            getHitRadius={getArcticBlizzardHitRadiusCallback}
            getParticleSpawnMultiplier={getArcticBlizzardParticleMultiplier}
            hasMonsoon={shouldApplyMonsoonTalent(talentLoadout)}
          />
          <AvalancheEffectManager
            world={engineRef.current.getWorld()}
            getDamagePerTick={getArcticBlizzardDamagePerTick}
            hasMonsoon={shouldApplyMonsoonTalent(talentLoadout)}
          />
          <FrostQueenPlayerIceStormManager
            socket={socket}
            getPlayerPositions={getEntangledPlayerPositions}
          />
          <StunManager world={engineRef.current.getWorld()} />
          <HuntersMarkManager world={engineRef.current.getWorld()} />
          <EntangleManager
            world={engineRef.current.getWorld()}
            getPlayerPositions={getEntangledPlayerPositions}
          />
          <IgniteEffectManager world={engineRef.current.getWorld()} />
          <CobraShotManager world={engineRef.current.getWorld()} />
          <DeflectShieldManager />
          <PVPSummonTotemManager
            players={players}
            localSocketId={socket?.id}
            enemyData={summonTotemEnemyData}
            onDamage={handleSummonTotemDamage}
            onTotemFloatingDamage={addTotemFloatingDamage}
            totemBoltVariant={getTotemBoltVariantFromTalentLoadout(talentLoadout)}
            weaponAspect={selectedWeaponAspect}
            superconductor={shouldApplySuperconductorTalent(talentLoadout, abilityLoadout)}
            allowPlayerTargets={gameMode !== 'coop'}
            resolveTotemEnemyFrozen={resolveTotemEnemyFrozen}
          />
          <RejuvenatingShotManager
            world={engineRef.current.getWorld()}
            playerPositions={Array.from(players.values())
              .filter(player => player.health > 0 && player.health < player.maxHealth && player.id !== socket?.id)
              .map(player => ({
                id: player.id,
                position: new Vector3(player.position.x, player.position.y, player.position.z),
                health: player.health,
                maxHealth: player.maxHealth
              }))}
            alliedTargets={Array.from(enemies.values())
              .filter(enemy => !enemy.isDying && enemy.health > 0 && enemy.health < enemy.maxHealth
                && (enemy.type === 'allied-knight' || enemy.alliedUnit === true))
              .map(enemy => {
                const live = enemyTransformsRef.current.get(enemy.id);
                const p = live?.position ?? enemy.position;
                return {
                  id: enemy.id,
                  position: new Vector3(p.x, p.y, p.z),
                  health: enemy.health,
                  maxHealth: enemy.maxHealth,
                };
              })}
            enemyTargets={Array.from(enemies.values())
              .filter(enemy => !enemy.isDying && enemy.health > 0
                && enemy.type !== 'allied-knight' && enemy.alliedUnit !== true
                && enemy.type !== 'player-zombie' && enemy.type !== 'vengeful-spirit')
              .map(enemy => {
                const live = enemyTransformsRef.current.get(enemy.id);
                const p = live?.position ?? enemy.position;
                return {
                  id: enemy.id,
                  position: new Vector3(p.x, p.y, p.z),
                  health: enemy.health,
                };
              })}
            onPlayerHealed={(playerId, healAmount, position) => {
              if (socket && currentRoomId) {
                broadcastPlayerHealing(healAmount, 'rejuvenating_shot', position, playerId);
              }
            }}
            onAlliedHealed={(enemyId, healAmount, position) => {
              if (socket && currentRoomId) {
                broadcastAlliedHealing(healAmount, 'rejuvenating_shot', position, enemyId);
              }
            }}
            onEnemyEntangled={(enemyId, position) => {
              if (socket && currentRoomId) {
                damageEnemy(enemyId, 0, socket.id, {
                  damageType: 'rejuvenating_shot',
                  rejuvenatingShotEntangle: true,
                });
              } else if (engineRef.current) {
                // Local PvE fallback — apply entangle on ECS enemy directly
                const world = engineRef.current.getWorld();
                const currentTime = Date.now() / 1000;
                for (const entity of world.getAllEntities()) {
                  const sid = entity.userData?.serverEnemyId as string | undefined;
                  if (sid !== enemyId && String(entity.id) !== enemyId) continue;
                  const enemy = entity.getComponent(Enemy);
                  if (!enemy) continue;
                  enemy.entangle(ENTANGLEMENT_DURATION_MS / 1000, currentTime);
                  break;
                }
              }
            }}
          />
          <ThrowSpearManager
            world={engineRef.current.getWorld()}
          />
          {/* Dropped Amulet Items */}
          {Array.from(droppedItems.values()).map(item => (
            <DroppedItemMesh
              key={item.id}
              item={item}
              playerPositionRef={realTimePlayerPositionRef}
              onPickup={pickupItem}
            />
          ))}

          {/* GOLD world piles */}
          {Array.from(goldDrops.values()).map((drop) => (
            <GoldPileDropEffect
              key={drop.id}
              drop={drop}
              playerPositionRef={realTimePlayerPositionRef}
              onPickup={pickupGoldDrop}
              pickupRadius={COOP_GROUND_ITEM_PICKUP_RADIUS}
            />
          ))}

          {/* WOOD world piles (explore) */}
          {isExplore && Array.from(woodDrops.values()).map((drop) => (
            <WoodPileDropEffect
              key={drop.id}
              drop={drop}
              playerPositionRef={realTimePlayerPositionRef}
              onPickup={pickupWoodDrop}
              pickupRadius={COOP_GROUND_ITEM_PICKUP_RADIUS}
            />
          ))}
          {isExplore && Array.from(stoneDrops.values()).map((drop) => (
            <StonePileDropEffect
              key={drop.id}
              drop={drop}
              playerPositionRef={realTimePlayerPositionRef}
              onPickup={pickupStoneDrop}
              pickupRadius={COOP_GROUND_ITEM_PICKUP_RADIUS}
            />
          ))}
          {isExplore && Array.from(meatDrops.values()).map((drop) => (
            <MeatPileDropEffect
              key={drop.id}
              drop={drop}
              playerPositionRef={realTimePlayerPositionRef}
              onPickup={pickupMeatDrop}
              pickupRadius={COOP_GROUND_ITEM_PICKUP_RADIUS}
            />
          ))}        </>
      )}
        </>
      )}

      </CoopSceneContentProfiler>
    </>
  );
}

function createCoopPlayer(
  world: World,
  spawn?: { x: number; y: number; z: number },
): any {
  // Create player entity
  const player = world.createEntity();

  // Add Transform component
  const transform = world.createComponent(Transform);
  const sx = spawn?.x ?? 0;
  const sy = spawn?.y ?? 0.5;
  const sz = spawn?.z ?? COOP_MAIN_DEFAULT_SPAWN_Z;
  transform.setPosition(sx, sy, sz);
  player.addComponent(transform);

  // Add Movement component
  const movement = world.createComponent(Movement);
  movement.maxSpeed = 3.575; // Reduced from 8 to 3.65 for slower movement
  movement.jumpForce = 4.5;
  movement.friction = 0.85;
  player.addComponent(movement);

  // Add Health component with level-based max health
  const maxHealth = ExperienceSystem.getMaxHealthForLevel(1); // Start at level 1
  const health = new Health(maxHealth);
  health.enableRegeneration(0, 0); // Slower regen in COOP: 1 HP per second after 10 seconds
  player.addComponent(health);

  // Add Shield component with 250 max shield
  const shield = new Shield(25, 12.5, 3); // 250 max shield, 20/s regen, 5s delay
  player.addComponent(shield);

  const energy = new Energy(100, 25, 40, 2);
  player.addComponent(energy);

  // Add Collider component for environment collision and enemy damage detection
  const collider = world.createComponent(Collider);
  collider.type = ColliderType.SPHERE;
  collider.radius = 1.2; // Reduced collision radius for better player proximity in COOP
  collider.layer = CollisionLayer.PLAYER; // Use player layer for local player
  // Set collision mask to collide with environment and enemies only - NO player-to-player collision in COOP
  collider.setMask(CollisionLayer.ENVIRONMENT | CollisionLayer.ENEMY);
  collider.setOffset(0, 0.5, 0); // Center on player
  player.addComponent(collider);

  // Store player ID in userData for projectile source identification
  // Note: This will be updated when the socket ID becomes available
  player.userData = player.userData || {};
  player.userData.playerId = 'unknown';
  player.userData.isPlayer = true; // Mark as local player for manager systems

  world.notifyEntityAdded(player);
  return player;
}

function updateFPSCounter(fps: number) {
  const fpsElement = document.getElementById('fps-counter');
  if (fpsElement) {
    fpsElement.textContent = `FPS: ${fps}`;
  }
}

function setupCoopGame(
  engine: Engine,
  scene: Scene,
  camera: PerspectiveCamera,
  renderer: WebGLRenderer,
  damagePlayerCallback: (playerId: string, damage: number, damageType?: string, isCritical?: boolean) => void,
  damageEnemyCallback?: (
    enemyId: string,
    damage: number,
    sourcePlayerId?: string,
    meta?: EnemyDamageMeta,
  ) => void,
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null,
  skillPointData?: any,
  cameraSystemRef?: React.MutableRefObject<CameraSystem | null>,
  coopSpawnOptions?: { initialSpawn?: { x: number; y: number; z: number }; initialThroneMap?: boolean },
): { player: any; controlSystem: ControlSystem } {
  const world = engine.getWorld();
  const inputManager = engine.getInputManager();

  if (ENABLE_REALTIME_SHADOWS) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    // Don't rebuild the shadow map automatically every frame. A throttled useFrame
    // flips needsUpdate so dynamic (moving) shadow casters still update, but at ~half
    // the per-frame shadow-pass cost. See the shadow-throttle useFrame below.
    renderer.shadowMap.autoUpdate = false;
    renderer.shadowMap.needsUpdate = true;
  } else {
    renderer.shadowMap.enabled = false;
  }

  // Dynamic <pointLight> VFX (impacts, spells, projectiles) constantly change the
  // scene's light count, which forces three.js to recompile every lit material's
  // shader program. By default the renderer then calls getProgramInfoLog() after
  // each link — a SYNCHRONOUS GPU stall (the hot leaf in the profiler). Shaders are
  // known-good in prod, so skip the error read; compiles go async and stop blocking
  // the frame. This treats the symptom; the light-count churn itself is the root
  // cause to address next (pool dynamic lights so the count stays constant).
  renderer.debug.checkShaderErrors = false;

  // Create systems for coop mode (similar to PVP but without towers/pillars)
  const physicsSystem = new PhysicsSystem();
  const initialThroneMap = !!coopSpawnOptions?.initialThroneMap;
  const initialR = initialThroneMap ? COOP_THRONE_ROOM_RADIUS + 2 : MAIN_MAP_RADIUS;
  physicsSystem.setMapRadius(initialR);
  const collisionSystem = new CollisionSystem(5); // 5 unit cell size for spatial hash
  const combatSystem = new CombatSystem(world);
  const renderSystem = new RenderSystem(scene, camera, renderer);
  const projectileSystem = new ProjectileSystem(world);

  // Initialize Audio System (reuse if already created for UI sounds)
  const audioSystem = (window as any).audioSystem || new AudioSystem();

  // Make audio system globally available for UI sounds (if not already set)
  if (!(window as any).audioSystem) {
    (window as any).audioSystem = audioSystem;
  }

  const controlSystem = new ControlSystem(
    camera as PerspectiveCamera,
    inputManager,
    world,
    projectileSystem,
    audioSystem,
    selectedWeapons
  );
  controlSystem.setPlayableRadius(initialR);
  // Match throne-room physics toggles (see inThroneRoom effect). Applying here avoids a
  // one-frame / whole-session gap when the effect ran before PhysicsSystem was registered.
  const throneObstaclesForInit = initialThroneMap ? getThronePrepPhysicsObstacles() : null;
  physicsSystem.setCastleWallPhysicsEnabled(!initialThroneMap);
  physicsSystem.setThronePillarObstacles(throneObstaclesForInit);
  physicsSystem.setCornerMountainObstacles(null);
  controlSystem.setCastleWallChargeCollision(!initialThroneMap);
  controlSystem.setThroneChargePillars(throneObstaclesForInit);
  controlSystem.setChargeCornerMountains(null);
  const cameraSystem = new CameraSystem(
    camera as PerspectiveCamera,
    inputManager,
    {
      distance: 8,
      height: 2,
      mouseSensitivity: 0.005,
      smoothing: 0.15,
    }
  );

  // Store camera system reference if ref provided
  if (cameraSystemRef) {
    cameraSystemRef.current = cameraSystem;
  }

  // Expose camera system globally for effects access
  (window as any).cameraSystem = cameraSystem;
  controlSystem.setCameraSystem(cameraSystem);

  // Expose damage number manager globally for abilities
  (window as any).damageNumberManager = combatSystem.getDamageNumberManager();

  const interpolationSystem = new InterpolationSystem();

  // Connect systems
  projectileSystem.setCombatSystem(combatSystem);
  combatSystem.setCoopMode(true); // Enable cooperative mode (no player-to-player damage)

  // Set up damage callbacks
  if (damageEnemyCallback) {
    combatSystem.setEnemyDamageCallback(
      (
        enemyId: string,
        damage: number,
        sourcePlayerId?: string,
        meta?: EnemyDamageMeta,
        hitWorldPosition?: { x: number; y: number; z: number },
      ) => {
        if (meta?.damageType !== 'blizzard' && meta?.damageType !== 'icebeam') {
          if (meta?.damageType === 'crossentropy') {
            audioSystem.playCrossentropyImpactSound();
          } else {
            audioSystem.playUIHitboxSound(undefined, damage, hitWorldPosition);
          }
        }
        damageEnemyCallback(enemyId, damage, sourcePlayerId, meta);
      },
    );
  }
  combatSystem.setPlayerDamageCallback(damagePlayerCallback);

  // Add systems to world (order matters for dependencies)
  world.addSystem(physicsSystem);
  world.addSystem(collisionSystem);
  world.addSystem(combatSystem);
  world.addSystem(interpolationSystem); // Add interpolation system before render system
  world.addSystem(renderSystem);
  world.addSystem(projectileSystem);
  world.addSystem(audioSystem);
  world.addSystem(controlSystem);
  world.addSystem(cameraSystem);

  // Create player entity
  const playerEntity = createCoopPlayer(world, coopSpawnOptions?.initialSpawn);

  // Set player for control system and camera system
  controlSystem.setPlayer(playerEntity);
  cameraSystem.setTarget(playerEntity);
  cameraSystem.snapToTarget();

  // Set local player entity ID for combat system damage number filtering
  combatSystem.setLocalPlayerEntityId(playerEntity.id);

  // Set weapon level based on selected weapons
  const playerLevel = selectedWeapons ? getRuneCountForWeapon(selectedWeapons.primary, 1) + getRuneCountForWeapon(selectedWeapons.secondary, 1) : 1;
  controlSystem.setWeaponLevel(playerLevel);

  // Set skill point data for ability unlocks
  if (skillPointData) {
    controlSystem.setSkillPointData(skillPointData);
  }

  return { player: playerEntity, controlSystem };
}

