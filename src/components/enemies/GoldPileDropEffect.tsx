'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Mesh } from '@/utils/three-exports';

interface GoldDropLike {
  id: string;
  amount: number;
  pieceCount: number;
  position: { x: number; y: number; z: number };
  droppedAt: number;
}

interface GoldPileDropEffectProps {
  drop: GoldDropLike;
  playerPositionRef: React.MutableRefObject<Vector3>;
  onPickup: (dropId: string) => void;
  pickupRadius?: number;
}

interface GoldPieceAnimSeed {
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  delay: number;
}

const DEFAULT_PICKUP_RADIUS = 6;
const FALL_DURATION_S = 0.36;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export default function GoldPileDropEffect({
  drop,
  playerPositionRef,
  onPickup,
  pickupRadius = DEFAULT_PICKUP_RADIUS,
}: GoldPileDropEffectProps) {
  const rootRef = useRef<any>(null);
  const pieceRefs = useRef<Array<Mesh | null>>([]);
  const pieceCount = Math.max(1, Math.min(25, Math.floor(drop.pieceCount || drop.amount || 1)));

  const seeds = useMemo<GoldPieceAnimSeed[]>(() => {
    const out: GoldPieceAnimSeed[] = [];
    for (let i = 0; i < pieceCount; i += 1) {
      const ring = (i / Math.max(pieceCount, 1)) * Math.PI * 2;
      const ringR = 0.12 + (i % 5) * 0.025;
      out.push({
        startX: Math.cos(ring) * (0.35 + Math.random() * 0.2),
        startY: 0.9 + Math.random() * 0.45,
        startZ: Math.sin(ring) * (0.35 + Math.random() * 0.2),
        targetX: Math.cos(ring) * ringR,
        targetZ: Math.sin(ring) * ringR,
        delay: Math.random() * 0.2,
      });
    }
    return out;
  }, [drop.id, pieceCount]);

  useFrame(() => {
    const nowS = Date.now() * 0.001;
    const ageS = nowS - drop.droppedAt * 0.001;

    for (let i = 0; i < seeds.length; i += 1) {
      const mesh = pieceRefs.current[i];
      if (!mesh) continue;
      const seed = seeds[i]!;
      const rawT = (ageS - seed.delay) / FALL_DURATION_S;
      const t = Math.max(0, Math.min(1, rawT));
      const eased = easeOutCubic(t);
      const x = seed.startX + (seed.targetX - seed.startX) * eased;
      const y = seed.startY + (0.02 - seed.startY) * eased;
      const z = seed.startZ + (seed.targetZ - seed.startZ) * eased;
      mesh.position.set(x, y, z);
      mesh.rotation.y += 0.05 + i * 0.0007;
      mesh.rotation.x += 0.02;
      if (t >= 1) {
        mesh.position.y = 0.02 + Math.sin(nowS * 4 + i * 0.7) * 0.006;
      }
    }

    if (rootRef.current) {
      rootRef.current.rotation.y += 0.0015;
    }
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
      ref={rootRef}
      position={[drop.position.x, drop.position.y, drop.position.z]}
      onClick={(e: any) => {
        e.stopPropagation();
        tryPickup();
      }}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[0.38, 24]} />
        <meshBasicMaterial color="#3d2a08" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <sphereGeometry args={[0.52, 12, 12]} />
        <meshBasicMaterial color="#ffd873" transparent opacity={0.14} depthWrite={false} />
      </mesh>
      <pointLight color="#ffc94d" intensity={2.2} distance={5} decay={2} position={[0, 0.35, 0]} />

      {seeds.map((_, idx) => (
        <mesh
          key={`${drop.id}-gold-${idx}`}
          ref={(el) => {
            pieceRefs.current[idx] = el;
          }}
        >
          <sphereGeometry args={[0.068, 8, 8]} />
          <meshStandardMaterial color="#f6c548" emissive="#f6c548" emissiveIntensity={1.05} metalness={0.92} roughness={0.2} />
        </mesh>
      ))}
    </group>
  );
}
