'use client';

import React, { useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

export type SpectreAbilityClip = 'Spin';

interface SpectreModelProps {
  isWalking: boolean;
  abilityClip: SpectreAbilityClip | null;
  isDying: boolean;
}

const SPECTRE_MODEL_PATHS = [
  '/models/spectre_idle.glb',
  '/models/spectre_run.glb',
  '/models/spectre_attack.glb',
  '/models/spectre_death.glb',
];

export function preloadSpectreModels(): void {
  SPECTRE_MODEL_PATHS.forEach((path) => useGLTF.preload(path));
}

const SCALE = 0.014;

export default React.memo(function SpectreModel({
  isWalking,
  abilityClip,
  isDying,
}: SpectreModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const hasKickedIdleRef = useRef(false);

  const { scene, animations: idleAnims } = useGLTF('/models/spectre_idle.glb');
  const { animations: runAnims } = useGLTF('/models/spectre_run.glb');
  const { animations: attackAnims } = useGLTF('/models/spectre_attack.glb');
  const { animations: deathAnims } = useGLTF('/models/spectre_death.glb');

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
      getCachedEnemyAnimationClips('spectre', () => [
        ...renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ),
        ...renameAnimationClips(runAnims, 'Run').map(stripRootMotionXZ),
        ...renameAnimationClips(attackAnims, 'Spin').map(stripRootMotionXZ),
        ...renameAnimationClips(deathAnims, 'Death'),
      ]),
    [idleAnims, runAnims, attackAnims, deathAnims],
  );

  const animations = useMemo(
    () => processedClips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip)),
    [processedClips, clonedScene],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Run' | 'Spin' | 'Death'): AnimationAction | null =>
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
        ? getAction('Spin')
        : isWalking
          ? getAction('Run')
          : getAction('Idle');

    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isDying || abilityClip) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = isDying || !!abilityClip;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.reset().fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [actions, isDying, isWalking, abilityClip]);

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      if (e.action?.getClip().name === 'Spin' && !isDying) {
        const walk = getAction(isWalking ? 'Run' : 'Idle');
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
