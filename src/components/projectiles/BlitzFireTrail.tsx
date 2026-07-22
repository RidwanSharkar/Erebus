'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  Vector3,
} from '@/utils/three-exports';
import type { CrossentropyVisualTheme } from '@/utils/talents';

const FIRE_PARTICLE_GEOMETRY = new SphereGeometry(0.12, 6, 6);
const MAX_PARTICLES = 48;
const SPAWN_SKIP_CHANCE = 0.45;
const RISE_PER_SEC = 0.5;
const TRAIL_Y_BIAS = -0.3;
const TRAIL_BACK_OFFSET = 0.35;

type Slot = {
  active: boolean;
  bornMs: number;
  lifeSec: number;
  initialScale: number;
  pos: Vector3;
};

function createSlots(): Slot[] {
  const slots: Slot[] = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    slots.push({
      active: false,
      bornMs: 0,
      lifeSec: 1,
      initialScale: 0.45,
      pos: new Vector3(),
    });
  }
  return slots;
}

function trailPalette(theme: CrossentropyVisualTheme, reaper: boolean) {
  if (reaper) {
    return { color: '#9944FF', emissive: '#B866FF' };
  }
  if (theme === 'inferno') {
    return { color: '#FF3300', emissive: '#FF6600' };
  }
  if (theme === 'glacial') {
    return { color: '#1188DD', emissive: '#66CCFF' };
  }
  if (theme === 'tempest') {
    return { color: '#44AAFF', emissive: '#88DDFF' };
  }
  if (theme === 'plague') {
    return { color: '#44FF88', emissive: '#88FFAA' };
  }
  return { color: '#FF5500', emissive: '#FF8833' };
}

export interface BlitzFireTrailProps {
  worldPositionRef: React.RefObject<Vector3 | null> | React.MutableRefObject<Vector3>;
  directionRef: React.RefObject<Vector3 | null> | React.MutableRefObject<Vector3>;
  isActiveRef?: React.RefObject<boolean>;
  visualTheme?: CrossentropyVisualTheme;
  reaperPurple?: boolean;
  yOffset?: number;
}

const BlitzFireTrail = React.memo(
  ({
    worldPositionRef,
    directionRef,
    isActiveRef,
    visualTheme = 'default',
    reaperPurple = false,
    yOffset = 0,
  }: BlitzFireTrailProps) => {
    const meshRef = useRef<InstancedMesh>(null);
    const dummy = useMemo(() => new Object3D(), []);
    const slotsRef = useRef<Slot[]>(createSlots());
    const lastPosRef = useRef<Vector3 | null>(null);
    const tmpB = useRef(new Vector3());
    const tmpSpawn = useRef(new Vector3());
    const tmpBack = useRef(new Vector3());

    const { color, emissive } = useMemo(
      () => trailPalette(visualTheme, reaperPurple),
      [visualTheme, reaperPurple],
    );

    const material = useMemo(
      () =>
        new MeshStandardMaterial({
          color,
          emissive,
          emissiveIntensity: 2.2,
          transparent: true,
          opacity: 0.75,
          depthWrite: false,
        }),
      [color, emissive],
    );

    useEffect(() => {
      return () => {
        material.dispose();
      };
    }, [material]);

    useEffect(() => {
      const mesh = meshRef.current;
      if (!mesh) return;
      dummy.position.set(9999, 9999, 9999);
      dummy.scale.setScalar(0);
      dummy.updateMatrix();
      for (let i = 0; i < MAX_PARTICLES; i++) {
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }, [dummy]);

    useFrame((_, delta) => {
      const mesh = meshRef.current;
      if (!mesh) return;

      const active = isActiveRef?.current !== false;
      const raw = worldPositionRef.current;
      if (raw && active) {
        const dir = directionRef.current;
        tmpBack.current.set(0, 0, 0);
        if (dir && dir.lengthSq() > 0.0001) {
          tmpBack.current.copy(dir).normalize().multiplyScalar(-TRAIL_BACK_OFFSET);
        }

        const current = tmpB.current.copy(raw);
        current.add(tmpBack.current);
        current.y += TRAIL_Y_BIAS + yOffset;

        const last = lastPosRef.current;
        if (last && Math.random() > SPAWN_SKIP_CHANCE) {
          let free = -1;
          const slots = slotsRef.current;
          for (let i = 0; i < MAX_PARTICLES; i++) {
            if (!slots[i].active) {
              free = i;
              break;
            }
          }
          if (free >= 0) {
            const s = slots[free];
            const t = Math.random();
            tmpSpawn.current.copy(last).lerp(current, t);
            tmpSpawn.current.x += (Math.random() - 0.5) * 0.5;
            tmpSpawn.current.y += Math.random() * 0.2;
            tmpSpawn.current.z += (Math.random() - 0.5) * 0.5;
            s.pos.copy(tmpSpawn.current);
            s.bornMs = performance.now();
            s.lifeSec = 0.4 + Math.random() * 0.7;
            s.initialScale = 0.15 + Math.random() * 0.45;
            s.active = true;
          }
        }
        if (!lastPosRef.current) lastPosRef.current = new Vector3();
        lastPosRef.current.copy(current);
      } else {
        lastPosRef.current = null;
      }

      const now = performance.now();
      const slots = slotsRef.current;
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const s = slots[i];
        if (!s.active) {
          dummy.position.set(9999, 9999, 9999);
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }

        const elapsedSec = (now - s.bornMs) / 1000;
        const progress = Math.min(elapsedSec / s.lifeSec, 1);
        if (progress >= 1) {
          s.active = false;
          dummy.position.set(9999, 9999, 9999);
          dummy.scale.setScalar(0);
          dummy.updateMatrix();
          mesh.setMatrixAt(i, dummy.matrix);
          continue;
        }

        s.pos.y += RISE_PER_SEC * delta;
        const scale = s.initialScale * (1 - progress);
        dummy.position.copy(s.pos);
        dummy.scale.setScalar(scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }

      mesh.instanceMatrix.needsUpdate = true;
    });

    return (
      <instancedMesh
        ref={meshRef}
        args={[FIRE_PARTICLE_GEOMETRY, material, MAX_PARTICLES]}
        frustumCulled={false}
      />
    );
  },
);

BlitzFireTrail.displayName = 'BlitzFireTrail';

export default BlitzFireTrail;
