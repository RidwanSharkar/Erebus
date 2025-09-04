import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Points, AdditiveBlending } from '@/utils/three-exports';

interface BossTrailEffectProps {
  parentRef: React.RefObject<Group>;
}

const BossTrailEffect: React.FC<BossTrailEffectProps> = ({ parentRef }) => {
  const particlesCount = 1; // More particles than Ascendant for Boss
  const particlesRef = useRef<Points>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const opacitiesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const scalesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (!particlesRef.current?.parent || !parentRef.current) return;
    
    timeRef.current += delta;
    const bossPosition = parentRef.current.position;
    
    // Create a more complex spiral pattern for Boss
    for (let i = 0; i < particlesCount; i++) {
      const angle = (i / particlesCount) * Math.PI * 2 + timeRef.current * 0.8;
      const radius = 0.15 + Math.sin(timeRef.current * 1.5 + i * 0.3) * 0.12; // Larger radius for Boss
      
      positionsRef.current[i * 3] = bossPosition.x + Math.cos(angle) * radius;
      positionsRef.current[i * 3 + 1] = bossPosition.y + Math.sin(timeRef.current * 0.8 + i * 0.15) * 0.0002;
      positionsRef.current[i * 3 + 2] = bossPosition.z + Math.sin(angle) * radius;

      opacitiesRef.current[i] = Math.pow((1 - i / particlesCount), 1.2) * 0.35; // More opacity for Boss
      scalesRef.current[i] = 0.5 * Math.pow((1 - i / particlesCount), 0.5); // Larger scale for Boss
    }

    if (particlesRef.current) {
      const geometry = particlesRef.current.geometry;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.opacity.needsUpdate = true;
      geometry.attributes.scale.needsUpdate = true;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particlesCount}
          array={positionsRef.current}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-opacity"
          count={particlesCount}
          array={opacitiesRef.current}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-scale"
          count={particlesCount}
          array={scalesRef.current}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        vertexShader={`
          attribute float opacity;
          attribute float scale;
          varying float vOpacity;
          void main() {
            vOpacity = opacity;
            vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = scale * 24.0 * (300.0 / -mvPosition.z);
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float strength = smoothstep(0.5, 0.1, d);
            vec3 glowColor = mix(vec3(0.9, 0.0, 0.0), vec3(1.0, 0.3, 0.3), 0.5);
            gl_FragColor = vec4(glowColor, vOpacity * strength);
          }
        `}
      />
    </points>
  );
};

export default BossTrailEffect;
