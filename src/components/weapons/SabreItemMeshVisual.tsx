'use client';

import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import {
  applyWeaponItemGlow,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import {
  ASPECT_FIRE_AFFINITY,
  ASPECT_FROST_AFFINITY,
  ASPECT_WARLORD,
  type WeaponAspect,
} from '@/utils/weaponAspects';

export const SABRE_ITEM_MODEL_PATH = '/models/items/warlord1.glb';
export const FROST_AFFINITY_SABRE_MODEL_PATH = '/models/items/frostAff.glb';
export const WARLORD_SABRE_MODEL_PATH = '/models/items/warlord0.glb';

/**
 * Horizontal GLB (+X blade) → upright sabre aligned to procedural blade group.
 * Hilt was ≈ -0.55 on X; after Z +π/2 that becomes ≈ -0.55 on Y, so offset +0.55.
 */
export const SABRE_ITEM_LOCAL = {
  rotation: [0, -Math.PI / 2, Math.PI / 2] as const,
  position: [0, 0.525, 0] as const,
  scale: 0.75 as const,
};

type SabreAspectKey = 'FIRE_AFFINITY' | 'FROST_AFFINITY' | 'WARLORD';

type SabreAspectConfig = {
  path: string;
  light: string;
  /** Multiplier on SABRE_ITEM_LOCAL.scale (frostAffinity native span is ~half of sabres). */
  scaleMul: number;
};

const SABRE_ASPECT_CONFIG: Record<SabreAspectKey, SabreAspectConfig> = {
  FIRE_AFFINITY: {
    path: SABRE_ITEM_MODEL_PATH,
    light: '#ff2200',
    scaleMul: 1.1875,
  },
  FROST_AFFINITY: {
    path: FROST_AFFINITY_SABRE_MODEL_PATH,
    light: '#7dd3fc',
    // Native X ~1.13 vs sabres ~2.30 → ~2× to match Fire Affinity visual size
    scaleMul: 1.3,
  },
  WARLORD: {
    path: WARLORD_SABRE_MODEL_PATH,
    light: '#22c55e',
    scaleMul: 1.2875,
  },
};

useGLTF.preload(SABRE_ITEM_MODEL_PATH);
useGLTF.preload(FROST_AFFINITY_SABRE_MODEL_PATH);
useGLTF.preload(WARLORD_SABRE_MODEL_PATH);

export interface SabreItemMeshVisualProps {
  hand: 'left' | 'right';
  /** Throne aspect — selects GLB + accent light. Default Fire Affinity. */
  aspect?: WeaponAspect;
  /** Psionic Blades talent — purple emissive tint; default keeps native textures. */
  psionicTint?: boolean;
}

const PSIONIC_EMISSIVE = new Color('#c084fc');

type EmissiveBackup = {
  mat: MeshStandardMaterial;
  emissive: Color;
  emissiveIntensity: number;
};

function resolveSabreAspectKey(aspect: WeaponAspect | undefined): SabreAspectKey {
  if (aspect === ASPECT_FROST_AFFINITY) return 'FROST_AFFINITY';
  if (aspect === ASPECT_WARLORD) return 'WARLORD';
  if (aspect === ASPECT_FIRE_AFFINITY || aspect == null) return 'FIRE_AFFINITY';
  return 'FIRE_AFFINITY';
}

/**
 * Sabre aspect item GLB — mesh only; swing animations stay on left/right sabre refs.
 * Renders one instance; Sabres.tsx mounts two (left + right).
 */
export default function SabreItemMeshVisual({
  hand,
  aspect,
  psionicTint = false,
}: SabreItemMeshVisualProps) {
  const aspectKey = resolveSabreAspectKey(aspect);
  const config = SABRE_ASPECT_CONFIG[aspectKey];
  const { scene } = useGLTF(config.path);

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

    // Backup after weapon glow so theme restore keeps vivid emissive.
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

  useDisposeClonedMaterials(clonedScene);

  // Subtle purple emissive for Psionic Blades — restore boosted native when off.
  useEffect(() => {
    if (!psionicTint) {
      for (const backup of emissiveBackups) {
        backup.mat.emissive.copy(backup.emissive);
        backup.mat.emissiveIntensity = backup.emissiveIntensity;
        backup.mat.needsUpdate = true;
      }
      return;
    }

    for (const backup of emissiveBackups) {
      backup.mat.emissive.copy(PSIONIC_EMISSIVE);
      backup.mat.emissiveIntensity = Math.max(backup.emissiveIntensity, 3.5);
      backup.mat.needsUpdate = true;
    }
  }, [psionicTint, emissiveBackups]);

  // Match procedural handle/blade X offsets (left +0.2, right -0.2).
  const mountX = hand === 'left' ? 0.2 : -0.2;
  // Right hand mirrors so the same asset faces the correct direction.
  const mirrorX = hand === 'right' ? -1 : 1;
  const scale = SABRE_ITEM_LOCAL.scale * config.scaleMul;

  return (
    <group position={[mountX, 0, 0]} scale={[mirrorX, 1, 1]}>
      <group
        position={[
          SABRE_ITEM_LOCAL.position[0],
          SABRE_ITEM_LOCAL.position[1],
          SABRE_ITEM_LOCAL.position[2],
        ]}
        rotation={[
          SABRE_ITEM_LOCAL.rotation[0],
          SABRE_ITEM_LOCAL.rotation[1],
          SABRE_ITEM_LOCAL.rotation[2],
        ]}
        scale={scale}
      >
        <primitive object={clonedScene} />
        <PooledEffectLight
          position={[0, 0.85, 0]}
          color={config.light}
          intensity={2.5}
          distance={1}
          decay={2}
        />
      </group>
    </group>
  );
}
