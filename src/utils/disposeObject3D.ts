import * as THREE from 'three';
import type { ColorRepresentation } from 'three';
import type { RefObject } from 'react';
import { useEffect } from 'react';

function isSharedResource(
  resource: { userData?: { shared?: boolean } } | null | undefined,
): boolean {
  return resource?.userData?.shared === true;
}

/** Skip module-level / singleton geometries marked with userData.shared. */
export function disposeGeometrySafe(geometry: THREE.BufferGeometry | undefined): void {
  if (!geometry || isSharedResource(geometry)) return;
  geometry.dispose();
}

/** Skip module-level / singleton materials marked with userData.shared. */
export function disposeMaterialSafe(material: THREE.Material | undefined): void {
  if (!material || isSharedResource(material)) return;
  disposeMaterial(material);
}

/**
 * Recursively dispose all geometries, materials, and textures attached to a
 * Three.js Object3D hierarchy.  Safe to call on unmount for any group or scene
 * created at component level (cloned GLTF scenes, procedural meshes, etc.).
 *
 * Does NOT dispose shared/singleton resources (e.g. module-level constants).
 * Only call this on objects that are *owned* by the component being unmounted.
 */
export function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const mesh = child as THREE.Mesh;
      disposeGeometrySafe(mesh.geometry);
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach(disposeMaterialSafe);
      } else if (mat) {
        disposeMaterialSafe(mat);
      }
    }
  });
}

function disposeMaterial(material: THREE.Material): void {
  // Dispose every texture slot that exists on the material
  const m = material as unknown as Record<string, unknown>;
  for (const key of Object.keys(m)) {
    const val = m[key];
    if (val instanceof THREE.Texture) {
      val.dispose();
    }
  }
  material.dispose();
}

/** Dispose only cloned GLB materials (geometries stay shared with the cache). */
export function disposeClonedMaterials(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mat = (child as THREE.Mesh).material;
    if (Array.isArray(mat)) {
      mat.forEach((m) => m?.dispose());
    } else if (mat) {
      mat.dispose();
    }
  });
}

/**
 * SkeletonUtils.clone() gives each instance its own Skeleton, and each Skeleton
 * lazily owns a bone DataTexture that only Skeleton.dispose() frees.
 * Without this, every enemy spawn permanently increments renderer.info.memory.textures.
 */
export function disposeClonedSkeletons(object: THREE.Object3D): void {
  const seen = new Set<THREE.Skeleton>();
  object.traverse((child) => {
    const skinned = child as THREE.SkinnedMesh;
    if (!skinned.isSkinnedMesh) return;
    const skeleton = skinned.skeleton;
    if (!skeleton || seen.has(skeleton)) return;
    seen.add(skeleton);
    skeleton.dispose();
  });
}

/** Cleanup hook for SkeletonUtils.clone scenes that duplicate materials per instance. */
export function useDisposeClonedMaterials(clonedScene: THREE.Object3D | null | undefined): void {
  useEffect(() => {
    if (!clonedScene) return;
    return () => {
      disposeClonedMaterials(clonedScene);
      disposeClonedSkeletons(clonedScene);
    };
  }, [clonedScene]);
}

/** Stop clips and uncache the mixer root on unmount to avoid PropertyBinding warnings. */
export function useCleanupAnimationMixer(
  mixer: THREE.AnimationMixer | undefined,
  rootRef: RefObject<THREE.Object3D | null>,
): void {
  useEffect(() => {
    if (!mixer) return;
    return () => {
      mixer.stopAllAction();
      const root = rootRef.current;
      if (root) mixer.uncacheRoot(root);
    };
  }, [mixer, rootRef]);
}

export interface SelfIlluminationOptions {
  /** Default 0.5 — medium readability in dark rooms while keeping mood. */
  intensity?: number;
  /** Multiplier applied to emissiveMap output. Default white. */
  tint?: ColorRepresentation;
}

/** Player character — subtle; player also gets effect lights/cosmetics. */
export const PLAYER_SELF_ILLUMINATION_INTENSITY = 0.5;
/** Enemies, bosses, and allied units — baseline fill for dark rooms. */
export const UNIT_SELF_ILLUMINATION_INTENSITY = 0.18;
/** Knight armor is very dark PBR metal; needs ~2× the default unit fill. */
export const KNIGHT_SELF_ILLUMINATION_INTENSITY = 1.25;
/** Shade is intentionally shadowy; lowest fill of all units. */
export const SHADE_SELF_ILLUMINATION_INTENSITY = 0.06;
/** Warlock robes are very dark; needs nearly as much fill as Knight. */
export const WARLOCK_SELF_ILLUMINATION_INTENSITY = 0.85;

const DEFAULT_SELF_ILLUMINATION_INTENSITY = PLAYER_SELF_ILLUMINATION_INTENSITY;
const UNTEXTURED_SELF_ILLUMINATION_SCALE = 0.6;

function hasMeaningfulEmissiveGlow(mat: {
  emissiveMap?: unknown;
  emissiveIntensity?: number;
}): boolean {
  return !!mat.emissiveMap && (mat.emissiveIntensity ?? 0) > 0.05;
}

