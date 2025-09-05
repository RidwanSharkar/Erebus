// Tower system for managing PVP tower AI, targeting, and shooting
import { Vector3 } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Tower } from '@/ecs/components/Tower';
import { Collider, CollisionLayer } from '@/ecs/components/Collider';
import { World } from '@/ecs/World';
import { ProjectileSystem } from './ProjectileSystem';

export class TowerSystem extends System {
  public readonly requiredComponents = [Transform, Tower, Health];
  private world: World;
  private projectileSystem: ProjectileSystem | null = null;
  
  // Callback for broadcasting tower attacks in multiplayer
  private onTowerAttackCallback?: (towerOwnerId: string, targetPlayerId: string, position: Vector3, direction: Vector3) => void;
  
  // Player entity mapping for identifying tower owners vs enemies
  private serverPlayerEntities: Map<string, number> = new Map();
  private localSocketId: string | null = null;
  
  // Reusable objects to reduce allocations
  private tempVector = new Vector3();
  private tempVector2 = new Vector3();

  constructor(world: World) {
    super();
    this.world = world;
    this.priority = 25; // Run after movement and projectiles
  }
  
  public setProjectileSystem(projectileSystem: ProjectileSystem): void {
    this.projectileSystem = projectileSystem;
  }
  
  public setTowerAttackCallback(callback: (towerOwnerId: string, targetPlayerId: string, position: Vector3, direction: Vector3) => void): void {
    this.onTowerAttackCallback = callback;
  }
  
  public setPlayerMapping(serverPlayerEntities: Map<string, number>, localSocketId: string): void {
    this.serverPlayerEntities = serverPlayerEntities;
    this.localSocketId = localSocketId;
  }

