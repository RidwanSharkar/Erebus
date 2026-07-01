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
import {
  getEntropicExplosionColors,
  type EntropicExplosionColors,
} from '@/utils/entropicColorThemes';

interface EntropicBoltImpactProps {
  position: Vector3;
  /** Normalized projectile travel direction at point of impact. */
  direction: Vector3;
  onComplete: () => void;
  colorVariant?: string;
  isCryoflame?: boolean;
}

const IMPACT_DURATION = 0.5;
const RING_SIZES = [0.45, 0.65, 0.85,] as const;
const SHARD_COUNT = 7;

/** Inner → outer ring colors drawn from the active entropic talent palette. */
const RING_PALETTE: ReadonlyArray<{
  color: keyof EntropicExplosionColors;
  emissive: keyof EntropicExplosionColors;
}> = [
  { color: 'singularity', emissive: 'singularityEmissive' },
  { color: 'core', emissive: 'coreEmissive' },
  { color: 'inner', emissive: 'innerEmissive' },
  { color: 'ring', emissive: 'ringEmissive' },
  { color: 'spark', emissive: 'sparkEmissive' },
];

const RING_SPIN_RATES = [5.5, -4.2, 3.6, -3.0, 4.8] as const;

const AXIS_X = new Vector3(1, 0, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const AXIS_Y = new Vector3(0, 1, 0);
const _dir = new Vector3();
const _quat = new Quaternion();
const _shardPos = new Vector3();

function easeInCubic(t: number): number {
  return t * t * t;
}

function buildShardParams(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    baseAngle: (i / count) * Math.PI * 2 + (Math.random() * 0.4 - 0.2),
    startRadius: 0.55 + Math.random() * 0.55,
    height: (Math.random() - 0.5) * 0.35,
    spinSpeed: (i % 2 === 0 ? 1 : -1) * (6 + Math.random() * 4),
    size: 0.028 + Math.random() * 0.035,
    isBox: i % 3 === 0,
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
  isCryoflame = false,
}: EntropicBoltImpactProps) {
  const groupRef = useRef<Group>(null);
  const orientRef = useRef<Group>(null);
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const ringRefs = useRef<(Group | null)[]>([]);
  const shardRefs = useRef<(Mesh | null)[]>([]);

  const colors = useMemo(
    () => getEntropicExplosionColors(colorVariant, isCryoflame),
    [colorVariant, isCryoflame],
  );

  const shardParams = useMemo(() => buildShardParams(SHARD_COUNT), []);

  const ringMats = useMemo(
    () =>
      RING_SIZES.map((_, i) => {
        const palette = RING_PALETTE[i] ?? RING_PALETTE[RING_PALETTE.length - 1];
        const opacityBase =
          1 - (i / Math.max(1, RING_SIZES.length - 1)) * 0.3;
        return new MeshStandardMaterial({
          color: colors[palette.color],
          emissive: colors[palette.emissive],
          emissiveIntensity: 1.65,
          transparent: true,
          opacity: 1 * opacityBase,
          depthWrite: false,
          blending: AdditiveBlending,
        });
      }),
    [],
  );

  const shardMats = useMemo(
    () =>
      Array.from(
        { length: SHARD_COUNT },
        (_, i) =>
          new MeshStandardMaterial({
            color: i % 2 === 0 ? colors.shard : colors.core,
            emissive: i % 2 === 0 ? colors.shardEmissive : colors.coreEmissive,
            emissiveIntensity: 2.6,
            transparent: true,
            opacity: 0.88,
            depthWrite: false,
            blending: AdditiveBlending,
          }),
      ),
    [],
  );

  const implosionLight = useDynamicLight({
    color: colors.light,
    distance: 7,
    decay: 2,
    priority: 1,
  });

  useEffect(() => {
    ringMats.forEach((mat, i) => {
      const palette = RING_PALETTE[i] ?? RING_PALETTE[RING_PALETTE.length - 1];
      mat.color.set(colors[palette.color]);
      mat.emissive.set(colors[palette.emissive]);
    });
    shardMats.forEach((mat, i) => {
      mat.color.set(i % 2 === 0 ? colors.shard : colors.core);
      mat.emissive.set(i % 2 === 0 ? colors.shardEmissive : colors.coreEmissive);
    });
    implosionLight.current?.setColor(colors.light);
  }, [colors, ringMats, shardMats, implosionLight]);

  useEffect(() => {
    const rm = ringMats;
    const sm = shardMats;
    return () => {
      rm.forEach((m) => m.dispose());
      sm.forEach((m) => m.dispose());
    };
  }, [ringMats, shardMats]);

  useEffect(() => {
    alignGroupToDirection(orientRef.current, direction);
  }, [direction]);

  useFrame((_, delta) => {
    if (doneRef.current) return;

    timeRef.current += delta;
    const t = timeRef.current;
    const progress = Math.min(t / IMPACT_DURATION, 1);
    const collapse = Math.max(0, 1 - easeInCubic(progress));
    const fade = collapse;

    if (t >= IMPACT_DURATION) {
      doneRef.current = true;
      implosionLight.current?.setIntensity(0);
      onComplete();
      return;
    }

    implosionLight.current?.setPosition(
      position.x,
      position.y + 1.125,
      position.z,
    );
    const lightSpike = t < 0.06 ? 1 : collapse * collapse;
    implosionLight.current?.setIntensity(7 * lightSpike);

    ringRefs.current.forEach((ringGroup, i) => {
      if (!ringGroup) return;
      const spinRate = RING_SPIN_RATES[i] ?? RING_SPIN_RATES[i % RING_SPIN_RATES.length];
      const spinBoost = 1 + (1 - collapse) * 2.5;
      ringGroup.rotation.z += spinRate * delta * spinBoost;
      ringGroup.rotation.x +=
        RING_SPIN_RATES[(i + 1) % RING_SPIN_RATES.length] * delta * 0.7 * spinBoost;
      ringGroup.rotation.y +=
        RING_SPIN_RATES[(i + 2) % RING_SPIN_RATES.length] * delta * 0.5 * spinBoost;
      const ringScale = Math.max(0.001, RING_SIZES[i] * collapse);
      ringGroup.scale.setScalar(ringScale / RING_SIZES[i]);
      const mat = ringMats[i];
      if (mat) {
        const opacityBase =
          1 - (i / Math.max(1, RING_SIZES.length - 1)) * 0.3;
        mat.emissiveIntensity = (1.2 + (1 - collapse) * 1.8) * fade;
        mat.opacity = 0.7 * fade * opacityBase;
      }
    });

    shardParams.forEach((param, i) => {
      const mesh = shardRefs.current[i];
      const mat = shardMats[i];
      if (!mesh || !mat) return;

      const radius = param.startRadius * collapse;
      const angle = param.baseAngle + t * param.spinSpeed;
      _shardPos.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius * 0.65 + param.height * collapse,
        Math.sin(angle * 1.7) * radius * 0.12,
      );
      mesh.position.copy(_shardPos);
      mesh.rotation.set(
        t * param.spinSpeed * 0.8,
        angle,
        t * param.spinSpeed * 0.5,
      );

      const shardSize = param.size * (0.35 + collapse * 0.65);
      mesh.scale.setScalar(Math.max(0.008, shardSize / param.size));
      mat.emissiveIntensity = 2.4 * fade;
      mat.opacity = 0.9 * fade;
    });
  });

  return (
    <group ref={groupRef} position={[position.x, position.y + 1.125, position.z]}>
      <group ref={orientRef}>


        {/* Contracting counter-rotating torus rings */}
        {RING_SIZES.map((size, i) => (
          <group
            key={i}
            ref={(el) => {
              ringRefs.current[i] = el;
            }}
          >
            <mesh rotation={[Math.PI * 0.35 * (i + 1), Math.PI * 0.2 * i, 0]}>
              <torusGeometry args={[size, 0.055, 12, 28]} />
              <primitive object={ringMats[i]} attach="material" />
            </mesh>
          </group>
        ))}

        {/* Inward-spiraling jagged shards */}
        {shardParams.map((param, i) => (
          <mesh
            key={`shard-${i}`}
            ref={(el) => {
              shardRefs.current[i] = el;
            }}
          >
            {param.isBox ? (
              <boxGeometry args={[param.size, param.size * 1.6, param.size * 0.6]} />
            ) : (
              <tetrahedronGeometry args={[param.size, 0]} />
            )}
            <primitive object={shardMats[i]} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function peakIntensity(progress: number): number {
  return Math.sin(progress * Math.PI);
}
