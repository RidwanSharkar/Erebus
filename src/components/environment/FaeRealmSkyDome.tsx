'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { Mesh as MeshType } from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  Color,
  DoubleSide,
  Group,
  LoopRepeat,
  Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from '@/utils/three-exports';
import { filterAnimationTracksForRoot } from '@/utils/enemyAnimationClipCache';

const SKY_DOME_PATH = '/models/environ/skybox.glb';
/**
 * Camera polar range is ~51–72° from vertical (never looks at zenith). Scale
 * up so the painted sky recedes, then drop Y so the upper ribbon/planets sit
 * in the visible band above the horizon.
 */
const SKY_DOME_SCALE = 0.25;
const SKY_DOME_Y = 19;
/** Stand clip is ~667s; 8× yields an ~83s swirl. */
const SKY_STAND_TIME_SCALE = 4;
const FAE_SKY_BACKGROUND = '#1a1028';

useGLTF.preload(SKY_DOME_PATH);

export function preloadFaeRealmSkyDome(): void {
  useGLTF.preload(SKY_DOME_PATH);
}

function toUnlitSkyMaterial(src: Material): MeshBasicMaterial {
  const std = src as MeshStandardMaterial;
  return new MeshBasicMaterial({
    map: std.map ?? null,
    color: std.color ?? new Color(0xffffff),
    transparent: src.transparent,
    opacity: src.opacity,
    // WoW sky cards export as OPAQUE; a small cutoff lets nebula alpha punch through.
    alphaTest: src.alphaTest > 0 ? src.alphaTest : 0.15,
    side: DoubleSide,
    depthWrite: false,
    fog: false,
    toneMapped: false,
  });
}

export default function FaeRealmSkyDome({ combatActive: _combatActive = false }: { combatActive?: boolean }) {
  const { scene: gltfScene, animations } = useGLTF(SKY_DOME_PATH);
  const groupRef = useRef<Group>(null);
  const { scene } = useThree();

  const skyRoot = useMemo(() => SkeletonUtils.clone(gltfScene) as Group, [gltfScene]);

  const clips = useMemo(
    () => animations.map((clip) => filterAnimationTracksForRoot(skyRoot, clip)),
    [animations, skyRoot],
  );

  const { actions } = useAnimations(clips, groupRef);

  useLayoutEffect(() => {
    const created: MeshBasicMaterial[] = [];
    skyRoot.traverse((child) => {
      const mesh = child as MeshType;
      if (!mesh.isMesh) return;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.frustumCulled = false;
      mesh.renderOrder = -1000;
      const src = mesh.material;
      if (Array.isArray(src)) {
        mesh.material = src.map((m) => {
          const next = toUnlitSkyMaterial(m);
          created.push(next);
          return next;
        });
      } else if (src) {
        const next = toUnlitSkyMaterial(src);
        created.push(next);
        mesh.material = next;
      }
    });
    return () => {
      for (const m of created) m.dispose();
    };
  }, [skyRoot]);

  useLayoutEffect(() => {
    const prev = scene.background;
    scene.background = new Color(FAE_SKY_BACKGROUND);
    return () => {
      scene.background = prev;
    };
  }, [scene]);

  useEffect(() => {
    const name =
      Object.keys(actions).find((n) => n.startsWith('Stand')) ?? Object.keys(actions)[0];
    const action = name ? actions[name] : null;
    if (!action) return;
    action.enabled = true;
    action.setLoop(LoopRepeat, Infinity);
    action.timeScale = SKY_STAND_TIME_SCALE;
    action.reset().play();
    return () => {
      action.stop();
    };
  }, [actions]);

  return (
    <group ref={groupRef} name="fae-realm-sky-dome">
      <primitive object={skyRoot} scale={SKY_DOME_SCALE} position={[0, SKY_DOME_Y, 0]} />
    </group>
  );
}
