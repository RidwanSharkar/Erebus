'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const OBELISK_PATH = '/models/environ/obelisk.glb';
/** Native XZ ≈ 3.121. Scale to a ~1.95-unit footprint (hull radius 0.975). */
export const OBELISK_MODEL_SCALE = 0.625;
/** Lift so the lowest vertex (native min Y ≈ -0.015) sits on the ground. */
export const OBELISK_MODEL_Y = 0.009;
/** HP billboard just above the scaled crown. */
export const OBELISK_HP_BAR_Y = 2.98;

useGLTF.preload(OBELISK_PATH);

export function preloadObelisk(): void {
  useGLTF.preload(OBELISK_PATH);
}

function ObeliskMesh({ scale = OBELISK_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(OBELISK_PATH);
  const clonedScene = useMemo(
    () => cloneBuildingScene(scene, OBELISK_PATH),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, OBELISK_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function Obelisk({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <ObeliskMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(Obelisk);
