import React, { useRef, useState, useEffect } from 'react';
import { Vector3, AdditiveBlending } from '@/utils/three-exports';

interface CrossentropyExplosionProps {
  position: Vector3;
  chargeTime?: number;
  explosionStartTime: number | null;
  /** INFERNO talent — red infernal palette vs default purple-or hybrid Crossentropy. */
  infernoVisual?: boolean;
  onComplete?: () => void;
}

const IMPACT_DURATION = 0.5; // Slightly longer than the original for more dramatic effect

export default function CrossentropyExplosion({ 
  position, 
  chargeTime = 1,
  explosionStartTime,
  infernoVisual = false,
  onComplete 
}: CrossentropyExplosionProps) {
  const startTime = useRef(explosionStartTime || Date.now());
  const [, forceUpdate] = useState({}); // Force updates to animate
  const normalizedCharge = Math.min(chargeTime / 4, 1.0);
  const scale = 0.5 + (normalizedCharge * 1.0); // Increased base scale for more impact
  const intensity = 2.5 + (normalizedCharge * 4); // Higher intensity for Crossentropy
  const sparkCount = 16; // More sparks for dramatic effect
  const c1 = infernoVisual ? '#CC1100' : '#FF4500';
  const c1e = infernoVisual ? '#FF2200' : '#FF6600';
  const c2 = infernoVisual ? '#E62E2E' : '#FF6600';
  const c2e = infernoVisual ? '#FF4400' : '#FFA500';
  const c3 = infernoVisual ? '#FF3300' : '#FFA500';
  const c3e = infernoVisual ? '#FFAA00' : '#FFD700';
  const ringC = infernoVisual ? '#DD2200' : '#FF4500';
  const ringE = infernoVisual ? '#FF3300' : '#FF6600';
  const sparkMain = infernoVisual ? '#FF5500' : '#FFA500';
  const sparkMainE = infernoVisual ? '#FFCC22' : '#FFD700';
  const sparkSmall = infernoVisual ? '#EE4400' : '#FF6600';
  const sparkSmallE = infernoVisual ? '#FF8800' : '#FFA500';
  const pl1 = infernoVisual ? '#EE2200' : '#FF4500';
  const pl2 = infernoVisual ? '#FF6600' : '#FFA500';
  const plFlash = infernoVisual ? '#FFAA22' : '#FFD700';
  const plAmb = infernoVisual ? '#CC2200' : '#FF6600';

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
      {/* Core explosion sphere - Deep orange fiery for Crossentropy */}
      <mesh>
        <sphereGeometry args={[0.4 * scale * (1 + elapsed * expansionRate), 32, 32]} />
        <meshStandardMaterial
          color={c1}
          emissive={c1e}
          emissiveIntensity={intensity * fade * 0.6}
          transparent
          opacity={0.85 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      
      {/* Inner energy sphere - Brighter orange */}
      <mesh>
        <sphereGeometry args={[0.5 * scale * (1 + elapsed * (expansionRate + 1)), 24, 24]} />
        <meshStandardMaterial
          color={c2}
          emissive={c2e}
          emissiveIntensity={intensity * 0.6 * fade}
          transparent
          opacity={0.9 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Outer energy sphere - Bright orange */}
      <mesh>
        <sphereGeometry args={[0.6 * scale * (1 + elapsed * (expansionRate + 2)), 16, 16]} />
        <meshStandardMaterial
          color={c3}
          emissive={c3e}
          emissiveIntensity={intensity * 0.4 * fade}
          transparent
          opacity={0.7 * fade}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* Multiple expanding rings with orange fiery theme */}
      {[0.5, 0.7, 0.85, 1.0, 1.2, 1.4].map((ringSize, i) => (
        <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}>
          <torusGeometry args={[ringSize * scale * (1 + elapsed * (expansionRate + 2)), 0.08 * scale, 16, 32]} />
          <meshStandardMaterial
            color={ringC}
            emissive={ringE}
            emissiveIntensity={intensity * fade * 0.4}
            transparent
            opacity={0.8 * fade * (1 - i * 0.12)}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Particle sparks - purple/magenta theme with more dynamic positioning */}
      {[...Array(sparkCount)].map((_, i) => {
        const angle = (i / sparkCount) * Math.PI * 2;
        const randomOffset = Math.random() * 0.4;
        const radius = scale * (1 + elapsed * (expansionRate - 0.5)) * (1 + randomOffset);
        const yOffset = (Math.random() - 0.5) * 0.6; // More vertical variation
        const zOffset = (Math.random() - 0.5) * 0.4; // Add depth variation
        
        return (
          <mesh
            key={`spark-${i}`}
            position={[
              Math.sin(angle) * radius,
              Math.cos(angle) * radius + yOffset,
              zOffset
            ]}
          >
            <sphereGeometry args={[0.1 * scale, 8, 8]} />
            <meshStandardMaterial
              color={sparkMain}
              emissive={sparkMainE}
              emissiveIntensity={intensity * 1.5 * fade}
              transparent
              opacity={0.95 * fade}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Secondary smaller sparks for more detail */}
      {[...Array(sparkCount * 2)].map((_, i) => {
        const angle = (i / (sparkCount * 2)) * Math.PI * 2 + Math.random() * 0.5;
        const randomOffset = Math.random() * 0.3;
        const radius = scale * 0.7 * (1 + elapsed * (expansionRate + 1)) * (1 + randomOffset);
        const yOffset = (Math.random() - 0.5) * 0.4;
        const zOffset = (Math.random() - 0.5) * 0.3;
        
        return (
          <mesh
            key={`small-spark-${i}`}
            position={[
              Math.sin(angle) * radius,
              Math.cos(angle) * radius + yOffset,
              zOffset
            ]}
          >
            <sphereGeometry args={[0.05 * scale, 6, 6]} />
            <meshStandardMaterial
              color={sparkSmall}
              emissive={sparkSmallE}
              emissiveIntensity={intensity * 1.8 * fade}
              transparent
              opacity={0.9 * fade}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        );
      })}

      {/* Dynamic lights - orange fiery theme */}
      <pointLight
        color={pl1}
        intensity={intensity * 4 * fade}
        distance={6 * scale}
        decay={1.8}
      />
      <pointLight
        color={pl2}
        intensity={intensity * 2 * fade}
        distance={9 * scale}
        decay={1.5}
      />
      
      {/* Additional bright flash at the beginning - more intense for Crossentropy */}
      {elapsed < 0.15 && (
        <pointLight
          color={plFlash}
          intensity={intensity * 8 * (1 - elapsed * 6.67)} // Fade over 0.15 seconds
          distance={4 * scale}
          decay={1}
        />
      )}

      {/* Ambient glow effect */}
      <pointLight
        color={plAmb}
        intensity={intensity * 1.2 * fade}
        distance={12 * scale}
        decay={2}
      />
    </group>
  );
}
