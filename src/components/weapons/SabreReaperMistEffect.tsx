import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, SphereGeometry, MeshStandardMaterial } from '@/utils/three-exports';

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
  console.log('🌫️ SabreReaperMistEffect created at position:', position);
  const startTime = useRef(Date.now());
  const isCompleted = useRef(false);

  // Initialize particle data once
  const [particleData] = useState<ParticleData[]>(() =>
    Array(30).fill(null).map(() => ({ // Increased from 20 to 35 particles
      initialAngle: Math.random() * Math.PI * 2,
      initialRadius: 0.5 + Math.random() * 1.0, // Doubled the radius range (was 0.5 + 0.5)
      initialY: 0.5 + Math.random() * 1
    }))
  );

  const [progress, setProgress] = useState(0);

  // Create simple geometries and materials for the particles (no pooling for now)
  const particleGeometry = useMemo(() => new SphereGeometry(0.1, 8, 8), []);
  const particleMaterial = useMemo(() => new MeshStandardMaterial({
    color: "#ff0000", // Red theme for sabres
    emissive: "#aa0000",
    emissiveIntensity: 0.8,
    transparent: true,
    opacity: 0.8
  }), []);

  useFrame(() => {
    if (isCompleted.current) return;

    const elapsed = Date.now() - startTime.current;
    const currentProgress = Math.min(elapsed / duration, 1);
    setProgress(currentProgress);

    // Update material properties dynamically
    particleMaterial.opacity = 0.8 * (1 - currentProgress);
    particleMaterial.emissiveIntensity = 0.8 * (1 - currentProgress);

    if (currentProgress >= 1 && !isCompleted.current) {
      isCompleted.current = true;
      console.log('🌫️ SabreReaperMistEffect completed, calling onComplete');
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

  console.log('🌫️ SabreReaperMistEffect rendering with', particleData.length, 'particles at position:', position);

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

      {/* Add central light for glow effect - red theme */}
      <pointLight
        color="#ff0000"
        intensity={4}
        distance={5}
        decay={1}
      />
    </group>
  );
}
