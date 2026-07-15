'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail from '@/components/projectiles/EntropicBoltTrail';
import { LOCUST_HOMING_DELAY_SEC } from '@/utils/talents';

const _boltLightPos = new Vector3();
const _resolved = new Vector3();
const _aim = new Vector3();
const _toTarget = new Vector3();

const trailColor = new Color('#a855f7');
const trailAccent = new Color('#d8b4fe');

export interface LocustProjectileProps {
  startPosition: Vector3;
  initialDirection: Vector3;
  spreadIndex: number;
  targetPosition: Vector3;
  getTargetPosition: () => Vector3 | null;
  homingDelaySec?: number;
  damage: number;
  onHitEnemy: () => void;
  onComplete: () => void;
}

const START_SPEED = 5;
const MAX_SPEED = 40;
const TURN_RATE = 10;
const HIT_RADIUS = 1.00;
const SPREAD_ANGLES_RAD = [-0.32, 0, 0.32];

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Acolyte Locust — spread launch, brief coast, then homing acceleration toward a locked enemy. */
export default function LocustProjectile({
  startPosition,
  initialDirection,
  spreadIndex,
  targetPosition,
  getTargetPosition,
  homingDelaySec = LOCUST_HOMING_DELAY_SEC,
  onHitEnemy,
  onComplete,
}: LocustProjectileProps) {
  const groupRef = useRef<Group>(null);
  const visualScaleRef = useRef<Group>(null);
  const wingRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const phaseRef = useRef<'spread' | 'homing'>('spread');
  const homingElapsedRef = useRef(0);

  const spreadAngle = SPREAD_ANGLES_RAD[spreadIndex] ?? 0;
  const launchDirRef = useRef(new Vector3());
  launchDirRef.current.copy(initialDirection);
  launchDirRef.current.applyAxisAngle(new Vector3(0, 1, 0), spreadAngle);
  launchDirRef.current.normalize();

  const currentDirRef = useRef(launchDirRef.current.clone());
  const currentSpeedRef = useRef(START_SPEED);

  const orbLight = useDynamicLight({ color: '#c084fc', distance: 6, priority: 1 });

  const maxLifetimeRef = useRef(6);

  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color('#d8b4fe'),
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
        color: new Color('#a855f7'),
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

    if (phaseRef.current === 'spread' && t >= homingDelaySec) {
      phaseRef.current = 'homing';
      homingElapsedRef.current = 0;
    }

    if (phaseRef.current === 'homing') {
      homingElapsedRef.current += delta;
      const liveTarget = getTargetPosition();
      if (!liveTarget) {
        doneRef.current = true;
        onComplete();
        return;
      }

      _aim.copy(liveTarget).sub(g.position);
      _aim.y *= 0.35;
      if (_aim.lengthSq() > 1e-6) {
        _aim.normalize();
        const maxTurn = TURN_RATE * delta;
        _toTarget.copy(_aim);
        const dot = Math.max(-1, Math.min(1, currentDirRef.current.dot(_toTarget)));
        const angle = Math.acos(dot);
        if (angle > 1e-5) {
          const turn = Math.min(maxTurn, angle);
          currentDirRef.current.lerp(_toTarget, turn / Math.max(angle, 1e-5)).normalize();
        } else {
          currentDirRef.current.copy(_toTarget);
        }
      }

      const accelProgress = smoothstep01(homingElapsedRef.current / 1.1);
      currentSpeedRef.current = START_SPEED + (MAX_SPEED - START_SPEED) * accelProgress;
    }

    const step = currentSpeedRef.current * delta;
    g.position.addScaledVector(currentDirRef.current, step);
    g.rotation.y = Math.atan2(currentDirRef.current.x, currentDirRef.current.z);

    if (wingRef.current) {
      wingRef.current.rotation.y += delta * 14;
      wingRef.current.rotation.z = Math.sin(t * 18) * 0.35;
    }

    if (visualScaleRef.current) {
      const pulse = phaseRef.current === 'homing' ? 1 + Math.sin(t * 12) * 0.08 : 1;
      visualScaleRef.current.scale.setScalar(pulse);
    }

    _boltLightPos.copy(g.position).add(new Vector3(0, 0.1, 0));
    orbLight.current?.setPosition(_boltLightPos.x, _boltLightPos.y, _boltLightPos.z);

    const liveHitTarget = getTargetPosition();
    if (phaseRef.current === 'homing' && liveHitTarget) {
      _resolved.copy(liveHitTarget);
      const hitDist = g.position.distanceTo(_resolved);
      if (hitDist <= HIT_RADIUS) {
        doneRef.current = true;
        onHitEnemy();
        onComplete();
        return;
      }
    }

    if (t > maxLifetimeRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailAccent}
        size={0.035}
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
            <mesh material={wingMat} rotation={[0, 0, 0.55]} position={[0.16, 0, 0]}>
              <boxGeometry args={[0.34, 0.05, 0.14]} />
            </mesh>
            <mesh material={wingMat} rotation={[0, 0, -0.55]} position={[-0.16, 0, 0]}>
              <boxGeometry args={[0.34, 0.05, 0.14]} />
            </mesh>
          </group>
          <mesh material={coreMat}>
            <sphereGeometry args={[0.16, 10, 10]} />
          </mesh>
        </group>
      </group>
    </>
  );
}
