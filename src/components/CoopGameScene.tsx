'use client';

import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { unstable_batchedUpdates } from 'react-dom';
import { useThree, useFrame } from '@react-three/fiber';
import { Vector3, Matrix4, Camera, PerspectiveCamera, Scene, WebGLRenderer, PCFSoftShadowMap, Color, Quaternion, Euler, Group, AdditiveBlending, MeshBasicMaterial, Mesh, MeshStandardMaterial, PointLight } from '@/utils/three-exports';
import DragonRenderer from './dragon/DragonRenderer';
import CharacterRenderer from './character/CharacterRenderer';
import { warmupCharacterIdleGltf, warmupCharacterLocomotionGltf } from '@/components/character/CharacterModel';
import SummonedBossSkeleton from './enemies/SummonedBossSkeleton';
import KnightRenderer from './enemies/KnightRenderer';
import AlliedKnightRenderer from './enemies/AlliedKnightRenderer';
import AlliedHealerRenderer from './enemies/AlliedHealerRenderer';
import GreaterHealBeamEffect from './enemies/GreaterHealBeamEffect';
import KnightDeathVortex from './enemies/KnightDeathVortex';
import ShadeRenderer from './enemies/ShadeRenderer';
import ShadeDaggerProjectile from './enemies/ShadeDaggerProjectile';
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
import BossTeleportEffect from './enemies/BossTeleportEffect';
import BossLeapTelegraph from './enemies/BossLeapTelegraph';
import BossSpearProjectile from './enemies/BossSpearProjectile';
import BossLeapShockwave, { type LeapShockwaveVariant } from './enemies/BossLeapShockwave';
import Boss2ArchonLightning from './enemies/Boss2ArchonLightning';
import Boss3NovaDiscs, { type Boss3NovaBurst } from './enemies/Boss3NovaDiscs';
import TitanStompShockwave, { type TitanStompShockwaveBurst } from './enemies/TitanStompShockwave';
import TitanCannonAbility from './enemies/TitanCannonAbility';
import GoldPileDropEffect from './enemies/GoldPileDropEffect';
import GoldCollectMoteEffect from './enemies/GoldCollectMoteEffect';
import BowShotImpact from './weapons/BowShotImpact';
import EntropicBoltImpact from './weapons/EntropicBoltImpact';
import SabreImpactEffect from './weapons/SabreImpactEffect';
import CrescentSlashEffect from './weapons/CrescentSlashEffect';
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
import BossTectonicSpike from './enemies/BossTectonicSpike';
import BossTectonicSpikeTelegraph, {
  POST_SPIKE_CRACK_HOLD_MS,
  TECTONIC_HIT_RADIUS,
} from './enemies/BossTectonicSpikeTelegraph';
import SpikeGroundCracksVfx from './environment/SpikeGroundCracksVfx';
import TemplarBlinkSmiteGround from './enemies/TemplarBlinkSmiteGround';
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
import CoopPvpAbilityLayer, { type CoopPvpAbilityLayerHandle } from './coop/CoopPvpAbilityLayer';
import type {
  BossLeapShockwaveState,
  BossSpearState,
  CloudkillArrowState,
  CrossentropyMeteorState,
  DualityBlizzardState,
  GoldCollectMoteState,
  KnightFrostProjectileState,
  MeteorState,
  ShadeDaggerState,
  ViperArrowState,
  WarlockFlameStrikeState,
  WarlockProjectileState,
  WeaverLightningState,
} from './coop/coopVfxLayerTypes';
import { useMultiplayerActions, useMultiplayerRoom, Player, EnemyDamageMeta, type Enemy as ServerEnemy, type GoldDrop, type PlayerMovementDirection, type BroadcastPlayerAttackAnimationData } from '@/contexts/MultiplayerContext';
import { SkillPointData } from '@/utils/SkillPointSystem';
import { AbilityLoadout, getDefaultLoadoutForWeapon } from '@/utils/weaponAbilities';
import {
  TENTACLE_GROUND_TELEGRAPH_LEAD_MS,
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
  getArcticBlizzardDamagePerTickFromStats,
  getArcticBlizzardHitRadius,
  getRunebladeBlizzardStormHitRadius,
  getBlizzardParticleSpawnMultiplier,
  getDualCoilLateralVector,
  CROSSENTROPY_MAX_TRAVEL_DISTANCE,
  REANIMATE_SUNWELL_HEAL,
  shouldApplyBlizzardTalent,
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
  type FanOfKnivesFlourishTint,
  CROSSENTROPY_PLAGUE_VENOM_MS,
} from '@/utils/talents';
import { StatSystem, StatPointData, type PlayerStats } from '@/utils/StatSystem';
import { ITEM_RARITY_COLORS, isItemRarity } from '@/utils/itemRarity';
import { setGlobalAgilityStatPoints, setGlobalStrengthStatPoints } from '@/core/DamageCalculator';
import { logJsHeapSnapshotDev } from '@/utils/coopMemoryDebug';
import { isBowPerfectShotProgress } from '@/utils/bowConstants';
import { getRuneCountForWeapon } from '@/utils/runeCount';
import { registerEnemyAttackTelegraphSounds } from '@/utils/enemyTelegraphSound';

const ZERO_PLAYER_STATS: PlayerStats = { strength: 0, stamina: 0, agility: 0, intellect: 0 };

// Import our ECS systems
import { Engine } from '@/core/Engine';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { DestructibleMushroom } from '@/ecs/components/DestructibleMushroom';
import { Shield } from '@/ecs/components/Shield';
import { Enemy, EnemyType, capFreezeMsForEnemy } from '@/ecs/components/Enemy';

import { Renderer } from '@/ecs/components/Renderer';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Entity } from '@/ecs/Entity';
import { InterpolationBuffer } from '@/ecs/components/Interpolation';
import { RenderSystem } from '@/systems/RenderSystem';
import { ControlSystem, type RoomBoomDashPayload, type RoomBoomDashVariant } from '@/systems/ControlSystem';
import { AudioSystem } from '@/systems/AudioSystem';
import { CameraSystem } from '@/systems/CameraSystem';
import { ProjectileSystem } from '@/systems/ProjectileSystem';
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
import BowPowershotManager from '@/components/projectiles/BowPowershotManager';
import FrostNovaManager, { addGlobalFrozenEnemy } from '@/components/weapons/FrostNovaManager';
import ArcticBlizzardManager from '@/components/weapons/Blizzard/ArcticBlizzardManager';
import Blizzard from '@/components/weapons/Blizzard/Blizzard';
import StunManager, { addGlobalStunnedEnemy } from '@/components/weapons/StunManager';
import EntangleManager, { addGlobalEntangledEnemy } from '@/components/weapons/EntangleManager';
import IgniteEffectManager from '@/components/weapons/IgniteEffectManager';
import FireStormManager from '@/components/weapons/FireStormManager';

import CobraShotManager from '@/components/projectiles/CobraShotManager';

import RejuvenatingShotManager from '@/components/projectiles/RejuvenatingShotManager';
import ThrowSpearManager, { triggerGlobalThrowSpear } from '@/components/projectiles/ThrowSpearManager';
import {
  useOptimizedPVPEffects
} from '@/components/pvp/OptimizedPVPManagers';
import { pvpObjectPool } from '@/utils/PVPObjectPool';
import { pvpStateBatcher, PVPStateUpdateHelpers } from '@/utils/PVPStateBatcher';
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
import HexCombatArena, { HEX_ARENA_RADIUS } from '@/components/environment/HexCombatArena';
import { CoopMainArenaPortals } from '@/components/environment/CoopMainArenaPortals';
import ThroneRoom, {
  COOP_DEV_LOCALHOST_FEATURES,
  COOP_THRONE_ROOM_RADIUS,
  THRONE_ABILITY_PEDESTAL_INTERACT_RADIUS,
  THRONE_ABILITY_PEDESTAL_POSITION,
  THRONE_TALENT_PEDESTAL_POSITION,
  THRONE_PORTAL_POSITION,
  THRONE_PORTAL_POSITIONS,
  THRONE_DEV_BOSS_PORTAL_INTERACT_RADIUS,
  THRONE_DEV_BOSS_PORTAL_POSITION,
  THRONE_DEV_BOSS2_PORTAL_POSITION,
  THRONE_DEV_BOSS3_PORTAL_POSITION,
  MAIN_COMBAT_CHOICE_PORTAL_POSITIONS,
  MAIN_COMBAT_BOSS_PORTAL_POSITION,
  MAIN_COMBAT_PEDESTAL_POSITION,
  MAIN_COMBAT_PEDESTAL_INTERACT_RADIUS,
  THRONE_PILLAR_POSITIONS,
  THRONE_WEAPON_INTERACT_DEFS,
  THRONE_WEAPON_INTERACT_RADIUS,
  normalizeCoopPortalKind,
  getThronePrepPhysicsObstacles,
} from '@/components/environment/ThroneRoom';
import CombatArenaPedestal from '@/components/environment/CombatArenaPedestal';
import MerchantNpcRenderer from '@/components/environment/MerchantNpcRenderer';
import CastleWallCollision from '@/components/environment/CastleWallCollision';
import PillarCollision from '@/components/environment/PillarCollision';
import { MAIN_ARENA_HEX_RADIUS, MAIN_MAP_RADIUS, clampToMainArenaXZ } from '@/utils/mapConstants';
import { COOP_MAIN_ENTRY_Z, rotationYTowardArenaCenter } from '@/utils/coopArenaLayout';
import { KNIGHT_SMITE_RADIUS_BASE } from '@/utils/knightCoopAbilitiesConstants';
import { MUSHROOM_COUNT, buildMushroomInstances, getMushroomColliderCenter } from '@/utils/mushroomLayout';
import { MUSHROOM_MAX_HP } from '@/utils/mushroomConstants';
import MushroomEruptionVfx from '@/components/environment/MushroomEruptionVfx';

/** Default main combat entry Z (ring centered here; matches server `teleportAllPlayersToCombatSpawn`). */
const COOP_MAIN_DEFAULT_SPAWN_Z = COOP_MAIN_ENTRY_Z;
import { useBowPowershot } from '@/components/projectiles/useBowPowershot';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';
import PVPSummonTotemManager from '@/components/projectiles/PVPSummonTotemManager';
import { ExperienceSystem } from '@/utils/ExperienceSystem';
import DynamicLightPool, { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { calculationCache } from '@/utils/CalculationCache';
import { Text } from '@react-three/drei';

const BossRenderer = React.lazy(() => import('./enemies/BossRenderer'));
const Boss2Renderer = React.lazy(() => import('./enemies/Boss2Renderer'));
const Boss3Renderer = React.lazy(() => import('./enemies/Boss3Renderer'));
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

/**
 * In-canvas perf helper. Two jobs, both cheap and isolated:
 *  1. Throttled shadow-map refresh. `renderer.shadowMap.autoUpdate` is disabled in
 *     setupCoopGame, so we flip `needsUpdate` every other frame — dynamic shadow
 *     casters still move, but the shadow pass runs ~half as often.
 *  2. Optional draw-call HUD. Append `?perf=1` to the URL to show live
 *     `gl.info.render` stats (draw calls / triangles / programs) so renderBufferDirect
 *     cost can be measured before/after changes. Off by default, zero prod overhead.
 */
function RenderPerfHud() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const frame = useRef(0);
  const hudRef = useRef<HTMLDivElement | null>(null);
  const seenProgramKeys = useRef<Set<string>>(new Set());

  const showHud = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).has('perf');
  }, []);

  useEffect(() => {
    if (!showHud) return;
    const el = document.createElement('div');
    el.style.cssText =
      'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;' +
      'font:12px/1.4 monospace;color:#9effa0;background:rgba(0,0,0,0.6);' +
      'padding:4px 8px;border-radius:4px;pointer-events:none;white-space:pre';
    document.body.appendChild(el);
    hudRef.current = el;
    return () => {
      el.remove();
      hudRef.current = null;
    };
  }, [showHud]);

  // Memory-leak diagnostic: window.erebusMemStats() snapshots every suspect at once.
  // Call it a minute apart while playing; whichever number climbs without bound is the
  // leak (geometries/textures = undisposed GPU buffers; sceneObjects = lingering
  // meshes; cache sizes = unbounded caches; heapMB = overall).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).erebusMemStats = () => {
      let sceneObjects = 0;
      let meshes = 0;
      let instancedMeshes = 0;
      let lights = 0;
      let shadowCasters = 0;
      scene.traverse((o: any) => {
        sceneObjects++;
        if (o.isInstancedMesh) instancedMeshes++;
        else if (o.isMesh || o.isSkinnedMesh) meshes++;
        if (o.isLight) lights++;
        if (o.castShadow) shadowCasters++;
      });
      const mem = (performance as { memory?: { usedJSHeapSize: number } }).memory;
      const stats = {
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : 'n/a',
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
        sceneObjects,
        meshes,
        instancedMeshes,
        lights,
        shadowCasters,
        drawCalls: gl.info.render.calls,
        calcCache: calculationCache.getStats?.() ?? 'n/a',
      };
      // eslint-disable-next-line no-console
      console.table(stats);
      return stats;
    };
    return () => {
      delete (window as any).erebusMemStats;
    };
  }, [gl, scene]);

  useFrame(() => {
    const f = (frame.current = (frame.current + 1) % 1_000_000);

    // 1. Pin compiled shader programs so three.js never evicts (and later recompiles)
    //    them. three.js destroys a program when its last material is disposed
    //    (WebGLPrograms: `if (--program.usedTimes === 0) program.destroy()`). Transient
    //    combat VFX spawn and despawn constantly, so a program whose users all despawn
    //    gets destroyed and must recompile on the next spawn — bursts of recompiles in
    //    one frame are the ~1s stalls when attacking a lot. Keeping usedTimes high means
    //    each shader variant compiles at most once per session (bounded, small memory).
    const programs = gl.info.programs;
    if (programs) {
      for (let i = 0; i < programs.length; i++) {
        (programs[i] as { usedTimes: number }).usedTimes = 1e9;
      }
    }

    // 2. Throttle the shadow pass to every other frame.
    if (!gl.shadowMap.autoUpdate) {
      gl.shadowMap.needsUpdate = f % 2 === 0;
    }

    // 3. DIAGNOSTIC (perf HUD only): when new shader programs appear, log their cache
    //    keys + the live scene light count, so we can see exactly what's churning.
    if (showHud) {
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
          // Skip the initial bulk warmup; only report incremental churn.
          let nPoint = 0, nDir = 0, nSpot = 0, nShadow = 0;
          scene.traverse((o: any) => {
            if (!o.visible || !o.isLight) return;
            if (o.isPointLight) nPoint++;
            else if (o.isDirectionalLight) nDir++;
            else if (o.isSpotLight) nSpot++;
            if (o.castShadow) nShadow++;
          });
          // eslint-disable-next-line no-console
          console.warn(
            `[perf] +${fresh.length} new programs (total ${seenProgramKeys.current.size}). ` +
            `lights: point=${nPoint} dir=${nDir} spot=${nSpot} shadow=${nShadow}`,
            fresh.map((k) => k.slice(0, 120)),
          );
        }
      }
    }

    // 4. Sample draw-call stats ~4x/sec for the HUD.
    if (showHud && hudRef.current && f % 15 === 0) {
      const info = gl.info;
      hudRef.current.textContent =
        `draws ${info.render.calls}  tris ${info.render.triangles.toLocaleString()}\n` +
        `geom ${info.memory.geometries}  tex ${info.memory.textures}  prog ${info.programs?.length ?? 0}  dpr ${gl.getPixelRatio().toFixed(2)}`;
    }
  });

  return null;
}

