// SummonedUnit component for PVP tower minions
import { Component } from '../Entity';

export class SummonedUnit extends Component {
  public static readonly componentType = 'SummonedUnit';
  public readonly componentType = 'SummonedUnit';

  // Ownership and identification
  public ownerId: string; // Player ID who owns this unit
  public unitId: string; // Unique identifier for this unit

  // Combat properties
  public attackRange: number;
  public attackDamage: number;
  public attackCooldown: number; // Seconds between attacks
  public lastAttackTime: number;
  public maxHealth: number;

  // Movement properties
  public moveSpeed: number;
  public targetPosition: { x: number; y: number; z: number } | null; // Position to move towards
  public currentTarget: number | null; // Entity ID of current target (unit or tower)
  public lastTargetSearchTime: number;
  public targetSearchCooldown: number; // How often to search for targets

  // State
  public isActive: boolean;
  public isDead: boolean;
  public deathTime: number;

  // Summon properties
  public summonTime: number; // When this unit was summoned
  public lifetime: number; // How long this unit lives (in seconds)

  constructor(
    ownerId: string = '',
    unitId: string = '',
    targetPosition: { x: number; y: number; z: number } | null = null
  ) {
    super();

    this.ownerId = ownerId;
    this.unitId = unitId;

    // Combat configuration
    this.attackRange = 4; // 4 unit attack range as specified
    this.attackDamage = 45; // 15 damage per hit as specified
    this.attackCooldown = 2.0; // 1 second between attacks
    this.lastAttackTime = 0;
    this.maxHealth = 1000; // 500 HP as specified

    // Movement configuration
    this.moveSpeed = 2.25; // Moderate movement speed
    this.targetPosition = targetPosition;
    this.currentTarget = null;
    this.lastTargetSearchTime = 0;
    this.targetSearchCooldown = 0.5; // Search for targets every 0.5 seconds

    // State
    this.isActive = true;
    this.isDead = false;
    this.deathTime = 0;

    // Summon properties
    this.summonTime = Date.now() / 1000; // Current time in seconds
    this.lifetime = 120; // 2 minutes lifetime
  }

  public canAttack(currentTime: number): boolean {
    if (!this.isActive || this.isDead || !this.currentTarget) {
      return false;
    }
    return (currentTime - this.lastAttackTime) >= this.attackCooldown;
  }

  public performAttack(currentTime: number): void {
    this.lastAttackTime = currentTime;
  }

  public canSearchForTargets(currentTime: number): boolean {
    return (currentTime - this.lastTargetSearchTime) >= this.targetSearchCooldown;
  }

  public updateTargetSearch(currentTime: number): void {
    this.lastTargetSearchTime = currentTime;
  }

  public setTarget(targetEntityId: number | null): void {
    this.currentTarget = targetEntityId;
  }

  public clearTarget(): void {
    this.currentTarget = null;
  }

  public die(currentTime: number): void {
    this.isDead = true;
    this.isActive = false;
    this.deathTime = currentTime;
    this.clearTarget();
  }

  public isExpired(currentTime: number): boolean {
    return this.isDead || (currentTime - this.summonTime) >= this.lifetime;
  }

  public getDisplayName(): string {
    return `Unit (${this.ownerId})`;
  }

  public reset(): void {
    this.ownerId = '';
    this.unitId = '';
    this.attackRange = 4;
    this.attackDamage = 45;
    this.attackCooldown = 2.0;
    this.lastAttackTime = 0;
    this.maxHealth = 1000;
    this.moveSpeed = 2.25;
    this.targetPosition = null;
    this.currentTarget = null;
    this.lastTargetSearchTime = 0;
    this.targetSearchCooldown = 0.5;
    this.isActive = true;
    this.isDead = false;
    this.deathTime = 0;
    this.summonTime = Date.now() / 1000;
    this.lifetime = 120;
    this.enabled = true;
  }

  public clone(): SummonedUnit {
    const clone = new SummonedUnit(this.ownerId, this.unitId, this.targetPosition);
    clone.attackRange = this.attackRange;
    clone.attackDamage = this.attackDamage;
    clone.attackCooldown = this.attackCooldown;
    clone.lastAttackTime = this.lastAttackTime;
    clone.maxHealth = this.maxHealth;
    clone.moveSpeed = this.moveSpeed;
    clone.currentTarget = this.currentTarget;
    clone.lastTargetSearchTime = this.lastTargetSearchTime;
    clone.targetSearchCooldown = this.targetSearchCooldown;
    clone.isActive = this.isActive;
    clone.isDead = this.isDead;
    clone.deathTime = this.deathTime;
    clone.summonTime = this.summonTime;
    clone.lifetime = this.lifetime;
    return clone;
  }
}
