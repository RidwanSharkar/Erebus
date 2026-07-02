'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import ShadeDaggerProjectile from '@/components/enemies/ShadeDaggerProjectile';
import WarlockProjectile from '@/components/enemies/WarlockProjectile';
import ViperArrowProjectile from '@/components/enemies/ViperArrowProjectile';
import KnightFrostProjectile from '@/components/enemies/KnightFrostProjectile';
import KnightDeathGraspProjectile from '@/components/enemies/KnightDeathGraspProjectile';
import GreedFireProjectile from '@/components/enemies/GreedFireProjectile';
import Meteor from '@/components/enemies/Meteor';
import CrossentropyMeteor from '@/components/projectiles/CrossentropyMeteor';
import CloudkillArrow from '@/components/projectiles/CloudkillArrow';
import BossSpearProjectile from '@/components/enemies/BossSpearProjectile';
import type {
  BossSpearState,
  CloudkillArrowState,
  CrossentropyMeteorState,
  GreedFireballState,
  KnightDeathGraspProjectileState,
  KnightFrostProjectileState,
  MeteorState,
  ShadeDaggerState,
  ViperArrowState,
  WarlockProjectileState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopProjectileLayerHandle = {
  clearAll: () => void;
  addShadeDagger: (dagger: ShadeDaggerState) => void;
  addMeteors: (meteors: MeteorState[]) => void;
  addBossSpear: (spear: BossSpearState) => void;
  addKnightFrostProjectile: (projectile: KnightFrostProjectileState) => void;
  addWarlockProjectile: (projectile: WarlockProjectileState) => void;
  addViperArrow: (arrow: ViperArrowState) => void;
  addKnightDeathGraspProjectile: (projectile: KnightDeathGraspProjectileState) => void;
  addKnightDeathGraspProjectiles: (projectiles: KnightDeathGraspProjectileState[]) => void;
  addGreedFireball: (fireball: GreedFireballState) => void;
  removeGreedFireballByGreedId: (greedId: string) => void;
  addCrossentropyMeteor: (meteor: CrossentropyMeteorState) => void;
  addCloudkillArrow: (arrow: CloudkillArrowState) => void;
};

type CoopProjectileLayerProps = {
  warlockOrbChargeMs: number;
  getLocalPlayerPosition: () => Vector3 | null;
  coopServerEnemyLiving: (enemyId: string) => boolean;
  onBossSpearHitPlayer: (damage: number, bossId: string) => void;
  onMeteorPlayerImpact: (damage: number, position: Vector3, sourceEnemyId?: string) => void;
};

const CoopProjectileLayer = memo(forwardRef<CoopProjectileLayerHandle, CoopProjectileLayerProps>(
  function CoopProjectileLayer({
    warlockOrbChargeMs,
    getLocalPlayerPosition,
    coopServerEnemyLiving,
    onBossSpearHitPlayer,
    onMeteorPlayerImpact,
  }, ref) {
    const [shadeDaggers, setShadeDaggers] = useState<ShadeDaggerState[]>([]);
    const [activeMeteors, setActiveMeteors] = useState<MeteorState[]>([]);
    const [bossSpears, setBossSpears] = useState<BossSpearState[]>([]);
    const [knightFrostProjectiles, setKnightFrostProjectiles] = useState<KnightFrostProjectileState[]>([]);
    const [warlockProjectiles, setWarlockProjectiles] = useState<WarlockProjectileState[]>([]);
    const [viperArrows, setViperArrows] = useState<ViperArrowState[]>([]);
    const [knightDeathGraspProjectiles, setKnightDeathGraspProjectiles] = useState<KnightDeathGraspProjectileState[]>([]);
    const [greedFireballs, setGreedFireballs] = useState<GreedFireballState[]>([]);
    const [activeCrossentropyMeteors, setActiveCrossentropyMeteors] = useState<CrossentropyMeteorState[]>([]);
    const [activeCloudkillArrows, setActiveCloudkillArrows] = useState<CloudkillArrowState[]>([]);

    const clearAll = useCallback(() => {
      setShadeDaggers([]);
      setActiveMeteors([]);
      setBossSpears([]);
      setKnightFrostProjectiles([]);
      setWarlockProjectiles([]);
      setViperArrows([]);
      setKnightDeathGraspProjectiles([]);
      setGreedFireballs([]);
      setActiveCrossentropyMeteors([]);
      setActiveCloudkillArrows([]);
    }, []);

    const addShadeDagger = useCallback((dagger: ShadeDaggerState) => {
      setShadeDaggers((prev) => [...prev, dagger]);
    }, []);

    const addMeteors = useCallback((meteors: MeteorState[]) => {
      setActiveMeteors((prev) => [...prev, ...meteors]);
    }, []);

    const addBossSpear = useCallback((spear: BossSpearState) => {
      setBossSpears((prev) => [...prev, spear]);
    }, []);

    const addKnightFrostProjectile = useCallback((projectile: KnightFrostProjectileState) => {
      setKnightFrostProjectiles((prev) => [...prev, projectile]);
    }, []);

    const addWarlockProjectile = useCallback((projectile: WarlockProjectileState) => {
      setWarlockProjectiles((prev) => [...prev, projectile]);
    }, []);

    const addViperArrow = useCallback((arrow: ViperArrowState) => {
      setViperArrows((prev) => [...prev, arrow]);
    }, []);

    const addKnightDeathGraspProjectile = useCallback((projectile: KnightDeathGraspProjectileState) => {
      setKnightDeathGraspProjectiles((prev) => [...prev, projectile]);
    }, []);

    const addKnightDeathGraspProjectiles = useCallback((projectiles: KnightDeathGraspProjectileState[]) => {
      setKnightDeathGraspProjectiles((prev) => [...prev, ...projectiles]);
    }, []);

    const addGreedFireball = useCallback((fireball: GreedFireballState) => {
      setGreedFireballs((prev) => [...prev, fireball]);
    }, []);

    const removeGreedFireballByGreedId = useCallback((greedId: string) => {
      setGreedFireballs((prev) => prev.filter((f) => f.greedId !== greedId));
    }, []);

    const addCrossentropyMeteor = useCallback((meteor: CrossentropyMeteorState) => {
      setActiveCrossentropyMeteors((prev) => [...prev, meteor]);
    }, []);

    const addCloudkillArrow = useCallback((arrow: CloudkillArrowState) => {
      setActiveCloudkillArrows((prev) => [...prev, arrow]);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addShadeDagger,
      addMeteors,
      addBossSpear,
      addKnightFrostProjectile,
      addWarlockProjectile,
      addViperArrow,
      addKnightDeathGraspProjectile,
      addKnightDeathGraspProjectiles,
      addGreedFireball,
      removeGreedFireballByGreedId,
      addCrossentropyMeteor,
      addCloudkillArrow,
    }), [
      clearAll,
      addShadeDagger,
      addMeteors,
      addBossSpear,
      addKnightFrostProjectile,
      addWarlockProjectile,
      addViperArrow,
      addKnightDeathGraspProjectile,
      addKnightDeathGraspProjectiles,
      addGreedFireball,
      removeGreedFireballByGreedId,
      addCrossentropyMeteor,
      addCloudkillArrow,
    ]);

    return (
      <>
        {knightFrostProjectiles.map((p) => (
          <KnightFrostProjectile
            key={p.id}
            startPosition={p.startPosition}
            endPosition={p.endPosition}
            travelMs={p.travelMs}
            onComplete={() => setKnightFrostProjectiles((prev) => prev.filter((x) => x.id !== p.id))}
          />
        ))}

        {knightDeathGraspProjectiles.map((p) => (
          <KnightDeathGraspProjectile
            key={p.id}
            startPosition={p.startPosition}
            endPosition={p.endPosition}
            travelMs={p.travelMs}
            onComplete={() => {
              setKnightDeathGraspProjectiles((prev) => prev.filter((x) => x.id !== p.id));
            }}
          />
        ))}

        {greedFireballs.map((fireball) => (
          <GreedFireProjectile
            key={fireball.id}
            startPosition={fireball.startPosition}
            targetPosition={fireball.targetPosition}
            onComplete={() => setGreedFireballs((prev) => prev.filter((f) => f.id !== fireball.id))}
          />
        ))}

        {activeCrossentropyMeteors.map((meteor) => (
          <CrossentropyMeteor
            key={meteor.id}
            targetPosition={meteor.targetPosition}
            timestamp={meteor.timestamp}
            damage={meteor.damage}
            startPosition={meteor.startPosition}
            onImpact={(_damage, _position) => {
              // Damage is server-authoritative; this render path is VFX-only.
            }}
            onComplete={() => {
              setActiveCrossentropyMeteors((prev) => prev.filter((m) => m.id !== meteor.id));
            }}
          />
        ))}

        {activeCloudkillArrows.map((arrow) => (
          <CloudkillArrow
            key={arrow.id}
            targetPosition={arrow.targetPosition}
            timestamp={arrow.timestamp}
            delayMs={arrow.delayMs}
            startPosition={arrow.startPosition}
            onComplete={() => {
              setActiveCloudkillArrows((prev) => prev.filter((a) => a.id !== arrow.id));
            }}
          />
        ))}

        {shadeDaggers.map((dagger) => (
          <ShadeDaggerProjectile
            key={dagger.id}
            startPosition={dagger.startPosition}
            targetPosition={dagger.targetPosition}
            damage={dagger.damage}
            soulType={dagger.soulType}
            getPlayerPosition={getLocalPlayerPosition}
            onHitPlayer={() => {
              // Damage, hit audio, and floating numbers are server-authoritative via `player-damaged`.
            }}
            onComplete={() => setShadeDaggers((prev) => prev.filter((d) => d.id !== dagger.id))}
          />
        ))}

        {warlockProjectiles.map((orb) => (
          <WarlockProjectile
            key={orb.id}
            startPosition={orb.startPosition}
            targetPosition={orb.targetPosition}
            damage={orb.damage}
            chargeDurationMs={warlockOrbChargeMs}
            isSourceEnemyLiving={() => coopServerEnemyLiving(orb.warlockId)}
            getPlayerPosition={getLocalPlayerPosition}
            onHitPlayer={() => {
              // Damage, hit audio, and floating numbers are server-authoritative via `player-damaged`.
            }}
            onComplete={() => setWarlockProjectiles((prev) => prev.filter((p) => p.id !== orb.id))}
          />
        ))}

        {viperArrows.map((arrow) => (
          <ViperArrowProjectile
            key={arrow.id}
            startPosition={arrow.startPosition}
            targetPosition={arrow.targetPosition}
            damage={arrow.damage}
            getPlayerPosition={getLocalPlayerPosition}
            onHitPlayer={() => {
              // Damage and hit/miss audio are server-authoritative via `player-damaged` and `viper-arrow-outcome`.
            }}
            onComplete={() => setViperArrows((prev) => prev.filter((a) => a.id !== arrow.id))}
          />
        ))}

        {activeMeteors.map((meteor) => (
          <Meteor
            key={meteor.id}
            targetPosition={meteor.targetPosition}
            timestamp={meteor.timestamp}
            damage={meteor.damage}
            startPosition={meteor.startPosition}
            onImpact={(damage, position) => {
              onMeteorPlayerImpact(damage, position, meteor.sourceEnemyId);
            }}
            onComplete={() => {
              setActiveMeteors((prev) => prev.filter((m) => m.id !== meteor.id));
            }}
          />
        ))}

        {bossSpears.map((spear) => (
          <BossSpearProjectile
            key={spear.id}
            startPosition={spear.startPosition}
            targetPosition={spear.targetPosition}
            damage={spear.damage}
            getPlayerPosition={getLocalPlayerPosition}
            onHitPlayer={() => onBossSpearHitPlayer(spear.damage, spear.bossId)}
            onComplete={() => setBossSpears((prev) => prev.filter((x) => x.id !== spear.id))}
          />
        ))}
      </>
    );
  },
));

CoopProjectileLayer.displayName = 'CoopProjectileLayer';

export default CoopProjectileLayer;
