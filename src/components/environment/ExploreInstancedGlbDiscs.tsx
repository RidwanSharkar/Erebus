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

export type ExploreGlbDiscPlacement = {
  x: number;
  z: number;
  scale: number;
  rotY: number;
  index?: number;
};

export type ExploreInstancedGlbDiscsHandle = ExploreInstancedWriteHandle<ExploreGlbDiscPlacement>;

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
  pool,
  visualScale,
  writeSlot,
}: {
  url: string;
  meta: { groundY: number; defaultScale: number };
  pool: number;
  visualScale: number;
  writeSlot: MutableRefObject<ExploreInstancedWrite<ExploreGlbDiscPlacement>>;
}) {
  const { scene } = useGLTF(url);
  const sources = useMemo(() => extractMeshSources(scene), [scene]);
  const meshRefs = useRef<(InstancedMesh | null)[][]>(
    Array.from({ length: EXPLORE_PROP_CHUNK_COUNT }, () => []),
  );

  const write: ExploreInstancedWrite<ExploreGlbDiscPlacement> = (placements, originX, originZ, radius) => {
    if (sources.length === 0) return true;
    const cellSize = (radius * 2) / EXPLORE_PROP_CHUNK_GRID;
    const cells: ExploreGlbDiscPlacement[][] = Array.from(
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
          const s = meta.defaultScale * p.scale * visualScale;
          _q.setFromAxisAngle(UP, p.rotY);
          _s.set(s, s, s);
          _p.set(p.x, meta.groundY * s, p.z);
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

export function preloadExploreGlbDisc(url: string): void {
  useGLTF.preload(url);
}

const ExploreInstancedGlbDiscs = forwardRef<
  ExploreInstancedGlbDiscsHandle,
  {
    url: string;
    meta: { groundY: number; defaultScale: number };
    pool: number;
    visualScale: number;
    name: string;
  }
>(function ExploreInstancedGlbDiscs({ url, meta, pool, visualScale, name }, ref) {
  const writeRef = useRef<ExploreInstancedWrite<ExploreGlbDiscPlacement>>(() => false);
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
      <group name={name}>
        <GlbDiscBatch
          url={url}
          meta={meta}
          pool={pool}
          visualScale={visualScale}
          writeSlot={writeRef}
        />
      </group>
    </Suspense>
  );
});

export default ExploreInstancedGlbDiscs;
