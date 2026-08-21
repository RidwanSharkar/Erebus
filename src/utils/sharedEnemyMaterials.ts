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

/** Explore building unlit materials — keyed by modelKey → source uuid. */
const buildingUnlitCaches = new Map<string, Map<string, THREE.Material>>();

const BUILDING_UNLIT_BOOST = 1.12;
const BUILDING_ALPHA_MASK = 0.5;

/** FX / fire mats must stay special-cased (additive or hidden), not converted to opaque unlit. */
function isBuildingFxMaterial(mat: THREE.Material): boolean {
  const name = (mat.name || '').toLowerCase();
  return (
    name === 'firewall2b' ||
    name.includes('genericglow') ||
    name.includes('alphamask_glow') ||
    name.includes('7fx_')
  );
}

/** Roofs / cathedral cutouts that already carry unused alpha — MASK, never BLEND. */
function isBuildingAlphaCutoutMaterial(mat: THREE.Material): boolean {
  const name = (mat.name || '').toLowerCase();
  return (
    name.includes('aroof_02') ||
    name.includes('aroof_02a') ||
    name.includes('cathedral') ||
    name.includes('pa_shrine') ||
    name.includes('thatch') ||
    name.includes('alphamask') ||
    /leaf|leaves|pine|branch|vine|needle/.test(name)
  );
}

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

/**
 * MeshStandard → MeshBasic so explore buildings skip the ~58 pooled point-light loop.
 * Alpha-cutout roofs get alphaTest (MASK), never transparent BLEND.
 */
function getOrCreateBuildingUnlitMaterial(
  modelKey: string,
  source: THREE.Material,
): THREE.Material {
  let cache = buildingUnlitCaches.get(modelKey);
  if (!cache) {
    cache = new Map();
    buildingUnlitCaches.set(modelKey, cache);
  }
  const existing = cache.get(source.uuid);
  if (existing) return existing;

  if (isBuildingFxMaterial(source)) {
    const shared = source.clone();
    shared.userData = {
      ...shared.userData,
      shared: true,
      sharedMaterialKey: modelKey,
      buildingFx: true,
    };
    cache.set(source.uuid, shared);
    return shared;
  }

  const src = source as THREE.Material & {
    map?: THREE.Texture | null;
    color?: THREE.Color;
    side?: number;
    alphaTest?: number;
  };
  const unlit = new THREE.MeshBasicMaterial({
    map: src.map ?? null,
    color: src.color ? src.color.clone() : new THREE.Color(0xffffff),
    side: src.side ?? THREE.FrontSide,
    fog: true,
    toneMapped: true,
  });
  unlit.color.multiplyScalar(BUILDING_UNLIT_BOOST);
  unlit.transparent = false;
  unlit.depthWrite = true;

  if (isBuildingAlphaCutoutMaterial(source) || (src.alphaTest ?? 0) > 0) {
    unlit.alphaTest = Math.max(src.alphaTest ?? 0, BUILDING_ALPHA_MASK);
    unlit.side = THREE.FrontSide;
  }

  unlit.userData = {
    ...unlit.userData,
    shared: true,
    sharedMaterialKey: modelKey,
    buildingUnlit: true,
  };
  cache.set(source.uuid, unlit);
  return unlit;
}

export type CloneEnemySceneOptions = {
  /** When set, apply unit self-illumination (once per shared material via idempotent pass). */
  selfIlluminationIntensity?: number | null;
  castShadow?: boolean;
  receiveShadow?: boolean;
  frustumCulled?: boolean;
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
    frustumCulled,
  } = options;

  const clone = SkeletonUtils.clone(scene) as THREE.Group;
  clone.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    if (frustumCulled != null) mesh.frustumCulled = frustumCulled;
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
 * Explore building GLBs — unlit MeshBasic (no 58-light loop), shared mats, no shadows,
 * frustum culled. FX/fire mats left for callers to configure; alpha cutouts use MASK.
 */
export function cloneBuildingScene(
  scene: THREE.Object3D,
  modelKey: string,
  options: CloneEnemySceneOptions = {},
): THREE.Group {
  const {
    castShadow = false,
    receiveShadow = false,
    frustumCulled = true,
  } = options;

  const clone = SkeletonUtils.clone(scene) as THREE.Group;
  clone.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = frustumCulled;
    const mat = mesh.material;
    if (Array.isArray(mat)) {
      mesh.material = mat.map((m) => getOrCreateBuildingUnlitMaterial(modelKey, m));
    } else if (mat) {
      mesh.material = getOrCreateBuildingUnlitMaterial(modelKey, mat);
    }
  });

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

export function isBuildingFxMaterialName(name: string | undefined | null): boolean {
  return isBuildingFxMaterial({ name: name || '' } as THREE.Material);
}
