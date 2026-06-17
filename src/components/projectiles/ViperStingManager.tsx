import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Vector3, Group } from 'three';
import ViperSting from './ViperSting';
import ViperStingBeam from './ViperStingBeam';
import SoulStealEffect from './SoulStealEffect';
import ExplosiveTalonsDetonation from './ExplosiveTalonsDetonation';
import { useViperSting } from './useViperSting';
import { useViperStingBeam } from './useViperStingBeam';
import { REAPING_TALONS_RETURN_HEAL_PER_ORB } from '@/utils/talents';

interface ViperStingManagerProps {
  parentRef: React.RefObject<Group>;
  enemyData: Array<{
    id: string;
    position: Vector3;
    health: number;
    maxHealth?: number;
    isBoss?: boolean;
    isDying?: boolean;
  }>;
  onHit: (
    targetId: string,
    damage: number,
    isCritical?: boolean,
    position?: Vector3,
    isBlizzard?: boolean,
    viperPhase?: 'forward' | 'return' | 'explosion',
  ) => void;
  setDamageNumbers: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isViperSting?: boolean;
    isHealing?: boolean;
  }>>>;
  nextDamageNumberId: React.MutableRefObject<number>;
  onHealthChange?: (deltaHealth: number) => void;
  charges: Array<{
    id: number;
    available: boolean;
    cooldownStartTime: number | null;
  }>;
  setCharges: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    available: boolean;
    cooldownStartTime: number | null;
  }>>>;
  localSocketId?: string; // Add this to prevent self-damage
  players?: Array<{ // For PVP dynamic targeting
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
  }>;
  wrathfulTalonsReturnCrit?: boolean;
  explosiveTalons?: boolean;
  onExecuteFirstForwardHit?: () => number;
  giantKiller?: boolean;
  glacialTalonsTheme?: boolean;
}

interface SoulStealEffect {
  id: number;
  position: Vector3;
  targetPosition: Vector3;
  startTime: number;
  duration: number;
  active: boolean;
}

interface ExplosiveTalonsDetonationEntry {
  id: number;
  position: Vector3;
}

// Global state for Viper Sting manager
let globalViperStingManager: {
  shootViperSting?: (
    position?: Vector3,
    direction?: Vector3,
    casterId?: string,
    opts?: { explosiveTalons?: boolean },
  ) => boolean;
  getProjectiles?: () => any[];
  createSoulSteal?: (enemyPosition: Vector3) => void;
} = {};

export const triggerGlobalViperSting = (
  position?: Vector3,
  direction?: Vector3,
  casterId?: string,
  opts?: { explosiveTalons?: boolean },
): boolean => {
  if (globalViperStingManager.shootViperSting) {
    return globalViperStingManager.shootViperSting(position, direction, casterId, opts);
  }
  return false;
};

export const getGlobalViperStingProjectiles = (): any[] => {
  if (globalViperStingManager.getProjectiles) {
    return globalViperStingManager.getProjectiles();
  }
  return [];
};

export const triggerGlobalViperStingSoulSteal = (enemyPosition: Vector3): void => {
  if (globalViperStingManager.createSoulSteal) {
    globalViperStingManager.createSoulSteal(enemyPosition);
  }
};

