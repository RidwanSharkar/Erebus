'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import WeaverModel from './WeaverModel';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

interface WeaverRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
}

const CAST_HEAL_DURATION   = 2000; // ms — matches weaver_castheal clip length
const CAST_SUMMON_DURATION = 3000; // ms — matches weaver_castsummon clip length
const FADE_DURATION        = 1.5;  // seconds for death fade-out
const LERP_SPEED           = 12;
const WALK_STOP_DELAY      = 250;  // ms

export default function WeaverRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
}: WeaverRendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isCastingHeal,   setIsCastingHeal]   = useState(false);
  const [isCastingSummon, setIsCastingSummon] = useState(false);
  const [isWalking,       setIsWalking]       = useState(false);

  const targetPosition   = useRef(position.clone());
  const targetRotation   = useRef(rotation);
  const isCastingRef     = useRef(false);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isCastingRef.current && !isDying) {
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

  // Weaver heal cast telegraph
  useEffect(() => {
    if (!socket) return;

    const handleHealTelegraph = (data: { weaverId: string }) => {
      if (data.weaverId !== id) return;
      isCastingRef.current = true;
      setIsCastingHeal(true);
      setTimeout(() => {
        setIsCastingHeal(false);
        isCastingRef.current = isCastingSummon;
      }, CAST_HEAL_DURATION);
    };

    socket.on('weaver-heal-telegraph', handleHealTelegraph);
    return () => { socket.off('weaver-heal-telegraph', handleHealTelegraph); };
  }, [id, socket, isCastingSummon]);

  // Weaver summon ghoul telegraph
  useEffect(() => {
    if (!socket) return;

    const handleSummonTelegraph = (data: { weaverId: string }) => {
      if (data.weaverId !== id) return;
      isCastingRef.current = true;
      setIsCastingSummon(true);
      setTimeout(() => {
        setIsCastingSummon(false);
        isCastingRef.current = false;
      }, CAST_SUMMON_DURATION);
    };

    socket.on('weaver-summon-telegraph', handleSummonTelegraph);
    return () => { socket.off('weaver-summon-telegraph', handleSummonTelegraph); };
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
      <WeaverModel
        isWalking={isWalking}
        isCastingHeal={isCastingHeal}
        isCastingSummon={isCastingSummon}
        isDying={isDying}
      />

      <Billboard position={[0, 3.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[2.0, 0.25]} />
              <meshBasicMaterial color="#0a1a0a" opacity={0.9} transparent />
            </mesh>

            <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
              <meshBasicMaterial color="#22cc55" opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.18}
              color="#aaffcc"
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`🧵 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
          </>
        )}
      </Billboard>
    </group>
  );
}
