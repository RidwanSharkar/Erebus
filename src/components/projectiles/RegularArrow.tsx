import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, DoubleSide, AdditiveBlending } from '@/utils/three-exports';
import type { TempestBurstTheme } from '@/utils/talents';

interface RegularArrowProps {
  position: Vector3;
  direction: Vector3;
  onImpact?: (position: Vector3) => void;
  distanceTraveled?: number;
  maxDistance?: number;
  projectileType?: string;
  triggerFingerUncharged?: boolean;
  tempestBurstTheme?: TempestBurstTheme;
}

function resolveBurstArrowColors(theme: TempestBurstTheme | undefined): {
  color: string;
  emissiveColor: string;
  shaftEmissiveColor: string;
  fletchingColor: string;
  fletchingEmissiveColor: string;
  auraColor: string;
} {
  switch (theme) {
    case 'wrathful':
      return {
        color: '#cc2222',
        emissiveColor: '#ff3333',
        shaftEmissiveColor: '#aa1111',
        fletchingColor: '#ff4444',
        fletchingEmissiveColor: '#ff2222',
        auraColor: '#ff3333',
      };
    case 'arctic':
      return {
        color: '#8844cc',
        emissiveColor: '#aa66ff',
        shaftEmissiveColor: '#6622aa',
        fletchingColor: '#bb88ff',
        fletchingEmissiveColor: '#9944ee',
        auraColor: '#aa66ff',
      };
    case 'stagger':
      return {
        color: '#0088ff',
        emissiveColor: '#0088ff',
        shaftEmissiveColor: '#0066cc',
        fletchingColor: '#44aaff',
        fletchingEmissiveColor: '#0088ff',
        auraColor: '#0088ff',
      };
    case 'wyvern':
      return {
        color: '#00aa20',
        emissiveColor: '#00ff40',
        shaftEmissiveColor: '#008818',
        fletchingColor: '#44dd66',
        fletchingEmissiveColor: '#00ff40',
        auraColor: '#00ff40',
      };
    default:
      return {
        color: '#ff5500',
        emissiveColor: '#aa2200',
        shaftEmissiveColor: '#ff4400',
        fletchingColor: '#ff7722',
        fletchingEmissiveColor: '#ff5500',
        auraColor: '#ff5500',
      };
  }
}

const _lookAtTarget = new Vector3();
const _dirNorm = new Vector3();

export default function RegularArrow({
  position,
  direction,
  onImpact,
  distanceTraveled = 0,
  maxDistance = 25,
  projectileType,
  triggerFingerUncharged,
  tempestBurstTheme,
}: RegularArrowProps) {

  const arrowRef = useRef<Group>(null);

  const isBurstArrow = projectileType === 'burst_arrow';
  const isTriggerFinger = !isBurstArrow && triggerFingerUncharged === true;
  let color = '#00ffff';
  let emissiveColor = '#0088aa';
  let shaftEmissiveColor = '#0099cc';
  let fletchingColor = '#66ffff';
  let fletchingEmissiveColor = '#00aaff';
  let auraColor = '#00ffff';
  if (isBurstArrow) {
    const burstColors = resolveBurstArrowColors(tempestBurstTheme);
    color = burstColors.color;
    emissiveColor = burstColors.emissiveColor;
    shaftEmissiveColor = burstColors.shaftEmissiveColor;
    fletchingColor = burstColors.fletchingColor;
    fletchingEmissiveColor = burstColors.fletchingEmissiveColor;
    auraColor = burstColors.auraColor;
  } else if (isTriggerFinger) {
    color = '#ff2200';
    emissiveColor = '#880011';
    shaftEmissiveColor = '#dd1100';
    fletchingColor = '#ff4444';
    fletchingEmissiveColor = '#ff1100';
    auraColor = '#ff3300';
  }

  const size = 0.15;

  // Calculate fade based on distance traveled
  const fadeStartDistance = maxDistance * 0.7; // Start fading at 70% of max distance
  const fadeProgress = Math.max(0, Math.min(1, (distanceTraveled - fadeStartDistance) / (maxDistance - fadeStartDistance)));
  const opacity = Math.max(0.1, 1 - fadeProgress); // Minimum opacity of 0.1

  useFrame((_, delta) => {
    if (!arrowRef.current) return;

    // Use the position directly from the ECS system (passed via props)
    // The RegularArrowManager updates this position from the Transform component
    arrowRef.current.position.copy(position);
    
    // Orient arrow to face movement direction
    _lookAtTarget.copy(position).add(_dirNorm.copy(direction).normalize());
    arrowRef.current.lookAt(_lookAtTarget);
  });

  return (
    <group name="regular-arrow-group">
      <group ref={arrowRef} position={position}>
        {/* Arrow Head */}
        <mesh position={[0, 0, 0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.08, 0.25, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={emissiveColor}
            emissiveIntensity={3 * opacity}
            transparent
            opacity={0.9 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />

        </mesh>
        
        {/* Arrow Shaft */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.02, 0.03, 0.4, 8]} />
          <meshStandardMaterial
            color={color}
            emissive={shaftEmissiveColor}
            emissiveIntensity={2 * opacity}
            transparent
            opacity={0.8 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        
        {/* Arrow Fletching */}
        <group position={[0, 0, -0.15]}>
          {/* Three fletching vanes */}
          {[0, 120, 240].map((angle, index) => (
            <mesh 
              key={index}
              position={[
                Math.cos((angle * Math.PI) / 180) * 0.04,
                Math.sin((angle * Math.PI) / 180) * 0.04,
                0
              ]}
              rotation={[0, 0, (angle * Math.PI) / 180]}
            >
              <planeGeometry args={[0.08, 0.12]} />
              <meshStandardMaterial
                color={fletchingColor}
                emissive={fletchingEmissiveColor}
                emissiveIntensity={1.5 * opacity}
                transparent
                opacity={0.7 * opacity}
                side={DoubleSide}
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
        
        {/* Energy Aura around arrow */}
        <mesh>
          <sphereGeometry args={[size * 1.5, 16, 16]} />
          <meshStandardMaterial
            color={auraColor}
            emissive={color}
            emissiveIntensity={1 * opacity}
            transparent
            opacity={0.3 * opacity}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
        
 
      </group>
    </group>
  );
}
