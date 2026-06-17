'use client';

import React from 'react';
import { DoubleSide } from 'three';

/** Match `attackRange` in `backend/enemyAI.js` → `updateKnightAI` */
export const KNIGHT_MELEE_ATTACK_RANGE = 2.6;
/** Match `attackRange` in `backend/enemyAI.js` → `updateTemplarAI` */
export const TEMPLAR_MELEE_ATTACK_RANGE = 2.6;
/** Match `attackRange` in `backend/enemyAI.js` → `updateGhoulAI` */
export const GHOUL_MELEE_ATTACK_RANGE = 2.4;

const LINE_HALF_WIDTH = 0.04;

interface EnemyMeleeAttackRangeRingProps {
  radius: number;
}

/**
 * Flat ring on the ground at the unit’s feet, radius equal to server melee attack range.
 */
export default function EnemyMeleeAttackRangeRing({ radius }: EnemyMeleeAttackRangeRingProps) {
  const innerRadius = Math.max(0.02, radius - LINE_HALF_WIDTH);
  const outerRadius = radius + LINE_HALF_WIDTH;

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.125, 0]}
      renderOrder={2}
      frustumCulled={false}
    >
      <ringGeometry args={[innerRadius, outerRadius, 64]} />
      <meshBasicMaterial
        color="#c94a3a"
        transparent
        opacity={0.55}
        depthWrite={false}
        side={DoubleSide}
      />
    </mesh>
  );
}
