'use client';

import React, { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { DoubleSide, InstancedMesh, Matrix4, Quaternion, Vector3 } from '@/utils/three-exports';
import { prepareNaturePropScene } from './ThroneNatureProps';
import {
  EXPLORE_TREE_META,
  EXPLORE_TREE_URLS,
  type ExploreTreeVariant,
} from '@/utils/exploreTreeLayout';

export type ExploreTreePlacement = {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  variant: ExploreTreeVariant;
};

const TREE_POOL = 256;
/** Visual-only multiplier; collision still uses worldgen disc radius. */
const EXPLORE_TREE_VISUAL_SCALE = 1.475;

const UP = new Vector3(0, 1, 0);
const _mat = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

function configureTreeFoliage(mat: Material): void {
  const m = mat as Material & {
    name?: string;
    transparent?: boolean;
    alphaTest?: number;
    depthWrite?: boolean;
    side?: number;
  };
  const name = (m.name || '').toLowerCase();
  if (!/leaf|leaves|pine|branch|vine|needle/i.test(name)) return;
  m.transparent = false;
  m.alphaTest = Math.max(m.alphaTest ?? 0, 0.45);
  m.depthWrite = true;
  m.side = DoubleSide;
  m.needsUpdate = true;
}

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
    const material = (raw as Material).clone();
    configureTreeFoliage(material);
    out.push({ geometry: geo, material });
  });
  return out;
}

function TreeVariantBatch({
  url,
  meta,
  placements,
}: {
  url: string;
  meta: { groundY: number; defaultScale: number };
  placements: readonly ExploreTreePlacement[];
}) {
  const { scene } = useGLTF(url);
  const sources = useMemo(() => extractMeshSources(scene), [scene]);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    const n = Math.min(placements.length, TREE_POOL);
    const write = () => {
      let wrote = false;
      for (const mesh of meshRefs.current) {
        if (!mesh) continue;
        wrote = true;
        for (let i = 0; i < n; i++) {
          const p = placements[i]!;
          const s = meta.defaultScale * p.scale * EXPLORE_TREE_VISUAL_SCALE;
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
  }, [placements, meta, sources.length]);

  if (sources.length === 0) return null;

  return (
    <group>
      {sources.map((src, i) => (
        <instancedMesh
          key={`${url}-${i}`}
          ref={(mesh) => {
            meshRefs.current[i] = mesh;
          }}
          args={[src.geometry, src.material, TREE_POOL]}
          frustumCulled
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

function ExploreInstancedTreesInner({
  placements,
}: {
  placements: readonly ExploreTreePlacement[];
}) {
  const byVariant = useMemo(() => {
    const buckets: ExploreTreePlacement[][] = EXPLORE_TREE_URLS.map(() => []);
    for (const p of placements) {
      buckets[p.variant]!.push(p);
    }
    return buckets;
  }, [placements]);

  return (
    <group name="explore-glb-trees">
      {EXPLORE_TREE_URLS.map((url, i) => (
        <TreeVariantBatch
          key={url}
          url={url}
          meta={EXPLORE_TREE_META[i]!}
          placements={byVariant[i]!}
        />
      ))}
    </group>
  );
}

export function preloadExploreTreeGlbs(): void {
  for (const url of EXPLORE_TREE_URLS) {
    useGLTF.preload(url);
  }
}

export default function ExploreInstancedTrees({
  placements,
}: {
  placements: readonly ExploreTreePlacement[];
}) {
  return (
    <Suspense fallback={null}>
      <ExploreInstancedTreesInner placements={placements} />
    </Suspense>
  );
}
