'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface WraithModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isDying: boolean;
}

const WRAITH_MODEL_PATHS = [
  '/models/wraith_idle.glb',
  '/models/wraith_walk.glb',
  '/models/wraith_attack.glb',
  '/models/wraith_death.glb',
];

export function preloadWraithModels(): void {
  WRAITH_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

const SCALE = 0.010;

export default React.memo(function WraithModel({
  isWalking,
  isAttacking,
  isDying,
}: WraithModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims } = useGLTF('/models/wraith_idle.glb');
  const { animations: walkAnims } = useGLTF('/models/wraith_walk.glb');
  const { animations: attackAnims } = useGLTF('/models/wraith_attack.glb');
  const { animations: deathAnims } = useGLTF('/models/wraith_death.glb');

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
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
      getCachedEnemyAnimationClips('wraith', () => [
        ...renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ),
        ...renameAnimationClips(walkAnims, 'Walk').map(stripRootMotionXZ),
        ...renameAnimationClips(attackAnims, 'Attack'),
        ...renameAnimationClips(deathAnims, 'Death'),
      ]),
    [idleAnims, walkAnims, attackAnims, deathAnims],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction('Attack')
        : isWalking
          ? getAction('Walk')
          : getAction('Idle');

    if (!nextAction) return;
    if (nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isDying || isAttacking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Attack') {
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        if (fallback) {
          fallback.enabled = true;
          fallback.setLoop(LoopRepeat, Infinity);
          currentActionRef.current?.fadeOut(0.15);
          fallback.fadeIn(0.15).play();
          currentActionRef.current = fallback;
        }
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
