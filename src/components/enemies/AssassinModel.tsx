'use client';

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import {
  Group,
  AnimationAction,
  AnimationClip,
  Material,
  Mesh,
  Object3D,
} from 'three';
import { playEnemyAction, useEnemyIdlePose } from '@/hooks/useEnemyIdlePose';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { bindWowAttachmentItems } from '@/utils/bindWowAttachmentItems';
import {
  applySelfIllumination,
  applyWeaponItemGlow,
  UNIT_SELF_ILLUMINATION_INTENSITY,
  useDisposeClonedMaterials,
} from '@/utils/disposeObject3D';
import { loadGltfAnimationClips, preloadSkinnedIdleAndAnimationClips } from '@/utils/gltfAnimationLoader';
import { filterAnimationTracksForRoot, getCachedProcessedClips } from '@/utils/enemyAnimationClipCache';

export type AssassinAbilityClip = 'Spin' | 'Backflip';

interface AssassinModelProps {
  isWalking: boolean;
  /** Increments on every bow telegraph — restarts DrawBow → ReleaseBow. */
  attackKey: number;
  abilityClip: AssassinAbilityClip | null;
  abilityPlayKey?: number;
  isDying: boolean;
}

const ASSASSIN_BASE_PATH = '/models/assassin/buchess_walk.glb';
/** 1H sabre — textured material donor for embedded WoW weapon shells. */
const ASSASSIN_WEAPON_MAT_PATH = '/models/items/sabres0.glb';

const ASSASSIN_MODEL_PATHS = [
  ASSASSIN_BASE_PATH,
  '/models/assassin/buchess_spinattack.glb',
  '/models/assassin/buchess_drawbow.glb',
  '/models/assassin/buchess_releasebow.glb',
  '/models/assassin/buchess_backflip.glb',
  '/models/assassin/buchess_death.glb',
];

const ASSASSIN_DEFERRED_PATHS = {
  Walk: '/models/assassin/buchess_walk.glb',
  Spin: '/models/assassin/buchess_spinattack.glb',
  DrawBow: '/models/assassin/buchess_drawbow.glb',
  ReleaseBow: '/models/assassin/buchess_releasebow.glb',
  Backflip: '/models/assassin/buchess_backflip.glb',
  Death: '/models/assassin/buchess_death.glb',
} as const;

/** Current buchess export — dual-glaive off-hand (Item32838). */
const OFFHAND_PRIMARY = 'Off-hand_Item32838_0';
const OFFHAND_SHELL = 'Off-hand_Item32838_1';
const HELM_PRIMARY = 'Head_Item22478_0';
const HAIR_GEOSET = 'bloodelffemale_Hair2';
/** Assassin helm verts sit ~15cm lower than DK; lift past the shared +0.17 offset. */
const ASSASSIN_HEAD_OFFSET_Y = 0.28;
/** Slight shrink so the dual-glaive matches body scale (~2.6m native span). */
const ASSASSIN_WEAPON_SCALE = 0.85;

export function preloadAssassinModels(): void {
  preloadSkinnedIdleAndAnimationClips(ASSASSIN_BASE_PATH, ASSASSIN_MODEL_PATHS, useGLTF.preload);
  useGLTF.preload(ASSASSIN_WEAPON_MAT_PATH);
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    // Prefer word-boundary match so 'Walk' does not grab 'Walkbackwards'.
    const exact = clips.find(
      (c) =>
        c.name === prefix ||
        c.name.startsWith(`${prefix} `) ||
        c.name.startsWith(`${prefix}(`),
    );
    if (exact) return [exact];
  }
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]] : [];
}

/** Extract first MeshStandard-like material from a donor item GLB scene. */
function findDonorWeaponMaterial(root: Object3D): Material | null {
  let found: Material | null = null;
  root.traverse((obj) => {
    if (found) return;
    const mesh = obj as Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat) found = mat;
  });
  return found;
}

/**
 * WoW hides hair under helm; snap the leather hood onto bone_Head so it sits
 * on the cranium (assassin helm verts are authored below the attachment origin).
 */
function fixAssassinHeadAndHair(root: Object3D): void {
  const helm = root.getObjectByName(HELM_PRIMARY) as Mesh | undefined;
  if (!helm?.isMesh) return;

  const hair = root.getObjectByName(HAIR_GEOSET) as Mesh | undefined;
  if (hair?.isMesh) {
    hair.visible = false;
  }

  const headBone = root.getObjectByName('bone_Head');
  if (!headBone) return;

  // Bone-local snap (same idea as pauldrons) — preserveWorld leaves the helm too low.
  headBone.add(helm);
  helm.position.set(0, ASSASSIN_HEAD_OFFSET_Y, 0);
  helm.quaternion.identity();
  helm.scale.set(1, 1, 1);
  helm.matrixAutoUpdate = true;
  if (helm.geometry) {
    helm.geometry.computeBoundingSphere();
    helm.geometry.computeBoundingBox();
  }
}

