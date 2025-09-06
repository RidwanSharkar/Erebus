// Movement component for velocity and movement properties
import { Vector3 } from '@/utils/three-exports';
import { Component } from '../Entity';

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
  public isSlowed: boolean;
  public slowedUntil: number;
  public movementSpeedMultiplier: number;

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
  
  // Multiple dash charges system
  public dashCharges: Array<{
    isAvailable: boolean;
    cooldownStartTime: number | null;
  }>;
  public maxDashCharges: number;

  // Sword Charge ability system (separate from dashes)
  public isCharging: boolean;
  public chargeDirection: Vector3;
  public chargeStartTime: number;
  public chargeDuration: number;
  public chargeDistance: number;
  public chargeStartPosition: Vector3;

  constructor(
    maxSpeed: number = 3.75,
    friction: number = 0.8,
    jumpForce: number = 20.0,
    gravity: number = -12.5
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
    this.isSlowed = false;
    this.slowedUntil = 0;
    this.movementSpeedMultiplier = 1.0;
    
    this.moveDirection = new Vector3(0, 0, 0);
    this.inputStrength = 0;

    // Initialize dash properties
    this.isDashing = false;
    this.dashDirection = new Vector3(0, 0, 0);
    this.dashStartTime = 0;
    this.dashDuration = 0.35; // 350ms dash duration (same as old implementation)
    this.dashDistance = 4; // Increased from 3.125 for more noticeable dash
    this.dashStartPosition = new Vector3(0, 0, 0);
    
    // Initialize multiple dash charges (3 charges, each with 6s cooldown)
    this.maxDashCharges = 3;
    this.dashCharges = Array.from({ length: this.maxDashCharges }, () => ({
      isAvailable: true,
      cooldownStartTime: null
    }));

    // Initialize sword charge properties
    this.isCharging = false;
    this.chargeDirection = new Vector3(0, 0, 0);
    this.chargeStartTime = 0;
    this.chargeDuration = 0.35; // 350ms charge duration
    this.chargeDistance = 9; // Sword charge distance
    this.chargeStartPosition = new Vector3(0, 0, 0);
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

  public slow(duration: number, speedMultiplier: number = 0.5): void {
    const currentTime = Date.now();
    this.isSlowed = true;
    this.slowedUntil = currentTime + duration;
    this.movementSpeedMultiplier = speedMultiplier;
    // console.log(`🐌 Player slowed to ${speedMultiplier * 100}% speed for ${duration}ms until ${this.slowedUntil}`);
  }

  public updateDebuffs(): void {
    const currentTime = Date.now();
    
    // Check frozen state
    if (this.isFrozen && currentTime >= this.frozenUntil) {
      this.isFrozen = false;
      this.frozenUntil = 0;
      console.log('🧊 Player unfrozen');
    }
    
    // Check slowed state
    if (this.isSlowed && currentTime >= this.slowedUntil) {
      this.isSlowed = false;
      this.slowedUntil = 0;
      this.movementSpeedMultiplier = 1.0;
      console.log('🐌 Player no longer slowed');
    }
  }

  public getEffectiveMaxSpeed(): number {
    if (this.isFrozen) {
      return 0; // Completely frozen
    }
    return this.maxSpeed * this.movementSpeedMultiplier;
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

    // Consume the charge
    this.dashCharges[availableChargeIndex].isAvailable = false;
    this.dashCharges[availableChargeIndex].cooldownStartTime = currentTime;

    // Set cooldown timer for this specific charge (6 seconds)
    setTimeout(() => {
      this.dashCharges[availableChargeIndex].isAvailable = true;
      this.dashCharges[availableChargeIndex].cooldownStartTime = null;
    }, 6000); // 6 second cooldown

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
        ? Math.max(0, 6 - (currentTime - charge.cooldownStartTime))
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
    this.maxSpeed = 5.0;
    this.friction = 0.8;
    this.jumpForce = 20.0;
    this.gravity = -12.5;
    this.enabled = true;

    // Reset debuff states
    this.isFrozen = false;
    this.frozenUntil = 0;
    this.isSlowed = false;
    this.slowedUntil = 0;
    this.movementSpeedMultiplier = 1.0;

    // Reset dash properties
    this.isDashing = false;
    this.dashDirection.set(0, 0, 0);
    this.dashStartTime = 0;
    this.dashDuration = 0.35;
    this.dashDistance = 4;
    this.dashStartPosition.set(0, 0, 0);
    
    // Reset dash charges
    this.maxDashCharges = 3;
    this.dashCharges = Array.from({ length: this.maxDashCharges }, () => ({
      isAvailable: true,
      cooldownStartTime: null
    }));

    // Reset charge properties
    this.isCharging = false;
    this.chargeDirection.set(0, 0, 0);
    this.chargeStartTime = 0;
    this.chargeDuration = 0.35;
    this.chargeDistance = 9;
    this.chargeStartPosition.set(0, 0, 0);
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
    clone.isSlowed = this.isSlowed;
    clone.slowedUntil = this.slowedUntil;
    clone.movementSpeedMultiplier = this.movementSpeedMultiplier;

    // Clone dash properties
    clone.isDashing = this.isDashing;
    clone.dashDirection.copy(this.dashDirection);
    clone.dashStartTime = this.dashStartTime;
    clone.dashDuration = this.dashDuration;
    clone.dashDistance = this.dashDistance;
    clone.dashStartPosition.copy(this.dashStartPosition);
    
    // Clone dash charges
    clone.maxDashCharges = this.maxDashCharges;
    clone.dashCharges = this.dashCharges.map(charge => ({
      isAvailable: charge.isAvailable,
      cooldownStartTime: charge.cooldownStartTime
    }));

    // Clone charge properties
    clone.isCharging = this.isCharging;
    clone.chargeDirection.copy(this.chargeDirection);
    clone.chargeStartTime = this.chargeStartTime;
    clone.chargeDuration = this.chargeDuration;
    clone.chargeDistance = this.chargeDistance;
    clone.chargeStartPosition.copy(this.chargeStartPosition);

    return clone;
  }
}
