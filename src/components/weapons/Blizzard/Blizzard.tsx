import { useEffect, useRef, useState } from 'react';
import { Group, Vector3, TorusGeometry, TetrahedronGeometry, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import BlizzardShard from './BlizzardShard';
import { BLIZZARD_STORM_HIT_RADIUS, ARCTIC_BLIZZARD_HIT_RADIUS } from '@/utils/talents';

export const sharedGeometries = {
  torus: new TorusGeometry(0.8, 0.075, 8, 32),
  tetrahedron: new TetrahedronGeometry(0.075)
};

export const sharedMaterials = {
  blizzard: new MeshStandardMaterial({
    color: "#80ffff",
    emissive: "#40a0ff",
    emissiveIntensity: 2,
    transparent: true,
    opacity: 0.3
  }),
  shard: new MeshStandardMaterial({
    color: "#80ffff",
    emissive: "#40a0ff",
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.7
  })
};

interface BlizzardProps {
  position: Vector3;
  onComplete: () => void;
  enemyData?: Array<{ id: string; position: Vector3; health: number }>;
  /** When set, called each damage tick instead of `enemyData` (fresh positions without parent re-render). */
  resolveEnemyData?: () => Array<{ id: string; position: Vector3; health: number }>;
  onHitTarget?: (targetId: string, damage: number, isCritical: boolean, position: Vector3, isBlizzard: boolean) => void;
  parentRef?: React.RefObject<Group>;
  /** Sabres stealth: level-scaled damage with falloff. Ignored when `flatDamagePerTick` is set. */
  level?: number;
  /** Storm duration in seconds (Sabres stealth default 5). */
  durationSeconds?: number;
  /** Runeblade Blizzard talent: fixed damage per 1s tick, no falloff, no random crit. */
  flatDamagePerTick?: number;
  /** Default 1000. Arctic concentrated blizzard uses 500ms. */
  damageTickIntervalMs?: number;
  /** XZ hit radius; default `BLIZZARD_STORM_HIT_RADIUS`. */
  hitRadius?: number;
  /** Multiplier for orbital/falling shard spawn chance (Awakened Eye). */
  particleSpawnMultiplier?: number;
  visualPreset?: 'default' | 'concentrated';
}

export default function Blizzard({
  position,
  onComplete,
  enemyData = [],
  resolveEnemyData,
  onHitTarget,
  parentRef,
  level = 2,
  durationSeconds = 5,
  flatDamagePerTick,
  damageTickIntervalMs = 1000,
  hitRadius = BLIZZARD_STORM_HIT_RADIUS,
  particleSpawnMultiplier = 1,
  visualPreset = 'default',
}: BlizzardProps) {
  const stormRef = useRef<Group>(null);
  const stormWorldPositionRef = useRef(new Vector3());
  const progressRef = useRef(0);
  const lastDamageTime = useRef<number>(0);
  const endedRef = useRef(false);
  const MAX_SHARDS = 32;
  type ShardEntry = { id: number; position: Vector3; type: 'orbital' | 'falling' };
  const shardsRef = useRef<(ShardEntry | null)[]>(Array(MAX_SHARDS).fill(null));
  const freeShardSlotsRef = useRef<number[]>(Array.from({ length: MAX_SHARDS }, (_, i) => i));
  const nextShardIdRef = useRef(0);
  const [, shardRenderTick] = useState(0);
  const bumpShardRender = () => shardRenderTick(v => v + 1);

  const baselineHitRadius =
    visualPreset === 'concentrated' ? ARCTIC_BLIZZARD_HIT_RADIUS : BLIZZARD_STORM_HIT_RADIUS;
  const radiusScale = hitRadius / baselineHitRadius;
  const ORBITAL_RADIUS = (visualPreset === 'concentrated' ? 0.35 : 0.8) * radiusScale;
  const FALLING_RADIUS = (visualPreset === 'concentrated' ? 1.1 : 2.5) * radiusScale;
  const ORBITAL_HEIGHT = (visualPreset === 'concentrated' ? 1.55 : 2.35) * radiusScale;
  const FALLING_HEIGHT = (visualPreset === 'concentrated' ? 0.85 : 1.2) * radiusScale;
  const orbitalSpawnChance = (visualPreset === 'concentrated' ? 0.42 : 0.3) * particleSpawnMultiplier;
  const fallingSpawnChance = (visualPreset === 'concentrated' ? 0.75 : 0.8) * particleSpawnMultiplier;

  useEffect(() => {
    endedRef.current = false;
    progressRef.current = 0;
    lastDamageTime.current = 0;
    shardsRef.current = Array(MAX_SHARDS).fill(null);
    freeShardSlotsRef.current = Array.from({ length: MAX_SHARDS }, (_, i) => i);
    nextShardIdRef.current = 0;
    bumpShardRender();
  }, [durationSeconds, flatDamagePerTick, damageTickIntervalMs, hitRadius, particleSpawnMultiplier, visualPreset]);

  const spawnShard = (type: 'orbital' | 'falling', shardPosition: Vector3) => {
    const free = freeShardSlotsRef.current;
    if (free.length === 0) return;
    const slot = free.pop()!;
    shardsRef.current[slot] = {
      id: nextShardIdRef.current++,
      position: shardPosition,
      type,
    };
    bumpShardRender();
  };

  const releaseShard = (shardId: number) => {
    const slots = shardsRef.current;
    for (let slot = 0; slot < slots.length; slot++) {
      const shard = slots[slot];
      if (shard?.id === shardId) {
        slots[slot] = null;
        freeShardSlotsRef.current.push(slot);
        bumpShardRender();
        return;
      }
    }
  };

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

    if (Math.random() < orbitalSpawnChance) {
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * ORBITAL_RADIUS / 50;

      const orbitalPosition = new Vector3(
        Math.cos(angle) * spawnRadius,
        ORBITAL_HEIGHT + Math.random() * 0.25,
        Math.sin(angle) * spawnRadius
      );

      spawnShard('orbital', orbitalPosition);
    }

    if (Math.random() < fallingSpawnChance) {
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = Math.random() * FALLING_RADIUS;

      const fallingPosition = new Vector3(
        Math.cos(angle) * spawnRadius,
        FALLING_HEIGHT + Math.random() * 2.5,
        Math.sin(angle) * spawnRadius
      );

      spawnShard('falling', fallingPosition);
    }

    const now = Date.now();
    if (now - lastDamageTime.current >= damageTickIntervalMs) {
      lastDamageTime.current = now;

      const enemies = resolveEnemyData ? resolveEnemyData() : enemyData;
      if (enemies && enemies.length > 0 && onHitTarget) {
        stormRef.current.getWorldPosition(stormWorldPositionRef.current);
        const hits =
          flatDamagePerTick != null
            ? calculateBlizzardDamageFlat(stormWorldPositionRef.current, enemies, flatDamagePerTick, hitRadius)
            : calculateBlizzardDamageScaled(stormWorldPositionRef.current, enemies, level, hitRadius);
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
      {shardsRef.current.flatMap((shard) =>
        shard
          ? [
              <BlizzardShard
                key={shard.id}
                initialPosition={shard.position}
                type={shard.type}
                onComplete={() => releaseShard(shard.id)}
              />,
            ]
          : [],
      )}

    </group>
  );
}

/** Horizontal reach only — matches Runeblade LMB (XZ cone) and avoids false misses from Y (feet vs torso). */
function distanceXZ(a: Vector3, b: Vector3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function calculateBlizzardDamageScaled(
  centerPosition: Vector3,
  enemyData: Array<{ id: string; position: Vector3; health: number }>,
  level: number,
  damageRadius: number,
) {
  const hits: Array<{ targetId: string; damage: number; isCritical: boolean; position: Vector3 }> = [];

  for (const enemy of enemyData) {
    const distance = distanceXZ(centerPosition, enemy.position);
    if (distance <= damageRadius) {
      const baseDamage = 15 + (level * 3); // OLD DAMAGE LOGIC
      const damage = Math.floor(baseDamage * (1 - distance / damageRadius));

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
  damageRadius: number,
) {
  const hits: Array<{ targetId: string; damage: number; isCritical: boolean; position: Vector3 }> = [];

  for (const enemy of enemyData) {
    const distance = distanceXZ(centerPosition, enemy.position);
    if (distance <= damageRadius) {
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
