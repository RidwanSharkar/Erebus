import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import TotemModel from './TotemModel';
import UnholyAura from './UnholyAura';
import TotemEntropicBolt from './TotemEntropicBolt';
import { calculateDamage } from '@/core/DamageCalculator';
import { WeaponType } from '@/components/dragon/weapons';

interface SummonProps {
  position: Vector3;
  players?: Map<string, any>; // Real-time players data
  localSocketId?: string; // Local player ID to exclude from targets
  enemyData?: Array<{ // Fallback for NPCs or static enemies
    id: string;
    position: Vector3;
    health: number;
  }>;
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void;
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
  casterId
}: SummonProps) {

  const groupRef = useRef<Group>(null);
  const boltIdRef = useRef(0);
  const [currentTarget, setCurrentTarget] = useState<{ id: string; position: Vector3; health: number } | null>(null);
  const [activeBolts, setActiveBolts] = useState<
    Array<{ id: number; from: Vector3; to: Vector3; targetId: string }>
  >([]);

  const constants = useRef({
    lastAttackTime: 0,
    startTime: Date.now(),
    hasTriggeredCleanup: false,
    mountId: Date.now(),
    ATTACK_COOLDOWN: 500, // 0.5 seconds
    RANGE: 6, // 6 units range for targeting
    DURATION: 8000, // 8 seconds
    BASE_DAMAGE: 20, // Same as scythe basic attack damage
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
    if (players) {
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
  }, [players, casterId, enemyData]);

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

    // Calculate damage using the same system as scythe basic attacks
    const damageResult = calculateDamage(constants.BASE_DAMAGE, WeaponType.SCYTHE);

    // Use the enemy's current real-time position for damage numbers and effects (not cached target position)
    const currentWorldImpactPosition = currentEnemy.position.clone().setY(1.5);



    // CRITICAL: Prevent attacking the caster
    if (casterId && target.id === casterId) {
      return;
    }

    // Call the damage callback to route damage to server
    onDamage(target.id, damageResult.damage, currentWorldImpactPosition, damageResult.isCritical);

    // Create explosion effect that tracks the target player's current position
    // Instead of using the internal activeEffects system, broadcast to the global PVP system
    if (typeof window !== 'undefined' && (window as any).triggerSummonTotemExplosion) {
      (window as any).triggerSummonTotemExplosion(target.id, currentWorldImpactPosition);
    }

    if (onTotemFloatingDamage) {
      onTotemFloatingDamage(
        damageResult.damage,
        damageResult.isCritical,
        currentWorldImpactPosition.clone(),
      );
    } else if (setDamageNumbers && nextDamageNumberId) {
      setDamageNumbers((prev) => [
        ...prev,
        {
          id: nextDamageNumberId.current++,
          damage: damageResult.damage,
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

    // Check attack cooldown
    if (now - constants.lastAttackTime < constants.ATTACK_COOLDOWN) {
      return;
    }


    // Continuously check for the closest enemy in range
    const closestEnemy = findNewTarget();

    // Attack if we have a valid target in range — spawn a totem bolt; damage applies on impact
    if (closestEnemy && closestEnemy.health > 0) {
      if (groupRef.current) {
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

  return (
    <>
      <group ref={groupRef} position={position.toArray()}>
        <TotemModel isAttacking={!!currentTarget} />
        <UnholyAura />
      </group>
      {activeBolts.map((b) => (
        <TotemEntropicBolt
          key={b.id}
          from={b.from}
          to={b.to}
          onImpact={() => onTotemBoltImpact(b.id, b.targetId)}
        />
      ))}
    </>
  );
}
