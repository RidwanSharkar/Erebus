'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import { Color, Group, Mesh, MeshStandardMaterial } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import {
  applyWeaponItemGlow,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import {
  ASPECT_BLADEMASTER,
  ASPECT_DEATHDEALER,
  ASPECT_LEGIONNAIRE,
  ASPECT_ROYAL_GUARD,
  type WeaponAspect,
} from '@/utils/weaponAspects';

export const LEGIONNAIRE_ITEM_MODEL_PATH = '/models/items/boneSWordDope.glb';
export const BLADEMASTER_ITEM_MODEL_PATH = '/models/items/runeblade.glb';
export const DEATHDEALER_ITEM_MODEL_PATH = '/models/items/MACE.glb';
export const ROYAL_GUARD_ITEM_MODEL_PATH = '/models/items/runeblade4.glb';

type RunebladeAspectKey = 'LEGIONNAIRE' | 'BLADEMASTER' | 'DEATHDEALER' | 'ROYAL_GUARD';

type RunebladeItemLocal = {
  path: string;
  rotation: readonly [number, number, number];
  position: readonly [number, number, number];
  scale: number;
  light: string;
};

/**
 * Inner transform: horizontal GLB (+X blade) → upright weapon (+Y blade)
 * aligned to the procedural Runeblade grip under the aspect mesh mount.
 * Per-aspect scales — runeblade0 / legionairre are natively larger than 1 & 3.
 */
export const RUNEBLADE_ITEM_LOCAL_BY_ASPECT: Record<
  RunebladeAspectKey,
  RunebladeItemLocal
> = {
  LEGIONNAIRE: {
    path: LEGIONNAIRE_ITEM_MODEL_PATH,
    rotation: [0, -Math.PI / 2, Math.PI / 2],
    position: [0, 0.35, 0],
    scale: 1.675,
    light: '#1097B5',
  },
  BLADEMASTER: {
    path: BLADEMASTER_ITEM_MODEL_PATH,
    rotation: [0, -Math.PI / 2, Math.PI / 2],
    position: [0, 0.35, 0],
    scale: 1.925,
    light: '#C4B5FD',
  },
  DEATHDEALER: {
    path: DEATHDEALER_ITEM_MODEL_PATH,
    rotation: [0, Math.PI / 2.25, 0],
    position: [0, 0.95, 0],
    scale: 1.5525,
    light: '#eab308',
  },
  ROYAL_GUARD: {
    path: ROYAL_GUARD_ITEM_MODEL_PATH,
    rotation: [0, -Math.PI / 2, Math.PI / 2],
    position: [0, 0.35, 0],
    scale: 1.425,
    light: '#E8CD57',
  },
};

useGLTF.preload(LEGIONNAIRE_ITEM_MODEL_PATH);
useGLTF.preload(BLADEMASTER_ITEM_MODEL_PATH);
useGLTF.preload(DEATHDEALER_ITEM_MODEL_PATH);
useGLTF.preload(ROYAL_GUARD_ITEM_MODEL_PATH);

export type RunebladeItemBladeTheme = 'default' | 'crusader' | 'titans-grip';

export interface RunebladeItemMeshVisualProps {
  /** Throne aspect — selects GLB + accent light. Default Legionnaire. */
  aspect?: WeaponAspect;
  /** Crusader / Titan's Grip talent tint. Default keeps native textures. */
  bladeTheme?: RunebladeItemBladeTheme;
  /** Extra emissive intensity (0–1) during Royal Guard Tempest charge. */
  emissiveBoost?: number;
}

const CRUSADER_EMISSIVE = new Color('#ff8800');
const TITANS_GRIP_EMISSIVE = new Color('#cc2222');

type EmissiveBackup = {
  mat: MeshStandardMaterial;
  emissive: Color;
  emissiveIntensity: number;
};

function resolveRunebladeAspectKey(
  aspect: WeaponAspect | undefined,
): RunebladeAspectKey {
  if (aspect === ASPECT_BLADEMASTER) return 'BLADEMASTER';
  if (aspect === ASPECT_DEATHDEALER) return 'DEATHDEALER';
  if (aspect === ASPECT_ROYAL_GUARD) return 'ROYAL_GUARD';
  if (aspect === ASPECT_LEGIONNAIRE || aspect == null) return 'LEGIONNAIRE';
  return 'LEGIONNAIRE';
}

/**
 * Runeblade item GLB — mesh only; swing animations stay on runebladeRef.
 * Legionnaire / Blademaster / Deathdealer / Royal Guard.
 */
export default function RunebladeItemMeshVisual({
  aspect,
  bladeTheme = 'default',
  emissiveBoost = 0,
}: RunebladeItemMeshVisualProps) {
  const aspectKey = resolveRunebladeAspectKey(aspect);
  const local = RUNEBLADE_ITEM_LOCAL_BY_ASPECT[aspectKey];
  const { scene } = useGLTF(local.path);
  const backupsRef = useRef<EmissiveBackup[]>([]);
  const bladeThemeRef = useRef(bladeTheme);
  bladeThemeRef.current = bladeTheme;
  const emissiveBoostRef = useRef(emissiveBoost);
  emissiveBoostRef.current = emissiveBoost;

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

  backupsRef.current = emissiveBackups;
  useDisposeClonedMaterials(clonedScene);

  // Theme tint for Crusader / Titan's Grip — restore boosted native on default.
  useEffect(() => {
    if (bladeTheme === 'default') {
      for (const backup of emissiveBackups) {
        backup.mat.emissive.copy(backup.emissive);
        backup.mat.emissiveIntensity = backup.emissiveIntensity;
        backup.mat.needsUpdate = true;
      }
      return;
    }

    const tint = bladeTheme === 'crusader' ? CRUSADER_EMISSIVE : TITANS_GRIP_EMISSIVE;
    const intensity = bladeTheme === 'crusader' ? 3.5 : 4.5;

    for (const backup of emissiveBackups) {
      backup.mat.emissive.copy(tint);
      backup.mat.emissiveIntensity = Math.max(backup.emissiveIntensity, intensity);
      backup.mat.needsUpdate = true;
    }
  }, [bladeTheme, emissiveBackups]);

  // Tempest charge emissive boost on top of theme base; restore when charge ends.
  useFrame(() => {
    const boost = emissiveBoostRef.current;
    const theme = bladeThemeRef.current;
    const backups = backupsRef.current;
    for (const backup of backups) {
      const base =
        theme === 'default'
          ? backup.emissiveIntensity
          : Math.max(backup.emissiveIntensity, theme === 'crusader' ? 3.5 : 4.5);
      const next = boost > 0 ? base + boost * 4 : base;
      if (backup.mat.emissiveIntensity !== next) {
        backup.mat.emissiveIntensity = next;
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
        position={[0, 0.85, 0]}
        color={local.light}
        intensity={3}
        distance={1.2}
        decay={2}
      />
    </group>
  );
}
