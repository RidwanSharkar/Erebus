import React, { useRef, useMemo, useEffect } from 'react';
import {
  InstancedMesh,
  ShaderMaterial,
  PlaneGeometry,
  Matrix4,
  Vector3,
  AdditiveBlending,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Procedural ground cracks — flat decal planes on stone paths
// Voronoi-cell based crack pattern in fragment shader; no textures needed
// Transparent, renders on top of stone ground (renderOrder 2)
// ---------------------------------------------------------------------------

const CRACK_VERT = `
  varying vec2 vWorldXZ;

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldXZ    = wp.xz; // pass world XZ for crack pattern uniqueness
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CRACK_FRAG = `
  varying vec2 vWorldXZ;

  // ── Voronoi / cell noise for crack skeleton ─────────────────────────────
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  // Distance to nearest Voronoi edge → crack mask
  float voronoiEdge(vec2 p) {
    vec2 pi = floor(p);
    vec2 pf = fract(p);

    float minDist1 = 1e9;
    float minDist2 = 1e9;
    vec2  minPoint;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell  = vec2(float(x), float(y));
        vec2 point = hash2(pi + cell);
        vec2 diff  = cell + point - pf;
        float d    = dot(diff, diff);
        if (d < minDist1) { minDist2 = minDist1; minDist1 = d; minPoint = point; }
        else if (d < minDist2) { minDist2 = d; }
      }
    }
    // Edge distance = difference between two closest cell distances
    return sqrt(minDist2) - sqrt(minDist1);
  }

  void main() {
    // UV coordinates derived from world position for variety per instance
    vec2 uv = vWorldXZ * 0.9;

    float edge1 = voronoiEdge(uv * 1.0);
    float edge2 = voronoiEdge(uv * 2.2 + 3.7);
    float edge3 = voronoiEdge(uv * 4.5 - 1.9);

    // Crack = narrow dark lines at cell edges; thinner at higher frequencies
    float crack1 = smoothstep(0.06, 0.0,  edge1);
    float crack2 = smoothstep(0.03, 0.0,  edge2) * 0.7;
    float crack3 = smoothstep(0.015, 0.0, edge3) * 0.45;

    float cracks = crack1 + crack2 + crack3;
    cracks = clamp(cracks, 0.0, 1.0);

    // Dark charcoal crack color with a hint of the ground shadow
    vec3 crackCol = vec3(0.06, 0.05, 0.04);
    float alpha   = cracks * 0.72;

    gl_FragColor = vec4(crackCol, alpha);
  }
`;

const CRACK_COUNT = 50;

const GroundCracks: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  const geo = useMemo(() => new PlaneGeometry(1, 1), []);

  const mat = useMemo(() => new ShaderMaterial({
    vertexShader:   CRACK_VERT,
    fragmentShader: CRACK_FRAG,
    transparent:    true,
    depthWrite:     false,
    // Multiplicative blend — darkens the stone underneath
    // AdditiveBlending would lighten; keep default NormalBlending for shadow cracks
  }), []);

  // Camp paths + open stone areas to target
  const CAMP_CENTERS: [number, number][] = [
    [  0, -22 ],
    [ 22,   8 ],
    [-22,   8 ],
    [  0,   0 ], // arena center
  ];

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const m   = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < CRACK_COUNT; i++) {
      // 70% near camp stone platforms, 30% on paths between camps
      const camp = CAMP_CENTERS[Math.floor(Math.random() * CAMP_CENTERS.length)];
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 7.5;
      pos.set(camp[0] + Math.cos(a) * r, 0.02, camp[1] + Math.sin(a) * r);

      // Vary size and rotation for each crack slab
      const s = 2.5 + Math.random() * 5.0;
      const rotAngle = Math.random() * Math.PI;

      m.makeRotationX(-Math.PI / 2);                        // lay flat
      const rotY = new Matrix4().makeRotationZ(rotAngle);   // randomise UV sampling direction
      m.multiply(rotY);
      scl.set(s, s, 1);
      m.scale(scl);
      m.setPosition(pos);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, CRACK_COUNT]}
      frustumCulled={false}
      renderOrder={2}
    />
  );
};

export default React.memo(GroundCracks);
