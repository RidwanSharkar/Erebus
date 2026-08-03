// Movement component for velocity and movement properties
import { Vector3 } from '@/utils/three-exports';
import { Component } from '../Entity';
import { getWarpdriveDashDistance } from '@/utils/merchantShopUtils';
import type { WeaponAspect } from '@/utils/weaponAspects';

/** Per-charge dash recharge delay (matches existing setTimeout behavior). */
const DASH_CHARGE_RECHARGE_MS = 8000;

type DashChargeSlot = {
  isAvailable: boolean;
  cooldownStartTime: number | null;
  cooldownTimerId: ReturnType<typeof setTimeout> | null;
};

function createEmptyDashCharge(): DashChargeSlot {
  return { isAvailable: true, cooldownStartTime: null, cooldownTimerId: null };
}

export class Movement extends Component {
  public static readonly componentType = 'Movement'; // Explicit type identifier
  public readonly componentType = 'Movement'; // Instance identifier
  public velocity: Vector3;
  public acceleration: Vector3;
  public maxSpeed: number;
  public friction: number;
  public isGrounded: boolean;
  public jumpForce: number;
  public gravity: number;

  // Movement flags
  public canMove: boolean;
  public canJump: boolean;
  public canFly: boolean;

  // Debuff states for PVP
  public isFrozen: boolean;
  public frozenUntil: number;
  public isEntangled: boolean;
  public entangledUntil: number;
  public isSlowed: boolean;
  public slowedUntil: number;
  public movementSpeedMultiplier: number;
  /** Persistence Hunter pet upgrade — walk/run bonus while near Fae wolf. */
  public persistenceHunterActive: boolean;
  
  // Corrupted debuff state (WraithStrike)
  public isCorrupted: boolean;
  public corruptedStartTime: number;
  public corruptedDuration: number;
  public corruptedInitialSlowPercent: number; // Initial slow percentage (90%)
  public corruptedRecoveryRate: number; // Recovery rate per second (10%)

  // Ice Beam debuff state (Scythe Ice Beam)
  public isIcebeaming: boolean;

  /** Alchemist Prime Materia — toggle Shift aura (synced for remote VFX). */
  public isPrimeMateriaActive: boolean;

  /** Sorceress Incineration — hold Shift charge channel (synced for remote VFX). */
  public isIncinerationCharging: boolean;

  /** Sorceress Incineration — shift released, charge armed for LMB detonate (synced for remote VFX). */
  public isIncinerationArmed: boolean;

  /** Acolyte Locusts — hold Shift volley channel (synced for remote VFX). */
  public isLocustChanneling: boolean;

  // Attack-cast movement slow (Sword ColossusStrike, Bow/Scythe/Runeblade/Spear primary, abilities, Spear charges)
  public isAttackSlowed: boolean;
  /** Multiplier applied while isAttackSlowed (default 0.5 = 50% slow; Hexmetal Leggings = 0.75). */
  public attackSlowMultiplier: number;
  /** Hexmetal 2pc — raise walk speed to 4.125 while not sprinting. */
  public hexmetalWalkSpeedActive: boolean;

  // Hold-Shift sprint (any locomotion except backward)
  public isSprinting: boolean;

  // Input-based movement
  public moveDirection: Vector3;
  public inputStrength: number;

  // Dash/Vault system
  public isDashing: boolean;
  public dashDirection: Vector3;
  public dashStartTime: number;
  public dashDuration: number;
  public dashDistance: number;
  public dashStartPosition: Vector3;
  public warpdrivePurchases: number;
  /** Throne weapon aspect — affects Warlord dash distance. */
  public weaponAspect: WeaponAspect | null;
  
  // Multiple dash charges system
  public dashCharges: Array<DashChargeSlot>;
  public maxDashCharges: number;
  /** Flat recovery rate multiplier (1 = base 8s; 1.25 = Overclock). */
  public dashChargeRechargeRateMultiplier: number;

  // Sword Charge ability system (separate from dashes)
  public isCharging: boolean;
  public chargeDirection: Vector3;
  public chargeStartTime: number;
  public chargeDuration: number;
  public chargeDistance: number;
  public chargeStartPosition: Vector3;

