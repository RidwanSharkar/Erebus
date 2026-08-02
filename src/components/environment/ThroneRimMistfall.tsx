'use client';

import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  CylinderGeometry,
  DoubleSide,
  ShaderMaterial,
} from '@/utils/three-exports';

/**
 * Mist pouring off the throne island rim into the cloud sea.
 * One open-ended cylinder shell — classic floating-island silhouette cue.
 */

const MIST_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vY;
  varying vec3 vWorldPos;

  void main() {
    vUv = uv;
    vY = position.y;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const MIST_FRAG = /* glsl */ `
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }
  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i),             hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * smoothNoise(p);
      p  = p * 2.13 + vec2(0.4, 0.8);
      a *= 0.5;
    }
    return v;
  }

  uniform float uTime;
  uniform float uOpacity;
  uniform vec3  uMistColor;
  uniform float uHalfH;

  varying vec2 vUv;
  varying float vY;
  varying vec3 vWorldPos;

  void main() {
    // Cylinder UV: x = angle, y = height (0 bottom → 1 top for default UV)
    // Scroll noise downward so mist reads as pouring off the rim
    float angle = vUv.x * 6.2831853;
    vec2 nUv = vec2(angle * 0.55, vWorldPos.y * 0.22 - uTime * 0.35);
    float n = fbm(nUv);
    float n2 = fbm(nUv * 1.7 + vec2(2.4, -1.1));
    float dens = smoothstep(0.25, 0.75, n * 0.65 + n2 * 0.45);

    // Strong at the rim (top of shell), fade to zero at the bottom
    float hNorm = (vY / uHalfH) * 0.5 + 0.5; // 0 bottom → 1 top
    float topBoost = smoothstep(0.55, 1.0, hNorm);
    float bottomFade = smoothstep(0.0, 0.35, hNorm);
    float vertical = topBoost * bottomFade;

    float alpha = dens * vertical * uOpacity;
    alpha = clamp(alpha, 0.0, 0.75);
    if (alpha < 0.01) discard;

    vec3 col = mix(uMistColor * 0.75, uMistColor, dens);
    gl_FragColor = vec4(col, alpha);
  }
`;

const SHELL_HEIGHT = 7;
const SHELL_TOP_R = 14.25;
const SHELL_BOT_R = 15.5;

interface ThroneRimMistfallProps {
  animateClouds?: boolean;
}

const ThroneRimMistfall: React.FC<ThroneRimMistfallProps> = ({
  animateClouds = true,
}) => {
  const geo = useMemo(
    () =>
      new CylinderGeometry(SHELL_TOP_R, SHELL_BOT_R, SHELL_HEIGHT, 64, 1, true),
    [],
  );

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: MIST_VERT,
        fragmentShader: MIST_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: true,
        side: DoubleSide,
        uniforms: {
          uTime: { value: 0 },
          uOpacity: { value: 0.55 },
          uMistColor: { value: new Color('#d8e6f4') },
          uHalfH: { value: SHELL_HEIGHT * 0.5 },
        },
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((_, delta) => {
    if (!animateClouds) return;
    mat.uniforms.uTime.value += delta;
  });

  return (
    <mesh
      name="throne-rim-mistfall"
      geometry={geo}
      material={mat}
      // Hang from y≈0 down to y≈-7 (cylinder centered → shift down by half height)
      position={[0, -SHELL_HEIGHT * 0.5, 0]}
      frustumCulled={false}
      renderOrder={1}
    />
  );
};

export default React.memo(ThroneRimMistfall);
