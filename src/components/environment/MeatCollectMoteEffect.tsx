'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@/utils/three-exports';

const MOTE_STEAK_GEOMETRY = new SphereGeometry(0.055, 7, 5);
const MOTE_STEAK_MATERIAL = new MeshStandardMaterial({
  color: '#d4544a',
  emissive: '#6b221c',
  emissiveIntensity: 0.22,
  roughness: 0.7,
  metalness: 0.04,
});

const _mat4 = new Matrix4();
const _pos = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _nextPos = new Vector3();
const _euler = { x: 0.6, y: 0, z: 0 };

export interface MeatCollectMoteSeed {
  startPosition: Vector3;
  startTime: number;
  duration: number;
}

interface MeatCollectMoteEffectProps {
  batchId: string;
  motes: MeatCollectMoteSeed[];
  getCurrentPlayerPosition: () => Vector3;
  onMoteComplete: () => void;
  onBatchComplete: () => void;
}

export default function MeatCollectMoteEffect({
  batchId,
  motes,
  getCurrentPlayerPosition,
  onMoteComplete,
  onBatchComplete,
}: MeatCollectMoteEffectProps) {
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
      const lift = Math.sin(t * Math.PI) * 0.65;
      _nextPos.lerpVectors(mote.startPosition, playerPos, t);
      _nextPos.y += 0.35 + lift;

      const scale = 1 - t * 0.55;
      _pos.copy(_nextPos);
      _scale.set(scale * 1.2, scale * 0.5, scale * 1.2);
      _euler.y = t * 2.8;
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
      args={[MOTE_STEAK_GEOMETRY, MOTE_STEAK_MATERIAL, motes.length]}
      frustumCulled={false}
    />
  );
}
