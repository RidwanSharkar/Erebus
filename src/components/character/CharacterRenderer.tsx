'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Group, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import CharacterModel, { AnimState } from './CharacterModel';
import { World } from '@/ecs/World';
import { Movement } from '@/ecs/components/Movement';

interface CharacterRendererProps {
  entityId: number;
  position: Vector3;
  world: World;
  isLocalPlayer?: boolean;
  rotation?: { x: number; y: number; z: number };
}

const LERP_SPEED      = 15;  // snappy but smooth position interpolation
const WALK_STOP_DELAY = 120; // ms before switching to Idle after movement stops

// Return the animation state based on the signed angle (radians) between
// the character's facing direction and the movement direction.
//
//        Run (forward)
//           |  (-π/4 … +π/4)
// LeftStrafe ← 0 → RightStrafe
//  (-3π/4 … -π/4)  (+π/4 … +3π/4)
//           |
//        Backwards  (|angle| > 3π/4)
function dirToAnimState(facingDir: Vector3, moveDir: Vector3): AnimState {
  // Signed angle from facing to movement around the Y axis.
  //   dot  = cos(angle)
  //   crossY = sin(angle)  (positive = movement to the right of facing)
  const dot    = facingDir.dot(moveDir);
  const crossY = facingDir.x * moveDir.z - facingDir.z * moveDir.x;
  const angle  = Math.atan2(crossY, dot);

  if (Math.abs(angle) < Math.PI / 4)       return 'Run';
  if (Math.abs(angle) > (3 * Math.PI) / 4) return 'Backwards';
  return angle > 0 ? 'RightStrafe' : 'LeftStrafe';
}

export default function CharacterRenderer({
  entityId,
  position,
  world,
  isLocalPlayer = true,
  rotation,
}: CharacterRendererProps) {
  const groupRef         = useRef<Group | null>(null);
  const { camera }       = useThree();
  const [animState, setAnimState] = useState<AnimState>('Idle');

  const targetPosition   = useRef(position.clone());
  const targetRotationY  = useRef(0);
  const prevAnimState    = useRef<AnimState>('Idle');
  const walkStopTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    return () => { if (walkStopTimer.current) clearTimeout(walkStopTimer.current); };
  }, []);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const group = groupRef.current;

    // Smooth position.
    group.position.lerp(targetPosition.current, Math.min(1, delta * LERP_SPEED));

    // Rotation: local player always faces the camera; remote players lerp to server rotation.
    let facingDir = new Vector3(0, 0, -1); // default
    if (isLocalPlayer && camera) {
      const dir = new Vector3();
      camera.getWorldDirection(dir);
      group.rotation.y = Math.atan2(dir.x, dir.z);
      facingDir.set(dir.x, 0, dir.z).normalize();
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
    if (!movement || movement.constructor.name !== 'Movement') return;

    let next: AnimState;

    if (!movement.isGrounded) {
      next = 'Jump';
    } else if (movement.inputStrength > 0.05) {
      // Player is actively pressing a movement key — pick directional animation.
      const moveDir = movement.moveDirection.clone();
      moveDir.y = 0;
      if (moveDir.length() > 0.01) {
        moveDir.normalize();
        next = dirToAnimState(facingDir, moveDir);
      } else {
        next = 'Idle';
      }

      // Reset stop timer whenever input is active.
      if (walkStopTimer.current) {
        clearTimeout(walkStopTimer.current);
        walkStopTimer.current = null;
      }
    } else {
      // No input — start stop timer so the model doesn't snap to Idle on micro-jitter.
      if (prevAnimState.current !== 'Idle' && prevAnimState.current !== 'Jump' && !walkStopTimer.current) {
        walkStopTimer.current = setTimeout(() => {
          walkStopTimer.current = null;
          setAnimState('Idle');
          prevAnimState.current = 'Idle';
        }, WALK_STOP_DELAY);
      }
      return; // keep current animation until timer fires
    }

    if (next !== prevAnimState.current) {
      prevAnimState.current = next;
      setAnimState(next);
    }
  });

  return (
    <group ref={setGroupRef}>
      <CharacterModel animState={animState} />
    </group>
  );
}
