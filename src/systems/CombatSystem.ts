// Combat system for handling damage, healing, and combat mechanics
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Health } from '@/ecs/components/Health';
import { Shield } from '@/ecs/components/Shield';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Renderer } from '@/ecs/components/Renderer';
import { Movement } from '@/ecs/components/Movement';
import { World } from '@/ecs/World';
import { calculateDamage, DamageResult } from '@/core/DamageCalculator';
import { DamageNumberManager } from '@/utils/DamageNumberManager';
import { SummonedUnit } from '@/ecs/components/SummonedUnit';
import { Projectile } from '@/ecs/components/Projectile';
import { WeaponType } from '@/components/dragon/weapons';

interface DamageEvent {
  target: Entity;
  damage: number;
  source?: Entity;
  damageType?: string;
  timestamp: number;
  sourcePlayerId?: string; // Player ID of the source for proper experience attribution
}

interface HealEvent {
  target: Entity;
  amount: number;
  source?: Entity;
  timestamp: number;
}

export class CombatSystem extends System {
  public readonly requiredComponents = [Health];
  private world: World;
  private damageQueue: DamageEvent[] = [];
  private healQueue: HealEvent[] = [];
  private deadEntities: Entity[] = [];
  private damageNumberManager: DamageNumberManager;
  
  // Combat statistics
  private totalDamageDealt = 0;
  private totalHealingDone = 0;
  private enemiesKilled = 0;

  // Multiplayer damage callback for routing enemy damage to server
  private onEnemyDamageCallback?: (enemyId: string, damage: number, sourcePlayerId?: string) => void;
  
  // PVP damage callback for routing player damage to server
  private onPlayerDamageCallback?: (playerId: string, damage: number, damageType?: string) => void;

  // Summoned unit damage callback for routing summoned unit damage to server
  private onSummonedUnitDamageCallback?: (unitId: string, unitOwnerId: string, damage: number, sourcePlayerId: string, damageType?: string) => void;

  // Log throttling to reduce spam
  private lastDamageLogTime = 0;
  private damageLogThrottle = 100; // Only log every 100ms

  // Local player entity ID for distinguishing caster vs target damage numbers
  private localPlayerEntityId: number | null = null;

  constructor(world: World) {
    super();
    this.world = world;
    this.damageNumberManager = new DamageNumberManager();
    this.priority = 25; // Run after collision detection
  }

  private getCurrentWeapon(): WeaponType | undefined {
    // Get current weapon from ControlSystem
    const controlSystemRef = (window as any).controlSystemRef;
    if (controlSystemRef && controlSystemRef.current) {
      return controlSystemRef.current.getCurrentWeapon();
    }
    return undefined;
  }

  // Throttled logging to reduce spam
  private shouldLogDamage(): boolean {
    const now = Date.now();
    if (now - this.lastDamageLogTime > this.damageLogThrottle) {
      this.lastDamageLogTime = now;
      return true;
    }
    return false;
  }

  // Set callback for routing enemy damage to multiplayer server
  public setEnemyDamageCallback(callback: (enemyId: string, damage: number, sourcePlayerId?: string) => void): void {
    this.onEnemyDamageCallback = callback;
  }
  
  // Set callback for routing player damage to multiplayer server (PVP)
  public setPlayerDamageCallback(callback: (playerId: string, damage: number, damageType?: string) => void): void {
    this.onPlayerDamageCallback = callback;
  }

  public setSummonedUnitDamageCallback(callback: (unitId: string, unitOwnerId: string, damage: number, sourcePlayerId: string, damageType?: string) => void): void {
    this.onSummonedUnitDamageCallback = callback;
  }

  // Apply summoned unit damage received from server
  public applySummonedUnitDamage(unitId: string, damage: number, sourcePlayerId: string): void {
    const unitEntity = this.world.getEntity(parseInt(unitId));
    if (!unitEntity) {
      return;
    }

    const health = unitEntity.getComponent(Health);
    const summonedUnitComponent = unitEntity.getComponent(SummonedUnit);
    if (!health || !summonedUnitComponent) {
      return;
    }

    const currentTime = Date.now() / 1000;
    
    // Apply damage locally (pass entity so Health can use Shield component)
    const damageDealt = health.takeDamage(damage, currentTime, unitEntity);

    if (damageDealt) {

      // Check if target died
      if (health.isDead) {
        this.handleEntityDeath(unitEntity, undefined, currentTime);
      }

      // Trigger damage effects
      this.triggerDamageEffects(unitEntity, damage, undefined, 'melee', false);
    }
  }

  public update(entities: Entity[], deltaTime: number): void {
    const currentTime = Date.now() / 1000;

    // Update health components (regeneration, invulnerability timers)
    this.updateHealthComponents(entities, deltaTime, currentTime);

    // Process damage queue
    this.processDamageQueue(currentTime);

    // Process heal queue
    this.processHealQueue(currentTime);

    // Handle death and respawn
    this.handleDeathAndRespawn(entities, currentTime);

    // Cleanup old damage numbers
    this.damageNumberManager.cleanup();

    // Clear processed queues
    this.damageQueue.length = 0;
    this.healQueue.length = 0;
    this.deadEntities.length = 0;
  }

  private updateHealthComponents(entities: Entity[], deltaTime: number, currentTime: number): void {
    for (const entity of entities) {
      const health = entity.getComponent(Health);
      
      // Skip if required Health component is missing
      if (!health || !health.enabled) continue;

      // Update health component (handles regeneration and invulnerability)
      health.update(deltaTime, currentTime);

      // Update shield component if it exists
      const shield = entity.getComponent(Shield);
      if (shield) {
        shield.update(deltaTime);
      }

      // Update debuff statuses for enemies
      const enemy = entity.getComponent(Enemy);
      if (enemy) {
        enemy.updateFreezeStatus(currentTime);
        enemy.updateCorruptedStatus(currentTime);
        
        // Synchronize enemy debuffs with movement component
        this.synchronizeEnemyDebuffsWithMovement(entity, enemy);
      }
    }
  }

