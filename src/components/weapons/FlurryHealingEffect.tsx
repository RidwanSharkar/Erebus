import React, { useEffect, useMemo, useRef } from 'react';
import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface FlurryHealingEffectProps {
  position: Vector3;
  onComplete: () => void;
}

const PARTICLE_COUNT = 24;
const CROSS_COUNT = 8;
const DURATION = 0.8;

const FlurryHealingEffect: React.FC<FlurryHealingEffectProps> = React.memo(({ position, onComplete }) => {
  const timeRef = useRef(0);
  const doneRef = useRef(false);

  const primaryColor = '#00ff88';
  const secondaryColor = '#44ffaa';
  const coreColor = '#ffffff';
  const accentColor = '#00ffcc';

  const primaryLight = useDynamicLight({ color: primaryColor, distance: 6, decay: 2, priority: 1 });
  const coreLight = useDynamicLight({ color: coreColor, distance: 4, decay: 2, priority: 1 });
  const accentLight = useDynamicLight({ color: accentColor, distance: 5, decay: 2, priority: 1 });

  const ringRefs = useRef<(Mesh | null)[]>([]);
  const particleRefs = useRef<(Mesh | null)[]>([]);
  const crossGroupRefs = useRef<(Group | null)[]>([]);

  const ringGeos = useMemo(
    () => [0, 1, 2, 3].map((i) => new TorusGeometry(0.5 - i * 0.08, 0.04, 12, 24)),
    [],
  );
  const particleGeo = useMemo(() => new SphereGeometry(0.06, 8, 8), []);
  const crossHGeo = useMemo(() => new BoxGeometry(0.12, 0.025, 0.025), []);
  const crossVGeo = useMemo(() => new BoxGeometry(0.025, 0.12, 0.025), []);

  const ringMats = useMemo(
    () =>
      [0, 1, 2, 3].map(
        (i) =>
          new MeshStandardMaterial({
            color: i % 2 === 0 ? primaryColor : accentColor,
            emissive: i % 2 === 0 ? secondaryColor : primaryColor,
            emissiveIntensity: 3.5,
            transparent: true,
            opacity: 0,
            toneMapped: false,
          }),
      ),
    [],
  );
  const particleMats = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, i) =>
        new MeshStandardMaterial({
          color: i % 4 === 0 ? coreColor : i % 3 === 0 ? accentColor : primaryColor,
          emissive: i % 4 === 0 ? coreColor : secondaryColor,
          emissiveIntensity: 4,
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
        emissive: primaryColor,
        emissiveIntensity: 4,
        transparent: true,
        opacity: 0,
        toneMapped: false,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      ringGeos.forEach((g) => g.dispose());
      particleGeo.dispose();
      crossHGeo.dispose();
      crossVGeo.dispose();
      ringMats.forEach((m) => m.dispose());
      particleMats.forEach((m) => m.dispose());
      crossMat.dispose();
    };
  }, [ringGeos, particleGeo, crossHGeo, crossVGeo, ringMats, particleMats, crossMat]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const time = timeRef.current;

    if (time >= DURATION && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }

    const progress = time / DURATION;
    const opacity = Math.sin(progress * Math.PI);

    primaryLight.current?.setPosition(position.x, position.y, position.z);
    primaryLight.current?.setIntensity(5 * opacity);

    coreLight.current?.setPosition(position.x, position.y + progress * 1.5, position.z);
    coreLight.current?.setIntensity(4 * opacity);

    accentLight.current?.setPosition(position.x, position.y + 0.5, position.z);
    accentLight.current?.setIntensity(3 * opacity);

    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      ring.position.y = progress * 1.5 + i * 0.2;
      ring.rotation.set(Math.PI / 2, 0, time * 8 * (i % 2 === 0 ? 1 : -1));
      ringMats[i].opacity = opacity * (1 - i * 0.15);
    });

    particleRefs.current.forEach((particle, i) => {
      if (!particle) return;
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
      const spiralSpeed = 12;
      const radius = 0.4 + progress * 0.3;
      const yOffset = progress * 1.5 + Math.sin(time * 8 + i * 0.5) * 0.2;
      particle.position.set(
        Math.cos(angle + time * spiralSpeed) * radius,
        yOffset,
        Math.sin(angle + time * spiralSpeed) * radius,
      );
      particleMats[i].opacity = opacity * 0.9;
    });

    crossGroupRefs.current.forEach((group, i) => {
      if (!group) return;
      const angle = (i / CROSS_COUNT) * Math.PI * 2 + time * 6;
      const radius = 0.7 + progress * 0.2;
      const yOffset = progress * 1.8 + Math.sin(time * 6 + i) * 0.3;
      group.position.set(Math.cos(angle) * radius, yOffset, Math.sin(angle) * radius);
      group.rotation.set(0, time * 4, 0);
    });
    crossMat.opacity = opacity * 0.85;
  });

  return (
    <group position={position.toArray()}>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`ring-${i}`}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          geometry={ringGeos[i]}
          material={ringMats[i]}
        />
      ))}

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
    </group>
  );
});

FlurryHealingEffect.displayName = 'FlurryHealingEffect';

export default FlurryHealingEffect;
