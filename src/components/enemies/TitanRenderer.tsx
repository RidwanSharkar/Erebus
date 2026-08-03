'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useCallback, useLayoutEffect } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import TitanModel from './TitanModel';
import TitanSoulEffect from './TitanSoulEffect';
import TitanBladestorm from './TitanBladestorm';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyMeleeAttackRangeRing, { TITAN_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_FILL_Z,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';

const SOUL_TYPES = ['green', 'red', 'blue', 'purple'] as const;
type SoulType = typeof SOUL_TYPES[number];

const TITAN_DISPLAY_NAMES: Record<SoulType, string> = {
  blue:   'STORM TITAN',
  purple: 'TITAN OF MERCY',
  red:    'TITAN OF WRATH',
  green:  'PLAGUE TITAN',
};

interface TitanRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  soulType?: SoulType;
  isDying?: boolean;
  staggerBuildup?: number;
  bladestormActive?: boolean;
  bladestormStartTime?: number;
}

const ATTACK_DURATION        = 1500; // ms — matches backend meleeLockUntil
const POWERUP_DURATION       = 1500; // ms — bladestorm windup
const STOMP_DURATION         = 1000; // ms — stomp windup
const CANNON_CAST_DURATION   = 1500; // ms — matches backend TITAN_CANNON_TOTAL_LOCK_MS
const FADE_DURATION          = 2.5;
const LERP_SPEED             = 8;
const WALK_STOP_DELAY        = 300;

const HP_BAR_WIDTH = 4.2;
const HP_BAR_HEIGHT = 0.28;
const HP_BAR_FILL_HEIGHT = 0.26;

function TitanRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  soulType = 'green',
  isDying = false,
  staggerBuildup = 0,
  bladestormActive = false,
  bladestormStartTime,
}: TitanRendererProps) {
  const theme = campHpTheme(soulType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isPoweringUp, setIsPoweringUp] = useState(false);
  const [isStomping, setIsStomping] = useState(false);
  const [isCasting, setIsCasting] = useState(false);
  const [isWalking, setIsWalking] = useState(true);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isPoweringUpRef = useRef(false);
  const isStompingRef = useRef(false);
  const isCastingRef = useRef(false);
  const isWalkingRef = useRef(true);

  const lastMoveTimeRef = useRef(0);
  const pendingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const trackTimeout = useCallback((fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((t) => t !== id);
      fn();
    }, ms);
    pendingTimersRef.current.push(id);
    return id;
  }, []);
  const fadeTimer     = useRef(0);
  const opacity       = useRef(1);
  // Cached list of materials for death-fade — built once when isDying starts,
  // avoiding a group.traverse() call on every frame.
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const isAnimLocked = () =>
    isAttackingRef.current || isPoweringUpRef.current || isStompingRef.current || isCastingRef.current;

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    targetPosition.current.set(position.x, position.y, position.z);

    if (dist > 15.0 && groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  // Titan melee attack telegraph from server.
  useEffect(() => {
    if (!socket) return;

    const handleTitanTelegraph = (data: {
      titanId: string;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.titanId !== id) return;
      const visual = parseMeleeTelegraphPayload(data, TITAN_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      trackTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        if (!isAnimLocked()) {
          isWalkingRef.current = true;
          setIsWalking(true);
        }
      }, duration);
    };

    const handleTitanWhiff = (data: { titanId: string }) => {
      if (data.titanId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    const handleBladestormPowerup = (data: { titanId: string }) => {
      if (data.titanId !== id) return;
      setIsPoweringUp(true);
      isPoweringUpRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      trackTimeout(() => {
        setIsPoweringUp(false);
        isPoweringUpRef.current = false;
        if (!isAnimLocked()) {
          isWalkingRef.current = true;
          setIsWalking(true);
        }
      }, POWERUP_DURATION);
    };

    const handleStompStart = (data: { titanId: string }) => {
      if (data.titanId !== id) return;
      setIsStomping(true);
      isStompingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      trackTimeout(() => {
        setIsStomping(false);
        isStompingRef.current = false;
        if (!isAnimLocked()) {
          isWalkingRef.current = true;
          setIsWalking(true);
        }
      }, STOMP_DURATION);
    };

    const handleCannonWindup = (data: { titanId: string }) => {
      if (data.titanId !== id) return;
      setIsCasting(true);
      isCastingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      trackTimeout(() => {
        setIsCasting(false);
        isCastingRef.current = false;
        if (!isAnimLocked()) {
          isWalkingRef.current = true;
          setIsWalking(true);
        }
      }, CANNON_CAST_DURATION);
    };

    socket.on('titan-attack-telegraph', handleTitanTelegraph);
    socket.on('titan-attack-whiff', handleTitanWhiff);
    socket.on('titan-bladestorm-powerup-start', handleBladestormPowerup);
    socket.on('titan-stomp-start', handleStompStart);
    socket.on('titan-cannon-windup', handleCannonWindup);
    return () => {
      socket.off('titan-attack-telegraph', handleTitanTelegraph);
      socket.off('titan-attack-whiff', handleTitanWhiff);
      socket.off('titan-bladestorm-powerup-start', handleBladestormPowerup);
      socket.off('titan-stomp-start', handleStompStart);
      socket.off('titan-cannon-windup', handleCannonWindup);
      pendingTimersRef.current.forEach(clearTimeout);
      pendingTimersRef.current = [];
    };
  }, [id, socket, trackTimeout]);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(
      hpTextRef,
      enemiesRef,
      id,
      health,
      maxHealth,
      (hp, max) => `${Math.ceil(hp)} / ${max}`,
    );

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    updateEnemyWalkStateFromMoveDist(
      dist,
      isAnimLocked(),
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);

      // Build the material cache once on the first dying frame.
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
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <TitanModel
        isWalking={!isAttacking && !isPoweringUp && !isStomping && !isCasting && !isDying}
        isAttacking={isAttacking}
        isPoweringUp={isPoweringUp}
        isStomping={isStomping}
        isCasting={isCasting}
        isDying={isDying}
      />
      {!isDying && <TitanSoulEffect soulType={soulType} />}

      {bladestormActive && !isDying && !isPoweringUp && bladestormStartTime != null && (
        <TitanBladestorm soulType={soulType} startTime={bladestormStartTime} />
      )}

      {isAttacking && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? TITAN_MELEE_ATTACK_RANGE}
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

      <Billboard position={[0, 6.25, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[HP_BAR_WIDTH, HP_BAR_HEIGHT]} />
              <meshBasicMaterial color={theme.background} opacity={0.9} transparent />
            </mesh>

            <mesh
              ref={hpFillRef}
              position={[-HP_BAR_WIDTH / 2, 0, ENEMY_HP_BAR_FILL_Z]}
              scale={[1, 1, 1]}
            >
              <planeGeometry args={[HP_BAR_WIDTH, HP_BAR_FILL_HEIGHT]} />
              <meshBasicMaterial color={theme.fill} opacity={0.95} transparent />
            </mesh>

            <EnemyHealthBarTextLabel
              name={TITAN_DISPLAY_NAMES[soulType]}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.2}
              color={theme.text}
              numericFormat={(hp, max) => `${Math.ceil(hp)} / ${max}`}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} width={HP_BAR_WIDTH} y={-0.28} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(TitanRenderer);
