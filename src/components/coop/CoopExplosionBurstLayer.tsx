'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import TitanStompShockwave from '@/components/enemies/TitanStompShockwave';
import WarlockVoidBoltExplosion from '@/components/enemies/WarlockVoidBoltExplosion';
import MartyrDetonationExplosion from '@/components/enemies/MartyrDetonationExplosion';
import CrossentropyExplosion from '@/components/projectiles/CrossentropyExplosion';
import DeathFlashExplosion from '@/components/enemies/DeathFlashExplosion';
import TemplarBlinkSmiteGround from '@/components/enemies/TemplarBlinkSmiteGround';
import BossTeleportEffect from '@/components/enemies/BossTeleportEffect';
import type {
  DeathFlashExplosionState,
  FissionDetonationState,
  MartyrDetonationExplosionState,
  TeleportEffectState,
  TemplarBlinkSmiteStrikeState,
  TitanStompShockwaveBurst,
  WarlockVoidBoltExplosionState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopExplosionBurstLayerHandle = {
  clearAll: () => void;
  addTitanStompShockwave: (burst: TitanStompShockwaveBurst) => void;
  addWarlockVoidBoltExplosion: (burst: WarlockVoidBoltExplosionState) => void;
  addMartyrDetonationExplosion: (boom: MartyrDetonationExplosionState) => void;
  addFissionDetonation: (boom: FissionDetonationState) => void;
  addDeathFlashExplosion: (fx: DeathFlashExplosionState) => void;
  addTemplarBlinkSmiteStrike: (strike: TemplarBlinkSmiteStrikeState) => void;
  addTeleportEffect: (effect: TeleportEffectState) => void;
};

const CoopExplosionBurstLayer = memo(forwardRef<CoopExplosionBurstLayerHandle, object>(
  function CoopExplosionBurstLayer(_props, ref) {
    const [titanStompShockwaves, setTitanStompShockwaves] = useState<TitanStompShockwaveBurst[]>([]);
    const [warlockVoidBoltExplosions, setWarlockVoidBoltExplosions] = useState<WarlockVoidBoltExplosionState[]>([]);
    const [martyrDetonationExplosions, setMartyrDetonationExplosions] = useState<MartyrDetonationExplosionState[]>([]);
    const [fissionDetonations, setFissionDetonations] = useState<FissionDetonationState[]>([]);
    const [deathFlashExplosions, setDeathFlashExplosions] = useState<DeathFlashExplosionState[]>([]);
    const [templarBlinkSmiteStrikes, setTemplarBlinkSmiteStrikes] = useState<TemplarBlinkSmiteStrikeState[]>([]);
    const [activeTeleportEffects, setActiveTeleportEffects] = useState<TeleportEffectState[]>([]);

    const clearAll = useCallback(() => {
      setTitanStompShockwaves([]);
      setWarlockVoidBoltExplosions([]);
      setMartyrDetonationExplosions([]);
      setFissionDetonations([]);
      setDeathFlashExplosions([]);
      setTemplarBlinkSmiteStrikes([]);
      setActiveTeleportEffects([]);
    }, []);

    const addTitanStompShockwave = useCallback((burst: TitanStompShockwaveBurst) => {
      setTitanStompShockwaves((prev) => [...prev, burst]);
    }, []);

    const addWarlockVoidBoltExplosion = useCallback((burst: WarlockVoidBoltExplosionState) => {
      setWarlockVoidBoltExplosions((prev) => [...prev, burst]);
    }, []);

    const addMartyrDetonationExplosion = useCallback((boom: MartyrDetonationExplosionState) => {
      setMartyrDetonationExplosions((prev) => [...prev, boom]);
    }, []);

    const addFissionDetonation = useCallback((boom: FissionDetonationState) => {
      setFissionDetonations((prev) => [...prev, boom]);
    }, []);

    const addDeathFlashExplosion = useCallback((fx: DeathFlashExplosionState) => {
      setDeathFlashExplosions((prev) => [...prev, fx]);
    }, []);

    const addTemplarBlinkSmiteStrike = useCallback((strike: TemplarBlinkSmiteStrikeState) => {
      setTemplarBlinkSmiteStrikes((prev) => [...prev, strike]);
    }, []);

    const addTeleportEffect = useCallback((effect: TeleportEffectState) => {
      setActiveTeleportEffects((prev) => [...prev, effect]);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addTitanStompShockwave,
      addWarlockVoidBoltExplosion,
      addMartyrDetonationExplosion,
      addFissionDetonation,
      addDeathFlashExplosion,
      addTemplarBlinkSmiteStrike,
      addTeleportEffect,
    }), [
      clearAll,
      addTitanStompShockwave,
      addWarlockVoidBoltExplosion,
      addMartyrDetonationExplosion,
      addFissionDetonation,
      addDeathFlashExplosion,
      addTemplarBlinkSmiteStrike,
      addTeleportEffect,
    ]);

    return (
      <>
        {warlockVoidBoltExplosions.map((burst) => (
          <WarlockVoidBoltExplosion
            key={burst.id}
            position={burst.position}
            onComplete={() => setWarlockVoidBoltExplosions((prev) => prev.filter((x) => x.id !== burst.id))}
          />
        ))}

        {titanStompShockwaves.map((burst) => (
          <TitanStompShockwave
            key={burst.id}
            burst={burst}
            onComplete={() => setTitanStompShockwaves((prev) => prev.filter((x) => x.id !== burst.id))}
          />
        ))}

        {activeTeleportEffects.map(effect => {
          return (
            <BossTeleportEffect
              key={effect.id}
              position={effect.position}
              type={effect.type}
              theme="red"
              onComplete={() => {
                // Remove effect when it's done
                setActiveTeleportEffects(prev => prev.filter(e => e.id !== effect.id));
              }}
            />
          );
        })}

        {templarBlinkSmiteStrikes.map(strike => (
          <TemplarBlinkSmiteGround
            key={strike.id}
            position={strike.position}
            onComplete={() => {
              setTemplarBlinkSmiteStrikes(prev => prev.filter(s => s.id !== strike.id));
            }}
          />
        ))}

        {martyrDetonationExplosions.map(boom => (
          <MartyrDetonationExplosion
            key={boom.id}
            position={boom.position}
            maxRadius={boom.radius}
            onComplete={() => {
              setMartyrDetonationExplosions(prev => prev.filter(b => b.id !== boom.id));
            }}
          />
        ))}

        {fissionDetonations.map(boom => (
          <CrossentropyExplosion
            key={boom.id}
            position={boom.position}
            visualTheme="inferno"
            explosionStartTime={null}
            onComplete={() => {
              setFissionDetonations(prev => prev.filter(b => b.id !== boom.id));
            }}
          />
        ))}

        {deathFlashExplosions.map(fx => (
          <DeathFlashExplosion
            key={fx.id}
            position={fx.position}
            scale={fx.scale}
            onComplete={() => {
              setDeathFlashExplosions(prev => prev.filter(x => x.id !== fx.id));
            }}
          />
        ))}
      </>
    );
  },
));

CoopExplosionBurstLayer.displayName = 'CoopExplosionBurstLayer';

export default CoopExplosionBurstLayer;
