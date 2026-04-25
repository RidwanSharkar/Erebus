'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import MartyrModel from './MartyrModel';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import EnemyStaggerBar from './EnemyStaggerBar';

interface MartyrRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
}

const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const WALK_STOP_DELAY = 250;

export default function MartyrRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
}: MartyrRendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [isPrimming, setIsPrimming] = useState(false);
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onTelegraph = (data: { martyrId: string }) => {
      if (data.martyrId !== id) return;
      setIsPrimming(true);
    };
    socket.on('martyr-detonation-telegraph', onTelegraph);
    return () => {
      socket.off('martyr-detonation-telegraph', onTelegraph);
    };
  }, [id, socket]);

  useEffect(() => {
    if (!socket) return;
    const onImpact = (data: { martyrId: string }) => {
      if (data.martyrId !== id) return;
      setIsPrimming(false);
    };
    socket.on('martyr-detonation-impact', onImpact);
    return () => {
      socket.off('martyr-detonation-impact', onImpact);
    };
  }, [id, socket]);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isDying) {
      if (!isWalking) setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => setIsWalking(false), WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z, isDying]);

  useEffect(() => {
    return () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
    };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;
    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);
      group.traverse((child: any) => {
        if (child.isMesh && child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach((m: any) => {
            m.transparent = true;
            m.opacity = opacity.current;
          });
        }
      });
    }
  });

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <MartyrModel isWalking={isWalking && !isPrimming} isDying={isDying} />

      <Billboard position={[0, 2.6, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[1.6, 0.2]} />
              <meshBasicMaterial color="#1a0a0a" opacity={0.9} transparent />
            </mesh>
            <mesh position={[-0.8 + (health / maxHealth) * 0.8, 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 1.6, 0.18]} />
              <meshBasicMaterial color="#cc2200" opacity={0.95} transparent />
            </mesh>
            <Text
              position={[0, 0, 0.002]}
              fontSize={0.15}
              color="#ffcc99"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`💣 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}
