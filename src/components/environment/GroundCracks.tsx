import React, { useRef, useMemo, useEffect } from 'react';
import { InstancedBufferAttribute } from 'three';
import {
  InstancedMesh,
  ShaderMaterial,
  PlaneGeometry,
  Matrix4,
  Vector3,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Procedural ground cracks — flat decal planes on stone paths
// Voronoi-cell based crack pattern in fragment shader; no textures needed
// Transparent, renders on top of stone ground (renderOrder 2)
// ---------------------------------------------------------------------------

const CRACK_VERT = `
  attribute vec2 aCrackSeed;
  varying vec2 vCrackUv;

  void main() {
    vCrackUv = uv * 2.5 + aCrackSeed;
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CRACK_FRAG = `
  varying vec2 vCrackUv;

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453);
  }

  float voronoiEdge(vec2 p) {
    vec2 pi = floor(p);
    vec2 pf = fract(p);

    float minDist1 = 1e9;
    float minDist2 = 1e9;

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 cell  = vec2(float(x), float(y));
        vec2 point = hash2(pi + cell);
        vec2 diff  = cell + point - pf;
        float d    = dot(diff, diff);
        if (d < minDist1) { minDist2 = minDist1; minDist1 = d; }
        else if (d < minDist2) { minDist2 = d; }
      }
    }
    return sqrt(minDist2) - sqrt(minDist1);
  }

  float crackLine(float edge, float baseWidth) {
    float w = max(baseWidth, fwidth(edge) * 1.5);
    return smoothstep(w, 0.0, edge);
  }

  void main() {
    vec2 uv = vCrackUv;

    float edge1 = voronoiEdge(uv * 1.0);
    float edge2 = voronoiEdge(uv * 2.2 + 3.7);
    float edge3 = voronoiEdge(uv * 4.5 - 1.9);

    float crack1 = crackLine(edge1, 0.06);
    float crack2 = crackLine(edge2, 0.03) * 0.7;
    float crack3 = crackLine(edge3, 0.015) * 0.45;

    float cracks = clamp(crack1 + crack2 + crack3, 0.0, 1.0);

    vec3 crackCol = vec3(0.06, 0.05, 0.04);
    float alpha   = cracks * 0.72;

    gl_FragColor = vec4(crackCol, alpha);
  }
`;

const CRACK_COUNT = 40;
const CRACK_SEED = 0x4a7f;

function seededRandom(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const CAMP_CENTERS: [number, number][] = [
  [0, -15],
  [15, 7],
  [-15, 7],
  [0, 0],
];

const GroundCracks: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  const geo = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1);
    geometry.setAttribute(
      'aCrackSeed',
      new InstancedBufferAttribute(new Float32Array(CRACK_COUNT * 2), 2),
    );
    return geometry;
  }, []);

  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CRACK_VERT,
        fragmentShader: CRACK_FRAG,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const seedAttr = geo.getAttribute('aCrackSeed') as InstancedBufferAttribute;
    const m = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < CRACK_COUNT; i++) {
      const baseSeed = CRACK_SEED + i * 17.31;
      const campIdx = Math.floor(seededRandom(baseSeed) * CAMP_CENTERS.length);
      const camp = CAMP_CENTERS[campIdx];
      const a = seededRandom(baseSeed + 1.7) * Math.PI * 2;
      const r = seededRandom(baseSeed + 3.1) * 7.5;
      pos.set(camp[0] + Math.cos(a) * r, 0.03, camp[1] + Math.sin(a) * r);

      const s = 2.5 + seededRandom(baseSeed + 5.3) * 5.0;
      const rotAngle = seededRandom(baseSeed + 7.9) * Math.PI;

      seedAttr.setXY(i, seededRandom(baseSeed + 11.2) * 8.0, seededRandom(baseSeed + 13.4) * 8.0);

      m.makeRotationX(-Math.PI / 2);
      const rotY = new Matrix4().makeRotationZ(rotAngle);
      m.multiply(rotY);
      scl.set(s, s, 1);
      m.scale(scl);
      m.setPosition(pos);
      mesh.setMatrixAt(i, m);
    }

    seedAttr.needsUpdate = true;
    mesh.instanceMatrix.needsUpdate = true;
  }, [geo]);

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
