import React, { useMemo, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, SphereGeometry, Vector3, Color, BackSide } from '@/utils/three-exports';
import type { RoomBorderTheme } from './SimpleBorderEffects';

/** Per-room sky: gradient, sun, and subtle atmosphere so clouds match the combat palette. */
type SkyThemeUniforms = {
  zenith: string;
  upperMid: string;
  midHorizon: string;
  horizon: string;
  ground: string;
  sunColor: string;
  sunDir: [number, number, number];
  /** Sun corona tints (match previous warm look on red, cool on blue). */
  sunHalo0: string;
  sunHalo1: string;
  sunHalo2: string;
  /** 0 = cool/icy clouds, 1 = warm sunset-style cloud bellies. */
  cloudWarmth: number;
};

/** Clear daytime blue — throne prep room only (decoupled from perimeter camp tint). */
export const SKY_THRONE_BLUE: SkyThemeUniforms = {
  zenith: '#1e6fd4',
  upperMid: '#4a9ae8',
  midHorizon: '#7ec0f0',
  horizon: '#b8daf8',
  ground: '#0c1828',
  sunColor: '#fffef5',
  // Keep Y modest (not zenith): isometric cameras rarely look straight up, so a high sun
  // never enters the tight cosA cone and reads as “no sun”.
  sunDir: [0.52, 0.32, -0.48],
  sunHalo0: '#ffffff',
  sunHalo1: '#d4ecff',
  sunHalo2: '#7ab8ec',
  cloudWarmth: 0.12,
};

