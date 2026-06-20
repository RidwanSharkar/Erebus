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
import {
  STAGGERING_ENTROPIC_BOLT_STAGGER,
  CROSSENTROPY_TEMPEST_STAGGER,
  CROSSENTROPY_METEOR_AOE_RADIUS,
  CROSSENTROPY_METEOR_DAMAGE,
  CROSSENTROPY_METEOR_SKY_HEIGHT_MAX,
  CROSSENTROPY_METEOR_SKY_HEIGHT_MIN,
  CROSSENTROPY_METEOR_SKY_OFFSET_MAX,
  CROSSENTROPY_METEOR_SKY_OFFSET_MIN,
  CROSSENTROPY_METEOR_SPEED,
  CROSSENTROPY_METEOR_STAGGER_MS,
  CROSSENTROPY_METEOR_WARNING_MS,
  CROSSENTROPY_FRAGMENTATION_PROC_CHANCE,
  CROSSENTROPY_FRAGMENTATION_NEAR_RADIUS_UNITS,
  rollCrossentropyMeteorStrikeCount,
  CLOUDKILL_AOE_RADIUS,
  CLOUDKILL_ARROW_DELAY_MS,
  CLOUDKILL_ARROW_SPEED,
  CLOUDKILL_DAMAGE,
  CLOUDKILL_PROC_CHANCE,
  CLOUDKILL_SKY_HEIGHT_MAX,
  CLOUDKILL_SKY_HEIGHT_MIN,
  CLOUDKILL_WARNING_MS,
  rollCloudkillArrowCount,
  shouldApplyCloudkillTalent,
} from '@/utils/talents';
import {
  ENTROPIC_FORWARD_SCALE,
  ENTROPIC_MAX_LIFETIME,
} from '@/utils/entropicBoltPath';
import type { CrossentropyVisualTheme, FanOfKnivesFlourishTint } from '@/utils/talents';
import { CombatSystem } from './CombatSystem';

