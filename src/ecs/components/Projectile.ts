// Projectile component for bullets, spells, and other projectiles
import { Vector3 } from '@/utils/three-exports';
import { Component } from '../Entity';

export class Projectile extends Component {
  public static readonly componentType = 'Projectile'; // Explicit type identifier
  public readonly componentType = 'Projectile'; // Instance identifier
  public velocity: Vector3;
  public speed: number;
  public damage: number;
  public lifetime: number;
  public maxLifetime: number;
  public piercing: boolean;
  public hitTargets: Set<number>; // Entity IDs that have been hit
  public explosionRadius: number;
  public gravity: number;
  public bounces: number;
  public maxBounces: number;
  public owner: number; // Entity ID of the owner
  public sourcePlayerId: string; // Player ID of the source (for multiplayer team validation)
  public distanceTraveled: number; // Track distance traveled
  public maxDistance: number; // Maximum distance before expiring
  public startPosition: Vector3; // Starting position for distance calculation
  public projectileType: string; // Type of projectile (e.g., 'viper_sting', 'arrow', etc.)
  /** Co-op: stagger from talents (e.g. Stagger Shot) passed to CombatSystem on hit. */
  public staggerToAdd?: number;
  /** Bow perfect-timing primary — Wrathful Shots crit (CombatSystem + Projectile). */
  public isPerfectShot?: boolean;
  /** Bow perfect shot volley id (Dual Coil shares one id per release; Arctic Sting first-hit). */
  public perfectShotVolleyId?: number;
  /** INFERNO talent: Crossentropy bolt — crit + server Ignite routing. */
  public infernoCrossentropy?: boolean;
  /** Reaper talent: Crossentropy pierces, no impact explosion, stack routing on kill. */
  public reaperCrossentropy?: boolean;
  /** TEMPEST boon: VFX + stagger (used for explosion theme). */
  public crossentropyTempest?: boolean;
  /** PLAGUE boon: VFX + higher base damage (used for explosion theme). */
  public crossentropyPlague?: boolean;
  /** GLACIAL STORM room boon: deep blue theme + blizzard/coldsnap on hit (Inferno may override VFX only). */
  public crossentropyGlacial?: boolean;
  /** METEOR talent: Crossentropy hit can schedule a delayed meteor impact. */
  public crossentropyMeteor?: boolean;
  /** FRAGMENTATION talent enabled on this bolt (primary cast only). */
  public crossentropyFragmentation?: boolean;
  /** Secondary fragmentation bolt cannot chain further. */
  public crossentropySuppressFragmentation?: boolean;
  /** Dual Coil: which parallel lane (0/1) for damage number lateral offset. */
  public dualCoilLane?: 0 | 1;
  /** Scythe Wrathful / Staggering / Infesting Entropic boons — bolt hit rules in CombatSystem. */
  public entropicBoltTalent?: 'wrathful' | 'staggering' | 'infesting' | 'arctic';

  // Homing properties
  public targetEntityId: number | null; // Entity ID to home towards
  public homingStrength: number; // How strongly it homes (0-1)
  public maxTurnRate: number; // Maximum radians per second the projectile can turn

  constructor(
    speed: number = 20,
    damage: number = 10,
    maxLifetime: number = 5,
    owner: number = -1,
    sourcePlayerId: string = 'unknown',
    projectileType: string = 'generic'
  ) {
    super();
    
    this.velocity = new Vector3(0, 0, 0);
    this.speed = speed;
    this.damage = damage;
    this.lifetime = 0;
    this.maxLifetime = maxLifetime;
    this.piercing = false;
    this.hitTargets = new Set();
    this.explosionRadius = 0;
    this.gravity = 0; // Most projectiles ignore gravity
    this.bounces = 0;
    this.maxBounces = 0;
    this.owner = owner;
    this.sourcePlayerId = sourcePlayerId;
    this.distanceTraveled = 0;
    this.maxDistance = Infinity; // Default to no distance limit
    this.startPosition = new Vector3(0, 0, 0);
    this.projectileType = projectileType;
    this.staggerToAdd = undefined;

    // Initialize homing properties
    this.targetEntityId = null;
    this.homingStrength = 0; // Default to no homing
    this.maxTurnRate = Math.PI; // Default to 180 degrees per second turn rate
  }

  public setDirection(direction: Vector3): void {
    this.velocity.copy(direction).normalize().multiplyScalar(this.speed);
  }

  public addGravity(gravity: number): void {
    this.gravity = gravity;
  }

  public setPiercing(piercing: boolean): void {
    this.piercing = piercing;
  }

  public setExplosive(radius: number): void {
    this.explosionRadius = radius;
  }

  public setBouncing(maxBounces: number): void {
    this.maxBounces = maxBounces;
  }

  public setMaxDistance(maxDistance: number): void {
    this.maxDistance = maxDistance;
  }

  public setStartPosition(position: Vector3): void {
    this.startPosition.copy(position);
  }

