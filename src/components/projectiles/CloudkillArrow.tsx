import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, ConeGeometry, MeshBasicMaterial, RingGeometry, AdditiveBlending, DoubleSide } from 'three';
import { Enemy } from '@/contexts/MultiplayerContext';

interface CloudkillArrowProps {
  targetId: string;
  initialTargetPosition: Vector3;
  onImpact: () => void;
  onComplete: () => void;
  playerPosition: Vector3;
  enemyData: Enemy[];
  onHit?: (targetId: string, damage: number, isCritical: boolean, position: Vector3) => void;
}

const DAMAGE_RADIUS = 1.5; // Smaller radius for arrows compared to meteors
const IMPACT_DURATION = 1.0;
const ARROW_SPEED = 26.5;
const ARROW_DAMAGE = 75;
const WARNING_RING_SEGMENTS = 6;
const ARROW_COUNT = 3; // 3 arrows per Cloudkill cast

// Reusable geometries and materials
const arrowGeometry = new ConeGeometry(0.1, 0.8, 8); // Arrow shape
const arrowMaterial = new MeshBasicMaterial({ color: "#00ff00" }); // Green arrows

// Trail effect constants
const TRAIL_SEGMENTS = 20; 

// Warning indicators scaled for arrows
const warningRingGeometry = new RingGeometry((DAMAGE_RADIUS - 0.2), DAMAGE_RADIUS, WARNING_RING_SEGMENTS);
const pulsingRingGeometry = new RingGeometry((DAMAGE_RADIUS - 0.4), (DAMAGE_RADIUS - 0.2), WARNING_RING_SEGMENTS);
const outerGlowGeometry = new RingGeometry((DAMAGE_RADIUS - 0.1), DAMAGE_RADIUS, WARNING_RING_SEGMENTS);

// Reusable vectors to avoid allocations
const tempTargetGroundPos = new Vector3();



