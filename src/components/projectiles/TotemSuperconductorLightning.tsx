import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from '@/utils/three-exports';
import type { TotemBoltVariant } from '@/utils/talents';
import { getTotemBoltTheme } from '@/components/projectiles/TotemEntropicBolt';

interface TotemSuperconductorLightningProps {
  from: Vector3;
  to: Vector3;
  onComplete: () => void;
  /** Matches Mantra totem boon; default keeps cyan/teal conductor look. */
  totemBoltVariant?: TotemBoltVariant;
}

const DEFAULT_CONDUCTOR = {
  core: '#f0fbff',
  secondary: '#38bdf8',
  impact: '#7dd3fc',
  pointLight: '#7dd3fc',
};

const BOLT_DURATION_MS = 450;
const MAIN_SEGMENTS = 38;
const BRANCH_COUNT = 7;

type BoltBranch = {
  points: Vector3[];
  thickness: number;
  isCoreStrike: boolean;
};

function buildPerpendicularBasis(direction: Vector3): { perpendicular1: Vector3; perpendicular2: Vector3 } {
  const perpendicular1 = new Vector3().crossVectors(direction, new Vector3(0, 1, 0));
  if (perpendicular1.lengthSq() < 1e-6) {
    perpendicular1.crossVectors(direction, new Vector3(1, 0, 0));
  }
  perpendicular1.normalize();

  const perpendicular2 = new Vector3().crossVectors(direction, perpendicular1).normalize();
  return { perpendicular1, perpendicular2 };
}

function buildBoltBranches(startPosition: Vector3, targetPosition: Vector3): BoltBranch[] {
  const direction = targetPosition.clone().sub(startPosition);
  const distance = Math.max(0.001, direction.length());
  direction.normalize();

  const { perpendicular1, perpendicular2 } = buildPerpendicularBasis(direction);

  const mainBolt: BoltBranch = {
    points: Array.from({ length: MAIN_SEGMENTS }, (_, i) => {
      const t = i / (MAIN_SEGMENTS - 1);
      const point = startPosition.clone().lerp(targetPosition, t);
      const primaryOffset = Math.sin(t * Math.PI * 7) * (1 - t * 0.45) * 0.22;
      const randomOffset = (Math.random() - 0.5) * 0.28 * (1 - t * 0.65);
      point.add(perpendicular1.clone().multiplyScalar(primaryOffset + randomOffset));
      point.add(perpendicular2.clone().multiplyScalar(randomOffset * 0.55));
      return point;
    }),
    thickness: 0.065,
    isCoreStrike: true,
  };

  const secondaryBranches = Array.from({ length: BRANCH_COUNT }, () => {
    const startIdx = Math.floor(Math.random() * (MAIN_SEGMENTS * 0.72));
    const startPoint = mainBolt.points[startIdx] ?? startPosition;
    const branchLength = Math.max(4, Math.floor(MAIN_SEGMENTS * (0.12 + Math.random() * 0.18)));
    const branchDir = perpendicular1
      .clone()
      .multiplyScalar((Math.random() - 0.5) * 2)
      .add(perpendicular2.clone().multiplyScalar((Math.random() - 0.5) * 1.4))
      .normalize();

    return {
      points: Array.from({ length: branchLength }, (_, i) => {
        const t = i / Math.max(1, branchLength - 1);
        const branchTarget = startPoint.clone().add(branchDir.clone().multiplyScalar(distance * 0.16 * t));
        const point = startPoint.clone().lerp(branchTarget, t);
        point.add(
          new Vector3(
            (Math.random() - 0.5) * 0.14,
            (Math.random() - 0.5) * 0.14,
            (Math.random() - 0.5) * 0.14,
          ),
        );
        return point;
      }),
      thickness: 0.035 + Math.random() * 0.025,
      isCoreStrike: false,
    };
  });

  return [mainBolt, ...secondaryBranches];
}

export default function TotemSuperconductorLightning({
  from,
  to,
  onComplete,
  totemBoltVariant,
}: TotemSuperconductorLightningProps) {
  const startedAtRef = useRef(Date.now());
  const completedRef = useRef(false);
  const flickerRef = useRef(1);

  const conductorPalette = useMemo(() => {
    if (!totemBoltVariant) {
      return DEFAULT_CONDUCTOR;
    }
    const t = getTotemBoltTheme(totemBoltVariant);
    return {
      core: t.light,
      secondary: t.primary,
      impact: t.secondary,
      pointLight: t.light,
    };
  }, [totemBoltVariant]);

  const branches = useMemo(() => buildBoltBranches(from, to), [from, to]);
  const impactRotations = useMemo(
    () =>
      [0, 1].map(() => [
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI,
      ] as [number, number, number]),
    [],
  );

  const geometries = useMemo(
    () => ({
      bolt: new SphereGeometry(1, 8, 8),
      impact: new SphereGeometry(1, 16, 16),
      ring: new RingGeometry(0.55, 0.72, 32),
    }),
    [],
  );

  const materials = useMemo(
    () => ({
      coreBolt: new MeshBasicMaterial({
        color: conductorPalette.core,
        transparent: true,
        blending: AdditiveBlending,
      }),
      secondaryBolt: new MeshBasicMaterial({
        color: conductorPalette.secondary,
        transparent: true,
        blending: AdditiveBlending,
      }),
      impact: new MeshBasicMaterial({
        color: conductorPalette.impact,
        transparent: true,
        blending: AdditiveBlending,
      }),
      ring: new MeshBasicMaterial({
        color: conductorPalette.secondary,
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    }),
    [conductorPalette],
  );

  useFrame(() => {
    const elapsed = Date.now() - startedAtRef.current;
    const progress = Math.min(elapsed / BOLT_DURATION_MS, 1);
    flickerRef.current = Math.random() * 0.35 + 0.65;
    const fadeOut = (1 - progress) * flickerRef.current;

    materials.coreBolt.opacity = fadeOut;
    materials.secondaryBolt.opacity = fadeOut * 0.85;
    materials.impact.opacity = fadeOut;
    materials.ring.opacity = fadeOut * 0.7;

    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  });

  return (
    <group>
      {branches.map((branch, branchIdx) => (
        <group key={branchIdx}>
          {branch.points.map((point, idx) => (
            <mesh
              key={idx}
              position={point.toArray()}
              geometry={geometries.bolt}
              material={branch.isCoreStrike ? materials.coreBolt : materials.secondaryBolt}
              scale={[branch.thickness, branch.thickness, branch.thickness]}
            />
          ))}
        </group>
      ))}

      {[from, to].map((pos, i) => (
        <group key={i} position={pos.toArray()}>
          <mesh
            geometry={geometries.impact}
            material={materials.impact}
            scale={[i === 0 ? 0.45 : 0.75, i === 0 ? 0.45 : 0.75, i === 0 ? 0.45 : 0.75]}
          />
          <mesh
            rotation={impactRotations[i] ?? [0, 0, 0]}
            scale={[i === 0 ? 0.8 : 1.2, i === 0 ? 0.8 : 1.2, 1]}
            geometry={geometries.ring}
            material={materials.ring}
          />
          <pointLight
            color={conductorPalette.pointLight}
            intensity={(i === 0 ? 8 : 12) * flickerRef.current}
            distance={i === 0 ? 4 : 7}
            decay={2}
          />
        </group>
      ))}
    </group>
  );
}