const SKY_BY_ROOM: Record<RoomBorderTheme, SkyThemeUniforms> = {
  green: {
    zenith: '#1e3d5c',
    upperMid: '#3d6a8a',
    midHorizon: '#6a9a7a',
    horizon: '#a8c896',
    ground: '#0a1208',
    sunColor: '#f5f0d5',
    sunDir: [0.45, 0.45, -0.35],
    sunHalo0: '#fff8d8',
    sunHalo1: '#c8d8a0',
    sunHalo2: '#8aa878',
    cloudWarmth: 0.35,
  },
  red: {
    zenith: '#0e0b2a',
    upperMid: '#3a1a5c',
    midHorizon: '#b84010',
    horizon: '#ff7a2a',
    ground: '#0d0704',
    sunColor: '#fff6d0',
    sunDir: [0.6, 0.15, -0.5],
    sunHalo0: '#fff0c8',
    sunHalo1: '#ff8a22',
    sunHalo2: '#c45818',
    cloudWarmth: 1.0,
  },
  blue: {
    zenith: '#0c1520',
    upperMid: '#1a2e44',
    midHorizon: '#3a5568',
    horizon: '#6a7d8a',
    ground: '#040608',
    sunColor: '#c8d8e8',
    sunDir: [0.2, 0.55, -0.25],
    sunHalo0: '#a8c0d8',
    sunHalo1: '#6a8aa0',
    sunHalo2: '#3a4a58',
    cloudWarmth: 0.0,
  },
  purple: {
    zenith: '#120818',
    upperMid: '#2a1050',
    midHorizon: '#5a2088',
    horizon: '#a060c0',
    ground: '#050308',
    sunColor: '#e8d0f8',
    sunDir: [0.5, 0.12, -0.45],
    sunHalo0: '#e0a8ff',
    sunHalo1: '#a040c8',
    sunHalo2: '#601878',
    cloudWarmth: 0.5,
  },
};

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const SKY_VERT = `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SKY_FRAG = `
  // Value noise — no texture lookups, pure math
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
  // 5-octave FBM — fine cloud detail
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * smoothNoise(p);
      p  = p * 2.13 + vec2(0.4, 0.8);
      a *= 0.5;
    }
    return v;
  }
  // 3-octave FBM — domain warp + large-scale formation mask
  float fbm3(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * smoothNoise(p);
      p  = p * 2.13 + vec2(0.4, 0.8);
      a *= 0.5;
    }
    return v;
  }

  uniform vec3  uZenith;
  uniform vec3  uUpperMid;
  uniform vec3  uMidHorizon;
  uniform vec3  uHorizon;
  uniform vec3  uGround;
  uniform vec3  uSunColor;
  uniform vec3  uSunDir;
  uniform vec3  uSunHalo0;
  uniform vec3  uSunHalo1;
  uniform vec3  uSunHalo2;
  uniform float uCloudWarmth;
  uniform float uTime;

  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;

    // ── Gradient ────────────────────────────────────────────────────────────
    vec3 sky = uGround;
    sky = mix(sky, uHorizon,    smoothstep(-0.15, 0.0,  h));
    sky = mix(sky, uMidHorizon, smoothstep( 0.00, 0.20, h) * (1.0 - smoothstep(0.15, 0.45, h)));
    sky = mix(sky, uUpperMid,   smoothstep( 0.12, 0.45, h));
    sky = mix(sky, uZenith,     smoothstep( 0.35, 0.88, h));

    // ── Sun ─────────────────────────────────────────────────────────────────
    float cosA = dot(dir, normalize(uSunDir));
    sky += uSunColor  * smoothstep(0.9994, 0.9998, cosA);
    sky += uSunHalo0 * pow(max(0.0, cosA), 120.0) * 0.60;
    sky += uSunHalo1 * pow(max(0.0, cosA),   8.0) * 0.30;
    sky += uSunHalo2 * pow(max(0.0, cosA),   3.0) * 0.12;

    // ── Clouds (upper dome + under-horizon sea; domain-warped FBM) ──────────
    float yDamp = max(abs(h), 0.07);
    vec2  cUv   = dir.xz / yDamp;

    // Domain warp: two independent 3-oct FBMs displace the UV before sampling,
    // breaking grid-aligned repetition into organic billowing shapes.
    float warpX = fbm3(cUv * 0.09 + vec2(1.70 + uTime * 0.004, 9.20 + uTime * 0.003));
    float warpY = fbm3(cUv * 0.09 + vec2(8.30 + uTime * 0.003, 2.80 + uTime * 0.004));
    vec2  wUv   = cUv + (vec2(warpX, warpY) * 2.0 - 1.0) * 1.1;

    // Large-scale formation mask: slow low-frequency field that creates cloud
    // banks vs. clear sky regions instead of uniform coverage everywhere.
    float macro = smoothstep(0.28, 0.68,
      fbm3(cUv * 0.048 + vec2(uTime * 0.002, uTime * 0.0015))
    );

    // Fine-detail cloud shapes on the warped UVs
    float detail   = fbm(wUv * 0.11 + vec2(uTime * 0.008, uTime * 0.003));
    float rawCloud = detail * (0.60 + 0.60 * macro);
    float cloud    = smoothstep(0.44, 0.72, rawCloud);

    // ── Cloud color ─────────────────────────────────────────────────────────
    float hPos    = max(h, 0.0);
    float warmthH = 1.0 - smoothstep(0.0, 0.38, hPos);
    vec3  cLit    = mix(vec3(0.98, 0.88, 0.72), vec3(1.00, 0.98, 0.96), hPos);
    vec3  cWarm   = mix(cLit, vec3(1.0, 0.60, 0.26), warmthH * 0.65);
    vec3  cCool   = mix(cLit * vec3(0.75, 0.82, 0.95), mix(uMidHorizon, uHorizon, 0.4), 0.55);
    float warmthMix = uCloudWarmth * smoothstep(-0.28, 0.10, h);
    vec3  cBlend  = mix(cCool, cWarm, warmthMix);

    // Lit top / dark belly: thick cloud cores shade their undersides.
    // rawCloud density drives the belly→top gradient so thin edges stay
    // semi-transparent while dense centers have proper atmospheric depth.
    vec3  cBelly  = mix(cBlend * 0.28, cBlend * 0.48, smoothstep(-0.15, 0.15, h));
    vec3  cColor  = mix(cBelly, cBlend * 1.04, smoothstep(0.44, 0.75, rawCloud));

    // Atmospheric haze: clouds just above/below the horizon fade into the
    // sky palette, creating natural depth and a seamless horizon join.
    float hazeT = 1.0 - smoothstep(0.0, 0.22, abs(h));
    cColor = mix(cColor, mix(uHorizon, uMidHorizon, 0.35) * 0.72, hazeT * 0.60);

    // ── Opacity fades ────────────────────────────────────────────────────────
    float cFadeUp  = smoothstep(0.0, 0.10, h) * (1.0 - smoothstep(0.72, 0.94, h));
    float cFadeLow = (1.0 - smoothstep(-0.06, 0.14, h)) * smoothstep(-0.88, -0.12, h);
    float cFade    = max(cFadeUp, cFadeLow * 0.92);

    sky = mix(sky, cColor, cloud * cFade * 0.85);

    // Silver lining: bright rim on sun-facing cloud edges — zero extra samples.
    // cloudEdge peaks at coverage boundaries (cloud * (1-cloud) → 0 at 0 and 1).
    float sunDot    = max(0.0, dot(normalize(dir.xz), uSunDir.xz / max(length(uSunDir.xz), 0.001)));
    float cloudEdge = cloud * (1.0 - cloud) * 4.0;
    sky += uSunHalo1 * (cloudEdge * sunDot * 0.38 * cFade);

    gl_FragColor = vec4(sky, 1.0);
  }
