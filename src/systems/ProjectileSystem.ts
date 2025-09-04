// Projectile system for handling projectile movement and collisions
import { Vector3, Color, SphereGeometry, MeshStandardMaterial, Mesh } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Projectile } from '@/ecs/components/Projectile';
import { Health } from '@/ecs/components/Health';
import { Renderer } from '@/ecs/components/Renderer';
import { Collider, CollisionLayer } from '@/ecs/components/Collider';
import { Enemy } from '@/ecs/components/Enemy';
import { World } from '@/ecs/World';
import { ObjectPool } from '@/utils/ObjectPool';

import { WeaponSubclass } from '@/components/dragon/weapons';
import { CombatSystem } from './CombatSystem';
import CrossentropyBolt from '@/components/projectiles/CrossentropyBolt';

export class ProjectileSystem extends System {
  public readonly requiredComponents = [Transform, Projectile];
  private world: World;
  private combatSystem: CombatSystem | null = null;
  private projectilesToDestroy: number[] = [];
  

  
  // Object pools for performance (keeping vector pool for calculations)
  private vector3Pool: ObjectPool<Vector3>;
  
  // Reusable objects to reduce allocations
  private tempVector = new Vector3();
  private tempVector2 = new Vector3();

  constructor(world: World) {
    super();
    this.world = world;
    this.priority = 20; // Run after movement
    

    
    // Initialize vector pool for calculations
    this.vector3Pool = new ObjectPool(
      () => new Vector3(),
      (vector) => vector.set(0, 0, 0),
      100
    );
  }

  public setCombatSystem(combatSystem: CombatSystem): void {
    this.combatSystem = combatSystem;
  }

  public update(entities: Entity[], deltaTime: number): void {
    this.projectilesToDestroy.length = 0;

    for (const entity of entities) {
      const transform = entity.getComponent(Transform)!;
      const projectile = entity.getComponent(Projectile)!;

      if (!transform.enabled || !projectile.enabled) {
        continue;
      }

      // Update projectile
      projectile.update(deltaTime);

      // Check if projectile has expired
      if (projectile.isExpired()) {
        this.projectilesToDestroy.push(entity.id);
        continue;
      }

      // Move projectile
      this.moveProjectile(transform, projectile, deltaTime);

      // Arrow orientation is set once at creation - no need to update every frame
      // this.updateArrowOrientation(entity, projectile);

      // Check collisions
      this.checkCollisions(entity, transform, projectile);

      // Check world boundaries
      this.checkWorldBounds(entity, transform);
    }

    // Destroy expired projectiles
    for (const entityId of this.projectilesToDestroy) {
      this.world.destroyEntity(entityId);
    }
  }

  private moveProjectile(transform: Transform, projectile: Projectile, deltaTime: number): void {
    // Use temp vector to avoid allocations
    this.tempVector.copy(projectile.velocity).multiplyScalar(deltaTime);
    
    // Update position
    transform.translate(this.tempVector.x, this.tempVector.y, this.tempVector.z);
    transform.matrixNeedsUpdate = true;
  }



  private checkCollisions(projectileEntity: Entity, transform: Transform, projectile: Projectile): void {
    const projectilePos = transform.position;

    // Get all entities that could be hit - specifically look for enemies with colliders
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);

    // Early exit if no targets
    if (potentialTargets.length === 0) return;

