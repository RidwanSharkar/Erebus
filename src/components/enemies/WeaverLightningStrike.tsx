'use client';

import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  SphereGeometry,
  OctahedronGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  AdditiveBlending,
  RingGeometry,
  DoubleSide,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import DirectionalProcLightning, { type DirectionalProcLightningPalette } from './DirectionalProcLightning';

interface WeaverLightningStrikeProps {
  targetPosition: Vector3;
  /** Unix ms when the bolt hits and damage is resolved */
  strikeAt: number;
  damage: number;
  radius: number;
  theme?: 'blue' | 'green';
  onImpact: (damage: number, position: Vector3) => void;
  onComplete: () => void;
}

const TELEGRAPH_Y = 0.18;
const STRIKE_DURATION_S = 1.0;
const IMPACT_AT_PROGRESS = 0.6;
const RING_SEGMENTS = 6;
const SKY_Y = 24;

const BLUE_PALETTE: DirectionalProcLightningPalette = {
  core: '#c8e8ff',
  glow: '#1a8fd4',
  halo: '#2899e8',
  light: '#6eb8f0',
};

const GREEN_PALETTE: DirectionalProcLightningPalette = {
  core: '#d4ffe8',
  glow: '#00cc55',
  halo: '#00ff66',
  light: '#33ff88',
};

const BLUE_THEME = {
  palette: BLUE_PALETTE,
  ringOuter: '#44aaff',
  ringInner: '#88ccff',
  warningRing: '#3388dd',
  warningInner: '#66aaff',
  impactSphere: '#c8e8ff',
  particle: '#88ccff',
  particleEmissive: '#44aaff',
  strikeLightColor: '#6eb8f0',
};

const GREEN_THEME = {
  palette: GREEN_PALETTE,
  ringOuter: '#00ff66',
  ringInner: '#66ffaa',
  warningRing: '#00cc44',
  warningInner: '#44ff88',
  impactSphere: '#d4ffe8',
  particle: '#66ffaa',
  particleEmissive: '#00cc55',
  strikeLightColor: '#33ff88',
};

export default function WeaverLightningStrike({
  targetPosition,
  strikeAt,
  damage,
  radius,
  theme = 'blue',
  onImpact,
  onComplete,
}: WeaverLightningStrikeProps) {
  const [phase, setPhase] = useState<'warning' | 'strike'>('warning');
  const strikeStartRef = useRef<number | null>(null);
  const impactDoneRef = useRef(false);
  const completeDoneRef = useRef(false);
  const soundPlayedRef = useRef(false);
  const flickerRef = useRef(1);

  const themeConfig = theme === 'green' ? GREEN_THEME : BLUE_THEME;

  const strikeLight = useDynamicLight({ color: themeConfig.strikeLightColor, distance: 8, priority: 1 });

  const impactPos = useMemo(
    () => new Vector3(targetPosition.x, 0, targetPosition.z),
    [targetPosition.x, targetPosition.z],
  );

  const skyPosition = useMemo(
    () => new Vector3(impactPos.x, impactPos.y + SKY_Y, impactPos.z),
    [impactPos],
  );

  const warningRing = useMemo(() => new RingGeometry(radius - 0.25, radius, RING_SEGMENTS), [radius]);
  const innerPulse = useMemo(() => new RingGeometry(radius - 0.6, radius - 0.4, RING_SEGMENTS), [radius]);

  const geometries = useMemo(
    () => ({
      impact: new SphereGeometry(1, 16, 16),
      particle: new OctahedronGeometry(0.08, 0),
    }),
    [],
  );

  const materials = useMemo(
    () => ({
      impact: new MeshBasicMaterial({
        color: themeConfig.impactSphere,
        transparent: true,
        blending: AdditiveBlending,
      }),
      particle: new MeshStandardMaterial({
        color: themeConfig.particle,
        emissive: themeConfig.particleEmissive,
        emissiveIntensity: 0.85,
        transparent: true,
        blending: AdditiveBlending,
      }),
      ringImpact: [
        new MeshBasicMaterial({ color: themeConfig.ringOuter, transparent: true, blending: AdditiveBlending }),
        new MeshBasicMaterial({ color: themeConfig.ringInner, transparent: true, blending: AdditiveBlending }),
        new MeshBasicMaterial({ color: themeConfig.ringOuter, transparent: true, blending: AdditiveBlending }),
      ],
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    return () => {
      warningRing.dispose();
      innerPulse.dispose();
      Object.values(geometries).forEach((g) => g.dispose());
      materials.impact.dispose();
      materials.particle.dispose();
      materials.ringImpact.forEach((m) => m.dispose());
    };
  }, [warningRing, innerPulse, geometries, materials]);

  useFrame(() => {
    const now = Date.now();

    if (phase === 'warning') {
      strikeLight.current?.setIntensity(0);
      if (now >= strikeAt && strikeStartRef.current === null) {
        strikeStartRef.current = now;
        setPhase('strike');
        if (!soundPlayedRef.current) {
          soundPlayedRef.current = true;
          (window as any).audioSystem?.playLightningBoltSound?.(impactPos);
        }
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
    materials.impact.opacity = fadeOut * 0.9;
    materials.particle.opacity = fadeOut;

    materials.ringImpact.forEach((mat, i) => {
      mat.opacity = (0.8 - i * 0.15) * (1 - progress) * fadeOut;
    });

    strikeLight.current?.setPosition(impactPos.x, impactPos.y, impactPos.z);
    strikeLight.current?.setIntensity(22 * (1 - progress) * flickerRef.current);

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
              color={themeConfig.warningRing}
              transparent
              opacity={0.5}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={innerPulse} />
            <meshBasicMaterial
              color={themeConfig.warningInner}
              transparent
              opacity={0.45}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {phase === 'strike' && (
        <>
          <DirectionalProcLightning
            from={skyPosition}
            to={impactPos}
            palette={themeConfig.palette}
            durationMs={620}
            suppressImpactLight
            onComplete={() => {}}
          />

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
        </>
      )}
    </>
  );
}
