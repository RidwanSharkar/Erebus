'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface WarlockModelProps {
  isBlinking: boolean;
  isLaunching: boolean;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

useGLTF.preload('/models/warlock_idle.glb');
useGLTF.preload('/models/warlock_blink.glb');
useGLTF.preload('/models/warlock_launch.glb');
useGLTF.preload('/models/warlock_death.glb');
useGLTF.preload('/models/warlock_impact.glb');

// Starting scale — adjust if the warlock GLB geometry differs significantly from the knight (0.0135)
const SCALE = 0.0125;

export default function WarlockModel({
  isBlinking,
  isLaunching,
  isDying,
  isImpacting = false,
  impactPlayKey = 0,
  onImpactFinished,
}: WarlockModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const lastImpactPlayKeyRef = useRef(-1);

  const { scene, animations: idleAnims }   = useGLTF('/models/warlock_idle.glb');
  const { animations: blinkAnims }         = useGLTF('/models/warlock_blink.glb');
  const { animations: launchAnims }        = useGLTF('/models/warlock_launch.glb');
  const { animations: deathAnims }         = useGLTF('/models/warlock_death.glb');
  const { animations: impactAnims }        = useGLTF('/models/warlock_impact.glb');

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
      ...rename(launchAnims, 'Launch'),
      ...rename(deathAnims,  'Death'),
      ...rename(impactAnims, 'Impact'),
    ];
  }, [idleAnims, blinkAnims, launchAnims, deathAnims, impactAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Blink' | 'Launch' | 'Death' | 'Impact'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Death > Launch > Blink > Impact > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isLaunching
        ? getAction('Launch')
        : isBlinking
          ? getAction('Blink')
          : isImpacting
            ? getAction('Impact')
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
    } else if (isLaunching || isBlinking) {
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
  }, [isBlinking, isLaunching, isDying, isImpacting, impactPlayKey, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot (blink, launch, impact) finishes, return to Idle loop.
  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToIdle = () => {
      if (isDying) return;
      const idle = getAction('Idle');
      if (idle) {
        idle.setLoop(LoopRepeat, Infinity);
        currentActionRef.current?.fadeOut(0.15);
        idle.reset().fadeIn(0.15).play();
        currentActionRef.current = idle;
      }
    };

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Impact') {
        onImpactFinished?.();
        lastImpactPlayKeyRef.current = -1;
        blendToIdle();
        return;
      }
      if (name === 'Blink' || name === 'Launch') {
        blendToIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
