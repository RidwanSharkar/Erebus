'use client';

import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Box3, Color, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import {
  applyWeaponItemGlow,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';

export const HELLFIRE_CRYSTAL_SPIKE_MODEL_PATH =
  '/models/trinket/HELLFIRECRYSTALS.glb';

/**
 * Frost Affinity Shatter spike world height — shorter than Impale / tectonic
 * spikes so it emerges lower and peaks lower.
 */
export const FROST_SHATTER_SPIKE_HEIGHT = 3.5;

/** Frost Affinity Shatter — ice-blue crystal spike tint. */
const ICE_EMISSIVE = '#38bdf8';
const ICE_ALBEDO = '#7dd3fc';

useGLTF.preload(HELLFIRE_CRYSTAL_SPIKE_MODEL_PATH);

export function preloadHellfireCrystalSpikeModel(): void {
  useGLTF.preload(HELLFIRE_CRYSTAL_SPIKE_MODEL_PATH);
}

export default React.memo(function HellfireCrystalSpikeModel() {
  const { scene } = useGLTF(HELLFIRE_CRYSTAL_SPIKE_MODEL_PATH);

  const { clonedScene, scale, yOffset } = useMemo(() => {
    const modelKey = `${HELLFIRE_CRYSTAL_SPIKE_MODEL_PATH}|ice`;
    const clone = cloneEnemySceneWithSharedMaterials(scene, modelKey, {
      selfIlluminationIntensity: null,
      castShadow: true,
      receiveShadow: true,
    });

    const box = new Box3().setFromObject(clone);
    const size = new Vector3();
    box.getSize(size);
    const bindHeight = Math.max(size.y, 0.001);
    const nextScale = FROST_SHATTER_SPIKE_HEIGHT / bindHeight;
    const nextYOffset = -box.min.y * nextScale;

    applyWeaponItemGlow(clone, {
      tint: ICE_EMISSIVE,
      intensity: 1.8,
    });

    const iceEmissive = new Color(ICE_EMISSIVE);
    const iceAlbedo = new Color(ICE_ALBEDO);
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const std = mat as MeshStandardMaterial;
        if (!std?.emissive) continue;
        if (std.userData?.hellfireCrystalIceTint) continue;
        if (std.color) std.color.copy(iceAlbedo);
        std.emissive.copy(iceEmissive);
        std.emissiveIntensity = Math.max(std.emissiveIntensity ?? 1, 1.4);
        std.userData = { ...std.userData, hellfireCrystalIceTint: true };
        std.needsUpdate = true;
      }
    });

    return { clonedScene: clone, scale: nextScale, yOffset: nextYOffset };
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={scale} position={[0, yOffset, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
});