  // Knockback system
  public isKnockbacked: boolean;
  public knockbackDirection: Vector3;
  public knockbackStartTime: number;
  public knockbackDuration: number;
  public knockbackDistance: number;
  public knockbackStartPosition: Vector3;

  /** Timestamp (seconds) until which movement input should not override a forced halt (Shift-Deflect). */
  public movementLockUntil: number;

  /** Forced portal-fall jump animation (co-op room transitions). */
  public isPortalFalling: boolean;
  public portalFallPhase: 'rise' | 'fall';
  public portalFallProgress: number;

  constructor(
    maxSpeed: number = 3.575,
    friction: number = 0.8,
    jumpForce: number = 35.0,
    gravity: number = -12.0 //REAL
  ) {
    super();
    
    this.velocity = new Vector3(0, 0, 0);
    this.acceleration = new Vector3(0, 0, 0);
    this.maxSpeed = maxSpeed;
    this.friction = friction;
    this.isGrounded = false;
    this.jumpForce = jumpForce;
    this.gravity = gravity;
    
    this.canMove = true;
    this.canJump = true;
    this.canFly = false;

    // Initialize debuff states
    this.isFrozen = false;
    this.frozenUntil = 0;
    this.isEntangled = false;
    this.entangledUntil = 0;
    this.isSlowed = false;
    this.slowedUntil = 0;
    this.movementSpeedMultiplier = 1.0;
    this.persistenceHunterActive = false;
    
    // Initialize corrupted debuff states
    this.isCorrupted = false;
    this.corruptedStartTime = 0;
    this.corruptedDuration = 0;
    this.corruptedInitialSlowPercent = 0.8; // 90% initial slow
    this.corruptedRecoveryRate = 0.2; // 10% recovery per second

    // Initialize Ice Beam debuff state
    this.isIcebeaming = false;

    // Alchemist Prime Materia channel
    this.isPrimeMateriaActive = false;

    // Sorceress Incineration charge channel
    this.isIncinerationCharging = false;
    this.isIncinerationArmed = false;

    // Acolyte Locust channel
    this.isLocustChanneling = false;

    // Initialize attack-cast slow state
    this.isAttackSlowed = false;
    this.attackSlowMultiplier = 0.5;
    this.hexmetalWalkSpeedActive = false;

    // Initialize sprint state
    this.isSprinting = false;
    
    this.moveDirection = new Vector3(0, 0, 0);
    this.inputStrength = 0;

    // Initialize dash properties
    this.isDashing = false;
    this.dashDirection = new Vector3(0, 0, 0);
    this.dashStartTime = 0;
    this.dashDuration = 0.35; // 350ms dash duration (same as old implementation)
    this.dashDistance = 4.125; // Increased from 3.125 for more noticeable dash
    this.dashStartPosition = new Vector3(0, 0, 0);
    this.warpdrivePurchases = 0;
    this.weaponAspect = null;
    
    // Initialize multiple dash charges (3 charges, each with 8s cooldown)
    this.maxDashCharges = 3;
    this.dashCharges = Array.from({ length: this.maxDashCharges }, () => createEmptyDashCharge());
    this.dashChargeRechargeRateMultiplier = 1;

    // Initialize sword charge properties
    this.isCharging = false;
    this.chargeDirection = new Vector3(0, 0, 0);
    this.chargeStartTime = 0;
    this.chargeDuration = 0.35; // 350ms charge duration
    this.chargeDistance = 9; // Sword charge distance
    this.chargeStartPosition = new Vector3(0, 0, 0);

    // Initialize knockback properties
    this.isKnockbacked = false;
    this.knockbackDirection = new Vector3(0, 0, 0);
    this.knockbackStartTime = 0;
    this.knockbackDuration = 0.5; // 500ms knockback duration
    this.knockbackDistance = 10; // 10 unit knockback distance
    this.knockbackStartPosition = new Vector3(0, 0, 0);

    this.movementLockUntil = 0;

    this.isPortalFalling = false;
    this.portalFallPhase = 'rise';
    this.portalFallProgress = 0;
  }

  public addForce(force: Vector3): void {
    this.acceleration.add(force);
  }