export default function ViperStingManager({
  parentRef,
  enemyData,
  onHit,
  setDamageNumbers,
  nextDamageNumberId,
  onHealthChange,
  charges,
  setCharges,
  localSocketId,
  players,
  wrathfulTalonsReturnCrit,
  explosiveTalons,
  onExecuteFirstForwardHit,
  giantKiller,
  glacialTalonsTheme,
}: ViperStingManagerProps) {
  const [soulStealEffects, setSoulStealEffects] = useState<SoulStealEffect[]>([]);
  const nextSoulStealId = useRef(0);
  const [explosiveTalonsDetonations, setExplosiveTalonsDetonations] = useState<
    ExplosiveTalonsDetonationEntry[]
  >([]);
  const nextExplosiveTalonsDetonationId = useRef(0);

  const onExplosiveTalonsDetonate = useCallback((pos: Vector3) => {
    const id = nextExplosiveTalonsDetonationId.current++;
    setExplosiveTalonsDetonations((prev) => [...prev, { id, position: pos.clone() }]);
  }, []);
  
  // Beam effects management
  const { activeEffects: beamEffects, createBeamEffect, removeEffect: removeBeamEffect } = useViperStingBeam();

  // Viper Sting projectile management with soul steal effect creation
  const { shootViperSting, projectilePool, soulStealEffects: viperStingSoulStealEffects, createSoulStealEffect } = useViperSting({
    parentRef,
    onHit,
    enemyData,
    setDamageNumbers,
    nextDamageNumberId,
    onHealthChange,
    createBeamEffect,
    applyDoT: (enemyId: string) => {
      // Viper Sting does not apply DoT effects - only Cobra Shot does
      // This is a no-op function to satisfy the interface
    },
    charges,
    setCharges,
    localSocketId, // Pass the local socket ID to prevent self-damage
    players, // Pass players data for dynamic PVP targeting
    wrathfulTalonsReturnCrit,
    explosiveTalons,
    onExecuteFirstForwardHit,
    onExplosiveTalonsDetonate,
    giantKiller,
    glacialTalonsTheme,
  });

  // Register global manager
  useEffect(() => {
    globalViperStingManager.shootViperSting = shootViperSting;
    globalViperStingManager.getProjectiles = () => projectilePool.current;
    globalViperStingManager.createSoulSteal = createSoulStealEffect;

    return () => {
      globalViperStingManager = {};
    };
  }, [shootViperSting, projectilePool, createSoulStealEffect]);



  // Get current player position for soul steal effects
  const getCurrentPlayerPosition = () => {
    return parentRef.current ? parentRef.current.position.clone() : new Vector3();
  };

  return (
    <>
      {/* Viper Sting Projectiles */}
      <ViperSting projectilePool={projectilePool} />
      
      {/* Beam Effects */}
      {beamEffects.map(effect => (
        <ViperStingBeam
          key={effect.id}
          position={effect.position}
          direction={effect.direction}
          isReturning={effect.isReturning}
          beamLength={effect.beamLength}
          glacialTalonsTheme={effect.glacialTalonsTheme}
          onComplete={() => removeBeamEffect(effect.id)}
        />
      ))}

      {explosiveTalonsDetonations.map((d) => (
        <ExplosiveTalonsDetonation
          key={d.id}
          position={d.position}
          onComplete={() =>
            setExplosiveTalonsDetonations((prev) => prev.filter((x) => x.id !== d.id))
          }
        />
      ))}

      {/* Soul Steal Effects */}
      {viperStingSoulStealEffects.current.map(effect => (
        <SoulStealEffect
          key={effect.id}
          id={effect.id}
          startPosition={effect.position}
          targetPosition={effect.targetPosition}
          startTime={effect.startTime}
          duration={effect.duration}
          getCurrentPlayerPosition={() => {
            // Return current player position for dynamic tracking
            if (parentRef.current) {
              return parentRef.current.position.clone();
            }
            return effect.targetPosition; // Fallback to original target
          }}
          onComplete={() => {
            // Only process healing if this is NOT PVP mode (check if onHealthChange is a real function)
            const isPVPMode = !onHealthChange || onHealthChange.toString().includes('No-op');
            
            if (!isPVPMode && onHealthChange) {
              onHealthChange(REAPING_TALONS_RETURN_HEAL_PER_ORB);

              // Show healing damage number
              if (parentRef.current && setDamageNumbers && typeof setDamageNumbers === 'function') {
                const healingPosition = parentRef.current.position.clone().add(new Vector3(0, 1.5, 0));
                try {
                  setDamageNumbers(prev => [...prev, {
                    id: nextDamageNumberId.current++,
                    damage: REAPING_TALONS_RETURN_HEAL_PER_ORB,
                    position: healingPosition,
                    isCritical: false,
                    isHealing: true
                  }]);
                } catch (error) {
                  // console.warn('ViperSting: Failed to add healing damage number:', error);
                }
              }
            }
            
            // Remove the effect from the array
            viperStingSoulStealEffects.current = viperStingSoulStealEffects.current.filter(e => e.id !== effect.id);
          }}
        />
      ))}
    </>
  );
}
