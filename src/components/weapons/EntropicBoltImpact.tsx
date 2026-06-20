'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  AdditiveBlending,
  DoubleSide,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { getEntropicExplosionColors } from '@/utils/entropicColorThemes';

interface EntropicBoltImpactProps {
  position: Vector3;
  /** Normalized projectile travel direction at point of impact. */
  direction: Vector3;
  onComplete: () => void;
  colorVariant?: string;
}

const IMPACT_DURATION = 0.45;
const RING_SIZES = [0.4, 0.6, 0.8] as const;
const SPARK_COUNT = 14;

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const AXIS_Y = new Vector3(0, 1, 0);
const _dir = new Vector3();
const _quat = new Quaternion();
const _sparkPos = new Vector3();

function buildSparkParams(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + (Math.random() * 0.3 - 0.15),
    drift: 0.4 + Math.random() * 0.8,
    speed: 1.8 + Math.random() * 1.4,
  }));
}

function alignGroupToDirection(group: Group | null, direction: Vector3) {
  if (!group) return;
  _dir.copy(direction).normalize();
  if (_dir.lengthSq() < 1e-8) {
    group.quaternion.identity();
    return;
  }
  if (Math.abs(_dir.dot(AXIS_Y)) > 0.985) {
    _quat.setFromUnitVectors(AXIS_X, _dir);
  } else {
    _quat.setFromUnitVectors(AXIS_Z, _dir);
  }
  group.quaternion.copy(_quat);
}

