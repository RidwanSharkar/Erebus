// Camera system for third-person camera controls
import { PerspectiveCamera, Spherical, Vector3 } from '@/utils/three-exports';
import { System } from '@/ecs/System';
import { Entity } from '@/ecs/Entity';
import { Transform } from '@/ecs/components/Transform';
import { InputManager } from '@/core/InputManager';
import { MathUtils } from '@/utils/MathUtils';

export interface CameraConfig {
  distance: number;
  height: number;
  mouseSensitivity: number;
  smoothing: number;
  minPolarAngle: number;
  maxPolarAngle: number;
  maxDistance: number;
}

export class CameraSystem extends System {
  public readonly requiredComponents = [Transform];
  private camera: PerspectiveCamera;
  private inputManager: InputManager;
  private target: Entity | null = null;
  
  // Camera configuration
  private config: CameraConfig = {
    distance: 10,
    height: 5,
    mouseSensitivity: 0.005, // Increased for better responsiveness
    smoothing: 0.1,
    minPolarAngle: Math.PI / 3.5, // Prevent camera from going above horizon
    maxPolarAngle: Math.PI / 2.5, // Prevent camera from looking underneath the map
    maxDistance: 12.5,
  };

  // Camera state
  private spherical = new Spherical(10, Math.PI / 3, 0);
  private targetPosition = new Vector3();
  private currentPosition = new Vector3();
  private currentLookAt = new Vector3();
  private targetLookAt = new Vector3();
  private damageShakeOffset = new Vector3();
  private damageShakeTime = 0;
  private damageShakeDuration = 0;
  private damageShakeIntensity = 0;
  private damageShakeSeed = 0;
  
  // Mouse state for camera rotation
  private isRightMouseDown = false;
  private wheelListenerAdded = false;

  // Stun state for camera rotation disable
  private cameraRotationDisabled = false;
  private disabledByEntityId: string | null = null;

  // Ice Beam state for camera rotation speed reduction
  private isIcebeaming = false;

  constructor(camera: PerspectiveCamera, inputManager: InputManager, config?: Partial<CameraConfig>) {
    super();
    this.camera = camera;
    this.inputManager = inputManager;
    this.priority = 900; // Run late, after movement

    if (config) {
      this.config = { ...this.config, ...config };
    }

    this.spherical.radius = this.config.distance;
    this.spherical.phi = Math.PI / 3; // Start at 60 degrees
    this.spherical.theta = 0;

    this.setupEventListeners();
    this.setupInitialPosition();
  }

  public setTarget(entity: Entity): void {
    this.target = entity;
  }

  public setConfig(config: Partial<CameraConfig>): void {
    this.config = { ...this.config, ...config };
    this.spherical.radius = this.config.distance;
  }

  public update(entities: Entity[], deltaTime: number): void {
    if (!this.target) return;

    const targetTransform = this.target.getComponent(Transform);
    if (!targetTransform) return;

    // Handle mouse input for camera rotation
    this.handleMouseInput();

    // Update target position
    this.targetLookAt.copy(targetTransform.position);
    this.targetLookAt.y += this.config.height;

    // Calculate camera position based on spherical coordinates
    this.targetPosition.setFromSpherical(this.spherical);
    this.targetPosition.add(this.targetLookAt);

    // Smooth camera movement
    this.currentPosition.lerp(this.targetPosition, this.config.smoothing);
    this.currentLookAt.lerp(this.targetLookAt, this.config.smoothing);

    const shakeOffset = this.getDamageShakeOffset(deltaTime);

    // Update camera
    this.camera.position.copy(this.currentPosition).add(shakeOffset);
    this.camera.lookAt(this.currentLookAt);
  }