function applySelfIlluminationToMaterial(
  mat: {
    map?: unknown;
    color?: { copy: (color: unknown) => unknown };
    emissive?: { set: (color: ColorRepresentation) => unknown; copy: (color: unknown) => unknown };
    emissiveMap?: unknown;
    emissiveIntensity?: number;
    needsUpdate?: boolean;
  },
  intensity: number,
  tint: ColorRepresentation,
): void {
  if (!mat.emissive) return;
  if (hasMeaningfulEmissiveGlow(mat)) return;

  if (mat.map) {
    mat.emissiveMap = mat.map;
    mat.emissive.set(tint);
    mat.emissiveIntensity = intensity;
  } else if (mat.color) {
    mat.emissive.copy(mat.color);
    mat.emissiveIntensity = intensity * UNTEXTURED_SELF_ILLUMINATION_SCALE;
  } else {
    mat.emissive.set(tint);
    mat.emissiveIntensity = intensity * UNTEXTURED_SELF_ILLUMINATION_SCALE;
  }

  mat.needsUpdate = true;
}

/**
 * Makes a cloned character mesh readable in dark scenes without adding point lights.
 * Reuses each material's albedo map as emissiveMap so texture colors stay visible.
 * Call only on per-instance cloned materials.
 */
export function applySelfIllumination(
  root: THREE.Object3D,
  options: SelfIlluminationOptions = {},
): void {
  const intensity = options.intensity ?? DEFAULT_SELF_ILLUMINATION_INTENSITY;
  const tint = options.tint ?? 0xffffff;

  root.traverse((child) => {
    const mesh = child as {
      isMesh?: boolean;
      material?: unknown;
    };
    if (!mesh.isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (typeof material !== 'object' || material === null || !('emissive' in material)) {
        continue;
      }
      applySelfIlluminationToMaterial(
        material as Parameters<typeof applySelfIlluminationToMaterial>[0],
        intensity,
        tint,
      );
    }
  });
}

/** Player weapon item GLBs — match procedural sabre/runeblade vivid emissive. */
export const WEAPON_ITEM_EMISSIVE_INTENSITY = 2;
/** Mats that already had emissiveMap — boost harder so baked glow still pops. */
export const WEAPON_ITEM_EMISSIVE_INTENSITY_GLOW = 4;

export interface WeaponItemGlowOptions {
  intensity?: number;
  /** Boost existing emissiveMap materials instead of skipping them. Default true. */
  force?: boolean;
  tint?: ColorRepresentation;
}

type WeaponGlowMaterial = {
  map?: unknown;
  color?: { copy: (color: unknown) => unknown };
  emissive?: {
    set: (color: ColorRepresentation) => unknown;
    copy: (color: unknown) => unknown;
  };
  emissiveMap?: unknown;
  emissiveIntensity?: number;
  metalness?: number;
  roughness?: number;
  toneMapped?: boolean;
  needsUpdate?: boolean;
};

function applyWeaponItemGlowToMaterial(
  mat: WeaponGlowMaterial,
  intensity: number,
  glowIntensity: number,
  force: boolean,
  tint: ColorRepresentation,
): void {
  if (!mat.emissive) return;

  const hadGlow = hasMeaningfulEmissiveGlow(mat);
  if (hadGlow && !force) return;

  if (mat.map) {
    mat.emissiveMap = mat.map;
    mat.emissive.set(tint);
  } else if (mat.color) {
    mat.emissive.copy(mat.color);
  } else {
    mat.emissive.set(tint);
  }

  mat.emissiveIntensity = hadGlow ? glowIntensity : intensity;
  mat.toneMapped = false;
  if (typeof mat.metalness === 'number') {
    mat.metalness = Math.min(mat.metalness, 0.35);
  }
  if (typeof mat.roughness === 'number') {
    mat.roughness = Math.min(mat.roughness, 0.2);
  }
  mat.needsUpdate = true;
}

/**
 * High-emissive pass for player weapon item GLBs (sabres / runeblade).
 * Unlike unit self-illumination, this boosts (not skips) materials with baked emissiveMaps
 * and disables tone mapping so blades read as vivid as procedural weapons.
 * Call only on per-instance cloned materials.
 */
export function applyWeaponItemGlow(
  root: THREE.Object3D,
  options: WeaponItemGlowOptions = {},
): void {
  const intensity = options.intensity ?? WEAPON_ITEM_EMISSIVE_INTENSITY;
  const glowIntensity = WEAPON_ITEM_EMISSIVE_INTENSITY_GLOW;
  const force = options.force !== false;
  const tint = options.tint ?? 0xffffff;

  root.traverse((child) => {
    const mesh = child as {
      isMesh?: boolean;
      material?: unknown;
    };
    if (!mesh.isMesh || !mesh.material) return;

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (typeof material !== 'object' || material === null || !('emissive' in material)) {
        continue;
      }
      applyWeaponItemGlowToMaterial(
        material as WeaponGlowMaterial,
        intensity,
        glowIntensity,
        force,
        tint,
      );
    }
  });
}
