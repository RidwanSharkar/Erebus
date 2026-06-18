'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Mesh,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
  DodecahedronGeometry,
} from 'three';

export type LeapShockwaveVariant = 'boss' | 'ghoul' | 'templar';

interface BossLeapShockwaveProps {
  x: number;
  z: number;
  variant?: LeapShockwaveVariant;
  onComplete: () => void;
}

const DURATION = 1.8; // seconds
const RING_COUNT = 4;
/** Sits just above throne stone tiles to avoid z-fighting with the slab mesh. */
const GROUND_Y = 0.1;

// Staggered ring parameters: [startDelay, maxRadius, thickness, baseOpacity]
const BASE_RING_PARAMS: [number, number, number, number][] = [
  [0.0, 6.5, 0.28, 0.85],
  [0.07, 5.2, 0.18, 0.72],
  [0.15, 7.8, 0.12, 0.52],
  [0.25, 4.0, 0.22, 0.58],
];

type ShockwaveVariantConfig = {
  scale: number;
  debrisCount: number;
  ringColors: [string, string];
  debrisColors: [string, string, string];
  flashColor: string;
};

const SHOCKWAVE_VARIANTS: Record<LeapShockwaveVariant, ShockwaveVariantConfig> = {
  boss: {
    scale: 1.0,
    debrisCount: 16,
    ringColors: ['#7a6552', '#5c4a3a'],
    debrisColors: ['#6b5344', '#4a3b30', '#8b6f52'],
    flashColor: '#5a4636',
  },
  ghoul: {
    scale: 0.75,
    debrisCount: 16,
    ringColors: ['#3d8c4a', '#2d6b38'],
    debrisColors: ['#3d8c4a', '#2d6b38', '#5cb86a'],
    flashColor: '#4caf60',
  },
  templar: {
    scale: 0.55,
    debrisCount: 12,
    ringColors: ['#8b2a2a', '#6b1f1f'],
    debrisColors: ['#8b2a2a', '#6b1f1f', '#c43c3c'],
    flashColor: '#e04040',
  },
};

type DebrisParams = {
  angle: number;
  speed: number;
  delay: number;
  yOff: number;
  tumbleAx: number;
  tumbleAy: number;
  tumbleAz: number;
  size: number;
  shape: 'dodeca' | 'boxShard';
};

function buildDebrisParams(count: number, scale: number): DebrisParams[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
    const speed = (5.2 + Math.random() * 3.8) * scale;
    const delay = Math.random() * 0.12;
    const yOff = Math.random() * 0.22 * scale;
    const tumbleAx = 1.8 + Math.random() * 2.4;
    const tumbleAy = 1.2 + Math.random() * 2.0;
    const tumbleAz = 1.5 + Math.random() * 2.2;
    const size = (0.11 + Math.random() * 0.16) * scale;
    const shape: 'dodeca' | 'boxShard' = Math.random() < 0.62 ? 'dodeca' : 'boxShard';
    return { angle, speed, delay, yOff, tumbleAx, tumbleAy, tumbleAz, size, shape };
  });
}

