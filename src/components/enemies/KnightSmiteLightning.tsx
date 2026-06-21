'use client';

import { useRef, useMemo } from 'react';
import { Vector3, AdditiveBlending, CylinderGeometry, MeshBasicMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const DURATION_MS = 450;
const SKY_Y = 22;

export type KnightSmiteLightningVariant =
  | 'enemy-red'
  | 'enemy-blue'
  | 'enemy-green'
  | 'enemy-purple'
  | 'ally-gold';

interface KnightSmiteLightningProps {
  position: Vector3;
  onComplete: () => void;
  variant?: KnightSmiteLightningVariant;
  /** Scales beam thickness; 1 = base radius (2.8). Post-Boss-2 smites use ~3.75/2.8. */
  widthScale?: number;
}

const PALETTES: Record<KnightSmiteLightningVariant, { core: string; glow: string; light: string }> = {
  'enemy-red': { core: '#fca5a5', glow: '#ef4444', light: '#f97316' },
  'enemy-blue': { core: '#44aaff', glow: '#2266dd', light: '#3399ff' },
  'enemy-green': { core: '#00ff88', glow: '#00cc55', light: '#00ff66' },
  'enemy-purple': { core: '#cc44ff', glow: '#8811cc', light: '#bb33ff' },
  'ally-gold': { core: '#fff7ad', glow: '#facc15', light: '#f59e0b' },
};

/** Sky-to-ground strike for knight smites — soul-themed for enemies, gold for allied knight. */
export default function KnightSmiteLightning({
  position,
  onComplete,
  variant = 'enemy-red',
  widthScale = 1,
}: KnightSmiteLightningProps) {
  const startRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const palette = PALETTES[variant];
  const beamScale = Math.max(0.5, widthScale);

  const strikeLight = useDynamicLight({ color: palette.light, distance: 16, decay: 2, priority: 1 });

  const segments = useMemo(() => {
    const baseX = position.x;
    const baseY = position.y;
    const baseZ = position.z;
    const n = 14;
    const pts: { x: number; y: number; z: number; h: number }[] = [];
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const jitter = (1 - t) * 0.35 * beamScale;
      pts.push({
        x: baseX + (Math.random() - 0.5) * jitter,
        y: baseY + SKY_Y * (1 - t),
        z: baseZ + (Math.random() - 0.5) * jitter,
        h: (0.12 + (1 - t) * 0.08) * beamScale,
      });
    }
    return pts;
  }, [position.x, position.y, position.z, beamScale]);

  const matCore = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.core,
        transparent: true,
        opacity: 0.95,
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
        opacity: 0.55,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [palette.glow],
  );

  const cyl = useMemo(() => new CylinderGeometry(0.085 * beamScale, 0.085 * beamScale, 1, 6), [beamScale]);

  useFrame(() => {
    if (startRef.current === null) startRef.current = performance.now();
    const elapsed = performance.now() - startRef.current;
    const k = Math.min(1, elapsed / DURATION_MS);
    const fade = 1 - k;
    matCore.opacity = 0.95 * fade;
    matGlow.opacity = 0.55 * fade;
    strikeLight.current?.setPosition(position.x, position.y + 2, position.z);
    strikeLight.current?.setIntensity(22);
    if (k >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group>
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
