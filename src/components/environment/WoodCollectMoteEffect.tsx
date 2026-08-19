'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from '@/utils/three-exports';

const MOTE_LOG_GEOMETRY = new CylinderGeometry(0.042, 0.050, 0.26, 5);
const MOTE_LOG_MATERIAL = new MeshStandardMaterial({
  color: '#7a5230',
  emissive: '#4a3018',
  emissiveIntensity: 0.2,
  roughness: 0.8,
  metalness: 0.04,
});

const _mat4 = new Matrix4();
const _pos = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _nextPos = new Vector3();
const _euler = { x: 0, y: 0, z: 0 };

export interface WoodCollectMoteSeed {
  startPosition: Vector3;
  startTime: number;
  duration: number;
}

interface WoodCollectMoteEffectProps {
  batchId: string;
  motes: WoodCollectMoteSeed[];
  getCurrentPlayerPosition: () => Vector3;
  onMoteComplete: () => void;
  onBatchComplete: () => void;
}

export default function WoodCollectMoteEffect({
  batchId,
  motes,
  getCurrentPlayerPosition,
  onMoteComplete,
  onBatchComplete,
}: WoodCollectMoteEffectProps) {
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
      _scale.set(scale, scale, scale);
      _euler.y = t * 2.8;
      _euler.z = Math.PI / 2;
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
      args={[MOTE_LOG_GEOMETRY, MOTE_LOG_MATERIAL, motes.length]}
      frustumCulled={false}
    />
  );
}
