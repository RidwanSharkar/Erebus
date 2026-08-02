'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { bindWowAttachmentItems } from '@/utils/bindWowAttachmentItems';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';

export type FrostQueenAbilityClip = 'RiseCast' | 'Cast' | 'Channel';

interface FrostQueenModelProps {
  abilityClip: FrostQueenAbilityClip | null;
  isDying: boolean;
}

const FROST_QUEEN_IDLE_PATH = '/models/frost/frostqueen_idle.glb';

const FROST_QUEEN_MODEL_PATHS = [
  FROST_QUEEN_IDLE_PATH,
  '/models/frost/frostqueen_riseCast.glb',
  '/models/frost/frostqueen_cast.glb',
  '/models/frost/frostqueen_channel.glb',
];

const FROST_QUEEN_DEFERRED_PATHS = {
  RiseCast: '/models/frost/frostqueen_riseCast.glb',
  Cast: '/models/frost/frostqueen_cast.glb',
  Channel: '/models/frost/frostqueen_channel.glb',
} as const;

export function preloadFrostQueenModels(): void {
  preloadSkinnedIdleAndAnimationClips(
    FROST_QUEEN_IDLE_PATH,
    FROST_QUEEN_MODEL_PATHS,
    useGLTF.preload,
  );
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

/** Zero root-motion XYZ so FrostQueen stays planted as a stationary caster. */
function stripRootMotionXYZ(clip: AnimationClip): AnimationClip {
  const result = clip.clone();
  result.tracks = result.tracks.map((track) => {
    if (!track.name.endsWith('.position')) return track;
    const lower = track.name.toLowerCase();
    if (!lower.includes('hips') && !lower.includes('bone_root') && !lower.includes('bone_main')) return track;
    const values = Float32Array.from(track.values);
    for (let i = 0; i < values.length; i += 3) {
      values[i] = 0;
      values[i + 1] = 0;
      values[i + 2] = 0;
    }
    return new VectorKeyframeTrack(track.name, Array.from(track.times), Array.from(values));
  });
  return result;
}

// WoW felelfcasterfemaleskinblack GLB — meter-scale bind (~2.1m feet→crown).
const TARGET_HEIGHT = 2.25 * 1.25;
const FROST_QUEEN_BIND_HEIGHT = 2.1;
const SCALE = TARGET_HEIGHT / FROST_QUEEN_BIND_HEIGHT;
// Bind-pose toes sit near Y=0 — no lift needed for ground placement.
const MODEL_Y_OFFSET = 0;

export default React.memo(function FrostQueenModel({
  abilityClip,
  isDying,
}: FrostQueenModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(FROST_QUEEN_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(FROST_QUEEN_DEFERRED_PATHS);
    void Promise.all(
      entries.map(async ([name, path]) => {
        const clips = await loadGltfAnimationClips(path);
        return [name, clips] as const;
      }),
    )
      .then((loaded) => {
        if (cancelled) return;
        setExtraAnims(Object.fromEntries(loaded));
      })
      .catch((error) => {
        console.warn('Failed to load frost queen animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = false;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    bindWowAttachmentItems(clone);
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Stand', 'ReadySpellOmni', 'Ready'),
    [idleAnims],
  );
  const riseCastSource = useMemo(
    () => pickWowClip(extraAnims.RiseCast ?? [], 'SpellCastDirected', 'SpellCastOmni', 'Special2H'),
    [extraAnims.RiseCast],
  );
  const castSource = useMemo(
    () => pickWowClip(extraAnims.Cast ?? [], 'SpellCastOmni', 'SpellCastDirected', 'Special2H'),
    [extraAnims.Cast],
  );
  const channelSource = useMemo(
    () => pickWowClip(extraAnims.Channel ?? [], 'ChannelCastOmni', 'ChannelCastDirected', 'SpellKneelLoop'),
    [extraAnims.Channel],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('frost-queen-idle', idleSource, {
        renameTo: 'Idle',
      }).map(stripRootMotionXYZ),
      ...getCachedProcessedClips('frost-queen-rise-cast', riseCastSource, {
        renameTo: 'RiseCast',
      }).map(stripRootMotionXYZ),
      ...getCachedProcessedClips('frost-queen-cast', castSource, {
        renameTo: 'Cast',
      }).map(stripRootMotionXYZ),
      ...getCachedProcessedClips('frost-queen-channel', channelSource, {
        renameTo: 'Channel',
      }).map(stripRootMotionXYZ),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    riseCastSource,
    castSource,
    channelSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);
  const getAction = (
    name: 'Idle' | FrostQueenAbilityClip,
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  useEffect(() => {
    if (!actions) return;
    // Death is handled by renderer fade — keep playing idle/ability while fading.
    const nextAction = abilityClip
      ? getAction(abilityClip)
      : getAction('Idle');
    if (abilityClip === 'Channel') {
      // Hold channel clip for up to 5s (loop until clip cleared)
      playEnemyAction(nextAction, currentActionRef, mixer, { fadeIn: 0.2, fadeOut: 0.2 });
    } else if (abilityClip) {
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: false,
        fadeIn: 0.2,
        fadeOut: 0.2,
      });
    } else {
      playEnemyAction(nextAction, currentActionRef, mixer, { fadeIn: 0.2, fadeOut: 0.2 });
    }
  }, [actions, isDying, abilityClip, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      const clipName = e.action?.getClip().name;
      if ((clipName === 'RiseCast' || clipName === 'Cast') && !isDying) {
        playEnemyAction(getAction('Idle'), currentActionRef, mixer, { fadeIn: 0.2, fadeOut: 0.2 });
      }
    };
    mixer.addEventListener('finished', onFinished);
    return () => mixer.removeEventListener('finished', onFinished);
  }, [mixer, isDying, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
