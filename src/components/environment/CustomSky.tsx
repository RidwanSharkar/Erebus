import React, { useMemo, useLayoutEffect, useEffect } from 'react';
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
  /**
   * Nadir color below `ground`. When omitted, defaults to `ground` (identical legacy look).
   * Throne cloud-sea presets set a deeper abyss so the void has depth.
   */
  abyss?: string;
  /**
   * 0 = dark under-horizon cloud bellies (legacy). Higher = keep under-horizon clouds lit
   * so they read as a sunlit cloud ocean. Defaults to 0.
   */
  underLit?: number;
};

/** Soft pink Fae Realm sky — distinct from purple Dream Layer. */
export const SKY_FAE_REALM: SkyThemeUniforms = {
  zenith: '#5a1848',
  upperMid: '#a04078',
  midHorizon: '#e878a8',
  horizon: '#f8c8dc',
  ground: '#1a0a14',
  sunColor: '#fff0f8',
  sunDir: [0.48, 0.3, -0.42],
  sunHalo0: '#ffe8f4',
  sunHalo1: '#f0a0c8',
  sunHalo2: '#c06090',
  cloudWarmth: 0.65,
};

/** Twilight holy sanctum — Inner Sanctum castle rooms (warmer/lighter than purple combat). */
export const SKY_SANCTUM_HOLY: SkyThemeUniforms = {
  zenith: '#2a1838',
  upperMid: '#4a2868',
  midHorizon: '#8a58a8',
  horizon: '#d4b8e8',
  ground: '#1a1420',
  sunColor: '#fff4d8',
  sunDir: [0.5, 0.28, -0.45],
  sunHalo0: '#fff0c8',
  sunHalo1: '#e8c8f0',
  sunHalo2: '#a878c8',
  cloudWarmth: 0.72,
};

/** Underwater sunken temple — deep teal murk with faint god-rays from above. */
export const SKY_SUNKEN_TEMPLE: SkyThemeUniforms = {
  zenith: '#0a2838',
  upperMid: '#1a4868',
  midHorizon: '#2a6888',
  horizon: '#4a98a8',
  ground: '#051820',
  sunColor: '#a0e8ff',
  sunDir: [0.3, 0.6, -0.2],
  sunHalo0: '#c8f0ff',
  sunHalo1: '#68c8e8',
  sunHalo2: '#2a7898',
  cloudWarmth: 0.0,
};

/** Warm autumn amber sky — Eternity's Palace hex rooms. */
export const SKY_ETERNITY_PALACE: SkyThemeUniforms = {
  zenith: '#4a2818',
  upperMid: '#8a4820',
  midHorizon: '#c87830',
  horizon: '#f0b878',
  ground: '#2a1810',
  sunColor: '#fff0d0',
  sunDir: [0.42, 0.32, -0.5],
  sunHalo0: '#ffe8b0',
  sunHalo1: '#f0a858',
  sunHalo2: '#c86828',
  cloudWarmth: 0.92,
};

/** Warm dusty colosseum sky — Erebus Gate surprise arena. */
export const SKY_COLOSSEUM: SkyThemeUniforms = {
  zenith: '#6a5038',
  upperMid: '#9a7858',
  midHorizon: '#c8a878',
  horizon: '#e8d4b0',
  ground: '#2a2018',
  sunColor: '#fff8e8',
  sunDir: [0.45, 0.35, -0.55],
  sunHalo0: '#fff0c0',
  sunHalo1: '#e8c898',
  sunHalo2: '#b88858',
  cloudWarmth: 0.88,
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
  // Celestial cloud sea: deep nadir + lit under-horizon bank so the void isn't flat black.
  abyss: '#04101f',
  underLit: 0.85,
};

