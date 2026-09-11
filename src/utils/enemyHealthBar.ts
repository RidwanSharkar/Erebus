import type { MutableRefObject, RefObject } from 'react';
import type { Mesh } from 'three';
import {
  CanvasTexture,
  LinearFilter,
  MeshBasicMaterial,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three';

/** Standard enemy billboard HP bar dimensions (knight, boss, viper, etc.). */
export const ENEMY_HP_BAR_WIDTH = 2.0;
export const ENEMY_HP_BAR_HEIGHT = 0.25;
export const ENEMY_HP_BAR_FILL_HEIGHT = 0.23;
export const ENEMY_HP_BAR_FILL_Z = 0.02;
/** Billboard-local Z for canvas name/HP labels — in front of the fill plane. */
export const ENEMY_HP_BAR_LABEL_Z = 0.03;
/** Draw order: stagger < track < fill < labels (avoids camera-angle transparent sort). */
export const ENEMY_HP_BAR_RENDER_ORDER_STAGGER_BG = 1;
export const ENEMY_HP_BAR_RENDER_ORDER_STAGGER_FILL = 2;
export const ENEMY_HP_BAR_RENDER_ORDER_BG = 2;
export const ENEMY_HP_BAR_RENDER_ORDER_FILL = 3;
export const ENEMY_HP_BAR_RENDER_ORDER_LABEL = 4;

export { ENEMY_HP_BAR_BG_GEO, ENEMY_HP_BAR_FILL_GEO } from './sharedEnemyUiGeometry';

/** Shared label planes — one geometry for all canvas HP / name labels. */
export const ENEMY_HP_NUMERIC_LABEL_GEO = new PlaneGeometry(1.35, 0.28);
ENEMY_HP_NUMERIC_LABEL_GEO.userData.shared = true;
export const ENEMY_HP_NAME_LABEL_GEO = new PlaneGeometry(1.8, 0.32);
ENEMY_HP_NAME_LABEL_GEO.userData.shared = true;
export const ENEMY_HP_LEADING_LABEL_GEO = new PlaneGeometry(0.45, 0.28);
ENEMY_HP_LEADING_LABEL_GEO.userData.shared = true;

const NUMERIC_CANVAS_W = 256;
const NUMERIC_CANVAS_H = 64;
const NAME_CANVAS_W = 384;
const NAME_CANVAS_H = 64;
const LEADING_CANVAS_W = 96;
const LEADING_CANVAS_H = 64;

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

/**
 * Canvas-backed HP numeric label handle.
 * Compatible with older Troika-shaped refs (`text` + `sync`) so renderers need no API change.
 * Does NOT allocate Troika BufferGeometry — only one shared plane + a disposable canvas texture.
 */
export type EnemyHpNumericLabelHandle = {
  text?: string;
  sync?: () => void;
  dispose?: () => void;
  /** When false, sync is a no-op (unmounted / dying). */
  alive?: boolean;
  setText?: (next: string) => void;
};

export type EnemyHpNumericLabelRef =
  | RefObject<EnemyHpNumericLabelHandle | null>
  | MutableRefObject<EnemyHpNumericLabelHandle | null>;

type LabelKind = 'numeric' | 'name' | 'leading';

function canvasSizeForKind(kind: LabelKind): { w: number; h: number } {
  if (kind === 'name') return { w: NAME_CANVAS_W, h: NAME_CANVAS_H };
  if (kind === 'leading') return { w: LEADING_CANVAS_W, h: LEADING_CANVAS_H };
  return { w: NUMERIC_CANVAS_W, h: NUMERIC_CANVAS_H };
}

function drawLabelCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  color: string,
  fontPx: number,
): void {
  ctx.clearRect(0, 0, w, h);
  ctx.font = `bold ${fontPx}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.72)';
  ctx.lineWidth = Math.max(3, fontPx * 0.14);
  ctx.fillStyle = color;
  ctx.strokeText(text, w / 2, h / 2);
  ctx.fillText(text, w / 2, h / 2);
}

/** Create a canvas text label material + sync handle (shared geometry applied by caller). */
export function createEnemyHpCanvasLabel(
  initialText: string,
  color: string,
  kind: LabelKind = 'numeric',
): { material: MeshBasicMaterial; handle: EnemyHpNumericLabelHandle } {
  const { w, h } = canvasSizeForKind(kind);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    const material = new MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const handle: EnemyHpNumericLabelHandle = {
      text: initialText,
      alive: false,
      sync: () => {},
      setText: () => {},
      dispose: () => {
        material.dispose();
      },
    };
    return { material, handle };
  }

  const fontPx = kind === 'leading' ? 42 : kind === 'name' ? 36 : 34;
  drawLabelCanvas(ctx, w, h, initialText, color, fontPx);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;

  const material = new MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });

  let currentText = initialText;
  let alive = true;

  const handle: EnemyHpNumericLabelHandle = {
    get text() {
      return currentText;
    },
    set text(next: string) {
      currentText = next;
    },
    get alive() {
      return alive;
    },
    set alive(next: boolean) {
      alive = next;
    },
    setText(next: string) {
      if (!alive || next === currentText) return;
      currentText = next;
      drawLabelCanvas(ctx, w, h, next, color, fontPx);
      texture.needsUpdate = true;
    },
    sync() {
      if (!alive) return;
      drawLabelCanvas(ctx, w, h, currentText, color, fontPx);
      texture.needsUpdate = true;
    },
    dispose() {
      if (!alive) return;
      alive = false;
      texture.dispose();
      material.dispose();
    },
  };

  return { material, handle };
}

/** Numeric HP label only (no emoji/prefix) — safe for per-tick canvas redraw. */
export function formatEnemyHealthNumeric(hp: number, max: number): string {
  return `${Math.ceil(hp)}/${max}`;
}

/**
 * Sync canvas (or legacy) HP label from live ref.
 * No-ops when the handle is disposed / unmounted (`alive === false` or null ref)
 * so async work cannot allocate orphan GPU resources after death.
 */
export function syncEnemyHealthBarTextFromRef(
  textRef: EnemyHpNumericLabelRef,
  enemiesRef: MutableRefObject<Map<string, { health?: number }>> | undefined,
  enemyId: string,
  fallbackHealth: number,
  maxHealth: number,
  format: (hp: number, max: number) => string = formatEnemyHealthNumeric,
): void {
  const t = textRef.current;
  if (!t || t.alive === false) return;
  const hp = readLiveEnemyHealth(enemiesRef, enemyId, fallbackHealth);
  const next = format(hp, maxHealth);
  if (t.setText) {
    t.setText(next);
    return;
  }
  if (t.text !== next) {
    t.text = next;
    t.sync?.();
  }
}

/** Sync numeric-only HP text (leading emoji/prefix rendered separately). */
export function syncEnemyHealthBarNumericTextFromRef(
  textRef: EnemyHpNumericLabelRef,
  enemiesRef: MutableRefObject<Map<string, { health?: number }>> | undefined,
  enemyId: string,
  fallbackHealth: number,
  maxHealth: number,
  format: (hp: number, max: number) => string = formatEnemyHealthNumeric,
): void {
  syncEnemyHealthBarTextFromRef(textRef, enemiesRef, enemyId, fallbackHealth, maxHealth, format);
}

/** Null the ref and dispose canvas/Troika resources so later useFrame syncs are no-ops. */
export function disposeEnemyHpNumericLabelRef(
  textRef: MutableRefObject<EnemyHpNumericLabelHandle | null>,
): void {
  const t = textRef.current;
  if (!t) return;
  t.alive = false;
  t.dispose?.();
  textRef.current = null;
}
