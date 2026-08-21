'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Enemy } from '@/contexts/MultiplayerContext';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { useRelayDefenseTowerAttacks } from '@/utils/exploreTowerAttackBus';
import KnightRenderer from '@/components/enemies/KnightRenderer';
import GhoulRenderer from '@/components/enemies/GhoulRenderer';
import WarlockRenderer from '@/components/enemies/WarlockRenderer';
import ViperRenderer from '@/components/enemies/ViperRenderer';
import WeaverRenderer from '@/components/enemies/WeaverRenderer';
import ShadeRenderer from '@/components/enemies/ShadeRenderer';
import TemplarRenderer from '@/components/enemies/TemplarRenderer';
import TitanRenderer from '@/components/enemies/TitanRenderer';
import GreedRenderer from '@/components/enemies/GreedRenderer';
import MartyrRenderer from '@/components/enemies/MartyrRenderer';
import WraithRenderer from '@/components/enemies/WraithRenderer';
import SpectreRenderer from '@/components/enemies/SpectreRenderer';
import DeathKnightRenderer from '@/components/enemies/DeathKnightRenderer';
import ShamanRenderer from '@/components/enemies/ShamanRenderer';
import AssassinRenderer from '@/components/enemies/AssassinRenderer';
import SerpentRenderer from '@/components/enemies/SerpentRenderer';
import FrostQueenRenderer from '@/components/enemies/FrostQueenRenderer';
import MedusaRenderer from '@/components/enemies/MedusaRenderer';
import WyvernRenderer from '@/components/enemies/WyvernRenderer';
import TerrorhawkRenderer from '@/components/enemies/TerrorhawkRenderer';
import EnemyTigerRenderer from '@/components/enemies/EnemyTigerRenderer';
import WolfRenderer from '@/components/enemies/WolfRenderer';
import BearRenderer from '@/components/enemies/BearRenderer';
import SkyRayRenderer from '@/components/enemies/SkyRayRenderer';
import BoneSpiderRenderer from '@/components/enemies/BoneSpiderRenderer';
import SentinelRenderer from '@/components/enemies/SentinelRenderer';
import NemesisRenderer from '@/components/enemies/NemesisRenderer';
import StoneGiantRenderer from '@/components/enemies/StoneGiantRenderer';
import EternalOakRenderer from '@/components/enemies/EternalOakRenderer';
import ColossusRenderer from '@/components/enemies/ColossusRenderer';
import ValkyrieRenderer from '@/components/enemies/ValkyrieRenderer';
import ZombieRenderer from '@/components/enemies/ZombieRenderer';
import VengefulSpiritRenderer from '@/components/enemies/VengefulSpiritRenderer';
import AlliedKnightRenderer from '@/components/enemies/AlliedKnightRenderer';
import AlliedHealerRenderer from '@/components/enemies/AlliedHealerRenderer';
import DefenseTowerRenderer from '@/components/enemies/DefenseTowerRenderer';
import WatchTowerRenderer from '@/components/enemies/WatchTowerRenderer';
import SiegeTowerRenderer from '@/components/enemies/SiegeTowerRenderer';
import FirePitRenderer from '@/components/enemies/FirePitRenderer';
import BarracksRenderer from '@/components/enemies/BarracksRenderer';
import ResearchStationRenderer from '@/components/enemies/ResearchStationRenderer';
import ShrineRenderer from '@/components/enemies/ShrineRenderer';
import ObeliskRenderer from '@/components/enemies/ObeliskRenderer';
import ShieldBatteryRenderer from '@/components/enemies/ShieldBatteryRenderer';
import CathedralRenderer from '@/components/enemies/CathedralRenderer';
import ExploreInstancedBuildingGlb from '@/components/environment/ExploreInstancedBuildingGlb';
import {
  SPIRIT_LOUNGE_PATH,
  SPIRIT_LOUNGE_MODEL_SCALE,
  SPIRIT_LOUNGE_MODEL_Y,
} from '@/components/environment/SpiritLounge';
import {
  RESEARCH_STATION_PATH,
  RESEARCH_STATION_MODEL_SCALE,
  RESEARCH_STATION_MODEL_Y,
} from '@/components/environment/ResearchStation';
import AlliedHuntressRenderer from '@/components/enemies/AlliedHuntressRenderer';
import AlliedPhantomRenderer from '@/components/enemies/AlliedPhantomRenderer';
import AlliedDemonRenderer from '@/components/enemies/AlliedDemonRenderer';
import AlliedEnchantressRenderer from '@/components/enemies/AlliedEnchantressRenderer';
import AlliedTigerRenderer from '@/components/enemies/AlliedTigerRenderer';
import AlliedWolfRenderer from '@/components/enemies/AlliedWolfRenderer';
import AlliedBearRenderer from '@/components/enemies/AlliedBearRenderer';
import AlliedSerpentRenderer from '@/components/enemies/AlliedSerpentRenderer';
import AlliedSpiderRenderer from '@/components/enemies/AlliedSpiderRenderer';
import SummonedBossSkeleton from '@/components/enemies/SummonedBossSkeleton';

