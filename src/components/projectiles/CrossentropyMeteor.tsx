import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from '@/utils/three-exports';
import MeteorTrail from '@/components/enemies/MeteorTrail';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  CROSSENTROPY_METEOR_AOE_RADIUS,
  CROSSENTROPY_METEOR_DAMAGE,
  CROSSENTROPY_METEOR_SKY_HEIGHT_MAX,
  CROSSENTROPY_METEOR_SKY_HEIGHT_MIN,
  CROSSENTROPY_METEOR_SKY_OFFSET_MAX,
  CROSSENTROPY_METEOR_SKY_OFFSET_MIN,
  CROSSENTROPY_METEOR_SPEED,
  CROSSENTROPY_METEOR_WARNING_MS,
} from '@/utils/talents';

interface CrossentropyMeteorProps {
  targetPosition: Vector3;
  onImpact: (damage: number, position: Vector3) => void;
  onComplete: () => void;
  timestamp?: number;
  damage?: number;
  startPosition?: Vector3;
}

const IMPACT_DURATION_SEC = 0.5;
/** Pulls impact sphere / ring expansion and point-light reach in together (~25% smaller). */
const METEOR_IMPACT_VFX_SCALE = 0.575;
const WARNING_SEGMENTS = 7;
const FIRE_PARTICLES_COUNT = 4;
const TORUS_BASE_SIZES = [1.5, 1.75, 2.0] as const;

const meteorGeometry = new SphereGeometry(0.68, 16, 16);
const meteorMaterial = new MeshBasicMaterial({ color: '#FF6A1A' });
const warningRingGeometry = new RingGeometry(
  CROSSENTROPY_METEOR_AOE_RADIUS - 0.2,
  CROSSENTROPY_METEOR_AOE_RADIUS,
  WARNING_SEGMENTS,
);
const pulsingRingGeometry = new RingGeometry(
  CROSSENTROPY_METEOR_AOE_RADIUS - 0.75,
  CROSSENTROPY_METEOR_AOE_RADIUS - 0.55,
  WARNING_SEGMENTS,
);
const particleGeometry = new SphereGeometry(0.09, 8, 8);
const tempGroundImpact = new Vector3();
const tempMeteorLightPos = new Vector3();
const impactSphereGeometry = new SphereGeometry(1, 32, 32);

