'use client';

import { useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Group, Mesh } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  PLAYER_SELF_ILLUMINATION_INTENSITY,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import {
  ARCHETYPE_TRINKET_MODEL_PATH,
  THRONE_ARCHETYPES,
  type ThroneArchetype,
} from '@/utils/archetypes';

type TrinketLayout = {
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  scale: number;
};

/**
 * Per-archetype layout so each GLB sits centered inside the pedestal torus
 * (~0.72–0.80 radius). Position is model-space (applied before scale).
 * ACOLYTE bind origin sits ~2.7m above the mesh.
 */
export const ARCHETYPE_TRINKET_LAYOUT: Record<ThroneArchetype, TrinketLayout> = {
  ROGUE: {
    // center ≈ [-0.07, 0.16, -0.01]
    position: [0.07, -0.16, 0.01],
    rotation: [0, Math.PI / 4, 0],
    scale: 1.675,
  },
  GLADIATOR: {
    // center ≈ [-0.18, 0.11, 0.00]
    position: [0.18, -0.11, 0],
    rotation: [0, Math.PI / 4, 0],
    scale: 0.915,
  },
  ACOLYTE: {
    // center ≈ [0.47, 2.685, -0.026]
    position: [0.05, -0.11, 0],
    rotation: [0, Math.PI / 4, 0],
    scale: 1.475,
  },
  ALCHEMIST: {
    // center ≈ [0.023, 0.198, 0.0005]
    position: [-0.02, -0.2, 0],
    rotation: [0, Math.PI / 4, 0],
    scale: 1.3,
  },
  SORCERESS: {
    // center ≈ [-0.0035, 0.088, 0.0005]
    position: [0, -0.09, 0],
    rotation: [0, Math.PI / 4, 0],
    scale: 1.69,
  },
};

for (const archetype of THRONE_ARCHETYPES) {
  useGLTF.preload(ARCHETYPE_TRINKET_MODEL_PATH[archetype]);
}

export interface ArchetypeTrinketMeshVisualProps {
  archetype: ThroneArchetype;
}

/**
 * Throne pedestal trinket GLB — mesh only; float / fade stay on ThroneFloatingWeapon.
 */
export default function ArchetypeTrinketMeshVisual({
  archetype,
}: ArchetypeTrinketMeshVisualProps) {
  const path = ARCHETYPE_TRINKET_MODEL_PATH[archetype];
  const layout = ARCHETYPE_TRINKET_LAYOUT[archetype];
  const { scene } = useGLTF(path);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.material = Array.isArray(mesh.material)
        ? mesh.material.map((m) => m.clone())
        : mesh.material.clone();
    });
    applySelfIllumination(clone, { intensity: PLAYER_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  return (
    <group
      rotation={[layout.rotation[0], layout.rotation[1], layout.rotation[2]]}
      scale={layout.scale}
    >
      {/* Position is model-space (pre-scale) so Y offsets match raw GLB centers. */}
      <group position={[layout.position[0], layout.position[1], layout.position[2]]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
