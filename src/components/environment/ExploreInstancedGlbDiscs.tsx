'use client';

import React, { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from '@/utils/three-exports';
import { prepareNaturePropScene } from './ThroneNatureProps';

export type ExploreGlbDiscPlacement = {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  index?: number;
};

const UP = new Vector3(0, 1, 0);
const _mat = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

function extractMeshSources(scene: Object3D): { geometry: BufferGeometry; material: Material }[] {
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
    out.push({ geometry: geo, material: (raw as Material).clone() });
  });
  return out;
}

function GlbDiscBatch({
  url,
  meta,
  placements,
  pool,
  visualScale,
}: {
  url: string;
  meta: { groundY: number; defaultScale: number };
  placements: readonly ExploreGlbDiscPlacement[];
  pool: number;
  visualScale: number;
}) {
  const { scene } = useGLTF(url);
  const sources = useMemo(() => extractMeshSources(scene), [scene]);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    const n = Math.min(placements.length, pool);
    const write = () => {
      let wrote = false;
      for (const mesh of meshRefs.current) {
        if (!mesh) continue;
        wrote = true;
        for (let i = 0; i < n; i++) {
          const p = placements[i]!;
          const s = meta.defaultScale * p.scale * visualScale;
          _q.setFromAxisAngle(UP, p.rotY);
          _s.set(s, s, s);
          _p.set(p.x, meta.groundY * s, p.z);
          _mat.compose(_p, _q, _s);
          mesh.setMatrixAt(i, _mat);
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
      return wrote;
    };
    if (write()) return;
    let raf = 0;
    let attempts = 0;
    const tick = () => {
      if (write() || ++attempts >= 30) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [placements, meta, visualScale, pool, sources.length]);

  if (sources.length === 0) return null;

  return (
    <group>
      {sources.map((src, i) => (
        <instancedMesh
          key={`${url}-${i}`}
          ref={(mesh) => {
            meshRefs.current[i] = mesh;
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

export function preloadExploreGlbDisc(url: string): void {
  useGLTF.preload(url);
}

export default function ExploreInstancedGlbDiscs({
  url,
  meta,
  placements,
  pool,
  visualScale,
  name,
}: {
  url: string;
  meta: { groundY: number; defaultScale: number };
  placements: readonly ExploreGlbDiscPlacement[];
  pool: number;
  visualScale: number;
  name: string;
}) {
  return (
    <Suspense fallback={null}>
      <group name={name}>
        <GlbDiscBatch
          url={url}
          meta={meta}
          placements={placements}
          pool={pool}
          visualScale={visualScale}
        />
      </group>
    </Suspense>
  );
}
