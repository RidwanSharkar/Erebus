import React, { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface RejuvenatingShotHealingEffectProps {
  position: Vector3;
  onComplete: () => void;
}

const PARTICLE_COUNT = 16;
const CROSS_COUNT = 6;
const DURATION = 1.2;

const RejuvenatingShotHealingEffect: React.FC<RejuvenatingShotHealingEffectProps> = React.memo(({ position, onComplete }) => {
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const primaryColor = '#00ffaa';
  const secondaryColor = '#00ff77';
  const coreColor = '#ffffff';

  const healLight = useDynamicLight({ color: primaryColor, distance: 6, decay: 2, priority: 1 });

  const ringRefs = useRef<(Mesh | null)[]>([]);
  const coreSphereRef = useRef<Mesh>(null);
  const outerSphereRef = useRef<Mesh>(null);
  const particleRefs = useRef<(Mesh | null)[]>([]);
  const crossGroupRefs = useRef<(Group | null)[]>([]);
  const groundRingRef = useRef<Mesh>(null);

  const ringGeos = useMemo(
    () => [0, 1, 2].map((i) => new TorusGeometry(0.7 - i * 0.15, 0.06, 16, 32)),
    [],
  );
  const coreSphereGeo = useMemo(() => new SphereGeometry(0.4, 32, 32), []);
  const outerSphereGeo = useMemo(() => new SphereGeometry(0.6, 32, 32), []);
  const particleGeo = useMemo(() => new SphereGeometry(0.08, 8, 8), []);
  const crossHGeo = useMemo(() => new BoxGeometry(0.15, 0.03, 0.03), []);
  const crossVGeo = useMemo(() => new BoxGeometry(0.03, 0.15, 0.03), []);
  const groundRingGeo = useMemo(() => new RingGeometry(0.5, 0.8, 32), []);

  const ringMats = useMemo(
    () =>
      [0, 1, 2].map(
        (i) =>
          new MeshStandardMaterial({
            color: i === 0 ? coreColor : primaryColor,
            emissive: secondaryColor,
            emissiveIntensity: i === 0 ? 3 : 2.5,
            transparent: true,
            opacity: 0,
            toneMapped: false,
          }),
      ),
    [],
  );
  const coreSphereMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: coreColor,
        emissive: coreColor,
        emissiveIntensity: 4,
        transparent: true,
        opacity: 0,
        toneMapped: false,
      }),
    [],
  );
  const outerSphereMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: primaryColor,
        emissive: secondaryColor,
        emissiveIntensity: 3,
        transparent: true,
        opacity: 0,
        toneMapped: false,
      }),
    [],
  );
  const particleMats = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) =>
        new MeshStandardMaterial({
          color: i % 3 === 0 ? coreColor : primaryColor,
          emissive: i % 3 === 0 ? coreColor : secondaryColor,
          emissiveIntensity: i % 3 === 0 ? 4 : 3,
          transparent: true,
          opacity: 0,
          toneMapped: false,
        }),
      ),
    [],
  );
  const crossMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: coreColor,
        emissive: coreColor,
        emissiveIntensity: 3.5,
        transparent: true,
        opacity: 0,
        toneMapped: false,
      }),
    [],
  );
  const groundRingMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: primaryColor,
        emissive: secondaryColor,
        emissiveIntensity: 2.5,
        transparent: true,
        opacity: 0,
        side: DoubleSide,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      ringGeos.forEach((g) => g.dispose());
      coreSphereGeo.dispose();
      outerSphereGeo.dispose();
      particleGeo.dispose();
      crossHGeo.dispose();
      crossVGeo.dispose();
      groundRingGeo.dispose();
      ringMats.forEach((m) => m.dispose());
      coreSphereMat.dispose();
      outerSphereMat.dispose();
      particleMats.forEach((m) => m.dispose());
      crossMat.dispose();
      groundRingMat.dispose();
    };
  }, [
    ringGeos,
    coreSphereGeo,
    outerSphereGeo,
    particleGeo,
    crossHGeo,
    crossVGeo,
    groundRingGeo,
    ringMats,
    coreSphereMat,
    outerSphereMat,
    particleMats,
    crossMat,
    groundRingMat,
  ]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const time = timeRef.current;

    if (time >= DURATION && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }

    const progress = time / DURATION;
    const opacity = Math.sin(progress * Math.PI);
    const scale = 1 + progress * 1.5;

    healLight.current?.setPosition(position.x, position.y, position.z);
    healLight.current?.setIntensity(4 * opacity);

    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      ring.position.y = progress * 2.5 + i * 0.4;
      ring.rotation.set(Math.PI / 2, 0, time * 3);
      ringMats[i].opacity = opacity * (1 - i * 0.2);
    });

    if (coreSphereRef.current) {
      const s = scale * 0.8;
      coreSphereRef.current.scale.set(s, s, s);
    }
    coreSphereMat.opacity = opacity * 0.6;

    if (outerSphereRef.current) {
      outerSphereRef.current.scale.set(scale, scale, scale);
    }
    outerSphereMat.opacity = opacity * 0.4;

    particleRefs.current.forEach((particle, i) => {
      if (!particle) return;
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const radius = 0.6 + progress * 0.5;
      const yOffset = progress * 2.5 + (i / PARTICLE_COUNT) * 0.8;
      particle.position.set(
        Math.cos(angle + time * 4) * radius,
        yOffset + Math.sin(time * 5 + i) * 0.3,
        Math.sin(angle + time * 4) * radius,
      );
      particleMats[i].opacity = opacity * 0.9;
    });

    crossGroupRefs.current.forEach((group, i) => {
      if (!group) return;
      const angle = (i / CROSS_COUNT) * Math.PI * 2 + time * 2;
      const radius = 1 + progress * 0.3;
      const yOffset = progress * 2 + Math.sin(time * 3 + i) * 0.4;
      group.position.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius);
      group.rotation.set(0, angle, 0);
    });
    crossMat.opacity = opacity * 0.8;

    if (groundRingRef.current) {
      groundRingRef.current.scale.set(scale, scale, 1);
    }
    groundRingMat.opacity = opacity * 0.5;
  });

  return (
    <group position={position.toArray()}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={`ring-${i}`}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          geometry={ringGeos[i]}
          material={ringMats[i]}
        />
      ))}

      <mesh ref={coreSphereRef} geometry={coreSphereGeo} material={coreSphereMat} />

      <mesh ref={outerSphereRef} geometry={outerSphereGeo} material={outerSphereMat} />

      {Array.from({ length: PARTICLE_COUNT }, (_, i) => (
        <mesh
          key={`particle-${i}`}
          ref={(el) => {
            particleRefs.current[i] = el;
          }}
          geometry={particleGeo}
          material={particleMats[i]}
        />
      ))}

      {Array.from({ length: CROSS_COUNT }, (_, i) => (
        <group
          key={`cross-${i}`}
          ref={(el) => {
            crossGroupRefs.current[i] = el;
          }}
        >
          <mesh geometry={crossHGeo} material={crossMat} />
          <mesh geometry={crossVGeo} material={crossMat} />
        </group>
      ))}

      <mesh
        ref={groundRingRef}
        position={[0, 0.05, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={groundRingGeo}
        material={groundRingMat}
      />
    </group>
  );
});

RejuvenatingShotHealingEffect.displayName = 'RejuvenatingShotHealingEffect';

export default RejuvenatingShotHealingEffect;
