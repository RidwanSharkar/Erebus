'use client';

import { useRef, useMemo, useEffect } from 'react';
import {
  Group,
  Vector3,
  Euler,
  CylinderGeometry,
  TorusGeometry,
  SphereGeometry,
  RingGeometry,
  CircleGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  AdditiveBlending,
  DoubleSide,
  Color,
  Mesh,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const DURATION = 0.95;
const STRIKE_PROGRESS = 0.62;

interface TemplarBlinkSmiteGroundProps {
  position: Vector3;
  onComplete: () => void;
}

/** Visual-only enemy Smite: Runeblade-style sky strike with a deep red Templar palette. */
export default function TemplarBlinkSmiteGround({ position, onComplete }: TemplarBlinkSmiteGroundProps) {
  const lightningRef = useRef<Group>(null);
  const tRef = useRef(0);
  const doneRef = useRef(false);
  const burstTRef = useRef(0);
  const burstStartedRef = useRef(false);
  const burstRingRef = useRef<Mesh>(null);
  const burstCoreRef = useRef<Mesh>(null);

  const primaryColor = useMemo(() => new Color('#7f0505'), []);
  const secondaryColor = useMemo(() => new Color('#ff2a1a'), []);
  const burstPointColor = useMemo(() => primaryColor.clone().lerp(secondaryColor, 0.45), [primaryColor, secondaryColor]);

  // Pooled lights replace the mounted <pointLight>s: one follows the falling beam
  // (collapses the 2 beam lights → 1), one for the ground burst flash.
  const beamLight = useDynamicLight({ color: primaryColor, distance: 28, decay: 2, priority: 1 });
  const burstLight = useDynamicLight({ color: burstPointColor, distance: 11, decay: 2, priority: 1 });

  const geometries = useMemo(() => ({
    core: new CylinderGeometry(0.055, 0.055, 20, 20),
    inner: new CylinderGeometry(0.14, 0.12, 20, 20),
    outer: new CylinderGeometry(0.26, 0.24, 20, 18),
    glow1: new CylinderGeometry(0.3, 0.32, 20, 16),
    glow2: new CylinderGeometry(0.34, 0.36, 20, 16),
    outerGlow: new CylinderGeometry(0.38, 0.48, 20, 16),
    torus: new TorusGeometry(0.65, 0.055, 8, 32),
    skyTorus: new TorusGeometry(0.5, 0.055, 32, 32),
    sphere: new SphereGeometry(0.1, 8, 8),
    burstRing: new RingGeometry(0.1, 0.38, 40),
    burstCore: new CircleGeometry(0.58, 24),
  }), []);

  const materials = useMemo(() => ({
    core: new MeshStandardMaterial({
      color: secondaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 64,
      transparent: true,
      opacity: 0.998,
    }),
    inner: new MeshStandardMaterial({
      color: secondaryColor,
      emissive: primaryColor,
      emissiveIntensity: 42,
      transparent: true,
      opacity: 0.7,
    }),
    outer: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 24,
      transparent: true,
      opacity: 0.6,
    }),
    glow1: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 5.5,
      transparent: true,
      opacity: 0.5,
    }),
    glow2: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 4.2,
      transparent: true,
      opacity: 0.4,
    }),
    outerGlow: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 1.8,
      transparent: true,
      opacity: 0.18,
    }),
    spiral: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 12,
      transparent: true,
      opacity: 0.48,
    }),
    skySpiral: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 11,
      transparent: true,
      opacity: 0.36,
    }),
    particle: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 12,
      transparent: true,
      opacity: 0.62,
    }),
    burstRing: new MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    }),
    burstCore: new MeshBasicMaterial({
      color: secondaryColor,
      transparent: true,
      opacity: 0,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    }),
  }), [primaryColor, secondaryColor]);

  const spiralPositions = useMemo(() => (
    Array(3).fill(0).map((_, i) => ({
      rotation: new Euler(Math.PI / 4, (i * Math.PI) / 1.5, Math.PI),
    }))
  ), []);

  const skySpiralPositions = useMemo(() => (
    Array(10).fill(0).map((_, i) => ({
      rotation: new Euler(0, (i * Math.PI) / 1.5, 0),
      position: new Vector3(0, 5.5, 0),
    }))
  ), []);

  const particlePositions = useMemo(() => (
    Array(6).fill(0).map((_, i) => ({
      position: new Vector3(
        Math.cos((i * Math.PI) / 3) * 0.45,
        (i - 3) * 1.35,
        Math.sin((i * Math.PI) / 3) * 0.45,
      ),
    }))
  ), []);

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    };
  }, [geometries, materials]);

  useFrame((_, delta) => {
    tRef.current += delta;
    const p = Math.min(tRef.current / DURATION, 1);

    if (lightningRef.current) {
      const startY = position.y + 40;
      const targetY = position.y;
      lightningRef.current.position.y = startY + (targetY - startY) * Math.min(p / STRIKE_PROGRESS, 1);
      const scale = p < 0.9 ? 1 : 1 - (p - 0.9) / 0.1;
      lightningRef.current.scale.set(scale, scale, scale);

      // Beam light follows the descending lightning group (collapsed from 2 lights).
      beamLight.current?.setPosition(position.x, lightningRef.current.position.y, position.z);
      beamLight.current?.setIntensity(44);
    }

    if (p >= STRIKE_PROGRESS) {
      burstStartedRef.current = true;
    }

    if (burstStartedRef.current) {
      burstTRef.current = Math.min(burstTRef.current + delta * 3.8, 1);
      const bt = burstTRef.current;
      const easeOut = 1 - Math.pow(1 - bt, 2);
      if (burstRingRef.current) {
        const s = 0.35 + easeOut * 2.4;
        burstRingRef.current.scale.set(s, s, 1);
        const m = burstRingRef.current.material as MeshBasicMaterial;
        m.opacity = 0.85 * (1 - bt);
      }
      if (burstCoreRef.current) {
        const cs = 0.2 + easeOut * 2.2;
        burstCoreRef.current.scale.set(cs, cs, 1);
        const m = burstCoreRef.current.material as MeshBasicMaterial;
        m.opacity = 0.7 * (1 - Math.min(bt * 1.4, 1));
      }
      // Ground burst flash, at the burst group's world position (local 0.15 * scale 1.55).
      burstLight.current?.setPosition(position.x, position.y + 1.25 + 0.15 * 1.55, position.z);
      burstLight.current?.setIntensity(30 * (1 - bt));
      burstLight.current?.setDistance(5 + easeOut * 4);
    }

    if (p >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group>
      <group ref={lightningRef} position={[position.x, position.y + 40, position.z]}>
        <mesh geometry={geometries.core} material={materials.core} />
        <mesh geometry={geometries.inner} material={materials.inner} />
        <mesh geometry={geometries.outer} material={materials.outer} />
        <mesh geometry={geometries.glow1} material={materials.glow1} />
        <mesh geometry={geometries.glow2} material={materials.glow2} />
        <mesh geometry={geometries.outerGlow} material={materials.outerGlow} />

        {spiralPositions.map((props, i) => (
          <mesh key={`templar-smite-spiral-${i}`} rotation={props.rotation} geometry={geometries.torus} material={materials.spiral} />
        ))}

        {skySpiralPositions.map((props, i) => (
          <mesh
            key={`templar-smite-sky-spiral-${i}`}
            rotation={props.rotation}
            position={props.position}
            geometry={geometries.skyTorus}
            material={materials.skySpiral}
          />
        ))}

        {particlePositions.map((props, i) => (
          <mesh key={`templar-smite-particle-${i}`} position={props.position} geometry={geometries.sphere} material={materials.particle} />
        ))}
      </group>

      <group position={[position.x, position.y + 1.25, position.z]} scale={[1.55, 1.55, 1.55]}>
        <mesh
          ref={burstRingRef}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.001, 0.001, 1]}
          geometry={geometries.burstRing}
          material={materials.burstRing}
          renderOrder={1}
        />
        <mesh
          ref={burstCoreRef}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[0.001, 0.001, 1]}
          geometry={geometries.burstCore}
          material={materials.burstCore}
          renderOrder={2}
        />
      </group>
    </group>
  );
}
