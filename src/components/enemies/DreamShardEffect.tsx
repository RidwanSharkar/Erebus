'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  SphereGeometry,
  BoxGeometry,
} from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail from '@/components/projectiles/EntropicBoltTrail';

const _boltLightPos = new Vector3();
const _aim = new Vector3();
const _toTarget = new Vector3();
const _resolved = new Vector3();
const _startToPlayer = new Vector3();
const _startToPos = new Vector3();

const trailColor = new Color('#a855f7');
const trailAccent = new Color('#d8b4fe');

const sharedCoreGeo = new SphereGeometry(0.16, 10, 10);
const sharedWingGeo = new BoxGeometry(0.34, 0.05, 0.14);

const START_SPEED = 5;
const MAX_SPEED = 38;
const BURST_SPEED = 7;
const TURN_RATE = 10;
const TURN_RATE_RECOVERY = 22;
const CROSS_TRACK_RECOVERY_START = 3.5;
const CROSS_TRACK_RECOVERY_RANGE = 2;
const HIT_RADIUS = 0.9;
const BURST_DURATION = 0.3;
const MAX_LIFETIME = 4.5;

function smoothstep01(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

export interface DreamShardEffectProps {
  startPosition: Vector3;
  initialDirection: Vector3;
  getPlayerPosition: () => Vector3 | null;
  onComplete: () => void;
}

/** Purple Locust-like shard that bursts from a dead enemy, then homes to the local player. */
export default function DreamShardEffect({
  startPosition,
  initialDirection,
  getPlayerPosition,
  onComplete,
}: DreamShardEffectProps) {
  const groupRef = useRef<Group>(null);
  const visualScaleRef = useRef<Group>(null);
  const wingRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const phaseRef = useRef<'burst' | 'homing'>('burst');
  const homingElapsedRef = useRef(0);

  const launchDirRef = useRef(new Vector3());
  launchDirRef.current.copy(initialDirection).normalize();

  const currentDirRef = useRef(launchDirRef.current.clone());
  const currentSpeedRef = useRef(BURST_SPEED);
  const startPositionRef = useRef(new Vector3());
  startPositionRef.current.copy(startPosition);

  const orbLight = useDynamicLight({ color: '#c084fc', distance: 6, priority: 1 });

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

    if (phaseRef.current === 'burst' && t >= BURST_DURATION) {
      phaseRef.current = 'homing';
      homingElapsedRef.current = 0;
      currentSpeedRef.current = START_SPEED;
    }

    if (phaseRef.current === 'homing') {
      homingElapsedRef.current += delta;
      const liveTarget = getPlayerPosition();
      if (liveTarget) {
        _aim.copy(liveTarget).sub(g.position);
        _aim.y *= 0.35;
        if (_aim.lengthSq() > 1e-6) {
          _aim.normalize();
          _toTarget.copy(_aim);
          const dot = Math.max(-1, Math.min(1, currentDirRef.current.dot(_toTarget)));
          const offAxis = 1 - Math.max(0, Math.min(1, (dot + 0.25) / 1.25));

          _startToPlayer.copy(liveTarget).sub(startPositionRef.current);
          _startToPlayer.y = 0;
          const lineLen = _startToPlayer.length();
          let crossFactor = 0;
          if (lineLen > 1e-4) {
            _startToPos.copy(g.position).sub(startPositionRef.current);
            _startToPos.y = 0;
            const crossMag = Math.abs(
              _startToPos.x * _startToPlayer.z - _startToPos.z * _startToPlayer.x,
            );
            const crossTrack = crossMag / lineLen;
            crossFactor = smoothstep01(
              (crossTrack - CROSS_TRACK_RECOVERY_START) / CROSS_TRACK_RECOVERY_RANGE,
            );
          }

          const urgency = Math.max(offAxis, crossFactor);
          const effectiveTurnRate =
            TURN_RATE + (TURN_RATE_RECOVERY - TURN_RATE) * urgency;
          const maxTurn = effectiveTurnRate * delta;
          const angle = Math.acos(dot);
          if (angle > 1e-5) {
            const turn = Math.min(maxTurn, angle);
            currentDirRef.current.lerp(_toTarget, turn / Math.max(angle, 1e-5)).normalize();
          } else {
            currentDirRef.current.copy(_toTarget);
          }
        }
      }

      const accelProgress = smoothstep01(homingElapsedRef.current / 1.1);
      currentSpeedRef.current = START_SPEED + (MAX_SPEED - START_SPEED) * accelProgress;
    } else {
      currentSpeedRef.current = BURST_SPEED;
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

    const liveHitTarget = getPlayerPosition();
    if (phaseRef.current === 'homing' && liveHitTarget) {
      _resolved.copy(liveHitTarget);
      const hitDist = g.position.distanceTo(_resolved);
      if (hitDist <= HIT_RADIUS) {
        doneRef.current = true;
        onComplete();
        return;
      }
    }

    if (t > MAX_LIFETIME) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <>
      <EntropicBoltTrail
        color={trailColor}
        accentColor={trailAccent}
        size={0.0325}
        meshRef={groupRef}
        opacity={0.9}
        flightDirectionRef={currentDirRef}
      />
      <group ref={groupRef} position={[startPosition.x, startPosition.y, startPosition.z]}>
        <group ref={visualScaleRef}>
          <group ref={wingRef}>
            <mesh
              material={wingMat}
              geometry={sharedWingGeo}
              rotation={[0, 0, 0.55]}
              position={[0.16, 0, 0]}
            />
            <mesh
              material={wingMat}
              geometry={sharedWingGeo}
              rotation={[0, 0, -0.55]}
              position={[-0.16, 0, 0]}
            />
          </group>
          <mesh material={coreMat} geometry={sharedCoreGeo} />
        </group>
      </group>
    </>
  );
}