type CoopEnemyRenderLayerProps = {
  enemiesByType: Map<string, Enemy[]>;
  isCoopEnemyVisibleForRender: (x: number, z: number, type?: string) => boolean;
  playerPositionRef?: React.MutableRefObject<{ x: number; z: number }>;
  cullOnMove?: boolean;
};

const DEATH_VISUAL_LINGER_MS = 1000;

/** Keep dying enemies mounted briefly so death GLB clips can play before dispose. */
function useCoopEnemyDeathLinger(enemiesByType: Map<string, Enemy[]>) {
  const deathStartByIdRef = useRef<Map<string, number>>(new Map());
  const lingerTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [expiredDeathIds, setExpiredDeathIds] = useState<Set<string>>(() => new Set());

  const allEnemies = useMemo(
    () => Array.from(enemiesByType.values()).flat(),
    [enemiesByType],
  );

  useEffect(() => {
    const currentIds = new Set(allEnemies.map((enemy) => enemy.id));

    lingerTimersRef.current.forEach((timer, enemyId) => {
      if (currentIds.has(enemyId)) return;
      clearTimeout(timer);
      lingerTimersRef.current.delete(enemyId);
      deathStartByIdRef.current.delete(enemyId);
      setExpiredDeathIds((prev) => {
        if (!prev.has(enemyId)) return prev;
        const next = new Set(prev);
        next.delete(enemyId);
        return next;
      });
    });

    for (const enemy of allEnemies) {
      if (enemy.type === 'training-dummy') continue;
      if (!enemy.isDying) continue;
      if (deathStartByIdRef.current.has(enemy.id)) continue;

      deathStartByIdRef.current.set(enemy.id, Date.now());
      const timer = setTimeout(() => {
        lingerTimersRef.current.delete(enemy.id);
        setExpiredDeathIds((prev) => {
          const next = new Set(prev);
          next.add(enemy.id);
          return next;
        });
      }, DEATH_VISUAL_LINGER_MS);
      lingerTimersRef.current.set(enemy.id, timer);
    }
  }, [allEnemies]);

  useEffect(() => {
    return () => {
      lingerTimersRef.current.forEach((timer) => {
        clearTimeout(timer);
      });
      lingerTimersRef.current.clear();
      deathStartByIdRef.current.clear();
    };
  }, []);

  return useCallback(
    (enemy: Enemy): boolean => {
      if (enemy.type === 'training-dummy') return true;
      if (!enemy.isDying) return true;
      return !expiredDeathIds.has(enemy.id);
    },
    [expiredDeathIds],
  );
}

/** Memoized enemy roster — skips re-render when unrelated room UI state changes. */
const EXPLORE_BUILDING_CULL_STEP2 = 8 * 8;

