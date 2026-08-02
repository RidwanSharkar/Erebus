import { useRef, useEffect, memo } from 'react';
import { Group } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { WeaponSubclass } from '../dragon/weapons';
import SpearMeshVisual from './SpearMeshVisual';

interface SpearProps {
  isSwinging: boolean;
  onSwingComplete?: () => void;
  isWhirlwinding?: boolean;
  fireballCharges?: Array<{
    id: number;
    available: boolean;
    cooldownStartTime: number | null;
  }>;
  currentSubclass?: WeaponSubclass;
  isThrowSpearCharging?: boolean;
  throwSpearChargeProgress?: number;
  isThrowSpearReleasing?: boolean;
  isSpearThrown?: boolean;
  isWhirlwindCharging?: boolean;
  whirlwindChargeProgress?: number;
}

const SpearComponent = memo(function Spear({
  isSwinging,
  onSwingComplete,
  isWhirlwinding = false,
  fireballCharges = [],
  currentSubclass,
  isThrowSpearCharging = false,
  throwSpearChargeProgress = 0,
  isThrowSpearReleasing = false,
  isSpearThrown = false,
  isWhirlwindCharging = false,
  whirlwindChargeProgress = 0
}: SpearProps) {
  const spearRef = useRef<Group>(null);
  const innerBladeRef = useRef<Group>(null);
  const swingProgress = useRef(0);
  const basePosition = [-1.18, 0.225, -0.3] as const; // POSITIONING
  const whirlwindRotation = useRef(0);
  const whirlwindSpeed = useRef(0);
  const prevWhirlwindState = useRef(false);

  // Burst attack state for Storm subclass
  const burstCount = useRef(0); // Track which attack we're on (0, 1) - 2 attacks total
  const isBurstAttack = currentSubclass === WeaponSubclass.STORM;

  // Track whirlwind state changes
  useEffect(() => {
    // When whirlwind becomes active, ensure we start the animation
    if (isWhirlwinding && !prevWhirlwindState.current) {
      // Reset rotation to start fresh
      whirlwindRotation.current = 0;
    }
    
    prevWhirlwindState.current = isWhirlwinding || false;
  }, [isWhirlwinding]);

  useFrame((state, delta) => {
    if (!spearRef.current) return;

    // Handle inner blade rotation
    if (innerBladeRef.current) {
      const rotationSpeed = 0.5; // Adjust speed as needed
      const currentRotation = state.clock.getElapsedTime() * rotationSpeed;
      innerBladeRef.current.rotation.y = -Math.PI / 6 + currentRotation;
    }

    // Handle whirlwind spinning animation (orbital motion when released)
    if (isWhirlwinding) {
      // Start at maximum speed immediately when whirlwind begins
      if (whirlwindSpeed.current === 0) {
        whirlwindSpeed.current = 60; // Start at max speed
      }
      // Then immediately start decelerating for explosive burst effect
      whirlwindSpeed.current = Math.max(0, whirlwindSpeed.current - delta * 1920);

      // Update rotation based on speed
      whirlwindRotation.current += delta * whirlwindSpeed.current;

      // Orbit parameters
      const orbitRadius = 2.5; // Radius of orbit circle
      const angle = whirlwindRotation.current;

      // Positional calculations
      const orbitalX = Math.cos(angle) * orbitRadius;
      const orbitalZ = Math.sin(angle) * orbitRadius;

      // Constant height above ground plane
      const fixedHeight = 0.4; // Keep this constant to ensure level movement

      // Set absolute rotation each frame - don't accumulate
      // This is the key to keeping it perfectly level
      // We'll use a fixed rotation sequence applied fresh each frame

      // The spear needs to:
      // 1. Lay flat on the XZ plane (parallel to ground)
      // 2. Point outward from center (tip away from center)

      spearRef.current.rotation.set(
        Math.PI/3,      // X rotation: 90 degrees to lay flat on ground
        -angle + Math.PI,              // Y rotation: will be applied separately
        1               // Z rotation: no roll
      );

      // Rotate around Y axis to make it follow the circle
      // Make the handle point toward center, blade outward
      spearRef.current.rotateY(-angle + Math.PI);

      // Apply position after rotation is set
      spearRef.current.position.set(orbitalX, fixedHeight, orbitalZ);

      return;
    } else if (whirlwindSpeed.current > 0) {
      // Deceleration when whirlwind ends - continue slowing down
      whirlwindSpeed.current = Math.max(0, whirlwindSpeed.current - delta * 1920);

      // Continue rotation but slowing down
      whirlwindRotation.current += delta * whirlwindSpeed.current;

      // If we're almost stopped, return to normal position
      if (whirlwindSpeed.current < 0.5) {
        whirlwindSpeed.current = 0;

        // Reset position smoothly
        spearRef.current.position.x += (basePosition[0] - spearRef.current.position.x) * 0.75;
        spearRef.current.position.y += (basePosition[1] - spearRef.current.position.y) * 0.75;
        spearRef.current.position.z += (basePosition[2] - spearRef.current.position.z) * 0.75;

        // Reset rotation smoothly
        spearRef.current.rotation.x += (-Math.PI/2 - spearRef.current.rotation.x) * 0.75;
        spearRef.current.rotation.y += (0 - spearRef.current.rotation.y) * 0.75;
        spearRef.current.rotation.z += (Math.PI - spearRef.current.rotation.z) * 0.75;
      } else {
        // Continue orbital movement while slowing down
        const orbitRadius = 2.5; // Radius of orbit circle
        const angle = whirlwindRotation.current;

        const orbitalX = Math.cos(angle) * orbitRadius;
        const orbitalZ = Math.sin(angle) * orbitRadius;
        const fixedHeight = 0.4;

        spearRef.current.rotation.set(
          Math.PI/3,
          -angle + Math.PI,
          1
        );

        spearRef.current.rotateY(-angle + Math.PI);
        spearRef.current.position.set(orbitalX, fixedHeight, orbitalZ);
      }

      return;
    }

    // Handle Whirlwind charging animation
    if (isWhirlwindCharging) {
      // Pull spear to center and start spinning slowly
      const pullAmount = whirlwindChargeProgress;
      const heightOffset = 0.3 * pullAmount + 0.5; // Lift up slightly
      const spinSpeed = pullAmount * 60; // Gradually increase spin speed - faster and more explosive

      // Pull spear toward center of player
      const targetX = -0.5 * (1 - pullAmount) - 0.65;
      const targetY = basePosition[1] + heightOffset;
      const targetZ = basePosition[2] + (0.5 * pullAmount);

      // Smoothly animate to charging position
      spearRef.current.position.x += (targetX - spearRef.current.position.x) * 0.1;
      spearRef.current.position.y += (targetY - spearRef.current.position.y) * 0.1;
      spearRef.current.position.z += (targetZ - spearRef.current.position.z) * 0.1;

      // Start spinning the spear
      spearRef.current.rotation.x = -Math.PI; // Face sky perpendicular
      spearRef.current.rotation.y += delta * spinSpeed;
      spearRef.current.rotation.z = Math.PI;

      return;
    }

    // Handle ThrowSpear charging animation
    if (isThrowSpearCharging) {
      // Dramatic charging windup animation - spear raises high and pulls back
      const windupAmount = -1.25 * throwSpearChargeProgress; // Pull back slightly less
      const heightOffset = 1.5 * throwSpearChargeProgress; // Raise much higher
      const sideOffset = -0.25 * throwSpearChargeProgress; // Pull slightly to the side
      const tiltAmount = -0.75 * throwSpearChargeProgress; // More dramatic tilt back

      // Smoothly animate to charging position
      const targetX = basePosition[0] + sideOffset;
      const targetY = basePosition[1] + heightOffset;
      const targetZ = basePosition[2] + windupAmount;

      spearRef.current.position.x += (targetX - spearRef.current.position.x) * 0.08;
      spearRef.current.position.y += (targetY - spearRef.current.position.y) * 0.08;
      spearRef.current.position.z += (targetZ - spearRef.current.position.z) * 0.08;

      // Dramatic tilt back for throwing stance - point spear upward and back
      const targetRotationX = -Math.PI/2 + tiltAmount; // Tilt back more
      const targetRotationY = 0.3 * throwSpearChargeProgress; // Slight Y rotation for aiming
      spearRef.current.rotation.x += (targetRotationX - spearRef.current.rotation.x) * 0.08;
      spearRef.current.rotation.y += (targetRotationY - spearRef.current.rotation.y) * 0.08;
      spearRef.current.rotation.z += (Math.PI - spearRef.current.rotation.z) * 0.08;

      // Add trembling effect when fully charged
      if (throwSpearChargeProgress > 0.8) {
        const trembleAmount = 0.03 * (throwSpearChargeProgress - 0.8) * 5;
        spearRef.current.position.x += (Math.random() - 0.5) * trembleAmount;
        spearRef.current.position.y += (Math.random() - 0.5) * trembleAmount;
        spearRef.current.position.z += (Math.random() - 0.5) * trembleAmount;
        spearRef.current.rotation.x += (Math.random() - 0.5) * trembleAmount * 0.1;
      }

      return;
    }

    // Handle ThrowSpear release animation - fast snap down motion
    if (isThrowSpearReleasing) {
      // Quick snap down to simulate throwing motion
      const snapSpeed = 0.4; // Fast snap speed

      // Snap to throwing position - forward and down
      const throwPositionX = basePosition[0] + 1.0; // Forward
      const throwPositionY = basePosition[1] - 0.5; // Down
      const throwPositionZ = basePosition[2] + 0.8; // Forward

      spearRef.current.position.x += (throwPositionX - spearRef.current.position.x) * snapSpeed;
      spearRef.current.position.y += (throwPositionY - spearRef.current.position.y) * snapSpeed;
      spearRef.current.position.z += (throwPositionZ - spearRef.current.position.z) * snapSpeed;

      // Snap rotation to throwing angle - point forward and slightly down
      const throwRotationX = -Math.PI/3; // Point forward/down
      const throwRotationY = 0;
      const throwRotationZ = Math.PI;

      spearRef.current.rotation.x += (throwRotationX - spearRef.current.rotation.x) * snapSpeed;
      spearRef.current.rotation.y += (throwRotationY - spearRef.current.rotation.y) * snapSpeed;
      spearRef.current.rotation.z += (throwRotationZ - spearRef.current.rotation.z) * snapSpeed;

      return;
    }

    // Handle spear being thrown (hide the weapon)
    if (isSpearThrown) {
      // Move spear off-screen or make it invisible
      spearRef.current.position.set(1000, 1000, 1000); // Move far away
      return;
    }

    if (isSwinging) {
      if (swingProgress.current === 0) {
        // Reset hit tracking when starting a swing
      }

      // Faster swing speed for burst attacks
      const swingSpeed = 21.5;
      swingProgress.current += delta * swingSpeed;
      const swingPhase = Math.min(swingProgress.current / Math.PI / 1.5, 1);

      if (swingProgress.current >= Math.PI * 0.75) {
        swingProgress.current = 0;

          // Normal single attack completion - reset position, rotation
          spearRef.current.rotation.set(-Math.PI/2, 0, Math.PI);
          spearRef.current.position.set(...basePosition);
          onSwingComplete?.();
        
        return;
      }

      const thrustPhase = swingPhase;

      const windUpAmount = -0.75;
      const forwardThrustAmount = 2.850;

      let thrustZ;
      if (thrustPhase < 0.25) {
        thrustZ = basePosition[2] + (windUpAmount * (thrustPhase / 0.2));
      } else if (thrustPhase < 0.5) {
        const forwardPhase = (thrustPhase - 0.2) / 0.3;
        thrustZ = basePosition[2] + windUpAmount + (forwardThrustAmount + Math.abs(windUpAmount)) * Math.sin(forwardPhase * Math.PI/2);
      } else {
        const returnPhase = (thrustPhase - 0.5) / 0.5;
        thrustZ = basePosition[2] + forwardThrustAmount * (1 - returnPhase);
      }

      spearRef.current.position.set(basePosition[0], basePosition[1], thrustZ);

      let rotationX = -Math.PI/2;
      if (thrustPhase < 0.2) {
        rotationX += (thrustPhase / 0.2) * 0.1;
      } else if (thrustPhase < 0.5) {
        rotationX += 0.1 - (((thrustPhase - 0.2) / 0.3) * 0.1);
      }

      spearRef.current.rotation.set(rotationX, 0, Math.PI);

    } else {
      // Normal idle state - only apply if not transitioning from whirlwind
      if (whirlwindSpeed.current === 0) {
        spearRef.current.rotation.x = -Math.PI/2;
        spearRef.current.rotation.y = 0;
        spearRef.current.rotation.z = Math.PI;

        spearRef.current.position.x += (basePosition[0] - spearRef.current.position.x) * 0.2;
        spearRef.current.position.y += (basePosition[1] - spearRef.current.position.y) * 0.2;
        spearRef.current.position.z += (basePosition[2] - spearRef.current.position.z) * 0.2;
      }
    }

  });

  // Charge glow boost (throw + whirlwind charge use the same emissive ladder)
  const emissiveBoost =
    (isThrowSpearCharging ? throwSpearChargeProgress : 0) +
    (isWhirlwindCharging ? whirlwindChargeProgress : 0);

  return (
    <>
      <group
        position={[0, 0.45, 0.25]}
        rotation={[-0.25, 0.15, -0]}
        scale={[0.825, 0.75, 0.75]}
      >
      <group
        ref={spearRef}
        position={[basePosition[0], basePosition[1], basePosition[2]]}
        rotation={[Math.PI/2, 0, 0]}
        scale={[0.8, 0.8, 0.7]}
      >
        <SpearMeshVisual
          innerBladeRef={innerBladeRef}
          emissiveBoost={emissiveBoost}
        />
      </group>
    </group>
    </>
  );
});

export default SpearComponent;
