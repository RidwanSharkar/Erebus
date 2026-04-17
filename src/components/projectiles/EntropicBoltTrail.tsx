import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';

interface EntropicBoltTrailProps {
  color: Color;
  size: number;
  meshRef: React.RefObject<Mesh | Group>;
  opacity?: number;
  isCryoflame?: boolean;
}

const TRAIL_LENGTH = 20;
const ORBIT_RADIUS = 0.14;
const ORBIT_SPEED = 10;
const MIN_MOVEMENT = 0.06;
const UPDATE_INTERVAL = 0.016;

const EntropicBoltTrail: React.FC<EntropicBoltTrailProps> = ({
  color,
  size,
  meshRef,
  opacity = 1,
}) => {
  const trail1Ref = useRef<Points>(null);
  const trail2Ref = useRef<Points>(null);

  // Path history: stores the bolt's center positions over time
  const pathHistory = useRef<Vector3[]>([]);
  const lastKnownPosition = useRef(new Vector3());
  const isInitialized = useRef(false);
  const timeRef = useRef(0);
  const updateTimer = useRef(0);

  // Separate position/opacity/scale buffers for each orbital trail
  const pos1 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3));
  const opa1 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const scl1 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));

  const pos2 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3));
  const opa2 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const scl2 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));

  useEffect(() => {
    if (meshRef.current && !isInitialized.current) {
      const wp = new Vector3();
      meshRef.current.getWorldPosition(wp);
      lastKnownPosition.current.copy(wp);

      for (let i = 0; i < TRAIL_LENGTH; i++) {
        pathHistory.current.push(wp.clone());
        pos1.current[i * 3] = wp.x;
        pos1.current[i * 3 + 1] = wp.y;
        pos1.current[i * 3 + 2] = wp.z;
        pos2.current[i * 3] = wp.x;
        pos2.current[i * 3 + 1] = wp.y;
        pos2.current[i * 3 + 2] = wp.z;
        opa1.current[i] = 0;
        opa2.current[i] = 0;
        scl1.current[i] = 0;
        scl2.current[i] = 0;
      }
      isInitialized.current = true;
    }
  }, [meshRef]);

  useFrame((_, delta) => {
    if (!meshRef.current || !isInitialized.current) return;
    if (!trail1Ref.current?.parent || !trail2Ref.current?.parent) return;

    timeRef.current += delta;
    updateTimer.current += delta;
    if (updateTimer.current < UPDATE_INTERVAL) return;
    updateTimer.current = 0;

    const wp = new Vector3();
    meshRef.current.getWorldPosition(wp);

    if (wp.distanceTo(lastKnownPosition.current) > MIN_MOVEMENT) {
      lastKnownPosition.current.copy(wp);
      pathHistory.current.unshift(wp.clone());
      if (pathHistory.current.length > TRAIL_LENGTH) pathHistory.current.pop();
    }

    const t = timeRef.current * ORBIT_SPEED;
    const count = Math.min(pathHistory.current.length, TRAIL_LENGTH);

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      if (i >= count) {
        opa1.current[i] = 0;
        opa2.current[i] = 0;
        scl1.current[i] = 0;
        scl2.current[i] = 0;
        continue;
      }

      const center = pathHistory.current[i];
      // Helix angle increases along the trail length and rotates over time
      const angle = (i / TRAIL_LENGTH) * Math.PI * 3 + t;
      const fade = Math.pow(1 - i / TRAIL_LENGTH, 1.8) * opacity;

      // Trail 1: primary orbital position
      pos1.current[i * 3]     = center.x + Math.cos(angle) * ORBIT_RADIUS;
      pos1.current[i * 3 + 1] = center.y + Math.sin(angle) * ORBIT_RADIUS;
      pos1.current[i * 3 + 2] = center.z;

      // Trail 2: opposite phase (π offset) — swirls around trail 1
      pos2.current[i * 3]     = center.x + Math.cos(angle + Math.PI) * ORBIT_RADIUS;
      pos2.current[i * 3 + 1] = center.y + Math.sin(angle + Math.PI) * ORBIT_RADIUS;
      pos2.current[i * 3 + 2] = center.z;

      const particleSize = size * 0.65 * (1 - (i / TRAIL_LENGTH) * 0.5);
      opa1.current[i] = fade * 0.95;
      scl1.current[i] = particleSize;
      opa2.current[i] = fade * 0.95;
      scl2.current[i] = particleSize;
    }

    for (const ref of [trail1Ref, trail2Ref]) {
      if (ref.current) {
        ref.current.geometry.attributes.position.needsUpdate = true;
        ref.current.geometry.attributes.opacity.needsUpdate = true;
        ref.current.geometry.attributes.scale.needsUpdate = true;
      }
    }
  });

  const vertexShader = `
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

  const fragmentShader = `
    varying float vOpacity;
    uniform vec3 uColor;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float strength = smoothstep(0.5, 0.05, d);
      gl_FragColor = vec4(uColor * 2.2, vOpacity * strength);
    }
  `;

  return (
    <>
      <points ref={trail1Ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={TRAIL_LENGTH} array={pos1.current} itemSize={3} />
          <bufferAttribute attach="attributes-opacity"  count={TRAIL_LENGTH} array={opa1.current} itemSize={1} />
          <bufferAttribute attach="attributes-scale"    count={TRAIL_LENGTH} array={scl1.current} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{ uColor: { value: color } }}
        />
      </points>

      <points ref={trail2Ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={TRAIL_LENGTH} array={pos2.current} itemSize={3} />
          <bufferAttribute attach="attributes-opacity"  count={TRAIL_LENGTH} array={opa2.current} itemSize={1} />
          <bufferAttribute attach="attributes-scale"    count={TRAIL_LENGTH} array={scl2.current} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{ uColor: { value: color } }}
        />
      </points>
    </>
  );
};

export default EntropicBoltTrail;
