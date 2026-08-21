'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const SIEGE_TOWER_PATH = '/models/environ/siegeTower.glb';
/** Native XZ ≈ 25.90. Scale to a ~3.6-unit footprint (hull radius 1.4). */
export const SIEGE_TOWER_MODEL_SCALE = 0.139;
/** Lift so the lowest vertex (native min Y ≈ -1.311) sits on the ground. */
export const SIEGE_TOWER_MODEL_Y = 0.182;
/** HP billboard just above the scaled crown. */
export const SIEGE_TOWER_HP_BAR_Y = 7.04;
/** Crown world Y: nativeMaxY(46.438) × scale(0.139) + lift(0.182) ≈ 6.64. */
export const SIEGE_TOWER_MUZZLE_Y = 6.64;
export const SIEGE_TOWER_ARROW_SPEED = 40;

useGLTF.preload(SIEGE_TOWER_PATH);

export function preloadSiegeTower(): void {
  useGLTF.preload(SIEGE_TOWER_PATH);
}

function SiegeTowerMesh({ scale = SIEGE_TOWER_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(SIEGE_TOWER_PATH);
  const clonedScene = useMemo(
    () => cloneBuildingScene(scene, SIEGE_TOWER_PATH),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, SIEGE_TOWER_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function SiegeTower({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <SiegeTowerMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(SiegeTower);
