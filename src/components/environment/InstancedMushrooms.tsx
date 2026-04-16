import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  CylinderGeometry,
  Matrix4,
  Vector3,
  Color,
  DoubleSide,
  AdditiveBlending,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Bioluminescent mushrooms — stem + cap instanced separately, 2 draw calls
// Glow pulses via uTime — teal/violet palette fits the dark fantasy theme
// ---------------------------------------------------------------------------

const STEM_VERT = `
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vHeight   = position.y; // -0.5→+0.5 in cylinder local space
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const STEM_FRAG = `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    // Pale cream-teal stem base
    vec3 stemLow  = vec3(0.60, 0.72, 0.62);
    vec3 stemHigh = vec3(0.78, 0.92, 0.80);
    vec3 col = mix(stemLow, stemHigh, vHeight + 0.5);

    // Subtle banding
    col *= 0.88 + sin(vHeight * 18.0 + vWorldPos.x * 6.0) * 0.06;

    // Pulse emission from interior veins
    float pulse = 0.55 + sin(uTime * 1.8 + vWorldPos.x * 3.1 + vWorldPos.z * 2.7) * 0.45;
    vec3 glow = vec3(0.10, 0.85, 0.78) * pulse * 0.35;
    col += glow;

    // Darken base (ground AO)
    col *= 0.5 + smoothstep(-0.5, 0.2, vHeight) * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const CAP_VERT = `
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vHeight   = position.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CAP_FRAG = `
  uniform float uTime;
  uniform vec3  uCapColor;
  varying vec3  vWorldPos;
  varying float vHeight;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // Base cap color — vivid violet / deep teal, seeded per mushroom by world pos
    float seed = floor(vWorldPos.x * 0.35) + floor(vWorldPos.z * 0.35) * 17.0;
    float variant = hash(vec2(seed, seed + 3.7));
    vec3 col = mix(uCapColor, vec3(0.15, 0.72, 0.85), variant * 0.5);

    // Spots pattern on top face
    vec2 uv = vWorldPos.xz * 2.1;
    float spot = smoothstep(0.36, 0.28, length(fract(uv) - 0.5)) * 0.45;
    col += vec3(0.9, 0.9, 0.95) * spot;

    // Bioluminescent pulse underneath (negative vHeight = cap underside)
    float underside = smoothstep(0.1, -0.35, vHeight);
    float pulse = 0.5 + sin(uTime * 2.1 + seed) * 0.5;
    col += vec3(0.08, 0.95, 0.82) * underside * pulse * 0.55;

    // Rim lighting from below
    col *= 0.7 + smoothstep(0.0, 0.5, vHeight) * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const SHROOM_COUNT  = 80;
const INNER_RADIUS  = 11; // inside forest ring
const OUTER_RADIUS  = 26;

const InstancedMushrooms: React.FC = () => {
  const stemRef = useRef<InstancedMesh>(null);
  const capRef  = useRef<InstancedMesh>(null);

  const stemGeo = useMemo(() => new CylinderGeometry(0.06, 0.09, 0.32, 7, 2), []);
  // Toadstool cap: wide at top (0.28), narrow at bottom edge (0.05), thin disc
  const capGeo  = useMemo(() => new CylinderGeometry(0.05, 0.28, 0.12, 10, 1), []);

  const stemMat = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader:   STEM_VERT,
    fragmentShader: STEM_FRAG,
    side: DoubleSide,
  }), []);

  const capMat = useMemo(() => new ShaderMaterial({
    uniforms: {
      uTime:    { value: 0 },
      uCapColor: { value: new Color('#7c22d4') },
    },
    vertexShader:   CAP_VERT,
    fragmentShader: CAP_FRAG,
    side: DoubleSide,
  }), []);

  useEffect(() => {
    const stem = stemRef.current;
    const cap  = capRef.current;
    if (!stem || !cap) return;

    const m   = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < SHROOM_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r     = INNER_RADIUS + Math.random() * (OUTER_RADIUS - INNER_RADIUS);
      const x     = Math.cos(angle) * r;
      const z     = Math.sin(angle) * r;

      // Random height: tiny fairy shrooms to knee-high
      const h  = 0.18 + Math.random() * 0.55;
      const cr = 0.7 + Math.random() * 1.4; // cap relative size

      // Stem
      scl.set(1, h / 0.32, 1);
      m.makeScale(scl.x, scl.y, scl.z);
      pos.set(x, h * 0.5, z);
      m.setPosition(pos);
      stem.setMatrixAt(i, m);

      // Cap sits on top of stem
      scl.set(cr, h * 0.5, cr);
      m.makeScale(scl.x, scl.y, scl.z);
      pos.set(x, h + 0.04 * h, z);
      m.setPosition(pos);
      cap.setMatrixAt(i, m);
    }

    stem.instanceMatrix.needsUpdate = true;
    cap.instanceMatrix.needsUpdate  = true;
  }, []);

  useFrame((_, delta) => {
    stemMat.uniforms.uTime.value += delta;
    capMat.uniforms.uTime.value  += delta;
  });

  return (
    <group>
      <instancedMesh ref={stemRef} args={[stemGeo, stemMat, SHROOM_COUNT]} frustumCulled={false} />
      <instancedMesh ref={capRef}  args={[capGeo,  capMat,  SHROOM_COUNT]} frustumCulled={false} />
    </group>
  );
};

export default React.memo(InstancedMushrooms);
