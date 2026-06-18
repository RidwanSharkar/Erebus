'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import TemplarModel from './TemplarModel';
import EnemyMeleeAttackRangeRing, { TEMPLAR_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { campHpTheme } from '@/utils/campHpTheme';
import EnemyStaggerBar from './EnemyStaggerBar';
import TemplarSoulCrest from './TemplarSoulCrest';

interface TemplarRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  campType?: string;
  staggerBuildup?: number;
  /** Melee range telegraph; false e.g. for throne training replica */
  showMeleeRangeRing?: boolean;
}

const ATTACK_DURATION = 1200; // ms — matches templar attack clip; backend `meleeLockUntil` uses the same window
const FADE_DURATION   = 1.5;  // seconds for death fade-out
const LERP_SPEED      = 14;   // slightly faster than knight (12) to feel snappier
const WALK_STOP_DELAY = 250;  // ms

export default function TemplarRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  campType,
  staggerBuildup = 0,
  showMeleeRangeRing = true,
}: TemplarRendererProps) {
  const theme = campHpTheme(campType);
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group | null>(null);

  const [isAttacking,   setIsAttacking]   = useState(false);
  const [isWalking,     setIsWalking]     = useState(false);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);
  const [isImpacting,   setIsImpacting]   = useState(false);
  const [impactPlayKey, setImpactPlayKey] = useState(0);
  const [isBlinkSmite,  setIsBlinkSmite]  = useState(false);
  const [blinkSmitePlayKey, setBlinkSmitePlayKey] = useState(0);
  const [isLeaping,     setIsLeaping]     = useState(false);
  const isBlinkSmiteRef = useRef(false);
  const isLeapingRef    = useRef(false);

  const targetPosition  = useRef(position.clone());
  const targetRotation  = useRef(rotation);
  const isAttackingRef  = useRef(false);
  const prevHealthRef   = useRef(health);

  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);

  // Initialise the group at the exact server position before the first frame.
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

    if (dist > 5.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }

    if (dist > 0.01 && !isAttackingRef.current && !isLeapingRef.current && !isDying) {
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

  const handleBlinkSmiteFinished = useCallback(() => {
    setIsBlinkSmite(false);
    isBlinkSmiteRef.current = false;
  }, []);

  useEffect(() => {
    isBlinkSmiteRef.current = isBlinkSmite;
  }, [isBlinkSmite]);

  // Hit-react: health drop while idle (not walk / attack).
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isWalking &&
      !isAttacking
    ) {
      setIsImpacting(true);
      setImpactPlayKey(k => k + 1);
    }
    prevHealthRef.current = health;
  }, [health, isDying, isWalking, isAttacking]);

  useEffect(() => {
    if (isWalking || isAttacking || isBlinkSmite) {
      setIsImpacting(false);
    }
  }, [isWalking, isAttacking, isBlinkSmite]);

  // Attack animation — driven by server telegraph.
  useEffect(() => {
    if (!socket) return;

    const handleTemplarTelegraph = (data: any) => {
      if (data.templarId !== id) return;
      if (isBlinkSmiteRef.current) return;
      setAttackVariant(Math.random() < 0.5 ? 1 : 2);
      setIsAttacking(true);
      isAttackingRef.current = true;
      setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
      }, ATTACK_DURATION);
    };

    const handleTemplarBlinkSmiteWindup = (data: any) => {
      if (data.templarId !== id) return;
      setIsBlinkSmite(true);
      isBlinkSmiteRef.current = true;
      setBlinkSmitePlayKey(k => k + 1);
      setIsAttacking(false);
      isAttackingRef.current = false;
    };

    socket.on('templar-attack-telegraph', handleTemplarTelegraph);
    socket.on('templar-blink-smite-windup', handleTemplarBlinkSmiteWindup);
    const onLeapStart = (data: { templarId: string }) => {
      if (data.templarId !== id) return;
      setIsLeaping(true);
      isLeapingRef.current = true;
      setIsWalking(false);
    };
    const onLeapLand = (data: { templarId: string }) => {
      if (data.templarId !== id) return;
      setIsLeaping(false);
      isLeapingRef.current = false;
    };
    socket.on('templar-leap-start', onLeapStart);
    socket.on('templar-leap-land', onLeapLand);
    return () => {
      socket.off('templar-attack-telegraph', handleTemplarTelegraph);
      socket.off('templar-blink-smite-windup', handleTemplarBlinkSmiteWindup);
      socket.off('templar-leap-start', onLeapStart);
      socket.off('templar-leap-land', onLeapLand);
    };
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
      <TemplarModel
        isWalking={isWalking && !isBlinkSmite && !isLeaping}
        isAttacking={isAttacking && !isBlinkSmite && !isLeaping}
        attackVariant={attackVariant}
        isDying={isDying}
        isLeaping={isLeaping}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
        isBlinkSmite={isBlinkSmite}
        blinkSmitePlayKey={blinkSmitePlayKey}
        onBlinkSmiteFinished={handleBlinkSmiteFinished}
      />

      {!isDying && <TemplarSoulCrest />}

      {/* Billboard health bar */}
      <Billboard position={[0, 3, 0]} follow lockX={false} lockY={false} lockZ={false}>
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
              {`🛡 ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}
