import React, { useRef, useEffect, useState } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface DebuffIndicatorProps {
  position: Vector3;
  debuffType: 'frozen' | 'slowed';
  duration?: number;
  startTime?: number;
  onComplete?: () => void;
}

export default function DebuffIndicator({ 
  position, 
  debuffType,
  duration = 5000,
  startTime = Date.now(),
  onComplete 
}: DebuffIndicatorProps) {
  const indicatorRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(1);
  const rotationSpeed = useRef(Math.random() * 0.02 + 0.01);

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log(`🎯 Debuff indicator (${debuffType}) completed after`, duration, 'ms');
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete, debuffType]);

  useFrame(() => {
    if (!indicatorRef.current) return;

    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Safety check: if effect has exceeded its duration, trigger completion
    if (progress >= 1 && onComplete) {
      console.log(`🎯 Debuff indicator (${debuffType}) exceeded duration, forcing completion`);
      onComplete();
      return;
    }

    // Fade out in the last 20% of duration
    if (progress > 0.8) {
      const fadeStart = 0.8;
      const fadePhase = (progress - fadeStart) / (1 - fadeStart);
      setFadeProgress(1 - fadePhase);
    } else {
      setFadeProgress(1);
    }

    // Pulsing intensity effect
    const pulseIntensity = 0.6 + 0.4 * Math.sin(elapsed * 0.008);
    setIntensity(pulseIntensity * fadeProgress);

    // Rotate the indicator
    indicatorRef.current.rotation.y += rotationSpeed.current;
    indicatorRef.current.rotation.z = Math.sin(elapsed * 0.003) * 0.1;
  });

  // Get colors and icon based on debuff type
  const getDebuffVisuals = () => {
    switch (debuffType) {
      case 'frozen':
        return {
          color: "#4FC3F7",
          emissive: "#29B6F6",
          symbol: "❄️"
        };
      case 'slowed':
        return {
          color: "#FFA726",
          emissive: "#FF9800",
          symbol: "🐌"
        };
      default:
        return {
          color: "#9E9E9E",
          emissive: "#757575",
          symbol: "?"
        };
    }
  };

  const visuals = getDebuffVisuals();

  return (
    <group ref={indicatorRef} position={[position.x, position.y + 2.5, position.z]}>
      {/* Background circle */}
      <mesh position={[0, 0, 0]}>
        <circleGeometry args={[0.4, 16]} />
        <meshStandardMaterial
          color={visuals.color}
          emissive={visuals.emissive}
          emissiveIntensity={0.3 * intensity}
          transparent
          opacity={0.6 * fadeProgress}
          roughness={0.1}
          metalness={0.2}
        />
      </mesh>

      {/* Outer ring */}
      <mesh position={[0, 0, -0.01]} rotation={[0, 0, 0]}>
        <ringGeometry args={[0.35, 0.45, 16]} />
        <meshStandardMaterial
          color={visuals.color}
          emissive={visuals.emissive}
          emissiveIntensity={0.5 * intensity}
          transparent
          opacity={0.8 * fadeProgress}
          roughness={0.05}
          metalness={0.3}
        />
      </mesh>

      {/* Inner glow */}
      <mesh position={[0, 0, 0.01]}>
        <circleGeometry args={[0.25, 12]} />
        <meshStandardMaterial
          color={visuals.emissive}
          emissive={visuals.emissive}
          emissiveIntensity={0.8 * intensity}
          transparent
          opacity={0.4 * fadeProgress}
        />
      </mesh>

      {/* Pulsing particles around the indicator */}
      {[...Array(6)].map((_, i) => {
        const angle = (i * Math.PI * 2) / 6;
        const radius = 0.6 + Math.sin(Date.now() * 0.003 + i) * 0.1;
        return (
          <mesh
            key={i}
            position={[
              Math.cos(angle) * radius,
              Math.sin(angle) * radius * 0.3,
              0
            ]}
          >
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial
              color={visuals.color}
              emissive={visuals.emissive}
              emissiveIntensity={0.9 * intensity}
              transparent
              opacity={0.7 * fadeProgress}
            />
          </mesh>
        );
      })}

      {/* Point light for glow effect */}
      <pointLight 
        color={visuals.color} 
        intensity={1.5 * intensity * fadeProgress} 
        distance={3} 
        position={[0, 0, 0.2]}
      />
    </group>
  );
}
