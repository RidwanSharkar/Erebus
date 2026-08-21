'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const SPIRIT_LOUNGE_PATH = '/models/environ/spiritLounge2.glb';
export { SPIRIT_LOUNGE_PATH };
/** Native XZ ≈ 18.874. Scale to a 3.2-unit footprint (hull radius 1.6). */
export const SPIRIT_LOUNGE_MODEL_SCALE = 0.170;
/** Native min Y ≈ 0 — already sits on the ground. */
export const SPIRIT_LOUNGE_MODEL_Y = 0;
/** HP billboard just above the scaled crown. */
export const SPIRIT_LOUNGE_HP_BAR_Y = 3.05;

useGLTF.preload(SPIRIT_LOUNGE_PATH);

export function preloadSpiritLounge(): void {
  useGLTF.preload(SPIRIT_LOUNGE_PATH);
}

function SpiritLoungeMesh({ scale = SPIRIT_LOUNGE_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(SPIRIT_LOUNGE_PATH);
  const clonedScene = useMemo(
    () => cloneBuildingScene(scene, SPIRIT_LOUNGE_PATH),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, SPIRIT_LOUNGE_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function SpiritLounge({ scale, hideMesh = false }: { scale?: number; hideMesh?: boolean }) {
  if (hideMesh) return null;
  return (
    <Suspense fallback={null}>
      <SpiritLoungeMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(SpiritLounge);
