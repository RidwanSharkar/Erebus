'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import Boss2ArchonLightning from '@/components/enemies/Boss2ArchonLightning';
import StaggerProcLightning from '@/components/enemies/StaggerProcLightning';
import KnightSmiteLightning from '@/components/enemies/KnightSmiteLightning';
import TotemSuperconductorLightning from '@/components/projectiles/TotemSuperconductorLightning';
import type {
  Boss2ArchonLightningState,
  KnightSmiteLightningState,
  RoomBoomLightningEffectState,
  StaggerProcEffectState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopLightningBurstLayerHandle = {
  clearAll: () => void;
  addBoss2ArchonLightning: (bolt: Boss2ArchonLightningState) => void;
  addWarlockArchonShock: (bolt: Boss2ArchonLightningState) => void;
  addKnightStormLashZap: (bolt: Boss2ArchonLightningState) => void;
  addKnightSmiteLightning: (fx: KnightSmiteLightningState) => void;
  addStaggerProcEffect: (fx: StaggerProcEffectState) => void;
  addRoomBoomLightningEffect: (effect: RoomBoomLightningEffectState) => void;
};

const CoopLightningBurstLayer = memo(forwardRef<CoopLightningBurstLayerHandle, object>(
  function CoopLightningBurstLayer(_props, ref) {
    const [boss2ArchonLightnings, setBoss2ArchonLightnings] = useState<Boss2ArchonLightningState[]>([]);
    const [warlockArchonShocks, setWarlockArchonShocks] = useState<Boss2ArchonLightningState[]>([]);
    const [knightStormLashZaps, setKnightStormLashZaps] = useState<Boss2ArchonLightningState[]>([]);
    const [knightSmiteLightnings, setKnightSmiteLightnings] = useState<KnightSmiteLightningState[]>([]);
    const [staggerProcEffects, setStaggerProcEffects] = useState<StaggerProcEffectState[]>([]);
    const [roomBoomLightningEffects, setRoomBoomLightningEffects] = useState<RoomBoomLightningEffectState[]>([]);

    const clearAll = useCallback(() => {
      setBoss2ArchonLightnings([]);
      setWarlockArchonShocks([]);
      setKnightStormLashZaps([]);
      setKnightSmiteLightnings([]);
      setStaggerProcEffects([]);
      setRoomBoomLightningEffects([]);
    }, []);

    const addBoss2ArchonLightning = useCallback((bolt: Boss2ArchonLightningState) => {
      setBoss2ArchonLightnings((prev) => [...prev, bolt]);
    }, []);

    const addWarlockArchonShock = useCallback((bolt: Boss2ArchonLightningState) => {
      setWarlockArchonShocks((prev) => [...prev, bolt]);
    }, []);

    const addKnightStormLashZap = useCallback((bolt: Boss2ArchonLightningState) => {
      setKnightStormLashZaps((prev) => [...prev, bolt]);
    }, []);

    const addKnightSmiteLightning = useCallback((fx: KnightSmiteLightningState) => {
      setKnightSmiteLightnings((prev) => [...prev, fx]);
    }, []);

    const addStaggerProcEffect = useCallback((fx: StaggerProcEffectState) => {
      setStaggerProcEffects((prev) => [...prev, fx]);
    }, []);

    const addRoomBoomLightningEffect = useCallback((effect: RoomBoomLightningEffectState) => {
      setRoomBoomLightningEffects((prev) => [...prev, effect]);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addBoss2ArchonLightning,
      addWarlockArchonShock,
      addKnightStormLashZap,
      addKnightSmiteLightning,
      addStaggerProcEffect,
      addRoomBoomLightningEffect,
    }), [
      clearAll,
      addBoss2ArchonLightning,
      addWarlockArchonShock,
      addKnightStormLashZap,
      addKnightSmiteLightning,
      addStaggerProcEffect,
      addRoomBoomLightningEffect,
    ]);

    return (
      <>
        {boss2ArchonLightnings.map((bolt) => (
          <Boss2ArchonLightning
            key={bolt.id}
            beams={bolt.beams}
            strikeAt={bolt.strikeAt}
            halfWidth={bolt.halfWidth}
            onComplete={() => setBoss2ArchonLightnings(prev => prev.filter(x => x.id !== bolt.id))}
          />
        ))}

        {warlockArchonShocks.map((bolt) => (
          <Boss2ArchonLightning
            key={bolt.id}
            beams={bolt.beams}
            strikeAt={bolt.strikeAt}
            halfWidth={bolt.halfWidth}
            theme="warlock-purple"
            onComplete={() => setWarlockArchonShocks(prev => prev.filter(x => x.id !== bolt.id))}
          />
        ))}

        {knightStormLashZaps.map((bolt) => (
          <Boss2ArchonLightning
            key={bolt.id}
            beams={bolt.beams}
            strikeAt={bolt.strikeAt}
            halfWidth={bolt.halfWidth}
            theme="knight-storm-blue"
            onComplete={() => setKnightStormLashZaps(prev => prev.filter(x => x.id !== bolt.id))}
          />
        ))}

        {knightSmiteLightnings.map(fx => (
          <KnightSmiteLightning
            key={fx.id}
            position={fx.position}
            variant={fx.variant}
            widthScale={fx.widthScale}
            onComplete={() => setKnightSmiteLightnings(prev => prev.filter(e => e.id !== fx.id))}
          />
        ))}

        {staggerProcEffects.map(fx => (
          <StaggerProcLightning
            key={fx.id}
            position={fx.position}
            magmaCurrent={fx.magmaCurrent}
            forceOfNature={fx.forceOfNature}
            onComplete={() => setStaggerProcEffects(prev => prev.filter(e => e.id !== fx.id))}
          />
        ))}

        {roomBoomLightningEffects.map(effect => (
          <TotemSuperconductorLightning
            key={`room-boom-lightning-${effect.id}`}
            from={effect.from}
            to={effect.to}
            onComplete={() => setRoomBoomLightningEffects(prev => prev.filter(e => e.id !== effect.id))}
          />
        ))}
      </>
    );
  },
));

CoopLightningBurstLayer.displayName = 'CoopLightningBurstLayer';

export default CoopLightningBurstLayer;