  private processDamageQueue(currentTime: number): void {
    for (const damageEvent of this.damageQueue) {
      this.applyDamage(damageEvent, currentTime);
    }
  }

  private processHealQueue(currentTime: number): void {
    for (const healEvent of this.healQueue) {
      this.applyHealing(healEvent, currentTime);
    }
  }

  private applyDamage(damageEvent: DamageEvent, currentTime: number): void {
    const { target, damage: baseDamage, source, damageType, sourcePlayerId } = damageEvent;

    const health = target.getComponent(Health);
    if (!health || !health.enabled) return;

    // Import SummonedUnit component dynamically to avoid circular dependency
    const SummonedUnit = require('@/ecs/components/SummonedUnit').SummonedUnit;

    // Debug: Log all damage events for charge damage
    if (damageType === 'charge') {
      const enemy = target.getComponent(Enemy);
      const summonedUnitComponent = target.getComponent(SummonedUnit);
      const summonedUnit = summonedUnitComponent ? summonedUnitComponent as typeof SummonedUnit.prototype : null;
      const entityType = enemy ? `Enemy(${enemy.getDisplayName()})` : summonedUnit ? `SummonedUnit(${summonedUnit.getDisplayName()})` : `Player(${target.id})`;
    }

    // Check if target is an enemy - if so, route damage through multiplayer
    const enemy = target.getComponent(Enemy);
    if (enemy && this.onEnemyDamageCallback) {
      // Calculate actual damage with critical hit mechanics
      const currentWeapon = this.getCurrentWeapon();
      const damageResult: DamageResult = calculateDamage(baseDamage, currentWeapon);
      const actualDamage = damageResult.damage;

      // Get source player ID for proper kill attribution
      // Use the sourcePlayerId from damage event if available, otherwise extract from source entity
      let finalSourcePlayerId = sourcePlayerId;
      if (!finalSourcePlayerId && source) {
        // Check if source is a projectile with stored player info
        const projectileComponent = source.getComponent(Projectile);
        if (projectileComponent && (projectileComponent as any).sourcePlayerId) {
          finalSourcePlayerId = (projectileComponent as any).sourcePlayerId;
        } else if (source.userData?.playerId) {
          finalSourcePlayerId = source.userData.playerId;
        }
      }

      // Route enemy damage through multiplayer server instead of applying locally
      // console.log(`🌐 Routing ${actualDamage} damage to enemy ${target.id} through multiplayer server from source player ${finalSourcePlayerId || 'unknown'}`);
      this.onEnemyDamageCallback(target.id.toString(), actualDamage, finalSourcePlayerId);

      // Apply Runeblade Arcane Mastery passive healing (10% of damage dealt)
      if (source && currentWeapon === WeaponType.RUNEBLADE) {
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current) {
          const controlSystem = controlSystemRef.current;
          // Check if Runeblade passive is unlocked
          const weaponSlot = controlSystem.selectedWeapons?.primary === WeaponType.RUNEBLADE ? 'primary' :
                            controlSystem.selectedWeapons?.secondary === WeaponType.RUNEBLADE ? 'secondary' : null;
          if (weaponSlot && controlSystem.isPassiveAbilityUnlocked && controlSystem.isPassiveAbilityUnlocked('P', WeaponType.RUNEBLADE, weaponSlot)) {
            const healingAmount = Math.floor(actualDamage * 0.1); // 10% of damage dealt
            if (healingAmount > 0) {
              // Apply healing to source player
              const sourceHealth = source.getComponent(Health);
              if (sourceHealth) {
                sourceHealth.heal(healingAmount);

                // Create healing number for visual feedback
                const sourceTransform = source.getComponent(Transform);
                if (sourceTransform) {
                  const healPosition = sourceTransform.getWorldPosition().clone();
                  healPosition.y += 1.5;
                  this.damageNumberManager.addDamageNumber(healingAmount, false, healPosition, 'healing');
                }
              }
            }
          }
        }
      }

      // Skip damage numbers for tower projectiles - players will see their own damage taken display
      const isTowerProjectile = source && (source as any).isTowerProjectile === true;
      if (!isTowerProjectile) {
        // Still create local damage numbers for immediate visual feedback
        const transform = target.getComponent(Transform);
        if (transform) {
          const position = transform.getWorldPosition();
          position.y += 1.5;
          this.damageNumberManager.addDamageNumber(
            actualDamage,
            damageResult.isCritical,
            position,
            damageType
          );
        }
      }

      // Log for debugging
      const sourceName = source ? `Entity ${source.id}` : 'Unknown';
      const targetName = this.getEntityDisplayName(target);
      const critText = damageResult.isCritical ? ' CRITICAL' : '';

      return; // Don't apply damage locally for enemies
    }

