import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Renderer } from '@/ecs/components/Renderer';
import { Enemy } from '@/ecs/components/Enemy';
import { Health } from '@/ecs/components/Health';
import { Collider } from '@/ecs/components/Collider';
import { CollisionSystem } from '@/systems/CollisionSystem';

// Import individual projectile components
import CrossentropyBolt from '@/components/projectiles/CrossentropyBolt';
import EntropicBolt from '@/components/projectiles/EntropicBolt';
import { ENTROPIC_TRAIL_FADE_OUT_DURATION } from '@/components/projectiles/EntropicBoltTrail';
import ChargedArrow from '@/components/projectiles/ChargedArrow';
import RegularArrow from '@/components/projectiles/RegularArrow';
import Barrage from '@/components/projectiles/Barrage';
import FanOfKnivesDagger from '@/components/projectiles/FanOfKnivesDagger';
import { WindShearProjectile } from '@/components/projectiles/WindShearProjectile';
import TowerProjectile from '@/components/projectiles/TowerProjectile';
import ExplosionEffect from '@/components/projectiles/ExplosionEffect';
import CrossentropyExplosion from '@/components/projectiles/CrossentropyExplosion';
import CrossentropyBlitzRocket from '@/components/projectiles/CrossentropyBlitzRocket';
import CrossentropyBlitzExplosion from '@/components/projectiles/CrossentropyBlitzExplosion';
import CrossentropyMeteor from '@/components/projectiles/CrossentropyMeteor';
import CloudkillArrow from '@/components/projectiles/CloudkillArrow';
import VenomEffect from '@/components/projectiles/VenomEffect';
import { Vector3, Color } from '@/utils/three-exports';
import { DEFAULT_ENTROPIC_COLOR_VARIANT } from '@/utils/entropicColorThemes';
import { CROSSENTROPY_PLAGUE_VENOM_MS, type CrossentropyVisualTheme, type FanOfKnivesFlourishTint, type TempestBurstTheme, getFanOfKnivesDaggerColorsFromTint } from '@/utils/talents';

// Generous bound covering projectile radius (~0.5) + largest enemy/boss collider radius,
// used to keep the client-side crossentropy explosion check a local spatial query instead
// of a full world scan.
const CROSSENTROPY_BOLT_COLLISION_QUERY_RADIUS = 5;

// Stable no-op passed to memoized projectile visuals so their `onImpact` prop identity
// doesn't change every render (which would otherwise defeat React.memo).
const noopProjectileImpact = () => {};

function crossentropyThemeFromUserData(userData: Record<string, unknown>): CrossentropyVisualTheme {
  if (userData.crossentropyInferno === true) return 'inferno';
  if (userData.crossentropyGlacial === true) return 'glacial';
  if (userData.crossentropyTempest === true) return 'tempest';
  if (userData.crossentropyPlague === true) return 'plague';
  return 'default';
}

// Data interfaces for each projectile type
interface ProjectileData {
  id: number;
  position: Vector3;
  direction: Vector3;
  entityId: number;
  subclass?: any;
  level?: number;
  opacity?: number;
  ownerId?: string; // For tower projectiles
  isCryoflame?: boolean; // For Entropic Bolt Cryoflame mode
  colorVariant?: string; // Entropic bolt color (rosegold default / talent-locked red|blue|green|arctic)
  entropicBoltTalent?: 'wrathful' | 'staggering' | 'infesting' | 'arctic';
  projectileType?: string; // For projectile type differentiation (e.g., burst_arrow)
  /** Trigger Finger talent — red uncharged bow tap arrow. */
  triggerFingerUncharged?: boolean;
  /** Tempest Rounds burst visual theme. */
  tempestBurstTheme?: TempestBurstTheme;
  /** Wrathful Bite talent — red Barrage theme. */
  barrageWrathfulBite?: boolean;
  /** Wyvern Bite talent — green Barrage theme. */
  barrageWyvernBite?: boolean;
  /** Staggering Bite talent — blue Barrage theme (when Wyvern/Wrathful not active). */
  barrageStaggeringBite?: boolean;
  /** Glacial Bite room boon — light blue Barrage when higher-precedence bites are off. */
  barrageGlacialBite?: boolean;
  /** Entanglement talent — Barrage hit roots and squeezes the target. */
  barrageEntanglement?: boolean;
  /** Fan of Knives Flourish tint. */
  fanOfKnivesFlourishTint?: FanOfKnivesFlourishTint;
  /** INFERNO talent — fiery Crossentropy theme. */
  infernoCrossentropy?: boolean;
  /** Reaper — pierce, visuals follow ECS, no impact explosion. */
  reaperCrossentropy?: boolean;
  crossentropyVisualTheme?: CrossentropyVisualTheme;
  /** PLAGUE boon (mechanics + venom FX); Inferno/Glacial/etc. may override `crossentropyVisualTheme`). */
  crossentropyPlague?: boolean;
  /** When the ECS entity despawns, R3F clock elapsed — trail fades out visually only. */
  trailFadeOutStartElapsed?: number;
  /** Wind Shear talent — roll (radians) applied to the crescent visual so paired slashes oppose diagonally. */
  windShearRoll?: number;
  /** Cached from the ECS Projectile component each tick so render doesn't need to re-query the world. */
  distanceTraveled?: number;
  /** Cached from the ECS Projectile component each tick so render doesn't need to re-query the world. */
  maxDistance?: number;
  /** Cached once at spawn from the ECS Projectile component (stable for the projectile's lifetime). */
  cachedStartPosition?: Vector3;
}

