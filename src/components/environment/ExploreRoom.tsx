'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  Color,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  FrontSide,
  FogExp2,
  PerspectiveCamera,
} from '@/utils/three-exports';
import type { Vector3 } from 'three';
import { DirectionalLight, HemisphereLight } from 'three';
import CustomSky, { SKY_INDIGO_NIGHT, type SkyThemeUniforms } from './CustomSky';
import ExploreChunkStreamer from './ExploreChunkStreamer';
import ExploreCampProps, { preloadExploreCampPropGlbs } from './ExploreCampProps';
import { EXPLORE_PLAYER_VIEW_RADIUS, exploreFog } from '@/utils/exploreFogOfWar';
import { useMultiplayerActions, useMultiplayerRoom } from '@/contexts/MultiplayerContext';
import {
  exploreDayNightPhaseFromStartedAt,
  resolveExploreDayNightLighting,
  resolveExploreDayNightTheme,
} from '@/utils/exploreDayNightCycle';

preloadExploreCampPropGlbs();

const GROUND_RADIUS = 80;
const GROUND_FADE_INNER = 45;
const GROUND_FADE_OUTER = 75;
const EXPLORE_FOG_DENSITY = 0.045;
const EXPLORE_CAMERA_FAR = 600;

const GROUND_VERT = `
#include <common>
#include <fog_pars_vertex>
varying vec2 vLocalXZ;
void main() {
  vLocalXZ = position.xy;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const GROUND_FRAG = `
