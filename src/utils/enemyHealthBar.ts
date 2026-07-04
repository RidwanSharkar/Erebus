import type { MutableRefObject, RefObject } from 'react';
import type { Mesh } from 'three';

/** Standard enemy billboard HP bar dimensions (knight, boss, viper, etc.). */
export const ENEMY_HP_BAR_WIDTH = 2.0;
export const ENEMY_HP_BAR_HEIGHT = 0.25;
export const ENEMY_HP_BAR_FILL_HEIGHT = 0.23;
export const ENEMY_HP_BAR_FILL_Z = 0.001;

export { ENEMY_HP_BAR_BG_GEO, ENEMY_HP_BAR_FILL_GEO } from './sharedEnemyUiGeometry';

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

type TroikaTextMesh = {
  text?: string;
  sync?: () => void;
};

/** Numeric HP label only (no emoji/prefix) — safe for per-tick Troika sync. */
export function formatEnemyHealthNumeric(hp: number, max: number): string {
  return `${Math.ceil(hp)}/${max}`;
}

/** Sync drei Text label from live ref (no React re-render). */
export function syncEnemyHealthBarTextFromRef(
  textRef: RefObject<TroikaTextMesh | null>,
  enemiesRef: MutableRefObject<Map<string, { health?: number }>> | undefined,
  enemyId: string,
  fallbackHealth: number,
  maxHealth: number,
  format: (hp: number, max: number) => string = formatEnemyHealthNumeric,
): void {
  const t = textRef.current;
  if (!t) return;
  const hp = readLiveEnemyHealth(enemiesRef, enemyId, fallbackHealth);
  const next = format(hp, maxHealth);
  if (t.text !== next) {
    t.text = next;
    t.sync?.();
  }
}

/** Sync numeric-only HP text (leading emoji/prefix rendered separately). */
export function syncEnemyHealthBarNumericTextFromRef(
  textRef: RefObject<TroikaTextMesh | null>,
  enemiesRef: MutableRefObject<Map<string, { health?: number }>> | undefined,
  enemyId: string,
  fallbackHealth: number,
  maxHealth: number,
  format: (hp: number, max: number) => string = formatEnemyHealthNumeric,
): void {
  syncEnemyHealthBarTextFromRef(textRef, enemiesRef, enemyId, fallbackHealth, maxHealth, format);
}
