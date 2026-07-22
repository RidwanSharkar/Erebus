'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Mesh,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  BufferGeometry,
  BufferAttribute,
} from 'three';

export interface CrescentSlashPalette {
  core: string;
  edge: string;
  flash: string;
  ring: string;
}

interface CrescentSlashEffectProps {
  position: Vector3;
  /** Normalized facing direction of the player at cast time. */
  direction: Vector3;
  onComplete: () => void;
  /** Uniform size multiplier — defaults to 1. */
  scale?: number;
  /** Optional color overrides for themed variants. */
  palette?: Partial<CrescentSlashPalette>;
}

const DURATION = 0.35;

const DEFAULT_PALETTE: CrescentSlashPalette = {
  core: '#ffe4a0',
  edge: '#ff6a5c',
  flash: '#ffffff',
  ring: '#ffe8c0',
};

/** Build a flat arc-sector geometry in XZ plane centered on +Z, spanning `span` radians. */
function buildArcSectorGeometry(
  innerRadius: number,
  outerRadius: number,
  spanRadians: number,
  segments: number,
): BufferGeometry {
  const geo = new BufferGeometry();
  const half = spanRadians / 2;
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const angle = -half + (i / segments) * spanRadians;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    positions.push(sin * innerRadius, 0, cos * innerRadius);
    positions.push(sin * outerRadius, 0, cos * outerRadius);
  }

  for (let i = 0; i < segments; i++) {
    const base = i * 2;
    indices.push(base, base + 1, base + 2);
    indices.push(base + 1, base + 3, base + 2);
  }

  geo.setAttribute('position', new BufferAttribute(new Float32Array(positions), 3));
  geo.setIndex(indices);
  return geo;
}

/** Two swept blade planes radiating left/right from center for afterglow. */
function buildWingSweepGeometry(width: number, length: number): BufferGeometry {
  const geo = new BufferGeometry();
  const positions = new Float32Array([
    -width * 0.15,  0,  0,
     width * 0.15,  0,  0,
    -width * 0.5,   0,  length,
     width * 0.5,   0,  length,
  ]);
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  return geo;
}

export default function CrescentSlashEffect({
  position,
  direction,
  onComplete,
  scale = 1,
  palette: paletteOverride,
}: CrescentSlashEffectProps) {
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const arcRef       = useRef<Mesh | null>(null);
  const arcInnerRef  = useRef<Mesh | null>(null);
  const leftWingRef  = useRef<Mesh | null>(null);
  const rightWingRef = useRef<Mesh | null>(null);
  const flashRef     = useRef<Mesh | null>(null);
  const ringRef      = useRef<Mesh | null>(null);

  const colors = useMemo(
    () => ({
      core: new Color(paletteOverride?.core ?? DEFAULT_PALETTE.core),
      edge: new Color(paletteOverride?.edge ?? DEFAULT_PALETTE.edge),
      flash: new Color(paletteOverride?.flash ?? DEFAULT_PALETTE.flash),
      ring: new Color(paletteOverride?.ring ?? DEFAULT_PALETTE.ring),
    }),
    [paletteOverride?.core, paletteOverride?.edge, paletteOverride?.flash, paletteOverride?.ring],
  );

  const yaw = useMemo(
    () => Math.atan2(direction.x, direction.z),
    [direction.x, direction.z],
  );

  const arcGeo      = useMemo(() => buildArcSectorGeometry(0.6 * scale, 4.0 * scale, Math.PI * 0.7, 24), [scale]);
  const arcInnerGeo = useMemo(() => buildArcSectorGeometry(0.0, 0.8 * scale, Math.PI * 0.5, 16), [scale]);
  const wingGeo     = useMemo(() => buildWingSweepGeometry(1.4 * scale, 3.8 * scale), [scale]);

  const arcMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: colors.edge,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [colors.edge],
  );

  const arcInnerMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: colors.core,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [colors.core],
  );

  const wingMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: colors.core,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [colors.core],
  );

  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: colors.flash,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [colors.flash],
  );

  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: colors.ring,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [colors.ring],
  );

  useEffect(() => {
    return () => {
      arcGeo.dispose();
      arcInnerGeo.dispose();
      wingGeo.dispose();
      arcMat.dispose();
      arcInnerMat.dispose();
      wingMat.dispose();
      flashMat.dispose();
      ringMat.dispose();
    };
  }, [arcGeo, arcInnerGeo, wingGeo, arcMat, arcInnerMat, wingMat, flashMat, ringMat]);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    if (t >= DURATION) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const progress = t / DURATION;

    const arcScale = 0.3 + progress * 0.85;
    const arcFade  = t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.12) / (DURATION - 0.12));
    if (arcRef.current) {
      arcRef.current.scale.set(arcScale, 1, arcScale);
      arcMat.opacity = Math.max(0, arcFade * 0.72);
    }
    if (arcInnerRef.current) {
      arcInnerRef.current.scale.set(arcScale * 1.05, 1, arcScale * 1.05);
      arcInnerMat.opacity = Math.max(0, arcFade * 0.55);
    }

    const wingAngle = progress * Math.PI * 0.42;
    const wingFade  = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.18) / (DURATION - 0.18));
    if (leftWingRef.current) {
      leftWingRef.current.rotation.y = -wingAngle;
      wingMat.opacity = Math.max(0, wingFade * 0.6);
    }
    if (rightWingRef.current) {
      rightWingRef.current.rotation.y = wingAngle;
    }

    const flashFade =
      t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / 0.14);
    if (flashRef.current) {
      const fs = 0.5 + t * 3.5;
      flashRef.current.scale.set(fs, fs, fs);
      flashMat.opacity = Math.max(0, flashFade * 0.65);
    }

    const ringScale = 0.25 + progress * 1.25;
    const ringFade  =
      t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - DURATION * 0.38) / (DURATION * 0.62));
    if (ringRef.current) {
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      ringMat.opacity = Math.max(0, ringFade * 0.5);
    }
  });

  const flashRadius = 0.55 * scale;
  const ringOuter = 1 * scale;
  const ringTube = 0.07 * scale;

  return (
    <group position={[position.x, position.y + 0.1 * scale, position.z]} rotation={[0, yaw, 0]}>
      <mesh ref={arcRef} geometry={arcGeo}>
        <primitive object={arcMat} attach="material" />
      </mesh>

      <mesh ref={arcInnerRef} geometry={arcInnerGeo}>
        <primitive object={arcInnerMat} attach="material" />
      </mesh>

      <mesh ref={leftWingRef} geometry={wingGeo}>
        <primitive object={wingMat} attach="material" />
      </mesh>

      <mesh ref={rightWingRef} geometry={wingGeo}>
        <primitive object={wingMat} attach="material" />
      </mesh>

      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 0.01]}>
        <circleGeometry args={[flashRadius, 16]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 0.01]}>
        <torusGeometry args={[ringOuter, ringTube, 6, 48]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
    </group>
  );
}
