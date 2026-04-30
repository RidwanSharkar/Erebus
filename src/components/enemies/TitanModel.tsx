'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface TitanModelProps {
  isWalking: boolean;
  isDying: boolean;
}

const TITAN_MODEL_PATHS = [
  '/models/titan_idle.glb',
  '/models/titan_walk.glb',
];

export function preloadTitanModels(): void {
  TITAN_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

// Adjust if the titan GLB geometry is larger or smaller than expected.
const SCALE = 0.02775;

export default function TitanModel({ isWalking, isDying }: TitanModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims } = useGLTF('/models/titan_idle.glb');
  const { animations: walkAnims }        = useGLTF('/models/titan_walk.glb');

  // Clone scene + own materials so dying fade-out doesn't bleed to other instances.
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

    // Strip root-motion X/Z so server position stays authoritative.
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
      ...rename(idleAnims, 'Idle').map(stripRootMotionXZ),
      ...rename(walkAnims, 'Walk').map(stripRootMotionXZ),
    ];
  }, [idleAnims, walkAnims]);

  const { actions } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk'): AnimationAction | null =>
    actions[name] ?? null;

  // Walk/Idle transitions (no attack animation yet).
  useEffect(() => {
    if (!actions || isDying) return;

    const nextAction = isWalking ? getAction('Walk') : getAction('Idle');
    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.3);
    nextAction.enabled = true;
    nextAction.setLoop(LoopRepeat, Infinity);
    nextAction.fadeIn(0.3).play();
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
