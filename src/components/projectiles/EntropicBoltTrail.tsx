import React, { useRef, useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';
import { computeEntropicDustScatter } from '@/utils/entropicBoltChaos';

/** Shared with managers / bolt — trail opacity decays 1→0 over this window when despawn fade starts. */
export const ENTROPIC_TRAIL_FADE_OUT_DURATION = 0.25;

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

const TRAIL_LENGTH = 45;
const MIN_MOVEMENT = 0.03;
const _dustOffset = new Vector3();
const _flightFallback = new Vector3(0, 1, 0);

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
  const trailRef = useRef<Points>(null);
  const dustRef = useRef<Points>(null);

  const accent = useMemo(
    () => (accentColor ? accentColor.clone() : color.clone().lerp(new Color('#ffffff'), 0.35)),
    [accentColor, color],
  );

  const pathHistory = useRef<Vector3[]>([]);
  const lastKnownPosition = useRef(new Vector3());
  const isInitialized = useRef(false);

  const pos = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3));
  const opa = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const scl = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const age = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));

  const dustPos = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3));
  const dustOpa = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const dustScl = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const dustAge = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));

  const dustSeeds = useRef<Float32Array>(
    Float32Array.from({ length: TRAIL_LENGTH }, (_, i) => (i * 0.618 + 0.13) % 1),
  );

  useEffect(() => {
    if (meshRef.current && !isInitialized.current) {
      const wp = new Vector3();
      meshRef.current.getWorldPosition(wp);
      lastKnownPosition.current.copy(wp);

      for (let i = 0; i < TRAIL_LENGTH; i++) {
        pathHistory.current.push(wp.clone());
        pos.current[i * 3] = wp.x;
        pos.current[i * 3 + 1] = wp.y;
        pos.current[i * 3 + 2] = wp.z;
        dustPos.current[i * 3] = wp.x;
        dustPos.current[i * 3 + 1] = wp.y;
        dustPos.current[i * 3 + 2] = wp.z;
        opa.current[i] = 0;
        dustOpa.current[i] = 0;
        scl.current[i] = 0;
        dustScl.current[i] = 0;
        age.current[i] = 0;
        dustAge.current[i] = 0;
      }
      isInitialized.current = true;
    }
  }, [meshRef]);

  useFrame((state) => {
    if (!meshRef.current || !isInitialized.current) return;
    if (!trailRef.current?.parent || !dustRef.current?.parent) return;

    let fadeOutFactor = 1;
    if (trailFadeOutStartElapsed != null && trailFadeOutDuration > 1e-6) {
      const u = (state.clock.elapsedTime - trailFadeOutStartElapsed) / trailFadeOutDuration;
      const clamped = Math.min(1, Math.max(0, u));
      fadeOutFactor = 1 - clamped * clamped * (3 - 2 * clamped);
    }

    const wp = new Vector3();
    meshRef.current.getWorldPosition(wp);

    if (wp.distanceTo(lastKnownPosition.current) > MIN_MOVEMENT) {
      lastKnownPosition.current.copy(wp);
      pathHistory.current.unshift(wp.clone());
      if (pathHistory.current.length > TRAIL_LENGTH) pathHistory.current.pop();
    }

    const count = Math.min(pathHistory.current.length, TRAIL_LENGTH);
    const hist = pathHistory.current;
    const time = state.clock.elapsedTime;
    const flightDir = flightDirectionRef?.current ?? _flightFallback;

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      if (i >= count) {
        opa.current[i] = 0;
        dustOpa.current[i] = 0;
        scl.current[i] = 0;
        dustScl.current[i] = 0;
        age.current[i] = 0;
        dustAge.current[i] = 0;
        continue;
      }

      const center = hist[i];
      const trailAge = i / TRAIL_LENGTH;
      const fadePow = isCryoflame ? 2.0 : 1.4;
      const fade = Math.pow(1 - trailAge, fadePow) * opacity * fadeOutFactor;

      pos.current[i * 3] = center.x;
      pos.current[i * 3 + 1] = center.y;
      pos.current[i * 3 + 2] = center.z;

      computeEntropicDustScatter(
        flightDir,
        time,
        dustSeeds.current[i],
        trailAge,
        size * 0.32,
        _dustOffset,
      );
      dustPos.current[i * 3] = center.x + _dustOffset.x;
      dustPos.current[i * 3 + 1] = center.y + _dustOffset.y;
      dustPos.current[i * 3 + 2] = center.z + _dustOffset.z;

      const coreSize = size * (1.4 - trailAge * 0.9);
      const dustSize = size * (2.2 - trailAge * 1.4);

      opa.current[i] = fade * 0.98;
      scl.current[i] = coreSize;
      age.current[i] = trailAge;

      dustOpa.current[i] = fade * 0.42;
      dustScl.current[i] = dustSize;
      dustAge.current[i] = trailAge;
    }

    for (const ref of [trailRef, dustRef]) {
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

  const coreFragmentShader = `
    varying float vOpacity;
    varying float vAge;
    uniform vec3 uColor;
    uniform vec3 uAccent;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float core = smoothstep(0.38, 0.08, d);
      float halo = smoothstep(0.55, 0.12, d);
      float sparkle = 0.85 + 0.15 * sin(vAge * 40.0 + gl_PointCoord.x * 12.0);
      vec3 mixedCol = mix(uAccent, uColor, clamp(vAge * 1.1, 0.0, 1.0));
      float strength = core * 0.75 + halo * 0.55;
      gl_FragColor = vec4(mixedCol * 2.6 * sparkle, vOpacity * strength);
    }
  `;

  const dustFragmentShader = `
    varying float vOpacity;
    varying float vAge;
    uniform vec3 uColor;
    uniform vec3 uAccent;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float dust = smoothstep(0.62, 0.05, d);
      float sparkle = 0.7 + 0.3 * sin(vAge * 28.0 + gl_PointCoord.y * 16.0);
      vec3 mixedCol = mix(uColor, uAccent, clamp(vAge * 0.85, 0.0, 1.0));
      gl_FragColor = vec4(mixedCol * 1.35 * sparkle, vOpacity * dust * 0.65);
    }
  `;

  return (
    <>
      <points ref={dustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={TRAIL_LENGTH} array={dustPos.current} itemSize={3} />
          <bufferAttribute attach="attributes-opacity" count={TRAIL_LENGTH} array={dustOpa.current} itemSize={1} />
          <bufferAttribute attach="attributes-scale" count={TRAIL_LENGTH} array={dustScl.current} itemSize={1} />
          <bufferAttribute attach="attributes-age" count={TRAIL_LENGTH} array={dustAge.current} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={vertexShader}
          fragmentShader={dustFragmentShader}
          uniforms={{ uColor: { value: color }, uAccent: { value: accent } }}
        />
      </points>

      <points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={TRAIL_LENGTH} array={pos.current} itemSize={3} />
          <bufferAttribute attach="attributes-opacity" count={TRAIL_LENGTH} array={opa.current} itemSize={1} />
          <bufferAttribute attach="attributes-scale" count={TRAIL_LENGTH} array={scl.current} itemSize={1} />
          <bufferAttribute attach="attributes-age" count={TRAIL_LENGTH} array={age.current} itemSize={1} />
        </bufferGeometry>
        <shaderMaterial
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          vertexShader={vertexShader}
          fragmentShader={coreFragmentShader}
          uniforms={{ uColor: { value: color }, uAccent: { value: accent } }}
        />
      </points>
    </>
  );
};

export default EntropicBoltTrail;
