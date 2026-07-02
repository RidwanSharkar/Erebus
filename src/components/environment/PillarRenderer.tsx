'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, Group, Mesh, MeshStandardMaterial } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import { PILLAR_SHARED_GEOMETRIES, PILLAR_STONE_MATERIAL } from './Pillar';

interface PillarRendererProps {
  entityId: number;
  world: World;
  position: Vector3;
  ownerId: string;
  pillarIndex: number;
  playerIndex?: number;
  health: number;
  maxHealth: number;
  isDead?: boolean;
  color?: Color;
  camera?: any;
}

function PillarRenderer({
  entityId,
  world,
  position,
  ownerId,
  pillarIndex,
  playerIndex = 0,
  health,
  maxHealth,
  isDead = false,
  color,
  camera
}: PillarRendererProps) {
  const groupRef = useRef<Group>(null);
  const healthBarRef = useRef<Group>(null);
  const orbRef = useRef<Mesh>(null);

  // Default colors for different players
  const playerColors = useMemo(() => [
    new Color("#4FC3F7"), // Blue - Elite color (Player 1)
    new Color("#FF4646"), // Orange/Red Fire theme (Player 2)
  ], []);

  // Use playerIndex to get consistent color for all pillars of the same player
  // Player 1 (index 0) = blue, Player 2 (index 1) = red
  const pillarColor = color || playerColors[playerIndex % playerColors.length];

  const orbMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: pillarColor,
        emissive: pillarColor,
        metalness: 1,
        roughness: 0.2,
      }),
    [pillarColor],
  );

  React.useEffect(
    () => () => {
      orbMaterial.dispose();
    },
    [orbMaterial],
  );

  // Health bar dimensions
  const healthBarWidth = 2;
  const healthBarHeight = 0.2;
  const healthBarY = 3.25; // Above the pillar

  useFrame((state, delta) => {
    if (orbRef.current) {
      orbRef.current.rotation.x += 0.02;
      orbRef.current.rotation.y += 0.02;
    }
    // Update health bar to always face camera
    if (healthBarRef.current && camera) {
      healthBarRef.current.lookAt(camera.position);
    }
  });

  if (isDead) {
    return null; // Don't render destroyed pillars
  }

  const healthPercent = Math.max(0, Math.min(1, health / maxHealth));

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Pillar Visual */}
      <group scale={[0.35, 0.35, 0.35]}>
        {/* Base */}
        <mesh
          geometry={PILLAR_SHARED_GEOMETRIES.base}
          material={PILLAR_STONE_MATERIAL}
          position={[0, 0, 0]}
          castShadow
          receiveShadow
        />

        {/* Main column */}
        <mesh
          geometry={PILLAR_SHARED_GEOMETRIES.column}
          material={PILLAR_STONE_MATERIAL}
          position={[0, 0.25, 0]}
          castShadow
          receiveShadow
        />

        {/* Top */}
        <mesh
          geometry={PILLAR_SHARED_GEOMETRIES.top}
          material={PILLAR_STONE_MATERIAL}
          position={[0, 3, 0]}
          castShadow
          receiveShadow
        />

        {/* Floating orb */}
        <mesh
          ref={orbRef}
          geometry={PILLAR_SHARED_GEOMETRIES.orb}
          material={orbMaterial}
          position={[0, 5, 0]}
        >
          <pointLight color={pillarColor} intensity={0.25} distance={5} />
        </mesh>
      </group>

      {/* Health Bar */}
      <group ref={healthBarRef} position={[0, healthBarY, 0]}>
        {/* Background */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[healthBarWidth, healthBarHeight]} />
          <meshBasicMaterial color="#333333" transparent opacity={0.8} />
        </mesh>

        {/* Health fill — fixed geometry + scale.x avoids reallocating planeGeometry each tick */}
        <mesh
          position={[-healthBarWidth / 2 + (healthBarWidth * healthPercent) / 2, 0, 0.01]}
          scale={[healthPercent, 1, 1]}
        >
          <planeGeometry args={[healthBarWidth, healthBarHeight * 0.8]} />
          <meshBasicMaterial
            color={healthPercent > 0.6 ? "#00ff00" : healthPercent > 0.3 ? "#ffff00" : "#ff0000"}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Border */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[healthBarWidth, healthBarHeight]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.5} />
        </mesh>
      </group>
    </group>
  );
}

export default React.memo(PillarRenderer);
