import type { MutableRefObject } from 'react';
import { Vector3 } from 'three';

export interface EnemyLiveTransform {
  position: { x: number; y: number; z: number };
  rotation: number;
}

export type EnemyTransformsRef = MutableRefObject<Map<string, EnemyLiveTransform>>;

const _scratch = new Vector3();

/**
 * Pull the latest server-authoritative transform from the ref-only movement store.
 * Returns the distance moved since the last target position (for walk/idle detection).
 * Call from enemy renderer useFrame before lerping toward targetPosition.
 */
export function syncEnemyTransformFromRef(
  enemyId: string,
  transformsRef: EnemyTransformsRef,
  targetPosition: Vector3,
  targetRotation: MutableRefObject<number>,
): number {
  const live = transformsRef.current.get(enemyId);
  if (!live) return 0;

  _scratch.set(live.position.x, live.position.y, live.position.z);
  const dist = targetPosition.distanceTo(_scratch);
  targetPosition.copy(_scratch);
  targetRotation.current = live.rotation;
  return dist;
}

/** Apply batched server moves to the ref store (no React setState). */
export function applyEnemyMoveBatch(
  transformsRef: EnemyTransformsRef,
  enemiesRef: MutableRefObject<Map<string, { position: { x: number; y: number; z: number }; rotation: number }>>,
  moves: Array<{ enemyId: string; position: { x: number; y: number; z: number }; rotation: number }>,
): void {
  for (const move of moves) {
    const existing = transformsRef.current.get(move.enemyId);
    if (existing) {
      existing.position = move.position;
      existing.rotation = move.rotation;
    } else {
      transformsRef.current.set(move.enemyId, {
        position: move.position,
        rotation: move.rotation,
      });
    }

    const enemy = enemiesRef.current.get(move.enemyId);
    if (enemy) {
      enemy.position = move.position;
      enemy.rotation = move.rotation;
    }
  }
}

/** Resolve live position for targeting helpers (falls back to stale React state). */
export function getEnemyLivePosition(
  enemyId: string,
  transformsRef: EnemyTransformsRef,
  fallback?: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const live = transformsRef.current.get(enemyId);
  if (live) return live.position;
  return fallback ?? { x: 0, y: 0, z: 0 };
}
