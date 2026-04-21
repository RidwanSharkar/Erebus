'use client';

import { useRef, useMemo } from 'react';
import { Vector3, AdditiveBlending, CylinderGeometry, MeshBasicMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

const DURATION_MS = 450;
const SKY_Y = 22;

interface KnightSmiteLightningProps {
  position: Vector3;
  onComplete: () => void;
}

/** Red sky-to-ground strike for Red Knight Smite — same mesh stack as StaggerProcLightning, crimson palette. */
export default function KnightSmiteLightning({ position, onComplete }: KnightSmiteLightningProps) {
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const segments = useMemo(() => {
    const baseX = position.x;
    const baseY = position.y;
    const baseZ = position.z;
    const n = 14;
    const pts: { x: number; y: number; z: number; h: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const jitter = (1 - t) * 0.35;
      pts.push({
        x: baseX + (Math.random() - 0.5) * jitter,
        y: baseY + SKY_Y * (1 - t),
        z: baseZ + (Math.random() - 0.5) * jitter,
        h: 0.12 + (1 - t) * 0.08,
      });
    }
    return pts;
  }, [position.x, position.y, position.z]);

  const matCore = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#fca5a5',
        transparent: true,
        opacity: 0.95,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const matGlow = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#ef4444',
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const cyl = useMemo(() => new CylinderGeometry(0.07, 0.11, 1, 6), []);

  useFrame(() => {
    if (startRef.current === null) startRef.current = performance.now();
    const elapsed = performance.now() - startRef.current;
    const k = Math.min(1, elapsed / DURATION_MS);
    const fade = 1 - k;
    matCore.opacity = 0.95 * fade;
    matGlow.opacity = 0.55 * fade;
    if (k >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group>
      <pointLight position={[position.x, position.y + 2, position.z]} color="#f97316" intensity={22} distance={16} decay={2} />
      {segments.slice(0, -1).map((p, i) => {
        const q = segments[i + 1];
        const midX = (p.x + q.x) / 2;
        const midY = (p.y + q.y) / 2;
        const midZ = (p.z + q.z) / 2;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const dz = q.z - p.z;
        const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
        const yaw = Math.atan2(dx, dz);
        const pitch = -Math.asin(dy / len) + Math.PI / 2;
        return (
          <group key={i} position={[midX, midY, midZ]} rotation={[pitch, yaw, 0]}>
            <mesh geometry={cyl} material={matGlow} scale={[1.4, len, 1.4]} />
            <mesh geometry={cyl} material={matCore} scale={[1, len, 1]} />
          </group>
        );
      })}
    </group>
  );
}