export default function EntropicBoltImpact({
  position,
  direction,
  onComplete,
  colorVariant,
}: EntropicBoltImpactProps) {
  const groupRef = useRef<Group>(null);
  const orientRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const coreRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const flashRef = useRef<Mesh>(null);
  const shockwaveRef = useRef<Mesh>(null);
  const ringRefs = useRef<(Group | null)[]>([]);
  const sparkRefs = useRef<(Mesh | null)[]>([]);

  const colors = useMemo(
    () => getEntropicExplosionColors(colorVariant),
    [colorVariant],
  );

  const sparkParams = useMemo(() => buildSparkParams(SPARK_COUNT), []);

  const coreMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: colors.core,
        emissive: colors.coreEmissive,
        emissiveIntensity: 2,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [colors.core, colors.coreEmissive],
  );

  const innerMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: colors.inner,
        emissive: colors.innerEmissive,
        emissiveIntensity: 4,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [colors.inner, colors.innerEmissive],
  );

  const flashMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: colors.innerEmissive,
        emissive: colors.coreEmissive,
        emissiveIntensity: 5,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [colors.innerEmissive, colors.coreEmissive],
  );

  const shockwaveMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: colors.ring,
        emissive: colors.ringEmissive,
        emissiveIntensity: 2.2,
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [colors.ring, colors.ringEmissive],
  );

  const ringMats = useMemo(
    () =>
      RING_SIZES.map(
        (_, i) =>
          new MeshStandardMaterial({
            color: colors.ring,
            emissive: colors.ringEmissive,
            emissiveIntensity: 1.2,
            transparent: true,
            opacity: 0.55 * (1 - i * 0.15),
            depthWrite: false,
            blending: AdditiveBlending,
          }),
      ),
    [colors.ring, colors.ringEmissive],
  );

  const sparkMats = useMemo(
    () =>
      Array.from(
        { length: SPARK_COUNT },
        () =>
          new MeshStandardMaterial({
            color: colors.spark,
            emissive: colors.sparkEmissive,
            emissiveIntensity: 2.4,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            blending: AdditiveBlending,
          }),
      ),
    [colors.spark, colors.sparkEmissive],
  );

  const explosionLight = useDynamicLight({
    color: colors.light,
    distance: 7,
    decay: 2,
    priority: 1,
  });

  useEffect(() => {
    alignGroupToDirection(orientRef.current, direction);
  }, [direction]);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;
    const fade = Math.max(0, 1 - t / IMPACT_DURATION);

    if (t >= IMPACT_DURATION) {
      doneRef.current = true;
      explosionLight.current?.setIntensity(0);
      onComplete();
      return;
    }

    explosionLight.current?.setPosition(
      position.x,
      position.y + 1.125,
      position.z,
    );
    explosionLight.current?.setIntensity(6 * fade * fade);

    const flashFade = t < 0.08 ? t / 0.08 : Math.max(0, 1 - (t - 0.08) / 0.12);

    if (coreRef.current) {
      const coreScale = 0.3 * (1 + t * 2.8);
      coreRef.current.scale.setScalar(coreScale);
    }
    coreMat.emissiveIntensity = 3.5 * fade;
    coreMat.opacity = 0.85 * fade;

    if (innerRef.current) {
      const innerScale = 0.2 * (1 + t * 3.6);
      innerRef.current.scale.setScalar(innerScale);
    }
    innerMat.emissiveIntensity = 5 * fade;
    innerMat.opacity = 0.95 * fade;

    if (flashRef.current) {
      const flashScale = 0.15 + t * 10;
      flashRef.current.scale.set(flashScale, flashScale, 1);
    }
    flashMat.opacity = flashFade * 0.95;
    flashMat.emissiveIntensity = 6 * flashFade;

    if (shockwaveRef.current) {
      const shockScale = 0.2 + t * 5.5;
      shockwaveRef.current.scale.set(shockScale, shockScale, 1);
    }
    shockwaveMat.opacity = fade * 0.75;
    shockwaveMat.emissiveIntensity = 2.8 * fade;

    const ringSpinRates = [4.5, -3.2, 2.8] as const;
    const ringExpandRates = [3.2, 3.6, 4.0] as const;
    ringRefs.current.forEach((ringGroup, i) => {
      if (!ringGroup) return;
      ringGroup.rotation.z += ringSpinRates[i] * delta;
      ringGroup.rotation.x += ringSpinRates[(i + 1) % 3] * delta * 0.65;
      ringGroup.rotation.y += ringSpinRates[(i + 2) % 3] * delta * 0.45;
      const ringScale = RING_SIZES[i] * (1 + t * ringExpandRates[i]);
      ringGroup.scale.setScalar(ringScale / RING_SIZES[i]);
      const mat = ringMats[i];
      if (mat) {
        mat.emissiveIntensity = 1.4 * fade;
        mat.opacity = 0.6 * fade * (1 - i * 0.18);
      }
    });

    sparkParams.forEach((param, i) => {
      const mesh = sparkRefs.current[i];
      const mat = sparkMats[i];
      if (!mesh || !mat) return;

      const radius = t * param.speed;
      const lift = t * param.drift;
      _sparkPos.set(
        Math.cos(param.angle) * radius,
        Math.sin(param.angle) * radius + lift,
        (Math.sin(param.angle * 2.1) * 0.08),
      );
      mesh.position.copy(_sparkPos);

      const sparkSize = 0.05 * (1 - t / IMPACT_DURATION * 0.55);
      mesh.scale.setScalar(Math.max(0.01, sparkSize / 0.05));
      mat.emissiveIntensity = 2.6 * fade;
      mat.opacity = 0.9 * fade;
    });
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 1.125, position.z]}>
      <group ref={orientRef}>
        {/* Direction-aligned flash disc */}
        <mesh ref={flashRef}>
          <circleGeometry args={[1, 24]} />
          <primitive object={flashMat} attach="material" />
        </mesh>

        {/* Shockwave ring aligned perpendicular to travel */}
        <mesh ref={shockwaveRef}>
          <ringGeometry args={[0.55, 0.72, 32]} />
          <primitive object={shockwaveMat} attach="material" />
        </mesh>

        {/* Core explosion sphere */}
        <mesh ref={coreRef}>
          <sphereGeometry args={[1, 32, 32]} />
          <primitive object={coreMat} attach="material" />
        </mesh>

        {/* Inner energy sphere */}
        <mesh ref={innerRef}>
          <sphereGeometry args={[1, 24, 24]} />
          <primitive object={innerMat} attach="material" />
        </mesh>

        {/* Counter-rotating torus rings */}
        {RING_SIZES.map((size, i) => (
          <group
            key={i}
            ref={(el) => {
              ringRefs.current[i] = el;
            }}
          >
            <mesh>
              <torusGeometry args={[size, 0.065, 16, 32]} />
              <primitive object={ringMats[i]} attach="material" />
            </mesh>
          </group>
        ))}

        {/* Radial sparks in impact plane */}
        {sparkParams.map((_, i) => (
          <mesh
            key={`spark-${i}`}
            ref={(el) => {
              sparkRefs.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <primitive object={sparkMats[i]} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
