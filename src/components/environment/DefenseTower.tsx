'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Group, Material, Mesh } from 'three';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const TOWER_PATH = '/models/environ/Tower2.glb';
/** Native XZ ≈ 3.018. Scale to a ~3.6-unit footprint (hull radius 1.4). */
export const DEFENSE_TOWER_MODEL_SCALE = 0.893;
/** Lift so the lowest vertex (native min Y ≈ -0.240) sits on the ground. */
export const DEFENSE_TOWER_MODEL_Y = 0.286;
/** HP billboard just above the scaled crown (native max Y ≈ 8.405). */
export const DEFENSE_TOWER_HP_BAR_Y = 8.2;
/** Crown world Y: nativeMaxY(8.405) × scale(0.893) + lift(0.286) ≈ 7.8. Keep in sync with defenseLayout + backend. */
export const DEFENSE_TOWER_MUZZLE_Y = 7.8;

/** WoW glow cards are ≤12 tris (Geoset2 = 8, Geoset3 = 4). Body geosets are hundreds. */
const TOWER_GLOW_MAX_INDEX_COUNT = 36;

useGLTF.preload(TOWER_PATH);

export function preloadDefenseTower(): void {
  useGLTF.preload(TOWER_PATH);
}

function meshIndexCount(mesh: Mesh): number {
  return mesh.geometry?.index?.count ?? 0;
}

function hasGlowMaterial(mesh: Mesh): boolean {
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  return mats.some((mat) => (mat as Material).name?.toLowerCase().includes('glow'));
}

/** Hide WoW glow-card quads — opaque black-background overlays on the pillar. */
function configureTowerGlow(root: Group): Group {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (hasGlowMaterial(mesh) || meshIndexCount(mesh) <= TOWER_GLOW_MAX_INDEX_COUNT) {
      mesh.visible = false;
    }
  });
  return root;
}

function DefenseTowerMesh({ scale = DEFENSE_TOWER_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(TOWER_PATH);
  const clonedScene = useMemo(
    () => configureTowerGlow(cloneBuildingScene(scene, TOWER_PATH)),
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
