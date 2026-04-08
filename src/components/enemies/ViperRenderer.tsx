'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import ViperModel from './ViperModel';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface ViperRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

// How long isAttacking stays true — used to suppress walk state during the bow cycle.
// DrawBow ~1s + ReleaseBow ~0.6s = ~1.6s; 3s gives comfortable headroom.
const ATTACK_DURATION = 3000; // ms
const FADE_DURATION   = 1.5;  // seconds for death fade-out
const LERP_SPEED      = 12;
const WALK_STOP_DELAY = 250;  // ms

export default function ViperRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
}: ViperRendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  // Increments on every telegraph — passed to ViperModel so it always restarts DrawBow.
  const [attackKey,   setAttackKey]   = useState(0);
  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking,   setIsWalking]   = useState(false);

  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);

  // Callback ref — positions the group at the server location before the first render
  // so the viper never flickers from world-origin.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track server position changes and derive walking state from them.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isAttackingRef.current && !isDying) {
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

  // Listen for the server's attack telegraph to drive the bow-draw animation.
  useEffect(() => {
    if (!socket) return;

    const handleViperTelegraph = (data: { viperId: string }) => {
      if (data.viperId !== id) return;
      // Increment key unconditionally so ViperModel always restarts DrawBow,
      // even if a previous attack cycle hasn't fully finished yet.
      setAttackKey(k => k + 1);
      setIsAttacking(true);
      isAttackingRef.current = true;
      setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
      }, ATTACK_DURATION);
    };

    socket.on('viper-attack-telegraph', handleViperTelegraph);
    return () => { socket.off('viper-attack-telegraph', handleViperTelegraph); };
  }, [id, socket]);

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

  return (
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <ViperModel isWalking={isWalking} attackKey={attackKey} isDying={isDying} />

      {/* Billboard health bar */}
      <Billboard position={[0, 3, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            {/* Dark background track */}
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[2.0, 0.25]} />
              <meshBasicMaterial color="#0a1a00" opacity={0.9} transparent />
            </mesh>

            {/* Lime-green health fill */}
            <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
              <meshBasicMaterial color="#66cc00" opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.18}
              color="#ccff88"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`🐍 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
          </>
        )}
      </Billboard>
    </group>
  );
}
