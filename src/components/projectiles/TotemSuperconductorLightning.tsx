import React, { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from '@/utils/three-exports';
import type { TotemBoltVariant } from '@/utils/talents';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { getTotemBoltTheme } from '@/components/projectiles/TotemEntropicBolt';

export type TotemLightningPoolSlot = {
  active: boolean;
  launchGen: number;
  id: number;
  from: Vector3;
  to: Vector3;
  totemBoltVariant?: TotemBoltVariant;
};

interface TotemSuperconductorLightningProps {
  from?: Vector3;
  to?: Vector3;
  onComplete?: () => void;
  /** Matches Mantra totem boon; default keeps cyan/teal conductor look. */
  totemBoltVariant?: TotemBoltVariant;
  poolSlot?: TotemLightningPoolSlot;
  onPoolComplete?: (id: number) => void;
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
  poolSlot,
  onPoolComplete,
}: TotemSuperconductorLightningProps) {
  const startedAtRef = useRef(Date.now());
  const completedRef = useRef(false);
  const flickerRef = useRef(1);
  const holderRef = useRef<Group>(null);
  const launchGenSeen = useRef(0);
  const impactRotationsRef = useRef<[number, number, number][]>([]);

  const resolvedVariant = poolSlot?.totemBoltVariant ?? totemBoltVariant;
  const resolvedFrom = poolSlot?.from ?? from!;
  const resolvedTo = poolSlot?.to ?? to!;

  const conductorPalette = useMemo(() => {
    if (!resolvedVariant) {
      return DEFAULT_CONDUCTOR;
    }
    const t = getTotemBoltTheme(resolvedVariant);
    return {
      core: t.light,
      secondary: t.primary,
      impact: t.secondary,
      pointLight: t.light,
    };
  }, [resolvedVariant]);

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

  // Two endpoint <pointLight>s (origin + impact) become two pooled lights at `from`/`to`.
  const originLight = useDynamicLight({ color: conductorPalette.pointLight, distance: 4, decay: 2, priority: 1 });
  const impactLight = useDynamicLight({ color: conductorPalette.pointLight, distance: 7, decay: 2, priority: 1 });

  const mountLightning = (start: Vector3, end: Vector3) => {
    const holder = holderRef.current;
    if (!holder) return;

    while (holder.children.length > 0) {
      holder.remove(holder.children[0]);
    }

    const builtBranches = buildBoltBranches(start, end);
    impactRotationsRef.current = [0, 1].map(() => [
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    ] as [number, number, number]);

    for (const branch of builtBranches) {
      const branchGroup = new Group();
      for (const point of branch.points) {
        const mesh = new Mesh(geometries.bolt, branch.isCoreStrike ? materials.coreBolt : materials.secondaryBolt);
        mesh.position.copy(point);
        mesh.scale.setScalar(branch.thickness);
        branchGroup.add(mesh);
      }
      holder.add(branchGroup);
    }

    [start, end].forEach((pos, i) => {
      const impactGroup = new Group();
      impactGroup.position.copy(pos);
      const impactMesh = new Mesh(geometries.impact, materials.impact);
      impactMesh.scale.setScalar(i === 0 ? 0.45 : 0.75);
      impactGroup.add(impactMesh);
      const ringMesh = new Mesh(geometries.ring, materials.ring);
      ringMesh.rotation.set(...(impactRotationsRef.current[i] ?? [0, 0, 0]));
      ringMesh.scale.set(i === 0 ? 0.8 : 1.2, i === 0 ? 0.8 : 1.2, 1);
      impactGroup.add(ringMesh);
      holder.add(impactGroup);
    });
  };

  const branches = useMemo(
    () => (poolSlot ? [] : buildBoltBranches(resolvedFrom, resolvedTo)),
    [poolSlot, resolvedFrom, resolvedTo],
  );
  const impactRotations = useMemo(
    () =>
      poolSlot
        ? []
        : [0, 1].map(() => [
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI,
          ] as [number, number, number]),
    [poolSlot],
  );

  useEffect(() => {
    const g = geometries;
    return () => {
      g.bolt.dispose();
      g.impact.dispose();
      g.ring.dispose();
    };
  }, [geometries]);

  useEffect(() => {
    const m = materials;
    return () => {
      m.coreBolt.dispose();
      m.secondaryBolt.dispose();
      m.impact.dispose();
      m.ring.dispose();
    };
  }, [materials]);

  useFrame(() => {
    if (poolSlot) {
      if (!poolSlot.active) {
        if (holderRef.current) holderRef.current.visible = false;
        originLight.current?.setIntensity(0);
        impactLight.current?.setIntensity(0);
        return;
      }
      if (poolSlot.launchGen !== launchGenSeen.current) {
        launchGenSeen.current = poolSlot.launchGen;
        startedAtRef.current = Date.now();
        completedRef.current = false;
        mountLightning(poolSlot.from, poolSlot.to);
        if (holderRef.current) holderRef.current.visible = true;
      }
    }

    const elapsed = Date.now() - startedAtRef.current;
    const progress = Math.min(elapsed / BOLT_DURATION_MS, 1);
    flickerRef.current = Math.random() * 0.35 + 0.65;
    const fadeOut = (1 - progress) * flickerRef.current;

    materials.coreBolt.opacity = fadeOut;
    materials.secondaryBolt.opacity = fadeOut * 0.85;
    materials.impact.opacity = fadeOut;
    materials.ring.opacity = fadeOut * 0.7;

    const lightFrom = poolSlot?.from ?? resolvedFrom;
    const lightTo = poolSlot?.to ?? resolvedTo;

    // Drive the two endpoint lights, replicating the per-endpoint flicker intensity.
    originLight.current?.setPosition(lightFrom.x, lightFrom.y, lightFrom.z);
    originLight.current?.setIntensity(8 * flickerRef.current);
    impactLight.current?.setPosition(lightTo.x, lightTo.y, lightTo.z);
    impactLight.current?.setIntensity(12 * flickerRef.current);

    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true;
      if (poolSlot) {
        poolSlot.active = false;
        if (holderRef.current) holderRef.current.visible = false;
        originLight.current?.setIntensity(0);
        impactLight.current?.setIntensity(0);
        onPoolComplete?.(poolSlot.id);
      } else {
        onComplete?.();
      }
    }
  });

  if (poolSlot) {
    return <group ref={holderRef} visible={false} />;
  }

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

      {[resolvedFrom, resolvedTo].map((pos, i) => (
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
        </group>
      ))}
    </group>
  );
}
