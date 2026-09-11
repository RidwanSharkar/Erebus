'use client';

import React, { useEffect, useLayoutEffect, useMemo } from 'react';
import type { MutableRefObject } from 'react';
import { SharedMesh } from '@/utils/SharedMesh';
import {
  createEnemyHpCanvasLabel,
  ENEMY_HP_BAR_LABEL_Z,
  ENEMY_HP_BAR_RENDER_ORDER_LABEL,
  ENEMY_HP_LEADING_LABEL_GEO,
  ENEMY_HP_NAME_LABEL_GEO,
  ENEMY_HP_NUMERIC_LABEL_GEO,
  formatEnemyHealthNumeric,
  type EnemyHpNumericLabelHandle,
} from '@/utils/enemyHealthBar';

/** Vertical offset for the static display name above the HP bar. */
const NAME_Y = 0.28;
/** Horizontal offset for the legacy short leading glyph/prefix (emoji or tag). */
const LEADING_X = -0.42;
/** Horizontal offset for the live numeric HP text when paired with a short leading. */
const NUMERIC_X = 0.08;

export interface EnemyHealthBarTextLabelProps {
  /** Display name centered above the bar (preferred nameplate layout). */
  name?: string;
  /** Static emoji or short prefix beside HP — only used when `name` is omitted. */
  leading?: string;
  numericRef: MutableRefObject<EnemyHpNumericLabelHandle | null>;
  health: number;
  maxHealth: number;
  fontSize?: number;
  nameFontSize?: number;
  color?: string;
  /** Numeric portion only; name/leading is rendered separately. */
  numericFormat?: (hp: number, max: number) => string;
}

/**
 * Canvas HP labels (no Troika).
 * Static name/leading + live numeric share module-level plane geometries.
 * Each instance owns a disposable CanvasTexture — no unique BufferGeometry per enemy.
 */
function EnemyHealthBarTextLabel({
  name,
  leading,
  numericRef,
  health,
  maxHealth,
  color = '#ffffff',
  numericFormat = formatEnemyHealthNumeric,
}: EnemyHealthBarTextLabelProps) {
  const numericText = numericFormat(health, maxHealth);
  const useNameplate = Boolean(name);

  const nameLabel = useMemo(
    () => (name ? createEnemyHpCanvasLabel(name, color, 'name') : null),
    // Recreate only when name/color identity changes — not every HP tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, color],
  );

  const leadingLabel = useMemo(
    () => (!name && leading ? createEnemyHpCanvasLabel(leading, color, 'leading') : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [name, leading, color],
  );

  const numericLabel = useMemo(
    () => createEnemyHpCanvasLabel(numericText, color, 'numeric'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [color],
  );

  useLayoutEffect(() => {
    numericRef.current = numericLabel.handle;
    return () => {
      if (numericRef.current === numericLabel.handle) {
        numericLabel.handle.alive = false;
        numericRef.current = null;
      }
    };
  }, [numericLabel, numericRef]);

  useLayoutEffect(() => {
    numericLabel.handle.setText?.(numericText);
  }, [numericLabel, numericText]);

  useEffect(() => {
    return () => {
      nameLabel?.handle.dispose?.();
      leadingLabel?.handle.dispose?.();
      numericLabel.handle.dispose?.();
    };
  }, [nameLabel, leadingLabel, numericLabel]);

  return (
    <>
      {nameLabel ? (
        <SharedMesh
          position={[0, NAME_Y, ENEMY_HP_BAR_LABEL_Z]}
          scale={[1.15, 1, 1]}
          renderOrder={ENEMY_HP_BAR_RENDER_ORDER_LABEL}
        >
          <primitive object={ENEMY_HP_NAME_LABEL_GEO} attach="geometry" />
          <primitive object={nameLabel.material} attach="material" />
        </SharedMesh>
      ) : leadingLabel ? (
        <SharedMesh
          position={[LEADING_X, 0, ENEMY_HP_BAR_LABEL_Z]}
          scale={[0.55, 1, 1]}
          renderOrder={ENEMY_HP_BAR_RENDER_ORDER_LABEL}
        >
          <primitive object={ENEMY_HP_LEADING_LABEL_GEO} attach="geometry" />
          <primitive object={leadingLabel.material} attach="material" />
        </SharedMesh>
      ) : null}
      <SharedMesh
        position={[useNameplate || !leading ? 0 : NUMERIC_X, 0, ENEMY_HP_BAR_LABEL_Z]}
        scale={[useNameplate || !leading ? 1.05 : 0.95, 1, 1]}
        renderOrder={ENEMY_HP_BAR_RENDER_ORDER_LABEL}
      >
        <primitive object={ENEMY_HP_NUMERIC_LABEL_GEO} attach="geometry" />
        <primitive object={numericLabel.material} attach="material" />
      </SharedMesh>
    </>
  );
}

export default React.memo(EnemyHealthBarTextLabel);
