'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

interface WeaverModelProps {
  isWalking: boolean;
  isCastingHeal: boolean;
  /** When true, CastHeal clips loop until `isCastingHeal` clears (Boss 3 beam channel). */
  castHealLoop?: boolean;
  isCastingSummon: boolean;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

const WEAVER_MODEL_PATHS = [
  '/models/weaver_idle.glb',
  '/models/weaver_walk.glb',
  '/models/weaver_castheal.glb',
  '/models/weaver_castsummon.glb',
  '/models/weaver_death.glb',
  '/models/weaver_impact.glb',
];

export function preloadWeaverModels(): void {
  WEAVER_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

const SCALE = 0.01235;

export default function WeaverModel({
  isWalking,
  isCastingHeal,
  castHealLoop = false,
  isCastingSummon,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
}: WeaverModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);

  const { scene, animations: idleAnims }    = useGLTF('/models/weaver_idle.glb');
  const { animations: walkAnims }           = useGLTF('/models/weaver_walk.glb');
  const { animations: castHealAnims }       = useGLTF('/models/weaver_castheal.glb');
  const { animations: castSummonAnims }     = useGLTF('/models/weaver_castsummon.glb');
  const { animations: deathAnims }          = useGLTF('/models/weaver_death.glb');
  const { animations: impactAnims }         = useGLTF('/models/weaver_impact.glb');

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow    = true;
        child.receiveShadow = true;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const animations = useMemo(() => {
    const rename = (clips: AnimationClip[], name: string) =>
      clips.map(c => { const r = c.clone(); r.name = name; return r; });

    const stripRootMotionXZ = (clip: AnimationClip): AnimationClip => {
      clip.tracks = clip.tracks.map(track => {
        if (!track.name.endsWith('.position')) return track;
        if (!track.name.toLowerCase().includes('hips')) return track;
        const values = Float32Array.from(track.values);
        for (let i = 0; i < values.length; i += 3) {
          values[i]     = 0;
          values[i + 2] = 0;
        }
        return new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
      });
      return clip;
    };

    return [
      ...rename(idleAnims,       'Idle').map(stripRootMotionXZ),
      ...rename(walkAnims,       'Walk').map(stripRootMotionXZ),
      ...rename(castHealAnims,   'CastHeal'),
      ...rename(castSummonAnims, 'CastSummon'),
      ...rename(deathAnims,      'Death'),
      ...rename(impactAnims,     'Impact'),
    ];
  }, [idleAnims, walkAnims, castHealAnims, castSummonAnims, deathAnims, impactAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'CastHeal' | 'CastSummon' | 'Death' | 'Impact'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Death > CastSummon > CastHeal > Impact > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isCastingSummon
        ? getAction('CastSummon')
        : isCastingHeal
          ? getAction('CastHeal')
          : isImpacting
            ? getAction('Impact')
            : isWalking
              ? getAction('Walk')
              : getAction('Idle');

    if (!nextAction) return;

    const sameClip = nextAction === currentActionRef.current;
    if (sameClip) {
      const retriggerImpact = isImpacting && impactPlayKey !== lastImpactPlayKeyRef.current;
      if (isCastingHeal && castHealLoop && getAction('CastHeal') === nextAction) {
        nextAction.setLoop(LoopRepeat, Infinity);
        nextAction.clampWhenFinished = false;
        if (!nextAction.isRunning()) nextAction.play();
        return;
      }
      if (!retriggerImpact) return;
    }

    currentActionRef.current?.fadeOut(0.2);

    if (isDying) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isCastingSummon) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else if (isCastingHeal) {
      if (castHealLoop) {
        nextAction.setLoop(LoopRepeat, Infinity);
        nextAction.clampWhenFinished = false;
      } else {
        nextAction.setLoop(LoopOnce, 1);
        nextAction.clampWhenFinished = true;
      }
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
  }, [isWalking, isCastingHeal, castHealLoop, isCastingSummon, isDying, isImpacting, impactPlayKey, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot (impact, cast) finishes, blend back to Walk or Idle.
  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToWalkOrIdle = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Walk') : getAction('Idle');
      if (fallback) {
        fallback.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.15);
        fallback.reset().fadeIn(0.15).play();
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
      if (name === 'CastHeal' || name === 'CastSummon') {
        if (name === 'CastHeal' && castHealLoop) return;
        blendToWalkOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, isCastingHeal, castHealLoop, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
