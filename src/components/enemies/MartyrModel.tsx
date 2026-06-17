'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface MartyrModelProps {
  isWalking: boolean;
  isDying: boolean;
}

const MARTYR_MODEL_PATHS = [
  '/models/martyr_idle.glb',
  '/models/martyr_run.glb',
  '/models/martyr_death.glb',
];

export function preloadMartyrModels(): void {
  MARTYR_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

const SCALE = 0.008;

export default function MartyrModel({ isWalking, isDying }: MartyrModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims } = useGLTF('/models/martyr_idle.glb');
  const { animations: runAnims } = useGLTF('/models/martyr_run.glb');
  const { animations: deathAnims } = useGLTF('/models/martyr_death.glb');

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
    const rename = (clips: AnimationClip[], name: string) => clips.map(c => {
      const r = c.clone();
      r.name = name;
      return r;
    });

    const stripRootMotionXZ = (clip: AnimationClip): AnimationClip => {
      clip.tracks = clip.tracks.map(track => {
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
      ...rename(runAnims, 'Run').map(stripRootMotionXZ),
      ...rename(deathAnims, 'Death').map(stripRootMotionXZ),
    ];
  }, [idleAnims, runAnims, deathAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Run' | 'Death'): AnimationAction | null => actions[name] ?? null;

  // Priority: Death > Run (or Idle when priming) > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isWalking
        ? getAction('Run')
        : getAction('Idle');

    if (!nextAction) return;
    if (nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isDying) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
