import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';

const REJUVENATING_TRAIL_VERTEX_SHADER = `
  attribute float opacity;
  attribute float scale;
  varying float vOpacity;
  void main() {
    vOpacity = opacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = scale * 20.0 * (300.0 / -mvPosition.z);
  }
`;

const REJUVENATING_TRAIL_FRAGMENT_SHADER = `
  varying float vOpacity;
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float strength = smoothstep(0.5, 0.1, d);
    vec3 glowColor = mix(uColor, vec3(0.2, 1.0, 0.8), 0.6);
    gl_FragColor = vec4(glowColor * 1.2, vOpacity * strength);
  }
`;

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
  const particlesCount = 30;
  const particlesRef = useRef<Points>(null);
  const positionsRef = useRef<Float32Array>(new Float32Array(particlesCount * 3));
  const opacitiesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const scalesRef = useRef<Float32Array>(new Float32Array(particlesCount));
  const isInitialized = useRef(false);

  const lastKnownPosition = useRef(new Vector3());
  const _worldPosScratch = useRef(new Vector3());

  const minMovementDistance = 0.06;
  const updateTimer = useRef(0);
  const updateInterval = 0.018;

  const uniforms = useMemo(
    () => ({
      uColor: { value: color.clone() },
    }),
    [color],
  );

  useEffect(() => {
    uniforms.uColor.value.copy(color);
  }, [color, uniforms]);

  useEffect(() => {
    return () => {
      const points = particlesRef.current;
      if (!points) return;
      points.geometry?.dispose();
      const mat = points.material;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat?.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if (meshRef.current && !isInitialized.current) {
      const worldPosition = _worldPosScratch.current;
      meshRef.current.getWorldPosition(worldPosition);
      const { x, y, z } = worldPosition;
      lastKnownPosition.current.set(x, y, z);

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

    if (updateTimer.current < updateInterval) return;
    updateTimer.current = 0;

    const worldPosition = _worldPosScratch.current;
    meshRef.current.getWorldPosition(worldPosition);

    const distance = worldPosition.distanceTo(lastKnownPosition.current);

    if (distance > minMovementDistance) {
      lastKnownPosition.current.copy(worldPosition);

      for (let i = particlesCount - 1; i > 0; i--) {
        positionsRef.current[i * 3] = positionsRef.current[(i - 1) * 3];
        positionsRef.current[i * 3 + 1] = positionsRef.current[(i - 1) * 3 + 1];
        positionsRef.current[i * 3 + 2] = positionsRef.current[(i - 1) * 3 + 2];
      }

      positionsRef.current[0] = worldPosition.x;
      positionsRef.current[1] = worldPosition.y;
      positionsRef.current[2] = worldPosition.z;

      if (particlesRef.current) {
        const geometry = particlesRef.current.geometry;
        geometry.attributes.position.needsUpdate = true;
      }
    }

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
        vertexShader={REJUVENATING_TRAIL_VERTEX_SHADER}
        fragmentShader={REJUVENATING_TRAIL_FRAGMENT_SHADER}
        uniforms={uniforms}
      />
    </points>
  );
};

export default RejuvenatingShotTrail;