/** Crypt of Currency (trial) — light blue sky, clearer than combat room skies. */
export const SKY_TRIAL_LIGHT_BLUE: SkyThemeUniforms = {
  zenith: '#4a9ae8',
  upperMid: '#6eb4f0',
  midHorizon: '#94c8f4',
  horizon: '#b8daf8',
  ground: '#0c1828',
  sunColor: '#fffef5',
  sunDir: [0.5, 0.35, -0.45],
  sunHalo0: '#ffffff',
  sunHalo1: '#d4ecff',
  sunHalo2: '#7ab8ec',
  cloudWarmth: 0.1,
};

/** Abyssal (purple) gate — complementary light red / coral sky. */
export const SKY_GATE_LIGHT_RED: SkyThemeUniforms = {
  zenith: '#c86868',
  upperMid: '#e08888',
  midHorizon: '#f0a8a0',
  horizon: '#f8d0c8',
  ground: '#281010',
  sunColor: '#fff8f0',
  sunDir: [0.5, 0.35, -0.45],
  sunHalo0: '#fff0e8',
  sunHalo1: '#f0a090',
  sunHalo2: '#d06858',
  cloudWarmth: 0.7,
};

/** Tempest (blue) gate — complementary light orange / peach sky. */
export const SKY_GATE_LIGHT_ORANGE: SkyThemeUniforms = {
  zenith: '#d88848',
  upperMid: '#e8a068',
  midHorizon: '#f0c088',
  horizon: '#f8e0b8',
  ground: '#281808',
  sunColor: '#fff8e8',
  sunDir: [0.5, 0.35, -0.45],
  sunHalo0: '#fff0d0',
  sunHalo1: '#f0b878',
  sunHalo2: '#d88848',
  cloudWarmth: 0.85,
};

/** Eldritch (green) gate — complementary light green / mint sky. */
export const SKY_GATE_LIGHT_GREEN: SkyThemeUniforms = {
  zenith: '#68a878',
  upperMid: '#88c098',
  midHorizon: '#a8d8b0',
  horizon: '#d0f0d8',
  ground: '#102018',
  sunColor: '#f8fff0',
  sunDir: [0.5, 0.35, -0.45],
  sunHalo0: '#f0ffe8',
  sunHalo1: '#b0e0b8',
  sunHalo2: '#78b888',
  cloudWarmth: 0.3,
};

/** Throne prep — soft light purple / lavender (brighter than combat purple). */
export const SKY_THRONE_LIGHT_PURPLE: SkyThemeUniforms = {
  zenith: '#8870b8',
  upperMid: '#a890d0',
  midHorizon: '#c8b0e8',
  horizon: '#e8dcf8',
  ground: '#181028',
  sunColor: '#fff8ff',
  sunDir: [0.5, 0.35, -0.45],
  sunHalo0: '#f8f0ff',
  sunHalo1: '#d0b8f0',
  sunHalo2: '#a888d0',
  cloudWarmth: 0.4,
};

/** Honey gold — warm midday amber. */
export const SKY_HONEY_GOLD: SkyThemeUniforms = {
  zenith: '#8a6820',
  upperMid: '#c89838',
  midHorizon: '#e8c058',
  horizon: '#f8e8a8',
  ground: '#201808',
  sunColor: '#fff8e0',
  sunDir: [0.48, 0.34, -0.48],
  sunHalo0: '#fff4c8',
  sunHalo1: '#f0d070',
  sunHalo2: '#c89830',
  cloudWarmth: 0.88,
};

/** Burnt sienna — deep copper dusk. */
export const SKY_BURNT_SIENNA: SkyThemeUniforms = {
  zenith: '#5a2818',
  upperMid: '#8a4028',
  midHorizon: '#c86840',
  horizon: '#e8a078',
  ground: '#180c08',
  sunColor: '#fff0e0',
  sunDir: [0.55, 0.22, -0.5],
  sunHalo0: '#ffe0c0',
  sunHalo1: '#e88858',
  sunHalo2: '#a84828',
  cloudWarmth: 0.95,
};

