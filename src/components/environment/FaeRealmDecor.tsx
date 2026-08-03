'use client';

import React, { Suspense, useLayoutEffect, useMemo } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import type { Group, Mesh, Object3D } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import { prepareDecorScene } from './FloatingTrinketMesh';
import {
  FAE_REALM_DECOR_GROUND_Y,
  FAE_REALM_DECOR_LAYOUT,
  FAE_REALM_DECOR_MODEL_META,
  FAE_REALM_NUMBERED_PYLON_SELF_ILLUMINATION,
  faeRealmDecorGlbUrl,
  isNumberedFaePylon,
  listUniqueFaeRealmDecorModels,
  type FaeRealmDecorDef,
  type FaeRealmDecorModel,
} from '@/utils/faeRealmDecorLayout';

for (const model of listUniqueFaeRealmDecorModels()) {
  useGLTF.preload(faeRealmDecorGlbUrl(model));
}

export function preloadFaeRealmDecor(
  layout: readonly FaeRealmDecorDef[] = FAE_REALM_DECOR_LAYOUT,
): void {
  for (const model of listUniqueFaeRealmDecorModels(layout)) {
    useGLTF.preload(faeRealmDecorGlbUrl(model));
  }
}

function prepareNumberedPylonScene(scene: Object3D): Object3D {
  const root = SkeletonUtils.clone(scene) as Group;
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    if (mesh.material) {
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    }
  });
  applySelfIllumination(root, {
    intensity: FAE_REALM_NUMBERED_PYLON_SELF_ILLUMINATION,
  });
  return root;
}

function DecorModelBatch({
  model,
  defs,
}: {
  model: FaeRealmDecorModel;
  defs: readonly FaeRealmDecorDef[];
}) {
  const url = faeRealmDecorGlbUrl(model);
  const { scene } = useGLTF(url);
  const meta = FAE_REALM_DECOR_MODEL_META[model];
  const numbered = isNumberedFaePylon(model);

  const prepared = useMemo(
    () => (numbered ? prepareNumberedPylonScene(scene) : scene),
    [numbered, scene],
  );
  useDisposeClonedMaterials(numbered ? prepared : null);

  useLayoutEffect(() => {
    if (!numbered) prepareDecorScene(scene, false);
  }, [numbered, scene]);

  return (
    <>
      {defs.map((def, i) => {
        const scaleMul = def.scale ?? 1;
        const s = meta.defaultScale * scaleMul;
        const y = FAE_REALM_DECOR_GROUND_Y + meta.groundY * s + def.position[1];
        return (
          <Clone
            key={`${model}-${i}`}
            object={prepared}
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

function FaeRealmDecorInner({
  layout = FAE_REALM_DECOR_LAYOUT,
}: {
  layout?: readonly FaeRealmDecorDef[];
}) {
  const byModel = useMemo(() => {
    const map = new Map<FaeRealmDecorModel, FaeRealmDecorDef[]>();
    for (const def of layout) {
      const list = map.get(def.model);
      if (list) list.push(def);
      else map.set(def.model, [def]);
    }
    return map;
  }, [layout]);

  return (
    <group name="fae-realm-decor">
      {Array.from(byModel.entries()).map(([model, defs]) => (
        <DecorModelBatch key={model} model={model} defs={defs} />
      ))}
    </group>
  );
}

/** GIANTSPINE + scattered numbered pylons for the Fae Realm hex. */
function FaeRealmDecor({
  layout = FAE_REALM_DECOR_LAYOUT,
}: {
  layout?: readonly FaeRealmDecorDef[];
}) {
  return (
    <Suspense fallback={null}>
      <FaeRealmDecorInner layout={layout} />
    </Suspense>
  );
}

export default React.memo(FaeRealmDecor);
