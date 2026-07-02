import { useRef, useEffect, useState, useCallback, type SetStateAction } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame, useThree } from '@react-three/fiber';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';
import React from 'react';

import DragonUnit from './DragonUnit';
import RunebladeSlashImpact from '../weapons/RunebladeSlashImpact';
import RunebladeWraithStrikeImpact from '../weapons/RunebladeWraithStrikeImpact';
import { DashChargeStatus } from './ChargedOrbitals';
import ViperStingManager, { triggerGlobalViperSting } from '../projectiles/ViperStingManager';
import GhostTrail from './GhostTrail';
import DashFireTrail from './DashFireTrail';
import { WeaponType, WeaponSubclass } from './weapons';
import { World } from '@/ecs/World';
import { Movement } from '@/ecs/components/Movement';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Enemy, EnemyType } from '@/ecs/components/Enemy';
import { CombatSystem } from '@/systems/CombatSystem';
import { calculateDamage } from '@/core/DamageCalculator';
import { ReanimateRef } from '../weapons/Reanimate';
import {
  STAGGERING_COMBO_HIT1_STAGGER,
  STAGGERING_COMBO_HIT2_STAGGER,
  STAGGERING_COMBO_HIT3_STAGGER,
  STAGGERING_TALONS_HIT_STAGGER,
  STAGGERING_TALONS_EXPLOSION_STAGGER,
  EXECUTE_REAPING_TALONS_BONUS_DAMAGE,
  WRATHFUL_COMBO_CRIT_CHANCE_ADD,
  WRATHFUL_COMBO_CRIT_DAMAGE_MULT_ADD,
  type VorpalGustStabBoonBeamTheme,
  type TalentLoadout,
} from '@/utils/talents';

const _chargeDirScratch = new Vector3();
const _cameraDirScratch = new Vector3();
const _movementDeltaScratch = new Vector3();

type DragonEnemyDataEntry = {
  id: string;
  position: Vector3;
  health: number;
  maxHealth: number;
  isBoss: boolean;
};

type DragonActiveEffect = {
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
  wrathfulStrike?: boolean;
  infestedStrike?: boolean;
  wraithGuard?: boolean;
  staggeringStrike?: boolean;
};

function countAvailableDashCharges(charges: DashChargeStatus[]): number {
  let count = 0;
  for (let i = 0; i < charges.length; i++) {
    if (charges[i].isAvailable) count++;
  }
  return count;
}

function writeDashChargesRef(target: DashChargeStatus[], source: DashChargeStatus[]): void {
  for (let i = 0; i < source.length; i++) {
    if (i < target.length) {
      target[i].isAvailable = source[i].isAvailable;
      target[i].cooldownRemaining = source[i].cooldownRemaining;
    } else {
      target.push({
        isAvailable: source[i].isAvailable,
        cooldownRemaining: source[i].cooldownRemaining,
      });
    }
  }
  target.length = source.length;
}

/**
 * Co-op allied units (knight/healer) and player-summoned zombies (`player-zombie`) share the ECS
 * `Enemy` component for gameplay; exclude them from Sword/Bow/Runeblade client melee lists so local
 * swing hitboxes / `runeblade-slash-impact` never treat them as targets. Mirrors `userData` set in
 * CoopGameScene when syncing server enemies.
 */
function shouldExcludeFromWeaponEnemyData(entity: {
  userData?: { isCoopAlliedUnit?: boolean; coopServerEnemyType?: string };
}): boolean {
  const ud = entity.userData;
  if (!ud) return false;
  if (ud.isCoopAlliedUnit === true) return true;
  if (ud.coopServerEnemyType === 'player-zombie') return true;
  return false;
}

