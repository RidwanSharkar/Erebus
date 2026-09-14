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
  ShaderMaterial,
  Vector3,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { SharedMesh } from '@/utils/SharedMesh';
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
/** Cap frame delta so hitch frames cannot leap over the impact sphere. */
const MAX_MOVE_DELTA = 1 / 20;
/**
 * Warning + max sky travel (~70u @ 26.5 u/s ≈ 2.6s) + impact linger + buffer.
 * Ensures onComplete always fires even if impact detection misses.
 */
const MAX_LIFETIME_MS = CLOUDKILL_WARNING_MS + 4000;
const IMPACT_COMPLETE_MS = 1000;
const CLOUDKILL_AOE_RADIUS_SQ = CLOUDKILL_AOE_RADIUS * CLOUDKILL_AOE_RADIUS;

const arrowGeometry = new ConeGeometry(0.1, 0.8, 8);
arrowGeometry.userData.shared = true;
const arrowMaterial = new MeshBasicMaterial({ color: '#00ff00' });
arrowMaterial.userData.shared = true;
const warningRingGeometry = new RingGeometry(
  CLOUDKILL_AOE_RADIUS - 0.2,
  CLOUDKILL_AOE_RADIUS,
  WARNING_RING_SEGMENTS,
);
warningRingGeometry.userData.shared = true;
const pulsingRingGeometry = new RingGeometry(
  CLOUDKILL_AOE_RADIUS - 0.4,
  CLOUDKILL_AOE_RADIUS - 0.2,
  WARNING_RING_SEGMENTS,
);
pulsingRingGeometry.userData.shared = true;
const warningRingMaterial = new MeshBasicMaterial({
  color: '#00aa00',
  transparent: true,
  opacity: 0.5,
  side: DoubleSide,
});
warningRingMaterial.userData.shared = true;
const pulsingRingMaterial = new MeshBasicMaterial({
  color: '#00ff00',
  transparent: true,
  opacity: 0.5,
  side: DoubleSide,
});
pulsingRingMaterial.userData.shared = true;
const trailColor = new Color('#00ff00');

const CLOUDKILL_TRAIL_VERTEX_SHADER = `
  attribute float opacity;
  attribute float scale;
  varying float vOpacity;
  void main() {
    vOpacity = opacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    gl_PointSize = scale * 45.0 * (300.0 / -mvPosition.z);
  }
`;

const CLOUDKILL_TRAIL_FRAGMENT_SHADER = `
  varying float vOpacity;
  uniform vec3 uColor;
  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    float strength = smoothstep(0.5, 0.1, d);
    vec3 glowColor = mix(uColor, vec3(0.53, 1.0, 0.53), 0.35);
    gl_FragColor = vec4(glowColor, vOpacity * strength);
  }
`;

const scratchDir = new Vector3();
const scratchIdeal = new Vector3();
const scratchFinal = new Vector3();
const scratchLightPos = new Vector3();
const scratchPrevPos = new Vector3();
const scratchSeg = new Vector3();
const scratchClosest = new Vector3();

function buildDefaultStart(target: Vector3): Vector3 {
  const height =
    CLOUDKILL_SKY_HEIGHT_MIN +
    Math.random() * (CLOUDKILL_SKY_HEIGHT_MAX - CLOUDKILL_SKY_HEIGHT_MIN);
  return new Vector3(target.x, height, target.z);
}

