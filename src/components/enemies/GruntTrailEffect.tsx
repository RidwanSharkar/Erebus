import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Points, AdditiveBlending } from '@/utils/three-exports';

interface GruntTrailEffectProps {
  parentRef: React.RefObject<Group>;
}

const GruntTrailEffect: React.FC<GruntTrailEffectProps> = ({ parentRef }) => {
  const particlesCount = 6; // Fewer particles for grunt
  const particlesRef = useRef<Points>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const opacitiesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const scalesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const timeRef = useRef(0);

  useFrame((state, delta) => {
    if (!particlesRef.current?.parent || !parentRef.current) return;
    
    timeRef.current += delta;
    const gruntPosition = parentRef.current.position;
    
    // Create a smaller spherical pattern for grunt
    for (let i = 0; i < particlesCount; i++) {
      // Spherical coordinates
      const phi = Math.acos(-1 + (2 * i) / particlesCount);
      const theta = Math.sqrt(particlesCount * Math.PI) * phi + timeRef.current;
      const radius = 0.5 + Math.sin(timeRef.current * 2 + i * 0.3) * 0.08; // Smaller radius
      
      // Convert to Cartesian coordinates
      positionsRef.current[i * 3] = gruntPosition.x + radius * Math.cos(theta) * Math.sin(phi);
      positionsRef.current[i * 3 + 1] = gruntPosition.y + radius * Math.sin(theta) * Math.sin(phi);
      positionsRef.current[i * 3 + 2] = gruntPosition.z + radius * Math.cos(phi);

      // Opacity and Scale
      opacitiesRef.current[i] = Math.pow((1 - i / particlesCount), 1.2) * 0.25; // Less opacity
      scalesRef.current[i] = 0.3 * Math.pow((1 - i / particlesCount), 0.5); // Smaller scale
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
            gl_PointSize = scale * 20.0 * (300.0 / -mvPosition.z); // Smaller point size
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float strength = smoothstep(0.5, 0.1, d);
            vec3 glowColor = mix(vec3(0.25, 0.41, 0.88), vec3(0.53, 0.81, 0.92), 0.4); // More vibrant blue glow for grunt
            gl_FragColor = vec4(glowColor, vOpacity * strength);
          }
        `}
      />
    </points>
  );
};

export default GruntTrailEffect;
