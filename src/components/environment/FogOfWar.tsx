'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DataTexture,
  RedFormat,
  UnsignedByteType,
  LinearFilter,
  ClampToEdgeWrapping,
} from 'three';
import { Vector3, ShaderMaterial, Color } from '@/utils/three-exports';
import {
  FOG_GRID_SIZE,
  MAP_HALF_SIZE,
  PLAYER_VIEW_RADIUS,
  markExplored,
} from '@/utils/fogOfWarUtils';
import { MAIN_MAP_RADIUS } from '@/utils/mapConstants';

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
  uniform vec3      uFogColor;
  uniform float     uFogAlpha;
  uniform vec3      uPlayerPos;
  uniform float     uPlayerRadius;
  uniform float     uEdgeSoftness;
  uniform sampler2D uExploredMap;
  uniform float     uMapHalfSize;

  varying vec3 vWorldPosition;

  void main() {
    vec2 worldXZ = vec2(vWorldPosition.x, vWorldPosition.z);

    float revealed = 0.0;

    // Live vision circle around the player
    float playerDist = distance(worldXZ, vec2(uPlayerPos.x, uPlayerPos.z));
    float playerReveal = 1.0 - smoothstep(
      uPlayerRadius - uEdgeSoftness,
      uPlayerRadius + uEdgeSoftness,
      playerDist
    );
    revealed = max(revealed, playerReveal);

    // Previously explored areas (sampled from DataTexture)
    vec2 uv = (worldXZ + uMapHalfSize) / (uMapHalfSize * 2.0);
    if (uv.x >= 0.0 && uv.x <= 1.0 && uv.y >= 0.0 && uv.y <= 1.0) {
      float explored = texture2D(uExploredMap, uv).r;
      revealed = max(revealed, explored);
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
  /**
   * Shared Uint8Array (FOG_GRID_SIZE²) representing which map cells the player
   * has visited. FogOfWar writes to this ref every frame; the scene reads from
   * it to decide enemy visibility.
   */
  exploredGridRef: React.MutableRefObject<Uint8Array>;
}

const FogOfWar: React.FC<FogOfWarProps> = ({ playerPositionRef, exploredGridRef }) => {
  const matRef = useRef<ShaderMaterial>(null!);

  // DataTexture backed by the same Uint8Array — updated in-place, no allocations per frame.
  // Callers must not replace `exploredGridRef.current` with a new array (GPU would keep the old buffer).
  const exploredTex = useMemo(() => {
    const tex = new DataTexture(
      exploredGridRef.current as Uint8Array<ArrayBuffer>,
      FOG_GRID_SIZE,
      FOG_GRID_SIZE,
      RedFormat,
      UnsignedByteType,
    );
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearFilter;
    tex.wrapS     = ClampToEdgeWrapping;
    tex.wrapT     = ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { exploredTex.dispose(); }, [exploredTex]);

  // Uniforms created once; values are mutated in-place every frame.
  const uniforms = useMemo(() => ({
    uFogColor:     { value: new Color(0x020408) },
    uFogAlpha:     { value: 0.93 },
    uPlayerPos:    { value: new Vector3() },
    uPlayerRadius: { value: PLAYER_VIEW_RADIUS },
    uEdgeSoftness: { value: 9.5 },
    uExploredMap:  { value: exploredTex },
    uMapHalfSize:  { value: MAP_HALF_SIZE },
  }), [exploredTex]);

  useFrame(() => {
    const mat = matRef.current;
    if (!mat) return;

    const pos = playerPositionRef.current;
    (mat.uniforms.uPlayerPos.value as Vector3).copy(pos);

    // Mark the player's current vision footprint as permanently explored.
    const changed = markExplored(exploredGridRef.current, pos.x, pos.z, PLAYER_VIEW_RADIUS);
    if (changed) {
      exploredTex.needsUpdate = true;
    }
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.15, 0]}
      renderOrder={50}
    >
      {/* Circle covers the full playable disc plus a small buffer */}
      <circleGeometry args={[MAIN_MAP_RADIUS + 0.5, 64]} />
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