    // Check if target is a summoned unit - route through server for synchronization
    const summonedUnitComponent = target.getComponent(SummonedUnit);
    if (summonedUnitComponent && this.onSummonedUnitDamageCallback) {
      // Cast to proper type
      const summonedUnit = summonedUnitComponent as typeof SummonedUnit.prototype;

      // Calculate actual damage with critical hit mechanics
      const currentWeapon = this.getCurrentWeapon();
      const damageResult: DamageResult = calculateDamage(baseDamage, currentWeapon);
      const actualDamage = damageResult.damage;

      // Get source player ID for team validation
      // Use the sourcePlayerId from damage event if available, otherwise extract from source entity
      let finalSourcePlayerId = sourcePlayerId || 'unknown';
      if (finalSourcePlayerId === 'unknown' && source) {
        // Check if source is a projectile with stored player info
        const projectileComponent = source.getComponent(Projectile);
        if (projectileComponent && (projectileComponent as any).sourcePlayerId) {
          finalSourcePlayerId = (projectileComponent as any).sourcePlayerId;
        } else if (source.userData?.playerId) {
          finalSourcePlayerId = source.userData.playerId;
        }
      }

      // Get the server unit ID from userData (set during ECS sync)
      const serverUnitId = target.userData?.serverUnitId || summonedUnit.unitId;
      const serverUnitOwnerId = target.userData?.serverUnitOwnerId || summonedUnit.ownerId;

      // Route summoned unit damage through multiplayer server instead of applying locally
      console.log(`🌐 Routing ${actualDamage} damage to summoned unit ${serverUnitId} (owned by ${serverUnitOwnerId}) from source player ${finalSourcePlayerId} through multiplayer server`);

      // Debug: Log the source information
      if (source) {
        const projectileComponent = source.getComponent(Projectile);
        console.log(`🔍 Source entity ${source.id} - projectile sourcePlayerId: ${(projectileComponent as any)?.sourcePlayerId}, userData playerId: ${source.userData?.playerId}`);
      }

      // Debug: Log the team validation check
      console.log(`🛡️ Team validation: sourcePlayerId="${finalSourcePlayerId}" vs unitOwnerId="${serverUnitOwnerId}" - ${finalSourcePlayerId === serverUnitOwnerId ? 'BLOCKED (same team)' : 'ALLOWED (different teams)'}`);

      // Block damage to own units
      if (finalSourcePlayerId === serverUnitOwnerId) {
        console.log(`🚫 Blocked damage to own summoned unit`);
        return;
      }

      // Additional check: Don't send damage for units that are already dead locally
      if (health.isDead || health.currentHealth <= 0) {
        console.log(`🚫 Blocked damage to already dead summoned unit ${serverUnitId}`);
        return;
      }
      
      // Call the server damage callback with server unit ID
      this.onSummonedUnitDamageCallback(
        serverUnitId,
        serverUnitOwnerId,
        actualDamage,
        finalSourcePlayerId,
        damageType
      );

      // Apply Runeblade Arcane Mastery passive healing (10% of damage dealt)
      if (source && currentWeapon === WeaponType.RUNEBLADE) {
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current) {
          const controlSystem = controlSystemRef.current;
          // Check if Runeblade passive is unlocked
          const weaponSlot = controlSystem.selectedWeapons?.primary === WeaponType.RUNEBLADE ? 'primary' :
                            controlSystem.selectedWeapons?.secondary === WeaponType.RUNEBLADE ? 'secondary' : null;
          if (weaponSlot && controlSystem.isPassiveAbilityUnlocked && controlSystem.isPassiveAbilityUnlocked('P', WeaponType.RUNEBLADE, weaponSlot)) {
            const healingAmount = Math.floor(actualDamage * 0.1); // 10% of damage dealt
            if (healingAmount > 0) {
              // Apply healing to source player
              const sourceHealth = source.getComponent(Health);
              if (sourceHealth) {
                sourceHealth.heal(healingAmount);

                // Create healing number for visual feedback
                const sourceTransform = source.getComponent(Transform);
                if (sourceTransform) {
                  const healPosition = sourceTransform.getWorldPosition().clone();
                  healPosition.y += 1.5;
                  this.damageNumberManager.addDamageNumber(healingAmount, false, healPosition, 'healing');
                }
              }
            }
          }
        }
      }

      // Skip damage numbers for tower projectiles or summoned units - players will see their own damage taken display
      const isTowerProjectile = source && (source as any).isTowerProjectile === true;
      const sourceSummonedUnit = source ? source.getComponent(SummonedUnit) : null;
      const shouldShowDamageNumbers = !sourceSummonedUnit && !isTowerProjectile; // Show numbers unless source is a summoned unit or tower projectile

