'use client';

import React, { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  RingGeometry,
  ShaderMaterial,
  Vector3,
} from '@/utils/three-exports';

/**
 * Horizontal FBM cloud-sea rings beneath the throne island.
 * Reuses the same hash/smoothNoise/fbm GLSL as CustomSky (pure math, no textures).
 */

const SEA_VERT = /* glsl */ `
  varying vec2 vWorldXZ;
  varying float vRadial;
  varying vec3 vWorldPos;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vWorldXZ = world.xz;
    vRadial = length(position.xz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const SEA_FRAG = /* glsl */ `
  // Value noise — matches CustomSky (no texture lookups)
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
    for (int i = 0; i < 5; i++) {
      v += a * smoothNoise(p);
      p  = p * 2.13 + vec2(0.4, 0.8);
      a *= 0.5;
    }
    return v;
  }
  float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * smoothNoise(p);
      p  = p * 2.13 + vec2(0.4, 0.8);
      a *= 0.5;
    }
    return v;
  }

  uniform float uTime;
  uniform float uScrollA;
  uniform float uScrollB;
  uniform float uOpacity;
  uniform float uDarken;
  uniform float uInnerR;
  uniform float uOuterR;
  uniform vec3  uHorizon;
  uniform vec3  uCloudLit;
  uniform vec3  uCloudShade;
  uniform vec3  uSunDir;

  varying vec2 vWorldXZ;
  varying float vRadial;
  varying vec3 vWorldPos;

  void main() {
    float r = vRadial;
    float t = uTime;

    // Distance-based detail: drop high-frequency octaves past ~120m (grazing-angle anti-moiré)
    float distFade = 1.0 - smoothstep(90.0, 160.0, r);

    vec2 uvA = vWorldXZ * 0.018 + vec2(t * uScrollA, t * uScrollA * 0.62);
    vec2 uvB = vWorldXZ * 0.031 + vec2(-t * uScrollB * 0.7, t * uScrollB);

    float warp = fbm3(uvA * 0.55 + vec2(3.1, 7.4));
    vec2 wUv = uvA + (warp * 2.0 - 1.0) * 0.35;

    float macro = fbm3(wUv * 0.45);
    float detail = mix(fbm3(wUv * 1.4), fbm(wUv * 1.4), distFade);
    float churn = fbm3(uvB);

    float dens = smoothstep(0.28, 0.72, macro * 0.55 + detail * 0.35 + churn * 0.22);
    dens = dens * dens * (3.0 - 2.0 * dens);

    // Soft radial fades — join sky at outer edge, soft hole under island
    float innerFade = smoothstep(uInnerR, uInnerR + 28.0, r);
    float outerFade = 1.0 - smoothstep(uOuterR - 90.0, uOuterR, r);
    float radial = innerFade * outerFade;

    // Sun sheen on cloud tops (same sunDir as throneBlue sky)
    vec3 toSun = normalize(uSunDir);
    float sheen = max(0.0, toSun.y) * 0.35 + max(0.0, dot(normalize(vec3(vWorldXZ.x, 0.15, vWorldXZ.y)), toSun)) * 0.25;

    vec3 cloudCol = mix(uCloudShade, uCloudLit, dens * 0.7 + sheen);
    cloudCol = mix(cloudCol, uHorizon, smoothstep(0.55, 1.0, 1.0 - outerFade) * 0.55);
    cloudCol *= (1.0 - uDarken);

    float alpha = dens * radial * uOpacity;
    alpha = clamp(alpha, 0.0, 0.92);

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(cloudCol, alpha);
  }
`;

function createSeaMaterial(opts: {
  opacity: number;
  darken: number;
  scrollA: number;
  scrollB: number;
  innerR: number;
  outerR: number;
}): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader: SEA_VERT,
    fragmentShader: SEA_FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uScrollA: { value: opts.scrollA },
      uScrollB: { value: opts.scrollB },
      uOpacity: { value: opts.opacity },
      uDarken: { value: opts.darken },
      uInnerR: { value: opts.innerR },
      uOuterR: { value: opts.outerR },
      uHorizon: { value: new Color('#b8daf8') },
      uCloudLit: { value: new Color('#f4f8fc') },
      uCloudShade: { value: new Color('#7a9aba') },
      uSunDir: { value: new Vector3(0.52, 0.32, -0.48).normalize() },
    },
  });
}

interface CloudSeaOceanProps {
  /** When false, FBM scroll freezes (combat LOD). Defaults to true. */
  animateClouds?: boolean;
}

/**
 * Two horizontal cloud-sea rings under the throne island — the main visual fill
 * for the below-horizon void. ~2 draw calls, no textures.
 */
const CloudSeaOcean: React.FC<CloudSeaOceanProps> = ({ animateClouds = true }) => {
  const nearGeo = useMemo(() => new RingGeometry(30, 280, 96, 6), []);
  const deepGeo = useMemo(() => new RingGeometry(60, 400, 64, 4), []);

  const nearMat = useMemo(
    () =>
      createSeaMaterial({
        opacity: 0.78,
        darken: 0.05,
        scrollA: 0.012,
        scrollB: 0.008,
        innerR: 30,
        outerR: 280,
      }),
    [],
  );
  const deepMat = useMemo(
    () =>
      createSeaMaterial({
        opacity: 0.55,
        darken: 0.28,
        scrollA: 0.006,
        scrollB: 0.004,
        innerR: 60,
        outerR: 400,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      nearGeo.dispose();
      deepGeo.dispose();
      nearMat.dispose();
      deepMat.dispose();
    };
  }, [nearGeo, deepGeo, nearMat, deepMat]);

  useFrame((_, delta) => {
    if (!animateClouds) return;
    nearMat.uniforms.uTime.value += delta;
    deepMat.uniforms.uTime.value += delta;
  });

  return (
    <group name="cloud-sea-ocean">
      {/* RingGeometry lies in XY; rotate to XZ horizontal */}
      <mesh
        geometry={nearGeo}
        material={nearMat}
        position={[0, -11, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        frustumCulled={false}
        renderOrder={-2}
      />
      <mesh
        geometry={deepGeo}
        material={deepMat}
        position={[0, -34, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        frustumCulled={false}
        renderOrder={-3}
      />
    </group>
  );
};

export default React.memo(CloudSeaOcean);
