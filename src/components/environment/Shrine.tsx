'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import { prepareDecorScene } from './FloatingTrinketMesh';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const SHRINE_PATH = '/models/environ/shrine.glb';
/** Native XZ ≈ 3.817. Scale to a 3.2-unit footprint (hull radius 1.6). */
export const SHRINE_MODEL_SCALE = 0.838;
/** Lift so the lowest vertex (native min Y ≈ -0.974) sits on the ground. */
export const SHRINE_MODEL_Y = 0.816;
/** HP billboard just above the scaled crown. */
export const SHRINE_HP_BAR_Y = 5.35;

useGLTF.preload(SHRINE_PATH);

export function preloadShrine(): void {
  useGLTF.preload(SHRINE_PATH);
}

function ShrineMesh({ scale = SHRINE_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(SHRINE_PATH);
  const clonedScene = useMemo(
    () => prepareDecorScene(scene, true) as Group,
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
