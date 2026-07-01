import React, { useRef, useEffect, useMemo, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Mesh, Group, Points, Vector3 } from '@/utils/three-exports';
import { ENTROPIC_TRAIL_FADE_OUT_DURATION } from './EntropicBoltTrail';

interface EntropicBoltMistTrailProps {
  color: Color;
  accentColor: Color;
  size: number;
  meshRef: React.RefObject<Mesh | Group>;
  opacity?: number;
  flightDirectionRef?: MutableRefObject<Vector3> | null;
  trailFadeOutStartElapsed?: number | null;
  trailFadeOutDuration?: number;
}

const TRAIL_LENGTH = 45;
const MIN_MOVEMENT = 0.03;
const AXIS_Y = new Vector3(0, 1, 0);
const AXIS_Z = new Vector3(0, 0, 1);
const _perpA = new Vector3();
const _perpB = new Vector3();
const _flight = new Vector3();
const _offset = new Vector3();
// Shared scratch for getWorldPosition — safe because R3F runs useFrame serially.
const _wpMist = new Vector3();

const VERTEX_SHADER = `
  attribute float opacity;
  attribute float scale;
  attribute float age;
  attribute float seed;
  varying float vOpacity;
  varying float vAge;
  varying float vSeed;
  void main() {
    vOpacity = opacity;
    vAge = age;
    vSeed = seed;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = scale * 22.0 * (300.0 / -mvPosition.z);
  }
`;

const FRAGMENT_SHADER = `
  varying float vOpacity;
  varying float vAge;
  varying float vSeed;
  uniform vec3 uColor;
  uniform vec3 uAccent;
  uniform float uTime;

  vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289v4(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289v3(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    float f = 1.0;
    for (int i = 0; i < 4; i++) {
      v += a * snoise(p * f);
      a *= 0.5;
      f *= 2.0;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float dist = length(uv);

    vec3 coord = vec3(gl_PointCoord * 2.8 + vSeed * 0.17, uTime * 0.35 + vAge * 3.5);
    float noise = fbm(coord);
    noise = (noise + 1.0) * 0.5;
    float detail = fbm(coord * 2.1 + vec3(vSeed * 2.3, vAge * 1.8, uTime * 0.22));
    detail = (detail + 1.0) * 0.5;
    float cloud = noise * 0.62 + detail * 0.38;

    float radial = 1.0 - smoothstep(0.08, 0.48, dist);
    radial = pow(radial, 1.35);

    float alpha = radial * cloud * vOpacity;
    alpha = clamp(alpha, 0.0, 0.35);

    vec3 mistCol = mix(uColor, uAccent, clamp(vAge * 0.75 + cloud * 0.25, 0.0, 1.0));
    gl_FragColor = vec4(mistCol, alpha);
  }
`;

function computePerpendicularAxes(flightDir: Vector3, outA: Vector3, outB: Vector3) {
  _flight.copy(flightDir);
  if (_flight.lengthSq() < 1e-8) {
    _flight.set(0, 1, 0);
  } else {
    _flight.normalize();
  }
  const ref = Math.abs(_flight.dot(AXIS_Y)) > 0.92 ? AXIS_Z : AXIS_Y;
  outA.crossVectors(_flight, ref).normalize();
  outB.crossVectors(_flight, outA).normalize();
}

