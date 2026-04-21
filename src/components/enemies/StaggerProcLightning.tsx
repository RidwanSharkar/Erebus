'use client';

import { useRef, useMemo } from 'react';
import { Vector3, AdditiveBlending, CylinderGeometry, MeshBasicMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

const DURATION_MS = 450;
const SKY_Y = 22;

interface StaggerProcLightningProps {
  position: Vector3;
  onComplete: () => void;
}

export default function StaggerProcLightning({ position, onComplete }: StaggerProcLightningProps) {
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
        color: '#7dd3fc',
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
        color: '#0ea5e9',
        transparent: true,
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const cyl = useMemo(() => new CylinderGeometry(0.06, 0.1, 1, 6), []);

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
      <pointLight position={[position.x, position.y + 2, position.z]} color="#38bdf8" intensity={18} distance={14} decay={2} />
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