/**
 * Renders death/spawn VFX once, far offscreen, during the loading window so their shader
 * variants (transparent / depth / additive) compile behind the loading screen instead of
 * stalling the first time they appear in gameplay (e.g. the first ally death). The
 * program-pin in RenderPerfHud then keeps the compiled programs resident for the session.
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

      {/* Standard shadowed opaque — enemy bodies, props, arena geometry.
          Having castShadow+receiveShadow here ensures the shadow-map variant
          compiles before the first enemy renders it. */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.01, 0.01, 0.01]} />
        <meshStandardMaterial color="#4a5b6c" metalness={0.9} roughness={0.1} />
      </mesh>

      {/* Low-metalness opaque — wooden/stone surfaces, handle wrappings, floor tiles. */}
      <mesh castShadow receiveShadow>
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
  isViperStingCharging: boolean;
  viperStingChargeProgress: number;
  isBarrageCharging: boolean;
  barrageChargeProgress: number;
  isCobraShotCharging: boolean;
  cobraShotChargeProgress: number;
  isSkyfalling: boolean;
  isBackstabbing: boolean;
  isSundering: boolean;
  isCorruptedAuraActive: boolean;
  isFrozen: boolean;
  isIcebeaming: boolean;
  tempestBurstShotSeq: number;
};

const PROGRESS_EPSILON = 0.03;

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
    'isViperStingCharging',
    'isBarrageCharging',
    'isCobraShotCharging',
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
  const lightRef = useRef<PointLight>(null);

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

    if (lightRef.current) lightRef.current.intensity = 4 * opacity;

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

      <pointLight ref={lightRef} color="#22c95e" intensity={0} distance={5} decay={2} />
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
        case 'allied-healer':
          void import('./enemies/AlliedHealerModel').then(mod => mod.preloadAlliedHealerModels());
          break;
        case 'ghoul':
          void import('./enemies/GhoulModel').then(mod => mod.preloadGhoulModels());
          break;
        case 'shade':
          void import('./enemies/ShadeModel').then(mod => mod.preloadShadeModels());
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
          break;
        case 'viper':
          void import('./enemies/ViperModel').then(mod => mod.preloadViperModels());
          break;
        case 'zombie':
        case 'player-zombie':
          void import('./enemies/ZombieModel').then(mod => mod.preloadZombieModels());
          break;
        case 'martyr':
          void import('./enemies/MartyrModel').then(mod => mod.preloadMartyrModels());
          break;
        case 'titan':
          void import('./enemies/TitanModel').then(mod => mod.preloadTitanModels());
          break;
        case 'boss':
          void import('./enemies/BossGlbModel').then(mod => mod.preloadBossModels());
          break;
        case 'greed':
          void import('./enemies/GreedModel').then(mod => mod.preloadGreedModels());
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
    import('./enemies/TemplarRenderer'),
    import('./enemies/TitanRenderer'),
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
    import('./enemies/MartyrModel').then((mod) => { mod.preloadMartyrModels(); }),
    import('./enemies/BossGlbModel').then((mod) => { mod.preloadBossModels(); }),
    import('./enemies/TitanModel').then((mod) => { mod.preloadTitanModels(); }),
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
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
  }) => void;
  onControlSystemUpdate?: (controlSystem: any) => void;
  onExperienceUpdate?: (experience: number, level: number) => void;
  onPlayerLevelUp?: (level: number) => void;
  onEssenceUpdate?: (essence: number) => void;
  onGoldUpdate?: (gold: number) => void;
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
  /** Open ability customization for the given throne weapon (co-op prep room). */
  onRequestThroneAbilityModal?: (weapon: WeaponType) => void;
  /** Open talent customization for the given throne weapon (co-op prep room). */
  onRequestThroneTalentModal?: (weapon: WeaponType) => void;
  /** After equipping a weapon from a throne pedestal (co-op prep) — e.g. roll class boons. */
  onThroneWeaponEquipped?: (weapon: WeaponType) => void;
  /** When true (dev), `T` near the talent pillar opens the talent modal without competing with `X` + ability pillar. */
  throneDevTalentShortcutEnabled?: boolean;
  /** True when the room is cleared and the combat pedestal is waiting to be interacted with (aura shown). */
  pedestalBoonReady?: boolean;
  /** True after the player has interacted with the pedestal and picked (or skipped) the boon — portals become colored and usable. */
  portalsUnlocked?: boolean;
  /** Called when the player presses X near the combat pedestal in the main arena. */
  onCombatArenaPedestalInteract?: (rewardKind?: string | null) => void;
  /** Merchant dash charge purchased this run — grants a 4th dash orbital. */
  extraDashChargePurchased?: boolean;
  /** Proximity hint above the HUD health bar ("Press 'x' to interact"). */
  onInteractHintChange?: (hint: string | null) => void;
  /** Local player died — e.g. show defeat UI. */
  onLocalPlayerDefeated?: () => void;
  /** Local player respawned/revived — e.g. hide defeat UI. */
  onLocalPlayerRevived?: () => void;
}

const COOP_INTERACT_HINT_TEXT = "Press 'x' to interact";

/** X / click pickup radius for server-synced ground drops (XZ); matches interact hint. */
const COOP_GROUND_ITEM_PICKUP_RADIUS = 6;

// Taunt Effect Indicator Component
function TauntEffectIndicator({ position }: { position: Vector3 }) {
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
    <group position={position}>
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
      onClick={handleClick}
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
          <pointLight color={color} intensity={3.0} distance={5} />
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
          <pointLight color={color} intensity={1.5} distance={3} />
        </>
      )}
    </group>
  );
}

/** Throne training dummy — memoized `Vector3` so parent re-renders do not allocate every frame. */
function ThroneTrainingDummyEntry({ enemy }: { enemy: ServerEnemy }) {
  const position = useMemo(
    () => new Vector3(enemy.position.x, enemy.position.y, enemy.position.z),
    [enemy.position.x, enemy.position.y, enemy.position.z],
  );
  const rot = enemy.rotation || 0;
  const st = enemy.staggerBuildup ?? 0;

  return (
    <KnightRenderer
      id={enemy.id}
      position={position}
      rotation={rot}
      health={enemy.health}
      maxHealth={enemy.maxHealth}
      isDying={false}
      soulType="yellow"
      campType="yellow"
      showMeleeRangeRing={false}
      staggerBuildup={st}
    />
  );
}

/** PhysicsSystem clamps player Y to sphere center at ~0.5; mirror for remote ECS Movement (humanoid locomotion clips). */
const REMOTE_PLAYER_CHARACTER_GROUND_Y = 0.5;
const scratchRemoteMovementXZ = new Vector3();
const scratchRemoteDashDirectionXZ = new Vector3();
const _remoteInterpPosScratch = new Vector3();
const _remoteInterpRotScratch = new Quaternion();
const _remoteInterpEulerScratch = new Euler();

