'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';

interface TitanModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isPoweringUp: boolean;
  isStomping: boolean;
  isCasting: boolean;
  isDying: boolean;
}

const TITAN_MODEL_PATHS = [
  '/models/titan_walk.glb',
  '/models/titan_melee.glb',
  '/models/titan_death.glb',
  '/models/titan_powerup.glb',
  '/models/titan_stomp.glb',
  '/models/titan_cast.glb',
];

export function preloadTitanModels(): void {
  TITAN_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

// Adjust if the titan GLB geometry is larger or smaller than expected.
const SCALE = 0.02775;

export default function TitanModel({
  isWalking,
  isAttacking,
  isPoweringUp,
  isStomping,
  isCasting,
  isDying,
}: TitanModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: walkAnims }     = useGLTF('/models/titan_walk.glb');
  const { animations: meleeAnims }           = useGLTF('/models/titan_melee.glb');
  const { animations: deathAnims }           = useGLTF('/models/titan_death.glb');
  const { animations: powerupAnims }         = useGLTF('/models/titan_powerup.glb');
  const { animations: stompAnims }           = useGLTF('/models/titan_stomp.glb');
  const { animations: castAnims }            = useGLTF('/models/titan_cast.glb');

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
      ...rename(walkAnims,    'Walk').map(stripRootMotionXZ),
      ...rename(meleeAnims,   'Melee').map(stripRootMotionXZ),
      ...rename(powerupAnims, 'Powerup').map(stripRootMotionXZ),
      ...rename(stompAnims,   'Stomp').map(stripRootMotionXZ),
      ...rename(castAnims,    'Cast').map(stripRootMotionXZ),
      ...rename(deathAnims,   'Death'),
    ];
  }, [walkAnims, meleeAnims, powerupAnims, stompAnims, castAnims, deathAnims]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Walk' | 'Melee' | 'Powerup' | 'Stomp' | 'Cast' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  // Priority: Death > Cast > Stomp > Powerup > Melee > Walk
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isCasting
        ? getAction('Cast')
        : isStomping
          ? getAction('Stomp')
          : isPoweringUp
            ? getAction('Powerup')
            : isAttacking
              ? getAction('Melee')
              : getAction('Walk');

    if (!nextAction) return;
    if (nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.3);

    if (isDying) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isCasting || isStomping || isPoweringUp || isAttacking) {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.3).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isPoweringUp, isStomping, isCasting, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After one-shot clips finish, blend back to Walk.
  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Melee' || name === 'Stomp' || name === 'Powerup' || name === 'Cast') {
        const walk = getAction('Walk');
        if (walk) {
          walk.setLoop(LoopRepeat, Infinity);
          currentActionRef.current?.fadeOut(0.15);
          walk.reset().fadeIn(0.15).play();
          currentActionRef.current = walk;
        }
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
