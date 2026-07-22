'use client';

import { useRef, useMemo, useEffect } from 'react';
import {
  Color,
  AdditiveBlending,
  RingGeometry,
  SphereGeometry,
  OctahedronGeometry,
  MeshBasicMaterial,
  Mesh,
  Vector3,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface KnightDeathVortexProps {
  id: string;
  position: { x: number; y: number; z: number };
  soulType?: string | null;
  onComplete: () => void;
}

interface DeathBurstPalette {
  core: string;
  glow: string;
  light: string;
}

const DURATION = 0.58;
const EMBER_COUNT = 8;

function getPalette(soulType?: string | null): DeathBurstPalette {
  switch (soulType) {
    case 'red':
      return { core: '#fca5a5', glow: '#ef4444', light: '#f97316' };
    case 'blue':
      return { core: '#44aaff', glow: '#2266dd', light: '#3399ff' };
    case 'green':
      return { core: '#00ff88', glow: '#00cc55', light: '#00ff66' };
    case 'purple':
      return { core: '#cc44ff', glow: '#8811cc', light: '#bb33ff' };
    case 'orange':
      return { core: '#ffb347', glow: '#ff6b00', light: '#ff8c42' };
    case 'yellow':
      return { core: '#ffe066', glow: '#facc15', light: '#fbbf24' };
    default:
      return { core: '#ffd978', glow: '#e6a800', light: '#f59e0b' };
  }
}

/** Radial soul burst when an enemy dies — wide outward explosion themed by soul color. */
export default function KnightDeathVortex({ position, soulType, onComplete }: KnightDeathVortexProps) {
  const palette = getPalette(soulType);
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const ring1Ref = useRef<Mesh>(null);
  const ring2Ref = useRef<Mesh>(null);
  const coreRef = useRef<Mesh>(null);
  const emberRefs = useRef<(Mesh | null)[]>([]);

  const baseY = position.y + 0.15;
  const deathLight = useDynamicLight({ color: palette.light, distance: 14, decay: 2, priority: 1 });

  const ring1Geo = useMemo(() => new RingGeometry(0.08, 0.38, 32), []);
  const ring2Geo = useMemo(() => new RingGeometry(0.12, 0.28, 24), []);
  const coreGeo = useMemo(() => new SphereGeometry(0.32, 10, 10), []);
  const emberGeo = useMemo(() => new OctahedronGeometry(0.12, 0), []);

  const ring1Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.glow,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [palette.glow],
  );

  const ring2Mat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.core,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [palette.core],
  );

  const coreMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.core,
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [palette.core],
  );

  const emberMats = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, (_, i) =>
        new MeshBasicMaterial({
          color: i % 2 === 0 ? palette.core : palette.glow,
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [palette.core, palette.glow],
  );

  const emberDirs = useMemo(() => {
    const dirs: Vector3[] = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      const angle = (i / EMBER_COUNT) * Math.PI * 2 + 0.3;
      dirs.push(new Vector3(Math.sin(angle), 0.15 + (i % 3) * 0.08, Math.cos(angle)).normalize());
    }
    return dirs;
  }, []);

  useEffect(() => {
    return () => {
      ring1Geo.dispose();
      ring2Geo.dispose();
      coreGeo.dispose();
      emberGeo.dispose();
      ring1Mat.dispose();
      ring2Mat.dispose();
      coreMat.dispose();
      emberMats.forEach((m) => m.dispose());
    };
  }, [ring1Geo, ring2Geo, coreGeo, emberGeo, ring1Mat, ring2Mat, coreMat, emberMats]);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;
    const p = Math.min(1, t / DURATION);

    const burstOut = 1 - Math.pow(1 - Math.min(p / 0.35, 1), 3);
    const fade = p < 0.18 ? p / 0.18 : Math.max(0, 1 - (p - 0.18) / (1 - 0.18));

    if (ring1Ref.current) {
      const scale = 0.25 + burstOut * 3.6;
      ring1Ref.current.scale.set(scale, scale, 1);
      ring1Mat.opacity = fade * 0.72 * (0.4 + burstOut * 0.6);
    }

    if (ring2Ref.current) {
      const scale = 0.2 + burstOut * 4.4;
      ring2Ref.current.rotation.z = p * Math.PI * 0.35;
      ring2Ref.current.scale.set(scale, scale, 1);
      ring2Mat.opacity = fade * 0.58 * (0.35 + burstOut * 0.65);
    }

    if (coreRef.current) {
      const coreScale = p < 0.12 ? 0.3 + (p / 0.12) * 1.1 : Math.max(0.05, 1.4 - (p - 0.12) * 1.8);
      coreRef.current.scale.setScalar(coreScale);
      coreMat.opacity = fade * 0.85;
    }

    emberRefs.current.forEach((ember, i) => {
      if (!ember) return;
      const dir = emberDirs[i];
      const dist = burstOut * (1.8 + (i % 3) * 0.4);
      ember.position.set(dir.x * dist, dir.y * dist * 0.6 + 0.1, dir.z * dist);
      ember.rotation.set(p * 4 + i, p * 3, p * 2);
      const emberFade = p < 0.1 ? p / 0.1 : Math.max(0, 1 - (p - 0.15) / 0.55);
      emberMats[i].opacity = emberFade * 0.7;
    });

    deathLight.current?.setPosition(position.x, baseY + 0.25, position.z);
    deathLight.current?.setIntensity(12 * fade * (0.5 + burstOut * 0.5));

    if (p >= 1) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group position={[position.x, baseY, position.z]}>
      <mesh
        ref={ring1Ref}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        geometry={ring1Geo}
        material={ring1Mat}
      />
      <mesh
        ref={ring2Ref}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.06, 0]}
        geometry={ring2Geo}
        material={ring2Mat}
      />
      <mesh ref={coreRef} geometry={coreGeo} material={coreMat} />
      {emberMats.map((mat, i) => (
        <mesh
          key={i}
          ref={(el) => { emberRefs.current[i] = el; }}
          geometry={emberGeo}
          material={mat}
        />
      ))}
    </group>
  );
}
