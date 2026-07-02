'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { AnimationClip, Group, LoopRepeat, Vector3 } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import {
  MERCHANT_NPC_DEFAULT_ROTATION_Y,
  MERCHANT_NPC_FACE_RANGE,
  MERCHANT_NPC_POSITION,
} from './ThroneRoom';

const ALLY_IDLE_PATH = '/models/ally_idle.glb';
const SCALE = 0.01135;
const ROTATION_SPEED = 2.0;

useGLTF.preload(ALLY_IDLE_PATH);

interface MerchantNpcRendererProps {
  playerPositionRef: React.MutableRefObject<Vector3>;
}

function MerchantNpcRenderer({ playerPositionRef }: MerchantNpcRendererProps) {
  const rootRef = useRef<Group>(null);
  const npcPos = useMemo(
    () => new Vector3(MERCHANT_NPC_POSITION.x, MERCHANT_NPC_POSITION.y, MERCHANT_NPC_POSITION.z),
    [],
  );

  const { scene, animations: idleAnims } = useGLTF(ALLY_IDLE_PATH);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(
    () =>
      idleAnims.map((clip: AnimationClip) => {
        const renamed = clip.clone();
        renamed.name = 'Idle';
        return renamed;
      }),
    [idleAnims],
  );

  const { actions } = useAnimations(animations, rootRef);

  useEffect(() => {
    const idle = actions?.Idle;
    if (!idle) return;
    idle.enabled = true;
    idle.setLoop(LoopRepeat, Infinity);
    idle.reset().fadeIn(0.2).play();
    return () => {
      idle.fadeOut(0.2);
    };
  }, [actions]);

  useFrame((_, delta) => {
    const root = rootRef.current;
    if (!root) return;

    const playerPos = playerPositionRef.current;
    const dx = playerPos.x - npcPos.x;
    const dz = playerPos.z - npcPos.z;
    const distSq = dx * dx + dz * dz;
    const rangeSq = MERCHANT_NPC_FACE_RANGE * MERCHANT_NPC_FACE_RANGE;

    let targetY = MERCHANT_NPC_DEFAULT_ROTATION_Y;
    if (distSq <= rangeSq) {
      targetY = Math.atan2(dx, dz);
    }

    let diff = targetY - root.rotation.y;
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;

    const maxStep = ROTATION_SPEED * delta;
    const step = Math.max(-maxStep, Math.min(maxStep, diff));
    root.rotation.y += step;
  });

  return (
    <group
      ref={rootRef}
      position={[MERCHANT_NPC_POSITION.x, MERCHANT_NPC_POSITION.y, MERCHANT_NPC_POSITION.z]}
      rotation={[0, MERCHANT_NPC_DEFAULT_ROTATION_Y, 0]}
    >
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}

export default React.memo(MerchantNpcRenderer);