interface DragonRendererProps {
  entityId: number;
  position: Vector3;
  realTimePositionRef?: React.RefObject<Vector3>;
  world: World;
  onMeshReady?: (mesh: Group) => void;
  currentWeapon?: WeaponType;
  currentSubclass?: WeaponSubclass;
  isCharging?: boolean;
  chargeProgress?: number;
  chargeDirection?: Vector3;
  isSwinging?: boolean;
  purchasedItems?: string[];
  /** Co-op duo boon (green + purple) — attaches AscendantBoneWings back cosmetic. */
  hasFatebreaker?: boolean;
  /** Co-op duo boon (red + purple) — attaches a small BoneWings back cosmetic. */
  hasFrostQueen?: boolean;
  isSpinning?: boolean;
  onBowRelease?: (finalProgress: number, isPerfectShot?: boolean) => void;
  onScytheSwingComplete?: () => void;
  onSwordSwingComplete?: () => void;
  onSabresSwingComplete?: () => void;
  onRunebladeSwingComplete?: () => void;
  onSpearSwingComplete?: () => void;
  onBackstabComplete?: () => void;
  onSunderComplete?: () => void;
  swordComboStep?: 1 | 2 | 3;
  isSkyfalling?: boolean;
  isBackstabbing?: boolean;
  /** Sabres — show Vorpal Gust beam during Backstab when talent owned or synced from attacker. */
  showVorpalGustBeam?: boolean;
  vorpalGustStabBoonBeamTheme?: VorpalGustStabBoonBeamTheme;
  isSundering?: boolean;
  isSwordCharging?: boolean;
  isDeflecting?: boolean;
  /** Deflect shield VFX (Aegis and/or Wraith Guard). */
  deflectShieldActive?: boolean;
  deflectShieldDurationSec?: number;
  deflectShieldPaletteVariant?: import('@/utils/aegisShieldPalette').AegisPaletteVariant;
  isSmiting?: boolean;
  isColossusStriking?: boolean;
  isDeathGrasping?: boolean;
  isWraithStriking?: boolean;
  isCorruptedAuraActive?: boolean;
  isDead?: boolean;
  onSmiteComplete?: () => void;
  onColossusStrikeComplete?: () => void;
  onDeathGraspComplete?: () => void;
  onWraithStrikeComplete?: () => void;
  onCorruptedAuraToggle?: (active: boolean) => void;
  onChargeComplete?: () => void;
  onChargeSpinStart?: () => void;
  onChargeSpinEnd?: () => void;
  onDeflectComplete?: () => void;
  onHeal?: (amount: number) => void; // Callback for healing effects like Viper Sting soul steal
  rotation?: { x: number; y: number; z: number }; // Add rotation prop for multiplayer
  isLocalPlayer?: boolean; // Flag to distinguish local player from other players
  isStealthing?: boolean; // Whether the local player is currently in stealth mode
  isInvisible?: boolean; // Whether the local player is currently invisible (stealth active)
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCrossentropyCharging?: boolean;
  isSummonTotemCharging?: boolean;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  /** Tempest Rounds: monotonic per-arrow id for EtherBow muzzle VFX. */
  tempestBurstShotSeq?: number;
  isRejuvenatingShotCharging?: boolean;
  rejuvenatingShotChargeProgress?: number;
  isWhirlwindCharging?: boolean;
  whirlwindChargeProgress?: number;
  isWhirlwinding?: boolean;
  isThrowSpearCharging?: boolean;
  throwSpearChargeProgress?: number;
  isThrowSpearReleasing?: boolean;
  reanimateRef?: React.RefObject<ReanimateRef>;
  // Damage number management
  onDamageNumbersReady?: (setDamageNumbers: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSmite?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSmite?: boolean;
  }>) => void, nextDamageNumberId: { current: number }) => void;
  /** Local player: register queue fn for Wraith Strike slash VFX (ControlSystem → activeEffects). */
  onWraithStrikeSlashImpactQueueReady?: (
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
  ) => void;
  // PVP-specific props
  targetPlayerData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    maxHealth: number;
  }>;
  rageSpent?: number;
  combatSystem?: any;
  hideBody?: boolean;
  playerLevel?: number;
  /** Co-op: mushroom ring melee (Sword/Runeblade) — server `mushroom-damage`. */
  mushroomTargets?: Array<{ index: number; position: Vector3 }>;
  onMushroomHit?: (index: number, baseDamage: number) => void;

  /** Wrathful Talons: Reaping Talons return arrow uses preset crit when local player has talent. */
  wrathfulTalonsReturnCrit?: boolean;
  /** Wrathful + Explosive Talons: end-of-range detonation preset crit. */
  wrathfulTalonsExplosionCrit?: boolean;
  /** EXECUTE: Reaping Talons first forward hit may consume a dash for bonus damage. */
  executeReapingTalons?: boolean;
  /** Local player: dash charge spent (e.g. Execute, room boons) — MANA SHIELD shield restore. */
  onDashChargeExpended?: (consumed: number) => void;
  /** EXPLOSIVE TALONS: Reaping Talons detonates at max range; no return arrow. */
  explosiveTalons?: boolean;
  /** GIANTKILLER: Reaping Talons return hit bonus when forward leg hit same target. */
  giantKillerReapingTalons?: boolean;
  /** Wyvern Talons: Reaping hits detonate Cobra + Concentrated Venom remaining DoT. */
  wyvernTalons?: boolean;
  /** Staggering Talons: forward, return, and Explosive detonation Reaping hits apply server stagger. */
  staggeringTalonsActive?: boolean;
  /** Glacial Talons room boon — deep-blue Reaping Talons beams + 2× vs frozen (R routed in CombatSystem). */
  glacialTalonsTheme?: boolean;
  /** Co-op: server applies CV remainder + optional Cobra remainder as one Wyvern Talons hit. */
  detonateWyvernConcentratedVenomCoop?: (serverEnemyId: string, cobraRemainingDamage?: number) => void;
  /** Cyclone Rush: Runeblade Charge — 3 spin rotations + per-rotation damage. */
  runebladeStoredCharge?: boolean;
  /** STAGGERING COMBO: basic attack combo adds stagger per hit (co-op server sync). */
  runebladeStaggeringCombo?: boolean;
  /** Wrathful Combo: 3rd basic hit uses bonus crit roll (client + server damage). */
  runebladeWrathfulCombo?: boolean;
  /** Infested Combo: basic hits heal and can spawn zombies on kill (server). */
  runebladeInfestedCombo?: boolean;
  /** Local player: roll Guard Combo proc after each basic hit (chance in ControlSystem). */
  onRunebladeGuardComboProc?: () => void;
  /** Local player: Windfury + Flurry heal once per Runeblade swing (ControlSystem). */
  onRunebladePrimaryHits?: (enemiesHit: number) => void;
  /** Local: live Runeblade combo step from ControlSystem. */
  runebladeComboStepResolver?: () => 1 | 2 | 3;
  /** Local: EXECUTIONER flat bonus (ControlSystem getAndClear). */
  getRunebladeExecutionerFlatBonus?: () => number;
  /** Local: Crusader flat bonus while buff active. */
  getRunebladeCrusaderLmbFlatBonus?: () => number;
  /** Local: Crusader corrupted blade palette. */
  crusaderBladeThemeActive?: boolean;
  /** Local: Blizzard talent storm (omit when talent not taken). */
  getRunebladeBlizzardTalentActive?: () => boolean;
  /** Local: Awakened Eye — scaled Runeblade Blizzard storm hit radius. */
  getRunebladeBlizzardStormHitRadius?: () => number;
  /** Local: Awakened Eye — denser Runeblade Blizzard frost particles. */
  getRunebladeBlizzardParticleSpawnMultiplier?: () => number;
  /** Room-boom dash boons override the weapon ghost trail while unlocked. */
  roomBoomGhostTrailColor?: string;
  /** Local player talent loadout — drives scythe handle trail colors. */
  talentLoadout?: TalentLoadout | null;
}

