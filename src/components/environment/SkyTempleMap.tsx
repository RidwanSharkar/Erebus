'use client';

import React, { Suspense, useEffect, useLayoutEffect, useMemo } from 'react';
import { Bvh, useGLTF } from '@react-three/drei';
import {
  SKY_TEMPLE_MODEL_POSITION,
  SKY_TEMPLE_MODEL_SCALE,
} from '@/utils/skyTempleLayout';
import { setDungeonMeshCollider } from '@/utils/dungeonLayout';
import {
  SKY_TEMPLE_CULL_CELL_NATIVE,
  disposeDungeonMapScenes,
  prepareMeshMapScenes,
} from '@/utils/dungeonMapPrep';

const TEMPLE_PATH = '/models/maps/lifesizeTemple.glb';
/** Unlit albedo scale — the GLB is authored very bright; 0.8 knocks it down slightly. */
const SKY_TEMPLE_ALBEDO_SCALE = 0.8;

export function preloadSkyTempleMap(): void {
  useGLTF.preload(TEMPLE_PATH);
}

function SkyTempleMapMesh() {
  const { scene } = useGLTF(TEMPLE_PATH);
  const { visual, collider } = useMemo(
    () =>
      prepareMeshMapScenes(scene, {
        cellSize: SKY_TEMPLE_CULL_CELL_NATIVE,
        visualName: 'sky-temple-visual',
        colliderName: 'sky-temple-collider',
        colorScale: SKY_TEMPLE_ALBEDO_SCALE,
      }),
    [scene],
  );

  useEffect(() => {
    return () => disposeDungeonMapScenes(visual, collider);
  }, [visual, collider]);

  useLayoutEffect(() => {
    collider.updateMatrixWorld(true);
    setDungeonMeshCollider(collider);
    return () => setDungeonMeshCollider(null);
  }, [collider]);

  return (
    <group
      name="sky-temple-lifesize"
      scale={SKY_TEMPLE_MODEL_SCALE}
      position={SKY_TEMPLE_MODEL_POSITION}
    >
      <primitive object={visual} />
      <Bvh>
        <primitive object={collider} />
      </Bvh>
    </group>
  );
}

function SkyTempleMap() {
  return (
    <Suspense fallback={null}>
      <SkyTempleMapMesh />
    </Suspense>
  );
}

export default React.memo(SkyTempleMap);
