'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MeshBasicMaterial,
  NormalBlending,
  Vector3,
} from 'three';
import type { MeleeWeightClass } from '@/components/enemies/EnemyMeleeAttackRangeRing';

interface MeleeContactGashProps {
  /** Player world position at the moment of impact. */
  position: Vector3;
  /** Normalized impact direction (attacker → player). */
  direction: Vector3;
  onComplete: () => void;
  weightClass?: MeleeWeightClass;
  scale?: number;
}

type GashSilhouette = {
  count: number;
  length: number;
  halfWidth: number;
  spacing: number;
  fan: number;
  duration: number;
  core: string;
  rim: string;
  showDust: boolean;
  showCrack: boolean;
};

const SILHOUETTE: Record<MeleeWeightClass, GashSilhouette> = {
  beast: {
    count: 3,
    length: 0.55,
    halfWidth: 0.028,
    spacing: 0.09,
    fan: 0.12,
    duration: 0.26,
    core: '#5a1010',
    rim: '#c94a3a',
    showDust: false,
    showCrack: false,
  },
  'large-beast': {
    count: 3,
    length: 0.72,
    halfWidth: 0.045,
    spacing: 0.12,
    fan: 0.16,
    duration: 0.32,
    core: '#4a0c0c',
    rim: '#e83a2a',
    showDust: false,
    showCrack: false,
  },
  humanoid: {
    count: 1,
    length: 0.6,
    halfWidth: 0.032,
    spacing: 0,
    fan: 0,
    duration: 0.28,
    core: '#3a1218',
    rim: '#a8b0bc',
    showDust: false,
    showCrack: false,
  },
  giant: {
    count: 1,
    length: 0.85,
    halfWidth: 0.09,
    spacing: 0,
    fan: 0,
    duration: 0.38,
    core: '#2a1010',
    rim: '#c94a3a',
    showDust: true,
    showCrack: true,
  },
};

/** Tapered vertical ribbon in local XY: thick at y=0, pointed at y=length. Faces +Z. */
function buildRibbonGeometry(length: number, halfWidth: number): BufferGeometry {
  const geo = new BufferGeometry();
  const tipW = halfWidth * 0.12;
  const positions = new Float32Array([
    -halfWidth, 0, 0,
     halfWidth, 0, 0,
    -tipW, length, 0,
     tipW, length, 0,
  ]);
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  return geo;
}

function buildCrackGeometry(length: number): BufferGeometry {
  const geo = new BufferGeometry();
  const hw = 0.018;
  // Ground crack in XZ extending along +Z.
  const positions = new Float32Array([
    -hw, 0, 0,
     hw, 0, 0,
    -hw * 0.4, 0, length * 0.55,
     hw * 0.4, 0, length * 0.55,
    -hw * 0.15, 0, length,
     hw * 0.15, 0, length,
  ]);
  geo.setAttribute('position', new BufferAttribute(positions, 3));
  geo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]);
  return geo;
}

/**
 * Subtle contact-point gash on the side the blow came from.
 * Anchored between player and attacker — not a giant player-centered slash.
 */
