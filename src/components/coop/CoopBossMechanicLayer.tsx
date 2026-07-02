'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import BossTectonicSpike from '@/components/enemies/BossTectonicSpike';
import Boss3NovaDiscs from '@/components/enemies/Boss3NovaDiscs';
import { TECTONIC_HIT_RADIUS } from '@/components/enemies/BossTectonicSpikeTelegraph';
import SpikeGroundCracksVfx from '@/components/environment/SpikeGroundCracksVfx';
import type {
  Boss3NovaBurst,
  BossTectonicSpikeState,
  TectonicSpikeGroundCrackState,
  WeaverImpaleSpikeState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopBossMechanicLayerHandle = {
  clearAll: () => void;
  addBossTectonicSpike: (spike: BossTectonicSpikeState) => void;
  addTectonicSpikeGroundCrack: (crack: TectonicSpikeGroundCrackState) => void;
  addWeaverImpaleSpike: (spike: WeaverImpaleSpikeState) => void;
  addBoss3NovaBurst: (burst: Boss3NovaBurst) => void;
};

const CoopBossMechanicLayer = memo(forwardRef<CoopBossMechanicLayerHandle, object>(
  function CoopBossMechanicLayer(_props, ref) {
    const [bossTectonicSpikes, setBossTectonicSpikes] = useState<BossTectonicSpikeState[]>([]);
    const [tectonicSpikeGroundCracks, setTectonicSpikeGroundCracks] = useState<TectonicSpikeGroundCrackState[]>([]);
    const [weaverImpaleSpikes, setWeaverImpaleSpikes] = useState<WeaverImpaleSpikeState[]>([]);
    const [boss3NovaBursts, setBoss3NovaBursts] = useState<Boss3NovaBurst[]>([]);

    const clearAll = useCallback(() => {
      setBossTectonicSpikes([]);
      setTectonicSpikeGroundCracks([]);
      setWeaverImpaleSpikes([]);
      setBoss3NovaBursts([]);
    }, []);

    const addBossTectonicSpike = useCallback((spike: BossTectonicSpikeState) => {
      setBossTectonicSpikes((prev) => [...prev, spike]);
    }, []);

    const addTectonicSpikeGroundCrack = useCallback((crack: TectonicSpikeGroundCrackState) => {
      setTectonicSpikeGroundCracks((prev) => [...prev, crack]);
    }, []);

    const addWeaverImpaleSpike = useCallback((spike: WeaverImpaleSpikeState) => {
      setWeaverImpaleSpikes((prev) => [...prev, spike]);
    }, []);

    const addBoss3NovaBurst = useCallback((burst: Boss3NovaBurst) => {
      setBoss3NovaBursts((prev) => [...prev, burst]);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addBossTectonicSpike,
      addTectonicSpikeGroundCrack,
      addWeaverImpaleSpike,
      addBoss3NovaBurst,
    }), [
      clearAll,
      addBossTectonicSpike,
      addTectonicSpikeGroundCrack,
      addWeaverImpaleSpike,
      addBoss3NovaBurst,
    ]);

    return (
      <>
        {weaverImpaleSpikes.map((sp) => (
          <BossTectonicSpike
            key={sp.id}
            worldPosition={sp.position}
            theme={sp.theme}
            variantSeed={sp.id}
            onComplete={() => {
              setWeaverImpaleSpikes((prev) => prev.filter((x) => x.id !== sp.id));
            }}
          />
        ))}

        {bossTectonicSpikes.map((sp) => (
          <BossTectonicSpike
            key={sp.id}
            worldPosition={sp.position}
            variantSeed={sp.id}
            onComplete={() => {
              setBossTectonicSpikes((prev) => prev.filter((x) => x.id !== sp.id));
            }}
          />
        ))}

        {tectonicSpikeGroundCracks.map((cr) => (
          <SpikeGroundCracksVfx
            key={cr.id}
            position={[cr.x, cr.y, cr.z]}
            radius={TECTONIC_HIT_RADIUS}
            seed={cr.seed}
            durationMs={cr.durationMs}
            onComplete={() =>
              setTectonicSpikeGroundCracks((prev) => prev.filter((c) => c.id !== cr.id))
            }
          />
        ))}

        <Boss3NovaDiscs
          bursts={boss3NovaBursts}
          onBurstComplete={id => setBoss3NovaBursts(prev => prev.filter(b => b.id !== id))}
        />
      </>
    );
  },
));

CoopBossMechanicLayer.displayName = 'CoopBossMechanicLayer';

export default CoopBossMechanicLayer;
