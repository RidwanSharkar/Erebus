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

interface SpectreModelProps {
  isWalking: boolean;
  isAttacking: boolean;
  attackVariant: 1 | 2;
  isWhirlwinding: boolean;
  isDying: boolean;
}

const SPECTRE_IDLE_PATH = '/models/paladin_idle.glb';

const SPECTRE_MODEL_PATHS = [
  SPECTRE_IDLE_PATH,
  '/models/paladin_walk.glb',
  '/models/paladin_attack0.glb',
  '/models/paladin_attack1.glb',
  '/models/paladin_whirlwind.glb',
  '/models/paladin_death.glb',
];

const SPECTRE_DEFERRED_PATHS = {
  Walk: '/models/paladin_walk.glb',
  Attack: '/models/paladin_attack0.glb',
  Attack2: '/models/paladin_attack1.glb',
  Whirlwind: '/models/paladin_whirlwind.glb',
  Death: '/models/paladin_death.glb',
} as const;

export function preloadSpectreModels(): void {
  preloadSkinnedIdleAndAnimationClips(SPECTRE_IDLE_PATH, SPECTRE_MODEL_PATHS, useGLTF.preload);
}

// Paladin GLB is exported in meters (~2.43m tall), not Mixamo centimeters
// (Templar/Knight use ~0.012–0.016 for cm-scale assets).
const TARGET_HEIGHT = 2.75;
const PALADIN_BIND_HEIGHT = 2.43;
const SCALE = TARGET_HEIGHT / PALADIN_BIND_HEIGHT; // ~0.82

// Feet sit ~0.40m below origin in bind pose — lift so soles sit on the floor.
const MODEL_Y_OFFSET = 0.4 * SCALE;

/** Pick one WoW clip by name prefix; fall back to first clip if missing. */
function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

export default React.memo(function SpectreModel({
  isWalking,
  isAttacking,
  attackVariant,
  isWhirlwinding,
  isDying,
}: SpectreModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: idleAnims } = useGLTF(SPECTRE_IDLE_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(SPECTRE_DEFERRED_PATHS);
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
        console.warn('Failed to load spectre animations:', error);
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

  // Prefer Ready2H combat stance as idle; fall back to Stand if missing.
  const idleSource = useMemo(() => {
    const ready = idleAnims.find((c) => c.name.startsWith('Ready2H'));
    const stand = idleAnims.find((c) => c.name.startsWith('Stand'));
    return ready ? [ready] : stand ? [stand] : idleAnims.slice(0, 1);
  }, [idleAnims]);

  const walkSource = useMemo(
    () => pickWowClip(extraAnims.Walk ?? [], 'Walk', 'Run'),
    [extraAnims.Walk],
  );
  const attackSource = useMemo(
    () => pickWowClip(extraAnims.Attack ?? [], 'Attack', 'Special'),
    [extraAnims.Attack],
  );
  const attack2Source = useMemo(
    () => pickWowClip(extraAnims.Attack2 ?? [], 'Attack', 'Special'),
    [extraAnims.Attack2],
  );
  const whirlwindSource = useMemo(
    () => pickWowClip(extraAnims.Whirlwind ?? [], 'Attack', 'Special', 'Whirlwind'),
    [extraAnims.Whirlwind],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(
    () => {
      const clips = [
        ...getCachedProcessedClips('spectre-paladin-idle', idleSource, {
          stripRootMotion: true,
          renameTo: 'Idle',
        }),
        ...getCachedProcessedClips('spectre-paladin-walk', walkSource, {
          stripRootMotion: true,
          renameTo: 'Walk',
        }),
        ...getCachedProcessedClips('spectre-paladin-attack0', attackSource, { renameTo: 'Attack' }),
        ...getCachedProcessedClips('spectre-paladin-attack1', attack2Source, { renameTo: 'Attack2' }),
        ...getCachedProcessedClips('spectre-paladin-whirlwind', whirlwindSource, {
          stripRootMotion: true,
          renameTo: 'Whirlwind',
        }),
        ...getCachedProcessedClips('spectre-paladin-death', deathSource, { renameTo: 'Death' }),
      ];
      return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
    },
    [idleSource, walkSource, attackSource, attack2Source, whirlwindSource, deathSource, clonedScene],
  );

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Walk' | 'Attack' | 'Attack2' | 'Whirlwind' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  // Ready2H source is renamed to 'Idle' during clip processing.
  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Priority: Death > Whirlwind > Attack > Walk > Idle
  useEffect(() => {
    if (!actions) return;

    const attackClip = attackVariant === 2 ? 'Attack2' : 'Attack';
    const nextAction = isDying
      ? getAction('Death')
      : isWhirlwinding
        ? getAction('Whirlwind')
        : isAttacking
          ? getAction(attackClip)
          : isWalking
            ? getAction('Walk')
            : getAction('Idle');

    if (!nextAction) return;

    playEnemyAction(nextAction, currentActionRef, mixer, {
      loopOnce: isDying || isAttacking,
      clampWhenFinished: isDying || isAttacking,
    });
  }, [isWalking, isAttacking, isWhirlwinding, isDying, attackVariant, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (e: { action: AnimationAction }) => {
      if (isDying) return;
      const name = e.action.getClip().name;
      if (name === 'Death' || name === 'Whirlwind') return;
      if (name === 'Attack' || name === 'Attack2') {
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      {/* WoW paladin faces +X; game yaw (atan2 dx,dz) assumes +Z forward. */}
      <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
