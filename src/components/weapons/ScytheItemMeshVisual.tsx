'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import {
  applyWeaponItemGlow,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import {
  ASPECT_ARCHMAGE,
  ASPECT_DRACONIC,
  ASPECT_NECROMANCER,
  type WeaponAspect,
} from '@/utils/weaponAspects';

export const ARCHMAGE_SCYTHE_ITEM_MODEL_PATH = '/models/items/bloodElf.glb';
export const NECROMANCER_SCYTHE_ITEM_MODEL_PATH = '/models/items/necromancer1.glb';
export const DRACONIC_SCYTHE_ITEM_MODEL_PATH = '/models/items/Scythe1.glb';

export type ScytheAspectKey = 'ARCHMAGE' | 'NECROMANCER' | 'DRACONIC';

type ScytheItemLocal = {
  rotation: readonly [number, number, number];
  position: readonly [number, number, number];
  scale: number;
  light: string;
  /** Handle-end trail anchors (procedural legacy: [0, ±0.7, 0]). */
  trailAnchorTop: readonly [number, number, number];
  trailAnchorBottom: readonly [number, number, number];
};

/**
 * Dualblade GLBs (+X span) → upright staff via sabre-style Euler.
 * spinnerScythe is Z/Y-long instead — uses a different rotation.
 * Trail anchors are in the handle-group space (siblings of this mesh group).
 */
export const SCYTHE_ITEM_LOCAL_BY_ASPECT: Record<ScytheAspectKey, ScytheItemLocal> = {
  // royalDualblade: X±0.927 → after upright rot, tips ≈ ±Y; length ~1.85
  ARCHMAGE: {
    rotation: [0, Math.PI / 7, Math.PI/2],
    position: [0, 0, 0],
    scale: 1.1025,
    light: '#38AECC',
    trailAnchorTop: [0, 0.55, 0],
    trailAnchorBottom: [0, -0.55, 0],
  },
  // necromancer: X±1.3 — slightly longer native span; scale down to match Archmage length
  NECROMANCER: {
    rotation: [0, Math.PI / 4, -Math.PI/2],
    position: [0, 0, 0],
    scale: 0.9125,
    light: '#22c55e',
    trailAnchorTop: [0, 0.62, 0],
    trailAnchorBottom: [0, -0.62, 0],
  },
  // spinnerScythe: native Z-long (~1.38); Rx(π/2) maps Z→−Y
  DRACONIC: {
    rotation: [0, Math.PI / 4, Math.PI/2],
    position: [0, 0.315, 0],
    scale: 1.125,
    light: '#8667E5',
    trailAnchorTop: [0, 0.66, 0],
    trailAnchorBottom: [0, -0.66, 0],
  },
};

useGLTF.preload(ARCHMAGE_SCYTHE_ITEM_MODEL_PATH);
useGLTF.preload(NECROMANCER_SCYTHE_ITEM_MODEL_PATH);
useGLTF.preload(DRACONIC_SCYTHE_ITEM_MODEL_PATH);

const EMPOWERED_EMISSIVE = new Color('#8A2BE2');

type EmissiveBackup = {
  mat: MeshStandardMaterial;
  emissive: Color;
  emissiveIntensity: number;
};

export function resolveScytheAspectKey(
  aspect: WeaponAspect | undefined,
): ScytheAspectKey {
  if (aspect === ASPECT_NECROMANCER) return 'NECROMANCER';
  if (aspect === ASPECT_DRACONIC) return 'DRACONIC';
  if (aspect === ASPECT_ARCHMAGE || aspect == null) return 'ARCHMAGE';
  return 'ARCHMAGE';
}

function modelPathForAspect(key: ScytheAspectKey): string {
  if (key === 'NECROMANCER') return NECROMANCER_SCYTHE_ITEM_MODEL_PATH;
  if (key === 'DRACONIC') return DRACONIC_SCYTHE_ITEM_MODEL_PATH;
  return ARCHMAGE_SCYTHE_ITEM_MODEL_PATH;
}

export interface ScytheItemMeshVisualProps {
  /** Throne aspect — selects GLB + accent light. Default Archmage. */
  aspect?: WeaponAspect;
  /** Purple emissive boost (legacy Legion empowerment). */
  isEmpowered?: boolean;
}

/**
 * Scythe aspect item GLB — mesh only; spin / ease animations stay on scytheRef.
 * Archmage / Necromancer / Draconic.
 */
export default function ScytheItemMeshVisual({
  aspect,
  isEmpowered = false,
}: ScytheItemMeshVisualProps) {
  const aspectKey = resolveScytheAspectKey(aspect);
  const local = SCYTHE_ITEM_LOCAL_BY_ASPECT[aspectKey];
  const path = modelPathForAspect(aspectKey);
  const { scene } = useGLTF(path);
  const backupsRef = useRef<EmissiveBackup[]>([]);

  const { clonedScene, emissiveBackups } = useMemo(() => {
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
    applyWeaponItemGlow(clone);

    const backups: EmissiveBackup[] = [];
    clone.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        const std = mat as MeshStandardMaterial;
        if (!std?.emissive) continue;
        backups.push({
          mat: std,
          emissive: std.emissive.clone(),
          emissiveIntensity: std.emissiveIntensity ?? 0,
        });
      }
    });
    return { clonedScene: clone, emissiveBackups: backups };
  }, [scene]);

  backupsRef.current = emissiveBackups;
  useDisposeClonedMaterials(clonedScene);

  // Empowered purple emissive — restore boosted native when off.
  useEffect(() => {
    if (!isEmpowered) {
      for (const backup of emissiveBackups) {
        backup.mat.emissive.copy(backup.emissive);
        backup.mat.emissiveIntensity = backup.emissiveIntensity;
        backup.mat.needsUpdate = true;
      }
      return;
    }

    for (const backup of emissiveBackups) {
      backup.mat.emissive.copy(EMPOWERED_EMISSIVE);
      backup.mat.emissiveIntensity = Math.max(backup.emissiveIntensity, 3.5);
      backup.mat.needsUpdate = true;
    }
  }, [isEmpowered, emissiveBackups]);

  return (
    <group
      position={[local.position[0], local.position[1], local.position[2]]}
      rotation={[local.rotation[0], local.rotation[1], local.rotation[2]]}
      scale={local.scale}
    >
      <primitive object={clonedScene} />
      <PooledEffectLight
        position={[0, 0.35, 0]}
        color={isEmpowered ? '#8A2BE2' : local.light}
        intensity={2.75}
        distance={1.15}
        decay={2}
      />
    </group>
  );
}
