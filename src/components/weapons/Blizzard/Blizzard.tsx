import { useRef } from 'react';
import { Group, Vector3, TorusGeometry, TetrahedronGeometry, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import BlizzardShard from './BlizzardShard';

export const sharedGeometries = {
  torus: new TorusGeometry(0.8, 0.075, 8, 32),
  tetrahedron: new TetrahedronGeometry(0.075)
};

export const sharedMaterials = {
  blizzard: new MeshStandardMaterial({
    color: "#FF544E",
    emissive: "#FF544E",
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.3
  }),
  shard: new MeshStandardMaterial({
    color: "#FF544E",
    emissive: "#FF544E",
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.7
  })
};

interface BlizzardProps {
  position: Vector3;
  onComplete: () => void;
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
  onHitTarget?: (targetId: string, damage: number, isCritical: boolean, position: Vector3, isBlizzard: boolean) => void;
  parentRef?: React.RefObject<Group>;
  level?: number; // Player level for damage scaling
}

export default function Blizzard({
  position,
  onComplete,
  enemyData = [],
  onHitTarget,
  parentRef,
  level = 2 // Default to level 2 since Blizzard unlocks at level 2
}: BlizzardProps) {
  const stormRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const lastDamageTime = useRef<number>(0);
  const duration = 5; // 5 seconds to match stealth duration
  const shardsRef = useRef<Array<{ id: number; position: Vector3; type: 'orbital' | 'falling' }>>([]);
  const aurasRef = useRef<Array<{ id: number }>>([]);

  const ORBITAL_RADIUS = 1;        // Radius of the orbital shard spawn area (compact)
  const FALLING_RADIUS = 0.5;        // Radius of the falling shard spawn area (compact)
  const ORBITAL_HEIGHT = 0.75;        // Height of orbital shards
  const FALLING_HEIGHT = 0.75;       // Starting height of falling shards

  useFrame((_, delta) => {
    if (!stormRef.current) return;

    // If parentRef is provided, follow the parent's position
    if (parentRef?.current) {
      stormRef.current.position.copy(parentRef.current.position);
    } else {
      stormRef.current.position.copy(position);
    }

    progressRef.current += delta;
    if (progressRef.current >= duration) {
      onComplete();
      return;
    }

    stormRef.current.rotation.y += delta * 7;

    if (Math.random() < 0.3) { // Reduced from 0.2
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * ORBITAL_RADIUS / 50;

      const orbitalPosition = new Vector3(
        Math.cos(angle) * spawnRadius,
        ORBITAL_HEIGHT + Math.random() * 0.25,
        Math.sin(angle) * spawnRadius
      );

      shardsRef.current.push({
        id: Date.now() + Math.random(),
        position: orbitalPosition,
        type: 'orbital'
      });
    }

    if (Math.random() > 0.2) { // Reduced from 0.3
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * FALLING_RADIUS;

      const fallingPosition = new Vector3(
        Math.cos(angle) * spawnRadius,
        FALLING_HEIGHT + Math.random() * 2.5,
        Math.sin(angle) * spawnRadius
      );

      shardsRef.current.push({
        id: Date.now() + Math.random(),
        position: fallingPosition,
        type: 'falling'
      });
    }

    if (Math.random() < 0.1) { // 10% chance each frame
      aurasRef.current.push({
        id: Date.now() + Math.random(),
      });
    }

    const now = Date.now();
    if (now - lastDamageTime.current >= 1000) {
      lastDamageTime.current = now;

      if (enemyData && onHitTarget) {
        const hits = calculateBlizzardDamage(stormRef.current.position, enemyData, level);
        hits.forEach(hit => {
          onHitTarget(
            hit.targetId,
            hit.damage,
            hit.isCritical,
            hit.position,
            true  // isBlizzard flag
          );
        });
      }
    }
  });

  return (
    <group ref={stormRef} position={[position.x, position.y, position.z]}>
      {shardsRef.current.map(shard => (
        <BlizzardShard
          key={shard.id}
          initialPosition={shard.position}
          type={shard.type}
          onComplete={() => {
            shardsRef.current = shardsRef.current.filter(s => s.id !== shard.id);
          }}
        />
      ))}

    </group>
  );
}

// Simple damage calculation function
function calculateBlizzardDamage(centerPosition: Vector3, enemyData: Array<{ id: string; position: Vector3; health: number }>, level: number) {
  const hits = [];
  const damageRadius = 1.5; // Damage radius around the blizzard center (compact)

  for (const enemy of enemyData) {
    const distance = centerPosition.distanceTo(enemy.position);
    if (distance <= damageRadius) {
      // Base damage scales with level, reduced for area effect
      const baseDamage = 15 + (level * 3); // Similar to other area effects
      const damage = Math.floor(baseDamage * (1 - distance / damageRadius)); // Falloff with distance

      hits.push({
        targetId: enemy.id,
        damage: Math.max(1, damage), // Minimum 1 damage
        isCritical: Math.random() < 0.1, // 10% crit chance
        position: enemy.position.clone()
      });
    }
  }

  return hits;
}
