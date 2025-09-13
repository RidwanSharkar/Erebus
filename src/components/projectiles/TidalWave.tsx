import { useRef, useEffect, useState } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';

interface TidalWaveProps {
  position: Vector3;
  direction: Vector3; // Direction the wave should travel (facing direction)
  onComplete: () => void;
  isActive: boolean;
  startTime: number;
  waveSpeed?: number; // How fast the wave expands
  maxRadius?: number; // Maximum radius of the wave
  waveHeight?: number; // Height of the wave
  arcAngle?: number; // Arc angle in radians (default: PI/2 for 90 degrees)
}

export default function TidalWave({
  position,
  direction,
  onComplete,
  isActive,
  startTime,
  waveSpeed = 8, // 8 units per second
  maxRadius = 12, // 12 unit radius
  waveHeight = 2,
  arcAngle = Math.PI / 2 // 90 degrees arc by default
}: TidalWaveProps) {
  const waveRef = useRef<Group>(null);
  const [currentRadius, setCurrentRadius] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [fadeProgress, setFadeProgress] = useState(1);
  const fadeStartTime = useRef<number | null>(null);

  // Handle fade out when wave becomes inactive
  useEffect(() => {
    if (!isActive && !isFadingOut) {
      setIsFadingOut(true);
      fadeStartTime.current = Date.now();
    }
  }, [isActive, isFadingOut]);

  useFrame(() => {
    if (!waveRef.current) return;

    const currentTime = Date.now();

    if (isFadingOut) {
      // Handle smooth fade out
      if (fadeStartTime.current) {
        const fadeElapsed = currentTime - fadeStartTime.current;
        const fadeDuration = 600; // 600ms fade out
        const progress = Math.min(fadeElapsed / fadeDuration, 1);
        setFadeProgress(1 - progress);

        if (progress >= 1) {
          waveRef.current.scale.setScalar(0);
          onComplete();
          return;
        }
      }
    } else if (isActive) {
      // Expand the wave
      const activeTime = (currentTime - startTime) / 1000; // Convert to seconds
      const newRadius = Math.min(activeTime * waveSpeed, maxRadius);
      setCurrentRadius(newRadius);
      setFadeProgress(1);

      // Complete when max radius is reached
      if (newRadius >= maxRadius) {
        setIsFadingOut(true);
        fadeStartTime.current = Date.now();
      }
    }

    // Update wave position
    waveRef.current.position.copy(position);
  });

  // Create arc wave geometry - only extends in front of the player
  const waveSegments = 32; // Number of segments in the wave
  const wavePoints = [];

  // Calculate the base angle from the direction vector
  const baseAngle = Math.atan2(direction.x, direction.z);

  // Create arc from -arcAngle/2 to +arcAngle/2 relative to facing direction
  const startAngle = baseAngle - arcAngle / 2;
  const endAngle = baseAngle + arcAngle / 2;

  for (let i = 0; i <= waveSegments; i++) {
    const t = i / waveSegments;
    const angle = startAngle + t * arcAngle;
    const x = Math.cos(angle) * currentRadius;
    const z = Math.sin(angle) * currentRadius;
    wavePoints.push([x, 0, z]);
  }

  return (
    <group ref={waveRef}>
      {/* Main wave arc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0, currentRadius - 0.5), currentRadius, waveSegments, 1, 0, arcAngle]} />
        <meshBasicMaterial
          color="#00aaff"
          transparent
          opacity={0.6 * fadeProgress}
          side={2} // DoubleSide
        />
      </mesh>

      {/* Inner wave arc for depth */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0, currentRadius - 1), Math.max(0, currentRadius - 0.5), waveSegments, 1, 0, arcAngle]} />
        <meshBasicMaterial
          color="#0088dd"
          transparent
          opacity={0.4 * fadeProgress}
          side={2}
        />
      </mesh>

      {/* Wave particles effect - distributed within the arc */}
      {Array.from({ length: 8 }).map((_, i) => {
        const t = i / 7; // 0 to 1
        const angle = startAngle + t * arcAngle;
        const particleRadius = currentRadius;
        const x = Math.cos(angle) * particleRadius;
        const z = Math.sin(angle) * particleRadius;

        return (
          <mesh key={i} position={[x, waveHeight * 0.5, z]}>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshBasicMaterial
              color="#ffffff"
              transparent
              opacity={0.8 * fadeProgress}
            />
          </mesh>
        );
      })}

      {/* Central splash effect */}
      <mesh position={[0, waveHeight * 0.3, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.5 * fadeProgress}
        />
      </mesh>
    </group>
  );
}
