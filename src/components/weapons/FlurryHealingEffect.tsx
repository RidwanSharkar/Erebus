import React, { useState } from 'react';
import { Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';

interface FlurryHealingEffectProps {
  position: Vector3;
  onComplete: () => void;
}

const FlurryHealingEffect: React.FC<FlurryHealingEffectProps> = React.memo(({ position, onComplete }) => {
  const [time, setTime] = useState(0);
  const duration = 0.8; // Faster, snappier effect to match Flurry's rapid attack theme

  useFrame((_, delta) => {
    setTime(prev => {
      const newTime = prev + delta;
      if (newTime >= duration) {
        onComplete();
      }
      return newTime;
    });
  });

  const progress = time / duration;
  const opacity = Math.sin(progress * Math.PI); // Fade in and out smoothly
  const scale = 1 + progress * 0.8; // Quick expansion

  // Healing green colors with a hint of white for intensity
  const primaryColor = "#00ff88";
  const secondaryColor = "#44ffaa";
  const coreColor = "#ffffff";
  const accentColor = "#00ffcc";

  return (
    <group position={position.toArray()}>
      {/* Rapidly spinning healing rings - multiple for flurry effect */}
      {[...Array(4)].map((_, i) => (
        <mesh
          key={`ring-${i}`}
          position={[0, progress * 1.5 + i * 0.2, 0]}
          rotation={[Math.PI / 2, 0, time * 8 * (i % 2 === 0 ? 1 : -1)]} // Alternating spin directions
        >
          <torusGeometry args={[0.5 - i * 0.08, 0.04, 12, 24]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? primaryColor : accentColor}
            emissive={i % 2 === 0 ? secondaryColor : primaryColor}
            emissiveIntensity={3.5}
            transparent
            opacity={opacity * (1 - i * 0.15)}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Central healing burst - bright core */}
      <mesh scale={[scale * 0.6, scale * 1.2, scale * 0.6]}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={5}
          transparent
          opacity={opacity * 0.7}
          toneMapped={false}
        />
      </mesh>

      {/* Outer healing pulse */}
      <mesh scale={[scale * 0.9, scale * 1.5, scale * 0.9]}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={secondaryColor}
          emissiveIntensity={3.5}
          transparent
          opacity={opacity * 0.3}
          toneMapped={false}
        />
      </mesh>

      {/* Rapid swirling healing particles - lots of them for "flurry" effect */}
      {[...Array(24)].map((_, i) => {
        const angle = (i / 24) * Math.PI * 2;
        const spiralSpeed = 12; // Very fast spinning
        const radius = 0.4 + progress * 0.3;
        const yOffset = progress * 1.5 + Math.sin(time * 8 + i * 0.5) * 0.2;

        return (
          <mesh
            key={`particle-${i}`}
            position={[
              Math.cos(angle + time * spiralSpeed) * radius,
              yOffset,
              Math.sin(angle + time * spiralSpeed) * radius
            ]}
          >
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial
              color={i % 4 === 0 ? coreColor : i % 3 === 0 ? accentColor : primaryColor}
              emissive={i % 4 === 0 ? coreColor : secondaryColor}
              emissiveIntensity={4}
              transparent
              opacity={opacity * 0.9}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {/* Floating plus symbols rising upward - healing theme */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + time * 6;
        const radius = 0.7 + progress * 0.2;
        const yOffset = progress * 1.8 + Math.sin(time * 6 + i) * 0.3;

        return (
          <group
            key={`cross-${i}`}
            position={[
              Math.cos(angle) * radius,
              yOffset,
              Math.sin(angle) * radius
            ]}
            rotation={[0, time * 4, 0]}
          >
            {/* Horizontal bar */}
            <mesh>
              <boxGeometry args={[0.12, 0.025, 0.025]} />
              <meshStandardMaterial
                color={coreColor}
                emissive={primaryColor}
                emissiveIntensity={4}
                transparent
                opacity={opacity * 0.85}
                toneMapped={false}
              />
            </mesh>
            {/* Vertical bar */}
            <mesh>
              <boxGeometry args={[0.025, 0.12, 0.025]} />
              <meshStandardMaterial
                color={coreColor}
                emissive={primaryColor}
                emissiveIntensity={4}
                transparent
                opacity={opacity * 0.85}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* Expanding ground ring with pulse */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, time * 3]}>
        <ringGeometry args={[scale * 0.4, scale * 0.7, 32]} />
        <meshStandardMaterial
          color={accentColor}
          emissive={primaryColor}
          emissiveIntensity={3}
          transparent
          opacity={opacity * 0.6}
          side={2} // DoubleSide
          toneMapped={false}
        />
      </mesh>

      {/* Inner ground ring - counter-rotating */}
      <mesh position={[0, 0.08, 0]} rotation={[Math.PI / 2, 0, -time * 4]}>
        <ringGeometry args={[scale * 0.2, scale * 0.4, 24]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={secondaryColor}
          emissiveIntensity={3.5}
          transparent
          opacity={opacity * 0.7}
          side={2} // DoubleSide
          toneMapped={false}
        />
      </mesh>

      {/* Multiple point lights for intense glow */}
      <pointLight
        color={primaryColor}
        intensity={5 * opacity}
        distance={6}
        decay={2}
      />
      
      <pointLight
        position={[0, progress * 1.5, 0]}
        color={coreColor}
        intensity={4 * opacity}
        distance={4}
        decay={2}
      />

      <pointLight
        position={[0, 0.5, 0]}
        color={accentColor}
        intensity={3 * opacity}
        distance={5}
        decay={2}
      />
    </group>
  );
});

FlurryHealingEffect.displayName = 'FlurryHealingEffect';

export default FlurryHealingEffect;

