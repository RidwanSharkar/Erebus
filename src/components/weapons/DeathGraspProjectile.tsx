import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, MeshBasicMaterial, Color, AdditiveBlending, SphereGeometry } from '@/utils/three-exports';
import AnimatedDeathGrasp from './AnimatedDeathGrasp';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

interface DeathGraspProjectileProps {
  startPosition: Vector3;
  direction: Vector3;
  casterId: string;
  onHit?: (targetId: string, position: Vector3) => void;
  onComplete?: () => void;
  playerEntities?: React.MutableRefObject<Map<string, number>>;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  players?: Map<string, any>;
  localSocketId?: string;
}

export default function DeathGraspProjectile({
  startPosition,
  direction,
  casterId,
  onHit,
  onComplete,
  playerEntities,
  enemyData = [],
  players,
  localSocketId
}: DeathGraspProjectileProps) {
  const timeRef = useRef(0);
  const flickerRef = useRef(1);
  const duration = 1.2; // Total duration
  const speed = 15; // Units per second (increased from 8 for longer range)
  const range = speed * duration; // Total travel distance (~18 units)
  const hitEnemies = useRef(new Set<string>());
  const hasHit = useRef(false);
  const useAnimatedVersion = useRef(true); // Flag to use new animated version

  // Borrow ONE pooled light (collapses the former static-fallback start/target/path
  // <pointLight>s) instead of mounting lights. Only emits when the static fallback
  // renders; the animated version drives its own pooled light.
  const graspLight = useDynamicLight({ color: '#6A0DAD', distance: 4, decay: 2, priority: 1 });

  // Adjust direction to be more horizontal (DeathGrasp should shoot horizontally, not downward)
  const adjustedDirection = useMemo(() => {
    const dir = direction.clone();

    // Flatten the Y component to make it more horizontal
    // Keep some upward arc to avoid ground collision
    dir.y = Math.max(dir.y * 0.3, 0.1); // Reduce downward tilt, ensure slight upward bias

    // Renormalize to maintain unit length
    dir.normalize();

    return dir;
  }, [direction]);

  // Calculate target position using adjusted direction
  const targetPosition = useMemo(() => {
    return startPosition.clone().add(adjustedDirection.clone().multiplyScalar(range));
  }, [startPosition, adjustedDirection, range]);

  // Use useMemo for static geometries and materials
  const geometries = useMemo(() => ({
    particle: new SphereGeometry(0.15, 8, 8),
    impact: new SphereGeometry(0.2, 8, 8),
    core: new SphereGeometry(0.18, 8, 8)
  }), []);

  const materials = useMemo(() => ({
    spiral1: new MeshBasicMaterial({
      color: new Color("#6A0DAD"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    spiral2: new MeshBasicMaterial({
      color: new Color("#9370DB"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    spiral3: new MeshBasicMaterial({
      color: new Color("#8A2BE2"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    impact: new MeshBasicMaterial({
      color: new Color("#6A0DAD"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    }),
    core: new MeshBasicMaterial({
      color: new Color("#9370DB"),
      transparent: true,
      opacity: 1.0,
      blending: AdditiveBlending
    })
  }), []);

  // Pre-calculate spiraling particle streams
  const spiralStreams = useMemo(() => {
    const directionNormalized = adjustedDirection.clone();
    const segments = Math.ceil(range * 2); // More segments for projectile path
    const streams = [[], [], []] as Array<Array<{position: Vector3, scale: number}>>;

    // Create normalized direction vector and perpendicular vectors for spiral calculation
    const up = new Vector3(0, 1, 0);
    const right = new Vector3().crossVectors(directionNormalized, up).normalize();
    const forward = new Vector3().crossVectors(right, directionNormalized).normalize();

    // Spiral parameters
    const spiralRadius = 0.2; // Radius of the spiral
    const spiralTurns = 4; // Number of complete turns along the path

    for (let streamIndex = 0; streamIndex < 3; streamIndex++) {
      const phaseOffset = (streamIndex * Math.PI * 2) / 3; // 120 degrees apart

      for (let i = 0; i < segments; i++) {
        const progress = i / segments;
        const distanceAlongPath = progress * range;
        const basePos = startPosition.clone().add(directionNormalized.clone().multiplyScalar(distanceAlongPath));

        // Calculate spiral position
        const spiralAngle = progress * spiralTurns * Math.PI * 2 + phaseOffset;
        const currentRadius = spiralRadius * (1 - progress * 0.3); // Taper towards target

        // Create spiral offset
        const spiralOffset = right.clone().multiplyScalar(Math.cos(spiralAngle) * currentRadius)
          .add(forward.clone().multiplyScalar(Math.sin(spiralAngle) * currentRadius));

        const spiralPos = basePos.clone().add(spiralOffset);

        // Scale particles - larger at start, smaller towards target
        const scale = 1.2 - progress * 0.8 + Math.sin(progress * Math.PI * 6) * 0.1;

        streams[streamIndex].push({
          position: spiralPos,
          scale: Math.max(0.3, scale)
        });
      }
    }

    return streams;
  }, [startPosition, adjustedDirection, range]);

  useFrame((_, delta) => {
    timeRef.current = Math.min(timeRef.current + delta, duration);
    flickerRef.current = Math.random() * 0.3 + 0.7;

    const progress = timeRef.current / duration;

    // Calculate current projectile position along the path using adjusted direction
    const currentDistance = progress * range;
    const currentPosition = startPosition.clone().add(adjustedDirection.clone().multiplyScalar(currentDistance));

    // Check for hits during the first 80% of the projectile's travel
    if (progress < 0.8 && !hasHit.current) {
      // Check collision with enemies
      if (enemyData && enemyData.length > 0) {
        for (const enemy of enemyData) {
          if (hitEnemies.current.has(enemy.id) || enemy.health <= 0) continue;

          const distance = currentPosition.distanceTo(enemy.position);
          if (distance <= 3.0) { // 3 unit collision radius (increased with range)
            hitEnemies.current.add(enemy.id);
            hasHit.current = true;
            onHit?.(enemy.id, enemy.position.clone());
            break;
          }
        }
      }

      // Check collision with players in PVP mode
      if (players && localSocketId && !hasHit.current) {
        players.forEach((player: any, playerId: string) => {
          if (playerId === localSocketId || hitEnemies.current.has(playerId) || player.health <= 0) return;

          const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
          const distance = currentPosition.distanceTo(playerPos);
          if (distance <= 3.0) { // 3 unit collision radius (increased with range)
            hitEnemies.current.add(playerId);
            hasHit.current = true;
            onHit?.(playerId, playerPos.clone());
          }
        });
      }
    }

    // Update material opacities based on progress
    const baseOpacity = progress < 0.8 ? (1 - progress * 0.6) : (0.4 * (1 - (progress - 0.8) / 0.2));

    materials.spiral1.opacity = (baseOpacity * 0.9) * flickerRef.current;
    materials.spiral2.opacity = (baseOpacity * 0.85) * (flickerRef.current * 0.9 + 0.1);
    materials.spiral3.opacity = (baseOpacity * 0.8) * (flickerRef.current * 0.8 + 0.2);
    materials.impact.opacity = (baseOpacity * 0.7) * flickerRef.current;
    materials.core.opacity = (baseOpacity * 1.1) * flickerRef.current;

    // Drive the pooled light only in the static-fallback path (world space). Replicates the
    // former start <pointLight>: 10 * (1 - progress) * flicker, following the projectile head.
    if (!useAnimatedVersion.current) {
      graspLight.current?.setPosition(currentPosition.x, currentPosition.y, currentPosition.z);
      graspLight.current?.setIntensity(10 * (1 - progress) * flickerRef.current);
    } else {
      graspLight.current?.setIntensity(0);
    }

    // Complete the effect
    if (progress >= 1) {
      onComplete?.();
    }
  });

  // Use the new animated version if enabled
  if (useAnimatedVersion.current) {
    return (
      <AnimatedDeathGrasp
        startPosition={startPosition}
        targetPosition={targetPosition}
        onHit={(targetId: string, position: Vector3) => {
          if (onHit) {
            onHit(targetId, position);
          }
        }}
        onPullStart={() => {}}
        onComplete={() => {
          if (onComplete) {
            onComplete();
          }
        }}
        enemyData={enemyData}
      />
    );
  }

  // Fallback to original static version (kept for compatibility)
  return (
    <group>
      {/* Three spiraling particle streams */}
      {spiralStreams.map((stream, streamIndex) => {
        const materials_array = [materials.spiral1, materials.spiral2, materials.spiral3];
        const currentMaterial = materials_array[streamIndex];

        return (
          <group key={`stream-${streamIndex}`}>
            {stream.map((particle, particleIndex) => (
              <mesh
                key={`particle-${streamIndex}-${particleIndex}`}
                position={particle.position.toArray()}
                geometry={geometries.particle}
                material={currentMaterial}
                scale={[particle.scale, particle.scale, particle.scale]}
              />
            ))}
          </group>
        );
      })}

      {/* Impact effect at target */}
      <mesh
        position={targetPosition.toArray()}
        geometry={geometries.impact}
        material={materials.impact}
        scale={[1.5, 1.5, 1.5]}
      />

      {/* Starting point core glow */}
      <mesh
        position={startPosition.toArray()}
        geometry={geometries.core}
        material={materials.core}
        scale={[1.3, 1.3, 1.3]}
      />

      {/* Additional pulsing core at start */}
      <mesh
        position={startPosition.toArray()}
        geometry={geometries.particle}
        material={materials.spiral1}
        scale={[
          2 + Math.sin(timeRef.current * 8) * 0.5,
          2 + Math.sin(timeRef.current * 8) * 0.5,
          2 + Math.sin(timeRef.current * 8) * 0.5
        ]}
      />

      {/* Dynamic lighting is driven via the pooled light in useFrame above. */}
    </group>
  );
}
