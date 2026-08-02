'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import ShadeDaggerProjectile from '@/components/enemies/ShadeDaggerProjectile';
import WarlockProjectile from '@/components/enemies/WarlockProjectile';
import MedusaProjectile from '@/components/enemies/MedusaProjectile';
import ViperArrowProjectile from '@/components/enemies/ViperArrowProjectile';
import KnightFrostProjectile from '@/components/enemies/KnightFrostProjectile';
import KnightDeathGraspProjectile from '@/components/enemies/KnightDeathGraspProjectile';
import GreedFireProjectile from '@/components/enemies/GreedFireProjectile';
import SentinelVoidProjectile from '@/components/enemies/SentinelVoidProjectile';
import BoneSpiderEnsnaringShot from '@/components/enemies/BoneSpiderEnsnaringShot';
import EnchantressEarthShockProjectile from '@/components/enemies/EnchantressEarthShockProjectile';
import AlliedSpiderEnsnaringThreadsProjectile from '@/components/enemies/AlliedSpiderEnsnaringThreadsProjectile';
import Meteor from '@/components/enemies/Meteor';
import CrossentropyMeteor from '@/components/projectiles/CrossentropyMeteor';
import CloudkillArrow from '@/components/projectiles/CloudkillArrow';
import BossSpearProjectile from '@/components/enemies/BossSpearProjectile';
import type {
  BossSpearState,
  CloudkillArrowState,
  CrossentropyMeteorState,
  GreedFireballState,
  WyvernBreathFireboltState,
  DestinyBreathFireboltState,
  SentinelVoidOrbState,
  BoneSpiderEnsnaringShotState,
  EnchantressEarthShockState,
  AlliedSpiderEnsnaringThreadsState,
  KnightDeathGraspProjectileState,
  KnightFrostProjectileState,
  MeteorState,
  ShadeDaggerState,
  ViperArrowState,
  WarlockProjectileState,
  MedusaProjectileState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopProjectileLayerHandle = {
  clearAll: () => void;
  addShadeDagger: (dagger: ShadeDaggerState) => void;
  addMeteors: (meteors: MeteorState[]) => void;
  addBossSpear: (spear: BossSpearState) => void;
  addKnightFrostProjectile: (projectile: KnightFrostProjectileState) => void;
  addWarlockProjectile: (projectile: WarlockProjectileState) => void;
  addMedusaProjectile: (projectile: MedusaProjectileState) => void;
  addViperArrow: (arrow: ViperArrowState) => void;
  addKnightDeathGraspProjectile: (projectile: KnightDeathGraspProjectileState) => void;
  addKnightDeathGraspProjectiles: (projectiles: KnightDeathGraspProjectileState[]) => void;
  addGreedFireball: (fireball: GreedFireballState) => void;
  removeGreedFireballByGreedId: (greedId: string) => void;
  addWyvernBreathFirebolt: (firebolt: WyvernBreathFireboltState) => void;
  removeWyvernBreathFireboltByWyvernId: (wyvernId: string) => void;
  removeWyvernBreathFireboltById: (fireboltId: string) => void;
  addDestinyBreathFirebolt: (firebolt: DestinyBreathFireboltState) => void;
  removeDestinyBreathFireboltByDestinyId: (destinyId: string) => void;
  removeDestinyBreathFireboltById: (fireboltId: string) => void;
  addSentinelVoidOrb: (orb: SentinelVoidOrbState) => void;
  removeSentinelVoidOrbBySentinelId: (sentinelId: string) => void;
  addBoneSpiderEnsnaringShot: (shot: BoneSpiderEnsnaringShotState) => void;
  removeBoneSpiderEnsnaringShotBySpiderId: (spiderId: string) => void;
  addEnchantressEarthShock: (projectile: EnchantressEarthShockState) => void;
  removeEnchantressEarthShockByEnchantressId: (enchantressId: string) => void;
  addAlliedSpiderEnsnaringThreads: (projectile: AlliedSpiderEnsnaringThreadsState) => void;
  removeAlliedSpiderEnsnaringThreadsBySpiderId: (spiderId: string) => void;
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
    const [medusaProjectiles, setMedusaProjectiles] = useState<MedusaProjectileState[]>([]);
    const [viperArrows, setViperArrows] = useState<ViperArrowState[]>([]);
    const [knightDeathGraspProjectiles, setKnightDeathGraspProjectiles] = useState<KnightDeathGraspProjectileState[]>([]);
    const [greedFireballs, setGreedFireballs] = useState<GreedFireballState[]>([]);
    const [wyvernBreathFirebolts, setWyvernBreathFirebolts] = useState<WyvernBreathFireboltState[]>([]);
    const [destinyBreathFirebolts, setDestinyBreathFirebolts] = useState<DestinyBreathFireboltState[]>([]);
    const [sentinelVoidOrbs, setSentinelVoidOrbs] = useState<SentinelVoidOrbState[]>([]);
    const [boneSpiderEnsnaringShots, setBoneSpiderEnsnaringShots] = useState<BoneSpiderEnsnaringShotState[]>([]);
    const [enchantressEarthShocks, setEnchantressEarthShocks] = useState<EnchantressEarthShockState[]>([]);
    const [alliedSpiderEnsnaringThreads, setAlliedSpiderEnsnaringThreads] = useState<AlliedSpiderEnsnaringThreadsState[]>([]);
    const [activeCrossentropyMeteors, setActiveCrossentropyMeteors] = useState<CrossentropyMeteorState[]>([]);
    const [activeCloudkillArrows, setActiveCloudkillArrows] = useState<CloudkillArrowState[]>([]);

    const clearAll = useCallback(() => {
      setShadeDaggers([]);
      setActiveMeteors([]);
      setBossSpears([]);
      setKnightFrostProjectiles([]);
      setWarlockProjectiles([]);
      setMedusaProjectiles([]);
      setViperArrows([]);
      setKnightDeathGraspProjectiles([]);
      setGreedFireballs([]);
      setWyvernBreathFirebolts([]);
      setDestinyBreathFirebolts([]);
      setSentinelVoidOrbs([]);
      setBoneSpiderEnsnaringShots([]);
      setEnchantressEarthShocks([]);
      setAlliedSpiderEnsnaringThreads([]);
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

    const addMedusaProjectile = useCallback((projectile: MedusaProjectileState) => {
      setMedusaProjectiles((prev) => [...prev, projectile]);
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

    const addWyvernBreathFirebolt = useCallback((firebolt: WyvernBreathFireboltState) => {
      setWyvernBreathFirebolts((prev) => [...prev, firebolt]);
    }, []);

    const removeWyvernBreathFireboltByWyvernId = useCallback((wyvernId: string) => {
      setWyvernBreathFirebolts((prev) => prev.filter((f) => f.wyvernId !== wyvernId));
    }, []);

    const removeWyvernBreathFireboltById = useCallback((fireboltId: string) => {
      setWyvernBreathFirebolts((prev) => prev.filter((f) => f.id !== fireboltId));
    }, []);

    const addDestinyBreathFirebolt = useCallback((firebolt: DestinyBreathFireboltState) => {
      setDestinyBreathFirebolts((prev) => [...prev, firebolt]);
    }, []);

    const removeDestinyBreathFireboltByDestinyId = useCallback((destinyId: string) => {
      setDestinyBreathFirebolts((prev) => prev.filter((f) => f.destinyId !== destinyId));
    }, []);

    const removeDestinyBreathFireboltById = useCallback((fireboltId: string) => {
      setDestinyBreathFirebolts((prev) => prev.filter((f) => f.id !== fireboltId));
    }, []);

    const addSentinelVoidOrb = useCallback((orb: SentinelVoidOrbState) => {
      setSentinelVoidOrbs((prev) => [...prev, orb]);
    }, []);

    const removeSentinelVoidOrbBySentinelId = useCallback((sentinelId: string) => {
      setSentinelVoidOrbs((prev) => prev.filter((o) => o.sentinelId !== sentinelId));
    }, []);

    const addBoneSpiderEnsnaringShot = useCallback((shot: BoneSpiderEnsnaringShotState) => {
      setBoneSpiderEnsnaringShots((prev) => [...prev, shot]);
    }, []);

    const removeBoneSpiderEnsnaringShotBySpiderId = useCallback((spiderId: string) => {
      setBoneSpiderEnsnaringShots((prev) => prev.filter((s) => s.spiderId !== spiderId));
    }, []);

    const addEnchantressEarthShock = useCallback((projectile: EnchantressEarthShockState) => {
      setEnchantressEarthShocks((prev) => [...prev, projectile]);
    }, []);

    const removeEnchantressEarthShockByEnchantressId = useCallback((enchantressId: string) => {
      setEnchantressEarthShocks((prev) => prev.filter((p) => p.enchantressId !== enchantressId));
    }, []);

    const addAlliedSpiderEnsnaringThreads = useCallback((projectile: AlliedSpiderEnsnaringThreadsState) => {
      setAlliedSpiderEnsnaringThreads((prev) => [...prev, projectile]);
    }, []);

    const removeAlliedSpiderEnsnaringThreadsBySpiderId = useCallback((spiderId: string) => {
      setAlliedSpiderEnsnaringThreads((prev) => prev.filter((p) => p.spiderId !== spiderId));
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
      addMedusaProjectile,
      addViperArrow,
      addKnightDeathGraspProjectile,
      addKnightDeathGraspProjectiles,
      addGreedFireball,
      removeGreedFireballByGreedId,
      addWyvernBreathFirebolt,
      removeWyvernBreathFireboltByWyvernId,
      removeWyvernBreathFireboltById,
      addDestinyBreathFirebolt,
      removeDestinyBreathFireboltByDestinyId,
      removeDestinyBreathFireboltById,
      addSentinelVoidOrb,
      removeSentinelVoidOrbBySentinelId,
      addBoneSpiderEnsnaringShot,
      removeBoneSpiderEnsnaringShotBySpiderId,
      addEnchantressEarthShock,
      removeEnchantressEarthShockByEnchantressId,
      addAlliedSpiderEnsnaringThreads,
      removeAlliedSpiderEnsnaringThreadsBySpiderId,
      addCrossentropyMeteor,
      addCloudkillArrow,
    }), [
      clearAll,
      addShadeDagger,
      addMeteors,
      addBossSpear,
      addKnightFrostProjectile,
      addWarlockProjectile,
      addMedusaProjectile,
      addViperArrow,
      addKnightDeathGraspProjectile,
      addKnightDeathGraspProjectiles,
      addGreedFireball,
      removeGreedFireballByGreedId,
      addWyvernBreathFirebolt,
      removeWyvernBreathFireboltByWyvernId,
      removeWyvernBreathFireboltById,
      addDestinyBreathFirebolt,
      removeDestinyBreathFireboltByDestinyId,
      removeDestinyBreathFireboltById,
      addSentinelVoidOrb,
      removeSentinelVoidOrbBySentinelId,
      addBoneSpiderEnsnaringShot,
      removeBoneSpiderEnsnaringShotBySpiderId,
      addEnchantressEarthShock,
      removeEnchantressEarthShockByEnchantressId,
      addAlliedSpiderEnsnaringThreads,
      removeAlliedSpiderEnsnaringThreadsBySpiderId,
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

        {wyvernBreathFirebolts.map((firebolt) => (
          <GreedFireProjectile
            key={firebolt.id}
            startPosition={firebolt.startPosition}
            targetPosition={firebolt.targetPosition}
            onComplete={() => setWyvernBreathFirebolts((prev) => prev.filter((f) => f.id !== firebolt.id))}
          />
        ))}

        {destinyBreathFirebolts.map((firebolt) => (
          <GreedFireProjectile
            key={firebolt.id}
            startPosition={firebolt.startPosition}
            targetPosition={firebolt.targetPosition}
            fromAir={firebolt.fromAir}
            onComplete={() => setDestinyBreathFirebolts((prev) => prev.filter((f) => f.id !== firebolt.id))}
          />
        ))}

        {sentinelVoidOrbs.map((orb) => (
          <SentinelVoidProjectile
            key={orb.id}
            startPosition={orb.startPosition}
            targetPosition={orb.targetPosition}
            onComplete={() => setSentinelVoidOrbs((prev) => prev.filter((o) => o.id !== orb.id))}
          />
        ))}

        {boneSpiderEnsnaringShots.map((shot) => (
          <BoneSpiderEnsnaringShot
            key={shot.id}
            startPosition={shot.startPosition}
            targetPosition={shot.targetPosition}
            onComplete={() => setBoneSpiderEnsnaringShots((prev) => prev.filter((s) => s.id !== shot.id))}
          />
        ))}

        {enchantressEarthShocks.map((projectile) => (
          <EnchantressEarthShockProjectile
            key={projectile.id}
            startPosition={projectile.startPosition}
            targetPosition={projectile.targetPosition}
            onComplete={() => setEnchantressEarthShocks((prev) => prev.filter((p) => p.id !== projectile.id))}
          />
        ))}

        {alliedSpiderEnsnaringThreads.map((projectile) => (
          <AlliedSpiderEnsnaringThreadsProjectile
            key={projectile.id}
            startPosition={projectile.startPosition}
            targetPosition={projectile.targetPosition}
            onComplete={() => setAlliedSpiderEnsnaringThreads((prev) => prev.filter((p) => p.id !== projectile.id))}
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

        {medusaProjectiles.map((bolt) => (
          <MedusaProjectile
            key={bolt.id}
            startPosition={bolt.startPosition}
            targetPosition={bolt.targetPosition}
            damage={bolt.damage}
            getPlayerPosition={getLocalPlayerPosition}
            onHitPlayer={() => {
              // Damage is server-authoritative via `player-damaged`.
            }}
            onComplete={() => setMedusaProjectiles((prev) => prev.filter((p) => p.id !== bolt.id))}
          />
        ))}

        {viperArrows.map((arrow) => (
          <ViperArrowProjectile
            key={arrow.id}
            startPosition={arrow.startPosition}
            targetPosition={arrow.targetPosition}
            damage={arrow.damage}
            maxRange={arrow.maxRange}
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
