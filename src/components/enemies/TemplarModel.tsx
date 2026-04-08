'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface TemplarModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
}

useGLTF.preload('/models/templar_idle.glb');
useGLTF.preload('/models/templar_run.glb');
useGLTF.preload('/models/templar_attack.glb');
useGLTF.preload('/models/templar_attack2.glb');

// Scale to match in-world height (~2 game units). Tune if GLB geometry differs.
const SCALE = 0.013;

export default function TemplarModel({ isWalking, isAttacking, attackVariant, isDying }: TemplarModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims }    = useGLTF('/models/templar_idle.glb');
  const { animations: runAnims }            = useGLTF('/models/templar_run.glb');
  const { animations: attackAnims }         = useGLTF('/models/templar_attack.glb');
  const { animations: attack2Anims }        = useGLTF('/models/templar_attack2.glb');

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

  const animations = useMemo(() => {
    const rename = (clips: AnimationClip[], name: string) =>
      clips.map(c => { const r = c.clone(); r.name = name; return r; });

    // Strip root-motion X/Z so server position stays authoritative.
    const stripRootMotionXZ = (clip: AnimationClip): AnimationClip => {
      clip.tracks = clip.tracks.map(track => {
        if (!track.name.endsWith('.position')) return track;
        if (!track.name.toLowerCase().includes('hips')) return track;
        const values = Float32Array.from(track.values);
        for (let i = 0; i < values.length; i += 3) {
          values[i]     = 0; // X
          values[i + 2] = 0; // Z
        }
        return new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
      });
      return clip;
    };

    return [
      ...rename(idleAnims,    'Idle').map(stripRootMotionXZ),
      ...rename(runAnims,     'Walk').map(stripRootMotionXZ),
      ...rename(attackAnims,  'Attack'),
      ...rename(attack2Anims, 'Attack2'),
    ];
  }, [idleAnims, runAnims, attackAnims, attack2Anims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Attack2'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Attack > Walk > Idle. No dedicated death clip — renderer fades opacity.
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isAttacking
      ? getAction(attackClip)
      : isWalking
        ? getAction('Walk')
        : getAction('Idle');

    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isAttacking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isDying, attackVariant, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After attack finishes, blend back to Walk or Idle.
  useEffect(() => {
    if (!mixer || !isAttacking || isDying) return;

    const handleFinish = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Walk') : getAction('Idle');
      if (fallback && fallback !== currentActionRef.current) {
        fallback.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.15);
        fallback.reset().fadeIn(0.15).play();
        currentActionRef.current = fallback;
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isAttacking, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
