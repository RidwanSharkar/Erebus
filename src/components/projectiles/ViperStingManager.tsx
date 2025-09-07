import React, { useState, useRef, useEffect } from 'react';
import { Vector3, Group } from 'three';
import ViperSting from './ViperSting';
import ViperStingBeam from './ViperStingBeam';
import { useViperSting } from './useViperSting';
import { useViperStingBeam } from './useViperStingBeam';

interface ViperStingManagerProps {
  parentRef: React.RefObject<Group>;
  enemyData: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
  }>;
  onHit: (targetId: string, damage: number) => void;
  setDamageNumbers: React.Dispatch<React.SetStateAction<Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isViperSting?: boolean;
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
}

interface SoulStealEffect {
  id: number;
  position: Vector3;
  targetPosition: Vector3;
  startTime: number;
  duration: number;
  active: boolean;
}

// Global state for Viper Sting manager
let globalViperStingManager: {
  shootViperSting?: () => boolean;
  getProjectiles?: () => any[];
} = {};

export const triggerGlobalViperSting = (): boolean => {
  if (globalViperStingManager.shootViperSting) {
    return globalViperStingManager.shootViperSting();
  }
  return false;
};

export const getGlobalViperStingProjectiles = (): any[] => {
  if (globalViperStingManager.getProjectiles) {
    return globalViperStingManager.getProjectiles();
  }
  return [];
};

export default function ViperStingManager({
  parentRef,
  enemyData,
  onHit,
  setDamageNumbers,
  nextDamageNumberId,
  onHealthChange,
  charges,
  setCharges
}: ViperStingManagerProps) {
  const [soulStealEffects, setSoulStealEffects] = useState<SoulStealEffect[]>([]);
  const nextSoulStealId = useRef(0);
  
  // Beam effects management
  const { activeEffects: beamEffects, createBeamEffect, removeEffect: removeBeamEffect } = useViperStingBeam();

  // Viper Sting projectile management
  const { shootViperSting, projectilePool } = useViperSting({
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
    setCharges
  });

  // Register global manager
  useEffect(() => {
    globalViperStingManager.shootViperSting = shootViperSting;
    globalViperStingManager.getProjectiles = () => projectilePool.current;

    return () => {
      globalViperStingManager = {};
    };
  }, [shootViperSting, projectilePool]);



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
          onComplete={() => removeBeamEffect(effect.id)}
        />
      ))}

    </>
  );
}
