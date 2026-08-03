'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Vector3, Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import KnightModel, { type KnightAbilityClip } from './KnightModel';
import KnightBlockShield from './KnightBlockShield';
import KnightSoulEffect from './KnightSoulEffect';
import EnemyMeleeAttackRangeRing, { KNIGHT_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyAbilityChargeTelegraph from './EnemyAbilityChargeTelegraph';
import { registerKnightAnimationHandlers } from '@/utils/knightAnimationDispatch';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getUnitNameplateName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';
import { KNIGHT_CAST_ABILITY_LOCK_MS, KNIGHT_STORM_LASH_DURATION_MS } from '@/utils/knightCoopAbilitiesConstants';
import GhostTrail from '../dragon/GhostTrail';
import { WeaponType } from '../dragon/weapons';
import ChargedOrbitals, { DashChargeStatus } from '../dragon/ChargedOrbitals';

interface KnightRendererProps {
  id: string;
  position: Position3;
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
  /** Use fast walk animation regardless of soulType (allied knight with Abyssal Initiate). */
  forceFastWalk?: boolean;
  /** Visual scale multiplier (e.g. Boss1 elite knights). */
  visualScale?: number;
  /** Co-op hit-react: training dummy always (1s CD), enemy only on stun or >400 dmg, off for allies. */
  impactHitReactMode?: 'training-dummy' | 'enemy' | 'off';
}

const TRAINING_DUMMY_IMPACT_COOLDOWN_MS = 1000;
const KNIGHT_ENEMY_IMPACT_DAMAGE_THRESHOLD = 400;

const ATTACK_DURATION = 1200; // ms — matches Mixamo attack clip length
// Ability animation durations — must match the backend meleeLockUntil windows
const SMITE_DURATION = 1200; // Red knight smite (ms)
const HEAL_DURATION  = 1800; // Green/Purple aggro shout (ms)
// knight_cast.glb / Cast clip — see knightCoopAbilitiesConstants (backend enemyAI)
const CAST_ABILITY_MS = KNIGHT_CAST_ABILITY_LOCK_MS;
const FROST_DURATION = CAST_ABILITY_MS; // Purple frost cast (ms)
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

function KnightRenderer({
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
  forceFastWalk = false,
  visualScale = 1,
  impactHitReactMode = 'off',
}: KnightRendererProps) {
  const theme = campHpTheme(campType);
  const { enemyTransformsRef, enemyVisualRotationsRef, enemiesRef, subscribeEnemyDamage } = useMultiplayerActions();
  const spinChargeColor = soulType ? SPIN_CHARGE_COLORS[soulType] : DEFAULT_SPIN_CHARGE_COLOR;
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const isWalkingRef = useRef(false);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);
  const [abilityClip, setAbilityClip] = useState<KnightAbilityClip | null>(null);
  const [abilityPlayKey, setAbilityPlayKey] = useState(0);
  const [isDashing, setIsDashing] = useState(false);
  const [isSpinCharging, setIsSpinCharging] = useState(false);
  const [isImpacting, setIsImpacting] = useState(false);
  const [impactVariant, setImpactVariant] = useState<1 | 2>(1);
  const [impactPlayKey, setImpactPlayKey] = useState(0);

  const nextImpactVariantRef = useRef<1 | 2>(1);
  const nextAttackVariantRef = useRef<1 | 2>(1);
  const lastImpactAtRef = useRef(0);
  const isDyingRef = useRef(isDying);
  const abilityClipRef = useRef<KnightAbilityClip | null>(abilityClip);

  // Server-authoritative targets — updated when props change (single source of truth).
  // The group is NEVER written to from effects; only useFrame lerps toward these refs.
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);

  const isAttackingRef = useRef(false);
  const isAbilityRef   = useRef(false);
  const isDashingRef   = useRef(false);

  // Timer handle for the delayed idle transition after server stops sending moves.
  const lastMoveTimeRef = useRef(0);
  const dashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinChargeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abilityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const spinTravelRef = useRef<{
    start: Vector3;
    end: Vector3;
    startedAt: number;
    duration: number;
  } | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

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
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));

    // While executing an attack or ability, ignore position updates entirely.
    // The backend locks the knight in place during these windows; any in-flight
    // packets that arrive during the animation should not cause sliding.
    const isLocked = isAttackingRef.current || isAbilityRef.current || isDashingRef.current;
    if (!isLocked) {
      targetPosition.current.set(position.x, position.y, position.z);
    }

    if (dist > 5.0 && groupRef.current && !isLocked) {
      // Actual teleport (spawn, respawn) — snap so the knight doesn't swim the map.
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clean up timers on unmount.
  useEffect(() => {
    return () => {
      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current);
    };
  }, []);

  // Update target rotation — lerped in useFrame to stay consistent with position.
  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  const handleBlockStartFinished = useCallback(() => {
    if (abilityClipRef.current === 'StartBlock') {
      setAbilityClip('IdleBlock');
    }
  }, []);

  useEffect(() => {
    isDyingRef.current = isDying;
  }, [isDying]);

  useEffect(() => {
    abilityClipRef.current = abilityClip;
  }, [abilityClip]);

  const playImpact = useCallback(() => {
    if (isDyingRef.current) return;
    if (
      isWalkingRef.current ||
      isAttackingRef.current ||
      isDashingRef.current ||
      abilityClipRef.current
    ) {
      return;
    }
    const v = nextImpactVariantRef.current;
    nextImpactVariantRef.current = v === 1 ? 2 : 1;
    setImpactVariant(v);
    setIsImpacting(true);
    setImpactPlayKey((k) => k + 1);
  }, []);

  // Hit-react from confirmed server damage (React health prop is ref-only in co-op).
  useEffect(() => {
    if (impactHitReactMode === 'off') return;

    return subscribeEnemyDamage((event) => {
      if (event.enemyId !== id || event.damage <= 0) return;

      const now = Date.now();

      if (impactHitReactMode === 'training-dummy') {
        if (now - lastImpactAtRef.current < TRAINING_DUMMY_IMPACT_COOLDOWN_MS) return;
        lastImpactAtRef.current = now;
        playImpact();
        return;
      }

      const enemy = enemiesRef.current.get(id);
      const stunnedUntil = enemy?.stunnedUntilMs ?? 0;
      const isStunned = now < stunnedUntil;
      if (!isStunned && event.damage <= KNIGHT_ENEMY_IMPACT_DAMAGE_THRESHOLD) return;

      playImpact();
    });
  }, [id, impactHitReactMode, subscribeEnemyDamage, enemiesRef, playImpact]);

  // Higher-priority states interrupt impact (e.g. attack telegraph) so `isImpacting` cannot get stuck
  // if the mixer never fires `finished` for a faded-out impact.
  useEffect(() => {
    if (isWalking || isAttacking || isDashing || abilityClip) {
      setIsImpacting(false);
    }
  }, [isWalking, isAttacking, isDashing, abilityClip]);

  // Animation telegraphs — registered centrally via knightAnimationDispatch (one socket listener per event).
  useEffect(() => {
    const handleKnightTelegraph = (data: {
      knightId: string;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (alternateAttackVariants) {
        const variant = nextAttackVariantRef.current;
        nextAttackVariantRef.current = variant === 1 ? 2 : 1;
        setAttackVariant(variant);
      } else {
        setAttackVariant(Math.random() < attackVariantOneChance ? 1 : 2);
      }
      const visual = parseMeleeTelegraphPayload(data, KNIGHT_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      attackTimerRef.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        attackTimerRef.current = null;
      }, duration);
    };

    const handleKnightWhiff = (_data: { knightId: string }) => {
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    const handleKnightDash = (data: {
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
      durationMs?: number;
    }) => {
      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      const duration = data.durationMs ?? DASH_DURATION;

      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
      spinTravelRef.current = null;

      isWalkingRef.current = false;
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

    const handleKnightSpinCharge = (data: {
      position?: { x: number; y: number; z: number };
      rotation: number;
      chargeMs?: number;
    }) => {
      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);
      spinTravelRef.current = null;

      const chargeMs = data.chargeMs ?? SPIN_CHARGE_DURATION;
      isWalkingRef.current = false;
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
      startPosition: { x: number; y: number; z: number };
      endPosition: { x: number; y: number; z: number };
      rotation: number;
      durationMs?: number;
    }) => {
      const startPos = new Vector3(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      const endPos = new Vector3(data.endPosition.x, data.endPosition.y, data.endPosition.z);
      const duration = data.durationMs ?? SPIN_DURATION;

      if (dashTimer.current) clearTimeout(dashTimer.current);
      if (spinChargeTimer.current) clearTimeout(spinChargeTimer.current);

      isWalkingRef.current = false;
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

    const handleSmiteTelegraph = () => {
      isAbilityRef.current = true;
      setAbilityClip('Smite');
      if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current);
      abilityTimerRef.current = setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
        abilityTimerRef.current = null;
      }, SMITE_DURATION);
    };

    const handleHealTelegraph = () => {
      const soundPos = groupRef.current?.position.clone() ?? targetPosition.current.clone();
      (window as any).audioSystem?.playKnightAggroSound?.(soundPos);
      isAbilityRef.current = true;
      setAbilityClip('Aggro');
      if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current);
      abilityTimerRef.current = setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
        abilityTimerRef.current = null;
      }, HEAL_DURATION);
    };

    const handleFrostTelegraph = () => {
      isAbilityRef.current = true;
      setAbilityClip('Cast');
      if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current);
      abilityTimerRef.current = setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
        abilityTimerRef.current = null;
      }, CAST_ABILITY_MS);
    };

    const handleStormLashTelegraph = () => {
      isAbilityRef.current = true;
      setAbilityClip('Cast');
      setAbilityPlayKey(k => k + 1);
      if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current);
      abilityTimerRef.current = setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
        abilityTimerRef.current = null;
      }, KNIGHT_STORM_LASH_DURATION_MS);
    };

    const handleStormLashZap = () => {
      setAbilityPlayKey(k => k + 1);
    };

    const handleDeathGraspTelegraph = () => {
      isAbilityRef.current = true;
      setAbilityClip('Cast');
      if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current);
      abilityTimerRef.current = setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
        abilityTimerRef.current = null;
      }, CAST_ABILITY_MS);
    };

    const handleBlockTelegraph = (data: { durationMs: number; startBlockMs?: number }) => {
      isAbilityRef.current = true;
      setIsImpacting(false);
      setAbilityClip('StartBlock');
      if (abilityTimerRef.current) clearTimeout(abilityTimerRef.current);
      abilityTimerRef.current = setTimeout(() => {
        setAbilityClip(null);
        isAbilityRef.current = false;
        abilityTimerRef.current = null;
      }, data.durationMs);
    };

    return registerKnightAnimationHandlers(id, {
      onAttackTelegraph: handleKnightTelegraph,
      onAttackWhiff: handleKnightWhiff,
      onDash: handleKnightDash,
      onSpinCharge: handleKnightSpinCharge,
      onSpinDash: handleKnightSpinDash,
      onSmiteTelegraph: handleSmiteTelegraph,
      onHealTelegraph: handleHealTelegraph,
      onFrostTelegraph: handleFrostTelegraph,
      onStormLashTelegraph: handleStormLashTelegraph,
      onStormLashZap: handleStormLashZap,
      onDeathGraspTelegraph: handleDeathGraspTelegraph,
      onBlockTelegraph: handleBlockTelegraph,
    });
  }, [id, alternateAttackVariants, attackVariantOneChance]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(
      hpFillRef,
      enemiesRef,
      id,
      health,
      maxHealth,
    );
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    const isLocked = isAttackingRef.current || isAbilityRef.current || isDashingRef.current;
    if (dist > 5.0 && !isLocked) {
      group.position.copy(targetPosition.current);
    }

    // Walk state from live server transform deltas (ref-only movement store).
    updateEnemyWalkStateFromMoveDist(
      dist,
      isLocked,
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

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
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    // Death fade-out.
    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      if (!deathCacheBuilt.current) {
        const collected: any[] = [];
        group.traverse((child: any) => {
          if (child.isMesh && child.material) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((mat: any) => {
              mat.transparent = true;
              collected.push(mat);
            });
          }
        });
        cachedDeathMats.current = collected;
        deathCacheBuilt.current = true;
      }

      const op = opacity.current;
      for (let i = 0; i < cachedDeathMats.current.length; i++) {
        cachedDeathMats.current[i].opacity = op;
      }
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
      <EnemyAbilityChargeTelegraph
        active={isSpinCharging && !isDying}
        primaryColor={spinChargeColor}
      />
      <KnightModel
        isWalking={isWalking}
        isAttacking={isAttacking}
        attackVariant={attackVariant}
        isDying={isDying}
        soulType={soulType}
        forceFastWalk={forceFastWalk}
        scaleMultiplier={visualScale}
        castShadow={castShadow}
        abilityClip={abilityClip}
        abilityPlayKey={abilityPlayKey}
        isImpacting={isImpacting}
        impactVariant={impactVariant}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
        onBlockStartFinished={handleBlockStartFinished}
      />

      <KnightBlockShield
        active={abilityClip === 'IdleBlock' && !isDying}
        visualScale={visualScale}
      />

      {showMeleeRangeRing && isAttacking && !isDying && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? KNIGHT_MELEE_ATTACK_RANGE}
          hitDelayMs={meleeTelegraph?.hitDelayMs}
          swingLockMs={meleeTelegraph?.swingLockMs}
          arcDeg={meleeTelegraph?.arcDeg}
          facing={meleeTelegraph?.facing}
          weightClass={meleeTelegraph?.weightClass}
          whiffed={meleeTelegraph?.whiffed}
          startedAtMs={meleeTelegraph?.startedAtMs}
          commitAtMs={meleeTelegraph?.commitAtMs}
        />
      )}

      {/* Glowing soul orb floating above the knight */}
      {showSoulEffect && soulType && !isDying && (
        <KnightSoulEffect soulType={soulType} />
      )}

      {/* Billboard health bar — above the knight model head */}
      <Billboard position={[0, 3 * visualScale, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />

            <EnemyHealthBarTextLabel
              name={getUnitNameplateName('knight', campType)}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.18}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
    </>
  );
}

export default React.memo(KnightRenderer);
