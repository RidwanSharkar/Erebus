'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const RESEARCH_STATION_PATH = '/models/environ/research.glb';
export { RESEARCH_STATION_PATH };
/** Native XZ ≈ 18.874. Scale to a 3.2-unit footprint (hull radius 1.6). */
export const RESEARCH_STATION_MODEL_SCALE = 0.170;
/** Native min Y ≈ 0 — already sits on the ground. */
export const RESEARCH_STATION_MODEL_Y = 0;
/** HP billboard just above the scaled crown. */
export const RESEARCH_STATION_HP_BAR_Y = 3.05;

useGLTF.preload(RESEARCH_STATION_PATH);

export function preloadResearchStation(): void {
  useGLTF.preload(RESEARCH_STATION_PATH);
}

function ResearchStationMesh({ scale = RESEARCH_STATION_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(RESEARCH_STATION_PATH);
  const clonedScene = useMemo(
    () => cloneBuildingScene(scene, RESEARCH_STATION_PATH),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, RESEARCH_STATION_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function ResearchStation({ scale, hideMesh = false }: { scale?: number; hideMesh?: boolean }) {
  if (hideMesh) return null;
  return (
    <Suspense fallback={null}>
      <ResearchStationMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(ResearchStation);
