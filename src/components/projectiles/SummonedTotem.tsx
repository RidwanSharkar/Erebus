import React, { useRef, useCallback, useEffect } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import TotemModel from './TotemModel';
import UnholyAura from './UnholyAura';
import TotemEntropicBolt, { type TotemBoltPoolSlot } from './TotemEntropicBolt';
import TotemSuperconductorLightning, { type TotemLightningPoolSlot } from './TotemSuperconductorLightning';
import { calculateDamage } from '@/core/DamageCalculator';
import { WeaponType } from '@/components/dragon/weapons';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import type { EnemyDamageMeta } from '@/contexts/MultiplayerContext';
import type { TotemBoltVariant } from '@/utils/talents';
import {
  ENTANGLEMENT_DURATION_MS,
  SUPERCONDUCTOR_INFESTING_DAMAGE,
  SUPERCONDUCTOR_STAGGERING_STRIKE_STAGGER,
  SUPERCONDUCTOR_TOTEM_COOLDOWN_SEC,
  SUPERCONDUCTOR_TOTEM_DAMAGE,
  SUPERCONDUCTOR_WRATHFUL_CRIT_CHANCE_ADD,
  WRATHFUL_ENTROPIC_BOLT_CRIT_CHANCE_ADD,
  STAGGERING_TOTEM_STAGGER,
} from '@/utils/talents';
import type { WeaponAspect } from '@/utils/weaponAspects';
import {
  isScytheNecromancerAspect,
  NECROMANCER_TOTEM_ENTANGLE_INTERVAL_MS,
  NECROMANCER_TOTEM_ENTANGLE_RADIUS,
} from '@/utils/weaponAspects';
import {
  refreshTotemEnemyTargetScratch,
  type TotemTargetEntry,
} from '@/utils/enemyLiveTransform';
import { getPlayerLivePosition } from '@/utils/playerLiveTransform';
import { addGlobalEntangledEnemy } from '@/components/weapons/EntangleManager';

function totemBoltBaseDamage(variant?: TotemBoltVariant): number {
  if (variant === 'wrathful') return 30;
  if (variant === 'infesting') return 40;
  if (variant === 'frost') return 25;
  return 25;
}

function coopEnemyMetaForTotemBolt(variant?: TotemBoltVariant): EnemyDamageMeta | undefined {
  if (variant === 'wrathful') {
    return { damageType: 'entropic', entropicWrathful: true };
  }
  if (variant === 'staggering') {
    return { damageType: 'entropic', staggerToAdd: STAGGERING_TOTEM_STAGGER };
  }
  if (variant === 'infesting') {
    return { damageType: 'entropic', entropicInfesting: true };
  }
  if (variant === 'frost') {
    return { damageType: 'entropic', frostTotemChill: true };
  }
  return undefined;
}

/** Superconductor shock: staggers 15 vs totem bolts' 10 for staggering variant; same wrath/infest flags as bolts. */
function coopEnemyMetaForSuperconductorStrike(variant?: TotemBoltVariant): EnemyDamageMeta | undefined {
  if (variant === 'wrathful') {
    return { damageType: 'entropic', entropicWrathful: true };
  }
  if (variant === 'staggering') {
    return { damageType: 'entropic', staggerToAdd: SUPERCONDUCTOR_STAGGERING_STRIKE_STAGGER };
  }
  if (variant === 'infesting') {
    return { damageType: 'entropic', entropicInfesting: true };
  }
  if (variant === 'frost') {
    return { damageType: 'entropic', frostTotemChill: true };
  }
  return undefined;
}

