'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { hideStrayGlowShellMeshes } from '@/utils/hideStrayGlowShellMeshes';

interface BoneSpiderModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isCasting?: boolean;
  isDying: boolean;
  scaleMultiplier?: number;
}

const BONE_SPIDER_IDLE_PATH = '/models/spider/BoneSpider_idle.glb';

const BONE_SPIDER_MODEL_PATHS = [
  BONE_SPIDER_IDLE_PATH,
  '/models/spider/BoneSpider_walk.glb',
  '/models/spider/BoneSpider_attack1.glb',
  '/models/spider/BoneSpider_attack2.glb',
  '/models/spider/BoneSpider_cast.glb',
  '/models/spider/BoneSpider_death.glb',
];

const BONE_SPIDER_DEFERRED_PATHS = {
  Walk: '/models/spider/BoneSpider_walk.glb',
  Attack: '/models/spider/BoneSpider_attack1.glb',
  Attack2: '/models/spider/BoneSpider_attack2.glb',
  Cast: '/models/spider/BoneSpider_cast.glb',
  Death: '/models/spider/BoneSpider_death.glb',
} as const;

export function preloadBoneSpiderModels(): void {
  preloadSkinnedIdleAndAnimationClips(BONE_SPIDER_IDLE_PATH, BONE_SPIDER_MODEL_PATHS, useGLTF.preload);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

/** Large spider — target ~4.2m tall */
const TARGET_HEIGHT = 4.2;
const BONE_SPIDER_BIND_HEIGHT = 2.5;
const SCALE = TARGET_HEIGHT / BONE_SPIDER_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.02 * SCALE;

export default React.memo(function BoneSpiderModel({
  isWalking,
  isAttacking,
  attackVariant,
  isCasting = false,
  isDying,
  scaleMultiplier = 1,
}: BoneSpiderModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(BONE_SPIDER_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(BONE_SPIDER_DEFERRED_PATHS);
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
        console.warn('Failed to load bone spider animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = cloneEnemySceneWithSharedMaterials(scene, BONE_SPIDER_IDLE_PATH, {
      selfIlluminationIntensity: null,
      castShadow: false,
      receiveShadow: false,
    });
    hideStrayGlowShellMeshes(clone);
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const idleSource = useMemo(
    () => pickWowClip(idleAnims, 'Stand', 'Idle', 'Stand '),
    [idleAnims],
  );
  const walkSource = useMemo(
    () => pickWowClip(extraAnims.Walk ?? [], 'Walk', 'Run'),
    [extraAnims.Walk],
  );
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attack ?? [], 'Attack', 'Combat'),
    [extraAnims.Attack],
  );
  const attack2Source = useMemo(
    () => pickWowClip(extraAnims.Attack2 ?? [], 'Attack', 'Combat'),
    [extraAnims.Attack2],
  );
  const castSource = useMemo(
    () => pickWowClip(extraAnims.Cast ?? [], 'Spell', 'Cast', 'Combat'),
    [extraAnims.Cast],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('bone-spider-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('bone-spider-walk', walkSource, {
        stripRootMotion: true,
        renameTo: 'Walk',
      }),
      ...getCachedProcessedClips('bone-spider-attack1', attackSource, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('bone-spider-attack2', attack2Source, { renameTo: 'Attack2' }),
      ...getCachedProcessedClips('bone-spider-cast', castSource, {
        stripRootMotion: true,
        renameTo: 'Cast',
      }),
      ...getCachedProcessedClips('bone-spider-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    walkSource,
    attackSource,
    attack2Source,
    castSource,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Walk' | 'Attack' | 'Attack2' | 'Cast' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Cast > Attack > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isCasting
        ? getAction('Cast')
        : isAttacking
          ? getAction(attackClip)
          : isWalking
            ? getAction('Walk')
            : getAction('Idle');

    if (!nextAction) return;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isCasting || isAttacking,
      clampWhenFinished: isDying || isCasting || isAttacking,
      fadeIn: isDying || isCasting || isAttacking ? 0.15 : 0.2,
    });
  }, [isWalking, isAttacking, attackVariant, isCasting, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death' || name === 'Cast') return;
      if (name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, isCasting, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  const finalScale = SCALE * scaleMultiplier;

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group
        scale={[finalScale, finalScale, finalScale]}
        position={[0, MODEL_Y_OFFSET, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
