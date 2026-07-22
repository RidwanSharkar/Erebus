'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, SHADE_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { getCachedEnemyAnimationClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface ShadeModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isBlinking: boolean;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

const SHADE_MODEL_PATHS = [
  '/models/shade_idle.glb',
  '/models/shade_walk.glb',
  '/models/shade_throw.glb',
  '/models/shade_death.glb',
  '/models/shade_impact.glb',
];

export function preloadShadeModels(): void {
  SHADE_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

// Doubled from the knight baseline (0.0135) since the shade GLB geometry
// is smaller than the knight's — this brings it to a similar in-world size.
const SCALE = 0.0375;

export default React.memo(function ShadeModel({
  isWalking,
  isAttacking,
  isBlinking: _isBlinking,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
}: ShadeModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);

  const { scene, animations: idleAnims } = useGLTF('/models/shade_idle.glb');
  const { animations: walkAnims }  = useGLTF('/models/shade_walk.glb');
  const { animations: throwAnims } = useGLTF('/models/shade_throw.glb');
  const { animations: deathAnims } = useGLTF('/models/shade_death.glb');
  const { animations: impactAnims } = useGLTF('/models/shade_impact.glb');

  // Clone + own materials so a dying shade's fade-out doesn't affect other instances.
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
    applySelfIllumination(clone, { intensity: SHADE_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(
    () =>
      getCachedEnemyAnimationClips('shade', () => [
        ...renameAnimationClips(idleAnims, 'Idle').map(stripRootMotionXZ),
        ...renameAnimationClips(walkAnims, 'Walk').map(stripRootMotionXZ),
        ...renameAnimationClips(throwAnims, 'Throw'),
        ...renameAnimationClips(deathAnims, 'Death'),
        ...renameAnimationClips(impactAnims, 'Impact'),
      ]),
    [idleAnims, walkAnims, throwAnims, deathAnims, impactAnims],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Throw' | 'Death' | 'Impact'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Death > Throw > Impact > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction('Throw')
        : isImpacting
          ? getAction('Impact')
          : isWalking
            ? getAction('Walk')
            : getAction('Idle');

    if (!nextAction) return;
    if (nextAction === currentActionRef.current) {
      const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
      if (!retriggerImpact) return;
    }

    currentActionRef.current?.fadeOut(0.2);

    if (isDying) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isAttacking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else if (isImpacting) {
      lastImpactPlayKeyRef.current = impactPlayKey;
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      if (!isImpacting) lastImpactPlayKeyRef.current = -1;
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isDying, isImpacting, impactPlayKey, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot (throw, impact) finishes, blend back to Walk or Idle.
  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToWalkOrIdle = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Walk') : getAction('Idle');
      if (fallback) {
        fallback.enabled = true;
        fallback.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.15);
        fallback.fadeIn(0.15).play();
        currentActionRef.current = fallback;
      }
    };

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        blendToWalkOrIdle();
        return;
      }
      if (name === 'Throw') {
        blendToWalkOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});

