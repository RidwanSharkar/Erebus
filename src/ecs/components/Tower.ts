// Tower component for PVP home base towers
import { Component } from '../Entity';

export class Tower extends Component {
  public static readonly componentType = 'Tower';
  public readonly componentType = 'Tower';
  
  // Tower ownership and identification
  public ownerId: string; // Player ID who owns this tower
  public towerIndex: number; // Tower index (0 for first player, 1 for second, etc.)
  
  // Combat properties
  public attackRange: number;
  public attackDamage: number;
  public attackCooldown: number; // Seconds between attacks
  public lastAttackTime: number;
  public projectileSpeed: number;
  
  // Targeting
  public currentTarget: number | null; // Entity ID of current target
  public targetSearchRange: number; // Range to search for new targets
  public lastTargetSearchTime: number;
  public targetSearchCooldown: number; // How often to search for targets
  
  // State
  public isActive: boolean;
  public isDead: boolean;
  public deathTime: number;
  
  constructor(
    ownerId: string = '',
    towerIndex: number = 0
  ) {
    super();
    
    this.ownerId = ownerId;
    this.towerIndex = towerIndex;
    
    // Combat configuration
    this.attackRange = 13; // attack range 
    this.attackDamage = 150; // 25 damage per arrow
    this.attackCooldown = 1.5; // 1.5 seconds between shots
    this.lastAttackTime = 0;
    this.projectileSpeed = 20; // Speed of tower arrows
    
    // Targeting configuration
    this.currentTarget = null;
    this.targetSearchRange = this.attackRange + 1; // Search slightly beyond attack range
    this.lastTargetSearchTime = 0;
    this.targetSearchCooldown = 0.5; // Search for targets every 0.5 seconds
    
    // State
    this.isActive = true;
    this.isDead = false;
    this.deathTime = 0;
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
  
  public getDisplayName(): string {
    return `Tower ${this.towerIndex + 1} (Owner: ${this.ownerId})`;
  }
  
  public reset(): void {
    this.ownerId = '';
    this.towerIndex = 0;
    this.attackRange = 10;
    this.attackDamage = 25;
    this.attackCooldown = 1.5;
    this.lastAttackTime = 0;
    this.projectileSpeed = 20;
    this.currentTarget = null;
    this.targetSearchRange = 9;
    this.lastTargetSearchTime = 0;
    this.targetSearchCooldown = 0.5;
    this.isActive = true;
    this.isDead = false;
    this.deathTime = 0;
    this.enabled = true;
  }
  
  public clone(): Tower {
    const clone = new Tower(this.ownerId, this.towerIndex);
    clone.attackRange = this.attackRange;
    clone.attackDamage = this.attackDamage;
    clone.attackCooldown = this.attackCooldown;
    clone.lastAttackTime = this.lastAttackTime;
    clone.projectileSpeed = this.projectileSpeed;
    clone.currentTarget = this.currentTarget;
    clone.targetSearchRange = this.targetSearchRange;
    clone.lastTargetSearchTime = this.lastTargetSearchTime;
    clone.targetSearchCooldown = this.targetSearchCooldown;
    clone.isActive = this.isActive;
    clone.isDead = this.isDead;
    clone.deathTime = this.deathTime;
    return clone;
  }
}
