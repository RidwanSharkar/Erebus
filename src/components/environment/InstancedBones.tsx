import React, { useRef, useMemo, useEffect } from 'react';
import {
  InstancedMesh,
  ShaderMaterial,
  CylinderGeometry,
  OctahedronGeometry,
  Matrix4,
  Vector3,
  DoubleSide,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Scattered bones & crude skulls — dark horror prop, zero animation needed
// Shard bones: CylinderGeometry. Skulls: OctahedronGeometry (rough sphere).
// 2 draw calls total.
// ---------------------------------------------------------------------------

const BONE_VERT = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos   = wp.xyz;
    vNormal     = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const BONE_FRAG = `
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    // Aged yellowed bone — slightly warm ivory
    vec3 ivory = vec3(0.82, 0.76, 0.58);

    // Stain variation — darker patches simulate age/grime
    float stain = hash(vWorldPos.xz * 2.3) * 0.4 + hash(vWorldPos.xz * 6.7 + 1.1) * 0.2;
    vec3 col = mix(ivory * 0.55, ivory, stain);

    // Directional lighting
    float sky  = max(0.0, vNormal.y) * 0.4;
    float side = max(0.0, dot(vNormal, normalize(vec3(0.8, 0.5, -0.6)))) * 0.3;
    col *= 0.38 + sky + side;

    // Slight green tinge from ground moss contact
    col = mix(col, col * vec3(0.80, 1.05, 0.78), smoothstep(0.2, -0.3, vNormal.y) * 0.4);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const BONE_COUNT  = 120;
const SKULL_COUNT = 35;

// Concentration near the 3 camp areas
const CAMP_CENTERS: [number, number][] = [
  [  0, -22 ],
  [ 22,   8 ],
  [-22,   8 ],
];

function bonePosition(i: number, total: number): Vector3 {
  // 60% near camps, 40% scattered freely
  const nearCamp = Math.random() < 0.6;
  const pos = new Vector3();
  if (nearCamp) {
    const camp = CAMP_CENTERS[Math.floor(Math.random() * CAMP_CENTERS.length)];
    const a = Math.random() * Math.PI * 2;
    const r = 2.5 + Math.random() * 6.5;
    pos.set(camp[0] + Math.cos(a) * r, 0, camp[1] + Math.sin(a) * r);
  } else {
    const a = Math.random() * Math.PI * 2;
    const r = 5 + Math.random() * 24;
    pos.set(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  return pos;
}

const InstancedBones: React.FC = () => {
  const boneRef  = useRef<InstancedMesh>(null);
  const skullRef = useRef<InstancedMesh>(null);

  // Elongated shard for bone fragments
  const boneGeo  = useMemo(() => new CylinderGeometry(0.025, 0.04, 0.38, 5, 1), []);
  // Lumpy sphere for skulls
  const skullGeo = useMemo(() => new OctahedronGeometry(0.14, 1), []);

  const boneMat  = useMemo(() => new ShaderMaterial({
    vertexShader:   BONE_VERT,
    fragmentShader: BONE_FRAG,
    side: DoubleSide,
  }), []);

  const skullMat = useMemo(() => new ShaderMaterial({
    vertexShader:   BONE_VERT,
    fragmentShader: BONE_FRAG,
    side: DoubleSide,
  }), []);

  useEffect(() => {
    const bones  = boneRef.current;
    const skulls = skullRef.current;
    if (!bones || !skulls) return;

    const m   = new Matrix4();
    const rot = new Matrix4();
    const scl = new Vector3();

    // ── Bone shards ──────────────────────────────────────────────────────────
    for (let i = 0; i < BONE_COUNT; i++) {
      const pos = bonePosition(i, BONE_COUNT);

      // Bones lie mostly flat on the ground — random tilt up to 45°
      const tilt = (Math.random() - 0.5) * Math.PI * 0.5;
      rot.makeRotationZ(tilt);
      const rotY = new Matrix4().makeRotationY(Math.random() * Math.PI * 2);
      rot.multiply(rotY);

      const s = 0.5 + Math.random() * 1.4;
      scl.set(s, s, s);
      m.makeScale(scl.x, scl.y, scl.z);
      m.multiply(rot);
      // Keep mostly at ground level
      pos.y = 0.04 * s;
      m.setPosition(pos);
      bones.setMatrixAt(i, m);
    }

    // ── Skulls ───────────────────────────────────────────────────────────────
    for (let i = 0; i < SKULL_COUNT; i++) {
      const pos = bonePosition(i, SKULL_COUNT);

      // Skulls sit flat, slight random tilt
      const tilt = (Math.random() - 0.5) * 0.5;
      rot.makeRotationX(tilt);
      const rotY = new Matrix4().makeRotationY(Math.random() * Math.PI * 2);
      rot.premultiply(rotY);

      const s = 0.7 + Math.random() * 0.9;
      scl.set(s, s * 0.85, s); // slightly squashed Y
      m.makeScale(scl.x, scl.y, scl.z);
      m.multiply(rot);
      pos.y = 0.1 * s;
      m.setPosition(pos);
      skulls.setMatrixAt(i, m);
    }

    bones.instanceMatrix.needsUpdate  = true;
    skulls.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={boneRef}  args={[boneGeo,  boneMat,  BONE_COUNT]}  frustumCulled={false} />
      <instancedMesh ref={skullRef} args={[skullGeo, skullMat, SKULL_COUNT]} frustumCulled={false} />
    </group>
  );
};

export default React.memo(InstancedBones);
