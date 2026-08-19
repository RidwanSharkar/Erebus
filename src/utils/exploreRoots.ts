import type { ExploreRootInstance } from './exploreGroundPropLayout';

type Listener = (instances: readonly ExploreRootInstance[]) => void;

let listener: Listener | null = null;

export function setExploreRootListener(fn: Listener | null): void {
  listener = fn;
}

export function publishExploreRoots(instances: readonly ExploreRootInstance[]): void {
  listener?.(instances);
}
