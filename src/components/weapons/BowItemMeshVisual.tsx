'use client';

import { useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import {
  applyWeaponItemGlow,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import { hideStrayGlowShellMeshes } from '@/utils/hideStrayGlowShellMeshes';
import {
  ASPECT_BEASTMASTER,
  ASPECT_DRUID,
  ASPECT_SNIPER,
  type WeaponAspect,
} from '@/utils/weaponAspects';

export const SNIPER_BOW_ITEM_MODEL_PATH = '/models/items/GOODBOW0.glb';
export const DRUID_BOW_ITEM_MODEL_PATH = '/models/items/GOODBOW.glb';
export const BEASTMASTER_BOW_ITEM_MODEL_PATH = '/models/items/DRUIDBOW.glb';

type BowItemLocal = {
  rotation: readonly [number, number, number];
  position: readonly [number, number, number];
  scale: number;
  light: string;
};

/**
 * Native GLB limbs span ±X (arc in XY). Rotate so the bow belly faces +Z
 * (XZ plane), matching the procedural string endpoints at (±0.8, 0, 0).
 * Scales keep tip-to-tip ≈ procedural (±0.875).
 */
export const BOW_ITEM_LOCAL_BY_ASPECT: Record<
  'SNIPER' | 'DRUID' | 'BEASTMASTER',
  BowItemLocal
> = {
  // SNIPERBOW2 tip-to-tip X≈2.31 (was sniperBow ≈2.10)
  SNIPER: {
    rotation: [Math.PI / 1.75, 0, Math.PI],
    position: [0, 0.15, 0.125],
    scale: 1.31,
    light: '#a16207',
  },
  // DRUIDBOW tip-to-tip X≈1.70 (was phoenixBow ≈2.22) — scale up to match
  DRUID: {
    rotation: [-Math.PI / 2.25, 0  , 2*Math.PI],
    position: [0, -0.05, 0.105],
    scale: 1.375,
    light: '#86efac',
  },
  // beastmASTER BOW2 tip-to-tip X≈1.89 (was beastMasterBow ≈2.68) — scale up to match
  BEASTMASTER: {
    rotation: [Math.PI / 2, 0, Math.PI],
    position: [0, -0.095, 0.225],
    scale: 1.31,
    light: '#C18C4B',
  },
};

useGLTF.preload(SNIPER_BOW_ITEM_MODEL_PATH);
useGLTF.preload(DRUID_BOW_ITEM_MODEL_PATH);
useGLTF.preload(BEASTMASTER_BOW_ITEM_MODEL_PATH);

type EmissiveBackup = {
  mat: MeshStandardMaterial;
  emissive: Color;
  emissiveIntensity: number;
};

function resolveBowAspectKey(
  aspect: WeaponAspect | undefined,
): 'SNIPER' | 'DRUID' | 'BEASTMASTER' {
  if (aspect === ASPECT_DRUID) return 'DRUID';
  if (aspect === ASPECT_BEASTMASTER) return 'BEASTMASTER';
  if (aspect === ASPECT_SNIPER || aspect == null) return 'SNIPER';
  return 'SNIPER';
}

function modelPathForAspect(key: 'SNIPER' | 'DRUID' | 'BEASTMASTER'): string {
  if (key === 'DRUID') return DRUID_BOW_ITEM_MODEL_PATH;
  if (key === 'BEASTMASTER') return BEASTMASTER_BOW_ITEM_MODEL_PATH;
  return SNIPER_BOW_ITEM_MODEL_PATH;
}

export interface BowItemMeshVisualProps {
  aspect?: WeaponAspect;
  /** Written by EtherBow useFrame during perfect-shot window; 0 when idle. */
  perfectShotPulseRef: MutableRefObject<number>;
}

/**
 * Bow aspect item GLB — mesh only; string / arrow draw stay on EtherBow.
 */
export default function BowItemMeshVisual({
  aspect,
  perfectShotPulseRef,
}: BowItemMeshVisualProps) {
  const aspectKey = resolveBowAspectKey(aspect);
  const local = BOW_ITEM_LOCAL_BY_ASPECT[aspectKey];
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
    // Keep primary geoset only — GOODBOW Geoset1–4 are smoke/energy effect planes.
    hideStrayGlowShellMeshes(clone);
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

  // Perfect-shot pulse — restore base emissive when pulse returns to 0.
  useFrame(() => {
    const pulse = perfectShotPulseRef.current;
    const backups = backupsRef.current;
    if (pulse > 0) {
      for (const backup of backups) {
        backup.mat.emissiveIntensity = pulse;
      }
      return;
    }
    for (const backup of backups) {
      if (backup.mat.emissiveIntensity !== backup.emissiveIntensity) {
        backup.mat.emissiveIntensity = backup.emissiveIntensity;
      }
    }
  });

  return (
    <group
      position={[local.position[0], local.position[1], local.position[2]]}
      rotation={[local.rotation[0], local.rotation[1], local.rotation[2]]}
      scale={local.scale}
    >
      <primitive object={clonedScene} />
      <PooledEffectLight
        position={[0, 0.35, 0]}
        color={local.light}
        intensity={2.75}
        distance={1.15}
        decay={2}
      />
    </group>
  );
}
