'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Vector3 } from '@/utils/three-exports';
import BossTectonicSpike from '@/components/enemies/BossTectonicSpike';
import { setFrostShatterSpikeSpawner } from './frostShatterSpikeSpawnBridge';

interface FrostShatterSpikeData {
  id: number;
  position: Vector3;
}

export default function FrostShatterSpikeManager() {
  const [activeSpikes, setActiveSpikes] = useState<FrostShatterSpikeData[]>([]);
  const spikeIdCounter = useRef(0);

  const spawnSpike = useCallback((position: Vector3) => {
    const id = spikeIdCounter.current++;
    setActiveSpikes((prev) => [...prev, { id, position: position.clone() }]);
  }, []);

  useEffect(() => {
    setFrostShatterSpikeSpawner(spawnSpike);
    return () => {
      setFrostShatterSpikeSpawner(null);
    };
  }, [spawnSpike]);

  const handleComplete = useCallback((spikeId: number) => {
    setActiveSpikes((prev) => prev.filter((s) => s.id !== spikeId));
  }, []);

  return (
    <>
      {activeSpikes.map((spike) => (
        <BossTectonicSpike
          key={spike.id}
          worldPosition={spike.position}
          variant="hellfireCrystal"
          variantSeed={`frost-shatter-${spike.id}`}
          onComplete={() => handleComplete(spike.id)}
        />
      ))}
    </>
  );
}
