import type { MutableRefObject } from 'react';
import { Vector3 } from 'three';

export interface EnemyLiveTransform {
  position: { x: number; y: number; z: number };
  rotation: number;
}

export type EnemyTransformsRef = MutableRefObject<Map<string, EnemyLiveTransform>>;
export type EnemyVisualRotationsRef = MutableRefObject<Map<string, number>>;

const _scratch = new Vector3();

/** Store lerped mesh Y rotation for backstab / facing checks (ref-only, no React setState). */
export function syncEnemyVisualRotation(
  enemyId: string,
  visualRotationsRef: EnemyVisualRotationsRef,
  rotationY: number,
): void {
  visualRotationsRef.current.set(enemyId, rotationY);
}

/** Derive walk/idle from per-frame server transform delta (ref-only movement store). */
export function updateEnemyWalkStateFromMoveDist(
  dist: number,
  isLocked: boolean,
  isDying: boolean,
  walkStopDelayMs: number,
  lastMoveTimeRef: MutableRefObject<number>,
  isWalkingRef: MutableRefObject<boolean>,
  setIsWalking: (walking: boolean) => void,
): void {
  if (dist > 0.01 && !isLocked && !isDying) {
    lastMoveTimeRef.current = performance.now();
    if (!isWalkingRef.current) {
      isWalkingRef.current = true;
      setIsWalking(true);
    }
    return;
  }

  if (
    isWalkingRef.current &&
    !isDying &&
    performance.now() - lastMoveTimeRef.current > walkStopDelayMs
  ) {
    isWalkingRef.current = false;
    setIsWalking(false);
  }
}

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

export type TotemTargetEntry = { id: string; position: Vector3; health: number };

type TotemTargetEnemy = {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  health: number;
  isDying?: boolean;
  alliedUnit?: boolean;
};

function isTotemValidEnemy(enemy: TotemTargetEnemy): boolean {
  return (
    !enemy.isDying &&
    enemy.health > 0 &&
    enemy.alliedUnit !== true &&
    enemy.type !== 'allied-knight' &&
    enemy.type !== 'allied-huntress' &&
    enemy.type !== 'allied-phantom' &&
    enemy.type !== 'allied-demon' &&
    enemy.type !== 'allied-enchantress' &&
    enemy.type !== 'allied-healer' &&
    enemy.type !== 'player-zombie'
  );
}

/**
 * Rebuild a pooled totem target list from live enemy transforms (no per-frame Vector3 allocation).
 * Matches the filter used by `getLiveCoopEnemyData` in CoopGameScene.
 */
export function refreshTotemEnemyTargetScratch(
  scratch: TotemTargetEntry[],
  enemiesRef: MutableRefObject<Map<string, TotemTargetEnemy>>,
  transformsRef: EnemyTransformsRef,
): TotemTargetEntry[] {
  let writeIndex = 0;

  for (const [id, enemy] of Array.from(enemiesRef.current.entries())) {
    if (!isTotemValidEnemy(enemy)) continue;

    const livePos = getEnemyLivePosition(id, transformsRef, enemy.position);
    if (writeIndex < scratch.length) {
      scratch[writeIndex].id = id;
      scratch[writeIndex].position.set(livePos.x, livePos.y, livePos.z);
      scratch[writeIndex].health = enemy.health;
    } else {
      scratch.push({
        id,
        position: new Vector3(livePos.x, livePos.y, livePos.z),
        health: enemy.health,
      });
    }
    writeIndex++;
  }

  scratch.length = writeIndex;
  return scratch;
}
