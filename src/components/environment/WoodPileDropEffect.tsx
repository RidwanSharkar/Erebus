'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from '@/utils/three-exports';

interface WoodDropLike {
  id: string;
  amount: number;
  pieceCount: number;
  position: { x: number; y: number; z: number };
  droppedAt: number;
}

interface WoodPileDropEffectProps {
  drop: WoodDropLike;
  playerPositionRef: React.MutableRefObject<Vector3>;
  onPickup: (dropId: string) => void;
  pickupRadius?: number;
}

interface WoodPieceAnimSeed {
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  targetY: number;
  rotY: number;
  delay: number;
}

const DEFAULT_PICKUP_RADIUS = 6;
const FALL_DURATION_S = 0.36;

const LOG_GEOMETRY = new CylinderGeometry(0.058, 0.070, 0.40, 6);
const LOG_MATERIAL = new MeshStandardMaterial({
  color: '#6b4423',
  emissive: '#3d2817',
  emissiveIntensity: 0.15,
  roughness: 0.85,
  metalness: 0.05,
});

const _mat4 = new Matrix4();
const _pos = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _euler = { x: 0, y: 0, z: Math.PI / 2 };

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function WoodPileDropEffect({
  drop,
  playerPositionRef,
  onPickup,
  pickupRadius = DEFAULT_PICKUP_RADIUS,
}: WoodPileDropEffectProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const pieceCount = Math.max(1, Math.min(20, Math.floor(drop.pieceCount || drop.amount || 1)));

  const seeds = useMemo<WoodPieceAnimSeed[]>(() => {
    const out: WoodPieceAnimSeed[] = [];
    for (let i = 0; i < pieceCount; i += 1) {
      const ring = (i / Math.max(pieceCount, 1)) * Math.PI * 2;
      const ringR = 0.14 + (i % 5) * 0.032;
      const stackLayer = Math.floor(i / 5);
      out.push({
        startX: Math.cos(ring) * (0.42 + Math.random() * 0.22),
        startY: 0.85 + Math.random() * 0.4,
        startZ: Math.sin(ring) * (0.42 + Math.random() * 0.22),
        targetX: Math.cos(ring) * ringR,
        targetZ: Math.sin(ring) * ringR,
        targetY: stackLayer * 0.085,
        rotY: ring + (Math.random() - 0.5) * 0.6,
        delay: Math.random() * 0.2,
      });
    }
    return out;
  }, [drop.id, pieceCount]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const nowS = Date.now() * 0.001;
    const ageS = nowS - drop.droppedAt * 0.001;
    const bob = ageS > FALL_DURATION_S + 0.3 ? Math.sin(nowS * 2.4) * 0.012 : 0;

    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i]!;
      const rawT = (ageS - seed.delay) / FALL_DURATION_S;
      const t = Math.max(0, Math.min(1, rawT));
      const eased = easeOutCubic(t);

      const x = seed.startX + (seed.targetX - seed.startX) * eased;
      const y = seed.startY + (seed.targetY - seed.startY) * eased + bob;
      const z = seed.startZ + (seed.targetZ - seed.startZ) * eased;

      _pos.set(x, y, z);
      _scale.set(1, 1, 1);
      _euler.y = seed.rotY;
      _quat.setFromEuler(_euler as any);
      _mat4.compose(_pos, _quat, _scale);
      mesh.setMatrixAt(i, _mat4);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  const tryPickup = () => {
    const dropPos = new Vector3(drop.position.x, drop.position.y, drop.position.z);
    const dist = playerPositionRef.current.distanceTo(dropPos);
    if (dist <= pickupRadius) {
      onPickup(drop.id);
    }
  };

  return (
    <group
      position={[drop.position.x, drop.position.y, drop.position.z]}
      onClick={(e: any) => {
        e.stopPropagation();
        tryPickup();
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[0.50, 20]} />
        <meshBasicMaterial color="#2a1a0a" transparent opacity={0.45} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[LOG_GEOMETRY, LOG_MATERIAL, pieceCount]}
        frustumCulled={false}
      />
    </group>
  );
}
