'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const SHRINE_PATH = '/models/environ/shrine.glb';
/** Native XZ ≈ 3.817. Scale to a ~1.92-unit footprint (hull radius 0.96). */
export const SHRINE_MODEL_SCALE = 0.503;
/** Lift so the lowest vertex (native min Y ≈ -0.974) sits on the ground. */
export const SHRINE_MODEL_Y = 0.49;
/** HP billboard just above the scaled crown. */
export const SHRINE_HP_BAR_Y = 3.21;

useGLTF.preload(SHRINE_PATH);

export function preloadShrine(): void {
  useGLTF.preload(SHRINE_PATH);
}

function ShrineMesh({ scale = SHRINE_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(SHRINE_PATH);
  const clonedScene = useMemo(
    () => cloneBuildingScene(scene, SHRINE_PATH),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, SHRINE_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function Shrine({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <ShrineMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(Shrine);
