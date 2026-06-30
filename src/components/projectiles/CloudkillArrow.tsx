import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  Points,
  RingGeometry,
  Vector3,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  CLOUDKILL_AOE_RADIUS,
  CLOUDKILL_ARROW_SPEED,
  CLOUDKILL_SKY_HEIGHT_MAX,
  CLOUDKILL_SKY_HEIGHT_MIN,
  CLOUDKILL_WARNING_MS,
} from '@/utils/talents';

interface CloudkillArrowProps {
  targetPosition: Vector3;
  startPosition?: Vector3;
  delayMs?: number;
  timestamp?: number;
  onComplete: () => void;
}

const TRAIL_SEGMENTS = 12;
const WARNING_RING_SEGMENTS = 6;

const arrowGeometry = new ConeGeometry(0.1, 0.8, 8);
const arrowMaterial = new MeshBasicMaterial({ color: '#00ff00' });
const warningRingGeometry = new RingGeometry(
  CLOUDKILL_AOE_RADIUS - 0.2,
  CLOUDKILL_AOE_RADIUS,
  WARNING_RING_SEGMENTS,
);
const pulsingRingGeometry = new RingGeometry(
  CLOUDKILL_AOE_RADIUS - 0.4,
  CLOUDKILL_AOE_RADIUS - 0.2,
  WARNING_RING_SEGMENTS,
);
const warningRingMaterial = new MeshBasicMaterial({
  color: '#00aa00',
  transparent: true,
  opacity: 0.5,
  side: DoubleSide,
});
const pulsingRingMaterial = new MeshBasicMaterial({
  color: '#00ff00',
  transparent: true,
  opacity: 0.5,
  side: DoubleSide,
});
const trailColor = new Color('#00ff00');

const scratchDir = new Vector3();
const scratchIdeal = new Vector3();
const scratchFinal = new Vector3();
const scratchLightPos = new Vector3();

function buildDefaultStart(target: Vector3): Vector3 {
  const height =
    CLOUDKILL_SKY_HEIGHT_MIN +
    Math.random() * (CLOUDKILL_SKY_HEIGHT_MAX - CLOUDKILL_SKY_HEIGHT_MIN);
  return new Vector3(target.x, height, target.z);
}

