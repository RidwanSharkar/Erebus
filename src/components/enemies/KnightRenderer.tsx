'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { AdditiveBlending, Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard, Text } from '@react-three/drei';
import KnightModel, { type KnightAbilityClip } from './KnightModel';
import KnightSoulEffect from './KnightSoulEffect';
import EnemyMeleeAttackRangeRing, { KNIGHT_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import EnemyStaggerBar from './EnemyStaggerBar';
import { useMultiplayer } from '@/contexts/MultiplayerContext';
import { campHpTheme } from '@/utils/campHpTheme';
import { KNIGHT_CAST_ABILITY_LOCK_MS } from '@/utils/knightCoopAbilitiesConstants';
import GhostTrail from '../dragon/GhostTrail';
import { WeaponType } from '../dragon/weapons';
import ChargedOrbitals, { DashChargeStatus } from '../dragon/ChargedOrbitals';

interface KnightRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  soulType?: 'green' | 'red' | 'blue' | 'purple' | 'yellow';
  campType?: string;
  /** When false, suppresses the colored soul orb and its local lights. */
  showSoulEffect?: boolean;
  /** Allows prep-only spawns to avoid changing room shadow coverage. */
  castShadow?: boolean;
  /** When false, hides the red melee telegraph ring (e.g. throne training dummy). */
  showMeleeRangeRing?: boolean;
  /** Staggering Strike buildup (0–100). */
  staggerBuildup?: number;
  attackTelegraphEvent?: string;
  alternateAttackVariants?: boolean;
  attackVariantOneChance?: number;
  showOrbitals?: boolean;
  orbitalCharges?: DashChargeStatus[];
  orbitalActiveColor?: string;
  orbitalInactiveColor?: string;
  orbitalYOffset?: number;
}

const ATTACK_DURATION = 1200; // ms — matches Mixamo attack clip length
// Ability animation durations — must match the backend meleeLockUntil windows
const SMITE_DURATION = 1200; // Red knight smite (ms)
const HEAL_DURATION  = 1800; // Green/Purple aggro shout (ms)
// knight_cast.glb / Cast clip — see knightCoopAbilitiesConstants (backend enemyAI)
const CAST_ABILITY_MS = KNIGHT_CAST_ABILITY_LOCK_MS;
const FROST_DURATION = CAST_ABILITY_MS; // Blue frost cast (ms)
const SPIN_CHARGE_DURATION = 750;
const SPIN_DURATION = 1033; // 31 frames at 30fps
const FADE_DURATION = 1.5; // seconds
// How quickly (per second) the rendered position chases the server-authoritative target.
// 12 keeps the visual within ~0.17 units of the server position at knight speed (2 u/s),
// tight enough to avoid visible lag while still smoothing out 33 ms server steps.
const LERP_SPEED = 12;
const DASH_LERP_SPEED = 24;
const DASH_DURATION = 350;
// After the server stops sending position updates for this long, transition to idle.
// Must comfortably exceed 2× the server tick (33ms) plus network jitter to avoid
// premature Walk→Idle flicker when the client-side throttle drops an update.
const WALK_STOP_DELAY = 250; // ms
const DEFAULT_SPIN_CHARGE_COLOR = '#fff2a8';
const SPIN_CHARGE_COLORS: Record<NonNullable<KnightRendererProps['soulType']>, string> = {
  green: '#35ff6b',
  red: '#ff3838',
  blue: '#42b7ff',
  purple: '#b55cff',
  yellow: DEFAULT_SPIN_CHARGE_COLOR,
};

