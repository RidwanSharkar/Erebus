'use client';

import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Vector3,
  CircleGeometry,
  RingGeometry,
  CylinderGeometry,
  MeshStandardMaterial,
  Color,
  Group,
} from '../../utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface GhoulSummonRitualProps {
  position: Vector3;
  onComplete: () => void;
}

const DURATION = 6; // seconds — covers the full ghoul_summon animation (+2s extended)

/** Local geometry scale (matches reference RuneCircle). */
const GEOMETRY_SCALE = 0.35;
/** Outer ring outer radius in local units: 22.5 * GEOMETRY_SCALE */
const OUTER_RING_MAX_R = 22.5 * GEOMETRY_SCALE;
/** Match prior ritual footprint (~1.5 world units outer radius). */
const RITUAL_WORLD_SCALE = 1.5 / OUTER_RING_MAX_R;

// Green arcane theme (analogous to purple / plum in reference)
const BASE_COLOR = '#166534';
const GLOW_COLOR = '#86efac';

function createDashedRingGeometry(
  innerRadius: number,
  outerRadius: number,
  dashLength: number,
  gapLength: number
): RingGeometry[] {
  const geometries: RingGeometry[] = [];
  const circumference = 2.375 * Math.PI * ((innerRadius + outerRadius) / 2);
  const totalDashGap = dashLength + gapLength;
  const numDashes = Math.floor(circumference / totalDashGap);

  for (let i = 0; i < numDashes; i++) {
    const startAngle = ((i * totalDashGap) / circumference) * 2 * Math.PI;
    const endAngle = startAngle + (dashLength / circumference) * 2 * Math.PI;
    const thetaLength = endAngle - startAngle;
    geometries.push(
      new RingGeometry(innerRadius, outerRadius, 8, 1, startAngle, thetaLength)
    );
  }
  return geometries;
}

// ── Module-level shared geometries ────────────────────────────────────────────
// Created once for the entire session (never mutated, never disposed).
// Each GhoulSummonRitual instance references these, so no synchronous geometry
// allocation happens on mount — eliminating the main-thread hitch at cast start.
const sharedGeometries = (() => {
  const s = GEOMETRY_SCALE;
  return {
    outerRing:      createDashedRingGeometry(20.5 * s, 22.5 * s, 8, 6),
    innerRing:      createDashedRingGeometry(11.5 * s, 12.5 * s, 4, 3),
    expandingRing:  new RingGeometry(20.5 * s, 22.5 * s, 32),
    centerOrb:      new CircleGeometry(1.2 * s, 16),
    marker:         new CylinderGeometry(0.05, 0.05, 1.0, 8),
    rune:           new CircleGeometry(0.15, 8),
  };
})();

export default function GhoulSummonRitual({ position, onComplete }: GhoulSummonRitualProps) {
  const elapsed = useRef(0);
  const completedRef = useRef(false);
  const outerRingRef = useRef<Group>(null);
  const innerRingRef = useRef<Group>(null);
  const rotationRef = useRef(0);

  // Per-instance materials: each ritual instance has its own material set so
  // concurrent rituals can fade independently without interfering with each other.
  const { materials, materialFadeList } = useMemo(() => {
    const makeMat = (
      opacity: number,
      emissiveIntensity: number
    ): MeshStandardMaterial =>
      new MeshStandardMaterial({
        color: new Color(BASE_COLOR),
        transparent: true,
        opacity,
        emissive: new Color(GLOW_COLOR),
        emissiveIntensity,
        side: 2,
        depthWrite: false,
      });

    const outerRingMaterial    = makeMat(0.75, 0.5);
    const innerRingMaterial    = makeMat(0.70, 0.4);
    const centerOrbMaterial    = makeMat(0.85, 0.8);
    const markerMaterial       = makeMat(0.70, 0.4);
    const runeMaterial         = makeMat(0.95, 0.7);
    const expandingRingMaterial = makeMat(0.20, 0.25);

    const materialFadeList = [
      { material: outerRingMaterial,     baseOpacity: 0.75 },
      { material: innerRingMaterial,     baseOpacity: 0.70 },
      { material: centerOrbMaterial,     baseOpacity: 0.85 },
      { material: markerMaterial,        baseOpacity: 0.70 },
      { material: runeMaterial,          baseOpacity: 0.95 },
      { material: expandingRingMaterial, baseOpacity: 0.20 },
    ];

    return {
      materials: {
        outerRing:     outerRingMaterial,
        innerRing:     innerRingMaterial,
        centerOrb:     centerOrbMaterial,
        marker:        markerMaterial,
        rune:          runeMaterial,
        expandingRing: expandingRingMaterial,
      },
      materialFadeList,
    };
  }, []);

  // Dispose only per-instance materials on unmount; shared geometries are session-lived.
  useEffect(() => {
    return () => {
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [materials]);

  const finish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  /** JSX layout scale for marker / rune placement (matches reference). */
  const layoutScaleFactor = 0.4;

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / DURATION);
    const fadeMult = t < 0.7 ? 1 : Math.max(0, (1 - t) * 3.33);

    for (const { material, baseOpacity } of materialFadeList) {
      material.opacity = baseOpacity * fadeMult;
    }

    rotationRef.current += delta * 0.125 * (180 / Math.PI);
    rotationRef.current = rotationRef.current % 360;

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z = (rotationRef.current * Math.PI) / 180;
    }
    if (innerRingRef.current) {
      innerRingRef.current.rotation.z = (-rotationRef.current * 1.3 * Math.PI) / 180;
    }

    if (t >= 1) finish();
  });

  return (
    <group position={[position.x, 0.25, position.z]}>
      <group scale={[RITUAL_WORLD_SCALE, RITUAL_WORLD_SCALE, RITUAL_WORLD_SCALE]}>
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
              const innerRadius = 5 * layoutScaleFactor;
              const outerRadius = 12.75 * layoutScaleFactor;
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
              const innerRadius = 5.75 * layoutScaleFactor;
              const outerRadius = 24 * layoutScaleFactor;
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
          const radius = 4.5 * layoutScaleFactor;
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
