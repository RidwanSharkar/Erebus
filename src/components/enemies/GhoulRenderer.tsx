'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import GhoulModel from './GhoulModel';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface GhoulRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

const ATTACK_DURATION  = 1200; // ms — matches ghoul attack clip
const SUMMON_DURATION  = 2500; // ms — ghoul_summon clip plays on first spawn
const FADE_DURATION    = 1.5;  // seconds
const LERP_SPEED       = 14;
const WALK_STOP_DELAY  = 250;  // ms

export default function GhoulRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
}: GhoulRendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking,    setIsAttacking]    = useState(false);
  const [isWalking,      setIsWalking]      = useState(false);
  const [isSummoning,    setIsSummoning]    = useState(true); // Start with summon anim
  const [attackVariant,  setAttackVariant]  = useState<1 | 2>(1);

  const targetPosition  = useRef(position.clone());
  const targetRotation  = useRef(rotation);
  const isAttackingRef  = useRef(false);
  const isSummoningRef  = useRef(true);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);

  // Callback ref — positions the group at server spawn location immediately.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Play the spawn summon animation once on mount, then switch to Idle.
  useEffect(() => {
    const t = setTimeout(() => {
      setIsSummoning(false);
      isSummoningRef.current = false;
    }, SUMMON_DURATION);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isAttackingRef.current && !isSummoningRef.current && !isDying) {
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

  // Ghoul melee attack telegraph
  useEffect(() => {
    if (!socket) return;

    const handleGhoulTelegraph = (data: { ghoulId: string }) => {
      if (data.ghoulId !== id) return;
      if (isSummoningRef.current) return;
      setAttackVariant(prev => (prev === 1 ? 2 : 1));
      setIsAttacking(true);
      isAttackingRef.current = true;
      setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
      }, ATTACK_DURATION);
    };

    socket.on('ghoul-attack-telegraph', handleGhoulTelegraph);
    return () => { socket.off('ghoul-attack-telegraph', handleGhoulTelegraph); };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

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
      <GhoulModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        attackVariant={attackVariant}
        isSummoning={isSummoning}
        isDying={isDying}
      />

      <Billboard position={[0, 2.8, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && !isSummoning && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[1.8, 0.22]} />
              <meshBasicMaterial color="#1a0a0a" opacity={0.9} transparent />
            </mesh>

            <mesh position={[-0.9 + (health / maxHealth) * 0.9, 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 1.8, 0.20]} />
              <meshBasicMaterial color="#aa3300" opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.16}
              color="#ffccaa"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`💀 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
          </>
        )}
      </Billboard>
    </group>
  );
}
