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
  /** Cap simulated trail points (buffers stay TRAIL_LENGTH). Default: full trail. */
  pointCount?: number;
  /** Bump to rewind the ring buffer (replay without remount). */
  resetSeq?: number;
}

const TRAIL_LENGTH = 45;
const MIN_MOVEMENT = 0.03;
const _dustOffset = new Vector3();
const _flightFallback = new Vector3(0, 1, 0);
// Shared scratch for getWorldPosition — safe because R3F runs useFrame serially.
const _wpEB = new Vector3();

const ENTROPIC_TRAIL_VERTEX_SHADER = `
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

const ENTROPIC_CORE_FRAGMENT_SHADER = `
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

const ENTROPIC_DUST_FRAGMENT_SHADER = `
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
  pointCount = TRAIL_LENGTH,
  resetSeq = 0,
}) => {
  const trailRef = useRef<Points>(null);
  const dustRef = useRef<Points>(null);

  const accent = useMemo(
    () => (accentColor ? accentColor.clone() : color.clone().lerp(new Color('#ffffff'), 0.35)),
    [accentColor, color],
  );

  // Ring buffer: avoids per-frame clone() and O(N) Array.unshift.
  const posRing = useRef<Vector3[]>(Array.from({ length: TRAIL_LENGTH }, () => new Vector3()));
  const ringHead = useRef(0);    // index of the newest slot
  const ringFill = useRef(0);    // how many slots are valid
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

  const liveCount = Math.max(1, Math.min(TRAIL_LENGTH, pointCount));

  const uniforms = useMemo(
    () => ({
      uColor: { value: color.clone() },
      uAccent: { value: accent.clone() },
    }),
    [color, accent],
  );

  useEffect(() => {
    uniforms.uColor.value.copy(color);
    uniforms.uAccent.value.copy(accent);
  }, [color, accent, uniforms]);

  useEffect(() => {
    return () => {
      for (const ref of [trailRef, dustRef]) {
        const points = ref.current;
        if (!points) continue;
        points.geometry?.dispose();
        const mat = points.material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => m.dispose());
        } else {
          mat?.dispose();
        }
      }
    };
  }, []);

  useEffect(() => {
    if (resetSeq === 0) return;
    isInitialized.current = false;
    ringFill.current = 0;
    ringHead.current = 0;
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      opa.current[i] = 0;
      dustOpa.current[i] = 0;
    }
  }, [resetSeq]);

  useFrame((state) => {
    if (!meshRef.current || !trailRef.current?.parent || !dustRef.current?.parent) return;
    if (opacity <= 0) return;

    if (!isInitialized.current) {
      meshRef.current.getWorldPosition(_wpEB);
      lastKnownPosition.current.copy(_wpEB);
      for (let i = 0; i < TRAIL_LENGTH; i++) {
        posRing.current[i].copy(_wpEB);
        pos.current[i * 3] = _wpEB.x;
        pos.current[i * 3 + 1] = _wpEB.y;
        pos.current[i * 3 + 2] = _wpEB.z;
        dustPos.current[i * 3] = _wpEB.x;
        dustPos.current[i * 3 + 1] = _wpEB.y;
        dustPos.current[i * 3 + 2] = _wpEB.z;
        opa.current[i] = 0;
        dustOpa.current[i] = 0;
        scl.current[i] = 0;
        dustScl.current[i] = 0;
        age.current[i] = 0;
        dustAge.current[i] = 0;
      }
      ringHead.current = 0;
      ringFill.current = liveCount;
      isInitialized.current = true;
    }

    let fadeOutFactor = 1;
    if (trailFadeOutStartElapsed != null && trailFadeOutDuration > 1e-6) {
      const u = (state.clock.elapsedTime - trailFadeOutStartElapsed) / trailFadeOutDuration;
      const clamped = Math.min(1, Math.max(0, u));
      fadeOutFactor = 1 - clamped * clamped * (3 - 2 * clamped);
    }

    meshRef.current.getWorldPosition(_wpEB);

    if (_wpEB.distanceTo(lastKnownPosition.current) > MIN_MOVEMENT) {
      lastKnownPosition.current.copy(_wpEB);
      // Ring-buffer write: decrement head and copy into the vacated slot.
      ringHead.current = (ringHead.current + TRAIL_LENGTH - 1) % TRAIL_LENGTH;
      posRing.current[ringHead.current].copy(_wpEB);
      if (ringFill.current < liveCount) ringFill.current++;
    }

    const count = ringFill.current;
    const ring = posRing.current;
    const head = ringHead.current;
    const time = state.clock.elapsedTime;
    const flightDir = flightDirectionRef?.current ?? _flightFallback;

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      if (i >= count || i >= liveCount) {
        opa.current[i] = 0;
        dustOpa.current[i] = 0;
        scl.current[i] = 0;
        dustScl.current[i] = 0;
        age.current[i] = 0;
        dustAge.current[i] = 0;
        continue;
      }

      const center = ring[(head + i) % TRAIL_LENGTH];
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
          vertexShader={ENTROPIC_TRAIL_VERTEX_SHADER}
          fragmentShader={ENTROPIC_DUST_FRAGMENT_SHADER}
          uniforms={uniforms}
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
          vertexShader={ENTROPIC_TRAIL_VERTEX_SHADER}
          fragmentShader={ENTROPIC_CORE_FRAGMENT_SHADER}
          uniforms={uniforms}
        />
      </points>
    </>
  );
};

export default EntropicBoltTrail;