interface SummonProps {
  position: Vector3;
  players?: Map<string, any>; // Real-time players data
  localSocketId?: string; // Local player ID to exclude from targets
  enemyData?: Array<{ // Fallback for NPCs or static enemies
    id: string;
    position: Vector3;
    health: number;
  }>;
  onDamage?: (
    targetId: string,
    damage: number,
    impactPosition: Vector3,
    isCritical?: boolean,
    coopEnemyDamageMeta?: EnemyDamageMeta,
  ) => void;
  totemBoltVariant?: TotemBoltVariant;
  /** Scythe aspect for default bolt colors when no talent boon is active. */
  weaponAspect?: WeaponAspect | null;
  onComplete?: () => void;
  onStartCooldown?: () => void;
  setActiveEffects?: (callback: (prev: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => void;
  activeEffects?: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSummon?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  /** When set, routes floating damage text through CombatSystem (same overlay as `DamageNumbers.tsx`). */
  onTotemFloatingDamage?: (damage: number, isCritical: boolean, position: Vector3) => void;
  casterId?: string; // ID of the player who cast the totem
  allowPlayerTargets?: boolean;
  superconductor?: boolean;
  /** Server doubles damage when frozen; use for floating numbers only. Optional in offline/PVP. */
  resolveTotemEnemyFrozen?: (enemyId: string) => boolean;
}

const MAX_TOTEM_BOLTS = 12;
const MAX_TOTEM_LIGHTNING = 6;

function createBoltPool(size: number): TotemBoltPoolSlot[] {
  return Array.from({ length: size }, () => ({
    active: false,
    launchGen: 0,
    id: -1,
    from: new Vector3(),
    to: new Vector3(),
    targetId: '',
  }));
}

function createLightningPool(size: number): TotemLightningPoolSlot[] {
  return Array.from({ length: size }, () => ({
    active: false,
    launchGen: 0,
    id: -1,
    from: new Vector3(),
    to: new Vector3(),
    totemBoltVariant: undefined,
  }));
}

export default function SummonedTotem({
  position,
  players,
  localSocketId,
  enemyData = [],
  onDamage,
  onComplete,
  onStartCooldown,
  setActiveEffects,
  activeEffects = [],
  setDamageNumbers,
  nextDamageNumberId,
  onTotemFloatingDamage,
  casterId,
  allowPlayerTargets = false,
  totemBoltVariant,
  weaponAspect,
  superconductor = false,
  resolveTotemEnemyFrozen,
}: SummonProps) {

  const { enemiesRef, enemyTransformsRef, playersRef, playersTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group>(null);
  const boltIdRef = useRef(0);
  const currentTargetRef = useRef<{ id: string; position: Vector3; health: number } | null>(null);
  const isAttackingRef = useRef(false);
  const boltPool = useRef(createBoltPool(MAX_TOTEM_BOLTS));
  const lightningPool = useRef(createLightningPool(MAX_TOTEM_LIGHTNING));
  const enemyTargetScratchRef = useRef<TotemTargetEntry[]>([]);
  const enemyDataRef = useRef(enemyData);
  enemyDataRef.current = enemyData;
  const allowPlayerTargetsRef = useRef(allowPlayerTargets);
  allowPlayerTargetsRef.current = allowPlayerTargets;
  const casterIdRef = useRef(casterId);
  casterIdRef.current = casterId;

  const constants = useRef({
    lastAttackTime: 0,
    lastSuperconductorTime: Date.now(),
    lastNecromancerEntangleTime: 0,
    startTime: Date.now(),
    hasTriggeredCleanup: false,
    mountId: Date.now(),
    ATTACK_COOLDOWN: 670, // 0.5 seconds
    SUPERCONDUCTOR_COOLDOWN: SUPERCONDUCTOR_TOTEM_COOLDOWN_SEC * 1000,
    RANGE: 8.5, // 6 units range for targeting
    DURATION: 8000, // 8 seconds
    EFFECT_DURATION: 225,
  }).current;

  const calculateDistance = useCallback((pos1: Vector3, pos2: Vector3) => {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, []);

  // Live enemy/player targets refreshed from ref stores (no React re-renders on movement).
  const refreshLiveTargets = useCallback((): TotemTargetEntry[] => {
    const scratch = refreshTotemEnemyTargetScratch(
      enemyTargetScratchRef.current,
      enemiesRef,
      enemyTransformsRef,
    );
    let writeIndex = scratch.length;

    for (const npc of enemyDataRef.current) {
      if (enemiesRef.current.has(npc.id)) continue;
      if (npc.health <= 0) continue;
      if (writeIndex < scratch.length) {
        scratch[writeIndex].id = npc.id;
        scratch[writeIndex].position.copy(npc.position);
        scratch[writeIndex].health = npc.health;
      } else {
        scratch.push({
          id: npc.id,
          position: npc.position.clone(),
          health: npc.health,
        });
      }
      writeIndex++;
    }

    if (allowPlayerTargetsRef.current) {
      for (const [playerId, playerData] of Array.from(playersRef.current.entries())) {
        if (casterIdRef.current && playerId === casterIdRef.current) continue;
        if (playerData.health <= 0) continue;
        const livePos = getPlayerLivePosition(playerId, playersTransformsRef, playerData.position);
        if (writeIndex < scratch.length) {
          scratch[writeIndex].id = playerId;
          scratch[writeIndex].position.set(livePos.x, livePos.y, livePos.z);
          scratch[writeIndex].health = playerData.health;
        } else {
          scratch.push({
            id: playerId,
            position: new Vector3(livePos.x, livePos.y, livePos.z),
            health: playerData.health,
          });
        }
        writeIndex++;
      }
    }

    scratch.length = writeIndex;
    return scratch;
  }, [enemiesRef, enemyTransformsRef, playersRef, playersTransformsRef]);

  const getCurrentEnemyData = useCallback((): TotemTargetEntry[] => {
    return refreshLiveTargets();
  }, [refreshLiveTargets]);

  const findLiveTargetById = useCallback((targetId: string): TotemTargetEntry | undefined => {
    const scratch = enemyTargetScratchRef.current;
    for (let i = 0; i < scratch.length; i++) {
      if (scratch[i].id === targetId && scratch[i].health > 0) {
        return scratch[i];
      }
    }
    return undefined;
  }, []);

  const syncActiveBoltTargets = useCallback(() => {
    for (const slot of boltPool.current) {
      if (!slot.active || !slot.targetId) continue;
      const liveTarget = findLiveTargetById(slot.targetId);
      if (!liveTarget) continue;
      slot.to.copy(liveTarget.position);
      slot.to.y += 1.05;
    }
  }, [findLiveTargetById]);

  const findNewTarget = useCallback((
    excludeCurrentTarget: boolean = false,
    maxRange: number = constants.RANGE,
  ): { id: string; position: Vector3; health: number } | null => {
    if (!groupRef.current) {
      return null;
    }

    const currentEnemyData = enemyTargetScratchRef.current;
    if (!currentEnemyData.length) {
      return null;
    }

    // Get the totem's world position
    const totemWorldPosition = new Vector3();
    groupRef.current.getWorldPosition(totemWorldPosition);

    let closestDistance = maxRange;
    let closestTarget: { id: string; position: Vector3; health: number } | null = null;

    for (let i = 0; i < currentEnemyData.length; i++) {
      const enemy = currentEnemyData[i];

      if (enemy.health <= 0) {
        // Skip dead enemies
        continue;
      }

      if (excludeCurrentTarget && currentTargetRef.current && enemy.id === currentTargetRef.current.id) {
        continue;
      }

      const distance = calculateDistance(
        enemy.position,
        totemWorldPosition
      );

      if (distance <= closestDistance) {
        closestDistance = distance;
        closestTarget = enemy;
      }
    }

    return closestTarget;
  }, [calculateDistance, constants.RANGE]);

  const handleAttack = useCallback((target: { id: string; position: Vector3; health: number }) => {
    const canShowFloating =
      onTotemFloatingDamage || (setDamageNumbers && nextDamageNumberId);
    if (!target || target.health <= 0 || !onDamage || !canShowFloating) {
      return;
    }

    // CRITICAL FIX: Get the current/real-time enemy position from current enemy data at the moment of attack
    const currentEnemyData = getCurrentEnemyData();
    const currentEnemy = currentEnemyData.find(e => e.id === target.id && e.health > 0);
    if (!currentEnemy) {
      return;
    }

    const base = totemBoltBaseDamage(totemBoltVariant);
    const cs = (window as any).controlSystemRef?.current;
    const bloodroseMult = cs?.getBloodroseDamageMultiplier?.() ?? 1;
    const scaledBase = Math.max(0, Math.floor(base * bloodroseMult));
    const dmgOpts =
      totemBoltVariant === 'wrathful' ? { critChanceAdd: WRATHFUL_ENTROPIC_BOLT_CRIT_CHANCE_ADD } : undefined;
    const damageResult = calculateDamage(scaledBase, WeaponType.SCYTHE, dmgOpts);

    const coopEnemyDamageMeta = coopEnemyMetaForTotemBolt(totemBoltVariant);
    const baseDamage = damageResult.damage;
    const displayDamage =
      totemBoltVariant === 'frost' && resolveTotemEnemyFrozen?.(currentEnemy.id)
        ? Math.floor(baseDamage * 2)
        : baseDamage;

    // Use the enemy's current real-time position for damage numbers and effects (not cached target position)
    const currentWorldImpactPosition = currentEnemy.position.clone();
    currentWorldImpactPosition.y += 1.5;



    // CRITICAL: Prevent attacking the caster
    if (casterId && target.id === casterId) {
      return;
    }

    onDamage(
      target.id,
      baseDamage,
      currentWorldImpactPosition,
      damageResult.isCritical,
      coopEnemyDamageMeta,
    );

    // Create explosion effect that tracks the target player's current position
    // Instead of using the internal activeEffects system, broadcast to the global PVP system
    if (typeof window !== 'undefined' && (window as any).triggerSummonTotemExplosion) {
      (window as any).triggerSummonTotemExplosion(target.id, currentWorldImpactPosition);
    }

    if (onTotemFloatingDamage) {
      onTotemFloatingDamage(
        displayDamage,
        damageResult.isCritical,
        currentWorldImpactPosition.clone(),
      );
    } else if (setDamageNumbers && nextDamageNumberId) {
      setDamageNumbers((prev) => [
        ...prev,
        {
          id: nextDamageNumberId.current++,
          damage: displayDamage,
          position: currentWorldImpactPosition.clone(),
          isCritical: damageResult.isCritical,
          isSummon: true,
        },
      ]);
    }
  }, [
    constants,
    onDamage,
    onTotemFloatingDamage,
    setDamageNumbers,
    nextDamageNumberId,
    getCurrentEnemyData,
    casterId,
    totemBoltVariant,
    resolveTotemEnemyFrozen,
  ]);

  const handleSuperconductorStrike = useCallback((target: { id: string; position: Vector3; health: number }) => {
    const canShowFloating =
      onTotemFloatingDamage || (setDamageNumbers && nextDamageNumberId);
    if (!target || target.health <= 0 || !onDamage || !canShowFloating) {
      return;
    }

    const currentEnemyData = getCurrentEnemyData();
    const currentEnemy = currentEnemyData.find(e => e.id === target.id && e.health > 0);
    if (!currentEnemy || (casterId && target.id === casterId)) {
      return;
    }

    const base =
      totemBoltVariant === 'infesting' ? SUPERCONDUCTOR_INFESTING_DAMAGE : SUPERCONDUCTOR_TOTEM_DAMAGE;
    const dmgOpts =
      totemBoltVariant === 'wrathful'
        ? { critChanceAdd: SUPERCONDUCTOR_WRATHFUL_CRIT_CHANCE_ADD }
        : undefined;
    const damageResult = calculateDamage(base, WeaponType.SCYTHE, dmgOpts);
    const coopEnemyDamageMeta = coopEnemyMetaForSuperconductorStrike(totemBoltVariant);
    const baseDamage = damageResult.damage;
    const displayDamage =
      totemBoltVariant === 'frost' && resolveTotemEnemyFrozen?.(currentEnemy.id)
        ? Math.floor(baseDamage * 2)
        : baseDamage;

    const currentWorldImpactPosition = currentEnemy.position.clone();
    currentWorldImpactPosition.y += 1.5;

    onDamage(
      target.id,
      baseDamage,
      currentWorldImpactPosition,
      damageResult.isCritical,
      coopEnemyDamageMeta,
    );

    if (onTotemFloatingDamage) {
      onTotemFloatingDamage(
        displayDamage,
        damageResult.isCritical,
        currentWorldImpactPosition.clone(),
      );
    } else if (setDamageNumbers && nextDamageNumberId) {
      setDamageNumbers((prev) => [
        ...prev,
        {
          id: nextDamageNumberId.current++,
          damage: displayDamage,
          position: currentWorldImpactPosition.clone(),
          isCritical: damageResult.isCritical,
          isSummon: true,
        },
      ]);
    }
  }, [
    onDamage,
    onTotemFloatingDamage,
    setDamageNumbers,
    nextDamageNumberId,
    getCurrentEnemyData,
    casterId,
    totemBoltVariant,
    resolveTotemEnemyFrozen,
  ]);

  useFrame(() => {
    const now = Date.now();

    // Check if totem duration is over
    if (now - constants.startTime > constants.DURATION) {
      if (!constants.hasTriggeredCleanup) {
        constants.hasTriggeredCleanup = true;
        onComplete?.();
        onStartCooldown?.();
      }
      return;
    }

    refreshLiveTargets();
    syncActiveBoltTargets();

    // Necromancer Mantra — Entangle closest enemy within 4.5 every 2s (owner client only).
    if (
      onDamage &&
      isScytheNecromancerAspect(weaponAspect) &&
      now - constants.lastNecromancerEntangleTime >= NECROMANCER_TOTEM_ENTANGLE_INTERVAL_MS
    ) {
      const entangleTarget = findNewTarget(false, NECROMANCER_TOTEM_ENTANGLE_RADIUS);
      if (entangleTarget && entangleTarget.health > 0) {
        constants.lastNecromancerEntangleTime = now;
        const impactPos = entangleTarget.position.clone();
        impactPos.y += 0.5;
        onDamage(entangleTarget.id, 0, impactPos, false, {
          damageType: 'summon_totem',
          necromancerTotemEntangle: true,
        });
        addGlobalEntangledEnemy(entangleTarget.id, impactPos, ENTANGLEMENT_DURATION_MS);
      }
    }

    // Continuously check for the closest enemy in range
    const closestEnemy = findNewTarget();

    if (closestEnemy && closestEnemy.health > 0) {
      if (
        superconductor &&
        groupRef.current &&
        now - constants.lastSuperconductorTime >= constants.SUPERCONDUCTOR_COOLDOWN
      ) {
        const from = new Vector3();
        groupRef.current.getWorldPosition(from);
        from.y += 0.58;
        const to = closestEnemy.position.clone();
        to.y += 1.1;
        const id = boltIdRef.current++;
        const lightningSlot = lightningPool.current.find((slot) => !slot.active);
        if (lightningSlot) {
          lightningSlot.active = true;
          lightningSlot.id = id;
          lightningSlot.from.copy(from);
          lightningSlot.to.copy(to);
          lightningSlot.totemBoltVariant = totemBoltVariant;
          lightningSlot.launchGen += 1;
        }
        (window as any).audioSystem?.playTotemSuperconductorSound?.(from);
        constants.lastSuperconductorTime = now;
        handleSuperconductorStrike(closestEnemy);
      }

      // Attack if we have a valid target in range — spawn a totem bolt; damage applies on impact
      if (groupRef.current) {
        if (now - constants.lastAttackTime >= constants.ATTACK_COOLDOWN) {
          const from = new Vector3();
          groupRef.current.getWorldPosition(from);
          from.y += 0.42;
          const to = closestEnemy.position.clone();
          to.y += 1.05;
          const id = boltIdRef.current++;
          currentTargetRef.current = closestEnemy;
          isAttackingRef.current = true;
          const boltSlot = boltPool.current.find((slot) => !slot.active);
          if (boltSlot) {
            boltSlot.active = true;
            boltSlot.id = id;
            boltSlot.from.copy(from);
            boltSlot.to.copy(to);
            boltSlot.targetId = closestEnemy.id;
            boltSlot.launchGen += 1;
          }
          constants.lastAttackTime = now;
        }
      }
    } else {
      // No enemy in range, clear current target
      if (currentTargetRef.current) {
        currentTargetRef.current = null;
        isAttackingRef.current = false;
      }
    }
  });

  useEffect(() => {
    const currentMountId = constants.mountId;

    return () => {
      setActiveEffects?.(prev =>
        prev.filter(effect =>
          effect.type !== 'summonExplosion' ||
          effect.summonId !== currentMountId
        )
      );
    };
  }, [setActiveEffects, constants.mountId]);

  const onTotemBoltImpact = useCallback(
    (boltId: number, targetId: string) => {
      const currentEnemyData = getCurrentEnemyData();
      const currentEnemy = currentEnemyData.find((e) => e.id === targetId && e.health > 0);
      if (!currentEnemy) {
        return;
      }
      handleAttack(currentEnemy);
    },
    [getCurrentEnemyData, handleAttack],
  );

  const onSuperconductorComplete = useCallback((_id: number) => {
    // Pool slot is cleared imperatively when the lightning finishes.
  }, []);

  return (
    <>
      <group ref={groupRef} position={position.toArray()}>
        <TotemModel
          isAttackingRef={isAttackingRef}
          totemBoltVariant={totemBoltVariant}
          weaponAspect={weaponAspect}
        />
        <UnholyAura totemBoltVariant={totemBoltVariant} weaponAspect={weaponAspect} />
      </group>
      {boltPool.current.map((slot, i) => (
        <TotemEntropicBolt
          key={`totem-bolt-${i}`}
          poolSlot={slot}
          totemBoltVariant={totemBoltVariant}
          weaponAspect={weaponAspect}
          onPoolImpact={onTotemBoltImpact}
        />
      ))}
      {lightningPool.current.map((slot, i) => (
        <TotemSuperconductorLightning
          key={`totem-lightning-${i}`}
          poolSlot={slot}
          onPoolComplete={onSuperconductorComplete}
        />
      ))}
    </>
  );
}
