import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import * as THREE from 'three';
import { Enemy } from '@/contexts/MultiplayerContext';

interface CloudkillArrowProps {
  targetId: string;
  initialTargetPosition: THREE.Vector3;
  onImpact: (damage: number) => void;
  onComplete: () => void;
  playerPosition: THREE.Vector3;
  enemyData: Enemy[];
  onHit?: (targetId: string, damage: number, isCritical: boolean, position: THREE.Vector3) => void;
  isHoming?: boolean; // Whether this arrow should home in on venom-affected enemies
  players?: Array<{ id: string; position: { x: number; y: number; z: number }; health?: number }>; // For PVP mode
}

const DAMAGE_RADIUS = 1.5; // Smaller radius for arrows compared to meteors
const IMPACT_DURATION = 1.0;
const ARROW_SPEED = 25.0;
const ARROW_DAMAGE = 50;
const WARNING_RING_SEGMENTS = 24;
const ARROW_COUNT = 3; // 3 arrows per Cloudkill cast

// Reusable geometries and materials
const arrowGeometry = new THREE.ConeGeometry(0.1, 0.8, 8); // Arrow shape
const arrowMaterial = new THREE.MeshBasicMaterial({ color: "#00ff00" }); // Green arrows
const trailGeometry = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);

// Warning indicators scaled for arrows
const warningRingGeometry = new THREE.RingGeometry((DAMAGE_RADIUS - 0.2), DAMAGE_RADIUS, WARNING_RING_SEGMENTS);
const pulsingRingGeometry = new THREE.RingGeometry((DAMAGE_RADIUS - 0.4), (DAMAGE_RADIUS - 0.2), WARNING_RING_SEGMENTS);
const outerGlowGeometry = new THREE.RingGeometry((DAMAGE_RADIUS - 0.1), DAMAGE_RADIUS, WARNING_RING_SEGMENTS);

// Reusable vectors to avoid allocations
const tempPlayerGroundPos = new THREE.Vector3();
const tempTargetGroundPos = new THREE.Vector3();

