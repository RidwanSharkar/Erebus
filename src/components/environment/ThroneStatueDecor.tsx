'use client';

import React, { Suspense, useLayoutEffect, useMemo } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import { prepareDecorScene } from './FloatingTrinketMesh';
import {
  listUniqueThroneStatueModels,
  THRONE_STATUE_GROUND_Y,
  THRONE_STATUE_LAYOUT,
  THRONE_STATUE_MODEL_META,
  throneStatueGlbUrl,
  type ThroneStatueDef,
  type ThroneStatueModel,
} from '@/utils/throneStatueDecorLayout';

for (const model of listUniqueThroneStatueModels()) {
  useGLTF.preload(throneStatueGlbUrl(model));
}

export function preloadThroneStatueDecor(
  layout: readonly ThroneStatueDef[] = THRONE_STATUE_LAYOUT,
): void {
  for (const model of listUniqueThroneStatueModels(layout)) {
    useGLTF.preload(throneStatueGlbUrl(model));
  }
}

function StatueModelBatch({
  model,
  defs,
}: {
  model: ThroneStatueModel;
  defs: readonly ThroneStatueDef[];
}) {
  const url = throneStatueGlbUrl(model);
  const { scene } = useGLTF(url);
  const meta = THRONE_STATUE_MODEL_META[model];

  useLayoutEffect(() => {
    prepareDecorScene(scene, false);
  }, [scene]);

  return (
    <>
      {defs.map((def, i) => {
        const scaleMul = def.scale ?? 1;
        const s = meta.defaultScale * scaleMul;
        const y = THRONE_STATUE_GROUND_Y + meta.groundY * s + def.position[1];
        return (
          <Clone
            key={`${model}-${i}`}
            object={scene}
            position={[def.position[0], y, def.position[2]]}
            rotation={[0, def.rotationY ?? 0, 0]}
            scale={s}
            deep={false}
          />
        );
      })}
    </>
  );
}

function ThroneStatueDecorInner({
  layout = THRONE_STATUE_LAYOUT,
}: {
  layout?: readonly ThroneStatueDef[];
}) {
  const byModel = useMemo(() => {
    const map = new Map<ThroneStatueModel, ThroneStatueDef[]>();
    for (const def of layout) {
      const list = map.get(def.model);
      if (list) list.push(def);
      else map.set(def.model, [def]);
    }
    return map;
  }, [layout]);

  return (
    <group name="throne-statue-decor">
      {Array.from(byModel.entries()).map(([model, defs]) => (
        <StatueModelBatch key={model} model={model} defs={defs} />
      ))}
    </group>
  );
}

/** Decorative Deathwing + GIANTSPINE statues for the throne grass disc. */
function ThroneStatueDecor({
  layout = THRONE_STATUE_LAYOUT,
}: {
  layout?: readonly ThroneStatueDef[];
}) {
  return (
    <Suspense fallback={null}>
      <ThroneStatueDecorInner layout={layout} />
    </Suspense>
  );
}

export default React.memo(ThroneStatueDecor);
