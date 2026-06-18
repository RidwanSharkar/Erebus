'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Mesh, ShaderMaterial, Vector3, Quaternion, DoubleSide } from '@/utils/three-exports';

// Shared simplex-noise + fbm GLSL
const mistVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const mistFragmentShader = `
  uniform float opacity;
  uniform float time;
  uniform float seed;

  varying vec2 vUv;

  // Simplex noise
  vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289v4(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289v3(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    float f = 1.0;
    for (int i = 0; i < 5; i++) {
      v += a * snoise(p * f);
      a *= 0.5;
      f *= 2.0;
    }
    return v;
  }

  void main() {
    vec2 center = vUv - 0.5;
    float dist = length(center);

    // Multi-octave noise for cloud texture, slowly churning
    vec3 coord = vec3(vUv * 2.5 + seed * 0.3, time * 0.018);
    float noise = fbm(coord);
    noise = (noise + 1.0) * 0.5;

    float detail = fbm(coord * 2.0 + vec3(seed * 5.0));
    detail = (detail + 1.0) * 0.5;

    float cloud = noise * 0.65 + detail * 0.35;

    // Soft radial falloff so quads don't have hard rectangle edges
    float radial = 1.0 - smoothstep(0.15, 0.5, dist);
    radial = pow(radial, 1.2);

    // Horizontal and vertical soft fade near UV edges (additional insurance)
    float hFade = smoothstep(0.0, 0.12, vUv.x) * smoothstep(0.0, 0.12, 1.0 - vUv.x);
    float vFade = smoothstep(0.0, 0.12, vUv.y) * smoothstep(0.0, 0.12, 1.0 - vUv.y);

    float alpha = radial * hFade * vFade * cloud * opacity;
    alpha = clamp(alpha, 0.0, 1.0);

    // Near-white / light grey cloud color with faint cool tint
    vec3 cloudColor = vec3(0.92, 0.94, 0.98);
    gl_FragColor = vec4(cloudColor, alpha);
  }
`;

// A single mist chunk within a cluster
interface PuffDef {
  localX: number;     // offset from cluster center along camera-right (world units)
  localY: number;     // offset from cluster center along camera-up (world units)
  scale: number;      // quad size
  seed: number;       // noise seed for unique texture
  opacityMul: number; // relative opacity within the cluster
}

// A drifting cluster of chunks that travels across the view as a unit
interface ClusterParams {
  driftSpeed: number;   // horizontal units per second in world space
  phase: number;        // 0-1 starting offset in the drift cycle
  vertOffset: number;   // cluster vertical offset in camera-up space (world units)
  forwardDist: number;  // how far in front of camera (world units)
  baseOpacity: number;  // cluster master opacity
  puffs: PuffDef[];     // chunks that make up the cluster
}

// Scratch objects allocated once, reused every frame
const _fwd    = new Vector3();
const _right  = new Vector3();
const _up     = new Vector3();
const _center = new Vector3();
const _pos    = new Vector3();
const _camQ   = new Quaternion();

