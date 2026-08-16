import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
  Points,
  Vector3,
  RingGeometry,
} from '@/utils/three-exports';
import { MAIN_ARENA_FLOOR_RADIUS, MAIN_ARENA_HEX_RADIUS } from '@/utils/mapConstants';

// ---------------------------------------------------------------------------
// Fire embers — GPU-animated floating sparks near camps and torch areas
// Single Points draw call, additive blending, all motion in vertex shader.
//
// Color design: embers use the room theme (aCampIdx = 0) from uniform arrays
// uColorDim[1] / uColorBright[1].  When campTypes[0] arrives from the server,
// useEffect patches those 6 uniforms in-place — no geometry rebuild needed.
// ---------------------------------------------------------------------------

const EMBER_VERT = `
  attribute float aIndex;
  attribute vec3  aOrigin;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aCampIdx;   // 0 — room theme palette index

  uniform float uTime;
  uniform vec3  uColorDim[1];     // cool / fading — room theme
  uniform vec3  uColorBright[1];  // hot / core — room theme

  varying float vAlpha;
  varying vec3  vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float t     = mod(uTime * aSpeed + aIndex * 1.618, 5.0);
    float tNorm = t / 5.0;

    // Spiral upward drift
    float angle  = aIndex * 2.39996 + uTime * aSpeed * 0.4;
    float radius = 0.4 + hash(aIndex + 7.0) * 1.2;

    vec3 pos = aOrigin;
    pos.x += cos(angle) * radius * (1.0 - tNorm * 0.5);
    pos.z += sin(angle) * radius * (1.0 - tNorm * 0.5);
    pos.y += tNorm * (2.5 + hash(aIndex) * 2.5);

    // Micro flutter
    pos.x += sin(uTime * 3.1 + aIndex * 5.7) * 0.12;
    pos.z += cos(uTime * 2.7 + aIndex * 3.3) * 0.12;

    vAlpha = smoothstep(0.0, 0.15, tNorm) * (1.0 - smoothstep(0.65, 1.0, tNorm));

    // Pick this camp's palette then blend hot → dim as ember rises
    int   ci     = int(aCampIdx);
    float heat   = 1.0 - tNorm;
    vColor = mix(uColorDim[ci], uColorBright[ci], heat * heat);

    vec4 mvPos   = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.5 - tNorm * 0.8) * (300.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const EMBER_FRAG = `
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec2  c    = gl_PointCoord - 0.5;
    float r    = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.4, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.9);
  }
