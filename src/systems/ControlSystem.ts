// Control system for player input handling
import { Vector3, Matrix4 } from '@/utils/three-exports';
import { PerspectiveCamera } from '@/utils/three-exports';

import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Health } from '@/ecs/components/Health';
import { Enemy } from '@/ecs/components/Enemy';
import { Renderer } from '@/ecs/components/Renderer';
import { Collider } from '@/ecs/components/Collider';
import { InputManager } from '@/core/InputManager';
import { World } from '@/ecs/World';
import { ProjectileSystem } from './ProjectileSystem';
import { CombatSystem } from './CombatSystem';
import { WeaponSubclass, WeaponType } from '@/components/dragon/weapons';
import { DeflectBarrier } from '@/components/weapons/DeflectBarrier';
import { triggerGlobalFrostNova, addGlobalFrozenEnemy } from '@/components/weapons/FrostNovaManager';
import { triggerGlobalCobraShot } from '@/components/projectiles/CobraShotManager';
import { triggerGlobalViperSting } from '@/components/projectiles/ViperStingManager';

export class ControlSystem extends System {
  public readonly requiredComponents = [Transform, Movement];
  private inputManager: InputManager;
  private camera: PerspectiveCamera;
  private world: World;
  private projectileSystem: ProjectileSystem;
  private playerEntity: Entity | null = null;
  
  // Callback for bow release effects
  private onBowReleaseCallback?: (finalProgress: number, isPerfectShot?: boolean) => void;
  
  // Callback for Divine Storm activation
  private onDivineStormCallback?: (position: Vector3, direction: Vector3, duration: number) => void;
  
  // Callback for projectile creation
  private onProjectileCreatedCallback?: (projectileType: string, position: Vector3, direction: Vector3, config: any) => void;
  
  // Callback for Viper Sting activation
  private onViperStingCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Barrage activation
  private onBarrageCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Reanimate healing effect
  private onReanimateCallback?: () => void;
  
  // Callback for Frost Nova activation
  private onFrostNovaCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Cobra Shot activation
  private onCobraShotCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Charge activation
  private onChargeCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for Deflect activation
  private onDeflectCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Callback for broadcasting debuff effects in PVP
  private onDebuffCallback?: (targetEntityId: number, debuffType: 'frozen' | 'slowed', duration: number, position: Vector3) => void;
  
  // Callback for Skyfall ability
  private onSkyfallCallback?: (position: Vector3, direction: Vector3) => void;
  
  // Rate limiting for projectile firing
  private lastFireTime = 0;
  private lastCrossentropyTime = 0; // Separate tracking for CrossentropyBolt
  private lastReanimateTime = 0; // Separate tracking for Reanimate ability
  private lastViperStingTime = 0;
  private lastFrostNovaTime = 0; // Separate tracking for Frost Nova ability
  private lastCobraShotTime = 0; // Separate tracking for Cobra Shot ability
  private fireRate = 0.225; // Default for bow
  private swordFireRate = 0.9; // Slower rate for sword attacks (800ms between attacks)
  private sabresFireRate = 0.6; // Sabres dual attack rate (600ms between attacks)
  private scytheFireRate = 0.33; // EntropicBolt rate (0.5s cooldown)
  private crossentropyFireRate = 2; // CrossentropyBolt rate (1 per second)
  private viperStingFireRate = 2.0; // Viper Sting rate (2 seconds cooldown)
  private reanimateFireRate = 1.5; // Reanimate rate (2 seconds cooldown)
  private frostNovaFireRate = 12.0; // Frost Nova rate (12 seconds cooldown)
  private cobraShotFireRate = 2.0; // Cobra Shot rate (2 seconds cooldown)
  
  // Current weapon configuration
  private currentWeapon: WeaponType = WeaponType.BOW; // Default weapon
  private currentSubclass: WeaponSubclass = WeaponSubclass.ELEMENTAL; // Default for bow
  private currentLevel = 1;
  
  // Weapon-specific states
  private isCharging = false;
  private chargeProgress = 0;
  private isSwinging = false;
  
  // Viper Sting charging state
  private isViperStingCharging = false;
  private viperStingChargeProgress = 0;
  
  // Barrage charging state
  private isBarrageCharging = false;
  private barrageChargeProgress = 0;
  private lastBarrageTime = 0;
  private barrageFireRate = 5.0; // 5 second cooldown (keeping as requested)
  
  // Cobra Shot charging state
  private isCobraShotCharging = false;
  private cobraShotChargeProgress = 0;
  
  // Sword-specific states
  private swordComboStep: 1 | 2 | 3 = 1;
  private lastSwordAttackTime = 0;
  private swordComboResetTime = 1; // Reset combo after 1 seconds
  
  // Divine Storm ability state
  private isDivineStorming = false;
  private lastDivineStormTime = 0;
  private divineStormCooldown = 8.0; // 8 second cooldown
  
  // Charge ability state
  private isSwordCharging = false;
  private lastChargeTime = 0;
  private chargeCooldown = 8.0; // 8 second cooldown
  
  // Deflect ability state
  private isDeflecting = false;
  private lastDeflectTime = 0;
  private deflectCooldown = 6.0; // 8 second cooldown
  private deflectDuration = 3.0; // 3 second duration
  private deflectBarrier: DeflectBarrier;
  
  // Skyfall ability state (Sabres)
  private isSkyfalling = false;
  private skyfallPhase: 'none' | 'ascending' | 'descending' | 'landing' = 'none';
  private lastSkyfallTime = 0;
  private skyfallCooldown = 5.0; // 4 second cooldown
  private skyfallStartTime = 0;
  private skyfallStartPosition = new Vector3();
  private skyfallTargetHeight = 0;
  private skyfallOriginalGravity = 0;
  constructor(
    camera: PerspectiveCamera, 
    inputManager: InputManager, 
    world: World,
    projectileSystem: ProjectileSystem
  ) {
    super();
    this.camera = camera;
    this.inputManager = inputManager;
    this.world = world;
    this.projectileSystem = projectileSystem;
    this.deflectBarrier = new DeflectBarrier(world);
    this.priority = 5; // Run early for input handling
  }

  public setPlayer(entity: Entity): void {
    this.playerEntity = entity;
  }

  public update(entities: Entity[], deltaTime: number): void {
    if (!this.playerEntity) return;

    const playerTransform = this.playerEntity.getComponent(Transform);
    const playerMovement = this.playerEntity.getComponent(Movement);
    
    if (!playerTransform || !playerMovement) return;

    // Update debuff states first
    if (typeof playerMovement.updateDebuffs === 'function') {
      playerMovement.updateDebuffs();
    } else {
      console.warn('⚠️ Player Movement component missing updateDebuffs method:', playerMovement);
    }

    // Handle weapon switching
    this.handleWeaponSwitching();

    // Handle dash movement first (overrides regular movement)
    this.handleDashMovement(playerMovement, playerTransform);

    // Handle charge movement (overrides regular movement)
    this.handleChargeMovement(playerMovement, playerTransform);

    // Handle player movement input (only if not dashing, charging, frozen, or skyfalling)
    if (!playerMovement.isDashing && !playerMovement.isCharging && !playerMovement.isFrozen && !this.isSkyfalling) {
      this.handleMovementInput(playerMovement);
    }
    
    // Handle combat input
    this.handleCombatInput(playerTransform);
    
    // Update deflect barrier position if active
    this.updateDeflectBarrier(playerTransform);
  }

  private handleMovementInput(movement: Movement): void {
    if (!this.playerEntity) return;

    const playerTransform = this.playerEntity.getComponent(Transform);
    if (!playerTransform) return;

    // Check for double-tap dashes first (before processing regular movement)
    this.checkForDashInput(movement, playerTransform);

    // Get input direction
    const inputDirection = new Vector3(0, 0, 0);
    let hasInput = false;

    // WASD movement
    if (this.inputManager.isKeyPressed('w')) {
      inputDirection.z -= 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('s')) {
      inputDirection.z += 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('a')) {
      inputDirection.x -= 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('d')) {
      inputDirection.x += 1;
      hasInput = true;
    }

    // Normalize diagonal movement
    if (inputDirection.length() > 0) {
      inputDirection.normalize();
    }

    // Convert input to world space based on camera orientation
    if (hasInput) {
      const cameraDirection = new Vector3();
      this.camera.getWorldDirection(cameraDirection);
      
      // Get camera's right vector
      const cameraRight = new Vector3();
      cameraRight.crossVectors(cameraDirection, new Vector3(0, 1, 0)).normalize();
      
      // Get camera's forward vector (projected on XZ plane)
      const cameraForward = new Vector3();
      cameraForward.crossVectors(new Vector3(0, 1, 0), cameraRight).normalize();

      // Transform input direction to world space
      const worldDirection = new Vector3();
      worldDirection.addScaledVector(cameraRight, inputDirection.x);
      worldDirection.addScaledVector(cameraForward, -inputDirection.z);
      worldDirection.normalize();

      movement.setMoveDirection(worldDirection, 1.0);
    } else {
      movement.setMoveDirection(new Vector3(0, 0, 0), 0);
    }

    // Handle jumping
    if (this.inputManager.isKeyPressed(' ')) { // Spacebar
      movement.jump();
    }
  }

  private lastWeaponSwitchTime = 0;
  private weaponSwitchCooldown = 3; // 200ms cooldown to prevent rapid switching

