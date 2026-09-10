'use client';

import React, { Suspense, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Clone, useGLTF } from '@react-three/drei';
import type { BufferGeometry, Group, Mesh, Object3D } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  disposeClonedSkeletons,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import {
  DoubleSide,
  FrontSide,
  InstancedMesh,
  Material,
  Matrix4,
  Quaternion,
  Vector3,
} from '@/utils/three-exports';
import { prepareDecorScene } from './FloatingTrinketMesh';
import { prepareNaturePropScene } from './ThroneNatureProps';
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

const FOLIAGE_ALPHA = 0.45;

const UP = new Vector3(0, 1, 0);
const _mat = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

function configureCutoutMaterial(mat: Material): Material {
  mat.alphaTest = 0.5;
  mat.side = DoubleSide;
  mat.transparent = false;
  return mat;
}

function isFoliageMaterial(mat: Material): boolean {
  const name = ((mat as Material & { name?: string }).name || '').toLowerCase();
  return /leaf|leaves|pine|branch|vine|needle/i.test(name);
}

function configureTreeFoliage(mat: Material): void {
  const m = mat as Material & {
    transparent?: boolean;
    alphaTest?: number;
    depthWrite?: boolean;
    side?: number;
  };
  if (!isFoliageMaterial(mat)) return;
  m.transparent = false;
  m.alphaTest = Math.max(m.alphaTest ?? 0, FOLIAGE_ALPHA);
  m.depthWrite = true;
  m.side = FrontSide;
  m.needsUpdate = true;
}

function extractInstancedMeshSources(scene: Object3D): {
  geometry: BufferGeometry;
  material: Material;
}[] {
  const cloned = scene.clone(true);
  prepareNaturePropScene(cloned);
  cloned.updateWorldMatrix(true, true);
  const out: { geometry: BufferGeometry; material: Material }[] = [];
  cloned.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    const raw = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!raw) return;
    const material = (raw as Material).clone();
    configureTreeFoliage(material);
    out.push({ geometry: geo, material });
  });
  return out;
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

function prepareSkinnedDecorScene(scene: Object3D): Object3D {
  const root = SkeletonUtils.clone(scene) as Group;
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    if (mesh.material) {
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => configureCutoutMaterial(m.clone()))
        : configureCutoutMaterial(mesh.material.clone());
    }
  });
  return root;
}

function SkinnedDecorInstance({
  prepared,
  position,
  rotation,
  scale,
}: {
  prepared: Object3D;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}) {
  const cloned = useMemo(() => SkeletonUtils.clone(prepared) as Group, [prepared]);
  useEffect(() => {
    return () => {
      disposeClonedSkeletons(cloned);
    };
  }, [cloned]);
  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

/** Explore-style InstancedMesh for static deadtree.glb (no shadow, baked geo). */
function InstancedDecorBatch({
  model,
  defs,
}: {
  model: FaeRealmDecorModel;
  defs: readonly FaeRealmDecorDef[];
}) {
  const url = faeRealmDecorGlbUrl(model);
  const { scene } = useGLTF(url);
  const meta = FAE_REALM_DECOR_MODEL_META[model];
  const sources = useMemo(() => extractInstancedMeshSources(scene), [scene]);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);
  const pool = Math.max(1, defs.length);

  const writeMatrices = () => {
    const n = defs.length;
    for (const mesh of meshRefs.current) {
      if (!mesh) continue;
      for (let i = 0; i < n; i++) {
        const def = defs[i]!;
        const s = meta.defaultScale * (def.scale ?? 1);
        _q.setFromAxisAngle(UP, def.rotationY ?? 0);
        _s.set(s, s, s);
        _p.set(
          def.position[0],
          FAE_REALM_DECOR_GROUND_Y + meta.groundY * s + def.position[1],
          def.position[2],
        );
        _mat.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _mat);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };

  useLayoutEffect(() => {
    if (sources.length === 0) return;
    writeMatrices();
  });

  useEffect(() => {
    return () => {
      for (const src of sources) {
        src.geometry.dispose();
        src.material.dispose();
      }
    };
  }, [sources]);

  if (sources.length === 0) return null;

  return (
    <group name={`fae-instanced-${model}`}>
      {sources.map((src, i) => (
        <instancedMesh
          key={`${url}-${i}`}
          ref={(mesh) => {
            meshRefs.current[i] = mesh;
            if (mesh) writeMatrices();
          }}
          args={[src.geometry, src.material, pool]}
          frustumCulled
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
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
  const skinned = Boolean(meta.skinned);

  const prepared = useMemo(() => {
    if (numbered) return prepareNumberedPylonScene(scene);
    if (skinned) return prepareSkinnedDecorScene(scene);
    return scene;
  }, [numbered, skinned, scene]);
  useDisposeClonedMaterials(numbered || skinned ? prepared : null);

  useLayoutEffect(() => {
    if (!numbered && !skinned) prepareDecorScene(scene, false);
  }, [numbered, skinned, scene]);

  return (
    <>
      {defs.map((def, i) => {
        const scaleMul = def.scale ?? 1;
        const s = meta.defaultScale * scaleMul;
        const y = FAE_REALM_DECOR_GROUND_Y + meta.groundY * s + def.position[1];
        const position: [number, number, number] = [def.position[0], y, def.position[2]];
        const rotation: [number, number, number] = [0, def.rotationY ?? 0, 0];
        if (skinned) {
          return (
            <SkinnedDecorInstance
              key={`${model}-${i}`}
              prepared={prepared}
              position={position}
              rotation={rotation}
              scale={s}
            />
          );
        }
        return (
          <Clone
            key={`${model}-${i}`}
            object={prepared}
            position={position}
            rotation={rotation}
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
      {Array.from(byModel.entries()).map(([model, defs]) => {
        const meta = FAE_REALM_DECOR_MODEL_META[model];
        if (meta.instanced) {
          return <InstancedDecorBatch key={model} model={model} defs={defs} />;
        }
        return <DecorModelBatch key={model} model={model} defs={defs} />;
      })}
    </group>
  );
}

/** GIANTSPINE, deadtree (instanced), and other Fae Realm hex décor. */
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