function CloudkillArrowInner({
  targetPosition,
  startPosition,
  delayMs = 0,
  timestamp,
  onComplete,
}: CloudkillArrowProps) {
  const arrowGroupRef = useRef<Group>(null);
  const trailPointsRef = useRef<Points>(null);
  const pulsingRingRef = useRef<Mesh>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const arrowLight = useDynamicLight({ color: '#00ff00', distance: 6, priority: 2 });

  const groundTarget = useMemo(
    () => new Vector3(targetPosition.x, -3, targetPosition.z),
    [targetPosition.x, targetPosition.z],
  );

  const initialStart = useMemo(
    () => (startPosition ? startPosition.clone() : buildDefaultStart(groundTarget)),
    [startPosition, groundTarget],
  );

  const timeElapsed = useRef(0);
  const randomSeed = useRef(Math.random() * 1000);
  const chaoticOffset = useRef(new Vector3());
  const trailPositions = useRef(new Float32Array(TRAIL_SEGMENTS * 3));
  const trailOpacities = useRef(new Float32Array(TRAIL_SEGMENTS));
  const trailScales = useRef(new Float32Array(TRAIL_SEGMENTS));
  const trailCount = useRef(0);
  const trailInitialized = useRef(false);

  const showArrowRef = useRef(false);
  const impactOccurredRef = useRef(false);
  const armedRef = useRef(false);

  const warningStartTime = useMemo(
    () => (timestamp != null ? timestamp + delayMs : Date.now() + delayMs),
    [timestamp, delayMs],
  );

  const [state, setState] = useState({
    impactOccurred: false,
    showArrow: false,
    impactStartTime: null as number | null,
    armed: false,
  });

  showArrowRef.current = state.showArrow;
  impactOccurredRef.current = state.impactOccurred;
  armedRef.current = state.armed;

  useEffect(() => {
    const armDelay = Math.max(0, warningStartTime - Date.now());
    const armTimer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, armed: true }));
    }, armDelay);
    const showTimer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, showArrow: true }));
    }, armDelay + CLOUDKILL_WARNING_MS);
    return () => {
      window.clearTimeout(armTimer);
      window.clearTimeout(showTimer);
    };
  }, [warningStartTime]);

  useEffect(() => {
    if (!state.impactOccurred || !state.impactStartTime) return;
    const t = window.setTimeout(() => {
      onCompleteRef.current();
    }, 1000);
    return () => window.clearTimeout(t);
  }, [state.impactOccurred, state.impactStartTime]);

  useFrame((_, delta) => {
    timeElapsed.current += delta;

    if (armedRef.current && !impactOccurredRef.current && pulsingRingRef.current) {
      const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.15;
      pulsingRingRef.current.scale.set(pulse, pulse, 1);
      pulsingRingMaterial.opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
    }

    if (!arrowGroupRef.current || !showArrowRef.current || impactOccurredRef.current) {
      arrowLight.current?.setIntensity(0);
      return;
    }

    arrowGroupRef.current.getWorldPosition(scratchLightPos);
    arrowLight.current?.setPosition(scratchLightPos.x, scratchLightPos.y, scratchLightPos.z);
    arrowLight.current?.setIntensity(3);

    const currentPos = arrowGroupRef.current.position;
    const distanceToTarget = currentPos.distanceTo(groundTarget);

    if (distanceToTarget < CLOUDKILL_AOE_RADIUS) {
      arrowLight.current?.setIntensity(0);
      setState((prev) => ({
        ...prev,
        impactOccurred: true,
        impactStartTime: Date.now(),
      }));
      return;
    }

    const speed = CLOUDKILL_ARROW_SPEED * delta;
    const time = timeElapsed.current;
    const seed = randomSeed.current;

    const chaoticX =
      Math.sin(time * 4 + seed) * 0.08 * Math.sin(time * 2 + seed * 0.3) * 0.6;
    const chaoticY =
      Math.cos(time * 3 + seed * 1.2) * 0.06 * Math.sin(time * 2.5 + seed * 0.6) * 0.4;
    const chaoticZ =
      Math.sin(time * 3.5 + seed * 1.8) * 0.05 * Math.cos(time * 2.2 + seed * 0.9) * 0.5;

    const jitterIntensity = Math.max(0.02, distanceToTarget / 80) * 0.03;
    chaoticOffset.current.set(
      chaoticX + (Math.random() - 0.5) * jitterIntensity,
      chaoticY + (Math.random() - 0.5) * jitterIntensity,
      chaoticZ + (Math.random() - 0.5) * jitterIntensity,
    );

    scratchDir.subVectors(groundTarget, currentPos).normalize();
    scratchIdeal.copy(currentPos).addScaledVector(scratchDir, speed);
    scratchFinal.copy(scratchIdeal).add(chaoticOffset.current);
    currentPos.copy(scratchFinal);

    const positions = trailPositions.current;
    const opacities = trailOpacities.current;
    const scales = trailScales.current;

    if (!trailInitialized.current) {
      for (let i = 0; i < TRAIL_SEGMENTS; i++) {
        positions[i * 3] = scratchFinal.x;
        positions[i * 3 + 1] = scratchFinal.y;
        positions[i * 3 + 2] = scratchFinal.z;
        opacities[i] = 0;
        scales[i] = 0;
      }
      trailInitialized.current = true;
      trailCount.current = 1;
    } else if (trailCount.current < TRAIL_SEGMENTS) {
      trailCount.current += 1;
    }

    for (let i = 0; i < TRAIL_SEGMENTS - 1; i++) {
      positions[i * 3] = positions[(i + 1) * 3];
      positions[i * 3 + 1] = positions[(i + 1) * 3 + 1];
      positions[i * 3 + 2] = positions[(i + 1) * 3 + 2];
    }
    const tail = TRAIL_SEGMENTS - 1;
    positions[tail * 3] = scratchFinal.x;
    positions[tail * 3 + 1] = scratchFinal.y;
    positions[tail * 3 + 2] = scratchFinal.z;

    for (let i = 0; i < TRAIL_SEGMENTS; i++) {
      const normalizedIndex = i / Math.max(1, TRAIL_SEGMENTS - 1);
      opacities[i] = normalizedIndex * 0.8;
      scales[i] = 0.1 + normalizedIndex * 0.08;
    }

    const points = trailPointsRef.current;
    if (points?.geometry) {
      const geo = points.geometry;
      (geo.attributes.position as BufferAttribute).needsUpdate = true;
      if (geo.attributes.opacity) {
        (geo.attributes.opacity as BufferAttribute).needsUpdate = true;
      }
      if (geo.attributes.scale) {
        (geo.attributes.scale as BufferAttribute).needsUpdate = true;
      }
    }
  });

  const showWarning = state.armed && !state.impactOccurred;

  return (
    <>
      {showWarning && (
        <group position={[groundTarget.x, 0.1, groundTarget.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={warningRingGeometry} material={warningRingMaterial} />
          <mesh
            ref={pulsingRingRef}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={pulsingRingGeometry}
            material={pulsingRingMaterial}
          />
        </group>
      )}

      {state.showArrow && (
        <points ref={trailPointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={TRAIL_SEGMENTS}
              array={trailPositions.current}
              itemSize={3}
            />
            <bufferAttribute
              attach="attributes-opacity"
              count={TRAIL_SEGMENTS}
              array={trailOpacities.current}
              itemSize={1}
            />
            <bufferAttribute
              attach="attributes-scale"
              count={TRAIL_SEGMENTS}
              array={trailScales.current}
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
                gl_PointSize = scale * 45.0 * (300.0 / -mvPosition.z);
              }
            `}
            fragmentShader={`
              varying float vOpacity;
              uniform vec3 uColor;
              void main() {
                float d = length(gl_PointCoord - vec2(0.5));
                float strength = smoothstep(0.5, 0.1, d);
                vec3 glowColor = mix(uColor, vec3(0.53, 1.0, 0.53), 0.35);
                gl_FragColor = vec4(glowColor, vOpacity * strength);
              }
            `}
            uniforms={{
              uColor: { value: trailColor },
            }}
          />
        </points>
      )}

      {state.showArrow && !state.impactOccurred && (
        <group ref={arrowGroupRef} position={initialStart}>
          <mesh rotation={[Math.PI, 0, 0]} geometry={arrowGeometry} material={arrowMaterial} />
        </group>
      )}
    </>
  );
}

function cloudkillArrowPropsEqual(prev: CloudkillArrowProps, next: CloudkillArrowProps): boolean {
  if (prev.delayMs !== next.delayMs || prev.timestamp !== next.timestamp) return false;
  if (
    prev.targetPosition.x !== next.targetPosition.x ||
    prev.targetPosition.y !== next.targetPosition.y ||
    prev.targetPosition.z !== next.targetPosition.z
  ) {
    return false;
  }
  const prevStart = prev.startPosition;
  const nextStart = next.startPosition;
  if (!prevStart && !nextStart) return true;
  if (!prevStart || !nextStart) return false;
  return (
    prevStart.x === nextStart.x &&
    prevStart.y === nextStart.y &&
    prevStart.z === nextStart.z
  );
}

const CloudkillArrow = memo(CloudkillArrowInner, cloudkillArrowPropsEqual);
CloudkillArrow.displayName = 'CloudkillArrow';

export default CloudkillArrow;
