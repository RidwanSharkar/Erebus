// Movement system with WASD controls and physics
import { Camera, Vector3 } from '@/utils/three-exports';
import { MAIN_MAP_HALF_X, MAIN_MAP_HALF_Z, MAIN_MAP_RADIUS } from '@/utils/mapConstants';
import { CASTLE_WALL_HALF_THICKNESS, CASTLE_WALL_X_OFFSET, CASTLE_WALL_Z_OFFSET } from '@/components/environment/CastleWalls';
import { System } from '@/ecs/System';
import { Entity, Component } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { Movement } from '@/ecs/components/Movement';
import { Enemy } from '@/ecs/components/Enemy';
import { InputManager } from '@/core/InputManager';

export class MovementSystem extends System {
  public readonly requiredComponents = [Transform, Movement];
  private inputManager: InputManager;
  private camera: Camera | null = null;

  /** When true, skip circular map clamp and rely on castle wall AABBs (matches PhysicsSystem). */
  private castleWallPhysicsEnabled = true;

  private _inputDirection = new Vector3();
  private _cameraDirection = new Vector3();
  private _cameraRight = new Vector3();
  private _cameraForward = new Vector3();
  private _worldDirection = new Vector3();
  private _zeroDirection = new Vector3(0, 0, 0);
  private _targetVelocity = new Vector3();
  private _accelDelta = new Vector3();
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
  private _wallCollisionResult = {
    hasCollision: false,
    normal: new Vector3(),
    wallIndex: -1,
  };
  private _upVector = new Vector3(0, 1, 0);

  constructor(inputManager: InputManager) {
    super();
    this.inputManager = inputManager;
    this.priority = 10; // Run early in the update cycle, before collision system
  }

  public setCamera(camera: Camera): void {
    this.camera = camera;
  }

  public setCastleWallPhysicsEnabled(enabled: boolean): void {
    this.castleWallPhysicsEnabled = enabled;
  }

