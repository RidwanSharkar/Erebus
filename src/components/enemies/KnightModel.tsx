'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

interface KnightModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
}

// Load mesh + skeleton from the "with skin" idle export.
// Walk/Attack are loaded separately so each clip lives in its own single-scene
// GLB — avoiding the multi-scene node-index confusion that gltf-transform merge
// introduces when the animations target bones from different scene subtrees.
useGLTF.preload('/models/knight_idle.glb');
useGLTF.preload('/models/knight_walk.glb');
useGLTF.preload('/models/knight_attack.glb');
useGLTF.preload('/models/knight_attack2.glb');
useGLTF.preload('/models/knight_death.glb');
 
// GLB geometry is in centimeters (bboxMax Y ≈ 172.5 cm).
// Target ≈ 2 game units tall → 2 / 172.5 ≈ 0.0116
const SCALE = 0.015;

export default function KnightModel({ isWalking, isAttacking, attackVariant, isDying }: KnightModelProps) {
  // This ref is the root handed to useAnimations so the mixer can find bones
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  // Scene (mesh + skeleton) comes from the idle GLB only
  const { scene, animations: idleAnims } = useGLTF('/models/knight_idle.glb');
  // Pull animation clips from the separate single-animation GLBs
  const { animations: walkAnims }    = useGLTF('/models/knight_walk.glb');
  const { animations: attackAnims }  = useGLTF('/models/knight_attack.glb');
  const { animations: attack2Anims } = useGLTF('/models/knight_attack2.glb');
  const { animations: deathAnims }   = useGLTF('/models/knight_death.glb');

  // SkeletonUtils.clone() properly re-binds each clone's SkinnedMesh to its own
  // skeleton, so multiple knight instances are fully independent.
  // Plain scene.clone(true) shares the skeleton across all instances, causing
  // all models to collapse to the same world position.
  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
        // SkeletonUtils.clone() re-binds skeletons but leaves Material references
        // shared across all instances (Object3D.clone() is shallow for materials).
        // The death fade-out in KnightRenderer mutates mat.opacity directly, so
        // each instance MUST own its own material objects or one dying knight will
        // make every other knight on the map invisible simultaneously.
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    return clone;
  }, [scene]);

  // Merge clips from the three separate GLBs into one array with canonical names.
  // Each individual GLB exports its clip as "mixamo.com", so we rename here.
  // Cloning avoids mutating the cached shared AnimationClip objects.
  const animations = useMemo(() => {
    const rename = (clips: AnimationClip[], name: string) =>
      clips.map(c => { const r = c.clone(); r.name = name; return r; });

    // Mixamo walk/idle animations embed root motion in the Hips position track —
    // the bone physically translates forward through the clip. Since position is
    // driven by server state, we zero out X and Z while keeping Y so the natural
    // vertical bounce is preserved.
    //
    // Match the Hips position track case-insensitively to handle naming variations
    // across export tools (mixamorig:Hips, mixamorig_Hips, Hips, etc.).
    // Only the Hips (root bone) should be stripped — other bones need their
    // local-space position offsets intact.
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
      ...rename(idleAnims,    'Idle').map(stripRootMotionXZ),
      ...rename(walkAnims,    'Walk').map(stripRootMotionXZ),
      ...rename(attackAnims,  'Attack'),
      ...rename(attack2Anims, 'Attack2'),
      ...rename(deathAnims,   'Death'),
    ];
  }, [idleAnims, walkAnims, attackAnims, attack2Anims, deathAnims]);

  // Bind the mixer to the clone's root so it can traverse to find bones by name
  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Walk' | 'Attack' | 'Attack2' | 'Death'): AnimationAction | null =>
    actions[name] ?? null;

  // Transition to the right animation clip when state changes.
  // Priority: Death > Attack > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction(attackClip)
        : isWalking
          ? getAction('Walk')
          : getAction('Idle');

    if (!nextAction || nextAction === currentActionRef.current) return;

    currentActionRef.current?.fadeOut(0.2);

    if (isDying) {
      // Death is a one-shot that clamps on its last frame (corpse pose).
      // Use a shorter fade-in so the collapse begins immediately.
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.15).play();
    } else if (isAttacking) {
      // Attack is one-shot — always restart from the beginning.
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(0.2).play();
    } else {
      // Walk / Idle are continuous loops. Resume from current playback time
      // rather than resetting to frame 0, so a brief Idle→Walk flicker doesn't
      // snap the character's legs back to the start pose.
      //
      // Re-enable explicitly: Three.js auto-disables actions whose weight
      // reaches 0 after a fadeOut completes (_updateWeight sets enabled=false).
      // Without this, a Walk that was faded out for Attack stays disabled and
      // contributes zero weight no matter how many fadeIn/play calls follow.
      nextAction.enabled = true;
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(0.2).play();
    }

    currentActionRef.current = nextAction;
  }, [isWalking, isAttacking, isDying, attackVariant, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // After attack finishes, blend back to Walk or Idle.
  // Guard against isDying so the Death animation's 'finished' event never
  // triggers a fallback to Walk/Idle.
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
    // sceneGroupRef wraps the clone so the AnimationMixer can traverse into the
    // bone hierarchy. The scale group converts cm → game units.
    <group ref={sceneGroupRef}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
