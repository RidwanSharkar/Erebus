import { useRef, useMemo } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import React from 'react';

interface BossNeckProps {
  movementDirection?: Vector3;
  isDashing?: boolean;
}

const BossNeck: React.FC<BossNeckProps> = React.memo(({
  movementDirection,
  isDashing = false
}) => {
  const neckRef = useRef<Group>(null);
  const vertebraRefs = useRef<Group[]>([]);

  useFrame(({ clock }) => {
    if (!neckRef.current) return;

    const time = clock.getElapsedTime();

    // IDLE ANIMATION SETTINGS - Neck sways more gently than tail
    const idleFrequencyX = 0.3;
    const idleFrequencyY = 0.4;
    const idleAmplitudeX = 0.02;
    const idleAmplitudeY = 0.08;
    const baseRotationX = -0.15; // Slight forward lean

    const idleSwayX = Math.sin(time * idleFrequencyX) * idleAmplitudeX;
    const idleSwayY = Math.sin(time * idleFrequencyY) * idleAmplitudeY;

    let finalSwayX = idleSwayX;
    let finalSwayY = idleSwayY;

    // Only apply movement sway during dashes for performance and visual clarity
    if (isDashing && movementDirection) {
      const baseMovementIntensity = 0.8;
      const movementSwayXStrength = 0.25;
      const movementSwayYStrength = 0.08;

      const movementIntensity = movementDirection.length() * baseMovementIntensity;

      // Calculate sway based on movement direction during dash
      const movementSwayX = movementDirection.z * movementSwayXStrength * movementIntensity;
      const movementSwayY = movementDirection.x * movementSwayYStrength * movementIntensity;

      finalSwayX += movementSwayX;
      finalSwayY += movementSwayY;
    }

    // Directly apply rotations without triggering re-renders
    neckRef.current.rotation.x = baseRotationX + finalSwayX;
    neckRef.current.rotation.y = finalSwayY;

    // Update individual vertebra rotations for subtle idle movement
    vertebraRefs.current.forEach((vertebra, index) => {
      if (vertebra) {
        const swayProgress = Math.max(0, 1 - (index / 8));
        const idleSwayX = Math.sin(time * 0.8 + index * 0.15) * 0.008 * swayProgress;
        const idleSwayY = Math.sin(time * 0.6 + index * 0.2) * 0.015 * Math.pow(swayProgress, 1.1);

        vertebra.rotation.x = idleSwayX * 0.7;
        vertebra.rotation.y = idleSwayY * (1 - index / 3);
      }
    });
  });

  const vertebrae = useMemo(() => {
    return [...Array(6)].map((_, index) => {
      const scale = 1 - (index * 0.05);
      const progress = index / 10;
      const curve = Math.pow(progress, 3) * 0.8;

      const nextProgress = (index + 1) / 10;
      const nextCurve = Math.pow(nextProgress, 3) * 0.8;
      const deltaY = nextCurve - curve;
      const deltaZ = 0.25 * (1 - (index / 12));

      const initialAngle = -Math.PI / 2; // Point upward
      const segmentAngle = Math.atan2(deltaY, deltaZ) + (index === 0 ? initialAngle : 0);

      return (
        <group
          key={index}
          ref={(el) => {
            if (el) vertebraRefs.current[index] = el;
          }}
          position={[
            0,
            curve * 2 + index * 0.18,
            -index * 0.12 * (1 - (index / 20))
          ]}
          scale={scale}
          rotation={[-segmentAngle, 0, 0]}
        >
          {/* Main vertebra */}
          <mesh rotation={[Math.PI / -2, 0, 0]}>
            <cylinderGeometry args={[0.05, 0.065, 0.18, 6]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive="#8B0000"
              emissiveIntensity={0.5}
              roughness={0.3}
              metalness={0.4}
            />
          </mesh>

          {/* Vertebra spikes */}
          <group rotation={[Math.PI / 2, 0, Math.PI / 2]}>
            <mesh position={[0, 0.1, 0]}>
              <coneGeometry args={[0.025, 0.08, 4]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#8B0000"
                emissiveIntensity={0.5}
                roughness={0.3}
                metalness={0.4}
              />
            </mesh>
          </group>

          <group rotation={[Math.PI / 24, 0, -Math.PI / 2]}>
            <mesh position={[0, 0.1, 0]}>
              <coneGeometry args={[0.025, 0.08, 4]} />
              <meshStandardMaterial
                color="#ffffff"
                emissive="#8B0000"
                emissiveIntensity={0.5}
                roughness={0.3}
                metalness={0.4}
              />
            </mesh>
          </group>
        </group>
      );
    });
  }, []);

  return (
    <group
      ref={neckRef}
      position={[0, 0, 0]}
      rotation={[0.2, 0, 0]}
    >
      {vertebrae}
    </group>
  );
});

BossNeck.displayName = 'BossNeck';

export default BossNeck;

