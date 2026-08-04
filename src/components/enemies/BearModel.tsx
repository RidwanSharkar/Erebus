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

interface BearModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
  scaleMultiplier?: number;
}

const BEAR_IDLE_PATH = '/models/bear/ursoc_idle.glb';

const BEAR_MODEL_PATHS = [
  BEAR_IDLE_PATH,
  '/models/bear/ursoc_run.glb',
  '/models/bear/ursoc_attack.glb',
  '/models/bear/ursoc_attack2.glb',
  '/models/bear/ursoc_death.glb',
];

const BEAR_DEFERRED_PATHS = {
  Run: '/models/bear/ursoc_run.glb',
  Attack: '/models/bear/ursoc_attack.glb',
  Attack2: '/models/bear/ursoc_attack2.glb',
  Death: '/models/bear/ursoc_death.glb',
} as const;

export function preloadBearModels(): void {
  preloadSkinnedIdleAndAnimationClips(BEAR_IDLE_PATH, BEAR_MODEL_PATHS, useGLTF.preload);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

const TARGET_HEIGHT = 2.0;
const BEAR_BIND_HEIGHT = 2.4;
const SCALE = TARGET_HEIGHT / BEAR_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.02 * SCALE;

export default React.memo(function BearModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
  scaleMultiplier = 1,
}: BearModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(BEAR_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(BEAR_DEFERRED_PATHS);
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
        console.warn('Failed to load bear animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = cloneEnemySceneWithSharedMaterials(scene, BEAR_IDLE_PATH, {
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
  const runSource = useMemo(
    () => pickWowClip(extraAnims.Run ?? [], 'Run', 'Walk', 'Sprint'),
    [extraAnims.Run],
  );
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attack ?? [], 'Attack', 'Combat'),
    [extraAnims.Attack],
  );
  const attack2Source = useMemo(
    () => pickWowClip(extraAnims.Attack2 ?? [], 'Attack', 'Combat'),
    [extraAnims.Attack2],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('bear-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('bear-run', runSource, {
        stripRootMotion: true,
        renameTo: 'Run',
      }),
      ...getCachedProcessedClips('bear-attack1', attackSource, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('bear-attack2', attack2Source, { renameTo: 'Attack2' }),
      ...getCachedProcessedClips('bear-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    runSource,
    attackSource,
    attack2Source,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Run' | 'Attack' | 'Attack2' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Attack > Run > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction(attackClip)
        : isWalking
          ? getAction('Run')
          : getAction('Idle');

    if (!nextAction) return;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isAttacking,
      clampWhenFinished: isDying || isAttacking,
      fadeIn: isDying || isAttacking ? 0.15 : 0.2,
    });
  }, [isWalking, isAttacking, attackVariant, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking ? getAction('Run') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

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
