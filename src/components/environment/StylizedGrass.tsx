import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Vector3,
  Color,
  DoubleSide,
  CircleGeometry,
  MeshBasicMaterial,
} from '@/utils/three-exports';

interface StylizedGrassProps {
  count?: number;
  radius?: number;
  bladeHeight?: number;
  windStrength?: number;
  baseColor?: string;
  tipColor?: string;
  groundColor?: string;
  groundLightColor?: string;
  groundLightIntensity?: number;
}

const GRASS_VERTEX = `
  attribute float aHeightRatio;

  uniform float uTime;
  uniform float uWindStrength;

  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    vec4 wp = instanceMatrix * vec4(position, 1.0);
    float hr = aHeightRatio;
    float bend = hr * hr;

    // Primary rolling wind wave — sweeps across the field
    float phase = wp.x * 0.35 + wp.z * 0.25;
    float w1 = sin(phase + uTime * 1.3) * uWindStrength;

    // Secondary gust layer — offset frequency for organic feel
    float w2 = sin(phase * 2.1 + uTime * 2.1 + 1.7) * uWindStrength * 0.3;

    // Micro flutter — high-frequency per-blade shimmer
    float w3 = cos(wp.x * 3.5 + wp.z * 2.0 + uTime * 4.5) * uWindStrength * 0.06;

    float wind = (w1 + w2 + w3) * bend;

    wp.x += wind;
    wp.z += wind * 0.4;
    // Slight vertical compression when bending for realism
    wp.y -= abs(wind) * 0.1;

    vHeightRatio = hr;
    vWorldPos = wp.xyz;

    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const GRASS_FRAGMENT = `
  uniform vec3 uBaseColor;
  uniform vec3 uTipColor;
  uniform vec3 uGroundLightColor;
  uniform float uGroundLightIntensity;

  varying float vHeightRatio;
  varying vec3 vWorldPos;

  void main() {
    // Gradient from dark base to bright tip
    vec3 col = mix(uBaseColor, uTipColor, vHeightRatio);

    // Low-frequency spatial color variation (meadow patches)
    float n1 = sin(vWorldPos.x * 1.7) * cos(vWorldPos.z * 2.1) * 0.10;
    // High-frequency variation for blade-level uniqueness
    float n2 = sin(vWorldPos.x * 5.3 + 2.0) * cos(vWorldPos.z * 4.7 + 1.0) * 0.04;
    col += n1 + n2;

    // Ground bounce light — warms and brightens the lower half of every blade
    float bounceFalloff = 1.0 - smoothstep(0.0, 0.7, vHeightRatio);
    col += uGroundLightColor * uGroundLightIntensity * bounceFalloff;

    // Tips catch overhead light (raised from 0.55 → 0.65 for overall brightness)
    col *= 0.65 + vHeightRatio * 0.35;

    // Ambient occlusion at the base (raised floor 0.4 → 0.55 so base isn't so dark)
    col *= 0.55 + smoothstep(0.0, 0.25, vHeightRatio) * 0.45;

    // Fade at the edge of the playable area (matches radius prop)
    float dist = length(vWorldPos.xz);
    col *= 1.0 - smoothstep(27.5, 31.5, dist) * 0.5;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const StylizedGrass: React.FC<StylizedGrassProps> = ({
  count = 80000,
  radius = 31,
  bladeHeight = 0.45,
  windStrength = 0.25,
  baseColor = '#1a4d1a',
  tipColor = '#4caf50',
  groundColor = '#1a2e12',
  groundLightColor = '#3a7a2a',
  groundLightIntensity = 0.45,
}) => {
  const meshRef = useRef<InstancedMesh>(null);

  const bladeGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    const w = 0.07;

    // Tapered blade: wide base → narrow tip, 3 height segments for smooth bending
    const positions = new Float32Array([
      -w * 0.50, 0,    0,
       w * 0.50, 0,    0,
      -w * 0.35, 0.33, 0,
       w * 0.35, 0.33, 0,
      -w * 0.15, 0.66, 0,
       w * 0.15, 0.66, 0,
       0,        1.0,  0,
    ]);

    // 5 triangles (2 quads + 1 top tri)
    geo.setIndex([0,1,3, 0,3,2, 2,3,5, 2,5,4, 4,5,6]);

    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geo.setAttribute(
      'aHeightRatio',
      new Float32BufferAttribute(new Float32Array([0, 0, 0.33, 0.33, 0.66, 0.66, 1.0]), 1)
    );

    return geo;
  }, []);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uBaseColor: { value: new Color(baseColor) },
        uTipColor: { value: new Color(tipColor) },
        uWindStrength: { value: windStrength },
        uGroundLightColor: { value: new Color(groundLightColor) },
        uGroundLightIntensity: { value: groundLightIntensity },
      },
      vertexShader: GRASS_VERTEX,
      fragmentShader: GRASS_FRAGMENT,
      side: DoubleSide,
    });
  }, [baseColor, tipColor, windStrength, groundLightColor, groundLightIntensity]);

  // Soil disc geometry + material (created once)
  const groundGeo = useMemo(() => new CircleGeometry(radius, 48), [radius]);
  const groundMat = useMemo(() => new MeshBasicMaterial({ color: groundColor }), [groundColor]);

  // Distribute blades once on mount
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const mat = new Matrix4();
    const lean = new Matrix4();
    const scl = new Vector3();
    const pos = new Vector3();

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * radius;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;

      // Positional height clumping — creates natural taller / shorter patches
      const clump =
        Math.sin(x * 0.3 + 0.7) * Math.cos(z * 0.5 + 1.2) * 0.4 + 0.6;

      mat.makeRotationY(Math.random() * Math.PI);
      lean.makeRotationX((Math.random() - 0.5) * 0.3);
      mat.multiply(lean);

      scl.set(
        0.8 + Math.random() * 0.5,
        bladeHeight * (0.3 + Math.random() * 1.4) * clump,
        0.8 + Math.random() * 0.5,
      );
      mat.scale(scl);

      pos.set(x, 0, z);
      mat.setPosition(pos);

      mesh.setMatrixAt(i, mat);
    }

    mesh.instanceMatrix.needsUpdate = true;
  }, [count, radius, bladeHeight]);

  useFrame((_, delta) => {
    material.uniforms.uTime.value += delta;
  });

  return (
    <group>
      {/* Dark soil disc sits just above the existing ground */}
      <mesh
        geometry={groundGeo}
        material={groundMat}
        rotation-x={-Math.PI / 2}
        position-y={0.01}
      />

      <instancedMesh
        ref={meshRef}
        args={[bladeGeometry, material, count]}
        frustumCulled={false}
      />
    </group>
  );
};

export default React.memo(StylizedGrass);
