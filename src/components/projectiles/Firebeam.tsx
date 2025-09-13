import { useRef, useEffect, useState } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';

interface FirebeamProps {
  parentRef: React.RefObject<Group>;
  onComplete: () => void;
  onHit?: () => void;
  isActive: boolean;
  startTime: number;
  fixedPosition?: Vector3; // Optional fixed position for abilities like Particle Beam
  fixedDirection?: Vector3; // Optional fixed direction for abilities like Particle Beam
}

export default function Firebeam({ parentRef, onComplete, isActive, startTime, fixedPosition, fixedDirection }: FirebeamProps) {
  const beamRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const fadeStartTime = useRef<number | null>(null);
  const currentPosition = useRef(new Vector3());
  const currentDirection = useRef(new Vector3());

  // Handle fade out when beam becomes inactive
  useEffect(() => {
    if (!isActive && !isFadingOut) {
      setIsFadingOut(true);
      fadeStartTime.current = Date.now();
    }
  }, [isActive, isFadingOut]);

  useFrame(() => {
    if (!beamRef.current) return;

    const currentTime = Date.now();

    // Use fixed position/direction if provided (for Particle Beam), otherwise use parentRef
    if (fixedPosition && fixedDirection) {
      currentPosition.current.copy(fixedPosition);
      currentPosition.current.y += 1; // Offset for beam origin
      currentDirection.current.copy(fixedDirection);

      // Update beam position and rotation
      beamRef.current.position.copy(currentPosition.current);
      beamRef.current.rotation.y = Math.atan2(currentDirection.current.x, currentDirection.current.z);
    } else if (parentRef.current) {
      // Fallback to parentRef behavior for other beams
      currentPosition.current.copy(parentRef.current.position);
      currentPosition.current.y += 1; // Offset for beam origin

      currentDirection.current.set(0, 0, 1);
      currentDirection.current.applyQuaternion(parentRef.current.quaternion);

      // Update beam position and rotation
      beamRef.current.position.copy(currentPosition.current);
      beamRef.current.rotation.y = Math.atan2(currentDirection.current.x, currentDirection.current.z);
    }

    if (isFadingOut) {
      // Handle smooth fade out
      if (fadeStartTime.current) {
        const fadeElapsed = currentTime - fadeStartTime.current;
        const fadeDuration = 400; // 400ms fade out for shorter duration
        const progress = Math.min(fadeElapsed / fadeDuration, 1);
        setFadeProgress(1 - progress);

        if (progress >= 1) {
          beamRef.current.scale.setScalar(0);
          onComplete();
          return;
        }
      }
    } else if (isActive) {
      // Handle intensity increase over time
      const activeTime = (currentTime - startTime) / 1000;
      const newIntensity = Math.min(1 + activeTime * 0.5, 2.0); // Max 2x intensity after ~2 seconds
      setIntensity(newIntensity);
      setFadeProgress(1); // Ensure full visibility when active
    }

    // Apply fade progress to scale
    const scale = fadeProgress;
    beamRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={beamRef}>
      {/* Origin point effects */}
      <group position={[0, -1.1, 0]}>
        {/* Origin core glow */}
        <mesh>
          <sphereGeometry args={[0.45 * intensity, 16, 16]} />
          <meshStandardMaterial
            color="#58FCEC"
            emissive="#00E5FF"
            emissiveIntensity={2.5 * intensity * fadeProgress}
            transparent
            opacity={0.65 * fadeProgress}
          />
        </mesh>

        {/* Origin outer glow */}
        <mesh>
          <sphereGeometry args={[0.65 * intensity, 16, 16]} />
          <meshStandardMaterial
            color="#58FCEC"
            emissive="#00E5FF"
            emissiveIntensity={0.7 * intensity * fadeProgress}
            transparent
            opacity={0.65 * fadeProgress}
          />
        </mesh>

        {/* Origin energy rings */}
        {[...Array(3)].map((_, i) => (
          <mesh
            key={`ring-${i}`}
            rotation={[Math.PI / 2, 0, (i * Math.PI) / 3]}
          >
            <torusGeometry args={[0.725 * intensity/2, 0.075, 8, 32]} />
            <meshStandardMaterial
              color="#58FCEC"
              emissive="#00E5FF"
              emissiveIntensity={0.8 * intensity * fadeProgress}
              transparent
              opacity={0.9 * fadeProgress}
            />
          </mesh>
        ))}

        {/* Origin point light */}
        <pointLight
          color="#58FCEC"
          intensity={20 * intensity * fadeProgress}
          distance={3 * intensity}
        />
      </group>

      {/* Main beam group */}
      <group position={[0, -1.1, 10.7]}>
        {/* Core beam */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1 * intensity/2, 0.1 * intensity, 20, 16]} />
          <meshStandardMaterial
            color="#58FCEC"
            emissive="#00E5FF"
            emissiveIntensity={50 * intensity * fadeProgress}
            transparent
            opacity={0.95 * fadeProgress}
          />
        </mesh>

        {/* Inner glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25 * intensity/2, 0.275 * intensity, 20, 16]} />
          <meshStandardMaterial
            color="#58FCEC"
            emissive="#00E5FF"
            emissiveIntensity={10 * intensity * fadeProgress}
            transparent
            opacity={0.7 * fadeProgress}
          />
        </mesh>

        {/* Outer glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.30 * intensity, 0.375 * intensity, 20, 16]} />
          <meshStandardMaterial
            color="#58FCEC"
            emissive="#00E5FF"
            emissiveIntensity={2 * intensity * fadeProgress}
            transparent
            opacity={0.6 * fadeProgress}
          />
        </mesh>

        {/* Outerest glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35 * intensity, 0.375 * intensity, 20, 16]} />
          <meshStandardMaterial
            color="#58FCEC"
            emissive="#00E5FF"
            emissiveIntensity={0.75 * intensity * fadeProgress}
            transparent
            opacity={0.6 * fadeProgress}
          />
        </mesh>

        {/* Spiral effect */}
        {[...Array(Math.floor(5 * intensity))].map((_, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 4, 0, (i * Math.PI) / -1.5]}
            position={[0, 0, 10]}
          >
            <torusGeometry args={[0.35 * intensity, 0.05, 8, 32]} />
            <meshStandardMaterial
              color="#58FCEC"
              emissive="#00E5FF"
              emissiveIntensity={1 * intensity * fadeProgress}
              transparent
              opacity={0.3 * fadeProgress}
            />
          </mesh>
        ))}

        {/* End-beam sparks */}
        {[...Array(Math.floor(24 * intensity))].map((_, i) => (
          <mesh
            key={`spark-${i}`}
            position={[
              (Math.random() - 0.5) * 1.0 * intensity,
              (Math.random() - 0.5) * 1.75 * intensity,
              Math.random() * 5 -11,
            ]}
            rotation={[
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
            ]}
          >
            <boxGeometry args={[0.05, 0.05, 0.1]} />
            <meshStandardMaterial
              color="#58FCEC"
              emissive="#00E5FF"
              emissiveIntensity={2 * intensity * fadeProgress}
              transparent
              opacity={0.75 * fadeProgress}
            />
          </mesh>
        ))}

        {/* Adjusted point light for the sparks */}
        <pointLight
          position={[0, 0, 12]}
          color="#00E5FF"
          intensity={12 * intensity * fadeProgress}
          distance={4 * intensity}
        />
      </group>
    </group>
  );
}
