'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import CharacterModel, { AnimState, preloadCharacterModels } from './CharacterModel';
import { World } from '@/ecs/World';
import { Movement } from '@/ecs/components/Movement';
import { Transform } from '@/ecs/components/Transform';
import { WeaponType, WeaponSubclass } from '@/components/dragon/weapons';
import DraconicWingJets from '@/components/dragon/DraconicWingJets';
import DashFireTrail from '@/components/dragon/DashFireTrail';

interface CharacterRendererProps {
  entityId: number;
  position: Vector3;
  world: World;
  isLocalPlayer?: boolean;
  rotation?: { x: number; y: number; z: number };
  currentWeapon?: WeaponType;
  weaponSubclass?: WeaponSubclass;
  /** Primary (LMB) bow charge — see also ability charges below. */
  isCharging?: boolean;
  isBarrageCharging?: boolean;
  isCobraShotCharging?: boolean;
  /** Reaping Talons (`BOW_R`) charge window — same flag as EtherealBow viper-sting draw. */
  isViperStingCharging?: boolean;
  isDead?: boolean;
  /** Co-op remote: SwordCast/Cast when replicated melee/channel state mirrors LMB posture. */
  remotePrimaryWeaponCastHold?: boolean;
}

const LERP_SPEED      = 15;  // snappy but smooth position interpolation
const WALK_STOP_DELAY = 120; // ms before switching to Idle after movement stops

// The controllable player must never wait behind enemy/boss asset staging.
preloadCharacterModels();

// Return the animation state based on the signed angle (radians) between
// the character's facing direction and the movement direction.
//
//  Run (|angle| < π/8) — W
//       |
//  LeftStrafe / RightStrafe (π/8 … 7π/8) — WA/WD/SA/SD, pure A/D, and diagonals
//       |                    reuse one side-strafe clip per direction; gameplay still moves diagonally.
//  Backwards (|angle| > 7π/8) — S
function dirToAnimState(facingDir: Vector3, moveDir: Vector3): AnimState {
  // Signed angle from facing to movement around the Y axis.
  //   dot    = cos(angle)
  //   crossY = sin(angle)  (positive = movement to the right of facing)
  const dot    = facingDir.dot(moveDir);
  const crossY = facingDir.x * moveDir.z - facingDir.z * moveDir.x;
  const angle  = Math.atan2(crossY, dot);
  const abs    = Math.abs(angle);

  if (abs < Math.PI / 8)       return 'Run';       // ±22.5°   — forward
  if (abs > (7 * Math.PI) / 8) return 'Backwards'; // ±157.5°+ — backward
  return angle > 0 ? 'RightStrafe' : 'LeftStrafe';
}

// Four-way slow walk (attack slow / ice beam): forward + dedicated walk GLBs per side/back.
function dirToSlowWalkAnimState(facingDir: Vector3, moveDir: Vector3): AnimState {
  const dot    = facingDir.dot(moveDir);
  const crossY = facingDir.x * moveDir.z - facingDir.z * moveDir.x;
  const angle  = Math.atan2(crossY, dot);
  const abs    = Math.abs(angle);

  if (abs < Math.PI / 4) return 'Walk';
  if (abs > (3 * Math.PI) / 4) return 'WalkBack';
  return angle > 0 ? 'WalkRight' : 'WalkLeft';
}