#include <common>
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uFadeInner;
uniform float uFadeOuter;
varying vec2 vLocalXZ;
void main() {
  float dist = length(vLocalXZ);
  float edge = smoothstep(uFadeInner, uFadeOuter, dist);
  if (edge > 0.98) discard;
  gl_FragColor = vec4(uColor, 1.0);
  #include <fog_fragment>
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, edge);
}
`;

interface ExploreRoomProps {
  playerPositionRef: React.MutableRefObject<Vector3>;
  combatActive?: boolean;
  mushroomHiddenIndices?: ReadonlySet<number>;
  treeHiddenIndices?: ReadonlySet<number>;
  rootHiddenIndices?: ReadonlySet<number>;
  rockHiddenIndices?: ReadonlySet<number>;
  spineHiddenIndices?: ReadonlySet<number>;
  onFogHorizonChange?: (horizonHex: string) => void;
}

export default function ExploreRoom({
  playerPositionRef,
  combatActive = false,
  mushroomHiddenIndices,
  treeHiddenIndices,
  rootHiddenIndices,
  rockHiddenIndices,
  spineHiddenIndices,
  onFogHorizonChange,
}: ExploreRoomProps) {
  const { coopExploreSeed, exploreDayNightActive, exploreDayNightStartedAt } = useMultiplayerRoom();
  const { emitExploreFogUpdate } = useMultiplayerActions();
  const { scene, camera } = useThree();
  const seed = coopExploreSeed || 1;
  const groundRef = useRef<Mesh>(null);
  const prevSeedRef = useRef<number | null>(null);
  const [animateClouds, setAnimateClouds] = useState(!combatActive);
  const initialLighting = useMemo(() => resolveExploreDayNightLighting(0.85), []);
  const skyThemeHolder = useRef<SkyThemeUniforms>({ ...SKY_INDIGO_NIGHT });
  const hemiRef = useRef<HemisphereLight>(null);
  const dirRef = useRef<DirectionalLight>(null);
  const lastHorizonRef = useRef('');
  const fogRef = useRef<FogExp2 | null>(null);
  const onFogHorizonChangeRef = useRef(onFogHorizonChange);
  onFogHorizonChangeRef.current = onFogHorizonChange;

  const groundMat = useMemo(() => {
    const mat = new ShaderMaterial({
      uniforms: UniformsUtils.merge([
        UniformsLib.fog,
        {
          uColor: { value: new Color('#3d5c32') },
          uFadeInner: { value: GROUND_FADE_INNER },
          uFadeOuter: { value: GROUND_FADE_OUTER },
        },
      ]),
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      side: FrontSide,
      fog: true,
    });
    return mat;
  }, []);

  useEffect(() => () => groundMat.dispose(), [groundMat]);

  useLayoutEffect(() => {
    const prevFog = scene.fog;
    const horizon = SKY_INDIGO_NIGHT.horizon;
    const fog = new FogExp2(horizon, EXPLORE_FOG_DENSITY);
    fogRef.current = fog;
    scene.fog = fog;
    const persp = camera instanceof PerspectiveCamera ? camera : null;
    const prevFar = persp?.far;
    if (persp) {
      persp.far = EXPLORE_CAMERA_FAR;
      persp.updateProjectionMatrix();
    }
    return () => {
      if (scene.fog === fog) scene.fog = prevFog;
      if (persp && prevFar != null && persp.far === EXPLORE_CAMERA_FAR) {
        persp.far = prevFar;
        persp.updateProjectionMatrix();
      }
    };
  }, [scene, camera]);

  useEffect(() => {
    const prev = prevSeedRef.current;
    prevSeedRef.current = seed;
    if (prev != null && prev !== seed) {
      exploreFog.reset();
    }
  }, [seed]);

  useEffect(() => {
    setAnimateClouds(!combatActive);
  }, [combatActive]);

  useFrame(() => {
    const pos = playerPositionRef.current;
    if (!pos) return;

    let horizon = SKY_INDIGO_NIGHT.horizon;
    if (exploreDayNightActive && exploreDayNightStartedAt > 0) {
      const phase = exploreDayNightPhaseFromStartedAt(exploreDayNightStartedAt);
      const theme = resolveExploreDayNightTheme(phase);
      Object.assign(skyThemeHolder.current, theme);
      const lighting = resolveExploreDayNightLighting(phase);
      const hemi = hemiRef.current;
      if (hemi) {
        hemi.color.set(lighting.hemiColor);
        hemi.groundColor.set(lighting.hemiGround);
        hemi.intensity = lighting.hemiIntensity;
      }
      const dir = dirRef.current;
      if (dir) {
        dir.color.set(lighting.dirColor);
        dir.intensity = lighting.dirIntensity;
      }
      horizon = theme.horizon;
    } else {
      Object.assign(skyThemeHolder.current, SKY_INDIGO_NIGHT);
      const lighting = initialLighting;
      const hemi = hemiRef.current;
      if (hemi) {
        hemi.color.set(lighting.hemiColor);
        hemi.groundColor.set(lighting.hemiGround);
        hemi.intensity = lighting.hemiIntensity;
      }
      const dir = dirRef.current;
      if (dir) {
        dir.color.set(lighting.dirColor);
        dir.intensity = lighting.dirIntensity;
      }
    }
    if (fogRef.current) {
      fogRef.current.color.set(horizon);
    }
    if (horizon !== lastHorizonRef.current) {
      lastHorizonRef.current = horizon;
      onFogHorizonChangeRef.current?.(horizon);
    }

    const changed = exploreFog.markExplored(pos.x, pos.z, EXPLORE_PLAYER_VIEW_RADIUS);
    if (changed) {
      const dirty = exploreFog.consumeDirtyChunks();
      if (dirty.length > 0) emitExploreFogUpdate(dirty);
    }
    if (groundRef.current) {
      groundRef.current.position.set(pos.x, -0.04, pos.z);
    }
  });

  const start = playerPositionRef.current;
  return (
    <group name="explore-room">
      <CustomSky
        skyPreset="indigoNight"
        animateClouds={animateClouds}
        themeUniforms={skyThemeHolder.current}
      />
      <hemisphereLight
        ref={hemiRef}
        color={initialLighting.hemiColor}
        groundColor={initialLighting.hemiGround}
        intensity={initialLighting.hemiIntensity}
      />
      <directionalLight
        ref={dirRef}
        position={[40, 60, 20]}
        intensity={initialLighting.dirIntensity}
        color={initialLighting.dirColor}
      />
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[start?.x ?? 0, -0.04, start?.z ?? 0]}
        receiveShadow={false}
        frustumCulled={false}
      >
        <circleGeometry args={[GROUND_RADIUS, 48]} />
        <primitive object={groundMat} attach="material" />
      </mesh>
      <ExploreChunkStreamer
        seed={seed}
        playerPositionRef={playerPositionRef}
        combatActive={combatActive}
        mushroomHiddenIndices={mushroomHiddenIndices}
        treeHiddenIndices={treeHiddenIndices}
        rootHiddenIndices={rootHiddenIndices}
        rockHiddenIndices={rockHiddenIndices}
        spineHiddenIndices={spineHiddenIndices}
      />
      <ExploreCampProps />
    </group>
  );
}
