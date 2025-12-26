import { useRef, useEffect, useState } from 'react';
import { Group, Vector3 } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface IcebeamProps {
  parentRef: React.RefObject<Group>;
  onComplete: () => void;
  isActive: boolean;
  startTime: number;
  intensity?: number;
}

export default function Icebeam({ 
  parentRef, 
  onComplete, 
  isActive, 
  startTime,
  intensity: externalIntensity = 1
}: IcebeamProps) {
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

  // Color interpolation helper function
  const lerpColor = (color1: string, color2: string, t: number): string => {
    const c1 = color1.replace('#', '');
    const c2 = color2.replace('#', '');
    const r1 = parseInt(c1.substr(0, 2), 16);
    const g1 = parseInt(c1.substr(2, 2), 16);
    const b1 = parseInt(c1.substr(4, 2), 16);
    const r2 = parseInt(c2.substr(0, 2), 16);
    const g2 = parseInt(c2.substr(2, 2), 16);
    const b2 = parseInt(c2.substr(4, 2), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  // Get beam colors based on duration - cycles through color wheel with extended blue time
  const getBeamColors = (activeTime: number) => {
    // Cycle through colors every 4 seconds (longer cycle for more blue time)
    const cycleTime = activeTime % 4;
    const cycleProgress = cycleTime / 4;

    // Define key colors with extended blue: Cyan (0-0.5), Orange (0.5-0.75), Purple (0.75-1.0)
    // This gives cyan 50% of the cycle time, orange 25%, purple 25%
    const colors = [
      { color: '#58FCEC', emissive: '#00E5FF' }, // Cyan (extended)
      { color: '#58FCEC', emissive: '#00E5FF' }, // Cyan (extended)
      { color: '#FF6B35', emissive: '#FF4500' }, // Orange
      { color: '#8A2BE2', emissive: '#9932CC' }, // Purple
      { color: '#58FCEC', emissive: '#00E5FF' }  // Back to Cyan
    ];

    // Find which segment we're in (0-4)
    const segmentIndex = Math.floor(cycleProgress * 4);
    const segmentProgress = (cycleProgress * 4) % 1;

    // Interpolate between current and next color
    const currentColor = colors[segmentIndex];
    const nextColor = colors[segmentIndex + 1] || colors[0];

    return {
      color: lerpColor(currentColor.color, nextColor.color, segmentProgress),
      emissive: lerpColor(currentColor.emissive, nextColor.emissive, segmentProgress)
    };
  };

  useFrame(() => {
    if (!beamRef.current) return;

    const currentTime = Date.now();

    // Update position and direction from parent
    if (parentRef.current) {
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
        const fadeDuration = 400; // 400ms fade out
        const progress = Math.min(fadeElapsed / fadeDuration, 1);
        setFadeProgress(1 - progress);

        if (progress >= 1) {
          beamRef.current.scale.setScalar(0);
          onComplete();
          return;
        }
      }
    } else if (isActive) {
      // Handle intensity increase over time (scales with external intensity from damage multiplier)
      const activeTime = (currentTime - startTime) / 1000;
      const baseIntensity = Math.min(1 + activeTime * 0.3, 2.5); // Max 1.5x intensity
      const newIntensity = baseIntensity * externalIntensity;
      // Cap visual scaling at 1.3x while keeping damage scaling unlimited
      const cappedVisualIntensity = Math.min(newIntensity, 1.3);
      setIntensity(cappedVisualIntensity);
      setFadeProgress(1); // Ensure full visibility when active
    }

    // Apply fade progress to scale
    const scale = fadeProgress;
    beamRef.current.scale.setScalar(scale);
  });

  // Get current beam colors based on active time
  const activeTime = isActive ? (Date.now() - startTime) / 1000 : 0;
  const beamColors = getBeamColors(activeTime);

  return (
    <group ref={beamRef}>
      {/* Origin point effects */}
      <group position={[0, -1.1, 2]}>
        {/* Origin core glow */}
        <mesh>
          <sphereGeometry args={[0.45 * intensity, 16, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={2.5 * intensity * fadeProgress}
            transparent
            opacity={0.65 * fadeProgress}
          />
        </mesh>

        {/* Origin outer glow */}
        <mesh>
          <sphereGeometry args={[0.65 * intensity, 16, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={0.7 * intensity * fadeProgress}
            transparent
            opacity={0.65 * fadeProgress}
          />
        </mesh>


        {/* Origin point light */}
        <pointLight
          color={beamColors.emissive}
          intensity={20 * intensity * fadeProgress}
          distance={3 * intensity}
        />
      </group>

      {/* Main beam group */}
      <group position={[0, -1.1, 11.85]}>
        {/* Core beam */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1 * intensity / 2, 0.1 * intensity, 20, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={50 * intensity * fadeProgress}
            transparent
            opacity={0.95 * fadeProgress}
          />
        </mesh>

        {/* Inner glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25 * intensity / 2, 0.275 * intensity, 20, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={10 * intensity * fadeProgress}
            transparent
            opacity={0.7 * fadeProgress}
          />
        </mesh>

        {/* Outer glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.30 * intensity, 0.375 * intensity, 20, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={2 * intensity * fadeProgress}
            transparent
            opacity={0.6 * fadeProgress}
          />
        </mesh>

        {/* Outermost glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.35 * intensity, 0.375 * intensity, 20, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
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
              color={beamColors.color}
              emissive={beamColors.emissive}
              emissiveIntensity={1 * intensity * fadeProgress}
              transparent
              opacity={0.3 * fadeProgress}
            />
          </mesh>
        ))}

        {/* Ice crystals/shards at end */}
        {[...Array(Math.floor(24 * intensity))].map((_, i) => (
          <mesh
            key={`shard-${i}`}
            position={[
              (Math.random() - 0.5) * 1.0 * intensity,
              (Math.random() - 0.5) * 1.75 * intensity,
              Math.random() * 5 - 11,
            ]}
            rotation={[
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
            ]}
          >
            <boxGeometry args={[0.05, 0.05, 0.1]} />
            <meshStandardMaterial
              color={beamColors.color}
              emissive={beamColors.emissive}
              emissiveIntensity={2 * intensity * fadeProgress}
              transparent
              opacity={0.75 * fadeProgress}
            />
          </mesh>
        ))}

        {/* Point light for the ice crystals */}
        <pointLight
          position={[0, 0, 12]}
          color={beamColors.emissive}
          intensity={12 * intensity * fadeProgress}
          distance={4 * intensity}
        />
      </group>
    </group>
  );
}

