import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, AdditiveBlending } from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import type { CrossentropyVisualTheme } from '@/utils/talents';

interface CrossentropyExplosionProps {
  position: Vector3;
  chargeTime?: number;
  explosionStartTime: number | null;
  visualTheme?: CrossentropyVisualTheme;
  onComplete?: () => void;
}

const IMPACT_DURATION = 0.395; // Slightly longer than the original for more dramatic effect

export default function CrossentropyExplosion({
  position,
  chargeTime = 1,
  explosionStartTime,
  visualTheme = 'default',
  onComplete,
}: CrossentropyExplosionProps) {
  const startTime = useRef(explosionStartTime || Date.now());
  const [, forceUpdate] = useState({}); // Force updates to animate
  const normalizedCharge = Math.min(chargeTime / 4, 1.0);
  const scale = 0.35 + (normalizedCharge * 1.0); // Increased base scale for more impact
  const intensity = 1.25 + (normalizedCharge * 4); // Higher intensity for Crossentropy
  const sparkCount = 4; // More sparks for dramatic effect

  const {
    c1,
    c1e,
    c2,
    c2e,
    c3,
    c3e,
    ringC,
    ringE,
    sparkMain,
    sparkMainE,
    sparkSmall,
    sparkSmallE,
    pl1,
    pl2,
    plFlash,
    plAmb,
  } = useMemo(() => {
    if (visualTheme === 'inferno') {
      return {
        c1: '#CC1100',
        c1e: '#FF2200',
        c2: '#E62E2E',
        c2e: '#FF4400',
        c3: '#FF3300',
        c3e: '#FFAA00',
        ringC: '#DD2200',
        ringE: '#FF3300',
        sparkMain: '#FF5500',
        sparkMainE: '#FFCC22',
        sparkSmall: '#EE4400',
        sparkSmallE: '#FF8800',
        pl1: '#EE2200',
        pl2: '#FF6600',
        plFlash: '#FFAA22',
        plAmb: '#CC2200',
      };
    }
    if (visualTheme === 'glacial') {
      return {
        c1: '#064E8A',
        c1e: '#0B74C4',
        c2: '#0A5FAD',
        c2e: '#3DB3FF',
        c3: '#1273C4',
        c3e: '#7DD3FC',
        ringC: '#1E56A0',
        ringE: '#60C4FF',
        sparkMain: '#94DDFF',
        sparkMainE: '#E0F5FF',
        sparkSmall: '#2080CC',
        sparkSmallE: '#6EC8FF',
        pl1: '#0D5A9E',
        pl2: '#4AB8FF',
        plFlash: '#C8ECFF',
        plAmb: '#063666',
      };
    }
    if (visualTheme === 'tempest') {
      return {
        c1: '#0D47A1',
        c1e: '#2196F3',
        c2: '#1565C0',
        c2e: '#42A5F5',
        c3: '#1976D2',
        c3e: '#90CAF9',
        ringC: '#1E88E5',
        ringE: '#64B5F6',
        sparkMain: '#40C4FF',
        sparkMainE: '#B3E5FC',
        sparkSmall: '#0288D1',
        sparkSmallE: '#4FC3F7',
        pl1: '#2196F3',
        pl2: '#64B5F6',
        plFlash: '#E1F5FE',
        plAmb: '#0D47A1',
      };
    }
    if (visualTheme === 'plague') {
      return {
        c1: '#1B5E20',
        c1e: '#43A047',
        c2: '#2E7D32',
        c2e: '#66BB6A',
        c3: '#388E3C',
        c3e: '#A5D6A7',
        ringC: '#43A047',
        ringE: '#81C784',
        sparkMain: '#69F0AE',
        sparkMainE: '#C8E6C9',
        sparkSmall: '#2E7D32',
        sparkSmallE: '#A5D6A7',
        pl1: '#43A047',
        pl2: '#81C784',
        plFlash: '#EEFFEE',
        plAmb: '#1B5E20',
      };
    }
    return {
      c1: '#FF4500',
      c1e: '#FF6600',
      c2: '#FF6600',
      c2e: '#FFA500',
      c3: '#FFA500',
      c3e: '#FFD700',
      ringC: '#FF4500',
      ringE: '#FF6600',
      sparkMain: '#FFA500',
      sparkMainE: '#FFD700',
      sparkSmall: '#FF6600',
      sparkSmallE: '#FFA500',
      pl1: '#FF4500',
      pl2: '#FFA500',
      plFlash: '#FFD700',
      plAmb: '#FF6600',
    };
  }, [visualTheme]);

  // Collapse the two explosion <pointLight>s into one pooled light at the blast center.
  const blastLight = useDynamicLight({ color: pl1, distance: 6, decay: 6, priority: 1 });

  useFrame(() => {
    const e = (Date.now() - startTime.current) / 1000;
    const f = Math.max(0, 1 - e / IMPACT_DURATION);
    blastLight.current?.setPosition(position.x, position.y, position.z);
    blastLight.current?.setIntensity(1 * f);
  });

  useEffect(() => {
    // Animation timer
    const interval = setInterval(() => {
      forceUpdate({});
      
      // Check if we should clean up
      const elapsed = (Date.now() - startTime.current) / 1000;
      if (elapsed > IMPACT_DURATION) {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 16); // ~60fps
    
    // Cleanup timer after explosion duration
    const timer = setTimeout(() => {
      clearInterval(interval);
      if (onComplete) onComplete();
    }, IMPACT_DURATION * 1000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [onComplete]);

  // Calculate fade based on elapsed time
  const elapsed = (Date.now() - startTime.current) / 1000;
  const duration = IMPACT_DURATION;
  const fade = Math.max(0, 1 - (elapsed / duration));
  
  if (fade <= 0) return null;

  // More dynamic effect - faster expansion for initial impact
  const expansionRate = 4 + (elapsed < 0.15 ? 10 : 0); // Faster initial expansion

  return (
    <group position={position}>
      {/* Core explosion sphere - Exact same as original */}
      <mesh>
        <sphereGeometry args={[0.55 * (1 + elapsed * 2), 32, 32]} />
        <meshStandardMaterial
          color={c1}
          emissive={c1e}
          emissiveIntensity={0.5 * fade}
          transparent
          opacity={1 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Inner energy sphere - Exact same as original */}
      <mesh>
        <sphereGeometry args={[0.35 * (1 + elapsed * 3), 24, 24]} />
        <meshStandardMaterial
          color={c2}
          emissive={c2e}
          emissiveIntensity={0.5 * fade}
          transparent
          opacity={1 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Expanding rings - Exact same as original */}
      {[0.45, 0.65, 0.85].map((size, i) => (
        <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}>
          <torusGeometry args={[size * (1.25 + elapsed * 3), 0.125, 16, 32]} />
          <meshStandardMaterial
            color={ringC}
            emissive={ringE}
            emissiveIntensity={0.875 * fade}
            transparent
            opacity={0.875}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Particle sparks - Exact same as original */}
      {[...Array(4)].map((_, i) => {
        const angle = (i / 4) * Math.PI * 2;
        const radius = 0.5 * (1 + elapsed * 2);
        return (
          <mesh
            key={`spark-${i}`}
            position={[
              Math.sin(angle) * radius,
              Math.cos(angle) * radius,
              0
            ]}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshStandardMaterial
              color={sparkMain}
              emissive={sparkMainE}
              emissiveIntensity={2 * fade}
              transparent
              opacity={0.8 * fade}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

    </group>
  );
}
