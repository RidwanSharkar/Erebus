import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  CylinderGeometry,
  SphereGeometry,
  CircleGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
  Color,
  DoubleSide,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const TREE_COUNT = 25;

// 3 overlapping sphere tiers making a rounded deciduous blob
// yFrac = how far up within the canopy radius to offset the center
// rScale = sphere radius relative to the base canopy radius
const CANOPY_TIERS = [
  { yFrac: 0.00, rScale: 1.00 }, // bottom sphere — widest, sits on trunk
  { yFrac: 0.60, rScale: 0.85 }, // upper sphere — overlaps bottom
  { yFrac: 0.35, rScale: 0.72 }, // side sphere — fills the gap, creates fullness
] as const;

// Sun direction for lighting (low angle; slight magenta bias reads well on purple foliage)
const SUN_DIR = new Vector3(1.0, 0.85, -0.55).normalize();

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const TRUNK_VERT = `
  attribute float aHeightRatio;
  uniform float uTime;
  uniform float uWindStrength;
  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    vec4 wp = instanceMatrix * vec4(position, 1.0);
    float bend = aHeightRatio * aHeightRatio;
    float phase = wp.x * 0.18 + wp.z * 0.13;
    float w1 = sin(phase + uTime * 0.75) * uWindStrength * bend;
    float w2 = sin(phase * 1.8 + uTime * 1.2 + 2.3) * uWindStrength * 0.22 * bend;
    wp.x += w1 + w2;
    wp.z += (w1 + w2) * 0.35;
    wp.y -= abs(w1) * 0.03 * bend;
    vHeightRatio = aHeightRatio;
    vWorldPos    = wp.xyz;
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
`;

const TRUNK_FRAG = `
  uniform vec3 uTrunkDark;
  uniform vec3 uTrunkLight;
  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    vec3 col = mix(uTrunkDark, uTrunkLight, vHeightRatio * 0.65);
    col *= 0.82 + sin(vWorldPos.y * 5.2 + vWorldPos.x * 2.8) * 0.18;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Canopy uses screen-space derivatives to get per-face normals → flat shading
// with a directional sun light, matching the reference image aesthetic.
const CANOPY_VERT = `
  attribute float aHeightRatio;
  uniform float uTime;
  uniform float uWindStrength;
  varying float vHeightRatio;
  varying vec3 vWorldPos;
  varying vec3 vLocalNorm;

  void main() {
    // Capture sphere-surface normal in local space (stable UV, won't swim with wind)
    vLocalNorm = normalize(position);

    vec4 wp = instanceMatrix * vec4(position, 1.0);
    float phase = wp.x * 0.18 + wp.z * 0.13;

    // Tree sway — same phase as trunk so canopy stays attached
    float s1 = sin(phase + uTime * 0.75) * uWindStrength;
    float s2 = sin(phase * 1.8 + uTime * 1.2 + 2.3) * uWindStrength * 0.22;

    // Tip flutter — adds rustling on outer vertices
    float flutter = sin(wp.x * 4.8 + wp.z * 3.9 + uTime * 3.6) * uWindStrength * 0.15 * aHeightRatio;

    float totalX = s1 + s2 + flutter;
    wp.x += totalX;
    wp.z += totalX * 0.38;

    vHeightRatio = aHeightRatio;
    vWorldPos    = wp.xyz;
    gl_Position  = projectionMatrix * viewMatrix * wp;
  }