`;

export type CustomSkyPreset = RoomBorderTheme | 'throneBlue';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function skyUniformsForPreset(preset: CustomSkyPreset): SkyThemeUniforms {
  if (preset === 'throneBlue') return SKY_THRONE_BLUE;
  return SKY_BY_ROOM[preset] ?? SKY_BY_ROOM.red;
}

function applySkyTheme(material: ShaderMaterial, preset: CustomSkyPreset) {
  const t = skyUniformsForPreset(preset);
  material.uniforms.uZenith.value.set(t.zenith);
  material.uniforms.uUpperMid.value.set(t.upperMid);
  material.uniforms.uMidHorizon.value.set(t.midHorizon);
  material.uniforms.uHorizon.value.set(t.horizon);
  material.uniforms.uGround.value.set(t.ground);
  material.uniforms.uSunColor.value.set(t.sunColor);
  material.uniforms.uSunDir.value.set(...t.sunDir).normalize();
  material.uniforms.uSunHalo0.value.set(t.sunHalo0);
  material.uniforms.uSunHalo1.value.set(t.sunHalo1);
  material.uniforms.uSunHalo2.value.set(t.sunHalo2);
  material.uniforms.uCloudWarmth.value = t.cloudWarmth;
}

const CustomSky: React.FC<{
  roomTheme?: RoomBorderTheme;
  /** When set, overrides `roomTheme` (e.g. throne prep always uses clear blue sky). */
  skyPreset?: CustomSkyPreset;
  /** When false, cloud FBM stops updating (combat LOD). Defaults to true. */
  animateClouds?: boolean;
}> = ({ roomTheme = 'red', skyPreset, animateClouds = true }) => {
  const effectivePreset: CustomSkyPreset = skyPreset ?? roomTheme;
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uZenith:       { value: new Color() },
          uUpperMid:     { value: new Color() },
          uMidHorizon:   { value: new Color() },
          uHorizon:      { value: new Color() },
          uGround:       { value: new Color() },
          uSunColor:     { value: new Color() },
          uSunDir:       { value: new Vector3(0, 1, 0) },
          uSunHalo0:     { value: new Color() },
          uSunHalo1:     { value: new Color() },
          uSunHalo2:     { value: new Color() },
          uCloudWarmth:  { value: 1.0 },
          uTime:         { value: 0 },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: BackSide,
      }),
    [],
  );

  useLayoutEffect(() => {
    applySkyTheme(material, effectivePreset);
  }, [material, effectivePreset]);

  const geo = useMemo(() => new SphereGeometry(500, 32, 16), []);

  useFrame((_, delta) => {
    if (animateClouds) {
      material.uniforms.uTime.value += delta;
    }
  });

  return <mesh geometry={geo} material={material} />;
};

export default CustomSky;
