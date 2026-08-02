'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Billboard } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import { Vector3 } from '@/utils/three-exports';
import type { DeliriumStructureState } from '@/contexts/MultiplayerContext';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from '@/components/enemies/EnemyHealthBarTextLabel';
import EnemyHpBarPlanes from '@/components/enemies/EnemyHpBarPlanes';
import ThronePedestalAura from '@/components/environment/ThronePedestalAura';
import { WeaponType } from '@/components/dragon/weapons';
import { ASPECT_ARCHMAGE } from '@/utils/weaponAspects';
import {
  clearMerchantShopTooltip,
  publishMerchantShopTooltip,
} from '@/utils/merchantShopTooltipStore';

type DeliriumStructureProps = {
  structure: DeliriumStructureState;
};

const STRUCTURE_BAR_BG = '#1a0a0a';
const STRUCTURE_BAR_FILL = '#22c55e';
const STRUCTURE_BAR_FILL_DESTROYED = '#7f1d1d';

const BODY_ROTATE_SPEED = 0.2;
const TOOLTIP_NAME = 'Monolith of Original Vice';
const TOOLTIP_WORLD_OFFSET = new Vector3(0, 3.2, 0);
const _projectScratch = new Vector3();

export default function DeliriumStructure({ structure }: DeliriumStructureProps) {
  const fillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<{ text?: string; sync?: () => void } | null>(null);
  const bodyRef = useRef<Group>(null);
  const anchorRef = useRef<Group>(null);
  const lastPublishedTooltipRef = useRef<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState(false);
  const { camera, size } = useThree();
  const { position, hp, maxHp, destroyed } = structure;

  useEffect(() => {
    applyEnemyHealthBarFill(fillRef.current, hp, maxHp, ENEMY_HP_BAR_WIDTH);
  }, [hp, maxHp]);

  useEffect(() => () => clearMerchantShopTooltip(), []);

  useFrame((_, delta) => {
    if (bodyRef.current && !destroyed) {
      bodyRef.current.rotation.y += BODY_ROTATE_SPEED * delta;
    }

    if (!hovered) {
      if (lastPublishedTooltipRef.current !== null) {
        lastPublishedTooltipRef.current = null;
        publishMerchantShopTooltip(null);
      }
      return;
    }

    const anchor = anchorRef.current;
    if (!anchor || size.width <= 0 || size.height <= 0) return;

    anchor.getWorldPosition(_projectScratch);
    _projectScratch.add(TOOLTIP_WORLD_OFFSET);
    _projectScratch.project(camera);

    const x = (_projectScratch.x * 0.5 + 0.5) * size.width;
    const y = (_projectScratch.y * -0.5 + 0.5) * size.height;

    const last = lastPublishedTooltipRef.current;
    if (
      !last
      || Math.abs(last.x - x) > 1.5
      || Math.abs(last.y - y) > 1.5
    ) {
      lastPublishedTooltipRef.current = { x, y };
      publishMerchantShopTooltip({
        visible: true,
        x,
        y,
        name: TOOLTIP_NAME,
        description: '',
      });
    }
  });

  const handlePointerOver = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setHovered(true);
  }, []);

  const handlePointerOut = useCallback((event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    setHovered(false);
  }, []);

  const accent = destroyed ? '#7f1d1d' : '#7dd3fc';
  const bodyEmissive = destroyed ? '#7f1d1d' : '#38bdf8';
  const capColor = destroyed ? '#450a0a' : '#bae6fd';
  const capEmissive = destroyed ? '#1a0505' : '#38bdf8';
  const glow = destroyed ? '#450a0a' : '#38bdf8';

  return (
    <group
      ref={anchorRef}
      position={[position.x, 0, position.z]}
      name="delirium-structure"
    >
      {/* Orange pedestal aura at base */}
      <group scale={1.4}>
        <ThronePedestalAura
          position={[0, 0, 0]}
          weapon={WeaponType.SCYTHE}
          equippedWeapon={WeaponType.SCYTHE}
          weaponAspect={ASPECT_ARCHMAGE}
        />
      </group>

      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.2, 3.8, 48]} />
        <meshStandardMaterial
          color={glow}
          emissive={glow}
          emissiveIntensity={0.3}
          transparent
          opacity={0.45}
        />
      </mesh>

      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[1.6, 1.95, 0.5, 6]} />
        <meshStandardMaterial color="#2a1810" roughness={0.85} metalness={0.15} />
      </mesh>

      {/* Slowly rotating rectangular prism body */}
      <group ref={bodyRef} position={[0, 2.0, 0]}>
        <mesh>
          <boxGeometry args={[1.25, 3.15, 1.25]} />
          <meshStandardMaterial
            color={accent}
            emissive={bodyEmissive}
            emissiveIntensity={destroyed ? 0.05 : 0.28}
            roughness={0.55}
            metalness={0.25}
          />
        </mesh>
      </group>

      <mesh position={[0, 3.95, 0]}>
        <octahedronGeometry args={[0.8, 0]} />
        <meshStandardMaterial
          color={capColor}
          emissive={capEmissive}
          emissiveIntensity={destroyed ? 0.02 : 0.4}
        />
      </mesh>

      {/* Hit volume for hover tooltip */}
      <mesh
        position={[0, 2.1, 0]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry args={[2.4, 4.4, 2.4]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Billboard position={[0, 5.0, 0]} follow lockX={false} lockY={false} lockZ={false}>
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
