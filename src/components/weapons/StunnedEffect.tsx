import React, { useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3 } from '@/utils/three-exports';

interface StunnedEffectProps {
  position: Vector3;
  duration?: number;
  startTime?: number;
  enemyId?: string;
  onComplete?: () => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    isDying?: boolean;
    deathStartTime?: number;
  }>;
  disableCameraRotation?: boolean; // New prop to disable camera rotation during stun
}

export default function StunnedEffect({
  position,
  duration = 4000, // 4 seconds stun duration
  startTime = Date.now(),
  enemyId,
  enemyData = [],
  onComplete,
  disableCameraRotation = false
}: StunnedEffectProps) {
  const effectRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(1);
  const rotationSpeed = useRef(Math.random() * 0.03 + 0.02);
  const pulseSpeed = useRef(Math.random() * 0.008 + 0.006);
  const elapsedRef = useRef(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (onComplete) onComplete();
    }, duration);

    return () => {
      clearTimeout(timeout);
    };
  }, [duration, onComplete, enemyId]);

  // Handle camera rotation disable for sabre stuns
  useEffect(() => {
    if (!disableCameraRotation || !enemyId) return;

    // Disable camera rotation during stun
    const cameraSystem = (window as any).cameraSystem;
    if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
      cameraSystem.setCameraRotationDisabled(true, enemyId);

      // Re-enable camera rotation when stun ends
      const timeout = setTimeout(() => {
        if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
          cameraSystem.setCameraRotationDisabled(false, enemyId);
        }
      }, duration);

      return () => {
        clearTimeout(timeout);
        if (cameraSystem && typeof cameraSystem.setCameraRotationDisabled === 'function') {
          cameraSystem.setCameraRotationDisabled(false, enemyId);
        }
      };
    }
  }, [disableCameraRotation, enemyId, duration]);

  useFrame(() => {
    if (!effectRef.current) return;

    const currentTime = Date.now();
    const elapsed = currentTime - startTime;
    elapsedRef.current = elapsed; // Store elapsed time in ref for use in JSX
    const progress = Math.min(elapsed / duration, 1);

    // Safety check: if effect has exceeded its duration, trigger completion
    if (progress >= 1 && onComplete) {
      onComplete();
      return;
    }

    // Update position to follow enemy if enemyId is provided
    if (enemyId && enemyData.length > 0) {
      const target = enemyData.find(enemy => enemy.id === enemyId);
      
      if (target && target.health > 0 && !target.isDying && !target.deathStartTime) {
        // Update the group position to follow the enemy
        const targetPosition = target.position.clone();
        targetPosition.y += 0.5; // Adjust Y offset to be at player level
        effectRef.current.position.copy(targetPosition);
      }
      // Note: If target is not found, we keep the original position passed as prop
      // This is important for PVP mode where the position is managed externally
    }

    // Fade out in the last 500ms
    if (progress > 0.875) {
      const fadeStart = 0.875;
      const fadeProgress = (progress - fadeStart) / (1 - fadeStart);
      setFadeProgress(1 - fadeProgress);
    } else {
      setFadeProgress(1);
    }

    // Pulsing intensity effect - more aggressive than freeze
    const pulseIntensity = 0.6 + 0.4 * Math.sin(elapsed * pulseSpeed.current);
    setIntensity(pulseIntensity * fadeProgress);

    // Rotate the lightning cage
    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.004) * 0.15;
    effectRef.current.rotation.z = Math.cos(elapsed * 0.003) * 0.1;
  });

  return (
    <group ref={effectRef} position={position}>
      {/* Lightning cage base */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.9, 1.0, 0.4, 6]} />
        <meshStandardMaterial
          color="#FFD700"
          emissive="#FFA500"
          emissiveIntensity={0.4 * intensity}
          transparent
          opacity={0.6 * fadeProgress}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Main lightning orb */}
      <mesh position={[0, 1.0, 0]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          color="#FFFF00"
          emissive="#FFD700"
          emissiveIntensity={0.8 * intensity}
          transparent
          opacity={0.7 * fadeProgress}
          roughness={0.1}
          metalness={0.3}
        />
      </mesh>

      {/* Lightning bolts around the orb */}
      {[...Array(8)].map((_, i) => (
        <group
          key={i}
          rotation={[0, (i * Math.PI) / 4, 0]}
          position={[
            Math.cos((i * Math.PI) / 4) * 0.8,
            0.2 + Math.sin(i + elapsedRef.current * 0.01) * 0.4,
            Math.sin((i * Math.PI) / 4) * 0.8
          ]}
        >
          <mesh rotation={[Math.PI / 3, 0, Math.PI / 6]}>
            <boxGeometry args={[0.05, 0.6, 0.05]} />
            <meshStandardMaterial
              color="#FFFF00"
              emissive="#FFC107"
              emissiveIntensity={0.6 * intensity}
              transparent
              opacity={0.8 * fadeProgress}
              roughness={0.1}
              metalness={0.9}
            />
          </mesh>
        </group>
      ))}

      {/* Electric sparks */}
      {[...Array(16)].map((_, i) => (
        <mesh
          key={`spark-${i}`}
          position={[
            (Math.random() - 0.5) * 2.5,
            Math.random() * 2 + 0.2,
            (Math.random() - 0.5) * 2.5
          ]}
          rotation={[
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
          ]}
        >
          <boxGeometry args={[0.02, 0.15, 0.02]} />
          <meshStandardMaterial
            color="#FFFFFF"
            emissive="#FFFF00"
            emissiveIntensity={0.9 * intensity * (0.5 + Math.sin(elapsedRef.current * 0.02 + i) * 0.5)}
            transparent
            opacity={0.9 * fadeProgress * (0.3 + Math.sin(elapsedRef.current * 0.015 + i * 0.5) * 0.7)}
            roughness={0}
            metalness={1}
          />
        </mesh>
      ))}

      {/* Central energy core */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#FFFF00"
          emissiveIntensity={1.2 * intensity}
          transparent
          opacity={0.9 * fadeProgress}
          roughness={0}
          metalness={0.5}
        />
      </mesh>

      {/* Point light for illumination */}
      <pointLight
        color="#FFFF00"
        intensity={2 * intensity * fadeProgress}
        distance={4}
        decay={2}
        position={[0, 0.5, 0]}
      />
    </group>
  );
}
