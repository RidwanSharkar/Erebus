import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';

interface RejuvenatingShotTrailProps {
  color: Color;
  size: number;
  meshRef: React.RefObject<Mesh | Group>;
  opacity?: number;
}

const RejuvenatingShotTrail: React.FC<RejuvenatingShotTrailProps> = ({
  color,
  size,
  meshRef,
  opacity = 1
}) => {
  const particlesCount = 30; // More particles for a smoother healing trail
  const particlesRef = useRef<Points>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const opacitiesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const scalesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const isInitialized = useRef(false);

  // ref to store the last known position for smoother updates
  const lastKnownPosition = useRef(new Vector3());

  // Control trail update frequency
  const minMovementDistance = 0.06; // Minimum distance before updating trail
  const updateTimer = useRef(0);
  const updateInterval = 0.018; // Update rate for smooth trail

  // Initialize positions only once when mesh is available
  useEffect(() => {
    if (meshRef.current && !isInitialized.current) {
      // Get world position to handle coordinate space correctly
      const worldPosition = new Vector3();
      meshRef.current.getWorldPosition(worldPosition);
      const { x, y, z } = worldPosition;
      lastKnownPosition.current.set(x, y, z);

      // Initialize all particles at the starting position
      for (let i = 0; i < particlesCount; i++) {
        positionsRef.current[i * 3] = x;
        positionsRef.current[i * 3 + 1] = y;
        positionsRef.current[i * 3 + 2] = z;
        opacitiesRef.current[i] = 0;
        scalesRef.current[i] = 0;
      }
      isInitialized.current = true;
    }
  }, [meshRef]);

  useFrame((_, delta) => {
    if (!particlesRef.current?.parent || !meshRef.current || !isInitialized.current) return;

    updateTimer.current += delta;

    // Only update at controlled intervals
    if (updateTimer.current < updateInterval) return;
    updateTimer.current = 0;

    // Get world position to handle coordinate space correctly
    const worldPosition = new Vector3();
    meshRef.current.getWorldPosition(worldPosition);

    // Calculate movement distance
    const distance = worldPosition.distanceTo(lastKnownPosition.current);

    // Only update if there's meaningful movement
    if (distance > minMovementDistance) {
      lastKnownPosition.current.copy(worldPosition);

      // Update particle positions by shifting them backward
      for (let i = particlesCount - 1; i > 0; i--) {
        positionsRef.current[i * 3] = positionsRef.current[(i - 1) * 3];
        positionsRef.current[i * 3 + 1] = positionsRef.current[(i - 1) * 3 + 1];
        positionsRef.current[i * 3 + 2] = positionsRef.current[(i - 1) * 3 + 2];
      }

      // Update lead particle
      positionsRef.current[0] = worldPosition.x;
      positionsRef.current[1] = worldPosition.y;
      positionsRef.current[2] = worldPosition.z;

      // Update geometry attributes
      if (particlesRef.current) {
        const geometry = particlesRef.current.geometry;
        geometry.attributes.position.needsUpdate = true;
      }
    }

    // Update opacities and scales with parent opacity
    for (let i = 0; i < particlesCount; i++) {
      opacitiesRef.current[i] = Math.pow((1 - i / particlesCount), 2) * 0.8 * opacity;
      scalesRef.current[i] = size * 0.7 * Math.pow((1 - i / particlesCount), 0.7);
    }

    if (particlesRef.current) {
      const geometry = particlesRef.current.geometry;
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
            gl_PointSize = scale * 20.0 * (300.0 / -mvPosition.z);
          }
        `}
        fragmentShader={`
          varying float vOpacity;
          uniform vec3 uColor;
          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            float strength = smoothstep(0.5, 0.1, d);
            // Healing trail: mix with bright cyan for a soothing, magical effect
            vec3 glowColor = mix(uColor, vec3(0.2, 1.0, 0.8), 0.6);
            gl_FragColor = vec4(glowColor * 1.2, vOpacity * strength);
          }
        `}
        uniforms={{
          uColor: { value: color },
        }}
      />
    </points>
  );
};

export default RejuvenatingShotTrail;
