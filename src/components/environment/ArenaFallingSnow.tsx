import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
} from '@/utils/three-exports';
import { MAIN_MAP_RADIUS } from '@/utils/mapConstants';

// GPU-only snowfall across the main arena (blue room).
const SNOW_VERT = `
  attribute vec3  aOrigin;
  attribute float aRand;
  attribute float aSpeed;

  uniform float uTime;

  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    float sp = 0.4 + aSpeed * 0.9;
    float t = uTime * sp + aRand * 50.0;
    float y = 19.0 - mod(t, 24.0);

    float xW = sin(uTime * 0.38 + aRand * 6.28) * 0.22;
    float zW = cos(uTime * 0.32 + aRand * 4.2) * 0.2;

    vec3 pos = vec3(aOrigin.x + xW, y, aOrigin.z + zW);

    float lowFade = smoothstep(0.0, 0.5, y);
    float highFade = 1.0 - smoothstep(16.0, 19.0, y);
    vAlpha = 0.45 * lowFade * highFade * (0.5 + 0.5 * aRand);

    vec3 base = vec3(0.75, 0.85, 0.95);
    vColor = base + vec3(0.1, 0.12, 0.12) * aRand;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (0.75 + aRand * 0.55) * (150.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const SNOW_FRAG = `
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec2  c   = gl_PointCoord - 0.5;
    float r   = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.35, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.85);
  }
`;

const DEFAULT_COUNT = 2600;

interface ArenaFallingSnowProps {
  count?: number;
  radius?: number;
}

const ArenaFallingSnow: React.FC<ArenaFallingSnowProps> = ({
  count = DEFAULT_COUNT,
  radius = MAIN_MAP_RADIUS,
}) => {
  const { geometry: geo, material: mat } = useMemo(() => {
    const rMax = radius - 0.7;
    const geometry = new BufferGeometry();
    const origins = new Float32Array(count * 3);
    const rands = new Float32Array(count);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      origins[i * 3] = (Math.random() * 2 - 1) * rMax;
      origins[i * 3 + 1] = 0;
      origins[i * 3 + 2] = (Math.random() * 2 - 1) * rMax;
      rands[i] = Math.random();
      speeds[i] = 0.35 + Math.random() * 0.65;
    }
    geometry.setAttribute('aOrigin', new Float32BufferAttribute(origins, 3));
    geometry.setAttribute('aRand', new Float32BufferAttribute(rands, 1));
    geometry.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1));
    geometry.setAttribute('position', new Float32BufferAttribute(origins, 3));

    const material = new ShaderMaterial({
      vertexShader: SNOW_VERT,
      fragmentShader: SNOW_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
    });
    return { geometry, material };
  }, [count, radius]);

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={1} />;
};

export default React.memo(ArenaFallingSnow);
