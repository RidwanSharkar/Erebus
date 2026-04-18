'use client';

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import TitanModel from './TitanModel';
import TitanSoulEffect from './TitanSoulEffect';

const SOUL_TYPES = ['green', 'red', 'blue', 'purple'] as const;
type SoulType = typeof SOUL_TYPES[number];

interface TitanRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

const FADE_DURATION   = 2.5;  // seconds — longer fade for a dramatic death
const LERP_SPEED      = 8;    // smooth, weighty movement befitting a giant
const WALK_STOP_DELAY = 300;  // ms

// Fixed palette for the Titan — deep charcoal track with bone-white fill.
const THEME = {
  background: '#1a1a1a',
  fill:       '#c8b89a',
  text:       '#ffffff',
};

const HP_BAR_WIDTH = 3.0; // wider bar for a 3000 HP unit

export default function TitanRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
}: TitanRendererProps) {
  const groupRef = useRef<Group | null>(null);

  // Pick a random soul colour once per titan instance and keep it stable.
  const soulType = useMemo<SoulType>(
    () => SOUL_TYPES[Math.floor(Math.random() * SOUL_TYPES.length)],
    [],
  );

  const [isWalking, setIsWalking] = useState(false);

  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);

  // Snap to spawn position before the first paint so the titan never flashes at origin.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive walking state from server position deltas.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    // Hard-snap on very large jumps (first spawn).
    if (dist > 15.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isDying) {
      if (!isWalking) setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => setIsWalking(false), WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => { if (walkStopTimer.current) clearTimeout(walkStopTimer.current); };
  }, []);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    // Shortest-arc rotation lerp.
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

    // Death fade-out.
    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);
      group.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((mat: any) => {
            mat.transparent = true;
            mat.opacity = opacity.current;
          });
        }
      });
    }
  });

  const hpFraction = health / maxHealth;

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <TitanModel isWalking={isWalking} isDying={isDying} />
      {!isDying && <TitanSoulEffect soulType={soulType} />}

      {/* Billboard HP bar — positioned higher to clear the titan's head */}
      <Billboard position={[0, 6.25, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            {/* Background track */}
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[HP_BAR_WIDTH, 0.28]} />
              <meshBasicMaterial color={THEME.background} opacity={0.9} transparent />
            </mesh>

            {/* Health fill */}
            <mesh position={[-(HP_BAR_WIDTH / 2) * (1 - hpFraction), 0, 0.001]}>
              <planeGeometry args={[hpFraction * HP_BAR_WIDTH, 0.26]} />
              <meshBasicMaterial color={THEME.fill} opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.2}
              color={THEME.text}
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`🗿 TITAN  ${Math.ceil(health)} / ${maxHealth}`}
            </Text>
          </>
        )}
      </Billboard>
    </group>
  );
}
