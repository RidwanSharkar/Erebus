import React, { useRef, useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';

/** Shared with managers / bolt — trail opacity decays 1→0 over this window when despawn fade starts. */
export const ENTROPIC_TRAIL_FADE_OUT_DURATION = 0.35;

interface EntropicBoltTrailProps {
  color: Color;
  size: number;
  meshRef: React.RefObject<Mesh | Group>;
  opacity?: number;
  isCryoflame?: boolean;
  accentColor?: Color;
  /** Normalized travel direction; used when path history is too short for a stable tangent. */
  flightDirectionRef?: MutableRefObject<Vector3> | null;
  /** When set, global opacity is multiplied by (1 − eased(elapsed / duration)) using R3F clock elapsed time. */
  trailFadeOutStartElapsed?: number | null;
  trailFadeOutDuration?: number;
}

const TRAIL_LENGTH = 50;
/** Helix spread at the bolt head → tapers to this at the trail tail. */
const ORBIT_RADIUS_MAX = 0.4;
const ORBIT_RADIUS_MIN = 0.1;
const ORBIT_SPEED = 15;
const MIN_MOVEMENT = 0.06;


const AXIS_Y = new Vector3(0, 1, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);
const _T = new Vector3();
const _N = new Vector3();
const _B = new Vector3();
const _P = new Vector3();

const DEFAULT_TANGENT = new Vector3(0, 1, 0);

function setPerpBasisFromTangent(tangent: Vector3, outN: Vector3, outB: Vector3) {
  if (Math.abs(tangent.dot(AXIS_Y)) > 0.985) {
    outB.crossVectors(tangent, FALLBACK_UP);
  } else {
    outB.crossVectors(AXIS_Y, tangent);
  }
  if (outB.lengthSq() < 1e-8) {
    outB.crossVectors(tangent, FALLBACK_UP);
  }
  outB.normalize();
  outN.crossVectors(outB, tangent);
  outN.normalize();
}

const EntropicBoltTrail: React.FC<EntropicBoltTrailProps> = ({
  color,
  accentColor,
  size,
  meshRef,
  opacity = 1,
  isCryoflame = false,
  flightDirectionRef = null,
  trailFadeOutStartElapsed = null,
  trailFadeOutDuration = ENTROPIC_TRAIL_FADE_OUT_DURATION,
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

  useFrame((state, delta) => {
    if (!meshRef.current || !isInitialized.current) return;
    if (!trail1Ref.current?.parent || !trail2Ref.current?.parent) return;

    timeRef.current += delta;
    updateTimer.current += delta;

    let fadeOutFactor = 1;
    if (trailFadeOutStartElapsed != null && trailFadeOutDuration > 1e-6) {
      const u = (state.clock.elapsedTime - trailFadeOutStartElapsed) / trailFadeOutDuration;
      const clamped = Math.min(1, Math.max(0, u));
      // Smooth ease-out so the tail doesn’t “snap” at the end
      fadeOutFactor = 1 - clamped * clamped * (3 - 2 * clamped);
    }

    const wp = new Vector3();
    meshRef.current.getWorldPosition(wp);

    if (wp.distanceTo(lastKnownPosition.current) > MIN_MOVEMENT) {
      lastKnownPosition.current.copy(wp);
      pathHistory.current.unshift(wp.clone());
      if (pathHistory.current.length > TRAIL_LENGTH) pathHistory.current.pop();
    }

    const t = timeRef.current * ORBIT_SPEED;
    const count = Math.min(pathHistory.current.length, TRAIL_LENGTH);
    const hist = pathHistory.current;
    const n = hist.length;

    const useFallbackT = (dest: Vector3) => {
      if (flightDirectionRef?.current) {
        dest.copy(flightDirectionRef.current);
        if (dest.lengthSq() < 1e-8) dest.copy(DEFAULT_TANGENT);
        else dest.normalize();
      } else {
        dest.copy(DEFAULT_TANGENT);
      }
    };

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

      const center = hist[i];
      const trailAge = i / TRAIL_LENGTH;
      // Helix: phase tied to arc index + time so strands precess around the beam
      const angle = trailAge * Math.PI * 4.2 + t * 0.85 + i * 0.31;
      const fade = Math.pow(1 - trailAge, isCryoflame ? 2.0 : 1.65) * opacity * fadeOutFactor;
      const orbitR = ORBIT_RADIUS_MAX + (ORBIT_RADIUS_MIN - ORBIT_RADIUS_MAX) * trailAge;

      if (n >= 2) {
        if (i === 0) {
          _T.subVectors(hist[0], hist[1]);
        } else if (i >= n - 1) {
          _T.subVectors(hist[i - 1], hist[i]);
        } else {
          _T.subVectors(hist[i - 1], hist[i + 1]);
        }
        if (_T.lengthSq() < 1e-8) {
          useFallbackT(_T);
        } else {
          _T.normalize();
        }
      } else {
        useFallbackT(_T);
      }

      setPerpBasisFromTangent(_T, _N, _B);

      const c = Math.cos(angle);
      const s = Math.sin(angle);
      // Strand 1: offset strictly in plane perpendicular to T (double-helix partner is opposite)
      _P.copy(_N).multiplyScalar(c * orbitR).addScaledVector(_B, s * orbitR);
      pos1.current[i * 3]     = center.x + _P.x;
      pos1.current[i * 3 + 1] = center.y + _P.y;
      pos1.current[i * 3 + 2] = center.z + _P.z;

      pos2.current[i * 3]     = center.x - _P.x;
      pos2.current[i * 3 + 1] = center.y - _P.y;
      pos2.current[i * 3 + 2] = center.z - _P.z;

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
