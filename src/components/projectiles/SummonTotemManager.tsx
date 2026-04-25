import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import SummonedTotem from './SummonedTotem';

interface SummonTotemData {
  id: number;
  startTime: number;
  isActive: boolean;
  position: Vector3;
  onComplete: () => void;
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
  casterId?: string;
  localSocketId?: string;
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
}

export interface SummonTotemManagerRef {
  createTotem: (
    position: Vector3,
    enemyData?: Array<{ id: string; position: Vector3; health: number }>,
    onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void,
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
    localSocketId?: string
  ) => number;
}

const SummonTotemManager = forwardRef<SummonTotemManagerRef, SummonTotemManagerProps>(({ onTotemComplete, players, enemyData = [], localSocketId, onTotemFloatingDamage }, ref) => {
  const [activeTotems, setActiveTotems] = useState<SummonTotemData[]>([]);
  const totemIdCounter = useRef(0);

  useImperativeHandle(ref, () => ({
    createTotem
  }));

  const createTotem = useCallback((
    position: Vector3,
    enemyData: Array<{ id: string; position: Vector3; health: number }> = [],
    onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void,
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
    localSocketId?: string
  ) => {
    const totemId = totemIdCounter.current++;
    const startTime = Date.now();

    const handleTotemComplete = () => {
      setActiveTotems(prev => prev.filter(totem => totem.id !== totemId));
      onTotemComplete?.(totemId);
    };

    const onDamageForTotem =
      onDamage &&
      ((targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => {
        if (casterId != null && localSocketId != null && casterId !== localSocketId) {
          return;
        }
        onDamage(targetId, damage, impactPosition, isCritical);
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
      localSocketId
    };

    setActiveTotems(prev => [...prev, newTotem]);

    // Auto-complete after totem duration (8 seconds)
    setTimeout(() => {
      handleTotemComplete();
    }, 8000);

    return totemId;
  }, [onTotemComplete]);

  // Update totems each frame
  useFrame(() => {
    // Active totems are managed by their own timeouts
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
        />
      ))}
    </>
  );
});

SummonTotemManager.displayName = 'SummonTotemManager';

export default SummonTotemManager;

let globalSummonTotemTriggerCallback: ((position: Vector3, enemyData?: Array<{ id: string; position: Vector3; health: number }>, onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void, setActiveEffects?: (callback: (prev: Array<{
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
}>) => void, activeEffects?: Array<{
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
}>, setDamageNumbers?: (callback: (prev: Array<{
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
}>) => void, nextDamageNumberId?: { current: number }, casterId?: string) => void) | null = null;

export const setGlobalSummonTotemTrigger = (callback: (position: Vector3, enemyData?: Array<{ id: string; position: Vector3; health: number }>, onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void, setActiveEffects?: (callback: (prev: Array<{
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
}>) => void, activeEffects?: Array<{
  id: number;
  type: string;
  position: Vector3;
  direction: Vector3;
  duration?: number;
  startTime?: number;
  summonId?: number;
  targetId?: string;
}>, setDamageNumbers?: (callback: (prev: Array<{
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
}>) => void, nextDamageNumberId?: { current: number }, casterId?: string) => void) => {
  globalSummonTotemTriggerCallback = callback;
};

export const triggerGlobalSummonTotem = (
  position: Vector3,
  enemyData?: Array<{ id: string; position: Vector3; health: number }>,
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void,
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
      casterId
    );
  }
};

export const createSummonTotem = (
  position: Vector3,
  enemyData?: Array<{ id: string; position: Vector3; health: number }>,
  onDamage?: (targetId: string, damage: number, impactPosition: Vector3, isCritical?: boolean) => void,
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
