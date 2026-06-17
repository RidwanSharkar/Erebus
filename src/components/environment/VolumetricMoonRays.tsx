import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  CylinderGeometry,
  Matrix4,
  Vector3,
  AdditiveBlending,
  DoubleSide,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Volumetric blood-moon god rays — 5 open-ended cone shafts
// Moon is at [100, 60, -150]; rays fan downward toward arena
// Additive blending, no depth write — pure atmospheric glow, near-zero cost
// ---------------------------------------------------------------------------

const RAY_VERT = `
  varying float vHeight; // 0 = top (moon end), 1 = bottom (ground end)

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    // CylinderGeometry: y ∈ [−0.5, +0.5]; remap so 0=top 1=bottom
    vHeight     = 1.0 - (position.y + 0.5);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const RAY_FRAG = `
  uniform float uTime;
  varying float vHeight;

  void main() {
    // Fade near moon source (top) and near ground (bottom)
    float alpha = smoothstep(0.0, 0.25, vHeight) * smoothstep(1.0, 0.55, vHeight);

    // Slow breathing pulse
    float pulse = 0.55 + sin(uTime * 0.35) * 0.45;
    alpha *= pulse * 0.12;

    // Deep crimson-to-faint orange gradient descending from moon
    vec3 top    = vec3(0.82, 0.05, 0.05); // crimson near moon
    vec3 bottom = vec3(0.55, 0.12, 0.04); // dark orange toward ground
    vec3 col = mix(top, bottom, vHeight);

    gl_FragColor = vec4(col, alpha);
  }
`;

// Blood moon world position (from Planet.tsx)
const MOON_POS  = new Vector3(100, 60, -150);
const ARENA_CENTER = new Vector3(0, 0, 0);

// Pre-compute 5 ray configurations — varied direction spread around center
const RAY_CONFIGS = [
  { spread: new Vector3(  0,  0,  0 ), radiusTop: 1.2, radiusBot: 7.0 },
  { spread: new Vector3(  8,  0,  5 ), radiusTop: 0.8, radiusBot: 4.5 },
  { spread: new Vector3( -7,  0,  3 ), radiusTop: 0.9, radiusBot: 5.0 },
  { spread: new Vector3(  4,  0, -6 ), radiusTop: 0.7, radiusBot: 3.5 },
  { spread: new Vector3( -5,  0, -4 ), radiusTop: 1.0, radiusBot: 4.0 },
];

const RAY_COUNT = RAY_CONFIGS.length;

const VolumetricMoonRays: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  // Use a tall open-ended cylinder for the shaft; open sides only (no caps)
  const geo = useMemo(() => new CylinderGeometry(1, 1, 1, 8, 1, true), []);

  const mat = useMemo(() => new ShaderMaterial({
    uniforms:       { uTime: { value: 0 } },
    vertexShader:   RAY_VERT,
    fragmentShader: RAY_FRAG,
    transparent:    true,
    depthWrite:     false,
    blending:       AdditiveBlending,
    side:           DoubleSide,
  }), []);

  // Build instance matrices once — each ray points from moon to a ground target
  useMemo(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    placeRays(mesh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // We can't ref-access on first useMemo; use a callback ref instead
  const setRef = (mesh: InstancedMesh | null) => {
    (meshRef as React.MutableRefObject<InstancedMesh | null>).current = mesh;
    if (!mesh) return;
    placeRays(mesh);
  };

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;
  });

  return (
    <instancedMesh
      ref={setRef}
      args={[geo, mat, RAY_COUNT]}
      frustumCulled={false}
    />
  );
};

function placeRays(mesh: InstancedMesh) {
  const m = new Matrix4();

  RAY_CONFIGS.forEach((cfg, i) => {
    // Target point on arena ground (near center, spread slightly)
    const target = ARENA_CENTER.clone().add(cfg.spread);
    target.y = 0;

    // Ray direction: from moon down to target
    const dir = target.clone().sub(MOON_POS).normalize();
    const length = MOON_POS.distanceTo(target);

    // Midpoint of the ray shaft
    const mid = MOON_POS.clone().lerp(target, 0.5);

    // Orient cylinder along the ray direction
    // CylinderGeometry default axis = +Y; we need to rotate +Y → dir
    const up = new Vector3(0, 1, 0);
    const q  = new Matrix4();
    // Cross product + angle
    const axis = new Vector3().crossVectors(up, dir).normalize();
    const dot  = Math.max(-1, Math.min(1, up.dot(dir)));
    const angle = Math.acos(dot);

    if (axis.lengthSq() > 0.001) {
      q.makeRotationAxis(axis, angle);
    }

    // Scale: X/Z = radiusTop→Bot (we taper via scale, not geometry)
    // CylinderGeometry(radiusTop, radiusBot, height) — vary per instance
    const scaleX = cfg.radiusBot;  // use max radius for scale; shader doesn't taper
    m.makeScale(scaleX, length, scaleX);
    m.premultiply(q);
    m.setPosition(mid);
    mesh.setMatrixAt(i, m);
  });

  mesh.instanceMatrix.needsUpdate = true;
}

export default React.memo(VolumetricMoonRays);
