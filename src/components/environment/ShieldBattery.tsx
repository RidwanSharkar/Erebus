'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import type { Group, Material, Mesh } from 'three';
import { cloneBuildingScene } from '@/utils/sharedEnemyMaterials';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

const SHIELD_BATTERY_PATH = '/models/environ/shieldBattery.glb';
/** Visual 50% above the 1.7-footprint fit; hull stays 0.85. */
export const SHIELD_BATTERY_MODEL_SCALE = 0.911;
/** Native min Y = 0 — already sits on the ground. */
export const SHIELD_BATTERY_MODEL_Y = 0;
/** HP billboard just above the scaled crown (native max Y ≈ 1.805 × 0.911 ≈ 1.64). */
export const SHIELD_BATTERY_HP_BAR_Y = 1.90;

const GLOW_CARD_MAT_NAME = '7fx_alphamask_glow_blue_sethrak2';

/** Hide WoW glow-card quads — alphaTest alone still leaves a black square after self-illumination. */
function hideGlowCard(root: Group): Group {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const glow = mat as Material & { name?: string };
      if ((glow.name || '') !== GLOW_CARD_MAT_NAME) continue;
      mesh.visible = false;
      break;
    }
  });
  return root;
}

useGLTF.preload(SHIELD_BATTERY_PATH);

export function preloadShieldBattery(): void {
  useGLTF.preload(SHIELD_BATTERY_PATH);
}

function ShieldBatteryMesh({ scale = SHIELD_BATTERY_MODEL_SCALE }: { scale?: number }) {
  const { scene } = useGLTF(SHIELD_BATTERY_PATH);
  const clonedScene = useMemo(
    () => hideGlowCard(cloneBuildingScene(scene, SHIELD_BATTERY_PATH)),
    [scene],
  );
  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, SHIELD_BATTERY_MODEL_Y, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
}

function ShieldBattery({ scale }: { scale?: number }) {
  return (
    <Suspense fallback={null}>
      <ShieldBatteryMesh scale={scale} />
    </Suspense>
  );
}

export default React.memo(ShieldBattery);