  public addDamageShake(intensity = 0.25, duration = 0.16): void {
    const nextIntensity = MathUtils.clamp(intensity, 0.04, 0.75);
    const nextDuration = MathUtils.clamp(duration, 0.08, 0.35);

    this.damageShakeIntensity = Math.max(this.damageShakeIntensity * 0.7, nextIntensity);
    this.damageShakeDuration = Math.max(this.damageShakeTime, nextDuration);
    this.damageShakeTime = Math.max(this.damageShakeTime, nextDuration);
    this.damageShakeSeed = Math.random() * 1000;
  }

  private getDamageShakeOffset(deltaTime: number): Vector3 {
    this.damageShakeOffset.set(0, 0, 0);
    if (this.damageShakeTime <= 0 || this.damageShakeDuration <= 0) {
      return this.damageShakeOffset;
    }

    this.damageShakeTime = Math.max(0, this.damageShakeTime - deltaTime);
    const elapsed = this.damageShakeDuration - this.damageShakeTime;
    const remaining = this.damageShakeTime / this.damageShakeDuration;
    const decay = remaining * remaining;
    const strength = this.damageShakeIntensity * decay;

    const forward = this.currentLookAt.clone().sub(this.currentPosition);
    if (forward.lengthSq() > 1e-6) {
      forward.normalize();
    } else {
      forward.set(0, 0, -1);
    }

    const right = new Vector3().crossVectors(forward, new Vector3(0, 1, 0));
    if (right.lengthSq() > 1e-6) {
      right.normalize();
    } else {
      right.set(1, 0, 0);
    }

    const horizontal = Math.sin(this.damageShakeSeed + elapsed * 82) * strength;
    const vertical = Math.sin(this.damageShakeSeed * 1.37 + elapsed * 97) * strength * 0.65;
    const depth = Math.sin(this.damageShakeSeed * 2.11 + elapsed * 61) * strength * 0.22;

    this.damageShakeOffset.addScaledVector(right, horizontal);
    this.damageShakeOffset.y += vertical;
    this.damageShakeOffset.addScaledVector(forward, depth);

    if (this.damageShakeTime === 0) {
      this.damageShakeIntensity = 0;
      this.damageShakeDuration = 0;
    }

    return this.damageShakeOffset;
  }

  private handleMouseInput(): void {
    const mouseDelta = this.inputManager.getMouseDelta();

    // Only rotate camera when right mouse button is held down AND camera rotation is not disabled
    if ((mouseDelta.x !== 0 || mouseDelta.y !== 0) && this.isRightMouseDown && !this.cameraRotationDisabled) {
      // Apply Ice Beam camera rotation speed reduction (50% slower)
      const sensitivity = this.isIcebeaming ? this.config.mouseSensitivity * 0.125 : this.config.mouseSensitivity;

      // Update spherical coordinates based on mouse movement
      this.spherical.theta -= mouseDelta.x * sensitivity;
      this.spherical.phi -= mouseDelta.y * sensitivity; // Inverted Y for natural camera feel

      // Clamp phi to prevent camera flipping
      this.spherical.phi = MathUtils.clamp(
        this.spherical.phi,
        this.config.minPolarAngle,
        this.config.maxPolarAngle
      );

      // Normalize theta
      this.spherical.theta = MathUtils.normalizeAngle(this.spherical.theta);
    }
  }

  private setupEventListeners(): void {
    // Mouse button events for camera rotation
    this.inputManager.on('mouseDown', ({ button }) => {
      if (button === 2) { // Right mouse button
        this.isRightMouseDown = true;
      }
    });

    this.inputManager.on('mouseUp', ({ button }) => {
      if (button === 2) { // Right mouse button
        this.isRightMouseDown = false;
      }
    });

    // Mouse wheel for zoom - only add listener once
    if (!this.wheelListenerAdded) {
      this.inputManager.on('wheel', ({ deltaY }) => {
        this.spherical.radius += deltaY * 0.01;
        this.spherical.radius = MathUtils.clamp(this.spherical.radius, 2, this.config.maxDistance);
      });
      this.wheelListenerAdded = true;
    }
  }