  public addImpulse(impulse: Vector3): void {
    this.velocity.add(impulse);
  }

  public jump(): void {
    if (this.canJump && (this.isGrounded || this.canFly)) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
    }
  }

  public setMoveDirection(direction: Vector3, strength: number = 1.0): void {
    this.moveDirection.copy(direction).normalize();
    this.inputStrength = Math.max(0, Math.min(1, strength));
  }

  public freeze(duration: number): void {
    const currentTime = Date.now();
    this.isFrozen = true;
    this.frozenUntil = currentTime + duration;
    // console.log(`🧊 Player frozen for ${duration}ms until ${this.frozenUntil} (current: ${currentTime})`);
  }

  public entangle(duration: number): void {
    const currentTime = Date.now();
    this.isEntangled = true;
    this.entangledUntil = currentTime + duration;
  }

  public slow(duration: number, speedMultiplier: number = 0.5): void {
    const currentTime = Date.now();
    this.isSlowed = true;
    this.slowedUntil = currentTime + duration;
    this.movementSpeedMultiplier = speedMultiplier;
    // console.log(`🐌 Player slowed to ${speedMultiplier * 100}% speed for ${duration}ms until ${this.slowedUntil}`);
  }

  public applyCorrupted(duration: number): void {
    this.isCorrupted = true;
    this.corruptedStartTime = Date.now() / 1000; // Store in seconds for easier calculations
    this.corruptedDuration = duration / 1000; // Convert to seconds
    this.corruptedInitialSlowPercent = 0.9; // 90% initial slow
    this.corruptedRecoveryRate = 0.1; // 10% recovery per second
  }

  public updateDebuffs(): void {
    const currentTime = Date.now();
    
    // Check frozen state
    if (this.isFrozen && currentTime >= this.frozenUntil) {
      this.isFrozen = false;
      this.frozenUntil = 0;
    }

    if (this.isEntangled && currentTime >= this.entangledUntil) {
      this.isEntangled = false;
      this.entangledUntil = 0;
    }
    
    // Check slowed state
    if (this.isSlowed && currentTime >= this.slowedUntil) {
      this.isSlowed = false;
      this.slowedUntil = 0;
      this.movementSpeedMultiplier = 1.0;
    }
    
    // Check corrupted state
    const currentTimeSeconds = currentTime / 1000;
    if (this.isCorrupted) {
      const elapsed = currentTimeSeconds - this.corruptedStartTime;
      if (elapsed >= this.corruptedDuration) {
        // Corrupted debuff has expired
        this.isCorrupted = false;
        this.corruptedStartTime = 0;
        this.corruptedDuration = 0;
      }
    }
  }

  public getEffectiveMaxSpeed(): number {
    if (this.isFrozen || this.isEntangled) {
      return 0; // Completely frozen or rooted
    }

    // Persistence Hunter: raise walk/run to 4.0, but keep sprint absolute speed unchanged
    // (sprint = base 3.575 × sprint multiplier).
    const BASE_WALK = 3.575;
    const PERSISTENCE_WALK = 4.0;
    const HEXMETAL_WALK = 4.125;
    let baseSpeed = this.maxSpeed;
    if (this.persistenceHunterActive && !this.isSprinting) {
      baseSpeed = PERSISTENCE_WALK;
    } else if (this.isSprinting && this.persistenceHunterActive) {
      // Ensure sprint uses the original base, not an inflated maxSpeed.
      baseSpeed = BASE_WALK;
    }
    // Hexmetal 2pc: walk 4.125 (does not stack with sprint). Math.max so it never
    // downgrades Sabres Lethality (4.25) or Persistence Hunter (4.0).
    if (this.hexmetalWalkSpeedActive && !this.isSprinting) {
      baseSpeed = Math.max(baseSpeed, HEXMETAL_WALK);
    }
    let speed = baseSpeed * this.movementSpeedMultiplier;



    // Apply corrupted debuff slow effect with gradual recovery
    if (this.isCorrupted) {
      const currentTimeSeconds = Date.now() / 1000;
      const elapsed = currentTimeSeconds - this.corruptedStartTime;

      // Calculate current slow percentage based on gradual recovery
      // Initial: 90% slow, recovers 10% per second
      const currentSlowPercent = Math.max(0, this.corruptedInitialSlowPercent - (elapsed * this.corruptedRecoveryRate));

      // Apply the slow effect (reduce speed by the slow percentage)
      speed *= (1 - currentSlowPercent);

    }

    // Apply Ice Beam movement speed reduction (50% slower)
    if (this.isIcebeaming) {
      speed *= 0.2;
    }

    // Apply attack-cast movement slow (default 50%; Hexmetal Leggings halves the penalty)
    if (this.isAttackSlowed) {
      speed *= this.attackSlowMultiplier;
    }

    // Apply sprint speed boost (50% faster while holding Shift, except backward locomotion)
    if (this.isSprinting) {
      speed *= 1.97;
    }

    return speed;
  }

  private getDashChargeRechargeMs(): number {
    return DASH_CHARGE_RECHARGE_MS / Math.max(0.1, this.dashChargeRechargeRateMultiplier);
  }

  public getDashChargeRechargeSec(): number {
    return this.getDashChargeRechargeMs() / 1000;
  }

  public setDashChargeRechargeRateMultiplier(multiplier: number): void {
    const next = Math.max(0.1, multiplier);
    if (next === this.dashChargeRechargeRateMultiplier) return;

    const prev = this.dashChargeRechargeRateMultiplier;
    this.dashChargeRechargeRateMultiplier = next;

    const nowSec = Date.now() / 1000;
    for (let i = 0; i < this.dashCharges.length; i++) {
      const charge = this.dashCharges[i];
      if (charge.isAvailable || charge.cooldownStartTime === null) continue;

      const prevTotalSec = DASH_CHARGE_RECHARGE_MS / prev / 1000;
      const remainingSec = Math.max(0, prevTotalSec - (nowSec - charge.cooldownStartTime));
      const scaledRemainingSec = remainingSec * (prev / next);
      const newTotalSec = this.getDashChargeRechargeSec();

      this.clearDashChargeCooldown(i);
      charge.isAvailable = false;
      charge.cooldownStartTime = nowSec - (newTotalSec - scaledRemainingSec);
      charge.cooldownTimerId = setTimeout(() => {
        charge.isAvailable = true;
        charge.cooldownStartTime = null;
        charge.cooldownTimerId = null;
      }, scaledRemainingSec * 1000);
    }
  }

  private clearDashChargeCooldown(chargeIndex: number): void {
    const charge = this.dashCharges[chargeIndex];
    if (!charge) return;
    if (charge.cooldownTimerId !== null) {
      clearTimeout(charge.cooldownTimerId);
      charge.cooldownTimerId = null;
    }
  }

  private beginDashChargeCooldown(chargeIndex: number, currentTime: number): void {
    const charge = this.dashCharges[chargeIndex];
    if (!charge) return;

    this.clearDashChargeCooldown(chargeIndex);
    charge.isAvailable = false;
    charge.cooldownStartTime = currentTime;
    charge.cooldownTimerId = setTimeout(() => {
      charge.isAvailable = true;
      charge.cooldownStartTime = null;
      charge.cooldownTimerId = null;
    }, this.getDashChargeRechargeMs());
  }

  public startDash(direction: Vector3, currentPosition: Vector3, currentTime: number): boolean {
    // Check if already dashing
    if (this.isDashing) {
      return false;
    }

    // Find first available charge
    const availableChargeIndex = this.dashCharges.findIndex(charge => charge.isAvailable);
    if (availableChargeIndex === -1) {
      return false; // No charges available
    }

    // Start the dash
    this.isDashing = true;
    this.dashDirection.copy(direction).normalize();
    this.dashStartTime = currentTime;
    this.dashStartPosition.copy(currentPosition);

    this.beginDashChargeCooldown(availableChargeIndex, currentTime);

    return true;
  }

  /** Blood Orbs — dash without consuming a charge when all charges are on cooldown. */
  public startDashWithoutCharge(direction: Vector3, currentPosition: Vector3, currentTime: number): boolean {
    if (this.isDashing) {
      return false;
    }
    if (this.getAvailableDashCharges() > 0) {
      return false;
    }

    this.isDashing = true;
    this.dashDirection.copy(direction).normalize();
    this.dashStartTime = currentTime;
    this.dashStartPosition.copy(currentPosition);

    return true;
  }

  public setMaxDashCharges(count: number): void {
    const target = Math.max(1, Math.floor(count));
    while (this.dashCharges.length < target) {
      this.dashCharges.push(createEmptyDashCharge());
    }
    if (this.dashCharges.length > target) {
      for (let i = target; i < this.dashCharges.length; i++) {
        this.clearDashChargeCooldown(i);
      }
      this.dashCharges.length = target;
    }
    this.maxDashCharges = target;
  }

  public setWarpdrivePurchases(count: number, aspect?: WeaponAspect | null): void {
    this.warpdrivePurchases = Math.max(0, Math.min(3, Math.floor(count)));
    if (aspect !== undefined) {
      this.weaponAspect = aspect ?? null;
    }
    this.dashDistance = getWarpdriveDashDistance(this.warpdrivePurchases, this.weaponAspect);
  }

  public setWeaponAspect(aspect: WeaponAspect | null | undefined): void {
    this.weaponAspect = aspect ?? null;
    this.dashDistance = getWarpdriveDashDistance(this.warpdrivePurchases, this.weaponAspect);
  }

  /**
   * Consume up to `maxCount` dash charges without moving (e.g. TRINITY + Colossus Smite).
   * Uses the same per-charge cooldown as `startDash`. Returns how many charges were consumed.
   */
  public consumeDashChargesWithoutDash(maxCount: number, currentTime: number): number {
    let consumed = 0;
    for (let n = 0; n < maxCount; n++) {
      const availableChargeIndex = this.dashCharges.findIndex(charge => charge.isAvailable);
      if (availableChargeIndex === -1) break;

      this.beginDashChargeCooldown(availableChargeIndex, currentTime);
      consumed++;
    }
    return consumed;
  }

  /**
   * Restore one dash charge (e.g. Momentum Rift). Prefers the slot with the longest remaining cooldown.
   * Returns true if a charge was restored, false if all charges were already available.
   */
  public restoreDashCharge(): boolean {
    const nowSec = Date.now() / 1000;
    let bestIndex = -1;
    let bestRemaining = -1;

    for (let i = 0; i < this.dashCharges.length; i++) {
      const charge = this.dashCharges[i];
      if (charge.isAvailable || charge.cooldownStartTime === null) continue;

      const remaining = this.getDashChargeRechargeSec() - (nowSec - charge.cooldownStartTime);
      if (remaining > bestRemaining) {
        bestRemaining = remaining;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) return false;

    const charge = this.dashCharges[bestIndex];
    this.clearDashChargeCooldown(bestIndex);
    charge.isAvailable = true;
    charge.cooldownStartTime = null;
    return true;
  }

  public updateDash(currentTime: number): { isComplete: boolean; newPosition: Vector3 | null } {
    if (!this.isDashing) {
      return { isComplete: false, newPosition: null };
    }

    const elapsed = currentTime - this.dashStartTime;
    const progress = Math.min(elapsed / this.dashDuration, 1);

    if (progress >= 1) {
      // Dash complete
      this.isDashing = false;
      const finalPosition = this.dashStartPosition.clone()
        .add(this.dashDirection.clone().multiplyScalar(this.dashDistance));
      return { isComplete: true, newPosition: finalPosition };
    }

    // Calculate current position using easing (ease-out quad, same as old implementation)
    const easeOutQuad = 1 - Math.pow(1 - progress, 2);
    const displacement = this.dashDirection.clone().multiplyScalar(this.dashDistance * easeOutQuad);
    const newPosition = this.dashStartPosition.clone().add(displacement);

    return { isComplete: false, newPosition };
  }

  public cancelDash(): void {
    this.isDashing = false;
    this.dashDirection.set(0, 0, 0);
    this.dashStartTime = 0;
  }

  public stop(): void {
    this.velocity.set(0, 0, 0);
    this.acceleration.set(0, 0, 0);
    this.moveDirection.set(0, 0, 0);
    this.inputStrength = 0;
  }

  /** Stop all locomotion immediately (death, stun, etc.). */
  public haltLocomotion(): void {
    this.stop();
    this.isSprinting = false;
    this.cancelDash();
    this.cancelCharge();
    this.cancelKnockback();
  }

  public getSpeed(): number {
    return this.velocity.length();
  }

  public getHorizontalSpeed(): number {
    return Math.sqrt(this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z);
  }

  public isMoving(): boolean {
    return this.getSpeed() > 0.01;
  }

  public isMovingHorizontally(): boolean {
    return this.getHorizontalSpeed() > 0.01;
  }

  public isFalling(): boolean {
    return this.velocity.y < -0.1;
  }

  public isRising(): boolean {
    return this.velocity.y > 0.1;
  }

  public getAvailableDashCharges(): number {
    return this.dashCharges.filter(charge => charge.isAvailable).length;
  }

  public getDashChargeStatus(): Array<{ isAvailable: boolean; cooldownRemaining: number }> {
    const currentTime = Date.now() / 1000;
    return this.dashCharges.map(charge => ({
      isAvailable: charge.isAvailable,
      cooldownRemaining: charge.cooldownStartTime 
        ? Math.max(0, this.getDashChargeRechargeSec() - (currentTime - charge.cooldownStartTime))
        : 0
    }));
  }

  public startCharge(direction: Vector3, currentPosition: Vector3, currentTime: number): boolean {
    // Check if already charging or dashing
    if (this.isCharging || this.isDashing) {
      return false;
    }

    // Start the charge
    this.isCharging = true;
    this.chargeDirection.copy(direction).normalize();
    this.chargeStartTime = currentTime;
    this.chargeStartPosition.copy(currentPosition);

    return true;
  }

  public updateCharge(currentTime: number): { isComplete: boolean; newPosition: Vector3 | null } {
    if (!this.isCharging) {
      return { isComplete: false, newPosition: null };
    }

    const elapsed = currentTime - this.chargeStartTime;
    const progress = Math.min(elapsed / this.chargeDuration, 1);

    if (progress >= 1) {
      // Charge complete
      this.isCharging = false;
      const finalPosition = this.chargeStartPosition.clone()
        .add(this.chargeDirection.clone().multiplyScalar(this.chargeDistance));
      return { isComplete: true, newPosition: finalPosition };
    }

    // Calculate current position using easing (ease-out quad)
    const easeOutQuad = 1 - Math.pow(1 - progress, 2);
    const displacement = this.chargeDirection.clone().multiplyScalar(this.chargeDistance * easeOutQuad);
    const newPosition = this.chargeStartPosition.clone().add(displacement);

    return { isComplete: false, newPosition };
  }

  public cancelCharge(): void {
    this.isCharging = false;
    this.chargeDirection.set(0, 0, 0);
    this.chargeStartTime = 0;
  }

  public applyKnockback(direction: Vector3, distance: number, currentPosition: Vector3, currentTime: number, duration: number = 0.5): void {
    // Check if already being knockbacked
    if (this.isKnockbacked) {
      // console.log(`⚠️ Knockback already active (${(currentTime - this.knockbackStartTime).toFixed(2)}s elapsed), ignoring new knockback`);
      return;
    }

    // Start the knockback
    this.isKnockbacked = true;
    this.knockbackDirection.copy(direction).normalize();
    this.knockbackStartTime = currentTime;
    this.knockbackDuration = duration;
    this.knockbackDistance = distance;
    this.knockbackStartPosition.copy(currentPosition);

  }

  public updateKnockback(currentTime: number): { isComplete: boolean; newPosition: Vector3 | null } {
    if (!this.isKnockbacked) {
      return { isComplete: false, newPosition: null };
    }

    const elapsed = currentTime - this.knockbackStartTime;
    const progress = Math.min(elapsed / this.knockbackDuration, 1);

    if (progress >= 1) {
      // Knockback complete
      const finalPosition = this.knockbackStartPosition.clone()
        .add(this.knockbackDirection.clone().multiplyScalar(this.knockbackDistance));
      this.isKnockbacked = false;
      return { isComplete: true, newPosition: finalPosition };
    }

    // Calculate current position using easing (ease-out quad)
    const easeOutQuad = 1 - Math.pow(1 - progress, 2);
    const displacement = this.knockbackDirection.clone().multiplyScalar(this.knockbackDistance * easeOutQuad);
    const newPosition = this.knockbackStartPosition.clone().add(displacement);


    return { isComplete: false, newPosition };
  }

  public cancelKnockback(): void {
    this.isKnockbacked = false;
    this.knockbackDirection.set(0, 0, 0);
    this.knockbackStartTime = 0;
  }

  public clampVelocity(): void {
    // Get effective max speed (considering debuffs)
    const effectiveMaxSpeed = this.getEffectiveMaxSpeed();
    
    // Clamp horizontal velocity to effective max speed
    const horizontalVelocity = new Vector3(this.velocity.x, 0, this.velocity.z);
    const horizontalSpeed = horizontalVelocity.length();
    
    if (horizontalSpeed > effectiveMaxSpeed) {
      if (effectiveMaxSpeed === 0) {
        // Completely frozen - stop all horizontal movement
        this.velocity.x = 0;
        this.velocity.z = 0;
      } else {
        horizontalVelocity.normalize().multiplyScalar(effectiveMaxSpeed);
        this.velocity.x = horizontalVelocity.x;
        this.velocity.z = horizontalVelocity.z;
      }
    }
  }

  public applyFriction(deltaTime: number): void {
    if (!this.canMove) return;

    // Apply friction to horizontal movement
    const frictionForce = Math.pow(this.friction, deltaTime);
    this.velocity.x *= frictionForce;
    this.velocity.z *= frictionForce;

    // Stop very small velocities to prevent jitter
    if (Math.abs(this.velocity.x) < 0.01) this.velocity.x = 0;
    if (Math.abs(this.velocity.z) < 0.01) this.velocity.z = 0;
  }

  public applyGravity(deltaTime: number): void {
    if (!this.canFly) {
      this.velocity.y += this.gravity * deltaTime;
    }
  }

  public reset(): void {
    // Ensure Vector3 objects are properly initialized
    if (!this.velocity) {
      this.velocity = new Vector3(0, 0, 0);
    } else {
      this.velocity.set(0, 0, 0);
    }
    
    if (!this.acceleration) {
      this.acceleration = new Vector3(0, 0, 0);
    } else {
      this.acceleration.set(0, 0, 0);
    }
    
    if (!this.moveDirection) {
      this.moveDirection = new Vector3(0, 0, 0);
    } else {
      this.moveDirection.set(0, 0, 0);
    }
    
    this.inputStrength = 0;
    this.isGrounded = false;
    this.canMove = true;
    this.canJump = true;
    this.canFly = false;
    this.maxSpeed = 3.575;
    this.friction = 0.8;
    this.jumpForce = 25.0;
    this.gravity = -12.5;
    this.enabled = true;

    // Reset debuff states
    this.isFrozen = false;
    this.frozenUntil = 0;
    this.isEntangled = false;
    this.entangledUntil = 0;
    this.isSlowed = false;
    this.slowedUntil = 0;
    this.movementSpeedMultiplier = 1.0;
    this.persistenceHunterActive = false;
    this.isIcebeaming = false;
    this.isPrimeMateriaActive = false;
    this.isIncinerationCharging = false;
    this.isIncinerationArmed = false;
    this.isLocustChanneling = false;
    this.isAttackSlowed = false;
    // Keep attackSlowMultiplier / hexmetalWalkSpeedActive — item ownership, not combat state.
    this.isSprinting = false;

    // Reset dash properties
    this.isDashing = false;
    this.dashDirection.set(0, 0, 0);
    this.dashStartTime = 0;
    this.dashDuration = 0.35;
    this.dashDistance = getWarpdriveDashDistance(this.warpdrivePurchases, this.weaponAspect);
    this.dashStartPosition.set(0, 0, 0);
    
    // Reset dash charges
    for (let i = 0; i < this.dashCharges.length; i++) {
      this.clearDashChargeCooldown(i);
    }
    this.maxDashCharges = 3;
    this.dashCharges = Array.from({ length: this.maxDashCharges }, () => createEmptyDashCharge());
    this.dashChargeRechargeRateMultiplier = 1;

    // Reset charge properties
    this.isCharging = false;
    this.chargeDirection.set(0, 0, 0);
    this.chargeStartTime = 0;
    this.chargeDuration = 0.35;
    this.chargeDistance = 9;
    this.chargeStartPosition.set(0, 0, 0);

    // Reset knockback properties
    this.isKnockbacked = false;
    this.knockbackDirection.set(0, 0, 0);
    this.knockbackStartTime = 0;
    this.knockbackDuration = 0.5;
    this.knockbackDistance = 10;
    this.knockbackStartPosition.set(0, 0, 0);

    this.movementLockUntil = 0;

    this.isPortalFalling = false;
    this.portalFallPhase = 'rise';
    this.portalFallProgress = 0;
  }

  public clone(): Movement {
    const clone = new Movement(this.maxSpeed, this.friction, this.jumpForce, this.gravity);
    clone.velocity.copy(this.velocity);
    clone.acceleration.copy(this.acceleration);
    clone.moveDirection.copy(this.moveDirection);
    clone.inputStrength = this.inputStrength;
    clone.isGrounded = this.isGrounded;
    clone.canMove = this.canMove;
    clone.canJump = this.canJump;
    clone.canFly = this.canFly;

    // Clone debuff states
    clone.isFrozen = this.isFrozen;
    clone.frozenUntil = this.frozenUntil;
    clone.isEntangled = this.isEntangled;
    clone.entangledUntil = this.entangledUntil;
    clone.isSlowed = this.isSlowed;
    clone.slowedUntil = this.slowedUntil;
    clone.movementSpeedMultiplier = this.movementSpeedMultiplier;
    clone.persistenceHunterActive = this.persistenceHunterActive;
    clone.isIcebeaming = this.isIcebeaming;
    clone.isPrimeMateriaActive = this.isPrimeMateriaActive;
    clone.isIncinerationCharging = this.isIncinerationCharging;
    clone.isIncinerationArmed = this.isIncinerationArmed;
    clone.isLocustChanneling = this.isLocustChanneling;
    clone.isAttackSlowed = this.isAttackSlowed;
    clone.attackSlowMultiplier = this.attackSlowMultiplier;
    clone.hexmetalWalkSpeedActive = this.hexmetalWalkSpeedActive;
    clone.isSprinting = this.isSprinting;

    // Clone dash properties
    clone.isDashing = this.isDashing;
    clone.dashDirection.copy(this.dashDirection);
    clone.dashStartTime = this.dashStartTime;
    clone.dashDuration = this.dashDuration;
    clone.dashDistance = this.dashDistance;
    clone.dashStartPosition.copy(this.dashStartPosition);
    clone.warpdrivePurchases = this.warpdrivePurchases;
    clone.weaponAspect = this.weaponAspect;
    
    // Clone dash charges
    clone.maxDashCharges = this.maxDashCharges;
    clone.dashChargeRechargeRateMultiplier = this.dashChargeRechargeRateMultiplier;
    clone.dashCharges = this.dashCharges.map(charge => ({
      isAvailable: charge.isAvailable,
      cooldownStartTime: charge.cooldownStartTime,
      cooldownTimerId: charge.cooldownTimerId,
    }));

    // Clone charge properties
    clone.isCharging = this.isCharging;
    clone.chargeDirection.copy(this.chargeDirection);
    clone.chargeStartTime = this.chargeStartTime;
    clone.chargeDuration = this.chargeDuration;
    clone.chargeDistance = this.chargeDistance;
    clone.chargeStartPosition.copy(this.chargeStartPosition);

    // Clone knockback properties
    clone.isKnockbacked = this.isKnockbacked;
    clone.knockbackDirection.copy(this.knockbackDirection);
    clone.knockbackStartTime = this.knockbackStartTime;
    clone.knockbackDuration = this.knockbackDuration;
    clone.knockbackDistance = this.knockbackDistance;
    clone.knockbackStartPosition.copy(this.knockbackStartPosition);

    clone.movementLockUntil = this.movementLockUntil;

    clone.isPortalFalling = this.isPortalFalling;
    clone.portalFallPhase = this.portalFallPhase;
    clone.portalFallProgress = this.portalFallProgress;

    return clone;
  }
}