// How wide the drift sweep is in world-space units (camera-right direction).
// Clusters travel from -SWEEP_HALF to +SWEEP_HALF and wrap.
const SWEEP_HALF = 42;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const MistCluster: React.FC<{ params: ClusterParams }> = ({ params }) => {
  const { camera } = useThree();
  const meshRefs = useRef<(Mesh | null)[]>([]);
  const matRefs  = useRef<(ShaderMaterial | null)[]>([]);

  // Looping sweep position (0→1). Initialised to phase so clusters start staggered.
  const uRef = useRef(params.phase);

  // One uniform set per puff, created once
  const puffUniforms = useMemo(
    () => params.puffs.map((p) => ({
      opacity: { value: params.baseOpacity * p.opacityMul },
      time:    { value: 0 },
      seed:    { value: p.seed },
    })),
    [params.puffs, params.baseOpacity]
  );

  useFrame(({ clock }, delta) => {
    // Advance the sweep parameter
    const speed = params.driftSpeed / (SWEEP_HALF * 2);  // convert to u/s
    uRef.current = (uRef.current + delta * speed) % 1.0;
    const u = uRef.current;

    // Cluster center horizontal position: map 0→1 to -SWEEP_HALF→+SWEEP_HALF
    const hPos = (u - 0.5) * SWEEP_HALF * 2;

    // Extract camera basis vectors (world space)
    camera.getWorldQuaternion(_camQ);
    _fwd.set(0, 0, -1).applyQuaternion(_camQ);
    _right.set(1, 0, 0).applyQuaternion(_camQ);
    _up.set(0, 1, 0).applyQuaternion(_camQ);

    // Cluster center: forward + horizontal sweep + vertical offset
    _center.copy(camera.position)
      .addScaledVector(_fwd,   params.forwardDist)
      .addScaledVector(_right, hPos)
      .addScaledVector(_up,    params.vertOffset);

    // Edge fade: smoothly ramp the whole cluster in/out at the sweep edges
    const edgeFade = Math.min(
      smoothstep(0, 0.12, u),
      smoothstep(0, 0.12, 1 - u)
    );
    const t = clock.getElapsedTime();

    // Place each chunk relative to the cluster center
    for (let i = 0; i < params.puffs.length; i++) {
      const mesh = meshRefs.current[i];
      const mat  = matRefs.current[i];
      if (!mesh || !mat) continue;

      const puff = params.puffs[i];
      _pos.copy(_center)
        .addScaledVector(_right, puff.localX)
        .addScaledVector(_up,    puff.localY);

      mesh.position.copy(_pos);
      mesh.quaternion.copy(_camQ);

      mat.uniforms.opacity.value = params.baseOpacity * puff.opacityMul * edgeFade;
      mat.uniforms.time.value    = t;
    }
  });

  return (
    <group>
      {params.puffs.map((puff, i) => (
        <mesh
          key={i}
          ref={(el) => { meshRefs.current[i] = el; }}
        >
          <planeGeometry args={[puff.scale, puff.scale * 0.75, 1, 1]} />
          <shaderMaterial
            ref={(el) => { matRefs.current[i] = el; }}
            vertexShader={mistVertexShader}
            fragmentShader={mistFragmentShader}
            uniforms={puffUniforms[i]}
            transparent
            depthWrite={false}
            depthTest={false}
            side={DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

// 4 clusters, staggered phases for continuous coverage. Each cluster is a handful
// of smaller chunks offset around its drifting center, so the mist reads as
// clumps rather than one uniform sheet.
const MIST_CLUSTERS: ClusterParams[] = [
  {
    driftSpeed: 2.4, phase: 0.00, vertOffset: 2.5, forwardDist: 12, baseOpacity: 0.17,
    puffs: [
      { localX: -6.0, localY:  1.5, scale: 14, seed: 1.1, opacityMul: 1.0 },
      { localX:  0.5, localY: -1.0, scale: 16, seed: 3.7, opacityMul: 0.9 },
      { localX:  6.5, localY:  2.5, scale: 12, seed: 6.2, opacityMul: 0.8 },
      { localX:  2.0, localY:  4.0, scale: 10, seed: 8.9, opacityMul: 0.6 },
    ],
  },
  {
    driftSpeed: 2.0, phase: 0.25, vertOffset: -2.0, forwardDist: 10, baseOpacity: 0.15,
    puffs: [
      { localX: -5.0, localY: -0.5, scale: 13, seed: 2.4, opacityMul: 0.9 },
      { localX:  1.5, localY:  1.5, scale: 15, seed: 5.5, opacityMul: 1.0 },
      { localX:  6.0, localY: -1.5, scale: 11, seed: 7.3, opacityMul: 0.7 },
    ],
  },
  {
    driftSpeed: 2.8, phase: 0.50, vertOffset: 0.5, forwardDist: 14, baseOpacity: 0.18,
    puffs: [
      { localX: -7.0, localY:  0.5, scale: 15, seed: 4.2, opacityMul: 0.85 },
      { localX: -1.0, localY:  2.5, scale: 13, seed: 9.6, opacityMul: 1.0 },
      { localX:  5.5, localY: -2.0, scale: 14, seed: 1.8, opacityMul: 0.9 },
      { localX:  8.0, localY:  3.0, scale:  9, seed: 6.9, opacityMul: 0.55 },
    ],
  },
  {
    driftSpeed: 1.7, phase: 0.75, vertOffset: 3.5, forwardDist: 13, baseOpacity: 0.14,
    puffs: [
      { localX: -4.5, localY: -1.0, scale: 12, seed: 3.3, opacityMul: 0.9 },
      { localX:  2.0, localY:  0.5, scale: 14, seed: 7.7, opacityMul: 1.0 },
      { localX:  6.5, localY:  2.0, scale: 10, seed: 5.1, opacityMul: 0.65 },
    ],
  },
];

const DriftingMist: React.FC = () => (
  <group name="drifting-mist">
    {MIST_CLUSTERS.map((params, i) => (
      <MistCluster key={i} params={params} />
    ))}
  </group>
);

export default DriftingMist;
