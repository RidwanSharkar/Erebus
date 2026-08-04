'use client';

import React, { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Group, Color, Mesh, MeshStandardMaterial } from 'three';
import {
  applyWeaponItemGlow,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { SPIKE_HEIGHT } from '@/utils/tectonicSpikeGeometry';
import type { TectonicSpikeTheme } from './BossTectonicSpikeTelegraph';

export const GROUND_SPIKE_MODEL_PATH = '/models/trinket/GROUNDSPIKE.glb';

/** Bind height from GLB position accessor AABB (~11.04). */
const BIND_HEIGHT = 11.036;
const SCALE = SPIKE_HEIGHT / BIND_HEIGHT;
/** Bind pose sits slightly below origin (min Y ≈ -0.496). */
const MODEL_Y_OFFSET = 0.496 * SCALE;

const THEME_EMISSIVE: Record<TectonicSpikeTheme, string | null> = {
  earth: null, // preserve native purple/black albedo glow
  blue: '#3388dd',
  green: '#00cc44',
};

useGLTF.preload(GROUND_SPIKE_MODEL_PATH);

export function preloadGroundSpikeModel(): void {
  useGLTF.preload(GROUND_SPIKE_MODEL_PATH);
}

export default React.memo(function GroundSpikeModel({
  theme = 'earth',
}: {
  theme?: TectonicSpikeTheme;
}) {
  const { scene } = useGLTF(GROUND_SPIKE_MODEL_PATH);

  const clonedScene = useMemo(() => {
    // Theme-keyed cache so earth/blue/green emissive variants stay isolated while
    // repeated spikes of the same theme share one material set.
    const modelKey = `${GROUND_SPIKE_MODEL_PATH}|${theme}`;
    const clone = cloneEnemySceneWithSharedMaterials(scene, modelKey, {
      selfIlluminationIntensity: null,
      castShadow: true,
      receiveShadow: true,
    });

    const tintHex = THEME_EMISSIVE[theme];
    applyWeaponItemGlow(clone, {
      tint: tintHex ?? 0xffffff,
      intensity: 1.6,
    });

    // Blue/green: pull emissive toward soul-type telegraph colors while keeping albedo map.
    // Runs once per shared material (idempotent for subsequent instances of same theme).
    if (tintHex) {
      const tint = new Color(tintHex);
      clone.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const mat of mats) {
          const std = mat as MeshStandardMaterial;
          if (!std?.emissive) continue;
          if (std.userData?.groundSpikeThemeTint === tintHex) continue;
          std.emissive.copy(tint);
          std.userData = { ...std.userData, groundSpikeThemeTint: tintHex };
          std.needsUpdate = true;
        }
      });
    }

    return clone;
  }, [scene, theme]);

  useDisposeClonedMaterials(clonedScene);

  return (
    <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]}>
      <primitive object={clonedScene} />
    </group>
  );
});
