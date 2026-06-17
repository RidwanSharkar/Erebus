import React, { useRef } from 'react';
import { Vector3, Group, AdditiveBlending } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { REAPING_TALONS_MAX_TRAVEL_DISTANCE } from '@/utils/talents';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface ViperStingBeamProps {
  position: Vector3;
  direction: Vector3;
  onComplete: () => void;
  isReturning?: boolean;
  /** Matches Reaping Talons max travel (e.g. shorter with Explosive Talons). */
  beamLength?: number;
  /** Glacial Talons co-op boon — deep blue palette (aligned with Arctic Sting perfect shot). */
  glacialTalonsTheme?: boolean;
}

const ViperStingBeam: React.FC<ViperStingBeamProps> = ({ 
  position, 
  direction, 
  onComplete,
  isReturning = false,
  beamLength = REAPING_TALONS_MAX_TRAVEL_DISTANCE,
  glacialTalonsTheme = false,
}) => {
  const lenScale = beamLength / REAPING_TALONS_MAX_TRAVEL_DISTANCE;
  const halfZ = beamLength * 0.5;
  const groupRef = useRef<Group>(null);
  const startTimeRef = useRef(Date.now());
  const duration = 200; // Slightly longer than bow powershot
  const fadeStartTime = useRef<number | null>(null);
  
  // Default: reddish-orange venom beam; Glacial Talons: deep blue (BowPowershot arctic palette).
  const colors = glacialTalonsTheme
    ? { core: '#0a3d6e', emissive: '#051a38', outer: '#1a6ba3' }
    : {
        core: "#ff4400",
        emissive: "#cc0000",
        outer: "#ff6600",
      };
  const returnAccent = glacialTalonsTheme ? '#4da6ff' : '#ff6600';

  // Borrow a pooled light instead of mounting a <pointLight> (avoids lit-shader recompiles).
  const beamLight = useDynamicLight({ color: colors.emissive, distance: 9 * lenScale, decay: 2, priority: 2 });

  useFrame(() => {
    const elapsed = Date.now() - startTimeRef.current;

    if (elapsed >= duration && !fadeStartTime.current) {
      fadeStartTime.current = Date.now();
    }

    // Drive the pooled light at the beam mid-point in world space. The light sat at local
    // [0,0,halfZ] inside a group rotated by atan2(dir.x,dir.z) and parented at `position`,
    // so world = position + horizontalDir * halfZ.
    const yaw = Math.atan2(direction.x, direction.z);
    const fade = fadeStartTime.current
      ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 350)
      : 1;
    beamLight.current?.setPosition(
      position.x + Math.sin(yaw) * halfZ,
      position.y,
      position.z + Math.cos(yaw) * halfZ,
    );
    beamLight.current?.setIntensity(18 * fade);

    // Handle fade out
    if (fadeStartTime.current) {
      const fadeElapsed = Date.now() - fadeStartTime.current;
      const fadeDuration = 250; // Slightly longer fade for venom effect

      if (fadeElapsed >= fadeDuration) {
        onComplete();
        return;
      }
    }
  });

  const fadeProgress = fadeStartTime.current 
    ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 350)
    : 1;

  return (
    <group ref={groupRef} position={position.toArray()}>
      {/* Main beam trail - very thin like firebeam but 1/4 diameter */}
      <group
        rotation={[
          0,
          Math.atan2(direction.x, direction.z),
          0
        ]}
      >
        {/* Core beam - ultra thin with venom glow */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, halfZ]}>
          <cylinderGeometry args={[0.03, 0.03, beamLength, 8]} />
          <meshStandardMaterial
            color={colors.core}
            emissive={colors.emissive}
            emissiveIntensity={14 * fadeProgress}
            transparent
            opacity={0.95 * fadeProgress}
          />
        </mesh>

        {/* Inner glow - venomous aura */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, halfZ]}>
          <cylinderGeometry args={[0.07, 0.07, beamLength, 8]} />
          <meshStandardMaterial
            color={colors.emissive}
            emissive={colors.emissive}
            emissiveIntensity={9 * fadeProgress}
            transparent
            opacity={0.7 * fadeProgress}
          />
        </mesh>

        {/* Outer glow - toxic mist */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, halfZ]}>
          <cylinderGeometry args={[0.09, 0.09, beamLength, 8]} />
          <meshStandardMaterial
            color={colors.outer}
            emissive={colors.core}
            emissiveIntensity={5 * fadeProgress}
            transparent
            opacity={0.5 * fadeProgress}
          />
        </mesh>

        {/* Venom ring/swirl effects that last longer */}
        {[...Array(7)].map((_, i) => {
          const ringProgress = Math.min(1, (Date.now() - startTimeRef.current) / 900); // Slower fade for venom rings
          const ringFade = fadeStartTime.current 
            ? Math.max(0, 1 - (Date.now() - fadeStartTime.current) / 700) // Longer fade for rings
            : 1;
          
          const offset = i * 2.8 * lenScale;
          const scale = 1 - (i * 0.08);
          
          return (
            <group key={`ring-${i}`} position={[0, 0, offset]}>
              {/* Venom smoke ring effect */}
              <mesh
                rotation={[0, Date.now() * 0.0025 + i, 0]}
                scale={[scale, scale, scale]}
              >
                <torusGeometry args={[0.35, 0.07, 6, 12]} />
                <meshStandardMaterial
                  color={colors.outer}
                  emissive={colors.emissive}
                  emissiveIntensity={2.5 * ringFade}
                  transparent
                  opacity={0.45 * ringFade * (1 - ringProgress * 0.4)}
                  blending={AdditiveBlending}
                />
              </mesh>
              
              {/* Secondary venom swirl */}
              <mesh
                rotation={[Math.PI/2, Date.now() * -0.0035 + i, 0]}
                scale={[scale * 0.75, scale * 0.75, scale * 0.75]}
              >
                <torusGeometry args={[0.28, 0.05, 6, 12]} />
                <meshStandardMaterial
                  color={colors.core}
                  emissive={colors.emissive}
                  emissiveIntensity={1.8 * ringFade}
                  transparent
                  opacity={0.35 * ringFade * (1 - ringProgress * 0.25)}
                  blending={AdditiveBlending}
                />
              </mesh>
            </group>
          );
        })}

        {/* Venom particles floating around the beam */}
        {[...Array(6)].map((_, i) => {
          const angle = (i / 6) * Math.PI * 2;
          const radius = 0.12;
          const floatOffset = Math.sin(Date.now() * 0.003 + i) * 0.05;
          return (
            <group key={`venom-particle-${i}`} position={[
              Math.sin(angle + Date.now() * 0.002) * radius,
              Math.cos(angle + Date.now() * 0.002) * radius + floatOffset,
              8 * lenScale + Math.sin(Date.now() * 0.004 + i) * 3 * lenScale
            ]}>
              <mesh>
                <sphereGeometry args={[0.025, 4, 4]} />
                <meshStandardMaterial
                  color={colors.outer}
                  emissive={colors.outer}
                  emissiveIntensity={6 * fadeProgress}
                  transparent
                  opacity={0.7 * fadeProgress}
                  blending={AdditiveBlending}
                />
              </mesh>
            </group>
          );
        })}

        {/* Additional returning shot effects */}
        {isReturning && (
          <>
            {/* Soul energy crackling effect for returning shots */}
            {[...Array(5)].map((_, i) => {
              const angle = (i / 5) * Math.PI * 2;
              const radius = 0.18;
              return (
                <group key={`soul-energy-${i}`} position={[
                  Math.sin(angle + Date.now() * 0.012) * radius,
                  Math.cos(angle + Date.now() * 0.012) * radius,
                  halfZ + Math.sin(Date.now() * 0.006 + i) * 2.5 * lenScale
                ]}>
                  <mesh>
                    <sphereGeometry args={[0.03, 4, 4]} />
                    <meshStandardMaterial
                      color={returnAccent}
                      emissive={returnAccent}
                      emissiveIntensity={10 * fadeProgress}
                      transparent
                      opacity={0.9 * fadeProgress}
                      blending={AdditiveBlending}
                    />
                  </mesh>
                </group>
              );
            })}
            
            {/* Soul steal aura for returning shots */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, halfZ]}>
              <cylinderGeometry args={[0.15, 0.15, beamLength, 8]} />
              <meshStandardMaterial
                color={returnAccent}
                emissive={returnAccent}
                emissiveIntensity={3 * fadeProgress}
                transparent
                opacity={0.4 * fadeProgress}
                blending={AdditiveBlending}
              />
            </mesh>
          </>
        )}
      </group>
    </group>
  );
};

export default ViperStingBeam;
