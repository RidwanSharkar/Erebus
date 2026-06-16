'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  MeshBasicMaterial,
  Color,
  AdditiveBlending,
} from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export interface WraithStrikeImpactTalentProps {
  /** Wrathful Strike — red (priority 1 vs other Wraith Strike row talents). */
  wrathfulStrike?: boolean;
  /** INFESTED STRIKE — green */
  infestedStrike?: boolean;
  /** Wraith Guard — purple */
  wraithGuard?: boolean;
  /** STAGGERING STRIKE — light blue */
  staggeringStrike?: boolean;
}

export interface RunebladeWraithStrikeImpactProps extends WraithStrikeImpactTalentProps {
  position: Vector3;
  /** Horizontal forward at impact (Y should be 0) — orients the crescent like LMB impacts. */
  direction: Vector3;
  onComplete: () => void;
}

const DURATION = 0.35;
const SPARK_COUNT = 1;

/** Mirrored from primary slash: combo step 2 / Wraith Strike; stronger euler Y = more left-above/right-below silhouette. */
const CRESCENT_ROTATION: [number, number, number] = [Math.PI / 2, 0.45, 0];
/** Burst disc banks with similar diagonal read (pair with crescent). */
const FLASH_ROTATION: [number, number, number] = [-Math.PI / 3, 0.14, 0.1];
/** Applied as third euler: crescentYaw + this offset vs RunebladeSlashImpact's crescentYaw alone. */
const CRESCENT_YAW_OFFSET = Math.PI;

type ImpactPaletteKey = 'default' | 'wrathful' | 'infested' | 'wraith_guard' | 'staggering';

function resolveImpactPaletteKey(m: {
  wrathfulStrike: boolean;
  infestedStrike: boolean;
  wraithGuard: boolean;
  staggeringStrike: boolean;
}): ImpactPaletteKey {
  if (m.wrathfulStrike) return 'wrathful';
  if (m.infestedStrike) return 'infested';
  if (m.wraithGuard) return 'wraith_guard';
  if (m.staggeringStrike) return 'staggering';
  return 'default';
}

function pickWraithStrikeImpactColors(key: ImpactPaletteKey) {
  switch (key) {
    case 'wrathful':
      return {
        crescent: new Color('#ff5252'),
        sparkA: new Color('#ffffff'),
        sparkB: new Color('#ffcdd2'),
        flash: new Color('#ff1744'),
      };
    case 'infested':
      return {
        crescent: new Color('#66bb6a'),
        sparkA: new Color('#ffffff'),
        sparkB: new Color('#a5d6a7'),
        flash: new Color('#99f6a4'),
      };
    case 'wraith_guard':
      return {
        crescent: new Color('#ba68c8'),
        sparkA: new Color('#fce4ec'),
        sparkB: new Color('#e1bee7'),
        flash: new Color('#d500f9'),
      };
    case 'staggering':
      return {
        crescent: new Color('#42a5f5'),
        sparkA: new Color('#ffffff'),
        sparkB: new Color('#7ecbff'),
        flash: new Color('#b3e5fc'),
      };
    default:
      return {
        crescent: new Color('#1097B5'),
        sparkA: new Color('#ffffff'),
        sparkB: new Color('#60e8ff'),
        flash: new Color('#d0f8ff'),
      };
  }
}

function buildSparkParams(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const baseAngle = (i / count) * Math.PI * 2;
    const angle = baseAngle + (Math.random() * 0.4 - 0.2);
    const speed = 4.5 + Math.random() * 3.5;
    const delay = Math.random() * 0.06;
    const size = 0.05 + Math.random() * 0.1;
    const yBias = Math.random() * 0.4;
    return { angle, speed, delay, size, yBias };
  });
}

