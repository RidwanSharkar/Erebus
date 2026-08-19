import type { ExploreTreeInstance } from './exploreTreeLayout';

type Listener = (instances: readonly ExploreTreeInstance[]) => void;

let listener: Listener | null = null;

export function setExploreTreeListener(fn: Listener | null): void {
  listener = fn;
}

export function publishExploreTrees(instances: readonly ExploreTreeInstance[]): void {
  listener?.(instances);
}
