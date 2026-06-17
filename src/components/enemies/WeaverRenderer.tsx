'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { EnemyDynamicLight } from '@/components/effects/DynamicLightPool';

import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import WeaverModel from './WeaverModel';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { campHpTheme } from '@/utils/campHpTheme';
import EnemyStaggerBar from './EnemyStaggerBar';

interface WeaverRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  /** Co-op: green = support weaver, blue = lightning weaver (aura colour) */
  soulType?: 'green' | 'blue' | 'red' | 'purple' | 'yellow';
  staggerBuildup?: number;
}

const CAST_HEAL_DURATION   = 2000; // ms — matches weaver_castheal clip length
const CAST_SUMMON_DURATION = 3000; // ms — matches weaver_castsummon clip length
const FADE_DURATION        = 1.5;  // seconds for death fade-out
const LERP_SPEED           = 12;
const WALK_STOP_DELAY      = 250;  // ms
const HIT_REACT_IMPACT_COOLDOWN_MS = 1500; // min time between weaver_impact.glb hit-react plays

export default function WeaverRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  soulType,
  staggerBuildup = 0,
}: WeaverRendererProps) {
  const theme = campHpTheme(campType);
  const isBlue = soulType === 'blue';
  const auraRing = isBlue
    ? { color: '#44aaff', emissive: '#2060c0' }
    : { color: '#00ff55', emissive: '#00cc33' };
  const auraDisc = isBlue
    ? { color: '#3388dd', emissive: '#1a50aa' }
    : { color: '#00cc44', emissive: '#00aa22' };
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isCastingHeal,   setIsCastingHeal]   = useState(false);
  const [isCastingSummon, setIsCastingSummon] = useState(false);
  const [isWalking,       setIsWalking]       = useState(false);
  const [isImpacting,     setIsImpacting]     = useState(false);
  const [impactPlayKey,   setImpactPlayKey]   = useState(0);

  const targetPosition   = useRef(position.clone());
  const targetRotation   = useRef(rotation);
  const isCastingRef     = useRef(false);
  const prevHealthRef    = useRef(health);
  const lastHitImpactAtRef = useRef(0);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);
  const auraGroupRef  = useRef<Group | null>(null);

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

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  // Hit-react: health drop while idle (not walk / cast).
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isWalking &&
      !isCastingHeal &&
      !isCastingSummon
    ) {
      const now = performance.now();
      if (now - lastHitImpactAtRef.current >= HIT_REACT_IMPACT_COOLDOWN_MS) {
        lastHitImpactAtRef.current = now;
        setIsImpacting(true);
        setImpactPlayKey(k => k + 1);
      }
    }
    prevHealthRef.current = health;
  }, [health, isDying, isWalking, isCastingHeal, isCastingSummon]);

  useEffect(() => {
    if (isWalking || isCastingHeal || isCastingSummon) {
      setIsImpacting(false);
    }
  }, [isWalking, isCastingHeal, isCastingSummon]);

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

    // Aura is a scene-level sibling group — mirror the weaver's XZ, stay at ground Y
    if (auraGroupRef.current && !isDying) {
      const pos = group.position;
      auraGroupRef.current.position.set(pos.x, 0.2, pos.z);
      auraGroupRef.current.rotation.y += 0.15 * 0.008;
    }
  });

  return (
    <>
      {/* Permanent ground aura — green (support) or blue (lightning) */}
      {!isDying && (
        <group ref={auraGroupRef}>
          {/* Four triangular ring segments, flat on the ground */}
          <group>
            {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rot, i) => (
              <mesh key={i} rotation={[-Math.PI / 2, 0, rot]}>
                <ringGeometry args={[0.85, 1.0, 3]} />
                <meshStandardMaterial
                  color={auraRing.color}
                  emissive={auraRing.emissive}
                  emissiveIntensity={2}
                  transparent
                  opacity={0.6}
                  depthWrite={false}
                  side={2}
                />
              </mesh>
            ))}
          </group>
          {/* Disc beneath the rings */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.925, 32]} />
            <meshStandardMaterial
              color={auraDisc.color}
              emissive={auraDisc.emissive}
              emissiveIntensity={1}
              transparent
              opacity={0.45}
              depthWrite={false}
              side={2}
            />
          </mesh>

          <EnemyDynamicLight color="auraRing.color" intensity={0.5} distance={12} decay={6} position={[0, 2, -0.5]} />
          <EnemyDynamicLight color="auraDisc.color" intensity={3} distance={8} decay={2} position={[0, 1, 0]} />
        </group>
      )}

      <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <WeaverModel
        isWalking={isWalking}
        isCastingHeal={isCastingHeal}
        isCastingSummon={isCastingSummon}
        isDying={isDying}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
      />

      <Billboard position={[0, 3.2, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[2.0, 0.25]} />
              <meshBasicMaterial color={theme.background} opacity={0.9} transparent />
            </mesh>

            <mesh position={[-1.0 + (health / maxHealth), 0, 0.001]}>
              <planeGeometry args={[(health / maxHealth) * 2.0, 0.23]} />
              <meshBasicMaterial color={theme.fill} opacity={0.95} transparent />
            </mesh>

            <Text
              position={[0, 0, 0.002]}
              fontSize={0.18}
              color={theme.text}
              anchorX="center"
              anchorY="middle"
              fontWeight="bold"
            >
              {`🧵 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
      </group>
    </>
  );
}
