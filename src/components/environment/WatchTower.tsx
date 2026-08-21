'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const WATCH_TOWER_PATH = '/models/environ/watchTower.glb';
export { WATCH_TOWER_PATH };
/** Native XZ ≈ 30.07. Scale to a ~3.16-unit footprint (hull radius 1.4). */
export const WATCH_TOWER_MODEL_SCALE = 0.105;
/** Lift so the lowest vertex (native min Y ≈ -3.299) sits on the ground. */
export const WATCH_TOWER_MODEL_Y = 0.346;
/** HP billboard just above the scaled crown. */
export const WATCH_TOWER_HP_BAR_Y = 4.48;
/** Crown world Y: nativeMaxY(35.527) × scale(0.105) + lift(0.346) ≈ 4.08. */
export const WATCH_TOWER_MUZZLE_Y = 3.78;

useGLTF.preload(WATCH_TOWER_PATH);

export function preloadWatchTower(): void {
  useGLTF.preload(WATCH_TOWER_PATH);
}

function WatchTowerMesh({ scale = WATCH_TOWER_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(WATCH_TOWER_PATH);
  const clonedScene = useMemo(
    () => cloneBuildingScene(scene, WATCH_TOWER_PATH),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, WATCH_TOWER_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function WatchTower({ scale, hideMesh = false }: { scale?: number; hideMesh?: boolean }) {
  if (hideMesh) return null;
  return (
    <Suspense fallback={null}>
      <WatchTowerMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(WatchTower);
