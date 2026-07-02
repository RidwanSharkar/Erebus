'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import KnightDeathVortex from '@/components/enemies/KnightDeathVortex';
import GhoulSummonRitual from '@/components/enemies/GhoulSummonRitual';
import InfestedZombieRiseVFX from '@/components/enemies/InfestedZombieRiseVFX';
import VenomEffect from '@/components/projectiles/VenomEffect';
import EnemySummonFlameVFX from '@/components/enemies/EnemySummonFlameVFX';
import WeaverHealEffect from '@/components/enemies/WeaverHealEffect';
import { CROSSENTROPY_PLAGUE_VENOM_MS } from '@/utils/talents';
import type {
  EnemySummonFlameVfxState,
  ExploderStrainVenomVfxState,
  GhoulSummonRitualState,
  InfestedZombieSummonVfxState,
  KnightDeathVortexState,
  WeaverHealEffectState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopSummonRitualLayerHandle = {
  clearAll: () => void;
  addKnightDeathVortex: (vortex: KnightDeathVortexState) => void;
  addGhoulSummonRitual: (ritual: GhoulSummonRitualState) => void;
  addInfestedZombieSummonVfx: (fx: InfestedZombieSummonVfxState) => void;
  addExploderStrainVenomVfx: (fx: ExploderStrainVenomVfxState) => void;
  addEnemySummonFlameVfx: (fx: EnemySummonFlameVfxState) => void;
  addWeaverHealEffect: (effect: WeaverHealEffectState) => void;
};

const CoopSummonRitualLayer = memo(forwardRef<CoopSummonRitualLayerHandle, object>(
  function CoopSummonRitualLayer(_props, ref) {
    const [knightDeathVortices, setKnightDeathVortices] = useState<KnightDeathVortexState[]>([]);
    const [ghoulSummonRituals, setGhoulSummonRituals] = useState<GhoulSummonRitualState[]>([]);
    const [infestedZombieSummonVfx, setInfestedZombieSummonVfx] = useState<InfestedZombieSummonVfxState[]>([]);
    const [exploderStrainVenomVfx, setExploderStrainVenomVfx] = useState<ExploderStrainVenomVfxState[]>([]);
    const [enemySummonFlameVfx, setEnemySummonFlameVfx] = useState<EnemySummonFlameVfxState[]>([]);
    const [weaverHealEffects, setWeaverHealEffects] = useState<WeaverHealEffectState[]>([]);

    const clearAll = useCallback(() => {
      setKnightDeathVortices([]);
      setGhoulSummonRituals([]);
      setInfestedZombieSummonVfx([]);
      setExploderStrainVenomVfx([]);
      setEnemySummonFlameVfx([]);
      setWeaverHealEffects([]);
    }, []);

    const addKnightDeathVortex = useCallback((vortex: KnightDeathVortexState) => {
      setKnightDeathVortices((prev) => [...prev, vortex]);
    }, []);

    const addGhoulSummonRitual = useCallback((ritual: GhoulSummonRitualState) => {
      setGhoulSummonRituals((prev) => [...prev, ritual]);
    }, []);

    const addInfestedZombieSummonVfx = useCallback((fx: InfestedZombieSummonVfxState) => {
      setInfestedZombieSummonVfx((prev) => [...prev, fx]);
    }, []);

    const addExploderStrainVenomVfx = useCallback((fx: ExploderStrainVenomVfxState) => {
      setExploderStrainVenomVfx((prev) => [...prev, fx]);
    }, []);

    const addEnemySummonFlameVfx = useCallback((fx: EnemySummonFlameVfxState) => {
      setEnemySummonFlameVfx((prev) => [...prev, fx]);
    }, []);

    const addWeaverHealEffect = useCallback((effect: WeaverHealEffectState) => {
      setWeaverHealEffects((prev) => [...prev, effect]);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addKnightDeathVortex,
      addGhoulSummonRitual,
      addInfestedZombieSummonVfx,
      addExploderStrainVenomVfx,
      addEnemySummonFlameVfx,
      addWeaverHealEffect,
    }), [
      clearAll,
      addKnightDeathVortex,
      addGhoulSummonRitual,
      addInfestedZombieSummonVfx,
      addExploderStrainVenomVfx,
      addEnemySummonFlameVfx,
      addWeaverHealEffect,
    ]);

    return (
      <>
        {knightDeathVortices.map(vortex => (
          <KnightDeathVortex
            key={vortex.id}
            id={vortex.id}
            position={vortex.position}
            soulType={vortex.soulType}
            onComplete={() =>
              setKnightDeathVortices(prev => prev.filter(v => v.id !== vortex.id))
            }
          />
        ))}

        {ghoulSummonRituals.map(ritual => (
          <GhoulSummonRitual
            key={ritual.id}
            position={ritual.position}
            onComplete={() => setGhoulSummonRituals(prev => prev.filter(r => r.id !== ritual.id))}
          />
        ))}

        {infestedZombieSummonVfx.map(fx => (
          <InfestedZombieRiseVFX
            key={fx.id}
            position={fx.position}
            onComplete={() => setInfestedZombieSummonVfx(prev => prev.filter(e => e.id !== fx.id))}
          />
        ))}

        {exploderStrainVenomVfx.map(fx => (
          <VenomEffect
            key={fx.id}
            position={fx.position}
            duration={CROSSENTROPY_PLAGUE_VENOM_MS}
            onComplete={() => setExploderStrainVenomVfx(prev => prev.filter(e => e.id !== fx.id))}
          />
        ))}

        {enemySummonFlameVfx.map(fx => (
          <EnemySummonFlameVFX
            key={fx.id}
            position={fx.position}
            onComplete={() => setEnemySummonFlameVfx(prev => prev.filter(e => e.id !== fx.id))}
          />
        ))}

        {weaverHealEffects.map(effect => (
          <WeaverHealEffect
            key={effect.id}
            position={effect.position}
            onComplete={() => setWeaverHealEffects(prev => prev.filter(e => e.id !== effect.id))}
          />
        ))}
      </>
    );
  },
));

CoopSummonRitualLayer.displayName = 'CoopSummonRitualLayer';

export default CoopSummonRitualLayer;
