'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  InstancedMesh,
  InstancedBufferAttribute,
  Matrix4,
  Quaternion,
  Vector2,
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  FrontSide,
  Sphere,
  DynamicDrawUsage,
} from '@/utils/three-exports';
import type { Vector3 as Vector3Type } from 'three';
import {
  chunkKey,
  generateChunk,
  worldToChunk,
  EXPLORE_GRASS_STRIDE,
  EXPLORE_DISC_STRIDE,
  EXPLORE_MUSHROOM_VIEW_RADIUS,
  packExploreMushroomIndex,
  packExploreTreeIndex,
  packExploreRootIndex,
  packExploreRockIndex,
  packExploreSpineIndex,
  mushroomVisualFromScale,
  exploreRockVariant,
  type ExploreChunkData,
} from '@/utils/exploreWorldGen';
import { publishExploreObstacles, type ExploreObstacleDisc } from '@/utils/exploreObstacles';
import { publishExploreMushrooms } from '@/utils/exploreMushrooms';
import { publishExploreTrees } from '@/utils/exploreTrees';
import { publishExploreRoots } from '@/utils/exploreRoots';
import { publishExploreRocks, type ExploreRockInstance } from '@/utils/exploreRocks';
import { publishExploreSpines, type ExploreSpineInstance } from '@/utils/exploreSpines';
import type { MushroomInstance } from '@/utils/mushroomLayout';
import type { ExploreTreeInstance } from '@/utils/exploreTreeLayout';
import type { ExploreRootInstance } from '@/utils/exploreGroundPropLayout';
import InstancedMushrooms, { type InstancedMushroomsHandle } from './InstancedMushrooms';
import ExploreInstancedRocks, {
  preloadExploreRockGlbs,
  type ExploreInstancedRocksHandle,
  type ExploreRockPlacement,
} from './ExploreInstancedRocks';
import ExploreInstancedTrees, {
  preloadExploreTreeGlbs,
  type ExploreInstancedTreesHandle,
  type ExploreTreePlacement,
} from './ExploreInstancedTrees';
import ExploreInstancedGlbDiscs, {
  preloadExploreGlbDisc,
  type ExploreGlbDiscPlacement,
  type ExploreInstancedGlbDiscsHandle,
} from './ExploreInstancedGlbDiscs';
import { exploreTreeVariant } from '@/utils/exploreTreeLayout';
import {
  EXPLORE_ROOT_META,
  EXPLORE_ROOT_URL,
  EXPLORE_ROOT_VISUAL_SCALE,
  EXPLORE_SPINE_META,
  EXPLORE_SPINE_URL,
  EXPLORE_SPINE_VISUAL_SCALE,
} from '@/utils/exploreGroundPropLayout';
import { GRASS_VERTEX, GRASS_FRAGMENT } from './StylizedGrass';
import { explorePropPoolPerChunk, samePackedMembership } from '@/utils/explorePropChunks';
import { isExploreZoomClose } from '@/utils/exploreZoomLod';

const LOAD_RADIUS = 1;
const GEN_BUDGET = 2;
const DATA_LRU_MAX = 24;
const REWRITE_STEP = 6;
const GRASS_RADIUS = 26;
const PROP_RADIUS = 46;
const MUSH_RADIUS = EXPLORE_MUSHROOM_VIEW_RADIUS;
const OBSTACLE_RADIUS = 40;
const GRASS_RADIUS2 = GRASS_RADIUS * GRASS_RADIUS;
const PROP_RADIUS2 = PROP_RADIUS * PROP_RADIUS;
const MUSH_RADIUS2 = MUSH_RADIUS * MUSH_RADIUS;
const OBSTACLE_RADIUS2 = OBSTACLE_RADIUS * OBSTACLE_RADIUS;

const GRASS_POOL = 0;
const GRASS_CHUNK_GRID = 3;
const GRASS_CHUNK_COUNT = GRASS_CHUNK_GRID * GRASS_CHUNK_GRID;
const GRASS_PER_CHUNK = Math.ceil((GRASS_POOL * 1.6) / GRASS_CHUNK_COUNT);
const GRASS_CELL = (GRASS_RADIUS * 2) / GRASS_CHUNK_GRID;
const GRASS_CELL_RADIUS = GRASS_CELL * Math.SQRT1_2 + 1.25;
const COMBAT_GRASS_SCALE = 0.5;
const TREE_POOL = 256;
const ROCK_POOL = 192;
const ROOT_POOL = 128;
const SPINE_POOL = 32;
const MUSH_POOL = 128;
const ROCK_PER_CHUNK = explorePropPoolPerChunk(ROCK_POOL);
const ROOT_PER_CHUNK = explorePropPoolPerChunk(ROOT_POOL);
const SPINE_PER_CHUNK = explorePropPoolPerChunk(SPINE_POOL);
const GRASS_WIND_STRENGTH = 0.22;

