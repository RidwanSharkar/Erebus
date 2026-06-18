'use client';

import { useRef, useMemo } from 'react';
import { Vector3, Quaternion, AdditiveBlending, CylinderGeometry, MeshBasicMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const DEFAULT_DURATION_MS = 620;
const SEGMENT_COUNT = 20;

export interface DirectionalProcLightningPalette {
  core: string;
  glow: string;
  halo: string;
  light: string;
}

export interface DirectionalProcLightningProps {
  from: Vector3;
  to: Vector3;
  palette: DirectionalProcLightningPalette;
  durationMs?: number;
  onComplete?: () => void;
}

const _yAxis = new Vector3(0, 1, 0);
const _dir = new Vector3();
const _perp1 = new Vector3();
const _perp2 = new Vector3();

function buildBoltSegments(from: Vector3, to: Vector3) {
  const n = SEGMENT_COUNT;
  const pts: { x: number; y: number; z: number }[] = [];

  _dir.copy(to).sub(from);
  _dir.divideScalar(_dir.length() || 0.001);

  _perp1.crossVectors(_dir, _yAxis);
  if (_perp1.lengthSq() < 1e-6) {
    _perp1.set(1, 0, 0);
  } else {
    _perp1.normalize();
  }
  _perp2.crossVectors(_dir, _perp1).normalize();

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const spread = 1.1 * Math.sin(t * Math.PI) + 0.35;
    const baseX = from.x + (to.x - from.x) * t;
    const baseY = from.y + (to.y - from.y) * t;
    const baseZ = from.z + (to.z - from.z) * t;
    const j1 = (Math.random() - 0.5) * spread * 2;
    const j2 = (Math.random() - 0.5) * spread;
    pts.push({
      x: baseX + _perp1.x * j1 + _perp2.x * j2,
      y: baseY + _perp1.y * j1 + _perp2.y * j2,
      z: baseZ + _perp1.z * j1 + _perp2.z * j2,
    });
  }

  pts[0] = { x: from.x, y: from.y, z: from.z };
  pts[n - 1] = { x: to.x, y: to.y, z: to.z };

  return pts.slice(0, -1).map((p, i) => {
    const q = pts[i + 1];
    const dx = q.x - p.x;
    const dy = q.y - p.y;
    const dz = q.z - p.z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001;
    _dir.set(dx / len, dy / len, dz / len);
    const quat = new Quaternion().setFromUnitVectors(_yAxis, _dir);
    return {
      mid: [(p.x + q.x) / 2, (p.y + q.y) / 2, (p.z + q.z) / 2] as [number, number, number],
      len,
      quat,
    };
  });
}

export default function DirectionalProcLightning({
  from,
  to,
  palette,
  durationMs = DEFAULT_DURATION_MS,
  onComplete,
}: DirectionalProcLightningProps) {
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const boltLight = useDynamicLight({ color: palette.light, distance: 22, decay: 1.8, priority: 1 });

  const segments = useMemo(
    () => buildBoltSegments(from, to),
    [from.x, from.y, from.z, to.x, to.y, to.z],
  );

  const matCore = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.core,
        transparent: true,
        opacity: 1,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [palette.core],
  );
  const matGlow = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.glow,
        transparent: true,
        opacity: 0.72,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [palette.glow],
  );
  const matHalo = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.halo,
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [palette.halo],
  );

  const cyl = useMemo(() => new CylinderGeometry(0.09, 0.14, 1, 8), []);

  useFrame(() => {
    if (startRef.current === null) startRef.current = performance.now();
    const elapsed = performance.now() - startRef.current;
    const k = Math.min(1, elapsed / durationMs);
    const fade = 1 - k;
    const peak = 1 - Math.pow(2 * k - 1, 2) * 0.25;
    matCore.opacity = Math.min(1, 0.98 * fade * peak);
    matGlow.opacity = 0.72 * fade * peak;
    matHalo.opacity = 0.35 * fade;
    boltLight.current?.setPosition(to.x, to.y, to.z);
    boltLight.current?.setIntensity(48 * fade * peak);
    if (k >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete?.();
    }
  });

  return (
    <group>
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
