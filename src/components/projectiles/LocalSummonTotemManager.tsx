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
  superconductor?: boolean;
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
  superconductor = false,
}) => {
  const managerRef = React.useRef<SummonTotemManagerRef>(null);
  const totemBoltVariantRef = React.useRef(totemBoltVariant);
  const superconductorRef = React.useRef(superconductor);

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
    ) => {
      if (managerRef.current) {
        const finalEnemyData = enemyDataParam || enemyData;
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
          playerId,
          boltVariantResolved ?? undefined,
          superconductorResolved,
        );
      }
    });

    return () => {
      setGlobalSummonTotemTrigger(() => {});
    };
  }, [enemyData, onDamage, setActiveEffects, activeEffects, setDamageNumbers, nextDamageNumberId, playerId, totemBoltVariant, superconductor]);

  return (
    <SummonTotemManager
      ref={managerRef}
      enemyData={enemyData}
    />
  );
};

export default LocalSummonTotemManager;
