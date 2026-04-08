'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface ShadeModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isBlinking: boolean;
  isDying: boolean;
}

useGLTF.preload('/models/shade_idle.glb');
useGLTF.preload('/models/shade_walk.glb');
useGLTF.preload('/models/shade_throw.glb');

// Doubled from the knight baseline (0.0135) since the shade GLB geometry
// is smaller than the knight's — this brings it to a similar in-world size.
const SCALE = 0.0375;

export default function ShadeModel({ isWalking, isAttacking, isBlinking: _isBlinking, isDying }: ShadeModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims } = useGLTF('/models/shade_idle.glb');
  const { animations: walkAnims }  = useGLTF('/models/shade_walk.glb');
  const { animations: throwAnims } = useGLTF('/models/shade_throw.glb');

  // Clone + own materials so a dying shade's fade-out doesn't affect other instances.
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

    // Strip root-motion X/Z from locomotion clips so server position is authoritative.
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
      ...rename(idleAnims, 'Idle').map(stripRootMotionXZ),
      ...rename(walkAnims, 'Walk').map(stripRootMotionXZ),
      ...rename(throwAnims, 'Throw'),
    ];
  }, [idleAnims, walkAnims, throwAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Throw'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Attacking > Walking > Idle. No dedicated death clip — the renderer
  // fades the mesh opacity to zero when isDying.
  useEffect(() => {
    if (!actions) return;

    const nextAction = isAttacking
      ? getAction('Throw')
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
  }, [isWalking, isAttacking, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After throw finishes, blend back to Walk or Idle.
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
