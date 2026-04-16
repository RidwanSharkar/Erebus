'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export type AnimState = 'Idle' | 'Run' | 'Backwards' | 'LeftStrafe' | 'RightStrafe' | 'Jump';

interface CharacterModelProps {
  animState: AnimState;
}

useGLTF.preload('/models/character_idle.glb');
useGLTF.preload('/models/character_run.glb');
useGLTF.preload('/models/character_backwards.glb');
useGLTF.preload('/models/character_leftStrafe.glb');
useGLTF.preload('/models/character_rightStrafe.glb');
useGLTF.preload('/models/character_jump.glb');

// Adjust if the character GLB geometry is larger or smaller than expected.
// Standard Mixamo / Character Creator exports at ~200 units tall (cm) → 0.01 gives ~2 world units.
const SCALE = 0.01;

// Crossfade durations per transition type (seconds).
const FADE_NORMAL = 0.2;
const FADE_JUMP   = 0.15;

export default function CharacterModel({ animState }: CharacterModelProps) {
  const sceneGroupRef   = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims }        = useGLTF('/models/character_idle.glb');
  const { animations: runAnims }                = useGLTF('/models/character_run.glb');
  const { animations: backAnims }               = useGLTF('/models/character_backwards.glb');
  const { animations: leftAnims }               = useGLTF('/models/character_leftStrafe.glb');
  const { animations: rightAnims }              = useGLTF('/models/character_rightStrafe.glb');
  const { animations: jumpAnims }               = useGLTF('/models/character_jump.glb');

  // Clone scene so each instance owns its materials (avoids shared fade / material state).
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

    // Strip root-motion X/Z so gameplay position stays authoritative.
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
      ...rename(idleAnims,  'Idle'       ).map(stripRootMotionXZ),
      ...rename(runAnims,   'Run'        ).map(stripRootMotionXZ),
      ...rename(backAnims,  'Backwards'  ).map(stripRootMotionXZ),
      ...rename(leftAnims,  'LeftStrafe' ).map(stripRootMotionXZ),
      ...rename(rightAnims, 'RightStrafe').map(stripRootMotionXZ),
      ...rename(jumpAnims,  'Jump'       ).map(stripRootMotionXZ),
    ];
  }, [idleAnims, runAnims, backAnims, leftAnims, rightAnims, jumpAnims]);

  const { actions } = useAnimations(animations, sceneGroupRef);

  useEffect(() => {
    if (!actions) return;

    const nextAction = actions[animState] ?? null;
    if (!nextAction || nextAction === currentActionRef.current) return;

    const fadeOut = animState === 'Jump' ? FADE_JUMP : FADE_NORMAL;
    const fadeIn  = fadeOut;

    currentActionRef.current?.fadeOut(fadeOut);
    nextAction.enabled = true;

    if (animState === 'Jump') {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = false;
      nextAction.reset().fadeIn(fadeIn).play();
    } else {
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(fadeIn).play();
    }

    currentActionRef.current = nextAction;
  }, [animState, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
