import React, { useState, useRef, useCallback } from 'react';
import { Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import FireStorm from './FireStorm';
import { setFireStormSpawner } from './fireStormSpawnBridge';
import type { World } from '@/ecs/World';

interface FireStormData {
  id: number;
  position: Vector3;
  startTime: number;
  duration: number;
}

interface FireStormManagerProps {
  world?: World;
}

export default function FireStormManager({ world: _world }: FireStormManagerProps) {
  const [activeStorms, setActiveStorms] = useState<FireStormData[]>([]);
  const stormIdCounter = useRef(0);
  const lastUpdateTime = useRef(0);

  const triggerFireStorm = useCallback((position: Vector3) => {
    const newStorm: FireStormData = {
      id: stormIdCounter.current++,
      position: position.clone(),
      startTime: Date.now(),
      duration: 700,
    };

    setActiveStorms((prev) => [...prev, newStorm]);
  }, []);

  React.useEffect(() => {
    setFireStormSpawner(triggerFireStorm);

    return () => {
      setFireStormSpawner(null);
    };
  }, [triggerFireStorm]);

  useFrame((state) => {
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.1) return;
    lastUpdateTime.current = currentTime;

    const now = Date.now();
    setActiveStorms((prev) =>
      prev.filter((storm) => now - storm.startTime < storm.duration),
    );
  });

  const handleFireStormComplete = (stormId: number) => {
    setActiveStorms((prev) => prev.filter((s) => s.id !== stormId));
  };

  return (
    <>
      {activeStorms.map((storm) => (
        <FireStorm
          key={storm.id}
          position={storm.position}
          duration={storm.duration}
          startTime={storm.startTime}
          onComplete={() => handleFireStormComplete(storm.id)}
        />
      ))}
    </>
  );
}
