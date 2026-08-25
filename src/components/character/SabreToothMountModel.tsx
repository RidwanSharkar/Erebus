'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { Group, AnimationAction, AnimationClip } from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import { applySelfIllumination, UNIT_SELF_ILLUMINATION_INTENSITY, useDisposeClonedMaterials, useCleanupAnimationMixer } from '@/utils/disposeObject3D';
import { cloneEnemySceneWithSharedMaterials } from '@/utils/sharedEnemyMaterials';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';
import { hideStrayGlowShellMeshes } from '@/utils/hideStrayGlowShellMeshes';

export type SabreToothMountLocomotion = 'idle' | 'run' | 'walkBack';

interface SabreToothMountModelProps {
  locomotion: SabreToothMountLocomotion;
}

const SABRE_IDLE_PATH = '/models/tiger/sabreTooth_idle.glb';
const SABRE_RUN_PATH = '/models/tiger/sabreTooth_run.glb';
const SABRE_WALK_BACK_PATH = '/models/tiger/sabreTooth_walkBack.glb';

const SABRE_MODEL_PATHS = [SABRE_IDLE_PATH, SABRE_RUN_PATH, SABRE_WALK_BACK_PATH];

export function preloadSabreToothMountModels(): void {
  preloadSkinnedIdleAndAnimationClips(SABRE_IDLE_PATH, SABRE_MODEL_PATHS, useGLTF.preload);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

/** Sabretooth mount under Mixamo rider (~2 wu). Slightly larger than companion tiger. */
const TARGET_HEIGHT = 2.35 * 1.15;
const BIND_HEIGHT = 2.952;
const SCALE = TARGET_HEIGHT / BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.02 * SCALE;

export default React.memo(function SabreToothMountModel({ locomotion }: SabreToothMountModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [runAnims, setRunAnims] = useState<AnimationClip[]>([]);
  const [walkBackAnims, setWalkBackAnims] = useState<AnimationClip[]>([]);

  const { scene, animations: idleAnims } = useGLTF(SABRE_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    void loadGltfAnimationClips(SABRE_RUN_PATH)
      .then((clips) => {
        if (!cancelled) setRunAnims(clips);
      })
      .catch((error) => {
        console.warn('Failed to load sabretooth mount run animation:', error);
      });
    void loadGltfAnimationClips(SABRE_WALK_BACK_PATH)
      .then((clips) => {
        if (!cancelled) setWalkBackAnims(clips);
      })
      .catch((error) => {
        console.warn('Failed to load sabretooth mount walk-back animation:', error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const clonedScene = useMemo(() => {
    const clone = cloneEnemySceneWithSharedMaterials(scene, SABRE_IDLE_PATH, {
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
    () => pickWowClip(idleAnims, 'Stand', 'Stand '),
    [idleAnims],
  );
  const runSource = useMemo(
    () => pickWowClip(runAnims, 'Run', 'Sprint', 'Walk'),
    [runAnims],
  );
  // Prefer Walkbackwards — never match prefix "Walk" first (that binds forward Walk).
  const walkBackSource = useMemo(
    () => pickWowClip(walkBackAnims, 'Walkbackwards', 'WalkBackwards'),
    [walkBackAnims],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('sabre-mount-idle', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('sabre-mount-run', runSource, {
        stripRootMotion: true,
        renameTo: 'Run',
      }),
      ...getCachedProcessedClips('sabre-mount-walkback', walkBackSource, {
        stripRootMotion: true,
        renameTo: 'WalkBack',
      }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [idleSource, runSource, walkBackSource, clonedScene]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  useCleanupAnimationMixer(mixer, sceneGroupRef);

  const getAction = (name: 'Idle' | 'Run' | 'WalkBack'): AnimationAction | null =>
    actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  useEffect(() => {
    if (!actions) return;
    const nextAction =
      locomotion === 'run'
        ? getAction('Run')
        : locomotion === 'walkBack'
          ? getAction('WalkBack')
          : getAction('Idle');
    if (!nextAction) return;
    playEnemyAction(nextAction, currentActionRef, mixer, {
      fadeIn: 0.2,
    });
  }, [locomotion, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

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
