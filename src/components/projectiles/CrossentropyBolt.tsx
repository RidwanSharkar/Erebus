import React, { useRef, useMemo } from 'react';
import { AdditiveBlending, SphereGeometry } from '@/utils/three-exports';

import { Mesh, Vector3, Clock, Color, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import CrossentropyBoltTrail from './CrossentropyBoltTrail';
import CrossentropyBoltLaunchSmoke from './CrossentropyBoltLaunchSmoke';
import { CROSSENTROPY_MAX_TRAVEL_DISTANCE } from '@/utils/talents';
import type { CrossentropyVisualTheme } from '@/utils/talents';

const BOLT_SPHERE_RADIUS = 0.225;
const BOLT_SPHERE_GEO = new SphereGeometry(BOLT_SPHERE_RADIUS, 16, 16);

interface CrossentropyBoltProps {
  id: number;
  position: Vector3;
  direction: Vector3;
  /** Bolt + explosion palette (Inferno overrides Tempest/Plague). */
  visualTheme?: CrossentropyVisualTheme;
  /** Reaper: follow ECS `position` each frame (pierce line), no client collision. */
  reaperEcsDriven?: boolean;
  onImpact?: (position?: Vector3) => void;
  checkCollisions?: (boltId: number, position: Vector3) => boolean;
}

export default function CrossentropyBolt({
  id,
  position,
  direction,
  visualTheme = 'default',
  reaperEcsDriven = false,
  onImpact,
  checkCollisions,
}: CrossentropyBoltProps) {
  const fireball1Ref = useRef<Mesh>(null);
  const fireball2Ref = useRef<Mesh>(null);
  const fireball3Ref = useRef<Mesh>(null);

  // Scratch vectors pooled at component level to eliminate per-frame allocations
  const _scratchMovement    = useRef(new Vector3());
  const _scratchRight       = useRef(new Vector3());
  const _scratchUp          = useRef(new Vector3());
  const _scratchSpiralOff1  = useRef(new Vector3());
  const _scratchSpiralOff2  = useRef(new Vector3());
  const _scratchSpiralOff3  = useRef(new Vector3());
  const _scratchFinalOff1   = useRef(new Vector3());
  const _scratchFinalOff2   = useRef(new Vector3());
  const _scratchFinalOff3   = useRef(new Vector3());
  const _scratchCurrentPos  = useRef(new Vector3());
  const clock = useRef(new Clock());
  const startSpeed = 0.03;
  const maxSpeed = 1.25;
  const accelerationDistance = 10; // Distance over which to accelerate from start to max speed
  const maxRange = CROSSENTROPY_MAX_TRAVEL_DISTANCE; // Aligned with ECS maxDistance for Crossentropy
  const lifespan = 3; // Fallback lifespan
  const currentPosition = useRef(position.clone());
  const startPosition = useRef(position.clone());
  const hasCollided = useRef(false);
  const hasExploded = useRef(false);
  const fadeStartTime = useRef<number | null>(null);
  const fadeDuration = 1; // 500ms fade duration
  const opacityRef = useRef(1);
  const mat1Ref = useRef<MeshStandardMaterial>(null);
  const mat2Ref = useRef<MeshStandardMaterial>(null);
  const mat3Ref = useRef<MeshStandardMaterial>(null);
  const size = BOLT_SPHERE_RADIUS;
  const { color, meshColor, meshEmissive } = useMemo(() => {
    if (visualTheme === 'inferno') {
      return {
        color: new Color('#FF2200'),
        meshColor: '#E62E2E',
        meshEmissive: '#FF1100',
      };
    }
    if (visualTheme === 'glacial') {
      return {
        color: new Color('#0e5090'),
        meshColor: '#0a3d6e',
        meshEmissive: '#40a0f0',
      };
    }
    if (visualTheme === 'tempest') {
      return {
        color: new Color('#44AAFF'),
        meshColor: '#1E6EEB',
        meshEmissive: '#88DDFF',
      };
    }
    if (visualTheme === 'plague') {
      return {
        color: new Color('#44FF88'),
        meshColor: '#1E8B4A',
        meshEmissive: '#66FFAA',
      };
    }
    return {
      color: new Color('#FF4500'),
      meshColor: '#FF4500',
      meshEmissive: '#FF6600',
    };
  }, [visualTheme]);

  // One pooled light follows the bolt, driven in useFrame below.
  const boltLight = useDynamicLight({ color, distance: 12, priority: 2 });

  const trailColor = useMemo(
    () => (reaperEcsDriven ? new Color('#B866FF') : color),
    [reaperEcsDriven, color],
  );

  // Spiral parameters
  const spiralRadius = 0.5;
  const spiralSpeed = 4; // rotations per second
  const time = useRef(0);
  const launchSmokeDistanceRef = useRef(0);

  const applyOpacityToMaterials = (value: number) => {
    opacityRef.current = value;
    for (const matRef of [mat1Ref, mat2Ref, mat3Ref]) {
      const mat = matRef.current;
      if (!mat) continue;
      mat.opacity = 0.9 * value;
      mat.emissiveIntensity = 2 * value;
    }
  };

  // Collision detection is now handled by the ECS system
  // This component only handles visual representation

  useFrame((_, delta) => {
    if (!fireball1Ref.current || !fireball2Ref.current || !fireball3Ref.current) return;

    const currentTime = Date.now();

    if (reaperEcsDriven) {
      if (fadeStartTime.current !== null) {
        const fadeElapsed = currentTime - fadeStartTime.current;
        const fadeProgress = Math.min(fadeElapsed / (fadeDuration * 1000), 1);
        applyOpacityToMaterials(1 - fadeProgress);
        if (fadeProgress >= 1) {
          fireball1Ref.current.removeFromParent();
          fireball2Ref.current.removeFromParent();
          fireball3Ref.current.removeFromParent();
          onImpact?.();
        }
        return;
      }
      if (hasCollided.current) return;
      currentPosition.current.copy(position);
      time.current += delta;
      const spiralAngle = time.current * spiralSpeed * Math.PI * 2;
      _scratchSpiralOff1.current.set(Math.cos(spiralAngle) * spiralRadius, Math.sin(spiralAngle * 0.5) * spiralRadius * 0.3, 0);
      _scratchSpiralOff2.current.set(Math.cos(spiralAngle + Math.PI) * spiralRadius, Math.sin((spiralAngle + Math.PI) * 0.5) * spiralRadius * 0.3, 0);
      _scratchSpiralOff3.current.set(Math.cos(spiralAngle + (2 * Math.PI) / 3) * spiralRadius, Math.sin((spiralAngle + (2 * Math.PI) / 3) * 0.5) * spiralRadius * 0.3, 0);
      _scratchRight.current.crossVectors(direction, _scratchUp.current.set(0, 1, 0)).normalize();
      _scratchUp.current.crossVectors(_scratchRight.current, direction).normalize();
      fireball1Ref.current.position.copy(currentPosition.current).add(_scratchFinalOff1.current.copy(_scratchRight.current).multiplyScalar(_scratchSpiralOff1.current.x).addScaledVector(_scratchUp.current, _scratchSpiralOff1.current.y));
      fireball2Ref.current.position.copy(currentPosition.current).add(_scratchFinalOff2.current.copy(_scratchRight.current).multiplyScalar(_scratchSpiralOff2.current.x).addScaledVector(_scratchUp.current, _scratchSpiralOff2.current.y));
      fireball3Ref.current.position.copy(currentPosition.current).add(_scratchFinalOff3.current.copy(_scratchRight.current).multiplyScalar(_scratchSpiralOff3.current.x).addScaledVector(_scratchUp.current, _scratchSpiralOff3.current.y));
      {
        const rp = currentPosition.current;
        boltLight.current?.setPosition(rp.x, rp.y, rp.z);
        boltLight.current?.setIntensity(5 * opacityRef.current);
      }
      return;
    }

    // Handle fading
    if (fadeStartTime.current !== null) {
      const fadeElapsed = currentTime - fadeStartTime.current;
      const fadeProgress = Math.min(fadeElapsed / (fadeDuration * 1000), 1);
      applyOpacityToMaterials(1 - fadeProgress);
      
      if (fadeProgress >= 1) {
        // Fade complete, remove from scene
        fireball1Ref.current.removeFromParent();
        fireball2Ref.current.removeFromParent();
        fireball3Ref.current.removeFromParent();
        if (onImpact) {
          onImpact(); // Call without position to indicate fade completion
        }
        return;
      }
    }

    // Skip movement and collision if already collided
    if (hasCollided.current) return;

    // Check if exceeded lifespan
    if (clock.current.getElapsedTime() > lifespan && !hasExploded.current) {
      hasCollided.current = true;
      hasExploded.current = true;
      fadeStartTime.current = currentTime;
      // Lifespan exceeded without collision - no explosion, just fade
      return;
    }

    time.current += delta;

    // Calculate current speed based on distance traveled (accelerate from startSpeed to maxSpeed)
    const distanceTraveled = currentPosition.current.distanceTo(startPosition.current);
    launchSmokeDistanceRef.current = distanceTraveled;
    const accelerationProgress = Math.min(distanceTraveled / accelerationDistance, 1);
    const currentSpeed = startSpeed + (maxSpeed - startSpeed) * accelerationProgress;

    // Update position based on direction and current speed
    currentPosition.current.add(_scratchMovement.current.copy(direction).multiplyScalar(currentSpeed * delta * 60));
    if (distanceTraveled >= maxRange && !hasExploded.current) {
      hasCollided.current = true;
      hasExploded.current = true;
      fadeStartTime.current = currentTime;
      if (onImpact) {
        onImpact(currentPosition.current.clone()); // Impact at max range position
      }
      return;
    }

    // Check collisions each frame
    if (checkCollisions) {
      _scratchCurrentPos.current.copy(currentPosition.current);
      const hitSomething = checkCollisions(id, _scratchCurrentPos.current);

      if (hitSomething && !hasExploded.current) {
        hasCollided.current = true;
        hasExploded.current = true;
        fadeStartTime.current = currentTime;
        if (onImpact) {
          onImpact(_scratchCurrentPos.current.clone()); // Impact at collision position
        }
        return;
      }
    }
    
    // Calculate spiral positions for the three fireballs (reuse scratch vectors)
    const spiralAngle = time.current * spiralSpeed * Math.PI * 2;
    _scratchSpiralOff1.current.set(Math.cos(spiralAngle) * spiralRadius, Math.sin(spiralAngle * 0.5) * spiralRadius * 0.3, 0);
    _scratchSpiralOff2.current.set(Math.cos(spiralAngle + Math.PI) * spiralRadius, Math.sin((spiralAngle + Math.PI) * 0.5) * spiralRadius * 0.3, 0);
    _scratchSpiralOff3.current.set(Math.cos(spiralAngle + (2 * Math.PI / 3)) * spiralRadius, Math.sin((spiralAngle + (2 * Math.PI / 3)) * 0.5) * spiralRadius * 0.3, 0);

    // Apply spiral offsets to the main direction (reuse scratch right/up)
    _scratchRight.current.crossVectors(direction, _scratchUp.current.set(0, 1, 0)).normalize();
    _scratchUp.current.crossVectors(_scratchRight.current, direction).normalize();

    fireball1Ref.current.position.copy(currentPosition.current).add(_scratchFinalOff1.current.copy(_scratchRight.current).multiplyScalar(_scratchSpiralOff1.current.x).addScaledVector(_scratchUp.current, _scratchSpiralOff1.current.y));
    fireball2Ref.current.position.copy(currentPosition.current).add(_scratchFinalOff2.current.copy(_scratchRight.current).multiplyScalar(_scratchSpiralOff2.current.x).addScaledVector(_scratchUp.current, _scratchSpiralOff2.current.y));
    fireball3Ref.current.position.copy(currentPosition.current).add(_scratchFinalOff3.current.copy(_scratchRight.current).multiplyScalar(_scratchSpiralOff3.current.x).addScaledVector(_scratchUp.current, _scratchSpiralOff3.current.y));

    // Single pooled light follows the bolt (replaces 3 per-fireball <pointLight>s).
    const p = currentPosition.current;
    boltLight.current?.setPosition(p.x, p.y, p.z);
    boltLight.current?.setIntensity(5 * opacityRef.current);
  });

  return (
    <group name="crossentropy-bolt-group">
      <mesh ref={fireball1Ref} position={currentPosition.current} geometry={BOLT_SPHERE_GEO}>
        <meshStandardMaterial
          ref={mat1Ref}
          color={meshColor}
          emissive={meshEmissive}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={fireball2Ref} position={currentPosition.current} geometry={BOLT_SPHERE_GEO}>
        <meshStandardMaterial
          ref={mat2Ref}
          color={meshColor}
          emissive={meshEmissive}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={fireball3Ref} position={currentPosition.current} geometry={BOLT_SPHERE_GEO}>
        <meshStandardMaterial
          ref={mat3Ref}
          color={meshColor}
          emissive={meshEmissive}
          emissiveIntensity={2}
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
      <CrossentropyBoltTrail
        color={trailColor}
        reaperPurple={reaperEcsDriven}
        size={size * 0.875}
        mesh1Ref={fireball1Ref}
        mesh2Ref={fireball2Ref}
        mesh3Ref={fireball3Ref}
        opacityRef={opacityRef}
      />
      <CrossentropyBoltLaunchSmoke
        direction={direction}
        visualTheme={visualTheme}
        anchorRef={currentPosition}
        boltRadius={size}
        reaperPurple={reaperEcsDriven}
        {...(!reaperEcsDriven ? { launchDistanceRef: launchSmokeDistanceRef } : {})}
      />
    </group>
  );
} 
