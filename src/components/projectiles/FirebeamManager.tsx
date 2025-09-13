import React, { useState, useRef, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import Firebeam from './Firebeam';
import { Group } from 'three';

interface FirebeamData {
  id: number;
  startTime: number;
  isActive: boolean;
  position: Vector3;
  direction: Vector3;
  parentRef: React.RefObject<Group>;
  onComplete: () => void;
  onHit?: () => void;
}

interface FirebeamManagerProps {
  world?: any; // World reference for collision detection
  onBeamComplete?: (beamId: number) => void;
  onBeamHit?: (beamId: number, targetId?: number, damage?: number, isFrozen?: boolean) => void;
}

export default function FirebeamManager({ world, onBeamComplete, onBeamHit }: FirebeamManagerProps) {
  const [activeBeams, setActiveBeams] = useState<FirebeamData[]>([]);
  const beamIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  const createBeam = useCallback((
    parentRef: React.RefObject<Group>,
    onComplete: () => void,
    onHit?: () => void
  ) => {
    const beamId = beamIdCounter.current++;
    const startTime = Date.now();
    const position = new Vector3();
    const direction = new Vector3();

    // Get initial position and direction from parent
    if (parentRef.current) {
      position.copy(parentRef.current.position);
      position.y += 1; // Offset for beam origin

      direction.set(0, 0, 1);
      direction.applyQuaternion(parentRef.current.quaternion);
    }

    const newBeam: FirebeamData = {
      id: beamId,
      startTime,
      isActive: true,
      position,
      direction,
      parentRef,
      onComplete,
      onHit
    };

    setActiveBeams(prev => [...prev, newBeam]);

    // Auto-deactivate after 1.5 seconds (short duration beam)
    setTimeout(() => {
      setActiveBeams(prev => prev.map(beam =>
        beam.id === beamId ? { ...beam, isActive: false } : beam
      ));
    }, 1500);

    return beamId;
  }, []);

  const removeBeam = useCallback((beamId: number) => {
    setActiveBeams(prev => prev.filter(beam => beam.id !== beamId));
  }, []);

  useFrame((state) => {
    // Throttle updates to avoid excessive re-renders
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.016) return; // ~60fps
    lastUpdateTime.current = currentTime;

    // Update beam positions from parent refs
    setActiveBeams(prev => prev.map(beam => {
      if (beam.parentRef.current) {
        const newPosition = beam.parentRef.current.position.clone();
        newPosition.y += 1; // Offset for beam origin

        const newDirection = new Vector3(0, 0, 1);
        newDirection.applyQuaternion(beam.parentRef.current.quaternion);

        return {
          ...beam,
          position: newPosition,
          direction: newDirection
        };
      }
      return beam;
    }));
  });

  const handleBeamComplete = useCallback((beamId: number) => {
    const beam = activeBeams.find(b => b.id === beamId);
    if (beam) {
      beam.onComplete();
      onBeamComplete?.(beamId);
    }
    removeBeam(beamId);
  }, [activeBeams, onBeamComplete, removeBeam]);

  const handleBeamHit = useCallback((beamId: number, targetId?: number, damage?: number, isFrozen?: boolean) => {
    const beam = activeBeams.find(b => b.id === beamId);
    if (beam && beam.onHit) {
      beam.onHit();
    }
    onBeamHit?.(beamId, targetId, damage, isFrozen);
  }, [activeBeams, onBeamHit]);

  // Note: createBeam, removeBeam, and handleBeamHit functions are defined but not exposed
  // as this component manages its own internal state

  return (
    <>
      {activeBeams.map(beam => (
        <Firebeam
          key={beam.id}
          parentRef={beam.parentRef}
          onComplete={() => handleBeamComplete(beam.id)}
          onHit={beam.onHit}
          isActive={beam.isActive}
          startTime={beam.startTime}
        />
      ))}
    </>
  );
}

// Global trigger function for PVP
let globalTriggerCallback: ((position: Vector3, direction: Vector3, casterId?: string) => void) | null = null;

export const setGlobalParticleBeamTrigger = (callback: (position: Vector3, direction: Vector3, casterId?: string) => void) => {
  globalTriggerCallback = callback;
};

export const triggerGlobalParticleBeam = (position: Vector3, direction: Vector3, casterId?: string) => {
  if (globalTriggerCallback) {
    globalTriggerCallback(position, direction, casterId);
  }
};

// Hook for using FirebeamManager
export const useFirebeamManager = () => {
  const managerRef = useRef<any>(null);

  const createBeam = useCallback((
    parentRef: React.RefObject<Group>,
    onComplete: () => void,
    onHit?: () => void
  ) => {
    return managerRef.current?.createBeam(parentRef, onComplete, onHit);
  }, []);

  const removeBeam = useCallback((beamId: number) => {
    managerRef.current?.removeBeam(beamId);
  }, []);

  const handleBeamHit = useCallback((beamId: number, targetId?: number, damage?: number, isFrozen?: boolean) => {
    managerRef.current?.handleBeamHit(beamId, targetId, damage, isFrozen);
  }, []);

  return {
    managerRef,
    createBeam,
    removeBeam,
    handleBeamHit
  };
};
