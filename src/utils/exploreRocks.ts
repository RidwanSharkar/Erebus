export type ExploreRockInstance = {
  index: number;
  x: number;
  z: number;
  radius: number;
  scale: number;
  variant: 0 | 1;
};

type Listener = (instances: readonly ExploreRockInstance[]) => void;

let listener: Listener | null = null;

export function setExploreRockListener(fn: Listener | null): void {
  listener = fn;
}

export function publishExploreRocks(instances: readonly ExploreRockInstance[]): void {
  listener?.(instances);
}
