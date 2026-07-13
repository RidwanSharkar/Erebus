import type { MutableRefObject, RefObject } from 'react';
import type { Mesh } from 'three';
import { STAGGER_MAX } from '@/utils/talents';

export function enemyStaggerRatio(stagger: number, staggerMax: number): number {
  const cap = staggerMax > 0 ? staggerMax : STAGGER_MAX;
  return Math.max(0, Math.min(1, stagger / cap));
}

export function readLiveEnemyStagger(
  enemiesRef: MutableRefObject<Map<string, { staggerBuildup?: number }>> | undefined,
  enemyId: string,
  fallbackStagger: number,
): number {
  const live = enemiesRef?.current.get(enemyId);
  return live?.staggerBuildup ?? fallbackStagger;
}

/** Left-aligned fill mesh: fixed planeGeometry width + scale.x (no per-tick geometry alloc). */
export function applyEnemyStaggerBarFill(
  fillMesh: Mesh | null | undefined,
  stagger: number,
  staggerMax: number,
  barWidth: number,
): void {
  if (!fillMesh) return;
  const t = enemyStaggerRatio(stagger, staggerMax);
  fillMesh.scale.x = t;
  fillMesh.position.x = -barWidth / 2 + (barWidth * t) / 2;
}

/** Sync fill from a live ref each frame; returns the stagger value used. */
export function syncEnemyStaggerBarFillFromRef(
  fillRef: RefObject<Mesh | null>,
  enemiesRef: MutableRefObject<Map<string, { staggerBuildup?: number }>> | undefined,
  enemyId: string,
  fallbackStagger: number,
  staggerMax: number,
  barWidth: number,
): number {
  const stagger = readLiveEnemyStagger(enemiesRef, enemyId, fallbackStagger);
  applyEnemyStaggerBarFill(fillRef.current, stagger, staggerMax, barWidth);
  return stagger;
}
