'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { getCachedProcessedClips, renameAnimationClips, stripRootMotionXZ } from '@/utils/enemyAnimationClipCache';

interface TemplarModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
  isLeaping?: boolean;
  onLeapFinished?: () => void;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
  /** Templar Blink Smite wind-up (templar_smite.glb) */
  isBlinkSmite?: boolean;
  blinkSmitePlayKey?: number;
  onBlinkSmiteFinished?: () => void;
}

const TEMPLAR_MODEL_PATHS = [
  '/models/templar_idle.glb',
  '/models/templar_run.glb',
  '/models/templar_attack.glb',
  '/models/templar_attack2.glb',
  '/models/templar_death.glb',
  '/models/templar_impact.glb',
  '/models/templar_smite.glb',
  '/models/templar_leap.glb',
];

export function preloadTemplarModels(): void {
  TEMPLAR_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

// Scale to match in-world height (~2 game units). Tune if GLB geometry differs.
const SCALE = 0.013;

export default React.memo(function TemplarModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
  isLeaping = false,
  onLeapFinished,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
  isBlinkSmite = false,
  blinkSmitePlayKey = 0,
  onBlinkSmiteFinished,
}: TemplarModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);
  const lastBlinkSmitePlayKeyRef = useRef(-1);

  const { scene, animations: idleAnims }    = useGLTF('/models/templar_idle.glb');
  const { animations: runAnims }            = useGLTF('/models/templar_run.glb');
  const { animations: attackAnims }         = useGLTF('/models/templar_attack.glb');
  const { animations: attack2Anims }        = useGLTF('/models/templar_attack2.glb');
  const { animations: deathAnims }          = useGLTF('/models/templar_death.glb');
  const { animations: impactAnims }         = useGLTF('/models/templar_impact.glb');
  const { animations: smiteAnims }          = useGLTF('/models/templar_smite.glb');
  const { animations: leapAnims }           = useGLTF('/models/templar_leap.glb');

  // Clone scene + own materials so dying fade-out is isolated to this instance.
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
    () => [
      ...getCachedProcessedClips('templar-idle', idleAnims, { stripRootMotion: true, renameTo: 'Idle' }),
      ...getCachedProcessedClips('templar-run', runAnims, { stripRootMotion: true, renameTo: 'Walk' }),
      ...getCachedProcessedClips('templar-attack', attackAnims, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('templar-attack2', attack2Anims, { renameTo: 'Attack2' }),
      ...getCachedProcessedClips('templar-death', deathAnims, { renameTo: 'Death' }),
      ...getCachedProcessedClips('templar-impact', impactAnims, { renameTo: 'Impact' }),
      ...(smiteAnims.length
        ? getCachedProcessedClips('templar-smite', [smiteAnims[0]], { stripRootMotion: true, renameTo: 'BlinkSmite' })
        : []),
      ...getCachedProcessedClips('templar-leap', leapAnims, { stripRootMotion: true, renameTo: 'Leap' }),
    ],
    [idleAnims, runAnims, attackAnims, attack2Anims, deathAnims, impactAnims, smiteAnims, leapAnims],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Attack2' | 'Death' | 'Impact' | 'BlinkSmite' | 'Leap'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Death > Leap > BlinkSmite > Attack > Impact > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isLeaping
        ? getAction('Leap')
        : isBlinkSmite
          ? getAction('BlinkSmite')
          : isAttacking
            ? getAction(attackClip)
            : isImpacting
              ? getAction('Impact')
              : isWalking
                ? getAction('Walk')
                : getAction('Idle');

    if (!nextAction) return;
    if (nextAction === currentActionRef.current) {
      const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
      const retriggerBlinkSmite = isBlinkSmite && blinkSmitePlayKey !== lastBlinkSmitePlayKeyRef.current;
      if (!retriggerImpact && !retriggerBlinkSmite) return;
    }

    currentActionRef.current?.fadeOut(0.2);

    if (isDying) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isLeaping) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.1).play();
    } else if (isBlinkSmite) {
      lastBlinkSmitePlayKeyRef.current = blinkSmitePlayKey;
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
      if (!isBlinkSmite) lastBlinkSmitePlayKeyRef.current = -1;
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.reset().fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isDying, attackVariant, isLeaping, isImpacting, impactPlayKey, isBlinkSmite, blinkSmitePlayKey, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot (impact, attack) finishes, blend back to Walk or Idle.
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
      if (name === 'Leap') {
        onLeapFinished?.();
        blendToWalkOrIdle();
        return;
      }
      if (name === 'BlinkSmite') {
        onBlinkSmiteFinished?.();
        // Keep playKey matched so useEffect won't retrigger while React clears isBlinkSmite.
        lastBlinkSmitePlayKeyRef.current = blinkSmitePlayKey;
        blendToWalkOrIdle();
        return;
      }
      if (name === 'Attack' || name === 'Attack2') {
        blendToWalkOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished, onBlinkSmiteFinished, onLeapFinished, blinkSmitePlayKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});

