// Enemy component for identifying enemy entities
import { Component } from '../Entity';
import { Vector3 } from '@/utils/three-exports';
import { addGlobalFrozenEnemy } from '@/components/weapons/FrostNovaManager';
import {
  WYVERN_BITE_CONCENTRATED_VENOM_DPS_PER_STACK,
  WYVERN_BITE_CONCENTRATED_VENOM_DURATION_SEC,
  WYVERN_BITE_CONCENTRATED_VENOM_MAX_STACKS,
  CHILL_STACK_DURATION_SEC,
  CHILL_SLOW_PER_STACK,
  CHILL_STACKS_TO_FREEZE,
  BLIZZARD_FREEZE_DURATION_SEC,
} from '@/utils/talents';

export enum EnemyType {
  DUMMY = 'dummy',
  GRUNT = 'grunt',
  ELITE = 'elite',
  BOSS = 'boss'
}

export class Enemy extends Component {
  public static readonly componentType = 'Enemy'; // Explicit type identifier
  public readonly componentType = 'Enemy'; // Instance identifier
  public type: EnemyType;
  public level: number;
  public experienceReward: number;
  public isAggressive: boolean;
  public aggroRange: number;
  public attackRange: number;
  public attackDamage: number;
  public attackCooldown: number;
  public lastAttackTime: number;
  public movementSpeed: number;
  public isDead: boolean;
  public deathTime: number;
  public respawnTime: number;
  public canRespawn: boolean;
  
  // Freeze status effect
  public isFrozen: boolean;
  public freezeStartTime: number;
  public freezeDuration: number;
  public originalMovementSpeed: number;

  // Stun status effect (prevents rotation but not movement)
  public isStunned: boolean;
  public stunStartTime: number;
  public stunDuration: number;
  
  // Venom debuff effect
  public isVenomous: boolean;
  public venomStartTime: number;
  public venomDuration: number;
  public venomDamagePerSecond: number;
  public lastVenomDamageTime: number;

  /** Wyvern Bite — Concentrated Venom (local / offline; co-op uses server). */
  public concentratedVenomStacks: number;
  public concentratedVenomEndTime: number;
  public lastConcentratedVenomTickTime: number;
  
  // Sunder stacks effect
  public sunderStacks: number;
  public sunderLastApplied: number;
  public sunderDuration: number;
  
  // Corrupted debuff effect (WraithStrike)
  public isCorrupted: boolean;
  public corruptedStartTime: number;
  public corruptedDuration: number;
  public corruptedInitialSlowPercent: number; // Initial slow percentage (90%)
  public corruptedRecoveryRate: number; // Recovery rate per second (10%)

  /** Blizzard talent — Chill stacks (local + client mirror of server in co-op). */
  public chillStacks: number;
  public chillExpiresAtSec: number;

  constructor(
    type: EnemyType = EnemyType.DUMMY,
    level: number = 1
  ) {
    super();
    
    this.type = type;
    this.level = level;
    this.experienceReward = this.calculateExperienceReward();
    this.isAggressive = type !== EnemyType.DUMMY;
    this.aggroRange = this.calculateAggroRange();
    this.attackRange = this.calculateAttackRange();
    this.attackDamage = this.calculateAttackDamage();
    this.attackCooldown = this.calculateAttackCooldown();
    this.lastAttackTime = 0;
    this.movementSpeed = this.calculateMovementSpeed();
    this.isDead = false;
    this.deathTime = 0;
    this.respawnTime = 30; // 30 seconds default respawn time
    this.canRespawn = true;
    
    // Initialize freeze status
    this.isFrozen = false;
    this.freezeStartTime = 0;
    this.freezeDuration = 0;
    this.originalMovementSpeed = this.movementSpeed;

    // Initialize stun status
    this.isStunned = false;
    this.stunStartTime = 0;
    this.stunDuration = 0;
    
    // Initialize venom status
    this.isVenomous = false;
    this.venomStartTime = 0;
    this.venomDuration = 0;
    this.venomDamagePerSecond = 0;
    this.lastVenomDamageTime = 0;

    this.concentratedVenomStacks = 0;
    this.concentratedVenomEndTime = 0;
    this.lastConcentratedVenomTickTime = 0;
    
    // Initialize sunder stacks
    this.sunderStacks = 0;
    this.sunderLastApplied = 0;
    this.sunderDuration = 10.0; // 10 seconds
    
    // Initialize corrupted debuff
    this.isCorrupted = false;
    this.corruptedStartTime = 0;
    this.corruptedDuration = 8.0; // 8 seconds
    this.corruptedInitialSlowPercent = 0.9; // 90% slow initially
    this.corruptedRecoveryRate = 0.1; // 10% recovery per second

    this.chillStacks = 0;
    this.chillExpiresAtSec = 0;
  }

