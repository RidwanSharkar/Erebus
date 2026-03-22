import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { ShaderMaterial, SphereGeometry, Vector3, Color, BackSide } from '@/utils/three-exports';

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
  // Value noise helpers — no texture lookups, pure math
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
  // 5-octave FBM for soft fluffy clouds
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
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
    sky += uSunColor             * smoothstep(0.9994, 0.9998, cosA);          // hard disk
    sky += vec3(1.0, 0.85, 0.55) * pow(max(0.0, cosA), 120.0) * 0.60;       // inner glow
    sky += vec3(1.0, 0.52, 0.12) * pow(max(0.0, cosA),   8.0) * 0.30;       // outer glow
    sky += vec3(0.9, 0.38, 0.08) * pow(max(0.0, cosA),   3.0) * 0.12;       // atmosphere scatter

    // ── Clouds ──────────────────────────────────────────────────────────────
    if (h > -0.02) {
      float yDamp  = max(dir.y, 0.08);
      vec2  cUv    = dir.xz / yDamp;

      // Two cloud layers at different altitudes / speeds
      float c1 = fbm(cUv * 0.11 + vec2( uTime * 0.008,  uTime * 0.003));
      float c2 = fbm(cUv * 0.19 + vec2( uTime * 0.013, -uTime * 0.005)) * 0.55;
      float cloud = smoothstep(0.47, 0.73, c1 + c2 * 0.35);

      // Warm sunset tint on clouds — lower = more orange
      float warmth = 1.0 - smoothstep(0.0, 0.38, h);
      vec3  cLit   = mix(vec3(0.98, 0.88, 0.72), vec3(1.00, 0.98, 0.96), h);
      vec3  cWarm  = mix(cLit, vec3(1.0, 0.60, 0.26), warmth * 0.65);
      // Dark belly effect
      vec3  cColor = mix(cWarm * 0.42, cWarm, 0.62);

      float cFade = smoothstep(0.0, 0.10, h) * (1.0 - smoothstep(0.72, 0.94, h));
      sky = mix(sky, cColor, cloud * cFade * 0.82);
    }

    gl_FragColor = vec4(sky, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const CustomSky: React.FC = () => {
  const material = useMemo(() => new ShaderMaterial({
    uniforms: {
      uZenith:     { value: new Color('#0e0b2a') }, // deep purple-blue zenith
      uUpperMid:   { value: new Color('#3a1a5c') }, // warm purple upper sky
      uMidHorizon: { value: new Color('#b84010') }, // orange-red band
      uHorizon:    { value: new Color('#ff7a2a') }, // bright gold-orange horizon
      uGround:     { value: new Color('#0d0704') }, // below horizon
      uSunColor:   { value: new Color('#fff6d0') }, // warm white sun disk
      uSunDir:     { value: new Vector3(0.6, 0.15, -0.5).normalize() }, // low evening sun
      uTime:       { value: 0 },
    },
    vertexShader:   SKY_VERT,
    fragmentShader: SKY_FRAG,
    side: BackSide,
  }), []);

  const geo = useMemo(() => new SphereGeometry(500, 32, 16), []);

  // Animate clouds
  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });

  return <mesh geometry={geo} material={material} />;
};

export default CustomSky;
