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
  public distanceTraveled: number; // Track distance traveled
  public maxDistance: number; // Maximum distance before expiring
  public startPosition: Vector3; // Starting position for distance calculation

  constructor(
    speed: number = 20,
    damage: number = 10,
    maxLifetime: number = 5,
    owner: number = -1
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
    this.distanceTraveled = 0;
    this.maxDistance = Infinity; // Default to no distance limit
    this.startPosition = new Vector3(0, 0, 0);
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

  public hasHitTarget(entityId: number): boolean {
    return this.hitTargets.has(entityId);
  }

  public addHitTarget(entityId: number): void {
    this.hitTargets.add(entityId);
  }

  public canHitTarget(entityId: number): boolean {
    // Can't hit owner
    if (entityId === this.owner) return false;
    
    // If piercing, can hit targets multiple times
    if (this.piercing) return true;
    
    // Otherwise, can only hit each target once
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
    this.distanceTraveled = 0;
    this.maxDistance = Infinity;
    this.startPosition.set(0, 0, 0);
    this.enabled = true;
  }

  public clone(): Projectile {
    const clone = new Projectile(this.speed, this.damage, this.maxLifetime, this.owner);
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
    return clone;
  }
}
