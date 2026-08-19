'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@/utils/three-exports';
import type { InstancedMesh } from '@/utils/three-exports';

interface MeatDropLike {
  id: string;
  amount: number;
  pieceCount: number;
  position: { x: number; y: number; z: number };
  droppedAt: number;
}

interface MeatPileDropEffectProps {
  drop: MeatDropLike;
  playerPositionRef: React.MutableRefObject<Vector3>;
  onPickup: (dropId: string) => void;
  pickupRadius?: number;
}

interface MeatPieceAnimSeed {
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  targetY: number;
  rotY: number;
  rotX: number;
  delay: number;
  scaleXZ: number;
  scaleY: number;
}

const DEFAULT_PICKUP_RADIUS = 6;
const FALL_DURATION_S = 0.36;
const VISUAL_PIECE_CAP = 10;
const STEAK_RADIUS = 0.11;
const SHADOW_RADIUS = 0.48;

const STEAK_GEOMETRY = new SphereGeometry(STEAK_RADIUS, 8, 6);
const STEAK_MATERIAL = new MeshStandardMaterial({
  color: '#c4453c',
  emissive: '#5c1a16',
  emissiveIntensity: 0.18,
  roughness: 0.72,
  metalness: 0.04,
});

const _mat4 = new Matrix4();
const _pos = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _euler = { x: 0, y: 0, z: 0 };

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function MeatPileDropEffect({
  drop,
  playerPositionRef,
  onPickup,
  pickupRadius = DEFAULT_PICKUP_RADIUS,
}: MeatPileDropEffectProps) {
  const meshRef = useRef<InstancedMesh>(null);
  const pieceCount = Math.max(1, Math.min(VISUAL_PIECE_CAP, Math.floor(drop.pieceCount || drop.amount || 1)));

  const seeds = useMemo<MeatPieceAnimSeed[]>(() => {
    const out: MeatPieceAnimSeed[] = [];
    for (let i = 0; i < pieceCount; i += 1) {
      const ring = (i / Math.max(pieceCount, 1)) * Math.PI * 2;
      const ringR = 0.12 + (i % 5) * 0.04;
      const stackLayer = Math.floor(i / 5);
      out.push({
        startX: Math.cos(ring) * (0.38 + Math.random() * 0.2),
        startY: 0.8 + Math.random() * 0.35,
        startZ: Math.sin(ring) * (0.38 + Math.random() * 0.2),
        targetX: Math.cos(ring) * ringR,
        targetZ: Math.sin(ring) * ringR,
        targetY: STEAK_RADIUS * 0.55 + stackLayer * 0.07,
        rotY: ring + (Math.random() - 0.5) * 0.8,
        rotX: 0.55 + Math.random() * 0.4,
        delay: Math.random() * 0.2,
        scaleXZ: 1.15 + Math.random() * 0.35,
        scaleY: 0.42 + Math.random() * 0.16,
      });
    }
    return out;
  }, [drop.id, pieceCount]);

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const nowS = Date.now() * 0.001;
    const ageS = nowS - drop.droppedAt * 0.001;
    const bob = ageS > FALL_DURATION_S + 0.3 ? Math.sin(nowS * 2.4) * 0.01 : 0;

    for (let i = 0; i < seeds.length; i += 1) {
      const seed = seeds[i]!;
      const rawT = (ageS - seed.delay) / FALL_DURATION_S;
      const t = Math.max(0, Math.min(1, rawT));
      const eased = easeOutCubic(t);

      const x = seed.startX + (seed.targetX - seed.startX) * eased;
      const y = seed.startY + (seed.targetY - seed.startY) * eased + bob;
      const z = seed.startZ + (seed.targetZ - seed.startZ) * eased;

      _pos.set(x, y, z);
      _scale.set(seed.scaleXZ, seed.scaleY, seed.scaleXZ);
      _euler.y = seed.rotY;
      _euler.x = seed.rotX;
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
        <circleGeometry args={[SHADOW_RADIUS, 20]} />
        <meshBasicMaterial color="#3a1210" transparent opacity={0.42} />
      </mesh>
      <instancedMesh
        ref={meshRef}
        args={[STEAK_GEOMETRY, STEAK_MATERIAL, pieceCount]}
        frustumCulled={false}
      />
    </group>
  );
}
