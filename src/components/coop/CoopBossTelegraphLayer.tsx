'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import BossLeapShockwave from '@/components/enemies/BossLeapShockwave';
import WarlockFlameStrike from '@/components/enemies/WarlockFlameStrike';
import WeaverLightningStrike from '@/components/enemies/WeaverLightningStrike';
import FrostNova from '@/components/weapons/FrostNova';
import Blizzard from '@/components/weapons/Blizzard/Blizzard';
import { ARCTIC_BLIZZARD_DAMAGE_PER_TICK } from '@/utils/talents';
import type {
  BossLeapShockwaveState,
  DualityBlizzardState,
  RoomBoomFlameStrikeState,
  RoomBoomFrostNovaState,
  WarlockFlameStrikeState,
  WeaverLightningState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopBossTelegraphLayerHandle = {
  clearAll: () => void;
  addBossLeapShockwave: (shockwave: BossLeapShockwaveState) => void;
  addWarlockFlameStrike: (strike: WarlockFlameStrikeState) => void;
  addWeaverLightningStrike: (strike: WeaverLightningState) => void;
  addRoomBoomFlameStrike: (effect: RoomBoomFlameStrikeState) => void;
  addRoomBoomFrostNova: (effect: RoomBoomFrostNovaState) => void;
  addDualityBlizzard: (storm: DualityBlizzardState) => void;
};

type CoopBossTelegraphLayerProps = {
  onWeaverLightningImpact: (damage: number, position: Vector3, strike: WeaverLightningState) => void;
};

const CoopBossTelegraphLayer = memo(forwardRef<CoopBossTelegraphLayerHandle, CoopBossTelegraphLayerProps>(
  function CoopBossTelegraphLayer({ onWeaverLightningImpact }, ref) {
    const [bossLeapShockwaves, setBossLeapShockwaves] = useState<BossLeapShockwaveState[]>([]);
    const [warlockFlameStrikes, setWarlockFlameStrikes] = useState<WarlockFlameStrikeState[]>([]);
    const [weaverLightningStrikes, setWeaverLightningStrikes] = useState<WeaverLightningState[]>([]);
    const [roomBoomFlameStrikes, setRoomBoomFlameStrikes] = useState<RoomBoomFlameStrikeState[]>([]);
    const [roomBoomFrostNovas, setRoomBoomFrostNovas] = useState<RoomBoomFrostNovaState[]>([]);
    const [activeDualityBlizzards, setActiveDualityBlizzards] = useState<DualityBlizzardState[]>([]);

    const clearAll = useCallback(() => {
      setBossLeapShockwaves([]);
      setWarlockFlameStrikes([]);
      setWeaverLightningStrikes([]);
      setRoomBoomFlameStrikes([]);
      setRoomBoomFrostNovas([]);
      setActiveDualityBlizzards([]);
    }, []);

    const addBossLeapShockwave = useCallback((shockwave: BossLeapShockwaveState) => {
      setBossLeapShockwaves((prev) => [...prev, shockwave]);
    }, []);

    const addWarlockFlameStrike = useCallback((strike: WarlockFlameStrikeState) => {
      setWarlockFlameStrikes((prev) => [...prev, strike]);
    }, []);

    const addWeaverLightningStrike = useCallback((strike: WeaverLightningState) => {
      setWeaverLightningStrikes((prev) => [...prev, strike]);
    }, []);

    const addRoomBoomFlameStrike = useCallback((effect: RoomBoomFlameStrikeState) => {
      setRoomBoomFlameStrikes((prev) => [...prev, effect]);
    }, []);

    const addRoomBoomFrostNova = useCallback((effect: RoomBoomFrostNovaState) => {
      setRoomBoomFrostNovas((prev) => [...prev, effect]);
    }, []);

    const addDualityBlizzard = useCallback((storm: DualityBlizzardState) => {
      setActiveDualityBlizzards((prev) => [...prev, storm]);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addBossLeapShockwave,
      addWarlockFlameStrike,
      addWeaverLightningStrike,
      addRoomBoomFlameStrike,
      addRoomBoomFrostNova,
      addDualityBlizzard,
    }), [
      clearAll,
      addBossLeapShockwave,
      addWarlockFlameStrike,
      addWeaverLightningStrike,
      addRoomBoomFlameStrike,
      addRoomBoomFrostNova,
      addDualityBlizzard,
    ]);

    return (
      <>
        {warlockFlameStrikes.map((strike) => (
          <WarlockFlameStrike
            key={strike.id}
            position={strike.position}
            onComplete={() => setWarlockFlameStrikes((prev) => prev.filter((s) => s.id !== strike.id))}
          />
        ))}

        {weaverLightningStrikes.map((strike) => (
          <WeaverLightningStrike
            key={strike.id}
            targetPosition={strike.targetPosition}
            strikeAt={strike.strikeAt}
            damage={strike.damage}
            radius={strike.radius}
            theme={strike.theme}
            onImpact={(damage, position) => onWeaverLightningImpact(damage, position, strike)}
            onComplete={() => setWeaverLightningStrikes((prev) => prev.filter((s) => s.id !== strike.id))}
          />
        ))}

        {activeDualityBlizzards.map((storm) => (
          <Blizzard
            key={storm.id}
            position={storm.position}
            durationSeconds={storm.durationMs / 1000}
            flatDamagePerTick={ARCTIC_BLIZZARD_DAMAGE_PER_TICK}
            damageTickIntervalMs={storm.tickMs}
            hitRadius={storm.radius}
            visualPreset="concentrated"
            onComplete={() => {
              setActiveDualityBlizzards((prev) => prev.filter((s) => s.id !== storm.id));
            }}
          />
        ))}

        {bossLeapShockwaves.map((sw) => (
          <BossLeapShockwave
            key={sw.id}
            x={sw.x}
            z={sw.z}
            variant={sw.variant}
            onComplete={() => setBossLeapShockwaves((prev) => prev.filter((x) => x.id !== sw.id))}
          />
        ))}

        {roomBoomFlameStrikes.map((effect) => (
          <WarlockFlameStrike
            key={`room-boom-flame-${effect.id}`}
            position={effect.position}
            onComplete={() => setRoomBoomFlameStrikes((prev) => prev.filter((e) => e.id !== effect.id))}
          />
        ))}

        {roomBoomFrostNovas.map((effect) => (
          <FrostNova
            key={`room-boom-frost-${effect.id}`}
            position={effect.position}
            startTime={effect.startTime}
            duration={effect.duration}
            visualScale={0.5}
            onComplete={() => setRoomBoomFrostNovas((prev) => prev.filter((e) => e.id !== effect.id))}
          />
        ))}
      </>
    );
  },
));

CoopBossTelegraphLayer.displayName = 'CoopBossTelegraphLayer';

export default CoopBossTelegraphLayer;