      if (shouldShowDamageNumbers) {
        const transform = target.getComponent(Transform);
        if (transform) {
          const position = transform.getWorldPosition();
          // Only create damage number if position is valid
          if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
            // Offset slightly above the target
            position.y += 2;
            this.damageNumberManager.addDamageNumber(
              actualDamage,
              damageResult.isCritical,
              position,
              damageType || 'melee'
            );
          }
        }
      }

      return; // Don't apply damage locally for summoned units
    }

    // Fallback: If no callback is set, apply damage locally (for single-player or testing)
    if (summonedUnitComponent && !this.onSummonedUnitDamageCallback) {
      // Cast to proper type
      const summonedUnit = summonedUnitComponent as typeof SummonedUnit.prototype;

      // Get source player ID for team validation (same logic as above)
      // Use the sourcePlayerId from damage event if available, otherwise extract from source entity
      let finalSourcePlayerId = sourcePlayerId || 'unknown';
      if (finalSourcePlayerId === 'unknown' && source) {
        const projectileComponent = source.getComponent(Projectile);
        if (projectileComponent && (projectileComponent as any).sourcePlayerId) {
          finalSourcePlayerId = (projectileComponent as any).sourcePlayerId;
        } else if (source.userData?.playerId) {
          finalSourcePlayerId = source.userData.playerId;
        }
      }

      // TEMPORARY: Block all damage to own units for testing (even in fallback)
      if (finalSourcePlayerId === summonedUnit.ownerId) {
        console.warn(`🚫 FALLBACK BLOCKED: Player ${finalSourcePlayerId} tried to damage their own summoned unit ${target.id}`);
        return; // Block the damage
      }

      // Calculate actual damage with critical hit mechanics
      const currentWeapon = this.getCurrentWeapon();
      const damageResult: DamageResult = calculateDamage(baseDamage, currentWeapon);
      const actualDamage = damageResult.damage;

      // Apply damage locally (pass entity so Health can use Shield component)
      const damageDealt = health.takeDamage(actualDamage, currentTime, target);

      if (damageDealt) {
        this.totalDamageDealt += actualDamage;

        // Skip damage numbers for tower projectiles or summoned units - players will see their own damage taken display
        const isTowerProjectile = source && (source as any).isTowerProjectile === true;
        const sourceSummonedUnit = source ? source.getComponent(SummonedUnit) : null;
        const shouldShowDamageNumbers = !sourceSummonedUnit && !isTowerProjectile; // Show numbers unless source is a summoned unit or tower projectile

        if (shouldShowDamageNumbers) {
          // Create damage number at target position for damage from players/enemies
          const transform = target.getComponent(Transform);
          if (transform) {
            const position = transform.getWorldPosition();
            // Only create damage number if position is valid
            if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
              // Offset slightly above the target
              position.y += 2;
              this.damageNumberManager.addDamageNumber(
                actualDamage,
                damageResult.isCritical,
                position,
                damageType || 'melee'
              );
            }
          }
        }

        // Log for debugging (throttled to reduce spam)
        if (this.shouldLogDamage()) {
          const sourceName = source ? `Entity ${source.id}` : 'Unknown';
          const targetName = summonedUnit.getDisplayName();
          const critText = damageResult.isCritical ? ' CRITICAL' : '';
          // console.log(`⚔️ ${sourceName} dealt ${actualDamage}${critText} ${damageType || 'damage'} to ${targetName} (${health.currentHealth}/${health.maxHealth} HP)`);
        }

        // Check if target died
        if (health.isDead) {
          this.handleEntityDeath(target, source, currentTime, finalSourcePlayerId);
        }

        // Trigger damage effects
        this.triggerDamageEffects(target, actualDamage, source, damageType, damageResult.isCritical);
      }

      return; // Don't process further for summoned units
    }

    // Check if target is a player in PVP mode - if so, route damage through multiplayer
    // Also prevent self-damage in PVP (source hitting themselves)
    if (!enemy && this.onPlayerDamageCallback && source && source.id !== target.id) {
      // Check if this is a Cryoflame-enhanced Entropic Bolt
      const isCryoflameBolt = damageType === 'entropic' && source.getComponent(Renderer)?.mesh?.userData?.isCryoflame === true;

      // Apply burning stacks for Entropic Bolt and Crossentropy Bolt (but not for Cryoflame)
      let finalDamage = baseDamage;
      if ((damageType === 'entropic' || damageType === 'crossentropy') && !isCryoflameBolt) {
        // Get the ControlSystem to apply burning stacks
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current) {
          const controlSystem = controlSystemRef.current;
          const isEntropicBolt = damageType === 'entropic';

          // Check if we recently applied burning stacks to prevent spam
          const lastBurningStackTime = (target as any)._lastBurningStackTime || 0;
          if (currentTime - lastBurningStackTime > 0.1) { // 100ms cooldown between burning stack applications
            // Apply burning stack and get damage bonus
            const { damageBonus } = controlSystem.applyBurningStack(target.id, currentTime, isEntropicBolt);

            // Cap burning damage in PVP to prevent extreme values that cause desync
            const maxBurningBonus = isEntropicBolt ? 15 : 100; // Max +15 for Entropic, +100 for Crossentropy in PVP
            const cappedBonus = Math.min(damageBonus, maxBurningBonus);
            finalDamage = baseDamage + cappedBonus;

            // Mark when we last applied burning stacks to this target
            (target as any)._lastBurningStackTime = currentTime;

            if (cappedBonus < damageBonus) {
              console.log(`🔥 Applied burning stack to player ${target.id}: base damage ${baseDamage} + bonus ${cappedBonus}/${damageBonus} (CAPPED FOR PVP) = ${finalDamage}`);
            } else {
              console.log(`🔥 Applied burning stack to player ${target.id}: base damage ${baseDamage} + bonus ${cappedBonus} = ${finalDamage}`);
            }
          } else {
            // Use existing burning stack bonus without incrementing
            const existingStacks = controlSystem.getBurningStacks(target.id);
            const rawDamageBonus = isEntropicBolt ? existingStacks : existingStacks * 20;

            // Cap burning damage in PVP to prevent extreme values that cause desync
            const maxBurningBonus = isEntropicBolt ? 15 : 100; // Max +15 for Entropic, +100 for Crossentropy in PVP
            const cappedBonus = Math.min(rawDamageBonus, maxBurningBonus);
            finalDamage = baseDamage + cappedBonus;

            if (cappedBonus < rawDamageBonus) {
              console.log(`🔥 Using existing burning stack bonus for player ${target.id}: base damage ${baseDamage} + bonus ${cappedBonus}/${rawDamageBonus} (CAPPED FOR PVP) = ${finalDamage}`);
            } else {
              console.log(`🔥 Using existing burning stack bonus for player ${target.id}: base damage ${baseDamage} + bonus ${cappedBonus} = ${finalDamage}`);
            }
          }
        }
      }

      // Apply Cryoflame double damage to frozen enemies BEFORE critical calculation
      if (isCryoflameBolt) {
        // Check if target is frozen using the debuff system
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current) {
          const controlSystem = controlSystemRef.current;
          const isFrozen = controlSystem.isPlayerStunned(target.id); // Now checks both stunned and frozen
          if (isFrozen) {
            // Double the damage for frozen enemies BEFORE critical calculation
            finalDamage *= 2;
            console.log(`🧊 Cryoflame: Doubled base damage to frozen enemy ${target.id}: ${finalDamage}`);
          }
        }
      }

      // Calculate actual damage with critical hit mechanics (using modified damage)
      const currentWeapon = this.getCurrentWeapon();
      let damageResult: DamageResult = calculateDamage(finalDamage, currentWeapon);

      // Debug logging for sabre damage
      if (damageType?.includes('sabre')) {
        console.log(`🎯 SABRE CRIT CALC - Base: ${finalDamage}, Final: ${damageResult.damage}, Critical: ${damageResult.isCritical}, Type: ${damageType}`);
      }

      // Route player damage through multiplayer server for PVP (let receiver handle shields)
      if (this.shouldLogDamage()) {
        // console.log(`⚔️ Routing ${damageResult.damage} PVP ${damageType || 'damage'} to player ${target.id} through multiplayer server`);
      }
      this.onPlayerDamageCallback(target.id.toString(), damageResult.damage, damageType); // Send damage, let receiver handle shields

      // Apply Runeblade Arcane Mastery passive healing (10% of damage dealt)
      if (source && currentWeapon === WeaponType.RUNEBLADE) {
        const controlSystemRef = (window as any).controlSystemRef;
        if (controlSystemRef && controlSystemRef.current) {
          const controlSystem = controlSystemRef.current;
          // Check if Runeblade passive is unlocked
          const weaponSlot = controlSystem.selectedWeapons?.primary === WeaponType.RUNEBLADE ? 'primary' :
                            controlSystem.selectedWeapons?.secondary === WeaponType.RUNEBLADE ? 'secondary' : null;
          if (weaponSlot && controlSystem.isPassiveAbilityUnlocked && controlSystem.isPassiveAbilityUnlocked('P', WeaponType.RUNEBLADE, weaponSlot)) {
            const healingAmount = Math.floor(damageResult.damage * 0.1); // 10% of damage dealt
            if (healingAmount > 0) {
              // Apply healing to source player
              const sourceHealth = source.getComponent(Health);
              if (sourceHealth) {
                sourceHealth.heal(healingAmount);

                // Create healing number for visual feedback
                const sourceTransform = source.getComponent(Transform);
                if (sourceTransform) {
                  const healPosition = sourceTransform.getWorldPosition().clone();
                  healPosition.y += 1.5;
                  this.damageNumberManager.addDamageNumber(healingAmount, false, healPosition, 'healing');
                }
              }
            }
          }
        }
      }

      // Skip damage numbers for tower projectiles and specific projectile types that use damage taken system
      // Exception: Show damage numbers for crossentropy and entropic bolts when local player is the caster (not the target)
      const isTowerProjectile = source && (source as any).isTowerProjectile === true;
      const isProjectileWithDamageTaken = damageType === 'crossentropy' || damageType === 'entropic' || damageType === 'projectile';
      const isLocalPlayerCaster = this.localPlayerEntityId !== null && this.localPlayerEntityId !== target.id;
      const shouldShowDamageNumbers = !isTowerProjectile && (!isProjectileWithDamageTaken || (isProjectileWithDamageTaken && isLocalPlayerCaster));

      if (shouldShowDamageNumbers) {
        // Create local damage numbers for immediate visual feedback
        const transform = target.getComponent(Transform);
        if (transform) {
          const position = transform.getWorldPosition();
          // Only create damage number if position is valid
          if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
            position.y += 1.5;

            // Add slight position offset for delayed damage (like sabres right hit) to prevent overlap
            if (damageType === 'sabres_right') {
              position.x += 0.3; // Slight offset to the right for the right sabre
            } else if (damageType === 'sabres_left') {
              position.x -= 0.3; // Slight offset to the left for the left sabre
            }

            this.damageNumberManager.addDamageNumber(
              damageResult.damage, // Show the full damage in damage numbers
              damageResult.isCritical,
              position,
              damageType || 'pvp'
            );
          } else {
            // console.warn('⚠️ Skipping PVP damage number creation - invalid position:', position);
          }
        }
      }

      // Log for debugging (throttled to reduce spam)
      if (this.shouldLogDamage()) {
        const sourceName = source ? `Player ${source.id}` : 'Unknown';
        const targetName = `Player ${target.id}`;
        const critText = damageResult.isCritical ? ' CRITICAL' : '';
        // console.log(`⚔️ ${sourceName} dealt ${damageResult.damage}${critText} PVP ${damageType || 'damage'} to ${targetName} (routed to server)`);
      }

      return; // Don't apply damage locally for PVP players
    }

    // For non-enemies and non-summoned units (like players in non-PVP mode), apply damage locally as before
    const currentWeapon = this.getCurrentWeapon();
    const damageResult: DamageResult = calculateDamage(baseDamage, currentWeapon);
    const actualDamage = damageResult.damage;

    // Apply damage (pass entity so Health can use Shield component)
    const damageDealt = health.takeDamage(actualDamage, currentTime, target);

    if (damageDealt) {
      this.totalDamageDealt += actualDamage;

      // Skip damage numbers for tower projectiles - players will see their own damage taken display
      const isTowerProjectile = source && (source as any).isTowerProjectile === true;
      if (!isTowerProjectile) {
        // Create damage number at target position
        const transform = target.getComponent(Transform);
        if (transform) {
          const position = transform.getWorldPosition();
          // Only create damage number if position is valid
          if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
            // Offset slightly above the target
            position.y += 3;
            this.damageNumberManager.addDamageNumber(
              actualDamage,
              damageResult.isCritical,
              position,
              damageType
            );
          } else {
            // console.warn('⚠️ Skipping damage number creation - invalid position:', position);
          }
        }
      }

      // Log damage for debugging (throttled to reduce spam)
      if (this.shouldLogDamage()) {
        const sourceName = source ? `Entity ${source.id}` : 'Unknown';
        const targetName = this.getEntityDisplayName(target);
        const critText = damageResult.isCritical ? ' CRITICAL' : '';
        // console.log(`💥 ${sourceName} dealt ${actualDamage}${critText} ${damageType || 'damage'} to ${targetName} (${health.currentHealth}/${health.maxHealth} HP)`);
      }

        // Check if target died
        if (health.isDead) {
          // Only handle death locally if this is not an enemy in multiplayer mode
          // Enemy deaths in multiplayer/PVP mode are handled by the server
          const enemy = target.getComponent(Enemy);
          const shouldHandleDeathLocally = !enemy || !this.onEnemyDamageCallback;
          
          if (shouldHandleDeathLocally) {
            // Try to get source player ID from the source entity
            let sourcePlayerIdForDeath: string | undefined;
            if (source) {
              const projectileComponent = source.getComponent(Projectile);
              if (projectileComponent && (projectileComponent as any).sourcePlayerId) {
                sourcePlayerIdForDeath = (projectileComponent as any).sourcePlayerId;
              } else if (source.userData?.playerId) {
                sourcePlayerIdForDeath = source.userData.playerId;
              }
            }
            this.handleEntityDeath(target, source, currentTime, sourcePlayerIdForDeath);
          } else {
            // Enemy death in multiplayer mode - let server handle experience and death effects
            console.log(`🌐 Enemy ${target.id} died locally but death handling is deferred to server in multiplayer mode`);
          }
        }

      // Trigger damage effects
      this.triggerDamageEffects(target, actualDamage, source, damageType, damageResult.isCritical);
    }
  }

  private applyHealing(healEvent: HealEvent, currentTime: number): void {
    const { target, amount, source } = healEvent;
    
    const health = target.getComponent(Health);
    if (!health || !health.enabled) return;

    // Apply healing
    const healingDone = health.heal(amount);
    
    if (healingDone) {
      this.totalHealingDone += amount;
      
      // Log healing for debugging
      const sourceName = source ? `Entity ${source.id}` : 'Unknown';
      const targetName = this.getEntityDisplayName(target);
      // console.log(`💚 ${sourceName} healed ${targetName} for ${amount} HP (${health.currentHealth}/${health.maxHealth} HP)`);

      // Trigger healing effects
      this.triggerHealingEffects(target, amount, source);
    }
  }

  private handleEntityDeath(entity: Entity, killer?: Entity, currentTime?: number, sourcePlayerId?: string): void {
    const enemy = entity.getComponent(Enemy);

    if (enemy) {
      enemy.die(currentTime || Date.now() / 1000);
      this.enemiesKilled++;

      // console.log(`💀 ${enemy.getDisplayName()} has been defeated!`);

      // Award experience to killer if it's a player - only for killing blows
      // IMPORTANT: Only award experience in single-player mode or when enemy callback is not set
      // In multiplayer/PVP mode, enemy damage should be routed through server, not processed locally
      if (sourcePlayerId && sourcePlayerId !== 'unknown' && !this.onEnemyDamageCallback) {
        console.log(`🏆 Player ${sourcePlayerId} killed enemy in single-player mode! Awarding +10 EXP for player kill`);
        // Award +10 EXP for player kills (increased from +5 as requested)
        // This should only happen in single-player mode where onEnemyDamageCallback is not set
        this.onPlayerDamageCallback?.(sourcePlayerId, 0, 'player_kill');

        // Check for Scythe Soul Harvest passive (+5 mana per kill)
        this.applyScythePassiveReward(sourcePlayerId);
      } else if (sourcePlayerId && sourcePlayerId !== 'unknown' && this.onEnemyDamageCallback) {
        console.log(`⚠️ Enemy death processed locally in multiplayer mode - this should not happen! Enemy: ${enemy.getDisplayName()}, Player: ${sourcePlayerId}`);
        // Don't award experience here - it should be handled by the server/multiplayer system
      }

      // Trigger death effects
      this.triggerDeathEffects(entity, killer);
    }

    // Handle SummonedUnit death
    const SummonedUnit = require('@/ecs/components/SummonedUnit').SummonedUnit;
    const summonedUnitComponent = entity.getComponent(SummonedUnit);
    if (summonedUnitComponent) {
      const summonedUnit = summonedUnitComponent as typeof SummonedUnit.prototype;
      summonedUnit.die(currentTime || Date.now() / 1000);

      // Immediately disable to prevent further targeting
      summonedUnit.isActive = false;

      console.log(`💀 ${summonedUnit.getDisplayName()} has been defeated!`);

      // Award experience for killing blows on enemy summoned units (only if killer is a player, not tower/summoned unit)
      if (sourcePlayerId && sourcePlayerId !== 'unknown' && this.onPlayerDamageCallback) {
        // Only award experience if it's an enemy summoned unit (not the player's own unit)
        if (summonedUnit.ownerId !== sourcePlayerId) {
          console.log(`🎯 Player ${sourcePlayerId} killed enemy summoned unit owned by ${summonedUnit.ownerId}! Awarding +5 EXP`);
          // Award +5 EXP for killing enemy summoned units
          this.onPlayerDamageCallback(sourcePlayerId, 0, 'summoned_unit_kill');
        } else {
          console.log(`🤝 Player ${sourcePlayerId} killed their own summoned unit - no EXP awarded`);
        }
      }

      // Trigger death effects for summoned units
      this.triggerDeathEffects(entity, killer);
    }

    this.deadEntities.push(entity);
  }

  private handleDeathAndRespawn(entities: Entity[], currentTime: number): void {
    for (const entity of entities) {
      const health = entity.getComponent(Health);
      const enemy = entity.getComponent(Enemy);
      
      if (!health || !enemy) continue;

      // Handle respawn for enemies
      if (enemy.isDead && enemy.canRespawnNow(currentTime)) {
        this.respawnEnemy(entity, enemy, health);
      }
    }
  }

  private respawnEnemy(entity: Entity, enemy: Enemy, health: Health): void {
    // Respawn the enemy
    enemy.respawn();
    health.revive();
    
    // console.log(`🔄 ${enemy.getDisplayName()} has respawned!`);
    
    // Trigger respawn effects
    this.triggerRespawnEffects(entity);
  }

  private triggerDamageEffects(target: Entity, damage: number, source?: Entity, damageType?: string, isCritical?: boolean): void {
    // This can be extended to trigger particle effects, screen shake, etc.
    // For now, we'll just handle basic effects
    
    const transform = target.getComponent(Transform);
    if (transform) {
      // Could trigger damage number popup, blood effects, etc.
      // For now, just log the position where damage occurred
      const critText = isCritical ? ' (CRITICAL)' : '';
      // console.log(`🎯 Damage effect${critText} at position:`, transform.position);
    }

    // Handle special projectile effects
    if (damageType === 'projectile' && source) {
      const sourceRenderer = source.getComponent(Renderer);
      if (sourceRenderer?.mesh?.userData?.isBarrageArrow) {
        // console.log(`🏹 Barrage arrow hit detected, applying slow effect to target ${target.id}`);
        const targetMovement = target.getComponent(Movement);
        if (targetMovement) {
          targetMovement.slow(5000, 0.5); // 5 seconds, 50% speed
          // console.log(`🐌 Applied 50% slow for 5 seconds to target ${target.id}`);
        }
      }
    }
  }

  private triggerHealingEffects(target: Entity, amount: number, source?: Entity): void {
    // This can be extended to trigger healing particle effects
    const transform = target.getComponent(Transform);
    if (transform) {
      // console.log(`✨ Healing effect at position:`, transform.position);
    }
  }

  private triggerDeathEffects(entity: Entity, killer?: Entity): void {
    // This can be extended to trigger death animations, loot drops, etc.
    const transform = entity.getComponent(Transform);
    if (transform) {
      // console.log(`💀 Death effect at position:`, transform.position);
    }
  }

  private triggerRespawnEffects(entity: Entity): void {
    // This can be extended to trigger respawn animations, effects, etc.
    const transform = entity.getComponent(Transform);
    if (transform) {
      // console.log(`🌟 Respawn effect at position:`, transform.position);
    }
  }

  private awardExperience(entity: Entity, experience: number): void {
    // This would integrate with a progression system
    // console.log(`⭐ Entity ${entity.id} gained ${experience} experience!`);
  }

  private getEntityDisplayName(entity: Entity): string {
    const enemy = entity.getComponent(Enemy);
    if (enemy) {
      return enemy.getDisplayName();
    }

    // Import SummonedUnit component dynamically to avoid circular dependency
    const SummonedUnit = require('@/ecs/components/SummonedUnit').SummonedUnit;
    const summonedUnitComponent = entity.getComponent(SummonedUnit);
    if (summonedUnitComponent) {
      const summonedUnit = summonedUnitComponent as typeof SummonedUnit.prototype;
      return summonedUnit.getDisplayName();
    }

    // Could check for other components that provide names
    return `Entity ${entity.id}`;
  }

  // Public API for other systems to queue damage and healing
  public queueDamage(
    target: Entity,
    damage: number,
    source?: Entity,
    damageType?: string,
    sourcePlayerId?: string
  ): void {
    this.damageQueue.push({
      target,
      damage,
      source,
      damageType,
      timestamp: Date.now() / 1000,
      sourcePlayerId
    });
  }

  public queueHealing(
    target: Entity, 
    amount: number, 
    source?: Entity
  ): void {
    this.healQueue.push({
      target,
      amount,
      source,
      timestamp: Date.now() / 1000
    });
  }

  // Immediate damage/healing (bypasses queue)
  public dealDamageImmediate(
    target: Entity,
    damage: number,
    source?: Entity,
    damageType?: string,
    sourcePlayerId?: string
  ): boolean {
    const health = target.getComponent(Health);
    if (!health || !health.enabled) return false;

    // Import SummonedUnit component dynamically to avoid circular dependency
    const SummonedUnit = require('@/ecs/components/SummonedUnit').SummonedUnit;

    // Check if target is a summoned unit - skip damage numbers only if source is also a summoned unit
    const summonedUnitComponent = target.getComponent(SummonedUnit);
    if (summonedUnitComponent) {
      // Calculate actual damage with critical hit mechanics
      const currentWeapon = this.getCurrentWeapon();
      const damageResult: DamageResult = calculateDamage(damage, currentWeapon);
      const actualDamage = damageResult.damage;

      const currentTime = Date.now() / 1000;
      const damageDealt = health.takeDamage(actualDamage, currentTime, target);

      if (damageDealt) {
        this.totalDamageDealt += actualDamage;

        // Skip damage numbers for tower projectiles or summoned units - players will see their own damage taken display
        const isTowerProjectile = source && (source as any).isTowerProjectile === true;
        const sourceSummonedUnit = source ? source.getComponent(SummonedUnit) : null;
        const shouldShowDamageNumbers = !sourceSummonedUnit && !isTowerProjectile; // Show numbers unless source is a summoned unit or tower projectile

        if (shouldShowDamageNumbers) {
          // Create damage number at target position for damage from players/enemies
          const transform = target.getComponent(Transform);
          if (transform) {
            const position = transform.getWorldPosition();
            // Offset slightly above the target
            position.y += 1.5;
            this.damageNumberManager.addDamageNumber(
              actualDamage,
              damageResult.isCritical,
              position,
              damageType
            );
          }
        }

        if (health.isDead) {
          // Only handle death locally if this is not an enemy in multiplayer mode
          // Enemy deaths in multiplayer/PVP mode are handled by the server
          const enemy = target.getComponent(Enemy);
          const shouldHandleDeathLocally = !enemy || !this.onEnemyDamageCallback;
          
          if (shouldHandleDeathLocally) {
            this.handleEntityDeath(target, source, currentTime, sourcePlayerId);
          } else {
            // Enemy death in multiplayer mode - let server handle experience and death effects
            console.log(`🌐 Enemy ${target.id} died locally via immediate damage but death handling is deferred to server in multiplayer mode`);
          }
        }

        this.triggerDamageEffects(target, actualDamage, source, damageType, damageResult.isCritical);
      }

      return damageDealt;
    }

    // Calculate actual damage with critical hit mechanics
    const currentWeapon = this.getCurrentWeapon();
    const damageResult: DamageResult = calculateDamage(damage, currentWeapon);
    const actualDamage = damageResult.damage;

    const currentTime = Date.now() / 1000;
    const damageDealt = health.takeDamage(actualDamage, currentTime, target);

    if (damageDealt) {
      this.totalDamageDealt += actualDamage;

      // Skip damage numbers for tower projectiles - players will see their own damage taken display
      const isTowerProjectile = source && (source as any).isTowerProjectile === true;
      if (!isTowerProjectile) {
        // Create damage number at target position
        const transform = target.getComponent(Transform);
        if (transform) {
          const position = transform.getWorldPosition();
          // Offset slightly above the target
          position.y += 1.5;
          this.damageNumberManager.addDamageNumber(
            actualDamage,
            damageResult.isCritical,
            position,
            damageType
          );
        }
      }

      if (health.isDead) {
        // Only handle death locally if this is not an enemy in multiplayer mode
        // Enemy deaths in multiplayer/PVP mode are handled by the server
        const enemy = target.getComponent(Enemy);
        const shouldHandleDeathLocally = !enemy || !this.onEnemyDamageCallback;
        
        if (shouldHandleDeathLocally) {
          this.handleEntityDeath(target, source, currentTime, sourcePlayerId);
        } else {
          // Enemy death in multiplayer mode - let server handle experience and death effects
          console.log(`🌐 Enemy ${target.id} died locally via immediate damage but death handling is deferred to server in multiplayer mode`);
        }
      }

      this.triggerDamageEffects(target, actualDamage, source, damageType, damageResult.isCritical);
    }

    return damageDealt;
  }

  public healImmediate(
    target: Entity, 
    amount: number, 
    source?: Entity
  ): boolean {
    const health = target.getComponent(Health);
    if (!health || !health.enabled) return false;

    const healingDone = health.heal(amount);
    
    if (healingDone) {
      this.totalHealingDone += amount;
      this.triggerHealingEffects(target, amount, source);
    }
    
    return healingDone;
  }

  // Utility methods
  public isEntityDead(entity: Entity): boolean {
    const health = entity.getComponent(Health);
    return health ? health.isDead : false;
  }

  public getEntityHealthRatio(entity: Entity): number {
    const health = entity.getComponent(Health);
    return health ? health.getHealthRatio() : 0;
  }

  public canEntityTakeDamage(entity: Entity): boolean {
    const health = entity.getComponent(Health);
    return health ? (!health.isDead && !health.isInvulnerable) : false;
  }

  // Statistics and debugging
  public getCombatStats(): {
    totalDamageDealt: number;
    totalHealingDone: number;
    enemiesKilled: number;
    queuedDamageEvents: number;
    queuedHealEvents: number;
  } {
    return {
      totalDamageDealt: this.totalDamageDealt,
      totalHealingDone: this.totalHealingDone,
      enemiesKilled: this.enemiesKilled,
      queuedDamageEvents: this.damageQueue.length,
      queuedHealEvents: this.healQueue.length
    };
  }

  public resetStats(): void {
    this.totalDamageDealt = 0;
    this.totalHealingDone = 0;
    this.enemiesKilled = 0;
  }

  // Damage numbers management
  public getDamageNumbers() {
    return this.damageNumberManager.getDamageNumbers();
  }

  public removeDamageNumber(id: string): void {
    this.damageNumberManager.removeDamageNumber(id);
  }

  public getDamageNumberManager() {
    return this.damageNumberManager;
  }

  public onDisable(): void {
    this.damageQueue.length = 0;
    this.healQueue.length = 0;
    this.deadEntities.length = 0;
    this.damageNumberManager.clear();
    this.resetStats();
  }

  private synchronizeEnemyDebuffsWithMovement(entity: Entity, enemy: Enemy): void {
    const movement = entity.getComponent(Movement);
    if (!movement) return;

    // Calculate the effective movement speed multiplier based on enemy debuffs
    let speedMultiplier = 1.0;

    // Apply corrupted debuff slow effect
    if (enemy.isCorrupted) {
      const currentTime = Date.now() / 1000;
      const elapsed = currentTime - enemy.corruptedStartTime;
      
      // Calculate current slow percentage based on gradual recovery
      // Initial: 90% slow, recovers 10% per second
      const currentSlowPercent = Math.max(0, enemy.corruptedInitialSlowPercent - (elapsed * enemy.corruptedRecoveryRate));
      
      // Apply the slow effect (reduce speed by the slow percentage)
      speedMultiplier *= (1 - currentSlowPercent);
      
      // Debug logging for corrupted debuff (only log occasionally to avoid spam)
      const logInterval = 1.0; // Log every second
      if (elapsed % logInterval < 0.1) {
        console.log(`👻 Corrupted debuff on ${enemy.getDisplayName()}: ${(currentSlowPercent * 100).toFixed(1)}% slow (${(speedMultiplier * 100).toFixed(1)}% speed remaining)`);
      }
    }

    // Only update the movement speed multiplier if it's different from the current value
    // This prevents overriding other effects unnecessarily
    if (Math.abs(movement.movementSpeedMultiplier - speedMultiplier) > 0.01) {
      movement.movementSpeedMultiplier = speedMultiplier;
    }

    // Reset to normal speed if no debuffs are active
    if (!enemy.isCorrupted && movement.movementSpeedMultiplier !== 1.0) {
      // Only reset if no other systems are managing the speed multiplier
      // Check if this might be from another debuff system (like Corrupted Aura)
      const wasSlowedByOtherEffect = movement.movementSpeedMultiplier < 1.0;
      if (!wasSlowedByOtherEffect || movement.movementSpeedMultiplier === 0.1) { // 0.1 is typical corrupted slow value
        movement.movementSpeedMultiplier = 1.0;
      }
    }
  }

  private applyScythePassiveReward(sourcePlayerId: string): void {
    // Check if Scythe passive is unlocked and current weapon is Scythe
    const currentWeapon = this.getCurrentWeapon();
    if (currentWeapon === WeaponType.SCYTHE) {
      const controlSystemRef = (window as any).controlSystemRef;
      if (controlSystemRef && controlSystemRef.current) {
        const weaponSlot = controlSystemRef.current.selectedWeapons?.primary === WeaponType.SCYTHE ? 'primary' : 'secondary';
        if (weaponSlot && controlSystemRef.current.isPassiveAbilityUnlocked &&
            controlSystemRef.current.isPassiveAbilityUnlocked('P', WeaponType.SCYTHE, weaponSlot)) {
          // Soul Harvest: +5 mana per enemy kill
          const gameUI = (window as any).gameUI;
          if (gameUI && gameUI.addMana) {
            gameUI.addMana(5);
            console.log(`🔮 Scythe Soul Harvest: Gained +5 mana from enemy kill`);
          }
        }
      }
    }
  }

  // Set the local player entity ID for damage number filtering
  public setLocalPlayerEntityId(entityId: number): void {
    this.localPlayerEntityId = entityId;
  }
}