  private calculateExperienceReward(): number {
    const baseExp = {
      [EnemyType.DUMMY]: 5,
      [EnemyType.GRUNT]: 10,
      [EnemyType.ELITE]: 25,
      [EnemyType.BOSS]: 100
    };
    return baseExp[this.type] * this.level;
  }

  private calculateAggroRange(): number {
    const baseRange = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't aggro
      [EnemyType.GRUNT]: 5,
      [EnemyType.ELITE]: 8,
      [EnemyType.BOSS]: 12
    };
    return baseRange[this.type];
  }

  private calculateAttackRange(): number {
    const baseRange = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't attack
      [EnemyType.GRUNT]: 1.5,
      [EnemyType.ELITE]: 2,
      [EnemyType.BOSS]: 3
    };
    return baseRange[this.type];
  }

  private calculateAttackDamage(): number {
    const baseDamage = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't deal damage
      [EnemyType.GRUNT]: 15,
      [EnemyType.ELITE]: 25,
      [EnemyType.BOSS]: 50
    };
    return baseDamage[this.type] * this.level;
  }

  private calculateAttackCooldown(): number {
    const baseCooldown = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't attack
      [EnemyType.GRUNT]: 2,
      [EnemyType.ELITE]: 1.5,
      [EnemyType.BOSS]: 1
    };
    return baseCooldown[this.type];
  }

  private calculateMovementSpeed(): number {
    const baseSpeed = {
      [EnemyType.DUMMY]: 0, // Dummy enemies don't move
      [EnemyType.GRUNT]: 3,
      [EnemyType.ELITE]: 0, // Elite enemies are stationary like training dummies
      [EnemyType.BOSS]: 2.5
    };
    return baseSpeed[this.type];
  }

  public canAttack(currentTime: number): boolean {
    if (!this.isAggressive || this.isDead || this.attackDamage === 0) {
      return false;
    }
    return (currentTime - this.lastAttackTime) >= this.attackCooldown;
  }

  public performAttack(currentTime: number): void {
    this.lastAttackTime = currentTime;
  }

  public takeDamage(): void {
    // This will be handled by the Health component
    // This method is for enemy-specific damage reactions
  }

  public die(currentTime: number): void {
    this.isDead = true;
    this.deathTime = currentTime;
  }

  public canRespawnNow(currentTime: number): boolean {
    if (!this.canRespawn || !this.isDead) {
      return false;
    }
    return (currentTime - this.deathTime) >= this.respawnTime;
  }

  public respawn(): void {
    this.isDead = false;
    this.deathTime = 0;
    this.lastAttackTime = 0;
    // Clear freeze status on respawn
    this.unfreeze();
    // Clear stun status on respawn
    this.unstun();
    // Clear venom status on respawn
    this.removeVenom();
    this.removeConcentratedVenom();
    // Clear corrupted status on respawn
    this.removeCorrupted();
    this.chillStacks = 0;
    this.chillExpiresAtSec = 0;
  }
  
  public freeze(duration: number, currentTime: number): void {
    if (this.isDead) return; // Can't freeze dead enemies
    
    this.isFrozen = true;
    this.freezeStartTime = currentTime;
    this.freezeDuration = duration;
    // Set movement speed to 0 when frozen
    this.movementSpeed = 0;
  }
  
  public unfreeze(): void {
    this.isFrozen = false;
    this.freezeStartTime = 0;
    this.freezeDuration = 0;
    // Restore original movement speed
    this.movementSpeed = this.originalMovementSpeed;
  }

  public stun(duration: number, currentTime: number): void {
    if (this.isDead) return; // Can't stun dead enemies

    this.isStunned = true;
    this.stunStartTime = currentTime;
    this.stunDuration = duration;
    // Set movement speed to 0 when stunned
    this.movementSpeed = 0;
  }

  public unstun(): void {
    this.isStunned = false;
    this.stunStartTime = 0;
    this.stunDuration = 0;
    // Restore original movement speed
    this.movementSpeed = this.originalMovementSpeed;
  }
  
  public updateFreezeStatus(currentTime: number): void {
    if (!this.isFrozen) return;

    const elapsed = currentTime - this.freezeStartTime;
    if (elapsed >= this.freezeDuration) {
      this.unfreeze();
    }
  }

  public updateStunStatus(currentTime: number): void {
    if (!this.isStunned) return;

    const elapsed = currentTime - this.stunStartTime;
    if (elapsed >= this.stunDuration) {
      this.unstun();
    }
  }

  public updateChillStatus(currentTime: number): void {
    if (this.chillStacks <= 0) return;
    if (currentTime >= this.chillExpiresAtSec) {
      this.chillStacks = 0;
      this.chillExpiresAtSec = 0;
    }
  }

  /**
   * One Blizzard damage tick → +1 Chill; at 5 stacks, freeze and clear (Runeblade talent).
   */
  public applyBlizzardChillStack(currentTime: number, ecsEntityIdForVfx: string, position: Vector3): void {
    if (this.isDead || this.isFrozen) return;

    this.chillStacks += 1;
    this.chillExpiresAtSec = currentTime + CHILL_STACK_DURATION_SEC;

    if (this.chillStacks >= CHILL_STACKS_TO_FREEZE) {
      this.chillStacks = 0;
      this.chillExpiresAtSec = 0;
      this.freeze(BLIZZARD_FREEZE_DURATION_SEC, currentTime);
      addGlobalFrozenEnemy(ecsEntityIdForVfx, position.clone(), BLIZZARD_FREEZE_DURATION_SEC * 1000);
    }
  }

  /** Co-op: server-authoritative chill stacks → local ECS (movement multiplier + UI). */
  public syncChillFromServer(stacks: number, expiresAtMs: number): void {
    if (this.isDead) return;
    this.chillStacks = Math.max(0, Math.floor(stacks));
    this.chillExpiresAtSec = expiresAtMs / 1000;
  }
  
  public canMove(): boolean {
    return !this.isFrozen && !this.isStunned && !this.isDead;
  }

  public canRotate(): boolean {
    return !this.isStunned && !this.isDead;
  }
  
  public getEffectiveMovementSpeed(): number {
    if (this.isDead || this.isFrozen || this.isStunned) {
      return 0;
    }
    
    let speed = this.movementSpeed;
    
    // Apply corrupted debuff slow effect
    if (this.isCorrupted) {
      const slowMultiplier = this.getCorruptedSlowMultiplier();
      speed *= (1 - slowMultiplier);
    }

    const t = Date.now() / 1000;
    if (this.chillStacks > 0 && t < this.chillExpiresAtSec) {
      speed *= 1 - CHILL_SLOW_PER_STACK * Math.min(4, this.chillStacks);
    }
    
    return speed;
  }
  
  private getCorruptedSlowMultiplier(): number {
    if (!this.isCorrupted) return 0;
    
    const currentTime = Date.now() / 1000;
    const elapsed = currentTime - this.corruptedStartTime;
    
    // Calculate current slow percentage based on gradual recovery
    // Initial: 90% slow, recovers 10% per second
    const currentSlowPercent = Math.max(0, this.corruptedInitialSlowPercent - (elapsed * this.corruptedRecoveryRate));
    
    return currentSlowPercent;
  }
  
  public applyVenom(duration: number, damagePerSecond: number, currentTime: number): void {
    if (this.isDead) return; // Can't apply venom to dead enemies
    
    this.isVenomous = true;
    this.venomStartTime = currentTime;
    this.venomDuration = duration;
    this.venomDamagePerSecond = damagePerSecond;
    this.lastVenomDamageTime = currentTime;
  }
  
  public removeVenom(): void {
    this.isVenomous = false;
    this.venomStartTime = 0;
    this.venomDuration = 0;
    this.venomDamagePerSecond = 0;
    this.lastVenomDamageTime = 0;
  }
  
  public updateVenomStatus(currentTime: number): { shouldDealDamage: boolean; damage: number } {
    if (!this.isVenomous) return { shouldDealDamage: false, damage: 0 };
    
    const elapsed = currentTime - this.venomStartTime;
    if (elapsed >= this.venomDuration) {
      this.removeVenom();
      return { shouldDealDamage: false, damage: 0 };
    }
    
    // Check if we should deal damage (every second)
    const timeSinceLastDamage = currentTime - this.lastVenomDamageTime;
    if (timeSinceLastDamage >= 1.0) {
      this.lastVenomDamageTime = currentTime;
      return { shouldDealDamage: true, damage: this.venomDamagePerSecond };
    }
    
    return { shouldDealDamage: false, damage: 0 };
  }

  public applyConcentratedVenomStack(currentTime: number): void {
    if (this.isDead) return;
    this.concentratedVenomStacks = Math.min(
      WYVERN_BITE_CONCENTRATED_VENOM_MAX_STACKS,
      this.concentratedVenomStacks + 1,
    );
    this.concentratedVenomEndTime = currentTime + WYVERN_BITE_CONCENTRATED_VENOM_DURATION_SEC;
    this.lastConcentratedVenomTickTime = currentTime;
  }

  public removeConcentratedVenom(): void {
    this.concentratedVenomStacks = 0;
    this.concentratedVenomEndTime = 0;
    this.lastConcentratedVenomTickTime = 0;
  }

  public updateConcentratedVenomStatus(currentTime: number): { shouldDealDamage: boolean; damage: number } {
    if (this.concentratedVenomStacks <= 0) return { shouldDealDamage: false, damage: 0 };
    if (currentTime >= this.concentratedVenomEndTime) {
      this.removeConcentratedVenom();
      return { shouldDealDamage: false, damage: 0 };
    }
    const timeSinceLast = currentTime - this.lastConcentratedVenomTickTime;
    if (timeSinceLast >= 1.0) {
      this.lastConcentratedVenomTickTime = currentTime;
      return {
        shouldDealDamage: true,
        damage: this.concentratedVenomStacks * WYVERN_BITE_CONCENTRATED_VENOM_DPS_PER_STACK,
      };
    }
    return { shouldDealDamage: false, damage: 0 };
  }

  /** Remaining Cobra venom damage if applied as one instant hit (duration remaining × DPS). */
  public getRemainingCobraVenomDamageInstant(currentTime: number): number {
    if (!this.isVenomous) return 0;
    const end = this.venomStartTime + this.venomDuration;
    if (currentTime >= end) return 0;
    const remainingSec = end - currentTime;
    return Math.max(0, Math.floor(remainingSec * this.venomDamagePerSecond));
  }

  /** Remaining Wyvern Bite Concentrated Venom as one instant hit. */
  public getRemainingConcentratedVenomDamageInstant(currentTime: number): number {
    if (this.concentratedVenomStacks <= 0) return 0;
    if (currentTime >= this.concentratedVenomEndTime) return 0;
    const remainingSec = this.concentratedVenomEndTime - currentTime;
    const dps = this.concentratedVenomStacks * WYVERN_BITE_CONCENTRATED_VENOM_DPS_PER_STACK;
    return Math.max(0, Math.floor(remainingSec * dps));
  }
  
  public applySunderStack(currentTime: number): void {
    if (this.isDead) return; // Can't apply sunder to dead enemies
    
    // Check if existing stacks have expired
    if (this.sunderStacks > 0 && (currentTime - this.sunderLastApplied) > this.sunderDuration) {
      this.sunderStacks = 0;
    }
    
    // Add new stack (max 3)
    if (this.sunderStacks < 3) {
      this.sunderStacks++;
    }
    
    // Update timing
    this.sunderLastApplied = currentTime;
  }
  
  public getSunderStacks(): number {
    return this.sunderStacks;
  }
  
  public clearSunderStacks(): void {
    this.sunderStacks = 0;
    this.sunderLastApplied = 0;
  }
  
  public updateSunderStatus(currentTime: number): void {
    if (this.sunderStacks <= 0) return;
    
    const elapsed = currentTime - this.sunderLastApplied;
    if (elapsed >= this.sunderDuration) {
      this.clearSunderStacks();
    }
  }

  public setLevel(newLevel: number): void {
    this.level = Math.max(1, newLevel);
    this.experienceReward = this.calculateExperienceReward();
    this.attackDamage = this.calculateAttackDamage();
  }

  public getDisplayName(): string {
    const typeNames = {
      [EnemyType.DUMMY]: 'Training Dummy',
      [EnemyType.GRUNT]: 'Grunt',
      [EnemyType.ELITE]: 'Elite',
      [EnemyType.BOSS]: 'Boss'
    };
    return `${typeNames[this.type]} (Lv.${this.level})`;
  }

  public reset(): void {
    this.type = EnemyType.DUMMY;
    this.level = 1;
    this.experienceReward = this.calculateExperienceReward();
    this.isAggressive = false;
    this.aggroRange = this.calculateAggroRange();
    this.attackRange = this.calculateAttackRange();
    this.attackDamage = this.calculateAttackDamage();
    this.attackCooldown = this.calculateAttackCooldown();
    this.lastAttackTime = 0;
    this.movementSpeed = this.calculateMovementSpeed();
    this.isDead = false;
    this.deathTime = 0;
    this.respawnTime = 30;
    this.canRespawn = true;
    this.enabled = true;
    
    // Reset freeze status
    this.isFrozen = false;
    this.freezeStartTime = 0;
    this.freezeDuration = 0;
    this.originalMovementSpeed = this.movementSpeed;

    // Reset stun status
    this.isStunned = false;
    this.stunStartTime = 0;
    this.stunDuration = 0;
    
    // Reset venom status
    this.isVenomous = false;
    this.venomStartTime = 0;
    this.venomDuration = 0;
    this.venomDamagePerSecond = 0;
    this.lastVenomDamageTime = 0;

    this.concentratedVenomStacks = 0;
    this.concentratedVenomEndTime = 0;
    this.lastConcentratedVenomTickTime = 0;
    
    // Reset sunder stacks
    this.sunderStacks = 0;
    this.sunderLastApplied = 0;

    this.chillStacks = 0;
    this.chillExpiresAtSec = 0;
  }

  public clone(): Enemy {
    const clone = new Enemy(this.type, this.level);
    clone.experienceReward = this.experienceReward;
    clone.isAggressive = this.isAggressive;
    clone.aggroRange = this.aggroRange;
    clone.attackRange = this.attackRange;
    clone.attackDamage = this.attackDamage;
    clone.attackCooldown = this.attackCooldown;
    clone.lastAttackTime = this.lastAttackTime;
    clone.movementSpeed = this.movementSpeed;
    clone.isDead = this.isDead;
    clone.deathTime = this.deathTime;
    clone.respawnTime = this.respawnTime;
    clone.canRespawn = this.canRespawn;
    
    // Clone freeze status
    clone.isFrozen = this.isFrozen;
    clone.freezeStartTime = this.freezeStartTime;
    clone.freezeDuration = this.freezeDuration;
    clone.originalMovementSpeed = this.originalMovementSpeed;

    // Clone stun status
    clone.isStunned = this.isStunned;
    clone.stunStartTime = this.stunStartTime;
    clone.stunDuration = this.stunDuration;
    
    // Clone venom status
    clone.isVenomous = this.isVenomous;
    clone.venomStartTime = this.venomStartTime;
    clone.venomDuration = this.venomDuration;
    clone.venomDamagePerSecond = this.venomDamagePerSecond;
    clone.lastVenomDamageTime = this.lastVenomDamageTime;

    clone.concentratedVenomStacks = this.concentratedVenomStacks;
    clone.concentratedVenomEndTime = this.concentratedVenomEndTime;
    clone.lastConcentratedVenomTickTime = this.lastConcentratedVenomTickTime;
    
    // Clone sunder stacks
    clone.sunderStacks = this.sunderStacks;
    clone.sunderLastApplied = this.sunderLastApplied;
    
    // Clone corrupted status
    clone.isCorrupted = this.isCorrupted;
    clone.corruptedStartTime = this.corruptedStartTime;
    clone.corruptedDuration = this.corruptedDuration;
    clone.corruptedInitialSlowPercent = this.corruptedInitialSlowPercent;
    clone.corruptedRecoveryRate = this.corruptedRecoveryRate;

    clone.chillStacks = this.chillStacks;
    clone.chillExpiresAtSec = this.chillExpiresAtSec;
    
    return clone;
  }
  
  public applyCorrupted(duration: number, currentTime: number): void {
    if (this.isDead) return; // Can't apply corrupted to dead enemies
    if (this.type === EnemyType.BOSS) return;

    this.isCorrupted = true;
    this.corruptedStartTime = currentTime;
    this.corruptedDuration = duration;
  }
  
  public removeCorrupted(): void {
    this.isCorrupted = false;
    this.corruptedStartTime = 0;
    this.corruptedDuration = 0;
  }
  
  public updateCorruptedStatus(currentTime: number): void {
    if (!this.isCorrupted) return;
    
    const elapsed = currentTime - this.corruptedStartTime;
    if (elapsed >= this.corruptedDuration) {
      this.removeCorrupted();
    }
  }
  
  public getCorruptedTimeRemaining(currentTime: number): number {
    if (!this.isCorrupted) return 0;
    
    const elapsed = currentTime - this.corruptedStartTime;
    return Math.max(0, this.corruptedDuration - elapsed);
  }
}
