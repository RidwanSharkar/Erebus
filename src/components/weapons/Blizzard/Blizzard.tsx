import { useEffect, useRef } from 'react';
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
  /** Sabres stealth: level-scaled damage with falloff. Ignored when `flatDamagePerTick` is set. */
  level?: number;
  /** Storm duration in seconds (Sabres stealth default 5). */
  durationSeconds?: number;
  /** Runeblade Blizzard talent: fixed damage per 1s tick, no falloff, no random crit. */
  flatDamagePerTick?: number;
}

export default function Blizzard({
  position,
  onComplete,
  enemyData = [],
  onHitTarget,
  parentRef,
  level = 2,
  durationSeconds = 5,
  flatDamagePerTick,
}: BlizzardProps) {
  const stormRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const lastDamageTime = useRef<number>(0);
  const endedRef = useRef(false);
  const shardsRef = useRef<Array<{ id: number; position: Vector3; type: 'orbital' | 'falling' }>>([]);
  const aurasRef = useRef<Array<{ id: number }>>([]);

  const ORBITAL_RADIUS = 1;
  const FALLING_RADIUS = 0.5;
  const ORBITAL_HEIGHT = 0.75;
  const FALLING_HEIGHT = 0.75;

  useEffect(() => {
    endedRef.current = false;
    progressRef.current = 0;
    lastDamageTime.current = 0;
  }, [durationSeconds, flatDamagePerTick]);

  useFrame((_, delta) => {
    if (!stormRef.current) return;

    if (parentRef?.current) {
      stormRef.current.position.copy(parentRef.current.position);
    } else {
      stormRef.current.position.copy(position);
    }

    progressRef.current += delta;
    if (progressRef.current >= durationSeconds) {
      if (!endedRef.current) {
        endedRef.current = true;
        onComplete();
      }
      return;
    }

    stormRef.current.rotation.y += delta * 7;

    if (Math.random() < 0.3) {
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

    if (Math.random() > 0.2) {
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

    if (Math.random() < 0.1) {
      aurasRef.current.push({
        id: Date.now() + Math.random(),
      });
    }

    const now = Date.now();
    if (now - lastDamageTime.current >= 1000) {
      lastDamageTime.current = now;

      if (enemyData && onHitTarget) {
        const hits =
          flatDamagePerTick != null
            ? calculateBlizzardDamageFlat(stormRef.current.position, enemyData, flatDamagePerTick)
            : calculateBlizzardDamageScaled(stormRef.current.position, enemyData, level);
        hits.forEach(hit => {
          onHitTarget(
            hit.targetId,
            hit.damage,
            hit.isCritical,
            hit.position,
            true
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

const DAMAGE_RADIUS = 1.5;

function calculateBlizzardDamageScaled(
  centerPosition: Vector3,
  enemyData: Array<{ id: string; position: Vector3; health: number }>,
  level: number,
) {
  const hits: Array<{ targetId: string; damage: number; isCritical: boolean; position: Vector3 }> = [];

  for (const enemy of enemyData) {
    const distance = centerPosition.distanceTo(enemy.position);
    if (distance <= DAMAGE_RADIUS) {
      const baseDamage = 15 + (level * 3);
      const damage = Math.floor(baseDamage * (1 - distance / DAMAGE_RADIUS));

      hits.push({
        targetId: enemy.id,
        damage: Math.max(1, damage),
        isCritical: Math.random() < 0.1,
        position: enemy.position.clone()
      });
    }
  }

  return hits;
}

function calculateBlizzardDamageFlat(
  centerPosition: Vector3,
  enemyData: Array<{ id: string; position: Vector3; health: number }>,
  flatDamage: number,
) {
  const hits: Array<{ targetId: string; damage: number; isCritical: boolean; position: Vector3 }> = [];

  for (const enemy of enemyData) {
    const distance = centerPosition.distanceTo(enemy.position);
    if (distance <= DAMAGE_RADIUS) {
      hits.push({
        targetId: enemy.id,
        damage: flatDamage,
        isCritical: false,
        position: enemy.position.clone()
      });
    }
  }

  return hits;
}
