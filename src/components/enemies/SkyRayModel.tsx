'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';

interface SkyRayModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  isDying: boolean;
}

const SKYRAY_SWIM_PATH = '/models/SkyRay_swim.glb';

const SKYRAY_MODEL_PATHS = [
  SKYRAY_SWIM_PATH,
  '/models/SkyRay_attack.glb',
  '/models/SkyRay_death.glb',
];

const SKYRAY_DEFERRED_PATHS = {
  Attack: '/models/SkyRay_attack.glb',
  Death: '/models/SkyRay_death.glb',
} as const;

export function preloadSkyRayModels(): void {
  preloadSkinnedIdleAndAnimationClips(SKYRAY_SWIM_PATH, SKYRAY_MODEL_PATHS, useGLTF.preload);
}

const TARGET_HEIGHT = 2.2;
const SKYRAY_BIND_HEIGHT = 2.0;
const SCALE = TARGET_HEIGHT / SKYRAY_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.35 * SCALE;

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

export default React.memo(function SkyRayModel({
  isWalking,
  isAttacking,
  isDying,
}: SkyRayModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: swimAnims } = useGLTF(SKYRAY_SWIM_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(SKYRAY_DEFERRED_PATHS);
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
        console.warn('Failed to load skyray animations:', error);
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
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const swimIdleSource = useMemo(
    () =>
      pickWowClip(
        swimAnims,
        'SwimIdle (ID 41 variation 0)',
        'SwimIdle',
        'Stand (ID 0 variation 0)',
        'Stand',
      ),
    [swimAnims],
  );
  const swimSource = useMemo(
    () =>
      pickWowClip(
        swimAnims,
        // Exact names first — bare 'Swim' matches SwimBackwards / SwimIdle before Swim (ID 42).
        'Swim (ID 42 variation 0)',
        'Fly (ID 135 variation 0)',
        'FlyRun (ID 234 variation 0)',
      ),
    [swimAnims],
  );
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attack ?? [], 'Attack', 'AttackUnarmed', 'Spell'),
    [extraAnims.Attack],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('skyray-swim-idle', swimIdleSource, {
        stripRootMotion: true,
        renameTo: 'SwimIdle',
      }),
      ...getCachedProcessedClips('skyray-swim', swimSource, {
        stripRootMotion: true,
        renameTo: 'Swim',
      }),
      ...getCachedProcessedClips('skyray-attack', attackSource, { renameTo: 'Attack' }),
      ...getCachedProcessedClips('skyray-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [swimIdleSource, swimSource, attackSource, deathSource, clonedScene]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (
    name: 'SwimIdle' | 'Swim' | 'Attack' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({
    actions,
    mixer,
    currentActionRef,
    idleClipName: 'SwimIdle',
  });

  // Priority: Death > Attack > Swim (moving) > SwimIdle (stationary)
  useEffect(() => {
    if (!actions) return;

    const nextAction = isDying
      ? getAction('Death')
      : isAttacking
        ? getAction('Attack')
        : isWalking
          ? getAction('Swim')
          : getAction('SwimIdle');

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: !!(isDying || isAttacking),
      clampWhenFinished: !!(isDying || isAttacking),
      fadeIn: isDying || isAttacking ? 0.15 : 0.2,
      fadeOut: isDying || isAttacking ? 0.15 : 0.2,
    });
  }, [isWalking, isAttacking, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const blendToSwimOrIdle = () => {
      if (isDying) return;
      const fallback = isWalking ? getAction('Swim') : getAction('SwimIdle');
      playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
    };

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death') return;
      if (name === 'Attack') {
        blendToSwimOrIdle();
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group
        scale={[SCALE, SCALE, SCALE]}
        position={[0, MODEL_Y_OFFSET, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