interface SwordProjectileData {
  id: number;
  position: Vector3;
  direction: Vector3;
  entityId: number;
}

interface ExplosionData {
  id: number;
  position: Vector3;
  color: Color;
  size: number;
  duration: number;
  type?: 'crossentropy' | 'crossentropy_blitz' | 'generic'; // Add type to distinguish explosion types
  chargeTime?: number; // For crossentropy explosions
  infernoCrossentropy?: boolean;
  crossentropyVisualTheme?: CrossentropyVisualTheme;
  reaperCrossentropy?: boolean;
}

interface CrossentropyMeteorData {
  id: number;
  targetPosition: Vector3;
  timestamp?: number;
  damage?: number;
  startPosition?: Vector3;
}

interface CloudkillArrowData {
  id: number;
  targetPosition: Vector3;
  timestamp?: number;
  delayMs?: number;
  startPosition?: Vector3;
}

interface UnifiedProjectileManagerProps {
  world: World;
  onHauntedSoulAt?: (position: Vector3) => void;
}

function UnifiedProjectileManager({ world, onHauntedSoulAt }: UnifiedProjectileManagerProps) {
  // State for all projectile types
  const [projectileData, setProjectileData] = useState<{
    crossentropy: ProjectileData[];
    blitzCrossentropy: ProjectileData[];
    entropic: ProjectileData[];
    charged: ProjectileData[];
    regular: ProjectileData[];
    sword: SwordProjectileData[];
    barrage: ProjectileData[];
    fanOfKnives: ProjectileData[];
    windShear: ProjectileData[];
    tower: ProjectileData[];
  }>({
    crossentropy: [],
    blitzCrossentropy: [],
    entropic: [],
    charged: [],
    regular: [],
    sword: [],
    barrage: [],
    fanOfKnives: [],
    windShear: [],
    tower: []
  });

  const [explosions, setExplosions] = useState<ExplosionData[]>([]);
  const [crossentropyPlagueVenoms, setCrossentropyPlagueVenoms] = useState<Array<{ id: number; position: Vector3 }>>(
    [],
  );
  const [crossentropyMeteors, setCrossentropyMeteors] = useState<CrossentropyMeteorData[]>([]);
  const [cloudkillArrows, setCloudkillArrows] = useState<CloudkillArrowData[]>([]);

  // Counters for unique IDs
  const crossentropyIdCounter = useRef(0);
  const blitzCrossentropyIdCounter = useRef(0);
  const entropicIdCounter = useRef(0);
  const chargedIdCounter = useRef(0);
  const regularIdCounter = useRef(0);
  const swordIdCounter = useRef(0);
  const barrageIdCounter = useRef(0);
  const fanOfKnivesIdCounter = useRef(0);
  const windShearIdCounter = useRef(0);
  const towerIdCounter = useRef(0);
  const explosionIdCounter = useRef(0);
  const plagueVenomEffectIdCounter = useRef(0);
  const crossentropyMeteorIdCounter = useRef(0);
  const cloudkillArrowIdCounter = useRef(0);

  // Throttling
  const lastUpdateTime = useRef(0);

  // Collision detection for CrossentropyBolt (visual-only: decides when the client-simulated
  // fireball should explode. Real damage is applied independently by the ECS ProjectileSystem.)
  const checkCrossentropyBoltCollisions = (boltId: number, position: Vector3): boolean => {
    if (!world) return false;

    // Only scan entities near the bolt (spatial hash) instead of the entire world every frame.
    // Radius generously covers projectile radius + largest enemy collider radius.
    const collisionSystem = world.getSystem(CollisionSystem);
    const nearbyEntities = collisionSystem
      ? collisionSystem.queryCollidersRadius(position, CROSSENTROPY_BOLT_COLLISION_QUERY_RADIUS)
      : world.getAllEntities();

    for (const entity of nearbyEntities) {
      const enemy = entity.getComponent(Enemy);
      const health = entity.getComponent(Health);
      const transform = entity.getComponent(Transform);
      const collider = entity.getComponent(Collider);

      // Skip if not an enemy or if dead
      if (!enemy || !health || !transform || health.isDead) continue;

      // Get collision center (account for collider offset)
      const collisionCenter = transform.position.clone();
      if (collider) {
        collisionCenter.add((collider as Collider).offset);
      }

      // Check collision distance (using 2D distance for better gameplay)
      const projectilePos2D = new Vector3(position.x, 0, position.z);
      const enemyPos2D = new Vector3(collisionCenter.x, 0, collisionCenter.z);
      const distance = projectilePos2D.distanceTo(enemyPos2D);

      // CrossentropyBolt has effective radius of ~0.5, enemy collider radius varies
      const projectileRadius = 0.5;
      const enemyRadius = collider ? (collider as Collider).radius : 1.0;
      const totalCollisionRadius = projectileRadius + enemyRadius;

      if (distance <= totalCollisionRadius) {
        return true; // Collision detected
      }
    }

    return false; // No collision
  };

  useFrame((state) => {
    // Throttle updates to avoid excessive re-renders
    const currentTime = state.clock.getElapsedTime();
    if (currentTime - lastUpdateTime.current < 0.016) return; // ~60fps
    lastUpdateTime.current = currentTime;

    if (!world) return;

    // SINGLE QUERY FOR ALL PROJECTILES - This is the key optimization!
    const allProjectileEntities = world.queryEntities([Transform, Projectile, Renderer]);
    
    // Separate projectiles by type in a single pass
    const newCrossentropy: ProjectileData[] = [];
    const newBlitzCrossentropy: ProjectileData[] = [];
    const newEntropic: ProjectileData[] = [];
    const newCharged: ProjectileData[] = [];
    const newRegular: ProjectileData[] = [];
    const newSword: SwordProjectileData[] = [];
    const newBarrage: ProjectileData[] = [];
    const newFanOfKnives: ProjectileData[] = [];
    const newWindShear: ProjectileData[] = [];
    const newTower: ProjectileData[] = [];

    for (const entity of allProjectileEntities) {
      const renderer = entity.getComponent(Renderer);
      const transform = entity.getComponent(Transform);
      const projectile = entity.getComponent(Projectile);

      if (!renderer?.mesh || !transform || !projectile) continue;

      const userData = renderer.mesh.userData;
      const direction = userData.direction || projectile.velocity.clone().normalize();

      // Determine projectile type and update appropriate array
      if (userData.isTowerProjectile) {
        const existing = projectileData.tower.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newTower.push(existing);
        } else {
          newTower.push({
            id: towerIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0,
            ownerId: userData.towerOwnerId
          });
        }
      } else if (userData.isCrossentropyBlitzRocket) {
        const existing = projectileData.blitzCrossentropy.find(p => p.entityId === entity.id);
        const theme = crossentropyThemeFromUserData(userData as Record<string, unknown>);
        if (existing) {
          existing.position.copy(transform.position);
          if (userData.crossentropyInferno) existing.infernoCrossentropy = true;
          if (userData.reaperCrossentropy) existing.reaperCrossentropy = true;
          existing.crossentropyVisualTheme = theme;
          existing.crossentropyPlague = userData.crossentropyPlague === true;
          newBlitzCrossentropy.push(existing);
        } else {
          newBlitzCrossentropy.push({
            id: blitzCrossentropyIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            infernoCrossentropy: userData.crossentropyInferno === true,
            reaperCrossentropy: userData.reaperCrossentropy === true,
            crossentropyVisualTheme: theme,
            crossentropyPlague: userData.crossentropyPlague === true,
          });
        }
      } else if (userData.isCrossentropyBolt) {
        const existing = projectileData.crossentropy.find(p => p.entityId === entity.id);
        const theme = crossentropyThemeFromUserData(userData as Record<string, unknown>);
        if (existing) {
          existing.position.copy(transform.position);
          if (userData.crossentropyInferno) existing.infernoCrossentropy = true;
          if (userData.reaperCrossentropy) existing.reaperCrossentropy = true;
          existing.crossentropyVisualTheme = theme;
          existing.crossentropyPlague = userData.crossentropyPlague === true;
          newCrossentropy.push(existing);
        } else {
          newCrossentropy.push({
            id: crossentropyIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            infernoCrossentropy: userData.crossentropyInferno === true,
            reaperCrossentropy: userData.reaperCrossentropy === true,
            crossentropyVisualTheme: theme,
            crossentropyPlague: userData.crossentropyPlague === true,
          });
        }
      } else if (userData.isEntropicBolt) {
        const existing = projectileData.entropic.find(p => p.entityId === entity.id);
        const entropicTalent = userData.entropicBoltTalent as ProjectileData['entropicBoltTalent'] | undefined;
        const colorVariant =
          entropicTalent === 'arctic' ? 'arctic' : (userData.colorVariant as string | undefined) || DEFAULT_ENTROPIC_COLOR_VARIANT;
        if (existing) {
          existing.position.copy(transform.position);
          existing.colorVariant = colorVariant;
          existing.entropicBoltTalent = entropicTalent;
          delete existing.trailFadeOutStartElapsed;
          newEntropic.push(existing);
        } else {
          newEntropic.push({
            id: entropicIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            isCryoflame: userData.isCryoflame || false,
            colorVariant,
            entropicBoltTalent: entropicTalent,
          });
        }
      } else if (userData.isChargedArrow) {
        const existing = projectileData.charged.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newCharged.push(existing);
        } else {
          newCharged.push({
            id: chargedIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0
          });
        }
      } else if (userData.isBarrageArrow) {
        const existing = projectileData.barrage.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          existing.direction.copy(direction);
          existing.barrageWrathfulBite = userData.barrageWrathfulBite === true;
          existing.barrageWyvernBite = userData.barrageWyvernBite === true;
          existing.barrageStaggeringBite = userData.barrageStaggeringBite === true;
          existing.barrageGlacialBite = userData.barrageGlacialBite === true;
          existing.barrageEntanglement = userData.barrageEntanglement === true;
          existing.distanceTraveled = projectile.distanceTraveled;
          existing.maxDistance = projectile.maxDistance;
          newBarrage.push(existing);
        } else {
          newBarrage.push({
            id: barrageIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0,
            barrageWrathfulBite: userData.barrageWrathfulBite === true,
            barrageWyvernBite: userData.barrageWyvernBite === true,
            barrageStaggeringBite: userData.barrageStaggeringBite === true,
            barrageGlacialBite: userData.barrageGlacialBite === true,
            barrageEntanglement: userData.barrageEntanglement === true,
            distanceTraveled: projectile.distanceTraveled,
            maxDistance: projectile.maxDistance,
            cachedStartPosition: projectile.startPosition?.clone(),
          });
        }
      } else if (userData.isFanOfKnivesDagger || userData.projectileType === 'fan_of_knives') {
        const existing = projectileData.fanOfKnives.find((p) => p.entityId === entity.id);
        const fanTint = (userData.fanOfKnivesFlourishTint as FanOfKnivesFlourishTint | undefined) ?? 'default';
        if (existing) {
          existing.position.copy(transform.position);
          existing.direction.copy(direction);
          existing.fanOfKnivesFlourishTint = fanTint;
          existing.distanceTraveled = projectile.distanceTraveled;
          existing.maxDistance = projectile.maxDistance;
          newFanOfKnives.push(existing);
        } else {
          newFanOfKnives.push({
            id: fanOfKnivesIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0,
            projectileType: 'fan_of_knives',
            fanOfKnivesFlourishTint: fanTint,
            distanceTraveled: projectile.distanceTraveled,
            maxDistance: projectile.maxDistance,
            cachedStartPosition: projectile.startPosition?.clone(),
          });
        }
      } else if (userData.isRegularArrow || userData.projectileType === 'burst_arrow') {
        const existing = projectileData.regular.find(p => p.entityId === entity.id);
        const triggerFinger = userData.triggerFingerUncharged === true;
        const tempestTheme = userData.tempestBurstTheme as TempestBurstTheme | undefined;
        if (existing) {
          existing.position.copy(transform.position);
          existing.triggerFingerUncharged = triggerFinger;
          existing.tempestBurstTheme = tempestTheme;
          existing.distanceTraveled = projectile.distanceTraveled;
          existing.maxDistance = projectile.maxDistance;
          newRegular.push(existing);
        } else {
          newRegular.push({
            id: regularIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            subclass: userData.subclass,
            level: userData.level,
            opacity: userData.opacity || 1.0,
            projectileType: userData.projectileType,
            triggerFingerUncharged: triggerFinger,
            tempestBurstTheme: tempestTheme,
            distanceTraveled: projectile.distanceTraveled,
            maxDistance: projectile.maxDistance,
          });
        }
      } else if (userData.projectileType === 'wind_shear') {
        const existing = projectileData.windShear.find((p) => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          existing.direction.copy(direction);
          existing.distanceTraveled = projectile.distanceTraveled;
          existing.maxDistance = projectile.maxDistance;
          newWindShear.push(existing);
        } else {
          newWindShear.push({
            id: windShearIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id,
            opacity: userData.opacity || 1.0,
            projectileType: 'wind_shear',
            windShearRoll: typeof userData.windShearRoll === 'number' ? userData.windShearRoll : 0,
            distanceTraveled: projectile.distanceTraveled,
            maxDistance: projectile.maxDistance,
            cachedStartPosition: projectile.startPosition?.clone(),
          });
        }
      } else if (userData.projectileType === 'sword_projectile') {
        const existing = projectileData.sword.find(p => p.entityId === entity.id);
        if (existing) {
          existing.position.copy(transform.position);
          newSword.push(existing);
        } else {
          const newSwordData = {
            id: swordIdCounter.current++,
            position: transform.position.clone(),
            direction: direction.clone(),
            entityId: entity.id
          };
          newSword.push(newSwordData);
        }
      }
    }

    // Check for explosion events
    const explosionEvents = world.getEvents?.('explosion') || [];
    const newExplosions = [...explosions];
    
    for (const event of explosionEvents) {
      const newExplosion: ExplosionData = {
        id: explosionIdCounter.current++,
        position: event.position.clone(),
        color: event.color || new Color('#00ff44'),
        size: event.size || 1,
        duration: event.duration || 2,
        type: event.type || 'generic',
        chargeTime: event.chargeTime,
        infernoCrossentropy: event.infernoCrossentropy === true,
        crossentropyVisualTheme:
          (event.crossentropyVisualTheme as CrossentropyVisualTheme | undefined) ??
          (event.infernoCrossentropy === true ? 'inferno' : 'default'),
        reaperCrossentropy: event.reaperCrossentropy === true,
      };
      newExplosions.push(newExplosion);
    }

    // Clear processed explosion events
    if (explosionEvents.length > 0) {
      world.clearEvents?.('explosion');
    }

    // Haunted soul VFX (e.g. Reaper Crossentropy hits) — emitted by ProjectileSystem
    const hauntedSoulEvents = world.getEvents?.('hauntedSoulEffect') || [];
    for (const ev of hauntedSoulEvents) {
      if (onHauntedSoulAt && ev?.position) {
        onHauntedSoulAt(ev.position.clone());
      }
    }
    if (hauntedSoulEvents.length > 0) {
      world.clearEvents?.('hauntedSoulEffect');
    }

    const crossentropyPlagueVenomEvents = world.getEvents?.('crossentropyPlagueVenom') || [];
    if (crossentropyPlagueVenomEvents.length > 0) {
      world.clearEvents?.('crossentropyPlagueVenom');
      const spawned: Array<{ id: number; position: Vector3 }> = [];
      for (const raw of crossentropyPlagueVenomEvents) {
        const pos =
          raw != null &&
          typeof raw === 'object' &&
          'position' in raw &&
          raw.position != null &&
          typeof (raw as { position: Vector3 }).position.clone === 'function'
            ? (raw as { position: Vector3 }).position.clone()
            : null;
        if (!pos) continue;
        spawned.push({ id: plagueVenomEffectIdCounter.current++, position: pos });
      }
      if (spawned.length > 0) {
        setCrossentropyPlagueVenoms((prev) => [...prev, ...spawned]);
      }
    }

    const crossentropyMeteorEvents = world.getEvents?.('crossentropyMeteorCast') || [];
    if (crossentropyMeteorEvents.length > 0) {
      world.clearEvents?.('crossentropyMeteorCast');
      const spawned: CrossentropyMeteorData[] = [];
      for (const raw of crossentropyMeteorEvents) {
        const target =
          raw != null &&
          typeof raw === 'object' &&
          'targetPosition' in raw &&
          raw.targetPosition != null &&
          typeof (raw as { targetPosition: Vector3 }).targetPosition.clone === 'function'
            ? (raw as { targetPosition: Vector3 }).targetPosition.clone()
            : null;
        if (!target) continue;
        const timestamp =
          raw != null &&
          typeof raw === 'object' &&
          'timestamp' in raw &&
          typeof (raw as { timestamp?: unknown }).timestamp === 'number'
            ? ((raw as { timestamp: number }).timestamp)
            : undefined;
        const damage =
          raw != null &&
          typeof raw === 'object' &&
          'damage' in raw &&
          typeof (raw as { damage?: unknown }).damage === 'number'
            ? ((raw as { damage: number }).damage)
            : undefined;
        const startPosition =
          raw != null &&
          typeof raw === 'object' &&
          'startPosition' in raw &&
          raw.startPosition != null &&
          typeof (raw as { startPosition: Vector3 }).startPosition.clone === 'function'
            ? (raw as { startPosition: Vector3 }).startPosition.clone()
            : undefined;
        spawned.push({
          id: crossentropyMeteorIdCounter.current++,
          targetPosition: target,
          ...(timestamp != null ? { timestamp } : {}),
          ...(damage != null ? { damage } : {}),
          ...(startPosition ? { startPosition } : {}),
        });
      }
      if (spawned.length > 0) {
        setCrossentropyMeteors((prev) => [...prev, ...spawned]);
      }
    }

    const cloudkillCastEvents = world.getEvents?.('cloudkillCast') || [];
    if (cloudkillCastEvents.length > 0) {
      world.clearEvents?.('cloudkillCast');
      const spawned: CloudkillArrowData[] = [];
      for (const raw of cloudkillCastEvents) {
        const target =
          raw != null &&
          typeof raw === 'object' &&
          'targetPosition' in raw &&
          raw.targetPosition != null &&
          typeof (raw as { targetPosition: Vector3 }).targetPosition.clone === 'function'
            ? (raw as { targetPosition: Vector3 }).targetPosition.clone()
            : null;
        if (!target) continue;
        const timestamp =
          raw != null &&
          typeof raw === 'object' &&
          'timestamp' in raw &&
          typeof (raw as { timestamp?: unknown }).timestamp === 'number'
            ? (raw as { timestamp: number }).timestamp
            : undefined;
        const delayMs =
          raw != null &&
          typeof raw === 'object' &&
          'delayMs' in raw &&
          typeof (raw as { delayMs?: unknown }).delayMs === 'number'
            ? (raw as { delayMs: number }).delayMs
            : undefined;
        const startPosition =
          raw != null &&
          typeof raw === 'object' &&
          'startPosition' in raw &&
          raw.startPosition != null &&
          typeof (raw as { startPosition: Vector3 }).startPosition.clone === 'function'
            ? (raw as { startPosition: Vector3 }).startPosition.clone()
            : undefined;
        spawned.push({
          id: cloudkillArrowIdCounter.current++,
          targetPosition: target,
          ...(timestamp != null ? { timestamp } : {}),
          ...(delayMs != null ? { delayMs } : {}),
          ...(startPosition ? { startPosition } : {}),
        });
      }
      if (spawned.length > 0) {
        setCloudkillArrows((prev) => [...prev, ...spawned]);
      }
    }

    // Entropic bolts: linger briefly after ECS despawn so the trail can fade out (see EntropicBoltTrail).
    const liveEntropicIds = new Set(newEntropic.map((b) => b.entityId));
    const mergedEntropic: ProjectileData[] = [...newEntropic];
    for (const b of projectileData.entropic) {
      if (!liveEntropicIds.has(b.entityId)) {
        if (b.trailFadeOutStartElapsed === undefined) {
          mergedEntropic.push({ ...b, trailFadeOutStartElapsed: currentTime });
        } else if (currentTime - b.trailFadeOutStartElapsed < ENTROPIC_TRAIL_FADE_OUT_DURATION) {
          mergedEntropic.push(b);
        }
      }
    }

    const entropicDataChanged =
      mergedEntropic.length !== projectileData.entropic.length ||
      mergedEntropic.some((p) => {
        const ex = projectileData.entropic.find((e) => e.entityId === p.entityId);
        if (!ex) return true;
        return (ex.trailFadeOutStartElapsed ?? -1) !== (p.trailFadeOutStartElapsed ?? -1);
      }) ||
      projectileData.entropic.some((p) => !mergedEntropic.find((e) => e.entityId === p.entityId));

    // Update state only if there are changes
    const hasProjectileChanges = (
      newCrossentropy.length !== projectileData.crossentropy.length ||
      newBlitzCrossentropy.length !== projectileData.blitzCrossentropy.length ||
      entropicDataChanged ||
      newCharged.length !== projectileData.charged.length ||
      newRegular.length !== projectileData.regular.length ||
      newSword.length !== projectileData.sword.length ||
      newBarrage.length !== projectileData.barrage.length ||
      newFanOfKnives.length !== projectileData.fanOfKnives.length ||
      newWindShear.length !== projectileData.windShear.length ||
      newTower.length !== projectileData.tower.length ||
      newCrossentropy.some(p => !projectileData.crossentropy.find(existing => existing.entityId === p.entityId)) ||
      newBlitzCrossentropy.some(p => !projectileData.blitzCrossentropy.find(existing => existing.entityId === p.entityId)) ||
      newCharged.some(p => !projectileData.charged.find(existing => existing.entityId === p.entityId)) ||
      newRegular.some(p => !projectileData.regular.find(existing => existing.entityId === p.entityId)) ||
      newSword.some(p => !projectileData.sword.find(existing => existing.entityId === p.entityId)) ||
      newBarrage.some(p => !projectileData.barrage.find(existing => existing.entityId === p.entityId)) ||
      newFanOfKnives.some(p => !projectileData.fanOfKnives.find(existing => existing.entityId === p.entityId)) ||
      newWindShear.some(p => !projectileData.windShear.find(existing => existing.entityId === p.entityId)) ||
      newTower.some(p => !projectileData.tower.find(existing => existing.entityId === p.entityId))
    );

    if (hasProjectileChanges) {
      setProjectileData({
        crossentropy: newCrossentropy,
        blitzCrossentropy: newBlitzCrossentropy,
        entropic: mergedEntropic,
        charged: newCharged,
        regular: newRegular,
        sword: newSword,
        barrage: newBarrage,
        fanOfKnives: newFanOfKnives,
        windShear: newWindShear,
        tower: newTower
      });
    }

    if (newExplosions.length !== explosions.length) {
      setExplosions(newExplosions);
    }
  });

  const handleExplosionComplete = (explosionId: number) => {
    setExplosions(prev => prev.filter(explosion => explosion.id !== explosionId));
  };

  return (
    <>
      {crossentropyPlagueVenoms.map((vfx) => (
        <VenomEffect
          key={vfx.id}
          position={vfx.position}
          duration={CROSSENTROPY_PLAGUE_VENOM_MS}
          onComplete={() =>
            setCrossentropyPlagueVenoms((prev) => prev.filter((p) => p.id !== vfx.id))
          }
        />
      ))}
      {crossentropyMeteors.map((meteor) => (
        <CrossentropyMeteor
          key={meteor.id}
          targetPosition={meteor.targetPosition}
          timestamp={meteor.timestamp}
          damage={meteor.damage}
          startPosition={meteor.startPosition}
          onImpact={(_damage, _position) => {
            // Damage is applied by ProjectileSystem / backend; this is VFX only.
          }}
          onComplete={() =>
            setCrossentropyMeteors((prev) => prev.filter((m) => m.id !== meteor.id))
          }
        />
      ))}
      {cloudkillArrows.map((arrow) => (
        <CloudkillArrow
          key={arrow.id}
          targetPosition={arrow.targetPosition}
          timestamp={arrow.timestamp}
          delayMs={arrow.delayMs}
          startPosition={arrow.startPosition}
          onComplete={() =>
            setCloudkillArrows((prev) => prev.filter((a) => a.id !== arrow.id))
          }
        />
      ))}
      {/* Crossentropy Bolts */}
      {projectileData.crossentropy.map(bolt => (
        <CrossentropyBolt
          key={bolt.id}
          id={bolt.id}
          position={bolt.position}
          direction={bolt.direction}
          visualTheme={bolt.crossentropyVisualTheme ?? 'default'}
          reaperEcsDriven={bolt.reaperCrossentropy === true}
          checkCollisions={bolt.reaperCrossentropy ? undefined : checkCrossentropyBoltCollisions}
          onImpact={(impactPosition?: Vector3) => {
            if (bolt.reaperCrossentropy) return;
            if (impactPosition) {
              const explosionPosition = impactPosition.clone();
              explosionPosition.y = Math.max(1.5, impactPosition.y);
              const theme = bolt.crossentropyVisualTheme ?? 'default';
              const color =
                theme === 'inferno'
                  ? new Color('#FF3300')
                  : theme === 'glacial'
                    ? new Color('#1188DD')
                    : theme === 'tempest'
                    ? new Color('#2288FF')
                    : theme === 'plague'
                      ? new Color('#33DD66')
                      : new Color('#8B00FF');
              const explosion = {
                id: explosionIdCounter.current++,
                position: explosionPosition,
                color,
                size: 2.0,
                duration: 1.0,
                type: 'crossentropy' as const,
                chargeTime: 1.0,
                infernoCrossentropy: theme === 'inferno',
                crossentropyVisualTheme: theme,
              };
              setExplosions(prev => [...prev, explosion]);
              if (bolt.crossentropyPlague === true && world.emitEvent) {
                world.emitEvent('crossentropyPlagueVenom', { position: explosionPosition.clone() });
              }
            }
          }}
        />
      ))}

      {/* Blitz Cannon Crossentropy Rockets */}
      {projectileData.blitzCrossentropy.map(bolt => (
        <CrossentropyBlitzRocket
          key={bolt.id}
          id={bolt.id}
          position={bolt.position}
          direction={bolt.direction}
          visualTheme={bolt.crossentropyVisualTheme ?? 'default'}
          reaperEcsDriven={bolt.reaperCrossentropy === true}
        />
      ))}

      {/* Entropic Bolts */}
      {projectileData.entropic.map(bolt => (
        <EntropicBolt
          key={bolt.id}
          id={bolt.id}
          position={bolt.position}
          direction={bolt.direction}
          isCryoflame={bolt.isCryoflame}
          colorVariant={bolt.colorVariant}
          ecsDriven
          trailFadeOutStartElapsed={bolt.trailFadeOutStartElapsed}
        />
      ))}

      {/* Charged Arrows */}
      {projectileData.charged.map(arrow => (
        <ChargedArrow
          key={arrow.id}
          position={arrow.position}
          direction={arrow.direction}
          onImpact={noopProjectileImpact}
        />
      ))}

      {/* Regular Arrows */}
      {projectileData.regular.map(arrow => {
        // Distance info is cached from the ECS projectile component during the useFrame tick above
        const distanceTraveled = arrow.distanceTraveled || 0;
        const maxDistance = arrow.maxDistance || 25;
        
        return (
          <RegularArrow
            key={arrow.id}
            position={arrow.position}
            direction={arrow.direction}
            distanceTraveled={distanceTraveled}
            maxDistance={maxDistance}
            projectileType={arrow.projectileType}
            triggerFingerUncharged={arrow.triggerFingerUncharged === true}
            tempestBurstTheme={arrow.tempestBurstTheme}
            onImpact={noopProjectileImpact}
          />
        );
      })}


      {/* Barrage Arrows */}
      <Barrage 
        projectiles={projectileData.barrage.map(arrow => {
          // Distance info is cached from the ECS projectile component during the useFrame tick above
          const distanceTraveled = arrow.distanceTraveled || 0;
          const maxDistance = arrow.maxDistance || 16;
          const startPos =
            arrow.cachedStartPosition != null ? arrow.cachedStartPosition.clone() : arrow.position.clone();

          return {
            id: arrow.id,
            position: arrow.position,
            direction: arrow.direction,
            startPosition: startPos,
            maxDistance: maxDistance,
            damage: 30,
            startTime: Date.now(),
            hasCollided: false, 
            hitEnemies: new Set(),
            opacity: arrow.opacity,
            distanceTraveled: distanceTraveled,
            wrathfulBite: arrow.barrageWrathfulBite === true,
            wyvernBite: arrow.barrageWyvernBite === true,
            staggeringBite: arrow.barrageStaggeringBite === true,
            glacialBite: arrow.barrageGlacialBite === true,
            entanglement: arrow.barrageEntanglement === true,
          };
        })}
      />

      <FanOfKnivesDagger
        projectiles={projectileData.fanOfKnives.map((knife) => {
          const maxDistance =
            knife.maxDistance != null && knife.maxDistance !== Infinity
              ? knife.maxDistance
              : 7;
          const startPos = knife.cachedStartPosition ?? knife.position;
          const tint = knife.fanOfKnivesFlourishTint ?? 'default';
          return {
            id: knife.id,
            position: knife.position,
            direction: knife.direction,
            startPosition: startPos,
            maxDistance,
            distanceTraveled: knife.distanceTraveled ?? 0,
            colors: getFanOfKnivesDaggerColorsFromTint(tint),
          };
        })}
      />

      <WindShearProjectile
        projectiles={projectileData.windShear.map((ws) => {
          // Distance/start-position info is cached from the ECS projectile component during the useFrame tick above
          const distanceTraveled = ws.distanceTraveled ?? 0;
          const maxDistance =
            ws.maxDistance != null && ws.maxDistance !== Infinity
              ? ws.maxDistance
              : 8;
          const startPos = ws.cachedStartPosition != null ? ws.cachedStartPosition.clone() : ws.position.clone();
          return {
            id: ws.id,
            position: ws.position,
            direction: ws.direction.clone(),
            startPosition: startPos,
            maxDistance,
            distanceTraveled,
            roll: ws.windShearRoll ?? 0,
          };
        })}
      />

      {/* Tower Projectiles */}
      {projectileData.tower.map(projectile => (
        <TowerProjectile
          key={projectile.id}
          position={projectile.position}
          direction={projectile.direction}
          entityId={projectile.entityId}
          ownerId={projectile.ownerId}
          opacity={projectile.opacity}
        />
      ))}

      {/* Explosions */}
      {explosions.map(explosion => {
        if (explosion.type === 'crossentropy_blitz') {
          return (
            <CrossentropyBlitzExplosion
              key={explosion.id}
              position={explosion.position}
              chargeTime={explosion.chargeTime || 0.25}
              explosionStartTime={Date.now()}
              visualTheme={
                explosion.crossentropyVisualTheme ??
                (explosion.infernoCrossentropy ? 'inferno' : 'default')
              }
              reaperPurple={explosion.reaperCrossentropy === true}
              onComplete={() => handleExplosionComplete(explosion.id)}
            />
          );
        }
        if (explosion.type === 'crossentropy') {
          return (
            <CrossentropyExplosion
              key={explosion.id}
              position={explosion.position}
              chargeTime={explosion.chargeTime || 1.0}
              explosionStartTime={Date.now()}
              visualTheme={
                explosion.crossentropyVisualTheme ??
                (explosion.infernoCrossentropy ? 'inferno' : 'default')
              }
              onComplete={() => handleExplosionComplete(explosion.id)}
            />
          );
        } else {
          // Default to generic explosion for other types
          return (
            <ExplosionEffect
              key={explosion.id}
              position={explosion.position}
              color={explosion.color}
              size={explosion.size}
              duration={explosion.duration}
              onComplete={() => handleExplosionComplete(explosion.id)}
            />
          );
        }
      })}
    </>
  );
}

export default React.memo(UnifiedProjectileManager);