/** True if segment from `from` to `to` intersects a sphere at `center` with radiusSq. */
function segmentIntersectsSphere(
  from: Vector3,
  to: Vector3,
  center: Vector3,
  radiusSq: number,
): boolean {
  scratchSeg.subVectors(to, from);
  const segLenSq = scratchSeg.lengthSq();
  if (segLenSq < 1e-10) {
    return from.distanceToSquared(center) <= radiusSq;
  }
  const t = Math.max(
    0,
    Math.min(1, scratchSeg.dot(scratchClosest.subVectors(center, from)) / segLenSq),
  );
  scratchClosest.copy(from).addScaledVector(scratchSeg, t);
  return scratchClosest.distanceToSquared(center) <= radiusSq;
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
  const completedRef = useRef(false);

  const arrowLight = useDynamicLight({ color: '#00ff00', distance: 6, priority: 2 });

  const trailUniforms = useMemo(() => ({ uColor: { value: trailColor.clone() } }), []);

  // Aim at event ground Y for VFX. Sentinel -3 (no dungeon collider) → floor 0.
  const groundTarget = useMemo(() => {
    const rawY = Number.isFinite(targetPosition.y) ? targetPosition.y : 0;
    const y = rawY <= -2.5 ? 0 : rawY;
    return new Vector3(targetPosition.x, y, targetPosition.z);
  }, [targetPosition.x, targetPosition.y, targetPosition.z]);

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

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  };

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

  // Max-lifetime fallback so rings cannot stay mounted if impact never fires.
  useEffect(() => {
    const armDelay = Math.max(0, warningStartTime - Date.now());
    const t = window.setTimeout(() => {
      finish();
    }, armDelay + MAX_LIFETIME_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish via refs
  }, [warningStartTime]);

  useEffect(() => {
    if (!state.impactOccurred || !state.impactStartTime) return;
    const t = window.setTimeout(() => {
      finish();
    }, IMPACT_COMPLETE_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish via refs
  }, [state.impactOccurred, state.impactStartTime]);

  // Dispose per-instance trail geometry/material on unmount (module geos use SharedMesh).
  useEffect(() => {
    return () => {
      const points = trailPointsRef.current;
      if (!points) return;
      points.geometry?.dispose();
      const mat = points.material as ShaderMaterial | ShaderMaterial[] | undefined;
      if (Array.isArray(mat)) {
        mat.forEach((m) => m.dispose());
      } else {
        mat?.dispose();
      }
    };
  }, []);

  const triggerImpact = () => {
    if (impactOccurredRef.current) return;
    impactOccurredRef.current = true;
    arrowLight.current?.setIntensity(0);
    setState((prev) => ({
      ...prev,
      impactOccurred: true,
      impactStartTime: Date.now(),
    }));
  };

  useFrame((_, delta) => {
    timeElapsed.current += delta;

    if (armedRef.current && !impactOccurredRef.current && pulsingRingRef.current) {
      const pulse = 1 + Math.sin(Date.now() * 0.008) * 0.15;
      pulsingRingRef.current.scale.set(pulse, pulse, 1);
      const mat = pulsingRingRef.current.material as MeshBasicMaterial;
      if (mat && !Array.isArray(mat)) {
        mat.opacity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
      }
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

    if (
      distanceToTarget < CLOUDKILL_AOE_RADIUS ||
      currentPos.y <= groundTarget.y
    ) {
      triggerImpact();
      return;
    }

    const clampedDelta = Math.min(delta, MAX_MOVE_DELTA);
    const speed = CLOUDKILL_ARROW_SPEED * clampedDelta;
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

    scratchPrevPos.copy(currentPos);
    scratchDir.subVectors(groundTarget, currentPos).normalize();
    scratchIdeal.copy(currentPos).addScaledVector(scratchDir, speed);
    scratchFinal.copy(scratchIdeal).add(chaoticOffset.current);
    currentPos.copy(scratchFinal);

    // Swept-sphere: hitch/chaos cannot skip past the impact volume.
    if (
      currentPos.y <= groundTarget.y ||
      currentPos.distanceTo(groundTarget) < CLOUDKILL_AOE_RADIUS ||
      segmentIntersectsSphere(
        scratchPrevPos,
        currentPos,
        groundTarget,
        CLOUDKILL_AOE_RADIUS_SQ,
      )
    ) {
      currentPos.copy(groundTarget);
      triggerImpact();
      return;
    }

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
  const ringY = groundTarget.y + 0.1;

  return (
    <>
      {showWarning && (
        <group position={[groundTarget.x, ringY, groundTarget.z]}>
          <SharedMesh
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={warningRingGeometry}
            material={warningRingMaterial}
          />
          <SharedMesh
            ref={pulsingRingRef}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={pulsingRingGeometry}
            material={pulsingRingMaterial}
          />
        </group>
      )}

      {state.showArrow && !state.impactOccurred && (
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
            vertexShader={CLOUDKILL_TRAIL_VERTEX_SHADER}
            fragmentShader={CLOUDKILL_TRAIL_FRAGMENT_SHADER}
            uniforms={trailUniforms}
          />
        </points>
      )}

      {state.showArrow && !state.impactOccurred && (
        <group ref={arrowGroupRef} position={initialStart}>
          <SharedMesh
            rotation={[Math.PI, 0, 0]}
            geometry={arrowGeometry}
            material={arrowMaterial}
          />
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
