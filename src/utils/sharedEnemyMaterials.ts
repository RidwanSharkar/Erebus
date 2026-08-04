import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applySelfIllumination,
  UNIT_SELF_ILLUMINATION_INTENSITY,
} from '@/utils/disposeObject3D';

/**
 * Per-model-type shared materials.
 * Keyed by modelKey (typically the idle GLB path) → original material uuid → shared clone.
 * All instances of the same enemy type reuse these materials for GPU batching.
 */
const sharedMaterialCaches = new Map<string, Map<string, THREE.Material>>();

function getOrCreateSharedMaterial(
  modelKey: string,
  source: THREE.Material,
): THREE.Material {
  let cache = sharedMaterialCaches.get(modelKey);
  if (!cache) {
    cache = new Map();
    sharedMaterialCaches.set(modelKey, cache);
  }
  const existing = cache.get(source.uuid);
  if (existing) return existing;

  const shared = source.clone();
  shared.userData = { ...shared.userData, shared: true, sharedMaterialKey: modelKey };
  cache.set(source.uuid, shared);
  return shared;
}

export type CloneEnemySceneOptions = {
  /** When set, apply unit self-illumination (once per shared material via idempotent pass). */
  selfIlluminationIntensity?: number | null;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

/**
 * SkeletonUtils.clone + shared per-type materials (same appearance as per-instance clones
 * for static look). Death-fade / per-instance opacity mutation must call
 * {@link detachSharedMaterialsForMutation} first.
 */
export function cloneEnemySceneWithSharedMaterials(
  scene: THREE.Object3D,
  modelKey: string,
  options: CloneEnemySceneOptions = {},
): THREE.Group {
  const {
    selfIlluminationIntensity = UNIT_SELF_ILLUMINATION_INTENSITY,
    castShadow = false,
    receiveShadow = false,
  } = options;

  const clone = SkeletonUtils.clone(scene) as THREE.Group;
  clone.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mesh.material = mat.map((m) => getOrCreateSharedMaterial(modelKey, m));
    } else if (mat) {
      mesh.material = getOrCreateSharedMaterial(modelKey, mat);
    }
  });

  if (selfIlluminationIntensity != null) {
    applySelfIllumination(clone, { intensity: selfIlluminationIntensity });
  }

  return clone;
}

/**
 * Before mutating opacity/transparent for death fade, clone any shared materials
 * so other instances of the same enemy type are unaffected.
 */
export function detachSharedMaterialsForMutation(root: THREE.Object3D): void {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    if (Array.isArray(mesh.material)) {
      let changed = false;
      const next = mesh.material.map((m) => {
        if (m?.userData?.shared) {
          changed = true;
          const uniq = m.clone();
          uniq.userData = { ...uniq.userData, shared: false };
          return uniq;
        }
        return m;
      });
      if (changed) mesh.material = next;
    } else if (mesh.material.userData?.shared) {
      const uniq = mesh.material.clone();
      uniq.userData = { ...uniq.userData, shared: false };
      mesh.material = uniq;
    }
  });
}

export function isSharedMaterial(material: THREE.Material | null | undefined): boolean {
  return material?.userData?.shared === true;
}
