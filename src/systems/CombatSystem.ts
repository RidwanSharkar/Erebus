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

interface DamageEvent {
  target: Entity;
  damage: number;
  source?: Entity;
  damageType?: string;
  timestamp: number;
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
  private onEnemyDamageCallback?: (enemyId: string, damage: number) => void;
  
  // PVP damage callback for routing player damage to server
  private onPlayerDamageCallback?: (playerId: string, damage: number, damageType?: string) => void;

  // Log throttling to reduce spam
  private lastDamageLogTime = 0;
  private damageLogThrottle = 100; // Only log every 100ms

  constructor(world: World) {
    super();
    this.world = world;
    this.damageNumberManager = new DamageNumberManager();
    this.priority = 25; // Run after collision detection
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
  public setEnemyDamageCallback(callback: (enemyId: string, damage: number) => void): void {
    this.onEnemyDamageCallback = callback;
  }
  
  // Set callback for routing player damage to multiplayer server (PVP)
  public setPlayerDamageCallback(callback: (playerId: string, damage: number, damageType?: string) => void): void {
    this.onPlayerDamageCallback = callback;
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

      // Update freeze status for enemies
      const enemy = entity.getComponent(Enemy);
      if (enemy) {
        enemy.updateFreezeStatus(currentTime);
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
    const { target, damage: baseDamage, source, damageType } = damageEvent;

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
      const damageResult: DamageResult = calculateDamage(baseDamage);
      const actualDamage = damageResult.damage;

      // Route enemy damage through multiplayer server instead of applying locally
      // console.log(`🌐 Routing ${actualDamage} damage to enemy ${target.id} through multiplayer server`);
      this.onEnemyDamageCallback(target.id.toString(), actualDamage);

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

      // Log for debugging
      const sourceName = source ? `Entity ${source.id}` : 'Unknown';
      const targetName = this.getEntityDisplayName(target);
      const critText = damageResult.isCritical ? ' CRITICAL' : '';

      return; // Don't apply damage locally for enemies
    }

    // Check if target is a summoned unit - treat like enemy (apply damage locally)
    const summonedUnitComponent = target.getComponent(SummonedUnit);
    if (summonedUnitComponent) {
      // Cast to proper type
      const summonedUnit = summonedUnitComponent as typeof SummonedUnit.prototype;

      // Calculate actual damage with critical hit mechanics
      const damageResult: DamageResult = calculateDamage(baseDamage);
      const actualDamage = damageResult.damage;

      // Apply damage locally (pass entity so Health can use Shield component)
      const damageDealt = health.takeDamage(actualDamage, currentTime, target);

      if (damageDealt) {
        this.totalDamageDealt += actualDamage;

        // Check if source is a summoned unit - if so, skip damage numbers to reduce visual clutter
        const sourceSummonedUnit = source ? source.getComponent(SummonedUnit) : null;
        const shouldShowDamageNumbers = !sourceSummonedUnit; // Show numbers unless source is a summoned unit

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
          this.handleEntityDeath(target, source, currentTime);
        }

        // Trigger damage effects
        this.triggerDamageEffects(target, actualDamage, source, damageType, damageResult.isCritical);
      }

      return; // Damage applied locally for summoned units
    }

    // Check if target is a player in PVP mode - if so, route damage through multiplayer
    // Also prevent self-damage in PVP (source hitting themselves)
    if (!enemy && this.onPlayerDamageCallback && source && source.id !== target.id) {
      // Calculate actual damage with critical hit mechanics
      const damageResult: DamageResult = calculateDamage(baseDamage);

      // Route player damage through multiplayer server for PVP (let receiver handle shields)
      if (this.shouldLogDamage()) {
        // console.log(`⚔️ Routing ${damageResult.damage} PVP ${damageType || 'damage'} to player ${target.id} through multiplayer server`);
      }
      this.onPlayerDamageCallback(target.id.toString(), damageResult.damage, damageType); // Send damage, let receiver handle shields

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
    const damageResult: DamageResult = calculateDamage(baseDamage);
    const actualDamage = damageResult.damage;

    // Apply damage (pass entity so Health can use Shield component)
    const damageDealt = health.takeDamage(actualDamage, currentTime, target);

    if (damageDealt) {
      this.totalDamageDealt += actualDamage;

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

      // Log damage for debugging (throttled to reduce spam)
      if (this.shouldLogDamage()) {
        const sourceName = source ? `Entity ${source.id}` : 'Unknown';
        const targetName = this.getEntityDisplayName(target);
        const critText = damageResult.isCritical ? ' CRITICAL' : '';
        // console.log(`💥 ${sourceName} dealt ${actualDamage}${critText} ${damageType || 'damage'} to ${targetName} (${health.currentHealth}/${health.maxHealth} HP)`);
      }

      // Check if target died
      if (health.isDead) {
        this.handleEntityDeath(target, source, currentTime);
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

  private handleEntityDeath(entity: Entity, killer?: Entity, currentTime?: number): void {
    const enemy = entity.getComponent(Enemy);

    if (enemy) {
      enemy.die(currentTime || Date.now() / 1000);
      this.enemiesKilled++;

      // console.log(`💀 ${enemy.getDisplayName()} has been defeated!`);

      // Award experience to killer if it's a player
      if (killer) {
        this.awardExperience(killer, enemy.experienceReward);
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

      // console.log(`💀 ${summonedUnit.getDisplayName()} has been defeated!`);

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
    damageType?: string
  ): void {
    this.damageQueue.push({
      target,
      damage,
      source,
      damageType,
      timestamp: Date.now() / 1000
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
    damageType?: string
  ): boolean {
    const health = target.getComponent(Health);
    if (!health || !health.enabled) return false;

    // Import SummonedUnit component dynamically to avoid circular dependency
    const SummonedUnit = require('@/ecs/components/SummonedUnit').SummonedUnit;

    // Check if target is a summoned unit - skip damage numbers only if source is also a summoned unit
    const summonedUnitComponent = target.getComponent(SummonedUnit);
    if (summonedUnitComponent) {
      // Calculate actual damage with critical hit mechanics
      const damageResult: DamageResult = calculateDamage(damage);
      const actualDamage = damageResult.damage;

      const currentTime = Date.now() / 1000;
      const damageDealt = health.takeDamage(actualDamage, currentTime, target);

      if (damageDealt) {
        this.totalDamageDealt += actualDamage;

        // Check if source is a summoned unit - if so, skip damage numbers to reduce visual clutter
        const sourceSummonedUnit = source ? source.getComponent(SummonedUnit) : null;
        const shouldShowDamageNumbers = !sourceSummonedUnit; // Show numbers unless source is a summoned unit

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
          this.handleEntityDeath(target, source, currentTime);
        }

        this.triggerDamageEffects(target, actualDamage, source, damageType, damageResult.isCritical);
      }

      return damageDealt;
    }

    // Calculate actual damage with critical hit mechanics
    const damageResult: DamageResult = calculateDamage(damage);
    const actualDamage = damageResult.damage;

    const currentTime = Date.now() / 1000;
    const damageDealt = health.takeDamage(actualDamage, currentTime, target);

    if (damageDealt) {
      this.totalDamageDealt += actualDamage;

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

      if (health.isDead) {
        this.handleEntityDeath(target, source, currentTime);
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

  public onDisable(): void {
    this.damageQueue.length = 0;
    this.healQueue.length = 0;
    this.deadEntities.length = 0;
    this.damageNumberManager.clear();
    this.resetStats();
  }
}
