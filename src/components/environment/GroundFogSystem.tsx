import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  PlaneGeometry,
  Matrix4,
  Vector3,
  AdditiveBlending,
} from '@/utils/three-exports';

// ---------------------------------------------------------------------------
// Low-lying ground mist — 60 flat instanced planes with radial alpha shader
// Additive blending, zero depth write → near-zero GPU cost
// ---------------------------------------------------------------------------

const FOG_VERT = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vDriftOffset;

  void main() {
    vUv = uv;
    vec4 wp = instanceMatrix * vec4(position, 1.0);

    // Extract a unique per-instance offset from the translation for drift
    float seed = instanceMatrix[3][0] * 0.13 + instanceMatrix[3][2] * 0.07;
    vDriftOffset = seed;

    // Slow horizontal drift in XZ
    float drift = sin(uTime * 0.18 + seed * 6.28) * 0.6;
    wp.x += drift;
    wp.z += cos(uTime * 0.12 + seed * 4.71) * 0.4;

    // Gentle vertical bobbing (very subtle, keeps fog "ground-hugging")
    wp.y += sin(uTime * 0.25 + seed * 9.0) * 0.06;

    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FOG_FRAG = `
  uniform float uTime;
  varying vec2 vUv;
  varying float vDriftOffset;

  void main() {
    // Soft radial falloff from center of the plane
    vec2 centered = vUv - 0.5;
    float dist = length(centered);
    float alpha = smoothstep(0.5, 0.05, dist);

    // Inner turbulence — cheap hash-based variation
    float n = sin(vUv.x * 8.3 + uTime * 0.3 + vDriftOffset * 3.14) *
              cos(vUv.y * 7.1 + uTime * 0.22 + vDriftOffset * 2.71) * 0.5 + 0.5;
    alpha *= 0.08 + n * 0.06;

    // Cool violet-grey mist tint matching the dark fantasy sky
    vec3 col = vec3(0.38, 0.30, 0.50);

    gl_FragColor = vec4(col, alpha);
  }
`;

const WISP_COUNT = 60;

const GroundFogSystem: React.FC = () => {
  const meshRef = useRef<InstancedMesh>(null);

  const geo = useMemo(() => new PlaneGeometry(5.5, 5.5), []);

  const mat = useMemo(() => new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  }), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const m = new Matrix4();
    const pos = new Vector3();

    for (let i = 0; i < WISP_COUNT; i++) {
      // Spread across the arena floor, avoid center path (donut-ish)
      const angle = Math.random() * Math.PI * 2;
      const minR = 4;
      const maxR = 29;
      const r = minR + Math.random() * (maxR - minR);
      pos.set(
        Math.cos(angle) * r,
        0.05 + Math.random() * 0.15, // hug the ground
        Math.sin(angle) * r,
      );

      const scale = 1.2 + Math.random() * 2.2;
      m.makeRotationX(-Math.PI / 2); // lay flat
      // Random Y rotation to vary the turbulence pattern per wisp
      const rotY = new Matrix4().makeRotationZ(Math.random() * Math.PI);
      m.multiply(rotY);
      m.scale(new Vector3(scale, scale, 1));
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
      args={[geo, mat, WISP_COUNT]}
      frustumCulled={false}
      renderOrder={1}
    />
  );
};

export default React.memo(GroundFogSystem);
