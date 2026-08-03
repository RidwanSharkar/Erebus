'use client';

import type { RefObject } from 'react';
import { Text } from '@react-three/drei';

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
  numericRef: RefObject<{ text?: string; sync?: () => void } | null>;
  health: number;
  maxHealth: number;
  fontSize?: number;
  nameFontSize?: number;
  color?: string;
  /** Numeric portion only; name/leading is rendered separately. */
  numericFormat?: (hp: number, max: number) => string;
}

/**
 * Split HP label: static name (above bar) or short leading glyph + numeric text synced via ref.
 * Avoids Troika re-syncing the name/emoji on every HP tick (GPU program/texture churn).
 */
export default function EnemyHealthBarTextLabel({
  name,
  leading,
  numericRef,
  health,
  maxHealth,
  fontSize = 0.18,
  nameFontSize,
  color = '#ffffff',
  numericFormat = (hp, max) => `${Math.ceil(hp)}/${max}`,
}: EnemyHealthBarTextLabelProps) {
  const numericText = numericFormat(health, maxHealth);
  const useNameplate = Boolean(name);

  return (
    <>
      {name ? (
        <Text
          position={[0, NAME_Y, 0.002]}
          fontSize={nameFontSize ?? fontSize}
          color={color}
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          {name}
        </Text>
      ) : leading ? (
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
        position={[useNameplate || !leading ? 0 : NUMERIC_X, 0, 0.002]}
        fontSize={fontSize}
        color={color}
        anchorX={useNameplate || !leading ? 'center' : 'left'}
        anchorY="middle"
        fontWeight="bold"
      >
        {numericText}
      </Text>
    </>
  );
}