export default function RunebladeWraithStrikeImpact({
  position,
  direction,
  wrathfulStrike = false,
  infestedStrike = false,
  wraithGuard = false,
  staggeringStrike = false,
  onComplete,
}: RunebladeWraithStrikeImpactProps) {
  const groupRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const crescentRef = useRef<Mesh | null>(null);
  const flashRef = useRef<Mesh | null>(null);
  const sparkRefs = useRef<(Mesh | null)[]>(Array(SPARK_COUNT).fill(null));

  // Borrow a pooled point light for the impact flash instead of mounting a <pointLight>.
  const impactLight = useDynamicLight({ color: pickWraithStrikeImpactColors(resolveImpactPaletteKey({
    wrathfulStrike: !!wrathfulStrike,
    infestedStrike: !!infestedStrike,
    wraithGuard: !!wraithGuard,
    staggeringStrike: !!staggeringStrike,
  })).flash, distance: 10, decay: 6, priority: 1 });

  const sparkParams = useMemo(() => buildSparkParams(SPARK_COUNT), []);

  const crescentYaw = useMemo(
    () => Math.atan2(direction.x, direction.z),
    [direction.x, direction.z],
  );

  const crescentRotation = useMemo((): [number, number, number] => [
    CRESCENT_ROTATION[0],
    CRESCENT_ROTATION[1],
    crescentYaw + CRESCENT_YAW_OFFSET,
  ], [crescentYaw]);

  const paletteKey = useMemo(() => resolveImpactPaletteKey({
    wrathfulStrike: !!wrathfulStrike,
    infestedStrike: !!infestedStrike,
    wraithGuard: !!wraithGuard,
    staggeringStrike: !!staggeringStrike,
  }), [wrathfulStrike, infestedStrike, wraithGuard, staggeringStrike]);

  const palette = useMemo(() => pickWraithStrikeImpactColors(paletteKey), [paletteKey]);

  const crescentMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.crescent.clone(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
        side: 2,
      }),
    [paletteKey],
  );

  const flashMat = useMemo(
    () =>
      new MeshBasicMaterial({
        color: palette.flash.clone(),
        transparent: true,
        opacity: 0,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [paletteKey],
  );

  const sparkMats = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) =>
        new MeshBasicMaterial({
          color: (i % 2 === 0 ? palette.sparkA : palette.sparkB).clone(),
          transparent: true,
          opacity: 0,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      ),
    [paletteKey],
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

    if (flashRef.current) {
      const flashFade = t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.08) / 0.17);
      const scale = 0.3 + t * 6.0;
      flashRef.current.scale.set(scale, scale, 1);
      flashMat.opacity = Math.max(0, flashFade * 0.85);

      // Drive the pooled light at the impact point (world space), tracking the flash.
      impactLight.current?.setPosition(position.x, position.y + 1, position.z);
      impactLight.current?.setIntensity(10 * flashFade);
    }

    if (crescentRef.current) {
      const progress = Math.min(t / (DURATION * 0.7), 1.0);
      const scale = progress * 1.275;
      crescentRef.current.scale.set(scale, scale, scale);
      const fadeIn = t < 0.07 ? t / 0.07 : 1.0;
      const fadeOut =
        t > DURATION * 0.45 ? 1 - (t - DURATION * 0.45) / (DURATION * 0.55) : 1.0;
      crescentMat.opacity = Math.max(0, fadeIn * fadeOut * 0.9);
    }

    for (let i = 0; i < SPARK_COUNT; i++) {
      const mesh = sparkRefs.current[i];
      const mat = sparkMats[i];
      if (!mesh) continue;
      const { angle, speed, delay, size, yBias } = sparkParams[i];
      const localT = t - delay;
      if (localT <= 0) {
        mat.opacity = 0;
        continue;
      }

      const dist = localT * speed;
      mesh.position.set(
        Math.sin(angle) * dist,
        yBias + localT * 1.5,
        Math.cos(angle) * dist,
      );
      const s = size * (0.6 + localT * 1.8);
      mesh.scale.set(s, s, s);
      const localFade =
        localT < 0.08 ? localT / 0.08 : Math.max(0, 1 - (localT - 0.08) / (DURATION * 0.8));
      mat.opacity = Math.max(0, 0.85 * localFade);
    }
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 1, position.z]}>
      {/* Impact flash point light now driven via the shared dynamic light pool (see useFrame). */}

      <mesh ref={flashRef} rotation={FLASH_ROTATION} scale={[0.01, 0.01, 1]}>
        <circleGeometry args={[1, 24]} />
        <primitive object={flashMat} attach="material" />
      </mesh>

      <mesh
        ref={crescentRef}
        rotation={crescentRotation}
        scale={[0.01, 0.01, 0.01]}
      >
        <torusGeometry args={[1, 0.08, 6, 48, Math.PI * 1.4]} />
        <primitive object={crescentMat} attach="material" />
      </mesh>

      {sparkParams.map((_, i) => (
        <mesh key={i} ref={(el) => { sparkRefs.current[i] = el; }}>
          <planeGeometry args={[1, 1]} />
          <primitive object={sparkMats[i]} attach="material" />
        </mesh>
      ))}
    </group>
  );
}
