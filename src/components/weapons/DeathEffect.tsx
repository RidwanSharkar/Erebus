import React, { useRef, useEffect, useMemo } from 'react';
import { Group, Vector3, Mesh, Material, MeshStandardMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import type { Position3 } from '@/utils/position3';

interface DeathEffectProps {
  position: Position3;
  duration?: number;
  startTime?: number;
  playerId?: string;
  onComplete?: () => void;
  // For tracking player position updates
  playerData?: Array<{
    id: string;
    position: Position3;
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
  const rotationSpeed = useRef(Math.random() * 0.01 + 0.005);
  const hasCompleted = useRef(false);

  const mistParticles = useMemo(
    () =>
      Array.from({ length: 8 }, () => ({
        position: [
          (Math.random() - 0.5) * 1.5,
          Math.random() * 1.5 + 0.2,
          (Math.random() - 0.5) * 1.5,
        ] as [number, number, number],
        rotation: [
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI,
        ] as [number, number, number],
        radius: 0.1 + Math.random() * 0.1,
      })),
    [],
  );

  const coreMatRef = useRef<MeshStandardMaterial>(null);
  const mistMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const ringMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const skullMatRef = useRef<MeshStandardMaterial>(null);
  const glowMatRef = useRef<MeshStandardMaterial>(null);
  const followPosScratch = useRef(new Vector3());

  // Borrow a pooled light instead of mounting a <pointLight> (avoids lit-shader recompiles).
  const deathLight = useDynamicLight({ color: '#6A1B9A', distance: 8, decay: 2, priority: 1 });

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

  // MEMORY FIX: Cleanup geometries and materials on unmount
  useEffect(() => {
    return () => {
      if (effectRef.current) {
        effectRef.current.traverse((child) => {
          if (child instanceof Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach((mat: Material) => mat.dispose());
              } else {
                (child.material as Material).dispose();
              }
            }
          }
        });
      }
    };
  }, []);

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
        followPosScratch.current.set(target.position.x, target.position.y + 0.5, target.position.z);
        effectRef.current.position.copy(followPosScratch.current);
      }
    }

    // Fade out in the last 500ms
    let currentFadeProgress = 1;
    if (progress > 0.9) {
      const fadeStart = 0.9;
      const fadeAmount = (progress - fadeStart) / (1 - fadeStart);
      currentFadeProgress = 1 - fadeAmount;
    }

    // Pulsing intensity effect
    const pulseIntensity = 0.7 + 0.3 * Math.sin(elapsed * 0.008);
    const currentIntensity = pulseIntensity * currentFadeProgress;

    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity = 0.4 * currentIntensity;
      coreMatRef.current.opacity = 0.6 * currentFadeProgress;
    }
    for (const mat of mistMatRefs.current) {
      if (mat) {
        mat.emissiveIntensity = 0.6 * currentIntensity;
        mat.opacity = 0.4 * currentFadeProgress;
      }
    }
    for (const mat of ringMatRefs.current) {
      if (mat) {
        mat.emissiveIntensity = 0.5 * currentIntensity;
        mat.opacity = 0.5 * currentFadeProgress;
      }
    }
    if (skullMatRef.current) {
      skullMatRef.current.emissiveIntensity = 0.8 * currentIntensity;
      skullMatRef.current.opacity = 0.7 * currentFadeProgress;
    }
    if (glowMatRef.current) {
      glowMatRef.current.emissiveIntensity = 0.15 * currentIntensity;
      glowMatRef.current.opacity = 0.3 * currentFadeProgress;
    }

    // Drive the pooled light at the effect's world position (group root + local [0,1,0]).
    // Replicates the former <pointLight>: 2 * intensity * fadeProgress.
    deathLight.current?.setPosition(
      effectRef.current.position.x,
      effectRef.current.position.y + 1,
      effectRef.current.position.z,
    );
    deathLight.current?.setIntensity(2 * currentIntensity * currentFadeProgress);

    // Rotate the death effect slowly
    effectRef.current.rotation.y += rotationSpeed.current;
    effectRef.current.rotation.x = Math.sin(elapsed * 0.002) * 0.05;
  });

  return (
    <group ref={effectRef} position={[position.x, position.y, position.z]}>
      {/* Dark ethereal sphere */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial
          ref={coreMatRef}
          color="#2D1B69"
          emissive="#4A148C"
          emissiveIntensity={0.4}
          transparent
          opacity={0.6}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>

      {/* Death mist particles */}
      {mistParticles.map((particle, i) => (
        <mesh
          key={`mist-${i}`}
          position={particle.position}
          rotation={particle.rotation}
        >
          <sphereGeometry args={[particle.radius, 8, 8]} />
          <meshStandardMaterial
            ref={(el) => { mistMatRefs.current[i] = el; }}
            color="#6A1B9A"
            emissive="#9C27B0"
            emissiveIntensity={0.6}
            transparent
            opacity={0.4}
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
            ref={(el) => { ringMatRefs.current[i] = el; }}
            color="#4A148C"
            emissive="#7B1FA2"
            emissiveIntensity={0.5}
            transparent
            opacity={0.5}
            roughness={0.7}
            metalness={0.2}
          />
        </mesh>
      ))}

      {/* Skull-like dark core */}
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.3, 12, 12]} />
        <meshStandardMaterial
          ref={skullMatRef}
          color="#1A0033"
          emissive="#4A148C"
          emissiveIntensity={0.8}
          transparent
          opacity={0.7}
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>

      {/* Dark glow effect */}
      <mesh>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshStandardMaterial
          ref={glowMatRef}
          color="#4A148C"
          emissive="#6A1B9A"
          emissiveIntensity={0.15}
          transparent
          opacity={0.3}
        />
      </mesh>

    </group>
  );
}
