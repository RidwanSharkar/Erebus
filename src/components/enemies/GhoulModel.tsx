'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface GhoulModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isSummoning: boolean;
  isDying: boolean;
}

useGLTF.preload('/models/ghoul_idle.glb');
useGLTF.preload('/models/ghoul_run.glb');
useGLTF.preload('/models/ghoul_attack.glb');
useGLTF.preload('/models/ghoul_attack2.glb');
useGLTF.preload('/models/ghoul_summon.glb');

const SCALE = 0.015;

export default function GhoulModel({ isWalking, isAttacking, attackVariant, isSummoning, isDying }: GhoulModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims }    = useGLTF('/models/ghoul_idle.glb');
  const { animations: runAnims }            = useGLTF('/models/ghoul_run.glb');
  const { animations: attackAnims }         = useGLTF('/models/ghoul_attack.glb');
  const { animations: attack2Anims }        = useGLTF('/models/ghoul_attack2.glb');
  const { animations: summonAnims }         = useGLTF('/models/ghoul_summon.glb');

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
      ...rename(idleAnims,    'Idle').map(stripRootMotionXZ),
      ...rename(runAnims,     'Run').map(stripRootMotionXZ),
      ...rename(attackAnims,  'Attack'),
      ...rename(attack2Anims, 'Attack2'),
      ...rename(summonAnims,  'Summon'),
    ];
  }, [idleAnims, runAnims, attackAnims, attack2Anims, summonAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Run' | 'Attack' | 'Attack2' | 'Summon'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Summon > Attack > Run > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isSummoning
      ? getAction('Summon')
      : isAttacking
        ? getAction(attackClip)
        : isWalking
          ? getAction('Run')
          : getAction('Idle');

    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isSummoning || isAttacking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, attackVariant, isSummoning, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After summon or attack finishes, blend back to Run or Idle.
  useEffect(() => {
    if (!mixer || (!isAttacking && !isSummoning) || isDying) return;

    const handleFinish = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Run') : getAction('Idle');
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
  }, [mixer, isAttacking, isSummoning, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
