'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Group } from 'three';
import { prepareDecorScene } from './FloatingTrinketMesh';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const CATHEDRAL_PATH = '/models/environ/cathedral.glb';
/** Native XZ ≈ 27.08. Scale to a 4-unit footprint (hull radius 2.0). */
export const CATHEDRAL_MODEL_SCALE = 0.1875;
/** Lift so the lowest vertex (native min Y ≈ -5.085) sits on the ground. */
export const CATHEDRAL_MODEL_Y = 0.751;
/** HP billboard just above the scaled crown. */
export const CATHEDRAL_HP_BAR_Y = 4.75;

useGLTF.preload(CATHEDRAL_PATH);

export function preloadCathedral(): void {
  useGLTF.preload(CATHEDRAL_PATH);
}

function CathedralMesh({ scale = CATHEDRAL_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(CATHEDRAL_PATH);
  const clonedScene = useMemo(
    () => prepareDecorScene(scene, true) as Group,
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, CATHEDRAL_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function Cathedral({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <CathedralMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(Cathedral);
