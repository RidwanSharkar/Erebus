import type { MutableRefObject, RefObject } from 'react';
import type { Mesh } from 'three';

/** Standard enemy billboard HP bar dimensions (knight, boss, viper, etc.). */
export const ENEMY_HP_BAR_WIDTH = 2.0;
export const ENEMY_HP_BAR_HEIGHT = 0.25;
export const ENEMY_HP_BAR_FILL_HEIGHT = 0.23;
export const ENEMY_HP_BAR_FILL_Z = 0.001;

export function enemyHealthRatio(health: number, maxHealth: number): number {
  if (maxHealth <= 0) return 0;
  return Math.max(0, Math.min(1, health / maxHealth));
}

/** Left-aligned fill mesh: fixed planeGeometry width + scale.x (no per-tick geometry alloc). */
export function applyEnemyHealthBarFill(
  fillMesh: Mesh | null | undefined,
  health: number,
  maxHealth: number,
  barWidth: number = ENEMY_HP_BAR_WIDTH,
): void {
  if (!fillMesh) return;
  const ratio = enemyHealthRatio(health, maxHealth);
  fillMesh.scale.x = ratio;
  fillMesh.position.x = -barWidth / 2 + (barWidth * ratio) / 2;
}

export function readLiveEnemyHealth(
  enemiesRef: MutableRefObject<Map<string, { health?: number }>> | undefined,
  enemyId: string,
  fallbackHealth: number,
): number {
  const live = enemiesRef?.current.get(enemyId);
  return live?.health ?? fallbackHealth;
}

/** Sync fill from a live ref each frame; returns the health value used. */
export function syncEnemyHealthBarFillFromRef(
  fillRef: RefObject<Mesh | null>,
  enemiesRef: MutableRefObject<Map<string, { health?: number }>> | undefined,
  enemyId: string,
  fallbackHealth: number,
  maxHealth: number,
  barWidth: number = ENEMY_HP_BAR_WIDTH,
): number {
  const health = readLiveEnemyHealth(enemiesRef, enemyId, fallbackHealth);
  applyEnemyHealthBarFill(fillRef.current, health, maxHealth, barWidth);
  return health;
}
