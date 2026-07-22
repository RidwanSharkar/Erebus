'use client';

import React, { useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

export type ValkyrieAbilityClip = 'Attack' | 'Attack2' | 'Cast';

interface ValkyrieModelProps {
  abilityClip: ValkyrieAbilityClip | null;
  isDying: boolean;
}

const VALKYRIE_MODEL_PATHS = [
  '/models/valkyrie_idle.glb',
  '/models/valkyrie_attack.glb',
  '/models/valkyrie_attack2.glb',
  '/models/valkyrie_cast.glb',
  '/models/valkyrie_death.glb',
];

export function preloadValkyrieModels(): void {
  VALKYRIE_MODEL_PATHS.forEach((path) => useGLTF.preload(path));
}

const SCALE = 0.0161;

export default React.memo(function ValkyrieModel({
  abilityClip,
  isDying,
}: ValkyrieModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const hasKickedIdleRef = useRef(false);

  const { scene, animations: idleAnims } = useGLTF('/models/valkyrie_idle.glb');
  const { animations: attackAnims } = useGLTF('/models/valkyrie_attack.glb');
  const { animations: attack2Anims } = useGLTF('/models/valkyrie_attack2.glb');
  const { animations: castAnims } = useGLTF('/models/valkyrie_cast.glb');
  const { animations: deathAnims } = useGLTF('/models/valkyrie_death.glb');

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
      getCachedEnemyAnimationClips('valkyrie', () => [
        ...renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ),
        ...renameAnimationClips(attackAnims, 'Attack').map(stripRootMotionXZ),
        ...renameAnimationClips(attack2Anims, 'Attack2').map(stripRootMotionXZ),
        ...renameAnimationClips(castAnims, 'Cast').map(stripRootMotionXZ),
        ...renameAnimationClips(deathAnims, 'Death'),
      ]),
    [idleAnims, attackAnims, attack2Anims, castAnims, deathAnims],
  );

  const animations = useMemo(
    () => processedClips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip)),
    [processedClips, clonedScene],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);
  const getAction = (name: 'Idle' | 'Attack' | 'Attack2' | 'Cast' | 'Death'): AnimationAction | null =>
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
    const nextAction = isDying
      ? getAction('Death')
      : abilityClip
        ? getAction(abilityClip)
        : getAction('Idle');
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
  }, [actions, isDying, abilityClip]);

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      const clipName = e.action?.getClip().name;
      if ((clipName === 'Attack' || clipName === 'Attack2' || clipName === 'Cast') && !isDying) {
        const idle = getAction('Idle');
        if (idle) {
          currentActionRef.current?.fadeOut(0.2);
          idle.enabled = true;
          idle.setLoop(LoopRepeat, Infinity);
          idle.reset().fadeIn(0.2).play();
          currentActionRef.current = idle;
        }
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, isDying]);

  return (
    <group ref={sceneGroupRef}>
      <group scale={SCALE}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
