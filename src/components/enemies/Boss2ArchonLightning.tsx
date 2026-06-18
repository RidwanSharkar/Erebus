'use client';

import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import ViperShotTelegraphLine from './ViperShotTelegraphLine';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { BOSS2_ARCHON_LIGHTNING_WINDUP_MS } from '@/utils/groundLineTelegraphShader';

export interface Boss2ArchonBeam {
  startPosition: Vector3;
  targetPosition: Vector3;
}

interface Boss2ArchonLightningProps {
  beams: Boss2ArchonBeam[];
  strikeAt: number;
  halfWidth: number;
  onComplete: () => void;
}

const BOLT_DURATION_MS = 600;
const MAIN_SEGMENTS = 48;
const BRANCH_COUNT = 12;

type BoltBranch = {
  points: Vector3[];
  thickness: number;
  isCoreStrike: boolean;
};

function buildBoltBranches(startPosition: Vector3, targetPosition: Vector3): BoltBranch[] {
  const direction = targetPosition.clone().sub(startPosition).normalize();
  const distance = startPosition.distanceTo(targetPosition);
  const perpendicular1 = new Vector3().crossVectors(direction, new Vector3(0, 1, 0)).normalize();
  const perpendicular2 = new Vector3().crossVectors(direction, perpendicular1).normalize();

  const mainBolt: BoltBranch = {
    points: Array.from({ length: MAIN_SEGMENTS }, (_, i) => {
      const t = i / (MAIN_SEGMENTS - 1);
      const point = startPosition.clone().lerp(targetPosition, t);
      const primaryOffset = Math.sin(t * Math.PI * 6) * (1 - t * 0.5) * 0.4;
      const randomOffset = (Math.random() - 0.5) * 0.4 * (1 - t * 0.7);
      point.add(perpendicular1.clone().multiplyScalar(primaryOffset + randomOffset));
      point.add(perpendicular2.clone().multiplyScalar(randomOffset * 0.5));
      return point;
    }),
    thickness: 0.08,
    isCoreStrike: true,
  };

  const secondaryBranches = Array.from({ length: BRANCH_COUNT }, () => {
    const startIdx = Math.floor(Math.random() * (MAIN_SEGMENTS * 0.7));
    const startPoint = mainBolt.points[startIdx];
    const branchLength = Math.floor(MAIN_SEGMENTS * (0.15 + Math.random() * 0.2));
    const branchDir = perpendicular1
      .clone()
      .multiplyScalar((Math.random() - 0.5) * 2)
      .add(perpendicular2.clone().multiplyScalar((Math.random() - 0.5) * 1.5))
      .normalize();

    return {
      points: Array.from({ length: branchLength }, (_, i) => {
        const t = i / Math.max(1, branchLength - 1);
        const branchTarget = startPoint.clone().add(branchDir.clone().multiplyScalar(distance * 0.2 * t));
        const point = startPoint.clone().lerp(branchTarget, t);
        point.add(
          new Vector3(
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2,
            (Math.random() - 0.5) * 0.2
          )
        );
        return point;
      }),
      thickness: 0.05 + Math.random() * 0.04,
      isCoreStrike: false,
    };
  });

  return [mainBolt, ...secondaryBranches];
}

