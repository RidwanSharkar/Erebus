'use client';

import React, { useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

export type SentinelAbilityClip = 'ThrowUp' | 'HoldCast';

interface SentinelModelProps {
  isWalking: boolean;
  isSprinting: boolean;
  isStunned?: boolean;
  isSlowed?: boolean;
  abilityClip: SentinelAbilityClip | null;
  isDying: boolean;
}

const SENTINEL_MODEL_PATHS = [
  '/models/sentinel_idle.glb',
  '/models/sentinel_walk.glb',
  '/models/sentinel_sprint.glb',
  '/models/sentinel_throwUp.glb',
  '/models/sentinel_holdCast.glb',
  '/models/sentinel_death.glb',
];

export function preloadSentinelModels(): void {
  SENTINEL_MODEL_PATHS.forEach((path) => useGLTF.preload(path));
}

const SCALE = 0.014;

export default React.memo(function SentinelModel({
  isWalking,
  isSprinting,
  isStunned = false,
  isSlowed = false,
  abilityClip,
  isDying,
}: SentinelModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const hasKickedIdleRef = useRef(false);

  const { scene, animations: idleAnims } = useGLTF('/models/sentinel_idle.glb');
  const { animations: walkAnims } = useGLTF('/models/sentinel_walk.glb');
  const { animations: sprintAnims } = useGLTF('/models/sentinel_sprint.glb');
  const { animations: throwUpAnims } = useGLTF('/models/sentinel_throwUp.glb');
  const { animations: holdCastAnims } = useGLTF('/models/sentinel_holdCast.glb');
  const { animations: deathAnims } = useGLTF('/models/sentinel_death.glb');

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
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const processedClips = useMemo(
    () =>
      getCachedEnemyAnimationClips('sentinel', () => [
        ...renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ),
        ...renameAnimationClips(walkAnims, 'Walk').map(stripRootMotionXZ),
        ...renameAnimationClips(sprintAnims, 'Sprint').map(stripRootMotionXZ),
        ...renameAnimationClips(throwUpAnims, 'ThrowUp'),
        ...renameAnimationClips(holdCastAnims, 'HoldCast'),
        ...renameAnimationClips(deathAnims, 'Death'),
      ]),
    [idleAnims, walkAnims, sprintAnims, throwUpAnims, holdCastAnims, deathAnims],
  );

  const animations = useMemo(
    () => processedClips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip)),
    [processedClips, clonedScene],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);
  const getAction = (name: 'Idle' | 'Walk' | 'Sprint' | 'ThrowUp' | 'HoldCast' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  useLayoutEffect(() => {
    const idle = actions?.Idle;
    if (!idle || hasKickedIdleRef.current) return;
    hasKickedIdleRef.current = true;
    idle.enabled = true;
    idle.setLoop(LoopRepeat, Infinity);
    idle.play();
    currentActionRef.current = idle;
  }, [actions]);

  useEffect(() => {
    if (!actions) return;
    const locomotion = isStunned
      ? 'Idle'
      : isSlowed
        ? (isWalking ? 'Walk' : 'Idle')
        : isSprinting
          ? 'Sprint'
          : isWalking
            ? 'Walk'
            : 'Idle';
    const nextAction = isDying
      ? getAction('Death')
      : abilityClip
        ? getAction(abilityClip)
        : getAction(locomotion);
    if (!nextAction || nextAction === currentActionRef.current) return;
    currentActionRef.current?.fadeOut(0.2);
    if (isDying || abilityClip) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = isDying;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.reset().fadeIn(0.2).play();
    }
    currentActionRef.current = nextAction;
  }, [actions, isDying, isWalking, isSprinting, isStunned, isSlowed, abilityClip]);

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      const clipName = e.action?.getClip().name;
      if ((clipName === 'ThrowUp' || clipName === 'HoldCast') && !isDying) {
        const loc = isStunned
          ? 'Idle'
          : isSlowed
            ? (isWalking ? 'Walk' : 'Idle')
            : isSprinting
              ? 'Sprint'
              : isWalking
                ? 'Walk'
                : 'Idle';
        const next = getAction(loc);
        if (next) {
          currentActionRef.current?.fadeOut(0.2);
          next.enabled = true;
          next.setLoop(LoopRepeat, Infinity);
          next.reset().fadeIn(0.2).play();
          currentActionRef.current = next;
        }
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, isWalking, isSprinting, isStunned, isSlowed, isDying]);

  return (
    <group ref={sceneGroupRef}>
      <group scale={SCALE}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
