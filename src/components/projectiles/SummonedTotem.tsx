import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import TotemModel from './TotemModel';
import UnholyAura from './UnholyAura';
import TotemEntropicBolt from './TotemEntropicBolt';
import TotemSuperconductorLightning from './TotemSuperconductorLightning';
import { calculateDamage } from '@/core/DamageCalculator';
import { WeaponType } from '@/components/dragon/weapons';
import type { EnemyDamageMeta } from '@/contexts/MultiplayerContext';
import type { TotemBoltVariant } from '@/utils/talents';
import {
  SUPERCONDUCTOR_INFESTING_DAMAGE,
  SUPERCONDUCTOR_STAGGERING_STRIKE_STAGGER,
  SUPERCONDUCTOR_TOTEM_COOLDOWN_SEC,
  SUPERCONDUCTOR_TOTEM_DAMAGE,
  SUPERCONDUCTOR_WRATHFUL_CRIT_CHANCE_ADD,
  WRATHFUL_ENTROPIC_BOLT_CRIT_CHANCE_ADD,
  STAGGERING_TOTEM_STAGGER,
} from '@/utils/talents';

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
  superconductor = false,
  resolveTotemEnemyFrozen,
}: SummonProps) {

  const groupRef = useRef<Group>(null);
  const boltIdRef = useRef(0);
  const [currentTarget, setCurrentTarget] = useState<{ id: string; position: Vector3; health: number } | null>(null);
  const [activeBolts, setActiveBolts] = useState<
    Array<{ id: number; from: Vector3; to: Vector3; targetId: string }>
  >([]);
  const [activeLightning, setActiveLightning] = useState<
    Array<{ id: number; from: Vector3; to: Vector3; totemBoltVariant?: TotemBoltVariant }>
  >([]);

  const constants = useRef({
    lastAttackTime: 0,
    lastSuperconductorTime: Date.now(),
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

  // Get current enemy data from players and static enemyData
  const getCurrentEnemyData = useCallback((): Array<{ id: string; position: Vector3; health: number }> => {
    let currentEnemies: Array<{ id: string; position: Vector3; health: number }> = [...enemyData];

    // Add real-time player positions
    if (allowPlayerTargets && players) {
      const playerEnemies = Array.from(players.entries())
        .filter(([playerId]) => !casterId || playerId !== casterId) // Exclude the caster of the totem (if casterId is defined)
        .map(([playerId, playerData]) => ({
          id: playerId,
          position: new Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
          health: playerData.health
        }));

      currentEnemies = [...currentEnemies, ...playerEnemies];
    }

    return currentEnemies;
  }, [players, casterId, enemyData, allowPlayerTargets]);

  const findNewTarget = useCallback((excludeCurrentTarget: boolean = false): { id: string; position: Vector3; health: number } | null => {
    if (!groupRef.current) {
      return null;
    }

    const currentEnemyData = getCurrentEnemyData();
    if (!currentEnemyData.length) {
      return null;
    }

    // Get the totem's world position
    const totemWorldPosition = new Vector3();
    groupRef.current.getWorldPosition(totemWorldPosition);

    let closestDistance = constants.RANGE;
    let closestTarget: { id: string; position: Vector3; health: number } | null = null;

    for (let i = 0; i < currentEnemyData.length; i++) {
      const enemy = currentEnemyData[i];

      if (enemy.health <= 0) {
        // Skip dead enemies
        continue;
      }

      if (excludeCurrentTarget && currentTarget && enemy.id === currentTarget.id) {
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
  }, [getCurrentEnemyData, calculateDistance, currentTarget, constants.RANGE]);

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
    const dmgOpts =
      totemBoltVariant === 'wrathful' ? { critChanceAdd: WRATHFUL_ENTROPIC_BOLT_CRIT_CHANCE_ADD } : undefined;
    const damageResult = calculateDamage(base, WeaponType.SCYTHE, dmgOpts);

    const coopEnemyDamageMeta = coopEnemyMetaForTotemBolt(totemBoltVariant);
    const baseDamage = damageResult.damage;
    const displayDamage =
      totemBoltVariant === 'frost' && resolveTotemEnemyFrozen?.(currentEnemy.id)
        ? Math.floor(baseDamage * 2)
        : baseDamage;

    // Use the enemy's current real-time position for damage numbers and effects (not cached target position)
    const currentWorldImpactPosition = currentEnemy.position.clone().setY(1.5);



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

    const currentWorldImpactPosition = currentEnemy.position.clone().setY(1.5);

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
        to.y = Math.max(to.y, 0.35) + 1.1;
        const id = boltIdRef.current++;

        setActiveLightning((prev) => [
          ...prev,
          {
            id,
            from: from.clone(),
            to: to.clone(),
            totemBoltVariant,
          },
        ]);
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
          to.y = Math.max(to.y, 0.35) + 1.05;
          const id = boltIdRef.current++;
          setCurrentTarget(closestEnemy);
          setActiveBolts((prev) => [
            ...prev,
            {
              id,
              from: from.clone(),
              to: to.clone(),
              targetId: closestEnemy.id,
            },
          ]);
          constants.lastAttackTime = now;
        }
      }
    } else {
      // No enemy in range, clear current target
      if (currentTarget) {
        setCurrentTarget(null);
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
      setActiveBolts((prev) => prev.filter((b) => b.id !== boltId));
      const currentEnemyData = getCurrentEnemyData();
      const currentEnemy = currentEnemyData.find((e) => e.id === targetId && e.health > 0);
      if (!currentEnemy) {
        return;
      }
      handleAttack(currentEnemy);
    },
    [getCurrentEnemyData, handleAttack],
  );

  const onSuperconductorComplete = useCallback((id: number) => {
    setActiveLightning((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return (
    <>
      <group ref={groupRef} position={position.toArray()}>
        <TotemModel isAttacking={!!currentTarget} totemBoltVariant={totemBoltVariant} />
        <UnholyAura totemBoltVariant={totemBoltVariant} />
      </group>
      {activeBolts.map((b) => (
        <TotemEntropicBolt
          key={b.id}
          from={b.from}
          to={b.to}
          totemBoltVariant={totemBoltVariant}
          onImpact={() => onTotemBoltImpact(b.id, b.targetId)}
        />
      ))}
      {activeLightning.map((b) => (
        <TotemSuperconductorLightning
          key={b.id}
          from={b.from}
          to={b.to}
          totemBoltVariant={b.totemBoltVariant}
          onComplete={() => onSuperconductorComplete(b.id)}
        />
      ))}
    </>
  );
}
