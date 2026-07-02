'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import GoldCollectMoteEffect from '@/components/enemies/GoldCollectMoteEffect';
import MushroomEruptionVfx from '@/components/environment/MushroomEruptionVfx';
import DeathEffect from '@/components/weapons/DeathEffect';
import type {
  DeathEffectState,
  GoldCollectMoteState,
  MushroomEruptionFxState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopEnvironmentVfxLayerHandle = {
  clearAll: () => void;
  addGoldCollectMote: (mote: GoldCollectMoteState) => void;
  addGoldCollectMotes: (motes: GoldCollectMoteState[]) => void;
  addMushroomEruption: (fx: MushroomEruptionFxState) => void;
  addMushroomEruptions: (fxList: MushroomEruptionFxState[]) => void;
  setDeathEffect: (playerId: string, effect: DeathEffectState) => void;
  removeDeathEffect: (playerId: string) => void;
};

type DeathEffectPlayerData = {
  id: string;
  position: Vector3;
  health: number;
};

type CoopEnvironmentVfxLayerProps = {
  getCurrentPlayerPosition: () => Vector3;
  getDeathEffectPlayerData: () => DeathEffectPlayerData[];
  localSocketId?: string;
  onDeathEffectComplete: (playerId: string) => void;
  onGoldCollectMoteComplete?: (moteId: string) => void;
};

const CoopEnvironmentVfxLayer = memo(forwardRef<CoopEnvironmentVfxLayerHandle, CoopEnvironmentVfxLayerProps>(
  function CoopEnvironmentVfxLayer({
    getCurrentPlayerPosition,
    getDeathEffectPlayerData,
    localSocketId,
    onDeathEffectComplete,
    onGoldCollectMoteComplete,
  }, ref) {
    const [goldCollectMotes, setGoldCollectMotes] = useState<GoldCollectMoteState[]>([]);
    const [mushroomEruptionFx, setMushroomEruptionFx] = useState<MushroomEruptionFxState[]>([]);
    const [deathEffects, setDeathEffects] = useState<Map<string, DeathEffectState>>(() => new Map());

    const clearAll = useCallback(() => {
      setGoldCollectMotes([]);
      setMushroomEruptionFx([]);
      setDeathEffects(new Map());
    }, []);

    const addGoldCollectMote = useCallback((mote: GoldCollectMoteState) => {
      setGoldCollectMotes((prev) => [...prev, mote]);
    }, []);

    const addGoldCollectMotes = useCallback((motes: GoldCollectMoteState[]) => {
      if (motes.length === 0) return;
      setGoldCollectMotes((prev) => [...prev, ...motes]);
    }, []);

    const addMushroomEruption = useCallback((fx: MushroomEruptionFxState) => {
      setMushroomEruptionFx((prev) => [...prev, fx]);
    }, []);

    const addMushroomEruptions = useCallback((fxList: MushroomEruptionFxState[]) => {
      if (fxList.length === 0) return;
      setMushroomEruptionFx((prev) => [...prev, ...fxList]);
    }, []);

    const setDeathEffect = useCallback((playerId: string, effect: DeathEffectState) => {
      setDeathEffects((prev) => {
        const next = new Map(prev);
        next.set(playerId, effect);
        return next;
      });
    }, []);

    const removeDeathEffect = useCallback((playerId: string) => {
      setDeathEffects((prev) => {
        if (!prev.has(playerId)) return prev;
        const next = new Map(prev);
        next.delete(playerId);
        return next;
      });
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addGoldCollectMote,
      addGoldCollectMotes,
      addMushroomEruption,
      addMushroomEruptions,
      setDeathEffect,
      removeDeathEffect,
    }), [
      clearAll,
      addGoldCollectMote,
      addGoldCollectMotes,
      addMushroomEruption,
      addMushroomEruptions,
      setDeathEffect,
      removeDeathEffect,
    ]);

    return (
      <>
        {goldCollectMotes.map((mote) => (
          <GoldCollectMoteEffect
            key={mote.id}
            id={mote.id}
            startPosition={mote.startPosition}
            startTime={mote.startTime}
            duration={mote.duration}
            getCurrentPlayerPosition={getCurrentPlayerPosition}
            onComplete={() => {
              setGoldCollectMotes((prev) => prev.filter((m) => m.id !== mote.id));
              onGoldCollectMoteComplete?.(mote.id);
              window.dispatchEvent(new CustomEvent('gold-pocket-collected'));
            }}
          />
        ))}

        {mushroomEruptionFx.map((fx) => (
          <MushroomEruptionVfx
            key={fx.id}
            origin={fx.pos}
            onDone={() => setMushroomEruptionFx((prev) => prev.filter((e) => e.id !== fx.id))}
          />
        ))}

        {Array.from(deathEffects.values()).map((effect) => (
          <DeathEffect
            key={effect.playerId}
            position={effect.position}
            startTime={effect.startTime}
            duration={30000}
            playerId={effect.playerId}
            playerData={getDeathEffectPlayerData()}
            onComplete={() => {
              if (effect.playerId === localSocketId) {
                onDeathEffectComplete(effect.playerId);
              }
              removeDeathEffect(effect.playerId);
            }}
          />
        ))}
      </>
    );
  },
));

CoopEnvironmentVfxLayer.displayName = 'CoopEnvironmentVfxLayer';

export default CoopEnvironmentVfxLayer;
