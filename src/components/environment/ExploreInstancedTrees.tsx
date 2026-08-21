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
import { useFrame } from '@react-three/fiber';
import type { BufferGeometry, Material, Mesh, Object3D } from 'three';
import { FrontSide, InstancedMesh, Matrix4, Quaternion, Vector3 } from '@/utils/three-exports';
import { prepareNaturePropScene } from './ThroneNatureProps';
import {
  EXPLORE_TREE_META,
  EXPLORE_TREE_URLS,
  type ExploreTreeVariant,
} from '@/utils/exploreTreeLayout';
import {
  EXPLORE_PROP_CHUNK_COUNT,
  EXPLORE_PROP_CHUNK_GRID,
  EXPLORE_TREE_CHUNK_EXTRA_R,
  EXPLORE_TREE_CHUNK_PAD_Y,
  explorePropCellIndex,
  initExplorePropChunkMesh,
  setExplorePropChunkSphere,
  type ExploreInstancedWrite,
  type ExploreInstancedWriteHandle,
} from '@/utils/explorePropChunks';
import { isExploreZoomClose } from '@/utils/exploreZoomLod';

export type ExploreTreePlacement = {
  index: number;
  x: number;
  z: number;
  scale: number;
  rotY: number;
  variant: ExploreTreeVariant;
};

export type ExploreInstancedTreesHandle = ExploreInstancedWriteHandle<ExploreTreePlacement>;

const TREE_POOL = 256;
/** Visual-only multiplier; collision still uses worldgen disc radius. */
const EXPLORE_TREE_VISUAL_SCALE = 1.475;
/** alphaTest floor for foliage; raised when zoom-close to discard more early. */
const FOLIAGE_ALPHA_FAR = 0.45;
const FOLIAGE_ALPHA_CLOSE = 0.72;

const UP = new Vector3(0, 1, 0);
const _mat = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();

function isFoliageMaterial(mat: Material): boolean {
  const name = ((mat as Material & { name?: string }).name || '').toLowerCase();
  return /leaf|leaves|pine|branch|vine|needle/i.test(name);
}

function configureTreeFoliage(mat: Material): void {
  const m = mat as Material & {
    name?: string;
    transparent?: boolean;
    alphaTest?: number;
    depthWrite?: boolean;
    side?: number;
  };
  if (!isFoliageMaterial(mat)) return;
  m.transparent = false;
  m.alphaTest = Math.max(m.alphaTest ?? 0, FOLIAGE_ALPHA_FAR);
  m.depthWrite = true;
  m.side = FrontSide;
  m.needsUpdate = true;
}

function extractMeshSources(scene: Object3D): {
  geometry: BufferGeometry;
  material: Material;
  foliage: boolean;
}[] {
  const cloned = scene.clone(true);
  prepareNaturePropScene(cloned);
  cloned.updateWorldMatrix(true, true);
  const out: { geometry: BufferGeometry; material: Material; foliage: boolean }[] = [];
  cloned.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geo = mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrixWorld);
    const raw = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!raw) return;
    const material = (raw as Material).clone();
    const foliage = isFoliageMaterial(material);
    configureTreeFoliage(material);
    out.push({ geometry: geo, material, foliage });
  });
  return out;
}

function TreeVariantBatch({
  url,
  meta,
  pool,
  writeSlot,
}: {
  url: string;
  meta: { groundY: number; defaultScale: number };
  pool: number;
  writeSlot: MutableRefObject<ExploreInstancedWrite<ExploreTreePlacement>>;
}) {
  const { scene } = useGLTF(url);
  const sources = useMemo(() => extractMeshSources(scene), [scene]);
  const meshRefs = useRef<(InstancedMesh | null)[][]>(
    Array.from({ length: EXPLORE_PROP_CHUNK_COUNT }, () => []),
  );
  const foliageCloseRef = useRef(false);

  useFrame(() => {
    const close = isExploreZoomClose();
    if (close === foliageCloseRef.current) return;
    foliageCloseRef.current = close;
    const alpha = close ? FOLIAGE_ALPHA_CLOSE : FOLIAGE_ALPHA_FAR;
    for (const src of sources) {
      if (!src.foliage) continue;
      const m = src.material as Material & { alphaTest?: number; needsUpdate?: boolean };
      m.alphaTest = alpha;
      m.needsUpdate = true;
    }
  });

  const write: ExploreInstancedWrite<ExploreTreePlacement> = (placements, originX, originZ, radius) => {
    if (sources.length === 0) return true;
    const cellSize = (radius * 2) / EXPLORE_PROP_CHUNK_GRID;
    const cells: ExploreTreePlacement[][] = Array.from(
      { length: EXPLORE_PROP_CHUNK_COUNT },
      () => [],
    );
    // Keep every placement; pool is sized to TREE_POOL so a dense cell cannot
    // silently drop attackable trees (streamer sends at most TREE_POOL total).
    for (const p of placements) {
      const ci = explorePropCellIndex(p.x, p.z, originX, originZ, cellSize);
      cells[ci]!.push(p);
    }

    let wrote = false;
    for (let c = 0; c < EXPLORE_PROP_CHUNK_COUNT; c++) {
      const list = cells[c]!;
      const n = Math.min(list.length, pool);
      const refs = meshRefs.current[c]!;
      for (const mesh of refs) {
        if (!mesh) continue;
        wrote = true;
        for (let i = 0; i < n; i++) {
          const p = list[i]!;
          const s = meta.defaultScale * p.scale * EXPLORE_TREE_VISUAL_SCALE;
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
          EXPLORE_TREE_CHUNK_PAD_Y,
          EXPLORE_TREE_CHUNK_EXTRA_R,
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

function ExploreInstancedTreesInner({
  pool = TREE_POOL,
  writeRef,
}: {
  pool?: number;
  writeRef: MutableRefObject<ExploreInstancedWrite<ExploreTreePlacement>>;
}) {
  const variantSlots = useRef(
    EXPLORE_TREE_URLS.map(() => {
      const slot: MutableRefObject<ExploreInstancedWrite<ExploreTreePlacement>> = {
        current: () => false,
      };
      return slot;
    }),
  );

  writeRef.current = (placements, originX, originZ, radius) => {
    const buckets: ExploreTreePlacement[][] = EXPLORE_TREE_URLS.map(() => []);
    for (const p of placements) {
      buckets[p.variant]!.push(p);
    }
    let ok = true;
    for (let i = 0; i < EXPLORE_TREE_URLS.length; i++) {
      if (!variantSlots.current[i]!.current(buckets[i]!, originX, originZ, radius)) ok = false;
    }
    return ok;
  };

  return (
    <group name="explore-glb-trees">
      {EXPLORE_TREE_URLS.map((url, i) => (
        <TreeVariantBatch
          key={`${i}-${url}`}
          url={url}
          meta={EXPLORE_TREE_META[i]!}
          pool={pool}
          writeSlot={variantSlots.current[i]!}
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

const ExploreInstancedTrees = forwardRef<
  ExploreInstancedTreesHandle,
  { pool?: number }
>(function ExploreInstancedTrees({ pool }, ref) {
  const writeRef = useRef<ExploreInstancedWrite<ExploreTreePlacement>>(() => false);
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
      <ExploreInstancedTreesInner pool={pool} writeRef={writeRef} />
    </Suspense>
  );
});

export default ExploreInstancedTrees;
