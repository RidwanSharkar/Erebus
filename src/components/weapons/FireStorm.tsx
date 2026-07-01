import React, { useRef, useEffect, useMemo } from 'react';
import {
  Group,
  Vector3,
  Color,
  Mesh,
  MeshStandardMaterial,
  AdditiveBlending,
  DoubleSide,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const FIRE_STORM_LIGHT_COLOR = new Color('#FF6B35');
const ORBIT_PARTICLE_COUNT = 14;
const TOP_SWIRL_COUNT = 8;
const RING_COUNT = 4;

interface FireStormProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  visualScale?: number;
  onComplete?: () => void;
}

export default function FireStorm({
  position,
  duration = 700,
  startTime = Date.now(),
  visualScale = 1.0,
  onComplete,
}: FireStormProps) {
  const effectRef = useRef<Group>(null);
  const tornadoRef = useRef<Group>(null);
  const coneRef = useRef<Mesh>(null);
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const orbitRefs = useRef<(Mesh | null)[]>([]);
  const topSwirlRefs = useRef<(Mesh | null)[]>([]);
  const fadeRef = useRef(1);
  const expansionRef = useRef(0.15);
  const rotationSpeed = useRef(0.42);
  const completedRef = useRef(false);

  const stormLight = useDynamicLight({ color: FIRE_STORM_LIGHT_COLOR, priority: 1 });

  const coneMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#FF8C42',
        emissive: '#FF4500',
        emissiveIntensity: 0.55,
        transparent: true,
        opacity: 0.55,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [],
  );

  const ringMats = useMemo(
    () =>
      Array.from({ length: RING_COUNT }, (_, i) =>
        new MeshStandardMaterial({
          color: i % 2 === 0 ? '#FFD166' : '#FF8C42',
          emissive: '#FF6B35',
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.65 - i * 0.1,
          blending: AdditiveBlending,
        }),
      ),
    [],
  );

  const orbitMats = useMemo(
    () =>
      Array.from({ length: ORBIT_PARTICLE_COUNT }, () =>
        new MeshStandardMaterial({
          color: '#FFE066',
          emissive: '#FF8C42',
          emissiveIntensity: 0.85,
          transparent: true,
          opacity: 0.9,
          blending: AdditiveBlending,
        }),
      ),
    [],
  );

  const topSwirlMats = useMemo(
    () =>
      Array.from({ length: TOP_SWIRL_COUNT }, () =>
        new MeshStandardMaterial({
          color: '#FFE066',
          emissive: '#FFD166',
          emissiveIntensity: 0.7,
          transparent: true,
          opacity: 0.75,
          blending: AdditiveBlending,
        }),
      ),
    [],
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      onComplete?.();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete]);

  useEffect(() => {
    const mats = [...ringMats, coneMat, ...orbitMats, ...topSwirlMats];
    return () => {
      coneMat.dispose();
      mats.forEach((m) => m.dispose());
      if (effectRef.current) {
        effectRef.current.traverse((child) => {
          if (child instanceof Mesh) {
            if (child.geometry) child.geometry.dispose();
          }
        });
      }
    };
  }, [coneMat, ringMats, orbitMats, topSwirlMats]);

  const applyFade = (fade: number, intensity: number) => {
    if (coneRef.current?.material) {
      const mat = coneRef.current.material as MeshStandardMaterial;
      mat.opacity = 0.55 * fade;
      mat.emissiveIntensity = 0.55 * intensity * fade;
    }
    ringRefs.current.forEach((mesh, i) => {
      if (!mesh?.material) return;
      const mat = mesh.material as MeshStandardMaterial;
      mat.opacity = (0.65 - i * 0.1) * fade;
      mat.emissiveIntensity = 0.5 * intensity * fade;
    });
    orbitRefs.current.forEach((mesh, i) => {
      if (!mesh?.material) return;
      const mat = mesh.material as MeshStandardMaterial;
      mat.opacity = 0.9 * fade;
      mat.emissiveIntensity = 0.85 * intensity * fade;
    });
    topSwirlRefs.current.forEach((mesh) => {
      if (!mesh?.material) return;
      const mat = mesh.material as MeshStandardMaterial;
      mat.opacity = 0.75 * fade;
      mat.emissiveIntensity = 0.7 * intensity * fade;
    });
  };

  useFrame((_, delta) => {
    if (!effectRef.current) return;

    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    if (progress >= 1) {
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete?.();
      }
      return;
    }

    let frameExpansionProgress: number;
    if (progress < 0.25) {
      frameExpansionProgress = progress / 0.25;
    } else {
      frameExpansionProgress = 1;
    }

    let frameFadeProgress: number;
    if (progress > 0.45) {
      const fadePhase = (progress - 0.45) / (1 - 0.45);
      frameFadeProgress = 1 - fadePhase;
    } else {
      frameFadeProgress = 1;
    }

    fadeRef.current = frameFadeProgress;
    expansionRef.current = 0.15 + frameExpansionProgress * 0.95;

    const pulseIntensity = 0.75 + 0.25 * Math.sin(elapsed * 0.02);
    const frameIntensity = pulseIntensity * frameFadeProgress;
    const frameBaseScale = expansionRef.current;

    stormLight.current?.setPosition(position.x, position.y + 0.75, position.z);
    stormLight.current?.setIntensity(5.5 * frameIntensity);
    stormLight.current?.setDistance(frameBaseScale * 1.8);

    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.004) * 0.12;

    if (tornadoRef.current) {
      tornadoRef.current.scale.setScalar(frameBaseScale);
    }

    ringRefs.current.forEach((mesh, ringIndex) => {
      if (!mesh) return;
      mesh.rotation.z = elapsed * 0.005 + ringIndex * (Math.PI / 3);
    });

    const timeSec = elapsed * 0.001;
    orbitRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const angle = (i / ORBIT_PARTICLE_COUNT) * Math.PI * 2 + timeSec * 2.8;
      const radius = 0.55 + Math.sin(timeSec * 8 + i) * 0.15;
      const height = Math.sin(timeSec * 6 + i * 0.5) * 0.45 + 0.85;
      mesh.position.set(Math.sin(angle) * radius, height, Math.cos(angle) * radius);
    });

    topSwirlRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const angle = (i / TOP_SWIRL_COUNT) * Math.PI * 2 + timeSec * 3.2;
      const radius = 0.18;
      mesh.position.set(Math.sin(angle) * radius, 0.65, Math.cos(angle) * radius);
    });

    applyFade(frameFadeProgress, frameIntensity);
  });

  return (
    <group ref={effectRef} position={position} scale={[visualScale, visualScale, visualScale]}>
      <group ref={tornadoRef} scale={[0.15, 0.15, 0.15]}>
        <mesh ref={coneRef} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.85, 2.4, 8, 1, true]} />
          <primitive object={coneMat} attach="material" />
        </mesh>

        {Array.from({ length: RING_COUNT }).map((_, ringIndex) => {
          const heightOffset = (ringIndex - 0.5) * 0.45;
          return (
            <mesh
              key={`fire-ring-${ringIndex}`}
              ref={(el) => {
                ringRefs.current[ringIndex] = el;
              }}
              position={[0, heightOffset, 0]}
              rotation={[Math.PI / 2, 0, ringIndex * (Math.PI / 4)]}
            >
              <torusGeometry args={[0.42 + ringIndex * 0.14, 0.05, 10, 20]} />
              <primitive object={ringMats[ringIndex]} attach="material" />
            </mesh>
          );
        })}

        {Array.from({ length: ORBIT_PARTICLE_COUNT }).map((_, i) => (
          <mesh
            key={`orbit-${i}`}
            ref={(el) => {
              orbitRefs.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.04, 6, 6]} />
            <primitive object={orbitMats[i]} attach="material" />
          </mesh>
        ))}

        {Array.from({ length: TOP_SWIRL_COUNT }).map((_, i) => (
          <mesh
            key={`top-${i}`}
            ref={(el) => {
              topSwirlRefs.current[i] = el;
            }}
          >
            <sphereGeometry args={[0.045, 6, 6]} />
            <primitive object={topSwirlMats[i]} attach="material" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
