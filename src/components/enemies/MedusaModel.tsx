'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip, VectorKeyframeTrack } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';

export type MedusaAbilityClip = 'CastLeft' | 'CastRight' | 'Special';

interface MedusaModelProps {
  abilityClip: MedusaAbilityClip | null;
  isDying: boolean;
}

const MEDUSA_IDLE_PATH = '/models/medusa/Azshara_idle.glb';

const MEDUSA_MODEL_PATHS = [
  MEDUSA_IDLE_PATH,
  '/models/medusa/Azshara_castLeft.glb',
  '/models/medusa/Azshara_castRight.glb',
  '/models/medusa/Azshara_special.glb',
];

const MEDUSA_DEFERRED_PATHS = {
  CastLeft: '/models/medusa/Azshara_castLeft.glb',
  CastRight: '/models/medusa/Azshara_castRight.glb',
  Special: '/models/medusa/Azshara_special.glb',
} as const;

export function preloadMedusaModels(): void {
  preloadSkinnedIdleAndAnimationClips(
    MEDUSA_IDLE_PATH,
    MEDUSA_MODEL_PATHS,
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

/** Zero root-motion XYZ so Medusa stays planted as a stationary caster. */
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

// WoW Azshara naga export — bind-pose Y spans ~19.06 units (feet ≈ -10.19, crown ≈ 8.87).
const TARGET_HEIGHT = 7.5;
const MEDUSA_BIND_HEIGHT = 19.06;
const SCALE = TARGET_HEIGHT / MEDUSA_BIND_HEIGHT;
// Lift bind-pose feet to ground — do not use bindWowAttachmentItems (its glow-shell pass
// treats all ImageofQueenAzshara_GeosetN as one weapon group and hides body/tent/head parts).
const MODEL_Y_OFFSET = 10.19 * SCALE;

export default React.memo(function MedusaModel({
  abilityClip,
  isDying,
}: MedusaModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(MEDUSA_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(MEDUSA_DEFERRED_PATHS);
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
        console.warn('Failed to load medusa animations:', error);
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
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Stand', 'Ready', 'Idle', 'Hover'),
    [idleAnims],
  );
  const castLeftSource = useMemo(
    () => pickWowClip(extraAnims.CastLeft ?? [], 'SpellCastDirected', 'SpellCast', 'Attack'),
    [extraAnims.CastLeft],
  );
  const castRightSource = useMemo(
    () => pickWowClip(extraAnims.CastRight ?? [], 'SpellCastOmni', 'SpellCast', 'Attack'),
    [extraAnims.CastRight],
  );
  // Prefer idle pack (available immediately) — CustomSpell02/03 match VOIDWARP ~4s.
  const specialSource = useMemo(
    () => {
      const fromIdle = pickWowClip(
        idleAnims,
        'CustomSpell02',
        'CustomSpell03',
        'CustomSpell01',
        'CustomSpell',
        'ChannelCastOmni',
        'ChannelCastDirected',
      );
      if (fromIdle.length > 0) return fromIdle;
      return pickWowClip(
        extraAnims.Special ?? [],
        'CustomSpell02',
        'CustomSpell03',
        'CustomSpell01',
        'CustomSpell',
        'ChannelCastOmni',
        'ChannelCastDirected',
      );
    },
    [idleAnims, extraAnims.Special],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('medusa-idle', idleSource, {
        renameTo: 'Idle',
      }).map(stripRootMotionXYZ),
      ...getCachedProcessedClips('medusa-cast-left', castLeftSource, {
        renameTo: 'CastLeft',
      }).map(stripRootMotionXYZ),
      ...getCachedProcessedClips('medusa-cast-right-omni', castRightSource, {
        renameTo: 'CastRight',
      }).map(stripRootMotionXYZ),
      ...getCachedProcessedClips('medusa-special-custom02', specialSource, {
        renameTo: 'Special',
      }).map(stripRootMotionXYZ),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    castLeftSource,
    castRightSource,
    specialSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);
  const getAction = (
    name: 'Idle' | MedusaAbilityClip,
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  useEffect(() => {
    if (!actions) return;
    const nextAction = abilityClip
      ? getAction(abilityClip)
      : getAction('Idle');
    if (abilityClip === 'Special') {
      // CustomSpell02 ~4.16s matches VOIDWARP — play once (renderer clears after durationMs).
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: true,
        fadeIn: 0.15,
        fadeOut: 0.15,
      });
    } else if (abilityClip) {
      playEnemyAction(nextAction, currentActionRef, mixer, {
        loopOnce: true,
        clampWhenFinished: false,
        fadeIn: 0.1,
        fadeOut: 0.15,
      });
    } else {
      playEnemyAction(nextAction, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
    }
  }, [actions, abilityClip, isDying, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer) return;
    const onFinished = (e: any) => {
      const clipName = e.action?.getClip().name;
      if ((clipName === 'CastLeft' || clipName === 'CastRight') && !isDying) {
        playEnemyAction(getAction('Idle'), currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
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
