'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface WarlockModelProps {
  isBlinking: boolean;
  isLaunching: boolean;
  isDying: boolean;
}

useGLTF.preload('/models/warlock_idle.glb');
useGLTF.preload('/models/warlock_blink.glb');
useGLTF.preload('/models/warlock_launch.glb');

// Starting scale — adjust if the warlock GLB geometry differs significantly from the knight (0.0135)
const SCALE = 0.0115;

export default function WarlockModel({ isBlinking, isLaunching, isDying }: WarlockModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims }   = useGLTF('/models/warlock_idle.glb');
  const { animations: blinkAnims }         = useGLTF('/models/warlock_blink.glb');
  const { animations: launchAnims }        = useGLTF('/models/warlock_launch.glb');

  // Clone scene so each instance owns its materials (prevents shared opacity bleed during death fade)
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

  // Merge clips from separate GLBs with canonical names.
  // No root-motion stripping needed — the warlock never walks.
  const animations = useMemo(() => {
    const rename = (clips: AnimationClip[], name: string) =>
      clips.map(c => { const r = c.clone(); r.name = name; return r; });

    return [
      ...rename(idleAnims,  'Idle'),
      ...rename(blinkAnims, 'Blink'),
      ...rename(launchAnims,'Launch'),
    ];
  }, [idleAnims, blinkAnims, launchAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Blink' | 'Launch'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Launching > Blinking > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isLaunching
      ? getAction('Launch')
      : isBlinking
        ? getAction('Blink')
        : getAction('Idle');

    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isLaunching || isBlinking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isBlinking, isLaunching, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After blink or launch finishes, return to Idle loop
  useEffect(() => {
    if (!mixer || (!isLaunching && !isBlinking) || isDying) return;

    const handleFinish = () => {
      if (isDying) return;
      const idle = getAction('Idle');
      if (idle && idle !== currentActionRef.current) {
        idle.enabled = true;
        idle.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.15);
        idle.reset().fadeIn(0.15).play();
        currentActionRef.current = idle;
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isLaunching, isBlinking, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
