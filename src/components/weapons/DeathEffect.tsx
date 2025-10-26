import React, { useRef, useEffect, useState } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface DeathEffectProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  playerId?: string;
  onComplete?: () => void;
  // For tracking player position updates
  playerData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
}

export default function DeathEffect({
  position,
  duration = 15000, // 15 seconds (respawn time)
  startTime = Date.now(),
  playerId,
  playerData = [],
  onComplete
}: DeathEffectProps) {
  const effectRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(1);
  const rotationSpeed = useRef(Math.random() * 0.01 + 0.005);
  const hasCompleted = useRef(false); // Flag to prevent multiple onComplete calls

  useEffect(() => {
    const timeout = setTimeout(() => {
      // Only trigger completion once
      if (onComplete && !hasCompleted.current) {
        hasCompleted.current = true;
        onComplete();
      }
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete, playerId]);

  useFrame(() => {
    if (!effectRef.current) return;

    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Safety check removed - we rely on setTimeout for completion to avoid duplicate calls

    // Update position to follow player if playerId is provided
    if (playerId && playerData.length > 0) {
      const target = playerData.find(player => player.id === playerId);

      if (target && target.health <= 0) {
        // Update the group position to follow the dead player
        const targetPosition = target.position.clone();
        targetPosition.y += 0.5; // Adjust Y offset to be at player level
        effectRef.current.position.copy(targetPosition);
      }
    }

    // Fade out in the last 500ms
    if (progress > 0.9) {
      const fadeStart = 0.9;
      const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
      setFadeProgress(1 - fadeProgress);
    } else {
      setFadeProgress(1);
    }

    // Pulsing intensity effect
    const pulseIntensity = 0.7 + 0.3 * Math.sin(elapsed * 0.008);
    setIntensity(pulseIntensity * fadeProgress);

    // Rotate the death effect slowly
    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.002) * 0.05;
  });

  return (
    <group ref={effectRef} position={position}>
      {/* Dark ethereal sphere */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color="#2D1B69"
          emissive="#4A148C"
          emissiveIntensity={0.4 * intensity}
          transparent
          opacity={0.6 * fadeProgress}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Death mist particles */}
      {[...Array(8)].map((_, i) => (
        <mesh
          key={`mist-${i}`}
          position={[
            (Math.random() - 0.5) * 1.5,
            Math.random() * 1.5 + 0.2,
            (Math.random() - 0.5) * 1.5
          ]}
          rotation={[
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          ]}
        >
          <sphereGeometry args={[0.1 + Math.random() * 0.1, 8, 8]} />
          <meshStandardMaterial
            color="#6A1B9A"
            emissive="#9C27B0"
            emissiveIntensity={0.6 * intensity}
            transparent
            opacity={0.4 * fadeProgress}
          />
        </mesh>
      ))}

      {/* Dark energy rings */}
      {[...Array(3)].map((_, i) => (
        <mesh
          key={`ring-${i}`}
          position={[0, 0.5 + i * 0.3, 0]}
          rotation={[Math.PI / 2, 0, (i * Math.PI) / 3]}
        >
          <torusGeometry args={[0.5 + i * 0.2, 0.03, 8, 16]} />
          <meshStandardMaterial
            color="#4A148C"
            emissive="#7B1FA2"
            emissiveIntensity={0.5 * intensity}
            transparent
            opacity={0.5 * fadeProgress}
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* Skull-like dark core */}
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial
          color="#1A0033"
          emissive="#4A148C"
          emissiveIntensity={0.8 * intensity}
          transparent
          opacity={0.7 * fadeProgress}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Dark glow effect */}
      <mesh>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial
          color="#4A148C"
          emissive="#6A1B9A"
          emissiveIntensity={0.15 * intensity}
          transparent
          opacity={0.3 * fadeProgress}
        />
      </mesh>

      {/* Point light for death glow */}
      <pointLight
        color="#6A1B9A"
        intensity={2 * intensity * fadeProgress}
        distance={8}
        position={[0, 1, 0]}
      />
    </group>
  );
}
