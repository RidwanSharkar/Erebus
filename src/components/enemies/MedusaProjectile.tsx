'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail from '@/components/projectiles/EntropicBoltTrail';
import {
  MEDUSA_HOMING_DELAY_SEC,
  MEDUSA_START_SPEED,
  MEDUSA_MAX_SPEED,
  MEDUSA_ACCEL_SEC,
  MEDUSA_TURN_RATE,
  MEDUSA_HIT_RADIUS,
  MEDUSA_CAST_RANGE,
} from '@/utils/medusaCoopAbilitiesConstants';

const _boltLightPos = new Vector3();
const _aim = new Vector3();
const _toTarget = new Vector3();

const trailColor = new Color('#7c3aed');
const trailAccent = new Color('#c4b5fd');

export interface MedusaProjectileProps {
  startPosition: Vector3;
  targetPosition: Vector3;
  damage: number;
  getPlayerPosition: () => Vector3 | null;
  onHitPlayer: () => void;
  onComplete: () => void;
}

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Medusa void bolt — brief coast, then slow accelerating homing (server-authoritative damage). */
export default function MedusaProjectile({
  startPosition,
  targetPosition,
  damage: _damage,
  getPlayerPosition,
  onHitPlayer: _onHitPlayer,
  onComplete,
}: MedusaProjectileProps) {
  const groupRef = useRef<Group>(null);
  const visualScaleRef = useRef<Group>(null);
  const wingRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const phaseRef = useRef<'coast' | 'homing'>('coast');
  const homingElapsedRef = useRef(0);

  const currentDirRef = useRef(new Vector3(0, 0, 1));
  const currentSpeedRef = useRef(MEDUSA_START_SPEED);
  const startPositionRef = useRef(new Vector3());
  startPositionRef.current.copy(startPosition);

  const staleDist = useMemo(() => {
    const d = targetPosition.clone().sub(startPosition);
    const len = d.length();
    if (len < 1e-4) {
      currentDirRef.current.set(0, 0, 1);
      return 1;
    }
    currentDirRef.current.copy(d).multiplyScalar(1 / len);
    return len;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const maxLifetimeRef = useRef(Math.max(4, (MEDUSA_CAST_RANGE / ((MEDUSA_START_SPEED + MEDUSA_MAX_SPEED) * 0.5)) * 2.5));

  const orbLight = useDynamicLight({ color: '#a78bfa', distance: 6, priority: 1 });

  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#ddd6fe'),
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const wingMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#7c3aed'),
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      coreMat.dispose();
      wingMat.dispose();
    },
    [coreMat, wingMat],
  );

  useEffect(() => {
    if (!groupRef.current) return;
    groupRef.current.position.copy(startPosition);
    const dir = currentDirRef.current;
    groupRef.current.rotation.y = Math.atan2(dir.x, dir.z);
    orbLight.current?.setPosition(startPosition.x, startPosition.y + 0.1, startPosition.z);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g || doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    if (phaseRef.current === 'coast' && t >= MEDUSA_HOMING_DELAY_SEC) {
      phaseRef.current = 'homing';
      homingElapsedRef.current = 0;
    }

    if (phaseRef.current === 'homing') {
      homingElapsedRef.current += delta;
      const liveTarget = getPlayerPosition();
      if (!liveTarget) {
        doneRef.current = true;
        onComplete();
        return;
      }

      _aim.copy(liveTarget).sub(g.position);
      _aim.y *= 0.35;
      if (_aim.lengthSq() > 1e-6) {
        _aim.normalize();
        _toTarget.copy(_aim);
        const dot = Math.max(-1, Math.min(1, currentDirRef.current.dot(_toTarget)));
        const maxTurn = MEDUSA_TURN_RATE * delta;
        const angle = Math.acos(dot);
        if (angle > 1e-5) {
          const turn = Math.min(maxTurn, angle);
          currentDirRef.current.lerp(_toTarget, turn / Math.max(angle, 1e-5)).normalize();
        } else {
          currentDirRef.current.copy(_toTarget);
        }
      }

      const accelProgress = smoothstep01(homingElapsedRef.current / MEDUSA_ACCEL_SEC);
      currentSpeedRef.current =
        MEDUSA_START_SPEED + (MEDUSA_MAX_SPEED - MEDUSA_START_SPEED) * accelProgress;
    }

    const step = currentSpeedRef.current * delta;
    g.position.addScaledVector(currentDirRef.current, step);
    g.rotation.y = Math.atan2(currentDirRef.current.x, currentDirRef.current.z);

    if (wingRef.current) {
      wingRef.current.rotation.y += delta * 10;
      wingRef.current.rotation.z = Math.sin(t * 14) * 0.3;
    }

    if (visualScaleRef.current) {
      const pulse = phaseRef.current === 'homing' ? 1 + Math.sin(t * 10) * 0.07 : 1;
      visualScaleRef.current.scale.setScalar(pulse);
    }

    _boltLightPos.copy(g.position).add(new Vector3(0, 0.1, 0));
    orbLight.current?.setPosition(_boltLightPos.x, _boltLightPos.y, _boltLightPos.z);

    const rangeFromSpawn = Math.hypot(
      g.position.x - startPositionRef.current.x,
      g.position.z - startPositionRef.current.z,
    );
    if (rangeFromSpawn > MEDUSA_CAST_RANGE * 1.35) {
      doneRef.current = true;
      onComplete();
      return;
    }

    // Client hit is visual-only; server applies damage via player-damaged
    if (phaseRef.current === 'homing') {
      const liveHitTarget = getPlayerPosition();
      if (liveHitTarget && g.position.distanceTo(liveHitTarget) <= MEDUSA_HIT_RADIUS) {
        doneRef.current = true;
        onComplete();
        return;
      }
    }

    if (t > maxLifetimeRef.current || t > staleDist * 2) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailAccent}
        size={0.04}
        meshRef={groupRef}
        opacity={0.9}
        flightDirectionRef={currentDirRef}
      />
      <group
        ref={groupRef}
        position={[startPosition.x, startPosition.y, startPosition.z]}
      >
        <group ref={visualScaleRef}>
          <group ref={wingRef}>
            <mesh material={wingMat} rotation={[0, 0, 0.55]} position={[0.14, 0, 0]}>
              <boxGeometry args={[0.28, 0.045, 0.12]} />
            </mesh>
            <mesh material={wingMat} rotation={[0, 0, -0.55]} position={[-0.14, 0, 0]}>
              <boxGeometry args={[0.28, 0.045, 0.12]} />
            </mesh>
          </group>
          <mesh material={coreMat}>
            <sphereGeometry args={[0.18, 10, 10]} />
          </mesh>
        </group>
      </group>
    </>
  );
}
