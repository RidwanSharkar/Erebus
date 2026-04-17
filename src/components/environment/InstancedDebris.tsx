import React, { useRef, useMemo, useEffect } from 'react';
import {
  InstancedMesh,
  OctahedronGeometry,
  ShaderMaterial,
  Matrix4,
  Vector3,
  DoubleSide,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Scattered stone debris — rocks, rubble, broken shards across the arena
// OctahedronGeometry(detail 1) = ~32 tris per rock, 1 draw call for all
// ---------------------------------------------------------------------------

const DEBRIS_VERT = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vNormal   = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const DEBRIS_FRAG = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1,0)), f.x),
      mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
      f.y
    );
  }

  void main() {
    // Base stone color — dark charcoal with slight warm undertone
    vec3 stone = vec3(0.28, 0.24, 0.20);

    // Macro variation: each rock feels unique via world-position seeded noise
    float macro = noise(vWorldPos.xz * 0.9 + vWorldPos.y * 1.3);
    stone = mix(stone * 0.7, stone * 1.3, macro);

    // Micro surface noise (cracks, chips)
    float micro = noise(vWorldPos.xz * 4.5 + 1.7) * 0.5
                + noise(vWorldPos.xz * 9.1 - 3.2) * 0.5;
    stone += (micro - 0.5) * 0.08;

    // Simple directional lighting (sky from above)
    float sky = max(0.0, vNormal.y) * 0.35;
    float side = max(0.0, dot(vNormal, normalize(vec3(1.0, 0.6, -0.4)))) * 0.25;
    float ao   = 0.45; // ambient baseline

    stone *= ao + sky + side;

    // Slight greenish moss in crevices on upward-facing geometry
    vec3 moss = vec3(0.18, 0.28, 0.14);
    float mossBlend = smoothstep(0.45, 0.75, vNormal.y) * noise(vWorldPos.xz * 3.1) * 0.5;
    stone = mix(stone, moss, mossBlend);

    gl_FragColor = vec4(stone, 1.0);
  }
`;

const ROCK_COUNT    = 280;
const ARENA_RADIUS  = 26;

const InstancedDebris: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  const geo = useMemo(() => new OctahedronGeometry(0.18, 1), []);

  const mat = useMemo(() => new ShaderMaterial({
    vertexShader:   DEBRIS_VERT,
    fragmentShader: DEBRIS_FRAG,
    side: DoubleSide,
  }), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const m   = new Matrix4();
    const rot = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < ROCK_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2;
      // Avoid a dead zone right at the very center of the arena
      const minR = 3.5;
      const r    = minR + Math.random() * (ARENA_RADIUS - minR);

      pos.set(Math.cos(angle) * r, 0, Math.sin(angle) * r);

      // Random rotation for each rock — no two face the same way
      rot.makeRotationX(Math.random() * Math.PI);
      const rotY = new Matrix4().makeRotationY(Math.random() * Math.PI * 2);
      rot.multiply(rotY);

      // Size variation: tiny chips to medium chunks
      const s = 0.25 + Math.random() * 1.6;
      // Flatten slightly — rocks rarely stand perfectly tall
      scl.set(s * (0.7 + Math.random() * 0.6), s * (0.4 + Math.random() * 0.5), s * (0.7 + Math.random() * 0.6));
      m.makeScale(scl.x, scl.y, scl.z);
      m.multiply(rot);
      // Sink slightly into ground so they don't float
      pos.y = scl.y * 0.08;
      m.setPosition(pos);

      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, ROCK_COUNT]}
      frustumCulled={false}
      receiveShadow
    />
  );
};

export default React.memo(InstancedDebris);