function buildPlayerMovementDirectionPayload(movement: Movement): PlayerMovementDirection {
  const isDashing = movement.isDashing && movement.dashDirection.lengthSq() > 0.0001;
  const locomotionDirection = isDashing ? movement.dashDirection : movement.moveDirection;
  const hasLocomotionDirection = locomotionDirection.lengthSq() > 0.0001;
  const inputStrength = isDashing
    ? Math.max(1, movement.inputStrength)
    : movement.inputStrength;

  return {
    x: hasLocomotionDirection ? locomotionDirection.x : 0,
    y: hasLocomotionDirection ? locomotionDirection.y : 0,
    z: hasLocomotionDirection ? locomotionDirection.z : 0,
    inputStrength,
    isGrounded: movement.isGrounded,
    isDashing: movement.isDashing,
    dashDirection: {
      x: movement.dashDirection.x,
      y: movement.dashDirection.y,
      z: movement.dashDirection.z,
    },
    isAttackSlowed: movement.isAttackSlowed,
    isIcebeaming: movement.isIcebeaming,
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
};

/** Remote players use `movement.canMove = false`; PhysicsMovement never fills `Movement`. CharacterRenderer animates off `Movement`. */
function syncRemoteMovementForHumanoidAnimations(
  movement: Movement,
  serverPlayer: { position: { x: number; y: number; z: number }; movementDirection?: PlayerMovementDirection },
): void {
  movement.velocity.set(0, 0, 0);
  movement.acceleration.set(0, 0, 0);
  const md = serverPlayer.movementDirection;
  if (!md) {
    movement.isGrounded = serverPlayer.position.y <= REMOTE_PLAYER_CHARACTER_GROUND_Y + 0.002;
    movement.moveDirection.set(0, 0, 0);
    movement.inputStrength = 0;
    movement.isDashing = false;
    movement.dashDirection.set(0, 0, 0);
    movement.isAttackSlowed = false;
    movement.isIcebeaming = false;
    return;
  }
  movement.isGrounded = md.isGrounded ?? (serverPlayer.position.y <= REMOTE_PLAYER_CHARACTER_GROUND_Y + 0.002);
  movement.isDashing = Boolean(md.isDashing);
  movement.isAttackSlowed = Boolean(md.isAttackSlowed);
  movement.isIcebeaming = Boolean(md.isIcebeaming);

  const dd = md.dashDirection;
  if (dd) {
    scratchRemoteDashDirectionXZ.set(dd.x, 0, dd.z);
    if (scratchRemoteDashDirectionXZ.lengthSq() > 0.0001) {
      movement.dashDirection.copy(scratchRemoteDashDirectionXZ.normalize());
    } else {
      movement.dashDirection.set(0, 0, 0);
    }
  } else {
    movement.dashDirection.set(0, 0, 0);
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
  onMerchantUIUpdate,
  onSceneReady,
  selectedWeapons,
  skillPointData,
  statPointData,
  abilityLoadout,
  throneAbilityModalOpen = false,
  onRequestThroneAbilityModal,
  onRequestThroneTalentModal,
  onThroneWeaponEquipped,
  throneDevTalentShortcutEnabled = false,
  pedestalBoonReady = false,
  portalsUnlocked = false,
  onCombatArenaPedestalInteract,
  extraDashChargePurchased = false,
  onInteractHintChange,
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
    updatePlayerPosition,
    updatePlayerWeapon,
    updatePlayerHealth,
    updatePlayerShield,
    broadcastPlayerAttack,
    broadcastPlayerAbility,
    broadcastPlayerAnimationState,
    broadcastPlayerEffect, // For broadcasting venom effects
    broadcastPlayerDamage, // For broadcasting player damage
    broadcastPlayerHealing, // For broadcasting player healing
    broadcastPlayerDebuff, // For broadcasting debuff effects
    broadcastPlayerStealth, // For broadcasting stealth state
    broadcastPlayerTornadoEffect, // For broadcasting tornado effects
    broadcastPlayerDeathEffect, // For broadcasting death effects
    broadcastPlayerKnockback, // For broadcasting knockback effects
    damageEnemy, // New function for enemy damage with source player tracking
    subscribeEnemyDamage,
    damageMushroom,
    detonateWyvernConcentratedVenom,
    triggerTyrantsCloakStrike,
    applyStatusEffect, // For applying status effects to enemies (freeze, slow, corrupted)
    updatePlayerEssence,
    openChat,
    closeChat,
    setSelectedWeapons,
    setAbilityLoadout,
    pickupItem,
    pickupGoldDrop,
    registerMerchantPurchaseSuccessHandler,
    registerMerchantNpcGreetHandler,
    registerPlayerGoldChangedHandler,
  } = useMultiplayerActions();

  const {
    players,
    enemies,
    gameStarted,
    combatArenaActive,
    gameMode,
    isInRoom,
    currentRoomId,
    mushroomState,
    isChatOpen,
    talentLoadout,
    droppedItems,
    goldDrops,
    inventory,
    campTypes,
    thronePortalOffer,
    coopMainArenaPortalPhase,
    coopBossThroneArena,
    coopCombatArenaEnterSeq,
    coopMainArenaIntermissionSeq,
    coopTransitionOverlay,
    coopClearedRoomColor,
    coopTerrainTheme,
    coopCurrentRoomKind,
    coopClearedRoomKind,
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

  const talentLoadoutRef = useRef(talentLoadout);
  const lastRebukeTimeSecRef = useRef(0);
  const lastTyrantsCloakTimeSecRef = useRef(0);
  const lastOrbShieldTimeSecRef = useRef(0);
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
    || coopCurrentRoomKind === 'merchant';
  const hexArenaVariant =
    coopCurrentRoomKind === 'merchant' ? 'merchant' as const : 'stat' as const;

  const coopArenaClampBounds = useMemo(() => {
    if (inThroneRoom || inBossThroneArena) return COOP_THRONE_ROOM_RADIUS;
    if (isHexCombatArena) return HEX_ARENA_RADIUS;
    return MAIN_ARENA_HEX_RADIUS;
  }, [inThroneRoom, inBossThroneArena, isHexCombatArena]);

  const dimThroneLikeLighting = inThroneRoom || inBossThroneArena;

  const effectiveMushroomHealth = useMemo(() => {
    if (mushroomState?.health?.length === MUSHROOM_COUNT) return mushroomState.health;
    return Array.from({ length: MUSHROOM_COUNT }, () => MUSHROOM_MAX_HP);
  }, [mushroomState]);

  const mushroomHiddenIndices = useMemo(() => {
    const s = new Set<number>();
    effectiveMushroomHealth.forEach((h, i) => {
      if (h <= 0) s.add(i);
    });
    return s;
  }, [effectiveMushroomHealth]);

  const mushroomTargetsForMelee = useMemo(() => {
    const instances = buildMushroomInstances();
    const out: Array<{ index: number; position: Vector3 }> = [];
    for (const inst of instances) {
      if (effectiveMushroomHealth[inst.index] > 0) {
        const c = getMushroomColliderCenter(inst);
        out.push({ index: inst.index, position: new Vector3(c.x, c.y, c.z) });
      }
    }
    return out;
  }, [effectiveMushroomHealth]);

  const prevMushroomHealthRef = useRef<number[] | null>(null);
    // Reset the health snapshot whenever we enter a new combat room so the diff
  // effect below does not treat freshly-restored mushrooms as newly destroyed.
  useEffect(() => {
    prevMushroomHealthRef.current = null;
  }, [coopCombatArenaEnterSeq]);

  useEffect(() => {
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
  }, [effectiveMushroomHealth]);

  const onMushroomMeleeHit = useCallback(
    (index: number, baseDamage: number) => {
      damageMushroom(index, baseDamage, socket?.id);
    },
    [damageMushroom, socket?.id],
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
  /** Pending Viper line + arrow setTimeouts; cleared on socket effect cleanup. */
  const viperAttackScheduleTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  /** tentacle ground telegraph: per-enemy windup add/failsafe timers */
  const tentacleSpinePendingByEnemyRef = useRef<
    Map<string, { tAdd: ReturnType<typeof setTimeout>; tFail: ReturnType<typeof setTimeout>; lineId: string }>
  >(new Map());
  // Alternating damage-sound variant (1 or 2) for knight and templar
  const knightDamageVariant = useRef<1 | 2>(1);
  const templarDamageVariant = useRef<1 | 2>(1);
  const shadeDamageVariant = useRef<1 | 2 | 3>(1);
  const lastTitanBladestormWhirwindAt = useRef(0);
  const realTimePlayerPositionRef = useRef<Vector3>(new Vector3(0, 0.5, COOP_MAIN_DEFAULT_SPAWN_Z));
  const runebladeWhirlwindInstanceRef = useRef<number | undefined>(undefined);
  const remotePlayerWhirlwindInstancesRef = useRef<Map<string, number>>(new Map());
  const remotePlayerWhirlwindStartTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const _lastSetPlayerPositionMs = useRef<number>(0);
  const _scratchCamDir = useRef<Vector3>(new Vector3());
  const coopTransitionOverlayRef = useRef(false);
  useEffect(() => {
    coopTransitionOverlayRef.current = coopTransitionOverlay;
  }, [coopTransitionOverlay]);

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

    const unregisterPurchase = registerMerchantPurchaseSuccessHandler(() => {
      window.audioSystem?.playMerchantPurchaseGreet?.();
    });

    return () => {
      unregisterGreet();
      unregisterPurchase();
    };
  }, [registerMerchantNpcGreetHandler, registerMerchantPurchaseSuccessHandler]);
  // Real-time position refs for enemy players to enable ghost trail updates
  const enemyPlayerPositionRefs = useRef<Map<string, { current: Vector3 }>>(new Map());
  const [playerEntity, setPlayerEntity] = useState<any>(null);

  useEffect(() => {
    playerEntityRef.current = playerEntity?.id ?? null;
  }, [playerEntity]);

  /** Warlock orb wind-up duration — keep aligned with WarlockRenderer LAUNCH_ANIMATION_DURATION & warlock_launch.glb */
  const WARLOCK_ORB_CHARGE_MS = 1400;

  const projectileLayerRef = useRef<CoopProjectileLayerHandle>(null);
  const bossTelegraphLayerRef = useRef<CoopBossTelegraphLayerHandle>(null);
  const groundTelegraphLayerRef = useRef<CoopGroundTelegraphLayerHandle>(null);
  const pvpAbilityLayerRef = useRef<CoopPvpAbilityLayerHandle>(null);
  const bossMechanicLayerRef = useRef<CoopBossMechanicLayerHandle>(null);
  const explosionBurstLayerRef = useRef<CoopExplosionBurstLayerHandle>(null);
  const lightningBurstLayerRef = useRef<CoopLightningBurstLayerHandle>(null);
  const groundHazardLayerRef = useRef<CoopGroundHazardLayerHandle>(null);
  const summonRitualLayerRef = useRef<CoopSummonRitualLayerHandle>(null);
  const allyCombatLayerRef = useRef<CoopAllyCombatLayerHandle>(null);
  const combatFeedbackLayerRef = useRef<CoopCombatFeedbackLayerHandle>(null);
  const nextPlayerHitBurstId = useRef(0);
  const greaterHealImpactTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const environmentVfxLayerRef = useRef<CoopEnvironmentVfxLayerHandle>(null);
  const tentacleSpineLayerRef = useRef<CoopTentacleSpineLayerHandle>(null);
  const tentacleSpineFxRef = useRef<Map<string, { windSeq: number; slamSeq: number; dir: { x: number; z: number } }>>(new Map());

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

  const isCoopEnemyVisibleForRender = useCallback(
    (_enemyX: number, _enemyZ: number) => true,
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
  const onRequestThroneAbilityModalRef = useRef(onRequestThroneAbilityModal);
  onRequestThroneAbilityModalRef.current = onRequestThroneAbilityModal;
  const onRequestThroneTalentModalRef = useRef(onRequestThroneTalentModal);
  onRequestThroneTalentModalRef.current = onRequestThroneTalentModal;
  const onThroneWeaponEquippedRef = useRef(onThroneWeaponEquipped);
  onThroneWeaponEquippedRef.current = onThroneWeaponEquipped;
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
  /** Prevents spamming `pickup-gold-drop` each frame while waiting for server ack / expiry. */
  const pendingGoldAutoPickupRef = useRef(new Set<string>());
  const onInteractHintChangeRef = useRef(onInteractHintChange);
  onInteractHintChangeRef.current = onInteractHintChange;
  const lastInteractHintRef = useRef<string | null>(null);
  const initialWeaponsForEngineRef = useRef(
    selectedWeapons ?? { primary: WeaponType.NONE, secondary: WeaponType.NONE },
  );
  const selectedWeaponsRef = useRef(selectedWeapons ?? initialWeaponsForEngineRef.current);
  selectedWeaponsRef.current = selectedWeapons ?? initialWeaponsForEngineRef.current;

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
    if (inThroneRoom) {
      portalUseSentRef.current = false;
    }
  }, [inThroneRoom]);

  useEffect(() => {
    if (coopMainArenaPortalPhase) {
      portalUseSentRef.current = false;
    }
  }, [coopMainArenaPortalPhase]);

  useEffect(() => {
    portalUseSentRef.current = false;
  }, [coopCombatArenaEnterSeq, coopMainArenaIntermissionSeq]);

  // Layout: apply before paint so physics boundary mode matches the active arena shell.
  useLayoutEffect(() => {
    if (!engineRef.current || !gameStarted) return;
    const world = engineRef.current.getWorld();
    const phys = world.getSystem(PhysicsSystem);
    const r =
      inThroneRoom || inBossThroneArena
        ? COOP_THRONE_ROOM_RADIUS + 2
        : isHexCombatArena
          ? HEX_ARENA_RADIUS
          : MAIN_ARENA_HEX_RADIUS;
    const mainCoopRoom = !inThroneRoom && !inBossThroneArena && !isHexCombatArena;
    phys?.setMapRadius(r);
    phys?.setArenaBoundaryMode?.(isHexCombatArena ? 'hex' : 'circle');
    const throneObstacles = inThroneRoom ? getThronePrepPhysicsObstacles() : null;
    const castleWallsOn = false; // Main combat rooms use circular boundary projection; ECS wall boxes are projectile blockers.
    phys?.setCastleWallPhysicsEnabled(castleWallsOn);
    phys?.setArenaBoundaryMode?.(isHexCombatArena ? 'hex' : 'circle');
    phys?.setTreeCollisionEnabled?.(!mainCoopRoom);
    phys?.setThronePillarObstacles(throneObstacles);
    phys?.setCornerMountainObstacles(null);
    controlSystemRef.current?.setPlayableRadius(r);
    controlSystemRef.current?.setCastleWallChargeCollision(castleWallsOn);
    controlSystemRef.current?.setArenaBoundaryMode?.(isHexCombatArena ? 'hex' : 'circle');
    controlSystemRef.current?.setThroneChargePillars(throneObstacles);
    controlSystemRef.current?.setChargeCornerMountains(null);
  }, [inThroneRoom, inBossThroneArena, isHexCombatArena, gameStarted, engineReady]);

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

  useEffect(() => {
    if (prevInThroneRef.current && !inThroneRoom) {
      if (process.env.NODE_ENV === 'development') {
        logJsHeapSnapshotDev('Coop: left prep throne (after portal) — JS heap snapshot');
      }
      if (playerEntityRef.current !== null && engineRef.current && socket?.id) {
        const me = players.get(socket.id);
        if (me) {
          const ent = engineRef.current.getWorld().getEntity(playerEntityRef.current);
          const tr = ent?.getComponent(Transform);
          if (tr) {
            const c = clampToMainArenaXZ(me.position.x, me.position.z, coopArenaClampBounds);
            tr.setPosition(c.x, 0.5, c.z);
          }
        }
        cameraSystemRef.current?.snapToTarget();
      }
    }
    prevInThroneRef.current = inThroneRoom;
  }, [inThroneRoom, players, socket?.id, coopArenaClampBounds]);

  // Clear every live projectile when entering a new combat room so stale explosions
  // and AOE impacts from the previous room cannot carry over and damage mushrooms.
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady) return;
    if (coopCombatArenaEnterSeq === 0) return;
    const projectileSystem = engineRef.current.getWorld().getSystem(ProjectileSystem);
    projectileSystem?.clearAllProjectiles();
  }, [coopCombatArenaEnterSeq, gameStarted, engineReady]);

  /** `combat-arena-entered` (server teleports) or `coop-main-arena-intermission` (server state sync, no entry snap); align local ECS. */
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady) return;
    if (playerEntityRef.current === null || !socket?.id) return;
    if (coopCombatArenaEnterSeq === 0 && coopMainArenaIntermissionSeq === 0) return;
    const me = players.get(socket.id);
    if (!me) return;
    const ent = engineRef.current.getWorld().getEntity(playerEntityRef.current);
    const tr = ent?.getComponent(Transform);
    if (tr) {
      const c = clampToMainArenaXZ(me.position.x, me.position.z, coopArenaClampBounds);
      tr.setPosition(c.x, 0.5, c.z);
    }
    const movement = ent?.getComponent(Movement);
    if (movement) {
      movement.velocity.set(0, 0, 0);
      movement.acceleration.set(0, 0, 0);
    }
    cameraSystemRef.current?.snapToTarget();
    // Intentionally omit `players` from deps: run only when seq/engine gates change; `players` is fresh from that commit when seq bumps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coopCombatArenaEnterSeq, coopMainArenaIntermissionSeq, gameStarted, engineReady, socket?.id, coopArenaClampBounds]);

  /**
   * Local hero rotation follows the camera. Default orbit (theta=0) puts the camera on the "wrong" side
   * of the entry ring, so the character looks back toward the rim. Orbit 180° behind the facing-into-arena
   * yaw on each combat segment enter (teleport) so the first frame match server-facing remotes.
   */
  useEffect(() => {
    if (!engineRef.current || !gameStarted || !engineReady) return;
    if (coopCombatArenaEnterSeq === 0) return;
    if (playerEntityRef.current === null || !socket?.id) return;
    if (!cameraSystemRef.current) return;
    const me = players.get(socket.id);
    if (!me) return;
    const c = clampToMainArenaXZ(me.position.x, me.position.z, coopArenaClampBounds);
    const faceY = rotationYTowardArenaCenter(c.x, c.z);
    const phi = cameraSystemRef.current.getVerticalAngle();
    cameraSystemRef.current.setAngles(faceY + Math.PI, phi);
    cameraSystemRef.current.snapToTarget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coopCombatArenaEnterSeq, gameStarted, engineReady, socket?.id, coopArenaClampBounds]);

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

  // Disable control system input when chat or throne ability modal is open
  useEffect(() => {
    if (controlSystemRef.current) {
      const uiBlocksGame = isChatOpen || throneAbilityModalOpen;
      controlSystemRef.current.setInputDisabled(uiBlocksGame);
      controlSystemRef.current.setAllowAllInput(isChatOpen);
    }
  }, [isChatOpen, throneAbilityModalOpen]);

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
        .filter((e) => !e.isDying && e.health > 0 && e.alliedUnit !== true && e.type !== 'allied-knight' && e.type !== 'allied-healer' && e.type !== 'player-zombie')
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
      .filter((e) => !e.isDying && e.health > 0 && e.alliedUnit !== true && e.type !== 'allied-knight' && e.type !== 'allied-healer' && e.type !== 'player-zombie')
      .map((e) => {
        const live = enemyTransformsRef.current.get(e.id);
        const p = live?.position ?? e.position;
        return {
          id: e.id,
          position: new Vector3(p.x, p.y, p.z),
          health: e.health,
          maxHealth: e.maxHealth,
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
            onDamageNumbersUpdate?.([{
              id: `room-boon-bloodleech-${Date.now()}-${Math.random()}`,
              damage: strengthHeal,
              position,
              isCritical: false,
              timestamp: Date.now(),
              damageType: 'reanimate_healing',
            }]);
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
      onDamageNumbersUpdate,
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
  /** One-shot ECS death-freeze per enemy (co-op death VFX window). */
  const coopEnemyDeathFrozenRef = useRef<Set<string>>(new Set());
  const mushroomEntityByIndexRef = useRef<Map<number, number>>(new Map());

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
    debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted';
    position: Vector3;
    startTime: number;
    duration: number;
  }>>([]);
  const nextDebuffEffectId = useRef(0);
  const nextLocalPlayerFrozenEffectId = useRef(0);
  const nextLocalPlayerStunnedEffectId = useRef(0);

  const applyLocalPlayerStun = useCallback((durationMs: number, source: string) => {
    controlSystemRef.current?.stunPlayer(durationMs);
    pvpAbilityLayerRef.current?.addLocalPlayerStunned({
      id: nextLocalPlayerStunnedEffectId.current++,
      startTime: Date.now(),
      duration: durationMs,
    });

    if (!socket?.id || !cameraSystemRef.current) return;

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
  }, [socket?.id]);

  // Track active debuff indicators to prevent visual overcrowding
  // Key format: "playerId:debuffType" -> debuff effect id
  const activeDebuffIndicators = useRef<Map<string, number>>(new Map());

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
      const isBoss = enemy.type === 'boss' || enemy.type === 'boss2' || enemy.type === 'boss3';
      const isTitan = enemy.type === 'titan';
      if (!isBoss && !isTitan) return;
      explosionBurstLayerRef.current?.addDeathFlashExplosion({
        id: `death-flash-${event.enemyId}-${event.timestamp}`,
        position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
        scale: isTitan ? 'titan' : 'boss',
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
  const createPvpDebuffEffect = useCallback((playerId: string, debuffType: 'frozen' | 'slowed' | 'stunned' | 'corrupted', position: Vector3, duration: number = 5000) => {
    // Debug: Check if this is the local player
    const isLocalPlayer = playerId === socket?.id;
    
    // Check if there's already an active debuff indicator for this player and debuff type
    const indicatorKey = `${playerId}:${debuffType}`;
    const existingIndicatorId = activeDebuffIndicators.current.get(indicatorKey);
    
    // If there's already an active indicator, extend its duration instead of creating a new one
    if (existingIndicatorId !== undefined) {
      // Find and update the existing debuff effect
      pvpDebuffEffectsRef.current = pvpDebuffEffectsRef.current.map(effect => {
        if (effect.id === existingIndicatorId) {
          return {
            ...effect,
            duration: Math.max(effect.duration, duration),
            position: position.clone(),
          };
        }
        return effect;
      });
      
      // Apply the debuff to the local player's movement if this is targeting us
      if (isLocalPlayer && playerEntity) {
        const playerMovement = playerEntity.getComponent(Movement);
        if (playerMovement) {
          if (debuffType === 'frozen') {
            playerMovement.freeze(duration);
          } else if (debuffType === 'slowed') {
            playerMovement.slow(duration, 0.5); // 50% speed reduction
          } else if (debuffType === 'stunned') {
            playerMovement.freeze(duration); // Stun uses same movement restriction as freeze
          } else if (debuffType === 'corrupted') {
            playerMovement.applyCorrupted(duration); // Apply corrupted debuff with gradual recovery
          }
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
    
    // Track this new debuff indicator
    activeDebuffIndicators.current.set(indicatorKey, debuffEffect.id);
    pvpDebuffEffectsRef.current.push(debuffEffect);
    
    // Apply the debuff to the local player's movement if this is targeting us
    if (isLocalPlayer && playerEntity) {
      const playerMovement = playerEntity.getComponent(Movement);
      if (playerMovement) {
        if (debuffType === 'frozen') {
          playerMovement.freeze(duration);
        } else if (debuffType === 'slowed') {
          playerMovement.slow(duration, 0.5); // 50% speed reduction
        } else if (debuffType === 'stunned') {
          playerMovement.freeze(duration); // Stun uses same movement restriction as freeze
        } else if (debuffType === 'corrupted') {
          playerMovement.applyCorrupted(duration); // Apply corrupted debuff with gradual recovery
        }
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
  }, [socket?.id, playerEntity]);

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
  const onPvpDeathGraspHitEnemy = useCallback((
    enemyId: string,
    hitPosition: Vector3,
    attackerId: string,
  ) => {
    if (socket && currentRoomId) {
      socket.emit('enemy_damaged', {
        roomId: currentRoomId,
        enemyId,
        damage: 80,
        attackerId,
        position: { x: hitPosition.x, y: hitPosition.y, z: hitPosition.z },
      });
    }
  }, [socket, currentRoomId]);
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
  ) => {
    const id = nextRoomBoomEffectId.current++;
    if (variant === 'infernal') {
      bossTelegraphLayerRef.current?.addRoomBoomFlameStrike({ id, position: destination.clone() });
      (window as any).audioSystem?.playWeaponSound?.('scythe_cryoflame', destination, { volume: 0.75 });
    } else if (variant === 'glacial') {
      bossTelegraphLayerRef.current?.addRoomBoomFrostNova({ id, position: origin.clone(), startTime: Date.now(), duration: 1200 });
      (window as any).audioSystem?.playFrostNovaSound?.(origin);
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
        enemy.applyIgnite(durationMs, nowSec, entity.id.toString(), position.clone());
      } else {
        const sk = entity.userData?.coopServerEnemyType as string | undefined;
        const cappedMs = capFreezeMsForEnemy(enemy, durationMs, sk);
        enemy.freeze(cappedMs / 1000, nowSec, sk);
        addGlobalFrozenEnemy(entity.id.toString(), position.clone(), cappedMs);
      }
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
      damageEnemiesInRadius(payload.origin, GLACIAL_DASH_RADIUS, 0, {
        type: 'freeze',
        durationMs: GLACIAL_DASH_FREEZE_DURATION_MS,
      });
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
        onDamageNumbersUpdate?.([{
          id: `room-boom-mending-${Date.now()}-${Math.random()}`,
          damage: staminaHeal,
          position: payload.destination.clone().add(new Vector3(0, 1.6, 0)),
          isCritical: false,
          timestamp: Date.now(),
          damageType: 'reanimate_healing',
        }]);
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

    createRoomBoomDashVfx(payload.variant, payload.origin, payload.destination, lightningTarget);
    broadcastPlayerAbility('room_boom_dash', payload.destination, payload.direction, undefined, {
      variant: payload.variant,
      origin: { x: payload.origin.x, y: payload.origin.y, z: payload.origin.z },
      destination: { x: payload.destination.x, y: payload.destination.y, z: payload.destination.z },
      lightningTarget: lightningTarget ? { x: lightningTarget.x, y: lightningTarget.y, z: lightningTarget.z } : undefined,
    });
  }, [
    applyStatusEffect,
    broadcastPlayerAbility,
    broadcastPlayerHealing,
    createRoomBoomDashVfx,
    onDamageNumbersUpdate,
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

  }, [socket, players, playerEntityRef, engineRef, controlSystemRef, cameraSystemRef, broadcastPlayerDeathEffect, handlePlayerRespawn, onLocalPlayerDefeated]);


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

    setGlobalAgilityStatPoints(effectiveCombatStats.agility);

    const spellbladeActive = shouldApplySpellbladeTalent(talentLoadout, abilityLoadout ?? null);
    const parryActive = shouldApplyParryTalent(talentLoadout, abilityLoadout ?? null);
    let statsForShield = { ...effectiveCombatStats };
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
    const staminaDelta = effectiveCombatStats.stamina - prevStamina;
    prevEffectiveStaminaRef.current = effectiveCombatStats.stamina;

    const playerEntity = engineRef.current?.getWorld().getEntity(playerEntityRef.current ?? -1);
    if (playerEntity) {
      const health = playerEntity.getComponent(Health);
      if (health) {
        const baseMaxHealth = ExperienceSystem.getMaxHealthForLevel(playerLevel);
        const staminaBonus = StatSystem.getBonusMaxHealth(effectiveCombatStats);
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
  }, [statPointData, playerLevel, talentLoadout, abilityLoadout, effectiveCombatStats]);

  useEffect(() => {
    if (!extraDashChargePurchased || !engineReady || playerEntityRef.current === null) return;
    const world = engineRef.current?.getWorld();
    const ent = world?.getEntity(playerEntityRef.current);
    const movement = ent?.getComponent(Movement);
    if (movement && movement.maxDashCharges < 4) {
      movement.setMaxDashCharges(4);
    }
  }, [extraDashChargePurchased, engineReady]);

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
    isViperStingCharging: false,
    viperStingChargeProgress: 0,
    isBarrageCharging: false,
    barrageChargeProgress: 0,
    isCobraShotCharging: false,
    cobraShotChargeProgress: 0,
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
  const lastCommittedWeaponStateRef = useRef(weaponState);
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
  const lastEmittedNetworkHealthRef = useRef<{ health: number; maxHealth: number } | null>(null);
  const lastEmittedNetworkShieldRef = useRef<{ shield: number; maxShield: number } | null>(null);

  const triggerLocalPlayerDamageFeedback = useCallback(({
    damage,
    damageType = 'physical',
    position,
    shieldOnly = false,
    fatal = false,
  }: {
    damage: number;
    damageType?: string;
    position?: Vector3;
    shieldOnly?: boolean;
    fatal?: boolean;
  }) => {
    const intensity = Math.min(1, Math.max(0.18, damage / 85));
    const tone: PlayerDamageFeedbackTone = fatal ? 'fatal' : shieldOnly ? 'shield' : 'health';
    const shakeIntensity = shieldOnly ? intensity * 0.11 : 0.08 + intensity * 0.22;
    const shakeDuration = fatal ? 0.28 : Math.min(0.26, 0.11 + intensity * 0.13);

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
    onDamageNumbersUpdate?.([{
      id: `room-boon-orb-shield-${Date.now()}-${Math.random()}`,
      damage: healAmount,
      position,
      isCritical: false,
      timestamp: Date.now(),
      damageType: 'reanimate_healing',
    }]);

    const id = nextRoomBoomEffectId.current++;
    pvpAbilityLayerRef.current?.addRoomBoomMending({ id, position: vfxPosition });
    (window as any).audioSystem?.playScytheSunwellSound?.(vfxPosition);
  }, [
    broadcastPlayerHealing,
    engineRef,
    onDamageNumbersUpdate,
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

    const damageApplied = health.takeDamage(BLOOD_ORBS_DASH_HP_COST, Date.now() / 1000, ent, false);
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
    onDamageNumbersUpdate?.([{
      id: `room-boon-fatebreaker-${Date.now()}-${Math.random()}`,
      damage: healAmount,
      position,
      isCritical: false,
      timestamp: Date.now(),
      damageType: 'reanimate_healing',
    }]);
  }, [
    broadcastPlayerHealing,
    engineRef,
    onDamageNumbersUpdate,
    playerEntityRef,
    updatePlayerHealth,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAegisBlock = () => tryFatebreakerOnAegisBlock();
    window.addEventListener('aegis-block', onAegisBlock);
    return () => window.removeEventListener('aegis-block', onAegisBlock);
  }, [tryFatebreakerOnAegisBlock]);

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
  }) => {
    if (!damageApplied) return;

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
    });

    tryRebukeOnDamageTaken(attackerServerEnemyId, damageApplied);
    tryTyrantsCloakOnDamageTaken(attackerServerEnemyId, damageApplied);
    tryOrbShieldOnDamageTaken(attackerServerEnemyId, damageApplied);
    tryMomentumRiftOnDamageTaken(attackerServerEnemyId, damageApplied);
  }, [triggerLocalPlayerDamageFeedback, tryRebukeOnDamageTaken, tryTyrantsCloakOnDamageTaken, tryOrbShieldOnDamageTaken, tryMomentumRiftOnDamageTaken]);

  const getLocalPlayerPosition = useCallback((): Vector3 | null => {
    if (!playerEntity) return null;
    const t = playerEntity.getComponent(Transform);
    return t ? t.position.clone() : null;
  }, [playerEntity]);

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
  type RemotePlayerAnimState = {
    isCharging: boolean;
    chargeProgress: number;
    isSwinging: boolean;
    swordComboStep: 1 | 2 | 3;
    isSpinning: boolean;
    isSwordCharging: boolean;
    isDeflecting: boolean;
    isViperStingCharging: boolean;
    viperStingChargeProgress: number;
    isBarrageCharging: boolean;
    barrageChargeProgress: number;
    isCobraShotCharging: boolean;
    cobraShotChargeProgress: number;
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
  };
  const multiplayerPlayerStatesRef = useRef<Map<string, RemotePlayerAnimState>>(new Map());
  const [multiplayerPlayerStates, setMultiplayerPlayerStates] = useState<Map<string, RemotePlayerAnimState>>(
    () => new Map(),
  );
  
  // Perfect shot system
  const { createPowershotEffect } = useBowPowershot();
  
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
      if (data.hit) {
        (window as any).audioSystem?.playViperImpactSound?.(soundPosition);
      } else {
        (window as any).audioSystem?.playViperMissSound?.(soundPosition);
      }
    };

    socket.on('viper-attack-telegraph', handleViperAttackTelegraph);
    socket.on('viper-arrow-outcome', handleViperArrowOutcome);

    return () => {
      viperAttackScheduleTimeoutsRef.current.forEach(t => { clearTimeout(t); });
      viperAttackScheduleTimeoutsRef.current = [];
      socket.off('viper-attack-telegraph', handleViperAttackTelegraph);
      socket.off('viper-arrow-outcome', handleViperArrowOutcome);
    };
  }, [socket]);

  // Set up PVP event listeners for player actions and damage
  useEffect(() => {
    if (!socket) return;

    const getLocalPlayerEntity = () => {
      const id = playerEntityRef.current;
      if (id == null || !engineRef.current) return null;
      return engineRef.current.getWorld().getEntity(id) ?? null;
    };

    const unregisterEnemyTelegraphSounds = registerEnemyAttackTelegraphSounds(socket, {
      getEnemyPosition: (enemyId) => enemiesRef.current.get(enemyId)?.position,
    });

    const handleCoopRoomWhisper = (data: { roomColor?: string }) => {
      const c = data.roomColor?.toLowerCase();
      if (c === 'red' || c === 'blue' || c === 'green' || c === 'purple') {
        window.audioSystem?.playCoopRoomWhisperSound(c);
      }
    };

    const blockLocalDamageDuringCoopPortal = () => coopTransitionOverlayRef.current;

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
        const instance = remotePlayerWhirlwindInstancesRef.current.get(playerId);
        if (instance !== undefined) {
          window.audioSystem?.stopSound('runeblade_whirlwind', instance);
          remotePlayerWhirlwindInstancesRef.current.delete(playerId);
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
          // Trigger visual effect for Rejuvenating Shot projectile
          const { triggerGlobalRejuvenatingShot } = require('@/components/projectiles/RejuvenatingShotManager');
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);
          triggerGlobalRejuvenatingShot(position, direction);
          
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
        const projectileTypes = ['regular_arrow', 'charged_arrow', 'entropic_bolt', 'crossentropy_bolt', 'perfect_shot', 'barrage_projectile', 'fan_of_knives_projectile', 'burst_arrow'];
        if (projectileTypes.includes(data.attackType)) {
          // Skip creating projectiles for the local player's own attacks to prevent duplicates
          const localSocketId = (window as any).localSocketId;
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
                const speed = crossCfg.speed ?? 15;
                const lifetime = crossCfg.lifetime ?? 2.5;
                projectileSystem.createCrossentropyBoltProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed,
                    damage: crossCfg.damage ?? 90,
                    lifetime,
                    maxDistance: reaper
                      ? (crossCfg.maxDistance ?? CROSSENTROPY_MAX_TRAVEL_DISTANCE)
                      : crossCfg.maxDistance,
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
                // Create Barrage projectiles for PVP
                const barrageEntity = projectileSystem.createProjectile(
                  engineRef.current.getWorld(),
                  position,
                  direction,
                  attackerEntityId,
                  {
                    speed: 22,
                    damage: 30,
                    lifetime: 3,
                    maxDistance: 25,
                    piercing: false,
                    opacity: 0.8,
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
            const timeoutId = setTimeout(() => {
              remotePlayerWhirlwindStartTimeoutsRef.current.delete(playerId);
              const instance = window.audioSystem?.playRunebladeWhirlwindSound(chargeSpinPos);
              if (instance !== undefined) {
                remotePlayerWhirlwindInstancesRef.current.set(playerId, instance);
              }
            }, 450);
            remotePlayerWhirlwindStartTimeoutsRef.current.set(playerId, timeoutId);
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
            window.audioSystem.playEnemyRunebladeSwingHitSound(position);
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
            createRoomBoomDashVfx(variant, origin, destination, lightningTarget);
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
          createPvpSmiteEffect(data.playerId, position, undefined, {
            sequenceDelaySec: 0,
            infestedSmite,
            staggeringSmite,
            infernalSmite,
            vengeanceSmite,
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
                { sequenceDelaySec: ex.delaySec ?? 0, infestedSmite, staggeringSmite, infernalSmite, vengeanceSmite },
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

          // Create death grasp visual effect and taunt nearby bosses
          const position = new Vector3(data.position.x, data.position.y, data.position.z);
          const direction = new Vector3(data.direction.x, data.direction.y, data.direction.z);

          createPvpDeathGraspEffect(data.playerId, position, direction);

          // Show taunt effects on nearby bosses (Deathgrasp now taunts enemies)
          const tauntRange = 15; // Same range as backend
          enemies.forEach((enemy: any) => {
            if (enemy.type === 'boss' || enemy.type === 'boss2' || enemy.type === 'boss3') {
              const enemyPos = new Vector3(enemy.position.x, enemy.position.y, enemy.position.z);
              const distance = position.distanceTo(enemyPos);

              if (distance <= tauntRange) {
                // Create taunt visual effect on this boss
                createEnemyTauntEffect(enemy.id, 10000); // 10 seconds taunt duration
              }
            }
          });

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

          // Pass the entity so Health component can use Shield for damage absorption
          // Bypass invulnerability for PVP damage to allow rapid attacks like bursts to land multiple hits,
          // but respect deflect invulnerability (3 seconds) which is much longer than standard invulnerability (0.5s)
          const bypassInvulnerability = !health.isInvulnerable || health.invulnerabilityTimer <= 1.0;
          const healthBefore = health.currentHealth;
          const shieldBefore = shield?.currentShield;
          const damageApplied = health.takeDamage(
            data.damage,
            Date.now() / 1000,
            playerEntity,
            bypassInvulnerability
          );

          if (playerEntity) {
            const transform = playerEntity.getComponent(Transform);
            if (transform) {
              const isCritical = data.isCritical || false;
              const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
              if (damageNumberManager && damageNumberManager.addDamageNumber) {
                const incomingDamagePosition = transform.position.clone();
                incomingDamagePosition.y -= 0.5;

                if (damageApplied) {
                  damageNumberManager.addDamageNumber(
                    data.damage,
                    isCritical,
                    incomingDamagePosition,
                    data.damageType,
                    true
                  );
                } else if (data.damage > 0 && health.isAegisInvulnerable()) {
                  damageNumberManager.addDamageNumber(
                    0,
                    false,
                    incomingDamagePosition,
                    'aegis_blocked',
                    true,
                    undefined,
                    undefined,
                    'AEGIS'
                  );
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('aegis-block'));
                  }
                }
              }

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

      // Create damage number for visual feedback - ONLY for the local player being damaged
      // This prevents duplicate damage numbers from appearing on multiple screens
      if (onDamageNumbersUpdate && socket.id && data.targetPlayerId === socket.id) {
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
      if (data.targetPlayerId !== socket?.id) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      // Server applies damage after ~1000ms — wait slightly longer before calling it a miss
      const timer = setTimeout(() => {
        knightPendingMissTimers.current.delete(data.knightId);
        window.audioSystem?.playKnightMissSound(pos);
      }, 1100);
      knightPendingMissTimers.current.set(data.knightId, timer);
    };

    const clearTentacleSpineGroundTelegraph = (enemyId: string) => {
      const p = tentacleSpinePendingByEnemyRef.current.get(enemyId);
      if (p) {
        clearTimeout(p.tAdd);
        clearTimeout(p.tFail);
        tentacleSpinePendingByEnemyRef.current.delete(enemyId);
      }
      groundTelegraphLayerRef.current?.removeTentacleSpineTelegraphsByEnemyId(enemyId);
    };

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
      const eventTime = data.timestamp ?? Date.now();
      const lineId = `tentacle-tg-${enemyId}-${eventTime}`;
      const endAt = eventTime + TENTACLE_SPINE_WINDUP_MS;
      const startedAt = eventTime;

      clearTentacleSpineGroundTelegraph(enemyId);

      {
        const prevFx = tentacleSpineFxRef.current.get(enemyId) ?? { windSeq: 0, slamSeq: 0, dir: { x: 0, z: 1 } };
        tentacleSpineLayerRef.current?.updateFx(enemyId, {
          windSeq: prevFx.windSeq + 1,
          slamSeq: prevFx.slamSeq,
          dir: { x: data.dirX ?? 0, z: data.dirZ ?? 1 },
        });
        tentacleSpineFxRef.current.set(enemyId, {
          windSeq: prevFx.windSeq + 1,
          slamSeq: prevFx.slamSeq,
          dir: { x: data.dirX ?? 0, z: data.dirZ ?? 1 },
        });
      }

      const lineDelay = Math.max(0, TENTACLE_SPINE_WINDUP_MS - TENTACLE_GROUND_TELEGRAPH_LEAD_MS);
      const addTelegraph = () => {
        groundTelegraphLayerRef.current?.addTentacleSpineTelegraph({ id: lineId, enemyId, start: from.clone(), end: to.clone(), endAt, startedAt });
      };
      if (lineDelay <= 0) addTelegraph();
      const tAdd = setTimeout(addTelegraph, lineDelay);
      const tFail = setTimeout(() => {
        groundTelegraphLayerRef.current?.removeTentacleSpineTelegraph(lineId);
        if (tentacleSpinePendingByEnemyRef.current.get(enemyId)?.lineId === lineId) {
          tentacleSpinePendingByEnemyRef.current.delete(enemyId);
        }
      }, TENTACLE_SPINE_WINDUP_MS);
      tentacleSpinePendingByEnemyRef.current.set(enemyId, { tAdd, tFail, lineId });
    };

    const handleTentacleSpineSlamSocket = (data: {
      enemyId?: string;
      dirX?: number;
      dirZ?: number;
      position?: { x: number; y: number; z: number };
      lineLength?: number;
    }) => {
      const enemyId = data?.enemyId;
      if (!enemyId) return;
      clearTentacleSpineGroundTelegraph(enemyId);
      const dirX = data.dirX ?? 0;
      const dirZ = data.dirZ ?? 1;
      {
        const prevFx = tentacleSpineFxRef.current.get(enemyId) ?? { windSeq: 0, slamSeq: 0, dir: { x: 0, z: 1 } };
        const nextFx = { ...prevFx, slamSeq: prevFx.slamSeq + 1, dir: { x: dirX, z: dirZ } };
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
        const impactTime = Date.now();
        const lineId = `tentacle-impact-tg-${enemyId}-${impactTime}`;
        const finalLine = {
          id: lineId,
          enemyId,
          start: new Vector3(x, groundY, z),
          end: new Vector3(x + nx * lineLen, groundY, z + nz * lineLen),
          endAt: impactTime + 180,
          startedAt: impactTime,
        };
        groundTelegraphLayerRef.current?.removeTentacleSpineTelegraphsByEnemyId(enemyId);
        groundTelegraphLayerRef.current?.addTentacleSpineTelegraph(finalLine);
        setTimeout(() => {
          groundTelegraphLayerRef.current?.removeTentacleSpineTelegraph(lineId);
        }, 180);
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

      // Play alternating hit sound
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      window.audioSystem?.playKnightDamageSound(pos, knightDamageVariant.current);
      knightDamageVariant.current = knightDamageVariant.current === 1 ? 2 : 1;

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
              attackerServerEnemyId: data.knightId,
            });
          }
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
      window.audioSystem?.playEnemyRunebladeVoidGraspSound(start);
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
    }) => {
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
    }) => {
      applyServerDeathGraspPull(data);
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

        const healthBefore = health.currentHealth;
        const shieldBefore = shield?.currentShield;
        const damageApplied = health.takeDamage(data.damage, Date.now() / 1000, playerEntity, false);

        const transform = playerEntity.getComponent(Transform);
        if (transform) {
          const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
          if (damageNumberManager?.addDamageNumber) {
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

    // Blue Knight — Frost Ray (magic damage + 3s movement freeze)
    const handleKnightFrost = (data: any) => {
      if (data.targetPosition) {
        const p = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);
        allyCombatLayerRef.current?.addKnightFrostImpact({
          id: `knight-frost-impact-${data.knightId}-${Date.now()}`,
          position: p.clone(),
        });
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

        const healthBefore = health.currentHealth;
        const shieldBefore = shield?.currentShield;
        const damageApplied = health.takeDamage(data.damage, Date.now() / 1000, playerEntity, false);

        const transform = playerEntity.getComponent(Transform);
        if (transform) {
          const damageNumberManager = engineRef.current?.getWorld().getSystem(CombatSystem)?.getDamageNumberManager();
          if (damageNumberManager?.addDamageNumber) {
            const pos = transform.position.clone();
            pos.y -= 0.5;
            damageNumberManager.addDamageNumber(data.damage, false, pos, 'magical', true);
          }
          triggerAppliedLocalPlayerDamageFeedback({
            damage: data.damage,
            damageType: 'frost',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: transform.position,
            attackerServerEnemyId: data.knightId,
          });
        }

        if (shield) updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        if (wasAlive && health.isDead) handlePlayerDeath(socket.id, data.knightId);

        // Root movement briefly while still allowing the player to attack.
        const movement = playerEntity.getComponent(Movement);
        if (movement) {
          const freezeDuration = 3000;
          movement.freeze(freezeDuration);
          pvpAbilityLayerRef.current?.addLocalPlayerFrozen({
            id: nextLocalPlayerFrozenEffectId.current++,
            startTime: Date.now(),
            duration: freezeDuration,
          });
        }
      }
    };

    // Templar telegraph — schedule a miss sound; cancel it if a damage event arrives first
    const handleTemplarAttackTelegraph = (data: any) => {
      if (data.targetPlayerId !== socket?.id) return;
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      const timer = setTimeout(() => {
        templarPendingMissTimers.current.delete(data.templarId);
        window.audioSystem?.playTemplarMissSound(pos);
      }, 1100);
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

      // Play alternating hit sound
      const pos = new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
      window.audioSystem?.playTemplarDamageSound(pos, templarDamageVariant.current);
      templarDamageVariant.current = templarDamageVariant.current === 1 ? 2 : 1;

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
              attackerServerEnemyId: data.templarId,
            });
          }
        }

        if (shield) {
          updatePlayerShield(socket.id, shield.currentShield, shield.maxShield);
        }

        if (wasAlive && health.isDead) {
          handlePlayerDeath(socket.id, data.templarId);
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
                  window.audioSystem.playEnemyRunebladeSwingHitSound(position);
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

      if (data.effect?.type === 'venom') {
        const { targetPlayerId, position, duration } = data.effect;

        // Create venom effect on the target player (could be local player or other player)
        if (targetPlayerId && position) {
          const venomPosition = new Vector3(position.x, position.y, position.z);
          createPvpVenomEffect(targetPlayerId, venomPosition);
        }
      }

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
        
        createPvpDebuffEffect(targetPlayerId, debuffType, position, duration);
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

    const enqueueLocalPickupFloatingNumber = (
      amount: number,
      damageType: 'experience_gain' | 'gold_pickup',
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

    const handleGoldExpired = (data: { dropId?: string }) => {
      if (data?.dropId) pendingGoldAutoPickupRef.current.delete(data.dropId);
    };


    const handlePlayerHealing = (data: any) => {
      const { healingAmount, healingType, position, targetPlayerId, sourcePlayerId } = data;
      const lesserHealTypes = new Set(['smite', 'flurry', 'healing_stream', 'viper_sting', 'merchant', 'room_boon_fatebreaker', 'room_boon_force_of_nature']);
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
      const d = data.durationMs ?? 1100;
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
          durationMs: w + POST_SPIKE_CRACK_HOLD_MS,
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
        });
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
        });
      explosionBurstLayerRef.current?.addTeleportEffect({
          id: `${templarId}-teleport-end-${timestamp}`,
          position: new Vector3(endPosition.x, endPosition.y, endPosition.z),
          type: 'end' as const,
          timestamp,
        });
    };

    const handleTemplarBlinkSmiteImpact = (data: any) => {
      const { templarId, position, radius, damage, timestamp } = data;
      const id = `templar-blink-smite-${templarId}-${timestamp}`;
      const pos = new Vector3(position.x, position.y, position.z);
      explosionBurstLayerRef.current?.addTemplarBlinkSmiteStrike({ id, position: pos, timestamp });
      window.audioSystem?.playEnemyTemplarSmiteSound(pos);

      const playerEntity = getLocalPlayerEntity();
      if (!playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;
      const deathState = playerDeathStates.get(socket.id);
      if (deathState?.isDead) return;
      const transform = playerEntity.getComponent(Transform);
      if (!transform) return;
      const playerGroundPos = new Vector3(transform.position.x, 0, transform.position.z);
      const smiteGroundPos = new Vector3(pos.x, 0, pos.z);
      if (playerGroundPos.distanceTo(smiteGroundPos) > radius) return;

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
            damageType: 'smite',
            damageApplied,
            health,
            healthBefore,
            shield,
            shieldBefore,
            position: t.position,
            attackerServerEnemyId: templarId,
          });
        }
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
      const { enemyId, effectType, duration, timestamp } = data;
      
      if (!engineRef.current) {
        return;
      }

      const world = engineRef.current.getWorld();
      
      // Find the enemy entity by its server ID
      const allEntities = world.getAllEntities();
      
      for (const entity of allEntities) {
        if (entity.userData?.serverEnemyId === enemyId) {
          const enemy = entity.getComponent(Enemy);
          if (enemy) {
            const currentTime = Date.now() / 1000;
            
            // Apply the appropriate status effect based on type
            if (effectType === 'stun') {
              enemy.stun(duration / 1000, currentTime); // Convert ms to seconds
              
              // Add visual stun effect
              const transform = entity.getComponent(Transform);
              if (transform) {
                addGlobalStunnedEnemy(entity.id.toString(), transform.position, duration);
              }
            } else if (effectType === 'freeze') {
              const sk = entity.userData?.coopServerEnemyType as string | undefined;
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
            } else if (effectType === 'entangle') {
              enemy.entangle(duration / 1000, currentTime);
              const transform = entity.getComponent(Transform);
              if (transform) {
                addGlobalEntangledEnemy(entity.id.toString(), transform.position.clone(), duration);
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
      const damageNumberManager = (window as any).damageNumberManager;
      if (damageNumberManager?.addDamageNumber) {
        damageNumberManager.addDamageNumber(dmg, isCritical, numPos, 'stagger_break');
      }
      lightningBurstLayerRef.current?.addStaggerProcEffect({
          id: `stagger-proc-${data.enemyId}-${Date.now()}`,
          position: p.clone(),
          magmaCurrent: !!data.magmaCurrent,
          forceOfNature: !!data.forceOfNature
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
      const isBlueShade = shadeEnemy?.soulType === 'blue';
      const daggerCount = isBlueShade ? 2 : 3;

      // Spawn daggers staggered after the throw animation release point.
      // Each dagger samples live player aim at launch; spawn origin uses live shade
      // position (+1.5 Y hand offset, matching enemyAI telegraphShadeAttack) so post-boss
      // blink timing cannot desync projectile start from the mesh.
      for (let i = 0; i < daggerCount; i++) {
        setTimeout(() => {
          let target = staleTarget.clone();
          const playerEntity = getLocalPlayerEntity();
          if (playerEntity) {
            const t = playerEntity.getComponent(Transform);
            if (t) {
              target = new Vector3(t.position.x, data.targetPosition.y, t.position.z);
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
              soulType: liveShade?.soulType ?? shadeEnemy?.soulType,
              daggerIndex: i,
            });
        }, SHADE_THROW_DURATION + i * SHADE_DAGGER_INTERVAL);
      }
    };

    socket.on('player-attacked', handlePlayerAttack);
    socket.on('player-used-ability', handlePlayerAbility);
    socket.on('player-damaged', handlePlayerDamaged);
    socket.on('player-healing', handlePlayerHealing);
    socket.on('player-experience-gained', handlePlayerExperienceGained);
    socket.on('player-kill', handlePlayerKill);
    socket.on('pillar-destroyed', handlePillarDestroyed);
    socket.on('player-essence-changed', handlePlayerEssenceChanged);
    const unregisterGoldHandler = registerPlayerGoldChangedHandler(handlePlayerGoldChanged);
    socket.on('gold-picked-up', handleGoldPickedUp);
    socket.on('gold-expired', handleGoldExpired);
    socket.on('player-animation-state', handlePlayerAnimationState);
    socket.on('player-effect', handlePlayerEffect);
    socket.on('player-debuff', handlePlayerDebuff);
    socket.on('player-stealth', handlePlayerStealth);
    socket.on('player-tornado-effect', handlePlayerTornadoEffect);
    socket.on('player-death-effect', handlePlayerDeathEffect);
    socket.on('player-respawned', handlePlayerRespawned);
    socket.on('player-shield-changed', handlePlayerShieldChanged);
    socket.on('player-knockback', handlePlayerKnockback);
    socket.on('boss-attack', handleBossAttack);
    socket.on('boss-defeated', handleBossDefeated);
    socket.on('boss-meteor-cast', handleBossMeteorCast);
    socket.on('crossentropy-meteor-cast', handleCrossentropyMeteorCast);
    socket.on('duality-blizzard-cast', handleDualityBlizzardCast);
    socket.on('spell-thief-dash-restore', handleSpellThiefDashRestore);
    socket.on('cloudkill-cast', handleCloudkillCast);
    socket.on('boss-leap-start', handleBossLeapStart);
    socket.on('boss-leap-land', handleBossLeapLand);
    socket.on('ghoul-leap-start', handleGhoulLeapStart);
    socket.on('ghoul-leap-land', handleGhoulLeapLand);
    socket.on('templar-leap-start', handleTemplarLeapStart);
    socket.on('templar-leap-land', handleTemplarLeapLand);
    socket.on('titan-stomp-shockwave', handleTitanStompShockwave);
    socket.on('titan-cannon-windup', handleTitanCannonWindup);
    socket.on('boss-throw-spear', handleBossThrowSpear);
    socket.on('boss-tectonic-spike-telegraph', handleBossTectonicSpikeTelegraph);
    socket.on('boss-tectonic-spike-appear', handleBossTectonicSpikeAppear);
    socket.on('boss2-archon-lightning', handleBoss2ArchonLightning);
    socket.on('warlock-archon-shock', handleWarlockArchonShock);
    socket.on('knight-storm-lash-zap', handleKnightStormLashZap);
    socket.on('boss3-nova-release', handleBoss3NovaRelease);
    socket.on('templar-teleport', handleTemplarTeleport);
    socket.on('templar-blink-smite-impact', handleTemplarBlinkSmiteImpact);
    socket.on('martyr-detonation-telegraph', handleMartyrDetonationTelegraph);
    socket.on('martyr-detonation-impact', handleMartyrDetonationImpact);
    socket.on('fission-detonation', handleFissionDetonation);
    socket.on('boss-skeleton-attack', handleBossSkeletonAttack);
    socket.on('knight-attack-telegraph', handleKnightAttackTelegraph);
    socket.on('tentacle-spine-windup', handleTentacleSpineWindup);
    socket.on('tentacle-spine-slam', handleTentacleSpineSlamSocket);
    socket.on('knight-attack', handleKnightAttack);
    socket.on('knight-spin-hit', handleKnightAttack);
    socket.on('knight-smite',  handleKnightSmite);
    socket.on('allied-knight-smite-impact', handleAlliedKnightSmiteImpact);
    socket.on('allied-healer-greater-heal', handleAlliedHealerGreaterHeal);
    socket.on('knight-frost',  handleKnightFrost);
    socket.on('knight-frost-projectile', handleKnightFrostProjectile);
    socket.on('knight-deathgrasp-projectile', handleKnightDeathGraspProjectile);
    socket.on('knight-deathgrasp-pull', handleKnightDeathGraspPull);
    socket.on('boss2-deathgrasp-projectiles', handleBoss2DeathGraspProjectiles);
    socket.on('boss2-deathgrasp-pull', handleBoss2DeathGraspPull);
    socket.on('templar-attack-telegraph', handleTemplarAttackTelegraph);
    socket.on('templar-attack', handleTemplarAttack);
    socket.on('enemy-status-effect', handleEnemyStatusEffect);
    socket.on('enemy-chill-sync', handleEnemyChillSync);
    socket.on('enemy-stagger-proc', handleEnemyStaggerProc);
    socket.on('knight-death-vortex', handleKnightDeathVortex);
    socket.on('shade-attack-telegraph', handleShadeAttackTelegraph);

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
    };

    socket.on('greed-fireball-impact', handleGreedFireballImpact);

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

    // ── Ghoul attack (melee damage to local player) ──────────────────────────
    const handleGhoulAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

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
    const handleTitanAttack = (data: any) => {
      const playerEntity = getLocalPlayerEntity();
      if (data.targetPlayerId !== socket?.id || !playerEntity || !socket?.id) return;
      if (blockLocalDamageDuringCoopPortal()) return;

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
      targetPosition: { x: number; y: number; z: number };
    }) => {
      // Delay heal burst to match cast animation finish (~1.8s)
      setTimeout(() => {
        const pos = new Vector3(data.targetPosition.x, data.targetPosition.y, data.targetPosition.z);
        summonRitualLayerRef.current?.addWeaverHealEffect({ id: `weaver-heal-${data.weaverId}-${Date.now()}`, position: pos },
        );
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
      summonRitualLayerRef.current?.addGhoulSummonRitual({ id: `ghoul-ritual-${data.weaverId}-${Date.now()}`, position: ritualPos },
      );
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
          durationMs: w + POST_SPIKE_CRACK_HOLD_MS,
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
    socket.on('titan-attack', handleTitanAttack);
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
      socket.off('coop-room-whisper', handleCoopRoomWhisper);
      tentacleSpinePendingByEnemyRef.current.forEach(p => {
        clearTimeout(p.tAdd);
        clearTimeout(p.tFail);
      });
      tentacleSpinePendingByEnemyRef.current.clear();
      greaterHealImpactTimers.current.forEach(clearTimeout);
      greaterHealImpactTimers.current = [];
      socket.off('player-attacked', handlePlayerAttack);
      socket.off('player-used-ability', handlePlayerAbility);
      socket.off('player-damaged', handlePlayerDamaged);
      socket.off('player-healing', handlePlayerHealing);
      socket.off('player-experience-gained', handlePlayerExperienceGained);
      socket.off('player-kill', handlePlayerKill);
      socket.off('pillar-destroyed', handlePillarDestroyed);
      socket.off('player-essence-changed', handlePlayerEssenceChanged);
      unregisterGoldHandler();
      socket.off('gold-picked-up', handleGoldPickedUp);
      socket.off('gold-expired', handleGoldExpired);
      socket.off('player-animation-state', handlePlayerAnimationState);
      socket.off('player-effect', handlePlayerEffect);
      socket.off('player-debuff', handlePlayerDebuff);
      socket.off('player-stealth', handlePlayerStealth);
      socket.off('player-tornado-effect', handlePlayerTornadoEffect);
      socket.off('player-death-effect', handlePlayerDeathEffect);
      socket.off('player-respawned', handlePlayerRespawned);
      socket.off('player-shield-changed', handlePlayerShieldChanged);
      socket.off('player-knockback', handlePlayerKnockback);
      socket.off('boss-attack', handleBossAttack);
      socket.off('boss-defeated', handleBossDefeated);
      socket.off('boss-meteor-cast', handleBossMeteorCast);
      socket.off('crossentropy-meteor-cast', handleCrossentropyMeteorCast);
      socket.off('duality-blizzard-cast', handleDualityBlizzardCast);
      socket.off('spell-thief-dash-restore', handleSpellThiefDashRestore);
      socket.off('cloudkill-cast', handleCloudkillCast);
      socket.off('boss-leap-start', handleBossLeapStart);
      socket.off('boss-leap-land', handleBossLeapLand);
      socket.off('ghoul-leap-start', handleGhoulLeapStart);
      socket.off('ghoul-leap-land', handleGhoulLeapLand);
      socket.off('templar-leap-start', handleTemplarLeapStart);
      socket.off('templar-leap-land', handleTemplarLeapLand);
      socket.off('titan-stomp-shockwave', handleTitanStompShockwave);
      socket.off('titan-cannon-windup', handleTitanCannonWindup);
      socket.off('boss-throw-spear', handleBossThrowSpear);
      socket.off('boss-tectonic-spike-telegraph', handleBossTectonicSpikeTelegraph);
      socket.off('boss-tectonic-spike-appear', handleBossTectonicSpikeAppear);
      socket.off('boss2-archon-lightning', handleBoss2ArchonLightning);
      socket.off('warlock-archon-shock', handleWarlockArchonShock);
      socket.off('knight-storm-lash-zap', handleKnightStormLashZap);
      socket.off('boss3-nova-release', handleBoss3NovaRelease);
      socket.off('templar-teleport', handleTemplarTeleport);
      socket.off('templar-blink-smite-impact', handleTemplarBlinkSmiteImpact);
      socket.off('martyr-detonation-telegraph', handleMartyrDetonationTelegraph);
      socket.off('martyr-detonation-impact', handleMartyrDetonationImpact);
      socket.off('fission-detonation', handleFissionDetonation);
      socket.off('boss-skeleton-attack', handleBossSkeletonAttack);
      socket.off('knight-attack-telegraph', handleKnightAttackTelegraph);
      socket.off('tentacle-spine-windup', handleTentacleSpineWindup);
      socket.off('tentacle-spine-slam', handleTentacleSpineSlamSocket);
      socket.off('knight-attack', handleKnightAttack);
      socket.off('knight-spin-hit', handleKnightAttack);
      socket.off('knight-smite',  handleKnightSmite);
      socket.off('allied-knight-smite-impact', handleAlliedKnightSmiteImpact);
      socket.off('allied-healer-greater-heal', handleAlliedHealerGreaterHeal);
      socket.off('knight-frost',  handleKnightFrost);
      socket.off('knight-frost-projectile', handleKnightFrostProjectile);
      socket.off('knight-deathgrasp-projectile', handleKnightDeathGraspProjectile);
      socket.off('knight-deathgrasp-pull', handleKnightDeathGraspPull);
      socket.off('boss2-deathgrasp-projectiles', handleBoss2DeathGraspProjectiles);
      socket.off('boss2-deathgrasp-pull', handleBoss2DeathGraspPull);
      socket.off('templar-attack-telegraph', handleTemplarAttackTelegraph);
      socket.off('templar-attack', handleTemplarAttack);
      // Clear any pending miss timers on cleanup
      knightPendingMissTimers.current.forEach(clearTimeout);
      knightPendingMissTimers.current.clear();
      templarPendingMissTimers.current.forEach(clearTimeout);
      templarPendingMissTimers.current.clear();
      socket.off('enemy-status-effect', handleEnemyStatusEffect);
      socket.off('enemy-chill-sync', handleEnemyChillSync);
      socket.off('enemy-stagger-proc', handleEnemyStaggerProc);
      socket.off('knight-death-vortex', handleKnightDeathVortex);
      socket.off('shade-attack-telegraph', handleShadeAttackTelegraph);
      socket.off('warlock-attack-telegraph', handleWarlockAttackTelegraph);
      socket.off('warlock-orb-impact', handleWarlockOrbImpact);
      socket.off('greed-launch-telegraph', handleGreedLaunchTelegraph);
      socket.off('greed-fireball-impact', handleGreedFireballImpact);
      socket.off('greed-ember-zone-spawned', handleGreedEmberZoneSpawned);
      socket.off('greed-ember-zone-expired', handleGreedEmberZoneExpired);
      socket.off('warlock-meteor-ember-zone-spawned', handleWarlockMeteorEmberZoneSpawned);
      socket.off('warlock-meteor-ember-zone-expired', handleWarlockMeteorEmberZoneExpired);
      socket.off('warlock-flame-strike', handleWarlockFlameStrike);
      socket.off('boss2-flame-pillar', handleBoss2FlamePillar);
      socket.off('ghoul-attack', handleGhoulAttack);
      socket.off('titan-attack', handleTitanAttack);
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
    onLocalPlayerRevived,
    coopServerEnemyLiving,
    onGoldUpdate,
  ]);

  useEffect(() => {
    const pending = tentacleSpinePendingByEnemyRef.current;
    const toRemove: string[] = [];
    pending.forEach((p, enemyId) => {
      const e = enemies.get(enemyId);
      if (!e || e.type !== 'tentacle-spine' || e.isDying) {
        clearTimeout(p.tAdd);
        clearTimeout(p.tFail);
        toRemove.push(enemyId);
      }
    });
    toRemove.forEach((enemyId) => {
      pending.delete(enemyId);
      groundTelegraphLayerRef.current?.removeTentacleSpineTelegraphsByEnemyId(enemyId);
      tentacleSpineLayerRef.current?.removeFx(enemyId);
      tentacleSpineFxRef.current.delete(enemyId);
    });
  }, [enemies]);

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
        serverEnemy.type === 'allied-healer' ||
        serverEnemy.type === 'player-zombie';

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

      const enemyType = serverEnemy.type === 'boss' || serverEnemy.type === 'boss2' || serverEnemy.type === 'boss3' ? EnemyType.BOSS : EnemyType.ELITE;
      const enemy = new Enemy(enemyType, 1);
      entity.addComponent(enemy);

      const collider = world.createComponent(Collider);
      collider.type = ColliderType.SPHERE;
      collider.radius = serverEnemy.type === 'boss' ? 2.0
        : serverEnemy.type === 'boss2' || serverEnemy.type === 'boss3' ? 1.8
        : serverEnemy.type === 'boss-skeleton' ? 1.2
        : serverEnemy.type === 'allied-healer' || serverEnemy.type === 'greed' ? 0.75
        : serverEnemy.type === 'allied-knight' ? 0.85
        : serverEnemy.type === 'knight' ? 0.85 * (serverEnemy.visualScale ?? 1)
        : serverEnemy.type === 'templar' || serverEnemy.type === 'ghoul' ? 0.95
        : serverEnemy.type === 'titan' ? 1.2
        : serverEnemy.type === 'training-dummy' ? 1.85
        : serverEnemy.type === 'shade' ? 1.0
        : serverEnemy.type === 'martyr' ? 0.8
        : serverEnemy.type === 'tentacle-spine' ? 0.55
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

    if (inThroneRoom || inBossThroneArena || isHexCombatArena) {
      clearAllMushrooms();
      return;
    }

    const instances = buildMushroomInstances();
    const healthArr = effectiveMushroomHealth;

    for (const [idx, eid] of Array.from(mushroomEntityByIndexRef.current.entries())) {
      if (healthArr[idx] <= 0) {
        if (world.getEntity(eid)) world.destroyEntity(eid);
        mushroomEntityByIndexRef.current.delete(idx);
      }
    }

    for (let i = 0; i < MUSHROOM_COUNT; i++) {
      if (healthArr[i] <= 0) continue;
      const inst = instances[i]!;
      const c = getMushroomColliderCenter(inst);
      if (mushroomEntityByIndexRef.current.has(i)) {
        const eid = mushroomEntityByIndexRef.current.get(i)!;
        const ent = world.getEntity(eid);
        if (ent) {
          const h = ent.getComponent(Health);
          if (h) {
            h.currentHealth = healthArr[i];
            h.maxHealth = MUSHROOM_MAX_HP;
            h.isDead = false;
          }
          const t = ent.getComponent(Transform);
          if (t) t.setPosition(c.x, c.y, c.z);
        }
        continue;
      }

      const entity = world.createEntity();
      const transform = world.createComponent(Transform);
      transform.setPosition(c.x, c.y, c.z);
      entity.addComponent(transform);

      const health = new Health(MUSHROOM_MAX_HP);
      health.currentHealth = healthArr[i];
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

      const dm = new DestructibleMushroom(i);
      entity.addComponent(dm);
      entity.userData = { ...entity.userData, mushroomIndex: i };
      world.notifyEntityAdded(entity);
      mushroomEntityByIndexRef.current.set(i, entity.id);
    }
  }, [gameStarted, engineReady, gameMode, inThroneRoom, inBossThroneArena, isHexCombatArena, effectiveMushroomHealth]);

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
        serverEnemy.type === 'allied-healer' ||
        serverEnemy.type === 'player-zombie';
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

  useEffect(() => {
    syncCoopEnemyEcsTransformsRef.current = syncCoopEnemyEcsTransforms;
  }, [syncCoopEnemyEcsTransforms]);

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
    const preWorldUpdateHook = () => syncCoopEnemyEcsTransformsRef.current();
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
  }, [players, disposeEffectPools, clearAllPvpVenomTimers]);

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
          syncRemoteMovementForHumanoidAnimations(movement, {
            ...serverPlayer,
            position: live.position,
            movementDirection: live.movementDirection ?? serverPlayer.movementDirection,
          });
        }
      });
    }

    if (engineRef.current && engineRef.current.isEngineRunning() && gameStarted) {
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
            const devPortalR2 =
              THRONE_DEV_BOSS_PORTAL_INTERACT_RADIUS * THRONE_DEV_BOSS_PORTAL_INTERACT_RADIUS;
            const devPortalsAll = [
              { camp: 'dev_boss' as const, p: THRONE_DEV_BOSS_PORTAL_POSITION },
              { camp: 'dev_boss2' as const, p: THRONE_DEV_BOSS2_PORTAL_POSITION },
              { camp: 'dev_boss3' as const, p: THRONE_DEV_BOSS3_PORTAL_POSITION },
            ].map(({ camp, p }) => {
              const dx = px - p.x;
              const dz = pz - p.z;
              return { camp, d2: dx * dx + dz * dz };
            });
            const inRangeDev = devPortalsAll.filter((e) => e.d2 <= devPortalR2);
            inRangeDev.sort((a, b) => a.d2 - b.d2);
            const bestDev =
              COOP_DEV_LOCALHOST_FEATURES ? inRangeDev[0]?.camp ?? null : null;

            if (bestDev && !portalUseSentRef.current) {
              portalUseSentRef.current = true;
              enterCombatArena(bestDev);
            } else {
              type ThroneXTarget =
                | { kind: 'weapon'; d2: number; weapon: WeaponType }
                | { kind: 'portal'; d2: number; chosen: string };
              const candidates: ThroneXTarget[] = [];
              if (bestWeapon && cur !== undefined && bestWeapon.weapon !== cur) {
                candidates.push({ kind: 'weapon', d2: bestWeapon.d2, weapon: bestWeapon.weapon });
              }

              const offer = thronePortalOfferRef.current;
              const rPortal = 2.9;
              const rPortal2 = rPortal * rPortal;
              if (!portalUseSentRef.current) {
                if (offer.length >= 2) {
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
                } else if (offer.length === 1) {
                  const dx = px - THRONE_PORTAL_POSITION.x;
                  const dz = pz - THRONE_PORTAL_POSITION.z;
                  const d2 = dx * dx + dz * dz;
                  if (d2 < rPortal2 && offer[0] != null) {
                    candidates.push({ kind: 'portal', d2, chosen: String(offer[0]) });
                  }
                }
              }

              candidates.sort((a, b) => a.d2 - b.d2);

              const pick = candidates[0];
              if (pick?.kind === 'weapon') {
                const w = pick.weapon;
                setSelectedWeapons({ primary: w, secondary: w });
                setAbilityLoadout(getDefaultLoadoutForWeapon(w));
                updatePlayerWeapon(w, defaultSubclassForThroneWeapon(w));
                onThroneWeaponEquippedRef.current?.(w);
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
              } else if (pick?.kind === 'portal') {
                portalUseSentRef.current = true;
                enterCombatArena(pick.chosen);
                if ((window as any).audioSystem?.playUISelectionSound) {
                  (window as any).audioSystem.playUISelectionSound();
                }
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

          // Pedestal interaction — show boon picker when room is cleared (priority over portals / pickup)
          if (
            xEdge &&
            pedestalBoonReadyRef.current &&
            pedDx * pedDx + pedDz * pedDz < pedR2
          ) {
            const rewardKind = coopClearedRoomKindRef.current ?? coopCurrentRoomKindRef.current;
            onCombatArenaPedestalInteractRef.current?.(rewardKind);
          } else if (
            xEdge &&
            portalsUnlockedRef.current &&
            coopMainArenaPortalPhaseRef.current &&
            !portalUseSentRef.current
          ) {
            const rPortal = 2.9;
            const r2 = rPortal * rPortal;
            const offer = thronePortalOfferRef.current;
            const phase = coopMainArenaPortalPhaseRef.current;

            if (
              (phase === 'pick_wave2' || phase === 'pick_post_boss') &&
              offer.length >= 2
            ) {
              let bestI = 0;
              let bestD2 = Infinity;
              for (let i = 0; i < MAIN_COMBAT_CHOICE_PORTAL_POSITIONS.length; i++) {
                const pos = MAIN_COMBAT_CHOICE_PORTAL_POSITIONS[i]!;
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
              }
            } else if (phase === 'pick_boss' && offer.length === 1 && String(offer[0]).toLowerCase() === 'boss') {
              const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
              const dx = px - pos.x;
              const dz = pz - pos.z;
              if (dx * dx + dz * dz < r2) {
                portalUseSentRef.current = true;
                enterCombatArena('boss');
              }
            }
          } else if (xEdge) {
            const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
            const rPick2 = rPick * rPick;
            let nearestItem: { id: string; d2: number } | null = null;
            droppedItemsRef.current.forEach((item) => {
              const dx = px - item.position.x;
              const dz = pz - item.position.z;
              const d2 = dx * dx + dz * dz;
              if (d2 <= rPick2 && (!nearestItem || d2 < nearestItem.d2)) {
                nearestItem = { id: item.id, d2 };
              }
            });
            const _itemFound = nearestItem as { id: string; d2: number } | null;
            if (_itemFound) {
              pickupItemRef.current(_itemFound.id);
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

      // Update FPS counter
      updateFPSCounter(engineRef.current.getCurrentFPS());

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

          // Update quaternion for Viper Sting direction
          viperStingParentRef.current.quaternion = {
            x: 0,
            y: Math.sin(cameraAngle / 2),
            z: 0,
            w: Math.cos(cameraAngle / 2)
          };

          // Send position updates to other players with camera rotation
          // This continues even during death to prevent ping timeout disconnection
          const rotation = { x: 0, y: cameraAngle, z: 0 };
          const movement = playerEntity.getComponent(Movement);
          const isLocalDead = localDeathState?.isDead ?? false;
          updatePlayerPosition(
            isLocalDead ? localDeathState!.deathPosition : transform.position,
            rotation,
            isLocalDead ? ZERO_PLAYER_MOVEMENT_DIRECTION : (movement ? buildPlayerMovementDirectionPayload(movement) : undefined),
          );
        }
      }

      // Update weapon state from control system
      if (controlSystemRef.current) {


        const newWeaponState = {
          currentWeapon: controlSystemRef.current.getCurrentWeapon(),
          currentSubclass: controlSystemRef.current.getCurrentSubclass(),
          isCharging: controlSystemRef.current.isWeaponCharging(),
          chargeProgress: controlSystemRef.current.getChargeProgress(),
          chargeDirection: weaponStateRef.current.chargeDirection,
          isSwinging: controlSystemRef.current.isWeaponSwinging(),
          isSpinning: (controlSystemRef.current.isWeaponCharging() || controlSystemRef.current.isCrossentropyChargingActive() || controlSystemRef.current.isEntropicBoltActive()) && controlSystemRef.current.getCurrentWeapon() === WeaponType.SCYTHE,
          swordComboStep: controlSystemRef.current.getSwordComboStep(),
          isSwordCharging: controlSystemRef.current.isChargeActive(),
          isDeflecting: controlSystemRef.current.isDeflectActive(),
          deflectShieldActive:
            controlSystemRef.current.isDeflectActive() ||
            controlSystemRef.current.isWraithGuardShieldActive() ||
            controlSystemRef.current.isColossusGuardShieldActive() ||
            controlSystemRef.current.isGuardComboShieldActive() ||
            controlSystemRef.current.isDashGuardShieldActive() ||
            controlSystemRef.current.isSabresPurpleGuardShieldActive(),
          deflectShieldDurationSec: controlSystemRef.current.getDeflectShieldDurationSec(),
          deflectShieldPaletteVariant: controlSystemRef.current.getAegisShieldPaletteVariant(),
          isViperStingCharging: controlSystemRef.current.isViperStingChargingActive(),
          viperStingChargeProgress: controlSystemRef.current.getViperStingChargeProgress(),
          isBarrageCharging: controlSystemRef.current.isBarrageChargingActive(),
          barrageChargeProgress: controlSystemRef.current.getBarrageChargeProgress(),
          isCobraShotCharging: controlSystemRef.current.isCobraShotChargingActive(),
          cobraShotChargeProgress: controlSystemRef.current.getCobraShotChargeProgress(),
          isSkyfalling: controlSystemRef.current.isSkyfallActive(),
          isBackstabbing: controlSystemRef.current.isBackstabActive(),
          isSundering: controlSystemRef.current.isSunderActive(),
          isCorruptedAuraActive: controlSystemRef.current.isCorruptedAuraActive(),
          isFrozen: weaponStateRef.current.isFrozen,
          isIcebeaming: controlSystemRef.current.isIcebeamActive(),
          tempestBurstShotSeq: controlSystemRef.current.getTempestBurstShotSeq(),
        };

        // Update the ref immediately
        weaponStateRef.current = newWeaponState;

        // Check for weapon changes and broadcast to other players
        const prevWeapon = prevWeaponRef.current;
        if (newWeaponState.currentWeapon !== prevWeapon.weapon ||
            newWeaponState.currentSubclass !== prevWeapon.subclass) {
          updatePlayerWeapon(newWeaponState.currentWeapon, newWeaponState.currentSubclass);
          prevWeaponRef.current = {
            weapon: newWeaponState.currentWeapon,
            subclass: newWeaponState.currentSubclass
          };
        }

        // Throttle React state updates to prevent infinite re-renders
        const now = Date.now();
        if (
          now - lastWeaponStateUpdate.current > 16 &&
          weaponStateNeedsReactUpdate(lastCommittedWeaponStateRef.current, newWeaponState)
        ) {
          setWeaponState(newWeaponState);
          lastCommittedWeaponStateRef.current = newWeaponState;
          lastWeaponStateUpdate.current = now;
        }

        // Broadcast animation state changes to other players (throttled to avoid spam)
        const animationNow = Date.now();
        if (animationNow - lastAnimationBroadcast.current > 100) { // Throttle to 10 times per second
          // Determine if scythe is spinning (IceBeam, Crossentropy, or Entropic Bolts)
          const isScytheSpinning = newWeaponState.isSpinning && newWeaponState.currentWeapon === WeaponType.SCYTHE;
          // Determine if sword is spinning during Charge
          const isSwordSpinning = newWeaponState.isSwordCharging;
          // Combine all spinning states
          const isSpinning = isScytheSpinning || isSwordSpinning;

          // Create the animation state object - only include weapon-specific fields for current weapon
          const animationStateToSend: any = {
            isCharging: newWeaponState.isCharging,
            chargeProgress: newWeaponState.chargeProgress,
            isSwinging: newWeaponState.isSwinging,
            isSpinning: isSpinning, // Broadcast spinning for scythe and sword charge
            isDeflecting: newWeaponState.isDeflecting,
            isSwordCharging: newWeaponState.isSwordCharging, // Broadcast sword charging state
            isViperStingCharging: newWeaponState.isViperStingCharging,
            viperStingChargeProgress: newWeaponState.viperStingChargeProgress,
            isBarrageCharging: newWeaponState.isBarrageCharging,
            barrageChargeProgress: newWeaponState.barrageChargeProgress,
            isBackstabbing: newWeaponState.isBackstabbing, // Broadcast backstab animation state
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
          };

          // Only include swordComboStep for weapons that actually use it (Sword and Runeblade)
          const currentWeapon = controlSystemRef.current?.getCurrentWeapon();
          if (currentWeapon === WeaponType.SWORD || currentWeapon === WeaponType.RUNEBLADE) {
            animationStateToSend.swordComboStep = newWeaponState.swordComboStep;
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
          onDamageNumbersUpdate(newDamageNumbers);
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
        onCameraUpdate(camera, state.size);
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
          if (healthComponent) {
            const gameState = {
              playerHealth: healthComponent.currentHealth,
              maxHealth: healthComponent.maxHealth,
              playerShield: shieldComponent ? shieldComponent.currentShield : 0,
              maxShield: shieldComponent ? shieldComponent.maxShield : 0,
              currentWeapon: controlSystemRef.current.getCurrentWeapon(),
              currentSubclass: controlSystemRef.current.getCurrentSubclass()
            };
            onGameStateUpdate(gameState);

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
            lastGameStateUpdate.current = gameStateNow;
          }
        }
      }

      // Co-op: one-line proximity hint above HUD health bar
      const hi = onInteractHintChangeRef.current;
      if (hi && playerEntity && gameMode === 'coop') {
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

              const abilityInRangeH = COOP_DEV_LOCALHOST_FEATURES && ad2 <= rAb2;
              const talentInRangeH = COOP_DEV_LOCALHOST_FEATURES && td2 <= rAb2;
              const offerH = thronePortalOfferRef.current;
              const rPortalH = 2.9;
              const rPortal2H = rPortalH * rPortalH;
              let portalCloseH = false;
              if (!portalUseSentRef.current) {
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
                bestW.weapon !== curHint
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

              if (weaponInteractH || abilityInteractH || talentInteractH || portalCloseH) {
                nextHint = COOP_INTERACT_HINT_TEXT;
              }
            } else if (!inThroneRoom && combatArenaActiveRef.current) {
              const pdx = px - MAIN_COMBAT_PEDESTAL_POSITION.x;
              const pdz = pz - MAIN_COMBAT_PEDESTAL_POSITION.z;
              const pedR = MAIN_COMBAT_PEDESTAL_INTERACT_RADIUS;
              if (
                pedestalBoonReadyRef.current &&
                pdx * pdx + pdz * pdz < pedR * pedR
              ) {
                nextHint = COOP_INTERACT_HINT_TEXT;
              } else if (
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
                  (phase === 'pick_wave2' || phase === 'pick_post_boss') &&
                  offer.length >= 2
                ) {
                  for (const pos of MAIN_COMBAT_CHOICE_PORTAL_POSITIONS) {
                    const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                    if (d2 < r2) {
                      portalClose = true;
                      break;
                    }
                  }
                } else if (
                  phase === 'pick_boss' &&
                  offer.length === 1 &&
                  String(offer[0]).toLowerCase() === 'boss'
                ) {
                  const pos = MAIN_COMBAT_BOSS_PORTAL_POSITION;
                  const d2 = (px - pos.x) * (px - pos.x) + (pz - pos.z) * (pz - pos.z);
                  portalClose = d2 < r2;
                }
                if (portalClose) nextHint = COOP_INTERACT_HINT_TEXT;
              }

              if (!nextHint && droppedItemsRef.current.size > 0) {
                const rPick = COOP_GROUND_ITEM_PICKUP_RADIUS;
                const rPick2 = rPick * rPick;
                droppedItemsRef.current.forEach((item) => {
                  if (nextHint) return;
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

    const localPlayerForSpawn = players.get(socket?.id || '');
    const spawnX = localPlayerForSpawn?.position.x ?? 0;
    const spawnZ = localPlayerForSpawn?.position.z ?? COOP_MAIN_DEFAULT_SPAWN_Z;
    const initialThroneMap = gameMode === 'coop' && !combatArenaActive;

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
      { initialSpawn: { x: spawnX, y: 0.5, z: spawnZ }, initialThroneMap },
    );

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

    // Set up Frost Nova callback
    controlSystem.setFrostNovaCallback((position, direction) => {
      broadcastPlayerAbility('frost_nova', position, direction);
    });

    controlSystem.setDeflectCallback((position, direction, extra) => {
      broadcastPlayerAbility('deflect', position, direction, undefined, extra);
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
      const summonTotemExtraData =
        totemBoltVariant != null || superconductor
          ? {
              ...(totemBoltVariant != null ? { totemBoltVariant } : {}),
              ...(superconductor ? { superconductor } : {}),
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
    controlSystem.setApplyEnemyStatusEffectCallback((enemyId: string, effectType: string, duration: number) => {
      if (applyStatusEffect) {
        applyStatusEffect(enemyId, effectType, duration);
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
        });
      }

      broadcastPlayerAbility('smite', position, direction, undefined, {
        infestedSmite,
        staggeringSmite,
        infernalSmite,
        vengeanceSmite,
        trinityExtras: meta?.extraStrikes?.map((s) => ({
          position: { x: s.position.x, y: s.position.y, z: s.position.z },
          delaySec: s.delaySec,
        })),
      });
    });

    // Set up Flurry healing effect callback
    controlSystem.setFlurryHealingEffectCallback((position: Vector3) => {
      triggerFlurryHealingEffect(position);
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
            enemy.type === 'allied-healer' || enemy.type === 'player-zombie') return false;
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
  }, [damageEnemy, damageMushroom, engineReady, socket?.id]);

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

  // Sync skill point data with control system when it changes
  useEffect(() => {
    if (controlSystemRef.current && skillPointData) {
      controlSystemRef.current.setSkillPointData(skillPointData);
    }
  }, [skillPointData]);

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
      <RenderPerfHud />
      <DynamicLightPool />
      {shaderWarmupActive && <ShaderWarmup />}
      {/* Don't render game world if game hasn't started */}
      {!gameStarted ? null : (
        <>
          {/* Drifting cloud mist — camera-relative overlay, present in every room */}
          <DriftingMist />
          {inThroneRoom ? (
            <>
              <ThroneRoom
                isSnowTheme={coopTerrainTheme === 'blue'}
                thronePortalOffer={thronePortalOffer}
                campTypes={campTypes}
                coopClearedRoomColor={coopClearedRoomColor}
                thronePortalsLocked={
                  !selectedWeapons || selectedWeapons.primary === WeaponType.NONE
                }
                equippedWeapon={selectedWeapons?.primary ?? WeaponType.NONE}
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
              />
              {combatArenaActive && coopMainArenaPortalPhase && (
                <CoopMainArenaPortals
                  thronePortalOffer={thronePortalOffer}
                  phase={coopMainArenaPortalPhase}
                  portalsUnlocked={portalsUnlocked}
                />
              )}
              {combatArenaActive && coopMainArenaPortalPhase && (
                <CombatArenaPedestal
                  campType={normalizeCoopPortalKind(coopClearedRoomKind ?? coopCurrentRoomKind ?? 'boss')}
                  showAura={pedestalBoonReady}
                />
              )}
            </>
          ) : (
            <>
              {isHexCombatArena ? (
                <HexCombatArena
                  key={`coop-hex-env-${coopCombatArenaEnterSeq}-${coopCurrentRoomKind}`}
                  variant={hexArenaVariant}
                  combatActive={combatArenaActive && enemies.size > 0}
                />
              ) : (
                <Environment
                  key={`coop-env-${coopCombatArenaEnterSeq}-${coopTerrainTheme}-${(campTypes[0] ?? coopCurrentRoomKind ?? 'pending').toString().toLowerCase()}`}
                  level={1}
                  world={engineRef.current?.getWorld()}
                  camera={camera as PerspectiveCamera}
                  enableLargeTree={true}
                  isPVP={false}
                  campTypes={campTypes}
                  coopTerrainTheme={coopTerrainTheme}
                  mushroomHiddenIndices={mushroomHiddenIndices}
                  animateClouds={!(combatArenaActive && enemies.size > 0)}
                />
              )}              {engineRef.current?.getWorld() && !isHexCombatArena && (
                <CastleWallCollision
                  world={engineRef.current.getWorld()}
                  enabled={!inThroneRoom && !inBossThroneArena && !isHexCombatArena}
                />
              )}
              {combatArenaActive && coopMainArenaPortalPhase && (
                <CoopMainArenaPortals
                  thronePortalOffer={thronePortalOffer}
                  phase={coopMainArenaPortalPhase}
                  portalsUnlocked={portalsUnlocked}
                />
              )}

              {/* Reward pedestal — visible throughout combat; aura activates when room is cleared */}
              {combatArenaActive && (
                <CombatArenaPedestal
                  campType={((k) => (k === 'red' ? 'purple' : k))(
                    normalizeCoopPortalKind(coopClearedRoomKind ?? coopCurrentRoomKind ?? campTypes[0]),
                  )}
                  showAura={pedestalBoonReady}
                />
              )}
              {combatArenaActive && coopCurrentRoomKind === 'merchant' && (
                <MerchantNpcRenderer playerPositionRef={realTimePlayerPositionRef} />
              )}
            </>
          )}

      {/* Lighting — throne room brings its own fill; keep this subtle there */}
      <ambientLight intensity={dimThroneLikeLighting ? 0.04 : 0.1} />
      <directionalLight
        position={[10, 10, 5]}
        intensity={dimThroneLikeLighting ? 0.12 : 0.14}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={70}
        shadow-camera-left={-35}
        shadow-camera-right={35}
        shadow-camera-top={35}
        shadow-camera-bottom={-35}
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
          isViperStingCharging={weaponState.isViperStingCharging}
          viperStingChargeProgress={weaponState.viperStingChargeProgress}
          isBarrageCharging={weaponState.isBarrageCharging}
          barrageChargeProgress={weaponState.barrageChargeProgress}
          isCrossentropyCharging={controlSystemRef.current?.isCrossentropyChargingActive() || false}
          isSummonTotemCharging={controlSystemRef.current?.isSummonTotemChargingActive() || false}
          isCobraShotCharging={weaponState.isCobraShotCharging}
          cobraShotChargeProgress={weaponState.cobraShotChargeProgress}
          tempestBurstShotSeq={weaponState.tempestBurstShotSeq}
          isRejuvenatingShotCharging={controlSystemRef.current?.isRejuvenatingShotChargingActive() || false}
          rejuvenatingShotChargeProgress={controlSystemRef.current?.getRejuvenatingShotChargeProgress() || 0}
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
          crusaderBladeThemeActive={
            controlSystemRef.current?.isRunebladeCrusaderBuffActive() || false
          }
          getRunebladeBlizzardTalentActive={
            shouldApplyBlizzardTalent(talentLoadout)
              ? () => controlSystemRef.current?.isRunebladeBlizzardTalentActive() ?? false
              : undefined
          }
          getRunebladeBlizzardStormHitRadius={getRunebladeBlizzardStormHitRadiusCallback}
          getRunebladeBlizzardParticleSpawnMultiplier={getRunebladeBlizzardParticleMultiplier}
          mushroomTargets={!inThroneRoom && !inBossThroneArena ? mushroomTargetsForMelee : []}
          onMushroomHit={!inThroneRoom && !inBossThroneArena ? onMushroomMeleeHit : undefined}
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
            runebladeWhirlwindInstanceRef.current = window.audioSystem?.playRunebladeWhirlwindSound(
              realTimePlayerPositionRef.current,
            );
          }}
          onChargeSpinEnd={() => {
            if (runebladeWhirlwindInstanceRef.current !== undefined) {
              window.audioSystem?.stopSound('runeblade_whirlwind', runebladeWhirlwindInstanceRef.current);
              runebladeWhirlwindInstanceRef.current = undefined;
            }
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

        // Check if player is invisible due to stealth
        const isPlayerInvisible = playerStealthStates.current.get(player.id) || false;

        // Check if player is dead
        const deathState = playerDeathStates.get(player.id);
        const isPlayerDead = deathState?.isDead || false;

        if (isPlayerInvisible) {
          return null; // Don't render invisible players
        }

        const playerState = multiplayerPlayerStates.get(player.id) || {
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
          isFrozen: false,
          runebladeStoredCharge: false,
          tempestBurstShotSeq: 0,
        };

        // Get the real-time position ref for this enemy player
        const enemyPositionRef = enemyPlayerPositionRefs.current.get(player.id);

        const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);

        const remotePeerEntityId = serverPlayerEntities.current.get(player.id);
        if (remotePeerEntityId == null) {
          return null;
        }

        const remotePrimaryWeaponCastHold =
          player.weapon !== WeaponType.BOW &&
          player.weapon !== WeaponType.NONE &&
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
              world={engineRef.current?.getWorld() || new World()}
              isLocalPlayer={false}
              rotation={player.rotation}
              currentWeapon={player.weapon}
              weaponSubclass={
                player.weapon === WeaponType.NONE ? undefined : player.subclass
              }
              isCharging={playerState.isCharging}
              isBarrageCharging={playerState.isBarrageCharging}
              isCobraShotCharging={playerState.isCobraShotCharging}
              isViperStingCharging={playerState.isViperStingCharging}
              remotePrimaryWeaponCastHold={remotePrimaryWeaponCastHold}
              isDead={isPlayerDead}
            />

            {/* Weapon layer — dragon body hidden, only weapon rendered */}
            {player.weapon !== WeaponType.KNIGHT && (
              <DragonRenderer
                entityId={remotePeerEntityId}
                position={playerPos}
                realTimePositionRef={enemyPositionRef}
                world={engineRef.current?.getWorld() || new World()}
                currentWeapon={player.weapon}
                currentSubclass={
                  player.weapon === WeaponType.NONE ? undefined : player.subclass
                }
                isCharging={playerState.isCharging}
                chargeProgress={playerState.chargeProgress}
                isSwinging={playerState.isSwinging}
                isSpinning={playerState.isSpinning}
                swordComboStep={playerState.swordComboStep}
                isSwordCharging={playerState.isSwordCharging}
                isDeflecting={playerState.isDeflecting}
                isViperStingCharging={playerState.isViperStingCharging}
                viperStingChargeProgress={playerState.viperStingChargeProgress}
                isBarrageCharging={playerState.isBarrageCharging}
                barrageChargeProgress={playerState.barrageChargeProgress}
                isCrossentropyCharging={playerState.isCrossentropyCharging || false}
                isSummonTotemCharging={playerState.isSummonTotemCharging || false}
                isCobraShotCharging={playerState.isCobraShotCharging}
                cobraShotChargeProgress={playerState.cobraShotChargeProgress}
                tempestBurstShotSeq={playerState.tempestBurstShotSeq ?? 0}
                isSkyfalling={playerState.isSkyfalling}
                isBackstabbing={playerState.isBackstabbing}
                showVorpalGustBeam={
                  player.weapon === WeaponType.SABRES &&
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
                isDead={isPlayerDead}
                rotation={player.rotation}
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
                purchasedItems={player.purchasedItems || []}
                hideBody={true}
                playerLevel={
                  player.level ??
                  ExperienceSystem.getLevelFromExperience(player.experience ?? 0)
                }
              />
            )}
          </React.Fragment>
        );
      })}

      {/* BOSS Enemy Renderer (Co-op Mode) */}
      {engineRef.current && (enemiesByType.get('boss') ?? []).map(enemy => {
        if (enemy.isDying) return null;

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
                position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
                world={engineRef.current!.getWorld()}
                health={enemy.health}
                maxHealth={enemy.maxHealth}
                rotation={enemy.rotation}
                isDying={!!enemy.isDying}
                staggerBuildup={enemy.staggerBuildup ?? 0}
                isStunned={(() => {
                  const world = engineRef.current!.getWorld();
                  const entity = world.getEntity(entityId);
                  const enemyComponent = entity?.getComponent(Enemy);
                  return enemyComponent ? enemyComponent.isStunned : false;
                })()}
              />
            </React.Suspense>

            {/* Taunt Effect Indicator */}
            {isTaunted && (
              <TauntEffectIndicator
                position={new Vector3(enemy.position.x, enemy.position.y + 4, enemy.position.z)}
              />
            )}
          </group>
        );
      })}

      {/* Boss 2 Enemy Renderer (Co-op Mode) */}
      {(enemiesByType.get('boss2') ?? []).map(enemy => {
        if (enemy.isDying) return null;
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        const isTaunted = isEnemyTaunted(enemy.id);

        return (
          <group key={enemy.id}>
            <React.Suspense fallback={null}>
              <Boss2Renderer
                id={enemy.id}
                position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
                rotation={enemy.rotation || 0}
                health={enemy.health}
                maxHealth={enemy.maxHealth}
                isDying={!!enemy.isDying}
                staggerBuildup={enemy.staggerBuildup ?? 0}
              />
            </React.Suspense>
            {isTaunted && (
              <TauntEffectIndicator
                position={new Vector3(enemy.position.x, enemy.position.y + 5.2, enemy.position.z)}
              />
            )}
          </group>
        );
      })}

      {/* Boss 3 — Weaver Nexus (Co-op) */}
      {(enemiesByType.get('boss3') ?? []).map(enemy => {
        if (enemy.isDying) return null;
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        const isTaunted = isEnemyTaunted(enemy.id);

        return (
          <group key={enemy.id}>
            <React.Suspense fallback={null}>
              <Boss3Renderer
                id={enemy.id}
                position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
                rotation={enemy.rotation || 0}
                health={enemy.health}
                maxHealth={enemy.maxHealth}
                isDying={!!enemy.isDying}
                staggerBuildup={enemy.staggerBuildup ?? 0}
              />
            </React.Suspense>
            {isTaunted && (
              <TauntEffectIndicator
                position={new Vector3(enemy.position.x, enemy.position.y + 5.2, enemy.position.z)}
              />
            )}
          </group>
        );
      })}

      {/* Boss Summoned Skeletons (Co-op Mode) */}
      {(enemiesByType.get('boss-skeleton') ?? []).map(enemy => {
        if (enemy.isDying) return null;
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;

        return (
          <SummonedBossSkeleton
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
          />
        );
      })}

      {/* Knights (Co-op Mode) — Mixamo animated */}
      {(enemiesByType.get('knight') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;

        return (
          <KnightRenderer
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            soulType={enemy.soulType as 'green' | 'red' | 'blue' | 'purple' | undefined}
            campType={enemy.campType}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            visualScale={enemy.visualScale ?? 1}
          />
        );
      })}

      {/* Allied knight — persistent co-op tank companion */}
      {(enemiesByType.get('allied-knight') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;

        return (
          <AlliedKnightRenderer
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            alliedOrbSlots={enemy.alliedOrbSlots}
            fastWalk={enemy.abyssalBoonApplied}
          />
        );
      })}

      {/* Allied healer — persistent co-op support companion */}
      {(enemiesByType.get('allied-healer') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;

        return (
          <AlliedHealerRenderer
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            alliedOrbSlots={enemy.alliedOrbSlots}
          />
        );
      })}

      {/* Throne training dummies (co-op prep) — static replicas, no AI */}
      {(enemiesByType.get('training-dummy') ?? []).map(enemy => (
          <ThroneTrainingDummyEntry key={enemy.id} enemy={enemy} />
      ))}

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

      {/* Shades (Co-op Mode) — ranged throw attackers */}

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
      />
      {(enemiesByType.get('shade') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <ShadeRenderer
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            campType={enemy.campType}
            soulType={enemy.soulType}
            staggerBuildup={enemy.staggerBuildup ?? 0}
          />
        );
      })}

      {/* Warlocks (Co-op Mode) — stationary spellcasters that blink and launch chaos orbs */}
      {(enemiesByType.get('warlock') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <WarlockRenderer
              id={enemy.id}
              position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              soulType={enemy.soulType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {/* Templars (Co-op Mode) — heavy melee fighters with alternating attack animations */}
      {(enemiesByType.get('templar') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <TemplarRenderer
              id={enemy.id}
              position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}      {/* Vipers (Co-op Mode) — ranged archers that draw and release energy arrows */}
      {(enemiesByType.get('viper') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <ViperRenderer
              id={enemy.id}
              position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}      {/* Weavers (Co-op Mode) — support spellcasters that heal allies and summon ghouls */}
      {(enemiesByType.get('weaver') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <WeaverRenderer
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            campType={enemy.campType}
            soulType={enemy.soulType}
            staggerBuildup={enemy.staggerBuildup ?? 0}
          />
        );
      })}      {/* Ghouls (Co-op Mode) — weaver summons; melee undead creatures */}
      {(enemiesByType.get('ghoul') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <GhoulRenderer
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            visualScale={enemy.visualScale ?? 1}
          />
        );
      })}

      {/* Titans (Co-op Mode) — tiered spawns: chance after Boss 1, guaranteed 1–2 after Boss 2, all combat rooms after Boss 3 */}
      {(enemiesByType.get('titan') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <TitanRenderer
              id={enemy.id}
              position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              soulType={enemy.soulType as 'green' | 'red' | 'blue' | 'purple' | undefined}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              bladestormActive={enemy.bladestormActive}
              bladestormStartTime={enemy.bladestormStartTime}
            />
          </React.Suspense>
        );
      })}

      {/* Greed — bonus wandering/fleeing enemy (10% chance per countable combat room wave) */}
      {(enemiesByType.get('greed') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <GreedRenderer
              id={enemy.id}
              position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              soulType={enemy.soulType as 'green' | 'red' | 'blue' | 'purple' | undefined}
            />
          </React.Suspense>
        );
      })}      <CoopTentacleSpineLayer
        ref={tentacleSpineLayerRef}
        enemies={enemiesByType.get('tentacle-spine') ?? []}
        isCoopEnemyVisibleForRender={isCoopEnemyVisibleForRender}
      />

      {/* Martyrs — suicide bombers */}
      {(enemiesByType.get('martyr') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <MartyrRenderer
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
          />
        );
      })}

      {/* Player zombies — INFESTED STRIKE (Wraith Strike kills) */}
      {(enemiesByType.get('player-zombie') ?? []).map(enemy => {
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
        return (
          <ZombieRenderer
            key={enemy.id}
            id={enemy.id}
            position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            visualScale={enemy.zombieVariant === 'juggernaut' ? 1.45 : 1}
          />
        );
      })}      {/* Other Players Health Bars */}
      {Array.from(players.values()).map(player => {
        if (player.id === socket?.id) return null; // Don't show health bar for local player

        // Check if player is invisible (stealth mode) - don't show health bar
        const isInvisible = playerStealthStates.current.get(player.id);
        if (isInvisible) return null;

        // Use shield values from the synchronized player data
        const shieldAmount = player.shield ?? 0;
        const maxShieldAmount = player.maxShield ?? 100;

        return (
          <PlayerHealthBar
            key={`healthbar-${player.id}`}
            playerId={player.id}
            playerName={player.name}
            position={new Vector3(player.position.x, player.position.y, player.position.z)}
            health={player.health}
            maxHealth={player.maxHealth}
            shield={shieldAmount}
            camera={camera}
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
        realTimePlayerPositionRef={realTimePlayerPositionRef}
        getLiveCoopEnemyData={getLiveCoopEnemyData}
        getEnemyType={getCoopEnemyTypeById}
        onSmiteHitEnemy={onPvpSmiteHitEnemy}
        onDeathGraspHitEnemy={onPvpDeathGraspHitEnemy}
        onLightningStormHitEnemy={onPvpLightningStormHitEnemy}
        onSmiteBeamEnemyHitColossusGuard={onSmiteBeamEnemyHitColossusGuard}
        getVengeanceSmiteDamageMultiplier={getVengeanceSmiteDamageMultiplier}
      />

      {/* Unified Managers - Single query optimization */}
      {engineRef.current && engineReady && (
        <>
          <UnifiedProjectileManager
            world={engineRef.current.getWorld()}
            onHauntedSoulAt={(pos) => createPvpHauntedSoulEffect(pos)}
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
          <BowPowershotManager />
          <FrostNovaManager world={engineRef.current.getWorld()} />
          <FireStormManager world={engineRef.current.getWorld()} />
          <ArcticBlizzardManager
            world={engineRef.current.getWorld()}
            getEnemyData={getArcticBlizzardEnemyData}
            getDamagePerTick={getArcticBlizzardDamagePerTick}
            getHitRadius={getArcticBlizzardHitRadiusCallback}
            getParticleSpawnMultiplier={getArcticBlizzardParticleMultiplier}
            hasMonsoon={shouldApplyMonsoonTalent(talentLoadout)}
          />
          <StunManager world={engineRef.current.getWorld()} />
          <EntangleManager world={engineRef.current.getWorld()} />
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
            superconductor={shouldApplySuperconductorTalent(talentLoadout, abilityLoadout)}
            allowPlayerTargets={gameMode !== 'coop'}
            resolveTotemEnemyFrozen={resolveTotemEnemyFrozen}
          />
          <RejuvenatingShotManager
            world={engineRef.current.getWorld()}
            playerPositions={Array.from(players.values())
              .filter(player => player.health > 0 && player.id !== socket?.id) // Exclude local player
              .map(player => ({
                id: player.id,
                position: new Vector3(player.position.x, player.position.y, player.position.z),
                health: player.health,
                maxHealth: player.maxHealth
              }))}
            onPlayerHealed={(playerId, healAmount, position) => {
              // Handle healing logic - broadcast to server for both local and remote players
              if (socket && currentRoomId) {
                broadcastPlayerHealing(healAmount, 'rejuvenating_shot', position, playerId);
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
          ))}        </>
      )}
        </>
      )}

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

  // Enable shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  // Don't rebuild the shadow map automatically every frame. A throttled useFrame
  // flips needsUpdate so dynamic (moving) shadow casters still update, but at ~half
  // the per-frame shadow-pass cost. See the shadow-throttle useFrame below.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

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