export default function DragonRenderer({
  entityId,
  position,
  realTimePositionRef,
  world,
  onMeshReady,
  currentWeapon = WeaponType.NONE,
  currentSubclass,
  isCharging = false,
  chargeProgress = 0,
  chargeDirection,
  isSwinging = false,
  isSpinning = false,
  isDeflecting = false,
  deflectShieldActive: deflectShieldActiveProp,
  deflectShieldDurationSec = 3,
  deflectShieldPaletteVariant = 'default',
  isDead = false,
  isSmiting = false,
  isColossusStriking = false,
  isDeathGrasping = false,
  isWraithStriking = false,
  isCorruptedAuraActive = false,
  crusaderBladeThemeActive = false,
  onSmiteComplete = () => {},
  onColossusStrikeComplete = () => {},
  onDeathGraspComplete = () => {},
  onWraithStrikeComplete = () => {},
  onCorruptedAuraToggle = () => {},
  onBowRelease = () => {},
  onScytheSwingComplete = () => {},
  onSwordSwingComplete = () => {},
  onSabresSwingComplete = () => {},
  onRunebladeSwingComplete = () => {},
  onSpearSwingComplete = () => {},
  onBackstabComplete = () => {},
  onSunderComplete = () => {},
  swordComboStep = 1,
  isSkyfalling = false,
  isBackstabbing = false,
  showVorpalGustBeam = false,
  vorpalGustStabBoonBeamTheme = 'default',
  isSundering = false,
  isSwordCharging = false,
  onChargeComplete = () => {},
  onChargeSpinStart,
  onChargeSpinEnd,
  onDeflectComplete = () => {},
  rotation,
  isLocalPlayer = false,
  isStealthing = false,
  isInvisible = false,
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCrossentropyCharging = false,
  isSummonTotemCharging = false,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  tempestBurstShotSeq = 0,
  isRejuvenatingShotCharging = false,
  rejuvenatingShotChargeProgress = 0,
  isWhirlwindCharging = false,
  whirlwindChargeProgress = 0,
  isWhirlwinding = false,
  isThrowSpearCharging = false,
  throwSpearChargeProgress = 0,
  isThrowSpearReleasing = false,
  reanimateRef,
  targetPlayerData,
  rageSpent,
  onDamageNumbersReady,
  onWraithStrikeSlashImpactQueueReady,
  combatSystem,
  onHeal = () => {},
  purchasedItems = [],
  hasFatebreaker = false,
  hasFrostQueen = false,
  hideBody = false,
  playerLevel = 1,
  wrathfulTalonsReturnCrit = false,
  wrathfulTalonsExplosionCrit = false,
  executeReapingTalons = false,
  onDashChargeExpended,
  explosiveTalons = false,
  giantKillerReapingTalons = false,
  wyvernTalons = false,
  staggeringTalonsActive = false,
  glacialTalonsTheme = false,
  detonateWyvernConcentratedVenomCoop,
  runebladeStoredCharge = false,
  runebladeStaggeringCombo = false,
  runebladeWrathfulCombo = false,
  runebladeInfestedCombo = false,
  onRunebladeGuardComboProc,
  onRunebladePrimaryHits,
  runebladeComboStepResolver,
  getRunebladeExecutionerFlatBonus,
  getRunebladeCrusaderLmbFlatBonus,
  getRunebladeBlizzardTalentActive,
  getRunebladeBlizzardStormHitRadius,
  getRunebladeBlizzardParticleSpawnMultiplier,
  roomBoomGhostTrailColor,
  talentLoadout = null,
  mushroomTargets,
  onMushroomHit,
}: DragonRendererProps) {
  const effectiveDeflectShieldActive = deflectShieldActiveProp ?? isDeflecting;
  const mountRef = useRef(false);
  if (!mountRef.current) {
    console.log('🐉 DragonRenderer mounting:', {
      entityId,
      position: position?.toArray(),
      isLocalPlayer,
      currentWeapon
    });
    mountRef.current = true;
  }
  const { camera } = useThree();
  const groupRef = useRef<Group>(null);
  const movementDirection = useRef(new Vector3(0, 0, 0));
  const lastPosition = useRef(position ? position.clone() : new Vector3(0, 0.5, 0));
  const isDashing = useRef(false);
  /** Movement.isCharging — Sword/Runeblade ability dash (GhostTrail matches regular dash) */
  const isWeaponChargeMoving = useRef(false);
  const currentRotationRef = useRef(new Vector3(0, 0, 0));
  const lastFacingDirection = useRef(new Vector3(0, 0, -1)); // Default facing forward
  const enemyDataRef = useRef<DragonEnemyDataEntry[]>([]);
  const lastEnemyQueryTimeRef = useRef(0);
  const initialDashCharges: DashChargeStatus[] = [
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 },
    { isAvailable: true, cooldownRemaining: 0 },
  ];
  const dashChargesRef = useRef<DashChargeStatus[]>(initialDashCharges.map((charge) => ({ ...charge })));
  const [dashCharges, setDashCharges] = useState<DashChargeStatus[]>(() =>
    initialDashCharges.map((charge) => ({ ...charge })),
  );
  const lastAvailableDashCountRef = useRef(initialDashCharges.length);
  const dashRechargeDurationSec = useRef(8);
  const localChargeDirectionRef = useRef<Vector3 | undefined>(undefined);
  const effectiveChargeDirection = chargeDirection || localChargeDirectionRef.current;
  const [damageNumbers, setDamageNumbers] = useState<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
  }>>([]);
  const nextDamageNumberId = useRef(0);

  // Notify parent when damage number functions are ready
  useEffect(() => {
    if (onDamageNumbersReady) {
      onDamageNumbersReady(setDamageNumbers, nextDamageNumberId);
    }
  }, [onDamageNumbersReady]);
  const lastChargeState = useRef(false);
  const activeEffectsRef = useRef<DragonActiveEffect[]>([]);
  const [activeEffects, setActiveEffectsState] = useState<DragonActiveEffect[]>([]);
  const setActiveEffects = useCallback((updater: SetStateAction<DragonActiveEffect[]>) => {
    const next =
      typeof updater === 'function' ? updater(activeEffectsRef.current) : updater;
    activeEffectsRef.current = next;
    setActiveEffectsState(next);
  }, []);

  const syncDashChargesHud = useCallback((source: DashChargeStatus[]) => {
    writeDashChargesRef(dashChargesRef.current, source);
    const availableCount = countAvailableDashCharges(dashChargesRef.current);
    if (availableCount !== lastAvailableDashCountRef.current) {
      lastAvailableDashCountRef.current = availableCount;
      setDashCharges(dashChargesRef.current.map((charge) => ({ ...charge })));
    }
  }, []);

  const refreshEnemyDataRef = useCallback(() => {
    const enemies = world
      .queryEntities([Transform, Health, Enemy])
      .filter((entity) => !shouldExcludeFromWeaponEnemyData(entity));
    const enemyDataArray = enemyDataRef.current;
    let writeIndex = 0;

    for (const enemy of enemies) {
      const transform = enemy.getComponent(Transform)!;
      const health = enemy.getComponent(Health)!;
      if (health.currentHealth <= 0) continue;

      const ec = enemy.getComponent(Enemy);
      const worldPos = transform.getWorldPosition();
      if (writeIndex < enemyDataArray.length) {
        const entry = enemyDataArray[writeIndex];
        entry.id = enemy.id.toString();
        entry.position.copy(worldPos);
        entry.health = health.currentHealth;
        entry.maxHealth = health.maxHealth;
        entry.isBoss = ec != null && ec.type === EnemyType.BOSS;
      } else {
        enemyDataArray.push({
          id: enemy.id.toString(),
          position: worldPos.clone(),
          health: health.currentHealth,
          maxHealth: health.maxHealth,
          isBoss: ec != null && ec.type === EnemyType.BOSS,
        });
      }
      writeIndex++;
    }
    enemyDataArray.length = writeIndex;
  }, [world]);

  useEffect(() => {
    if (!isLocalPlayer || !onWraithStrikeSlashImpactQueueReady) return;
    const queue = (
      pos: Vector3,
      dir: Vector3,
      meta?: {
        wrathfulStrike?: boolean;
        infestedStrike?: boolean;
        wraithGuard?: boolean;
        staggeringStrike?: boolean;
      },
    ) => {
      setActiveEffects((prev) => [
        ...prev,
        {
          id: Date.now() + Math.random(),
          type: 'runeblade-wraith-strike-impact',
          position: pos.clone(),
          direction: dir.clone(),
          startTime: Date.now(),
          duration: 0.5,
          wrathfulStrike: meta?.wrathfulStrike,
          infestedStrike: meta?.infestedStrike,
          wraithGuard: meta?.wraithGuard,
          staggeringStrike: meta?.staggeringStrike,
        },
      ]);
    };
    onWraithStrikeSlashImpactQueueReady(queue);
    return () => {
      onWraithStrikeSlashImpactQueueReady(null);
    };
  }, [isLocalPlayer, onWraithStrikeSlashImpactQueueReady]);

  // Real-time position ref for charge trail particles
  // Use the passed ref if available (for local player), otherwise create our own (for remote players)
  const internalRealTimePositionRef = useRef<Vector3>(position ? position.clone() : new Vector3(0, 0.5, 0));
  const effectiveRealTimePositionRef = realTimePositionRef || internalRealTimePositionRef;

  // Calculate movement direction based on position changes
  useFrame(() => {
    if (!groupRef.current) return;

    // Check if charge state changed from false to true
    if (isSwordCharging && !lastChargeState.current) {
      // Charge just started - calculate direction from camera
      camera.getWorldDirection(_chargeDirScratch);
      _chargeDirScratch.y = 0; // Keep movement horizontal
      _chargeDirScratch.normalize();
      if (!localChargeDirectionRef.current) {
        localChargeDirectionRef.current = new Vector3();
      }
      localChargeDirectionRef.current.copy(_chargeDirScratch);
    }
    lastChargeState.current = isSwordCharging;

    // Clean up expired active effects — only re-render when an effect is removed
    const now = Date.now();
    const prevEffectCount = activeEffectsRef.current.length;
    activeEffectsRef.current = activeEffectsRef.current.filter((effect) => {
      if (effect.startTime && effect.duration) {
        return now - effect.startTime < effect.duration * 1000;
      }
      return true; // Keep effects without expiration
    });
    if (activeEffectsRef.current.length !== prevEffectCount) {
      setActiveEffectsState([...activeEffectsRef.current]);
    }

    // Update position from ref (local player) or prop (remote)
    if (effectiveRealTimePositionRef.current) {
      groupRef.current.position.copy(effectiveRealTimePositionRef.current);
    } else if (position) {
      groupRef.current.position.copy(position);
    }

    // Get dash state from Movement component
    const entity = world.getEntity(entityId);
    if (entity) {
      const movement = entity.getComponent(Movement);

      // Check if it's a Movement component by checking for specific methods
      const isMovementComponent = movement && (
        typeof movement.getDashChargeStatus === 'function' ||
        (movement as any).componentType === 'Movement' ||
        movement.constructor.name === 'Movement'
      );

      if (isMovementComponent) {
        isDashing.current = movement.isDashing;
        isWeaponChargeMoving.current = movement.isCharging;

        // Update dash charges ref; HUD state only when available count changes
        if (typeof movement.getDashChargeStatus === 'function') {
          const currentChargeStatus = movement.getDashChargeStatus();
          syncDashChargesHud(currentChargeStatus);
          if (typeof movement.getDashChargeRechargeSec === 'function') {
            dashRechargeDurationSec.current = movement.getDashChargeRechargeSec();
          }
        }

        // Update charge direction ref if charging
        if (movement.isCharging) {
          if (!localChargeDirectionRef.current) {
            localChargeDirectionRef.current = new Vector3();
          }
          localChargeDirectionRef.current.copy(movement.chargeDirection);
        } else {
          localChargeDirectionRef.current = undefined;
        }
      }
    }

    // Calculate movement direction for tail animation
    if (position) {
      _movementDeltaScratch.copy(position).sub(lastPosition.current);
      if (_movementDeltaScratch.length() > 0.001) {
        movementDirection.current.copy(_movementDeltaScratch.normalize());
      } else {
        movementDirection.current.set(0, 0, 0);
      }
      lastPosition.current.copy(position);
    }

    // Rotate dragon based on whether it's the local player or other players
    if (isLocalPlayer && camera) {
      // Local player: face immediate orbit yaw (matches movement basis while RMB orbiting)
      const cameraSystem = (window as any).cameraSystem as
        | { getOrbitHorizontalFacingAngle?: () => number }
        | undefined;
      const angle =
        typeof cameraSystem?.getOrbitHorizontalFacingAngle === 'function'
          ? cameraSystem.getOrbitHorizontalFacingAngle()
          : (() => {
              camera.getWorldDirection(_cameraDirScratch);
              return Math.atan2(_cameraDirScratch.x, _cameraDirScratch.z);
            })();
      groupRef.current.rotation.y = angle;

      const localEntity = world.getEntity(entityId);
      if (localEntity) {
        // Update real-time position ref for charge trail particles
        const transform = localEntity.getComponent(Transform);
        if (transform && transform.position && effectiveRealTimePositionRef.current) {
          effectiveRealTimePositionRef.current.copy(transform.position);
        }

        const movement = localEntity.getComponent(Movement);
        if (movement && movement.inputStrength > 0.1 && movement.moveDirection.length() > 0.1) {
          lastFacingDirection.current
            .set(movement.moveDirection.x, 0, movement.moveDirection.z)
            .normalize();
        } else {
          // Idle: keep ref aligned with camera so future logic stays consistent
          lastFacingDirection.current.set(Math.sin(angle), 0, Math.cos(angle));
        }
      }

      // Sword/Runeblade cones use playerRotation — must match dragon mesh (camera horizontal yaw),
      // not stale move-only yaw (fixes LMB deadzone when orbiting camera without moving).
      currentRotationRef.current.set(0, angle, 0);
    } else if (!isLocalPlayer && rotation) {
      // Other players: use their actual rotation from server
      groupRef.current.rotation.set(rotation.x, rotation.y, rotation.z);
      currentRotationRef.current.set(rotation.x, rotation.y, rotation.z);
    }

    // Throttled enemy ECS query — every frame while swinging, otherwise every 100ms
    if (
      currentWeapon === WeaponType.SWORD ||
      currentWeapon === WeaponType.BOW ||
      currentWeapon === WeaponType.RUNEBLADE
    ) {
      const queryNow = performance.now();
      if (isSwinging || queryNow - lastEnemyQueryTimeRef.current >= 100) {
        lastEnemyQueryTimeRef.current = queryNow;
        refreshEnemyDataRef();
      }
    }
  });

  useEffect(() => {
    if (groupRef.current && onMeshReady) {
      onMeshReady(groupRef.current);
    }
  }, [onMeshReady]);
  
  // Handle sword damage through combat system
  const handleSwordHit = (
    targetId: string,
    damage: number,
    isCritical?: boolean,
    position?: Vector3,
    isBlizzard?: boolean,
    viperPhase?: 'forward' | 'return' | 'explosion',
  ) => {
    const targetEntity = world.getEntity(parseInt(targetId));
    const playerEntityObj = world.getEntity(entityId);

    if (targetEntity && playerEntityObj) {
      // Use combat system to deal damage (this will handle damage numbers automatically)
      const combatSystem = world.getSystem(CombatSystem);
      if (combatSystem) {
        if (currentWeapon === WeaponType.BOW && wyvernTalons) {
          const enemyForWyvern = targetEntity.getComponent(Enemy);
          if (enemyForWyvern) {
            const t = Date.now() / 1000;
            const cobraBurst = enemyForWyvern.getRemainingCobraVenomDamageInstant(t);
            if (combatSystem.usesNetworkedEnemyDamage() && detonateWyvernConcentratedVenomCoop) {
              const sid = targetEntity.userData?.serverEnemyId || String(targetEntity.id);
              if (cobraBurst > 0) {
                enemyForWyvern.removeVenom();
              }
              detonateWyvernConcentratedVenomCoop(sid, cobraBurst);
            } else {
              const cvBurst = enemyForWyvern.getRemainingConcentratedVenomDamageInstant(t);
              const totalDetonate = cobraBurst + cvBurst;
              if (totalDetonate > 0) {
                if (cobraBurst > 0) enemyForWyvern.removeVenom();
                if (cvBurst > 0) enemyForWyvern.removeConcentratedVenom();
                combatSystem.queueDamage(
                  targetEntity,
                  totalDetonate,
                  playerEntityObj,
                  'wyvern_talons_detonate',
                  playerEntityObj.userData?.playerId,
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
                  true,
                );
              }
            }
          }
        }

        const isReapingViperPhase =
          currentWeapon === WeaponType.BOW &&
          !isBlizzard &&
          (viperPhase === 'forward' || viperPhase === 'return' || viperPhase === 'explosion');

        const damageType = isBlizzard ? 'blizzard' : isReapingViperPhase ? 'reaping_talons' : 'sword';

        const glacialTalonsForHit = glacialTalonsTheme && isReapingViperPhase;
        const rbComboStep =
          currentWeapon === WeaponType.RUNEBLADE && runebladeComboStepResolver
            ? runebladeComboStepResolver()
            : swordComboStep;
        let staggerToAdd: number | undefined;
        if (currentWeapon === WeaponType.BOW && staggeringTalonsActive) {
          if (viperPhase === 'explosion') {
            staggerToAdd = STAGGERING_TALONS_EXPLOSION_STAGGER;
          } else if (viperPhase === 'forward' || viperPhase === 'return') {
            staggerToAdd = STAGGERING_TALONS_HIT_STAGGER;
          }
        } else if (currentWeapon === WeaponType.RUNEBLADE && runebladeStaggeringCombo && !isBlizzard) {
          staggerToAdd =
            rbComboStep === 1
              ? STAGGERING_COMBO_HIT1_STAGGER
              : rbComboStep === 2
                ? STAGGERING_COMBO_HIT2_STAGGER
                : STAGGERING_COMBO_HIT3_STAGGER;
        }

        let outgoingDamage = damage;
        let critPreset = isCritical;
        if (
          currentWeapon === WeaponType.RUNEBLADE &&
          !isBlizzard &&
          runebladeWrathfulCombo &&
          rbComboStep === 3
        ) {
          const r = calculateDamage(damage, WeaponType.RUNEBLADE, {
            critChanceAdd: WRATHFUL_COMBO_CRIT_CHANCE_ADD,
            critDamageMultAdd: WRATHFUL_COMBO_CRIT_DAMAGE_MULT_ADD,
          });
          outgoingDamage = r.damage;
          critPreset = r.isCritical;
        }

        const infestedCombo =
          currentWeapon === WeaponType.RUNEBLADE && !isBlizzard && runebladeInfestedCombo;

        const wyvernTalonsZombieOnKill = wyvernTalons && isReapingViperPhase;

        combatSystem.queueDamage(
          targetEntity,
          outgoingDamage,
          playerEntityObj,
          damageType,
          playerEntityObj?.userData?.playerId,
          critPreset,
          undefined,
          staggerToAdd,
          undefined,
          undefined,
          undefined,
          undefined,
          infestedCombo,
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
          false,
          glacialTalonsForHit,
          undefined,
          undefined,
          undefined,
          wyvernTalonsZombieOnKill || undefined,
        );

        if (
          isLocalPlayer &&
          currentWeapon === WeaponType.RUNEBLADE &&
          !isBlizzard &&
          onRunebladeGuardComboProc
        ) {
          onRunebladeGuardComboProc();
        }
      }
    }
  };

  const onExecuteFirstForwardHit = useCallback((): number => {
    const ent = world.getEntity(entityId);
    const m = ent?.getComponent(Movement);
    if (!m) return 0;
    const consumed = m.consumeDashChargesWithoutDash(1, Date.now() / 1000);
    if (consumed > 0) {
      onDashChargeExpended?.(consumed);
    }
    return consumed > 0 ? EXECUTE_REAPING_TALONS_BONUS_DAMAGE : 0;
  }, [world, entityId, onDashChargeExpended]);

  return (
    <>
      <group ref={groupRef}>
        {/* Death effect - make dragon semi-transparent when dead. Uses the pooled unit
            light so a player/ally dying doesn't change the scene light count (which
            would recompile every lit material — a hitch exactly on death/respawn). */}
        {isDead && (
          <EnemyDynamicLight
            color="#ff4444"
            intensity={0.5}
            distance={3}
            decay={2}
          />
        )}
        <DragonUnit
          position={new Vector3(0, 0, 0)} // Position is handled by the parent group
          movementDirection={movementDirection.current}
          isDashing={isDashing.current}
          entityId={entityId}
          dashCharges={dashCharges}
          dashRechargeDurationSec={dashRechargeDurationSec.current}
          chargeDirection={effectiveChargeDirection}
          currentWeapon={currentWeapon}
          currentSubclass={currentSubclass}
          isCharging={isCharging}
          chargeProgress={chargeProgress}
          isSwinging={isSwinging}
          isSpinning={isSpinning}
          onBowRelease={onBowRelease}
          onScytheSwingComplete={onScytheSwingComplete}
          onSwordSwingComplete={onSwordSwingComplete}
          onSabresSwingComplete={onSabresSwingComplete}
          onRunebladeSwingComplete={onRunebladeSwingComplete}
          onSpearSwingComplete={onSpearSwingComplete}
          onBackstabComplete={onBackstabComplete}
          onSunderComplete={onSunderComplete}
          swordComboStep={swordComboStep}
          isSkyfalling={isSkyfalling}
          isBackstabbing={isBackstabbing}
          showVorpalGustBeam={showVorpalGustBeam}
          vorpalGustStabBoonBeamTheme={vorpalGustStabBoonBeamTheme}
          isSundering={isSundering}
          isStealthing={isStealthing}
          isInvisible={isInvisible}
          isSwordCharging={isSwordCharging}
          isDeflecting={isDeflecting}
          deflectShieldActive={effectiveDeflectShieldActive}
          deflectShieldDurationSec={deflectShieldDurationSec}
          deflectShieldPaletteVariant={deflectShieldPaletteVariant}
          isSmiting={isSmiting}
          isColossusStriking={isColossusStriking}
          isDeathGrasping={isDeathGrasping}
          isWraithStriking={isWraithStriking}
          isCorruptedAuraActive={isCorruptedAuraActive}
          crusaderBladeThemeActive={crusaderBladeThemeActive}
          onSmiteComplete={onSmiteComplete}
          onColossusStrikeComplete={onColossusStrikeComplete}
          onDeathGraspComplete={onDeathGraspComplete}
          onWraithStrikeComplete={onWraithStrikeComplete}
          onCorruptedAuraToggle={onCorruptedAuraToggle}
          onChargeComplete={onChargeComplete}
          onChargeSpinStart={onChargeSpinStart}
          onChargeSpinEnd={onChargeSpinEnd}
          onDeflectComplete={onDeflectComplete}
          enemyData={enemyDataRef.current}
          onHit={handleSwordHit}
          setDamageNumbers={setDamageNumbers}
          nextDamageNumberId={nextDamageNumberId}
          playerPosition={position}
          playerRotation={currentRotationRef.current}
          realTimePositionRef={effectiveRealTimePositionRef}
          isViperStingCharging={isViperStingCharging}
          viperStingChargeProgress={viperStingChargeProgress}
          isBarrageCharging={isBarrageCharging}
          barrageChargeProgress={barrageChargeProgress}
          isCrossentropyCharging={isCrossentropyCharging}
          talentLoadout={talentLoadout}
          isSummonTotemCharging={isSummonTotemCharging}
          isCobraShotCharging={isCobraShotCharging}
          cobraShotChargeProgress={cobraShotChargeProgress}
          tempestBurstShotSeq={tempestBurstShotSeq}
          isRejuvenatingShotCharging={isRejuvenatingShotCharging}
          rejuvenatingShotChargeProgress={rejuvenatingShotChargeProgress}
          isWhirlwindCharging={isWhirlwindCharging}
          whirlwindChargeProgress={whirlwindChargeProgress}
          isWhirlwinding={isWhirlwinding}
          isThrowSpearCharging={isThrowSpearCharging}
          throwSpearChargeProgress={throwSpearChargeProgress}
          isThrowSpearReleasing={isThrowSpearReleasing}
          reanimateRef={reanimateRef}
          setActiveEffects={setActiveEffects}
          targetPlayerData={targetPlayerData}
          rageSpent={rageSpent}
          combatSystem={combatSystem}
          purchasedItems={purchasedItems}
          hasFatebreaker={hasFatebreaker}
          hasFrostQueen={hasFrostQueen}
          hideBody={hideBody}
          playerLevel={playerLevel}
          runebladeStoredCharge={runebladeStoredCharge}
          onRunebladePrimaryHits={onRunebladePrimaryHits}
          runebladeComboStepResolver={runebladeComboStepResolver}
          getRunebladeExecutionerFlatBonus={getRunebladeExecutionerFlatBonus}
          getRunebladeCrusaderLmbFlatBonus={getRunebladeCrusaderLmbFlatBonus}
          getRunebladeBlizzardTalentActive={getRunebladeBlizzardTalentActive}
          getRunebladeBlizzardStormHitRadius={getRunebladeBlizzardStormHitRadius}
          getRunebladeBlizzardParticleSpawnMultiplier={getRunebladeBlizzardParticleSpawnMultiplier}
          mushroomTargets={mushroomTargets}
          onMushroomHit={onMushroomHit}
          isLocalPlayer={isLocalPlayer}
        />
      </group>
      
      {/* GHOST TRAIL - Rendered outside dragon group to avoid inheriting transformations */}
      <GhostTrail
        parentRef={groupRef}
        weaponType={currentWeapon}
        weaponSubclass={currentSubclass}
        targetPosition={effectiveRealTimePositionRef.current || undefined}
        isStealthing={isStealthing}
        isDashingRef={isDashing}
        isWeaponChargeMovingRef={isWeaponChargeMoving}
        isSkyfalling={isSkyfalling}
        yOffset={hideBody ? 1.0 : 0}
        fixedTrailColor={roomBoomGhostTrailColor}
      />
      <DashFireTrail
        worldPositionRef={effectiveRealTimePositionRef}
        isDashingRef={isDashing}
        yOffset={hideBody ? 1.0 : 0}
      />
      
      {/* VIPER STING MANAGER - Only for local player with bow */}
      {isLocalPlayer && currentWeapon === WeaponType.BOW && (
        <ViperStingManager
          parentRef={groupRef}
          enemyData={enemyDataRef.current}
          onHit={handleSwordHit}
          setDamageNumbers={setDamageNumbers}
          nextDamageNumberId={nextDamageNumberId}
          onHealthChange={onHeal}
          charges={dashCharges.map((charge, index) => ({
            id: index + 1,
            available: charge.isAvailable,
            cooldownStartTime: charge.cooldownRemaining > 0 ? Date.now() - (15000 - charge.cooldownRemaining * 1000) : null
          }))}
          setCharges={(newCharges) => {
            // Convert back to DashChargeStatus format
            if (typeof newCharges === 'function') {
              setDashCharges(prev => {
                const converted = newCharges(prev.map((charge, index) => ({
                  id: index + 1,
                  available: charge.isAvailable,
                  cooldownStartTime: charge.cooldownRemaining > 0 ? Date.now() - (15000 - charge.cooldownRemaining * 1000) : null
                })));

                const next = converted.map((charge) => ({
                  isAvailable: charge.available,
                  cooldownRemaining: charge.cooldownStartTime ? Math.max(0, (15000 - (Date.now() - charge.cooldownStartTime)) / 1000) : 0
                }));
                writeDashChargesRef(dashChargesRef.current, next);
                lastAvailableDashCountRef.current = countAvailableDashCharges(next);
                return next;
              });
            } else {
              const next = newCharges.map((charge) => ({
                isAvailable: charge.available,
                cooldownRemaining: charge.cooldownStartTime ? Math.max(0, (15000 - (Date.now() - charge.cooldownStartTime)) / 1000) : 0
              }));
              writeDashChargesRef(dashChargesRef.current, next);
              lastAvailableDashCountRef.current = countAvailableDashCharges(next);
              setDashCharges(next);
            }
          }}
          localSocketId="local-player" // For single-player mode, use a fixed ID
          wrathfulTalonsReturnCrit={wrathfulTalonsReturnCrit}
          wrathfulTalonsExplosionCrit={wrathfulTalonsExplosionCrit}
          explosiveTalons={explosiveTalons}
          onExecuteFirstForwardHit={executeReapingTalons ? onExecuteFirstForwardHit : undefined}
          giantKiller={giantKillerReapingTalons}
          glacialTalonsTheme={glacialTalonsTheme}
        />
      )}

      {/* RUNEBLADE SLASH IMPACT — crescent arc + hit flash spawned per local LMB hit */}
      {activeEffects
        .filter(e => e.type === 'runeblade-slash-impact')
        .map(e => (
          <RunebladeSlashImpact
            key={e.id}
            position={e.position}
            direction={e.direction}
            onComplete={() =>
              setActiveEffects(prev => prev.filter(x => x.id !== e.id))
            }
          />
        ))}
      {activeEffects
        .filter(e => e.type === 'runeblade-wraith-strike-impact')
        .map(e => (
          <RunebladeWraithStrikeImpact
            key={e.id}
            position={e.position}
            direction={e.direction}
            wrathfulStrike={e.wrathfulStrike}
            infestedStrike={e.infestedStrike}
            wraithGuard={e.wraithGuard}
            staggeringStrike={e.staggeringStrike}
            onComplete={() =>
              setActiveEffects(prev => prev.filter(x => x.id !== e.id))
            }
          />
        ))}
    </>
  );
}
