import React, { useRef, useEffect, useState, useCallback, useLayoutEffect } from 'react';
import { positionScratch, type Position3 } from '@/utils/position3';
import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import BossGlbModel from './BossGlbModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyMeleeAttackRangeRing, { BOSS_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { parseMeleeTelegraphPayload, meleeAttackDurationFromTelegraph, type MeleeTelegraphVisual } from '@/utils/meleeTelegraphVisual';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef, syncEnemyVisualRotation, updateEnemyWalkStateFromMoveDist } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import {
  ENEMY_HP_BAR_WIDTH,
  applyEnemyHealthBarFill,
  syncEnemyHealthBarFillFromRef,
  syncEnemyHealthBarNumericTextFromRef,
} from '@/utils/enemyHealthBar';
import { STAGGER_MAX_BOSS } from '@/utils/talents';
import EnemyHealthBarTextLabel from './EnemyHealthBarTextLabel';
import { getEnemyDisplayName } from '@/utils/enemyDisplayNames';
import EnemyHpBarPlanes from './EnemyHpBarPlanes';

const WALK_STOP_DELAY = 250;
const LERP_SPEED = 12;
/** Matches `BOSS_LEAP_DURATION_MS` in backend `enemyAI.js`. */
const DEFAULT_BOSS_LEAP_DURATION_MS = 1325;
/** Matches `BOSS_MELEE_ATTACK_LOCK_MS` in backend `enemyAI.js`. */
const ATTACK_DURATION = 1200;
/** Fallback if `boss-throw-start` omits `moveLockMs` — keep in sync with `BOSS_THROW_MOVE_LOCK_MS` in backend `enemyAI.js`. */
const DEFAULT_BOSS_THROW_MOVE_LOCK_MS = 2000;

interface BossRendererProps {
  id: string;
  entityId: number;
  position: Position3;
  world: World;
  health: number;
  maxHealth: number;
  onMeshReady?: (mesh: Group) => void;
  rotation?: number;
  isStunned?: boolean;
  isDying?: boolean;
  staggerBuildup?: number;
}

