'use client';

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Enemy } from '@/contexts/MultiplayerContext';
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
import SentinelRenderer from '@/components/enemies/SentinelRenderer';
import NemesisRenderer from '@/components/enemies/NemesisRenderer';
import ValkyrieRenderer from '@/components/enemies/ValkyrieRenderer';
import ZombieRenderer from '@/components/enemies/ZombieRenderer';
import AlliedKnightRenderer from '@/components/enemies/AlliedKnightRenderer';
import AlliedHealerRenderer from '@/components/enemies/AlliedHealerRenderer';
import AlliedHuntressRenderer from '@/components/enemies/AlliedHuntressRenderer';
import AlliedPhantomRenderer from '@/components/enemies/AlliedPhantomRenderer';
import AlliedDemonRenderer from '@/components/enemies/AlliedDemonRenderer';
import AlliedEnchantressRenderer from '@/components/enemies/AlliedEnchantressRenderer';
import SummonedBossSkeleton from '@/components/enemies/SummonedBossSkeleton';

type CoopEnemyRenderLayerProps = {
  enemiesByType: Map<string, Enemy[]>;
  isCoopEnemyVisibleForRender: (x: number, z: number) => boolean;
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
const CoopEnemyRenderLayer = memo(function CoopEnemyRenderLayer({
  enemiesByType,
  isCoopEnemyVisibleForRender,
}: CoopEnemyRenderLayerProps) {
  const shouldRenderCoopEnemy = useCoopEnemyDeathLinger(enemiesByType);

  return (
    <>
      {(enemiesByType.get('boss-skeleton') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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

      {(enemiesByType.get('allied-huntress') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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

      {(enemiesByType.get('allied-enchantress') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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

      {(enemiesByType.get('sentinel') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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

      {(enemiesByType.get('valkyrie') ?? []).map((enemy) => {
        if (!shouldRenderCoopEnemy(enemy)) return null;
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
        if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
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
    </>
  );
});

export default CoopEnemyRenderLayer;
