import React, { useState, useMemo } from 'react';
import { Vector3, Color } from 'three';
import { useFrame } from '@react-three/fiber';

interface BossTeleportEffectProps {
  position: Vector3;
  onComplete: () => void;
  type?: 'start' | 'end'; // Different effects for teleport start vs end
}

const BossTeleportEffect: React.FC<BossTeleportEffectProps> = React.memo(({ position, onComplete, type = 'start' }) => {
  const [time, setTime] = useState(0);
  const duration = 0.8; // Duration of the effect
  const hasCompletedRef = React.useRef(false);

  useFrame((_, delta) => {
    setTime(prev => {
      const newTime = prev + delta;
      return newTime;
    });
    
    // Check for completion outside of setState to avoid calling parent setState during render
    if (time >= duration && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete();
    }
  });

  const progress = time / duration;

  // Different behaviors for start and end teleport
  const isStartEffect = type === 'start';
  const opacity = isStartEffect 
    ? 1 - progress // Fade out for start
    : Math.sin(progress * Math.PI); // Fade in and out for end

  const scale = isStartEffect
    ? 1 + progress * 2 // Expand for start
    : 1 - progress * 0.3 + Math.sin(progress * Math.PI * 2) * 0.2; // Contract with pulse for end

  // Purple/dark energy colors for ominous teleport
  const primaryColor = "#8800ff";
  const secondaryColor = "#aa00ff";
  const coreColor = "#ffffff";
  const darkColor = "#440088";
  const accentColor = "#ff00ff";

  // Generate random particles for swirling effect
  const particles = useMemo(() => {
    const particleCount = 30;
    const particleArray = [];
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const radius = 0.5 + Math.random() * 0.5;
      const height = Math.random() * 2 - 1;
      particleArray.push({
        angle,
        radius,
        height,
        speed: 2 + Math.random() * 2,
        size: 0.08 + Math.random() * 0.08
      });
    }
    return particleArray;
  }, []);

  return (
    <group position={position.toArray()}>
      {/* Central energy core */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.4 * scale, 16, 16]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={primaryColor}
          emissiveIntensity={5}
          transparent
          opacity={opacity * 0.9}
          toneMapped={false}
        />
      </mesh>

      {/* Outer energy sphere with pulsing effect */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.6 * scale + Math.sin(time * 10) * 0.1, 16, 16]} />
        <meshStandardMaterial
          color={secondaryColor}
          emissive={primaryColor}
          emissiveIntensity={3}
          transparent
          opacity={opacity * 0.4}
          toneMapped={false}
          wireframe
        />
      </mesh>

      {/* Spinning rings around the teleport */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={`ring-${i}`}
          position={[0, (i - 1) * 0.5, 0]}
          rotation={[Math.PI / 2, 0, time * 5 * (i % 2 === 0 ? 1 : -1)]}
        >
          <torusGeometry args={[0.8 * scale, 0.05, 8, 24]} />
          <meshStandardMaterial
            color={i === 1 ? accentColor : primaryColor}
            emissive={i === 1 ? secondaryColor : darkColor}
            emissiveIntensity={4}
            transparent
            opacity={opacity * (1 - i * 0.2)}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Vertical energy pillars */}
      {[...Array(6)].map((_, i) => {
        const angle = (i / 6) * Math.PI * 2;
        const radius = 0.9 * scale;
        const x = Math.cos(angle + time * 3) * radius;
        const z = Math.sin(angle + time * 3) * radius;
        
        return (
          <mesh
            key={`pillar-${i}`}
            position={[x, 0, z]}
            rotation={[0, 0, 0]}
          >
            <cylinderGeometry args={[0.04, 0.04, 2 + Math.sin(time * 5 + i) * 0.5, 8]} />
            <meshStandardMaterial
              color={primaryColor}
              emissive={accentColor}
              emissiveIntensity={3.5}
              transparent
              opacity={opacity * 0.7}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {/* Swirling particles */}
      {particles.map((particle, i) => {
        const currentAngle = particle.angle + time * particle.speed;
        const currentRadius = particle.radius * scale;
        const x = Math.cos(currentAngle) * currentRadius;
        const z = Math.sin(currentAngle) * currentRadius;
        const y = particle.height + Math.sin(time * 4 + i) * 0.3;

        return (
          <mesh
            key={`particle-${i}`}
            position={[x, y, z]}
          >
            <sphereGeometry args={[particle.size, 8, 8]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? primaryColor : accentColor}
              emissive={i % 2 === 0 ? accentColor : primaryColor}
              emissiveIntensity={4}
              transparent
              opacity={opacity * 0.8}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {/* Ground circle effect */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, time * 2]}>
        <ringGeometry args={[0.5 * scale, 1.2 * scale, 32]} />
        <meshStandardMaterial
          color={darkColor}
          emissive={primaryColor}
          emissiveIntensity={2.5}
          transparent
          opacity={opacity * 0.5}
          toneMapped={false}
          side={2}
        />
      </mesh>

      {/* Ascending/Descending energy streams for start/end effect */}
      {isStartEffect ? (
        // Ascending streams for teleport start (boss disappearing)
        [...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const radius = 0.6;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const streamHeight = progress * 3;
          
          return (
            <mesh
              key={`stream-up-${i}`}
              position={[x, streamHeight, z]}
            >
              <cylinderGeometry args={[0.08, 0.08, streamHeight * 2, 6]} />
              <meshStandardMaterial
                color={primaryColor}
                emissive={accentColor}
                emissiveIntensity={4}
                transparent
                opacity={opacity * 0.6}
                toneMapped={false}
              />
            </mesh>
          );
        })
      ) : (
        // Descending streams for teleport end (boss appearing)
        [...Array(8)].map((_, i) => {
          const angle = (i / 8) * Math.PI * 2;
          const radius = 0.6;
          const x = Math.cos(angle) * radius;
          const z = Math.sin(angle) * radius;
          const streamHeight = (1 - progress) * 3;
          
          return (
            <mesh
              key={`stream-down-${i}`}
              position={[x, streamHeight + 2, z]}
            >
              <cylinderGeometry args={[0.08, 0.08, 2, 6]} />
              <meshStandardMaterial
                color={primaryColor}
                emissive={accentColor}
                emissiveIntensity={4}
                transparent
                opacity={opacity * 0.6}
                toneMapped={false}
              />
            </mesh>
          );
        })
      )}

      {/* Point light for dramatic lighting */}
      <pointLight
        position={[0, 0.5, 0]}
        color={primaryColor}
        intensity={10 * opacity}
        distance={5}
        decay={2}
      />
    </group>
  );
});

BossTeleportEffect.displayName = 'BossTeleportEffect';

export default BossTeleportEffect;

