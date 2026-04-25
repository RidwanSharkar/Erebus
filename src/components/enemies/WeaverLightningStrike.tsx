'use client';

import React, { useRef, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  CylinderGeometry,
  SphereGeometry,
  OctahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  AdditiveBlending,
  RingGeometry,
  DoubleSide,
} from '@/utils/three-exports';

interface WeaverLightningStrikeProps {
  targetPosition: Vector3;
  /** Unix ms when the bolt hits and damage is resolved */
  strikeAt: number;
  damage: number;
  radius: number;
  onImpact: (damage: number, position: Vector3) => void;
  onComplete: () => void;
}

const TELEGRAPH_Y = 0.18;
const STRIKE_DURATION_S = 1.0;
const IMPACT_AT_PROGRESS = 0.6;
const RING_SEGMENTS = 32;
const MAIN_BOLT_SEGMENTS = 128;
const BRANCH_COUNT = 24;

export default function WeaverLightningStrike({
  targetPosition,
  strikeAt,
  damage,
  radius,
  onImpact,
  onComplete,
}: WeaverLightningStrikeProps) {
  const [phase, setPhase] = useState<'warning' | 'strike'>('warning');
  const strikeStartRef = useRef<number | null>(null);
  const impactDoneRef = useRef(false);
  const completeDoneRef = useRef(false);
  const flickerRef = useRef(1);
  const lightRef = useRef<any>(null);

  const impactPos = useMemo(
    () => new Vector3(targetPosition.x, 0, targetPosition.z),
    [targetPosition.x, targetPosition.z]
  );

  const skyPosition = useMemo(
    () => new Vector3(impactPos.x, impactPos.y + 20, impactPos.z),
    [impactPos]
  );

  const branches = useMemo(() => {
    const targetPos = impactPos;
    const mainBolt = {
      points: Array(MAIN_BOLT_SEGMENTS)
        .fill(0)
        .map((_, i) => {
          const t = i / (MAIN_BOLT_SEGMENTS - 1);
          const primaryOffset = Math.sin(t * Math.PI * 8) * (1 - t) * 1.2;
          const secondaryOffset = Math.sin(t * Math.PI * 16) * (1 - t) * 0.6;
          const randomOffset = (Math.random() - 0.5) * 0.8 * (1 - t);

          return new Vector3(
            skyPosition.x + (targetPos.x - skyPosition.x) * t + primaryOffset + randomOffset,
            skyPosition.y + (targetPos.y - skyPosition.y) * Math.pow(t, 0.7),
            skyPosition.z + (targetPos.z - skyPosition.z) * t + secondaryOffset + randomOffset
          );
        }),
      thickness: 0.11,
      isCoreStrike: true as const,
    };

    const secondaryBranches = Array(BRANCH_COUNT)
      .fill(0)
      .map(() => {
        const startIdx = Math.floor(Math.random() * mainBolt.points.length * 0.8);
        const startPoint = mainBolt.points[startIdx];
        const branchLength = Math.floor(Math.random() * 12) + 8;

        return {
          points: Array(branchLength)
            .fill(0)
            .map((_, j) => {
              const branchT = j / (branchLength - 1);
              const angle = (Math.random() - 0.5) * Math.PI * 0.8;
              const branchDistance = branchT * 3;

              return new Vector3(
                startPoint.x + Math.cos(angle) * branchDistance * (1 - branchT * 0.3),
                startPoint.y - branchT * 2,
                startPoint.z + Math.sin(angle) * branchDistance * (1 - branchT * 0.3)
              );
            }),
          thickness: 0.05,
          isCoreStrike: false as const,
        };
      });

    return [mainBolt, ...secondaryBranches];
  }, [impactPos, skyPosition]);

  const warningRing = useMemo(
    () => new RingGeometry(radius - 0.25, radius, RING_SEGMENTS),
    [radius]
  );
  const innerPulse = useMemo(
    () => new RingGeometry(radius - 0.6, radius - 0.4, RING_SEGMENTS),
    [radius]
  );

  const geometries = useMemo(
    () => ({
      bolt: new CylinderGeometry(1, 1, 1, 8),
      impact: new SphereGeometry(1, 16, 16),
      particle: new OctahedronGeometry(0.08, 0),
    }),
    []
  );

  const materials = useMemo(
    () => ({
      coreBolt: new MeshBasicMaterial({
        color: '#a8e6ff',
        transparent: true,
        blending: AdditiveBlending,
      }),
      secondaryBolt: new MeshBasicMaterial({
        color: '#44aaff',
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
      }),
      impact: new MeshBasicMaterial({
        color: '#cfefff',
        transparent: true,
        blending: AdditiveBlending,
      }),
      particle: new MeshStandardMaterial({
        color: '#88ccff',
        emissive: '#44aaff',
        emissiveIntensity: 0.85,
        transparent: true,
        blending: AdditiveBlending,
      }),
      ringImpact: [
        new MeshBasicMaterial({
          color: '#a8e6ff',
          transparent: true,
          blending: AdditiveBlending,
        }),
        new MeshBasicMaterial({
          color: '#66bfff',
          transparent: true,
          blending: AdditiveBlending,
        }),
        new MeshBasicMaterial({
          color: '#44aaff',
          transparent: true,
          blending: AdditiveBlending,
        }),
      ],
    }),
    []
  );

  useFrame(() => {
    const now = Date.now();

    if (phase === 'warning') {
      if (now >= strikeAt && strikeStartRef.current === null) {
        strikeStartRef.current = now;
        setPhase('strike');
      }
      return;
    }

    const start = strikeStartRef.current ?? now;
    const progress = Math.min((now - start) / (STRIKE_DURATION_S * 1000), 1);
    flickerRef.current = 0.8 + Math.random() * 0.4;

    if (progress >= IMPACT_AT_PROGRESS && !impactDoneRef.current) {
      impactDoneRef.current = true;
      onImpact(damage, impactPos);
    }

    const fadeOut = 1.0 * (1 - progress) * flickerRef.current;
    materials.coreBolt.opacity = fadeOut;
    materials.secondaryBolt.opacity = fadeOut * 0.85;
    materials.impact.opacity = fadeOut * 0.9;
    materials.particle.opacity = fadeOut;

    materials.ringImpact.forEach((mat, i) => {
      mat.opacity = (0.8 - i * 0.15) * (1 - progress) * fadeOut;
    });

    if (lightRef.current) {
      lightRef.current.intensity = 22 * (1 - progress) * flickerRef.current;
    }

    if (progress >= 1 && !completeDoneRef.current) {
      completeDoneRef.current = true;
      onComplete();
    }
  });

  return (
    <>
      {phase === 'warning' && (
        <group position={[impactPos.x, TELEGRAPH_Y, impactPos.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={warningRing} />
            <meshBasicMaterial
              color="#44aaff"
              transparent
              opacity={0.5}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={innerPulse} />
            <meshBasicMaterial
              color="#88ccff"
              transparent
              opacity={0.45}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {phase === 'strike' && (
        <group>
          {branches.map((branch, branchIdx) => (
            <group key={branchIdx}>
              {branch.points.map((point, idx) =>
                idx < branch.points.length - 1 ? (
                  <mesh
                    key={idx}
                    position={point.toArray()}
                    geometry={geometries.bolt}
                    material={branch.isCoreStrike ? materials.coreBolt : materials.secondaryBolt}
                    scale={[branch.thickness, branch.thickness, branch.thickness]}
                  />
                ) : null
              )}
            </group>
          ))}

          <group position={impactPos.toArray()}>
            <mesh geometry={geometries.impact} material={materials.impact} scale={[1, 1, 1]} />

            {[1, 1.4, 1.8].map((size, i) => (
              <mesh
                key={i}
                material={materials.ringImpact[i]}
                rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
              >
                <ringGeometry args={[size, size + 0.2, 32]} />
              </mesh>
            ))}

            <pointLight
              ref={lightRef}
              color="#a8e6ff"
              intensity={22}
              distance={8}
              decay={2}
            />
          </group>

          {[...Array(12)].map((_, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const spinAngle = angle + Date.now() * 0.008;
            const r = 1.2 + Math.sin(Date.now() * 0.01 + i) * 0.3;
            const height = Math.sin(Date.now() * 0.007 + i * 0.8) * 0.8;

            return (
              <mesh
                key={`lightning-particle-${i}`}
                position={[
                  impactPos.x + Math.sin(spinAngle) * r,
                  impactPos.y + height + 0.5,
                  impactPos.z + Math.cos(spinAngle) * r,
                ]}
                rotation={[Date.now() * 0.01 + i, Date.now() * 0.008 + i, Date.now() * 0.006 + i]}
                geometry={geometries.particle}
                material={materials.particle}
              />
            );
          })}

          {[...Array(8)].map((_, i) => {
            const angle = (i / 8) * Math.PI * 2 + Date.now() * 0.003;
            const r = 0.6;
            const height = 0.8 + Math.sin(Date.now() * 0.005 + i) * 0.4;

            return (
              <mesh
                key={`floating-particle-${i}`}
                position={[
                  impactPos.x + Math.sin(angle) * r,
                  impactPos.y + height,
                  impactPos.z + Math.cos(angle) * r,
                ]}
                rotation={[Date.now() * 0.008 + i * 0.5, Date.now() * 0.006 + i * 0.3, Date.now() * 0.004 + i * 0.7]}
                geometry={geometries.particle}
                material={materials.particle}
                scale={[0.6, 0.6, 0.6]}
              />
            );
          })}
        </group>
      )}
    </>
  );
}
