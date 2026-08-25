'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const BEAST_TEMPLE_PATH = '/models/environ/beastTemple.glb';
/** Native XZ ≈ 12.45. Scale to a ~1.92-unit footprint (hull radius 0.96). */
export const BEAST_TEMPLE_MODEL_SCALE = 0.1542;
/** Lift so the lowest vertex (native min Y ≈ -0.273) sits on the ground. */
export const BEAST_TEMPLE_MODEL_Y = 0.042;
/** HP billboard just above the scaled crown. */
export const BEAST_TEMPLE_HP_BAR_Y = 1.66;

useGLTF.preload(BEAST_TEMPLE_PATH);

export function preloadBeastTemple(): void {
  useGLTF.preload(BEAST_TEMPLE_PATH);
}

function BeastTempleMesh({ scale = BEAST_TEMPLE_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(BEAST_TEMPLE_PATH);
  const clonedScene = useMemo(
    () => cloneBuildingScene(scene, BEAST_TEMPLE_PATH),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, BEAST_TEMPLE_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function BeastTemple({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <BeastTempleMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(BeastTemple);