const createArrowImpactEffect = (position: THREE.Vector3, startTime: number, onComplete: () => void) => {
  const elapsed = (Date.now() - startTime) / 1000;
  const fade = Math.max(0, 1 - (elapsed / IMPACT_DURATION));

  if (fade <= 0) {
    onComplete();
    return null;
  }

  return (
    <group position={position}>
      {/* Core explosion sphere */}
      <mesh>
        <sphereGeometry args={[0.8 * (1 + elapsed), 16, 16]} />
        <meshStandardMaterial
          color="#00ff00"
          emissive="#00aa00"
          emissiveIntensity={2 * fade}
          transparent
          opacity={1.5 * fade}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Inner energy sphere */}
      <mesh>
        <sphereGeometry args={[0.4, 12, 12]} />
        <meshStandardMaterial
          color="#88ff88"
          emissive="#ffffff"
          emissiveIntensity={2 * fade}
          transparent
          opacity={1.6 * fade}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Expanding rings */}
      {[1.2, 1.4, 1.6].map((size, i) => (
        <mesh key={i} rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}>
          <torusGeometry args={[size * (1 + elapsed * 1.5), 0.15, 3, 16]} />
          <meshStandardMaterial
            color="#00ff00"
            emissive="#00aa00"
            emissiveIntensity={0.7 * fade}
            transparent
            opacity={0.8 * fade * (1 - i * 0.15)}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* Dynamic lights with fade */}
      <pointLight
        color="#00ff00"
        intensity={0.6 * fade}
        distance={6 * (1 + elapsed)}
        decay={2}
      />
      <pointLight
        color="#88ff88"
        intensity={0.6 * fade}
        distance={8}
        decay={1}
      />
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
  onHit,
  isHoming = false,
  players = []
}: CloudkillArrowProps) {
  const arrowGroupRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Mesh>(null);

  // State for tracking current target position
  const [currentTargetPosition, setCurrentTargetPosition] = useState(initialTargetPosition);

  // useMemo for initial calculations
  const [, startPos] = React.useMemo(() => {
    const initTarget = new THREE.Vector3(initialTargetPosition.x, -3, initialTargetPosition.z);
    const start = new THREE.Vector3(initialTargetPosition.x, 50 + Math.random() * 20, initialTargetPosition.z); // Random height variation
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
    }, 500); // 0.5 second delay for warning

    return () => clearTimeout(timer);
  }, []);

  useFrame((_, delta) => {
    // Update target tracking - find current target position (enemy or player)
    if (isHoming) {
      // First check enemies
      const enemyTarget = enemyData.find(enemy => enemy.id === targetId && enemy.health > 0);
      if (enemyTarget) {
        setCurrentTargetPosition(new Vector3(enemyTarget.position.x, enemyTarget.position.y, enemyTarget.position.z));
      } else {
        // Then check players - for homing arrows, track player movement
        const playerTarget = players.find(player => player.id === targetId);
        if (playerTarget && playerTarget.position) {
          setCurrentTargetPosition(new Vector3(playerTarget.position.x, playerTarget.position.y, playerTarget.position.z));
        }
      }
    }

    if (!arrowGroupRef.current || !state.showArrow || state.impactOccurred) {
      if (state.impactOccurred && !state.impactStartTime) {
        setState(prev => ({ ...prev, impactStartTime: Date.now() }));
      }
      return;
    }

    const currentPos = arrowGroupRef.current.position;
    const currentTargetGroundPos = new THREE.Vector3(currentTargetPosition.x, -3, currentTargetPosition.z);
    const distanceToTarget = currentPos.distanceTo(currentTargetGroundPos);

    if (distanceToTarget < DAMAGE_RADIUS || currentPos.y <= -2) {
      setState(prev => ({ ...prev, impactOccurred: true, impactStartTime: Date.now() }));

      // Apply damage to all enemies within radius on impact
      const impactPosition = new THREE.Vector3(currentTargetPosition.x, 0, currentTargetPosition.z);

      if (onHit) {
        // Damage enemies within radius
        enemyData.forEach(enemy => {
          // Only damage living enemies
          if (enemy.health <= 0) return;

          const enemyPos = new THREE.Vector3(enemy.position.x, 0, enemy.position.z);
          const distance = enemyPos.distanceTo(impactPosition);

          if (distance <= DAMAGE_RADIUS) {
            onHit(enemy.id, ARROW_DAMAGE, false, impactPosition);
          }
        });

        // Damage players within radius (for PVP mode)
        players.forEach(player => {
          if (!player.position) return;

          const playerPos = new THREE.Vector3(player.position.x, 0, player.position.z);
          const distance = playerPos.distanceTo(impactPosition);

          if (distance <= DAMAGE_RADIUS) {
            onHit(player.id, ARROW_DAMAGE, false, impactPosition);
          }
        });
      }

      // Also check if player is in damage radius
      tempPlayerGroundPos.set(playerPosition.x, 0, playerPosition.z);
      tempTargetGroundPos.set(currentTargetPosition.x, 0, currentTargetPosition.z);

      if (tempPlayerGroundPos.distanceTo(tempTargetGroundPos) <= DAMAGE_RADIUS) {
        onImpact(ARROW_DAMAGE);
      }
      return;
    }

    // Calculate trajectory towards current target position
    const directionToTarget = currentTargetGroundPos.clone().sub(currentPos).normalize();
    let speed = ARROW_SPEED * delta;
    
    // Increase speed and homing accuracy for venom-affected targets
    if (isHoming) {
      speed *= 1.5; // 50% faster for homing arrows
      // More aggressive homing - adjust direction more frequently
      const homingStrength = 0.8; // How strongly the arrow homes in (0.8 = 80% towards target)
      directionToTarget.multiplyScalar(homingStrength);
    }
    
    currentPos.addScaledVector(directionToTarget, speed);

    // Update trail to follow arrow
    if (trailRef.current) {
      trailRef.current.position.copy(currentPos);
      trailRef.current.position.y += 0.5; // Position trail above arrow (since arrow points down)
      // Orient trail vertically for downward motion
      trailRef.current.rotation.set(0, 0, 0);
    }
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
        <group position={[currentTargetPosition.x, 0.1, currentTargetPosition.z]}>
          {/* Warning rings using shared geometries */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <primitive object={warningRingGeometry} />
            <meshBasicMaterial color="#00aa00" transparent opacity={0.5} side={THREE.DoubleSide} />
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
              side={THREE.DoubleSide}
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
              side={THREE.DoubleSide}
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

      {/* Arrow with trail */}
      {state.showArrow && (
        <group ref={arrowGroupRef} position={startPos}>
          <mesh rotation={[Math.PI, 0, 0]}> {/* Point downwards */}
            <primitive object={arrowGeometry} />
            <primitive object={arrowMaterial} />
            <pointLight color="#00ff00" intensity={3} distance={6} />
          </mesh>


        </group>
      )}

      {/* Add impact effect */}
      {state.impactStartTime && createArrowImpactEffect(
        arrowGroupRef.current?.position || new THREE.Vector3(currentTargetPosition.x, 0, currentTargetPosition.z),
        state.impactStartTime,
        onComplete
      )}
    </>
  );
}