const CoopEnemyRenderLayer = memo(function CoopEnemyRenderLayer({
  enemiesByType,
  isCoopEnemyVisibleForRender,
  playerPositionRef,
  cullOnMove = false,
}: CoopEnemyRenderLayerProps) {
  const { socket } = useMultiplayerActions();
  useRelayDefenseTowerAttacks(socket);
  const shouldRenderCoopEnemy = useCoopEnemyDeathLinger(enemiesByType);
  const lastCullX = useRef(Number.POSITIVE_INFINITY);
  const lastCullZ = useRef(Number.POSITIVE_INFINITY);
  const [, setCullTick] = useState(0);

  useFrame(() => {
    if (!cullOnMove || !playerPositionRef) return;
    const pos = playerPositionRef.current;
    if (!pos) return;
    const dx = pos.x - lastCullX.current;
    const dz = pos.z - lastCullZ.current;
    if (dx * dx + dz * dz < EXPLORE_BUILDING_CULL_STEP2) return;
    lastCullX.current = pos.x;
    lastCullZ.current = pos.z;
    setCullTick((n) => n + 1);
  });

  const isVisible = (enemy: Enemy) =>
    isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z, enemy.type);

  const barracksPlacements: { x: number; z: number; rotY: number }[] = [];
  const researchPlacements: { x: number; z: number; rotY: number }[] = [];
  for (const e of enemiesByType.get('barracks') ?? []) {
    if (!shouldRenderCoopEnemy(e) || !isVisible(e) || e.isDying) continue;
    barracksPlacements.push({ x: e.position.x, z: e.position.z, rotY: e.rotation || 0 });
  }
  for (const e of enemiesByType.get('research-station') ?? []) {
    if (!shouldRenderCoopEnemy(e) || !isVisible(e) || e.isDying) continue;
    researchPlacements.push({ x: e.position.x, z: e.position.z, rotY: e.rotation || 0 });
  }

  return (
    <>
      <ExploreInstancedBuildingGlb
        url={SPIRIT_LOUNGE_PATH}
        scale={SPIRIT_LOUNGE_MODEL_SCALE}
        modelY={SPIRIT_LOUNGE_MODEL_Y}
        placements={barracksPlacements}
      />
      <ExploreInstancedBuildingGlb
        url={RESEARCH_STATION_PATH}
        scale={RESEARCH_STATION_MODEL_SCALE}
        modelY={RESEARCH_STATION_MODEL_Y}
        placements={researchPlacements}
      />

      {(enemiesByType.get('boss-skeleton') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <SummonedBossSkeleton
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
          />
        );
      })}

      {(enemiesByType.get('knight') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <KnightRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            soulType={enemy.soulType as 'green' | 'red' | 'blue' | 'purple' | undefined}
            campType={enemy.campType}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            visualScale={enemy.visualScale ?? 1}
            castShadow={false}
            impactHitReactMode="enemy"
          />
        );
      })}

      {(enemiesByType.get('training-dummy') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <KnightRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={false}
            soulType="yellow"
            campType="yellow"
            showMeleeRangeRing={false}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            impactHitReactMode="training-dummy"
          />
        );
      })}

      {(enemiesByType.get('allied-knight') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <AlliedKnightRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            alliedOrbSlots={enemy.alliedOrbSlots}
            fastWalk={enemy.abyssalBoonApplied}
          />
        );
      })}

      {(enemiesByType.get('allied-healer') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <AlliedHealerRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            alliedOrbSlots={enemy.alliedOrbSlots}
          />
        );
      })}

      {(enemiesByType.get('allied-tower') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <DefenseTowerRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
          />
        );
      })}

      {(enemiesByType.get('fire-pit') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <FirePitRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
          />
        );
      })}

      {(enemiesByType.get('barracks') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <BarracksRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
            hideMesh={!enemy.isDying}
          />
        );
      })}

      {(enemiesByType.get('tower') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <DefenseTowerRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
          />
        );
      })}

      {(enemiesByType.get('watch-tower') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <WatchTowerRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
          />
        );
      })}

      {(enemiesByType.get('siege-tower') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <SiegeTowerRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
          />
        );
      })}

      {(enemiesByType.get('research-station') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <ResearchStationRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
            hideMesh={!enemy.isDying}
          />
        );
      })}

      {(enemiesByType.get('shrine') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <ShrineRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
            shrineUsed={enemy.shrineUsed === true}
          />
        );
      })}

      {(enemiesByType.get('obelisk') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <ObeliskRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
          />
        );
      })}

      {(enemiesByType.get('shield-battery') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <ShieldBatteryRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
          />
        );
      })}

      {(enemiesByType.get('cathedral') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <CathedralRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            powered={enemy.powered !== false}
            cathedralUsed={enemy.cathedralUsed === true}
          />
        );
      })}

      {(enemiesByType.get('allied-huntress') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedHuntressRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('allied-phantom') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedPhantomRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('allied-demon') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedDemonRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('allied-tiger') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedTigerRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              tigerLocomotion={enemy.tigerLocomotion === 'run' ? 'run' : 'walk'}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('allied-wolf') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedWolfRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              visualScale={enemy.visualScale ?? 1}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('allied-bear') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedBearRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              visualScale={enemy.visualScale ?? 1}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('allied-serpent') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedSerpentRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              visualScale={enemy.visualScale ?? 0.5}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('allied-spider') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedSpiderRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              visualScale={enemy.visualScale ?? 0.33}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('allied-enchantress') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AlliedEnchantressRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('shade') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <ShadeRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            campType={enemy.campType}
            soulType={enemy.soulType}
            staggerBuildup={enemy.staggerBuildup ?? 0}
          />
        );
      })}

      {(enemiesByType.get('warlock') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <WarlockRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              soulType={enemy.soulType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('templar') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <TemplarRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('viper') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <ViperRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('weaver') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <WeaverRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            campType={enemy.campType}
            soulType={enemy.soulType}
            staggerBuildup={enemy.staggerBuildup ?? 0}
          />
        );
      })}

      {(enemiesByType.get('ghoul') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <GhoulRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            visualScale={enemy.visualScale ?? 1}
          />
        );
      })}

      {(enemiesByType.get('titan') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <TitanRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              soulType={enemy.soulType as 'green' | 'red' | 'blue' | 'purple' | undefined}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              bladestormActive={enemy.bladestormActive}
              bladestormStartTime={enemy.bladestormStartTime}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('spectre') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <SpectreRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('death-knight') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <DeathKnightRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('shaman') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <ShamanRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('assassin') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <AssassinRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('serpent') ?? []).concat(enemiesByType.get('boss-serpent') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <SerpentRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              visualScale={enemy.visualScale ?? 1}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('frost-queen') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <FrostQueenRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('medusa') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <MedusaRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('wyvern') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <WyvernRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('terrorhawk') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <TerrorhawkRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              terrorhawkPhase={enemy.terrorhawkPhase}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('tiger') ?? []).concat(enemiesByType.get('boss-tiger') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <EnemyTigerRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              soulType={enemy.soulType as 'yellow' | 'green' | 'red' | 'blue' | 'purple' | 'orange' | undefined}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              tigerLocomotion={enemy.tigerLocomotion === 'run' ? 'run' : 'walk'}
              visualScale={enemy.visualScale ?? 1}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('wolf') ?? []).concat(enemiesByType.get('boss-wolf') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <WolfRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              visualScale={enemy.visualScale ?? 1}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('bear') ?? []).concat(enemiesByType.get('boss-bear') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <BearRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              visualScale={enemy.visualScale ?? 1}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('skyray') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <SkyRayRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('bone-spider') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <BoneSpiderRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('sentinel') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <SentinelRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('nemesis') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <NemesisRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('stone-giant') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <StoneGiantRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('eternal-oak') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <EternalOakRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('colossus') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <ColossusRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('valkyrie') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <ValkyrieRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              campType={enemy.campType}
              staggerBuildup={enemy.staggerBuildup ?? 0}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('greed') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <React.Suspense key={enemy.id} fallback={null}>
            <GreedRenderer
              id={enemy.id}
              position={enemy.position}
              rotation={enemy.rotation || 0}
              health={enemy.health}
              maxHealth={enemy.maxHealth}
              isDying={enemy.isDying}
              staggerBuildup={enemy.staggerBuildup ?? 0}
              soulType={enemy.soulType as 'green' | 'red' | 'blue' | 'purple' | undefined}
            />
          </React.Suspense>
        );
      })}

      {(enemiesByType.get('martyr') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <MartyrRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
          />
        );
      })}

      {(enemiesByType.get('wraith') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <WraithRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            campType={enemy.campType}
            staggerBuildup={enemy.staggerBuildup ?? 0}
          />
        );
      })}

      {(enemiesByType.get('player-zombie') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <ZombieRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            health={enemy.health}
            maxHealth={enemy.maxHealth}
            isDying={enemy.isDying}
            staggerBuildup={enemy.staggerBuildup ?? 0}
            visualScale={enemy.zombieVariant === 'juggernaut' ? 1.45 : 1}
          />
        );
      })}

      {(enemiesByType.get('vengeful-spirit') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isVisible(enemy)) return null;
        return (
          <VengefulSpiritRenderer
            key={enemy.id}
            id={enemy.id}
            position={enemy.position}
            rotation={enemy.rotation || 0}
            isDying={enemy.isDying}
            visualScale={enemy.visualScale ?? 1}
          />
        );
      })}
    </>
  );
});

export default CoopEnemyRenderLayer;
