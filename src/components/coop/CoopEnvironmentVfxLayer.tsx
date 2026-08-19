'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import type { Position3 } from '@/utils/position3';
import GoldCollectMoteEffect from '@/components/enemies/GoldCollectMoteEffect';
import WoodCollectMoteEffect from '@/components/environment/WoodCollectMoteEffect';
import StoneCollectMoteEffect from '@/components/environment/StoneCollectMoteEffect';
import MeatCollectMoteEffect from '@/components/environment/MeatCollectMoteEffect';
import DreamShardEffect from '@/components/enemies/DreamShardEffect';
import RunePickupRiseEffect from '@/components/enemies/RunePickupRiseEffect';
import MushroomEruptionVfx from '@/components/environment/MushroomEruptionVfx';
import DeathEffect from '@/components/weapons/DeathEffect';
import type {
  DeathEffectState,
  DreamShardState,
  GoldCollectMoteState,
  MushroomEruptionFxState,
  RunePickupRiseState,
  WoodCollectMoteBatchState,
  StoneCollectMoteBatchState,
  MeatCollectMoteBatchState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopEnvironmentVfxLayerHandle = {
  clearAll: () => void;
  addGoldCollectMote: (mote: GoldCollectMoteState) => void;
  addGoldCollectMotes: (motes: GoldCollectMoteState[]) => void;
  addWoodCollectBatch: (batch: WoodCollectMoteBatchState) => void;
  addStoneCollectBatch: (batch: StoneCollectMoteBatchState) => void;
  addMeatCollectBatch: (batch: MeatCollectMoteBatchState) => void;
  addRunePickupRise: (fx: RunePickupRiseState) => void;
  addRunePickupRises: (fxList: RunePickupRiseState[]) => void;
  addMushroomEruption: (fx: MushroomEruptionFxState) => void;
  addMushroomEruptions: (fxList: MushroomEruptionFxState[]) => void;
  addDreamShard: (fx: DreamShardState) => void;
  setDeathEffect: (playerId: string, effect: DeathEffectState) => void;
  removeDeathEffect: (playerId: string) => void;
};

type DeathEffectPlayerData = {
  id: string;
  position: Position3;
  health: number;
};

type CoopEnvironmentVfxLayerProps = {
  getCurrentPlayerPosition: () => Vector3;
  getDeathEffectPlayerData: () => DeathEffectPlayerData[];
  localSocketId?: string;
  onDeathEffectComplete: (playerId: string) => void;
  onGoldCollectMoteComplete?: (moteId: string) => void;
  onDreamShardComplete?: (shardId: string) => void;
};

const CoopEnvironmentVfxLayer = memo(forwardRef<CoopEnvironmentVfxLayerHandle, CoopEnvironmentVfxLayerProps>(
  function CoopEnvironmentVfxLayer({
    getCurrentPlayerPosition,
    getDeathEffectPlayerData,
    localSocketId,
    onDeathEffectComplete,
    onGoldCollectMoteComplete,
    onDreamShardComplete,
  }, ref) {
    const [goldCollectMotes, setGoldCollectMotes] = useState<GoldCollectMoteState[]>([]);
    const [woodCollectBatches, setWoodCollectBatches] = useState<WoodCollectMoteBatchState[]>([]);
    const [stoneCollectBatches, setStoneCollectBatches] = useState<StoneCollectMoteBatchState[]>([]);
    const [meatCollectBatches, setMeatCollectBatches] = useState<MeatCollectMoteBatchState[]>([]);
    const [dreamShards, setDreamShards] = useState<DreamShardState[]>([]);
    const [runePickupRises, setRunePickupRises] = useState<RunePickupRiseState[]>([]);
    const [mushroomEruptionFx, setMushroomEruptionFx] = useState<MushroomEruptionFxState[]>([]);
    const [deathEffects, setDeathEffects] = useState<Map<string, DeathEffectState>>(() => new Map());

    const clearAll = useCallback(() => {
      setGoldCollectMotes([]);
      setWoodCollectBatches([]);
      setStoneCollectBatches([]);
      setMeatCollectBatches([]);
      setDreamShards([]);
      setRunePickupRises([]);
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

    const addWoodCollectBatch = useCallback((batch: WoodCollectMoteBatchState) => {
      if (batch.motes.length === 0) return;
      setWoodCollectBatches((prev) => [...prev, batch]);
    }, []);

    const addStoneCollectBatch = useCallback((batch: StoneCollectMoteBatchState) => {
      if (batch.motes.length === 0) return;
      setStoneCollectBatches((prev) => [...prev, batch]);
    }, []);

    const addMeatCollectBatch = useCallback((batch: MeatCollectMoteBatchState) => {
      if (batch.motes.length === 0) return;
      setMeatCollectBatches((prev) => [...prev, batch]);
    }, []);

    const addRunePickupRise = useCallback((fx: RunePickupRiseState) => {
      setRunePickupRises((prev) => [...prev, fx]);
    }, []);

    const addRunePickupRises = useCallback((fxList: RunePickupRiseState[]) => {
      if (fxList.length === 0) return;
      setRunePickupRises((prev) => [...prev, ...fxList]);
    }, []);

    const addMushroomEruption = useCallback((fx: MushroomEruptionFxState) => {
      setMushroomEruptionFx((prev) => [...prev, fx]);
    }, []);

    const addMushroomEruptions = useCallback((fxList: MushroomEruptionFxState[]) => {
      if (fxList.length === 0) return;
      setMushroomEruptionFx((prev) => [...prev, ...fxList]);
    }, []);

    const addDreamShard = useCallback((fx: DreamShardState) => {
      setDreamShards((prev) => [...prev, fx]);
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
      addWoodCollectBatch,
      addStoneCollectBatch,
      addMeatCollectBatch,
      addRunePickupRise,
      addRunePickupRises,
      addMushroomEruption,
      addMushroomEruptions,
      addDreamShard,
      setDeathEffect,
      removeDeathEffect,
    }), [
      clearAll,
      addGoldCollectMote,
      addGoldCollectMotes,
      addWoodCollectBatch,
      addStoneCollectBatch,
      addMeatCollectBatch,
      addRunePickupRise,
      addRunePickupRises,
      addMushroomEruption,
      addMushroomEruptions,
      addDreamShard,
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

        {woodCollectBatches.map((batch) => (
          <WoodCollectMoteEffect
            key={batch.batchId}
            batchId={batch.batchId}
            motes={batch.motes}
            getCurrentPlayerPosition={getCurrentPlayerPosition}
            onMoteComplete={() => {
              window.dispatchEvent(new CustomEvent('wood-collected'));
            }}
            onBatchComplete={() => {
              setWoodCollectBatches((prev) => prev.filter((b) => b.batchId !== batch.batchId));
            }}
          />
        ))}

        {stoneCollectBatches.map((batch) => (
          <StoneCollectMoteEffect
            key={batch.batchId}
            batchId={batch.batchId}
            motes={batch.motes}
            getCurrentPlayerPosition={getCurrentPlayerPosition}
            onMoteComplete={() => {
              window.dispatchEvent(new CustomEvent('stone-collected'));
            }}
            onBatchComplete={() => {
              setStoneCollectBatches((prev) => prev.filter((b) => b.batchId !== batch.batchId));
            }}
          />
        ))}

        {meatCollectBatches.map((batch) => (
          <MeatCollectMoteEffect
            key={batch.batchId}
            batchId={batch.batchId}
            motes={batch.motes}
            getCurrentPlayerPosition={getCurrentPlayerPosition}
            onMoteComplete={() => {
              window.dispatchEvent(new CustomEvent('meat-collected'));
            }}
            onBatchComplete={() => {
              setMeatCollectBatches((prev) => prev.filter((b) => b.batchId !== batch.batchId));
            }}
          />
        ))}

        {dreamShards.map((shard) => (
          <DreamShardEffect
            key={shard.id}
            startPosition={shard.startPosition}
            initialDirection={shard.initialDirection}
            getPlayerPosition={getCurrentPlayerPosition}
            onComplete={() => {
              setDreamShards((prev) => prev.filter((s) => s.id !== shard.id));
              onDreamShardComplete?.(shard.id);
            }}
          />
        ))}

        {runePickupRises.map((fx) => (
          <RunePickupRiseEffect
            key={fx.id}
            position={fx.position}
            color={fx.color}
            onComplete={() => setRunePickupRises((prev) => prev.filter((e) => e.id !== fx.id))}
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
