'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import { prepareDecorScene } from './FloatingTrinketMesh';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const SPIRIT_LOUNGE_PATH = '/models/environ/spiritLounge.glb';
/** Native XZ ≈ 27.08. Scale to a 4-unit footprint (hull radius 2.0). */
export const SPIRIT_LOUNGE_MODEL_SCALE = 0.1875;
/** Lift so the lowest vertex (native min Y ≈ -5.085) sits on the ground. */
export const SPIRIT_LOUNGE_MODEL_Y = 0.751;
/** HP billboard just above the scaled crown. */
export const SPIRIT_LOUNGE_HP_BAR_Y = 4.15;

useGLTF.preload(SPIRIT_LOUNGE_PATH);

export function preloadSpiritLounge(): void {
  useGLTF.preload(SPIRIT_LOUNGE_PATH);
}

function SpiritLoungeMesh({ scale = SPIRIT_LOUNGE_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(SPIRIT_LOUNGE_PATH);
  const clonedScene = useMemo(
    () => prepareDecorScene(scene, true) as Group,
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, SPIRIT_LOUNGE_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function SpiritLounge({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <SpiritLoungeMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(SpiritLounge);
