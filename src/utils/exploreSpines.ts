export type ExploreSpineInstance = {
  index: number;
  x: number;
  z: number;
  radius: number;
  scale: number;
};

type Listener = (instances: readonly ExploreSpineInstance[]) => void;

let listener: Listener | null = null;

export function setExploreSpineListener(fn: Listener | null): void {
  listener = fn;
}

export function publishExploreSpines(instances: readonly ExploreSpineInstance[]): void {
  listener?.(instances);
}
