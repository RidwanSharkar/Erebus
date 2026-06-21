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
import type { CrossentropyVisualTheme } from '@/utils/talents';

interface CrossentropyExplosionProps {
  position: Vector3;
  chargeTime?: number;
  explosionStartTime: number | null;
  visualTheme?: CrossentropyVisualTheme;
  onComplete?: () => void;
}

const IMPACT_DURATION = 0.395;

export default function CrossentropyExplosion({
  position,
  chargeTime = 1,
  explosionStartTime,
  visualTheme = 'default',
  onComplete,
}: CrossentropyExplosionProps) {
  const startTime = useRef(explosionStartTime || Date.now());
  const finished = useRef(false);
  const coreRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const ringRefs = useRef<(Mesh | null)[]>([]);
  const sparkRefs = useRef<(Mesh | null)[]>([]);

  const normalizedCharge = Math.min(chargeTime / 4, 1.0);

  const {
    c1,
    c1e,
    c2,
    c2e,
    ringC,
    ringE,
    sparkMain,
    sparkMainE,
    pl1,
  } = useMemo(() => {
    if (visualTheme === 'inferno') {
      return {
        c1: '#CC1100', c1e: '#FF2200', c2: '#E62E2E', c2e: '#FF4400',
        ringC: '#DD2200', ringE: '#FF3300', sparkMain: '#FF5500', sparkMainE: '#FFCC22', pl1: '#EE2200',
      };
    }
    if (visualTheme === 'glacial') {
      return {
        c1: '#064E8A', c1e: '#0B74C4', c2: '#0A5FAD', c2e: '#3DB3FF',
        ringC: '#1E56A0', ringE: '#60C4FF', sparkMain: '#94DDFF', sparkMainE: '#E0F5FF', pl1: '#0D5A9E',
      };
    }
    if (visualTheme === 'tempest') {
      return {
        c1: '#0D47A1', c1e: '#2196F3', c2: '#1565C0', c2e: '#42A5F5',
        ringC: '#1E88E5', ringE: '#64B5F6', sparkMain: '#40C4FF', sparkMainE: '#B3E5FC', pl1: '#2196F3',
      };
    }
    if (visualTheme === 'plague') {
      return {
        c1: '#1B5E20', c1e: '#43A047', c2: '#2E7D32', c2e: '#66BB6A',
        ringC: '#43A047', ringE: '#81C784', sparkMain: '#69F0AE', sparkMainE: '#C8E6C9', pl1: '#43A047',
      };
    }
    return {
      c1: '#FF4500', c1e: '#FF6600', c2: '#FF6600', c2e: '#FFA500',
      ringC: '#FF4500', ringE: '#FF6600', sparkMain: '#FFA500', sparkMainE: '#FFD700', pl1: '#FF4500',
    };
  }, [visualTheme]);

  const coreGeo = useMemo(() => new SphereGeometry(0.55, 32, 32), []);
  const innerGeo = useMemo(() => new SphereGeometry(0.35, 24, 24), []);
  const ringGeos = useMemo(
    () => [0.45, 0.65, 0.85].map((size) => new TorusGeometry(size * 1.25, 0.125, 16, 32)),
    [],
  );
  const sparkGeo = useMemo(() => new SphereGeometry(0.05, 8, 8), []);

  const coreMat = useMemo(
    () => new MeshStandardMaterial({ color: c1, emissive: c1e, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    [c1, c1e],
  );
  const innerMat = useMemo(
    () => new MeshStandardMaterial({ color: c2, emissive: c2e, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    [c2, c2e],
  );
  const ringMat = useMemo(
    () => new MeshStandardMaterial({ color: ringC, emissive: ringE, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    [ringC, ringE],
  );
  const sparkMat = useMemo(
    () => new MeshStandardMaterial({ color: sparkMain, emissive: sparkMainE, transparent: true, depthWrite: false, blending: AdditiveBlending }),
    [sparkMain, sparkMainE],
  );

  const ringRotations = useMemo(
    () => [0.45, 0.65, 0.85].map(() => [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [number, number, number]),
    [],
  );

  const blastLight = useDynamicLight({ color: pl1, distance: 6, decay: 6, priority: 1 });

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

    blastLight.current?.setPosition(position.x, position.y, position.z);
    blastLight.current?.setIntensity(1 * fade);

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
      coreMat.opacity = fade;
      coreMat.emissiveIntensity = 0.5 * fade;
    }
    if (innerRef.current) {
      innerRef.current.scale.setScalar(innerScale);
      innerMat.opacity = fade;
      innerMat.emissiveIntensity = 0.5 * fade;
    }

    ringRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      mesh.scale.setScalar(ringScale);
      ringMat.opacity = 0.875 * fade;
      ringMat.emissiveIntensity = 0.875 * fade;
    });

    sparkRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      const angle = (i / 4) * Math.PI * 2;
      mesh.position.set(Math.sin(angle) * sparkRadius, Math.cos(angle) * sparkRadius, 0);
      sparkMat.opacity = 0.8 * fade;
      sparkMat.emissiveIntensity = 2 * fade;
    });
  });

  return (
    <group position={position}>
      <mesh ref={coreRef} geometry={coreGeo} material={coreMat} />
      <mesh ref={innerRef} geometry={innerGeo} material={innerMat} />
      {ringGeos.map((geo, i) => (
        <mesh
          key={i}
          ref={(el) => { ringRefs.current[i] = el; }}
          geometry={geo}
          material={ringMat}
          rotation={ringRotations[i]}
        />
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={`spark-${i}`}
          ref={(el) => { sparkRefs.current[i] = el; }}
          geometry={sparkGeo}
          material={sparkMat}
        />
      ))}
    </group>
  );
}
