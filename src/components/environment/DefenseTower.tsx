'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Group, Material, Mesh } from 'three';
import { prepareDecorScene } from './FloatingTrinketMesh';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const TOWER_PATH = '/models/environ/Tower2.glb';
/** Native XZ ≈ 3.018. Scale to a ~3.6-unit footprint (hull radius 1.4). */
export const DEFENSE_TOWER_MODEL_SCALE = 0.893;
/** Lift so the lowest vertex (native min Y ≈ -0.240) sits on the ground. */
export const DEFENSE_TOWER_MODEL_Y = 0.286;
/** HP billboard just above the scaled crown (native max Y ≈ 8.405). */
export const DEFENSE_TOWER_HP_BAR_Y = 8.2;
/** Crown / muzzle height for downward bolt shots. Keep in sync with defenseLayout + backend. */
export const DEFENSE_TOWER_MUZZLE_Y = 7.0;

const TOWER_GLOW_MAT_NAME = 'genericglow_alpha_128';
/** WoW glow card is RGBA + alphaMode OPAQUE — cut out black holes. */
const TOWER_GLOW_ALPHA_TEST = 0.08;

useGLTF.preload(TOWER_PATH);

export function preloadDefenseTower(): void {
  useGLTF.preload(TOWER_PATH);
}

function configureTowerGlow(root: Group): Group {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const glow = mat as Material & { name?: string; transparent?: boolean; depthWrite?: boolean };
      if ((glow.name || '') !== TOWER_GLOW_MAT_NAME) continue;
      glow.alphaTest = TOWER_GLOW_ALPHA_TEST;
      glow.transparent = false;
      glow.depthWrite = true;
      glow.needsUpdate = true;
    }
  });
  return root;
}

function DefenseTowerMesh({ scale = DEFENSE_TOWER_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(TOWER_PATH);
  const clonedScene = useMemo(
    () => configureTowerGlow(prepareDecorScene(scene, true) as Group),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, DEFENSE_TOWER_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function DefenseTower({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <DefenseTowerMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(DefenseTower);
