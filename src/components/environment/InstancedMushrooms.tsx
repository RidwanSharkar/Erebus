import React, { useRef, useMemo, useLayoutEffect, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  CylinderGeometry,
  Matrix4,
  Vector3,
  Color,
  DoubleSide,
} from '@/utils/three-exports';
import { MUSHROOM_COUNT, buildMushroomInstances } from '@/utils/mushroomLayout';

const STEM_VERT = `
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vHeight   = position.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const STEM_FRAG = `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    vec3 stemLow  = vec3(0.60, 0.72, 0.62);
    vec3 stemHigh = vec3(0.78, 0.92, 0.80);
    vec3 col = mix(stemLow, stemHigh, vHeight + 0.5);
    col *= 0.88 + sin(vHeight * 18.0 + vWorldPos.x * 6.0) * 0.06;
    float pulse = 0.55 + sin(uTime * 1.8 + vWorldPos.x * 3.1 + vWorldPos.z * 2.7) * 0.45;
    vec3 glow = vec3(0.10, 0.85, 0.78) * pulse * 0.35;
    col += glow;
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
    float seed = floor(vWorldPos.x * 0.35) + floor(vWorldPos.z * 0.35) * 17.0;
    float variant = hash(vec2(seed, seed + 3.7));
    vec3 col = mix(uCapColor, vec3(0.15, 0.72, 0.85), variant * 0.5);
    vec2 uv = vWorldPos.xz * 2.1;
    float spot = smoothstep(0.36, 0.28, length(fract(uv) - 0.5)) * 0.45;
    col += vec3(0.9, 0.9, 0.95) * spot;
    float underside = smoothstep(0.1, -0.35, vHeight);
    float pulse = 0.5 + sin(uTime * 2.1 + seed) * 0.5;
    col += vec3(0.08, 0.95, 0.82) * underside * pulse * 0.55;
    col *= 0.7 + smoothstep(0.0, 0.5, vHeight) * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const _zero = new Matrix4().makeScale(0, 0, 0);

export interface InstancedMushroomsProps {
  /** Indices to hide (server-destroyed). */
  hiddenIndices?: ReadonlySet<number>;
}

const InstancedMushrooms: React.FC<InstancedMushroomsProps> = ({ hiddenIndices }) => {
  const stemRef = useRef<InstancedMesh>(null);
  const capRef = useRef<InstancedMesh>(null);

  const instances = useMemo(() => buildMushroomInstances(), []);

  const stemGeo = useMemo(() => new CylinderGeometry(0.06, 0.09, 0.32, 7, 2), []);
  const capGeo = useMemo(() => new CylinderGeometry(0.05, 0.28, 0.12, 10, 1), []);

  const stemMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: STEM_VERT,
        fragmentShader: STEM_FRAG,
        side: DoubleSide,
      }),
    [],
  );

  const capMat = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uCapColor: { value: new Color('#7c22d4') },
        },
        vertexShader: CAP_VERT,
        fragmentShader: CAP_FRAG,
        side: DoubleSide,
      }),
    [],
  );

  const fillInstances = useCallback((hide: ReadonlySet<number> | undefined) => {
    const stem = stemRef.current;
    const cap = capRef.current;
    if (!stem || !cap) return;

    const m = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < MUSHROOM_COUNT; i++) {
      if (hide?.has(i)) {
        stem.setMatrixAt(i, _zero);
        cap.setMatrixAt(i, _zero);
        continue;
      }
      const { x, z, h, cr } = instances[i]!;
      scl.set(1, h / 0.32, 1);
      m.makeScale(scl.x, scl.y, scl.z);
      pos.set(x, h * 0.5, z);
      m.setPosition(pos);
      stem.setMatrixAt(i, m);

      scl.set(cr, h * 0.5, cr);
      m.makeScale(scl.x, scl.y, scl.z);
      pos.set(x, h + 0.04 * h, z);
      m.setPosition(pos);
      cap.setMatrixAt(i, m);
    }

    stem.instanceMatrix.needsUpdate = true;
    cap.instanceMatrix.needsUpdate = true;
  }, [instances]);

  useLayoutEffect(() => {
    if (stemRef.current && capRef.current) {
      fillInstances(hiddenIndices);
      return;
    }
    let raf = 0;
    let attempts = 0;
    const maxAttempts = 90;
    const tick = () => {
      if (stemRef.current && capRef.current) {
        fillInstances(hiddenIndices);
        return;
      }
      if (++attempts >= maxAttempts) return;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [fillInstances, hiddenIndices]);

  useFrame((_, delta) => {
    stemMat.uniforms.uTime.value += delta;
    capMat.uniforms.uTime.value += delta;
  });

  return (
    <group>
      <instancedMesh ref={stemRef} args={[stemGeo, stemMat, MUSHROOM_COUNT]} frustumCulled={false} />
      <instancedMesh ref={capRef} args={[capGeo, capMat, MUSHROOM_COUNT]} frustumCulled={false} />
    </group>
  );
};

export default React.memo(InstancedMushrooms);