  private handleWeaponSwitching(): void {
    const currentTime = Date.now() / 1000;
    
    // Prevent rapid weapon switching
    if (currentTime - this.lastWeaponSwitchTime < this.weaponSwitchCooldown) {
      return;
    }

    // Handle weapon switching with number keys
    if (this.inputManager.isKeyPressed('1')) {
      if (this.currentWeapon !== WeaponType.SWORD) {
        this.currentWeapon = WeaponType.SWORD;
        this.currentSubclass = WeaponSubclass.DIVINITY; // Default sword subclass
        this.fireRate = this.swordFireRate; // Use sword-specific fire rate
        this.lastWeaponSwitchTime = currentTime;
        this.swordComboStep = 1; // Reset combo when switching to sword
        console.log('🗡️ Switched to Sword');
      }
    } else if (this.inputManager.isKeyPressed('2')) {
      if (this.currentWeapon !== WeaponType.BOW) {
        this.currentWeapon = WeaponType.BOW;
        this.currentSubclass = WeaponSubclass.ELEMENTAL; // Default bow subclass
        this.fireRate = 0.225; // Bow fire rate
        this.lastWeaponSwitchTime = currentTime;
        console.log('🏹 Switched to Bow');
      }
    } else if (this.inputManager.isKeyPressed('3')) {
      if (this.currentWeapon !== WeaponType.SCYTHE) {
        this.currentWeapon = WeaponType.SCYTHE;
        this.currentSubclass = WeaponSubclass.CHAOS; // Default scythe subclass
        this.fireRate = this.scytheFireRate; // Use scythe fire rate (0.5s)
        this.lastWeaponSwitchTime = currentTime;
        console.log('⚡ Switched to Scythe');
      }
    } else if (this.inputManager.isKeyPressed('4')) {
      if (this.currentWeapon !== WeaponType.SABRES) {
        this.currentWeapon = WeaponType.SABRES;
        this.currentSubclass = WeaponSubclass.FROST; // Default sabres subclass
        this.fireRate = this.sabresFireRate; // Use sabres-specific fire rate
        this.lastWeaponSwitchTime = currentTime;
        console.log('⚔️ Switched to Sabres');
      }
    }
  }

  private handleCombatInput(playerTransform: Transform): void {
    if (this.currentWeapon === WeaponType.BOW) {
      this.handleBowInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SCYTHE) {
      this.handleScytheInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SWORD) {
      this.handleSwordInput(playerTransform);
    } else if (this.currentWeapon === WeaponType.SABRES) {
      this.handleSabresInput(playerTransform);
    }
  }

  private handleBowInput(playerTransform: Transform): void {
    // Handle Viper Sting ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isViperStingCharging && !this.isCharging) {
      this.performViperSting(playerTransform);
    }
    
    // Handle Barrage ability with 'Q' key
    if (this.inputManager.isKeyPressed('q')) {
      console.log('🏹 Q key pressed for Barrage!', {
        isBarrageCharging: this.isBarrageCharging,
        isCharging: this.isCharging,
        isViperStingCharging: this.isViperStingCharging
      });
      if (!this.isBarrageCharging && !this.isCharging && !this.isViperStingCharging) {
        this.performBarrage(playerTransform);
      }
    }
    
