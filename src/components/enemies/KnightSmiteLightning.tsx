'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Vector3, AdditiveBlending, CylinderGeometry, MeshBasicMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const DURATION_MS = 450;
const SKY_Y = 22;
const BEAM_RADIUS = 0.11;
const GLOW_RADIUS_SCALE = 1.5;

export type KnightSmiteLightningVariant =
  | 'enemy-red'
  | 'enemy-blue'
  | 'enemy-green'
  | 'enemy-purple'
  | 'ally-gold'
  | 'titans-grip';

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
  'titans-grip': { core: '#ff8888', glow: '#B51010', light: '#EE6666' },
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

  const cyl = useMemo(
    () => new CylinderGeometry(BEAM_RADIUS * beamScale, BEAM_RADIUS * beamScale, 1, 6),
    [beamScale],
  );

  useEffect(() => {
    return () => {
      matCore.dispose();
      matGlow.dispose();
      cyl.dispose();
    };
  }, [matCore, matGlow, cyl]);

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
    <group position={[position.x, position.y + SKY_Y / 2, position.z]}>
      <mesh geometry={cyl} material={matGlow} scale={[GLOW_RADIUS_SCALE, SKY_Y, GLOW_RADIUS_SCALE]} />
      <mesh geometry={cyl} material={matCore} scale={[1, SKY_Y, 1]} />
    </group>
  );
}