export default function CharacterRenderer({
  entityId,
  position,
  world,
  isLocalPlayer = true,
  rotation,
  currentWeapon,
  weaponSubclass,
  isCharging = false,
  isBarrageCharging = false,
  isCobraShotCharging = false,
  isViperStingCharging = false,
  isDead = false,
  remotePrimaryWeaponCastHold = false,
}: CharacterRendererProps) {
  const groupRef         = useRef<Group | null>(null);
  const { camera }       = useThree();
  const [animState, setAnimState] = useState<AnimState>('Idle');
  const [dashJetsActive, setDashJetsActive] = useState(false);
  const [dashBurstId, setDashBurstId] = useState(0);
  const dashFlagsRef = useRef({ isBackward: false, isLeft: false, isRight: false });
  const lastIsDashingRef = useRef(false);
  const dashFireWorldPosRef = useRef(new Vector3());
  const isDashingRef = useRef(false);

  const targetPosition    = useRef(position.clone());
  const targetRotationY   = useRef(0);
  const prevAnimState     = useRef<AnimState>('Idle');
  const walkStopTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLeftMouseHeld      = useRef(false);
  const wasGrounded          = useRef(true);
  const jumpIsBack           = useRef(false);
  const jumpIsFront          = useRef(false);
  /** True while LMB or bow ability warmup holds DrawBow pose (Barrage, Cobra, Reaping Talons). */
  const bowDrawHoldActive =
    currentWeapon === WeaponType.BOW &&
    (isCharging || isBarrageCharging || isCobraShotCharging || isViperStingCharging);

  const prevBowDrawHold = useRef(false);
  const bowReleaseTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isCastingAbility     = useRef(false);
  const abilityAnimTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Snap to spawn position before first paint so the character never flashes at origin.
  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.copy(targetPosition.current);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep target position up to date and schedule Idle fallback.
  useEffect(() => {
    const dist = targetPosition.current.distanceTo(position);
    targetPosition.current.copy(position);

    if (dist > 15.0 && groupRef.current) {
      groupRef.current.position.copy(position);
    }
  }, [position.x, position.y, position.z]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track remote-player rotation.
  useEffect(() => {
    if (!isLocalPlayer && rotation) {
      targetRotationY.current = rotation.y;
    }
  }, [rotation, isLocalPlayer]);

  useEffect(() => {
    return () => {
      if (walkStopTimer.current)   clearTimeout(walkStopTimer.current);
      if (bowReleaseTimer.current) clearTimeout(bowReleaseTimer.current);
      if (abilityAnimTimer.current) clearTimeout(abilityAnimTimer.current);
    };
  }, []);

  // When any bow draw hold ends (LMB, Barrage, Cobra, or Reaping Talons charge), play ReleaseBow then Idle.
  useEffect(() => {
    if (prevBowDrawHold.current && !bowDrawHoldActive && currentWeapon === WeaponType.BOW) {
      if (bowReleaseTimer.current) clearTimeout(bowReleaseTimer.current);
      setAnimState('ReleaseBow');
      prevAnimState.current = 'ReleaseBow';
      bowReleaseTimer.current = setTimeout(() => {
        bowReleaseTimer.current = null;
        if (prevAnimState.current === 'ReleaseBow') {
          setAnimState('Idle');
          prevAnimState.current = 'Idle';
        }
      }, 500);
    }
    prevBowDrawHold.current = bowDrawHoldActive;
  }, [bowDrawHoldActive, currentWeapon]); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for ability casts (Q/E/R/F abilities) and play the CastSingle animation
  // when the character is not moving.
  useEffect(() => {
    if (!isLocalPlayer) return;

    const handleAbilityCast = () => {
      // Only trigger CastSingle when stationary; movement anims take priority.
      const entity = world.getEntity(entityId);
      const movement = entity?.getComponent(Movement);
      if (movement && movement.inputStrength > 0.05) return;

      // Clear any pending timer so rapid casts restart the clip.
      if (abilityAnimTimer.current) clearTimeout(abilityAnimTimer.current);

      isCastingAbility.current = true;
      setAnimState('CastSingle');
      prevAnimState.current = 'CastSingle';

      // After the clip duration, return to Idle (clip is ~1.1 s; 1200 ms gives a
      // small buffer so the animation always finishes before we switch back).
      abilityAnimTimer.current = setTimeout(() => {
        abilityAnimTimer.current = null;
        isCastingAbility.current = false;
        setAnimState('Idle');
        prevAnimState.current = 'Idle';
      }, 1200);
    };

    window.addEventListener('character-ability-cast', handleAbilityCast);
    return () => { window.removeEventListener('character-ability-cast', handleAbilityCast); };
  }, [isLocalPlayer, world, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track left mouse button for the local player so we can play the cast animation.
  useEffect(() => {
    if (!isLocalPlayer) return;
    const onDown = (e: MouseEvent) => { if (e.button === 0) isLeftMouseHeld.current = true; };
    const onUp   = (e: MouseEvent) => { if (e.button === 0) isLeftMouseHeld.current = false; };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('mouseup',   onUp);
    // Release if the window loses focus (alt-tab, etc.)
    const onBlur = () => { isLeftMouseHeld.current = false; };
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup',   onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isLocalPlayer]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    // Smooth position.
    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    // Rotation: local player always faces the camera; remote players lerp to server rotation.
    let facingDir = new Vector3(0, 0, -1); // default
    if (isLocalPlayer && camera) {
      const cameraSystem = (window as any).cameraSystem as
        | { getOrbitHorizontalFacingAngle?: () => number }
        | undefined;
      const angle =
        typeof cameraSystem?.getOrbitHorizontalFacingAngle === 'function'
          ? cameraSystem.getOrbitHorizontalFacingAngle()
          : (() => {
              const dir = new Vector3();
              camera.getWorldDirection(dir);
              return Math.atan2(dir.x, dir.z);
            })();
      group.rotation.y = angle;
      facingDir.set(Math.sin(angle), 0, Math.cos(angle));
    } else {
      let deltaAngle = targetRotationY.current - group.rotation.y;
      while (deltaAngle >  Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
      group.rotation.y += deltaAngle * Math.min(1, delta * LERP_SPEED);
      facingDir.set(
        Math.sin(group.rotation.y),
        0,
        Math.cos(group.rotation.y),
      );
    }

    // Derive animation state from ECS Movement component.
    const entity = world.getEntity(entityId);
    if (!entity) return;

    const movement = entity.getComponent(Movement);
    if (!movement) return;

    const transform = entity.getComponent(Transform);
    if (transform?.position) {
      dashFireWorldPosRef.current.copy(transform.position);
    }
    isDashingRef.current = movement.isDashing;

    if (lastIsDashingRef.current !== movement.isDashing) {
      lastIsDashingRef.current = movement.isDashing;
      setDashJetsActive(movement.isDashing);
      if (movement.isDashing) {
        setDashBurstId(id => id + 1);
      }
    }

    // Update dash direction flags synchronously into a ref so DraconicWingJets
    // always reads the correct direction in the same frame particles are spawned,
    // avoiding the 1-frame stale-state ghost trail on dash transitions.
    if (movement.isDashing) {
      const backDot = facingDir.dot(movement.dashDirection);
      const rightDot = facingDir.z * movement.dashDirection.x - facingDir.x * movement.dashDirection.z;
      dashFlagsRef.current = {
        isBackward: backDot < -0.3,
        isRight:    rightDot > 0.3,
        isLeft:     rightDot < -0.3,
      };
    } else {
      dashFlagsRef.current = { isBackward: false, isLeft: false, isRight: false };
    }

    let next: AnimState;

    if (!movement.isGrounded) {
      // Capture the jump direction at take-off so it stays consistent mid-air.
      if (wasGrounded.current) {
        if (movement.inputStrength > 0.05) {
          const md = movement.moveDirection.clone();
          md.y = 0;
          if (md.length() > 0.01) {
            md.normalize();
            const dot    = facingDir.dot(md);
            const crossY = facingDir.x * md.z - facingDir.z * md.x;
            const angle  = Math.atan2(crossY, dot);
            // JumpFront for W (|angle| < 22.5°), JumpBack for S (|angle| > 135°)
            const absAngle = Math.abs(angle);
            jumpIsFront.current = absAngle < Math.PI / 8;
            jumpIsBack.current  = absAngle > (3 * Math.PI) / 4;
          } else {
            jumpIsFront.current = false;
            jumpIsBack.current  = false;
          }
        } else {
          jumpIsFront.current = false;
          jumpIsBack.current  = false;
        }
      }
      wasGrounded.current = false;
      next = jumpIsBack.current ? 'JumpBack' : jumpIsFront.current ? 'JumpFront' : 'Jump';
    } else {
      wasGrounded.current = true;

      if (movement.inputStrength > 0.05) {
        // Movement cancels any in-progress ability cast animation.
        if (isCastingAbility.current) {
          isCastingAbility.current = false;
          if (abilityAnimTimer.current) {
            clearTimeout(abilityAnimTimer.current);
            abilityAnimTimer.current = null;
          }
        }

        // Player is actively pressing a movement key — pick directional animation.
        const moveDir = movement.moveDirection.clone();
        moveDir.y = 0;
        if (moveDir.length() > 0.01) {
          moveDir.normalize();
          const slowLocomotion = movement.isAttackSlowed || movement.isIcebeaming;
          next = slowLocomotion
            ? dirToSlowWalkAnimState(facingDir, moveDir)
            : dirToAnimState(facingDir, moveDir);
        } else {
          next = 'Idle';
        }

        // Reset stop timer whenever input is active.
        if (walkStopTimer.current) {
          clearTimeout(walkStopTimer.current);
          walkStopTimer.current = null;
        }
      } else if (bowDrawHoldActive) {
        // LMB or bow ability warmup — DrawBow clip (local + replicated co-op peers).
        if (walkStopTimer.current) {
          clearTimeout(walkStopTimer.current);
          walkStopTimer.current = null;
        }
        next = 'DrawBow';
      } else if (
        (isLocalPlayer &&
          isLeftMouseHeld.current &&
          currentWeapon != null &&
          currentWeapon !== WeaponType.NONE) ||
        (!isLocalPlayer &&
          remotePrimaryWeaponCastHold &&
          currentWeapon != null &&
          currentWeapon !== WeaponType.NONE &&
          currentWeapon !== WeaponType.BOW)
      ) {
        // Stationary + holding primary or replicated co-op melee/channel pose.
        if (walkStopTimer.current) {
          clearTimeout(walkStopTimer.current);
          walkStopTimer.current = null;
        }
        if (currentWeapon === WeaponType.SWORD) {
          next = 'SwordCast';
        } else {
          next = 'Cast'; // SCYTHE, SPEAR, SABRES, RUNEBLADE, Bow generic cast fallback, etc.
        }
      } else {
        // No input, not casting.
        const isCastVariant = (s: AnimState) =>
          s === 'Cast' || s === 'SwordCast' || s === 'DrawBow';

        // Let CastSingle play out on its own (driven by the ability-cast effect).
        if (prevAnimState.current === 'CastSingle') return;

        // If an ability cast is in progress, keep CastSingle running.
        if (isCastingAbility.current) return;

        // Snap back to Idle instantly when a cast is released.
        if (isCastVariant(prevAnimState.current)) {
          prevAnimState.current = 'Idle';
          setAnimState('Idle');
          return;
        }
        // Let ReleaseBow play out on its own (driven by the bow-release useEffect).
        if (prevAnimState.current === 'ReleaseBow') return;
        // Snap to Idle instantly on landing from any jump.
        if (
          prevAnimState.current === 'Jump' ||
          prevAnimState.current === 'JumpFront' ||
          prevAnimState.current === 'JumpBack'
        ) {
          prevAnimState.current = 'Idle';
          setAnimState('Idle');
          return;
        }
        // Normal stop timer for locomotion → Idle transition.
        if (
          prevAnimState.current !== 'Idle' &&
          !walkStopTimer.current
        ) {
          walkStopTimer.current = setTimeout(() => {
            walkStopTimer.current = null;
            setAnimState('Idle');
            prevAnimState.current = 'Idle';
          }, WALK_STOP_DELAY);
        }
        return; // keep current animation until timer fires
      }
    }

    if (next !== prevAnimState.current) {
      prevAnimState.current = next;
      setAnimState(next);
    }
  });

  const wType = currentWeapon ?? WeaponType.NONE;
  const showDashJets =
    dashJetsActive && wType !== WeaponType.KNIGHT;
  const jetSubclass =
    wType === WeaponType.NONE ? undefined : weaponSubclass;

  return (
    <>
      <group ref={setGroupRef}>
        <CharacterModel animState={animState} isDead={isDead} />
        <group position={[0, 1.0, -0.12]}>
          <DraconicWingJets
            key={`left-dash-jets-${dashBurstId}`}
            isActive={showDashJets}
            collectedBones={0}
            isLeftWing
            parentRef={groupRef as React.RefObject<Group>}
            weaponType={wType}
            weaponSubclass={jetSubclass}
            dashFlagsRef={dashFlagsRef}
          />
          <DraconicWingJets
            key={`right-dash-jets-${dashBurstId}`}
            isActive={showDashJets}
            collectedBones={0}
            isLeftWing={false}
            parentRef={groupRef as React.RefObject<Group>}
            weaponType={wType}
            weaponSubclass={jetSubclass}
            dashFlagsRef={dashFlagsRef}
          />
        </group>
      </group>
      <DashFireTrail
        worldPositionRef={dashFireWorldPosRef}
        isDashingRef={isDashingRef}
        disabled={wType === WeaponType.KNIGHT}
      />
    </>
  );
}
