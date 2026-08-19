// Physics system for handling movement physics
import { Object3D, Raycaster, Vector3 } from '@/utils/three-exports';
import { PhysicsSystem as BasePhysicsSystem } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { WALL_SEGMENTS, WallSegmentDef } from '@/components/environment/CastleWalls';
import { THRONE_PILLAR_HULL_RADIUS } from '@/components/environment/ThroneRoom';
import { MAIN_MAP_RADIUS } from '@/utils/mapConstants';

export class PhysicsSystem extends BasePhysicsSystem {
  public readonly requiredComponents = [Transform, Movement];

  /** Horizontal circular map boundary (XZ distance from origin). */
  private mapRadius = MAIN_MAP_RADIUS;

  /** When false, castle wall AABB checks are skipped (co-op throne room). */
  private castleWallPhysicsEnabled = true;
  private arenaBoundaryMode: 'circle' | 'square' | 'hex' | 'none' = 'square';

  /** Legacy fixed tree discs; disable when forest visuals use procedural positions. */
  private treeCollisionEnabled = true;

  /** Circular XZ obstacles (throne pillars) — only used when castle walls are off. */
  private thronePillarObstacles: Array<{ x: number; z: number; radius: number }> = [];

  /** Optional circular XZ disc obstacles (typically empty). */
  private cornerMountainObstacles: Array<{ x: number; z: number; radius: number }> = [];

  /** Streamed explore-mode prop discs (trees/rocks); updated as chunks load/unload. */
  private streamedObstacles: Array<{ x: number; z: number; radius: number }> = [];

  /** Optional triangle mesh used for ground snap + wall blocking (dungeon interiors). */
  private meshCollider: Object3D | null = null;
  /** Optional XZ AABB used when mesh walking is active (or as a void fence). */
  private playableAabb: { minX: number; maxX: number; minZ: number; maxZ: number } | null = null;
  private _meshRaycaster = new Raycaster();
  private _meshRayOrigin = new Vector3();
  private _meshRayDir = new Vector3();
  private _meshDown = new Vector3(0, -1, 0);
  private _meshHitNormal = new Vector3();

  private _deltaPosition = new Vector3();
  private _currentPosition = new Vector3();
  private _potentialPosition = new Vector3();
  private _horizontalPosition = new Vector3();
  private _currentHorizontalPos = new Vector3();
  private _toCenter = new Vector3();
  private _tangent = new Vector3();
  private _horizontalMovement = new Vector3();
  private _newHorizontalPosition = new Vector3();
  private _velocityNormal = new Vector3();
  private _targetVelocity = new Vector3();
  private _accelDelta = new Vector3();
  private _treeCollisionResult = {
    hasCollision: false,
    normal: new Vector3(),
    treeCenter: new Vector3(),
  };
  private _cornerMountainCollisionResult = {
    hasCollision: false,
    normal: new Vector3(),
    center: new Vector3(),
    blockRadius: 0,
  };
  private _thronePillarCollisionResult = {
    hasCollision: false,
    normal: new Vector3(),
    pillarCenter: new Vector3(),
    blockRadius: 0,
  };
  private _wallCollisionResult = {
    hasCollision: false,
    normal: new Vector3(),
    closestPoint: new Vector3(),
    segmentIndex: -1,
  };
  private _horizontalPosScratch = new Vector3();
  private _treeHorizontalScratch = new Vector3();
  private _slideHorizontalScratch = new Vector3();
  private _pushDirectionScratch = new Vector3();
  private _centerScratch = new Vector3();
  private _hexNormalScratch = new Vector3();
  private _hexStrongestNormal = new Vector3(1, 0, 0);

  constructor() {
    super();
    this.priority = 15; // Run after control system but before rendering
  }

  public setMapRadius(radius: number): void {
    this.mapRadius = Math.max(1, radius);
  }

  public getMapRadius(): number {
    return this.mapRadius;
  }

  public setCastleWallPhysicsEnabled(enabled: boolean): void {
    this.castleWallPhysicsEnabled = enabled;
    this.arenaBoundaryMode = enabled ? 'square' : 'circle';
  }

  public setArenaBoundaryMode(mode: 'circle' | 'square' | 'hex' | 'none'): void {
    this.arenaBoundaryMode = mode;
  }

  public setTreeCollisionEnabled(enabled: boolean): void {
    this.treeCollisionEnabled = enabled;
  }

  /**
   * When castle walls are disabled, use these circular XZ obstacles (throne pillars).
   * Pass null or [] to clear.
   */
  public setThronePillarObstacles(obstacles: Array<{ x: number; z: number; radius: number }> | null): void {
    this.thronePillarObstacles = obstacles && obstacles.length > 0 ? obstacles.slice() : [];
  }

