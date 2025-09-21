import React, { useRef, useEffect } from 'react';
import SummonTotemManager, { setGlobalSummonTotemTrigger, SummonTotemManagerRef } from './SummonTotemManager';
import { Vector3 } from '@/utils/three-exports';

interface PVPSummonTotemManagerProps {
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
  players?: Map<string, any>; // Add players map for real-time position updates
  localSocketId?: string; // Add local socket ID to exclude self
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void;
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
  onHealPlayer?: (healAmount: number) => void;
  playerId?: string; // Add player ID for healing
  onHealPlayerCallback?: (healAmount: number) => void; // Additional healing callback
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
  onHealPlayer,
  playerId,
  onHealPlayerCallback
}) => {
  const managerRef = React.useRef<SummonTotemManagerRef>(null);

  // Use refs to access latest props in callback
  const playersRef = React.useRef(players);
  const localSocketIdRef = React.useRef(localSocketId);
  const enemyDataRef = React.useRef(enemyData);

  // Update refs when props change
  React.useEffect(() => {
    playersRef.current = players;
  }, [players]);

  React.useEffect(() => {
    localSocketIdRef.current = localSocketId;
  }, [localSocketId]);

  React.useEffect(() => {
    enemyDataRef.current = enemyData;
  }, [enemyData]);

  React.useEffect(() => {
    setGlobalSummonTotemTrigger((position, enemyDataParam, onDamageParam, setActiveEffectsParam, activeEffectsParam, setDamageNumbersParam, nextDamageNumberIdParam, onHealPlayerParam, casterId) => {

      if (managerRef.current) {
        let finalEnemyData: Array<{ id: string; position: Vector3; health: number }> = [];

        // If enemyDataParam is provided, use it (for remote totems)
        if (enemyDataParam && enemyDataParam.length > 0) {
          finalEnemyData = enemyDataParam;
        } else {
          // Otherwise, use the current enemyData prop directly (for local totems)
          const currentPlayers = playersRef.current;
          const currentLocalSocketId = localSocketIdRef.current;


          if (currentPlayers && currentLocalSocketId) {
            finalEnemyData = Array.from(currentPlayers.entries())
              .filter(([playerId]) => playerId !== currentLocalSocketId) // Exclude local player
              .map(([playerId, playerData]) => ({
                id: playerId,
                position: new Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
                health: playerData.health
              }));
          }

          // Also include any provided enemyData prop (NPCs)
          if (enemyData && enemyData.length > 0) {
            finalEnemyData = [...finalEnemyData, ...enemyData];
          }
        }

        managerRef.current.createTotem(
          position,
          finalEnemyData,
          onDamageParam || onDamage,
          setActiveEffectsParam || setActiveEffects,
          activeEffectsParam || activeEffects,
          setDamageNumbersParam || setDamageNumbers,
          nextDamageNumberIdParam || nextDamageNumberId,
            onHealPlayerParam || onHealPlayer || onHealPlayerCallback || ((healAmount: number) => {
              // Heal the local player - this should be handled by the parent component
            })
        );
      }
    });

    return () => {
      setGlobalSummonTotemTrigger(() => {});
    };
  }, [onDamage, setActiveEffects, activeEffects, setDamageNumbers, nextDamageNumberId, onHealPlayer, onHealPlayerCallback, playerId, enemyData, players]);

  return (
    <SummonTotemManager
      ref={managerRef}
      onTotemComplete={(totemId) => {
      }}
    />
  );
};

export default PVPSummonTotemManager;
