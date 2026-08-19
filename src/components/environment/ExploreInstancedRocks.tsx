'use client';

import React, { Suspense, useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from '@/utils/three-exports';
import { prepareNaturePropScene } from './ThroneNatureProps';
import {
  NATURE_PROP_MODEL_META,
  naturePropGlbUrl,
} from '@/utils/throneNaturePropLayout';

export type ExploreRockPlacement = {
  index?: number;
  x: number;
  z: number;
  scale: number;
  rotY: number;
  variant: 0 | 1;
};

const ROCK_URLS = [naturePropGlbUrl('Rock_Medium_1'), naturePropGlbUrl('Rock_Medium_2')] as const;
const ROCK_META = [NATURE_PROP_MODEL_META.Rock_Medium_1, NATURE_PROP_MODEL_META.Rock_Medium_2] as const;
const ROCK_POOL = 192;
/** Visual-only multiplier; collision still uses worldgen disc radius. */
const EXPLORE_ROCK_VISUAL_SCALE = 2.75;

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

/** Unscaled Y lift so the baked mesh bottom sits at 0 after instance scale. */
function bakedGroundLift(sources: { geometry: BufferGeometry }[]): number {
  let minY = Infinity;
  for (const src of sources) {
    const geo = src.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const box = geo.boundingBox;
    if (!box) continue;
    minY = Math.min(minY, box.min.y);
  }
  return Number.isFinite(minY) ? -minY : 0;
}

function RockVariantBatch({
  url,
  meta,
  placements,
}: {
  url: string;
  meta: { groundY: number; defaultScale: number };
  placements: readonly ExploreRockPlacement[];
}) {
  const { scene } = useGLTF(url);
  const sources = useMemo(() => extractMeshSources(scene), [scene]);
  const groundLift = useMemo(() => bakedGroundLift(sources), [sources]);
  const meshRefs = useRef<(InstancedMesh | null)[]>([]);

  useLayoutEffect(() => {
    const n = Math.min(placements.length, ROCK_POOL);
    const write = () => {
      let wrote = false;
      for (const mesh of meshRefs.current) {
        if (!mesh) continue;
        wrote = true;
        for (let i = 0; i < n; i++) {
          const p = placements[i]!;
          const s = meta.defaultScale * p.scale * EXPLORE_ROCK_VISUAL_SCALE;
          _q.setFromAxisAngle(UP, p.rotY);
          _s.set(s, s, s);
          _p.set(p.x, groundLift * s, p.z);
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
  }, [placements, meta, sources.length, groundLift]);

  if (sources.length === 0) return null;
  const capacity = ROCK_POOL;

  return (
    <group>
      {sources.map((src, i) => (
        <instancedMesh
          key={`${url}-${i}`}
          ref={(mesh) => {
            meshRefs.current[i] = mesh;
          }}
          args={[src.geometry, src.material, capacity]}
          frustumCulled
          castShadow={false}
          receiveShadow={false}
        />
      ))}
    </group>
  );
}

function ExploreInstancedRocksInner({
  placements,
}: {
  placements: readonly ExploreRockPlacement[];
}) {
  const variant0 = useMemo(() => placements.filter((p) => p.variant === 0), [placements]);
  const variant1 = useMemo(() => placements.filter((p) => p.variant === 1), [placements]);

  return (
    <group name="explore-glb-rocks">
      <RockVariantBatch url={ROCK_URLS[0]} meta={ROCK_META[0]} placements={variant0} />
      <RockVariantBatch url={ROCK_URLS[1]} meta={ROCK_META[1]} placements={variant1} />
    </group>
  );
}

export function preloadExploreRockGlbs(): void {
  useGLTF.preload(ROCK_URLS[0]);
  useGLTF.preload(ROCK_URLS[1]);
}

export default function ExploreInstancedRocks({
  placements,
}: {
  placements: readonly ExploreRockPlacement[];
}) {
  return (
    <Suspense fallback={null}>
      <ExploreInstancedRocksInner placements={placements} />
    </Suspense>
  );
}
