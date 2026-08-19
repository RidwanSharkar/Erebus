'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from '@/utils/three-exports';

const MOTE_PEBBLE_GEOMETRY = new IcosahedronGeometry(0.06, 0);
const MOTE_PEBBLE_MATERIAL = new MeshStandardMaterial({
  color: '#9aa3ad',
  emissive: '#525860',
  emissiveIntensity: 0.18,
  roughness: 0.88,
  metalness: 0.06,
  flatShading: true,
});

const _mat4 = new Matrix4();
const _pos = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _nextPos = new Vector3();
const _euler = { x: 0, y: 0, z: 0 };

export interface StoneCollectMoteSeed {
  startPosition: Vector3;
  startTime: number;
  duration: number;
}

interface StoneCollectMoteEffectProps {
  batchId: string;
  motes: StoneCollectMoteSeed[];
  getCurrentPlayerPosition: () => Vector3;
  onMoteComplete: () => void;
  onBatchComplete: () => void;
}

export default function StoneCollectMoteEffect({
  batchId,
  motes,
  getCurrentPlayerPosition,
  onMoteComplete,
  onBatchComplete,
}: StoneCollectMoteEffectProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const completedRef = useRef(new Set<number>());
  const batchDoneRef = useRef(false);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh || motes.length === 0) return;

    const now = Date.now();
    let allDone = true;

    for (let i = 0; i < motes.length; i += 1) {
      const mote = motes[i]!;
      if (completedRef.current.has(i)) continue;

      const elapsed = now - mote.startTime;
      const t = Math.min(elapsed / mote.duration, 1);

      if (t >= 1) {
        completedRef.current.add(i);
        onMoteComplete();
        continue;
      }

      allDone = false;
      const playerPos = getCurrentPlayerPosition();
      const lift = Math.sin(t * Math.PI) * 0.55;
      _nextPos.lerpVectors(mote.startPosition, playerPos, t);
      _nextPos.y += 0.3 + lift;

      const scale = 1 - t * 0.5;
      _pos.copy(_nextPos);
      _scale.set(scale, scale * 0.85, scale);
      _euler.y = t * 3.2;
      _euler.x = 0.25;
      _quat.setFromEuler(_euler as any);
      _mat4.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat4);
    }

    mesh.instanceMatrix.needsUpdate = true;

    if (allDone && !batchDoneRef.current) {
      batchDoneRef.current = true;
      onBatchComplete();
    }
  });

  if (motes.length === 0) return null;

  return (
    <instancedMesh
      key={batchId}
      ref={meshRef}
      args={[MOTE_PEBBLE_GEOMETRY, MOTE_PEBBLE_MATERIAL, motes.length]}
      frustumCulled={false}
    />
  );
}
