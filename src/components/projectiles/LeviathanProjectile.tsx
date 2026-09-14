'use client';

import React, { Suspense, useEffect, useMemo, useRef } from 'react';
import { useAnimations, useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import {
  AnimationClip,
  Color,
  DoubleSide,
  Group,
  LoopRepeat,
  Material,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Vector3 } from '@/utils/three-exports';
import { useDisposeClonedMaterials } from '@/utils/disposeObject3D';
import {
  filterAnimationTracksForRoot,
  getCachedProcessedClips,
} from '@/utils/enemyAnimationClipCache';
import { LEVIATHAN_MAX_DISTANCE } from '@/utils/talents';

export const LEVIATHAN_MODEL_PATH = '/models/basilisk_swim.glb';

const TARGET_HEIGHT = 2.4;
const BASILISK_BIND_HEIGHT = 2.0;
/** Combat visual is ~1/3 of the original player-scale basilisk. */
const SCALE = (TARGET_HEIGHT / BASILISK_BIND_HEIGHT) / 3;
const MODEL_Y_OFFSET = 0.15 * SCALE;
/** Inner mesh bind rotation — parent Y must compensate so nose aligns with travel. */
const MODEL_Y_BIND = -Math.PI / 2;
const TRAVEL_TANGENT_Y_OFFSET = Math.PI / 2;
/** Flip 180° so they swim nose-first, not tail-first. */
const FORWARD_FLIP = Math.PI;
const ACTION_NAME = 'Fly';
/** Playback rate so the Fly clip matches travel speed. */
const ANIMATION_TIME_SCALE = 2.275;

/** Ghost shell base alpha — readable but clearly not solid. */
const SPECTRAL_BASE_OPACITY = 0.68;
const SPECTRAL_COLOR = new Color('#9be7ff');
const SPECTRAL_EMISSIVE = new Color('#c8f4ff');
const SPECTRAL_EMISSIVE_INTENSITY = 0.95;
const SPECTRAL_SHADER_CACHE_KEY = 'leviathan-spectral-v2';

useGLTF.preload(LEVIATHAN_MODEL_PATH);

export interface LeviathanProjectileView {
  id: number;
  position: Vector3;
  direction: Vector3;
  maxDistance: number;
  distanceTraveled: number;
}

type SpectralMaterial = MeshStandardMaterial & {
  userData: MeshStandardMaterial['userData'] & {
    spectralUniforms?: {
      uTime: { value: number };
      uFade: { value: number };
    };
  };
};

function computeFadeOpacity(traveled: number, maxDistance: number): number {
  const fadeStart = Math.max(maxDistance * 0.72, 1e-3);
  const fadeEnd = Math.max(maxDistance, fadeStart + 1e-3);
  const fadeProgress =
    traveled < fadeStart ? 0 : Math.min(1, (traveled - fadeStart) / (fadeEnd - fadeStart));
  return 1 - fadeProgress * fadeProgress;
}

function pickWowClip(clips: AnimationClip[], ...prefixes: string[]): AnimationClip[] {
  for (const prefix of prefixes) {
    const match = clips.find((c) => c.name.startsWith(prefix));
    if (match) return [match];
  }
  return clips.length > 0 ? [clips[0]!] : [];
}

function patchSpectralMaterial(mat: Material): void {
  const stdCandidate = mat as MeshStandardMaterial;
  if (!stdCandidate.isMeshStandardMaterial) {
    // Still force translucent shell settings on non-standard mats when possible.
    const anyMat = mat as Material & {
      transparent?: boolean;
      opacity?: number;
      depthWrite?: boolean;
      side?: number;
      color?: Color;
      emissive?: Color;
      emissiveIntensity?: number;
      metalness?: number;
      roughness?: number;
    };
    anyMat.transparent = true;
    anyMat.opacity = SPECTRAL_BASE_OPACITY;
    if ('depthWrite' in anyMat) anyMat.depthWrite = false;
    if ('side' in anyMat) anyMat.side = DoubleSide;
    if (anyMat.color) anyMat.color.lerp(SPECTRAL_COLOR, 0.55);
    if (anyMat.emissive) {
      anyMat.emissive.copy(SPECTRAL_EMISSIVE);
      anyMat.emissiveIntensity = SPECTRAL_EMISSIVE_INTENSITY;
    }
    if (typeof anyMat.metalness === 'number') anyMat.metalness = 0;
    if (typeof anyMat.roughness === 'number') anyMat.roughness = Math.max(anyMat.roughness, 0.72);
    mat.needsUpdate = true;
    return;
  }

  const std = mat as SpectralMaterial;
  std.transparent = true;
  std.opacity = SPECTRAL_BASE_OPACITY;
  std.depthWrite = false;
  std.side = DoubleSide;
  std.metalness = 0;
  std.roughness = Math.max(std.roughness, 0.72);
  std.color.lerp(SPECTRAL_COLOR, 0.55);
  std.emissive.copy(SPECTRAL_EMISSIVE);
  std.emissiveIntensity = SPECTRAL_EMISSIVE_INTENSITY;

  const uniforms = {
    uTime: { value: 0 },
    uFade: { value: 1 },
  };
  std.userData.spectralUniforms = uniforms;
  std.customProgramCacheKey = () => SPECTRAL_SHADER_CACHE_KEY;

  std.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uFade = uniforms.uFade;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
varying float vSpectralFresnel;`,
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
{
  // Post-skinning shimmer along skinned normal so Fly clip still drives silhouette.
  float shimmer = sin(uTime * 3.4 + transformed.x * 7.0 + transformed.z * 5.0) * 0.028
    + sin(uTime * 5.1 + transformed.y * 9.0) * 0.012;
  transformed += objectNormal * shimmer;
}`,
      )
      .replace(
        // mvPosition is declared in project_vertex — must patch AFTER that include.
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec3 viewN = normalize(normalMatrix * objectNormal);
  vec3 viewDir = normalize(-mvPosition.xyz);
  float ndotv = abs(dot(viewN, viewDir));
  vSpectralFresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), 2.2);
}`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uFade;
varying float vSpectralFresnel;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
// Hollow shell: interior more transparent, rim brighter/more opaque.
float rim = mix(0.55, 1.0, vSpectralFresnel);
diffuseColor.a *= rim * uFade;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.78, 0.94, 1.0), vSpectralFresnel * 0.45);`,
      );
  };

  std.needsUpdate = true;
}

