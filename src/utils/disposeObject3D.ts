import * as THREE from 'three';
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

/** Cleanup hook for SkeletonUtils.clone scenes that duplicate materials per instance. */
export function useDisposeClonedMaterials(clonedScene: THREE.Object3D | null | undefined): void {
  useEffect(() => {
    if (!clonedScene) return;
    return () => disposeClonedMaterials(clonedScene);
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
