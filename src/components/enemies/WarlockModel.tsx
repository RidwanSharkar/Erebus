'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

interface WarlockModelProps {
  isWalking: boolean;
  isBlinking: boolean;
  isLaunching: boolean;
  isDying: boolean;
  isImpacting?: boolean;
  impactPlayKey?: number;
  onImpactFinished?: () => void;
}

const WARLOCK_MODEL_PATHS = [
  '/models/warlock_idle.glb',
  '/models/warlock_walk.glb',
  '/models/warlock_blink.glb',
  '/models/warlock_launch.glb',
  '/models/warlock_death.glb',
  '/models/warlock_impact.glb',
];

export function preloadWarlockModels(): void {
  WARLOCK_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

const SCALE = 0.0125;

export default function WarlockModel({
  isWalking,
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
  const { animations: walkAnims }          = useGLTF('/models/warlock_walk.glb');
  const { animations: blinkAnims }         = useGLTF('/models/warlock_blink.glb');
  const { animations: launchAnims }        = useGLTF('/models/warlock_launch.glb');
  const { animations: deathAnims }         = useGLTF('/models/warlock_death.glb');
  const { animations: impactAnims }        = useGLTF('/models/warlock_impact.glb');

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
      ...rename(idleAnims,   'Idle').map(stripRootMotionXZ),
      ...rename(walkAnims,   'Walk').map(stripRootMotionXZ),
      ...rename(blinkAnims,  'Blink'),
      ...rename(launchAnims, 'Launch'),
      ...rename(deathAnims,  'Death'),
      ...rename(impactAnims, 'Impact'),
    ];
  }, [idleAnims, walkAnims, blinkAnims, launchAnims, deathAnims, impactAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Blink' | 'Launch' | 'Death' | 'Impact'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Death > Launch > Blink > Impact > Walk > Idle
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
            : isWalking
              ? getAction('Walk')
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
  }, [isWalking, isBlinking, isLaunching, isDying, isImpacting, impactPlayKey, actions]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (name === 'Blink' || name === 'Launch') {
        blendToWalkOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions, onImpactFinished]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
