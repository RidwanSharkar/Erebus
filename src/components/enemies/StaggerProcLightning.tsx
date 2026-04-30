'use client';

import { useRef, useMemo } from 'react';
import { Vector3, Quaternion, AdditiveBlending, CylinderGeometry, MeshBasicMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

const DURATION_MS = 620;
const SKY_Y = 24;

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
    const n = 20;
    const pts: { x: number; y: number; z: number }[] = [];

    // Random walk — each point continues from the tip of the previous segment
    let curX = baseX + (Math.random() - 0.5) * 0.4;
    let curZ = baseZ + (Math.random() - 0.5) * 0.4;

    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const spread = 1.1 * Math.sin(t * Math.PI) + 0.35;
      pts.push({ x: curX, y: baseY + SKY_Y * (1 - t), z: curZ });
      curX += (Math.random() - 0.5) * spread * 2;
      curZ += (Math.random() - 0.5) * spread * 2;
    }

    // Snap the final point back to the target so the bolt always lands on the enemy
    pts[n - 1].x = baseX;
    pts[n - 1].z = baseZ;

    // Precompute per-segment geometry: midpoint, length, and quaternion alignment.
    // CylinderGeometry is oriented along +Y by default, so we rotate +Y onto the
    // segment direction using setFromUnitVectors — this is the only reliable way to
    // orient cylinders for arbitrary 3D directions (Euler decomposition causes misalignment).
    const yAxis = new Vector3(0, 1, 0);
    return pts.slice(0, -1).map((p, i) => {
      const q = pts[i + 1];
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      const dz = q.z - p.z;
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
      const dir = new Vector3(dx / len, dy / len, dz / len);
      const quat = new Quaternion().setFromUnitVectors(yAxis, dir);
      return {
        mid: [(p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2] as [number, number, number],
        len,
        quat,
      };
    });
  }, [position.x, position.y, position.z]);

  const matCore = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#e0f2fe',
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const matGlow = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.72,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );
  const matHalo = useMemo(
    () =>
      new MeshBasicMaterial({
        color: '#7dd3fc',
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const cyl = useMemo(() => new CylinderGeometry(0.09, 0.14, 1, 8), []);

  useFrame(() => {
    if (startRef.current === null) startRef.current = performance.now();
    const elapsed = performance.now() - startRef.current;
    const k = Math.min(1, elapsed / DURATION_MS);
    const fade = 1 - k;
    const peak = 1 - Math.pow(2 * k - 1, 2) * 0.25;
    matCore.opacity = Math.min(1, 0.98 * fade * peak);
    matGlow.opacity = 0.72 * fade * peak;
    matHalo.opacity = 0.35 * fade;
    if (k >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group>
      <pointLight position={[position.x, position.y + 3.5, position.z]} color="#bae6fd" intensity={48} distance={22} decay={1.8} />
      <pointLight position={[position.x, position.y + 0.4, position.z]} color="#38bdf8" intensity={36} distance={14} decay={2} />
      {segments.map(({ mid, len, quat }, i) => (
        <group key={i} position={mid} quaternion={quat}>
          <mesh geometry={cyl} material={matHalo} scale={[2.1, len, 2.1]} />
          <mesh geometry={cyl} material={matGlow} scale={[1.65, len, 1.65]} />
          <mesh geometry={cyl} material={matCore} scale={[1.05, len, 1.05]} />
        </group>
      ))}
    </group>
  );
}