  public update(entities: Entity[], deltaTime: number): void {
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

      // Check if this is an immobilized enemy - skip ordinary locomotion only.
      const enemy = entity.getComponent(Enemy);
      if (enemy && (enemy.isFrozen || enemy.isStunned || enemy.isEntangled)) {
        continue;
      }

      // Handle input-based movement
      this.handleInput(entity, transform, movement);

      // Apply physics
      this.applyPhysics(transform, movement, deltaTime);

      // Update transform position
      this.updatePosition(transform, movement, deltaTime);
    }
  }

  private handleInput(entity: Entity, transform: Transform, movement: Movement): void {
    // Get input direction
    this._inputDirection.set(0, 0, 0);
    let hasInput = false;

    // WASD movement
    if (this.inputManager.isKeyPressed('w')) {
      this._inputDirection.z -= 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('s')) {
      this._inputDirection.z += 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('a')) {
      this._inputDirection.x -= 1;
      hasInput = true;
    }
    if (this.inputManager.isKeyPressed('d')) {
      this._inputDirection.x += 1;
      hasInput = true;
    }

    // Normalize diagonal movement
    if (this._inputDirection.length() > 0) {
      this._inputDirection.normalize();
    }

    // Convert input to world space based on camera orientation
    if (this.camera && hasInput) {
      this.camera.getWorldDirection(this._cameraDirection);

      this._cameraRight.crossVectors(this._cameraDirection, this._upVector).normalize();
      this._cameraForward.crossVectors(this._upVector, this._cameraRight).normalize();

      this._worldDirection.set(0, 0, 0);
      this._worldDirection.addScaledVector(this._cameraRight, this._inputDirection.x);
      this._worldDirection.addScaledVector(this._cameraForward, -this._inputDirection.z);
      this._worldDirection.normalize();

      movement.setMoveDirection(this._worldDirection, 1.0);
    } else if (!hasInput) {
      movement.setMoveDirection(this._zeroDirection, 0);
    }

    // Handle jumping
    if (this.inputManager.isKeyPressed(' ')) { // Spacebar
      movement.jump();
    }
  }

  private applyPhysics(transform: Transform, movement: Movement, deltaTime: number): void {
    // Apply gravity (only affects Y velocity)
    movement.applyGravity(deltaTime);

    // Handle knockback movement (takes priority over input)
    const currentTime = Date.now() / 1000; // Convert to seconds
    const knockbackResult = movement.updateKnockback(currentTime);

    if (knockbackResult.newPosition) {
      transform.position.copy(knockbackResult.newPosition);
    }

    if (movement.isKnockbacked) {
      // Skip input-based movement while being knockbacked
      return;
    }

    // Handle horizontal movement directly for immediate response
    if (movement.inputStrength > 0) {
      const targetVelocity = this._targetVelocity.copy(movement.moveDirection);
      targetVelocity.multiplyScalar(movement.maxSpeed * movement.inputStrength);
      
      // Set horizontal velocity directly (preserve Y velocity for gravity/jumping)
      movement.velocity.x = targetVelocity.x;
      movement.velocity.z = targetVelocity.z;
    } else {
      // No input - stop horizontal movement immediately for responsive controls
      movement.velocity.x = 0;
      movement.velocity.z = 0;
    }

    // Apply any additional forces (like knockback, wind, etc.)
    movement.velocity.add(this._accelDelta.copy(movement.acceleration).multiplyScalar(deltaTime));

    // Reset acceleration for next frame
    movement.acceleration.set(0, 0, 0);

    // Simple ground check (Y = 0 is ground level, account for sphere radius)
    const sphereRadius = 0.5; // Player sphere radius
    const groundLevel = sphereRadius; // Sphere center should be at radius height above ground
    
    if (transform.position.y <= groundLevel && movement.velocity.y <= 0) {
      transform.position.y = groundLevel;
      movement.velocity.y = 0;
      movement.isGrounded = true;
    } else {
      movement.isGrounded = false;
    }
  }

  private updatePosition(transform: Transform, movement: Movement, deltaTime: number): void {
    const deltaPosition = this._deltaPosition.copy(movement.velocity).multiplyScalar(deltaTime);
    const currentPosition = this._currentPosition.copy(transform.position);
    const potentialPosition = this._potentialPosition.copy(currentPosition).add(deltaPosition);

    const MAP_RADIUS = MAIN_MAP_RADIUS;
    const horizontalPosition = this._horizontalPosition.set(
      potentialPosition.x,
      0,
      potentialPosition.z,
    );
    const distanceFromCenter = horizontalPosition.length();

    const wallCollision = this.checkWallCollision(potentialPosition);

    if (!this.castleWallPhysicsEnabled && distanceFromCenter >= MAP_RADIUS) {
      const currentHorizontalPos = this._currentHorizontalPos.set(
        currentPosition.x,
        0,
        currentPosition.z,
      );
      const toCenter = this._toCenter.copy(currentHorizontalPos).normalize();
      const tangent = this._tangent.set(-toCenter.z, 0, toCenter.x);
      const horizontalMovement = this._horizontalMovement.set(
        deltaPosition.x,
        0,
        deltaPosition.z,
      );
      const tangentMovement = tangent.multiplyScalar(horizontalMovement.dot(tangent));
      const newHorizontalPosition = this._newHorizontalPosition
        .copy(currentHorizontalPos)
        .add(tangentMovement);
      newHorizontalPosition.normalize().multiplyScalar(MAP_RADIUS);

      transform.setPosition(
        newHorizontalPosition.x,
        currentPosition.y + deltaPosition.y,
        newHorizontalPosition.z
      );
    } else if (wallCollision.hasCollision) {
      const slidePosition = this.calculateWallSliding(currentPosition, deltaPosition, wallCollision);
      transform.setPosition(slidePosition.x, slidePosition.y, slidePosition.z);

      this._velocityNormal.copy(movement.velocity).projectOnVector(wallCollision.normal);
      movement.velocity.sub(this._velocityNormal.multiplyScalar(0.5));
    } else {
      transform.translate(deltaPosition.x, deltaPosition.y, deltaPosition.z);
    }

    transform.matrixNeedsUpdate = true;
  }

  // Castle wall AABB segments — mirrors CastleWalls perimeter (half-extents)
  private readonly WALL_SEGMENTS = [
    { cx: 0,   cz:  CASTLE_WALL_Z_OFFSET,  hx: MAIN_MAP_HALF_X + CASTLE_WALL_HALF_THICKNESS * 2, hz: CASTLE_WALL_HALF_THICKNESS },
    { cx: 0,   cz: -CASTLE_WALL_Z_OFFSET,  hx: MAIN_MAP_HALF_X + CASTLE_WALL_HALF_THICKNESS * 2, hz: CASTLE_WALL_HALF_THICKNESS },
    { cx:  CASTLE_WALL_X_OFFSET, cz: 0,  hx: CASTLE_WALL_HALF_THICKNESS, hz: MAIN_MAP_HALF_Z + CASTLE_WALL_HALF_THICKNESS * 2 },
    { cx: -CASTLE_WALL_X_OFFSET, cz: 0,  hx: CASTLE_WALL_HALF_THICKNESS, hz: MAIN_MAP_HALF_Z + CASTLE_WALL_HALF_THICKNESS * 2 },
  ];
  private readonly WALL_PLAYER_RADIUS = 0.5;

  private checkWallCollision(position: Vector3): { hasCollision: boolean; normal: Vector3; wallIndex: number } {
    const result = this._wallCollisionResult;
    result.hasCollision = false;
    result.wallIndex = -1;
    const r = this.WALL_PLAYER_RADIUS;
    for (let i = 0; i < this.WALL_SEGMENTS.length; i++) {
      const wall = this.WALL_SEGMENTS[i];
      const dx = Math.abs(position.x - wall.cx);
      const dz = Math.abs(position.z - wall.cz);
      if (dx < wall.hx + r && dz < wall.hz + r) {
        const overlapX = (wall.hx + r) - dx;
        const overlapZ = (wall.hz + r) - dz;
        if (overlapX < overlapZ) {
          result.normal.set(position.x > wall.cx ? 1 : -1, 0, 0);
        } else {
          result.normal.set(0, 0, position.z > wall.cz ? 1 : -1);
        }
        result.wallIndex = i;
        result.hasCollision = true;
        return result;
      }
    }
    return result;
  }

  private calculateWallSliding(currentPosition: Vector3, deltaPosition: Vector3, collision: { normal: Vector3; wallIndex: number }): Vector3 {
    const tangent = this._tangent.set(-collision.normal.z, 0, collision.normal.x);
    const tangentMovement = this._horizontalMovement.copy(deltaPosition).projectOnVector(tangent);
    const slidePosition = this._currentPosition.copy(currentPosition).add(tangentMovement);

    // After sliding, re-check and push out if we're still inside the AABB
    const wall = this.WALL_SEGMENTS[collision.wallIndex];
    if (!wall) return slidePosition;

    const r = this.WALL_PLAYER_RADIUS;
    const sdx = Math.abs(slidePosition.x - wall.cx);
    const sdz = Math.abs(slidePosition.z - wall.cz);
    if (sdx < wall.hx + r && sdz < wall.hz + r) {
      // Push out along the same normal
      if (collision.normal.x !== 0) {
        slidePosition.x = wall.cx + collision.normal.x * (wall.hx + r);
      } else {
        slidePosition.z = wall.cz + collision.normal.z * (wall.hz + r);
      }
    }

    return slidePosition;
  }

  // Utility methods for external systems
  public getMovingEntities(entities: Entity[]): Entity[] {
    return entities.filter(entity => {
      const movement = entity.getComponent(Movement);
      return movement && movement.isMoving();
    });
  }

  public getGroundedEntities(entities: Entity[]): Entity[] {
    return entities.filter(entity => {
      const movement = entity.getComponent(Movement);
      return movement && movement.isGrounded;
    });
  }

  public stopEntity(entity: Entity): void {
    const movement = entity.getComponent(Movement);
    if (movement) {
      movement.stop();
    }
  }

  public addForceToEntity(entity: Entity, force: Vector3): void {
    const movement = entity.getComponent(Movement);
    if (movement) {
      movement.addForce(force);
    }
  }

  public addImpulseToEntity(entity: Entity, impulse: Vector3): void {
    const movement = entity.getComponent(Movement);
    if (movement) {
      movement.addImpulse(impulse);
    }
  }
}
