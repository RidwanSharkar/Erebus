import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from '@/utils/three-exports';
import TidalWave from './TidalWave';

interface TidalWaveData {
  id: number;
  startTime: number;
  isActive: boolean;
  position: Vector3;
  direction: Vector3;
  onComplete: () => void;
  arcAngle?: number;
}

interface TidalWaveManagerProps {
  onWaveComplete?: (waveId: number) => void;
}

export interface TidalWaveManagerRef {
  createWave: (position: Vector3, direction: Vector3, onComplete: () => void, arcAngle?: number) => number;
}

const TidalWaveManager = forwardRef<TidalWaveManagerRef, TidalWaveManagerProps>(({ onWaveComplete }, ref) => {
  const [activeWaves, setActiveWaves] = useState<TidalWaveData[]>([]);
  const waveIdCounter = useRef(0);

  useImperativeHandle(ref, () => ({
    createWave
  }));

  const createWave = useCallback((
    position: Vector3,
    direction: Vector3,
    onComplete: () => void,
    arcAngle?: number
  ) => {
    const waveId = waveIdCounter.current++;
    const startTime = Date.now();

    const newWave: TidalWaveData = {
      id: waveId,
      startTime,
      isActive: true,
      position: position.clone(),
      direction: direction.clone(),
      onComplete,
      arcAngle
    };

    setActiveWaves(prev => [...prev, newWave]);

    // Auto-complete after wave duration (2 seconds for full expansion)
    setTimeout(() => {
      setActiveWaves(prev => prev.filter(wave => wave.id !== waveId));
      onComplete();
      onWaveComplete?.(waveId);
    }, 2000);

    return waveId;
  }, [onWaveComplete]);

  // Update waves each frame
  useFrame(() => {
    // Active waves are managed by their own timeouts
  });

  return (
    <>
      {activeWaves.map(wave => (
        <TidalWave
          key={wave.id}
          position={wave.position}
          direction={wave.direction}
          onComplete={wave.onComplete}
          isActive={wave.isActive}
          startTime={wave.startTime}
          arcAngle={wave.arcAngle}
        />
      ))}
    </>
  );
});

TidalWaveManager.displayName = 'TidalWaveManager';

export default TidalWaveManager;

let globalTidalWaveTriggerCallback: ((position: Vector3, direction: Vector3, casterId?: string) => void) | null = null;

export const setGlobalTidalWaveTrigger = (callback: (position: Vector3, direction: Vector3, casterId?: string) => void) => {
  globalTidalWaveTriggerCallback = callback;
};

export const triggerGlobalTidalWave = (position: Vector3, direction: Vector3, casterId?: string) => {
  if (globalTidalWaveTriggerCallback) {
    globalTidalWaveTriggerCallback(position, direction, casterId);
  }
};

export const createTidalWave = (
  position: Vector3,
  direction: Vector3,
  onComplete?: () => void,
  arcAngle?: number
): number | null => {
  // This function can be called from external systems to create waves
  // The actual implementation will be handled by the manager component
  console.log('🌊 Creating tidal wave at position:', position, 'direction:', direction);

  // For now, return a dummy ID - the actual creation is handled by the component
  return Date.now();
};