function seededUnit(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function buildRandomizedStart(target: Vector3, seedBase: number): Vector3 {
  const u1 = seededUnit(seedBase + 0.17);
  const u2 = seededUnit(seedBase + 0.73);
  const u3 = seededUnit(seedBase + 1.31);
  const angle = u1 * Math.PI * 2;
  const distance =
    CROSSENTROPY_METEOR_SKY_OFFSET_MIN +
    (CROSSENTROPY_METEOR_SKY_OFFSET_MAX - CROSSENTROPY_METEOR_SKY_OFFSET_MIN) * u2;
  const height =
    CROSSENTROPY_METEOR_SKY_HEIGHT_MIN +
    (CROSSENTROPY_METEOR_SKY_HEIGHT_MAX - CROSSENTROPY_METEOR_SKY_HEIGHT_MIN) * u3;
  return new Vector3(
    target.x + Math.cos(angle) * distance,
    height,
    target.z + Math.sin(angle) * distance,
  );
}

/** Expanding sphere / torii + light; material driven in `useFrame` (same timing as `ExplosionEffect`). */
function CrossentropyMeteorImpactVisual({
  impactStartMs,
  position,
}: {
  impactStartMs: number;
  position: Vector3;
}) {
  const sphereRef = useRef<Mesh>(null);
  const torus0 = useRef<Mesh>(null);
  const torus1 = useRef<Mesh>(null);
  const torus2 = useRef<Mesh>(null);
  const torusRefs = [torus0, torus1, torus2];

  // Pooled light for the impact flash (replaces the impact <pointLight>).
  const impactLight = useDynamicLight({ color: '#FF7A1A', priority: 1 });

  const torusRotations = useMemo(
    () =>
      TORUS_BASE_SIZES.map(
        () =>
          [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI] as [
            number,
            number,
            number,
          ],
      ),
    [],
  );

  useFrame(() => {
    const elapsedRaw = (Date.now() - impactStartMs) / 320;
    const elapsedSec = (Date.now() - impactStartMs) / 1000;
    const fade = Math.max(0, 1 - elapsedSec / IMPACT_DURATION_SEC);
    if (!sphereRef.current) return;

    sphereRef.current.scale.setScalar(METEOR_IMPACT_VFX_SCALE * 1.05 * (1.8 + elapsedRaw));

    const sm = sphereRef.current.material as MeshStandardMaterial;
    sm.opacity = 1.5 * fade;
    sm.emissiveIntensity = 2 * fade;

    for (let i = 0; i < TORUS_BASE_SIZES.length; i++) {
      const mesh = torusRefs[i].current;
      if (!mesh) continue;
      const baseSize = TORUS_BASE_SIZES[i];
      mesh.scale.setScalar(METEOR_IMPACT_VFX_SCALE * baseSize * (1.02 + elapsedRaw * 1.1));
      const tm = mesh.material as MeshStandardMaterial;
      tm.emissiveIntensity = 0.8 * fade;
      tm.opacity = 0.9 * fade * (1 - i * 0.12);
    }

    impactLight.current?.setPosition(position.x, position.y, position.z);
    impactLight.current?.setIntensity(0.9 * fade);
    impactLight.current?.setDistance(METEOR_IMPACT_VFX_SCALE * 9 * (1 + elapsedRaw));
  });

  return (
    <group position={position}>
      <mesh ref={sphereRef} geometry={impactSphereGeometry}>
        <meshStandardMaterial
          color="#FF5A18"
          emissive="#FF7A1A"
          emissiveIntensity={2}
          transparent
          opacity={1.5}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      {TORUS_BASE_SIZES.map((baseSize, i) => (
        <mesh key={i} ref={torusRefs[i]} rotation={torusRotations[i]}>
          <torusGeometry args={[1, 0.11, 4, 32]} />
          <meshStandardMaterial
            color="#FF7A1A"
            emissive="#FFB347"
            emissiveIntensity={0.8}
            transparent
            opacity={0.9 * (1 - i * 0.12)}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function CrossentropyMeteor({
  targetPosition,
  onImpact,
  onComplete,
  timestamp,
  damage,
  startPosition,
}: CrossentropyMeteorProps) {
  const meteorGroupRef = useRef<Group>(null);
  const meteorMeshRef = useRef<Mesh>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Pooled light follows the falling meteor (replaces its <pointLight>).
  const meteorLight = useDynamicLight({ color: '#FF7A1A', distance: 8, priority: 2 });

  const [impactStartTime, setImpactStartTime] = useState<number | null>(null);
  const [showMeteor, setShowMeteor] = useState(false);
  const [impactOccurred, setImpactOccurred] = useState(false);
  const [impactGroundPos] = useState(() => new Vector3());

  const [impactTargetPos, initialStartPos, trajectory] = useMemo(() => {
    const target = new Vector3(targetPosition.x, -3, targetPosition.z);
    const seedBase = (timestamp ?? Date.now()) / 1000;
    const start =
      startPosition?.clone() ?? buildRandomizedStart(targetPosition, seedBase);
    const dir = new Vector3().subVectors(target, start).normalize();
    return [target, start, dir];
  }, [startPosition, targetPosition, timestamp]);

  const trailBackward = useMemo(() => trajectory.clone().negate(), [trajectory]);

  useEffect(() => {
    (window as any).audioSystem?.playMeteorIndicatorSound?.(
      new Vector3(impactTargetPos.x, 0, impactTargetPos.z),
    );
  }, [impactTargetPos]);

  useEffect(() => {
    const delay = timestamp
      ? Math.max(0, timestamp - Date.now() + CROSSENTROPY_METEOR_WARNING_MS)
      : CROSSENTROPY_METEOR_WARNING_MS;
    const timer = setTimeout(() => setShowMeteor(true), delay);
    return () => clearTimeout(timer);
  }, [timestamp]);

  useEffect(() => {
    if (!showMeteor) return;
    (window as any).audioSystem?.playCrossentropyMeteoriteFallSound?.(
      new Vector3(impactTargetPos.x, 0, impactTargetPos.z),
    );
  }, [impactTargetPos, showMeteor]);

  useFrame((_, delta) => {
    if (!meteorGroupRef.current || !showMeteor || impactOccurred) {
      // Meteor not falling — keep its pooled light dark.
      meteorLight.current?.setIntensity(0);
      return;
    }
    const currentPos = meteorGroupRef.current.position;

    // Drive the pooled light at the meteor's world position.
    meteorGroupRef.current.getWorldPosition(tempMeteorLightPos);
    meteorLight.current?.setPosition(tempMeteorLightPos.x, tempMeteorLightPos.y, tempMeteorLightPos.z);
    meteorLight.current?.setIntensity(5);

    const distanceToTarget = currentPos.distanceTo(impactTargetPos);
    if (distanceToTarget < CROSSENTROPY_METEOR_AOE_RADIUS || currentPos.y <= 0) {
      setImpactOccurred(true);
      setImpactStartTime(Date.now());
      tempGroundImpact.set(impactTargetPos.x, 0, impactTargetPos.z);
      impactGroundPos.copy(tempGroundImpact);
      onImpact(damage ?? CROSSENTROPY_METEOR_DAMAGE, tempGroundImpact.clone());
      return;
    }
    currentPos.addScaledVector(trajectory, CROSSENTROPY_METEOR_SPEED * delta);
  });

  useEffect(() => {
    if (!impactStartTime) return;
    const t = window.setTimeout(() => {
      onCompleteRef.current();
    }, IMPACT_DURATION_SEC * 1000);
    return () => window.clearTimeout(t);
  }, [impactStartTime]);

  const getPulsingScale = useCallback((): [number, number, number] => {
    const s = 1 + Math.sin(Date.now() * 0.005) * 0.2;
    return [s, s, 1];
  }, []);

  return (
    <>
      <group position={[impactTargetPos.x, 0.01, impactTargetPos.z]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <primitive object={warningRingGeometry} />
          <meshBasicMaterial color="#FF7A1A" transparent opacity={0.42} side={DoubleSide} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} scale={getPulsingScale()}>
          <primitive object={pulsingRingGeometry} />
          <meshBasicMaterial
            color="#FF9F43"
            transparent
            opacity={0.38 + Math.sin(Date.now() * 0.003) * 0.16}
            side={DoubleSide}
          />
        </mesh>
        {[...Array(FIRE_PARTICLES_COUNT)].map((_, i) => (
          <mesh
            key={i}
            position={[
              Math.sin(Date.now() * 0.001 + i) * (CROSSENTROPY_METEOR_AOE_RADIUS - 0.45),
              Math.sin(Date.now() * 0.002 + i) * 0.45,
              Math.cos(Date.now() * 0.001 + i) * (CROSSENTROPY_METEOR_AOE_RADIUS - 0.45),
            ]}
          >
            <primitive object={particleGeometry} />
            <meshBasicMaterial
              color="#FF9F43"
              transparent
              opacity={0.28 + Math.sin(Date.now() * 0.004 + i) * 0.2}
            />
          </mesh>
        ))}
      </group>

      {showMeteor && !impactOccurred && (
        <group ref={meteorGroupRef} position={initialStartPos}>
          <mesh ref={meteorMeshRef}>
            <primitive object={meteorGeometry} />
            <primitive object={meteorMaterial} />
            <MeteorTrail
              meshRef={meteorMeshRef}
              color={new Color('#FF7A1A')}
              size={0.05}
              backwardDir={trailBackward}
            />
          </mesh>
        </group>
      )}

      {impactStartTime != null && (
        <CrossentropyMeteorImpactVisual
          impactStartMs={impactStartTime}
          position={impactGroundPos}
        />
      )}
    </>
  );
}
