'use client';

import React, {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import BowShotImpact from '@/components/weapons/BowShotImpact';
import EntropicBoltImpact from '@/components/weapons/EntropicBoltImpact';
import SabreImpactEffect from '@/components/weapons/SabreImpactEffect';
import CrescentSlashEffect from '@/components/weapons/CrescentSlashEffect';
import MortalStrikeEffect from '@/components/weapons/MortalStrikeEffect';
import PsionicBladeSliceEffect from '@/components/weapons/PsionicBladeSliceEffect';
import PlayerHitBurst from '@/components/weapons/PlayerHitBurst';
import type { ImpactEffectEvent } from '@/utils/ImpactEffectManager';
import type { PlayerHitBurstState } from '@/components/coop/coopVfxLayerTypes';
import type { World } from '@/ecs/World';

export type CoopCombatFeedbackLayerHandle = {
  clearAll: () => void;
  addPlayerHitBurst: (burst: PlayerHitBurstState) => void;
  addImpacts: (events: ImpactEffectEvent[]) => void;
  flushPendingImpacts: () => boolean;
  removeImpact: (id: string) => void;
  mountImpacts: () => void;
};

type CoopCombatFeedbackLayerProps = {
  world: World | null;
};

const CoopCombatFeedbackLayer = memo(forwardRef<CoopCombatFeedbackLayerHandle, CoopCombatFeedbackLayerProps>(
  function CoopCombatFeedbackLayer({ world }, ref) {
    const [playerHitBursts, setPlayerHitBursts] = useState<PlayerHitBurstState[]>([]);
    const [impactEffectsEpoch, setImpactEffectsEpoch] = useState(0);
    const impactEffectsListRef = useRef<ImpactEffectEvent[]>([]);
    const pendingImpactEffectsRef = useRef<ImpactEffectEvent[]>([]);
    const lastImpactEffectsMountRef = useRef(0);

    const impactEffectsSnapshot = useMemo(
      () => [...impactEffectsListRef.current],
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [impactEffectsEpoch],
    );

    const clearAll = useCallback(() => {
      setPlayerHitBursts([]);
      impactEffectsListRef.current = [];
      pendingImpactEffectsRef.current = [];
      lastImpactEffectsMountRef.current = 0;
      setImpactEffectsEpoch((epoch) => epoch + 1);
    }, []);

    const addPlayerHitBurst = useCallback((burst: PlayerHitBurstState) => {
      setPlayerHitBursts((prev) => [...prev, burst]);
    }, []);

    const addImpacts = useCallback((events: ImpactEffectEvent[]) => {
      if (events.length === 0) return;
      pendingImpactEffectsRef.current.push(...events);
    }, []);

    const flushPendingImpacts = useCallback(() => {
      if (pendingImpactEffectsRef.current.length === 0) return false;
      impactEffectsListRef.current.push(...pendingImpactEffectsRef.current);
      pendingImpactEffectsRef.current = [];
      return true;
    }, []);

    const removeImpact = useCallback((id: string) => {
      impactEffectsListRef.current = impactEffectsListRef.current.filter((x) => x.id !== id);
      setImpactEffectsEpoch((epoch) => epoch + 1);
    }, []);

    const mountImpacts = useCallback(() => {
      const now = Date.now();
      if (now - lastImpactEffectsMountRef.current <= 100) return;
      lastImpactEffectsMountRef.current = now;
      setImpactEffectsEpoch((epoch) => epoch + 1);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addPlayerHitBurst,
      addImpacts,
      flushPendingImpacts,
      removeImpact,
      mountImpacts,
    }), [
      clearAll,
      addPlayerHitBurst,
      addImpacts,
      flushPendingImpacts,
      removeImpact,
      mountImpacts,
    ]);

    return (
      <>
        {playerHitBursts.map((burst) => (
          <PlayerHitBurst
            key={burst.id}
            position={burst.position}
            damageType={burst.damageType}
            intensity={burst.intensity}
            onComplete={() => setPlayerHitBursts((prev) => prev.filter((x) => x.id !== burst.id))}
          />
        ))}

        {impactEffectsSnapshot.map((e) => {
          const onImpactDone = () => {
            removeImpact(e.id);
          };
          if (e.type === 'bow-shot-impact') {
            return (
              <BowShotImpact
                key={e.id}
                position={e.position}
                direction={e.direction}
                onComplete={onImpactDone}
              />
            );
          }
          if (e.type === 'sabre-impact-effect') {
            return (
              <SabreImpactEffect
                key={e.id}
                position={e.position}
                direction={e.direction}
                onComplete={onImpactDone}
              />
            );
          }
          if (e.type === 'crescent-slash-effect') {
            return (
              <CrescentSlashEffect
                key={e.id}
                position={e.position}
                direction={e.direction}
                onComplete={onImpactDone}
              />
            );
          }
          if (e.type === 'mortal-strike-effect') {
            return (
              <MortalStrikeEffect
                key={e.id}
                position={e.position}
                direction={e.direction}
                theme={e.colorVariant}
                onComplete={onImpactDone}
              />
            );
          }
          if (e.type === 'psionic-blade-slice' && e.enemyEntityId && world) {
            return (
              <PsionicBladeSliceEffect
                key={e.id}
                enemyEntityId={e.enemyEntityId}
                direction={e.direction}
                bladeSide={e.bladeSide}
                world={world}
                onComplete={onImpactDone}
              />
            );
          }
          return (
            <EntropicBoltImpact
              key={e.id}
              position={e.position}
              direction={e.direction}
              colorVariant={e.colorVariant}
              isCryoflame={e.isCryoflame}
              onComplete={onImpactDone}
            />
          );
        })}
      </>
    );
  },
));

CoopCombatFeedbackLayer.displayName = 'CoopCombatFeedbackLayer';

export default CoopCombatFeedbackLayer;
