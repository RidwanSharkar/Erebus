'use client';

import React, { useEffect, useRef } from 'react';
import { Billboard } from '@react-three/drei';
import type { Mesh } from 'three';
import type { DeliriumStructureState } from '@/contexts/MultiplayerContext';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from '@/components/enemies/EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from '@/components/enemies/EnemyHpBarPlanes';

type DeliriumStructureProps = {
  structure: DeliriumStructureState;
};

const STRUCTURE_BAR_BG = '#1a0a0a';
const STRUCTURE_BAR_FILL = '#22c55e';
const STRUCTURE_BAR_FILL_DESTROYED = '#7f1d1d';

export default function DeliriumStructure({ structure }: DeliriumStructureProps) {
  const fillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<{ text?: string; sync?: () => void } | null>(null);
  const { position, hp, maxHp, destroyed } = structure;

  useEffect(() => {
    applyEnemyHealthBarFill(fillRef.current, hp, maxHp, ENEMY_HP_BAR_WIDTH);
  }, [hp, maxHp]);

  const accent = destroyed ? '#7f1d1d' : '#f59e0b';
  const glow = destroyed ? '#450a0a' : '#dc2626';

  return (
    <group position={[position.x, 0, position.z]} name="delirium-structure">
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.2, 2.6, 48]} />
        <meshStandardMaterial color={glow} emissive={glow} emissiveIntensity={0.35} transparent opacity={0.55} />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <cylinderGeometry args={[1.1, 1.35, 0.35, 6]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} metalness={0.15} />
      </mesh>
      <mesh position={[0, 1.35, 0]}>
        <boxGeometry args={[0.85, 2.1, 0.85]} />
        <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={destroyed ? 0.05 : 0.22} roughness={0.55} metalness={0.25} />
      </mesh>
      <mesh position={[0, 2.65, 0]}>
        <octahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color={destroyed ? '#450a0a' : '#fbbf24'} emissive={destroyed ? '#1a0505' : '#f59e0b'} emissiveIntensity={destroyed ? 0.02 : 0.35} />
      </mesh>

      <Billboard position={[0, 3.35, 0]} follow lockX={false} lockY={false} lockZ={false}>
        <EnemyHpBarPlanes
          fillRef={fillRef}
          backgroundColor={STRUCTURE_BAR_BG}
          fillColor={destroyed ? STRUCTURE_BAR_FILL_DESTROYED : STRUCTURE_BAR_FILL}
        />
        <EnemyHealthBarTextLabel
          leading="🛡"
          numericRef={hpTextRef}
          health={destroyed ? 0 : hp}
          maxHealth={maxHp}
          fontSize={0.18}
          color="#ffffff"
        />
      </Billboard>
    </group>
  );
}
