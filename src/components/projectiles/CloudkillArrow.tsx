import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  ConeGeometry,
  DoubleSide,
  Group,
  MeshBasicMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from '@/utils/three-exports';
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
const outerGlowGeometry = new RingGeometry(
  CLOUDKILL_AOE_RADIUS - 0.1,
  CLOUDKILL_AOE_RADIUS,
  WARNING_RING_SEGMENTS,
);
const sparkGeometry = new SphereGeometry(0.04, 6, 6);
const trailSphereGeometries = Array.from({ length: TRAIL_SEGMENTS }, (_, i) => {
  const normalizedIndex = i / Math.max(1, TRAIL_SEGMENTS - 1);
  const size = 0.1 + normalizedIndex * 0.08;
  return new SphereGeometry(size, 8, 8);
});
const trailCoreGeometries = Array.from({ length: 6 }, (_, i) => {
  const normalizedIndex = i / 5;
  const size = 0.02 + normalizedIndex * 0.04;
  return new SphereGeometry(size, 6, 6);
});

function buildDefaultStart(target: Vector3): Vector3 {
  const height =
    CLOUDKILL_SKY_HEIGHT_MIN +
    Math.random() * (CLOUDKILL_SKY_HEIGHT_MAX - CLOUDKILL_SKY_HEIGHT_MIN);
  return new Vector3(target.x, height, target.z);
}

function CloudkillTrail({
  positions,
  opacity = 1,
}: {
  positions: Vector3[];
  opacity?: number;
}) {
  if (positions.length < 2) return null;

  return (
    <group>
      {positions.map((position, index) => {
        const normalizedIndex = index / Math.max(1, positions.length - 1);
        const alpha = normalizedIndex * opacity * 0.8;
        const size = 0.1 + normalizedIndex * 0.08;
        if (alpha < 0.1) return null;
        const geoIndex = Math.min(
          trailSphereGeometries.length - 1,
          Math.floor(normalizedIndex * (trailSphereGeometries.length - 1)),
        );
        return (
          <mesh key={`trail-${index}`} position={[position.x, position.y, position.z]}>
            <primitive object={trailSphereGeometries[geoIndex] ?? new SphereGeometry(size, 8, 8)} />
            <meshBasicMaterial
              color="#00ff00"
              transparent
              opacity={alpha}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        );
      })}
      {positions.length > 2 &&
        positions.slice(-Math.min(6, positions.length)).map((position, index, array) => {
          const normalizedIndex = index / Math.max(1, array.length - 1);
          const alpha = normalizedIndex * opacity * 1.2;
          if (alpha < 0.05) return null;
          return (
            <mesh key={`core-${index}`} position={[position.x, position.y, position.z]}>
              <primitive object={trailCoreGeometries[index] ?? trailCoreGeometries[0]} />
              <meshBasicMaterial
                color="#88ff88"
                transparent
                opacity={alpha}
                blending={AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}
    </group>
  );
}

export default function CloudkillArrow({
  targetPosition,
  startPosition,
  delayMs = 0,
  timestamp,
  onComplete,
}: CloudkillArrowProps) {
  const arrowGroupRef = useRef<Group>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const materials = useMemo(
    () => ({
      arrow: new MeshBasicMaterial({ color: '#00ff00' }),
    }),
    [],
  );

  useEffect(() => {
    return () => {
      materials.arrow.dispose();
    };
  }, [materials]);

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
  const trailPositions = useRef<Vector3[]>([]);

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

    if (!arrowGroupRef.current || !state.showArrow || state.impactOccurred) {
      return;
    }

    const currentPos = arrowGroupRef.current.position;
    const distanceToTarget = currentPos.distanceTo(groundTarget);

    if (distanceToTarget < CLOUDKILL_AOE_RADIUS) {
      setState((prev) => ({
        ...prev,
        impactOccurred: true,
        impactStartTime: Date.now(),
      }));
      return;
    }

    const directionToTarget = groundTarget.clone().sub(currentPos).normalize();
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

    const idealPosition = currentPos.clone().addScaledVector(directionToTarget, speed);
    const finalPosition = idealPosition.add(chaoticOffset.current);
    currentPos.copy(finalPosition);

    if (trailPositions.current.length >= TRAIL_SEGMENTS) {
      trailPositions.current.shift();
    }
    trailPositions.current.push(finalPosition.clone());
  });

  const getPulsingScale = useCallback((): [number, number, number] => {
    const scale = 1 + Math.sin(Date.now() * 0.008) * 0.15;
    return [scale, scale, 1];
  }, []);

  const showWarning = state.armed && !state.impactOccurred;

  return (
    <>
      {showWarning && (
        <group position={[groundTarget.x, 0.1, groundTarget.z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={warningRingGeometry}>
            <meshBasicMaterial color="#00aa00" transparent opacity={0.5} side={DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} scale={getPulsingScale()} geometry={pulsingRingGeometry}>
            <meshBasicMaterial
              color="#00ff00"
              transparent
              opacity={0.5 + Math.sin(Date.now() * 0.005) * 0.3}
              side={DoubleSide}
            />
          </mesh>

        </group>
      )}

      {state.showArrow && trailPositions.current.length > 2 && (
        <CloudkillTrail positions={[...trailPositions.current]} opacity={1} />
      )}

      {state.showArrow && !state.impactOccurred && (
        <group ref={arrowGroupRef} position={initialStart}>
          <mesh rotation={[Math.PI, 0, 0]} geometry={arrowGeometry} material={materials.arrow}>
            <pointLight color="#00ff00" intensity={3} distance={6} />
          </mesh>
        </group>
      )}
    </>
  );
}