`;

// Do not add #extension GL_OES_standard_derivatives here: Three prepends a large
// prefix to fragment shaders, so an extension in this string ends up after other
// declarations and fails to compile. WebGL2 (GLSL 300) has dFdx/dFdy built-in;
// WebGL1 gets the extension from ShaderMaterial extensions.derivatives.
const CANOPY_FRAG = `
  uniform vec3 uLeafDark;
  uniform vec3 uLeafLight;
  uniform vec3 uSunDir;

  varying float vHeightRatio;
  varying vec3 vWorldPos;
  varying vec3 vLocalNorm;

  // ── Procedural texture helpers (no texture files = zero memory overhead) ──

  // Fast integer hash → pseudo-random [0,1]
  float hash21(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
  }

  // Smooth 2-D value noise
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i),               hash21(i + vec2(1.0, 0.0)), f.x),
      mix(hash21(i + vec2(0.0,1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    // Per-face flat normal from screen-space derivatives → low-poly faceted look
    vec3 faceNormal = normalize(cross(dFdx(vWorldPos), dFdy(vWorldPos)));

    // Lighting: large ambient floor so canopy is always visible regardless of sky darkness
    float diffuse = clamp(dot(faceNormal, uSunDir), 0.0, 1.0);
    float skyUp   = max(0.0, dot(faceNormal, vec3(0.0, 1.0, 0.0)));
    float light   = 0.55 + diffuse * 0.28 + skyUp * 0.17;  // min=0.55, max~1.0

    vec3 col = mix(uLeafDark, uLeafLight, clamp(light, 0.0, 1.0));

    // ── Procedural leaf-cluster texture (spherical UVs from local normal) ──
    // vLocalNorm is the pre-wind sphere normal, so UVs stay anchored to the
    // sphere surface and never swim — zero texture memory overhead.
    vec2 sUV = vLocalNorm.xz * 3.8 + vLocalNorm.y * 1.5;

    float n1 = vnoise(sUV * 1.6);         // large leaf-clump scale
    float n2 = vnoise(sUV * 3.5 + 7.31); // mid leaf detail
    float n3 = vnoise(sUV * 7.2 - 2.93); // fine surface roughness

    float leafTex = n1 * 0.55 + n2 * 0.30 + n3 * 0.15;

    // Contrast stretch → punchy bright / dark leaf clusters
    leafTex = smoothstep(0.32, 0.75, leafTex);

    // Subtle tint variation — never go below 88% to avoid black patches
    col = mix(col * 0.88, col * 1.10, leafTex);

    // Underside shadow: downward faces slightly darker for depth
    col *= 0.88 + skyUp * 0.16;

    // Sky bounce — cool violet (alien canopy, no earth-green)
    col += vec3(0.08, 0.04, 0.14) * skyUp * 0.24;

    // Height brightening (sunlit canopy top)
    col *= 0.94 + vHeightRatio * 0.12;

    // Depth fade at map edge
    float dist = length(vWorldPos.xz);
    col *= 1.0 - smoothstep(22.0, 28.0, dist) * 0.30;

    gl_FragColor = vec4(col, 1.0);
  }
`;

// Blob shadow — radial gradient dark disc on the ground
const SHADOW_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec4 wp = instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const SHADOW_FRAG = `
  varying vec2 vUv;
  void main() {
    vec2 c = vUv - 0.5;
    // Slightly stretched ellipse to suggest sun angle
    float r = length(c * vec2(1.0, 0.75)) * 2.0;
    float alpha = (1.0 - smoothstep(0.55, 1.0, r)) * 0.38;
    gl_FragColor = vec4(0.05, 0.0, 0.10, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function addHeightRatio(geo: CylinderGeometry | SphereGeometry): void {
  const pos = geo.attributes.position.array as Float32Array;
  const hr  = new Float32Array(pos.length / 3);
  // Cylinder: y ∈ [-0.5, 0.5] → (y + 0.5). Sphere radius=1: y ∈ [-1, 1] → (y + 1) / 2
  const isSphere = (geo as SphereGeometry).type === 'SphereGeometry';
  for (let i = 0; i < hr.length; i++) {
    const y = pos[i * 3 + 1];
    hr[i] = isSphere ? Math.max(0, Math.min(1, (y + 1.0) * 0.5))
                     : Math.max(0, Math.min(1, y + 0.5));
  }
  geo.setAttribute('aHeightRatio', new Float32BufferAttribute(hr, 1));
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface InstancedForestProps {
  count?: number;
  innerRadius?: number;
  outerRadius?: number;
  windStrength?: number;
  trunkDark?: string;
  trunkLight?: string;
  leafDark?: string;
  leafLight?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const InstancedForest: React.FC<InstancedForestProps> = ({
  count        = TREE_COUNT,
  innerRadius  = 15,
  outerRadius  = 31,
  windStrength = 0.5,
  trunkDark    = '#3d2b1f',
  trunkLight   = '#6b4a34',
  leafDark     = '#2a6b14',
  leafLight    = '#F991CC',
}) => {
  const trunkRef  = useRef<InstancedMesh>(null);
  const canopy0   = useRef<InstancedMesh>(null);
  const canopy1   = useRef<InstancedMesh>(null);
  const canopy2   = useRef<InstancedMesh>(null);
  const shadowRef = useRef<InstancedMesh>(null);
  const canopyRefs = [canopy0, canopy1, canopy2] as const;

  // ── Geometries ────────────────────────────────────────────────────────────
  const trunkGeo = useMemo(() => {
    const g = new CylinderGeometry(0.05, 1.0, 3.25, 5, 4);
    addHeightRatio(g);
    return g;
  }, []);

  // Instanced spheres: enough segments to read as full rounded canopies (still cheap at 100×3)
  const canopyGeos = useMemo(() =>
    CANOPY_TIERS.map(() => {
      const g = new SphereGeometry(0.05, 3, 25);
      addHeightRatio(g);
      return g;
    }),
  []);

  // Flat disc for shadow blobs
  const shadowGeo = useMemo(() => new CircleGeometry(0.5, 10), []);

  // ── Materials ─────────────────────────────────────────────────────────────
  const trunkMat = useMemo(() => new ShaderMaterial({
    uniforms: {
      uTime:        { value: 0 },
      uWindStrength:{ value: windStrength },
      uTrunkDark:   { value: new Color(trunkDark) },
      uTrunkLight:  { value: new Color(trunkLight) },
    },
    vertexShader:   TRUNK_VERT,
    fragmentShader: TRUNK_FRAG,
    side: DoubleSide,
  }), [windStrength, trunkDark, trunkLight]);

  const canopyMats = useMemo(() =>
    CANOPY_TIERS.map(() => new ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uWindStrength:{ value: windStrength },
        uLeafDark:    { value: new Color(leafDark) },
        uLeafLight:   { value: new Color(leafLight) },
        uSunDir:      { value: SUN_DIR.clone() },
      },
      vertexShader:   CANOPY_VERT,
      fragmentShader: CANOPY_FRAG,
      side: DoubleSide,
      extensions: { derivatives: true },
    })),
  [windStrength, leafDark, leafLight]);

  const shadowMat = useMemo(() => new ShaderMaterial({
    vertexShader:   SHADOW_VERT,
    fragmentShader: SHADOW_FRAG,
    transparent: true,
    depthWrite:  false,
  }), []);

  // ── Instance matrices ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!trunkRef.current || !shadowRef.current) return;
    if (canopyRefs.some(r => !r.current)) return;

    const mat    = new Matrix4();
    const scl    = new Vector3();
    const pos    = new Vector3();
    const rotMat = new Matrix4();
    const rotY   = new Matrix4();

    for (let i = 0; i < count; i++) {
      const treeAngle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const t = Math.pow(Math.random(), 0.55); // bias toward inner treeline
      const r = innerRadius + t * (outerRadius - innerRadius);
      const x = Math.cos(treeAngle) * r;
      const z = Math.sin(treeAngle) * r;

      // Per-tree size variation
      const trunkH  = 1.5 + Math.random() * 2.5;
      const trunkR  = 0.20 + Math.random() * 0.16;
      const canopyR = (0.5 + Math.random() * 0.9) * trunkR * 6.5;

      const rotAngle = Math.random() * Math.PI * 2;
      rotY.makeRotationY(rotAngle);

      // ── Trunk ──────────────────────────────────────────────────────────
      scl.set(trunkR, trunkH, trunkR);
      mat.makeScale(scl.x, scl.y, scl.z);
      mat.premultiply(rotY);
      pos.set(x, trunkH * 0.25 + 2.0, z);
      mat.setPosition(pos);
      trunkRef.current.setMatrixAt(i, mat);

      // ── Canopy blob (3 overlapping spheres) ────────────────────────────
      CANOPY_TIERS.forEach((tier, ti) => {
        const cR = canopyR * tier.rScale;

        // Stagger each sphere in a rounded cluster shape
        // Slight XZ offsets rotated with the tree so the blob is directional
        let xOff = 0, zOff = 0;
        if (ti === 1) { xOff =  canopyR * 0.22; }
        if (ti === 2) { xOff = -canopyR * 0.15; zOff = canopyR * 0.1; }
        // Rotate offsets with tree Y rotation for consistent look
        const cos = Math.cos(rotAngle), sin = Math.sin(rotAngle);
        const rxOff = xOff * cos - zOff * sin;
        const rzOff = xOff * sin + zOff * cos;

        const sphereY = trunkH + canopyR * (tier.yFrac * 0.8) + cR * 0.15;

        scl.set(cR, cR, cR);
        mat.makeScale(scl.x, scl.y, scl.z);
        // No rotation needed for spheres, but keep the rotMat for consistency
        rotMat.makeRotationY(rotAngle + ti * 0.9);
        mat.premultiply(rotMat);
        pos.set(x + rxOff, sphereY, z + rzOff);
        mat.setPosition(pos);
        canopyRefs[ti].current!.setMatrixAt(i, mat);
      });

      // ── Shadow blob ────────────────────────────────────────────────────
      const shadowR = canopyR * 0.95;
      scl.set(shadowR, 1, shadowR * 0.75); // ellipse: Y scale irrelevant for flat disc
      mat.makeScale(scl.x, scl.y, scl.z);
      mat.premultiply(rotY);
      // Rotate disc to lie flat on the ground
      const flatRot = new Matrix4().makeRotationX(-Math.PI * 0.5);
      mat.premultiply(flatRot);
      pos.set(x, 0.02, z);
      mat.setPosition(pos);
      shadowRef.current.setMatrixAt(i, mat);
    }

    trunkRef.current.instanceMatrix.needsUpdate  = true;
    shadowRef.current.instanceMatrix.needsUpdate = true;
    canopyRefs.forEach(r => { r.current!.instanceMatrix.needsUpdate = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, innerRadius, outerRadius]);

  // ── Animation ─────────────────────────────────────────────────────────────
  useFrame((_, delta) => {
    trunkMat.uniforms.uTime.value += delta;
    canopyMats.forEach(m => { m.uniforms.uTime.value += delta; });
  });

  return (
    <group>
      {/* Shadow blobs — rendered first (closest to ground) */}
      <instancedMesh ref={shadowRef} args={[shadowGeo, shadowMat, count]} frustumCulled={false} />

      {/* Trunks */}
      <instancedMesh ref={trunkRef}  args={[trunkGeo,      trunkMat,      count]} frustumCulled={false} />

      {/* 3-sphere canopy blob */}
      <instancedMesh ref={canopy0}   args={[canopyGeos[0], canopyMats[0], count]} frustumCulled={false} />
      <instancedMesh ref={canopy1}   args={[canopyGeos[1], canopyMats[1], count]} frustumCulled={false} />
      <instancedMesh ref={canopy2}   args={[canopyGeos[2], canopyMats[2], count]} frustumCulled={false} />
    </group>
  );
};

export default React.memo(InstancedForest);