const UP = new Vector3(0, 1, 0);
const _mat = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _color = new Color();

const BLADE_GEO = (() => {
  const geo = new BufferGeometry();
  const w = 0.07;
  const positions = new Float32Array([
    -w * 0.5, 0, 0,
    w * 0.5, 0, 0,
    -w * 0.35, 0.33, 0,
    w * 0.35, 0.33, 0,
    -w * 0.15, 0.66, 0,
    w * 0.15, 0.66, 0,
    0, 1.0, 0,
  ]);
  geo.setIndex([0, 1, 3, 0, 3, 2, 2, 3, 5, 2, 5, 4, 4, 5, 6]);
  geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geo.setAttribute(
    'aHeightRatio',
    new Float32BufferAttribute(new Float32Array([0, 0, 0.33, 0.33, 0.66, 0.66, 1.0]), 1),
  );
  return geo;
})();

function buildExploreGrassShaders(): { vertexShader: string; fragmentShader: string } {
  const vertexShader = `
#include <common>
#include <fog_pars_vertex>
attribute vec3 instanceColor;
varying vec3 vInstanceColor;
${GRASS_VERTEX.replace(
    'void main() {',
    'void main() {\n    vInstanceColor = instanceColor;',
  ).replace(
    'gl_Position = projectionMatrix * viewMatrix * wp;',
    `vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>`,
  )}
`;

  const fragmentShader = `
#include <common>
#include <fog_pars_fragment>
varying vec3 vInstanceColor;
uniform vec2 uFadeCenter;
${GRASS_FRAGMENT.replace(
    'vec3 col = mix(uBaseColor, uTipColor, vHeightRatio);',
    'vec3 col = mix(vInstanceColor, vInstanceColor * 1.55 + vec3(0.08), vHeightRatio);',
  ).replace(
    `    float dist = uUseSquareEdgeFade > 0.5
      ? max(abs(vLocalPos.x) / uGrassHalfX, abs(vLocalPos.z) / uGrassHalfZ)
      : length(vLocalPos.xz);
    col *= 1.0 - smoothstep(uGrassFadeInner, uGrassFadeOuter, dist) * 0.5;`,
    `    float dist = length(vWorldPos.xz - uFadeCenter);
    float fade = 1.0 - smoothstep(uGrassFadeInner, uGrassFadeOuter, dist);
    if (fade < 0.02) discard;
    col *= fade;`,
  ).replace(
    'gl_FragColor = vec4(col, 1.0);',
    `gl_FragColor = vec4(col, 1.0);
    #include <fog_fragment>`,
  )}
