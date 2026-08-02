'use client';

import React, { Suspense, useLayoutEffect, useMemo } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import {
  FloatingTrinketMesh,
  prepareDecorScene,
} from './FloatingTrinketMesh';
import {
  listUniqueThroneShardModels,
  THRONE_CENTER_DECOR_GROUND_Y,
  THRONE_CENTER_WORLD_Z,
  THRONE_GOLD_PRISM_DEF,
  THRONE_PRISM_GOLD_PATH,
  THRONE_PRISM_RED_PATH,
  THRONE_RED_PRISM_DEF,
  THRONE_SHARD_LAYOUT,
  THRONE_SHARD_MODEL_META,
  THRONE_SPELLBOOK_DEF,
  THRONE_SPELLBOOK_PATH,
  throneShardGlbUrl,
  type ThroneShardDef,
  type ThroneShardModel,
} from '@/utils/throneCenterDecorLayout';

useGLTF.preload(THRONE_PRISM_GOLD_PATH);
useGLTF.preload(THRONE_PRISM_RED_PATH);
useGLTF.preload(THRONE_SPELLBOOK_PATH);
for (const model of listUniqueThroneShardModels()) {
  useGLTF.preload(throneShardGlbUrl(model));
}

export function preloadThroneCenterDecor(): void {
  useGLTF.preload(THRONE_PRISM_GOLD_PATH);
  useGLTF.preload(THRONE_PRISM_RED_PATH);
  useGLTF.preload(THRONE_SPELLBOOK_PATH);
  for (const model of listUniqueThroneShardModels()) {
    useGLTF.preload(throneShardGlbUrl(model));
  }
}

function ShardModelBatch({
  model,
  defs,
}: {
  model: ThroneShardModel;
  defs: readonly ThroneShardDef[];
}) {
  const url = throneShardGlbUrl(model);
  const { scene } = useGLTF(url);
  const meta = THRONE_SHARD_MODEL_META[model];

  useLayoutEffect(() => {
    prepareDecorScene(scene, false);
  }, [scene]);

  return (
    <>
      {defs.map((def, i) => {
        const scaleMul = def.scale ?? 1;
        const s = meta.defaultScale * scaleMul;
        const y = THRONE_CENTER_DECOR_GROUND_Y + meta.groundY * s;
        // Offset Z to match the center seal / grass disc (THRONE_CENTER_WORLD_Z).
        const z = def.position[1] + THRONE_CENTER_WORLD_Z;
        return (
          <Clone
            key={`${model}-${i}`}
            object={scene}
            position={[def.position[0], y, z]}
            rotation={[0, def.rotationY ?? 0, 0]}
            scale={s}
            deep={false}
          />
        );
      })}
    </>
  );
}

function ThroneShardFormations({
  layout = THRONE_SHARD_LAYOUT,
}: {
  layout?: readonly ThroneShardDef[];
}) {
  const byModel = useMemo(() => {
    const map = new Map<ThroneShardModel, ThroneShardDef[]>();
    for (const def of layout) {
      const list = map.get(def.model);
      if (list) list.push(def);
      else map.set(def.model, [def]);
    }
    return map;
  }, [layout]);

  return (
    <group name="throne-center-shards">
      {Array.from(byModel.entries()).map(([model, defs]) => (
        <ShardModelBatch key={model} model={model} defs={defs} />
      ))}
    </group>
  );
}

function ThroneCenterDecorInner() {
  return (
    <group name="throne-center-decor">
      <FloatingTrinketMesh
        path={THRONE_PRISM_GOLD_PATH}
        def={THRONE_GOLD_PRISM_DEF}
        lightColor="#fbbf24"
        lightIntensity={1.4}
      />
    </group>
  );
}

/** Prep-room center décor: floating prisms, spellbook, and ground shard formations. */
function ThroneCenterDecor() {
  return (
    <Suspense fallback={null}>
      <ThroneCenterDecorInner />
    </Suspense>
  );
}

export default React.memo(ThroneCenterDecor);
