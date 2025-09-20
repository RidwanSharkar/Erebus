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
    console.log('🎭 PVPSummonTotemManager: Setting up global trigger');
    setGlobalSummonTotemTrigger((position, enemyDataParam, onDamageParam, setActiveEffectsParam, activeEffectsParam, setDamageNumbersParam, nextDamageNumberIdParam, onHealPlayerParam, casterId) => {
      console.log('🎭 PVPSummonTotemManager: Global trigger called at position:', position);

      if (managerRef.current) {
        let finalEnemyData: Array<{ id: string; position: Vector3; health: number }> = [];

        // If enemyDataParam is provided, use it (for remote totems)
        if (enemyDataParam && enemyDataParam.length > 0) {
          finalEnemyData = enemyDataParam;
          console.log('🎭 Using enemyDataParam:', enemyDataParam.length, 'enemies');
        } else {
          // Otherwise, use the current enemyData prop directly (for local totems)
          const currentPlayers = playersRef.current;
          const currentLocalSocketId = localSocketIdRef.current;

          console.log('🎭 Building enemy data from current props - players:', currentPlayers?.size || 0, 'localSocketId:', currentLocalSocketId, 'enemyData prop:', enemyData?.length || 0);

          if (currentPlayers && currentLocalSocketId) {
            finalEnemyData = Array.from(currentPlayers.entries())
              .filter(([playerId]) => playerId !== currentLocalSocketId) // Exclude local player
              .map(([playerId, playerData]) => ({
                id: playerId,
                position: new Vector3(playerData.position.x, playerData.position.y, playerData.position.z),
                health: playerData.health
              }));
            console.log('🎭 Built PVP enemy data from players map:', finalEnemyData.length, 'enemies');
          }

          // Also include any provided enemyData prop (NPCs)
          if (enemyData && enemyData.length > 0) {
            finalEnemyData = [...finalEnemyData, ...enemyData];
            console.log('🎭 Added NPC enemy data from props, total:', finalEnemyData.length, 'enemies');
          }
        }

        console.log('🎭 PVPSummonTotemManager: Final enemyData for totem:', finalEnemyData.map(e => ({ id: e.id, health: e.health, position: [e.position.x.toFixed(2), e.position.y.toFixed(2), e.position.z.toFixed(2)] })));
        managerRef.current.createTotem(
          position,
          finalEnemyData,
          onDamageParam || onDamage,
          setActiveEffectsParam || setActiveEffects,
          activeEffectsParam || activeEffects,
          setDamageNumbersParam || setDamageNumbers,
          nextDamageNumberIdParam || nextDamageNumberId,
            onHealPlayerParam || onHealPlayer || onHealPlayerCallback || ((healAmount: number) => {
              console.log('🎭 PVPSummonTotemManager: Healing local player for', healAmount, 'HP');
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
        console.log('🎭 PVP Summon Totem completed:', totemId);
      }}
    />
  );
};

export default PVPSummonTotemManager;
