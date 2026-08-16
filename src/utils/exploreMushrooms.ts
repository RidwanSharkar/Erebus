import type { MushroomInstance } from './mushroomLayout';

type Listener = (instances: readonly MushroomInstance[]) => void;

let listener: Listener | null = null;

export function setExploreMushroomListener(fn: Listener | null): void {
  listener = fn;
}

export function publishExploreMushrooms(instances: readonly MushroomInstance[]): void {
  listener?.(instances);
}