function BossRenderer({
  id,
  entityId,
  position,
  world,
  health,
  maxHealth,
  onMeshReady,
  rotation,
  isStunned = false,
  isDying = false,
  staggerBuildup = 0,
}: BossRendererProps) {
  const theme = campHpTheme('red');
  const { socket, enemyTransformsRef, enemyVisualRotationsRef, enemiesRef } = useMultiplayerActions();
  const groupRef = useRef<Group>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);
  const currentRotationRef = useRef(0);
  const [isWalking, setIsWalking] = useState(false);
  const isWalkingRef = useRef(false);
  const [isLeaping, setIsLeaping] = useState(false);
  const [tectonicJumpTrigger, setTectonicJumpTrigger] = useState(0);
  const [attackTrigger, setAttackTrigger] = useState(0);
  const [meleeIndex, setMeleeIndex] = useState<0 | 1>(0);
  const [throwTrigger, setThrowTrigger] = useState(0);
  const [isImpacting, setIsImpacting] = useState(false);
  const [impactPlayKey, setImpactPlayKey] = useState(0);
  const [isThrowCasting, setIsThrowCasting] = useState(false);
  const [isAttacking, setIsAttacking] = useState(false);
  const [meleeTelegraph, setMeleeTelegraph] = useState<MeleeTelegraphVisual | null>(null);
  const targetPosition = useRef(new Vector3(position.x, position.y, position.z));
  const targetRotation = useRef(rotation ?? 0);
  const lastMoveTimeRef = useRef(0);
  const throwCastSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLeapingRef = useRef(false);
  const isThrowCastingRef = useRef(false);
  const isAttackingRef = useRef(false);
  const attackEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leapTravelRef = useRef<{
    start: Vector3;
    end: Vector3;
    startedAt: number;
    duration: number;
  } | null>(null);
  const leapStartScratch = useRef(new Vector3());
  const leapEndScratch = useRef(new Vector3());

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(positionScratch.set(position.x, position.y, position.z));
    const isLocked = isLeapingRef.current || isThrowCastingRef.current || isAttackingRef.current;
    if (!isLocked) {
      targetPosition.current.set(position.x, position.y, position.z);
    }
    if (dist > 5.0 && groupRef.current && !isLocked) {
      groupRef.current.position.set(position.x, position.y, position.z);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    targetRotation.current = rotation ?? 0;
  }, [rotation]);

  useEffect(
    () => () => {
      if (throwCastSafetyTimer.current) clearTimeout(throwCastSafetyTimer.current);
      if (attackEndTimer.current) clearTimeout(attackEndTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!socket) return;

    const onAttackTelegraph = (data: {
      bossId: string;
      meleeIndex?: number;
      hitDelayMs?: number;
      swingLockMs?: number;
      attackRange?: number;
      arcDeg?: number;
      facing?: number;
      weightClass?: string;
      timestamp?: number;
    }) => {
      if (data.bossId !== id) return;
      const m = (data.meleeIndex ?? 0) % 2;
      setMeleeIndex(m as 0 | 1);
      setAttackTrigger((k) => k + 1);
      const visual = parseMeleeTelegraphPayload(data, BOSS_MELEE_ATTACK_RANGE, ATTACK_DURATION);
      setMeleeTelegraph(visual);
      setIsAttacking(true);
      isAttackingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      if (attackEndTimer.current) clearTimeout(attackEndTimer.current);
      const duration = meleeAttackDurationFromTelegraph(visual, ATTACK_DURATION);
      attackEndTimer.current = setTimeout(() => {
        setIsAttacking(false);
        setMeleeTelegraph(null);
        isAttackingRef.current = false;
        attackEndTimer.current = null;
      }, duration);
    };

    const onAttackWhiff = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
      setMeleeTelegraph((prev) => (prev ? { ...prev, whiffed: true } : prev));
    };
    const onThrowStart = (data: { bossId: string; moveLockMs?: number }) => {
      if (data.bossId !== id) return;
      setThrowTrigger((k) => k + 1);
      setIsThrowCasting(true);
      isThrowCastingRef.current = true;
      if (throwCastSafetyTimer.current) clearTimeout(throwCastSafetyTimer.current);
      const lockMs =
        typeof data.moveLockMs === 'number' && data.moveLockMs > 0
          ? data.moveLockMs
          : DEFAULT_BOSS_THROW_MOVE_LOCK_MS;
      throwCastSafetyTimer.current = setTimeout(() => {
        setIsThrowCasting(false);
        isThrowCastingRef.current = false;
        throwCastSafetyTimer.current = null;
      }, lockMs + 150);
    };
    const onLeapStart = (data: {
      bossId: string;
      startPosition?: { x: number; y: number; z: number };
      landPosition?: { x: number; y: number; z: number };
      durationMs?: number;
    }) => {
      if (data.bossId !== id) return;

      const startPos = leapStartScratch.current;
      const endPos = leapEndScratch.current;
      if (data.startPosition) {
        startPos.set(data.startPosition.x, data.startPosition.y, data.startPosition.z);
      } else {
        startPos.copy(targetPosition.current);
      }
      if (data.landPosition) {
        endPos.set(data.landPosition.x, data.landPosition.y, data.landPosition.z);
      } else {
        endPos.copy(targetPosition.current);
      }

      const duration = data.durationMs ?? DEFAULT_BOSS_LEAP_DURATION_MS;
      leapTravelRef.current = {
        start: startPos.clone(),
        end: endPos.clone(),
        startedAt: performance.now(),
        duration,
      };
      targetPosition.current.copy(endPos);
      targetRotation.current = Math.atan2(endPos.x - startPos.x, endPos.z - startPos.z);

      if (groupRef.current) {
        groupRef.current.position.copy(startPos);
        groupRef.current.rotation.y = targetRotation.current;
      }

      setIsLeaping(true);
      isLeapingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
    };
    const onLeapLand = (data: { bossId: string; landPosition?: { x: number; y: number; z: number } }) => {
      if (data.bossId !== id) return;
      leapTravelRef.current = null;
      if (data.landPosition) {
        targetPosition.current.set(data.landPosition.x, data.landPosition.y, data.landPosition.z);
        if (groupRef.current) {
          groupRef.current.position.set(data.landPosition.x, data.landPosition.y, data.landPosition.z);
        }
      }
      setIsLeaping(false);
      isLeapingRef.current = false;
    };
    const onTectonic = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
      setTectonicJumpTrigger((k) => k + 1);
    };
    const onHitReact = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
      setIsImpacting(true);
      setImpactPlayKey((k) => k + 1);
    };

    socket.on('boss-attack-telegraph', onAttackTelegraph);
    socket.on('boss-attack-whiff', onAttackWhiff);
    socket.on('boss-throw-start', onThrowStart);
    socket.on('boss-leap-start', onLeapStart);
    socket.on('boss-leap-land', onLeapLand);
    socket.on('boss-tectonic-jump', onTectonic);
    socket.on('boss-hit-react', onHitReact);

    return () => {
      if (throwCastSafetyTimer.current) {
        clearTimeout(throwCastSafetyTimer.current);
        throwCastSafetyTimer.current = null;
      }
      if (attackEndTimer.current) {
        clearTimeout(attackEndTimer.current);
        attackEndTimer.current = null;
      }
      socket.off('boss-attack-telegraph', onAttackTelegraph);
      socket.off('boss-attack-whiff', onAttackWhiff);
      socket.off('boss-throw-start', onThrowStart);
      socket.off('boss-leap-start', onLeapStart);
      socket.off('boss-leap-land', onLeapLand);
      socket.off('boss-tectonic-jump', onTectonic);
      socket.off('boss-hit-react', onHitReact);
    };
  }, [socket, id]);

  const handleImpactFinished = useCallback(() => {
    setIsImpacting(false);
  }, []);

  const handleThrowAnimFinished = useCallback(() => {
    setIsThrowCasting(false);
    isThrowCastingRef.current = false;
    if (throwCastSafetyTimer.current) {
      clearTimeout(throwCastSafetyTimer.current);
      throwCastSafetyTimer.current = null;
    }
  }, []);

  useLayoutEffect(() => {
    applyEnemyHealthBarFill(hpFillRef.current, health, maxHealth, ENEMY_HP_BAR_WIDTH);
  }, [health, maxHealth]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyHealthBarFillFromRef(hpFillRef, enemiesRef, id, health, maxHealth, ENEMY_HP_BAR_WIDTH);
    syncEnemyHealthBarNumericTextFromRef(hpTextRef, enemiesRef, id, health, maxHealth);

    const leapTravel = leapTravelRef.current;
    const isLocked = isAttackingRef.current || isThrowCastingRef.current || isLeapingRef.current;

    let dist = 0;
    if (!leapTravel) {
      dist = syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    }

    if (leapTravel) {
      const t = Math.min(1, (performance.now() - leapTravel.startedAt) / leapTravel.duration);
      const su = t * t * (3 - 2 * t);
      group.position.lerpVectors(leapTravel.start, leapTravel.end, su);
    } else {
      if (dist > 5.0 && !isLocked) {
        group.position.copy(targetPosition.current);
      }

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
    }

    if (isStunned) return;

    let deltaAngle = targetRotation.current - group.rotation.y;
    while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
    while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
    group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
    currentRotationRef.current = group.rotation.y;
    syncEnemyVisualRotation(id, enemyVisualRotationsRef, group.rotation.y);

    const entity = world.getEntity(entityId);
    if (entity) {
      if (!entity.userData) entity.userData = {};
      entity.userData.visualRotation = group.rotation.y;
    }
  });

  useEffect(() => {
    if (groupRef.current && onMeshReady) {
      onMeshReady(groupRef.current);
    }
  }, [onMeshReady]);

  return (
    <group ref={groupRef}>
      <BossGlbModel
        isWalking={isWalking && !isLeaping && !isThrowCasting && !isAttacking}
        isDying={isDying}
        isLeaping={isLeaping}
        tectonicJumpTrigger={tectonicJumpTrigger}
        attackTrigger={attackTrigger}
        meleeIndex={meleeIndex}
        throwTrigger={throwTrigger}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
        onLeapFinished={() => {
          leapTravelRef.current = null;
          setIsLeaping(false);
          isLeapingRef.current = false;
        }}
        onTectonicJumpFinished={() => {}}
        onAttackFinished={() => {}}
        onThrowAnimFinished={handleThrowAnimFinished}
      />

      {isAttacking && (
        <EnemyMeleeAttackRangeRing
          radius={meleeTelegraph?.attackRange ?? BOSS_MELEE_ATTACK_RANGE}
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

      <Billboard position={[0, 6.1, 0]} follow lockX={false} lockY={false} lockZ={false}>
        {health > 0 && !isDying && (
          <>
            <EnemyHpBarPlanes
              fillRef={hpFillRef}
              backgroundColor={theme.background}
              fillColor={theme.fill}
            />
            <EnemyHealthBarTextLabel
              name={getEnemyDisplayName('boss')}
              numericRef={hpTextRef}
              health={health}
              maxHealth={maxHealth}
              fontSize={0.18}
              color={theme.text}
            />
            <EnemyStaggerBar enemyId={id} stagger={staggerBuildup} staggerMax={STAGGER_MAX_BOSS} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(BossRenderer);
