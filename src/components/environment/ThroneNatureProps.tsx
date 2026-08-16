'use client';

import React, { Suspense, useLayoutEffect, useMemo } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import type { Material, Mesh, Object3D } from 'three';
import { DoubleSide, sRGBEncoding } from '@/utils/three-exports';
import {
  listUniqueThroneNaturePropModels,
  NATURE_PROP_MODEL_META,
  naturePropGlbUrl,
  THRONE_NATURE_PROP_LAYOUT,
  type ThroneNaturePropDef,
  type ThroneNaturePropModel,
} from '@/utils/throneNaturePropLayout';

export function prepareNaturePropScene(scene: Object3D): void {
  // Assimp FBX export leaves a Unity-style scale=100 on the mesh node.
  // Mesh positions are already ~meters — apply 100× and everything towers into the sky.
  scene.traverse((child) => {
    if (
      Math.abs(child.scale.x - 100) < 0.01 &&
      Math.abs(child.scale.y - 100) < 0.01 &&
      Math.abs(child.scale.z - 100) < 0.01
    ) {
      child.scale.set(1, 1, 1);
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
        transparent?: boolean;
        alphaTest?: number;
        depthWrite?: boolean;
        side?: number;
        name?: string;
      };
      if (m.map) {
        m.map.encoding = sRGBEncoding;
        m.map.needsUpdate = true;
      }
      const name = (m.name || '').toLowerCase();
      const looksLikeFoliage =
        m.transparent ||
        (m.alphaTest ?? 0) > 0 ||
        /leaf|leaves|flower|grass|plant|fern/i.test(name);
      if (looksLikeFoliage) {
        m.transparent = true;
        m.alphaTest = Math.max(m.alphaTest ?? 0, 0.35);
        m.depthWrite = true;
        m.side = DoubleSide;
      }
      m.needsUpdate = true;
    }
  });
}

function NaturePropModelBatch({
  model,
  defs,
}: {
  model: ThroneNaturePropModel;
  defs: readonly ThroneNaturePropDef[];
}) {
  const url = naturePropGlbUrl(model);
  const { scene } = useGLTF(url);
  const meta = NATURE_PROP_MODEL_META[model];

  useLayoutEffect(() => {
    prepareNaturePropScene(scene);
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

function ThroneNaturePropsInner({
  layout = THRONE_NATURE_PROP_LAYOUT,
}: {
  layout?: readonly ThroneNaturePropDef[];
}) {
  const byModel = useMemo(() => {
    const map = new Map<ThroneNaturePropModel, ThroneNaturePropDef[]>();
    for (const def of layout) {
      const list = map.get(def.model);
      if (list) list.push(def);
      else map.set(def.model, [def]);
    }
    return map;
  }, [layout]);

  return (
    <group name="throne-nature-props">
      {Array.from(byModel.entries()).map(([model, defs]) => (
        <NaturePropModelBatch key={model} model={model} defs={defs} />
      ))}
    </group>
  );
}

export function preloadThroneNatureProps(
  layout: readonly ThroneNaturePropDef[] = THRONE_NATURE_PROP_LAYOUT,
): void {
  for (const model of listUniqueThroneNaturePropModels(layout)) {
    useGLTF.preload(naturePropGlbUrl(model));
  }
}

/** Decorative MegaKit nature props for the throne grass ring. */
function ThroneNatureProps({
  layout = THRONE_NATURE_PROP_LAYOUT,
}: {
  layout?: readonly ThroneNaturePropDef[];
}) {
  return (
    <Suspense fallback={null}>
      <ThroneNaturePropsInner layout={layout} />
    </Suspense>
  );
}

export default React.memo(ThroneNatureProps);
