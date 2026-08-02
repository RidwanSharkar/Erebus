'use client';

import React, { Suspense, useLayoutEffect, useMemo } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import type { Material, Mesh, Object3D } from 'three';
import { sRGBEncoding } from '@/utils/three-exports';
import {
  listUniqueThroneTurretPropModels,
  THRONE_TURRET_PROP_LAYOUT,
  TURRET_PROP_MODEL_META,
  turretPropGlbUrl,
  type ThroneTurretPropDef,
  type ThroneTurretPropModel,
} from '@/utils/throneTurretPropLayout';

function prepareTurretPropScene(scene: Object3D): void {
  scene.traverse((child) => {
    if (
      Math.abs(child.scale.x - 100) < 0.01 &&
      Math.abs(child.scale.y - 100) < 0.01 &&
      Math.abs(child.scale.z - 100) < 0.01
    ) {
      child.scale.set(1, 1, 1);
    }
    // cm leftovers if a GLB was converted before translation normalize
    if (
      Math.abs(child.position.x) > 50 ||
      Math.abs(child.position.y) > 50 ||
      Math.abs(child.position.z) > 50
    ) {
      child.position.multiplyScalar(0.01);
    }

    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of materials) {
      if (!mat) continue;
      const m = mat as Material & {
        map?: { encoding?: number; needsUpdate?: boolean } | null;
      };
      if (m.map) {
        m.map.encoding = sRGBEncoding;
        m.map.needsUpdate = true;
      }
      m.needsUpdate = true;
    }
  });
}

function TurretPropModelBatch({
  model,
  defs,
}: {
  model: ThroneTurretPropModel;
  defs: readonly ThroneTurretPropDef[];
}) {
  const url = turretPropGlbUrl(model);
  const { scene } = useGLTF(url);
  const meta = TURRET_PROP_MODEL_META[model];

  useLayoutEffect(() => {
    prepareTurretPropScene(scene);
  }, [scene]);

  return (
    <>
      {defs.map((def, i) => {
        const scaleMul = def.scale ?? 1;
        const s = meta.defaultScale * scaleMul;
        const y = meta.groundY * s;
        return (
          <Clone
            key={`${model}-${i}`}
            object={scene}
            position={[def.position[0], y + def.position[1], def.position[2]]}
            rotation={[0, def.rotationY ?? 0, 0]}
            scale={s}
            deep={false}
          />
        );
      })}
    </>
  );
}

function ThroneTurretPropsInner({
  layout = THRONE_TURRET_PROP_LAYOUT,
}: {
  layout?: readonly ThroneTurretPropDef[];
}) {
  const byModel = useMemo(() => {
    const map = new Map<ThroneTurretPropModel, ThroneTurretPropDef[]>();
    for (const def of layout) {
      const list = map.get(def.model);
      if (list) list.push(def);
      else map.set(def.model, [def]);
    }
    return map;
  }, [layout]);

  return (
    <group name="throne-turret-props">
      {Array.from(byModel.entries()).map(([model, defs]) => (
        <TurretPropModelBatch key={model} model={model} defs={defs} />
      ))}
    </group>
  );
}

export function preloadThroneTurretProps(
  layout: readonly ThroneTurretPropDef[] = THRONE_TURRET_PROP_LAYOUT,
): void {
  for (const model of listUniqueThroneTurretPropModels(layout)) {
    useGLTF.preload(turretPropGlbUrl(model));
  }
}

/** Decorative turret props on the throne center seal. */
function ThroneTurretProps({
  layout = THRONE_TURRET_PROP_LAYOUT,
}: {
  layout?: readonly ThroneTurretPropDef[];
}) {
  return (
    <Suspense fallback={null}>
      <ThroneTurretPropsInner layout={layout} />
    </Suspense>
  );
}

export default React.memo(ThroneTurretProps);