/** Apricot dawn — soft peach sunrise. */
export const SKY_APRICOT_DAWN: SkyThemeUniforms = {
  zenith: '#c87058',
  upperMid: '#e09870',
  midHorizon: '#f0c098',
  horizon: '#f8e0c8',
  ground: '#201410',
  sunColor: '#fff8f0',
  sunDir: [0.5, 0.3, -0.45],
  sunHalo0: '#fff0e0',
  sunHalo1: '#f0b888',
  sunHalo2: '#d88058',
  cloudWarmth: 0.8,
};

/** Dusty rose — muted pink twilight. */
export const SKY_DUSTY_ROSE: SkyThemeUniforms = {
  zenith: '#784858',
  upperMid: '#a07080',
  midHorizon: '#c8a0a8',
  horizon: '#e8d0d4',
  ground: '#180c10',
  sunColor: '#fff4f8',
  sunDir: [0.46, 0.32, -0.48],
  sunHalo0: '#ffe8f0',
  sunHalo1: '#d8a0b0',
  sunHalo2: '#a06878',
  cloudWarmth: 0.55,
};

/** Teal dawn — cool turquoise morning. */
export const SKY_TEAL_DAWN: SkyThemeUniforms = {
  zenith: '#184868',
  upperMid: '#287898',
  midHorizon: '#48a8b8',
  horizon: '#88d0d8',
  ground: '#081418',
  sunColor: '#f0fffc',
  sunDir: [0.4, 0.4, -0.4],
  sunHalo0: '#e0fff8',
  sunHalo1: '#70c8d0',
  sunHalo2: '#3890a0',
  cloudWarmth: 0.15,
};

/** Arctic mint — icy pale green. */
export const SKY_ARCTIC_MINT: SkyThemeUniforms = {
  zenith: '#286858',
  upperMid: '#489878',
  midHorizon: '#78c8a8',
  horizon: '#b8e8d0',
  ground: '#081410',
  sunColor: '#f4fff8',
  sunDir: [0.42, 0.38, -0.42],
  sunHalo0: '#e8fff0',
  sunHalo1: '#90d8b8',
  sunHalo2: '#50a888',
  cloudWarmth: 0.08,
};

/** Steel blue — cold industrial dusk. */
export const SKY_STEEL_BLUE: SkyThemeUniforms = {
  zenith: '#1a3048',
  upperMid: '#385878',
  midHorizon: '#587898',
  horizon: '#98b0c8',
  ground: '#081018',
  sunColor: '#e8f0f8',
  sunDir: [0.35, 0.42, -0.35],
  sunHalo0: '#d0e0f0',
  sunHalo1: '#7898b0',
  sunHalo2: '#486078',
  cloudWarmth: 0.05,
};

/** Twilight cyan — luminous blue-green nightfall. */
export const SKY_TWILIGHT_CYAN: SkyThemeUniforms = {
  zenith: '#0a3858',
  upperMid: '#186888',
  midHorizon: '#2898b8',
  horizon: '#58c8e0',
  ground: '#041018',
  sunColor: '#e0f8ff',
  sunDir: [0.38, 0.36, -0.45],
  sunHalo0: '#c8f0ff',
  sunHalo1: '#48b0d0',
  sunHalo2: '#187898',
  cloudWarmth: 0.1,
};

/** Electric violet — neon purple night. */
export const SKY_ELECTRIC_VIOLET: SkyThemeUniforms = {
  zenith: '#281060',
  upperMid: '#5020a0',
  midHorizon: '#8040e0',
  horizon: '#b888f8',
  ground: '#0c0820',
  sunColor: '#f0e8ff',
  sunDir: [0.5, 0.2, -0.48],
  sunHalo0: '#e0d0ff',
  sunHalo1: '#a070f0',
  sunHalo2: '#6830c0',
  cloudWarmth: 0.35,
};

/** Magenta bloom — hot pink zenith. */
export const SKY_MAGENTA_BLOOM: SkyThemeUniforms = {
  zenith: '#781848',
  upperMid: '#b02878',
  midHorizon: '#e048a8',
  horizon: '#f8a0d0',
  ground: '#180810',
  sunColor: '#fff0f8',
  sunDir: [0.48, 0.28, -0.45],
  sunHalo0: '#ffe0f0',
  sunHalo1: '#e070b0',
  sunHalo2: '#a02870',
  cloudWarmth: 0.6,
};