    // Handle Cobra Shot ability with 'E' key
    if (this.inputManager.isKeyPressed('e')) {
      console.log('🐍 E key pressed for Cobra Shot!', {
        isCharging: this.isCharging,
        isViperStingCharging: this.isViperStingCharging,
        isBarrageCharging: this.isBarrageCharging,
        isCobraShotCharging: this.isCobraShotCharging,
        currentWeapon: this.currentWeapon
      });
      if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging) {
        this.performCobraShot(playerTransform);
      }
    }
    
    // Handle bow charging and firing
    if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button held
      if (!this.isCharging && !this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging) {
        this.isCharging = true;
        this.chargeProgress = 0;
        console.log('🏹 Started charging bow');
      }
      // Increase charge progress (could be time-based)
      if (!this.isViperStingCharging && !this.isBarrageCharging && !this.isCobraShotCharging) {
        this.chargeProgress = Math.min(this.chargeProgress + 0.0125, 1.0); // BOW CHARGE SPEED
      }
    } else if (this.isCharging) {
      // Check if any ability is charging - if so, cancel the regular bow shot
      if (this.isViperStingCharging || this.isBarrageCharging || this.isCobraShotCharging) {
        console.log('🏹 Cancelling regular bow shot due to ability charging');
        this.isCharging = false;
        this.chargeProgress = 0;
        return;
      }
      
      // Store charge progress before resetting for visual effects
      const finalChargeProgress = this.chargeProgress;
      
      // Release the bow
      this.fireProjectile(playerTransform);
      this.isCharging = false;
      this.chargeProgress = 0;
      
      // Trigger visual effects callback with the stored charge progress
      this.triggerBowReleaseEffects(finalChargeProgress);
    }
  }

  private handleScytheInput(playerTransform: Transform): void {
    // Handle scythe left click for EntropicBolt
    if (this.inputManager.isMouseButtonPressed(0)) { // Left mouse button held
      if (!this.isCharging) {
        this.isCharging = true;
        this.chargeProgress = 0;
        console.log('⚡ Started charging scythe (spinning)');
      }
      // Increase charge progress continuously for spinning animation (no cap)
      this.chargeProgress += 0.03; // Continuously increase for spinning
      
      // Fire EntropicBolt projectiles continuously while spinning
      this.fireEntropicBoltProjectile(playerTransform);
    } else if (this.isCharging) {
      // Stop spinning when mouse is released
      console.log('⚡ Stopped charging scythe (spinning)');
      this.isCharging = false;
      this.chargeProgress = 0;
    }
    
    // Handle CrossentropyBolt ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isCharging) {
      this.fireCrossentropyBoltAbility(playerTransform);
    }
    
    // Handle Reanimate ability with 'Q' key
    if (this.inputManager.isKeyPressed('q') && !this.isCharging) {
      this.performReanimateAbility(playerTransform);
    }
    
    // Handle Frost Nova ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && !this.isCharging) {
      this.performFrostNovaAbility(playerTransform);
    }
  }

  private fireProjectile(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.fireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    
    // Get dragon's facing direction (same as camera direction since dragon faces camera)
    // This ensures arrows fire outward from where the dragon is facing
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply downward angle compensation to account for restricted camera bounds
    // Since camera can't look down much due to bounds, we add a fixed downward angle
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    
    // Create a rotation matrix to apply the downward angle around the camera's right axis
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Perfect shot timing constants
    const perfectShotMinThreshold = 0.7; // 85% charge
    const perfectShotMaxThreshold = 0.98; // 95% charge
    const isPerfectShot = this.chargeProgress >= perfectShotMinThreshold && this.chargeProgress <= perfectShotMaxThreshold;
    
    // Check if bow is fully charged for special projectile
    if (this.chargeProgress >= 1.0) {
      console.log(`🏹 Firing CHARGED ARROW with full charge: ${this.chargeProgress}`);
      this.createChargedArrowProjectile(playerTransform.position.clone(), direction);
    } else if (isPerfectShot) {
      console.log(`✨ Firing PERFECT SHOT with charge: ${this.chargeProgress}`);
      this.createPerfectShotProjectile(playerTransform.position.clone(), direction);
    } else {
      // Debug: Log the firing angle to verify it's changing with camera rotation
      const angle = Math.atan2(direction.x, direction.z);
      console.log(`🧭 Firing ${this.currentWeapon} at angle: ${(angle * 180 / Math.PI).toFixed(1)}°`);
      this.createProjectile(playerTransform.position.clone(), direction);
    }
  }

  private fireEntropicBoltProjectile(playerTransform: Transform): void {
    // Rate limiting - use new scythe rate (0.5 seconds)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.scytheFireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    
    // Get dragon's facing direction
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply downward angle compensation (same as bow projectiles)
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    const spinStatus = this.isCharging ? ' (SPINNING)' : '';
    console.log(`⚡ Firing EntropicBolt${spinStatus} - charge: ${this.chargeProgress.toFixed(2)} - rate: ${this.scytheFireRate}s`);
    
    this.createEntropicBoltProjectile(playerTransform.position.clone(), direction);
  }

  private fireCrossentropyBoltAbility(playerTransform: Transform): void {
    // Rate limiting - use CrossentropyBolt rate (1 per second)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastCrossentropyTime < this.crossentropyFireRate) {
      return;
    }
    this.lastCrossentropyTime = currentTime;
    
    // Get dragon's facing direction
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply angle compensation (same as bow projectiles)
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    console.log(`⚔️ Firing CrossentropyBolt ability (R key) - rate: ${this.crossentropyFireRate}s`);
    
    this.createCrossentropyBoltProjectile(playerTransform.position.clone(), direction);
  }

  private createProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Check if there are any valid targets in the world before creating projectiles
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);
    const validTargets = potentialTargets.filter(target => 
      target.id !== this.playerEntity!.id && // Not the player itself
      !target.getComponent(Health)?.isDead // Not dead
    );
    
    // In multiplayer mode, only create projectiles if there are valid targets or if we need to broadcast to other players
    const hasValidTargets = validTargets.length > 0;
    const shouldBroadcast = this.onProjectileCreatedCallback !== undefined;
    
    if (!hasValidTargets && !shouldBroadcast) {
      console.log('🏹 No valid targets found, skipping projectile creation');
      return;
    }
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 0.5; // Slightly higher
    
    // Create projectile using the ProjectileSystem with current weapon config
    const projectileConfig = {
      speed: 25,
      damage: 10, // Arrow damage should be 10
      lifetime: 3,
      maxDistance: 25, // Limit bow arrows to 25 units distance
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0
    };
    
    this.projectileSystem.createProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      projectileConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('regular_arrow', spawnPosition, direction, projectileConfig);
    }
  }

  private createEntropicBoltProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Check if there are any valid targets in the world before creating projectiles
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);
    const validTargets = potentialTargets.filter(target => 
      target.id !== this.playerEntity!.id && // Not the player itself
      !target.getComponent(Health)?.isDead // Not dead
    );
    
    // In multiplayer mode, only create projectiles if there are valid targets or if we need to broadcast to other players
    const hasValidTargets = validTargets.length > 0;
    const shouldBroadcast = this.onProjectileCreatedCallback !== undefined;
    
    if (!hasValidTargets && !shouldBroadcast) {
      console.log('⚡ No valid targets found, skipping EntropicBolt creation');
      return;
    }
    
    // Check if player has enough mana (15 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastEntropicBolt()) {
      console.log('⚡ Not enough mana to cast Entropic Bolt (requires 15 mana)');
      return;
    }
    
    // Consume mana
    if (gameUI) {
      gameUI.consumeMana(10);
      console.log('⚡ Consumed 15 mana for Entropic Bolt');
    }
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 0.75; // Slightly higher
    
    // Create EntropicBolt projectile using the new method
    const entropicConfig = {
      speed: 20, // Faster than CrossentropyBolt
      damage: 20, // EntropicBolt damage
      lifetime: 5, // Shorter lifetime
      piercing: false, // Non-piercing so projectile gets destroyed on hit
      explosive: false, // No explosion effect
      explosionRadius: 0, // No explosion radius
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0
    };
    
    this.projectileSystem.createEntropicBoltProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      entropicConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('entropic_bolt', spawnPosition, direction, entropicConfig);
    }
  }

  private createCrossentropyBoltProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Check if player has enough mana (40 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastCrossentropyBolt()) {
      console.log('⚔️ Not enough mana to cast Crossentropy Bolt (requires 40 mana)');
      return;
    }
    
    // Consume mana
    if (gameUI) {
      gameUI.consumeMana(40);
      console.log('⚔️ Consumed 40 mana for Crossentropy Bolt');
    }
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 0.75; // Slightly higher
    
    // Create CrossentropyBolt projectile using the existing method
    const crossentropyConfig = {
      speed: 15, // Slower than EntropicBolt
      damage: 90, // Higher damage for R ability
      lifetime: 5, // Longer lifetime
      piercing: false, // 
      explosive: false, // Disabled explosion effect for performance
      explosionRadius: 0, // No explosion radius
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0
    };
    
    this.projectileSystem.createCrossentropyBoltProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      crossentropyConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('crossentropy_bolt', spawnPosition, direction, crossentropyConfig);
    }
  }

  private performReanimateAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    // Rate limiting - prevent spam casting (1 second cooldown)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastReanimateTime < 1.0) {
      console.log('🩸 Reanimate on cooldown - please wait');
      return;
    }
    this.lastReanimateTime = currentTime;
    
    // Check if player has enough mana (20 mana cost - doubled from 10)
    const gameUI = (window as any).gameUI;
    const currentMana = gameUI ? gameUI.getCurrentMana() : 0;
    
    if (gameUI && !gameUI.canCastReanimate()) {
      return;
    }
    
    // Consume mana
    if (gameUI) {
      const manaBefore = gameUI.getCurrentMana();
      gameUI.consumeMana(20);
      const manaAfter = gameUI.getCurrentMana();
      console.log(`🩸 Reanimate mana consumption - Before: ${manaBefore}, After: ${manaAfter}, Consumed: ${manaBefore - manaAfter}`);
    }
    
    // Always trigger the visual effect first, regardless of healing success
    console.log('🌿 Reanimate ability activated - triggering visual effects');
    this.triggerReanimateEffect(playerTransform);
    
    // Get player's health component and heal for 20 HP (doubled from 10)
    const healthComponent = this.playerEntity.getComponent(Health);
    if (healthComponent) {
      const didHeal = healthComponent.heal(30); // REANIMATE HEAL AMOUNT
      if (didHeal) {
        console.log(`🩸 Reanimate healed player for 20 HP. Current health: ${healthComponent.currentHealth}/${healthComponent.maxHealth}`);
      } else {
        console.log('🩸 Reanimate cast successfully but player already at full health');
      }
    }
  }

  private triggerReanimateEffect(playerTransform: Transform): void {
    // Trigger the visual healing effect
    console.log('🌿 Triggering Reanimate healing effect');
    
    if (this.onReanimateCallback) {
      this.onReanimateCallback();
    }
    
    const playerPosition = playerTransform.position;
    console.log(`🌿 Healing effect at position: ${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)}`);
  }

  private performFrostNovaAbility(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFrostNovaTime < this.frostNovaFireRate) {
      console.log(`❄️ Frost Nova on cooldown for ${(this.frostNovaFireRate - (currentTime - this.lastFrostNovaTime)).toFixed(1)}s`);
      return;
    }
    
    // Check if player has enough mana (25 mana cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastFrostNova()) {
      console.log('❄️ Not enough mana to cast Frost Nova (requires 25 mana)');
      return;
    }
    
    // Consume mana
    if (gameUI) {
      gameUI.consumeMana(50);
      console.log('❄️ Consumed 25 mana for Frost Nova');
    }
    
    this.lastFrostNovaTime = currentTime;
    
    console.log('❄️ Frost Nova ability activated!');
    
    // Get player position and direction
    const playerPosition = playerTransform.getWorldPosition();
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Trigger Frost Nova callback for visual effects
    if (this.onFrostNovaCallback) {
      this.onFrostNovaCallback(playerPosition, direction);
    }
    
    // Find all enemies within 5 unit radius and freeze them
    this.freezeEnemiesInRadius(playerPosition, 6.0, currentTime);
    
    // Trigger global frost nova visual effect
    triggerGlobalFrostNova(playerPosition);
  }

  private performCobraShot(playerTransform: Transform): void {
    if (!this.playerEntity) return;
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastCobraShotTime < this.cobraShotFireRate) {
      console.log(`🐍 Cobra Shot on cooldown for ${(this.cobraShotFireRate - (currentTime - this.lastCobraShotTime)).toFixed(1)}s`);
      return;
    }

    // Check if player has enough energy (40 energy cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastCobraShot()) {
      console.log('🐍 Not enough energy to cast Cobra Shot (requires 40 energy)');
      return;
    }

    // Consume energy
    if (gameUI) {
      gameUI.consumeEnergy(40);
      console.log('🐍 Consumed 40 energy for Cobra Shot');
    }

    console.log('🐍 Cobra Shot activated - starting charge!');
    this.isCobraShotCharging = true;
    this.cobraShotChargeProgress = 0;
    this.lastCobraShotTime = currentTime;
    
    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 750; // 0.75 second charge time (between Viper Sting and Barrage)
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.cobraShotChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.cobraShotChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireCobraShot(playerTransform);
        this.isCobraShotCharging = false;
        this.cobraShotChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireCobraShot(playerTransform: Transform): void {
    console.log('🐍 Firing Cobra Shot projectile!');
    
    // Get player position and direction (same as other projectiles)
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 1; // Shoot from chest level like Viper Sting
    
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply same downward angle compensation as other projectiles
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Offset spawn position slightly forward to avoid collision with player
    const spawnPosition = playerPosition.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    
    // Note: Cobra Shot damage is handled by CobraShotManager, not ECS projectiles
    // This prevents duplicate projectiles and damage (similar to Viper Sting)
    
    // Trigger Cobra Shot callback for visual effects
    if (this.onCobraShotCallback) {
      this.onCobraShotCallback(spawnPosition, direction);
    }
    
    // Trigger global cobra shot with proper positioning (handles local visual effects and damage)
    triggerGlobalCobraShot(spawnPosition, direction);
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('cobra_shot_projectile', spawnPosition, direction, {
        speed: 16, // Consistent speed for PVP
        damage: 29, // Use consistent damage value
        lifetime: 8,
        venomDuration: 6
      });
    }
  }

  private freezeEnemiesInRadius(centerPosition: Vector3, radius: number, currentTime: number): void {
    // Get all entities in the world
    const allEntities = this.world.getAllEntities();
    let frozenCount = 0;
    let damagedPlayers = 0;
    
    allEntities.forEach(entity => {
      const entityTransform = entity.getComponent(Transform);
      const entityHealth = entity.getComponent(Health);
      
      if (!entityTransform || !entityHealth || entityHealth.isDead) return;
      
      // Skip self
      if (entity.id === this.playerEntity?.id) return;
      
      const entityPosition = entityTransform.position;
      const distance = centerPosition.distanceTo(entityPosition);
      
      // Check if entity is within freeze radius
      if (distance <= radius) {
        const enemy = entity.getComponent(Enemy);
        
        if (enemy) {
          // This is an enemy - freeze it (single player mode)
          enemy.freeze(6.0, currentTime);
          frozenCount++;
          console.log(`❄️ Frozen enemy at distance ${distance.toFixed(2)} units`);
          
          // Add frozen visual effect for this enemy
          addGlobalFrozenEnemy(entity.id.toString(), entityPosition);
        } else {
          // This is likely another player in PVP mode - deal damage and freeze
          const combatSystem = this.world.getSystem(CombatSystem);
          if (combatSystem && this.playerEntity) {
            const frostNovaDamage = 50; // Frost Nova damage
            combatSystem.queueDamage(entity, frostNovaDamage, this.playerEntity, 'frost_nova');
            damagedPlayers++;
            console.log(`❄️ Frost Nova hit player ${entity.id} for ${frostNovaDamage} damage at distance ${distance.toFixed(2)} units`);
            
            // Broadcast freeze effect to the target player so they get frozen on their end
            if (this.onDebuffCallback) {
              console.log(`❄️ Broadcasting freeze effect to PVP player ${entity.id}`);
              console.log(`🔍 Debug: Calling debuff callback with entityId=${entity.id}, type=frozen, duration=3000`);
              this.onDebuffCallback(entity.id, 'frozen', 6000, entityPosition);
              console.log(`✅ Debug: Debuff callback completed`);
            } else {
              console.warn(`⚠️ Debug: onDebuffCallback is not set!`);
            }
          }
        }
      }
    });
    
    if (frozenCount > 0) {
      console.log(`❄️ Frost Nova froze ${frozenCount} enemies within ${radius} unit radius`);
    }
    if (damagedPlayers > 0) {
      console.log(`❄️ Frost Nova damaged ${damagedPlayers} players within ${radius} unit radius`);
    }
  }

  private createChargedArrowProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 0.5; // Slightly higher
    
    // Create charged arrow projectile - more powerful than regular arrows
    const chargedArrowConfig = {
      speed: 35, // Faster than regular arrows (25)
      damage: 50, // Much higher damage than regular arrows (10)
      lifetime: 2, // Longer lifetime than regular arrows (3)
      piercing: true, // Charged arrows can pierce through enemies
      explosive: false, // No explosion, but could add special effects
      subclass: this.currentSubclass,
      level: this.currentLevel,
      opacity: 1.0
    };
    
    this.projectileSystem.createChargedArrowProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      chargedArrowConfig
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('charged_arrow', spawnPosition, direction, chargedArrowConfig);
    }
  }

  private createPerfectShotProjectile(position: Vector3, direction: Vector3): void {
    if (!this.playerEntity) return;
    
    // Offset projectile spawn position slightly forward to avoid collision with player
    const spawnPosition = position.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    spawnPosition.y += 0.5; // Slightly higher
    
    // Create perfect shot projectile - enhanced charged arrow with special effects
    this.projectileSystem.createChargedArrowProjectile(
      this.world,
      spawnPosition,
      direction,
      this.playerEntity.id,
      {
        speed: 40, // Faster than regular charged arrows (35)
        damage: 75, // Higher damage than regular charged arrows (50)
        lifetime: 6, // Longer lifetime than regular charged arrows (5)
        piercing: true, // Perfect shots can pierce through enemies
        explosive: false, // No explosion, but has special visual effects
        subclass: this.currentSubclass,
        level: this.currentLevel,
        opacity: 1.0
      }
    );
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('perfect_shot', spawnPosition, direction, {
        speed: 40,
        damage: 75,
        lifetime: 6,
        piercing: true,
        subclass: this.currentSubclass,
        level: this.currentLevel,
        opacity: 1.0
      });
    }
    
    console.log(`✨ Perfect shot projectile created with enhanced stats!`);
  }

  // Methods to configure weapon for testing
  public setWeaponSubclass(subclass: WeaponSubclass): void {
    this.currentSubclass = subclass;
    console.log(`🏹 Weapon subclass changed to: ${subclass}`);
  }

  // Method to set bow release callback
  public setBowReleaseCallback(callback: (finalProgress: number, isPerfectShot?: boolean) => void): void {
    this.onBowReleaseCallback = callback;
  }
  
  public setDivineStormCallback(callback: (position: Vector3, direction: Vector3, duration: number) => void): void {
    this.onDivineStormCallback = callback;
  }
  
  public setProjectileCreatedCallback(callback: (projectileType: string, position: Vector3, direction: Vector3, config: any) => void): void {
    this.onProjectileCreatedCallback = callback;
  }
  
  public setViperStingCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onViperStingCallback = callback;
  }

  public setBarrageCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onBarrageCallback = callback;
  }

  public setReanimateCallback(callback: () => void): void {
    this.onReanimateCallback = callback;
  }
  
  public setFrostNovaCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onFrostNovaCallback = callback;
  }
  
  public setCobraShotCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onCobraShotCallback = callback;
  }
  
  public setChargeCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onChargeCallback = callback;
  }
  
  public setDeflectCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onDeflectCallback = callback;
  }
  
  public setSkyfallCallback(callback: (position: Vector3, direction: Vector3) => void): void {
    this.onSkyfallCallback = callback;
  }
  
  public setDebuffCallback(callback: (targetEntityId: number, debuffType: 'frozen' | 'slowed', duration: number, position: Vector3) => void): void {
    this.onDebuffCallback = callback;
  }

  // Method to trigger bow release effects
  private triggerBowReleaseEffects(finalChargeProgress: number): void {
    if (this.onBowReleaseCallback) {
      // Check if this was a perfect shot
      const perfectShotMinThreshold = 0.75; // 85% charge
      const perfectShotMaxThreshold = 0.98; // 95% charge
      const isPerfectShot = finalChargeProgress >= perfectShotMinThreshold && finalChargeProgress <= perfectShotMaxThreshold;
      
      this.onBowReleaseCallback(finalChargeProgress, isPerfectShot);
    }
  }

  public setWeaponLevel(level: number): void {
    this.currentLevel = level;
    console.log(`⬆️ Weapon level changed to: ${level}`);
  }

  public getCurrentWeaponConfig(): { weapon: WeaponType; subclass: WeaponSubclass; level: number } {
    return {
      weapon: this.currentWeapon,
      subclass: this.currentSubclass,
      level: this.currentLevel
    };
  }

  // Getters for weapon state (for UI/rendering)
  public getCurrentWeapon(): WeaponType {
    return this.currentWeapon;
  }

  public getCurrentSubclass(): WeaponSubclass {
    return this.currentSubclass;
  }

  public isWeaponCharging(): boolean {
    return this.isCharging;
  }

  public getChargeProgress(): number {
    return this.chargeProgress;
  }

  public isViperStingChargingActive(): boolean {
    return this.isViperStingCharging;
  }

  public getViperStingChargeProgress(): number {
    return this.viperStingChargeProgress;
  }

  public isBarrageChargingActive(): boolean {
    return this.isBarrageCharging;
  }

  public getBarrageChargeProgress(): number {
    return this.barrageChargeProgress;
  }

  public isCobraShotChargingActive(): boolean {
    return this.isCobraShotCharging;
  }

  public getCobraShotChargeProgress(): number {
    return this.cobraShotChargeProgress;
  }

  public isWeaponSwinging(): boolean {
    return this.isSwinging;
  }

  // Sword-specific getters
  public getSwordComboStep(): 1 | 2 | 3 {
    return this.swordComboStep;
  }

  public isDivineStormActive(): boolean {
    return this.isDivineStorming;
  }

  public isChargeActive(): boolean {
    return this.isSwordCharging;
  }

  public isDeflectActive(): boolean {
    return this.isDeflecting;
  }
  
  public isSkyfallActive(): boolean {
    return this.isSkyfalling;
  }

  private handleSwordInput(playerTransform: Transform): void {
    // Handle sword melee attacks
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isDivineStorming && !this.isSwordCharging && !this.isDeflecting) { // Left mouse button
      this.performSwordMeleeAttack(playerTransform);
    }
    
    // Handle Divine Storm ability with 'R' key
    if (this.inputManager.isKeyPressed('r') && !this.isDivineStorming && !this.isSwinging && !this.isSwordCharging && !this.isDeflecting) {
      this.performDivineStorm(playerTransform);
    }
    
    // Handle Charge ability with 'E' key
    if (this.inputManager.isKeyPressed('e') && !this.isSwordCharging && !this.isDivineStorming && !this.isSwinging && !this.isDeflecting) {
      this.performCharge(playerTransform);
    }
    
    // Handle Deflect ability with 'Q' key
    if (this.inputManager.isKeyPressed('q') && !this.isDeflecting && !this.isDivineStorming && !this.isSwinging && !this.isSwordCharging) {
      this.performDeflect(playerTransform);
    }
    
    // Check for combo reset
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastSwordAttackTime > this.swordComboResetTime) {
      this.swordComboStep = 1;
    }
  }

  private performSwordMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use sword-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.swordFireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    this.lastSwordAttackTime = currentTime;
    
    console.log(`🗡️ Sword melee attack - Combo step ${this.swordComboStep}`);
    
    // Set swinging state - completion will be handled by sword component callback
    this.isSwinging = true;
    
    // Perform melee damage in a cone in front of player
    this.performMeleeDamage(playerTransform);
    
    // Note: Swing completion and combo advancement is now handled by onSwordSwingComplete callback
  }

  // Called by sword component when swing animation completes
  public onSwordSwingComplete(): void {
    if (!this.isSwinging) return; // Prevent multiple calls
    
    console.log(`🗡️ Sword swing completed - was combo step ${this.swordComboStep}`);
    
    // Reset swinging state
    this.isSwinging = false;
    
    // Advance combo step for next attack
    this.swordComboStep = (this.swordComboStep % 3 + 1) as 1 | 2 | 3;
    
    console.log(`🗡️ Next combo step will be: ${this.swordComboStep}`);
  }

  private handleSabresInput(playerTransform: Transform): void {
    // Handle left click for dual sabre attack
    if (this.inputManager.isMouseButtonPressed(0) && !this.isSwinging && !this.isSkyfalling) {
      this.performSabresMeleeAttack(playerTransform);
    }
    
    // Handle E key for Skyfall ability
    if (this.inputManager.isKeyPressed('e') && !this.isSkyfalling) {
      console.log('🌟 E key pressed for Skyfall - attempting to perform ability');
      this.performSkyfall(playerTransform);
    }
    
    // Update Skyfall state if active
    if (this.isSkyfalling) {
      this.updateSkyfallMovement(playerTransform);
    }
  }

  private performSabresMeleeAttack(playerTransform: Transform): void {
    // Rate limiting - prevent spam clicking (use sabres-specific fire rate)
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastFireTime < this.sabresFireRate) {
      return;
    }
    this.lastFireTime = currentTime;
    
    console.log('⚔️ Sabres dual attack initiated');
    
    // Set swinging state - completion will be handled by sabres component callback
    this.isSwinging = true;
    
    // Perform melee damage in a cone in front of player (dual attack)
    this.performSabresMeleeDamage(playerTransform);
  }

  // Called by sabres component when swing animation completes
  public onSabresSwingComplete(): void {
    if (!this.isSwinging) return; // Prevent multiple calls
    
    console.log('⚔️ Sabres dual swing completed');
    
    // Reset swinging state
    this.isSwinging = false;
  }

  private performSabresMeleeDamage(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Get all entities that could be damaged
    const allEntities = this.world.getAllEntities();
    const potentialTargets = allEntities.filter(entity => 
      entity.hasComponent(Health) && 
      entity.hasComponent(Transform) &&
      entity !== this.playerEntity
    );
    
    // SABRES DAMAGE
    const attackRange = 3.8; // Slightly longer range than sword
    const attackAngle = Math.PI / 2; // 60 degree cone (wider than sword)
    const leftSabreDamage = 19; // Damage per sabre
    const rightSabreDamage = 23;
    
    // Get camera direction for attack direction
    const attackDirection = new Vector3();
    this.camera.getWorldDirection(attackDirection);
    attackDirection.normalize();
    
    let hitCount = 0;
    
    for (const target of potentialTargets) {
      const targetTransform = target.getComponent(Transform);
      const targetHealth = target.getComponent(Health);
      
      if (!targetTransform || !targetHealth || targetHealth.isDead) continue;
      
      // Calculate direction to target
      const directionToTarget = targetTransform.position.clone().sub(playerTransform.position);
      const distanceToTarget = directionToTarget.length();
      
      // Check if target is within range
      if (distanceToTarget > attackRange) continue;
      
      // Check if target is within attack cone
      directionToTarget.normalize();
      const dotProduct = attackDirection.dot(directionToTarget);
      const angleToTarget = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
      
      if (angleToTarget > attackAngle / 2) continue;
      
      // Target is within range and cone - apply damage from both sabres
      const combatSystem = this.world.getSystem(CombatSystem);
      if (combatSystem) {
        // Left sabre hit (immediate)
        combatSystem.queueDamage(target, leftSabreDamage, this.playerEntity || undefined);
        
        // Right sabre hit (with small delay)
        setTimeout(() => {
          if (!targetHealth.isDead) {
            combatSystem.queueDamage(target, rightSabreDamage, this.playerEntity || undefined);
          }
        }, 100); // 100ms delay between sabre hits
        
        hitCount++;
        console.log(`⚔️ Sabres hit target at distance ${distanceToTarget.toFixed(2)} for ${leftSabreDamage + rightSabreDamage} total damage`);
      }
    }
    
    if (hitCount === 0) {
      console.log('⚔️ Sabres attack missed - no targets in range');
    } else {
      console.log(`⚔️ Sabres attack hit ${hitCount} target(s)`);
    }
  }

  // Skyfall ability implementation
  private performSkyfall(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    
    // Check cooldown
    if (currentTime - this.lastSkyfallTime < this.skyfallCooldown) {
      console.log(`🌟 Skyfall on cooldown for ${(this.skyfallCooldown - (currentTime - this.lastSkyfallTime)).toFixed(1)}s`);
      return;
    }
    
    // Check energy cost
    const gameUI = (window as any).gameUI;
    if (!gameUI || !gameUI.canCastSkyfall()) {
      console.log('🌟 Not enough energy for Skyfall (requires 40 energy)');
      return;
    }
    
    // Consume energy
    gameUI.consumeEnergy(40);
    
    // Start Skyfall
    this.isSkyfalling = true;
    this.skyfallPhase = 'ascending';
    this.skyfallStartTime = currentTime;
    this.lastSkyfallTime = currentTime;
    this.skyfallStartPosition.copy(playerTransform.position);
    
    // Set target height (double jump height)
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (playerMovement) {
      this.skyfallOriginalGravity = playerMovement.gravity;
      this.skyfallTargetHeight = playerTransform.position.y + (playerMovement.jumpForce * 2); // Double jump height
      
      console.log(`🌟 Skyfall Setup - Original Gravity: ${this.skyfallOriginalGravity}, Jump Force: ${playerMovement.jumpForce}, Start Y: ${playerTransform.position.y.toFixed(2)}, Target Y: ${this.skyfallTargetHeight.toFixed(2)}`);
      
      // Apply upward velocity
      playerMovement.velocity.y = playerMovement.jumpForce * 1.8; // Stronger initial velocity
      playerMovement.gravity = 0; // Disable gravity during ascent
      // Don't disable canMove as it prevents all physics updates including gravity
      // Instead we'll control horizontal movement in the ControlSystem
      
      console.log(`🌟 Applied velocity Y: ${playerMovement.velocity.y.toFixed(2)}, Set gravity to: ${playerMovement.gravity}`);
    }
    
    console.log(`🌟 Skyfall initiated! Ascending to height ${this.skyfallTargetHeight.toFixed(2)}`);
    
    // Trigger callback for multiplayer/visual effects
    if (this.onSkyfallCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      this.onSkyfallCallback(playerTransform.position, direction);
    }
  }
  
  private updateSkyfallMovement(playerTransform: Transform): void {
    const currentTime = Date.now() / 1000;
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (!playerMovement) return;
    
    const elapsedTime = currentTime - this.skyfallStartTime;
    
    // Debug logging (throttled to avoid spam)
    if (Math.floor(elapsedTime * 4) !== Math.floor((elapsedTime - 0.25) * 4)) {
      console.log(`🌟 Skyfall Update - Phase: ${this.skyfallPhase}, Y: ${playerTransform.position.y.toFixed(2)}, Target: ${this.skyfallTargetHeight.toFixed(2)}, Velocity Y: ${playerMovement.velocity.y.toFixed(2)}, Elapsed: ${elapsedTime.toFixed(2)}s`);
    }
    
    switch (this.skyfallPhase) {
      case 'ascending':
        // Check if we've reached target height or started falling
        if (playerTransform.position.y >= this.skyfallTargetHeight || playerMovement.velocity.y <= 0) {
          this.skyfallPhase = 'descending';
          playerMovement.velocity.y = 0; // Stop at peak
          playerMovement.gravity = this.skyfallOriginalGravity * 30; // Faster descent
          console.log('🌟 Skyfall: Reached peak, beginning descent');
        }
        break;
        
      case 'descending':
        // Check if we've landed (close to original height or on ground)
        if (playerTransform.position.y <= this.skyfallStartPosition.y + 0.5) {
          this.skyfallPhase = 'landing';
          this.performSkyfallLanding(playerTransform);
        }
        break;
        
      case 'landing':
        // Landing phase complete
        this.completeSkyfallAbility(playerTransform);
        break;
    }
    
    // Safety timeout (if something goes wrong, end after 5 seconds)
    if (elapsedTime > 5.0) {
      console.log('🌟 Skyfall timeout - force completing');
      this.completeSkyfallAbility(playerTransform);
    }
  }
  
  private performSkyfallLanding(playerTransform: Transform): void {
    console.log('🌟 Skyfall: Landing impact!');
    
    // Deal damage to enemies in landing area
    const allEntities = this.world.getAllEntities();
    const landingPosition = playerTransform.position;
    const damageRadius = 4.0; // 4 unit radius
    const skyfallDamage = 150; // 150 damage as requested
    
    let hitCount = 0;
    
    for (const entity of allEntities) {
      if (entity === this.playerEntity) continue;
      
      const targetHealth = entity.getComponent(Health);
      const targetTransform = entity.getComponent(Transform);
      
      if (!targetHealth || !targetTransform || targetHealth.isDead) continue;
      
      // Check distance to landing position
      const distanceToLanding = landingPosition.distanceTo(targetTransform.position);
      
      if (distanceToLanding <= damageRadius) {
        // Apply Skyfall damage
        const combatSystem = this.world.getSystem(CombatSystem);
        if (combatSystem) {
          combatSystem.queueDamage(entity, skyfallDamage, this.playerEntity || undefined);
          hitCount++;
          console.log(`🌟 Skyfall hit target at distance ${distanceToLanding.toFixed(2)} for ${skyfallDamage} damage`);
        }
      }
    }
    
    if (hitCount === 0) {
      console.log('🌟 Skyfall landing missed - no targets in range');
    } else {
      console.log(`🌟 Skyfall landing hit ${hitCount} target(s)`);
    }
  }
  
  private completeSkyfallAbility(playerTransform: Transform): void {
    // Reset all Skyfall states
    this.isSkyfalling = false;
    this.skyfallPhase = 'none';
    
    // Restore player movement
    const playerMovement = this.playerEntity?.getComponent(Movement);
    if (playerMovement) {
      playerMovement.gravity = this.skyfallOriginalGravity;
      playerMovement.velocity.y = 0; // Stop any remaining vertical movement
    }
    
    console.log('🌟 Skyfall ability completed');
  }

  private performMeleeDamage(playerTransform: Transform): void {
    // Get all entities in the world to check for enemies
    const allEntities = this.world.getAllEntities();
    const playerPosition = playerTransform.position;
    
    // Get player facing direction (camera direction)
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Melee attack parameters - increased for PVP combat
    const meleeRange = 4.6; // Increased attack range for PVP
    const meleeAngle = Math.PI / 2; // 120 degree cone (60 degrees each side)
    
    // Base damage values based on combo step - works for all subclasses
    let baseDamage = 45; // Base sword damage
    // Combo damage scaling
    switch (this.swordComboStep) {
      case 1: baseDamage = 45; break;
      case 2: baseDamage = 50; break;
      case 3: baseDamage = 60; break; // Finisher does more damage
    }
    
    // Get combat system to apply damage
    const combatSystem = this.world.getSystem(CombatSystem);
    
    // Track enemies hit for rage generation
    let enemiesHit = 0;
    
    allEntities.forEach(entity => {
      // Check if entity has enemy component and health
      const enemyTransform = entity.getComponent(Transform);
      const enemyHealth = entity.getComponent(Health);
      if (!enemyTransform || !enemyHealth || entity.id === this.playerEntity?.id) return;
      
      const enemyPosition = enemyTransform.position;
      const toEnemy = enemyPosition.clone().sub(playerPosition);
      const distance = toEnemy.length();
      
      // Debug logging for PVP hit detection
      console.log(`🎯 PVP Sword check - Entity ${entity.id}: Player pos (${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)}), Enemy pos (${enemyPosition.x.toFixed(2)}, ${enemyPosition.y.toFixed(2)}, ${enemyPosition.z.toFixed(2)}), Distance: ${distance.toFixed(2)}, Range: ${meleeRange}`);
      
      // Check if enemy is within range
      if (distance <= meleeRange) {
        // Check if enemy is within attack cone
        toEnemy.normalize();
        const angle = direction.angleTo(toEnemy);
        const angleDegrees = angle * 180 / Math.PI;
        const maxAngleDegrees = (meleeAngle / 2) * 180 / Math.PI;
        
        console.log(`🎯 PVP Sword angle check - Entity ${entity.id}: Angle ${angleDegrees.toFixed(1)}°, Max angle: ${maxAngleDegrees.toFixed(1)}°`);
        
        if (angle <= meleeAngle / 2) {
          // Enemy is within attack cone - deal damage through combat system
          console.log(`🗡️ PVP Sword hit confirmed! Entity ${entity.id} at distance ${distance.toFixed(2)}, angle ${angleDegrees.toFixed(1)}°`);
          
          if (combatSystem && this.playerEntity) {
            // Queue damage through combat system (which will route to multiplayer for enemies)
            combatSystem.queueDamage(entity, baseDamage, this.playerEntity, 'melee');
            console.log(`💥 Queued ${baseDamage} melee damage to entity ${entity.id} (combo step ${this.swordComboStep})`);
            enemiesHit++;
          }
        } else {
          console.log(`❌ PVP Sword missed - Entity ${entity.id} outside attack cone (${angleDegrees.toFixed(1)}° > ${maxAngleDegrees.toFixed(1)}°)`);
        }
      } else {
        console.log(`❌ PVP Sword missed - Entity ${entity.id} out of range (${distance.toFixed(2)} > ${meleeRange})`);
      }
    });
    
    // Generate rage only if we hit enemies (5 rage per hit, max 5 per swing)
    if (enemiesHit > 0) {
      const gameUI = (window as any).gameUI;
      if (gameUI) {
        const rageBefore = gameUI.getCurrentRage ? gameUI.getCurrentRage() : 'unknown';
        const rageToGain = Math.min(enemiesHit * 5, 5); // 5 rage per hit, max 5 per swing
        gameUI.gainRage(rageToGain);
        const rageAfter = gameUI.getCurrentRage ? gameUI.getCurrentRage() : 'unknown';
        console.log(`🗡️ Gained ${rageToGain} rage from hitting ${enemiesHit} enemies with sword combo ${this.swordComboStep} - Rage: ${rageBefore} → ${rageAfter}`);
      }
    }
  }

  private checkForDashInput(movement: Movement, transform: Transform): void {
    // Check for double-tap on movement keys
    const dashDirections = [
      { key: 'w', direction: new Vector3(0, 0, -1) }, // Forward
      { key: 's', direction: new Vector3(0, 0, 1) },  // Backward
      { key: 'a', direction: new Vector3(-1, 0, 0) }, // Left
      { key: 'd', direction: new Vector3(1, 0, 0) }   // Right
    ];

    for (const { key, direction } of dashDirections) {
      if (this.inputManager.checkDoubleTap(key)) {
        // Debug: Log the double tap detection
        const debugInfo = this.inputManager.getDoubleTapDebugInfo(key);
        console.log(`🔍 Double tap detected for key '${key.toUpperCase()}':`, debugInfo);
        
        // Convert input direction to world space based on camera orientation
        const worldDirection = this.getWorldSpaceDirection(direction);
        
        // Attempt to start dash
        const currentTime = Date.now() / 1000; // Convert to seconds
        const dashStarted = movement.startDash(worldDirection, transform.position, currentTime);
        
        if (dashStarted) {
          console.log(`🏃 Dash started in direction: ${key.toUpperCase()}`);
          // Reset the double-tap state to prevent multiple dashes
          this.inputManager.resetDoubleTap(key);
        } else {
          console.warn(`❌ Dash failed to start for key: ${key.toUpperCase()}`);
        }
        
        break; // Only process one dash per frame
      }
    }
  }

  private handleDashMovement(movement: Movement, transform: Transform): void {
    if (!movement.isDashing) return;

    const currentTime = Date.now() / 1000; // Convert to seconds
    const dashResult = movement.updateDash(currentTime);

    if (dashResult.newPosition) {
      // Apply bounds checking (similar to old implementation)
      const MAX_DASH_BOUNDS = 29; // Maximum distance from origin (matches map boundary)
      const distanceFromOrigin = dashResult.newPosition.length();
      
      if (distanceFromOrigin <= MAX_DASH_BOUNDS) {
        transform.position.copy(dashResult.newPosition);
      } else {
        // Cancel dash if it would move too far from origin
        console.warn(`Dash cancelled: would move too far from origin (${distanceFromOrigin.toFixed(2)} > ${MAX_DASH_BOUNDS})`);
        movement.cancelDash();
      }
    }

    if (dashResult.isComplete) {
      console.log('🏁 Dash completed');
    }
  }

  private handleChargeMovement(movement: Movement, transform: Transform): void {
    if (!movement.isCharging) return;

    const currentTime = Date.now() / 1000; // Convert to seconds
    
    // Check if charge was stopped by collision
    if (this.chargeStoppedByCollision) {
      movement.cancelCharge();
      return;
    }
    
    const chargeResult = movement.updateCharge(currentTime);

    if (chargeResult.newPosition) {
      // Apply bounds checking
      const MAX_CHARGE_BOUNDS = 29; // Maximum distance from origin (matches map boundary)
      const distanceFromOrigin = chargeResult.newPosition.length();
      
      // Check for pillar collision
      const pillarCollision = this.checkPillarCollision(chargeResult.newPosition);
      
      if (distanceFromOrigin > MAX_CHARGE_BOUNDS) {
        // Cancel charge if it would move too far from origin
        console.warn(`Charge cancelled: would move too far from origin (${distanceFromOrigin.toFixed(2)} > ${MAX_CHARGE_BOUNDS})`);
        movement.cancelCharge();
        // Notify sword component that charge was cancelled
        this.onChargeComplete();
      } else if (pillarCollision.hasCollision) {
        // Cancel charge if it would collide with a pillar
        console.warn(`Charge cancelled: would collide with pillar at [${pillarCollision.pillarCenter.toArray().join(', ')}]`);
        movement.cancelCharge();
        // Notify sword component that charge was cancelled
        this.onChargeComplete();
      } else if (!this.chargeStoppedByCollision) {
        // Only update position if not stopped by collision
        transform.position.copy(chargeResult.newPosition);
      }
    }

    if (chargeResult.isComplete || this.chargeStoppedByCollision) {
      console.log('⚔️ Charge movement completed');
      // Notify sword component that charge is complete
      this.onChargeComplete();
    }
  }

  // Define pillar positions (same as in Environment.tsx)
  private readonly PILLAR_POSITIONS = [
    new Vector3(0, 0, -5),        // Front pillar
    new Vector3(-4.25, 0, 2.5),   // Left pillar
    new Vector3(4.25, 0, 2.5)     // Right pillar
  ];
  private readonly PILLAR_RADIUS = 0.7; // Same as PillarCollision.tsx

  private checkPillarCollision(position: Vector3): { hasCollision: boolean; normal: Vector3; pillarCenter: Vector3 } {
    for (const pillarPos of this.PILLAR_POSITIONS) {
      // Only check horizontal distance (ignore Y)
      const horizontalPos = new Vector3(position.x, 0, position.z);
      const pillarHorizontal = new Vector3(pillarPos.x, 0, pillarPos.z);
      const distance = horizontalPos.distanceTo(pillarHorizontal);
      
      if (distance < this.PILLAR_RADIUS) {
        // Calculate normal vector pointing away from pillar center
        const normal = horizontalPos.clone().sub(pillarHorizontal).normalize();
        // Handle case where player is exactly at pillar center
        if (normal.length() === 0) {
          normal.set(1, 0, 0); // Default direction
        }
        return {
          hasCollision: true,
          normal: normal,
          pillarCenter: pillarPos.clone()
        };
      }
    }
    
    return { hasCollision: false, normal: new Vector3(), pillarCenter: new Vector3() };
  }

  private getWorldSpaceDirection(inputDirection: Vector3): Vector3 {
    // Get camera direction vectors
    const cameraDirection = new Vector3();
    this.camera.getWorldDirection(cameraDirection);
    
    // Get camera's right vector
    const cameraRight = new Vector3();
    cameraRight.crossVectors(cameraDirection, new Vector3(0, 1, 0)).normalize();
    
    // Get camera's forward vector (projected on XZ plane)
    const cameraForward = new Vector3();
    cameraForward.crossVectors(new Vector3(0, 1, 0), cameraRight).normalize();

    // Transform input direction to world space
    const worldDirection = new Vector3();
    worldDirection.addScaledVector(cameraRight, inputDirection.x);
    worldDirection.addScaledVector(cameraForward, -inputDirection.z);
    worldDirection.normalize();

    return worldDirection;
  }

  private performDivineStorm(playerTransform: Transform): void {
    // Check if player has enough rage (minimum 20 rage required)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastDivineStorm()) {
      console.log('⚡ Not enough rage to cast Divine Storm (requires minimum 20 rage)');
      return;
    }

    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastDivineStormTime < this.divineStormCooldown) {
      console.log(`⏰ Divine Storm on cooldown for ${(this.divineStormCooldown - (currentTime - this.lastDivineStormTime)).toFixed(1)}s`);
      return;
    }

    // Get current rage amount and consume ALL rage
    const currentRage = gameUI ? gameUI.getCurrentRage() : 40; // Fallback to 40 if gameUI not available
    if (gameUI) {
      gameUI.consumeAllRage(); // Consume all rage instead of just 20
      console.log(`⚡ Consumed ${currentRage} rage for Divine Storm`);
    }

    // Calculate extended duration: base 4 seconds + 1 second per 10 rage consumed
    const baseStormDuration = 1000; // 4 seconds base
    const bonusDuration = Math.floor(currentRage / 10) * 500; // 1 second per 10 rage
    const totalDivineStormDuration = baseStormDuration + bonusDuration;

    console.log(`⚡ Divine Storm activated! Duration: ${totalDivineStormDuration / 1000}s (base: 4s + bonus: ${bonusDuration / 1000}s from ${currentRage} rage)`);
    this.isDivineStorming = true;
    this.lastDivineStormTime = currentTime;
    
    // Trigger Divine Storm callback for multiplayer
    if (this.onDivineStormCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.normalize();
      this.onDivineStormCallback(playerTransform.position.clone(), direction, totalDivineStormDuration);
    }

    // Divine Storm lasts for calculated duration
    setTimeout(() => {
      this.isDivineStorming = false;
      console.log('⚡ Divine Storm completed');
    }, totalDivineStormDuration);
  }

  private performCharge(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastChargeTime < this.chargeCooldown) {
      console.log(`⏰ Charge on cooldown for ${(this.chargeCooldown - (currentTime - this.lastChargeTime)).toFixed(1)}s`);
      return;
    }

    console.log('⚔️ Charge activated!');
    this.isSwordCharging = true;
    this.lastChargeTime = currentTime;
    
    // Reset collision tracking for new charge
    this.chargeStoppedByCollision = false;
    
    // Trigger Charge callback for multiplayer
    if (this.onChargeCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.normalize();
      this.onChargeCallback(playerTransform.position.clone(), direction);
    }
    
    // Gain rage for using charge ability (+20 rage)
    const gameUI = (window as any).gameUI;
    if (gameUI) {
      gameUI.gainRage(20);
      console.log('⚔️ Gained 20 rage from using Charge ability');
    }
    
    // Start the charge movement using the separate charge system
    if (this.playerEntity) {
      const playerMovement = this.playerEntity.getComponent(Movement);
      if (playerMovement) {
        // Get charge direction from camera
        const direction = new Vector3();
        this.camera.getWorldDirection(direction);
        direction.y = 0; // Keep movement horizontal
        direction.normalize();
        
        // Start charge with 10.5 distance (separate from dash system)
        const chargeStarted = playerMovement.startCharge(direction, playerTransform.position, currentTime);
        
        if (chargeStarted) {
          console.log('⚔️ Charge movement started with 10.5 distance');
          
          // Schedule charge damage detection during movement
          this.scheduleChargeDamage(playerTransform, direction, currentTime);
        } else {
          console.warn('⚔️ Charge failed to start (already charging or dashing)');
        }
      }
    }
  }

  // Track charge hit entities to prevent multiple hits and enable collision stopping
  private chargeHitEntities = new Set<number>();
  private chargeStoppedByCollision = false;

  // Schedule damage detection during charge movement
  private scheduleChargeDamage(playerTransform: Transform, chargeDirection: Vector3, startTime: number): void {
    const chargeDuration = 0.75; // Charge lasts about 1.5 seconds
    const damageCheckInterval = 50; // Check for damage every 50ms for better collision detection
    const chargeDamage = 40; // High damage for charge ability
    const chargeRadius = 2.5; // Damage radius around player during charge
    
    // Reset charge hit tracking
    this.chargeHitEntities.clear();
    this.chargeStoppedByCollision = false;
    
    const damageInterval = setInterval(() => {
      const currentTime = Date.now() / 1000;
      
      // Stop if charge is complete, cancelled, or stopped by collision
      if (!this.isSwordCharging || currentTime - startTime > chargeDuration || this.chargeStoppedByCollision) {
        clearInterval(damageInterval);
        return;
      }
      
      // Get all entities in the world to check for damage
      const allEntities = this.world.getAllEntities();
      const playerPosition = playerTransform.position;
      
      let hitSomething = false;
      
      // Debug: Log all entities in the world during charge
      console.log(`🔍 Charge collision check - Total entities in world: ${allEntities.length}`);
      
      // ENHANCED: Also check against server player positions directly as a fallback
      // This ensures we don't miss collisions due to entity sync issues
      const serverPlayers = (window as any).pvpPlayers || new Map();
      const localSocketId = (window as any).localSocketId;
      
      console.log(`🔍 Also checking ${serverPlayers.size} server players directly for collision`);
      
      serverPlayers.forEach((serverPlayer: any, playerId: string) => {
        // Skip self
        if (playerId === localSocketId) return;
        
        // Skip already hit players (use hash of player ID for tracking)
        const playerIdHash = playerId.length * 1000 + playerId.charCodeAt(0);
        if (this.chargeHitEntities.has(playerIdHash)) return;
        
        const serverPlayerPos = new Vector3(serverPlayer.position.x, serverPlayer.position.y, serverPlayer.position.z);
        const distance = playerPosition.distanceTo(serverPlayerPos);
        const stopDistance = 0.9 + 1.0; // Player collision radius + buffer
        
        console.log(`🔍 Direct server player check - ${playerId}: distance=${distance.toFixed(2)}, stopDistance=${stopDistance.toFixed(2)}`);
        
        if (distance <= stopDistance && serverPlayer.health > 0) {
          console.log(`⚔️ Direct server collision detected with player ${playerId}!`);
          this.chargeHitEntities.add(playerIdHash);
          hitSomething = true;
          
          // Apply damage through PVP system if available
          if (this.onProjectileCreatedCallback) {
            this.onProjectileCreatedCallback('sword_charge_hit', playerPosition.clone(), chargeDirection.clone(), {
              damage: chargeDamage,
              targetId: playerId,
              hitPosition: {
                x: serverPlayerPos.x,
                y: serverPlayerPos.y,
                z: serverPlayerPos.z
              }
            });
          }
        }
      });
      
      allEntities.forEach(entity => {
        // Skip self
        if (entity.id === this.playerEntity?.id) return;
        
        // Skip already hit entities
        if (this.chargeHitEntities.has(entity.id)) return;
        
        // Check if entity has transform and health (could be enemy or player)
        const entityTransform = entity.getComponent(Transform);
        const entityHealth = entity.getComponent(Health);
        const entityCollider = entity.getComponent(Collider);
        
        // Debug: Log entity details
        const enemy = entity.getComponent(Enemy);
        const entityType = enemy ? `Enemy(${enemy.getDisplayName()})` : `Player(${entity.id})`;
        console.log(`🔍 Checking entity ${entity.id} (${entityType}): transform=${!!entityTransform}, health=${!!entityHealth}, collider=${!!entityCollider}, isDead=${entityHealth?.isDead}`);
        
        if (!entityTransform || !entityHealth || entityHealth.isDead) return;
        
        const entityPosition = entityTransform.position;
        const distance = playerPosition.distanceTo(entityPosition);
        
        // Check if entity is within charge damage radius
        // In PVP, we want to stop just before hitting the enemy, not overlap with them
        const stopDistance = entityCollider ? entityCollider.radius + 1.0 : chargeRadius; // Stop 1 unit away from enemy edge
        
        // Debug: Log position and distance information
        console.log(`🔍 Entity ${entity.id} (${entityType}): playerPos=[${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)}], entityPos=[${entityPosition.x.toFixed(2)}, ${entityPosition.y.toFixed(2)}, ${entityPosition.z.toFixed(2)}], distance=${distance.toFixed(2)}, stopDistance=${stopDistance.toFixed(2)}, colliderRadius=${entityCollider?.radius || 'none'}`);
        
        if (distance <= stopDistance) {
          // Mark as hit to prevent multiple hits
          this.chargeHitEntities.add(entity.id);
          hitSomething = true;
          
          // Apply damage through combat system
          const combatSystem = this.world.getSystem(CombatSystem);
          if (combatSystem && this.playerEntity) {
            combatSystem.queueDamage(entity, chargeDamage, this.playerEntity, 'charge');
            
            const enemy = entity.getComponent(Enemy);
            const entityType = enemy ? `Enemy(${enemy.getDisplayName()})` : `Player(${entity.id})`;
            console.log(`⚔️ Charge hit ${entityType} for ${chargeDamage} damage at distance ${distance.toFixed(2)}`);
            
            // Broadcast charge attack for PVP (includes damage and animation)
            if (this.onProjectileCreatedCallback) {
              this.onProjectileCreatedCallback('sword_charge_hit', playerPosition.clone(), chargeDirection.clone(), {
                damage: chargeDamage,
                targetId: entity.id,
                hitPosition: {
                  x: entityPosition.x,
                  y: entityPosition.y,
                  z: entityPosition.z
                }
              });
            }
          }
        }
      });
      
      // In PVP mode, stop charge when hitting something
      if (hitSomething) {
        console.log(`⚔️ Charge stopped by collision - ending charge movement`);
        this.chargeStoppedByCollision = true;
        
        // Stop the charge movement immediately
        if (this.playerEntity) {
          const playerMovement = this.playerEntity.getComponent(Movement);
          if (playerMovement) {
            playerMovement.cancelCharge();
          }
        }
        
        // Clear the damage interval immediately to prevent further hits
        clearInterval(damageInterval);
        
        // Trigger charge completion
        this.onChargeComplete();
      }
    }, damageCheckInterval);
  }

  // Called by sword component when Charge completes
  public onChargeComplete(): void {
    console.log('⚔️ Charge completed');
    this.isSwordCharging = false;
  }

  private performDeflect(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastDeflectTime < this.deflectCooldown) {
      console.log(`⏰ Deflect on cooldown for ${(this.deflectCooldown - (currentTime - this.lastDeflectTime)).toFixed(1)}s`);
      return;
    }

    console.log('🛡️ Deflect activated!');
    this.isDeflecting = true;
    this.lastDeflectTime = currentTime;
    
    // Trigger Deflect callback for multiplayer
    if (this.onDeflectCallback) {
      const direction = new Vector3();
      this.camera.getWorldDirection(direction);
      direction.normalize();
      this.onDeflectCallback(playerTransform.position.clone(), direction);
    }
    
    // Set up deflect barrier that blocks damage and reflects projectiles
    this.setupDeflectBarrier(playerTransform);
    
    // Auto-complete deflect after duration
    setTimeout(() => {
      this.onDeflectComplete();
    }, this.deflectDuration * 1000);
  }

  private performViperSting(playerTransform: Transform): void {
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastViperStingTime < this.viperStingFireRate) {
      console.log(`⏰ Viper Sting on cooldown for ${(this.viperStingFireRate - (currentTime - this.lastViperStingTime)).toFixed(1)}s`);
      return;
    }

    // Check if player has enough energy (60 energy cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastViperSting()) {
      console.log('🐍 Not enough energy to cast Viper Sting (requires 60 energy)');
      return;
    }

    // Consume energy
    if (gameUI) {
      gameUI.consumeEnergy(60);
      console.log('🐍 Consumed 60 energy for Viper Sting');
    }

    console.log('🐍 Viper Sting activated - starting charge!');
    this.isViperStingCharging = true;
    this.viperStingChargeProgress = 0;
    this.lastViperStingTime = currentTime;
    
    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 1000; // 1 second charge time
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.viperStingChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.viperStingChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireViperSting(playerTransform);
        this.isViperStingCharging = false;
        this.viperStingChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireViperSting(playerTransform: Transform): void {
    console.log('🐍 Firing Viper Sting projectile!');
    
    // Get player position and direction
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 1; // Shoot from chest level
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    direction.normalize();
    
    // Apply same downward angle compensation as other projectiles
    const compensationAngle = Math.PI / 6; // 30 degrees downward compensation
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    
    // Apply rotation around the right axis to tilt the direction downward
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Offset spawn position slightly forward to avoid collision with player
    const spawnPosition = playerPosition.clone();
    spawnPosition.add(direction.clone().multiplyScalar(1)); // 1 unit forward
    
    // Note: Viper Sting damage is handled by ViperStingManager, not ECS projectiles
    // This prevents duplicate projectiles and damage
    
    // Trigger Viper Sting callback for visual effects
    if (this.onViperStingCallback) {
      this.onViperStingCallback(playerPosition, direction);
    }
    
    // Trigger the global Viper Sting manager for visual effects
    const success = triggerGlobalViperSting();
    if (success) {
      console.log('🐍 Viper Sting visual effects successfully triggered!');
    }
    
    // Broadcast projectile creation to other players
    if (this.onProjectileCreatedCallback) {
      this.onProjectileCreatedCallback('viper_sting_projectile', spawnPosition, direction, {
        speed: 16,
        damage: 61,
        lifetime: 5,
        isReturning: false
      });
    }
  }

  private performBarrage(playerTransform: Transform): void {
    console.log('🏹 performBarrage called!');
    
    // Check cooldown
    const currentTime = Date.now() / 1000;
    if (currentTime - this.lastBarrageTime < this.barrageFireRate) {
      console.log(`⏰ Barrage on cooldown for ${(this.barrageFireRate - (currentTime - this.lastBarrageTime)).toFixed(1)}s`);
      return;
    }

    // Check if player has enough energy (40 energy cost)
    const gameUI = (window as any).gameUI;
    if (gameUI && !gameUI.canCastBarrage()) {
      console.log('🏹 Not enough energy to cast Barrage (requires 40 energy)');
      return;
    }

    // Consume energy
    if (gameUI) {
      gameUI.consumeEnergy(40);
      console.log('🏹 Consumed 40 energy for Barrage');
    }

    console.log('🏹 Barrage activated - starting charge!');
    this.isBarrageCharging = true;
    this.barrageChargeProgress = 0;
    this.lastBarrageTime = currentTime;
    
    // Start charging animation
    const chargeStartTime = Date.now();
    const chargeDuration = 500; // 1 second charge time
    
    const chargeInterval = setInterval(() => {
      const elapsed = Date.now() - chargeStartTime;
      this.barrageChargeProgress = Math.min(elapsed / chargeDuration, 1.0);
      
      if (this.barrageChargeProgress >= 1.0) {
        clearInterval(chargeInterval);
        this.fireBarrage(playerTransform);
        this.isBarrageCharging = false;
        this.barrageChargeProgress = 0;
      }
    }, 16); // ~60fps updates
  }

  private fireBarrage(playerTransform: Transform): void {
    console.log('🏹 Firing Barrage projectiles!');
    
    // Get player position and direction
    const playerPosition = playerTransform.getWorldPosition();
    playerPosition.y += 1; // Shoot from chest level
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    
    // Apply same downward compensation as projectile system
    const compensationAngle = Math.PI / 6; // 30 degrees
    const cameraRight = new Vector3();
    cameraRight.crossVectors(direction, new Vector3(0, 1, 0)).normalize();
    const rotationMatrix = new Matrix4();
    rotationMatrix.makeRotationAxis(cameraRight, compensationAngle);
    direction.applyMatrix4(rotationMatrix);
    direction.normalize();
    
    // Create 5 arrows: center (0°), left (15°, 30°), right (-15°, -30°) using proper ECS projectiles
    const angles = [0, Math.PI / 12, -Math.PI / 12, Math.PI / 6, -Math.PI / 6]; // 0°, 15°, -15°, 30°, -30°
    
    angles.forEach(angle => {
      // Rotate the base direction by the specified angle around the Y axis
      const projectileDirection = direction.clone();
      const rotationMatrix = new Matrix4().makeRotationY(angle);
      projectileDirection.applyMatrix4(rotationMatrix);
      projectileDirection.normalize();
      
      // Offset spawn position slightly forward to avoid collision with player
      const spawnPosition = playerPosition.clone();
      spawnPosition.add(projectileDirection.clone().multiplyScalar(1)); // 1 unit forward
      
      // Create proper ECS projectile entity
      const projectileConfig = {
        speed: 22, // Slightly faster than regular arrows (20)
        damage: 30, // High damage for barrage arrows
        lifetime: 8,
        maxDistance: 25, // Limit barrage arrows to 25 units distance (same as regular arrows)
        piercing: false,
        subclass: this.currentSubclass,
        level: 1,
        opacity: 1.0
      };
      
      const projectileEntity = this.projectileSystem.createProjectile(
        this.world,
        spawnPosition,
        projectileDirection,
        this.playerEntity!.id,
        projectileConfig
      );
      
      // Mark as barrage arrow for visual identification
      const renderer = projectileEntity.getComponent(Renderer) as Renderer;
      if (renderer?.mesh) {
        renderer.mesh.userData.isBarrageArrow = true;
        renderer.mesh.userData.isRegularArrow = false; // Override regular arrow marking
      }
      
      // Broadcast projectile creation to other players
      if (this.onProjectileCreatedCallback) {
        this.onProjectileCreatedCallback('barrage_projectile', spawnPosition, projectileDirection, projectileConfig);
      }
      
      console.log(`🏹 Created Barrage arrow ${projectileEntity.id} at angle ${(angle * 180 / Math.PI).toFixed(1)}°`);
    });
    
    // Trigger Barrage callback for additional visual effects if needed
    if (this.onBarrageCallback) {
      this.onBarrageCallback(playerPosition, direction);
    }
    
    console.log('🏹 Barrage successfully fired with 5 ECS projectiles!');
  }

  private setupDeflectBarrier(playerTransform: Transform): void {
    // Activate the deflect barrier
    const playerPosition = playerTransform.getWorldPosition();
    const playerRotation = new Vector3(0, 0, 0);
    
    // Use SAME rotation logic as DragonRenderer for consistency with visual shield
    if (this.playerEntity) {
      const movement = this.playerEntity.getComponent(Movement);
      if (movement && movement.inputStrength > 0.1) {
        // Player is actively moving - use movement direction (same as DragonRenderer)
        const moveDir = movement.moveDirection;
        if (moveDir.length() > 0.1) {
          const moveAngle = Math.atan2(moveDir.x, moveDir.z);
          playerRotation.y = moveAngle;
        }
      } else {
        // Not moving - use camera direction (same as DragonRenderer fallback)
        const cameraDirection = new Vector3();
        this.camera.getWorldDirection(cameraDirection);
        playerRotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
      }
    }
    
    this.deflectBarrier.activate(playerPosition, playerRotation, this.playerEntity || undefined);
  }

  private updateDeflectBarrier(playerTransform: Transform): void {
    // Update deflect barrier position if it's active
    if (this.deflectBarrier.isBarrierActive()) {
      const playerPosition = playerTransform.getWorldPosition();
      const playerRotation = new Vector3(0, 0, 0);
      
      // Use SAME rotation logic as DragonRenderer for consistency with visual shield
      if (this.playerEntity) {
        const movement = this.playerEntity.getComponent(Movement);
        if (movement && movement.inputStrength > 0.1) {
          // Player is actively moving - use movement direction (same as DragonRenderer)
          const moveDir = movement.moveDirection;
          if (moveDir.length() > 0.1) {
            const moveAngle = Math.atan2(moveDir.x, moveDir.z);
            playerRotation.y = moveAngle;
          }
        } else {
          // Not moving - use camera direction (same as DragonRenderer fallback)
          const cameraDirection = new Vector3();
          this.camera.getWorldDirection(cameraDirection);
          playerRotation.y = Math.atan2(cameraDirection.x, cameraDirection.z);
        }
      }
      
      // Update barrier position to follow player
      this.deflectBarrier.updatePosition(playerPosition, playerRotation);
    }
  }

  // Called by sword component when Deflect completes
  public onDeflectComplete(): void {
    console.log('🛡️ Deflect completed');
    this.isDeflecting = false;
    this.deflectBarrier.deactivate();
  }

  // Public methods to get cooldown information for UI
  public getWeaponSwitchCooldown(): { current: number; max: number } {
    const currentTime = Date.now() / 1000;
    return {
      current: Math.max(0, this.weaponSwitchCooldown - (currentTime - this.lastWeaponSwitchTime)),
      max: this.weaponSwitchCooldown
    };
  }

  public getAbilityCooldowns(): Record<string, { current: number; max: number; isActive: boolean }> {
    const currentTime = Date.now() / 1000;
    
    const cooldowns: Record<string, { current: number; max: number; isActive: boolean }> = {};
    
    if (this.currentWeapon === WeaponType.SWORD) {
      cooldowns['Q'] = {
        current: Math.max(0, this.deflectCooldown - (currentTime - this.lastDeflectTime)),
        max: this.deflectCooldown,
        isActive: this.isDeflecting
      };
      cooldowns['E'] = {
        current: Math.max(0, this.chargeCooldown - (currentTime - this.lastChargeTime)),
        max: this.chargeCooldown,
        isActive: this.isSwordCharging
      };
      cooldowns['R'] = {
        current: Math.max(0, this.divineStormCooldown - (currentTime - this.lastDivineStormTime)),
        max: this.divineStormCooldown,
        isActive: this.isDivineStorming
      };
    } else if (this.currentWeapon === WeaponType.BOW) {
      cooldowns['Q'] = {
        current: Math.max(0, this.barrageFireRate - (currentTime - this.lastBarrageTime)),
        max: this.barrageFireRate,
        isActive: this.isBarrageCharging
      };
      cooldowns['E'] = {
        current: Math.max(0, this.cobraShotFireRate - (currentTime - this.lastCobraShotTime)),
        max: this.cobraShotFireRate,
        isActive: false
      };
      cooldowns['R'] = {
        current: Math.max(0, this.viperStingFireRate - (currentTime - this.lastViperStingTime)),
        max: this.viperStingFireRate,
        isActive: this.isViperStingCharging
      };
    } else if (this.currentWeapon === WeaponType.SCYTHE) {
      cooldowns['Q'] = {
        current: Math.max(0, 1.0 - (currentTime - this.lastReanimateTime)),
        max: 1.0,
        isActive: false
      };
      cooldowns['E'] = {
        current: Math.max(0, this.frostNovaFireRate - (currentTime - this.lastFrostNovaTime)),
        max: this.frostNovaFireRate,
        isActive: false
      };
      cooldowns['R'] = {
        current: Math.max(0, this.crossentropyFireRate - (currentTime - this.lastCrossentropyTime)),
        max: this.crossentropyFireRate,
        isActive: false
      };
    } else if (this.currentWeapon === WeaponType.SABRES) {
      cooldowns['Q'] = {
        current: 0, // No Q ability yet
        max: 0,
        isActive: false
      };
      cooldowns['E'] = {
        current: Math.max(0, this.skyfallCooldown - (currentTime - this.lastSkyfallTime)),
        max: this.skyfallCooldown,
        isActive: this.isSkyfalling
      };
      cooldowns['R'] = {
        current: 0, // No R ability yet
        max: 0,
        isActive: false
      };
    }
    
    return cooldowns;
  }
}