export default function MeleeContactGash({
  position,
  direction,
  onComplete,
  weightClass = 'humanoid',
  scale = 1,
}: MeleeContactGashProps) {
  const sil = SILHOUETTE[weightClass] ?? SILHOUETTE.humanoid;
  const timeRef = useRef(0);
  const doneRef = useRef(false);
  const groupRef = useRef<any>(null);
  const coreMatsRef = useRef<MeshBasicMaterial[]>([]);
  const rimMatsRef = useRef<MeshBasicMaterial[]>([]);
  const dustMatRef = useRef<MeshBasicMaterial | null>(null);
  const crackMatRef = useRef<MeshBasicMaterial | null>(null);
  const scuffMatRef = useRef<MeshBasicMaterial | null>(null);

  const yaw = useMemo(
    () => Math.atan2(direction.x, direction.z),
    [direction.x, direction.z],
  );

  const origin = useMemo(() => {
    const dir = new Vector3(direction.x, 0, direction.z);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
    else dir.normalize();
    return new Vector3(
      position.x - dir.x * 0.45,
      position.y + 0.95 * scale,
      position.z - dir.z * 0.45,
    );
  }, [position.x, position.y, position.z, direction.x, direction.z, scale]);

  const ribbonGeo = useMemo(
    () => buildRibbonGeometry(sil.length * scale, sil.halfWidth * scale),
    [sil.length, sil.halfWidth, scale],
  );
  const crackGeo = useMemo(
    () => (sil.showCrack ? buildCrackGeometry(sil.length * 0.7 * scale) : null),
    [sil.showCrack, sil.length, scale],
  );

  const rakeOffsets = useMemo(() => {
    const offsets: { x: number; yaw: number }[] = [];
    if (sil.count === 1) {
      offsets.push({ x: 0, yaw: 0 });
    } else {
      const mid = (sil.count - 1) / 2;
      for (let i = 0; i < sil.count; i++) {
        const t = i - mid;
        offsets.push({
          x: t * sil.spacing * scale,
          yaw: t * sil.fan,
        });
      }
    }
    return offsets;
  }, [sil.count, sil.spacing, sil.fan, scale]);

  const coreMats = useMemo(() => {
    const mats: MeshBasicMaterial[] = [];
    for (let i = 0; i < sil.count; i++) {
      mats.push(
        new MeshBasicMaterial({
          color: new Color(sil.core),
          transparent: true,
          opacity: 0,
          blending: NormalBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
    }
    return mats;
  }, [sil.count, sil.core]);

  const rimMats = useMemo(() => {
    const mats: MeshBasicMaterial[] = [];
    for (let i = 0; i < sil.count; i++) {
      mats.push(
        new MeshBasicMaterial({
          color: new Color(sil.rim),
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
    }
    return mats;
  }, [sil.count, sil.rim]);

  const dustMat = useMemo(() => {
    if (!sil.showDust) return null;
    return new MeshBasicMaterial({
      color: new Color('#8a7060'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    });
  }, [sil.showDust]);

  const crackMat = useMemo(() => {
    if (!sil.showCrack) return null;
    return new MeshBasicMaterial({
      color: new Color('#1a0808'),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: DoubleSide,
    });
  }, [sil.showCrack]);

  const scuffMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: new Color(sil.core),
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        side: DoubleSide,
      }),
    [sil.core],
  );

  useEffect(() => {
    coreMatsRef.current = coreMats;
    rimMatsRef.current = rimMats;
    dustMatRef.current = dustMat;
    crackMatRef.current = crackMat;
    scuffMatRef.current = scuffMat;
  }, [coreMats, rimMats, dustMat, crackMat, scuffMat]);

  useEffect(() => {
    return () => {
      ribbonGeo.dispose();
      crackGeo?.dispose();
      for (const m of coreMats) m.dispose();
      for (const m of rimMats) m.dispose();
      dustMat?.dispose();
      crackMat?.dispose();
      scuffMat.dispose();
    };
  }, [ribbonGeo, crackGeo, coreMats, rimMats, dustMat, crackMat, scuffMat]);

  useFrame((_, delta) => {
    if (doneRef.current) return;
    timeRef.current += delta;
    const t = timeRef.current;
    const dur = sil.duration;

    if (t >= dur) {
      doneRef.current = true;
      onComplete();
      return;
    }

    const openT = Math.min(1, t / 0.09);
    const fadeStart = dur * 0.45;
    const fadeT = t < fadeStart ? 0 : Math.min(1, (t - fadeStart) / (dur - fadeStart));
    const coreOpacity = 0.55 * openT * (1 - fadeT);
    const rimLife = Math.max(0, 1 - t / 0.06);
    const rimOpacity = 0.45 * rimLife;
    const drift = fadeT * 0.18 * scale;

    if (groupRef.current) {
      groupRef.current.position.x = origin.x + Math.sin(yaw) * drift;
      groupRef.current.position.y = origin.y;
      groupRef.current.position.z = origin.z + Math.cos(yaw) * drift;
      // Open along the cut length (local Y for vertical ribbons).
      const openScale = 0.35 + openT * 0.65;
      groupRef.current.scale.set(1, openScale, 1);
    }

    for (const m of coreMatsRef.current) {
      m.opacity = Math.max(0, coreOpacity);
    }
    for (const m of rimMatsRef.current) {
      m.opacity = Math.max(0, rimOpacity);
    }
    if (scuffMatRef.current) {
      scuffMatRef.current.opacity = Math.max(0, 0.25 * openT * (1 - fadeT));
    }
    if (dustMatRef.current) {
      const dustFade = t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.08) / (dur - 0.08));
      dustMatRef.current.opacity = Math.max(0, dustFade * 0.35);
    }
    if (crackMatRef.current) {
      crackMatRef.current.opacity = Math.max(0, coreOpacity * 0.7);
    }
  });

  return (
    <group ref={groupRef} position={[origin.x, origin.y, origin.z]} rotation={[0, yaw, 0]}>
      {rakeOffsets.map((off, i) => (
        <group key={i} position={[off.x, -sil.length * 0.45 * scale, 0]} rotation={[0, 0, off.yaw]}>
          <mesh geometry={ribbonGeo} renderOrder={6}>
            <primitive object={coreMats[i]} attach="material" />
          </mesh>
          <mesh geometry={ribbonGeo} position={[0, 0, 0.01]} scale={[1.15, 1.02, 1]} renderOrder={7}>
            <primitive object={rimMats[i]} attach="material" />
          </mesh>
        </group>
      ))}

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.85 * scale, 0.05]}
        renderOrder={5}
      >
        <circleGeometry args={[0.12 * scale, 12]} />
        <primitive object={scuffMat} attach="material" />
      </mesh>

      {dustMat && (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.8 * scale, 0.08]}
          renderOrder={5}
        >
          <circleGeometry args={[0.28 * scale, 16]} />
          <primitive object={dustMat} attach="material" />
        </mesh>
      )}

      {crackMat && crackGeo && (
        <mesh geometry={crackGeo} position={[0, -0.88 * scale, 0]} renderOrder={5}>
          <primitive object={crackMat} attach="material" />
        </mesh>
      )}
    </group>
  );
}
