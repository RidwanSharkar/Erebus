'use client';
import { positionScratch, type Position3 } from '@/utils/position3';

import React, { useRef, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import { Group, Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { Billboard } from '@react-three/drei';
import TigerModel from './TigerModel';
import KnightSoulEffect from './KnightSoulEffect';
import EnemyMeleeAttackRangeRing, { TIGER_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import EnemyStaggerBar from './EnemyStaggerBar';
import { applyEnemyHealthBarFill, syncEnemyHealthBarFillFromRef, syncEnemyHealthBarNumericTextFromRef } from '@/utils/enemyHealthBar';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getUnitNameplateName } from '@/utils/enemyDisplayNames';
import { campHpTheme } from '@/utils/campHpTheme';

const TIGER_HP_BAR_WIDTH = 1.8;
const TIGER_HP_BAR_HEIGHT = 0.22;
const TIGER_HP_BAR_FILL_HEIGHT = 0.20;

interface TigerRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  staggerBuildup?: number;
  campType?: string;
  soulType?: 'yellow' | 'green' | 'red' | 'blue' | 'purple' | 'orange';
  /** Server locomotion mode — run while chasing within aggro. */
  tigerLocomotion?: 'walk' | 'run';
  /** Ally (beastmaster) vs hostile enemy tiger. */
  variant?: 'ally' | 'enemy';
  visualScale?: number;
}

const ALLY_ATTACK_DURATION = 1000;
const ENEMY_ATTACK_DURATION = 850;
const FADE_DURATION = 1.5;
const LERP_SPEED = 14;
const WALK_STOP_DELAY = 250;

function TigerRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  staggerBuildup = 0,
  campType,
  soulType,
  tigerLocomotion = 'walk',
  variant = 'ally',
  visualScale = 1,
}: TigerRendererProps) {
  const isEnemy = variant === 'enemy';
  const attackDuration = isEnemy ? ENEMY_ATTACK_DURATION : ALLY_ATTACK_DURATION;
  const telegraphEvent = isEnemy ? 'tiger-attack-telegraph' : 'allied-tiger-attack-telegraph';
  const hpTheme = campHpTheme(campType);
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);

  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const [isWalking, setIsWalking] = useState(false);
  const [isRunning, setIsRunning] = useState(tigerLocomotion === 'run');
  const [isPouncing, setIsPouncing] = useState(false);
  const [attackVariant, setAttackVariant] = useState<1 | 2>(1);
  const [pounceDurationMs, setPounceDurationMs] = useState(850);

  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation);
  const isAttackingRef = useRef(false);
  const isWalkingRef = useRef(false);
  const isPouncingRef = useRef(false);
  const lastMoveTimeRef = useRef(0);
  const attackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeTimer = useRef(0);
  const opacity = useRef(1);
  const cachedDeathMats = useRef<any[]>([]);
  const deathCacheBuilt = useRef(false);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
      group.rotation.y = targetRotation.current;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, TIGER_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    targetPosition.current.set(position.x, position.y, position.z);

    if (dist > 8.0 && groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, []);

  useEffect(() => {
    targetRotation.current = rotation;
  }, [rotation]);

  useEffect(() => {
    setIsRunning(tigerLocomotion === 'run');
  }, [tigerLocomotion]);

  useEffect(() => {
    if (!socket) return;

    const handleTigerTelegraph = (data: {
      tigerId: string;
      attackVariant?: 1 | 2;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.tigerId !== id) return;
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
      if (data.attackVariant === 1 || data.attackVariant === 2) {
        setAttackVariant(data.attackVariant);
      } else {
        setAttackVariant((prev) => (prev === 1 ? 2 : 1));
      }
      const visual = parseMeleeTelegraphPayload(data, TIGER_MELEE_ATTACK_RANGE, attackDuration);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      const duration = meleeAttackDurationFromTelegraph(visual, attackDuration);
      attackTimerRef.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        attackTimerRef.current = null;
      }, duration);
    };

    const handleTigerWhiff = (data: { tigerId: string }) => {
      if (data.tigerId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };

    socket.on(telegraphEvent, handleTigerTelegraph);
    if (isEnemy) {
      socket.on('tiger-attack-whiff', handleTigerWhiff);
    }

    const onPounceStart = (data: { tigerId: string; durationMs?: number }) => {
      if (!isEnemy || data.tigerId !== id) return;
      if (typeof data.durationMs === 'number' && data.durationMs > 0) {
        setPounceDurationMs(data.durationMs);
      }
      setIsPouncing(true);
      isPouncingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      setIsAttacking(false);
      setMeleeTelegraph(null);
      isAttackingRef.current = false;
    };
    const onPounceLand = (data: { tigerId: string }) => {
      if (!isEnemy || data.tigerId !== id) return;
      setIsPouncing(false);
      isPouncingRef.current = false;
    };

    if (isEnemy) {
      socket.on('tiger-pounce-start', onPounceStart);
      socket.on('tiger-pounce-land', onPounceLand);
    }

    return () => {
      socket.off(telegraphEvent, handleTigerTelegraph);
      if (isEnemy) {
        socket.off('tiger-attack-whiff', handleTigerWhiff);
        socket.off('tiger-pounce-start', onPounceStart);
        socket.off('tiger-pounce-land', onPounceLand);
      }
      if (attackTimerRef.current) clearTimeout(attackTimerRef.current);
    };
  }, [id, socket, isEnemy, telegraphEvent, attackDuration]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    const live = enemiesRef.current.get(id) as { tigerLocomotion?: 'walk' | 'run' } | undefined;
    if (live?.tigerLocomotion === 'run' || live?.tigerLocomotion === 'walk') {
      const nextRunning = live.tigerLocomotion === 'run';
      if (nextRunning !== isRunning) setIsRunning(nextRunning);
    }

    const dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    const isLocked = isAttackingRef.current || isPouncingRef.current;
    updateEnemyWalkStateFromMoveDist(
      dist,
      isLocked,
      isDying,
      WALK_STOP_DELAY,
      lastMoveTimeRef,
      isWalkingRef,
      setIsWalking,
    );

    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, TIGER_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

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
    <group ref={setGroupRef} visible={!isDying || opacity.current > 0}>
      <TigerModel
        isWalking={isWalking && !isPouncing}
        isRunning={isRunning}
        isAttacking={isAttacking && !isPouncing}
        attackVariant={attackVariant}
        isDying={isDying}
        isPouncing={isPouncing}
        pounceDurationMs={pounceDurationMs}
        scaleMultiplier={visualScale}
      />

      {isEnemy && isAttacking && !isDying && !isPouncing && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? TIGER_MELEE_ATTACK_RANGE}
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

      {!isDying && soulType && <KnightSoulEffect soulType={soulType} compact />}

      <Billboard position={[0, 2.4 * visualScale, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[TIGER_HP_BAR_WIDTH, TIGER_HP_BAR_HEIGHT]} />
              <meshBasicMaterial color={campType ? hpTheme.background : '#1a0a0a'} opacity={0.9} transparent />
            </mesh>

            <mesh
              ref={hpFillRef}
              position={[-TIGER_HP_BAR_WIDTH / 2, 0, 0.001]}
              scale={[1, 1, 1]}
            >
              <planeGeometry args={[TIGER_HP_BAR_WIDTH, TIGER_HP_BAR_FILL_HEIGHT]} />
              <meshBasicMaterial color={campType ? hpTheme.fill : '#aa7700'} opacity={0.95} transparent />
            </mesh>

            <EnemyHealthBarTextLabel
              name={getUnitNameplateName('tiger', campType)}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.16}
              color={campType ? hpTheme.text : '#ffccaa'}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(TigerRenderer);
