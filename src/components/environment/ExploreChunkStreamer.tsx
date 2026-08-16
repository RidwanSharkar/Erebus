'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  mushroomVisualFromScale,
  exploreRockVariant,
  type ExploreChunkData,
} from '@/utils/exploreWorldGen';
import { publishExploreObstacles, type ExploreObstacleDisc } from '@/utils/exploreObstacles';
import { publishExploreMushrooms } from '@/utils/exploreMushrooms';
import type { MushroomInstance } from '@/utils/mushroomLayout';
import InstancedMushrooms from './InstancedMushrooms';
import ExploreInstancedRocks, {
  preloadExploreRockGlbs,
  type ExploreRockPlacement,
} from './ExploreInstancedRocks';
import ExploreInstancedTrees, {
  preloadExploreTreeGlbs,
  type ExploreTreePlacement,
} from './ExploreInstancedTrees';
import { exploreTreeVariant } from '@/utils/exploreTreeLayout';
import { GRASS_VERTEX, GRASS_FRAGMENT } from './StylizedGrass';

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

const GRASS_POOL = 4000;
const GRASS_CHUNK_GRID = 3;
const GRASS_CHUNK_COUNT = GRASS_CHUNK_GRID * GRASS_CHUNK_GRID;
const GRASS_PER_CHUNK = Math.ceil((GRASS_POOL * 1.6) / GRASS_CHUNK_COUNT);
const GRASS_CELL = (GRASS_RADIUS * 2) / GRASS_CHUNK_GRID;
const GRASS_CELL_RADIUS = GRASS_CELL * Math.SQRT1_2 + 1.25;
const COMBAT_GRASS_SCALE = 0.5;
const TREE_POOL = 256;
const ROCK_POOL = 192;
const MUSH_POOL = 128;

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

function publishNearbyObstacles(loaded: Map<string, ExploreChunkData>, px: number, pz: number): void {
  const next = obstacleUseA ? obstacleBufA : obstacleBufB;
  obstacleUseA = !obstacleUseA;
  next.length = 0;
  for (const chunk of loaded.values()) {
    const trees = chunk.trees;
    for (let i = 0; i < chunk.treeCount; i++) {
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
      const o = i * EXPLORE_DISC_STRIDE;
      const x = rocks[o]!;
      const z = rocks[o + 1]!;
      const dx = x - px;
      const dz = z - pz;
      if (dx * dx + dz * dz > OBSTACLE_RADIUS2) continue;
      next.push({ x, z, radius: rocks[o + 2]! });
    }
  }
  publishExploreObstacles(next);
}

interface ExploreChunkStreamerProps {
  seed: number;
  playerPositionRef: React.MutableRefObject<Vector3Type>;
  combatActive?: boolean;
  mushroomHiddenIndices?: ReadonlySet<number>;
}

preloadExploreRockGlbs();
preloadExploreTreeGlbs();

export default function ExploreChunkStreamer({
  seed,
  playerPositionRef,
  combatActive = false,
  mushroomHiddenIndices,
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
  const [treePlacements, setTreePlacements] = useState<ExploreTreePlacement[]>([]);
  const [rockPlacements, setRockPlacements] = useState<ExploreRockPlacement[]>([]);
  const [mushInstances, setMushInstances] = useState<MushroomInstance[]>([]);

  const loadedRef = useRef(new Map<string, ExploreChunkData>());
  const pendingRef = useRef<Array<{ cx: number; cz: number }>>([]);
  const lastChunkRef = useRef<{ cx: number; cz: number } | null>(null);
  const lastWriteXRef = useRef(Number.POSITIVE_INFINITY);
  const lastWriteZRef = useRef(Number.POSITIVE_INFINITY);
  const lastCombatRef = useRef(combatActive);
  const combatActiveRef = useRef(combatActive);
  combatActiveRef.current = combatActive;

  const grassMat = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uTime: { value: 0 },
          uBaseColor: { value: new Color('#2d5a28') },
          uTipColor: { value: new Color('#4caf50') },
          uWindStrength: { value: 0.22 },
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
    setTreePlacements([]);
    setRockPlacements([]);
    setMushInstances([]);
  }, [seed]);

  const rewritePools = (px: number, pz: number) => {
    const grasses = grassRefs.current;
    for (let c = 0; c < GRASS_CHUNK_COUNT; c++) {
      if (!grasses[c]) return;
    }

    const grassCounts = new Int32Array(GRASS_CHUNK_COUNT);
    const originX = px - GRASS_RADIUS;
    const originZ = pz - GRASS_RADIUS;
    const combatThin = combatActiveRef.current;
    let grassN = 0;
    const grassBudget = combatThin ? Math.floor(GRASS_POOL * COMBAT_GRASS_SCALE) : GRASS_POOL;
    const nextTrees: ExploreTreePlacement[] = [];
    const nextRocks: ExploreRockPlacement[] = [];
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
      for (let i = 0; i < chunk.treeCount && nextTrees.length < TREE_POOL; i++) {
        const o = i * EXPLORE_DISC_STRIDE;
        const x = trees[o]!;
        const z = trees[o + 1]!;
        const dx = x - px;
        const dz = z - pz;
        if (dx * dx + dz * dz > PROP_RADIUS2) continue;
        nextTrees.push({
          x,
          z,
          scale: trees[o + 3]!,
          rotY: trees[o + 4]!,
          variant: exploreTreeVariant(x, z),
        });
      }

      const rocks = chunk.rocks;
      for (let i = 0; i < chunk.rockCount && nextRocks.length < ROCK_POOL; i++) {
        const o = i * EXPLORE_DISC_STRIDE;
        const x = rocks[o]!;
        const z = rocks[o + 1]!;
        const dx = x - px;
        const dz = z - pz;
        if (dx * dx + dz * dz > PROP_RADIUS2) continue;
        const scale = rocks[o + 3]!;
        nextRocks.push({
          x,
          z,
          scale,
          rotY: rocks[o + 4]!,
          variant: exploreRockVariant(x, z),
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

    lastWriteXRef.current = px;
    lastWriteZRef.current = pz;
    lastCombatRef.current = combatThin;
    publishNearbyObstacles(loadedRef.current, px, pz);
    publishExploreMushrooms(nextMush);
    setTreePlacements(nextTrees);
    setRockPlacements(nextRocks);
    setMushInstances(nextMush);
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

    const dx = px - lastWriteXRef.current;
    const dz = pz - lastWriteZRef.current;
    const combatChanged = lastCombatRef.current !== combatActiveRef.current;
    if (generated || combatChanged || dx * dx + dz * dz >= REWRITE_STEP * REWRITE_STEP) {
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
      <ExploreInstancedTrees placements={treePlacements} />
      <ExploreInstancedRocks placements={rockPlacements} />
      <InstancedMushrooms
        instances={mushInstances}
        hiddenIndices={mushroomHiddenIndices}
        maxCount={MUSH_POOL}
      />
    </group>
  );
}