function applySpectralMaterials(root: Group): void {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat) patchSpectralMaterial(mat);
    }
  });
}

/** Drive travel fade + shimmer time on patched spectral materials. */
function updateSpectralUniforms(root: Group | null, fade: number, time: number): void {
  if (!root) return;
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      const uniforms = (mat as SpectralMaterial).userData?.spectralUniforms;
      if (!uniforms) continue;
      uniforms.uFade.value = fade;
      uniforms.uTime.value = time;
    }
  });
}

function LeviathanProjectileMesh({ projectile }: { projectile: LeviathanProjectileView }) {
  const projectileRef = useRef(projectile);
  projectileRef.current = projectile;

  const groupRef = useRef<Group>(null);
  const sceneGroupRef = useRef<Group>(null);
  const { scene, animations: swimAnims } = useGLTF(LEVIATHAN_MODEL_PATH);

  const clonedScene = useMemo(() => {
    const clone = SkeletonUtils.clone(scene) as Group;
    clone.traverse((child: any) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        child.frustumCulled = true;
        child.material = Array.isArray(child.material)
          ? child.material.map((m: any) => m.clone())
          : child.material.clone();
      }
    });
    applySpectralMaterials(clone);
    return clone;
  }, [scene]);

  useDisposeClonedMaterials(clonedScene);

  const flySource = useMemo(
    () =>
      pickWowClip(
        swimAnims,
        'Fly (ID 135 variation 0)',
        'FlyRun (ID 234 variation 0)',
        'MountFlightIdle (ID 548 variation 0)',
        'Swim (ID 42 variation 0)',
      ),
    [swimAnims],
  );

  const animations = useMemo(() => {
    const clips = getCachedProcessedClips('leviathan-fly-basilisk', flySource, {
      stripRootMotion: true,
      renameTo: ACTION_NAME,
    });
    return clips.map((clip) => filterAnimationTracksForRoot(clonedScene, clip));
  }, [flySource, clonedScene]);

  const { actions } = useAnimations(animations, sceneGroupRef);

  useEffect(() => {
    const action = actions?.[ACTION_NAME];
    if (!action) return;
    action.enabled = true;
    action.setLoop(LoopRepeat, Infinity);
    action.timeScale = ANIMATION_TIME_SCALE;
    action.reset().fadeIn(0.15).play();
    return () => {
      action.fadeOut(0.15);
      action.stop();
    };
  }, [actions]);

  useFrame((state) => {
    const proj = projectileRef.current;
    const group = groupRef.current;
    if (!group) return;

    const traveled = Math.max(0, proj.distanceTraveled);
    const maxDistance =
      proj.maxDistance > 0 && Number.isFinite(proj.maxDistance)
        ? proj.maxDistance
        : LEVIATHAN_MAX_DISTANCE;
    const fade = computeFadeOpacity(traveled, maxDistance);

    group.position.copy(proj.position);
    const yaw =
      Math.atan2(proj.direction.x, proj.direction.z) -
      MODEL_Y_BIND +
      TRAVEL_TANGENT_Y_OFFSET +
      FORWARD_FLIP;
    group.rotation.set(0, yaw, 0);
    updateSpectralUniforms(clonedScene, fade, state.clock.elapsedTime);
    group.visible = fade > 0.02;
  });

  return (
    <group ref={groupRef}>
      <group ref={sceneGroupRef}>
        <group
          scale={[SCALE, SCALE, SCALE]}
          position={[0, MODEL_Y_OFFSET, 0]}
          rotation={[0, MODEL_Y_BIND, 0]}
        >
          <primitive object={clonedScene} />
        </group>
      </group>
    </group>
  );
}

export default function LeviathanProjectile({
  projectiles,
}: {
  projectiles: LeviathanProjectileView[];
}) {
  return (
    <Suspense fallback={null}>
      {projectiles.map((p) => (
        <LeviathanProjectileMesh key={p.id} projectile={p} />
      ))}
    </Suspense>
  );
}