    for (const target of potentialTargets) {
      // Skip self and owner
      if (target.id === projectileEntity.id || target.id === projectile.owner) {
        // Debug logging for owner collision prevention
        if (target.id === projectile.owner) {
          console.log(`🚫 Projectile ${projectileEntity.id} skipping owner ${projectile.owner} (target ${target.id})`);
        }
        continue;
      }

      // Skip if already hit and not piercing
      if (!projectile.canHitTarget(target.id)) {
        continue;
      }

      const targetTransform = target.getComponent(Transform)!;
      const targetHealth = target.getComponent(Health)!;
      const targetCollider = target.getComponent(Collider)!;
      
      // Skip if target is dead
      if (targetHealth.isDead) {
        continue;
      }

      // Check if projectile can hit this target (layer-based collision)
      // In PVP mode, projectiles can hit both ENEMY (remote players) and PLAYER (local player) layers
      if (targetCollider.layer !== CollisionLayer.ENEMY && targetCollider.layer !== CollisionLayer.PLAYER) {
        continue;
      }

      // Additional safety check: prevent projectiles from hitting their owner in PVP mode
      // This is a backup check in case the owner comparison above fails
      if (targetCollider.layer === CollisionLayer.PLAYER && target.id === projectile.owner) {
        console.log(`🚫 Extra safety: Projectile ${projectileEntity.id} prevented from hitting owner ${projectile.owner} (PVP mode)`);
        continue;
      }

      const targetPos = targetTransform.getWorldPosition();

      // Use collider radius for more accurate collision detection
      const projectileRadius = 0.2; // Increased from 0.1 for more forgiving collision detection
      const targetRadius = targetCollider.radius;

      // Use squared distance for performance (avoid sqrt)
      const distanceSquared = projectilePos.distanceToSquared(targetPos);
      const collisionRadiusSquared = (projectileRadius + targetRadius) ** 2;
      
      if (distanceSquared <= collisionRadiusSquared) {
        this.handleHit(projectileEntity, target, projectile, targetHealth);
        
        // If not piercing, destroy projectile
        if (!projectile.piercing) {
          this.projectilesToDestroy.push(projectileEntity.id);
          break;
        }
      }
    }
  }

  private handleHit(
    projectileEntity: Entity, 
    target: Entity, 
    projectile: Projectile, 
    targetHealth: Health
  ): void {
    // Mark target as hit
    projectile.addHitTarget(target.id);

    // Deal damage through combat system if available, otherwise directly
    if (this.combatSystem) {
      // Check projectile type for special damage handling
      const renderer = projectileEntity.getComponent(Renderer);
      const isCrossentropyBolt = renderer?.mesh?.userData?.isCrossentropyBolt;
      const isEntropicBolt = renderer?.mesh?.userData?.isEntropicBolt;
      
      let damageType = 'projectile';
      if (isCrossentropyBolt) {
        damageType = 'crossentropy';
      } else if (isEntropicBolt) {
        damageType = 'entropic';
      }
      
      // Debug logging
      if (isCrossentropyBolt) {
        console.log('🟢 CrossEntropy bolt hit detected, using green damage numbers');
      } else if (isEntropicBolt) {
        console.log('⚡ Entropic bolt hit detected, using green damage numbers');
      }
      
      this.combatSystem.queueDamage(target, projectile.damage, projectileEntity, damageType);
    } else {
      // Fallback to direct damage (pass entity for shield absorption)
      const currentTime = Date.now() / 1000;
      const damageDealt = targetHealth.takeDamage(projectile.damage, currentTime, target);
      
      if (damageDealt) {
        const enemy = target.getComponent(Enemy);
        const targetName = enemy ? enemy.getDisplayName() : `Entity ${target.id}`;
        console.log(`💥 Bone Arrow hit ${targetName} for ${projectile.damage} damage (${targetHealth.currentHealth}/${targetHealth.maxHealth} HP)`);
      }
    }

    // Handle explosion if explosive
    if (projectile.explosionRadius > 0) {
      this.handleExplosion(projectileEntity, projectile);
    }
  }

  private handleExplosion(projectileEntity: Entity, projectile: Projectile): void {
    const projectileTransform = projectileEntity.getComponent(Transform)!;
    const explosionCenter = projectileTransform.position;

    // Emit explosion event for visual effects
    this.world.emitEvent('explosion', {
      position: explosionCenter.clone(),
      color: new Color('#00ff44'),
      size: projectile.explosionRadius,
      duration: 0.5
    });

    // Find all entities within explosion radius
    const potentialTargets = this.world.queryEntities([Transform, Health]);

    for (const target of potentialTargets) {
      if (target.id === projectile.owner) continue; // Don't damage owner

      const targetTransform = target.getComponent(Transform)!;
      const targetHealth = target.getComponent(Health)!;
      const distance = explosionCenter.distanceTo(targetTransform.position);

      if (distance <= projectile.explosionRadius) {
        // Calculate damage falloff based on distance
        const damageFalloff = 1 - (distance / projectile.explosionRadius);
        const explosionDamage = Math.floor(projectile.damage * damageFalloff);

        if (explosionDamage > 0) {
          const currentTime = Date.now() / 1000;
          targetHealth.takeDamage(explosionDamage, currentTime, target);
          console.log(`💥 Explosion hit target ${target.id} for ${explosionDamage} damage`);
        }
      }
    }
  }

  private checkWorldBounds(entity: Entity, transform: Transform): void {
    const pos = transform.position;
    const maxDistance = 40; // Maximum distance from origin
    const maxDistanceSquared = maxDistance * maxDistance;

    // Check if projectile is too far from origin (using squared distance)
    if (pos.lengthSq() > maxDistanceSquared) {
      this.projectilesToDestroy.push(entity.id);
      return; // Early exit
    }

    // Check if projectile is below ground (simple ground check)
    if (pos.y < -10) {
      this.projectilesToDestroy.push(entity.id);
    }
  }

  // Utility method to create a ChargedArrow projectile for fully charged bow
  public createChargedArrowProjectile(
    world: World,
    position: Vector3,
    direction: Vector3,
    ownerId: number,
    config?: {
      speed?: number;
      damage?: number;
      lifetime?: number;
      piercing?: boolean;
      explosive?: boolean;
      explosionRadius?: number;
      subclass?: WeaponSubclass;
      level?: number;
      opacity?: number;
    }
  ): Entity {
    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component with charged arrow-specific settings
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 35; // Faster than regular arrows
    projectile.damage = config?.damage || 25; // Higher damage than regular arrows
    projectile.maxLifetime = config?.lifetime || 5; // Longer lifetime
    projectile.owner = ownerId;
    projectile.setDirection(direction);
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for ChargedArrow
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.15, 8, 8);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#ffaa00',
      emissive: '#ffaa00',
      emissiveIntensity: 3,
      transparent: true,
      opacity: 0.1 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as a ChargedArrow for special handling
    placeholderMesh.userData.isChargedArrow = true;
    placeholderMesh.userData.direction = direction.clone();
    placeholderMesh.userData.subclass = config?.subclass;
    placeholderMesh.userData.level = config?.level;
    placeholderMesh.userData.opacity = config?.opacity || 1.0;
    
    renderer.mesh = placeholderMesh;
    projectileEntity.addComponent(renderer);

    // Add Collider component
    const collider = world.createComponent(Collider);
    collider.radius = 0.15;
    collider.layer = CollisionLayer.PROJECTILE;
    projectileEntity.addComponent(collider);

    return projectileEntity;
  }

  // Utility method to create a CrossentropyBolt projectile for scythe
  public createCrossentropyBoltProjectile(
    world: World,
    position: Vector3,
    direction: Vector3,
    ownerId: number,
    config?: {
      speed?: number;
      damage?: number;
      lifetime?: number;
      piercing?: boolean;
      explosive?: boolean;
      explosionRadius?: number;
      subclass?: WeaponSubclass;
      level?: number;
      opacity?: number;
    }
  ): Entity {
    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component with scythe-specific settings
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 15; // Slower than arrows
    projectile.damage = config?.damage || 30; // Higher damage than arrows
    projectile.maxLifetime = config?.lifetime || 10; // Longer lifetime
    projectile.owner = ownerId;
    projectile.setDirection(direction);
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for CrossentropyBolt
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.28, 8, 8);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#00ff44',
      emissive: '#00ff44',
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.1 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as a CrossentropyBolt for special handling
    placeholderMesh.userData.isCrossentropyBolt = true;
    placeholderMesh.userData.projectileEntity = projectileEntity;
    placeholderMesh.userData.direction = direction.clone();
    
    renderer.mesh = placeholderMesh;
    
    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false);
    } else {
      console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);

    console.log(`⚔️ Created CrossentropyBolt projectile ${projectileEntity.id} at`, position, 'moving', direction);
    console.log(`📊 Active projectiles: ${this.world.queryEntities([Transform, Projectile]).length}`);
    
    // Notify systems that the entity is ready
    this.world.notifyEntityAdded(projectileEntity);
    
    return projectileEntity;
  }

  // Utility method to create an EntropicBolt projectile for scythe left click
  public createEntropicBoltProjectile(
    world: World,
    position: Vector3,
    direction: Vector3,
    ownerId: number,
    config?: {
      speed?: number;
      damage?: number;
      lifetime?: number;
      piercing?: boolean;
      explosive?: boolean;
      explosionRadius?: number;
      subclass?: WeaponSubclass;
      level?: number;
      opacity?: number;
    }
  ): Entity {
    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component with EntropicBolt-specific settings
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 20; // Faster than CrossentropyBolt
    projectile.damage = config?.damage || 20; // EntropicBolt damage
    projectile.maxLifetime = config?.lifetime || 8; // Shorter lifetime
    projectile.owner = ownerId;
    projectile.setDirection(direction);
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for EntropicBolt
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.15, 6, 6);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#00ff44',
      emissive: '#00ff44',
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.1 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as an EntropicBolt for special handling
    placeholderMesh.userData.isEntropicBolt = true;
    placeholderMesh.userData.projectileEntity = projectileEntity;
    placeholderMesh.userData.direction = direction.clone();
    
    renderer.mesh = placeholderMesh;
    
    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false);
    } else {
      console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);

    console.log(`⚡ Created EntropicBolt projectile ${projectileEntity.id} at`, position, 'moving', direction);
    console.log(`📊 Active projectiles: ${this.world.queryEntities([Transform, Projectile]).length}`);
    
    // Notify systems that the entity is ready
    this.world.notifyEntityAdded(projectileEntity);
    
    return projectileEntity;
  }

  // Utility method to create a projectile
  public createProjectile(
    world: World,
    position: Vector3,
    direction: Vector3,
    ownerId: number,
    config?: {
      speed?: number;
      damage?: number;
      lifetime?: number;
      piercing?: boolean;
      explosive?: boolean;
      explosionRadius?: number;
      subclass?: WeaponSubclass;
      level?: number;
      opacity?: number;
    }
  ): Entity {
    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 20;
    projectile.damage = config?.damage || 5; // Set default damage to 5 as requested
    projectile.maxLifetime = config?.lifetime || 5;
    projectile.owner = ownerId;
    projectile.setDirection(direction);
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for RegularArrow
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.15, 8, 8);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#ffaa00',
      emissive: '#ffaa00',
      emissiveIntensity: 3,
      transparent: true,
      opacity: 0.1 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as a RegularArrow for special handling
    placeholderMesh.userData.isRegularArrow = true;
    placeholderMesh.userData.direction = direction.clone();
    placeholderMesh.userData.subclass = config?.subclass;
    placeholderMesh.userData.level = config?.level;
    placeholderMesh.userData.opacity = config?.opacity || 1.0;
    
    renderer.mesh = placeholderMesh;
    
    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false); // Projectiles don't need to cast shadows
    } else {
      console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);

    // Add Collider component
    const collider = world.createComponent(Collider);
    collider.radius = 0.15;
    collider.layer = CollisionLayer.PROJECTILE;
    projectileEntity.addComponent(collider);

    console.log(`🚀 Created projectile ${projectileEntity.id} at`, position, 'moving', direction, `(owner: ${ownerId})`);
    console.log(`📊 Active projectiles: ${this.world.queryEntities([Transform, Projectile]).length}`);
    
    // Notify systems that the entity is ready (this will trigger RenderSystem.onEntityAdded)
    this.world.notifyEntityAdded(projectileEntity);
    
    return projectileEntity;
  }

  // Clean up projectile resources when entity is removed
  public onEntityRemoved(entity: Entity): void {
    const projectile = entity.getComponent(Projectile);
    if (projectile) {
      console.log(`💥 Destroying projectile ${entity.id} (lifetime: ${projectile.lifetime.toFixed(2)}s)`);
      console.log(`📊 Remaining projectiles: ${this.world.queryEntities([Transform, Projectile]).length - 1}`);
    }
    
    // No special cleanup needed for RegularArrow - React components handle their own lifecycle
  }

  // Get pool statistics for debugging
  public getPoolStats(): { 
    vector3: number;
  } {
    return {
      vector3: this.vector3Pool.getPoolSize()
    };
  }

  // Dispose of all pools when system is destroyed
  public onDisable(): void {
    console.log('🧹 Cleaning up ProjectileSystem pools:', this.getPoolStats());
    this.vector3Pool.clear();
  }
}
