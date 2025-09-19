import React, { useRef, useEffect } from 'react';
import SummonTotemManager, { setGlobalSummonTotemTrigger, SummonTotemManagerRef } from './SummonTotemManager';
import { Vector3 } from '@/utils/three-exports';

interface LocalSummonTotemManagerProps {
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
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
  playerId?: string; // Local player ID for healing
}

const LocalSummonTotemManager: React.FC<LocalSummonTotemManagerProps> = ({
  enemyData = [],
  onDamage,
  setActiveEffects,
  activeEffects = [],
  setDamageNumbers,
  nextDamageNumberId,
  onHealPlayer,
  playerId
}) => {
  const managerRef = React.useRef<SummonTotemManagerRef>(null);

  React.useEffect(() => {
    console.log('🎭 LocalSummonTotemManager: Setting up global trigger callback');
    setGlobalSummonTotemTrigger((position, enemyDataParam, onDamageParam, setActiveEffectsParam, activeEffectsParam, setDamageNumbersParam, nextDamageNumberIdParam, onHealPlayerParam, casterId) => {
      console.log('🎭 LocalSummonTotemManager: Global trigger callback fired with enemyDataParam:', enemyDataParam?.length || 0, 'enemies');
      console.log('🎭 LocalSummonTotemManager: Local enemyData prop has:', enemyData.length, 'enemies');
      if (managerRef.current) {
        const finalEnemyData = enemyDataParam || enemyData;
        console.log('🎭 LocalSummonTotemManager: Using finalEnemyData with', finalEnemyData.length, 'enemies');
        managerRef.current.createTotem(
          position,
          finalEnemyData,
          onDamageParam || onDamage,
          setActiveEffectsParam || setActiveEffects,
          activeEffectsParam || activeEffects,
          setDamageNumbersParam || setDamageNumbers,
          nextDamageNumberIdParam || nextDamageNumberId,
          onHealPlayerParam || onHealPlayer
        );
      } else {
        console.log('🎭 LocalSummonTotemManager: managerRef.current is null!');
      }
    });

    return () => {
      setGlobalSummonTotemTrigger(() => {});
    };
  }, [enemyData, onDamage, setActiveEffects, activeEffects, setDamageNumbers, nextDamageNumberId, onHealPlayer, playerId]);

  return (
    <SummonTotemManager
      ref={managerRef}
      onTotemComplete={(totemId) => {
        console.log('🎭 Local Summon Totem completed:', totemId);
      }}
    />
  );
};

export default LocalSummonTotemManager;
