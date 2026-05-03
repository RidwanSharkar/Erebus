import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import type { EnemyDamageMeta } from '@/contexts/MultiplayerContext';
import type { TotemBoltVariant } from '@/utils/talents';
import SummonedTotem from './SummonedTotem';

export type SummonTotemDamageHandler = (
  targetId: string,
  damage: number,
  impactPosition: Vector3,
  isCritical?: boolean,
  coopEnemyDamageMeta?: EnemyDamageMeta,
) => void;

interface SummonTotemData {
  id: number;
  startTime: number;
  isActive: boolean;
  position: Vector3;
  onComplete: () => void;
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
  casterId?: string;
  localSocketId?: string;
  totemBoltVariant?: TotemBoltVariant;
  superconductor?: boolean;
  allowPlayerTargets?: boolean;
}

/** Max XYZ triplets for Accelerator telemetry (published each R3F frame). */
const ACCELERATOR_PUBLISHED_TOTEM_CAP = 32;

/** Flat xyz… triplets owned by local player totems (`length` = triplets × 3, use `acceleratorOwnedTotemTripletCount`). */
export const acceleratorOwnedTotemFlatXYZ = new Float64Array(ACCELERATOR_PUBLISHED_TOTEM_CAP * 3);

/** Valid triplets in `acceleratorOwnedTotemFlatXYZ` (≤ cap). Written in SummonTotemManager `useFrame`. */
export let acceleratorOwnedTotemTripletCount = 0;

function isAcceleratorLocalOwnedTotem(
  totem: SummonTotemData,
  managerLocalSocketId: string | undefined,
): boolean {
  if (managerLocalSocketId != null && managerLocalSocketId !== '') {
    return totem.casterId === managerLocalSocketId;
  }
  // Offline / no socket: treat unnamed casters as local (legacy summon path).
  return totem.casterId == null || totem.casterId === '';
}

function rebuildAcceleratorTotemProbe(
  totems: SummonTotemData[],
  managerLocalSocketId: string | undefined,
): void {
  let wi = 0;
  let count = 0;
  const buf = acceleratorOwnedTotemFlatXYZ;
  const cap = buf.length;
  for (const t of totems) {
    if (!isAcceleratorLocalOwnedTotem(t, managerLocalSocketId)) continue;
    if (wi + 3 > cap) break;
    buf[wi++] = t.position.x;
    buf[wi++] = t.position.y;
    buf[wi++] = t.position.z;
    count++;
  }
  acceleratorOwnedTotemTripletCount = count;
}

export type SummonTotemEnemyEntry = {
  id: string;
  position: Vector3;
  health: number;
};

interface SummonTotemManagerProps {
  onTotemComplete?: (totemId: number) => void;
  players?: Map<string, any>; // Real-time players data
  /** Live NPC + player targets; updated each frame so totems track movement. */
  enemyData?: SummonTotemEnemyEntry[];
  localSocketId?: string; // Local player ID to exclude from targets
  onTotemFloatingDamage?: (damage: number, isCritical: boolean, position: Vector3) => void;
  allowPlayerTargets?: boolean;
  resolveTotemEnemyFrozen?: (enemyId: string) => boolean;
}

export interface SummonTotemManagerRef {
  createTotem: (
    position: Vector3,
    enemyData?: Array<{ id: string; position: Vector3; health: number }>,
    onDamage?: SummonTotemDamageHandler,
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
    }>) => void,
    activeEffects?: Array<{
      id: number;
      type: string;
      position: Vector3;
      direction: Vector3;
      duration?: number;
      startTime?: number;
      summonId?: number;
      targetId?: string;
    }>,
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
    }>) => void,
    nextDamageNumberId?: { current: number },
    casterId?: string,
    localSocketId?: string,
    totemBoltVariant?: TotemBoltVariant,
    superconductor?: boolean,
    allowPlayerTargets?: boolean,
  ) => number;
}

