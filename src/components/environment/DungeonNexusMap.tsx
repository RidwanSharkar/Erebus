'use client';

import React, { Suspense, useEffect, useLayoutEffect, useMemo } from 'react';
import { Bvh, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { Color } from '@/utils/three-exports';
import {
  DUNGEON_FOG_COLOR,
  DUNGEON_NEXUS_MODEL_POSITION,
  DUNGEON_NEXUS_MODEL_SCALE,
  setDungeonMeshCollider,
} from '@/utils/dungeonLayout';
import { disposeDungeonMapScenes, prepareDungeonMapScenes } from '@/utils/dungeonMapPrep';

const LAIR_PATH = '/models/maps/lifesizeLAIR.glb';
const DUNGEON_BG = new Color(DUNGEON_FOG_COLOR);

export function preloadDungeonNexusMap(): void {
  useGLTF.preload(LAIR_PATH);
}

function DungeonNexusMapMesh() {
  const { scene: threeScene } = useThree();
  const { scene } = useGLTF(LAIR_PATH);
  const { visual, collider } = useMemo(
    () => prepareDungeonMapScenes(scene),
    [scene],
  );

  useEffect(() => {
    return () => disposeDungeonMapScenes(visual, collider);
  }, [visual, collider]);

  useLayoutEffect(() => {
    const prevBackground = threeScene.background;
    threeScene.background = DUNGEON_BG;
    return () => {
      if (threeScene.background === DUNGEON_BG) {
        threeScene.background = prevBackground;
      }
    };
  }, [threeScene]);

  useLayoutEffect(() => {
    collider.updateMatrixWorld(true);
    setDungeonMeshCollider(collider);
    return () => setDungeonMeshCollider(null);
  }, [collider]);

  return (
    <group
      name="dungeon-lifesize-lair"
      scale={DUNGEON_NEXUS_MODEL_SCALE}
      position={DUNGEON_NEXUS_MODEL_POSITION}
    >
      <primitive object={visual} />
      <Bvh>
        <primitive object={collider} />
      </Bvh>
    </group>
  );
}

function DungeonNexusMap() {
  return (
    <Suspense fallback={null}>
      <DungeonNexusMapMesh />
    </Suspense>
  );
}

export default React.memo(DungeonNexusMap);
