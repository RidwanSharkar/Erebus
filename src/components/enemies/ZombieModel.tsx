'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface ZombieModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isSummoning: boolean;
  isDying: boolean;
}

useGLTF.preload('/models/zombie_idle.glb');
useGLTF.preload('/models/zombie_walk.glb');
useGLTF.preload('/models/zombie_attack.glb');
useGLTF.preload('/models/zombie_summon.glb');
useGLTF.preload('/models/zombie_death.glb');

const SCALE = 0.014;

export default function ZombieModel({ isWalking, isAttacking, isSummoning, isDying }: ZombieModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims } = useGLTF('/models/zombie_idle.glb');
  const { animations: walkAnims } = useGLTF('/models/zombie_walk.glb');
  const { animations: attackAnims } = useGLTF('/models/zombie_attack.glb');
  const { animations: summonAnims } = useGLTF('/models/zombie_summon.glb');
  const { animations: deathAnims } = useGLTF('/models/zombie_death.glb');

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
      clips.map((c) => {
        const r = c.clone();
        r.name = name;
        return r;
      });

    const stripRootMotionXZ = (clip: AnimationClip): AnimationClip => {
      clip.tracks = clip.tracks.map((track) => {
        if (!track.name.endsWith('.position')) return track;
        if (!track.name.toLowerCase().includes('hips')) return track;
        const values = Float32Array.from(track.values);
        for (let i = 0; i < values.length; i += 3) {
          values[i] = 0;
          values[i + 2] = 0;
        }
        return new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
      });
      return clip;
    };

    return [
      ...rename(idleAnims, 'Idle').map(stripRootMotionXZ),
      ...rename(walkAnims, 'Walk').map(stripRootMotionXZ),
      ...rename(attackAnims, 'Attack'),
      ...rename(summonAnims, 'Summon'),
      ...rename(deathAnims, 'Death'),
    ];
  }, [idleAnims, walkAnims, attackAnims, summonAnims, deathAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Summon' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isSummoning
        ? getAction('Summon')
        : isAttacking
          ? getAction('Attack')
          : isWalking
            ? getAction('Walk')
            : getAction('Idle');

    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isDying) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isSummoning || isAttacking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isSummoning, isDying, actions]);

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
      if (name === 'Summon' || name === 'Attack') {
        blendToWalkOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]);

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
