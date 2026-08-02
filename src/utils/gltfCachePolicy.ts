import { useGLTF } from '@react-three/drei';

/**
 * Evicts one GLB/GLTF URL from Drei / R3F's in-memory loader cache (`useLoader.clear(GLTFLoader, path)`).
 *
 * - Throne-room weapon pedestals use the same `*ItemMeshVisual` GLBs as gameplay weapons.
 * - Character / enemy models preload many files; session cache is intentional for fast remounts.
 * - Only call when a specific asset will not be needed again (no component may still `useGLTF` that path).
 * - Do **not** clear globally on every coop portal — that would force reloads and can race with in-flight loads.
 */
export function evictGltfLoaderCacheEntry(assetPath: string): void {
  useGLTF.clear(assetPath);
}
