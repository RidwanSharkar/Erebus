import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Color, SphereGeometry, MeshStandardMaterial } from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const SABRE_MIST_LIGHT_COLOR = new Color('#FF544E');

interface ParticleData {
  initialAngle: number;
  initialRadius: number;
  initialY: number;
}

interface SabreReaperMistEffectProps {
  position: Vector3;
  duration?: number;
  onComplete?: () => void;
}

export default function SabreReaperMistEffect({
  position,
  duration = 1000, // 1 second animation like stealth mist
  onComplete
}: SabreReaperMistEffectProps) {
  const startTime = useRef(Date.now());
  const isCompleted = useRef(false);

  // Borrow a pooled point light for the central glow instead of mounting a <pointLight>.
  const mistLight = useDynamicLight({ color: SABRE_MIST_LIGHT_COLOR, distance: 5, decay: 1, priority: 1 });

  // Initialize particle data once
  const [particleData] = useState<ParticleData[]>(() =>
    Array(50).fill(null).map(() => ({ // Increased from 20 to 35 particles
      initialAngle: Math.random() * Math.PI * 2,
      initialRadius: 0.075 + Math.random() * 1.0,
      initialY: -0.5 + Math.random() * 2
    }))
  );

  const [progress, setProgress] = useState(0);

  // Create simple geometries and materials for the particles (no pooling for now)
  const particleGeometry = useMemo(() => new SphereGeometry(0.125, 8, 8), []);
  const particleMaterial = useMemo(() => new MeshStandardMaterial({
    color: '#FF544E',
    emissive: '#FF544E',
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.6
  }), []);

  useFrame(() => {
    if (isCompleted.current) return;

    const elapsed = Date.now() - startTime.current;
    const currentProgress = Math.min(elapsed / duration, 1);
    setProgress(currentProgress);

    // Update material properties dynamically
    particleMaterial.opacity = 0.8 * (1 - currentProgress);
    particleMaterial.emissiveIntensity = 0.8 * (1 - currentProgress);

    // Drive the pooled light at the effect's world position (constant intensity).
    mistLight.current?.setPosition(position.x, position.y, position.z);
    mistLight.current?.setIntensity(4);

    if (currentProgress >= 1 && !isCompleted.current) {
      isCompleted.current = true;
      onComplete?.();
    }
  });

  // Cleanup
  useEffect(() => {
    return () => {
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
  }, [particleGeometry, particleMaterial]);


  return (
    <group position={[position.x, position.y, position.z]}>
      {particleData.map((particle, i) => {
        // Calculate current particle position based on progress
        const angle = particle.initialAngle + progress * Math.PI;
        const radius = particle.initialRadius * (1 - progress);
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = particle.initialY + progress * 2; // Rise upward

        const scale = 1 - progress * 0.5;

        return (
          <mesh
            key={i}
            position={[x, y, z]}
            scale={[scale, scale, scale]}
            geometry={particleGeometry}
            material={particleMaterial}
          />
        );
      })}

      {/* Central glow light now driven via the shared dynamic light pool (see useFrame). */}
    </group>
  );
}