export default function KnightRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  soulType,
  campType,
  showSoulEffect = true,
  castShadow = true,
  showMeleeRangeRing = true,
  staggerBuildup = 0,
  attackTelegraphEvent = 'knight-attack-telegraph',
  alternateAttackVariants = false,
  attackVariantOneChance = 0.65,
  showOrbitals = false,
  orbitalCharges = [],
  orbitalActiveColor,
  orbitalInactiveColor,
  orbitalYOffset = 2.1,
}: KnightRendererProps) {
  const theme = campHpTheme(campType);
  const { socket } = useMultiplayer();
  const spinChargeColor = soulType ? SPIN_CHARGE_COLORS[soulType] : DEFAULT_SPIN_CHARGE_COLOR;
  const groupRef = useRef<Group | null>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [isWalking, setIsWalking] = useState(false);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);
  const [abilityClip, setAbilityClip] = useState<KnightAbilityClip | null>(null);
  const [isDashing, setIsDashing] = useState(false);
  const [isSpinCharging, setIsSpinCharging] = useState(false);
  const [isImpacting, setIsImpacting] = useState(false);
  const [impactVariant, setImpactVariant] = useState<1 | 2>(1);
  const [impactPlayKey, setImpactPlayKey] = useState(0);

  const prevHealthRef = useRef(health);
  const nextImpactVariantRef = useRef<1 | 2>(1);
  const nextAttackVariantRef = useRef<1 | 2>(1);

  // Server-authoritative targets — updated when props change (single source of truth).
  // The group is NEVER written to from effects; only useFrame lerps toward these refs.
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation);

  const isAttackingRef = useRef(false);
  const isAbilityRef   = useRef(false);
  const isDashingRef   = useRef(false);

  // Timer handle for the delayed idle transition after server stops sending moves.
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinChargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinTravelRef = useRef<{
    start: Vector3;
    end: Vector3;
    startedAt: number;
    duration: number;
  } | null>(null);
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

    // While executing an attack or ability, ignore position updates entirely.
    // The backend locks the knight in place during these windows; any in-flight
    // packets that arrive during the animation should not cause sliding.
    const isLocked = isAttackingRef.current || isAbilityRef.current || isDashingRef.current;
    if (!isLocked) {
      targetPosition.current.copy(position);
    }

    if (dist > 5.0 && groupRef.current && !isLocked) {
      // Actual teleport (spawn, respawn) — snap so the knight doesn't swim the map.
      groupRef.current.position.copy(position);
    }

    // Server moved the knight a meaningful amount → it's walking.
    if (dist > 0.01 && !isLocked && !isDying) {
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
    return () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
    };
  }, []);

  // Update target rotation — lerped in useFrame to stay consistent with position.
  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  // Hit-react: server health drop while idle (not walk / attack / ability).
  useEffect(() => {
    if (
      health < prevHealthRef.current &&
      !isDying &&
      !isWalking &&
      !isAttacking &&
      !isDashing &&
      !abilityClip
    ) {
      const v = nextImpactVariantRef.current;
      nextImpactVariantRef.current = v === 1 ? 2 : 1;
      setImpactVariant(v);
      setIsImpacting(true);
      setImpactPlayKey(k => k + 1);
    }
    prevHealthRef.current = health;
  }, [health, isDying, isWalking, isAttacking, isDashing, abilityClip]);

  // Higher-priority states interrupt impact (e.g. attack telegraph) so `isImpacting` cannot get stuck
  // if the mixer never fires `finished` for a faded-out impact.
  useEffect(() => {
    if (isWalking || isAttacking || isDashing || abilityClip) {
      setIsImpacting(false);
    }
  }, [isWalking, isAttacking, isDashing, abilityClip]);

  // Attack animation trigger from server.
  useEffect(() => {
    if (!socket) return;

    const handleKnightTelegraph = (data: any) => {
      if (data.knightId !== id) return;
      if (alternateAttackVariants) {
        const variant = nextAttackVariantRef.current;
        nextAttackVariantRef.current = variant === 1 ? 2 : 1;
        setAttackVariant(variant);
      } else {
        setAttackVariant(Math.random() < attackVariantOneChance ? 1 : 2);
      }
      setIsAttacking(true);
      isAttackingRef.current = true;
      setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
      }, ATTACK_DURATION);
    };

    socket.on(attackTelegraphEvent, handleKnightTelegraph);
    return () => { socket.off(attackTelegraphEvent, handleKnightTelegraph); };
  }, [id, socket, attackTelegraphEvent, alternateAttackVariants, attackVariantOneChance]);

  // Post-boss mobility: server-authoritative dash, visually matched to player dash timing.
  useEffect(() => {
    if (!socket) return;

    const handleKnightDash = (data: {
      knightId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
      durationMs?: number;
    }) => {
      if (data.knightId !== id) return;

      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      const duration = data.durationMs ?? DASH_DURATION;

      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
      spinTravelRef.current = null;

      setIsWalking(false);
      setIsImpacting(false);
      setIsSpinCharging(false);
      setAbilityClip(null);
      setIsDashing(true);
      isAbilityRef.current = false;
      isDashingRef.current = true;
      targetPosition.current.copy(endPos);
      targetRotation.current = data.rotation;

      if (groupRef.current) {
        groupRef.current.position.copy(startPos);
        groupRef.current.rotation.y = data.rotation;
      }

      dashTimer.current = setTimeout(() => {
        setIsDashing(false);
        isDashingRef.current = false;
        spinTravelRef.current = null;
        if (groupRef.current) {
          groupRef.current.position.copy(endPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, duration);
    };

    socket.on('knight-dash', handleKnightDash);
    return () => { socket.off('knight-dash', handleKnightDash); };
  }, [id, socket]);

  // Spinning sword attack: server-authoritative charge, then timed travel.
  useEffect(() => {
    if (!socket) return;

    const handleKnightSpinCharge = (data: {
      knightId: string;
      position?: { x: number; y: number; z: number };
      rotation: number;
      chargeMs?: number;
    }) => {
      if (data.knightId !== id) return;

      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
      spinTravelRef.current = null;

      const chargeMs = data.chargeMs ?? SPIN_CHARGE_DURATION;
      setIsWalking(false);
      setIsImpacting(false);
      setIsDashing(false);
      setAbilityClip(null);
      setIsSpinCharging(true);
      isDashingRef.current = false;
      isAbilityRef.current = true;
      targetRotation.current = data.rotation;

      if (data.position && groupRef.current) {
        const chargePos = new Vector3(data.position.x, data.position.y, data.position.z);
        targetPosition.current.copy(chargePos);
        groupRef.current.position.copy(chargePos);
        groupRef.current.rotation.y = data.rotation;
      }

      spinChargeTimer.current = setTimeout(() => {
        setIsSpinCharging(false);
      }, chargeMs);
    };

    const handleKnightSpinDash = (data: {
      knightId: string;
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
      durationMs?: number;
    }) => {
      if (data.knightId !== id) return;

      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      const duration = data.durationMs ?? SPIN_DURATION;

      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);

      setIsWalking(false);
      setIsImpacting(false);
      setIsSpinCharging(false);
      setAbilityClip('Spin');
      setIsDashing(true);
      isAbilityRef.current = true;
      isDashingRef.current = true;
      targetPosition.current.copy(endPos);
      targetRotation.current = data.rotation;
      spinTravelRef.current = {
        start: startPos.clone(),
        end: endPos.clone(),
        startedAt: performance.now(),
        duration,
      };

      if (groupRef.current) {
        groupRef.current.position.copy(startPos);
        groupRef.current.rotation.y = data.rotation;
      }

      dashTimer.current = setTimeout(() => {
        setAbilityClip(null);
        setIsDashing(false);
        isAbilityRef.current = false;
        isDashingRef.current = false;
        spinTravelRef.current = null;
        if (groupRef.current) {
          groupRef.current.position.copy(endPos);
          groupRef.current.rotation.y = data.rotation;
        }
      }, duration);
    };

    socket.on('knight-spin-charge', handleKnightSpinCharge);
    socket.on('knight-spin-dash', handleKnightSpinDash);
    return () => {
      socket.off('knight-spin-charge', handleKnightSpinCharge);
      socket.off('knight-spin-dash', handleKnightSpinDash);
    };
  }, [id, socket]);

  // Ability animation triggers from server — one handler per soul-type ability.
  useEffect(() => {
    if (!socket) return;

    // Red Knight — Smite
    const handleSmiteTelegraph = (data: any) => {
      if (data.knightId !== id) return;
      isAbilityRef.current = true;
      setAbilityClip('Smite');
      setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, SMITE_DURATION);
    };

    // Green / Purple Knight — Aggro Shout (self-heal)
    const handleHealTelegraph = (data: any) => {
      if (data.knightId !== id) return;
      const soundPos = groupRef.current?.position.clone() ?? targetPosition.current.clone();
      (window as any).audioSystem?.playKnightAggroSound?.(soundPos);
      isAbilityRef.current = true;
      setAbilityClip('Aggro');
      setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, HEAL_DURATION);
    };

    // Blue Knight — Frost Ray
    const handleFrostTelegraph = (data: any) => {
      if (data.knightId !== id) return;
      isAbilityRef.current = true;
      setAbilityClip('Cast');
      setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, CAST_ABILITY_MS);
    };

    // Red / Green — Death Grasp (same cast clip as frost)
    const handleDeathGraspTelegraph = (data: any) => {
      if (data.knightId !== id) return;
      isAbilityRef.current = true;
      setAbilityClip('Cast');
      setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
      }, CAST_ABILITY_MS);
    };

    socket.on('knight-smite-telegraph', handleSmiteTelegraph);
    socket.on('knight-heal-telegraph',  handleHealTelegraph);
    socket.on('knight-frost-telegraph', handleFrostTelegraph);
    socket.on('knight-deathgrasp-telegraph', handleDeathGraspTelegraph);
    return () => {
      socket.off('knight-smite-telegraph', handleSmiteTelegraph);
      socket.off('knight-heal-telegraph',  handleHealTelegraph);
      socket.off('knight-frost-telegraph', handleFrostTelegraph);
      socket.off('knight-deathgrasp-telegraph', handleDeathGraspTelegraph);
    };
  }, [id, socket]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    const spinTravel = spinTravelRef.current;
    if (spinTravel) {
      const t = Math.min(1, (performance.now() - spinTravel.startedAt) / spinTravel.duration);
      group.position.copy(spinTravel.start).lerp(spinTravel.end, t);
    } else {
      // Smoothly move the rendered position toward the server-authoritative target.
      group.position.lerp(targetPosition.current, Math.min(1, delta * (isDashingRef.current ? DASH_LERP_SPEED : LERP_SPEED)));
    }

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
    <>
    <GhostTrail
      parentRef={groupRef as React.RefObject<Group>}
      weaponType={WeaponType.NONE}
      fixedTrailColor={spinChargeColor}
      isTrailMotionRef={isDashingRef}
      yOffset={1.0}
    />

    {showOrbitals && orbitalCharges.length > 0 && !isDying && (
      <ChargedOrbitals
        parentRef={groupRef as React.RefObject<Group>}
        dashCharges={orbitalCharges}
        weaponType={WeaponType.NONE}
        yOffset={orbitalYOffset}
        customActiveColor={orbitalActiveColor}
        customInactiveColor={orbitalInactiveColor}
      />
    )}

    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      {isSpinCharging && !isDying && (
        <>
          <pointLight position={[0, 1.25, 0]} color={spinChargeColor} intensity={6} distance={5} />
          <mesh position={[0, 1.1, 0]}>
            <sphereGeometry args={[1, 32, 16]} />
            <meshBasicMaterial
              color={spinChargeColor}
              transparent
              opacity={0.32}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </>
      )}
      <KnightModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        attackVariant={attackVariant}
        isDying={isDying}
        soulType={soulType}
        castShadow={castShadow}
        abilityClip={abilityClip}
        isImpacting={isImpacting}
        impactVariant={impactVariant}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
      />


      {/* Glowing soul orb floating above the knight */}
      {showSoulEffect && soulType && !isDying && (
        <KnightSoulEffect soulType={soulType} />
      )}

      {/* Billboard health bar — above the knight model head */}
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
              {`⚔ ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
    </>
  );
}
