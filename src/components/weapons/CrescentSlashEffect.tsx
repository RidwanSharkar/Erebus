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

interface CrescentSlashEffectProps {
  position: Vector3;
  /** Normalized facing direction of the player at cast time. */
  direction: Vector3;
  onComplete: () => void;
}

const DURATION = 0.35;

const COLOR_CORE  = new Color('#ffe4a0'); // warm gold
const COLOR_EDGE  = new Color('#ff6a5c'); // red accent (matches sabre palette)
const COLOR_FLASH = new Color('#ffffff'); // white center burst
const COLOR_RING  = new Color('#ffe8c0'); // outer ring glow

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
    // inner vertex
    positions.push(sin * innerRadius, 0, cos * innerRadius);
    // outer vertex
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
  // A tapered quad: narrow at root, wider at tip
  const positions = new Float32Array([
    -width * 0.15,  0,  0,         // root left
     width * 0.15,  0,  0,         // root right
    -width * 0.5,   0,  length,    // tip left
     width * 0.5,   0,  length,    // tip right
  ]);
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  return geo;
}

export default function CrescentSlashEffect({
  position,
  direction,
  onComplete,
}: CrescentSlashEffectProps) {
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const arcRef       = useRef<Mesh | null>(null);
  const arcInnerRef  = useRef<Mesh | null>(null);
  const leftWingRef  = useRef<Mesh | null>(null);
  const rightWingRef = useRef<Mesh | null>(null);
  const flashRef     = useRef<Mesh | null>(null);
  const ringRef      = useRef<Mesh | null>(null);

  // Yaw angle from direction so the arc faces where the player was looking
  const yaw = useMemo(
    () => Math.atan2(direction.x, direction.z),
    [direction.x, direction.z],
  );

  const arcGeo      = useMemo(() => buildArcSectorGeometry(0.6, 4.0, Math.PI * 0.7, 24), []);
  const arcInnerGeo = useMemo(() => buildArcSectorGeometry(0.0, 0.8, Math.PI * 0.5, 16), []);
  const wingGeo     = useMemo(() => buildWingSweepGeometry(1.4, 3.8), []);

  const arcMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_EDGE,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const arcInnerMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_CORE,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const wingMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_CORE,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_FLASH,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
  );

  const ringMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: COLOR_RING,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [],
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

    // --- Arc sweep: rushes outward then fades ---
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

    // --- Wings: spread outward from center during first half, then linger ---
    const wingAngle = progress * Math.PI * 0.42;
    const wingFade  = t < 0.1 ? t / 0.1 : Math.max(0, 1 - (t - 0.18) / (DURATION - 0.18));
    if (leftWingRef.current) {
      leftWingRef.current.rotation.y = -wingAngle;
      wingMat.opacity = Math.max(0, wingFade * 0.6);
    }
    if (rightWingRef.current) {
      rightWingRef.current.rotation.y = wingAngle;
    }

    // --- Center flash: brief bright burst at cast origin ---
    const flashFade =
      t < 0.05 ? t / 0.05 : Math.max(0, 1 - (t - 0.05) / 0.14);
    if (flashRef.current) {
      const fs = 0.5 + t * 3.5;
      flashRef.current.scale.set(fs, fs, fs);
      flashMat.opacity = Math.max(0, flashFade * 0.65);
    }

    // --- Outer expanding ring ---
    const ringScale = 0.25 + progress * 1.25;
    const ringFade  =
      t < 0.06 ? t / 0.06 : Math.max(0, 1 - (t - DURATION * 0.38) / (DURATION * 0.62));
    if (ringRef.current) {
      ringRef.current.scale.set(ringScale, ringScale, ringScale);
      ringMat.opacity = Math.max(0, ringFade * 0.5);
    }
  });

  return (
    <group position={[position.x, position.y + 0.1, position.z]} rotation={[0, yaw, 0]}>
      {/* Outer arc sector — gold/red sweep */}
      <mesh ref={arcRef} geometry={arcGeo}>
        <primitive object={arcMat} attach="material" />
      </mesh>

      {/* Inner arc fill — warm gold core */}
      <mesh ref={arcInnerRef} geometry={arcInnerGeo}>
        <primitive object={arcInnerMat} attach="material" />
      </mesh>

      {/* Left wing sweep */}
      <mesh ref={leftWingRef} geometry={wingGeo}>
        <primitive object={wingMat} attach="material" />
      </mesh>

      {/* Right wing sweep (shared geometry, mirrored rotation) */}
      <mesh ref={rightWingRef} geometry={wingGeo}>
        <primitive object={wingMat} attach="material" />
      </mesh>

      {/* Center flash disc */}
      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 0.01]}>
        <circleGeometry args={[0.55, 16]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      {/* Outer ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} scale={[0.01, 0.01, 0.01]}>
        <torusGeometry args={[1, 0.07, 6, 48]} />
        <primitive object={ringMat} attach="material" />
      </mesh>
    </group>
  );
}
