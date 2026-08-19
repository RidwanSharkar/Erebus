'use client';

import React, { Suspense, useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import {
  DEFENSE_CULL_CELL_NATIVE,
  disposeStaticMapVisual,
  prepareStaticMapVisual,
} from '@/utils/dungeonMapPrep';

const ARENA_PATH = '/models/maps/orgrimmararena.glb';
/**
 * Native AABB minY ≈ -32 is the trap-door pit under the cage — not the floor.
 * Ground / grate surface sits at native Y ≈ -5.292. Lift so that plane is world Y=0
 * (offsets scale with MODEL_SCALE). Pit XZ centroid ≈ (0.69, -0.96).
 */
export const DEFENSE_ARENA_MODEL_SCALE = 0.455;
export const DEFENSE_ARENA_MODEL_POSITION: [number, number, number] = [-0.552, 2.534, 0.768];

export function preloadDefenseArenaMap(): void {
  useGLTF.preload(ARENA_PATH);
}

function DefenseArenaMapMesh() {
  const { scene } = useGLTF(ARENA_PATH);
  const visual = useMemo(
    () =>
      prepareStaticMapVisual(scene, {
        cellSize: DEFENSE_CULL_CELL_NATIVE,
        name: 'defense-arena-visual',
      }),
    [scene],
  );

  useEffect(() => {
    return () => disposeStaticMapVisual(visual);
  }, [visual]);

  return (
    <group
      name="defense-orgrimmar-arena"
      scale={DEFENSE_ARENA_MODEL_SCALE}
      position={DEFENSE_ARENA_MODEL_POSITION}
    >
      <primitive object={visual} />
    </group>
  );
}

function DefenseArenaMap() {
  return (
    <Suspense fallback={null}>
      <DefenseArenaMapMesh />
    </Suspense>
  );
}

export default React.memo(DefenseArenaMap);