  /** Optional circular XZ obstacles (e.g. legacy corner discs). Pass null or [] to clear. */
  public setCornerMountainObstacles(
    obstacles: Array<{ x: number; z: number; radius: number }> | null,
  ): void {
    this.cornerMountainObstacles = obstacles && obstacles.length > 0 ? obstacles.slice() : [];
  }

  /** Streamed circular XZ obstacles (explore-mode trees/rocks). Pass null or [] to clear. */
  public setStreamedObstacles(
    obstacles: Array<{ x: number; z: number; radius: number }> | null,
  ): void {
    this.streamedObstacles = obstacles && obstacles.length > 0 ? obstacles : [];
  }

  /** Last walkable mesh stand point — used to recover if the player falls through / off. */
  private hasLastMeshGround = false;
  private lastMeshGroundX = 0;
  private lastMeshGroundY = 1;
  private lastMeshGroundZ = 0;

  /** Triangle mesh for dungeon ground / walls. Pass null to restore flat Y=0 ground. */
  public setMeshCollider(collider: Object3D | null): void {
    this.meshCollider = collider;
    if (!collider) this.hasLastMeshGround = false;
  }

  public hasMeshCollider(): boolean {
    return this.meshCollider != null;
  }

  /** XZ playable fence. Pass null to disable. */
  public setPlayableAabb(
    aabb: { minX: number; maxX: number; minZ: number; maxZ: number } | null,
  ): void {
    this.playableAabb = aabb;
  }