const EntropicBoltMistTrail: React.FC<EntropicBoltMistTrailProps> = ({
  color,
  accentColor,
  size,
  meshRef,
  opacity = 1,
  flightDirectionRef = null,
  trailFadeOutStartElapsed = null,
  trailFadeOutDuration = ENTROPIC_TRAIL_FADE_OUT_DURATION,
}) => {
  const mistRef = useRef<Points>(null);
  // Ring buffer: avoids per-frame clone() and O(N) Array.unshift.
  const posRing = useRef<Vector3[]>(Array.from({ length: TRAIL_LENGTH }, () => new Vector3()));
  const ringHead = useRef(0);
  const ringFill = useRef(0);
  const lastKnownPosition = useRef(new Vector3());
  const isInitialized = useRef(false);
  const seeds = useRef<Float32Array>(
    Float32Array.from({ length: TRAIL_LENGTH }, (_, i) => (i * 0.618 + 0.13) % 1),
  );

  const pos = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3));
  const opa = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const scl = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const age = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));

  const uniforms = useMemo(
    () => ({
      uColor: { value: color.clone() },
      uAccent: { value: accentColor.clone() },
      uTime: { value: 0 },
    }),
    [color, accentColor],
  );

  useEffect(() => {
    uniforms.uColor.value.copy(color);
    uniforms.uAccent.value.copy(accentColor);
  }, [color, accentColor, uniforms]);

  useEffect(() => {
    if (meshRef.current && !isInitialized.current) {
      meshRef.current.getWorldPosition(_wpMist);
      lastKnownPosition.current.copy(_wpMist);

      for (let i = 0; i < TRAIL_LENGTH; i++) {
        posRing.current[i].copy(_wpMist);
        pos.current[i * 3] = _wpMist.x;
        pos.current[i * 3 + 1] = _wpMist.y;
        pos.current[i * 3 + 2] = _wpMist.z;
        opa.current[i] = 0;
        scl.current[i] = 0;
        age.current[i] = 0;
      }
      ringHead.current = 0;
      ringFill.current = TRAIL_LENGTH;
      isInitialized.current = true;
    }
  }, [meshRef]);

  useFrame((state) => {
    if (!meshRef.current || !isInitialized.current) return;
    if (!mistRef.current?.parent) return;

    uniforms.uTime.value = state.clock.elapsedTime;

    let fadeOutFactor = 1;
    if (trailFadeOutStartElapsed != null && trailFadeOutDuration > 1e-6) {
      const u = (state.clock.elapsedTime - trailFadeOutStartElapsed) / trailFadeOutDuration;
      const clamped = Math.min(1, Math.max(0, u));
      fadeOutFactor = 1 - clamped * clamped * (3 - 2 * clamped);
    }

    meshRef.current.getWorldPosition(_wpMist);

    if (_wpMist.distanceTo(lastKnownPosition.current) > MIN_MOVEMENT) {
      lastKnownPosition.current.copy(_wpMist);
      // Ring-buffer write.
      ringHead.current = (ringHead.current + TRAIL_LENGTH - 1) % TRAIL_LENGTH;
      posRing.current[ringHead.current].copy(_wpMist);
      if (ringFill.current < TRAIL_LENGTH) ringFill.current++;
    }

    const flightDir = flightDirectionRef?.current ?? _flight.set(0, 1, 0);
    computePerpendicularAxes(flightDir, _perpA, _perpB);

    const count = ringFill.current;
    const ring = posRing.current;
    const head = ringHead.current;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      if (i >= count) {
        opa.current[i] = 0;
        scl.current[i] = 0;
        age.current[i] = 0;
        continue;
      }

      const center = ring[(head + i) % TRAIL_LENGTH];
      const trailAge = i / TRAIL_LENGTH;
      const fade = Math.pow(1 - trailAge, 0.85) * opacity * fadeOutFactor;
      const seed = seeds.current[i];

      const scatter = size * 0.55 * trailAge;
      const wobbleA = Math.sin(time * 1.8 + seed * 12.5 + trailAge * 5.2) * scatter;
      const wobbleB = Math.cos(time * 1.4 + seed * 9.7 + trailAge * 4.1) * scatter * 0.75;

      _offset.copy(_perpA).multiplyScalar(wobbleA).addScaledVector(_perpB, wobbleB);

      pos.current[i * 3] = center.x + _offset.x;
      pos.current[i * 3 + 1] = center.y + _offset.y;
      pos.current[i * 3 + 2] = center.z + _offset.z;

      const mistSize = size * (3.6 - trailAge * 2.2);
      opa.current[i] = fade * 0.32;
      scl.current[i] = mistSize;
      age.current[i] = trailAge;
    }

    const geometry = mistRef.current.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.opacity.needsUpdate = true;
    geometry.attributes.scale.needsUpdate = true;
    geometry.attributes.age.needsUpdate = true;
  });

  return (
    <points ref={mistRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={TRAIL_LENGTH} array={pos.current} itemSize={3} />
        <bufferAttribute attach="attributes-opacity" count={TRAIL_LENGTH} array={opa.current} itemSize={1} />
        <bufferAttribute attach="attributes-scale" count={TRAIL_LENGTH} array={scl.current} itemSize={1} />
        <bufferAttribute attach="attributes-age" count={TRAIL_LENGTH} array={age.current} itemSize={1} />
        <bufferAttribute attach="attributes-seed" count={TRAIL_LENGTH} array={seeds.current} itemSize={1} />
      </bufferGeometry>
      <shaderMaterial
        transparent
        depthWrite={false}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        uniforms={uniforms}
      />
    </points>
  );
};

export default EntropicBoltMistTrail;
