'use client';

import React, { useRef, useEffect, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, LoopRepeat, LoopOnce, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

export type AnimState =
  | 'Idle' | 'Run' | 'Walk' | 'WalkBack' | 'WalkLeft' | 'WalkRight' | 'Backwards'
  | 'LeftStrafe' | 'RightStrafe'
  | 'Jump' | 'JumpFront' | 'JumpBack'
  | 'Cast' | 'CastSingle' | 'SwordCast' | 'DrawBow' | 'ReleaseBow'
  | 'Death';

interface CharacterModelProps {
  animState: AnimState;
  isDead?: boolean;
}

const CHARACTER_MODEL_PATHS = [
  '/models/character_idle.glb',
  '/models/character_run.glb',
  '/models/character_walk.glb',
  '/models/character_walkBack.glb',
  '/models/character_walkLeft.glb',
  '/models/character_walkRight.glb',
  '/models/character_backwards.glb',
  '/models/character_leftStrafe.glb',
  '/models/character_rightStrafe.glb',
  '/models/character_jump.glb',
  '/models/character_jumpFront.glb',
  '/models/character_jumpBack.glb',
  '/models/character_cast.glb',
  '/models/character_castSingle.glb',
  '/models/character_swordCast.glb',
  '/models/character_drawBow.glb',
  '/models/character_releaseBow.glb',
  '/models/character_death.glb',
];

export function preloadCharacterModels(): void {
  CHARACTER_MODEL_PATHS.forEach(path => useGLTF.preload(path));
}

// Adjust if the character GLB geometry is larger or smaller than expected.
// Standard Mixamo / Character Creator exports at ~200 units tall (cm) → 0.01 gives ~2 world units.
const SCALE = 0.01;

// Fine-tune vertical placement so the character's feet sit flush with the ground.
// Increase (less negative) to raise, decrease (more negative) to lower.
const Y_OFFSET = -0.25;

// Crossfade durations per transition type (seconds).
const FADE_NORMAL = 0.2;
const FADE_JUMP   = 0.15;

export default function CharacterModel({ animState, isDead = false }: CharacterModelProps) {
  const sceneGroupRef   = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);

  const { scene, animations: idleAnims }        = useGLTF('/models/character_idle.glb');
  const { animations: runAnims }                = useGLTF('/models/character_run.glb');
  const { animations: walkAnims }               = useGLTF('/models/character_walk.glb');
  const { animations: walkBackAnims }          = useGLTF('/models/character_walkBack.glb');
  const { animations: walkLeftAnims }         = useGLTF('/models/character_walkLeft.glb');
  const { animations: walkRightAnims }        = useGLTF('/models/character_walkRight.glb');
  const { animations: backAnims }               = useGLTF('/models/character_backwards.glb');
  const { animations: leftAnims }  = useGLTF('/models/character_leftStrafe.glb');
  const { animations: rightAnims } = useGLTF('/models/character_rightStrafe.glb');
  const { animations: jumpAnims }               = useGLTF('/models/character_jump.glb');
  const { animations: jumpFrontAnims }          = useGLTF('/models/character_jumpFront.glb');
  const { animations: jumpBackAnims }           = useGLTF('/models/character_jumpBack.glb');
  const { animations: castAnims }               = useGLTF('/models/character_cast.glb');
  const { animations: castSingleAnims }         = useGLTF('/models/character_castSingle.glb');
  const { animations: swordCastAnims }          = useGLTF('/models/character_swordCast.glb');
  const { animations: drawBowAnims }            = useGLTF('/models/character_drawBow.glb');
  const { animations: releaseBowAnims }         = useGLTF('/models/character_releaseBow.glb');
  const { animations: deathAnims }              = useGLTF('/models/character_death.glb');

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
      ...rename(idleAnims,           'Idle'          ).map(stripRootMotionXZ),
      ...rename(runAnims,            'Run'           ).map(stripRootMotionXZ),
      ...rename(walkAnims,           'Walk'          ).map(stripRootMotionXZ),
      ...rename(walkBackAnims,       'WalkBack'      ).map(stripRootMotionXZ),
      ...rename(walkLeftAnims,       'WalkLeft'      ).map(stripRootMotionXZ),
      ...rename(walkRightAnims,      'WalkRight'     ).map(stripRootMotionXZ),
      ...rename(backAnims,           'Backwards'     ).map(stripRootMotionXZ),
      ...rename(leftAnims,  'LeftStrafe' ).map(stripRootMotionXZ),
      ...rename(rightAnims, 'RightStrafe').map(stripRootMotionXZ),
      ...rename(jumpAnims,           'Jump'          ).map(stripRootMotionXZ),
      ...rename(jumpFrontAnims,      'JumpFront'     ).map(stripRootMotionXZ),
      ...rename(jumpBackAnims,       'JumpBack'      ).map(stripRootMotionXZ),
      ...rename(castAnims,           'Cast'          ).map(stripRootMotionXZ),
      ...rename(castSingleAnims,     'CastSingle'    ).map(stripRootMotionXZ),
      ...rename(swordCastAnims,      'SwordCast'     ).map(stripRootMotionXZ),
      ...rename(drawBowAnims,        'DrawBow'       ).map(stripRootMotionXZ),
      ...rename(releaseBowAnims,     'ReleaseBow'    ).map(stripRootMotionXZ),
      ...rename(deathAnims,          'Death'         ).map(stripRootMotionXZ),
    ];
  }, [idleAnims, runAnims, walkAnims, walkBackAnims, walkLeftAnims, walkRightAnims, backAnims, leftAnims, rightAnims, jumpAnims, jumpFrontAnims, jumpBackAnims, castAnims, castSingleAnims, swordCastAnims, drawBowAnims, releaseBowAnims, deathAnims]);

  const { actions } = useAnimations(animations, sceneGroupRef);

  // When the player dies, force the Death animation immediately and ignore
  // subsequent animState changes so nothing overrides the death pose.
  const deathTriggeredRef = useRef(false);

  useEffect(() => {
    if (!actions) return;

    if (isDead && !deathTriggeredRef.current) {
      deathTriggeredRef.current = true;
      const deathAction = actions['Death'] ?? null;
      if (deathAction) {
        currentActionRef.current?.fadeOut(FADE_NORMAL);
        deathAction.enabled = true;
        deathAction.setLoop(LoopOnce, 1);
        deathAction.clampWhenFinished = true;
        deathAction.reset().fadeIn(FADE_NORMAL).play();
        currentActionRef.current = deathAction;
      }
      return;
    }

    // Block any animation changes once death has been triggered.
    if (deathTriggeredRef.current) return;

    const nextAction = actions[animState] ?? null;
    if (!nextAction || nextAction === currentActionRef.current) return;

    const fadeOut = animState === 'Jump' ? FADE_JUMP : FADE_NORMAL;
    const fadeIn  = fadeOut;

    currentActionRef.current?.fadeOut(fadeOut);
    nextAction.enabled = true;

    if (animState === 'Jump' || animState === 'JumpFront' || animState === 'JumpBack' || animState === 'ReleaseBow') {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = false;
      nextAction.reset().fadeIn(fadeIn).play();
    } else if (animState === 'CastSingle') {
      nextAction.setLoop(LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      nextAction.reset().fadeIn(fadeIn).play();
    } else if (animState === 'Cast' || animState === 'SwordCast' || animState === 'DrawBow') {
      // Always restart so the cast clip plays from the beginning on each new hold.
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.reset().fadeIn(fadeIn).play();
    } else {
      nextAction.setLoop(LoopRepeat, Infinity);
      nextAction.fadeIn(fadeIn).play();
    }

    currentActionRef.current = nextAction;
  }, [animState, isDead, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset death flag when the component is re-mounted (e.g. after respawn).
  useEffect(() => {
    deathTriggeredRef.current = false;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} position-y={Y_OFFSET}>
      <group scale={[SCALE, SCALE, SCALE]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
}