`;
  if (!fragmentShader.includes('uFadeCenter') || !fragmentShader.includes('fog_fragment')) {
    throw new Error('Explore grass shader compose failed; StylizedGrass fragment changed.');
  }
  if (!vertexShader.includes('fog_vertex') || !vertexShader.includes('instanceColor')) {
    throw new Error('Explore grass shader compose failed; StylizedGrass vertex changed.');
  }
  return { vertexShader, fragmentShader };
}

const { vertexShader: EXPLORE_GRASS_VERTEX, fragmentShader: EXPLORE_GRASS_FRAGMENT } =
  buildExploreGrassShaders();

const chunkDataLru = new Map<string, ExploreChunkData>();

function touchChunkData(key: string, data: ExploreChunkData): void {
  if (chunkDataLru.has(key)) chunkDataLru.delete(key);
  chunkDataLru.set(key, data);
  while (chunkDataLru.size > DATA_LRU_MAX) {
    const oldest = chunkDataLru.keys().next().value;
    if (oldest === undefined) break;
    chunkDataLru.delete(oldest);
  }
}

function getOrGenerate(seed: number, cx: number, cz: number): ExploreChunkData {
  const key = chunkKey(cx, cz);
  const cached = chunkDataLru.get(key);
  if (cached) {
    touchChunkData(key, cached);
    return cached;
  }
  const data = generateChunk(seed, cx, cz);
  touchChunkData(key, data);
  return data;
}

function markPoolDirty(mesh: InstancedMesh, count: number, stride: number): void {
  mesh.count = count;
  const attr = mesh.instanceMatrix;
  if (count > 0 && typeof attr.addUpdateRange === 'function') {
    attr.addUpdateRange(0, count * stride);
  }
  attr.needsUpdate = true;
  if (mesh.instanceColor) {
    if (count > 0 && typeof mesh.instanceColor.addUpdateRange === 'function') {
      mesh.instanceColor.addUpdateRange(0, count * 3);
    }
    mesh.instanceColor.needsUpdate = true;
  }
}

let obstacleBufA: ExploreObstacleDisc[] = [];
let obstacleBufB: ExploreObstacleDisc[] = [];
let obstacleUseA = true;
const EMPTY_HIDDEN = new Set<number>();

function publishNearbyObstacles(
  loaded: Map<string, ExploreChunkData>,
  px: number,
  pz: number,
  hiddenTrees: ReadonlySet<number> = EMPTY_HIDDEN,
  hiddenRoots: ReadonlySet<number> = EMPTY_HIDDEN,
  hiddenRocks: ReadonlySet<number> = EMPTY_HIDDEN,
  hiddenSpines: ReadonlySet<number> = EMPTY_HIDDEN,
): void {
  const next = obstacleUseA ? obstacleBufA : obstacleBufB;
  obstacleUseA = !obstacleUseA;
  next.length = 0;
  for (const chunk of loaded.values()) {
    const trees = chunk.trees;
    for (let i = 0; i < chunk.treeCount; i++) {
      const packed = packExploreTreeIndex(chunk.cx, chunk.cz, i);
      if (hiddenTrees.has(packed)) continue;
      const o = i * EXPLORE_DISC_STRIDE;
      const x = trees[o]!;
      const z = trees[o + 1]!;
      const dx = x - px;
      const dz = z - pz;
      if (dx * dx + dz * dz > OBSTACLE_RADIUS2) continue;
      next.push({ x, z, radius: trees[o + 2]! });
    }
    const rocks = chunk.rocks;
    for (let i = 0; i < chunk.rockCount; i++) {
      const packed = packExploreRockIndex(chunk.cx, chunk.cz, i);
      if (hiddenRocks.has(packed)) continue;
      const o = i * EXPLORE_DISC_STRIDE;
      const x = rocks[o]!;
      const z = rocks[o + 1]!;
      const dx = x - px;
      const dz = z - pz;
      if (dx * dx + dz * dz > OBSTACLE_RADIUS2) continue;
      next.push({ x, z, radius: rocks[o + 2]! });
    }
    const roots = chunk.roots;
    for (let i = 0; i < chunk.rootCount; i++) {
      const packed = packExploreRootIndex(chunk.cx, chunk.cz, i);
      if (hiddenRoots.has(packed)) continue;
      const o = i * EXPLORE_DISC_STRIDE;
      const x = roots[o]!;
      const z = roots[o + 1]!;
      const dx = x - px;
      const dz = z - pz;
      if (dx * dx + dz * dz > OBSTACLE_RADIUS2) continue;
      next.push({ x, z, radius: roots[o + 2]! });
    }
    const spines = chunk.spines;
    for (let i = 0; i < chunk.spineCount; i++) {
      const packed = packExploreSpineIndex(chunk.cx, chunk.cz, i);
      if (hiddenSpines.has(packed)) continue;
      const o = i * EXPLORE_DISC_STRIDE;
      const x = spines[o]!;
      const z = spines[o + 1]!;
      const dx = x - px;
      const dz = z - pz;
      if (dx * dx + dz * dz > OBSTACLE_RADIUS2) continue;
      next.push({ x, z, radius: spines[o + 2]! });
    }
  }
  publishExploreObstacles(next);
}

interface ExploreChunkStreamerProps {
  seed: number;
  playerPositionRef: React.MutableRefObject<Vector3Type>;
  combatActive?: boolean;
  mushroomHiddenIndices?: ReadonlySet<number>;
  treeHiddenIndices?: ReadonlySet<number>;
  rootHiddenIndices?: ReadonlySet<number>;
  rockHiddenIndices?: ReadonlySet<number>;
  spineHiddenIndices?: ReadonlySet<number>;
}

preloadExploreRockGlbs();
preloadExploreTreeGlbs();
preloadExploreGlbDisc(EXPLORE_ROOT_URL);
preloadExploreGlbDisc(EXPLORE_SPINE_URL);

export default function ExploreChunkStreamer({
  seed,
  playerPositionRef,
  combatActive = false,
  mushroomHiddenIndices,
  treeHiddenIndices,
  rootHiddenIndices,
  rockHiddenIndices,
  spineHiddenIndices,
}: ExploreChunkStreamerProps) {
  const grassRefs = useRef<(InstancedMesh | null)[]>(Array.from({ length: GRASS_CHUNK_COUNT }, () => null));
  const attachGrassChunks = useMemo(
    () =>
      Array.from({ length: GRASS_CHUNK_COUNT }, (_, i) => (mesh: InstancedMesh | null) => {
        grassRefs.current[i] = mesh;
        if (!mesh) return;
        mesh.instanceMatrix.setUsage(DynamicDrawUsage);
        mesh.count = 0;
        mesh.frustumCulled = true;
        if (!mesh.instanceColor) {
          mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(GRASS_PER_CHUNK * 3), 3);
          mesh.instanceColor.setUsage(DynamicDrawUsage);
        }
        if (!mesh.boundingSphere) mesh.boundingSphere = new Sphere();
      }),
    [],
  );
  const treeWriteRef = useRef<ExploreInstancedTreesHandle>(null);
  const rockWriteRef = useRef<ExploreInstancedRocksHandle>(null);
  const rootWriteRef = useRef<ExploreInstancedGlbDiscsHandle>(null);
  const spineWriteRef = useRef<ExploreInstancedGlbDiscsHandle>(null);
  const mushWriteRef = useRef<InstancedMushroomsHandle>(null);

  const loadedRef = useRef(new Map<string, ExploreChunkData>());
  const pendingRef = useRef<Array<{ cx: number; cz: number }>>([]);
  const lastChunkRef = useRef<{ cx: number; cz: number } | null>(null);
  const lastWriteXRef = useRef(Number.POSITIVE_INFINITY);
  const lastWriteZRef = useRef(Number.POSITIVE_INFINITY);
  const lastCombatRef = useRef(combatActive);
  const lastZoomThinRef = useRef(false);
  const combatActiveRef = useRef(combatActive);
  combatActiveRef.current = combatActive;
  const zoomThinRef = useRef(false);
  const lastPropOriginXRef = useRef(0);
  const lastPropOriginZRef = useRef(0);
  const treeHiddenRef = useRef<ReadonlySet<number>>(EMPTY_HIDDEN);
  treeHiddenRef.current = treeHiddenIndices ?? EMPTY_HIDDEN;
  const lastTreePlacementsRef = useRef<ExploreTreePlacement[]>([]);
  const lastTreeLiveRef = useRef<ExploreTreeInstance[]>([]);
  const rootHiddenRef = useRef<ReadonlySet<number>>(EMPTY_HIDDEN);
  rootHiddenRef.current = rootHiddenIndices ?? EMPTY_HIDDEN;
  const lastRootPlacementsRef = useRef<ExploreGlbDiscPlacement[]>([]);
  const lastRootLiveRef = useRef<ExploreRootInstance[]>([]);
  const rockHiddenRef = useRef<ReadonlySet<number>>(EMPTY_HIDDEN);
  rockHiddenRef.current = rockHiddenIndices ?? EMPTY_HIDDEN;
  const lastRockPlacementsRef = useRef<ExploreRockPlacement[]>([]);
  const lastRockLiveRef = useRef<ExploreRockInstance[]>([]);
  const spineHiddenRef = useRef<ReadonlySet<number>>(EMPTY_HIDDEN);
  spineHiddenRef.current = spineHiddenIndices ?? EMPTY_HIDDEN;
  const lastSpinePlacementsRef = useRef<ExploreGlbDiscPlacement[]>([]);
  const lastSpineLiveRef = useRef<ExploreSpineInstance[]>([]);
  const mushHiddenRef = useRef<ReadonlySet<number>>(EMPTY_HIDDEN);
  mushHiddenRef.current = mushroomHiddenIndices ?? EMPTY_HIDDEN;
  const lastMushRef = useRef<MushroomInstance[]>([]);

  const grassMat = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uBaseColor: { value: new Color('#2d5a28') },
          uTipColor: { value: new Color('#4caf50') },
          uWindStrength: { value: GRASS_WIND_STRENGTH },
          uGroundLightColor: { value: new Color('#3a7a2a') },
          uGroundLightIntensity: { value: 0.4 },
          uGrassFadeInner: { value: 18 },
          uGrassFadeOuter: { value: GRASS_RADIUS },
          uGrassHalfX: { value: 1 },
          uGrassHalfZ: { value: 1 },
          uUseSquareEdgeFade: { value: 0 },
          uBrightnessScale: { value: 1 },
          uFadeCenter: { value: new Vector2(0, 0) },
        },
      ]),
      vertexShader: EXPLORE_GRASS_VERTEX,
      fragmentShader: EXPLORE_GRASS_FRAGMENT,
      side: FrontSide,
      fog: true,
    });
    return mat;
  }, []);

  useEffect(() => () => grassMat.dispose(), [grassMat]);

  useEffect(() => {
    chunkDataLru.clear();
    loadedRef.current.clear();
    pendingRef.current = [];
    lastChunkRef.current = null;
    lastWriteXRef.current = Number.POSITIVE_INFINITY;
    lastWriteZRef.current = Number.POSITIVE_INFINITY;
    publishExploreObstacles([]);
    publishExploreMushrooms([]);
    publishExploreTrees([]);
    publishExploreRoots([]);
    publishExploreRocks([]);
    publishExploreSpines([]);
    lastTreePlacementsRef.current = [];
    lastTreeLiveRef.current = [];
    lastRootPlacementsRef.current = [];
    lastRootLiveRef.current = [];
    lastRockPlacementsRef.current = [];
    lastRockLiveRef.current = [];
    lastSpinePlacementsRef.current = [];
    lastSpineLiveRef.current = [];
    lastMushRef.current = [];
    lastPropOriginXRef.current = 0;
    lastPropOriginZRef.current = 0;
    treeWriteRef.current?.write([], 0, 0, PROP_RADIUS);
    rockWriteRef.current?.write([], 0, 0, PROP_RADIUS);
    rootWriteRef.current?.write([], 0, 0, PROP_RADIUS);
    spineWriteRef.current?.write([], 0, 0, PROP_RADIUS);
    mushWriteRef.current?.write([], mushHiddenRef.current);
  }, [seed]);

  useEffect(() => {
    const hidden = treeHiddenIndices ?? EMPTY_HIDDEN;
    const nextPlace = lastTreePlacementsRef.current.filter((p) => !hidden.has(p.index));
    const nextLive = lastTreeLiveRef.current.filter((t) => !hidden.has(t.index));
    if (nextPlace.length !== lastTreePlacementsRef.current.length) {
      lastTreePlacementsRef.current = nextPlace;
      treeWriteRef.current?.write(
        nextPlace,
        lastPropOriginXRef.current,
        lastPropOriginZRef.current,
        PROP_RADIUS,
      );
    }
    if (!samePackedMembership(lastTreeLiveRef.current, nextLive)) {
      lastTreeLiveRef.current = nextLive;
      publishExploreTrees(nextLive);
    }
    const pos = playerPositionRef.current;
    if (pos) {
      publishNearbyObstacles(
        loadedRef.current,
        pos.x,
        pos.z,
        hidden,
        rootHiddenRef.current,
        rockHiddenRef.current,
        spineHiddenRef.current,
      );
    }
  }, [treeHiddenIndices, playerPositionRef]);

  useEffect(() => {
    const hidden = rootHiddenIndices ?? EMPTY_HIDDEN;
    const nextPlace = lastRootPlacementsRef.current.filter((p) => p.index == null || !hidden.has(p.index));
    const nextLive = lastRootLiveRef.current.filter((r) => !hidden.has(r.index));
    if (nextPlace.length !== lastRootPlacementsRef.current.length) {
      lastRootPlacementsRef.current = nextPlace;
      rootWriteRef.current?.write(
        nextPlace,
        lastPropOriginXRef.current,
        lastPropOriginZRef.current,
        PROP_RADIUS,
      );
    }
    if (!samePackedMembership(lastRootLiveRef.current, nextLive)) {
      lastRootLiveRef.current = nextLive;
      publishExploreRoots(nextLive);
    }
    const pos = playerPositionRef.current;
    if (pos) {
      publishNearbyObstacles(
        loadedRef.current,
        pos.x,
        pos.z,
        treeHiddenRef.current,
        hidden,
        rockHiddenRef.current,
        spineHiddenRef.current,
      );
    }
  }, [rootHiddenIndices, playerPositionRef]);

  useEffect(() => {
    const hidden = rockHiddenIndices ?? EMPTY_HIDDEN;
    const nextPlace = lastRockPlacementsRef.current.filter((p) => p.index == null || !hidden.has(p.index));
    const nextLive = lastRockLiveRef.current.filter((r) => !hidden.has(r.index));
    if (nextPlace.length !== lastRockPlacementsRef.current.length) {
      lastRockPlacementsRef.current = nextPlace;
      rockWriteRef.current?.write(
        nextPlace,
        lastPropOriginXRef.current,
        lastPropOriginZRef.current,
        PROP_RADIUS,
      );
    }
    if (!samePackedMembership(lastRockLiveRef.current, nextLive)) {
      lastRockLiveRef.current = nextLive;
      publishExploreRocks(nextLive);
    }
    const pos = playerPositionRef.current;
    if (pos) {
      publishNearbyObstacles(
        loadedRef.current,
        pos.x,
        pos.z,
        treeHiddenRef.current,
        rootHiddenRef.current,
        hidden,
        spineHiddenRef.current,
      );
    }
  }, [rockHiddenIndices, playerPositionRef]);

  useEffect(() => {
    const hidden = spineHiddenIndices ?? EMPTY_HIDDEN;
    const nextPlace = lastSpinePlacementsRef.current.filter((p) => p.index == null || !hidden.has(p.index));
    const nextLive = lastSpineLiveRef.current.filter((s) => !hidden.has(s.index));
    if (nextPlace.length !== lastSpinePlacementsRef.current.length) {
      lastSpinePlacementsRef.current = nextPlace;
      spineWriteRef.current?.write(
        nextPlace,
        lastPropOriginXRef.current,
        lastPropOriginZRef.current,
        PROP_RADIUS,
      );
    }
    if (!samePackedMembership(lastSpineLiveRef.current, nextLive)) {
      lastSpineLiveRef.current = nextLive;
      publishExploreSpines(nextLive);
    }
    const pos = playerPositionRef.current;
    if (pos) {
      publishNearbyObstacles(
        loadedRef.current,
        pos.x,
        pos.z,
        treeHiddenRef.current,
        rootHiddenRef.current,
        rockHiddenRef.current,
        hidden,
      );
    }
  }, [spineHiddenIndices, playerPositionRef]);

  useEffect(() => {
    const hidden = mushroomHiddenIndices ?? EMPTY_HIDDEN;
    mushWriteRef.current?.write(lastMushRef.current, hidden);
  }, [mushroomHiddenIndices]);

  const rewritePools = (px: number, pz: number) => {
    const grasses = grassRefs.current;
    for (let c = 0; c < GRASS_CHUNK_COUNT; c++) {
      if (!grasses[c]) return;
    }

    const grassCounts = new Int32Array(GRASS_CHUNK_COUNT);
    const originX = px - GRASS_RADIUS;
    const originZ = pz - GRASS_RADIUS;
    const combatThin = combatActiveRef.current || zoomThinRef.current;
    let grassN = 0;
    const grassBudget = combatThin ? Math.floor(GRASS_POOL * COMBAT_GRASS_SCALE) : GRASS_POOL;
    const nextTrees: ExploreTreePlacement[] = [];
    const nextTreeLive: ExploreTreeInstance[] = [];
    const nextRocks: ExploreRockPlacement[] = [];
    const nextRockLive: ExploreRockInstance[] = [];
    const nextRoots: ExploreGlbDiscPlacement[] = [];
    const nextRootLive: ExploreRootInstance[] = [];
    const nextSpines: ExploreGlbDiscPlacement[] = [];
    const nextSpineLive: ExploreSpineInstance[] = [];
    const nextMush: MushroomInstance[] = [];

    for (const chunk of loadedRef.current.values()) {
      _color.setRGB(chunk.grassPalette[0], chunk.grassPalette[1], chunk.grassPalette[2]);
      const blades = chunk.grass;
      for (let i = 0; i < chunk.grassCount && grassN < grassBudget; i++) {
        if (combatThin && (i & 1) === 1) continue;
        const o = i * EXPLORE_GRASS_STRIDE;
        const x = blades[o]!;
        const z = blades[o + 1]!;
        const dx = x - px;
        const dz = z - pz;
        if (dx * dx + dz * dz > GRASS_RADIUS2) continue;
        let gx = Math.floor((x - originX) / GRASS_CELL);
        let gz = Math.floor((z - originZ) / GRASS_CELL);
        if (gx < 0) gx = 0;
        else if (gx >= GRASS_CHUNK_GRID) gx = GRASS_CHUNK_GRID - 1;
        if (gz < 0) gz = 0;
        else if (gz >= GRASS_CHUNK_GRID) gz = GRASS_CHUNK_GRID - 1;
        const ci = gz * GRASS_CHUNK_GRID + gx;
        const slot = grassCounts[ci]!;
        if (slot >= GRASS_PER_CHUNK) continue;
        const grass = grasses[ci]!;
        _q.setFromAxisAngle(UP, blades[o + 2]!);
        _s.set(blades[o + 3]!, blades[o + 4]!, blades[o + 5]!);
        _p.set(x, 0, z);
        _mat.compose(_p, _q, _s);
        grass.setMatrixAt(slot, _mat);
        grass.setColorAt(slot, _color);
        grassCounts[ci] = slot + 1;
        grassN++;
      }

      const trees = chunk.trees;
      const hiddenTrees = treeHiddenRef.current;
      // Keep visuals 1:1 with attackable/live discs — combat/zoom thinning left ghosts.
      for (let i = 0; i < chunk.treeCount && nextTreeLive.length < TREE_POOL; i++) {
        const packed = packExploreTreeIndex(chunk.cx, chunk.cz, i);
        if (hiddenTrees.has(packed)) continue;
        const o = i * EXPLORE_DISC_STRIDE;
        const x = trees[o]!;
        const z = trees[o + 1]!;
        const dx = x - px;
        const dz = z - pz;
        if (dx * dx + dz * dz > PROP_RADIUS2) continue;
        const scale = trees[o + 3]!;
        const variant = exploreTreeVariant(x, z);
        nextTrees.push({
          index: packed,
          x,
          z,
          scale,
          rotY: trees[o + 4]!,
          variant,
        });
        nextTreeLive.push({
          index: packed,
          x,
          z,
          radius: trees[o + 2]!,
          scale,
          variant,
        });
      }

      const rocks = chunk.rocks;
      const hiddenRocks = rockHiddenRef.current;
      for (let i = 0; i < chunk.rockCount && nextRocks.length < ROCK_POOL; i++) {
        const packed = packExploreRockIndex(chunk.cx, chunk.cz, i);
        if (hiddenRocks.has(packed)) continue;
        const o = i * EXPLORE_DISC_STRIDE;
        const x = rocks[o]!;
        const z = rocks[o + 1]!;
        const dx = x - px;
        const dz = z - pz;
        if (dx * dx + dz * dz > PROP_RADIUS2) continue;
        const scale = rocks[o + 3]!;
        const variant = exploreRockVariant(x, z);
        nextRocks.push({
          index: packed,
          x,
          z,
          scale,
          rotY: rocks[o + 4]!,
          variant,
        });
        nextRockLive.push({
          index: packed,
          x,
          z,
          radius: rocks[o + 2]!,
          scale,
          variant,
        });
      }

      const roots = chunk.roots;
      const hiddenRoots = rootHiddenRef.current;
      for (let i = 0; i < chunk.rootCount && nextRoots.length < ROOT_POOL; i++) {
        const packed = packExploreRootIndex(chunk.cx, chunk.cz, i);
        if (hiddenRoots.has(packed)) continue;
        const o = i * EXPLORE_DISC_STRIDE;
        const x = roots[o]!;
        const z = roots[o + 1]!;
        const dx = x - px;
        const dz = z - pz;
        if (dx * dx + dz * dz > PROP_RADIUS2) continue;
        const scale = roots[o + 3]!;
        nextRoots.push({
          index: packed,
          x,
          z,
          scale,
          rotY: roots[o + 4]!,
        });
        nextRootLive.push({
          index: packed,
          x,
          z,
          radius: roots[o + 2]!,
          scale,
        });
      }

      const spines = chunk.spines;
      const hiddenSpines = spineHiddenRef.current;
      for (let i = 0; i < chunk.spineCount && nextSpines.length < SPINE_POOL; i++) {
        const packed = packExploreSpineIndex(chunk.cx, chunk.cz, i);
        if (hiddenSpines.has(packed)) continue;
        const o = i * EXPLORE_DISC_STRIDE;
        const x = spines[o]!;
        const z = spines[o + 1]!;
        const dx = x - px;
        const dz = z - pz;
        if (dx * dx + dz * dz > PROP_RADIUS2) continue;
        const scale = spines[o + 3]!;
        nextSpines.push({
          index: packed,
          x,
          z,
          scale,
          rotY: spines[o + 4]!,
        });
        nextSpineLive.push({
          index: packed,
          x,
          z,
          radius: spines[o + 2]!,
          scale,
        });
      }

      const mush = chunk.mushrooms;
      for (let i = 0; i < chunk.mushroomCount && nextMush.length < MUSH_POOL; i++) {
        const o = i * EXPLORE_DISC_STRIDE;
        const x = mush[o]!;
        const z = mush[o + 1]!;
        const dx = x - px;
        const dz = z - pz;
        if (dx * dx + dz * dz > MUSH_RADIUS2) continue;
        const scale = mush[o + 3]!;
        const vis = mushroomVisualFromScale(scale);
        nextMush.push({
          index: packExploreMushroomIndex(chunk.cx, chunk.cz, i),
          x,
          z,
          h: vis.h,
          cr: vis.cr,
        });
      }
    }

    for (let c = 0; c < GRASS_CHUNK_COUNT; c++) {
      const grass = grasses[c]!;
      markPoolDirty(grass, grassCounts[c]!, 16);
      const gx = c % GRASS_CHUNK_GRID;
      const gz = Math.floor(c / GRASS_CHUNK_GRID);
      const cx = originX + (gx + 0.5) * GRASS_CELL;
      const cz = originZ + (gz + 0.5) * GRASS_CELL;
      if (!grass.boundingSphere) grass.boundingSphere = new Sphere();
      grass.boundingSphere.center.set(cx, 0.5, cz);
      grass.boundingSphere.radius = GRASS_CELL_RADIUS;
    }

    const propOriginX = px - PROP_RADIUS;
    const propOriginZ = pz - PROP_RADIUS;
    lastTreePlacementsRef.current = nextTrees;
    lastRootPlacementsRef.current = nextRoots;
    lastRockPlacementsRef.current = nextRocks;
    lastSpinePlacementsRef.current = nextSpines;
    publishNearbyObstacles(
      loadedRef.current,
      px,
      pz,
      treeHiddenRef.current,
      rootHiddenRef.current,
      rockHiddenRef.current,
      spineHiddenRef.current,
    );
    if (!samePackedMembership(lastTreeLiveRef.current, nextTreeLive)) {
      publishExploreTrees(nextTreeLive);
    }
    if (!samePackedMembership(lastRootLiveRef.current, nextRootLive)) {
      publishExploreRoots(nextRootLive);
    }
    if (!samePackedMembership(lastRockLiveRef.current, nextRockLive)) {
      publishExploreRocks(nextRockLive);
    }
    if (!samePackedMembership(lastSpineLiveRef.current, nextSpineLive)) {
      publishExploreSpines(nextSpineLive);
    }
    if (!samePackedMembership(lastMushRef.current, nextMush)) {
      publishExploreMushrooms(nextMush);
    }
    lastTreeLiveRef.current = nextTreeLive;
    lastRootLiveRef.current = nextRootLive;
    lastRockLiveRef.current = nextRockLive;
    lastSpineLiveRef.current = nextSpineLive;
    lastMushRef.current = nextMush;

    const treesReady = treeWriteRef.current?.write(nextTrees, propOriginX, propOriginZ, PROP_RADIUS) ?? false;
    const rocksReady = rockWriteRef.current?.write(nextRocks, propOriginX, propOriginZ, PROP_RADIUS) ?? false;
    const rootsReady = rootWriteRef.current?.write(nextRoots, propOriginX, propOriginZ, PROP_RADIUS) ?? false;
    const spinesReady = spineWriteRef.current?.write(nextSpines, propOriginX, propOriginZ, PROP_RADIUS) ?? false;
    const mushReady = mushWriteRef.current?.write(nextMush, mushHiddenRef.current) ?? false;
    if (!treesReady || !rocksReady || !rootsReady || !spinesReady || !mushReady) return;

    lastWriteXRef.current = px;
    lastWriteZRef.current = pz;
    lastCombatRef.current = combatActiveRef.current;
    lastZoomThinRef.current = zoomThinRef.current;
    lastPropOriginXRef.current = propOriginX;
    lastPropOriginZRef.current = propOriginZ;
  };

  useFrame((_, delta) => {
    grassMat.uniforms.uTime.value += delta;

    const pos = playerPositionRef.current;
    if (!pos) return;
    const px = pos.x;
    const pz = pos.z;
    grassMat.uniforms.uFadeCenter.value.set(px, pz);

    const { cx, cz } = worldToChunk(px, pz);
    const last = lastChunkRef.current;
    if (!last || last.cx !== cx || last.cz !== cz) {
      lastChunkRef.current = { cx, cz };
      const desired = new Set<string>();
      pendingRef.current = [];
      for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
        for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
          const ncx = cx + dx;
          const ncz = cz + dz;
          const key = chunkKey(ncx, ncz);
          desired.add(key);
          if (!loadedRef.current.has(key)) {
            pendingRef.current.push({ cx: ncx, cz: ncz });
          }
        }
      }
      for (const key of loadedRef.current.keys()) {
        if (!desired.has(key)) loadedRef.current.delete(key);
      }
    }

    let generated = false;
    if (pendingRef.current.length > 0) {
      const n = Math.min(GEN_BUDGET, pendingRef.current.length);
      for (let i = 0; i < n; i++) {
        const job = pendingRef.current.shift();
        if (!job) break;
        const key = chunkKey(job.cx, job.cz);
        if (loadedRef.current.has(key)) continue;
        loadedRef.current.set(key, getOrGenerate(seed, job.cx, job.cz));
        generated = true;
      }
    }

    zoomThinRef.current = isExploreZoomClose();
    grassMat.uniforms.uWindStrength.value =
      combatActiveRef.current || zoomThinRef.current ? 0 : GRASS_WIND_STRENGTH;

    const dx = px - lastWriteXRef.current;
    const dz = pz - lastWriteZRef.current;
    const combatChanged = lastCombatRef.current !== combatActiveRef.current;
    const zoomChanged = lastZoomThinRef.current !== zoomThinRef.current;
    if (generated || combatChanged || zoomChanged || dx * dx + dz * dz >= REWRITE_STEP * REWRITE_STEP) {
      rewritePools(px, pz);
    }
  });

  return (
    <group name="explore-chunk-streamer">
      {attachGrassChunks.map((attach, i) => (
        <instancedMesh
          key={`explore-grass-${i}`}
          ref={attach}
          args={[BLADE_GEO, grassMat, GRASS_PER_CHUNK]}
          frustumCulled
          castShadow={false}
          receiveShadow={false}
        />
      ))}
      <ExploreInstancedTrees ref={treeWriteRef} pool={TREE_POOL} />
      <ExploreInstancedRocks ref={rockWriteRef} pool={ROCK_PER_CHUNK} />
      <ExploreInstancedGlbDiscs
        ref={rootWriteRef}
        name="explore-glb-roots"
        url={EXPLORE_ROOT_URL}
        meta={EXPLORE_ROOT_META}
        pool={ROOT_PER_CHUNK}
        visualScale={EXPLORE_ROOT_VISUAL_SCALE}
      />
      <ExploreInstancedGlbDiscs
        ref={spineWriteRef}
        name="explore-glb-spines"
        url={EXPLORE_SPINE_URL}
        meta={EXPLORE_SPINE_META}
        pool={SPINE_PER_CHUNK}
        visualScale={EXPLORE_SPINE_VISUAL_SCALE}
      />
      <InstancedMushrooms
        ref={mushWriteRef}
        hiddenIndices={mushroomHiddenIndices}
        maxCount={MUSH_POOL}
      />
    </group>
  );
}
