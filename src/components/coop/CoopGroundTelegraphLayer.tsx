'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import BossLeapTelegraph from '@/components/enemies/BossLeapTelegraph';
import ViperShotTelegraphLine from '@/components/enemies/ViperShotTelegraphLine';
import BossTectonicSpikeTelegraph from '@/components/enemies/BossTectonicSpikeTelegraph';
import MartyrDetonationTelegraph from '@/components/enemies/MartyrDetonationTelegraph';
import TitanCannonAbility from '@/components/enemies/TitanCannonAbility';
import {
  TENTACLE_SPINE_TELEGRAPH_COLOR,
  TENTACLE_SPINE_TELEGRAPH_STRIP_WIDTH,
} from '@/utils/tentacleSpineClientConstants';
import type {
  BossLeapTelegraphState,
  BossTectonicTelegraphState,
  MartyrDetonationTelegraphState,
  MobLeapTelegraphState,
  TentacleSpineTelegraphState,
  TitanCannonAbilityState,
  ViperShotTelegraphState,
  WeaverImpaleTelegraphState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopGroundTelegraphLayerHandle = {
  clearAll: () => void;
  addBossLeapTelegraph: (tg: BossLeapTelegraphState) => void;
  removeBossLeapByEntityId: (entityId: string) => void;
  addMobLeapTelegraph: (tg: MobLeapTelegraphState) => void;
  removeMobLeapByEntityId: (entityId: string) => void;
  addViperShotTelegraph: (tg: ViperShotTelegraphState) => void;
  removeViperShotTelegraph: (id: string) => void;
  addTentacleSpineTelegraph: (tg: TentacleSpineTelegraphState) => void;
  removeTentacleSpineTelegraph: (id: string) => void;
  removeTentacleSpineTelegraphsByEnemyId: (enemyId: string) => void;
  setTentacleSpineTelegraphs: (telegraphs: TentacleSpineTelegraphState[]) => void;
  addBossTectonicTelegraph: (tg: BossTectonicTelegraphState) => void;
  addWeaverImpaleTelegraph: (tg: WeaverImpaleTelegraphState) => void;
  addMartyrDetonationTelegraph: (tel: MartyrDetonationTelegraphState) => void;
  removeMartyrDetonationByMartyrId: (martyrId: string) => void;
  addTitanCannonAbility: (ab: TitanCannonAbilityState) => void;
  removeById: (id: string) => void;
};

const CoopGroundTelegraphLayer = memo(forwardRef<CoopGroundTelegraphLayerHandle, object>(
  function CoopGroundTelegraphLayer(_props, ref) {
    const [bossLeapTelegraphs, setBossLeapTelegraphs] = useState<BossLeapTelegraphState[]>([]);
    const [mobLeapTelegraphs, setMobLeapTelegraphs] = useState<MobLeapTelegraphState[]>([]);
    const [viperShotTelegraphs, setViperShotTelegraphs] = useState<ViperShotTelegraphState[]>([]);
    const [tentacleSpineTelegraphs, setTentacleSpineTelegraphsState] = useState<TentacleSpineTelegraphState[]>([]);
    const [bossTectonicTelegraphs, setBossTectonicTelegraphs] = useState<BossTectonicTelegraphState[]>([]);
    const [weaverImpaleTelegraphs, setWeaverImpaleTelegraphs] = useState<WeaverImpaleTelegraphState[]>([]);
    const [martyrDetonationTelegraphs, setMartyrDetonationTelegraphs] = useState<MartyrDetonationTelegraphState[]>([]);
    const [titanCannonAbilities, setTitanCannonAbilities] = useState<TitanCannonAbilityState[]>([]);

    const clearAll = useCallback(() => {
      setBossLeapTelegraphs([]);
      setMobLeapTelegraphs([]);
      setViperShotTelegraphs([]);
      setTentacleSpineTelegraphsState([]);
      setBossTectonicTelegraphs([]);
      setWeaverImpaleTelegraphs([]);
      setMartyrDetonationTelegraphs([]);
      setTitanCannonAbilities([]);
    }, []);

    const removeById = useCallback((id: string) => {
      setBossLeapTelegraphs((prev) => prev.filter((t) => t.id !== id));
      setMobLeapTelegraphs((prev) => prev.filter((t) => t.id !== id));
      setViperShotTelegraphs((prev) => prev.filter((t) => t.id !== id));
      setTentacleSpineTelegraphsState((prev) => prev.filter((t) => t.id !== id));
      setBossTectonicTelegraphs((prev) => prev.filter((t) => t.id !== id));
      setWeaverImpaleTelegraphs((prev) => prev.filter((t) => t.id !== id));
      setMartyrDetonationTelegraphs((prev) => prev.filter((t) => t.id !== id));
      setTitanCannonAbilities((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addBossLeapTelegraph = useCallback((tg: BossLeapTelegraphState) => {
      setBossLeapTelegraphs((prev) => [...prev, tg]);
    }, []);

    const removeBossLeapByEntityId = useCallback((entityId: string) => {
      setBossLeapTelegraphs((prev) => prev.filter((t) => !t.id.includes(entityId)));
    }, []);

    const addMobLeapTelegraph = useCallback((tg: MobLeapTelegraphState) => {
      setMobLeapTelegraphs((prev) => [...prev, tg]);
    }, []);

    const removeMobLeapByEntityId = useCallback((entityId: string) => {
      setMobLeapTelegraphs((prev) => prev.filter((t) => !t.id.includes(entityId)));
    }, []);

    const addViperShotTelegraph = useCallback((tg: ViperShotTelegraphState) => {
      setViperShotTelegraphs((prev) => [...prev, tg]);
    }, []);

    const removeViperShotTelegraph = useCallback((id: string) => {
      setViperShotTelegraphs((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const addTentacleSpineTelegraph = useCallback((tg: TentacleSpineTelegraphState) => {
      setTentacleSpineTelegraphsState((prev) => [...prev, tg]);
    }, []);

    const removeTentacleSpineTelegraph = useCallback((id: string) => {
      setTentacleSpineTelegraphsState((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const removeTentacleSpineTelegraphsByEnemyId = useCallback((enemyId: string) => {
      setTentacleSpineTelegraphsState((prev) => prev.filter((t) => t.enemyId !== enemyId));
    }, []);

    const setTentacleSpineTelegraphs = useCallback((telegraphs: TentacleSpineTelegraphState[]) => {
      setTentacleSpineTelegraphsState(telegraphs);
    }, []);

    const addBossTectonicTelegraph = useCallback((tg: BossTectonicTelegraphState) => {
      setBossTectonicTelegraphs((prev) => [...prev, tg]);
    }, []);

    const addWeaverImpaleTelegraph = useCallback((tg: WeaverImpaleTelegraphState) => {
      setWeaverImpaleTelegraphs((prev) => [...prev, tg]);
    }, []);

    const addMartyrDetonationTelegraph = useCallback((tel: MartyrDetonationTelegraphState) => {
      setMartyrDetonationTelegraphs((prev) => [...prev, tel]);
    }, []);

    const removeMartyrDetonationByMartyrId = useCallback((martyrId: string) => {
      setMartyrDetonationTelegraphs((prev) => prev.filter((t) => t.martyrId !== martyrId));
    }, []);

    const addTitanCannonAbility = useCallback((ab: TitanCannonAbilityState) => {
      setTitanCannonAbilities((prev) => [...prev, ab]);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addBossLeapTelegraph,
      removeBossLeapByEntityId,
      addMobLeapTelegraph,
      removeMobLeapByEntityId,
      addViperShotTelegraph,
      removeViperShotTelegraph,
      addTentacleSpineTelegraph,
      removeTentacleSpineTelegraph,
      removeTentacleSpineTelegraphsByEnemyId,
      setTentacleSpineTelegraphs,
      addBossTectonicTelegraph,
      addWeaverImpaleTelegraph,
      addMartyrDetonationTelegraph,
      removeMartyrDetonationByMartyrId,
      addTitanCannonAbility,
      removeById,
    }), [
      clearAll,
      addBossLeapTelegraph,
      removeBossLeapByEntityId,
      addMobLeapTelegraph,
      removeMobLeapByEntityId,
      addViperShotTelegraph,
      removeViperShotTelegraph,
      addTentacleSpineTelegraph,
      removeTentacleSpineTelegraph,
      removeTentacleSpineTelegraphsByEnemyId,
      setTentacleSpineTelegraphs,
      addBossTectonicTelegraph,
      addWeaverImpaleTelegraph,
      addMartyrDetonationTelegraph,
      removeMartyrDetonationByMartyrId,
      addTitanCannonAbility,
      removeById,
    ]);

    return (
      <>
        {bossLeapTelegraphs.map((tg) => (
          <group key={tg.id} position={[tg.x, tg.y, tg.z]}>
            <BossLeapTelegraph
              durationMs={tg.durationMs}
              onEnd={() => removeById(tg.id)}
            />
          </group>
        ))}

        {mobLeapTelegraphs.map((tg) => (
          <group key={tg.id} position={[tg.x, tg.y, tg.z]}>
            <BossLeapTelegraph
              theme={tg.theme}
              durationMs={tg.durationMs}
              onEnd={() => removeById(tg.id)}
            />
          </group>
        ))}

        {viperShotTelegraphs.map((t) => (
          <ViperShotTelegraphLine
            key={t.id}
            start={t.start}
            end={t.end}
            variant="viper"
            endAt={t.endAt}
            startedAt={t.startedAt}
          />
        ))}

        {tentacleSpineTelegraphs.map((t) => (
          <ViperShotTelegraphLine
            key={t.id}
            start={t.start}
            end={t.end}
            lineWidth={TENTACLE_SPINE_TELEGRAPH_STRIP_WIDTH}
            color={TENTACLE_SPINE_TELEGRAPH_COLOR}
            variant="tentacle"
            endAt={t.endAt}
            startedAt={t.startedAt}
          />
        ))}

        {bossTectonicTelegraphs.map((tg) => (
          <group key={tg.id} position={[tg.x, tg.y, tg.z]}>
            <BossTectonicSpikeTelegraph
              durationMs={tg.durationMs}
              onEnd={() => removeById(tg.id)}
            />
          </group>
        ))}

        {weaverImpaleTelegraphs.map((tg) => (
          <group key={tg.id} position={[tg.x, tg.y, tg.z]}>
            <BossTectonicSpikeTelegraph
              durationMs={tg.durationMs}
              theme={tg.theme}
              onEnd={() => removeById(tg.id)}
            />
          </group>
        ))}

        {martyrDetonationTelegraphs.map((tel) => (
          <MartyrDetonationTelegraph
            key={tel.id}
            position={new Vector3(tel.position.x, tel.position.y + 0.165, tel.position.z)}
            radius={6}
            endAt={tel.endAt}
            onComplete={() => removeById(tel.id)}
          />
        ))}

        {titanCannonAbilities.map((ab) => (
          <TitanCannonAbility
            key={ab.id}
            soulType={ab.soulType}
            origin={ab.origin}
            rotation={ab.rotation}
            range={ab.range}
            halfWidth={ab.halfWidth}
            strikeAt={ab.strikeAt}
            onComplete={() => removeById(ab.id)}
          />
        ))}
      </>
    );
  },
));

CoopGroundTelegraphLayer.displayName = 'CoopGroundTelegraphLayer';

export default CoopGroundTelegraphLayer;
