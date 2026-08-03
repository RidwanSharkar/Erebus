'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import GreedEmberPatch from '@/components/enemies/GreedEmberPatch';
import SabreReaperMistEffect from '@/components/weapons/SabreReaperMistEffect';
import type {
  DestinyEmberZoneState,
  GreedEmberZoneState,
  MistEffectState,
  WarlockMeteorEmberZoneState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopGroundHazardLayerHandle = {
  clearAll: () => void;
  addGreedEmberZone: (zone: GreedEmberZoneState) => void;
  removeEmberZone: (id: string) => void;
  addWarlockMeteorEmberZone: (zone: WarlockMeteorEmberZoneState) => void;
  removeWarlockEmberZone: (id: string) => void;
  addDestinyEmberZone: (zone: DestinyEmberZoneState) => void;
  removeDestinyEmberZone: (id: string) => void;
  addMistEffect: (effect: MistEffectState) => void;
  removeMistEffect: (id: string) => void;
};

const CoopGroundHazardLayer = memo(forwardRef<CoopGroundHazardLayerHandle, object>(
  function CoopGroundHazardLayer(_props, ref) {
    const [greedEmberZones, setGreedEmberZones] = useState<GreedEmberZoneState[]>([]);
    const [warlockMeteorEmberZones, setWarlockMeteorEmberZones] = useState<WarlockMeteorEmberZoneState[]>([]);
    const [destinyEmberZones, setDestinyEmberZones] = useState<DestinyEmberZoneState[]>([]);
    const [activeMistEffects, setActiveMistEffects] = useState<MistEffectState[]>([]);

    const clearAll = useCallback(() => {
      setGreedEmberZones([]);
      setWarlockMeteorEmberZones([]);
      setDestinyEmberZones([]);
      setActiveMistEffects([]);
    }, []);

    const addGreedEmberZone = useCallback((zone: GreedEmberZoneState) => {
      setGreedEmberZones((prev) => [...prev, zone]);
    }, []);

    const removeEmberZone = useCallback((id: string) => {
      setGreedEmberZones((prev) => prev.filter((z) => z.id !== id));
    }, []);

    const addWarlockMeteorEmberZone = useCallback((zone: WarlockMeteorEmberZoneState) => {
      setWarlockMeteorEmberZones((prev) => [...prev, zone]);
    }, []);

    const removeWarlockEmberZone = useCallback((id: string) => {
      setWarlockMeteorEmberZones((prev) => prev.filter((z) => z.id !== id));
    }, []);

    const addDestinyEmberZone = useCallback((zone: DestinyEmberZoneState) => {
      setDestinyEmberZones((prev) => [...prev, zone]);
    }, []);

    const removeDestinyEmberZone = useCallback((id: string) => {
      setDestinyEmberZones((prev) => prev.filter((z) => z.id !== id));
    }, []);

    const addMistEffect = useCallback((effect: MistEffectState) => {
      setActiveMistEffects((prev) => [...prev, effect]);
    }, []);

    const removeMistEffect = useCallback((id: string) => {
      setActiveMistEffects((prev) => prev.filter((effect) => effect.id !== id));
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addGreedEmberZone,
      removeEmberZone,
      addWarlockMeteorEmberZone,
      removeWarlockEmberZone,
      addDestinyEmberZone,
      removeDestinyEmberZone,
      addMistEffect,
      removeMistEffect,
    }), [
      clearAll,
      addGreedEmberZone,
      removeEmberZone,
      addWarlockMeteorEmberZone,
      removeWarlockEmberZone,
      addDestinyEmberZone,
      removeDestinyEmberZone,
      addMistEffect,
      removeMistEffect,
    ]);

    return (
      <>
        {greedEmberZones.map(zone => (
          <GreedEmberPatch
            key={zone.id}
            position={zone.position}
            radius={zone.radius}
            durationMs={zone.durationMs}
            onComplete={() => setGreedEmberZones(prev => prev.filter(z => z.id !== zone.id))}
          />
        ))}

        {warlockMeteorEmberZones.map(zone => (
          <GreedEmberPatch
            key={zone.id}
            variant="purple"
            position={zone.position}
            radius={zone.radius}
            durationMs={zone.durationMs}
            onComplete={() => setWarlockMeteorEmberZones(prev => prev.filter(z => z.id !== zone.id))}
          />
        ))}

        {destinyEmberZones.map(zone => (
          <GreedEmberPatch
            key={zone.id}
            variant="orange"
            position={zone.position}
            radius={zone.radius}
            durationMs={zone.durationMs}
            onComplete={() => setDestinyEmberZones(prev => prev.filter(z => z.id !== zone.id))}
          />
        ))}

        {activeMistEffects.map(effect => (
          <SabreReaperMistEffect
            key={effect.id}
            position={effect.position}
            duration={1000}
            color={effect.color}
            onComplete={() => {
              // Effect cleanup is handled by the setTimeout in the callback
            }}
          />
        ))}
      </>
    );
  },
));

CoopGroundHazardLayer.displayName = 'CoopGroundHazardLayer';

export default CoopGroundHazardLayer;
