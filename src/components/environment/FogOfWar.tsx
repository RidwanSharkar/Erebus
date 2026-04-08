'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector2, Vector3, ShaderMaterial, Color } from '@/utils/three-exports';
import { CAMP_DATA } from '@/utils/fogOfWarUtils';

// ─── Shaders ─────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */`
  varying vec3 vWorldPosition;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3  uFogColor;
  uniform float uFogAlpha;
  uniform vec3  uPlayerPos;
  uniform float uPlayerRadius;
  uniform float uEdgeSoftness;
  uniform vec2  uCampCenters[4];
  uniform float uCampRadius;
  uniform float uDiscovered[4];

  varying vec3 vWorldPosition;

  void main() {
    vec2 worldXZ = vec2(vWorldPosition.x, vWorldPosition.z);

    float revealed = 0.0;

    // Always reveal a circle around the local player
    float playerDist = distance(worldXZ, vec2(uPlayerPos.x, uPlayerPos.z));
    float playerReveal = 1.0 - smoothstep(
      uPlayerRadius - uEdgeSoftness,
      uPlayerRadius + uEdgeSoftness,
      playerDist
    );
    revealed = max(revealed, playerReveal);

    // Reveal circles for each discovered camp
    for (int i = 0; i < 4; i++) {
      if (uDiscovered[i] > 0.5) {
        float campDist = distance(worldXZ, uCampCenters[i]);
        float campReveal = 1.0 - smoothstep(
          uCampRadius - uEdgeSoftness,
          uCampRadius + uEdgeSoftness,
          campDist
        );
        revealed = max(revealed, campReveal);
      }
    }

    float alpha = uFogAlpha * (1.0 - revealed);
    if (alpha < 0.005) discard;

    gl_FragColor = vec4(uFogColor, alpha);
  }
`;

// ─── Component ───────────────────────────────────────────────────────────────

interface FogOfWarProps {
  /** Ref to the local player's world position — updated every frame without triggering re-renders. */
  playerPositionRef: React.MutableRefObject<Vector3>;
  /** Which of the four camps have been discovered (indices match CAMP_DATA). */
  discoveredCamps: boolean[];
}

const FogOfWar: React.FC<FogOfWarProps> = ({ playerPositionRef, discoveredCamps }) => {
  const matRef = useRef<ShaderMaterial>(null!);

  // Uniforms are created once; values are mutated in-place every frame.
  const uniforms = useMemo(() => ({
    uFogColor:     { value: new Color(0x020408) },
    uFogAlpha:     { value: 0.93 },
    uPlayerPos:    { value: new Vector3() },
    uPlayerRadius: { value: 12.0 },
    uEdgeSoftness: { value: 2.5 },
    uCampCenters:  { value: CAMP_DATA.map(c => new Vector2(c.x, c.z)) },
    uCampRadius:   { value: 11.0 },
    uDiscovered:   { value: [0.0, 0.0, 0.0, 0.0] },
  }), []);

  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;

    // Sync player world position
    (mat.uniforms.uPlayerPos.value as Vector3).copy(playerPositionRef.current);

    // Sync discovered-camp flags
    const disc = mat.uniforms.uDiscovered.value as number[];
    for (let i = 0; i < 4; i++) {
      disc[i] = discoveredCamps[i] ? 1.0 : 0.0;
    }
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.15, 0]}
      renderOrder={50}
    >
      {/* 90×90 plane covers the full map (radius 33) plus generous buffer */}
      <planeGeometry args={[90, 90]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
};

export default FogOfWar;
