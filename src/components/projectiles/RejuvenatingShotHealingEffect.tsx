import React, { useState } from 'react';
import { Vector3 } from 'three';
import { useFrame, RootState } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface RejuvenatingShotHealingEffectProps {
  position: Vector3;
  onComplete: () => void;
}

const RejuvenatingShotHealingEffect: React.FC<RejuvenatingShotHealingEffectProps> = React.memo(({ position, onComplete }) => {
  const [time, setTime] = useState(0);
  const duration = 1.2; // Slightly shorter than Reanimate for snappier feel

  // Healing green colors
  const primaryColor = "#00ffaa";
  const secondaryColor = "#00ff77";
  const coreColor = "#ffffff";

  // Collapse the two healing-glow <pointLight>s into one pooled light at the effect
  // origin (group sits at world `position`). Uses the brighter primary light.
  const healLight = useDynamicLight({ color: primaryColor, distance: 6, decay: 2, priority: 1 });

  useFrame((_, delta) => {
    setTime(prev => {
      const newTime = prev + delta;
      if (newTime >= duration) {
        onComplete();
      }
      const newProgress = newTime / duration;
      const newOpacity = Math.sin(newProgress * Math.PI);
      healLight.current?.setPosition(position.x, position.y, position.z);
      healLight.current?.setIntensity(4 * newOpacity);
      return newTime;
    });
  });

  const progress = time / duration;
  const opacity = Math.sin(progress * Math.PI); // Fade in and out smoothly
  const scale = 1 + progress * 1.5; // Expand outward

  return (
    <group position={position.toArray()}>
      {/* Rising healing rings */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={`ring-${i}`}
          position={[0, progress * 2.5 + i * 0.4, 0]}
          rotation={[Math.PI / 2, 0, time * 3]}
        >
          <torusGeometry args={[0.7 - i * 0.15, 0.06, 16, 32]} />
          <meshStandardMaterial
            color={i === 0 ? coreColor : primaryColor}
            emissive={secondaryColor}
            emissiveIntensity={i === 0 ? 3 : 2.5}
            transparent
            opacity={opacity * (1 - i * 0.2)}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Central healing glow - bright core */}
      <mesh scale={[scale * 0.8, scale * 0.8, scale * 0.8]}>
        <sphereGeometry args={[0.4, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={4}
          transparent
          opacity={opacity * 0.6}
          toneMapped={false}
        />
      </mesh>

      {/* Outer healing glow */}
      <mesh scale={[scale, scale, scale]}>
        <sphereGeometry args={[0.6, 32, 32]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={secondaryColor}
          emissiveIntensity={3}
          transparent
          opacity={opacity * 0.4}
          toneMapped={false}
        />
      </mesh>

      {/* Healing particles spiraling upward */}
      {[...Array(16)].map((_, i) => {
        const angle = (i / 16) * Math.PI * 2;
        const radius = 0.6 + progress * 0.5;
        const yOffset = progress * 2.5 + (i / 16) * 0.8;

        return (
          <mesh
            key={`particle-${i}`}
            position={[
              Math.cos(angle + time * 4) * radius,
              yOffset + Math.sin(time * 5 + i) * 0.3,
              Math.sin(angle + time * 4) * radius
            ]}
          >
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial
              color={i % 3 === 0 ? coreColor : primaryColor}
              emissive={i % 3 === 0 ? coreColor : secondaryColor}
              emissiveIntensity={i % 3 === 0 ? 4 : 3}
              transparent
              opacity={opacity * 0.9}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {/* Floating cross/plus particles for healing theme */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2 + time * 2;
        const radius = 1 + progress * 0.3;
        const yOffset = progress * 2 + Math.sin(time * 3 + i) * 0.4;

        return (
          <group
            key={`cross-${i}`}
            position={[
              Math.cos(angle) * radius,
              yOffset,
              Math.sin(angle) * radius
            ]}
            rotation={[0, angle, 0]}
          >
            {/* Horizontal bar */}
            <mesh>
              <boxGeometry args={[0.15, 0.03, 0.03]} />
              <meshStandardMaterial
                color={coreColor}
                emissive={coreColor}
                emissiveIntensity={3.5}
                transparent
                opacity={opacity * 0.8}
                toneMapped={false}
              />
            </mesh>
            {/* Vertical bar */}
            <mesh>
              <boxGeometry args={[0.03, 0.15, 0.03]} />
              <meshStandardMaterial
                color={coreColor}
                emissive={coreColor}
                emissiveIntensity={3.5}
                transparent
                opacity={opacity * 0.8}
                toneMapped={false}
              />
            </mesh>
          </group>
        );
      })}

      {/* Pulsing ground ring */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[scale * 0.5, scale * 0.8, 32]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={secondaryColor}
          emissiveIntensity={2.5}
          transparent
          opacity={opacity * 0.5}
          side={2} // DoubleSide
          toneMapped={false}
        />
      </mesh>

    </group>
  );
});

RejuvenatingShotHealingEffect.displayName = 'RejuvenatingShotHealingEffect';

export default RejuvenatingShotHealingEffect;

