import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  CircleGeometry,
  Matrix4,
  Vector3,
  AdditiveBlending,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Glowing ground runes — procedural sigil pattern drawn entirely in GLSL
// Flat circle decals on stone floor, additive blend = gentle arcane glow
// ---------------------------------------------------------------------------

const RUNE_VERT = `
  varying vec2  vUv;
  varying float vSeed;

  void main() {
    vUv  = uv;
    // Encode a unique seed per rune from its world position
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vSeed = floor(wp.x * 0.5) * 17.0 + floor(wp.z * 0.5) * 31.0;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const RUNE_FRAG = `
  uniform float uTime;
  varying vec2  vUv;
  varying float vSeed;

  // ── Helpers ──────────────────────────────────────────────────────────────
  float hash(float n) { return fract(sin(n) * 43758.5453); }

  // Signed distance to a line segment (2-D)
  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
  }

  // Draw a single glyph stroke; returns 0→1 intensity
  float stroke(vec2 p, vec2 a, vec2 b, float w) {
    return 1.0 - smoothstep(w * 0.5, w, sdSegment(p, a, b));
  }

  // Rotate a 2-D vector
  vec2 rot2(vec2 v, float a) {
    float c = cos(a), s = sin(a);
    return vec2(v.x * c - v.y * s, v.x * s + v.y * c);
  }

  void main() {
    // Center UV at (0,0), range −0.5 → +0.5
    vec2 p = vUv - 0.5;

    // Outer circle mask — only render inside the disc
    float outerR = length(p);
    if (outerR > 0.48) discard;

    // Per-rune rotation derived from seed
    float rotAngle = hash(vSeed) * 6.2832;
    p = rot2(p, rotAngle);

    // ── Outer ring ───────────────────────────────────────────────────────
    float ring = abs(outerR - 0.42);
    float ringMask = smoothstep(0.015, 0.003, ring);

    // ── Inner ring ───────────────────────────────────────────────────────
    float innerRing = abs(outerR - 0.25);
    float innerRingMask = smoothstep(0.010, 0.002, innerRing) * 0.6;

    // ── Glyph strokes — 6 radial spokes + 2 cross bars ──────────────────
    float glyph = 0.0;
    int spokes = 6;
    for (int i = 0; i < 6; i++) {
      float a = float(i) / 6.0 * 6.2832;
      vec2 tip = vec2(cos(a), sin(a)) * 0.40;
      // Spoke from inner ring to outer ring
      glyph += stroke(p, vec2(cos(a), sin(a)) * 0.25, tip, 0.020);
      // Small cap notch at tip
      vec2 perp = vec2(-sin(a), cos(a)) * 0.06;
      glyph += stroke(p, tip - perp, tip + perp, 0.015) * 0.6;
    }

    // Cross bars at 30° offset
    for (int i = 0; i < 3; i++) {
      float a = float(i) / 3.0 * 6.2832 + 1.047;
      vec2 a0 = vec2(cos(a), sin(a)) * 0.30;
      vec2 a1 = vec2(cos(a + 2.094), sin(a + 2.094)) * 0.30;
      glyph += stroke(p, a0, a1, 0.015) * 0.55;
    }

    // Center dot
    float center = smoothstep(0.06, 0.01, length(p)) * 0.9;

    float mask = clamp(ringMask + innerRingMask + glyph + center, 0.0, 1.0);

    // Pulse — each rune breathes at a slightly different rate
    float rate  = 0.8 + hash(vSeed + 1.0) * 0.9;
    float pulse = 0.45 + sin(uTime * rate + hash(vSeed) * 6.28) * 0.55;

    // Color: cycle between violet and teal based on seed
    float hue = hash(vSeed + 2.0);
    vec3 runeA = vec3(0.55, 0.10, 0.95); // violet
    vec3 runeB = vec3(0.05, 0.82, 0.88); // teal
    vec3 col = mix(runeA, runeB, hue);

    float alpha = mask * pulse * 0.75;

    // Fade edge of disc
    alpha *= 1.0 - smoothstep(0.35, 0.48, outerR);

    gl_FragColor = vec4(col, alpha);
  }
`;

const RUNE_COUNT = 30;

// Placed on stone ground near camps and path intersections
const RUNE_CLUSTERS: [number, number][] = [
  [  0,   0 ], // arena center
  [  0, -22 ], // North camp
  [ 22,   8 ], // East camp
  [-22,   8 ], // West camp
  [  0, -11 ], // path midpoint N
  [ 11,   4 ], // path midpoint E
  [-11,   4 ], // path midpoint W
];

const InstancedRunes: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  const geo = useMemo(() => new CircleGeometry(1, 24), []);

  const mat = useMemo(() => new ShaderMaterial({
    uniforms:       { uTime: { value: 0 } },
    vertexShader:   RUNE_VERT,
    fragmentShader: RUNE_FRAG,
    transparent:    true,
    depthWrite:     false,
    blending:       AdditiveBlending,
  }), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const m   = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < RUNE_COUNT; i++) {
      const cluster = RUNE_CLUSTERS[i % RUNE_CLUSTERS.length];
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 4.5;
      pos.set(cluster[0] + Math.cos(a) * r, 0.03, cluster[1] + Math.sin(a) * r);

      const s = 0.8 + Math.random() * 2.2;
      m.makeRotationX(-Math.PI / 2); // lay flat on ground
      scl.set(s, s, 1);
      m.scale(scl);
      m.setPosition(pos);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, RUNE_COUNT]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
};

export default React.memo(InstancedRunes);
