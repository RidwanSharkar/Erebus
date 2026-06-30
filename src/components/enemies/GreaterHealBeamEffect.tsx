'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import type { Enemy, Player } from '@/contexts/MultiplayerContext';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface GreaterHealBeamEffectProps {
  position: Vector3;
  targetKind?: 'player' | 'ally';
  targetId?: string;
  enemiesRef?: React.MutableRefObject<Map<string, Enemy>>;
  playersRef?: React.MutableRefObject<Map<string, Player>>;
  socketId?: string;
  localPlayerWorldPosRef?: React.MutableRefObject<Vector3>;
  enemyPlayerPositionRefs?: React.MutableRefObject<Map<string, { current: Vector3 }>>;
  onComplete: () => void;
}

const DURATION = 1.25;
const MAX_BEAM_HEIGHT = 12;
const MOTE_COUNT = 26;

export default function GreaterHealBeamEffect({
  position,
  targetKind,
  targetId,
  enemiesRef,
  playersRef,
  socketId,
  localPlayerWorldPosRef,
  enemyPlayerPositionRefs,
  onComplete,
}: GreaterHealBeamEffectProps) {
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const groupRef = useRef<Group | null>(null);
  const trackedPosition = useRef(position.clone());

  const outerBeamRef = useRef<Mesh>(null);
  const innerBeamRef = useRef<Mesh>(null);
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const moteRefs = useRef<(Mesh | null)[]>([]);
  const groundRingRef = useRef<Mesh>(null);

  const healLight = useDynamicLight({ color: '#ccfbf1', distance: 8, priority: 1 });

  const motes = useMemo(
    () =>
      Array.from({ length: MOTE_COUNT }, (_, i) => ({
        angle: (i / MOTE_COUNT) * Math.PI * 2,
        radius: 0.35 + Math.random() * 0.75,
        heightOffset: Math.random() * 1.4,
        speed: 1.4 + Math.random() * 1.2,
        size: 0.045 + Math.random() * 0.055,
      })),
    [],
  );

  const outerBeamGeo = useMemo(() => new CylinderGeometry(1, 0.65, 1, 32, 1, true), []);
  const innerBeamGeo = useMemo(() => new CylinderGeometry(0.12, 0.2, 1, 18, 1, true), []);
  const ringGeos = useMemo(
    () => [0, 1, 2].map((i) => new TorusGeometry(0.45 + i * 0.18, 0.035, 12, 48)),
    [],
  );
  const moteGeo = useMemo(() => new SphereGeometry(1, 8, 8), []);
  const groundRingGeo = useMemo(() => new RingGeometry(0.42, 0.95, 48), []);

  const outerBeamMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#14b8a6',
        transparent: true,
        opacity: 0.2,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  const innerBeamMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ccfbf1',
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  const ringMats = useMemo(
    () =>
      [0, 1, 2].map(
        (i) =>
          new MeshBasicMaterial({
            color: i === 0 ? '#ccfbf1' : '#10b981',
            transparent: true,
            opacity: 0.55 - i * 0.1,
            blending: AdditiveBlending,
            depthWrite: false,
          }),
      ),
    [],
  );
  const moteMats = useMemo(
    () =>
      Array.from({ length: MOTE_COUNT }, (_, i) =>
        new MeshBasicMaterial({
          color: i % 4 === 0 ? '#ccfbf1' : '#2dd4bf',
          transparent: true,
          opacity: 0.9,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [],
  );
  const groundRingMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#059669',
        transparent: true,
        opacity: 0.45,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      outerBeamGeo.dispose();
      innerBeamGeo.dispose();
      ringGeos.forEach((g) => g.dispose());
      moteGeo.dispose();
      groundRingGeo.dispose();
      outerBeamMat.dispose();
      innerBeamMat.dispose();
      ringMats.forEach((m) => m.dispose());
      moteMats.forEach((m) => m.dispose());
      groundRingMat.dispose();
    };
  }, [
    outerBeamGeo,
    innerBeamGeo,
    ringGeos,
    moteGeo,
    groundRingGeo,
    outerBeamMat,
    innerBeamMat,
    ringMats,
    moteMats,
    groundRingMat,
  ]);

  const resolveTrackedPosition = (out: Vector3) => {
    if (targetKind === 'ally' && targetId) {
      const ally = enemiesRef?.current.get(targetId);
      if (ally && !ally.isDying && ally.health > 0) {
        out.set(ally.position.x, ally.position.y ?? 0, ally.position.z);
        return;
      }
    }

    if (targetKind === 'player' && targetId) {
      if (targetId === socketId && localPlayerWorldPosRef?.current) {
        out.copy(localPlayerWorldPosRef.current);
        return;
      }

      const remotePosition = enemyPlayerPositionRefs?.current.get(targetId)?.current;
      if (remotePosition) {
        out.copy(remotePosition);
        return;
      }

      const player = playersRef?.current.get(targetId);
      if (player) {
        out.set(player.position.x, player.position.y ?? 0, player.position.z);
        return;
      }
    }

    out.copy(position);
  };

  useFrame((_, delta) => {
    resolveTrackedPosition(trackedPosition.current);
    if (groupRef.current) {
      groupRef.current.position.copy(trackedPosition.current);
    }

    timeRef.current += delta;
    const time = timeRef.current;
    if (time >= DURATION && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }

    const progress = Math.min(1, time / DURATION);
    const fadeIn = Math.min(1, progress / 0.18);
    const fadeOut = 1 - Math.max(0, (progress - 0.62) / 0.38);
    const opacity = Math.max(0, fadeIn * fadeOut);
    const beamHeight = 7 + progress * 5;
    const beamY = beamHeight / 2;
    const beamRadius = 0.45 + progress * 0.18;
    const ringScale = 0.8 + progress * 2.2;

    const tp = trackedPosition.current;
    healLight.current?.setPosition(tp.x, tp.y, tp.z);
    healLight.current?.setIntensity(7 * opacity);

    if (outerBeamRef.current) {
      outerBeamRef.current.position.y = beamY;
      outerBeamRef.current.scale.set(beamRadius, beamHeight, beamRadius);
    }
    if (innerBeamRef.current) {
      innerBeamRef.current.position.y = beamY;
      innerBeamRef.current.scale.set(1, beamHeight, 1);
    }

    outerBeamMat.opacity = 0.2 * opacity;
    innerBeamMat.opacity = 0.5 * opacity;
    groundRingMat.opacity = opacity * 0.45;

    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      const s = ringScale * (1 - i * 0.12);
      ring.position.y = 0.05 + i * 0.34 + progress * 1.2;
      ring.rotation.set(Math.PI / 2, 0, time * (1.6 + i * 0.45));
      ring.scale.set(s, s, 1);
      ringMats[i].opacity = opacity * (0.55 - i * 0.1);
    });

    moteRefs.current.forEach((mote, i) => {
      if (!mote) return;
      const m = motes[i];
      const y = (progress * beamHeight * m.speed + m.heightOffset) % beamHeight;
      const spiral = m.angle + time * (2.8 + (i % 3) * 0.35);
      const radius = m.radius * (1 - progress * 0.35);
      mote.position.set(Math.cos(spiral) * radius, y, Math.sin(spiral) * radius);
      mote.scale.setScalar(m.size);
      moteMats[i].opacity = opacity * 0.9;
    });

    if (groundRingRef.current) {
      groundRingRef.current.scale.set(ringScale, ringScale, 1);
    }
  });

  return (
    <group ref={groupRef} position={[trackedPosition.current.x, trackedPosition.current.y, trackedPosition.current.z]}>
      <mesh ref={outerBeamRef} geometry={outerBeamGeo} material={outerBeamMat} />
      <mesh ref={innerBeamRef} geometry={innerBeamGeo} material={innerBeamMat} />

      {[0, 1, 2].map((i) => (
        <mesh
          key={`ring-${i}`}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          geometry={ringGeos[i]}
          material={ringMats[i]}
        />
      ))}

      {motes.map((_, i) => (
        <mesh
          key={`mote-${i}`}
          ref={(el) => {
            moteRefs.current[i] = el;
          }}
          geometry={moteGeo}
          material={moteMats[i]}
        />
      ))}

      <mesh
        ref={groundRingRef}
        position={[0, 0.04, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={groundRingGeo}
        material={groundRingMat}
      />
    </group>
  );
}
