import React, { useRef, useEffect } from 'react';
import SummonTotemManager, {
  setGlobalSummonTotemTrigger,
  SummonTotemManagerRef,
  type SummonTotemDamageHandler,
} from './SummonTotemManager';
import { Vector3 } from '@/utils/three-exports';
import type { TotemBoltVariant } from '@/utils/talents';

interface PVPSummonTotemManagerProps {
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
  players?: Map<string, any>; // Add players map for real-time position updates
  localSocketId?: string; // Add local socket ID to exclude self
  onDamage?: SummonTotemDamageHandler;
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
  onTotemFloatingDamage?: (damage: number, isCritical: boolean, position: Vector3) => void;
  /** Local player's Mantra bolt talent (remote totems supply variant via `triggerGlobalSummonTotem`). */
  totemBoltVariant?: TotemBoltVariant;
  superconductor?: boolean;
  allowPlayerTargets?: boolean;
  resolveTotemEnemyFrozen?: (enemyId: string) => boolean;
}

const PVPSummonTotemManager: React.FC<PVPSummonTotemManagerProps> = ({
  enemyData = [],
  players,
  localSocketId,
  onDamage,
  setActiveEffects,
  activeEffects = [],
  setDamageNumbers,
  nextDamageNumberId,
  onTotemFloatingDamage,
  totemBoltVariant,
  superconductor = false,
  allowPlayerTargets = false,
  resolveTotemEnemyFrozen,
}) => {
  const managerRef = React.useRef<SummonTotemManagerRef>(null);

  // Use refs to access latest props in callback
  const playersRef = React.useRef(players);
  const enemyDataRef = React.useRef(enemyData);
  const totemBoltVariantRef = React.useRef(totemBoltVariant);
  const superconductorRef = React.useRef(superconductor);

  // Update refs when props change
  React.useEffect(() => {
    playersRef.current = players;
  }, [players]);

  React.useEffect(() => {
    enemyDataRef.current = enemyData;
  }, [enemyData]);

  React.useEffect(() => {
    totemBoltVariantRef.current = totemBoltVariant;
  }, [totemBoltVariant]);

  React.useEffect(() => {
    superconductorRef.current = superconductor;
  }, [superconductor]);

  React.useEffect(() => {
    setGlobalSummonTotemTrigger((
      position,
      enemyDataParam,
      onDamageParam,
      setActiveEffectsParam,
      activeEffectsParam,
      setDamageNumbersParam,
      nextDamageNumberIdParam,
      casterId,
      totemBoltVariantParam,
      superconductorParam,
      allowPlayerTargetsParam,
    ) => {
      const canTargetPlayers = allowPlayerTargetsParam ?? allowPlayerTargets;

      if (managerRef.current) {
        let finalEnemyData: Array<{ id: string; position: Vector3; health: number }> = [];

        // If enemyDataParam is provided, use it (for remote totems) but filter out the caster
        if (enemyDataParam && enemyDataParam.length > 0) {
          finalEnemyData = enemyDataParam.filter(enemy => enemy.id !== casterId);
        } else {
          // Otherwise, use the current enemyData prop directly (for remote totems when enemyDataParam is not provided)
          const currentPlayers = playersRef.current;

          if (canTargetPlayers && currentPlayers) {
            finalEnemyData = Array.from(currentPlayers.entries())
              .filter(([playerId]) => playerId !== casterId) // Exclude the caster of the totem
              .map(([playerId, playerData]) => ({
                id: playerId,
                position: new Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
                health: playerData.health
              }));
          }

          // Also include any provided enemyData prop (NPCs)
          if (enemyDataRef.current && enemyDataRef.current.length > 0) {
            finalEnemyData = [...finalEnemyData, ...enemyDataRef.current];
          }
        }

        // For remote totems, use the caster's ID as localSocketId so the totem excludes the caster
        // For local totems, use the actual local player's ID
        const effectiveLocalSocketId = enemyDataParam ? casterId : localSocketId;

        const boltVariantResolved = totemBoltVariantParam ?? totemBoltVariantRef.current;
        const superconductorResolved = superconductorParam ?? superconductorRef.current;

        managerRef.current.createTotem(
          position,
          finalEnemyData,
          onDamageParam || onDamage,
          setActiveEffectsParam || setActiveEffects,
          activeEffectsParam || activeEffects,
          setDamageNumbersParam || setDamageNumbers,
          nextDamageNumberIdParam || nextDamageNumberId,
          casterId,
          effectiveLocalSocketId,
          boltVariantResolved ?? undefined,
          superconductorResolved,
          canTargetPlayers,
        );
      }
    });

    return () => {
      setGlobalSummonTotemTrigger(() => {});
    };
  }, [onDamage, setActiveEffects, activeEffects, setDamageNumbers, nextDamageNumberId, onTotemFloatingDamage, enemyData, players, localSocketId, totemBoltVariant, superconductor, allowPlayerTargets]);

  return (
    <SummonTotemManager
      ref={managerRef}
      onTotemComplete={(totemId) => {
      }}
      players={players}
      enemyData={enemyData}
      localSocketId={localSocketId}
      onTotemFloatingDamage={onTotemFloatingDamage}
      allowPlayerTargets={allowPlayerTargets}
      resolveTotemEnemyFrozen={resolveTotemEnemyFrozen}
    />
  );
};

export default PVPSummonTotemManager;