  public update(entities: Entity[], deltaTime: number): void {
    // This runs every frame for variable timestep updates
    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const movement = entity.getComponent(Movement);

      // Skip if required components are missing
      if (!transform || !movement) {
        continue;
      }

      if (!transform.enabled || !movement.enabled || !movement.canMove) {
        continue;
      }

      // Update debuff states (frozen, slowed, etc.)
      if (typeof movement.updateDebuffs === 'function') {
        movement.updateDebuffs();
      } else {
        // console.warn('⚠️ Movement component missing updateDebuffs method:', movement);
      }

      this.syncHorizontalVelocityFromInput(movement);
      this.updateMovement(transform, movement, deltaTime);
    }
  }

  public fixedUpdate(entities: Entity[], fixedDeltaTime: number): void {
    // This runs at fixed timestep for physics
    for (const entity of entities) {
      const transform = entity.getComponent(Transform);
      const movement = entity.getComponent(Movement);

      // Skip if required components are missing
      if (!transform || !movement) {
        continue;
      }

      if (!transform.enabled || !movement.enabled || !movement.canMove) {
        continue;
      }

      this.applyPhysics(transform, movement, fixedDeltaTime);
    }
  }

  private updateMovement(transform: Transform, movement: Movement, deltaTime: number): void {
    // Update position based on velocity
    const deltaPosition = this._deltaPosition.copy(movement.velocity).multiplyScalar(deltaTime);

    // Calculate potential new position
    const currentPosition = this._currentPosition.copy(transform.position);
    const potentialPosition = this._potentialPosition.copy(currentPosition).add(deltaPosition);

    // Apply map boundary constraints with smooth sliding (matches enlarged grass / collision disc)
    const MAP_RADIUS = this.mapRadius;

    // Only check horizontal distance (ignore Y for boundary)
    const horizontalPosition = this._horizontalPosition.set(
      potentialPosition.x,
      0,
      potentialPosition.z,
    );
    const distanceFromCenter = horizontalPosition.length();
    const hexBoundary = this.arenaBoundaryMode === 'hex'
      ? this.getHexBoundaryCorrection(potentialPosition)
      : null;
    const skipArenaClamp = this.arenaBoundaryMode === 'none';

    if (this.meshCollider) {
      if (!movement.isDashing) {
        this.resolveMeshMovement(transform, movement, currentPosition, potentialPosition, deltaPosition);
      }
      return;
    }

    // Check for tree, corner mountains, throne pillars, and castle-wall collisions
    const treeCollision = this.treeCollisionEnabled
      ? this.checkTreeCollision(potentialPosition)
      : this._treeCollisionResult;
    if (!this.treeCollisionEnabled) {
      this._treeCollisionResult.hasCollision = false;
    }
    const cornerMountainCollision = this.checkCornerMountainCollision(potentialPosition);
    const thronePillarCollision = this.checkThronePillarCollision(potentialPosition);
    const wallCollision = this.castleWallPhysicsEnabled
      ? this.checkWallCollision(potentialPosition)
      : this._wallCollisionResult;
    if (!this.castleWallPhysicsEnabled) {
      this._wallCollisionResult.hasCollision = false;
    }

    // Circular clamp only when castle walls are off (throne prep). Main arena uses wall AABBs + square interior.
    if (!skipArenaClamp && hexBoundary && hexBoundary.outside) {
      const corrected = this.clampToHexBoundary(potentialPosition);
      transform.setPosition(corrected.x, currentPosition.y + deltaPosition.y, corrected.z);
      this._velocityNormal.copy(movement.velocity).projectOnVector(hexBoundary.normal);
      movement.velocity.sub(this._velocityNormal.multiplyScalar(0.5));
    } else if (!skipArenaClamp && !this.castleWallPhysicsEnabled && distanceFromCenter >= MAP_RADIUS) {
      // If we hit the boundary, calculate tangent movement for smooth sliding
      const currentHorizontalPos = this._currentHorizontalPos.set(
        currentPosition.x,
        0,
        currentPosition.z,
      );
      const toCenter = this._toCenter.copy(currentHorizontalPos).normalize();

      // Create tangent vector (perpendicular to radius)
      const tangent = this._tangent.set(-toCenter.z, 0, toCenter.x);

      // Project our horizontal movement onto the tangent
      const horizontalMovement = this._horizontalMovement.set(
        deltaPosition.x,
        0,
        deltaPosition.z,
      );
      const tangentMovement = tangent.multiplyScalar(horizontalMovement.dot(tangent));

      // Apply the tangential movement while keeping distance to center constant
      const newHorizontalPosition = this._newHorizontalPosition
        .copy(currentHorizontalPos)
        .add(tangentMovement);
      newHorizontalPosition.normalize().multiplyScalar(MAP_RADIUS);

      // Update position with tangent movement and preserve Y movement
      transform.setPosition(
        newHorizontalPosition.x,
        currentPosition.y + deltaPosition.y, // Allow vertical movement (jumping, falling)
        newHorizontalPosition.z
      );
    } else if (treeCollision.hasCollision) {
      // Handle tree collision with smooth sliding
      const slidePosition = this.calculateTreeSliding(currentPosition, deltaPosition, treeCollision);
      transform.setPosition(slidePosition.x, slidePosition.y, slidePosition.z);

      // Reduce velocity in the direction of the tree to prevent bouncing
      this._velocityNormal.copy(movement.velocity).projectOnVector(treeCollision.normal);
      movement.velocity.sub(this._velocityNormal.multiplyScalar(0.5));
    } else if (cornerMountainCollision.hasCollision) {
      const slidePosition = this.calculateTreeSliding(
        currentPosition,
        deltaPosition,
        { normal: cornerMountainCollision.normal, treeCenter: cornerMountainCollision.center },
        cornerMountainCollision.blockRadius,
      );
      transform.setPosition(slidePosition.x, slidePosition.y, slidePosition.z);

      this._velocityNormal.copy(movement.velocity).projectOnVector(cornerMountainCollision.normal);
      movement.velocity.sub(this._velocityNormal.multiplyScalar(0.5));
    } else if (thronePillarCollision.hasCollision) {
      const slidePosition = this.calculateTreeSliding(
        currentPosition,
        deltaPosition,
        { normal: thronePillarCollision.normal, treeCenter: thronePillarCollision.pillarCenter },
        thronePillarCollision.blockRadius,
      );
      transform.setPosition(slidePosition.x, slidePosition.y, slidePosition.z);

      this._velocityNormal.copy(movement.velocity).projectOnVector(thronePillarCollision.normal);
      movement.velocity.sub(this._velocityNormal.multiplyScalar(0.5));
    } else if (wallCollision.hasCollision) {
      // Handle castle-wall collision with smooth sliding (AABB)
      const slidePosition = this.calculateWallSliding(currentPosition, deltaPosition, wallCollision);
      transform.setPosition(slidePosition.x, slidePosition.y, slidePosition.z);

      // Reduce velocity in the direction of the wall to prevent bouncing
      this._velocityNormal.copy(movement.velocity).projectOnVector(wallCollision.normal);
      movement.velocity.sub(this._velocityNormal.multiplyScalar(0.5));
    } else {
      // If within bounds and no collision, move normally
      transform.translate(deltaPosition.x, deltaPosition.y, deltaPosition.z);
    }

    // Mark transform matrix as needing update
    transform.matrixNeedsUpdate = true;
  }

  /**
   * Horizontal clearance for maze walls + throne pillars (XZ), vs. segment AABBs / circles.
   * Must match the local player sphere radius in CoopGameScene so this pass agrees with
   * CollisionSystem (sphere vs ENVIRONMENT boxes); a smaller value fights ECS every frame.
   */
  private readonly horizontalClearanceRadius = 1.2;

  // Wall segments imported directly from CastleWalls so positions stay in sync
  private readonly WALL_SEGMENTS: WallSegmentDef[] = WALL_SEGMENTS;

  private getHexBoundaryCorrection(position: Vector3): { outside: boolean; normal: Vector3 } {
    const apothem = this.mapRadius * Math.cos(Math.PI / 6) - this.horizontalClearanceRadius;
    let maxExcess = 0;
    this._hexStrongestNormal.set(1, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      this._hexNormalScratch.set(Math.cos(a), 0, Math.sin(a));
      const excess =
        position.x * this._hexNormalScratch.x +
        position.z * this._hexNormalScratch.z -
        apothem;
      if (excess > maxExcess) {
        maxExcess = excess;
        this._hexStrongestNormal.copy(this._hexNormalScratch);
      }
    }
    return { outside: maxExcess > 0, normal: this._hexStrongestNormal };
  }

  private clampToHexBoundary(position: Vector3): Vector3 {
    const apothem = this.mapRadius * Math.cos(Math.PI / 6) - this.horizontalClearanceRadius;
    let x = position.x;
    let z = position.z;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i;
        const nx = Math.cos(a);
        const nz = Math.sin(a);
        const excess = x * nx + z * nz - apothem;
        if (excess > 0) {
          x -= nx * excess;
          z -= nz * excess;
        }
      }
    }
    return this._potentialPosition.set(x, position.y, z);
  }

  // Define tree positions (same as in Environment.tsx - reduced by half)
  private readonly TREE_POSITIONS = [
    // Middle ring (scaled to smaller main map)
    new Vector3(10.7, 0, 3.6), new Vector3(-10.7, 0, 3.6), new Vector3(3.6, 0, 10.7),
    // Outer ring
    new Vector3(14.3, 0, 7.1), new Vector3(-14.3, 0, 7.1), new Vector3(14.3, 0, -7.1), new Vector3(-14.3, 0, -7.1),
    new Vector3(7.1, 0, 14.3), new Vector3(-7.1, 0, 14.3), new Vector3(7.1, 0, -14.3), new Vector3(-7.1, 0, -14.3),
    new Vector3(8.6, 0, 8.6)
  ];
  private readonly TREE_RADIUS = 0.3; // Roughly half the pillar diameter

  private checkTreeCollision(position: Vector3): { hasCollision: boolean; normal: Vector3; treeCenter: Vector3 } {
    const result = this._treeCollisionResult;
    result.hasCollision = false;

    for (const treePos of this.TREE_POSITIONS) {
      const horizontalPos = this._horizontalPosScratch.set(position.x, 0, position.z);
      const treeHorizontal = this._treeHorizontalScratch.set(treePos.x, 0, treePos.z);
      const distance = horizontalPos.distanceTo(treeHorizontal);

      if (distance < this.TREE_RADIUS) {
        result.normal.copy(horizontalPos).sub(treeHorizontal);
        if (result.normal.length() === 0) {
          result.normal.set(1, 0, 0);
        } else {
          result.normal.normalize();
        }
        result.treeCenter.copy(treePos);
        result.hasCollision = true;
        return result;
      }
    }

    return result;
  }

  private calculateTreeSliding(
    currentPosition: Vector3,
    deltaPosition: Vector3,
    collision: { normal: Vector3; treeCenter: Vector3 },
    obstacleRadius: number = this.TREE_RADIUS,
  ): Vector3 {
    const tangent = this._tangent.set(-collision.normal.z, 0, collision.normal.x);
    const tangentMovement = this._horizontalMovement.copy(deltaPosition).projectOnVector(tangent);
    const slidePosition = this._currentPosition.copy(currentPosition).add(tangentMovement);

    const treeHorizontal = this._treeHorizontalScratch.set(
      collision.treeCenter.x,
      0,
      collision.treeCenter.z,
    );
    const slideHorizontal = this._slideHorizontalScratch.set(slidePosition.x, 0, slidePosition.z);
    const distanceAfterSlide = slideHorizontal.distanceTo(treeHorizontal);

    if (distanceAfterSlide < obstacleRadius) {
      this._pushDirectionScratch.copy(slideHorizontal).sub(treeHorizontal);
      if (this._pushDirectionScratch.length() === 0) {
        this._pushDirectionScratch.set(1, 0, 0);
      } else {
        this._pushDirectionScratch.normalize();
      }
      this._newHorizontalPosition
        .copy(treeHorizontal)
        .add(this._pushDirectionScratch.multiplyScalar(obstacleRadius));
      slidePosition.x = this._newHorizontalPosition.x;
      slidePosition.z = this._newHorizontalPosition.z;
    }

    return slidePosition;
  }

  private checkCornerMountainCollision(position: Vector3): {
    hasCollision: boolean;
    normal: Vector3;
    center: Vector3;
    blockRadius: number;
  } {
    const result = this._cornerMountainCollisionResult;
    result.hasCollision = false;
    result.blockRadius = 0;
    const horizontalPos = this._horizontalPosScratch.set(position.x, 0, position.z);

    for (const p of this.cornerMountainObstacles) {
      const center = this._centerScratch.set(p.x, 0, p.z);
      const dist = horizontalPos.distanceTo(center);
      const minCenterDist = p.radius + this.horizontalClearanceRadius;
      if (dist < minCenterDist) {
        result.normal.copy(horizontalPos).sub(center);
        if (result.normal.lengthSq() < 1e-6) {
          result.normal.set(1, 0, 0);
        } else {
          result.normal.normalize();
        }
        result.center.copy(center);
        result.blockRadius = minCenterDist;
        result.hasCollision = true;
        return result;
      }
    }

    return result;
  }

  /**
   * XZ discs from `getThronePrepPhysicsObstacles()` / `setThronePillarObstacles` (ThroneRoom layout).
   * Radius should match `THRONE_PILLAR_HULL_RADIUS` and ECS throne `PillarCollision` cylinders.
   */
  private checkThronePillarCollision(position: Vector3): {
    hasCollision: boolean;
    normal: Vector3;
    pillarCenter: Vector3;
    blockRadius: number;
  } {
    const result = this._thronePillarCollisionResult;
    result.hasCollision = false;
    result.blockRadius = 0;
    const horizontalPos = this._horizontalPosScratch.set(position.x, 0, position.z);

    for (const p of this.thronePillarObstacles) {
      const center = this._centerScratch.set(p.x, 0, p.z);
      const dist = horizontalPos.distanceTo(center);
      const obstacleR = p.radius > 0 ? p.radius : THRONE_PILLAR_HULL_RADIUS;
      const minCenterDist = obstacleR + this.horizontalClearanceRadius;
      if (dist < minCenterDist) {
        result.normal.copy(horizontalPos).sub(center);
        if (result.normal.lengthSq() < 1e-6) {
          result.normal.set(1, 0, 0);
        } else {
          result.normal.normalize();
        }
        result.pillarCenter.copy(center);
        result.blockRadius = minCenterDist;
        result.hasCollision = true;
        return result;
      }
    }

    for (const p of this.streamedObstacles) {
      const center = this._centerScratch.set(p.x, 0, p.z);
      const dist = horizontalPos.distanceTo(center);
      const obstacleR = p.radius > 0 ? p.radius : THRONE_PILLAR_HULL_RADIUS;
      const minCenterDist = obstacleR + this.horizontalClearanceRadius;
      if (dist < minCenterDist) {
        result.normal.copy(horizontalPos).sub(center);
        if (result.normal.lengthSq() < 1e-6) {
          result.normal.set(1, 0, 0);
        } else {
          result.normal.normalize();
        }
        result.pillarCenter.copy(center);
        result.blockRadius = minCenterDist;
        result.hasCollision = true;
        return result;
      }
    }

    return result;
  }

  /**
   * AABB collision: find the closest point on each wall segment's footprint to the
   * player position and check if it's within horizontalClearanceRadius.  Returns the push-out
   * normal (player-center → closest-point direction, inverted) and the segment index
   * so the sliding step can re-verify against the same box.
   */
  private checkWallCollision(position: Vector3): {
    hasCollision: boolean;
    normal: Vector3;
    closestPoint: Vector3;
    segmentIndex: number;
  } {
    const result = this._wallCollisionResult;
    result.hasCollision = false;
    result.segmentIndex = -1;
    const px = position.x;
    const pz = position.z;

    for (let i = 0; i < this.WALL_SEGMENTS.length; i++) {
      const seg = this.WALL_SEGMENTS[i];
      const [cx, , cz] = seg.center;
      const halfX = seg.sizeX / 2;
      const halfZ = seg.sizeZ / 2;

      const closestX = Math.max(cx - halfX, Math.min(px, cx + halfX));
      const closestZ = Math.max(cz - halfZ, Math.min(pz, cz + halfZ));

      const dx = px - closestX;
      const dz = pz - closestZ;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist < this.horizontalClearanceRadius) {
        if (dist < 0.001) {
          result.normal.set(1, 0, 0);
        } else {
          result.normal.set(dx / dist, 0, dz / dist);
        }
        result.closestPoint.set(closestX, 0, closestZ);
        result.segmentIndex = i;
        result.hasCollision = true;
        return result;
      }
    }

    return result;
  }

  private calculateWallSliding(
    currentPosition: Vector3,
    deltaPosition: Vector3,
    collision: { normal: Vector3; closestPoint: Vector3; segmentIndex:  number }
  ): Vector3 {
    const tangent = this._tangent.set(-collision.normal.z, 0, collision.normal.x);
    const tangentMovement = this._horizontalMovement.copy(deltaPosition).projectOnVector(tangent);
    const slidePosition = this._currentPosition.copy(currentPosition).add(tangentMovement);

    const seg = this.WALL_SEGMENTS[collision.segmentIndex];
    const [cx, , cz] = seg.center;
    const halfX = seg.sizeX / 2;
    const halfZ = seg.sizeZ / 2;

    const closestX = Math.max(cx - halfX, Math.min(slidePosition.x, cx + halfX));
    const closestZ = Math.max(cz - halfZ, Math.min(slidePosition.z, cz + halfZ));

    const dx = slidePosition.x - closestX;
    const dz = slidePosition.z - closestZ;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist < this.horizontalClearanceRadius) {
      if (dist < 0.001) {
        this._pushDirectionScratch.set(1, 0, 0);
      } else {
        this._pushDirectionScratch.set(dx / dist, 0, dz / dist);
      }
      slidePosition.x = closestX + this._pushDirectionScratch.x * this.horizontalClearanceRadius;
      slidePosition.z = closestZ + this._pushDirectionScratch.z * this.horizontalClearanceRadius;
    }

    return slidePosition;
  }

  private syncHorizontalVelocityFromInput(movement: Movement): void {
    if (movement.inputStrength > 0) {
      const effectiveMaxSpeed = movement.getEffectiveMaxSpeed();
      const targetVelocity = this._targetVelocity.copy(movement.moveDirection);
      targetVelocity.multiplyScalar(effectiveMaxSpeed * movement.inputStrength);
      movement.velocity.x = targetVelocity.x;
      movement.velocity.z = targetVelocity.z;
    } else {
      movement.velocity.x = 0;
      movement.velocity.z = 0;
    }
  }

  private applyPhysics(transform: Transform, movement: Movement, deltaTime: number): void {
    const meshDash = this.meshCollider != null && movement.isDashing;
    if (!meshDash) {
      movement.applyGravity(deltaTime);
    } else {
      movement.velocity.y = 0;
    }

    this.syncHorizontalVelocityFromInput(movement);

    // Apply any additional forces (like knockback, wind, etc.)
    movement.velocity.add(
      this._accelDelta.copy(movement.acceleration).multiplyScalar(deltaTime),
    );

    // Reset acceleration for next frame
    movement.acceleration.set(0, 0, 0);

    // Simple ground check (Y = 0 is ground level, account for sphere radius)
    const sphereRadius = 0.5; // Player sphere radius
    const groundLevel = sphereRadius; // Sphere center should be at radius height above ground

    if (this.meshCollider) {
      if (!movement.isDashing) {
        this.applyMeshGround(transform, movement, sphereRadius);
      }
      return;
    }
    
    if (transform.position.y <= groundLevel && movement.velocity.y <= 0) {
      transform.position.y = groundLevel;
      movement.velocity.y = 0;
      movement.isGrounded = true;
    } else {
      movement.isGrounded = false;
    }
  }

  private readonly meshWallRadius = 0.55;
  private readonly meshPlayerRadius = 0.5;
  private readonly meshWalkableMinNy = 0.55;
  private readonly meshMaxStepUp = 1.15;
  private readonly meshMaxStepDown = 2.4;
  private readonly meshDashMaxStepUp = 4.5;
  private readonly meshDashMaxStepDown = 2.4;
  private readonly meshMoveSubstep = 0.4;
  private readonly meshDashSubstep = 0.4;
  private readonly _meshDashOut = { x: 0, y: 0, z: 0, blocked: false };

  private meshRaycast(
    origin: Vector3,
    direction: Vector3,
    far: number,
    firstHitOnly: boolean,
  ) {
    if (!this.meshCollider) return [];
    this._meshRaycaster.near = 0;
    this._meshRaycaster.far = Math.max(0.05, far);
    (this._meshRaycaster as Raycaster & { firstHitOnly?: boolean }).firstHitOnly = firstHitOnly;
    this._meshRaycaster.set(origin, direction);
    return this._meshRaycaster.intersectObject(this.meshCollider, true);
  }

  private meshRaycastFirst(origin: Vector3, direction: Vector3, far: number) {
    const hits = this.meshRaycast(origin, direction, far, true);
    return hits.length > 0 ? hits[0] : null;
  }

  private hitWalkableNy(hit: { face?: { normal: Vector3 } | null; object?: Object3D }): number | null {
    if (!hit.face) return null;
    this._meshHitNormal.copy(hit.face.normal);
    if (hit.object) {
      this._meshHitNormal.transformDirection(hit.object.matrixWorld);
    }
    if (this._meshHitNormal.y <= this.meshWalkableMinNy) return null;
    return this._meshHitNormal.y;
  }

  /**
   * Downward probe that ignores ceilings / walls. Picks the walkable hit whose
   * height is nearest `feetY` inside the step-up / step-down window.
   */
  public probeWalkableGroundY(
    x: number,
    z: number,
    feetY: number,
    maxStepUp: number = this.meshMaxStepUp,
    maxStepDown: number = this.meshMaxStepDown,
  ): number | null {
    const originY = feetY + maxStepUp + 0.35;
    const far = maxStepUp + maxStepDown + 1.25;
    const hits = this.meshRaycast(
      this._meshRayOrigin.set(x, originY, z),
      this._meshDown,
      far,
      false,
    );
    let bestY: number | null = null;
    let bestDist = Infinity;
    const minY = feetY - maxStepDown;
    const maxY = feetY + maxStepUp;
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (this.hitWalkableNy(hit) == null) continue;
      const gy = hit.point.y;
      if (gy < minY - 1e-3 || gy > maxY + 1e-3) continue;
      const d = Math.abs(gy - feetY);
      if (d < bestDist) {
        bestDist = d;
        bestY = gy;
      }
    }
    return bestY;
  }

  /**
   * Substep an XZ dash onto walkable mesh, including higher ledges.
   * Stops at the last valid stand point instead of falling into void.
   */
  public resolveMeshDash(
    from: Vector3,
    desiredX: number,
    desiredZ: number,
  ): { x: number; y: number; z: number; blocked: boolean } {
    const out = this._meshDashOut;
    const feetStart = from.y - this.meshPlayerRadius;
    const startGround = this.probeWalkableGroundY(
      from.x,
      from.z,
      feetStart,
      this.meshDashMaxStepUp,
      this.meshDashMaxStepDown,
    );
    let x = from.x;
    let z = from.z;
    let feetY = startGround != null ? startGround : feetStart;
    const dx = desiredX - from.x;
    const dz = desiredZ - from.z;
    const moveLen = Math.hypot(dx, dz);
    let blocked = false;

    if (moveLen > 1e-5) {
      const steps = Math.max(1, Math.ceil(moveLen / this.meshDashSubstep));
      const stepX = dx / steps;
      const stepZ = dz / steps;
      const inv = 1 / moveLen;
      this._meshRayDir.set(dx * inv, 0, dz * inv);
      let chestY = feetY + this.meshPlayerRadius;

      for (let i = 0; i < steps; i++) {
        const tryX = x + stepX;
        const tryZ = z + stepZ;
        const stepLen = Math.hypot(stepX, stepZ);
        const wallHit = this.meshRaycastFirst(
          this._meshRayOrigin.set(x, chestY, z),
          this._meshRayDir,
          stepLen + this.meshWallRadius,
        );
        if (wallHit && wallHit.face) {
          this._meshHitNormal.copy(wallHit.face.normal);
          if (wallHit.object) {
            this._meshHitNormal.transformDirection(wallHit.object.matrixWorld);
          }
          if (Math.abs(this._meshHitNormal.y) <= this.meshWalkableMinNy) {
            blocked = true;
            break;
          }
        }

        const destGround = this.probeWalkableGroundY(
          tryX,
          tryZ,
          feetY,
          this.meshDashMaxStepUp,
          this.meshDashMaxStepDown,
        );
        if (destGround == null) {
          blocked = true;
          break;
        }
        x = tryX;
        z = tryZ;
        feetY = destGround;
        chestY = feetY + this.meshPlayerRadius;
      }
    }

    const clamped = this.clampPositionToPlayableAabb(x, z);
    if (clamped.x !== x || clamped.z !== z) {
      blocked = true;
      x = clamped.x;
      z = clamped.z;
      const clampedGround = this.probeWalkableGroundY(
        x,
        z,
        feetY,
        this.meshDashMaxStepUp,
        this.meshDashMaxStepDown,
      );
      if (clampedGround != null) feetY = clampedGround;
    }

    out.x = x;
    out.y = feetY + this.meshPlayerRadius;
    out.z = z;
    out.blocked = blocked;
    this.rememberMeshGround(out.x, out.y, out.z);
    return out;
  }

  /** Highest walkable hit below a high origin — recovers from spawning inside / falling under mesh. */
  private probeHighestWalkableGroundY(x: number, z: number): number | null {
    const hits = this.meshRaycast(
      this._meshRayOrigin.set(x, 24, z),
      this._meshDown,
      48,
      false,
    );
    let bestY: number | null = null;
    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (this.hitWalkableNy(hit) == null) continue;
      if (bestY == null || hit.point.y > bestY) bestY = hit.point.y;
    }
    return bestY;
  }

  private rememberMeshGround(x: number, y: number, z: number): void {
    this.hasLastMeshGround = true;
    this.lastMeshGroundX = x;
    this.lastMeshGroundY = y;
    this.lastMeshGroundZ = z;
  }

  private applyMeshGround(transform: Transform, movement: Movement, sphereRadius: number): void {
    const feetY = transform.position.y - sphereRadius;
    let groundY = this.probeWalkableGroundY(
      transform.position.x,
      transform.position.z,
      feetY,
    );
    if (groundY == null) {
      groundY = this.probeHighestWalkableGroundY(transform.position.x, transform.position.z);
    }
    if (groundY == null) {
      if (this.hasLastMeshGround) {
        transform.setPosition(this.lastMeshGroundX, this.lastMeshGroundY, this.lastMeshGroundZ);
        movement.velocity.y = 0;
        movement.isGrounded = true;
        return;
      }
      movement.isGrounded = false;
      return;
    }
    const desiredY = groundY + sphereRadius;
    const above = transform.position.y - desiredY;
    if (movement.velocity.y <= 0.2 && above <= Math.max(this.meshMaxStepUp, 8)) {
      transform.position.y = desiredY;
      movement.velocity.y = 0;
      movement.isGrounded = true;
      this.rememberMeshGround(transform.position.x, desiredY, transform.position.z);
      return;
    }
    movement.isGrounded = false;
  }

  private clampPositionToPlayableAabb(x: number, z: number): { x: number; z: number } {
    const aabb = this.playableAabb;
    if (!aabb) return { x, z };
    return {
      x: Math.max(aabb.minX, Math.min(aabb.maxX, x)),
      z: Math.max(aabb.minZ, Math.min(aabb.maxZ, z)),
    };
  }

  private resolveMeshMovement(
    transform: Transform,
    movement: Movement,
    currentPosition: Vector3,
    potentialPosition: Vector3,
    deltaPosition: Vector3,
  ): void {
    let x = currentPosition.x;
    let z = currentPosition.z;
    const dx = potentialPosition.x - currentPosition.x;
    const dz = potentialPosition.z - currentPosition.z;
    const moveLen = Math.hypot(dx, dz);
    let feetY = currentPosition.y - this.meshPlayerRadius;

    if (moveLen > 1e-5) {
      const steps = Math.max(1, Math.ceil(moveLen / this.meshMoveSubstep));
      const stepX = dx / steps;
      const stepZ = dz / steps;
      const inv = 1 / moveLen;
      const dirX = dx * inv;
      const dirZ = dz * inv;
      this._meshRayDir.set(dirX, 0, dirZ);

      for (let i = 0; i < steps; i++) {
        let tryX = x + stepX;
        let tryZ = z + stepZ;
        const stepLen = Math.hypot(stepX, stepZ);
        const wallHit = this.meshRaycastFirst(
          this._meshRayOrigin.set(x, feetY + this.meshPlayerRadius, z),
          this._meshRayDir,
          stepLen + this.meshWallRadius,
        );
        if (wallHit && wallHit.face) {
          this._meshHitNormal.copy(wallHit.face.normal);
          if (wallHit.object) {
            this._meshHitNormal.transformDirection(wallHit.object.matrixWorld);
          }
          if (Math.abs(this._meshHitNormal.y) <= this.meshWalkableMinNy) {
            this._meshHitNormal.y = 0;
            if (this._meshHitNormal.lengthSq() > 1e-6) {
              this._meshHitNormal.normalize();
              const into = dirX * this._meshHitNormal.x + dirZ * this._meshHitNormal.z;
              if (into > 0) {
                tryX = x + stepX - this._meshHitNormal.x * into * stepLen;
                tryZ = z + stepZ - this._meshHitNormal.z * into * stepLen;
                this._velocityNormal.set(this._meshHitNormal.x, 0, this._meshHitNormal.z);
                const vn = movement.velocity.x * this._velocityNormal.x
                  + movement.velocity.z * this._velocityNormal.z;
                if (vn > 0) {
                  movement.velocity.x -= this._velocityNormal.x * vn;
                  movement.velocity.z -= this._velocityNormal.z * vn;
                }
              }
            }
          }
        }

        const destGround = this.probeWalkableGroundY(tryX, tryZ, feetY);
        if (destGround == null) {
          break;
        }
        x = tryX;
        z = tryZ;
        feetY = destGround;
      }
    }

    const clamped = this.clampPositionToPlayableAabb(x, z);
    if (clamped.x !== x || clamped.z !== z) {
      const clampedGround = this.probeWalkableGroundY(clamped.x, clamped.z, feetY);
      if (clampedGround != null) feetY = clampedGround;
      x = clamped.x;
      z = clamped.z;
    }
    const nextY = movement.isGrounded
      ? feetY + this.meshPlayerRadius
      : currentPosition.y + deltaPosition.y;
    transform.setPosition(x, nextY, z);
    if (movement.isGrounded) {
      this.rememberMeshGround(x, nextY, z);
    }
    transform.matrixNeedsUpdate = true;
  }
}