  public update(entities: Entity[], deltaTime: number): void {
    const currentTime = Date.now() / 1000; // Convert to seconds
    
    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const tower = entity.getComponent(Tower);
      const health = entity.getComponent(Health);
      
      if (!transform || !tower || !health) continue;
      
      // Check if tower is dead
      if (health.isDead && !tower.isDead) {
        tower.die(currentTime);
        continue;
      }
      
      // Skip inactive or dead towers
      if (!tower.isActive || tower.isDead) continue;
      
      // Search for targets periodically
      if (tower.canSearchForTargets(currentTime)) {
        this.searchForTarget(entity, transform, tower, currentTime);
      }
      
      // Validate current target (check if still alive and in range)
      if (tower.currentTarget) {
        const targetEntity = this.world.getEntity(tower.currentTarget);
        if (!this.isValidTarget(targetEntity || null, transform, tower)) {
          tower.clearTarget();
        }
      }
      
      // Attack current target if possible
      if (tower.currentTarget && tower.canAttack(currentTime)) {
        this.attackTarget(entity, transform, tower, currentTime);
      }
    }
  }
  
  private searchForTarget(towerEntity: Entity, towerTransform: Transform, tower: Tower, currentTime: number): void {
    tower.updateTargetSearch(currentTime);
    
    // Get all potential targets (players that are not the tower owner)
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);
    
    
    let closestTarget: Entity | null = null;
    let closestDistance = Infinity;
    let validTargetCount = 0;
    
    for (const target of potentialTargets) {
      const targetCollider = target.getComponent(Collider);
      const targetTransform = target.getComponent(Transform);
      
      if (targetCollider && targetTransform) {
        const distance = towerTransform.position.distanceTo(targetTransform.position);
      }
      
      if (!this.isValidTarget(target, towerTransform, tower)) continue;
      
      validTargetCount++;
      const targetTransform2 = target.getComponent(Transform);
      if (!targetTransform2) continue;
      
      const distance = towerTransform.position.distanceTo(targetTransform2.position);
      
      if (distance <= tower.targetSearchRange && distance < closestDistance) {
        closestTarget = target;
        closestDistance = distance;
      }
    }
    
    
    if (closestTarget) {
      tower.setTarget(closestTarget.id);
    } else if (tower.currentTarget) {
      // Clear target if no valid targets found
      tower.clearTarget();
    }
  }
  
  private isValidTarget(target: Entity | null, towerTransform: Transform, tower: Tower): boolean {
    if (!target) {
      return false;
    }
    
    const targetHealth = target.getComponent(Health);
    const targetTransform = target.getComponent(Transform);
    const targetCollider = target.getComponent(Collider);
    
    // Must have required components and be alive
    if (!targetHealth || !targetTransform || !targetCollider || targetHealth.isDead) {
      return false;
    }
    
    // Must be a player (not an enemy or other tower)
    if (targetCollider.layer !== CollisionLayer.PLAYER && targetCollider.layer !== CollisionLayer.ENEMY) {
      return false;
    }
    
    // Don't target other towers
    if (target.hasComponent(Tower)) {
      return false;
    }
    
    // In PVP mode, identify if this is an enemy player
    if (this.localSocketId && this.serverPlayerEntities.size > 0) {
      
      // Check if this is the local player (PLAYER layer)
      if (targetCollider.layer === CollisionLayer.PLAYER) {
        const shouldTarget = tower.ownerId !== this.localSocketId;
        return shouldTarget;
      }
      
      // Check if this is a remote player (ENEMY layer)
      if (targetCollider.layer === CollisionLayer.ENEMY) {
        // Find which player this entity belongs to
        let targetPlayerId: string | null = null;
        this.serverPlayerEntities.forEach((entityId, playerId) => {
          if (entityId === target.id) {
            targetPlayerId = playerId;
          }
        });
        
        if (targetPlayerId) {
          const shouldTarget = tower.ownerId !== targetPlayerId;
          return shouldTarget;
        }
        
        return true;
      }
    }
    
    return true;
  }
  
  private attackTarget(towerEntity: Entity, towerTransform: Transform, tower: Tower, currentTime: number): void {
    const targetEntity = this.world.getEntity(tower.currentTarget!);
    if (!targetEntity) {
      tower.clearTarget();
      return;
    }
    
    const targetTransform = targetEntity.getComponent(Transform);
    if (!targetTransform) {
      tower.clearTarget();
      return;
    }
    
    // Calculate direction to target
    this.tempVector.copy(targetTransform.position);
    this.tempVector.sub(towerTransform.position);
    const distance = this.tempVector.length();
    
    // Check if target is still in range
    if (distance > tower.attackRange) {
      tower.clearTarget();
      return;
    }
    
    // Normalize direction
    this.tempVector.normalize();
    
    // Calculate projectile spawn position (slightly above tower center)
    this.tempVector2.copy(towerTransform.position);
    this.tempVector2.y += 2; // Spawn projectiles 2 units above tower base
    
    // Create projectile
    if (this.projectileSystem) {
      const projectileConfig = {
        speed: tower.projectileSpeed,
        damage: tower.attackDamage,
        lifetime: 2, // 5 second lifetime
        opacity: 1.0
      };
      
      const projectileEntity = this.projectileSystem.createProjectile(
        this.world,
        this.tempVector2, // spawn position
        this.tempVector,  // direction
        towerEntity.id,   // tower as owner
        projectileConfig
      );
      
      // Mark projectile as tower projectile for special handling
      const projectileRenderer = projectileEntity.getComponent(Transform);
      if (projectileRenderer) {
        // Add metadata to identify this as a tower projectile
        (projectileEntity as any).isTowerProjectile = true;
        (projectileEntity as any).towerOwnerId = tower.ownerId;
      }
      
    }
    
    // Broadcast attack to multiplayer if callback is set
    if (this.onTowerAttackCallback) {
      // We need to map the target entity back to a player ID
      // For now, we'll use a placeholder - this will need to be improved with proper player mapping
      const targetPlayerId = `player_${tower.currentTarget}`;
      this.onTowerAttackCallback(tower.ownerId, targetPlayerId, this.tempVector2, this.tempVector);
    }
    
    tower.performAttack(currentTime);
  }
  
  // Utility method to get all towers owned by a specific player
  public getTowersByOwner(ownerId: string): Entity[] {
    const allTowers = this.world.queryEntities([Transform, Tower, Health]);
    return allTowers.filter(entity => {
      const tower = entity.getComponent(Tower);
      return tower && tower.ownerId === ownerId;
    });
  }
  
  // Utility method to get tower count for a player
  public getTowerCount(ownerId: string): number {
    return this.getTowersByOwner(ownerId).length;
  }
  
  // Utility method to check if a player has any active towers
  public hasActiveTowers(ownerId: string): boolean {
    const towers = this.getTowersByOwner(ownerId);
    return towers.some(entity => {
      const tower = entity.getComponent(Tower);
      const health = entity.getComponent(Health);
      return tower && health && tower.isActive && !tower.isDead && !health.isDead;
    });
  }
}
