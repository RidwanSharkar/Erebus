import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';

interface EntropicBoltTrailProps {
  color: Color;
  size: number;
  meshRef: React.RefObject<Mesh | Group>;
  opacity?: number;
  isCryoflame?: boolean;
  accentColor?: Color;
}

const TRAIL_LENGTH = 15;
const ORBIT_RADIUS = 0.1;
const ORBIT_SPEED = 8.5;
const MIN_MOVEMENT = 0.06;
const UPDATE_INTERVAL = 0.020;

const EntropicBoltTrail: React.FC<EntropicBoltTrailProps> = ({
  color,
  accentColor,
  size,
  meshRef,
  opacity = 1,
  isCryoflame = false,
}) => {
  const trail1Ref = useRef<Points>(null);
  const trail2Ref = useRef<Points>(null);

  const accent = useMemo(
    () => (accentColor ? accentColor.clone() : color.clone().lerp(new Color('#ffffff'), 0.35)),
    [accentColor, color]
  );

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
  const age1 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));

  const pos2 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3));
  const opa2 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const scl2 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const age2 = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));

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
        age1.current[i] = 0;
        age2.current[i] = 0;
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
        age1.current[i] = 0;
        age2.current[i] = 0;
        continue;
      }

      const center = pathHistory.current[i];
      const trailAge = i / TRAIL_LENGTH;
      // Ribbon-like helix: phase tied to index + time for a looser twist
      const angle = trailAge * Math.PI * 4.2 + t * 0.85 + i * 0.31;
      const fade = Math.pow(1 - trailAge, isCryoflame ? 2.0 : 1.65) * opacity;
      const lateral = ORBIT_RADIUS * (0.85 + trailAge * 0.35);

      pos1.current[i * 3]     = center.x + Math.cos(angle) * lateral;
      pos1.current[i * 3 + 1] = center.y + Math.sin(angle * 1.08) * lateral;
      pos1.current[i * 3 + 2] = center.z + Math.sin(angle * 0.65) * lateral * 0.45;

      pos2.current[i * 3]     = center.x + Math.cos(angle + Math.PI * 0.92) * lateral;
      pos2.current[i * 3 + 1] = center.y + Math.sin(angle * 1.08 + Math.PI) * lateral;
      pos2.current[i * 3 + 2] = center.z - Math.sin(angle * 0.65) * lateral * 0.45;

      const particleSize = size * 0.68 * (1 - trailAge * 0.48);
      opa1.current[i] = fade * 0.96;
      scl1.current[i] = particleSize;
      opa2.current[i] = fade * 0.92;
      scl2.current[i] = particleSize * 0.92;
      age1.current[i] = trailAge;
      age2.current[i] = trailAge;
    }

    for (const ref of [trail1Ref, trail2Ref]) {
      if (ref.current) {
        ref.current.geometry.attributes.position.needsUpdate = true;
        ref.current.geometry.attributes.opacity.needsUpdate = true;
        ref.current.geometry.attributes.scale.needsUpdate = true;
        ref.current.geometry.attributes.age.needsUpdate = true;
      }
    }
  });

  const vertexShader = `
    attribute float opacity;
    attribute float scale;
    attribute float age;
    varying float vOpacity;
    varying float vAge;
    void main() {
      vOpacity = opacity;
      vAge = age;
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
      gl_PointSize = scale * 20.0 * (300.0 / -mvPosition.z);
    }
  `;

  const fragmentShader = `
    varying float vOpacity;
    varying float vAge;
    uniform vec3 uColor;
    uniform vec3 uAccent;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float core = smoothstep(0.42, 0.18, d);
      float rim = smoothstep(0.22, 0.02, d);
      vec3 mixedCol = mix(uAccent, uColor, clamp(vAge * 1.15, 0.0, 1.0));
      float strength = core * 0.55 + rim * 1.15;
      gl_FragColor = vec4(mixedCol * 2.45, vOpacity * strength);
    }
  `;

  return (
    <>
      <points ref={trail1Ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={TRAIL_LENGTH} array={pos1.current} itemSize={3} />
          <bufferAttribute attach="attributes-opacity"  count={TRAIL_LENGTH} array={opa1.current} itemSize={1} />
          <bufferAttribute attach="attributes-scale"    count={TRAIL_LENGTH} array={scl1.current} itemSize={1} />
          <bufferAttribute attach="attributes-age"      count={TRAIL_LENGTH} array={age1.current} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{ uColor: { value: color }, uAccent: { value: accent } }}
        />
      </points>

      <points ref={trail2Ref}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={TRAIL_LENGTH} array={pos2.current} itemSize={3} />
          <bufferAttribute attach="attributes-opacity"  count={TRAIL_LENGTH} array={opa2.current} itemSize={1} />
          <bufferAttribute attach="attributes-scale"    count={TRAIL_LENGTH} array={scl2.current} itemSize={1} />
          <bufferAttribute attach="attributes-age"      count={TRAIL_LENGTH} array={age2.current} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{ uColor: { value: accent }, uAccent: { value: color } }}
        />
      </points>
    </>
  );
};

export default EntropicBoltTrail;
