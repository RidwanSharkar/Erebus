'use client';

import React, { useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface NemesisModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
}

const NEMESIS_MODEL_PATHS = [
  '/models/nemesis_idle.glb',
  '/models/nemesis_walk.glb',
  '/models/nemesis_melee.glb',
  '/models/nemesis_melee2.glb',
  '/models/nemesis_death.glb',
];

export function preloadNemesisModels(): void {
  NEMESIS_MODEL_PATHS.forEach((path) => useGLTF.preload(path));
}

const SCALE = 0.022;

export default React.memo(function NemesisModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
}: NemesisModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const hasKickedIdleRef = useRef(false);

  const { scene, animations: idleAnims } = useGLTF('/models/nemesis_idle.glb');
  const { animations: walkAnims } = useGLTF('/models/nemesis_walk.glb');
  const { animations: meleeAnims } = useGLTF('/models/nemesis_melee.glb');
  const { animations: melee2Anims } = useGLTF('/models/nemesis_melee2.glb');
  const { animations: deathAnims } = useGLTF('/models/nemesis_death.glb');

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
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const processedClips = useMemo(
    () =>
      getCachedEnemyAnimationClips('nemesis', () => [
        ...renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ),
        ...renameAnimationClips(walkAnims, 'Walk').map(stripRootMotionXZ),
        ...renameAnimationClips(meleeAnims, 'Melee').map(stripRootMotionXZ),
        ...renameAnimationClips(melee2Anims, 'Melee2').map(stripRootMotionXZ),
        ...renameAnimationClips(deathAnims, 'Death'),
      ]),
    [idleAnims, walkAnims, meleeAnims, melee2Anims, deathAnims],
  );

  const animations = useMemo(
    () => processedClips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip)),
    [processedClips, clonedScene],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);
  const getAction = (name: 'Idle' | 'Walk' | 'Melee' | 'Melee2' | 'Death'): AnimationAction | null =>
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
    const attackClip = attackVariant === 2 ? 'Melee2' : 'Melee';
    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction(attackClip)
        : isWalking
          ? getAction('Walk')
          : getAction('Idle');
    if (!nextAction || nextAction === currentActionRef.current) return;
    currentActionRef.current?.fadeOut(0.2);
    if (isDying || isAttacking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = isDying;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.reset().fadeIn(0.2).play();
    }
    currentActionRef.current = nextAction;
  }, [actions, isDying, isWalking, isAttacking, attackVariant]);

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      const clipName = e.action?.getClip().name;
      if ((clipName === 'Melee' || clipName === 'Melee2') && !isDying) {
        const walk = getAction(isWalking ? 'Walk' : 'Idle');
        if (walk) {
          currentActionRef.current?.fadeOut(0.2);
          walk.enabled = true;
          walk.setLoop(LoopRepeat, Infinity);
          walk.reset().fadeIn(0.2).play();
          currentActionRef.current = walk;
        }
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, isWalking, isDying]);

  return (
    <group ref={sceneGroupRef}>
      <group scale={SCALE}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