const SummonTotemManager = forwardRef<SummonTotemManagerRef, SummonTotemManagerProps>(({ onTotemComplete, players, enemyData = [], localSocketId, onTotemFloatingDamage, allowPlayerTargets = false, resolveTotemEnemyFrozen }, ref) => {
  const [activeTotems, setActiveTotems] = useState<SummonTotemData[]>([]);
  const activeTotemsRef = useRef<SummonTotemData[]>(activeTotems);
  activeTotemsRef.current = activeTotems;
  const totemIdCounter = useRef(0);

  useImperativeHandle(ref, () => ({
    createTotem
  }));

  const createTotem = useCallback((
    position: Vector3,
    enemyData: Array<{ id: string; position: Vector3; health: number }> = [],
    onDamage?: SummonTotemDamageHandler,
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
    }>) => void,
    activeEffects?: Array<{
      id: number;
      type: string;
      position: Vector3;
      direction: Vector3;
      duration?: number;
      startTime?: number;
      summonId?: number;
      targetId?: string;
    }>,
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
    }>) => void,
    nextDamageNumberId?: { current: number },
    casterId?: string,
    localSocketId?: string,
    totemBoltVariantProp?: TotemBoltVariant,
    superconductor: boolean = false,
    allowPlayerTargetsForTotem: boolean = allowPlayerTargets,
  ) => {
    const totemId = totemIdCounter.current++;
    const startTime = Date.now();

    const handleTotemComplete = () => {
      setActiveTotems(prev => prev.filter(totem => totem.id !== totemId));
      onTotemComplete?.(totemId);
    };

    const onDamageForTotem =
      onDamage &&
      ((
        targetId: string,
        damage: number,
        impactPosition: Vector3,
        isCritical?: boolean,
        coopEnemyDamageMeta?: EnemyDamageMeta,
      ) => {
        if (casterId != null && localSocketId != null && casterId !== localSocketId) {
          return;
        }
        onDamage(targetId, damage, impactPosition, isCritical, coopEnemyDamageMeta);
      });

    const newTotem: SummonTotemData = {
      id: totemId,
      startTime,
      isActive: true,
      position: position.clone(),
      onComplete: handleTotemComplete,
      onDamage: onDamageForTotem || undefined,
      setActiveEffects,
      activeEffects: activeEffects || [],
      setDamageNumbers,
      nextDamageNumberId,
      casterId: casterId,
      localSocketId,
      totemBoltVariant: totemBoltVariantProp,
      superconductor,
      allowPlayerTargets: allowPlayerTargetsForTotem,
    };

    setActiveTotems(prev => [...prev, newTotem]);

    // Auto-complete after totem duration (8 seconds)
    setTimeout(() => {
      handleTotemComplete();
    }, 8000);

    return totemId;
  }, [onTotemComplete, allowPlayerTargets]);

  useFrame(() => {
    rebuildAcceleratorTotemProbe(activeTotemsRef.current, localSocketId);
  });

  return (
    <>
      {activeTotems.map(totem => (
        <SummonedTotem
          key={totem.id}
          position={totem.position}
          players={players}
          localSocketId={totem.localSocketId}
          enemyData={enemyData}
          onDamage={totem.onDamage}
          onComplete={totem.onComplete}
          setActiveEffects={totem.setActiveEffects}
          activeEffects={totem.activeEffects}
          setDamageNumbers={totem.setDamageNumbers}
          nextDamageNumberId={totem.nextDamageNumberId}
          onTotemFloatingDamage={onTotemFloatingDamage}
          casterId={totem.casterId}
          allowPlayerTargets={totem.allowPlayerTargets}
          totemBoltVariant={totem.totemBoltVariant}
          superconductor={totem.superconductor}
          resolveTotemEnemyFrozen={resolveTotemEnemyFrozen}
        />
      ))}
    </>
  );
});

SummonTotemManager.displayName = 'SummonTotemManager';

export default SummonTotemManager;

/** Window / PVPSummonTotem glue: positional args mirror `SummonTotemManagerRef.createTotem`. */
export type SummonTotemTriggerCallback = (
  position: Vector3,
  enemyData?: Array<{ id: string; position: Vector3; health: number }>,
  onDamage?: SummonTotemDamageHandler,
  setActiveEffects?: SummonTotemData['setActiveEffects'],
  activeEffects?: SummonTotemData['activeEffects'],
  setDamageNumbers?: SummonTotemData['setDamageNumbers'],
  nextDamageNumberId?: { current: number },
  casterId?: string,
  totemBoltVariant?: TotemBoltVariant,
  superconductor?: boolean,
  allowPlayerTargets?: boolean,
) => void;

let globalSummonTotemTriggerCallback: SummonTotemTriggerCallback | null = null;

export const setGlobalSummonTotemTrigger = (callback: SummonTotemTriggerCallback) => {
  globalSummonTotemTriggerCallback = callback;
};

export const triggerGlobalSummonTotem = (
  position: Vector3,
  enemyData?: Array<{ id: string; position: Vector3; health: number }>,
  onDamage?: SummonTotemDamageHandler,
  setActiveEffects?: SummonTotemData['setActiveEffects'],
  activeEffects?: SummonTotemData['activeEffects'],
  setDamageNumbers?: SummonTotemData['setDamageNumbers'],
  nextDamageNumberId?: { current: number },
  casterId?: string,
  totemBoltVariant?: TotemBoltVariant,
  superconductor?: boolean,
  allowPlayerTargets?: boolean,
) => {
  if (globalSummonTotemTriggerCallback) {
    globalSummonTotemTriggerCallback(
      position,
      enemyData,
      onDamage,
      setActiveEffects,
      activeEffects,
      setDamageNumbers,
      nextDamageNumberId,
      casterId,
      totemBoltVariant,
      superconductor,
      allowPlayerTargets,
    );
  }
};

export const createSummonTotem = (
  position: Vector3,
  enemyData?: Array<{ id: string; position: Vector3; health: number }>,
  onDamage?: SummonTotemDamageHandler,
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
  }>) => void,
  activeEffects?: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>,
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
  }>) => void,
  nextDamageNumberId?: { current: number },
  casterId?: string
): number | null => {
  // This function can be called from external systems to create totems
  // The actual implementation will be handled by the manager component

  // For now, return a dummy ID - the actual creation is handled by the component
  return Date.now();
};

// Expose the trigger function globally for remote ability handling
if (typeof window !== 'undefined') {
  (window as any).triggerGlobalSummonTotem = triggerGlobalSummonTotem;
}
