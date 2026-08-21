'use client';

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from '@/utils/three-exports';
import { cloneBuildingScene, isBuildingFxMaterialName } from '@/utils/sharedEnemyMaterials';

export type ExploreBuildingPlacement = {
  x: number;
  z: number;
  rotY: number;
};

const UP = new Vector3(0, 1, 0);
const _mat = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

type MeshSource = {
  geometry: BufferGeometry;
  material: Material;
};

function extractBuildingSources(
  scene: Object3D,
  modelKey: string,
  skipFx: boolean,
): MeshSource[] {
  const cloned = cloneBuildingScene(scene, modelKey);
  cloned.updateWorldMatrix(true, true);
  const out: MeshSource[] = [];
  cloned.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const raw = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!raw) return;
    if (skipFx && isBuildingFxMaterialName(raw.name)) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    out.push({ geometry: geo, material: raw as Material });
  });
  return out;
}

function ExploreInstancedBuildingGlbInner({
  url,
  scale,
  modelY,
  placements,
  pool,
  skipFx,
}: {
  url: string;
  scale: number;
  modelY: number;
  placements: readonly ExploreBuildingPlacement[];
  pool: number;
  skipFx: boolean;
}) {
  const { scene } = useGLTF(url);
  const sources = useMemo(
    () => extractBuildingSources(scene, url, skipFx),
    [scene, url, skipFx],
  );
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);

  useEffect(() => {
    return () => {
      for (const src of sources) src.geometry.dispose();
    };
  }, [sources]);

  useEffect(() => {
    const write = () => {
      const n = Math.min(placements.length, pool);
      for (const mesh of meshRefs.current) {
        if (!mesh) continue;
        for (let i = 0; i < n; i++) {
          const p = placements[i]!;
          _q.setFromAxisAngle(UP, p.rotY);
          _s.set(scale, scale, scale);
          _p.set(p.x, modelY, p.z);
          _mat.compose(_p, _q, _s);
          mesh.setMatrixAt(i, _mat);
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
      }
    };
    write();
    const id = requestAnimationFrame(write);
    return () => cancelAnimationFrame(id);
  }, [placements, pool, scale, modelY, sources]);

  if (sources.length === 0) return null;

  return (
    <group>
      {sources.map((src, i) => (
        <instancedMesh
          key={`${url}-${i}`}
          ref={(el) => {
            meshRefs.current[i] = el;
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

/**
 * One InstancedMesh per GLB material — N copies of the same building share draws.
 * Callers hide per-building GLB meshes and keep HP / VFX overlays.
 */
export default function ExploreInstancedBuildingGlb({
  url,
  scale,
  modelY,
  placements,
  pool = 16,
  skipFx = false,
}: {
  url: string;
  scale: number;
  modelY: number;
  placements: readonly ExploreBuildingPlacement[];
  pool?: number;
  skipFx?: boolean;
}) {
  if (placements.length === 0) return null;
  return (
    <Suspense fallback={null}>
      <ExploreInstancedBuildingGlbInner
        url={url}
        scale={scale}
        modelY={modelY}
        placements={placements}
        pool={Math.max(pool, placements.length)}
        skipFx={skipFx}
      />
    </Suspense>
  );
}

export function preloadExploreBuildingGlb(url: string): void {
  useGLTF.preload(url);
}