// Improved Trail effect component for Cloudkill arrows (comet-like)
const CloudkillTrail = ({ 
  positions, 
  opacity = 1 
}: { 
  positions: Vector3[]; 
  opacity?: number; 
}) => {
  // Don't render if we don't have enough positions
  if (positions.length < 2) return null;

  return (
    <group>
      {positions.map((position, index) => {
        // Calculate alpha based on position in trail (older = less opaque)
        const normalizedIndex = index / Math.max(1, positions.length - 1);
        const alpha = normalizedIndex * opacity * 0.8;
        
        // Calculate size based on position in trail (older = smaller)
        const size = 0.1 + (normalizedIndex * 0.08);
        
        // Skip very faint trail segments
        if (alpha < 0.1) return null;
        
        return (
          <mesh key={`trail-${index}`} position={[position.x, position.y, position.z]}>
            <sphereGeometry args={[size, 8, 8]} />
            <meshBasicMaterial
              color="#00ff00"
              transparent
              opacity={alpha}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      
      {/* Additional bright core particles for the most recent positions */}
      {positions.length > 2 && positions.slice(-Math.min(6, positions.length)).map((position, index, array) => {
        const normalizedIndex = index / Math.max(1, array.length - 1);
        const alpha = normalizedIndex * opacity * 1.2;
        const size = 0.02 + (normalizedIndex * 0.04);
        
        return (
          <mesh key={`core-${index}`} position={[position.x, position.y, position.z]}>
            <sphereGeometry args={[size, 6, 6]} />
            <meshBasicMaterial
              color="#88ff88"
              transparent
              opacity={alpha}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
};

export default function CloudkillArrow({
  targetId,
  initialTargetPosition,
  onImpact,
  onComplete,
  playerPosition,
  enemyData,
  onHit
}: CloudkillArrowProps) {
  const arrowGroupRef = useRef<Group>(null);

  // State for tracking current target position
  const [currentTargetPosition, setCurrentTargetPosition] = useState(initialTargetPosition);

  // Store the original indicated position (where the warning ring was shown)
  // This is separate from currentTargetPosition for homing arrows
  const originalIndicatedPosition = useRef(initialTargetPosition.clone());

  // Chaotic movement variables (similar to EntropicBolt)
  const timeElapsed = useRef(0);
  const randomSeed = useRef(Math.random() * 1000);
  const chaoticOffset = useRef(new Vector3());

  // Trail tracking
  const trailPositions = useRef<Vector3[]>([]);
  const maxTrailLength = TRAIL_SEGMENTS;

  // useMemo for initial calculations
  const [, startPos] = React.useMemo(() => {
    const initTarget = new Vector3(initialTargetPosition.x, -3, initialTargetPosition.z);
    const start = new Vector3(initialTargetPosition.x, 50 + Math.random() * 20, initialTargetPosition.z); // Random height variation
    return [initTarget, start];
  }, [initialTargetPosition]);

  // State management
  const [state, setState] = useState({
    impactOccurred: false,
    showArrow: false,
    impactStartTime: null as number | null,
    warningStartTime: Date.now()
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setState(prev => ({ ...prev, showArrow: true }));
    }, 100); // 0.2 second delay for warning

    return () => clearTimeout(timer);
  }, []);

  useFrame((_, delta) => {
    timeElapsed.current += delta;

    // No target tracking needed - arrows fall straight to initial position

    if (!arrowGroupRef.current || !state.showArrow || state.impactOccurred) {
      if (state.impactOccurred && !state.impactStartTime) {
        setState(prev => ({ ...prev, impactStartTime: Date.now() }));
      }
      return;
    }

    const currentPos = arrowGroupRef.current.position;
    const currentTargetGroundPos = new Vector3(currentTargetPosition.x, -3, currentTargetPosition.z);
    const distanceToTarget = currentPos.distanceTo(currentTargetGroundPos);

    if (distanceToTarget < DAMAGE_RADIUS) {
      setState(prev => ({ ...prev, impactOccurred: true, impactStartTime: Date.now() }));

      // CRITICAL FIX: For damage calculation, check player positions at impact time, not at cast time
      // Always use original indicated position for damage area check (no homing behavior)
      // Position damage numbers above ground level for visibility
      const damagePosition = new Vector3(originalIndicatedPosition.current.x, 2.5, originalIndicatedPosition.current.z);

      if (onHit) {
        // Find the specific boss that was targeted
        const targetedBoss = enemyData.find(enemy => enemy.id === targetId);

        if (targetedBoss && targetedBoss.health > 0 && (targetedBoss.type === 'boss' || targetedBoss.type === 'boss-skeleton')) {
          // Check if the boss is still within the damage radius at impact time
          const bossPos = new Vector3(targetedBoss.position.x, 0, targetedBoss.position.z);
          const distance = bossPos.distanceTo(damagePosition);

          // Only damage if boss is currently within the damage radius at impact time
          if (distance <= DAMAGE_RADIUS) {
            onHit(targetedBoss.id, ARROW_DAMAGE, false, damagePosition);
          }
        }
      }
      return;
    }

    // Calculate base trajectory towards initial target position (no homing)
    const directionToTarget = currentTargetGroundPos.clone().sub(currentPos).normalize();
    const speed = ARROW_SPEED * delta;

    // Always fall straight down to initial target position (no homing behavior)
    const baseDirection = directionToTarget.clone();

    // Add localized chaotic movement for comet-like effect (much more subtle)
    const time = timeElapsed.current;
    const seed = randomSeed.current;
    
    // Reduced amplitude chaotic movement - more localized and comet-like
    const chaoticX = Math.sin(time * 4 + seed) * 0.08 * Math.sin(time * 2 + seed * 0.3) * 0.6;
    const chaoticY = Math.cos(time * 3 + seed * 1.2) * 0.06 * Math.sin(time * 2.5 + seed * 0.6) * 0.4;
    const chaoticZ = Math.sin(time * 3.5 + seed * 1.8) * 0.05 * Math.cos(time * 2.2 + seed * 0.9) * 0.5;
    
    // Very minimal jitter that decreases with distance
    const jitterIntensity = Math.max(0.02, (distanceToTarget / 80)) * 0.03;
    const jitterX = (Math.random() - 0.5) * jitterIntensity;
    const jitterY = (Math.random() - 0.5) * jitterIntensity;
    const jitterZ = (Math.random() - 0.5) * jitterIntensity;

    // Combine chaotic movement with jitter
    chaoticOffset.current.set(
      chaoticX + jitterX,
      chaoticY + jitterY,
      chaoticZ + jitterZ
    );

    // Apply base movement
    const idealPosition = currentPos.clone().addScaledVector(baseDirection, speed);
    
    // Add chaotic offset to the ideal position
    const finalPosition = idealPosition.add(chaoticOffset.current);
    currentPos.copy(finalPosition);

    // Update trail positions more frequently for better comet effect
    if (trailPositions.current.length >= maxTrailLength) {
      trailPositions.current.shift(); // Remove oldest position
    }
    
    // Store world position for trail (not relative to group)
    const worldPosition = finalPosition.clone();
    trailPositions.current.push(worldPosition);
  });

  const getPulsingScale = useCallback((): [number, number, number] => {
    const scale = 1 + Math.sin(Date.now() * 0.008) * 0.15;
    return [scale, scale, 1] as [number, number, number];
  }, []);

  const warningElapsed = (Date.now() - state.warningStartTime) / 1000;
  const showWarning = !state.impactOccurred; // Show warning until impact occurs

  return (
     <>
      {/* Warning indicators */}
      {showWarning && (
        <group position={[originalIndicatedPosition.current.x, 0.1, originalIndicatedPosition.current.z]}>
          {/* Warning rings using shared geometries */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={warningRingGeometry} />
            <meshBasicMaterial color="#00aa00" transparent opacity={0.5} side={DoubleSide} />
          </mesh>

          {/* Pulsing inner ring */}
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            scale={getPulsingScale()}
          >
            <primitive object={pulsingRingGeometry} />
            <meshBasicMaterial
              color="#00ff00"
              transparent
              opacity={0.5 + Math.sin(Date.now() * 0.005) * 0.3}
              side={DoubleSide}
            />
          </mesh>

          {/* Rotating outer glow ring */}
          <mesh
            rotation={[-Math.PI / 2, Date.now() * 0.004, 0]}
          >
            <primitive object={outerGlowGeometry} />
            <meshBasicMaterial
              color="#00cc00"
              transparent
              opacity={0.3}
              side={DoubleSide}
            />
          </mesh>

          {/* Rising particles */}
          {[...Array(8)].map((_, i) => (
            <mesh
              key={i}
              position={[
                Math.sin(Date.now() * 0.0015 + i) * (DAMAGE_RADIUS - 0.3),
                Math.sin(Date.now() * 0.0025 + i) * 0.3,
                Math.cos(Date.now() * 0.0015 + i) * (DAMAGE_RADIUS - 0.3)
              ]}
            >
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshBasicMaterial
                color="#00ff00"
                transparent
                opacity={0.4 + Math.sin(Date.now() * 0.006 + i) * 0.3}
              />
            </mesh>
          ))}
        </group>
      )}

      {/* Trail effect - rendered separately in world space */}
      {state.showArrow && trailPositions.current.length > 2 && (
        <CloudkillTrail
          positions={trailPositions.current}
          opacity={1.0}
        />
      )}

      {/* Arrow projectile */}
      {state.showArrow && (
        <group ref={arrowGroupRef} position={startPos}>
          <mesh rotation={[Math.PI, 0, 0]}> {/* Point downwards */}
            <primitive object={arrowGeometry} />
            <primitive object={arrowMaterial} />
            <pointLight color="#00ff00" intensity={3} distance={6} />
          </mesh>
        </group>
      )}

    </>
  );
}