  private setupInitialPosition(): void {
    this.currentPosition.setFromSpherical(this.spherical);
    this.currentLookAt.set(0, this.config.height, 0);
    this.targetPosition.copy(this.currentPosition);
    this.targetLookAt.copy(this.currentLookAt);
    
    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  // Utility methods
  public getCameraDirection(): Vector3 {
    const direction = new Vector3();
    this.camera.getWorldDirection(direction);
    return direction;
  }

  public getCameraRight(): Vector3 {
    const direction = this.getCameraDirection();
    const right = new Vector3();
    right.crossVectors(direction, new Vector3(0, 1, 0));
    right.normalize();
    return right;
  }

  public getCameraForward(): Vector3 {
    const right = this.getCameraRight();
    const forward = new Vector3();
    forward.crossVectors(new Vector3(0, 1, 0), right);
    forward.normalize();
    return forward;
  }

  public getDistance(): number {
    return this.spherical.radius;
  }

  public setDistance(distance: number): void {
    this.spherical.radius = MathUtils.clamp(distance, 2, this.config.maxDistance);
  }

  public getHorizontalAngle(): number {
    return this.spherical.theta;
  }

  public getVerticalAngle(): number {
    return this.spherical.phi;
  }

  /** Map polar angle to [-1, 1] for HUD alignment (e.g. strike indicator): -1 at min pitch, +1 at max. */
  public getVerticalAimNormalized(): number {
    const lo = this.config.minPolarAngle;
    const hi = this.config.maxPolarAngle;
    if (hi <= lo) return 0;
    const t = (this.spherical.phi - lo) / (hi - lo);
    return Math.max(-1, Math.min(1, t * 2 - 1));
  }

  public setAngles(horizontal: number, vertical: number): void {
    this.spherical.theta = MathUtils.normalizeAngle(horizontal);
    this.spherical.phi = MathUtils.clamp(
      vertical,
      this.config.minPolarAngle,
      this.config.maxPolarAngle
    );
  }

  public resetCamera(): void {
    this.spherical.radius = this.config.distance;
    this.spherical.phi = Math.PI / 3;
    this.spherical.theta = 0;
    this.setupInitialPosition();
  }

  public snapToTarget(): void {
    if (!this.target) return;

    const targetTransform = this.target.getComponent(Transform);
    if (!targetTransform || !targetTransform.position) return;

    // Safety check: ensure position is properly initialized
    if (targetTransform.position.x === undefined || 
        targetTransform.position.y === undefined || 
        targetTransform.position.z === undefined) {
      return;
    }

    this.targetLookAt.copy(targetTransform.position);
    this.targetLookAt.y += this.config.height;

    this.targetPosition.setFromSpherical(this.spherical);
    this.targetPosition.add(this.targetLookAt);

    this.currentPosition.copy(this.targetPosition);
    this.currentLookAt.copy(this.targetLookAt);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  public getCamera(): PerspectiveCamera {
    return this.camera;
  }

  // Disable/enable camera rotation (used for stun effects)
  public setCameraRotationDisabled(disabled: boolean, entityId?: string): void {
    this.cameraRotationDisabled = disabled;
    this.disabledByEntityId = disabled ? (entityId || null) : null;
  }

  // Check if camera rotation is disabled
  public isCameraRotationDisabled(): boolean {
    return this.cameraRotationDisabled;
  }

  // Get the entity ID that disabled camera rotation
  public getCameraRotationDisabledBy(): string | null {
    return this.disabledByEntityId;
  }

  // Disable/enable camera rotation for death state
  public setDeathCameraDisabled(disabled: boolean, playerId?: string): void {
    this.setCameraRotationDisabled(disabled, playerId);
  }

  // Set Ice Beam state for camera rotation speed reduction
  public setIceBeamActive(active: boolean): void {
    this.isIcebeaming = active;
  }
}
