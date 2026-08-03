'use client';

import React, { Suspense, useMemo } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import type { Group, Mesh, Object3D } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import {
  THRONE_PERIMETER_PYLON_GROUND_Y,
  THRONE_PERIMETER_PYLON_LAYOUT,
  THRONE_PERIMETER_PYLON_META,
  THRONE_PERIMETER_PYLON_PATH,
  THRONE_PERIMETER_PYLON_SELF_ILLUMINATION,
  type ThronePerimeterPylonDef,
} from '@/utils/thronePerimeterPylonLayout';

useGLTF.preload(THRONE_PERIMETER_PYLON_PATH);

export function preloadThronePerimeterPylonDecor(): void {
  useGLTF.preload(THRONE_PERIMETER_PYLON_PATH);
}

function preparePylonScene(scene: Object3D): Object3D {
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
  applySelfIllumination(root, { intensity: THRONE_PERIMETER_PYLON_SELF_ILLUMINATION });
  return root;
}

function ThronePerimeterPylonDecorInner({
  layout = THRONE_PERIMETER_PYLON_LAYOUT,
  groundY = THRONE_PERIMETER_PYLON_GROUND_Y,
}: {
  layout?: readonly ThronePerimeterPylonDef[];
  groundY?: number;
}) {
  const { scene } = useGLTF(THRONE_PERIMETER_PYLON_PATH);
  const meta = THRONE_PERIMETER_PYLON_META;

  const prepared = useMemo(() => preparePylonScene(scene), [scene]);
  useDisposeClonedMaterials(prepared);

  return (
    <group name="throne-perimeter-pylon-decor">
      {layout.map((def, i) => {
        const scaleMul = def.scale ?? 1;
        const s = meta.defaultScale * scaleMul;
        const y = groundY + meta.groundY * s + def.position[1];
        return (
          <Clone
            key={`perimeter-pylon-${i}`}
            object={prepared}
            position={[def.position[0], y, def.position[2]]}
            rotation={[0, def.rotationY, 0]}
            scale={s}
            deep={false}
          />
        );
      })}
    </group>
  );
}

/** Six rim pylons wrapping the throne grass disc, facing the room center. */
function ThronePerimeterPylonDecor({
  layout = THRONE_PERIMETER_PYLON_LAYOUT,
  groundY = THRONE_PERIMETER_PYLON_GROUND_Y,
}: {
  layout?: readonly ThronePerimeterPylonDef[];
  groundY?: number;
}) {
  return (
    <Suspense fallback={null}>
      <ThronePerimeterPylonDecorInner layout={layout} groundY={groundY} />
    </Suspense>
  );
}

export default React.memo(ThronePerimeterPylonDecor);