`;

// ---------------------------------------------------------------------------
// Perimeter flow ring — CCW energy trails connecting ember camp nodes.
// One RingGeometry draw call; all motion in fragment shader via uTime.
// RingGeometry UVs are planar (not angular), so we use world-space XZ polar math.
// ---------------------------------------------------------------------------

const FLOW_RING_VERT = `
  varying vec3 vWorldPos;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const FLOW_RING_FRAG = `
  uniform float uTime;
  uniform vec3  uColorDim;
  uniform vec3  uColorBright;
  uniform float uNodeCount;
  uniform float uFlowSpeed;
  uniform float uInnerRadius;
  uniform float uOuterRadius;

  varying vec3 vWorldPos;

  void main() {
    // World-space polar coords — RingGeometry UVs are planar projection, not usable here
    float angle = atan(vWorldPos.z, vWorldPos.x);          // -PI..PI
    float along = fract(angle / 6.2831853 + 0.5);          // 0..1 CCW wrap
    float dist  = length(vWorldPos.xz);

    // Soft band edges matching geometry radii
    float radialMask = smoothstep(uInnerRadius, uInnerRadius + 0.25, dist)
                     * (1.0 - smoothstep(uOuterRadius - 0.25, uOuterRadius, dist));

    // Brighten at each of the 12 ember camp angular nodes
    float nodePhase = fract(along * uNodeCount);
    float nodeDist  = min(nodePhase, 1.0 - nodePhase);
    float nodeGlow  = exp(-nodeDist * nodeDist * 85.0);

    // 3 staggered CCW traveling pulses (subtract time so flow is counter-clockwise)
    float trail = 0.0;
    for (int i = 0; i < 3; i++) {
      float phase  = float(i) / 3.0;
      float head   = fract(along - uTime * uFlowSpeed + phase);
      // Soft head with a longer fading tail behind it
      float pulse  = smoothstep(0.0, 0.04, head) * (1.0 - smoothstep(0.04, 0.22, head));
      trail += pulse;
    }
    trail = clamp(trail, 0.0, 1.0);

    // Organic wisp variation — cheap, no texture
    float wisp = 0.55 + 0.45 * sin(along * 18.2832 - uTime * 2.4);

    float intensity = (trail * 0.78 + nodeGlow * 0.65) * radialMask * wisp;
    vec3  color     = mix(uColorDim, uColorBright, trail * 0.65 + nodeGlow * 0.85);

    float alpha = intensity * 0.60;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

// ---------------------------------------------------------------------------
// Perimeter fire ring — evenly-spaced clusters around the arena boundary.
// All clusters share aCampIdx=0 so they inherit the single room theme color.
// ---------------------------------------------------------------------------
const PERIMETER_COUNT  = 9;
const PERIMETER_RADIUS = MAIN_ARENA_HEX_RADIUS + 1.5;

/** Match ThroneOuterFloor radius in Environment.tsx — trail sits on visible rune edge. */
const FLOOR_OUTER_RADIUS = MAIN_ARENA_FLOOR_RADIUS;
const FLOW_INNER = FLOOR_OUTER_RADIUS - 0.45;
const FLOW_OUTER = FLOOR_OUTER_RADIUS + 0.15;
/** Module-level singleton — never dispose on remount. */
const sharedFlowRingGeo = new RingGeometry(FLOW_INNER, FLOW_OUTER, 96);

const DEFAULT_CAMP_ORIGINS: [number, number, number][] = Array.from(
  { length: PERIMETER_COUNT },
  (_, i) => {
    const angle = (i / PERIMETER_COUNT) * Math.PI * 2;
    return [
      Math.cos(angle) * PERIMETER_RADIUS,
      0,
      Math.sin(angle) * PERIMETER_RADIUS,
    ];
  }
);

// Per-theme palettes: [dim (cool / fading), bright (hot core)]
// With additive blending even modest values glow vividly.
const FLAME_PALETTES: Record<string, [[number,number,number],[number,number,number]]> = {
  red:    [[0.25, 0.02, 0.00], [1.00, 0.55, 0.05]],  // ember-orange → deep red
  green:  [[0.01, 0.18, 0.00], [0.08, 1.00, 0.04]],  // neon green
  blue:   [[0.00, 0.04, 0.22], [0.03, 0.75, 1.00]],  // frost / ice-blue
  purple: [[0.22, 0.12, 0.32], [0.694, 0.545, 1.00]],  // B18BFF void
  pink:   [[0.22, 0.00, 0.14], [1.00, 0.38, 0.78]],  // fae realm magenta flames
};
const DEFAULT_PALETTE = FLAME_PALETTES.red;

const EMBERS_PER_CAMP = 15;

type CampOrigin = readonly [number, number, number];

const resolvePalette = (campTypes: string[], index: number) => {
  const key = (campTypes[index] ?? campTypes[0] ?? 'red').toLowerCase();
  return FLAME_PALETTES[key] ?? DEFAULT_PALETTE;
};

// Build the two uniform Vector3[] arrays for a given campTypes list.
const buildColorUniforms = (campTypes: string[], campCount: number) => ({
  dim: Array.from({ length: campCount }, (_, i) => {
    const [d] = resolvePalette(campTypes, i);
    return new Vector3(d[0], d[1], d[2]);
  }),
  bright: Array.from({ length: campCount }, (_, i) => {
    const [, b] = resolvePalette(campTypes, i);
    return new Vector3(b[0], b[1], b[2]);
  }),
});

/** Room theme palette from campTypes[0] — used by the perimeter flow ring. */
const resolveRoomPalette = (campTypes: string[]) => {
  const key = campTypes[0]?.toLowerCase();
  return FLAME_PALETTES[key ?? ''] ?? DEFAULT_PALETTE;
};

// ---------------------------------------------------------------------------

interface InstancedEmbersProps {
  campTypes?: string[]; // e.g. ['red','green','blue'] — arrives from socket
  /** Override default circular perimeter camps (e.g. Fae Realm triangle edges). */
  campOrigins?: ReadonlyArray<CampOrigin>;
  /** Full perimeter flow ring — off for sparse custom camp layouts. */
  showFlowRing?: boolean;
}

const EmberRisingPoints: React.FC<InstancedEmbersProps> = React.memo(({
  campTypes = [],
  campOrigins,
}) => {
  const pointsRef = useRef<Points>(null);
  const resolvedCampOrigins = campOrigins ?? DEFAULT_CAMP_ORIGINS;

  const { geo, mat } = useMemo(() => {
    const campCount = resolvedCampOrigins.length;
    const total = EMBERS_PER_CAMP * campCount;
    const indices  = new Float32Array(total);
    const origins  = new Float32Array(total * 3);
    const speeds   = new Float32Array(total);
    const sizes    = new Float32Array(total);
    const campIdxs = new Float32Array(total);
    const positions = new Float32Array(total * 3); // placeholder; shader ignores it

    let ptr = 0;
    resolvedCampOrigins.forEach(([cx, cy, cz], campIdx) => {
      for (let i = 0; i < EMBERS_PER_CAMP; i++) {
        const idx = ptr;
        indices[idx]  = idx;
        campIdxs[idx] = campIdx;

        const a = Math.random() * Math.PI * 2;
        const r = Math.random() * 1.25;
        origins[idx * 3    ] = cx + Math.cos(a) * r;
        origins[idx * 3 + 1] = cy;
        origins[idx * 3 + 2] = cz + Math.sin(a) * r;

        speeds[idx] = 0.4 + Math.random() * 0.8;
        sizes[idx]  = 2.0 + Math.random() * 4.0;
        ptr++;
      }
    });

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aIndex',   new Float32BufferAttribute(indices,   1));
    geometry.setAttribute('aOrigin',  new Float32BufferAttribute(origins,   3));
    geometry.setAttribute('aSpeed',   new Float32BufferAttribute(speeds,    1));
    geometry.setAttribute('aSize',    new Float32BufferAttribute(sizes,     1));
    geometry.setAttribute('aCampIdx', new Float32BufferAttribute(campIdxs,  1));

    const { dim, bright } = buildColorUniforms(campTypes, campCount);
    const material = new ShaderMaterial({
      uniforms: {
        uTime:        { value: 0 },
        uColorDim:    { value: dim },
        uColorBright: { value: bright },
      },
      vertexShader:   EMBER_VERT,
      fragmentShader: EMBER_FRAG,
      transparent:    true,
      depthWrite:     false,
      blending:       AdditiveBlending,
    });

    return { geo: geometry, mat: material };
  }, [resolvedCampOrigins, campTypes]);

  useEffect(() => {
    const { dim, bright } = buildColorUniforms(campTypes, resolvedCampOrigins.length);
    mat.uniforms.uColorDim.value    = dim;
    mat.uniforms.uColorBright.value = bright;
  }, [campTypes, mat, resolvedCampOrigins.length]);

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;
  });

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  return (
    <points ref={pointsRef} geometry={geo} material={mat} frustumCulled={false} />
  );
});

const EmberPerimeterFlow: React.FC<InstancedEmbersProps> = React.memo(({ campTypes = [] }) => {
  const flowMat = useMemo(() => {
    const [dim, bright] = DEFAULT_PALETTE;
    return new ShaderMaterial({
      uniforms: {
        uTime:         { value: 0 },
        uColorDim:     { value: new Vector3(dim[0], dim[1], dim[2]) },
        uColorBright:  { value: new Vector3(bright[0], bright[1], bright[2]) },
        uNodeCount:    { value: PERIMETER_COUNT },
        uFlowSpeed:    { value: 0.065 },
        uInnerRadius:  { value: FLOW_INNER },
        uOuterRadius:  { value: FLOW_OUTER },
      },
      vertexShader:   FLOW_RING_VERT,
      fragmentShader: FLOW_RING_FRAG,
      transparent:    true,
      depthWrite:     false,
      depthTest:      false,
      blending:       AdditiveBlending,
    });
  }, []);

  useEffect(() => {
    if (!campTypes.length) return;
    const [dim, bright] = resolveRoomPalette(campTypes);
    flowMat.uniforms.uColorDim.value.set(dim[0], dim[1], dim[2]);
    flowMat.uniforms.uColorBright.value.set(bright[0], bright[1], bright[2]);
  }, [campTypes, flowMat]);

  useFrame((_, delta) => {
    flowMat.uniforms.uTime.value += delta;
  });

  useEffect(() => {
    return () => {
      flowMat.dispose();
    };
  }, [flowMat]);

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.14, 0]}
      geometry={sharedFlowRingGeo}
      material={flowMat}
      frustumCulled={false}
      renderOrder={2}
    />
  );
});

const InstancedEmbers: React.FC<InstancedEmbersProps> = ({
  campTypes = [],
  campOrigins,
  showFlowRing = true,
}) => (
  <>
    <EmberRisingPoints campTypes={campTypes} campOrigins={campOrigins} />
    {showFlowRing ? <EmberPerimeterFlow campTypes={campTypes} /> : null}
  </>
);

/** Three hex-edge camp positions (triangle formation) for Fae Realm rooms. */
export function buildFaeRealmEmberCampOrigins(hexRadius: number, edgeInset = -2.2): CampOrigin[] {
  const edgeDistance = hexRadius * Math.cos(Math.PI / 6) - edgeInset;
  const edgeAngles = [Math.PI / 6, (5 * Math.PI) / 6, (3 * Math.PI) / 2];
  return edgeAngles.map((angle) => [
    Math.cos(angle) * edgeDistance,
    0,
    Math.sin(angle) * edgeDistance,
  ] as CampOrigin);
}

export default React.memo(InstancedEmbers);
