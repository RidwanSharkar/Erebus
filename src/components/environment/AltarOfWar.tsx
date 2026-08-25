'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const ALTAR_OF_WAR_PATH = '/models/environ/altarofWar.glb';
/** Native XZ ≈ 12.89. Scale to a ~1.70-unit footprint (hull radius 0.6375). */
export const ALTAR_OF_WAR_MODEL_SCALE = 0.1319;
/** Lift so the lowest vertex (native min Y ≈ -0.088) sits on the ground. */
export const ALTAR_OF_WAR_MODEL_Y = 0.012;
/** HP billboard just above the scaled crown. */
export const ALTAR_OF_WAR_HP_BAR_Y = 3.29;

useGLTF.preload(ALTAR_OF_WAR_PATH);

export function preloadAltarOfWar(): void {
  useGLTF.preload(ALTAR_OF_WAR_PATH);
}

function AltarOfWarMesh({ scale = ALTAR_OF_WAR_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(ALTAR_OF_WAR_PATH);
  const clonedScene = useMemo(
    () => cloneBuildingScene(scene, ALTAR_OF_WAR_PATH),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, ALTAR_OF_WAR_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function AltarOfWar({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <AltarOfWarMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(AltarOfWar);
