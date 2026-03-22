'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import KnightModel from './KnightModel';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface KnightRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

const ATTACK_DURATION = 1200; // ms — matches Mixamo attack clip length
const MOVEMENT_THRESHOLD = 0.05;
const FADE_DURATION = 1.5 ; // seconds
// How quickly (per second) the rendered position chases the server-authoritative target.
// 15 is responsive enough to track a sprinting knight yet smooths out 33 ms server steps.
const LERP_SPEED = 5;

export default function KnightRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
}: KnightRendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);

  // Server-authoritative targets — updated when props change (single source of truth).
  // The group is NEVER written to from effects; only useFrame lerps toward these refs.
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);

  // Mirror walking/attacking state in refs so useFrame always reads the current value
  // without needing to capture setState closures.
  const isWalkingRef = useRef(false);
  const isAttackingRef = useRef(false);

  const lastCheckedPosition = useRef(new Vector3());
  const movementCheckTimer = useRef(0);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);

  // Callback ref — fires synchronously when the <group> mounts, before the first
  // WebGL frame, so the knight is never rendered at the world origin.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
      lastCheckedPosition.current.copy(targetPosition.current);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update the target whenever the server position prop changes.
  // Using primitive coordinate values as deps so the effect only fires when the
  // actual numbers change — not every time the parent creates a new Vector3 object.
  // Only the target ref is written here; useFrame smoothly chases it every frame.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    if (dist > 0.05) {
      // Large teleport — snap instantly so the knight doesn't swim across the map.
      targetPosition.current.copy(position);
      if (groupRef.current) {
        groupRef.current.position.copy(position);
        lastCheckedPosition.current.copy(position);
      }
    } else {
      targetPosition.current.copy(position);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update target rotation — lerped in useFrame to stay consistent with position.
  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  // Attack animation trigger from server.
  useEffect(() => {
    if (!socket) return;

    const handleKnightTelegraph = (data: any) => {
      if (data.knightId !== id) return;
      setIsAttacking(true);
      isAttackingRef.current = true;
      setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
      }, ATTACK_DURATION);
    };

    socket.on('knight-attack-telegraph', handleKnightTelegraph);
    return () => { socket.off('knight-attack-telegraph', handleKnightTelegraph); };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    // Smoothly move the rendered position toward the server-authoritative target.
    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    // Lerp rotation with shortest-arc wrapping so the knight never spins the long way.
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

    // Walking detection — sample every 100 ms. Uses the actual rendered position so the
    // animation reflects real visual movement rather than the raw server target.
    movementCheckTimer.current += delta;
    if (movementCheckTimer.current >= 0.1) {
      const moved = group.position.distanceTo(lastCheckedPosition.current);
      const shouldWalk = moved > MOVEMENT_THRESHOLD && !isAttackingRef.current && !isDying;
      if (shouldWalk !== isWalkingRef.current) {
        isWalkingRef.current = shouldWalk;
        setIsWalking(shouldWalk);
      }
      lastCheckedPosition.current.copy(group.position);
      movementCheckTimer.current = 0;
    }

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
      <KnightModel isWalking={isWalking} isAttacking={isAttacking} />

      {/* Billboard health bar — sits just above the 2-unit-tall knight model */}
      <Billboard position={[0, 2.3, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            {/* Background track */}
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[2.0, 0.25]} />
              <meshBasicMaterial color="#333333" opacity={0.85} transparent />
            </mesh>

            {/* Gold fill — knight theme */}
            <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
              <meshBasicMaterial color="#c8a227" opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.18}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`⚔ ${Math.ceil(health)}/${maxHealth}`}
            </Text>
          </>
        )}
      </Billboard>
    </group>
  );
}