/** Lime aurora — vivid yellow-green. */
export const SKY_LIME_AURORA: SkyThemeUniforms = {
  zenith: '#386818',
  upperMid: '#68a028',
  midHorizon: '#98d048',
  horizon: '#c8f080',
  ground: '#0c1808',
  sunColor: '#f8ffe0',
  sunDir: [0.44, 0.38, -0.4],
  sunHalo0: '#f0ffc8',
  sunHalo1: '#a8e058',
  sunHalo2: '#68a828',
  cloudWarmth: 0.4,
};

/** Cherry sunset — deep crimson evening. */
export const SKY_CHERRY_SUNSET: SkyThemeUniforms = {
  zenith: '#581018',
  upperMid: '#982028',
  midHorizon: '#d04048',
  horizon: '#f88880',
  ground: '#180808',
  sunColor: '#fff0e8',
  sunDir: [0.58, 0.18, -0.48],
  sunHalo0: '#ffd8c8',
  sunHalo1: '#e06058',
  sunHalo2: '#a02828',
  cloudWarmth: 0.9,
};

/** Charcoal amber — dark sky with warm horizon. */
export const SKY_CHARCOAL_AMBER: SkyThemeUniforms = {
  zenith: '#181410',
  upperMid: '#383028',
  midHorizon: '#886028',
  horizon: '#d0a050',
  ground: '#0c0804',
  sunColor: '#fff0d0',
  sunDir: [0.55, 0.2, -0.5],
  sunHalo0: '#ffe8b0',
  sunHalo1: '#c88840',
  sunHalo2: '#785018',
  cloudWarmth: 0.85,
};

/** Deep wine — burgundy dusk. */
export const SKY_DEEP_WINE: SkyThemeUniforms = {
  zenith: '#381018',
  upperMid: '#582030',
  midHorizon: '#884058',
  horizon: '#c08090',
  ground: '#100808',
  sunColor: '#fff0f0',
  sunDir: [0.5, 0.25, -0.48],
  sunHalo0: '#ffe0e8',
  sunHalo1: '#b06070',
  sunHalo2: '#682038',
  cloudWarmth: 0.7,
};

/** Storm slate — grey stormfront. */
export const SKY_STORM_SLATE: SkyThemeUniforms = {
  zenith: '#283038',
  upperMid: '#485058',
  midHorizon: '#687078',
  horizon: '#a0a8b0',
  ground: '#0c1014',
  sunColor: '#e8ecf0',
  sunDir: [0.3, 0.45, -0.35],
  sunHalo0: '#d0d8e0',
  sunHalo1: '#889098',
  sunHalo2: '#505860',
  cloudWarmth: 0.15,
};

/** Ember dusk — dark sky with glowing orange belly. */
export const SKY_EMBER_DUSK: SkyThemeUniforms = {
  zenith: '#180c18',
  upperMid: '#381828',
  midHorizon: '#a84818',
  horizon: '#f08830',
  ground: '#0c0604',
  sunColor: '#fff0c8',
  sunDir: [0.6, 0.12, -0.5],
  sunHalo0: '#ffe0a0',
  sunHalo1: '#e87028',
  sunHalo2: '#983818',
  cloudWarmth: 1.0,
};

/** Sapphire noon — rich clear blue. */
export const SKY_SAPPHIRE_NOON: SkyThemeUniforms = {
  zenith: '#1040a0',
  upperMid: '#2870c8',
  midHorizon: '#58a0e0',
  horizon: '#a0d0f8',
  ground: '#081428',
  sunColor: '#fffef8',
  sunDir: [0.5, 0.36, -0.45],
  sunHalo0: '#ffffff',
  sunHalo1: '#90c0f0',
  sunHalo2: '#4880c8',
  cloudWarmth: 0.12,
};

