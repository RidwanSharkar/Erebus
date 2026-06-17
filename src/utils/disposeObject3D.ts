import * as THREE from 'three';

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
      mesh.geometry?.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) {
        mat.forEach(disposeMaterial);
      } else if (mat) {
        disposeMaterial(mat);
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
