'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { bindWowAttachmentItems } from '@/utils/bindWowAttachmentItems';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';

interface ShamanModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isStormShocking: boolean;
  isDying: boolean;
}

const SHAMAN_IDLE_PATH = '/models/shaman/shaman_idle.glb';

const SHAMAN_MODEL_PATHS = [
  SHAMAN_IDLE_PATH,
  '/models/shaman/shaman_walk.glb',
  '/models/shaman/shaman_rightSwing.glb',
  '/models/shaman/shaman_cast.glb',
  '/models/shaman/shaman_death.glb',
];

const SHAMAN_DEFERRED_PATHS = {
  Walk: '/models/shaman/shaman_walk.glb',
  Attack: '/models/shaman/shaman_rightSwing.glb',
  Cast: '/models/shaman/shaman_cast.glb',
  Death: '/models/shaman/shaman_death.glb',
} as const;

export function preloadShamanModels(): void {
  preloadSkinnedIdleAndAnimationClips(SHAMAN_IDLE_PATH, SHAMAN_MODEL_PATHS, useGLTF.preload);
}

/** Pick one WoW clip by name prefix; fall back to first clip if missing. */
function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

// WoW shaman GLB is exported in meters (~2.43m tall), same as Spectre/Death Knight.
const TARGET_HEIGHT = 2.75;
const SHAMAN_BIND_HEIGHT = 2.43;
const SCALE = TARGET_HEIGHT / SHAMAN_BIND_HEIGHT; // ~1.13

// Feet sit ~0.40m below origin in bind pose — lift so soles sit on the floor.
const MODEL_Y_OFFSET = 0.4 * SCALE;

export default React.memo(function ShamanModel({
  isWalking,
  isAttacking,
  isStormShocking,
  isDying,
}: ShamanModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(SHAMAN_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(SHAMAN_DEFERRED_PATHS);
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
        console.warn('Failed to load shaman animations:', error);
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
        child.receiveShadow = true;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    // WoW exports leave weapons/pauldrons/helm on the root; reparent to bones.
    bindWowAttachmentItems(clone);
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Ready2H', 'Stand', 'Ready'),
    [idleAnims],
  );
  const walkSource = useMemo(
    () => pickWowClip(extraAnims.Walk ?? [], 'Walk', 'Run'),
    [extraAnims.Walk],
  );
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attack ?? [], 'Attack', 'Special', 'Swing'),
    [extraAnims.Attack],
  );
  const castSource = useMemo(
    () => pickWowClip(extraAnims.Cast ?? [], 'Spell', 'Cast', 'Attack', 'Special'),
    [extraAnims.Cast],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(
    () => {
      const clips = [
        ...getCachedProcessedClips('shaman-idle', idleSource, {
          stripRootMotion: true,
          renameTo: 'Idle',
        }),
        ...getCachedProcessedClips('shaman-walk', walkSource, {
          stripRootMotion: true,
          renameTo: 'Walk',
        }),
        ...getCachedProcessedClips('shaman-rightSwing', attackSource, { renameTo: 'Attack' }),
        ...getCachedProcessedClips('shaman-cast', castSource, { renameTo: 'Cast' }),
        ...getCachedProcessedClips('shaman-death', deathSource, { renameTo: 'Death' }),
      ];
      return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
    },
    [idleSource, walkSource, attackSource, castSource, deathSource, clonedScene],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Walk' | 'Attack' | 'Cast' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Cast (Storm Shock) > Attack > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isStormShocking
        ? getAction('Cast')
        : isAttacking
          ? getAction('Attack')
          : isWalking
            ? getAction('Walk')
            : getAction('Idle');

    if (!nextAction) return;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isAttacking || isStormShocking,
      clampWhenFinished: isDying || isAttacking || isStormShocking,
    });
  }, [isWalking, isAttacking, isStormShocking, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Attack' || name === 'Cast') {
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      {/* WoW shaman faces +X; game yaw (atan2 dx,dz) assumes +Z forward. */}
      <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
