'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import KnightModel from './KnightModel';
import KnightSoulEffect from './KnightSoulEffect';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface KnightRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  soulType?: 'green' | 'red' | 'blue' | 'purple';
}

const ATTACK_DURATION = 1200; // ms — matches Mixamo attack clip length
const FADE_DURATION = 1.5; // seconds
// How quickly (per second) the rendered position chases the server-authoritative target.
// 12 keeps the visual within ~0.17 units of the server position at knight speed (2 u/s),
// tight enough to avoid visible lag while still smoothing out 33 ms server steps.
const LERP_SPEED = 12;
// After the server stops sending position updates for this long, transition to idle.
// Must comfortably exceed 2× the server tick (33ms) plus network jitter to avoid
// premature Walk→Idle flicker when the client-side throttle drops an update.
const WALK_STOP_DELAY = 250; // ms

export default function KnightRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  soulType,
}: KnightRendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);

  // Server-authoritative targets — updated when props change (single source of truth).
  // The group is NEVER written to from effects; only useFrame lerps toward these refs.
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);

  const isAttackingRef = useRef(false);

  // Timer handle for the delayed idle transition after server stops sending moves.
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);

  // Callback ref — fires synchronously when the <group> mounts, before the first
  // WebGL frame, so the knight is never rendered at the world origin.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update the target whenever the server position prop changes.
  // Walking state is derived here from server deltas — deterministic and immune to
  // lerp timing — instead of sampling the rendered position in useFrame.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 5.0 && groupRef.current) {
      // Actual teleport (spawn, respawn) — snap so the knight doesn't swim the map.
      groupRef.current.position.copy(position);
    }

    // Server moved the knight a meaningful amount → it's walking.
    if (dist > 0.01 && !isAttackingRef.current && !isDying) {
      if (!isWalking) setIsWalking(true);

      // Push back the idle-transition timer: as long as the server keeps sending
      // movement updates the knight stays in its walk animation.
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => {
        setIsWalking(false);
      }, WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up the walk-stop timer on unmount.
  useEffect(() => {
    return () => { if (walkStopTimer.current) clearTimeout(walkStopTimer.current); };
  }, []);

  // Update target rotation — lerped in useFrame to stay consistent with position.
  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  // Attack animation trigger from server.
  useEffect(() => {
    if (!socket) return;

    const handleKnightTelegraph = (data: any) => {
      if (data.knightId !== id) return;
      setAttackVariant(Math.random() < 0.65 ? 1 : 2);
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
      <KnightModel isWalking={isWalking} isAttacking={isAttacking} attackVariant={attackVariant} isDying={isDying} />

      {/* Glowing soul orb floating above the knight */}
      {soulType && !isDying && (
        <KnightSoulEffect soulType={soulType} />
      )}

      {/* Billboard health bar — above the knight model head */}
      <Billboard position={[0, 3, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            {/* Background track — deep wine */}
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[2.0, 0.25]} />
              <meshBasicMaterial color="#2a1218" opacity={0.9} transparent />
            </mesh>

            {/* Health fill — crimson */}
            <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
              <meshBasicMaterial color="#dc143c" opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.18}
              color="#fde8ec"
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
