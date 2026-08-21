'use client';

import React, {
  forwardRef,
  Suspense,
  useImperativeHandle,
  useMemo,
  useRef,
  type MutableRefObject,
} from 'react';
import { useGLTF } from '@react-three/drei';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { InstancedMesh, Matrix4, Quaternion, Vector3 } from '@/utils/three-exports';
import { prepareNaturePropScene } from './ThroneNatureProps';
import {
  NATURE_PROP_MODEL_META,
  naturePropGlbUrl,
} from '@/utils/throneNaturePropLayout';
import {
  EXPLORE_PROP_CHUNK_COUNT,
  EXPLORE_PROP_CHUNK_EXTRA_R,
  EXPLORE_PROP_CHUNK_GRID,
  EXPLORE_PROP_CHUNK_PAD_Y,
  explorePropCellIndex,
  initExplorePropChunkMesh,
  setExplorePropChunkSphere,
  type ExploreInstancedWrite,
  type ExploreInstancedWriteHandle,
} from '@/utils/explorePropChunks';

export type ExploreRockPlacement = {
  index?: number;
  x: number;
  z: number;
  scale: number;
  rotY: number;
  variant: 0 | 1;
};

export type ExploreInstancedRocksHandle = ExploreInstancedWriteHandle<ExploreRockPlacement>;

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
  pool,
  writeSlot,
}: {
  url: string;
  meta: { groundY: number; defaultScale: number };
  pool: number;
  writeSlot: MutableRefObject<ExploreInstancedWrite<ExploreRockPlacement>>;
}) {
  const { scene } = useGLTF(url);
  const sources = useMemo(() => extractMeshSources(scene), [scene]);
  const groundLift = useMemo(() => bakedGroundLift(sources), [sources]);
  const meshRefs = useRef<(InstancedMesh | null)[][]>(
    Array.from({ length: EXPLORE_PROP_CHUNK_COUNT }, () => []),
  );

  const write: ExploreInstancedWrite<ExploreRockPlacement> = (placements, originX, originZ, radius) => {
    if (sources.length === 0) return true;
    const cellSize = (radius * 2) / EXPLORE_PROP_CHUNK_GRID;
    const cells: ExploreRockPlacement[][] = Array.from(
      { length: EXPLORE_PROP_CHUNK_COUNT },
      () => [],
    );
    for (const p of placements) {
      const ci = explorePropCellIndex(p.x, p.z, originX, originZ, cellSize);
      if (cells[ci]!.length < pool) cells[ci]!.push(p);
    }

    let wrote = false;
    for (let c = 0; c < EXPLORE_PROP_CHUNK_COUNT; c++) {
      const list = cells[c]!;
      const n = list.length;
      for (const mesh of meshRefs.current[c]!) {
        if (!mesh) continue;
        wrote = true;
        for (let i = 0; i < n; i++) {
          const p = list[i]!;
          const s = meta.defaultScale * p.scale * EXPLORE_ROCK_VISUAL_SCALE;
          _q.setFromAxisAngle(UP, p.rotY);
          _s.set(s, s, s);
          _p.set(p.x, groundLift * s, p.z);
          _mat.compose(_p, _q, _s);
          mesh.setMatrixAt(i, _mat);
        }
        mesh.count = n;
        mesh.instanceMatrix.needsUpdate = true;
        setExplorePropChunkSphere(
          mesh,
          c,
          originX,
          originZ,
          cellSize,
          EXPLORE_PROP_CHUNK_PAD_Y,
          EXPLORE_PROP_CHUNK_EXTRA_R,
        );
      }
    }
    return wrote;
  };
  writeSlot.current = write;

  const attachMeshes = useMemo(
    () =>
      Array.from({ length: EXPLORE_PROP_CHUNK_COUNT }, (_, c) =>
        Array.from({ length: sources.length }, (_, i) => (mesh: InstancedMesh | null) => {
          meshRefs.current[c]![i] = mesh;
          initExplorePropChunkMesh(mesh);
        }),
      ),
    [sources.length],
  );

  if (sources.length === 0) return null;

  return (
    <group>
      {Array.from({ length: EXPLORE_PROP_CHUNK_COUNT }, (_, c) => (
        <group key={c}>
          {sources.map((src, i) => (
            <instancedMesh
              key={`${url}-${c}-${i}`}
              ref={attachMeshes[c]![i]}
              args={[src.geometry, src.material, pool]}
              frustumCulled
              castShadow={false}
              receiveShadow={false}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function ExploreInstancedRocksInner({
  pool = ROCK_POOL,
  writeRef,
}: {
  pool?: number;
  writeRef: MutableRefObject<ExploreInstancedWrite<ExploreRockPlacement>>;
}) {
  const slot0 = useRef<ExploreInstancedWrite<ExploreRockPlacement>>(() => false);
  const slot1 = useRef<ExploreInstancedWrite<ExploreRockPlacement>>(() => false);

  writeRef.current = (placements, originX, originZ, radius) => {
    const variant0: ExploreRockPlacement[] = [];
    const variant1: ExploreRockPlacement[] = [];
    for (const p of placements) {
      if (p.variant === 1) variant1.push(p);
      else variant0.push(p);
    }
    const a = slot0.current(variant0, originX, originZ, radius);
    const b = slot1.current(variant1, originX, originZ, radius);
    return a && b;
  };

  return (
    <group name="explore-glb-rocks">
      <RockVariantBatch
        url={ROCK_URLS[0]}
        meta={ROCK_META[0]}
        pool={pool}
        writeSlot={slot0}
      />
      <RockVariantBatch
        url={ROCK_URLS[1]}
        meta={ROCK_META[1]}
        pool={pool}
        writeSlot={slot1}
      />
    </group>
  );
}

export function preloadExploreRockGlbs(): void {
  useGLTF.preload(ROCK_URLS[0]);
  useGLTF.preload(ROCK_URLS[1]);
}

const ExploreInstancedRocks = forwardRef<
  ExploreInstancedRocksHandle,
  { pool?: number }
>(function ExploreInstancedRocks({ pool }, ref) {
  const writeRef = useRef<ExploreInstancedWrite<ExploreRockPlacement>>(() => false);
  useImperativeHandle(
    ref,
    () => ({
      write: (placements, originX, originZ, radius) =>
        writeRef.current(placements, originX, originZ, radius),
    }),
    [],
  );
  return (
    <Suspense fallback={null}>
      <ExploreInstancedRocksInner pool={pool} writeRef={writeRef} />
    </Suspense>
  );
});

export default ExploreInstancedRocks;
