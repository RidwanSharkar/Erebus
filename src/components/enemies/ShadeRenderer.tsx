'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import ShadeModel from './ShadeModel';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface ShadeRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

// How long the throw animation plays before blending back to idle/walk.
// Tune to match the shade_throw.glb clip length.
const ATTACK_DURATION = 1500; // ms
// How long the blink "teleport" lasts before we hard-snap the mesh.
const BLINK_DURATION  = 600;  // ms — must match shadeCastBlinkAndAttack in enemyAI.js
const FADE_DURATION   = 1.5;  // seconds for death fade-out
const LERP_SPEED      = 20;   // position + rotation chase speed — high value gives the fast-slide blink feel
// Debounce: server must stop sending moves for this long before we switch to Idle.
const WALK_STOP_DELAY = 250; // ms

export default function ShadeRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
}: ShadeRendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking,   setIsWalking]   = useState(false);
  const [isBlinking,  setIsBlinking]  = useState(false);

  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isBlinkingRef  = useRef(false);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer  = useRef(0);
  const opacity    = useRef(1);

  // Callback ref — positions the group at the server location before the first render
  // so the shade never flickers from world-origin.
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

    // Teleport snap for large jumps (spawn / respawn only — blink uses lerp)
    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    // Suppress walk state while blinking or attacking
    if (dist > 0.01 && !isAttackingRef.current && !isBlinkingRef.current && !isDying) {
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

  // Blink telegraph: set the target position and let the high-speed lerp pull the
  // mesh there — this produces the same fast-slide look as the Warlock's blink.
  useEffect(() => {
    if (!socket) return;

    const handleShadeBlink = (data: {
      shadeId: string;
      endPosition: { x: number; y: number; z: number };
      rotation: number;
    }) => {
      if (data.shadeId !== id) return;

      setIsBlinking(true);
      isBlinkingRef.current = true;

      const newPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      targetPosition.current.copy(newPos);
      targetRotation.current = data.rotation;

      // Hard-snap only after the slide finishes so the position is exactly correct.
      setTimeout(() => {
        setIsBlinking(false);
        isBlinkingRef.current = false;
        if (groupRef.current) {
          groupRef.current.position.copy(newPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, BLINK_DURATION);
    };

    socket.on('shade-blink-telegraph', handleShadeBlink);
    return () => { socket.off('shade-blink-telegraph', handleShadeBlink); };
  }, [id, socket]);

  // Listen for the server throw telegraph and drive the attack animation.
  useEffect(() => {
    if (!socket) return;

    const handleShadeTelegraph = (data: any) => {
      if (data.shadeId !== id) return;
      setIsAttacking(true);
      isAttackingRef.current = true;
      setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
      }, ATTACK_DURATION);
    };

    socket.on('shade-attack-telegraph', handleShadeTelegraph);
    return () => { socket.off('shade-attack-telegraph', handleShadeTelegraph); };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    // Shortest-arc rotation lerp
    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);

    // Death fade-out (no dedicated death clip — just dissolve the materials)
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
      <ShadeModel isWalking={isWalking} isAttacking={isAttacking} isBlinking={isBlinking} isDying={isDying} />

      {/* Billboard health bar */}
      <Billboard position={[0, 3, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            {/* Dark background track */}
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[2.0, 0.25]} />
              <meshBasicMaterial color="#1a0a2a" opacity={0.9} transparent />
            </mesh>

            {/* Purple health fill */}
            <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
              <meshBasicMaterial color="#8822cc" opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.18}
              color="#e8d4ff"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`👻 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
          </>
        )}
      </Billboard>
    </group>
  );
}
