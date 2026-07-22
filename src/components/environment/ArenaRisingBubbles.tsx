import React, { useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  AdditiveBlending,
} from '@/utils/three-exports';
import { PENTAGON_ARENA_RADIUS } from '@/utils/mapConstants';

const BUBBLE_VERT = `
  attribute vec3  aOrigin;
  attribute float aRand;
  attribute float aSpeed;

  uniform float uTime;

  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    float sp = 0.25 + aSpeed * 0.45;
    float t = uTime * sp + aRand * 50.0;
    float y = mod(t, 24.0) - 2.0;

    float xW = sin(uTime * 0.28 + aRand * 6.28) * 0.35;
    float zW = cos(uTime * 0.24 + aRand * 4.2) * 0.32;

    vec3 pos = vec3(aOrigin.x + xW, y, aOrigin.z + zW);

    float lowFade = smoothstep(0.0, 1.5, y);
    float highFade = 1.0 - smoothstep(18.0, 22.0, y);
    vAlpha = 0.55 * lowFade * highFade * (0.45 + 0.55 * aRand);

    vec3 base = vec3(0.72, 0.92, 1.0);
    vColor = base + vec3(0.08, 0.12, 0.15) * aRand;

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = (1.1 + aRand * 0.9) * (180.0 / -mvPos.z);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

const BUBBLE_FRAG = `
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec2  c   = gl_PointCoord - 0.5;
    float r   = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.25, 1.0, r);
    float ring = smoothstep(0.55, 0.75, r) * (1.0 - smoothstep(0.75, 0.95, r));
    vec3 col = mix(vColor, vec3(1.0), ring * 0.35);
    gl_FragColor = vec4(col, vAlpha * soft * 0.9);
  }
`;

const DEFAULT_COUNT = 220;

interface ArenaRisingBubblesProps {
  count?: number;
  radius?: number;
}

const ArenaRisingBubbles: React.FC<ArenaRisingBubblesProps> = ({
  count = DEFAULT_COUNT,
  radius = PENTAGON_ARENA_RADIUS,
}) => {
  const { geometry: geo, material: mat } = useMemo(() => {
    const inset = 1.2;
    const apothem = radius * Math.cos(Math.PI / 5) - inset;
    const geometry = new BufferGeometry();
    const origins = new Float32Array(count * 3);
    const rands = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      let x = 0;
      let z = 0;
      for (let attempt = 0; attempt < 24; attempt++) {
        x = (Math.random() * 2 - 1) * apothem;
        z = (Math.random() * 2 - 1) * apothem;
        let inside = true;
        for (let j = 0; j < 5; j++) {
          const a = (2.0 * 3.14159265 / 5.0) * j - 1.5707963;
          if (x * Math.cos(a) + z * Math.sin(a) > apothem) {
            inside = false;
            break;
          }
        }
        if (inside) break;
      }
      origins[i * 3] = x;
      origins[i * 3 + 1] = 0;
      origins[i * 3 + 2] = z;
      rands[i] = Math.random();
      speeds[i] = 0.25 + Math.random() * 0.75;
    }

    geometry.setAttribute('aOrigin', new Float32BufferAttribute(origins, 3));
    geometry.setAttribute('aRand', new Float32BufferAttribute(rands, 1));
    geometry.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1));
    geometry.setAttribute('position', new Float32BufferAttribute(origins, 3));

    const material = new ShaderMaterial({
      vertexShader: BUBBLE_VERT,
      fragmentShader: BUBBLE_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
    });
    return { geometry, material };
  }, [count, radius]);

  useEffect(() => {
    return () => {
      geo.dispose();
      mat.dispose();
    };
  }, [geo, mat]);

  useFrame((_, delta) => {
    mat.uniforms.uTime.value += delta;
  });

  return <points geometry={geo} material={mat} frustumCulled={false} renderOrder={2} />;
};

export default React.memo(ArenaRisingBubbles);