export default function Boss2ArchonLightning({
  beams,
  strikeAt,
  halfWidth,
  onComplete,
}: Boss2ArchonLightningProps) {
  const [phase, setPhase] = useState<'warning' | 'strike'>('warning');
  const strikeStartRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const flickerRef = useRef(1);

  // Two pooled lights cover the primary beam's start/target impacts (replaces the
  // per-impact <pointLight>s; extra beams share these as an approximation).
  const targetLight = useDynamicLight({ color: '#ff0000', distance: 8, priority: 1 });
  const startLight = useDynamicLight({ color: '#ff0000', distance: 5, priority: 1 });

  const groundPairs = useMemo(
    () =>
      beams.map(({ startPosition, targetPosition }) => ({
        groundStart: new Vector3(startPosition.x, 0.08, startPosition.z),
        groundEnd: new Vector3(targetPosition.x, 0.08, targetPosition.z),
      })),
    [beams]
  );

  const branchBundles = useMemo(
    () => beams.map(({ startPosition, targetPosition }) => buildBoltBranches(startPosition, targetPosition)),
    [beams]
  );

  const geometries = useMemo(
    () => ({
      bolt: new SphereGeometry(1, 8, 8),
      impact: new SphereGeometry(1, 16, 16),
      ring: new RingGeometry(0.65, 0.82, 32),
    }),
    []
  );

  const materials = useMemo(
    () => ({
      coreBolt: new MeshBasicMaterial({ color: '#ffefff', transparent: true, blending: AdditiveBlending }),
      secondaryBolt: new MeshBasicMaterial({ color: '#ff3333', transparent: true, blending: AdditiveBlending }),
      impact: new MeshBasicMaterial({ color: '#ff4444', transparent: true, blending: AdditiveBlending }),
      ring: new MeshBasicMaterial({
        color: '#ff1111',
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    }),
    []
  );

  useFrame(() => {
    const now = Date.now();
    if (phase === 'warning') {
      targetLight.current?.setIntensity(0);
      startLight.current?.setIntensity(0);
      if (now >= strikeAt) {
        strikeStartRef.current = now;
        setPhase('strike');
      }
      return;
    }

    const elapsed = now - (strikeStartRef.current ?? now);
    const progress = Math.min(elapsed / BOLT_DURATION_MS, 1);
    flickerRef.current = Math.random() * 0.4 + 0.6;
    const fadeOut = (1 - progress) * flickerRef.current;

    materials.coreBolt.opacity = fadeOut;
    materials.secondaryBolt.opacity = fadeOut * 0.8;
    materials.impact.opacity = fadeOut * 0.9;
    materials.ring.opacity = fadeOut * 0.7;

    // Drive the pooled lights at the primary beam's impact world positions.
    const primary = beams[0];
    if (primary) {
      const { startPosition, targetPosition } = primary;
      startLight.current?.setPosition(startPosition.x, startPosition.y, startPosition.z);
      startLight.current?.setIntensity(12 * flickerRef.current);
      targetLight.current?.setPosition(targetPosition.x, targetPosition.y, targetPosition.z);
      targetLight.current?.setIntensity(15 * flickerRef.current);
    }

    if (progress >= 1 && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  });

  return (
    <>
      {phase === 'warning' &&
        groundPairs.map(({ groundStart, groundEnd }, beamIdx) => {
          const showStartCap = groundStart.distanceTo(groundEnd) > 2;
          return (
            <ViperShotTelegraphLine
              key={`warn-${beamIdx}`}
              start={groundStart}
              end={groundEnd}
              lineWidth={halfWidth * 2}
              color="#ff3333"
              variant="archon"
              endAt={strikeAt}
              startedAt={strikeAt - BOSS2_ARCHON_LIGHTNING_WINDUP_MS}
              showStartCap={showStartCap}
            />
          );
        })}

      {phase === 'strike' && (
        <group>
          {branchBundles.map((branches, beamIdx) => (
            <group key={`strike-beam-${beamIdx}`}>
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
            </group>
          ))}

          {beams.map(({ startPosition, targetPosition }, beamIdx) => (
            <group key={`impact-${beamIdx}`}>
              {[startPosition, targetPosition].map((pos, i) => (
                <group key={i} position={pos.toArray()}>
                  <mesh
                    geometry={geometries.impact}
                    material={materials.impact}
                    scale={[i === 0 ? 0.6 : 1, i === 0 ? 0.6 : 1, i === 0 ? 0.6 : 1]}
                  />
                  {[0.75, 1.45].map((size, ringIdx) => (
                    <mesh
                      key={ringIdx}
                      rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
                      scale={[size / 0.8, size / 0.8, 1]}
                      geometry={geometries.ring}
                      material={materials.ring}
                    />
                  ))}
                </group>
              ))}
            </group>
          ))}
        </group>
      )}
    </>
  );
}
