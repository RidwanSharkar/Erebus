'use client';

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import {
  MeshStandardMaterial,
  Color,
  Group,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import {
  RITUAL_WORLD_SCALE,
  sharedGeometries,
} from './ritualCircleGeometries';

export interface ArcaneRitualCircleProps {
  baseColor: string;
  glowColor: string;
  worldScale?: number;
  position?: [number, number, number];
  /** When true, no fade-out — rotation runs indefinitely. */
  persistent?: boolean;
  /** Fade duration in seconds (only used when persistent is false). */
  duration?: number;
  onComplete?: () => void;
}

const DEFAULT_DURATION = 6;

/** JSX layout scale for marker / rune placement (matches reference). */
const LAYOUT_SCALE_FACTOR = 0.4;

export default function ArcaneRitualCircle({
  baseColor,
  glowColor,
  worldScale = RITUAL_WORLD_SCALE,
  position = [0, 0, 0],
  persistent = false,
  duration = DEFAULT_DURATION,
  onComplete,
}: ArcaneRitualCircleProps) {
  const elapsed = useRef(0);
  const completedRef = useRef(false);
  const outerRingRef = useRef<Group>(null);
  const innerRingRef = useRef<Group>(null);
  const rotationRef = useRef(0);

  const { materials, materialFadeList } = useMemo(() => {
    const makeMat = (
      opacity: number,
      emissiveIntensity: number
    ): MeshStandardMaterial =>
      new MeshStandardMaterial({
        color: new Color(baseColor),
        transparent: true,
        opacity,
        emissive: new Color(glowColor),
        emissiveIntensity,
        side: 2,
        depthWrite: false,
      });

    const outerRingMaterial = makeMat(0.75, 0.5);
    const innerRingMaterial = makeMat(0.70, 0.4);
    const centerOrbMaterial = makeMat(0.85, 0.8);
    const markerMaterial = makeMat(0.70, 0.4);
    const runeMaterial = makeMat(0.95, 0.7);
    const expandingRingMaterial = makeMat(0.20, 0.25);

    const materialFadeList = [
      { material: outerRingMaterial, baseOpacity: 0.75 },
      { material: innerRingMaterial, baseOpacity: 0.70 },
      { material: centerOrbMaterial, baseOpacity: 0.85 },
      { material: markerMaterial, baseOpacity: 0.70 },
      { material: runeMaterial, baseOpacity: 0.95 },
      { material: expandingRingMaterial, baseOpacity: 0.20 },
    ];

    return {
      materials: {
        outerRing: outerRingMaterial,
        innerRing: innerRingMaterial,
        centerOrb: centerOrbMaterial,
        marker: markerMaterial,
        rune: runeMaterial,
        expandingRing: expandingRingMaterial,
      },
      materialFadeList,
    };
  }, [baseColor, glowColor]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [materials]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete?.();
  }, [onComplete]);

  useFrame((_, delta) => {
    if (!persistent) {
      elapsed.current += delta;
      const t = Math.min(1, elapsed.current / duration);
      const fadeMult = t < 0.7 ? 1 : Math.max(0, (1 - t) * 3.33);

      for (const { material, baseOpacity } of materialFadeList) {
        material.opacity = baseOpacity * fadeMult;
      }

      if (t >= 1) finish();
    }

    rotationRef.current += delta * 0.125 * (180 / Math.PI);
    rotationRef.current = rotationRef.current % 360;

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = (rotationRef.current * Math.PI) / 180;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = (-rotationRef.current * 1.3 * Math.PI) / 180;
    }
  });

  return (
    <group position={position}>
      <group scale={[worldScale, worldScale, worldScale]}>
        <mesh
          geometry={sharedGeometries.expandingRing}
          material={materials.expandingRing}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
        />

        <mesh
          geometry={sharedGeometries.expandingRing}
          material={materials.expandingRing}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
          scale={[1.25, 1.25, 1.25]}
        />

        <group ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          {sharedGeometries.outerRing.map((geometry, i) => (
            <mesh key={`outer-dash-${i}`} geometry={geometry} material={materials.outerRing} />
          ))}

          <group rotation={[Math.PI / 2, 0, 0]}>
            {[90, 270].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const innerRadius = 5 * LAYOUT_SCALE_FACTOR;
              const outerRadius = 12.75 * LAYOUT_SCALE_FACTOR;
              const midpointRadius = (innerRadius + outerRadius) / 2;
              const x = Math.cos(rad) * midpointRadius;
              const z = Math.sin(rad) * midpointRadius;
              const length = outerRadius - innerRadius;
              return (
                <mesh
                  key={`marker-a-${i}`}
                  geometry={sharedGeometries.marker}
                  material={materials.marker}
                  position={[x, 0.005, z]}
                  rotation={[rad, 0, 0]}
                  scale={[3, length / 2, 1]}
                />
              );
            })}
          </group>

          <group rotation={[Math.PI / 2, Math.PI / 2, 0]}>
            {[90, 270].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const innerRadius = 5.75 * LAYOUT_SCALE_FACTOR;
              const outerRadius = 24 * LAYOUT_SCALE_FACTOR;
              const midpointRadius = (innerRadius + outerRadius) / 2;
              const x = Math.cos(rad) * midpointRadius;
              const z = Math.sin(rad) * midpointRadius;
              const length = outerRadius - innerRadius;
              return (
                <mesh
                  key={`marker-b-${i}`}
                  geometry={sharedGeometries.marker}
                  material={materials.marker}
                  position={[x, 0.005, z]}
                  rotation={[rad, 0, 0]}
                  scale={[4.5, length / 1.9, 1]}
                />
              );
            })}
          </group>
        </group>

        <group ref={innerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]}>
          {sharedGeometries.innerRing.map((geometry, i) => (
            <mesh key={`inner-dash-${i}`} geometry={geometry} material={materials.innerRing} />
          ))}
        </group>

        {[0, 60, 120, 180, 240, 300].map((angle, i) => {
          const rad = (angle * Math.PI) / 180;
          const radius = 4.5 * LAYOUT_SCALE_FACTOR;
          const x = Math.cos(rad) * radius;
          const z = Math.sin(rad) * radius;
          return (
            <mesh
              key={`rune-${i}`}
              geometry={sharedGeometries.rune}
              material={materials.rune}
              position={[x, 0.035, z]}
              rotation={[-Math.PI / 2, 0, 0]}
            />
          );
        })}

        <mesh
          geometry={sharedGeometries.centerOrb}
          material={materials.centerOrb}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.04, 0]}
        />
      </group>
    </group>
  );
}