function crossentropyThemeFromProjectile(projectile: Projectile): CrossentropyVisualTheme {
  if (projectile.infernoCrossentropy === true) return 'inferno';
  if (projectile.crossentropyGlacial === true) return 'glacial';
  if (projectile.crossentropyTempest === true) return 'tempest';
  if (projectile.crossentropyPlague === true) return 'plague';
  return 'default';
}

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
  private pendingCrossentropyMeteorImpacts: Array<{
    impactAtMs: number;
    impactPosition: Vector3;
    damage: number;
    radius: number;
    ownerEntityId: number;
    sourcePlayerId: string;
    infernoCrossentropy: boolean;
    reaperCrossentropy: boolean;
    crossentropyPlague: boolean;
    staggerToAdd?: number;
  }> = [];
  private pendingCloudkillImpacts: Array<{
    impactAtMs: number;
    impactPosition: Vector3;
    damage: number;
    radius: number;
    ownerEntityId: number;
    sourcePlayerId: string;
  }> = [];
  /** Co-op only: fragmentation child bolt broadcast (matches `broadcastPlayerAttack` crossentropy projectileConfig shape). */
  private crossentropyBoltBroadcastCallback?:
    | ((position: Vector3, direction: Vector3, projectileConfig: Record<string, unknown>) => void)
    | undefined;

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

  public setCrossentropyBoltBroadcastCallback(
    cb:
      | ((position: Vector3, direction: Vector3, projectileConfig: Record<string, unknown>) => void)
      | undefined,
  ): void {
    this.crossentropyBoltBroadcastCallback = cb;
  }

  public update(entities: Entity[], deltaTime: number): void {
    this.projectilesToDestroy.length = 0;
    this.processPendingCrossentropyMeteorImpacts(Date.now());
    this.processPendingCloudkillImpacts(Date.now());

    for (const entity of entities) {
      const transform = entity.getComponent(Transform)!;
      const projectile = entity.getComponent(Projectile)!;

      if (!transform.enabled || !projectile.enabled) {
        continue;
      }

      projectile.update(deltaTime);

      // Check if projectile has expired
      if (projectile.isExpired()) {
        this.projectilesToDestroy.push(entity.id);
        continue;
      }

      const previousProjectilePos = this.tempVector2.copy(transform.position);

      // Move projectile
      this.moveProjectile(entity, transform, projectile, deltaTime);

      // Update homing direction if projectile is homing
      this.updateHomingDirection(entity, projectile, deltaTime);

      // Arrow orientation is set once at creation - no need to update every frame
      // this.updateArrowOrientation(entity, projectile);

      // Check collisions
      this.checkCollisions(entity, transform, projectile, previousProjectilePos);

      // Check world boundaries
      this.checkWorldBounds(entity, transform);
    }

    // Destroy expired projectiles
    for (const entityId of this.projectilesToDestroy) {
      this.world.destroyEntity(entityId);
    }
  }

  private createCrossentropyMeteorStartPosition(impactPosition: Vector3): Vector3 {
    const angle = Math.random() * Math.PI * 2;
    const distance =
      CROSSENTROPY_METEOR_SKY_OFFSET_MIN +
      Math.random() * (CROSSENTROPY_METEOR_SKY_OFFSET_MAX - CROSSENTROPY_METEOR_SKY_OFFSET_MIN);
    const height =
      CROSSENTROPY_METEOR_SKY_HEIGHT_MIN +
      Math.random() * (CROSSENTROPY_METEOR_SKY_HEIGHT_MAX - CROSSENTROPY_METEOR_SKY_HEIGHT_MIN);
    return new Vector3(
      impactPosition.x + Math.cos(angle) * distance,
      height,
      impactPosition.z + Math.sin(angle) * distance,
    );
  }

  private scheduleCrossentropyMeteorImpact(
    projectile: Projectile,
    impactPosition: Vector3,
    castDelayMs = 0,
  ): void {
    const castTimeMs = Date.now() + castDelayMs;
    const startPosition = this.createCrossentropyMeteorStartPosition(impactPosition);
    const travelDistance = startPosition.distanceTo(new Vector3(impactPosition.x, -3, impactPosition.z));
    const travelTimeMs = (travelDistance / CROSSENTROPY_METEOR_SPEED) * 1000;
    this.pendingCrossentropyMeteorImpacts.push({
      impactAtMs: castTimeMs + CROSSENTROPY_METEOR_WARNING_MS + travelTimeMs,
      impactPosition: impactPosition.clone(),
      damage: CROSSENTROPY_METEOR_DAMAGE,
      radius: CROSSENTROPY_METEOR_AOE_RADIUS,
      ownerEntityId: projectile.owner,
      sourcePlayerId: projectile.sourcePlayerId,
      infernoCrossentropy: projectile.infernoCrossentropy === true,
      reaperCrossentropy: projectile.reaperCrossentropy === true,
      crossentropyPlague: projectile.crossentropyPlague === true,
      ...(projectile.staggerToAdd != null && projectile.staggerToAdd > 0
        ? { staggerToAdd: projectile.staggerToAdd }
        : {}),
    });
    this.world.emitEvent('crossentropyMeteorCast', {
      targetPosition: impactPosition.clone(),
      timestamp: castTimeMs,
      damage: CROSSENTROPY_METEOR_DAMAGE,
      startPosition: startPosition.clone(),
    });
  }

  private processPendingCrossentropyMeteorImpacts(nowMs: number): void {
    if (this.pendingCrossentropyMeteorImpacts.length === 0) return;
    const due = this.pendingCrossentropyMeteorImpacts.filter((meteor) => meteor.impactAtMs <= nowMs);
    if (due.length === 0) return;
    this.pendingCrossentropyMeteorImpacts = this.pendingCrossentropyMeteorImpacts.filter(
      (meteor) => meteor.impactAtMs > nowMs,
    );
    const potentialTargets = this.world.queryEntities([Transform, Health]);
    for (const meteor of due) {
      const sourceEntity = this.world.getEntity(meteor.ownerEntityId);
      for (const target of potentialTargets) {
        if (target.id === meteor.ownerEntityId) continue;
        if (target.userData?.isCoopAllyPlayer) continue;
        if (!target.getComponent(Enemy)) continue;
        const targetTransform = target.getComponent(Transform);
        const targetHealth = target.getComponent(Health);
        if (!targetTransform || !targetHealth || targetHealth.isDead) continue;
        if (meteor.impactPosition.distanceTo(targetTransform.position) > meteor.radius) continue;
        if (this.combatSystem) {
          this.combatSystem.queueDamage(
            target,
            meteor.damage,
            sourceEntity ?? undefined,
            'crossentropy',
            meteor.sourcePlayerId,
            undefined,
            undefined,
            meteor.staggerToAdd,
            undefined,
            undefined,
            meteor.infernoCrossentropy,
            meteor.reaperCrossentropy,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            meteor.crossentropyPlague,
            undefined,
          );
        } else {
          const currentTime = Date.now() / 1000;
          targetHealth.takeDamage(meteor.damage, currentTime, target);
        }
      }
    }
  }

  private createCloudkillStartPosition(impactPosition: Vector3): Vector3 {
    const height =
      CLOUDKILL_SKY_HEIGHT_MIN +
      Math.random() * (CLOUDKILL_SKY_HEIGHT_MAX - CLOUDKILL_SKY_HEIGHT_MIN);
    return new Vector3(impactPosition.x, height, impactPosition.z);
  }

  private scheduleCloudkillVolley(projectile: Projectile, impactPosition: Vector3): void {
    const arrowCount = rollCloudkillArrowCount();
    const castBaseMs = Date.now();
    for (let i = 0; i < arrowCount; i++) {
      const castDelayMs = i * CLOUDKILL_ARROW_DELAY_MS;
      const castTimeMs = castBaseMs + castDelayMs;
      const startPosition = this.createCloudkillStartPosition(impactPosition);
      const travelDistance = startPosition.distanceTo(
        new Vector3(impactPosition.x, -3, impactPosition.z),
      );
      const travelTimeMs = (travelDistance / CLOUDKILL_ARROW_SPEED) * 1000;
      this.pendingCloudkillImpacts.push({
        impactAtMs: castTimeMs + CLOUDKILL_WARNING_MS + travelTimeMs,
        impactPosition: impactPosition.clone(),
        damage: CLOUDKILL_DAMAGE,
        radius: CLOUDKILL_AOE_RADIUS,
        ownerEntityId: projectile.owner,
        sourcePlayerId: projectile.sourcePlayerId,
      });
      this.world.emitEvent('cloudkillCast', {
        castId: `cloudkill-${castTimeMs}-${i}`,
        targetPosition: impactPosition.clone(),
        timestamp: castTimeMs,
        delayMs: castDelayMs,
        startPosition: startPosition.clone(),
      });
    }
  }

  private processPendingCloudkillImpacts(nowMs: number): void {
    if (this.pendingCloudkillImpacts.length === 0) return;
    const due = this.pendingCloudkillImpacts.filter((impact) => impact.impactAtMs <= nowMs);
    if (due.length === 0) return;
    this.pendingCloudkillImpacts = this.pendingCloudkillImpacts.filter(
      (impact) => impact.impactAtMs > nowMs,
    );
    const potentialTargets = this.world.queryEntities([Transform, Health]);
    for (const impact of due) {
      const sourceEntity = this.world.getEntity(impact.ownerEntityId);
      for (const target of potentialTargets) {
        if (target.id === impact.ownerEntityId) continue;
        if (target.userData?.isCoopAllyPlayer) continue;
        if (!target.getComponent(Enemy)) continue;
        const targetTransform = target.getComponent(Transform);
        const targetHealth = target.getComponent(Health);
        if (!targetTransform || !targetHealth || targetHealth.isDead) continue;
        if (impact.impactPosition.distanceTo(targetTransform.position) > impact.radius) continue;
        if (this.combatSystem) {
          this.combatSystem.queueDamage(
            target,
            impact.damage,
            sourceEntity ?? undefined,
            'cloudkill',
            impact.sourcePlayerId,
          );
        } else {
          const currentTime = Date.now() / 1000;
          targetHealth.takeDamage(impact.damage, currentTime, target);
        }
      }
    }
  }

  private moveProjectile(
    entity: Entity,
    transform: Transform,
    projectile: Projectile,
    deltaTime: number,
  ): void {
    // Use temp vector to avoid allocations
    this.tempVector.copy(projectile.velocity).multiplyScalar(deltaTime);

    // Update position
    transform.translate(this.tempVector.x, this.tempVector.y, this.tempVector.z);
    transform.matrixNeedsUpdate = true;
  }

  private segmentIntersectsSphere(
    start: Vector3,
    end: Vector3,
    sphereCenter: Vector3,
    radiusSquared: number,
  ): boolean {
    const segmentX = end.x - start.x;
    const segmentY = end.y - start.y;
    const segmentZ = end.z - start.z;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY + segmentZ * segmentZ;

    if (segmentLengthSquared === 0) {
      return end.distanceToSquared(sphereCenter) <= radiusSquared;
    }

    const centerToStartX = sphereCenter.x - start.x;
    const centerToStartY = sphereCenter.y - start.y;
    const centerToStartZ = sphereCenter.z - start.z;
    const t = Math.max(
      0,
      Math.min(
        1,
        (centerToStartX * segmentX + centerToStartY * segmentY + centerToStartZ * segmentZ) /
          segmentLengthSquared,
      ),
    );

    const closestX = start.x + segmentX * t;
    const closestY = start.y + segmentY * t;
    const closestZ = start.z + segmentZ * t;
    const dx = sphereCenter.x - closestX;
    const dy = sphereCenter.y - closestY;
    const dz = sphereCenter.z - closestZ;

    return dx * dx + dy * dy + dz * dz <= radiusSquared;
  }

  private updateHomingDirection(projectileEntity: Entity, projectile: Projectile, deltaTime: number): void {
    // Skip if not homing
    if (!projectile.targetEntityId || projectile.homingStrength <= 0) {
      return;
    }

    // Get target entity
    const targetEntity = this.world.getEntity(projectile.targetEntityId);
    if (!targetEntity) {
      // Target no longer exists, disable homing
      projectile.disableHoming();
      return;
    }

    // Get target position
    const targetTransform = targetEntity.getComponent(Transform);
    if (!targetTransform) {
      projectile.disableHoming();
      return;
    }

    // Get projectile position
    const projectileTransform = projectileEntity.getComponent(Transform);
    if (!projectileTransform) {
      return;
    }

    // Check if this is a tower projectile for special handling
    const isTowerProjectile = (projectileEntity as any).isTowerProjectile === true;

    // Calculate direction to target
    const currentPosition = projectileTransform.position;
    const targetPosition = targetTransform.position;

    this.tempVector.copy(targetPosition).sub(currentPosition);
    const distanceToTarget = this.tempVector.length();

    // For tower projectiles, use more aggressive homing even at close range
    const minDistanceThreshold = isTowerProjectile ? 0.05 : 0.1; // Closer threshold for towers

    // If very close to target and not a tower projectile, maintain current direction
    if (distanceToTarget < minDistanceThreshold && !isTowerProjectile) {
      return;
    }

    // Normalize target direction
    this.tempVector.normalize();

    // Get current velocity direction
    const currentDirection = projectile.velocity.clone().normalize();

    // For tower projectiles, use more direct approach when very close
    if (isTowerProjectile && distanceToTarget < 0.3) {
      // Direct approach: immediately adjust towards target
      const desiredDirection = this.tempVector.clone();
      const angle = currentDirection.angleTo(desiredDirection);

      // For tower projectiles, allow much more aggressive turning when close
      const maxTurnThisFrame = projectile.maxTurnRate * deltaTime * 2; // Double the turn rate when close
      const turnAngle = Math.min(angle, maxTurnThisFrame);

      if (turnAngle > 0.001) {
        const rotationAxis = new Vector3();
        rotationAxis.crossVectors(currentDirection, desiredDirection).normalize();

        const newDirection = currentDirection.clone();
        newDirection.applyAxisAngle(rotationAxis, turnAngle);

        projectile.velocity.copy(newDirection).multiplyScalar(projectile.speed);
      }
    } else {
      // Standard homing logic with enhanced strength for tower projectiles
      const homingStrength = isTowerProjectile ? Math.min(projectile.homingStrength + 0.1, 1.0) : projectile.homingStrength;

      // Calculate desired direction (interpolate between current and target direction)
      const desiredDirection = new Vector3();
      desiredDirection.lerpVectors(currentDirection, this.tempVector, homingStrength);

      // Calculate angle between current and desired direction
      const angle = currentDirection.angleTo(desiredDirection);

      // Limit turn rate (more aggressive for tower projectiles)
      const maxTurnThisFrame = projectile.maxTurnRate * deltaTime;
      const turnAngle = Math.min(angle, maxTurnThisFrame);

      // If we need to turn
      if (turnAngle > 0.001) { // Small threshold to avoid jitter
        // Calculate rotation axis
        const rotationAxis = new Vector3();
        rotationAxis.crossVectors(currentDirection, desiredDirection).normalize();

        // Create rotation quaternion
        const cosHalfAngle = Math.cos(turnAngle / 2);
        const sinHalfAngle = Math.sin(turnAngle / 2);

        // Apply rotation to current direction
        const newDirection = currentDirection.clone();
        newDirection.applyAxisAngle(rotationAxis, turnAngle);

        // Update velocity while maintaining speed
        projectile.velocity.copy(newDirection).multiplyScalar(projectile.speed);
      }
    }
  }



  private checkCollisions(
    projectileEntity: Entity,
    transform: Transform,
    projectile: Projectile,
    previousProjectilePos: Vector3,
  ): void {
    const projectilePos = transform.position;

    // NOTE: Barrage and Viper Sting projectiles ARE handled by ECS collision detection
    // They work against both PVP players (via specialized managers) AND COOP enemies (boss/skeletons)
    // The specialized PVP managers handle player-vs-player damage, while ECS handles enemy damage

    // Get all entities that could be hit - specifically look for enemies with colliders
    const potentialTargets = this.world.queryEntities([Transform, Health, Collider]);

    // Early exit if no targets
    if (potentialTargets.length === 0) return;

    for (const target of potentialTargets) {
      // Skip self and owner
      if (target.id === projectileEntity.id || target.id === projectile.owner) {
        // Debug logging for owner collision prevention
        if (target.id === projectile.owner) {
          // console.log(`🚫 Projectile ${projectileEntity.id} skipping owner ${projectile.owner} (target ${target.id})`);
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

      if (target.userData?.isCoopAllyPlayer) {
        continue;
      }

      if (target.userData?.isCoopAlliedUnit) {
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
          // console.log(`🚫 Extra safety: Projectile ${projectileEntity.id} prevented from hitting owner ${projectile.owner} (PVP mode)`);
        continue;
      }

      // CRITICAL PVP FIX: Prevent Viper Sting projectiles from hitting the local player
      // In PVP, Viper Sting projectiles from remote players should not damage the local player
      // The local player always has CollisionLayer.PLAYER, while remote players have CollisionLayer.ENEMY
      if (targetCollider.layer === CollisionLayer.PLAYER && projectile.projectileType === 'viper_sting') {
        // This is a Viper Sting projectile hitting the local player - skip it
        // The OptimizedPVPViperStingManager will handle PVP damage separately
        continue;
      }

      const targetPos = targetTransform.getWorldPosition().add(targetCollider.offset);

      // Use collider radius for more accurate collision detection
      const projectileRadius = 0.2; // Increased from 0.1 for more forgiving collision detection
      const targetRadius = targetCollider.radius;

      // Use squared distance for performance (avoid sqrt)
      const collisionRadiusSquared = (projectileRadius + targetRadius) ** 2;
      
      if (
        projectilePos.distanceToSquared(targetPos) <= collisionRadiusSquared ||
        this.segmentIntersectsSphere(previousProjectilePos, projectilePos, targetPos, collisionRadiusSquared)
      ) {
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
      const isBarrageArrow = renderer?.mesh?.userData?.isBarrageArrow;
      const isFanOfKnives =
        projectile.projectileType === 'fan_of_knives' ||
        renderer?.mesh?.userData?.isFanOfKnivesDagger === true;
      const isWindShear =
        projectile.projectileType === 'wind_shear' ||
        renderer?.mesh?.userData?.isWindShearProjectile === true;
      const wyvernBiteConcentratedVenom = renderer?.mesh?.userData?.barrageWyvernBite === true;
      const glacialBiteChill = isBarrageArrow === true && renderer?.mesh?.userData?.barrageGlacialBite === true;
      const entanglementBarrage = isBarrageArrow === true && renderer?.mesh?.userData?.barrageEntanglement === true;

      let damageType = 'projectile';
      if (isCrossentropyBolt) {
        damageType = 'crossentropy';
      } else if (isEntropicBolt) {
        damageType = 'entropic';
      } else if (isBarrageArrow) {
        damageType = 'barrage';
      } else if (isFanOfKnives) {
        damageType = 'fan_of_knives';
      } else if (isWindShear) {
        damageType = 'wind_shear';
      }

      const isBowPrimary =
        renderer?.mesh?.userData?.isRegularArrow === true ||
        renderer?.mesh?.userData?.isChargedArrow === true ||
        renderer?.mesh?.userData?.projectileType === 'burst_arrow';

      let cloudkillProc = false;
      if (isBowPrimary && damageType === 'projectile' && target.getComponent(Enemy)) {
        const cs = (window as any).controlSystemRef?.current;
        const localEnt = cs?.getPlayerEntity?.() as { id: number } | null | undefined;
        if (
          localEnt &&
          projectile.owner === localEnt.id &&
          shouldApplyCloudkillTalent(cs?.talentLoadout) &&
          Math.random() < CLOUDKILL_PROC_CHANCE
        ) {
          cloudkillProc = true;
          if (this.combatSystem?.usesNetworkedEnemyDamage() !== true) {
            const impactTransform = target.getComponent(Transform);
            if (impactTransform) {
              const impactPos = impactTransform.getWorldPosition();
              impactPos.y = Math.max(1.5, impactPos.y);
              this.scheduleCloudkillVolley(projectile, impactPos);
            }
          }
        }
      }

      
      const entropicTalent =
        projectile.entropicBoltTalent ??
        (renderer?.mesh?.userData?.entropicBoltTalent as
          | 'wrathful'
          | 'staggering'
          | 'infesting'
          | 'arctic'
          | undefined);

      if (isFanOfKnives) {
        const infestedFlourishFan = renderer?.mesh?.userData?.infestedFlourishFanKnives === true;
        this.combatSystem.queueDamage(
          target,
          projectile.damage,
          projectileEntity,
          'fan_of_knives',
          projectile.sourcePlayerId,
          false,
          undefined,
          projectile.staggerToAdd != null && projectile.staggerToAdd > 0 ? projectile.staggerToAdd : undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          infestedFlourishFan ? true : undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
        );
      } else {
      this.combatSystem.queueDamage(
        target,
        projectile.damage,
        projectileEntity,
        damageType,
        projectile.sourcePlayerId,
        undefined,
        undefined,
        projectile.staggerToAdd != null && projectile.staggerToAdd > 0 ? projectile.staggerToAdd : undefined,
        undefined,
        undefined,
        isCrossentropyBolt && projectile.infernoCrossentropy === true,
        isCrossentropyBolt && projectile.reaperCrossentropy === true,
        undefined,
        wyvernBiteConcentratedVenom,
        undefined,
        undefined,
        isEntropicBolt && entropicTalent === 'wrathful',
        isEntropicBolt && entropicTalent === 'infesting',
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        isCrossentropyBolt && projectile.crossentropyPlague === true,
        glacialBiteChill,
        undefined,
        isCrossentropyBolt && projectile.crossentropyMeteor === true,
        entanglementBarrage,
        cloudkillProc,
      );
      }

      if (
        projectile.isPerfectShot === true &&
        target.getComponent(Enemy)
      ) {
        const cs = (window as any).controlSystemRef?.current;
        const localEnt = cs?.getPlayerEntity?.() as { id: number } | null | undefined;
        if (localEnt && projectile.owner === localEnt.id) {
          cs?.tryArcticStingBlizzardOnPerfectShotFirstHit?.(
            projectile.perfectShotVolleyId,
            target,
          );
        }
      }

      if (
        isCrossentropyBolt &&
        projectile.crossentropyGlacial === true &&
        target.getComponent(Enemy)
      ) {
        const glacialTransform = target.getComponent(Transform);
        if (glacialTransform) {
          const gp = glacialTransform.getWorldPosition().clone();
          gp.y = Math.max(1.5, gp.y);
          const cs = (window as any).controlSystemRef?.current;
          cs?.applyGlacialStormOnCrossentropyHit?.(gp);
        }
      }

      if (
        isCrossentropyBolt &&
        projectile.crossentropyMeteor === true &&
        target.getComponent(Enemy)
      ) {
        const cs = (window as any).controlSystemRef?.current;
        const localEnt = cs?.getPlayerEntity?.() as { id: number } | null | undefined;
        if (
          localEnt &&
          projectile.owner === localEnt.id &&
          this.combatSystem?.usesNetworkedEnemyDamage() !== true
        ) {
          const meteorTargetTransform = target.getComponent(Transform);
          if (meteorTargetTransform) {
            const impactPos = meteorTargetTransform.getWorldPosition();
            impactPos.y = Math.max(1.5, impactPos.y);
            const meteorCount = rollCrossentropyMeteorStrikeCount();
            for (let i = 0; i < meteorCount; i++) {
              this.scheduleCrossentropyMeteorImpact(projectile, impactPos, i * CROSSENTROPY_METEOR_STAGGER_MS);
            }
          }
        }
      }

      if (
        isCrossentropyBolt &&
        projectile.crossentropyFragmentation === true &&
        projectile.crossentropySuppressFragmentation !== true &&
        target.getComponent(Enemy)
      ) {
        const csFrag = (window as any).controlSystemRef?.current;
        const localFrag = csFrag?.getPlayerEntity?.() as { id: number } | null | undefined;
        if (
          localFrag &&
          projectile.owner === localFrag.id &&
          Math.random() < CROSSENTROPY_FRAGMENTATION_PROC_CHANCE
        ) {
          const fragOutcome = this.trySpawnCrossentropyFragmentationBolt(
            projectileEntity,
            projectile,
            target,
          );
          if (
            process.env.NODE_ENV === 'development' &&
            fragOutcome === 'no_candidates'
          ) {
            console.debug(
              '[Crossentropy FRAGMENTATION] 50% proc succeeded but no ricochet target: need another living Enemy with Health within',
              CROSSENTROPY_FRAGMENTATION_NEAR_RADIUS_UNITS,
              'horizontal units (xz) of the struck enemy.',
            );
          }
        }
      }

      if (
        isCrossentropyBolt &&
        projectile.reaperCrossentropy === true &&
        target.getComponent(Enemy)
      ) {
        const hitTransform = target.getComponent(Transform);
        if (hitTransform) {
          const soulPos = hitTransform.position.clone();
          soulPos.y = Math.max(1.5, soulPos.y);
          this.world.emitEvent('hauntedSoulEffect', { position: soulPos });
        }
      }

      // CRITICAL FIX: Emit explosion event for CrossentropyBolt hits
      // This ensures the local player sees the explosion visual effect
      if (isCrossentropyBolt && !projectile.reaperCrossentropy) {
        const projectileTransform = projectileEntity.getComponent(Transform);
        const targetTransform = target.getComponent(Transform);
        
        if (projectileTransform && targetTransform) {
          // Use the target's position for the explosion center (where the bolt hit)
          const explosionPosition = targetTransform.position.clone();
          // Ensure explosion is visible by setting it at a consistent height
          // Boss entities have colliders centered at y=1, so position explosion at y=1.5 for visibility
          explosionPosition.y = Math.max(1.5, explosionPosition.y);

          // Emit explosion event for CrossentropyBolt
          const theme = crossentropyThemeFromProjectile(projectile);
          const color =
            theme === 'inferno'
              ? new Color('#FF3300')
              : theme === 'glacial'
                ? new Color('#0a3d5c')
                : theme === 'tempest'
                  ? new Color('#2288FF')
                  : theme === 'plague'
                    ? new Color('#33DD66')
                    : new Color('#8B00FF');
          this.world.emitEvent('explosion', {
            position: explosionPosition,
            color,
            size: 2.0, // Increased size for better visibility on large bosses
            duration: 1.0,
            type: 'crossentropy' as const,
            chargeTime: 1.0, // Default charge time
            infernoCrossentropy: theme === 'inferno',
            crossentropyVisualTheme: theme,
          });
          if (projectile.crossentropyPlague === true) {
            this.world.emitEvent('crossentropyPlagueVenom', {
              position: explosionPosition.clone(),
            });
          }
        }
      }
    } else {
      // Fallback to direct damage (pass entity for shield absorption)
      const currentTime = Date.now() / 1000;
      const damageDealt = targetHealth.takeDamage(projectile.damage, currentTime, target);
      
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
      if (target.userData?.isCoopAllyPlayer) continue;

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
      sourcePlayerId?: string;
      staggerToAdd?: number;
      dualCoilLane?: 0 | 1;
      /** Bow perfect window — Wrathful Shots crit. */
      isPerfectShot?: boolean;
      perfectShotVolleyId?: number;
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
    projectile.sourcePlayerId = config?.sourcePlayerId || 'unknown';
    if (config?.staggerToAdd != null && config.staggerToAdd > 0) {
      projectile.staggerToAdd = config.staggerToAdd;
    }
    if (config?.dualCoilLane !== undefined) {
      projectile.dualCoilLane = config.dualCoilLane;
    }
    if (config?.isPerfectShot === true) {
      projectile.isPerfectShot = true;
    }
    if (config?.perfectShotVolleyId != null) {
      projectile.perfectShotVolleyId = config.perfectShotVolleyId;
    }
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

  /**
   * FRAGMENTATION ricochet: spawns a second Crossentropy bolt toward the closest eligible enemy.
   * Verification: chain only appears when at least one other target exists within xz radius
   * `CROSSENTROPY_FRAGMENTATION_NEAR_RADIUS_UNITS`; local shooter also notifies peers via
   * `crossentropyBoltBroadcastCallback` when a bolt is spawned.
   */
  private trySpawnCrossentropyFragmentationBolt(
    projectileEntity: Entity,
    projectile: Projectile,
    struckTarget: Entity,
  ): 'spawned' | 'no_candidates' | 'aborted' {
    const struckTf = struckTarget.getComponent(Transform);
    if (!struckTf) return 'aborted';

    const anchor = struckTf.getWorldPosition().clone();
    anchor.y = Math.max(1.5, anchor.y);

    const r2 = CROSSENTROPY_FRAGMENTATION_NEAR_RADIUS_UNITS * CROSSENTROPY_FRAGMENTATION_NEAR_RADIUS_UNITS;
    const candidates: Array<{ entity: Entity; distanceSq: number }> = [];
    const potential = this.world.queryEntities([Transform, Health, Enemy]);
    for (const ent of potential) {
      if (ent.id === struckTarget.id) continue;
      if (ent.userData?.isCoopAllyPlayer) continue;
      if (ent.userData?.isCoopAlliedUnit) continue;
      if (ent.userData?.coopServerEnemyType === 'player-zombie') continue;
      const h = ent.getComponent(Health);
      if (!h || h.isDead) continue;
      const tf = ent.getComponent(Transform);
      if (!tf) continue;
      const wp = tf.getWorldPosition();
      const dx = wp.x - anchor.x;
      const dz = wp.z - anchor.z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq > r2) continue;
      candidates.push({ entity: ent, distanceSq });
    }
    if (candidates.length === 0) return 'no_candidates';

    const pick = candidates.reduce((closest, current) =>
      current.distanceSq < closest.distanceSq ? current : closest
    ).entity;
    const pickTf = pick.getComponent(Transform);
    if (!pickTf) return 'aborted';
    const targetPos = pickTf.getWorldPosition();

    const rawDir = this.tempVector.copy(targetPos).sub(anchor);
    rawDir.y = 0;
    const direction = rawDir.lengthSq() < 1e-8 ? new Vector3(0, 0, 1) : rawDir.clone().normalize();

    const spawnPosition = anchor.clone().addScaledVector(direction, 0.5);

    const rendererUd = projectileEntity.getComponent(Renderer)?.mesh?.userData as Record<string, unknown> | undefined;
    const subclass =
      rendererUd?.subclass != null ? (rendererUd.subclass as WeaponSubclass) : undefined;
    const level =
      rendererUd?.level != null && typeof rendererUd.level === 'number' ? rendererUd.level : undefined;
    const opacity =
      rendererUd?.opacity != null && typeof rendererUd.opacity === 'number'
        ? rendererUd.opacity
        : 1.0;

    const reaper = projectile.reaperCrossentropy === true;
    const fragmentConfig = {
      speed: projectile.speed,
      damage: projectile.damage,
      lifetime: projectile.maxLifetime,
      opacity,
      sourcePlayerId: projectile.sourcePlayerId || 'unknown',
      infernoCrossentropy: projectile.infernoCrossentropy === true,
      ...(reaper
        ? {
            maxDistance: projectile.maxDistance,
            reaperCrossentropy: true as const,
            piercing: true as const,
          }
        : { piercing: false as const }),
      crossentropyTempest: projectile.crossentropyTempest === true,
      crossentropyPlague: projectile.crossentropyPlague === true,
      crossentropyGlacial: projectile.crossentropyGlacial === true,
      crossentropyMeteor: projectile.crossentropyMeteor === true,
      crossentropySuppressFragmentation: true as const,
      ...(subclass != null ? { subclass } : {}),
      ...(typeof level === 'number' ? { level } : {}),
    };

    const fragmentEntity = this.createCrossentropyBoltProjectile(
      this.world,
      spawnPosition,
      direction,
      projectile.owner,
      fragmentConfig,
    );
    fragmentEntity.getComponent(Projectile)?.addHitTarget(struckTarget.id);

    if (this.crossentropyBoltBroadcastCallback) {
      this.crossentropyBoltBroadcastCallback(spawnPosition, direction, fragmentConfig as Record<string, unknown>);
    }

    return 'spawned';
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
      sourcePlayerId?: string; // CRITICAL FIX: Add sourcePlayerId to config
      infernoCrossentropy?: boolean;
      reaperCrossentropy?: boolean;
      crossentropyTempest?: boolean;
      crossentropyPlague?: boolean;
      crossentropyGlacial?: boolean;
      crossentropyMeteor?: boolean;
      crossentropyFragmentation?: boolean;
      crossentropySuppressFragmentation?: boolean;
      maxDistance?: number;
    }
  ): Entity {
    const crossentropyDirection = direction.clone();
    if (crossentropyDirection.y < 0) crossentropyDirection.y = 0;
    if (crossentropyDirection.lengthSq() < 1e-8) crossentropyDirection.set(0, 0, -1);
    crossentropyDirection.normalize();

    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component with scythe-specific settings
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 20; // Slower than arrows
    projectile.damage = config?.damage || 30; // Higher damage than arrows
    projectile.maxLifetime = config?.lifetime || 1.75; // Longer lifetime
    projectile.owner = ownerId;
    projectile.sourcePlayerId = config?.sourcePlayerId || 'unknown'; // CRITICAL FIX: Set sourcePlayerId for proper damage attribution
    projectile.setDirection(crossentropyDirection);
    projectile.setStartPosition(position.clone());
    if (config?.infernoCrossentropy) {
      projectile.infernoCrossentropy = true;
    }
    if (config?.reaperCrossentropy) {
      projectile.reaperCrossentropy = true;
    }
    if (config?.crossentropyTempest) {
      projectile.crossentropyTempest = true;
      projectile.staggerToAdd = CROSSENTROPY_TEMPEST_STAGGER;
    }
    if (config?.crossentropyPlague) {
      projectile.crossentropyPlague = true;
    }
    if (config?.crossentropyGlacial) {
      projectile.crossentropyGlacial = true;
    }
    if (config?.crossentropyMeteor) {
      projectile.crossentropyMeteor = true;
    }
    if (config?.crossentropyFragmentation) {
      projectile.crossentropyFragmentation = true;
    }
    if (config?.crossentropySuppressFragmentation) {
      projectile.crossentropySuppressFragmentation = true;
    }
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }
    if (config?.reaperCrossentropy && config?.maxDistance != null) {
      projectile.setMaxDistance(config.maxDistance);
    } else if (config?.maxDistance != null) {
      projectile.setMaxDistance(config.maxDistance);
    }

    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for CrossentropyBolt
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.28, 8, 8);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#00ff44',
      emissive: '#00ff44',
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0 // Very low opacity since React component will handle visuals
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as a CrossentropyBolt for special handling
    placeholderMesh.userData.isCrossentropyBolt = true;
    placeholderMesh.userData.projectileEntity = projectileEntity;
    placeholderMesh.userData.direction = crossentropyDirection.clone();
    if (config?.infernoCrossentropy) {
      placeholderMesh.userData.crossentropyInferno = true;
    }
    if (config?.reaperCrossentropy) {
      placeholderMesh.userData.reaperCrossentropy = true;
    }
    if (config?.crossentropyTempest) {
      placeholderMesh.userData.crossentropyTempest = true;
    }
    if (config?.crossentropyPlague) {
      placeholderMesh.userData.crossentropyPlague = true;
    }
    if (config?.crossentropyGlacial) {
      placeholderMesh.userData.crossentropyGlacial = true;
    }
    if (config?.crossentropyMeteor) {
      placeholderMesh.userData.crossentropyMeteor = true;
    }
    if (config?.crossentropyFragmentation === true) {
      placeholderMesh.userData.crossentropyFragmentation = true;
    }
    if (config?.crossentropySuppressFragmentation === true) {
      placeholderMesh.userData.crossentropySuppressFragmentation = true;
    }
    
    renderer.mesh = placeholderMesh;
    
    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false);
    } else {
      // console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);

    
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
      sourcePlayerId?: string;
      isCryoflame?: boolean;
      colorVariant?: string;
      entropicBoltTalent?: 'wrathful' | 'staggering' | 'infesting' | 'arctic';
    }
  ): Entity {
    const entropicDirection = direction.clone();
    if (entropicDirection.lengthSq() < 1e-8) entropicDirection.set(0, 0, -1);
    entropicDirection.normalize();

    const projectileEntity = world.createEntity();

    // Add Transform component
    const transform = world.createComponent(Transform);
    transform.position.copy(position);
    projectileEntity.addComponent(transform);

    // Add Projectile component with EntropicBolt-specific settings
    const projectile = world.createComponent(Projectile);
    projectile.speed = config?.speed || 20;
    projectile.damage = config?.damage || 31;
    projectile.maxLifetime = config?.lifetime ?? ENTROPIC_MAX_LIFETIME;
    projectile.owner = ownerId;
    projectile.sourcePlayerId = config?.sourcePlayerId || 'unknown';
    projectile.projectileType = 'entropic_bolt';
    projectile.setDirection(entropicDirection);
    projectile.setStartPosition(position);
    projectile.setMaxDistance(ENTROPIC_FORWARD_SCALE);
    
    if (config?.piercing) projectile.setPiercing(true);
    if (config?.explosive && config?.explosionRadius) {
      projectile.setExplosive(config.explosionRadius);
    }

    const entropicTalent = config?.entropicBoltTalent;
    if (entropicTalent) {
      projectile.entropicBoltTalent = entropicTalent;
      if (entropicTalent === 'staggering') {
        projectile.staggerToAdd = STAGGERING_ENTROPIC_BOLT_STAGGER;
      }
    }
    
    projectileEntity.addComponent(projectile);

    // Add Renderer component - we'll use a special marker for EntropicBolt
    const renderer = world.createComponent(Renderer);
    
    // Create a simple placeholder mesh that will be replaced by the React component
    const placeholderGeometry = new SphereGeometry(0.15, 6, 6);
    const placeholderMaterial = new MeshStandardMaterial({
      color: '#00ff44',
      emissive: '#00ff44',
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0
    });
    const placeholderMesh = new Mesh(placeholderGeometry, placeholderMaterial);
    
    // Mark this as an EntropicBolt for special handling
    placeholderMesh.userData.isEntropicBolt = true;
    placeholderMesh.userData.projectileEntity = projectileEntity;
    placeholderMesh.userData.direction = entropicDirection.clone();
    placeholderMesh.userData.isCryoflame = config?.isCryoflame || false;
    placeholderMesh.userData.colorVariant = config?.colorVariant || 'purple';
    placeholderMesh.userData.entropicBoltTalent = entropicTalent;

    renderer.mesh = placeholderMesh;

    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false);
    } else {
      // console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);


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
      maxDistance?: number;
      projectileType?: string; // Add projectile type for special handling
      sourcePlayerId?: string; // Add source player ID for multiplayer team validation
      staggerToAdd?: number;
      /** Wrathful Bite talent — replicated to other clients for Barrage visuals. */
      wrathfulBiteBarrage?: boolean;
      /** Wyvern Bite talent — green Barrage + Concentrated Venom. */
      wyvernBiteBarrage?: boolean;
      /** Staggering Bite — Barrage stagger; replicated for remote clients. */
      staggeringBiteBarrage?: boolean;
      /** Glacial Bite — light blue Barrage + chill on hit. */
      glacialBiteBarrage?: boolean;
      /** Entanglement — Barrage hit roots and damages over time. */
      entanglementBarrage?: boolean;
      dualCoilLane?: 0 | 1;
      /** Bow perfect — Wrathful Shots. */
      isPerfectShot?: boolean;
      /** Trigger Finger — uncharged bow tap; red tint on RegularArrow visuals. */
      triggerFingerUncharged?: boolean;
      /** Sabres Fan of Knives Flourish dagger tint key. */
      fanOfKnivesFlourishTint?: FanOfKnivesFlourishTint;
      /** INFESTED FLOURISH hit meta replication for coop zombie kills. */
      infestedFlourishFanKnives?: boolean;
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
    projectile.maxLifetime = config?.lifetime || 2;
    projectile.owner = ownerId;
    projectile.sourcePlayerId = config?.sourcePlayerId || 'unknown';
    projectile.projectileType = config?.projectileType || 'generic';
    if (config?.staggerToAdd != null && config.staggerToAdd > 0) {
      projectile.staggerToAdd = config.staggerToAdd;
    }
    if (config?.dualCoilLane !== undefined) {
      projectile.dualCoilLane = config.dualCoilLane;
    }
    if (config?.isPerfectShot === true) {
      projectile.isPerfectShot = true;
    }
    projectile.setDirection(direction);
    projectile.setStartPosition(position);
    
    // Set max distance if specified (for bow arrows)
    if (config?.maxDistance !== undefined) {
      projectile.setMaxDistance(config.maxDistance);
    }
    
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

    // Only mark as RegularArrow if it's actually a regular arrow or generic projectile
    // Don't mark special projectile types like wind_shear
    const projectileType = config?.projectileType || 'generic';
    if (projectileType === 'generic' || projectileType === 'regular_arrow') {
      placeholderMesh.userData.isRegularArrow = true;
    }

    placeholderMesh.userData.direction = direction.clone();
    placeholderMesh.userData.subclass = config?.subclass;
    placeholderMesh.userData.level = config?.level;
    placeholderMesh.userData.opacity = config?.opacity || 1.0;
    placeholderMesh.userData.projectileType = projectileType;
    if (config?.triggerFingerUncharged === true) {
      placeholderMesh.userData.triggerFingerUncharged = true;
    }

    const isFanOfKnivesProjectile = projectileType === 'fan_of_knives';
    if (isFanOfKnivesProjectile) {
      placeholderMesh.userData.isFanOfKnivesDagger = true;
      if (config?.fanOfKnivesFlourishTint != null) {
        placeholderMesh.userData.fanOfKnivesFlourishTint = config.fanOfKnivesFlourishTint;
      }
      if (config?.infestedFlourishFanKnives === true) {
        placeholderMesh.userData.infestedFlourishFanKnives = true;
      }
    }

    if (projectileType === 'wind_shear') {
      placeholderMesh.userData.isWindShearProjectile = true;
    }

    renderer.mesh = placeholderMesh;
    
    // Set shadow casting with safety check
    if (typeof renderer.setCastShadow === 'function') {
      renderer.setCastShadow(false); // Projectiles don't need to cast shadows
    } else {
      // console.warn('⚠️ Renderer component missing setCastShadow method:', renderer);
    }
    
    projectileEntity.addComponent(renderer);

    // Add Collider component
    const collider = world.createComponent(Collider);
    collider.radius = 0.15;
    collider.layer = CollisionLayer.PROJECTILE;
    projectileEntity.addComponent(collider);
    
    // Notify systems that the entity is ready (this will trigger RenderSystem.onEntityAdded)
    this.world.notifyEntityAdded(projectileEntity);
    
    return projectileEntity;
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
    this.vector3Pool.clear();
  }
}
