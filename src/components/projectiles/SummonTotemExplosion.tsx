import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  AdditiveBlending,
  SphereGeometry,
  TorusGeometry,
  MeshStandardMaterial,
  type Mesh,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface SummonTotemExplosionProps {
  position: Vector3;
  explosionStartTime: number | null;
  onComplete?: () => void;
}

const IMPACT_DURATION = 0.2;

export default function SummonTotemExplosion({
  position,
  explosionStartTime,
  onComplete,
}: SummonTotemExplosionProps) {
  const startTime = useRef(explosionStartTime || Date.now());
  const finished = useRef(false);
  const coreRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const sparkRefs = useRef<(Mesh | null)[]>([]);

  const explosionLight = useDynamicLight({ color: '#0099ff', distance: 4, decay: 2, priority: 1 });

  const coreGeo = useMemo(() => new SphereGeometry(0.35, 32, 32), []);
  const innerGeo = useMemo(() => new SphereGeometry(0.25, 24, 24), []);
  const ringGeos = useMemo(
    () => [0.45, 0.65, 0.85].map((size) => new TorusGeometry(size, 0.045, 16, 32)),
    [],
  );
  const sparkGeo = useMemo(() => new SphereGeometry(0.05, 8, 8), []);

  const coreMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#0099ff',
        emissive: '#0088cc',
        emissiveIntensity: 0.5,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const innerMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#0077aa',
        emissive: '#cceeff',
        emissiveIntensity: 0.5,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const ringMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#0099ff',
        emissive: '#0088cc',
        emissiveIntensity: 1,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const sparkMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#0077aa',
        emissive: '#cceeff',
        emissiveIntensity: 2,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );

  const ringRotations = useMemo(
    () =>
      [0.45, 0.65, 0.85].map(
        () => [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number],
      ),
    [],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!finished.current) {
        finished.current = true;
        onComplete?.();
      }
    }, IMPACT_DURATION * 1000);
    return () => {
      clearTimeout(timer);
      coreGeo.dispose();
      innerGeo.dispose();
      ringGeos.forEach((g) => g.dispose());
      sparkGeo.dispose();
      coreMat.dispose();
      innerMat.dispose();
      ringMat.dispose();
      sparkMat.dispose();
    };
  }, [coreGeo, innerGeo, ringGeos, sparkGeo, coreMat, innerMat, ringMat, sparkMat, onComplete]);

  useFrame(() => {
    const elapsed = (Date.now() - startTime.current) / 1000;
    const fade = Math.max(0, 1 - elapsed / IMPACT_DURATION);

    explosionLight.current?.setPosition(position.x, position.y, position.z);
    explosionLight.current?.setIntensity(1 * fade);

    if (fade <= 0) {
      if (!finished.current) {
        finished.current = true;
        onComplete?.();
      }
      return;
    }

    const coreScale = 1 + elapsed * 2;
    const innerScale = 1 + elapsed * 3;
    const ringScale = 1 + elapsed * 3;
    const sparkRadius = 0.5 * (1 + elapsed * 2);

    if (coreRef.current) {
      coreRef.current.scale.setScalar(coreScale);
      coreMat.opacity = 0.8 * fade;
      coreMat.emissiveIntensity = 0.5 * fade;
    }
    if (innerRef.current) {
      innerRef.current.scale.setScalar(innerScale);
      innerMat.opacity = 0.9 * fade;
      innerMat.emissiveIntensity = 0.5 * fade;
    }

    ringRefs.current.forEach((ring, i) => {
      if (!ring) return;
      ring.scale.set(ringScale, ringScale, ringScale);
      ringMat.opacity = 0.6 * fade * (1 - i * 0.2);
      ringMat.emissiveIntensity = 1 * fade;
    });

    sparkRefs.current.forEach((spark, i) => {
      if (!spark) return;
      const angle = (i / 4) * Math.PI * 2;
      spark.position.set(Math.sin(angle) * sparkRadius, Math.cos(angle) * sparkRadius, 0);
      sparkMat.opacity = 0.8 * fade;
      sparkMat.emissiveIntensity = 2 * fade;
    });
  });

  return (
    <group position={position}>
      <mesh ref={coreRef} geometry={coreGeo} material={coreMat} />
      <mesh ref={innerRef} geometry={innerGeo} material={innerMat} />

      {[0.45, 0.65, 0.85].map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringRefs.current[i] = el;
          }}
          geometry={ringGeos[i]}
          material={ringMat}
          rotation={ringRotations[i]}
        />
      ))}

      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`spark-${i}`}
          ref={(el) => {
            sparkRefs.current[i] = el;
          }}
          geometry={sparkGeo}
          material={sparkMat}
        />
      ))}
    </group>
  );
}