/**
 * Hide the untextured Off-hand duplicate shell, shrink the dual-glaive slightly,
 * and swap placeholder materials for a cloned sabre material.
 */
function fixAssassinEmbeddedWeapons(root: Object3D, donorMaterial: Material | null): void {
  const shell = root.getObjectByName(OFFHAND_SHELL) as Mesh | undefined;
  if (shell?.isMesh) {
    shell.visible = false;
  }

  const primary = root.getObjectByName(OFFHAND_PRIMARY) as Mesh | undefined;
  if (primary?.isMesh) {
    // Multiply preserved bind-pose scale from reparent — do not overwrite it.
    primary.scale.multiplyScalar(ASSASSIN_WEAPON_SCALE);
    if (donorMaterial) {
      primary.material = donorMaterial.clone();
      // Subdued glow so weapons match unit self-illumination, not player blades.
      applyWeaponItemGlow(primary, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    }
  }
}

// WoW assassin GLB — same scale convention as Spectre / Death Knight / Shaman.
const TARGET_HEIGHT = 2.75;
const ASSASSIN_BIND_HEIGHT = 2.43;
const SCALE = TARGET_HEIGHT / ASSASSIN_BIND_HEIGHT;
const MODEL_Y_OFFSET = 0.4 * SCALE;

export default React.memo(function AssassinModel({
  isWalking,
  attackKey,
  abilityClip,
  abilityPlayKey = 0,
  isDying,
}: AssassinModelProps) {
  const sceneGroupRef = useRef<Group>(null);
  const currentActionRef = useRef<AnimationAction | null>(null);
  const attackPhaseRef = useRef<'draw' | 'release' | 'done'>('done');
  const lastAbilityPlayKeyRef = useRef(-1);
  const [extraAnims, setExtraAnims] = useState<Record<string, AnimationClip[]>>({});

  const { scene, animations: baseAnims } = useGLTF(ASSASSIN_BASE_PATH);
  const { scene: weaponMatScene } = useGLTF(ASSASSIN_WEAPON_MAT_PATH);

  useEffect(() => {
    let cancelled = false;
    const entries = Object.entries(ASSASSIN_DEFERRED_PATHS);
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
        console.warn('Failed to load assassin animations:', error);
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
    bindWowAttachmentItems(clone);
    // After bind — re-seat helm (assassin verts sit low) and hide hair under hood.
    fixAssassinHeadAndHair(clone);
    applySelfIllumination(clone, { intensity: UNIT_SELF_ILLUMINATION_INTENSITY });
    // After self-illumination so donor sabre mats replace placeholder data-1 cleanly.
    fixAssassinEmbeddedWeapons(clone, findDonorWeaponMaterial(weaponMatScene));
    return clone;
  }, [scene, weaponMatScene]);

  useDisposeClonedMaterials(clonedScene);

  // Dual-wield Ready2HL — Ready2H mis-poses the off-hand blade through the wrist.
  const idleSource = useMemo(
    () => pickWowClip(baseAnims, 'Ready2HL', 'Ready1H', 'StealthStand', 'Stand'),
    [baseAnims],
  );
  const walkSource = useMemo(
    () => pickWowClip(extraAnims.Walk ?? [], 'Walk', 'Run'),
    [extraAnims.Walk],
  );
  // Prefer Whirlwind / SpecialDual over Special2H (matches 'Special' first).
  const spinSource = useMemo(
    () => pickWowClip(extraAnims.Spin ?? [], 'Whirlwind', 'SpecialDual', 'Special1H', 'Special'),
    [extraAnims.Spin],
  );
  const drawBowSource = useMemo(
    () => pickWowClip(extraAnims.DrawBow ?? [], 'LoadBow', 'HoldBow', 'ReadyBow'),
    [extraAnims.DrawBow],
  );
  const releaseBowSource = useMemo(
    () => pickWowClip(extraAnims.ReleaseBow ?? [], 'AttackBow', 'AttackCrossbow', 'Shoot'),
    [extraAnims.ReleaseBow],
  );
  const backflipSource = useMemo(
    () => pickWowClip(extraAnims.Backflip ?? [], 'Jump', 'Special', 'Attack', 'Leap'),
    [extraAnims.Backflip],
  );
  const deathSource = useMemo(
    () => pickWowClip(extraAnims.Death ?? [], 'Death'),
    [extraAnims.Death],
  );

  const animations = useMemo(() => {
    const clips = [
      ...getCachedProcessedClips('assassin-idle-dw', idleSource, {
        stripRootMotion: true,
        renameTo: 'Idle',
      }),
      ...getCachedProcessedClips('assassin-walk-dw', walkSource, {
        stripRootMotion: true,
        renameTo: 'Walk',
      }),
      ...getCachedProcessedClips('assassin-spin-dw', spinSource, {
        stripRootMotion: true,
        renameTo: 'Spin',
      }),
      ...getCachedProcessedClips('assassin-drawbow-bow', drawBowSource, { renameTo: 'DrawBow' }),
      ...getCachedProcessedClips('assassin-releasebow-bow', releaseBowSource, { renameTo: 'ReleaseBow' }),
      ...getCachedProcessedClips('assassin-backflip', backflipSource, {
        stripRootMotion: true,
        renameTo: 'Backflip',
      }),
      ...getCachedProcessedClips('assassin-death', deathSource, { renameTo: 'Death' }),
    ];
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [
    idleSource,
    walkSource,
    spinSource,
    drawBowSource,
    releaseBowSource,
    backflipSource,
    deathSource,
    clonedScene,
  ]);

  const { actions, mixer } = useAnimations(animations, sceneGroupRef);

  const getAction = (
    name: 'Idle' | 'Walk' | 'Spin' | 'DrawBow' | 'ReleaseBow' | 'Backflip' | 'Death',
  ): AnimationAction | null => actions[name] ?? null;

  const posed = useEnemyIdlePose({ actions, mixer, currentActionRef });

  // Death overrides everything
  useEffect(() => {
    if (!actions || !isDying) return;
    attackPhaseRef.current = 'done';
    const d = getAction('Death');
    if (!d) return;
    playEnemyAction(d, currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      fadeIn: 0.15,
      fadeOut: 0.15,
    });
  }, [isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ability one-shots: Spin / Backflip
  useEffect(() => {
    if (!actions || isDying || !abilityClip) return;
    if (abilityPlayKey === lastAbilityPlayKeyRef.current && currentActionRef.current?.getClip().name === abilityClip) {
      return;
    }
    lastAbilityPlayKeyRef.current = abilityPlayKey;
    attackPhaseRef.current = 'done';

    const next = getAction(abilityClip);
    if (!next) return;
    playEnemyAction(next, currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      fadeIn: 0.1,
      fadeOut: 0.1,
      forceRestart: true,
    });
  }, [abilityClip, abilityPlayKey, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bow: restart DrawBow on every attackKey bump
  useEffect(() => {
    if (attackKey === 0 || !actions || isDying) return;
    if (abilityClip) return;

    const drawAction = getAction('DrawBow');
    if (!drawAction) return;

    attackPhaseRef.current = 'draw';
    playEnemyAction(drawAction, currentActionRef, mixer, {
      loopOnce: true,
      clampWhenFinished: true,
      fadeIn: 0.1,
      fadeOut: 0.1,
      forceRestart: true,
    });
  }, [attackKey, abilityClip, isDying, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  // Idle / Walk when not in bow cycle or ability
  useEffect(() => {
    if (!actions || isDying) return;
    if (attackPhaseRef.current !== 'done') return;
    if (abilityClip) return;

    const nextAction = isWalking ? getAction('Walk') : getAction('Idle');
    if (!nextAction) return;
    playEnemyAction(nextAction, currentActionRef, mixer);
  }, [isWalking, isDying, abilityClip, actions, mixer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mixer || isDying) return;

    const handleFinish = (event: { action: AnimationAction }) => {
      if (isDying) return;
      const finishedAction = event.action;
      const clipName = finishedAction.getClip().name;

      if (clipName === 'Death') return;

      if (clipName === 'Spin' || clipName === 'Backflip') {
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
        return;
      }

      if (finishedAction === getAction('DrawBow') && attackPhaseRef.current === 'draw') {
        const releaseAction = getAction('ReleaseBow');
        if (releaseAction) {
          attackPhaseRef.current = 'release';
          playEnemyAction(releaseAction, currentActionRef, mixer, {
            loopOnce: true,
            clampWhenFinished: true,
            fadeIn: 0.05,
            fadeOut: 0.05,
            forceRestart: true,
          });
        }
        return;
      }

      if (finishedAction === getAction('ReleaseBow') && attackPhaseRef.current === 'release') {
        attackPhaseRef.current = 'done';
        const fallback = isWalking ? getAction('Walk') : getAction('Idle');
        playEnemyAction(fallback, currentActionRef, mixer, { fadeIn: 0.15, fadeOut: 0.15 });
      }
    };

    mixer.addEventListener('finished', handleFinish);
    return () => mixer.removeEventListener('finished', handleFinish);
  }, [mixer, isDying, isWalking, actions]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <group ref={sceneGroupRef} visible={posed}>
      <group scale={SCALE} position={[0, MODEL_Y_OFFSET, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <primitive object={clonedScene} />
      </group>
    </group>
  );
});
