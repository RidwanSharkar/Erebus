import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Billboard, Text } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import BossGlbModel from './BossGlbModel';
import EnemyStaggerBar from './EnemyStaggerBar';
import EnemyMeleeAttackRangeRing, { BOSS_MELEE_ATTACK_RANGE } from './EnemyMeleeAttackRangeRing';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { syncEnemyTransformFromRef } from '@/utils/enemyLiveTransform';
import { campHpTheme } from '@/utils/campHpTheme';
import { STAGGER_MAX_BOSS } from '@/utils/talents';

const WALK_STOP_DELAY = 250;
/** Matches `BOSS_MELEE_ATTACK_LOCK_MS` in backend `enemyAI.js`. */
const ATTACK_DURATION = 1200;
/** Fallback if `boss-throw-start` omits `moveLockMs` — keep in sync with `BOSS_THROW_MOVE_LOCK_MS` in backend `enemyAI.js`. */
const DEFAULT_BOSS_THROW_MOVE_LOCK_MS = 2000;

interface BossRendererProps {
  id: string;
  entityId: number;
  position: Vector3;
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
  const { socket, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group>(null);
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
  const targetPosition = useRef(position.clone());
  const targetRotation = useRef(rotation ?? 0);
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throwCastSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLeapingRef = useRef(false);
  const isThrowCastingRef = useRef(false);
  const isAttackingRef = useRef(false);
  const attackEndTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    const isLocked = isLeapingRef.current || isThrowCastingRef.current || isAttackingRef.current;
    if (!isLocked) {
      targetPosition.current.copy(position);
    }
    if (dist > 0.01 && !isLocked && !isDying) {
      if (!isWalkingRef.current) {
        isWalkingRef.current = true;
        setIsWalking(true);
      }
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => {
        isWalkingRef.current = false;
        setIsWalking(false);
      }, WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z, isDying]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (throwCastSafetyTimer.current) clearTimeout(throwCastSafetyTimer.current);
      if (attackEndTimer.current) clearTimeout(attackEndTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!socket) return;

    const onAttackTelegraph = (data: { bossId: string; meleeIndex?: number }) => {
      if (data.bossId !== id) return;
      const m = (data.meleeIndex ?? 0) % 2;
      setMeleeIndex(m as 0 | 1);
      setAttackTrigger((k) => k + 1);
      setIsAttacking(true);
      isAttackingRef.current = true;
      isWalkingRef.current = false;
      setIsWalking(false);
      if (attackEndTimer.current) clearTimeout(attackEndTimer.current);
      attackEndTimer.current = setTimeout(() => {
        setIsAttacking(false);
        isAttackingRef.current = false;
        attackEndTimer.current = null;
      }, ATTACK_DURATION);
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
    const onLeapStart = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
      setIsLeaping(true);
      isLeapingRef.current = true;
    };
    const onLeapLand = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
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

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    syncEnemyTransformFromRef(id, enemyTransformsRef, targetPosition.current, targetRotation);
    group.position.copy(targetPosition.current);

    if (isStunned) return;

    const ROTATION_SPEED = 6.0;
    const currentRotationY = group.rotation.y;
    let rotationDiff = targetRotation.current - currentRotationY;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    group.rotation.y += rotationDiff * Math.min(1, ROTATION_SPEED * delta);
    currentRotationRef.current = group.rotation.y;

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
          setIsLeaping(false);
          isLeapingRef.current = false;
        }}
        onTectonicJumpFinished={() => {}}
        onAttackFinished={() => {}}
        onThrowAnimFinished={handleThrowAnimFinished}
      />

      {isAttacking && (
        <EnemyMeleeAttackRangeRing radius={BOSS_MELEE_ATTACK_RANGE} />
      )}

      <Billboard position={[0, 6.1, 0]} follow lockX={false} lockY={false} lockZ={false}>
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
              {`HATE ${Math.ceil(health)}/${maxHealth}`}
            </Text>
            <EnemyStaggerBar stagger={staggerBuildup} staggerMax={STAGGER_MAX_BOSS} />
          </>
        )}
      </Billboard>
    </group>
  );
}

export default React.memo(BossRenderer);
