import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Group, Points, Vector3, AdditiveBlending } from '@/utils/three-exports';

interface ScytheHandleTrailProps {
  anchorRef: React.RefObject<Group>;
  parentRef: React.RefObject<Group>;
  color?: Color;
}

const TRAIL_LENGTH = 16;
const MIN_MOVEMENT = 0.008;
const _worldPos = new Vector3();
const _localPos = new Vector3();
const _lastLocalPos = new Vector3();

export default function ScytheHandleTrail({
  anchorRef,
  parentRef,
  color = new Color('#9D4EDD'),
}: ScytheHandleTrailProps) {
  const trailRef = useRef<Points>(null);
  const posRing = useRef<Vector3[]>(Array.from({ length: TRAIL_LENGTH }, () => new Vector3()));
  const ringHead = useRef(0);
  const ringFill = useRef(0);
  const isInitialized = useRef(false);

  const pos = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH * 3));
  const opa = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const scl = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));
  const age = useRef<Float32Array>(new Float32Array(TRAIL_LENGTH));

  const uColorValue = useRef(color.clone());
  const uAccentValue = useRef(color.clone().lerp(new Color('#E0AAFF'), 0.35));

  const uniforms = useMemo(
    () => ({
      uColor: { value: uColorValue.current },
      uAccent: { value: uAccentValue.current },
    }),
    [],
  );

  useEffect(() => {
    uColorValue.current.copy(color);
    uAccentValue.current.copy(color).lerp(new Color('#E0AAFF'), 0.35);
  }, [color]);

  useEffect(() => {
    if (!anchorRef.current || !parentRef.current || isInitialized.current) return;

    anchorRef.current.getWorldPosition(_worldPos);
    parentRef.current.worldToLocal(_localPos.copy(_worldPos));
    _lastLocalPos.copy(_localPos);

    for (let i = 0; i < TRAIL_LENGTH; i++) {
      posRing.current[i].copy(_localPos);
      pos.current[i * 3] = _localPos.x;
      pos.current[i * 3 + 1] = _localPos.y;
      pos.current[i * 3 + 2] = _localPos.z;
      opa.current[i] = 0;
      scl.current[i] = 0;
      age.current[i] = 0;
    }

    ringHead.current = 0;
    ringFill.current = TRAIL_LENGTH;
    isInitialized.current = true;
  }, [anchorRef, parentRef]);

  useFrame((state) => {
    if (!anchorRef.current || !parentRef.current || !isInitialized.current) return;
    if (!trailRef.current?.parent) return;

    anchorRef.current.getWorldPosition(_worldPos);
    parentRef.current.worldToLocal(_localPos.copy(_worldPos));

    if (_localPos.distanceTo(_lastLocalPos) > MIN_MOVEMENT) {
      _lastLocalPos.copy(_localPos);
      ringHead.current = (ringHead.current + TRAIL_LENGTH - 1) % TRAIL_LENGTH;
      posRing.current[ringHead.current].copy(_localPos);
      if (ringFill.current < TRAIL_LENGTH) ringFill.current++;
    }

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
      const fade = Math.pow(1 - trailAge, 1.6);

      pos.current[i * 3] = center.x;
      pos.current[i * 3 + 1] = center.y;
      pos.current[i * 3 + 2] = center.z;

      const coreSize = 0.045 * (1.2 - trailAge * 0.75);
      opa.current[i] = fade * 0.85;
      scl.current[i] = coreSize;
      age.current[i] = trailAge + time * 0.5;
    }

    const geometry = trailRef.current.geometry;
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.opacity.needsUpdate = true;
    geometry.attributes.scale.needsUpdate = true;
    geometry.attributes.age.needsUpdate = true;
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
      gl_PointSize = scale * 22.0 * (300.0 / -mvPosition.z);
    }
  `;

  const fragmentShader = `
    varying float vOpacity;
    varying float vAge;
    uniform vec3 uColor;
    uniform vec3 uAccent;
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float core = smoothstep(0.38, 0.08, d);
      float halo = smoothstep(0.55, 0.12, d);
      float sparkle = 0.88 + 0.12 * sin(vAge * 36.0 + gl_PointCoord.x * 14.0);
      vec3 mixedCol = mix(uAccent, uColor, clamp(vAge * 0.9, 0.0, 1.0));
      float strength = core * 0.8 + halo * 0.45;
      gl_FragColor = vec4(mixedCol * 2.2 * sparkle, vOpacity * strength);
    }
  `;

  return (
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
        fragmentShader={fragmentShader}
        uniforms={uniforms}
      />
    </points>
  );
}
