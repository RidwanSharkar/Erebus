'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  Mesh,
  ShaderMaterial,
  UniformsLib,
  UniformsUtils,
  FrontSide,
} from '@/utils/three-exports';
import type { Vector3 } from 'three';
import CustomSky from './CustomSky';
import ExploreChunkStreamer from './ExploreChunkStreamer';
import ExploreCampProps, { preloadExploreCampPropGlbs } from './ExploreCampProps';
import { EXPLORE_PLAYER_VIEW_RADIUS, exploreFog } from '@/utils/exploreFogOfWar';
import { useMultiplayerRoom } from '@/contexts/MultiplayerContext';

preloadExploreCampPropGlbs();

const GROUND_RADIUS = 80;
const GROUND_FADE_INNER = 45;
const GROUND_FADE_OUTER = 75;

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
}

export default function ExploreRoom({
  playerPositionRef,
  combatActive = false,
  mushroomHiddenIndices,
}: ExploreRoomProps) {
  const { coopExploreSeed } = useMultiplayerRoom();
  const seed = coopExploreSeed || 1;
  const groundRef = useRef<Mesh>(null);
  const [animateClouds, setAnimateClouds] = useState(!combatActive);

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

  useEffect(() => {
    exploreFog.reset();
    return () => {
      exploreFog.reset();
    };
  }, [seed]);

  useEffect(() => {
    setAnimateClouds(!combatActive);
  }, [combatActive]);

  useFrame(() => {
    const pos = playerPositionRef.current;
    if (!pos) return;
    exploreFog.markExplored(pos.x, pos.z, EXPLORE_PLAYER_VIEW_RADIUS);
    if (groundRef.current) {
      groundRef.current.position.set(pos.x, -0.04, pos.z);
    }
  });

  return (
    <group name="explore-room">
      <CustomSky skyPreset="indigoNight" animateClouds={animateClouds} />
      <hemisphereLight color="#a8b8e0" groundColor="#0a0c18" intensity={0.45} />
      <directionalLight position={[40, 60, 20]} intensity={0.4} color="#c8d0ff" />
      <mesh
        ref={groundRef}
        rotation={[-Math.PI / 2, 0, 0]}
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
      />
      <ExploreCampProps />
    </group>
  );
}
