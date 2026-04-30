import React, { useRef, useEffect } from 'react';
import SummonTotemManager, {
  setGlobalSummonTotemTrigger,
  SummonTotemManagerRef,
  type SummonTotemDamageHandler,
} from './SummonTotemManager';
import { Vector3 } from '@/utils/three-exports';
import type { TotemBoltVariant } from '@/utils/talents';

interface LocalSummonTotemManagerProps {
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
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
  playerId?: string; // Local player id (caster + socket)
  totemBoltVariant?: TotemBoltVariant;
}

const LocalSummonTotemManager: React.FC<LocalSummonTotemManagerProps> = ({
  enemyData = [],
  onDamage,
  setActiveEffects,
  activeEffects = [],
  setDamageNumbers,
  nextDamageNumberId,
  playerId,
  totemBoltVariant,
}) => {
  const managerRef = React.useRef<SummonTotemManagerRef>(null);
  const totemBoltVariantRef = React.useRef(totemBoltVariant);

  React.useEffect(() => {
    totemBoltVariantRef.current = totemBoltVariant;
  }, [totemBoltVariant]);

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
    ) => {
      if (managerRef.current) {
        const finalEnemyData = enemyDataParam || enemyData;
        const boltVariantResolved = totemBoltVariantParam ?? totemBoltVariantRef.current;
        managerRef.current.createTotem(
          position,
          finalEnemyData,
          onDamageParam || onDamage,
          setActiveEffectsParam || setActiveEffects,
          activeEffectsParam || activeEffects,
          setDamageNumbersParam || setDamageNumbers,
          nextDamageNumberIdParam || nextDamageNumberId,
          casterId,
          playerId,
          boltVariantResolved ?? undefined,
        );
      }
    });

    return () => {
      setGlobalSummonTotemTrigger(() => {});
    };
  }, [enemyData, onDamage, setActiveEffects, activeEffects, setDamageNumbers, nextDamageNumberId, playerId, totemBoltVariant]);

  return (
    <SummonTotemManager
      ref={managerRef}
      enemyData={enemyData}
    />
  );
};

export default LocalSummonTotemManager;
