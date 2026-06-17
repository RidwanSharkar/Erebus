import { AnimationClip } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const clipPromises = new Map<string, Promise<AnimationClip[]>>();

export function loadGltfAnimationClips(path: string): Promise<AnimationClip[]> {
  const cached = clipPromises.get(path);
  if (cached) return cached;

  const promise = loader.loadAsync(path).then((gltf) =>
    (gltf.animations ?? []).map((clip) => clip.clone())
  );
  clipPromises.set(path, promise);
  return promise;
}

export function preloadGltfAnimationClips(paths: readonly string[]): void {
  paths.forEach((path) => {
    void loadGltfAnimationClips(path).catch((error) => {
      console.warn(`Failed to preload GLB animation ${path}:`, error);
    });
  });
}

export async function loadAllGltfAnimationClips<K extends string>(
  pathByKey: Record<K, string>,
): Promise<Record<K, AnimationClip[]>> {
  const entries = await Promise.all(
    (Object.entries(pathByKey) as [K, string][]).map(async ([key, path]) => {
      const clips = await loadGltfAnimationClips(path);
      return [key, clips] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<K, AnimationClip[]>;
}
