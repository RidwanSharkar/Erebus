import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, ShaderMaterial, PlaneGeometry, Color, Vector3 } from '@/utils/three-exports';

interface VolumetricLightingProps {
  lightPosition: [number, number, number];
  cameraPosition: [number, number, number];
  intensity?: number;
  color?: string;
}

/**
 * Creates volumetric god rays effect from light sources
 * Provides atmospheric lighting without heavy performance cost
 */
const VolumetricLighting: React.FC<VolumetricLightingProps> = ({
  lightPosition = [0, 0, 0],
  cameraPosition = [0, 0, 0],
  intensity = 0.3,
  color = '#ffffff'
}) => {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const timeRef = useRef(0);

  const material = useMemo(() => {
    return new ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        lightPosition: { value: new Vector3(...lightPosition) },
        cameraPosition: { value: new Vector3(...cameraPosition) },
        lightColor: { value: new Color(color) },
        intensity: { value: intensity }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec3 lightPosition;
        uniform vec3 cameraPosition;
        uniform vec3 lightColor;
        uniform float intensity;

        varying vec3 vWorldPosition;
        varying vec2 vUv;

        void main() {
          // Calculate direction from camera to light
          vec3 lightDir = normalize(lightPosition - cameraPosition);
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);

          // Calculate angle between view direction and light direction
          float cosAngle = dot(viewDir, lightDir);
          float angle = acos(cosAngle);

          // Create radial falloff from center
          vec2 center = vec2(0.5, 0.5);
          float distance = length(vUv - center);

          // Combine angle and distance for ray intensity
          float rayIntensity = pow(max(0.0, cosAngle), 8.0) * (1.0 - smoothstep(0.0, 0.5, distance));

          // Add some noise for more natural look
          float noise = sin(vUv.x * 10.0 + time) * sin(vUv.y * 8.0 + time * 0.7) * 0.1 + 0.9;

          // Apply time-based animation
          float animation = sin(time * 2.0) * 0.1 + 0.9;

          vec3 finalColor = lightColor * rayIntensity * intensity * noise * animation;
          float alpha = rayIntensity * 0.3;

          gl_FragColor = vec4(finalColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: 2 // AdditiveBlending
    });
  }, [lightPosition, cameraPosition, color, intensity]);

  const geometry = useMemo(() => new PlaneGeometry(100, 100), []);

  // Update uniforms each frame
  useFrame((state, delta) => {
    timeRef.current += delta;
    if (materialRef.current) {
      materialRef.current.uniforms.time.value = timeRef.current;
      materialRef.current.uniforms.cameraPosition.value.copy(state.camera.position);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, 25, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      geometry={geometry}
      material={material}
      renderOrder={0} // Render before other objects
    />
  );
};

export default VolumetricLighting;