  public setHoming(targetEntityId: number, homingStrength: number = 0.8, maxTurnRate: number = Math.PI): void {
    this.targetEntityId = targetEntityId;
    this.homingStrength = Math.max(0, Math.min(1, homingStrength)); // Clamp between 0 and 1
    this.maxTurnRate = maxTurnRate;
  }

  public disableHoming(): void {
    this.targetEntityId = null;
    this.homingStrength = 0;
  }

  public hasHitTarget(entityId: number): boolean {
    return this.hitTargets.has(entityId);
  }

  public addHitTarget(entityId: number): void {
    this.hitTargets.add(entityId);
  }

  public canHitTarget(entityId: number): boolean {
    // Can't hit owner
    if (entityId === this.owner) return false;
    
    // Even piercing projectiles can only hit each target once
    // Piercing means it can hit multiple different targets, not the same target multiple times
    return !this.hasHitTarget(entityId);
  }

  public isExpired(): boolean {
    return this.lifetime >= this.maxLifetime || this.distanceTraveled >= this.maxDistance;
  }

  public canBounce(): boolean {
    return this.bounces < this.maxBounces;
  }

  public bounce(normal: Vector3): void {
    if (!this.canBounce()) return;
    
    // Reflect velocity off the surface normal
    const reflection = this.velocity.clone().reflect(normal);
    this.velocity.copy(reflection);
    this.bounces++;
  }

  public update(deltaTime: number): void {
    this.lifetime += deltaTime;
    
    // Track distance traveled
    const distanceThisFrame = this.velocity.length() * deltaTime;
    this.distanceTraveled += distanceThisFrame;
    
    // Apply gravity if enabled
    if (this.gravity !== 0) {
      this.velocity.y += this.gravity * deltaTime;
    }
  }

  public getPosition(transform: Vector3): Vector3 {
    return transform.clone();
  }

  public getPredictedPosition(transform: Vector3, deltaTime: number): Vector3 {
    const predicted = transform.clone();
    predicted.add(this.velocity.clone().multiplyScalar(deltaTime));
    return predicted;
  }

  public reset(): void {
    this.velocity.set(0, 0, 0);
    this.speed = 20;
    this.damage = 10;
    this.lifetime = 0;
    this.maxLifetime = 5;
    this.piercing = false;
    this.hitTargets.clear();
    this.explosionRadius = 0;
    this.gravity = 0;
    this.bounces = 0;
    this.maxBounces = 0;
    this.owner = -1;
    this.sourcePlayerId = 'unknown';
    this.distanceTraveled = 0;
    this.maxDistance = Infinity;
    this.startPosition.set(0, 0, 0);
    this.projectileType = 'generic';
    this.staggerToAdd = undefined;
    this.infernoCrossentropy = undefined;
    this.reaperCrossentropy = undefined;
    this.crossentropyTempest = undefined;
    this.crossentropyPlague = undefined;
    this.crossentropyGlacial = undefined;
    this.crossentropyMeteor = undefined;
    this.crossentropyFragmentation = undefined;
    this.crossentropySuppressFragmentation = undefined;
    this.dualCoilLane = undefined;
    this.entropicBoltTalent = undefined;
    this.targetEntityId = null;
    this.homingStrength = 0;
    this.maxTurnRate = Math.PI;
    this.enabled = true;
  }

  public clone(): Projectile {
    const clone = new Projectile(this.speed, this.damage, this.maxLifetime, this.owner, this.sourcePlayerId, this.projectileType);
    clone.velocity.copy(this.velocity);
    clone.lifetime = this.lifetime;
    clone.piercing = this.piercing;
    clone.hitTargets = new Set(this.hitTargets);
    clone.explosionRadius = this.explosionRadius;
    clone.gravity = this.gravity;
    clone.bounces = this.bounces;
    clone.maxBounces = this.maxBounces;
    clone.distanceTraveled = this.distanceTraveled;
    clone.maxDistance = this.maxDistance;
    clone.startPosition.copy(this.startPosition);
    clone.targetEntityId = this.targetEntityId;
    clone.homingStrength = this.homingStrength;
    clone.maxTurnRate = this.maxTurnRate;
    clone.staggerToAdd = this.staggerToAdd;
    clone.infernoCrossentropy = this.infernoCrossentropy;
    clone.reaperCrossentropy = this.reaperCrossentropy;
    clone.crossentropyTempest = this.crossentropyTempest;
    clone.crossentropyPlague = this.crossentropyPlague;
    clone.crossentropyGlacial = this.crossentropyGlacial;
    clone.crossentropyMeteor = this.crossentropyMeteor;
    clone.crossentropyFragmentation = this.crossentropyFragmentation;
    clone.crossentropySuppressFragmentation = this.crossentropySuppressFragmentation;
    clone.dualCoilLane = this.dualCoilLane;
    clone.entropicBoltTalent = this.entropicBoltTalent;
    return clone;
  }
}