export default function BossLeapShockwave({
  x,
  z,
  variant = 'boss',
  onComplete,
}: BossLeapShockwaveProps) {
  const config = SHOCKWAVE_VARIANTS[variant];
  const scale = config.scale;
  const debrisCount = config.debrisCount;

  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const ringRefs = useRef<(Mesh | null)[]>(Array(RING_COUNT).fill(null));
  const debrisRefs = useRef<(Group | null)[]>([]);
  const flashRef = useRef<Mesh | null>(null);

  /** Pin world anchor once — never follow moving enemies after impact. */
  const anchorPosition = useMemo(() => [x, GROUND_Y, z] as [number, number, number], [x, z]);

  const ringParams = useMemo(
    () =>
      BASE_RING_PARAMS.map(([delay, maxR, thickness, opacity]) => [
        delay,
        maxR * scale,
        thickness * scale,
        opacity,
      ] as [number, number, number, number]),
    [scale],
  );

  const dodecaGeo = useMemo(() => new DodecahedronGeometry(1, 0), []);

  const debrisParams = useMemo(
    () => buildDebrisParams(debrisCount, scale),
    [debrisCount, scale],
  );

  useEffect(() => {
    debrisRefs.current = Array(debrisCount).fill(null);
  }, [debrisCount]);

  useEffect(
    () => () => {
      dodecaGeo.dispose();
    },
    [dodecaGeo],
  );

  const ringMats = useMemo(
    () =>
      Array.from({ length: RING_COUNT }, (_, i) =>
        new MeshBasicMaterial({
          color: new Color(config.ringColors[i % 2]),
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          side: 2,
        }),
      ),
    [config.ringColors],
  );

  const debrisMats = useMemo(
    () =>
      Array.from({ length: debrisCount }, (_, i) =>
        new MeshBasicMaterial({
          color: new Color(config.debrisColors[i % 3]),
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [config.debrisColors, debrisCount],
  );

  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(config.flashColor),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [config.flashColor],
  );

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;

    if (t >= DURATION) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const globalFade =
      t > DURATION * 0.6 ? 1 - (t - DURATION * 0.6) / (DURATION * 0.4) : 1.0;

    if (flashRef.current) {
      const flashT = Math.min(t / 0.25, 1.0);
      const flashFade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.8;
      const flashScale = flashT * 6.5 * scale;
      flashRef.current.scale.set(flashScale, flashScale, 1);
      flashMat.opacity = Math.max(0, flashFade * 0.48);
    }

    for (let i = 0; i < RING_COUNT; i++) {
      const mesh = ringRefs.current[i];
      const mat = ringMats[i];
      if (!mesh) continue;
      const [delay, maxR, , baseOpacity] = ringParams[i];
      const localT = t - delay;
      if (localT <= 0) {
        mat.opacity = 0;
        continue;
      }
      const progress = Math.min(localT / (DURATION * 0.75), 1.0);
      const radius = progress * maxR;
      mesh.scale.set(radius, radius, 1);
      const burstFade = localT < 0.12 ? localT / 0.12 : 1.0;
      mat.opacity = Math.max(0, baseOpacity * burstFade * globalFade * (1 - progress * 0.55));
    }

    for (let i = 0; i < debrisCount; i++) {
      const g = debrisRefs.current[i];
      const mat = debrisMats[i];
      if (!g) continue;
      const { angle, speed, delay, yOff, tumbleAx, tumbleAy, tumbleAz, size, shape } = debrisParams[i];
      const localT = t - delay;
      if (localT <= 0) {
        mat.opacity = 0;
        continue;
      }
      const dist = localT * speed;
      g.position.set(Math.sin(angle) * dist, yOff + localT * 0.85 * scale, Math.cos(angle) * dist);
      const sx = size * (0.55 + localT * 0.95);
      const sy = size * (0.4 + localT * 0.75) * (shape === 'boxShard' ? 1.15 : 0.95);
      const sz = size * (0.5 + localT * 0.9);
      g.scale.set(sx, sy, sz);
      g.rotation.x += delta * tumbleAx;
      g.rotation.y += delta * tumbleAy;
      g.rotation.z += delta * tumbleAz;
      const localFade =
        localT < 0.14
          ? localT / 0.14
          : Math.max(0, 1 - (localT - 0.14) / (DURATION - 0.14));
      mat.opacity = Math.max(0, 0.68 * localFade * globalFade);
    }
  });

  return (
    <group ref={groupRef} position={anchorPosition}>
      <mesh ref={flashRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1, 32]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      {ringParams.map(([, , thickness], i) => (
        <mesh key={i} ref={(el) => { ringRefs.current[i] = el; }} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1, thickness, 6, 48]} />
          <primitive object={ringMats[i]} attach="material" />
        </mesh>
      ))}

      {debrisParams.map((p, i) => (
        <group key={i} ref={(el) => { debrisRefs.current[i] = el; }}>
          {p.shape === 'dodeca' ? (
            <mesh geometry={dodecaGeo}>
              <primitive object={debrisMats[i]} attach="material" />
            </mesh>
          ) : (
            <mesh geometry={dodecaGeo} rotation={[0.35, 0.62, -0.28]} scale={[1.15, 0.42, 0.78]}>
              <primitive object={debrisMats[i]} attach="material" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}