/** Verdant haze — soft olive-green. */
export const SKY_VERDANT_HAZE: SkyThemeUniforms = {
  zenith: '#284828',
  upperMid: '#487048',
  midHorizon: '#78a068',
  horizon: '#b0d098',
  ground: '#0c1408',
  sunColor: '#f8ffe8',
  sunDir: [0.42, 0.4, -0.4],
  sunHalo0: '#f0ffd8',
  sunHalo1: '#98c080',
  sunHalo2: '#588048',
  cloudWarmth: 0.35,
};

/** Indigo night — deep blue-violet. */
export const SKY_INDIGO_NIGHT: SkyThemeUniforms = {
  zenith: '#101838',
  upperMid: '#202860',
  midHorizon: '#3840a0',
  horizon: '#6870d0',
  ground: '#060810',
  sunColor: '#e8e8ff',
  sunDir: [0.45, 0.28, -0.5],
  sunHalo0: '#d0d0ff',
  sunHalo1: '#6870c8',
  sunHalo2: '#3838a0',
  cloudWarmth: 0.2,
};

/** Coral reef — bright tropical coral. */
export const SKY_CORAL_REEF: SkyThemeUniforms = {
  zenith: '#c85060',
  upperMid: '#e07880',
  midHorizon: '#f0a8a0',
  horizon: '#f8d8c8',
  ground: '#201010',
  sunColor: '#fff8f0',
  sunDir: [0.48, 0.32, -0.45],
  sunHalo0: '#ffe8e0',
  sunHalo1: '#f09088',
  sunHalo2: '#d05860',
  cloudWarmth: 0.75,
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
  uniform vec3  uAbyss;
  uniform vec3  uSunColor;
  uniform vec3  uSunDir;
  uniform vec3  uSunHalo0;
  uniform vec3  uSunHalo1;
  uniform vec3  uSunHalo2;
  uniform float uCloudWarmth;
  uniform float uUnderLit;
  uniform float uTime;

  varying vec3 vDir;

  void main() {
    vec3 dir = normalize(vDir);
    float h = dir.y;

    // ── Gradient (two-stop nadir so the void has depth) ─────────────────────
    vec3 deep = mix(uAbyss, uGround, smoothstep(-0.85, -0.20, h));
    vec3 sky = deep;
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
    // uUnderLit keeps under-horizon clouds bright (throne cloud-sea look).
    float underKeep = uUnderLit * smoothstep(-0.55, -0.02, h);
    vec3  cBelly  = mix(
      mix(cBlend * 0.28, cBlend * 0.48, smoothstep(-0.15, 0.15, h)),
      cBlend * 0.90,
      underKeep
    );
    vec3  cColor  = mix(cBelly, cBlend * 1.04, smoothstep(0.44, 0.75, rawCloud));

    // Atmospheric haze: clouds just above/below the horizon fade into the
    // sky palette, creating natural depth and a seamless horizon join.
    float hazeT = 1.0 - smoothstep(0.0, 0.22, abs(h));
    cColor = mix(cColor, mix(uHorizon, uMidHorizon, 0.35) * 0.72, hazeT * 0.60);

    // ── Opacity fades (extend under-horizon reach for cloud-sea continuity) ─
    float cFadeUp  = smoothstep(0.0, 0.10, h) * (1.0 - smoothstep(0.72, 0.94, h));
    float cFadeLow = (1.0 - smoothstep(-0.06, 0.14, h)) * smoothstep(-0.95, -0.08, h);
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

export type CustomSkyPreset =
  | RoomBorderTheme
  | 'throneBlue'
  | 'throneLightPurple'
  | 'sanctumHoly'
  | 'sunkenTemple'
  | 'eternityPalace'
  | 'colosseum'
  | 'trialLightBlue'
  | 'gateLightRed'
  | 'gateLightOrange'
  | 'gateLightGreen'
  | 'faeRealm'
  | 'honeyGold'
  | 'burntSienna'
  | 'apricotDawn'
  | 'dustyRose'
  | 'tealDawn'
  | 'arcticMint'
  | 'steelBlue'
  | 'twilightCyan'
  | 'electricViolet'
  | 'magentaBloom'
  | 'limeAurora'
  | 'cherrySunset'
  | 'charcoalAmber'
  | 'deepWine'
  | 'stormSlate'
  | 'emberDusk'
  | 'sapphireNoon'
  | 'verdantHaze'
  | 'indigoNight'
  | 'coralReef';

/** Complementary light sky per gate/camp color (main combat rooms). */
export const GATE_SKY_PRESET_BY_THEME: Record<RoomBorderTheme, CustomSkyPreset> = {
  purple: 'gateLightRed',
  blue: 'gateLightOrange',
  green: 'gateLightGreen',
  red: 'trialLightBlue',
};

/**
 * Server-authoritative random sky pool (excludes sunkenTemple).
 * Keep count in sync with `COOP_RANDOM_SKY_PRESET_COUNT` in backend/coopSkyPresets.js.
 */
export const RANDOM_SKY_PRESETS: readonly CustomSkyPreset[] = [
  'throneBlue',
  'throneLightPurple',
  'sanctumHoly',
  'eternityPalace',
  'colosseum',
  'trialLightBlue',
  'gateLightRed',
  'gateLightOrange',
  'gateLightGreen',
  'faeRealm',
  'green',
  'red',
  'blue',
  'purple',
  'honeyGold',
  'burntSienna',
  'apricotDawn',
  'dustyRose',
  'tealDawn',
  'arcticMint',
  'steelBlue',
  'twilightCyan',
  'electricViolet',
  'magentaBloom',
  'limeAurora',
  'cherrySunset',
  'charcoalAmber',
  'deepWine',
  'stormSlate',
  'emberDusk',
  'sapphireNoon',
  'verdantHaze',
  'indigoNight',
  'coralReef',
] as const;

export const RANDOM_SKY_PRESET_COUNT = RANDOM_SKY_PRESETS.length;

export function resolveSkyPresetByIndex(index: number): CustomSkyPreset {
  const n = RANDOM_SKY_PRESET_COUNT;
  if (n <= 0) return 'throneBlue';
  const i = Number.isFinite(index) ? Math.floor(index) : 0;
  const wrapped = ((i % n) + n) % n;
  return RANDOM_SKY_PRESETS[wrapped] ?? 'throneBlue';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
function skyUniformsForPreset(preset: CustomSkyPreset): SkyThemeUniforms {
  if (preset === 'throneBlue') return SKY_THRONE_BLUE;
  if (preset === 'throneLightPurple') return SKY_THRONE_LIGHT_PURPLE;
  if (preset === 'sanctumHoly') return SKY_SANCTUM_HOLY;
  if (preset === 'sunkenTemple') return SKY_SUNKEN_TEMPLE;
  if (preset === 'eternityPalace') return SKY_ETERNITY_PALACE;
  if (preset === 'colosseum') return SKY_COLOSSEUM;
  if (preset === 'trialLightBlue') return SKY_TRIAL_LIGHT_BLUE;
  if (preset === 'gateLightRed') return SKY_GATE_LIGHT_RED;
  if (preset === 'gateLightOrange') return SKY_GATE_LIGHT_ORANGE;
  if (preset === 'gateLightGreen') return SKY_GATE_LIGHT_GREEN;
  if (preset === 'faeRealm') return SKY_FAE_REALM;
  if (preset === 'honeyGold') return SKY_HONEY_GOLD;
  if (preset === 'burntSienna') return SKY_BURNT_SIENNA;
  if (preset === 'apricotDawn') return SKY_APRICOT_DAWN;
  if (preset === 'dustyRose') return SKY_DUSTY_ROSE;
  if (preset === 'tealDawn') return SKY_TEAL_DAWN;
  if (preset === 'arcticMint') return SKY_ARCTIC_MINT;
  if (preset === 'steelBlue') return SKY_STEEL_BLUE;
  if (preset === 'twilightCyan') return SKY_TWILIGHT_CYAN;
  if (preset === 'electricViolet') return SKY_ELECTRIC_VIOLET;
  if (preset === 'magentaBloom') return SKY_MAGENTA_BLOOM;
  if (preset === 'limeAurora') return SKY_LIME_AURORA;
  if (preset === 'cherrySunset') return SKY_CHERRY_SUNSET;
  if (preset === 'charcoalAmber') return SKY_CHARCOAL_AMBER;
  if (preset === 'deepWine') return SKY_DEEP_WINE;
  if (preset === 'stormSlate') return SKY_STORM_SLATE;
  if (preset === 'emberDusk') return SKY_EMBER_DUSK;
  if (preset === 'sapphireNoon') return SKY_SAPPHIRE_NOON;
  if (preset === 'verdantHaze') return SKY_VERDANT_HAZE;
  if (preset === 'indigoNight') return SKY_INDIGO_NIGHT;
  if (preset === 'coralReef') return SKY_CORAL_REEF;
  return SKY_BY_ROOM[preset] ?? SKY_BY_ROOM.red;
}

function applySkyTheme(material: ShaderMaterial, preset: CustomSkyPreset) {
  const t = skyUniformsForPreset(preset);
  material.uniforms.uZenith.value.set(t.zenith);
  material.uniforms.uUpperMid.value.set(t.upperMid);
  material.uniforms.uMidHorizon.value.set(t.midHorizon);
  material.uniforms.uHorizon.value.set(t.horizon);
  material.uniforms.uGround.value.set(t.ground);
  // Default abyss=ground + underLit=0 → identical legacy look for all non-throne presets.
  material.uniforms.uAbyss.value.set(t.abyss ?? t.ground);
  material.uniforms.uSunColor.value.set(t.sunColor);
  material.uniforms.uSunDir.value.set(...t.sunDir).normalize();
  material.uniforms.uSunHalo0.value.set(t.sunHalo0);
  material.uniforms.uSunHalo1.value.set(t.sunHalo1);
  material.uniforms.uSunHalo2.value.set(t.sunHalo2);
  material.uniforms.uCloudWarmth.value = t.cloudWarmth;
  material.uniforms.uUnderLit.value = t.underLit ?? 0;
}

const CustomSky: React.FC<{
  roomTheme?: RoomBorderTheme;
  /** When set, overrides `roomTheme` (e.g. throne prep always uses clear blue sky). */
  skyPreset?: CustomSkyPreset;
  /**
   * Server-authoritative random sky index. When set (including 0), overrides
   * `skyPreset` / `roomTheme` via `resolveSkyPresetByIndex`.
   */
  skyPresetIndex?: number;
  /** When false, cloud FBM stops updating (combat LOD). Defaults to true. */
  animateClouds?: boolean;
}> = ({ roomTheme = 'red', skyPreset, skyPresetIndex, animateClouds = true }) => {
  const effectivePreset: CustomSkyPreset =
    skyPresetIndex != null
      ? resolveSkyPresetByIndex(skyPresetIndex)
      : (skyPreset ?? roomTheme);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uZenith:       { value: new Color() },
          uUpperMid:     { value: new Color() },
          uMidHorizon:   { value: new Color() },
          uHorizon:      { value: new Color() },
          uGround:       { value: new Color() },
          uAbyss:        { value: new Color() },
          uSunColor:     { value: new Color() },
          uSunDir:       { value: new Vector3(0, 1, 0) },
          uSunHalo0:     { value: new Color() },
          uSunHalo1:     { value: new Color() },
          uSunHalo2:     { value: new Color() },
          uCloudWarmth:  { value: 1.0 },
          uUnderLit:     { value: 0 },
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

  useEffect(() => {
    return () => {
      geo.dispose();
      material.dispose();
    };
  }, [geo, material]);

  useFrame((_, delta) => {
    if (animateClouds) {
      material.uniforms.uTime.value += delta;
    }
  });

  return <mesh geometry={geo} material={material} />;
};

export default React.memo(CustomSky);
