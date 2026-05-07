import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from '@/utils/three-exports';
import { World } from '@/ecs/World';
import BossGlbModel from './BossGlbModel';
import { useMultiplayer } from '@/contexts/MultiplayerContext';

const WALK_STOP_DELAY = 200;
/** Fallback if `boss-throw-start` omits `moveLockMs` — keep in sync with `BOSS_THROW_MOVE_LOCK_MS` in backend `enemyAI.js`. */
const DEFAULT_BOSS_THROW_MOVE_LOCK_MS = 2000;

interface BossRendererProps {
  id: string;
  entityId: number;
  position: Vector3;
  world: World;
  onMeshReady?: (mesh: Group) => void;
  rotation?: number;
  isStunned?: boolean;
  isDying?: boolean;
}

export default function BossRenderer({
  id,
  entityId,
  position,
  world,
  onMeshReady,
  rotation,
  isStunned = false,
  isDying = false,
}: BossRendererProps) {
  const { socket } = useMultiplayer();
  const groupRef = useRef<Group>(null);
  const currentRotationRef = useRef(0);
  const [isWalking, setIsWalking] = useState(false);
  const [isLeaping, setIsLeaping] = useState(false);
  const [tectonicJumpTrigger, setTectonicJumpTrigger] = useState(0);
  const [attackTrigger, setAttackTrigger] = useState(0);
  const [meleeIndex, setMeleeIndex] = useState<0 | 1>(0);
  const [throwTrigger, setThrowTrigger] = useState(0);
  const [isImpacting, setIsImpacting] = useState(false);
  const [impactPlayKey, setImpactPlayKey] = useState(0);
  const [isThrowCasting, setIsThrowCasting] = useState(false);
  const targetPosition = useRef(position.clone());
  const walkStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throwCastSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const updateVisualRotation = () => {
      const entity = world.getEntity(entityId);
      if (entity && groupRef.current) {
        if (!entity.userData) entity.userData = {};
        entity.userData.visualRotation = groupRef.current.rotation.y;
      }
    };
    const intervalId = setInterval(updateVisualRotation, 16);
    return () => clearInterval(intervalId);
  }, [world, entityId]);

  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);
    if (dist > 0.02 && !isDying && !isThrowCasting) {
      setIsWalking(true);
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      walkStopTimer.current = setTimeout(() => setIsWalking(false), WALK_STOP_DELAY);
    }
  }, [position.x, position.y, position.z, isDying, isThrowCasting]);

  useEffect(
    () => () => {
      if (walkStopTimer.current) clearTimeout(walkStopTimer.current);
      if (throwCastSafetyTimer.current) clearTimeout(throwCastSafetyTimer.current);
    },
    []
  );

  useEffect(() => {
    if (!socket) return;

    const onAttack = (data: { bossId: string; meleeIndex?: number }) => {
      if (data.bossId !== id) return;
      const m = (data.meleeIndex ?? 0) % 2;
      setMeleeIndex(m as 0 | 1);
      setAttackTrigger((k) => k + 1);
    };
    const onThrowStart = (data: { bossId: string; moveLockMs?: number }) => {
      if (data.bossId !== id) return;
      setThrowTrigger((k) => k + 1);
      setIsThrowCasting(true);
      if (throwCastSafetyTimer.current) clearTimeout(throwCastSafetyTimer.current);
      const lockMs =
        typeof data.moveLockMs === 'number' && data.moveLockMs > 0
          ? data.moveLockMs
          : DEFAULT_BOSS_THROW_MOVE_LOCK_MS;
      throwCastSafetyTimer.current = setTimeout(() => {
        setIsThrowCasting(false);
        throwCastSafetyTimer.current = null;
      }, lockMs + 150);
    };
    const onLeapStart = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
      setIsLeaping(true);
    };
    const onLeapLand = (data: { bossId: string }) => {
      if (data.bossId !== id) return;
      setIsLeaping(false);
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

    socket.on('boss-attack', onAttack);
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
      socket.off('boss-attack', onAttack);
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
    if (throwCastSafetyTimer.current) {
      clearTimeout(throwCastSafetyTimer.current);
      throwCastSafetyTimer.current = null;
    }
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.position.copy(position);
      if (isStunned) return;

      if (rotation !== undefined) {
        const ROTATION_SPEED = 6.0;
        const currentRotationY = groupRef.current.rotation.y;
        let rotationDiff = rotation - currentRotationY;
        while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
        while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
        groupRef.current.rotation.y += rotationDiff * Math.min(1, ROTATION_SPEED * delta);
        currentRotationRef.current = groupRef.current.rotation.y;
      }
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
        isWalking={isWalking && !isLeaping && !isThrowCasting}
        isDying={isDying}
        isLeaping={isLeaping}
        tectonicJumpTrigger={tectonicJumpTrigger}
        attackTrigger={attackTrigger}
        meleeIndex={meleeIndex}
        throwTrigger={throwTrigger}
        isImpacting={isImpacting}
        impactPlayKey={impactPlayKey}
        onImpactFinished={handleImpactFinished}
        onLeapFinished={() => setIsLeaping(false)}
        onTectonicJumpFinished={() => {}}
        onAttackFinished={() => {}}
        onThrowAnimFinished={handleThrowAnimFinished}
      />
    </group>
  );
}
