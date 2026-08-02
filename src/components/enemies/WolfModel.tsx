'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { hideStrayGlowShellMeshes } from '@/utils/hideStrayGlowShellMeshes';

interface WolfModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isDying: boolean;
  isHowling?: boolean;
  scaleMultiplier?: number;
}

const WOLF_IDLE_PATH = '/models/wolf/wolf_idle.glb';

const WOLF_MODEL_PATHS = [
  WOLF_IDLE_PATH,
  '/models/wolf/wolf_run.glb',
  '/models/wolf/wolf_attack1.glb',
  '/models/wolf/wolf_attack2.glb',
  '/models/wolf/wolf_howl.glb',
  '/models/wolf/wolf_death.glb',
];

const WOLF_DEFERRED_PATHS = {
  Run: '/models/wolf/wolf_run.glb',
  Attack: '/models/wolf/wolf_attack1.glb',
  Attack2: '/models/wolf/wolf_attack2.glb',
  Howl: '/models/wolf/wolf_howl.glb',
  Death: '/models/wolf/wolf_death.glb',
} as const;

export function preloadWolfModels(): void {
  preloadSkinnedIdleAndAnimationClips(WOLF_IDLE_PATH, WOLF_MODEL_PATHS, useGLTF.preload);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

const TARGET_HEIGHT = 1.5;
const WOLF_BIND_HEIGHT = 2.0;
const SCALE = TARGET_HEIGHT / WOLF_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.02 * SCALE;

export default React.memo(function WolfModel({
  isWalking,
  isAttacking,
  attackVariant,
  isDying,
  isHowling = false,
  scaleMultiplier = 1,
}: WolfModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(WOLF_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(WOLF_DEFERRED_PATHS);
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
        console.warn('Failed to load wolf animations:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
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
  const howlSource = useMemo(
    () => pickWowClip(extraAnims.Howl ?? [], 'Howl', 'Special', 'Emote'),
    [extraAnims.Howl],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('wolf-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('wolf-run', runSource, {
        stripRootMotion: true,
        renameTo: 'Run',
      }),
      ...getCachedProcessedClips('wolf-attack1', attackSource, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('wolf-attack2', attack2Source, { renameTo: 'Attack2' }),
      ...getCachedProcessedClips('wolf-howl', howlSource, {
        stripRootMotion: true,
        renameTo: 'Howl',
      }),
      ...getCachedProcessedClips('wolf-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    runSource,
    attackSource,
    attack2Source,
    howlSource,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Run' | 'Attack' | 'Attack2' | 'Howl' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Howl > Attack > Run > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isHowling
        ? getAction('Howl')
        : isAttacking
          ? getAction(attackClip)
          : isWalking
            ? getAction('Run')
            : getAction('Idle');

    if (!nextAction) return;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isHowling || isAttacking,
      clampWhenFinished: isDying || isHowling || isAttacking,
      fadeIn: isDying || isHowling || isAttacking ? 0.15 : 0.2,
    });
  }, [isWalking, isAttacking, attackVariant, isDying, isHowling, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death' || name === 'Howl') return;
      if (name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking ? getAction('Run') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, isHowling, actions]); // eslint-disable-line react-hooks/exhaustive-deps

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
