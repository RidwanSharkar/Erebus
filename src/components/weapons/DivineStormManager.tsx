import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import DivineStorm from './DivineStorm';

interface DivineStormEffect {
  id: number;
  position: Vector3;
  startTime: number;
  duration: number;
  playerId?: string; // For PVP tracking
}

interface DivineStormManagerProps {
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
  onHitTarget?: (targetId: string, damage: number, isCritical: boolean, position: Vector3, isDivineStorm: boolean) => void;
  playerId?: string; // ID of the player who cast the Divine Storm
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isDivineStorm?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isDivineStorm?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
}

// Global state for Divine Storm effects
let globalDivineStormEffects: DivineStormEffect[] = [];
let nextDivineStormId = 1;

// Global functions for triggering Divine Storm effects
export function triggerGlobalDivineStorm(position: Vector3, playerId?: string, duration: number = 3000): number {
  const effect: DivineStormEffect = {
    id: nextDivineStormId++,
    position: position.clone(),
    startTime: Date.now(),
    duration: duration, // Use provided duration or default to 3 seconds
    playerId
  };
  
  globalDivineStormEffects.push(effect);
  return effect.id;
}

export function getActiveDivineStorms(): DivineStormEffect[] {
  return globalDivineStormEffects;
}

export function clearDivineStormEffect(id: number): void {
  globalDivineStormEffects = globalDivineStormEffects.filter(effect => effect.id !== id);
}

export default function DivineStormManager({
  enemyData = [],
  onHitTarget,
  playerId,
  setDamageNumbers,
  nextDamageNumberId
}: DivineStormManagerProps) {
  const [activeEffects, setActiveEffects] = useState<DivineStormEffect[]>([]);
  const parentRefsMap = useRef<Map<number, { position: Vector3 }>>(new Map());

  useFrame(() => {
    // Sync with global state
    const now = Date.now();
    const currentEffects = globalDivineStormEffects.filter(effect => 
      now - effect.startTime < effect.duration
    );
    
    // Remove expired effects from global state
    globalDivineStormEffects = currentEffects;
    
    // Update local state
    setActiveEffects(currentEffects);
    
    // Clean up parent refs for expired effects
    const activeIds = new Set(currentEffects.map(e => e.id));
    parentRefsMap.current.forEach((_, id) => {
      if (!activeIds.has(id)) {
        parentRefsMap.current.delete(id);
      }
    });
    
    // Update parent refs for active effects
    currentEffects.forEach(effect => {
      if (!parentRefsMap.current.has(effect.id)) {
        parentRefsMap.current.set(effect.id, { position: effect.position.clone() });
      } else {
        // Update position
        parentRefsMap.current.get(effect.id)!.position.copy(effect.position);
      }
    });
  });

  return (
    <>
      {activeEffects.map(effect => {
        // Get or create parent ref for this effect
        let parentRef = parentRefsMap.current.get(effect.id);
        if (!parentRef) {
          parentRef = { position: effect.position && effect.position.clone ? effect.position.clone() : new Vector3(0, 0, 0) };
          parentRefsMap.current.set(effect.id, parentRef);
        }
        
        return (
          <DivineStorm
            key={effect.id}
            position={effect.position}
            parentRef={{ current: parentRef } as any}
            isActive={true}
            enemyData={enemyData}
            onHitTarget={onHitTarget}
            playerId={effect.playerId || playerId}
            setDamageNumbers={setDamageNumbers}
            nextDamageNumberId={nextDamageNumberId}
            onComplete={() => {
              clearDivineStormEffect(effect.id);
              parentRefsMap.current.delete(effect.id);
            }}
          />
        );
      })}
    </>
  );
}
