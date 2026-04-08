'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface WeaverModelProps {
  isWalking: boolean;
  isCastingHeal: boolean;
  isCastingSummon: boolean;
  isDying: boolean;
}

useGLTF.preload('/models/weaver_idle.glb');
useGLTF.preload('/models/weaver_walk.glb');
useGLTF.preload('/models/weaver_castheal.glb');
useGLTF.preload('/models/weaver_castsummon.glb');

const SCALE = 0.01235;

export default function WeaverModel({ isWalking, isCastingHeal, isCastingSummon, isDying }: WeaverModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims }    = useGLTF('/models/weaver_idle.glb');
  const { animations: walkAnims }           = useGLTF('/models/weaver_walk.glb');
  const { animations: castHealAnims }       = useGLTF('/models/weaver_castheal.glb');
  const { animations: castSummonAnims }     = useGLTF('/models/weaver_castsummon.glb');

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
    ];
  }, [idleAnims, walkAnims, castHealAnims, castSummonAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'CastHeal' | 'CastSummon'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: CastSummon > CastHeal > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isCastingSummon
      ? getAction('CastSummon')
      : isCastingHeal
        ? getAction('CastHeal')
        : isWalking
          ? getAction('Walk')
          : getAction('Idle');

    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isCastingSummon || isCastingHeal) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isCastingHeal, isCastingSummon, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After a cast finishes, blend back to Walk or Idle.
  useEffect(() => {
    if (!mixer || (!isCastingHeal && !isCastingSummon) || isDying) return;

    const handleFinish = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Walk') : getAction('Idle');
      if (fallback && fallback !== currentActionRef.current) {
        fallback.enabled = true;
        fallback.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.15);
        fallback.reset().fadeIn(0.15).play();
        currentActionRef.current = fallback;
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isCastingHeal, isCastingSummon, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
