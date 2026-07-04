'use client';

import type { RefObject } from 'react';
import { Text } from '@react-three/drei';

/** Horizontal offset for the static leading glyph/prefix (emoji or label). */
const LEADING_X = -0.42;
/** Horizontal offset for the live numeric HP text synced each frame. */
const NUMERIC_X = 0.08;

export interface EnemyHealthBarTextLabelProps {
  /** Static emoji or prefix (e.g. "HATE", "🧟") — never re-synced after mount. */
  leading?: string;
  numericRef: RefObject<{ text?: string; sync?: () => void } | null>;
  health: number;
  maxHealth: number;
  fontSize?: number;
  color?: string;
  /** Numeric portion only; leading is rendered separately. */
  numericFormat?: (hp: number, max: number) => string;
}

/**
 * Split HP label: static leading glyph (emoji/prefix) + numeric text synced via ref.
 * Avoids Troika re-syncing color emoji on every HP tick (GPU program/texture churn).
 */
export default function EnemyHealthBarTextLabel({
  leading,
  numericRef,
  health,
  maxHealth,
  fontSize = 0.18,
  color = '#ffffff',
  numericFormat = (hp, max) => `${Math.ceil(hp)}/${max}`,
}: EnemyHealthBarTextLabelProps) {
  const numericText = numericFormat(health, maxHealth);

  return (
    <>
      {leading ? (
        <Text
          position={[LEADING_X, 0, 0.002]}
          fontSize={fontSize}
          color={color}
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          {leading}
        </Text>
      ) : null}
      <Text
        ref={numericRef}
        position={[leading ? NUMERIC_X : 0, 0, 0.002]}
        fontSize={fontSize}
        color={color}
        anchorX={leading ? 'left' : 'center'}
        anchorY="middle"
        fontWeight="bold"
      >
        {numericText}
      </Text>
    </>
  );
}
