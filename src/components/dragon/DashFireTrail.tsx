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

const FIRE_PARTICLE_GEOMETRY = new SphereGeometry(0.25, 8, 8);
const MAX_PARTICLES = 64;
const SPAWN_SKIP_CHANCE = 0.6; // matches old Math.random() > 0.6
const RISE_PER_SEC = 0.6; // ~0.01/frame at 60fps
const TRAIL_Y_BIAS = -0.5;

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
      initialScale: 0.3,
      pos: new Vector3(),
    });
  }
  return slots;
}

export interface DashFireTrailProps {
  worldPositionRef: React.RefObject<Vector3 | null> | React.MutableRefObject<Vector3>;
  isDashingRef: React.RefObject<boolean>;
  yOffset?: number;
  /** When true, no spawn/update (e.g. Knight humanoid — matches wing jet rule). */
  disabled?: boolean;
}

const DashFireTrail = React.memo(
  ({ worldPositionRef, isDashingRef, yOffset = 0, disabled = false }: DashFireTrailProps) => {
    const meshRef = useRef<InstancedMesh>(null);
    const dummy = useMemo(() => new Object3D(), []);
    const slotsRef = useRef<Slot[]>(createSlots());
    const lastPosRef = useRef<Vector3 | null>(null);
    const tmpB = useRef(new Vector3());
    const tmpSpawn = useRef(new Vector3());

    const material = useMemo(
      () =>
        new MeshStandardMaterial({
          color: '#ff4500',
          emissive: '#ff7700',
          emissiveIntensity: 2,
          transparent: true,
          opacity: 0.8,
          depthWrite: false,
        }),
      [],
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

      const raw = worldPositionRef.current;
      if (raw && !disabled && isDashingRef.current) {
        const current = tmpB.current.copy(raw);
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
            tmpSpawn.current.x += (Math.random() - 0.5) * .65;
            tmpSpawn.current.y += Math.random() * 0.25;
            tmpSpawn.current.z += (Math.random() - 0.5) * .65;
            s.pos.copy(tmpSpawn.current);
            s.bornMs = performance.now();
            s.lifeSec = 0.5 + Math.random() * 1.0;
            s.initialScale = 0.2 + Math.random() * 0.6;
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

DashFireTrail.displayName = 'DashFireTrail';

export default DashFireTrail;
