export type ExploreObstacleDisc = { x: number; z: number; radius: number };

type Listener = (discs: ExploreObstacleDisc[]) => void;

let listener: Listener | null = null;

export function setExploreObstacleListener(fn: Listener | null): void {
  listener = fn;
}

export function publishExploreObstacles(discs: ExploreObstacleDisc[]): void {
  listener?.(discs);
}
