import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, SphereGeometry, MeshBasicMaterial, RingGeometry, AdditiveBlending, DoubleSide, Group, Mesh, Color } from 'three';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import MeteorTrail from './MeteorTrail';

interface MeteorProps {
  targetPosition: Vector3;
  onImpact: (damage: number, position: Vector3) => void;
  onComplete: () => void;
  timestamp?: number; // Optional timestamp for staggered meteor timing
  /** Override default boss meteor damage (e.g. purple warlock swarm). */
  damage?: number;
  /** Randomized sky origin for angled approach (e.g. purple warlock swarm). */
  startPosition?: Vector3;
}

const DAMAGE_RADIUS = 2.99;
const IMPACT_DURATION = 0.625;
const METEOR_SPEED = 38;
const METEOR_DAMAGE = 173;
const WARNING_RING_SEGMENTS = 9;
const FIRE_PARTICLES_COUNT = 0;
const WARNING_DURATION = 100; // 1.5 seconds warning before meteor appears

// Reusable geometries and materials
const meteorGeometry = new SphereGeometry(0.75, 16, 16);
const meteorMaterial = new MeshBasicMaterial({ color: "#BA55D3" });
const warningRingGeometry = new RingGeometry(DAMAGE_RADIUS - 0.2, DAMAGE_RADIUS, WARNING_RING_SEGMENTS);
const pulsingRingGeometry = new RingGeometry(DAMAGE_RADIUS - 0.8, DAMAGE_RADIUS - 0.6, WARNING_RING_SEGMENTS);
const outerGlowGeometry = new RingGeometry(DAMAGE_RADIUS - 0.25, DAMAGE_RADIUS, WARNING_RING_SEGMENTS);
const particleGeometry = new SphereGeometry(0.1, 8, 8);

// Reusable vectors to avoid allocations
const tempTargetGroundPos = new Vector3();

/** Stable impact VFX component — animates via useFrame, no per-frame setState. */
function MeteorImpactEffect({
  positionRef,
  startTimeRef,
  activeRef,
  onComplete,
}: {
  positionRef: React.RefObject<Vector3>;
  startTimeRef: React.RefObject<number | null>;
  activeRef: React.RefObject<boolean>;
  onComplete: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const coreRef = useRef<Mesh>(null);
  const innerRef = useRef<Mesh>(null);
  const ringRefs = [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)];
  const doneRef = useRef(false);
  const RING_SIZES = [2.0, 2.15, 2.3, 2.5, 2.7];

  useFrame(() => {
    if (groupRef.current && positionRef.current) {
      groupRef.current.position.copy(positionRef.current);
    }
    if (!activeRef.current || startTimeRef.current === null) {
      if (groupRef.current) groupRef.current.visible = false;
      return;
    }
    if (groupRef.current) groupRef.current.visible = true;
    if (doneRef.current) return;

    const elapsed = (Date.now() - startTimeRef.current) / 350;
    const fade = Math.max(0, 1 - (elapsed / IMPACT_DURATION));
    if (fade <= 0) {
      doneRef.current = true;
      onComplete();
      return;
    }
    if (coreRef.current) {
      (coreRef.current.material as any).opacity = 1.8 * fade;
      (coreRef.current.material as any).emissiveIntensity = 2 * fade;
      coreRef.current.scale.setScalar(2 + elapsed);
    }
    if (innerRef.current) {
      (innerRef.current.material as any).opacity = 1.9 * fade;
      (innerRef.current.material as any).emissiveIntensity = 2 * fade;
    }
    ringRefs.forEach((ref, i) => {
      if (!ref.current) return;
      const size = RING_SIZES[i] * (1.125 + elapsed * 1.25);
      ref.current.scale.setScalar(size);
      (ref.current.material as any).opacity = 0.95 * fade * (1 - i * 0.1);
      (ref.current.material as any).emissiveIntensity = 0.7 * fade;
    });
  });

  return (
    <group ref={groupRef}>
      <mesh ref={coreRef}>
        <sphereGeometry args={[1, 32, 32]} />
        <meshStandardMaterial color="#BA55D3" emissive="#BA55D3" emissiveIntensity={2} transparent opacity={1.8} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh ref={innerRef}>
        <sphereGeometry args={[1, 24, 24]} />
        <meshStandardMaterial color="#BA55D3" emissive="#BA55D3" emissiveIntensity={2} transparent opacity={1.9} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      {RING_SIZES.map((_, i) => (
        <mesh key={i} ref={ringRefs[i]}>
          <torusGeometry args={[1, 0.1725, 4, 32]} />
          <meshStandardMaterial color="#BA55D3" emissive="#BA55D3" emissiveIntensity={0.7} transparent opacity={0.95} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}

export default function Meteor({ targetPosition, onImpact, onComplete, timestamp, damage: damageOverride, startPosition }: MeteorProps) {
  const meteorGroupRef = useRef<Group>(null);
  const meteorMeshRef = useRef<Mesh>(null);

  // One pooled light serves the whole effect: it follows the falling meteor, then
  // fades at the impact point (replaces 1 falling + 2 impact <pointLight>s → 1 pooled).
  const meteorLight = useDynamicLight({ color: new Color('#BA55D3'), distance: 12, decay: 2, priority: 2 });

  // useMemo for initial calculations
  const [initialTargetPos, startPos, trajectory, trailBackward] = useMemo(() => {
    const initTarget = new Vector3(targetPosition.x, -3, targetPosition.z); // Slightly below ground for better visual
    const start = startPosition?.clone() ?? new Vector3(targetPosition.x, 60, targetPosition.z);
    const traj = new Vector3().subVectors(initTarget, start).normalize();
    return [initTarget, start, traj, traj.clone().negate()];
  }, [startPosition, targetPosition]);

  useEffect(() => {
    (window as any).audioSystem?.playMeteorIndicatorSound?.(
      new Vector3(initialTargetPos.x, 0, initialTargetPos.z),
    );
  }, [initialTargetPos]);

  const [showMeteor, setShowMeteor] = useState(false);
  const impactOccurredRef = useRef(false);
  const impactStartTimeRef = useRef<number | null>(null);
  const impactPositionRef = useRef(initialTargetPos.clone());

  useEffect(() => {
    // Calculate delay based on timestamp if provided, otherwise use default WARNING_DURATION
    const delay = timestamp ? Math.max(0, timestamp - Date.now() + WARNING_DURATION) : WARNING_DURATION;

    const timer = setTimeout(() => {
      setShowMeteor(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [timestamp]);

  useEffect(() => {
    if (!showMeteor) return;
    (window as any).audioSystem?.playCrossentropyMeteoriteFallSound?.(
      new Vector3(initialTargetPos.x, 0, initialTargetPos.z),
    );
  }, [showMeteor, initialTargetPos]);

  useFrame((_, delta) => {
    // Drive the pooled light through both phases.
    if (impactStartTimeRef.current !== null) {
      // Impact phase: light fades at the impact point (replaces the 2 impact <pointLight>s).
      const elapsed = (Date.now() - impactStartTimeRef.current) / 350;
      const fade = Math.max(0, 1 - elapsed / IMPACT_DURATION);
      const ip = impactPositionRef.current;
      meteorLight.current?.setPosition(ip.x, ip.y, ip.z);
      meteorLight.current?.setIntensity(0.8 * fade);
    } else if (showMeteor && !impactOccurredRef.current && meteorGroupRef.current) {
      // Falling phase: light follows the meteor (replaces the falling <pointLight>).
      const mp = meteorGroupRef.current.position;
      meteorLight.current?.setPosition(mp.x, mp.y, mp.z);
      meteorLight.current?.setIntensity(5);
    }

    if (!meteorGroupRef.current || !showMeteor || impactOccurredRef.current) {
      return;
    }

    const currentPos = meteorGroupRef.current.position;
    const distanceToTarget = currentPos.distanceTo(initialTargetPos);

    if (distanceToTarget < DAMAGE_RADIUS || currentPos.y <= 0) {
      impactOccurredRef.current = true;
      impactStartTimeRef.current = Date.now();
      impactPositionRef.current.copy(meteorGroupRef.current.position);

      // Call impact with the meteor's impact position (ground level for damage check)
      tempTargetGroundPos.set(initialTargetPos.x, 0, initialTargetPos.z);
      onImpact(damageOverride ?? METEOR_DAMAGE, tempTargetGroundPos.clone());
      return;
    }

    const speed = METEOR_SPEED * delta;
    currentPos.addScaledVector(trajectory, speed);
  });

  const getPulsingScale = useCallback((): [number, number, number] => {
    const scale = 1 + Math.sin(Date.now() * 0.005) * 0.2;
    return [scale, scale, 1] as [number, number, number];
  }, []);

  return (
    <>
      <group position={[initialTargetPos.x, 0.01, initialTargetPos.z]}>
        {/* Warning rings using shared geometries */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.325, 0]}>
          <primitive object={warningRingGeometry} />
          <meshBasicMaterial color="#BA55D3" transparent opacity={0.4} side={DoubleSide} />
        </mesh>

        {/* Pulsing inner ring */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          scale={getPulsingScale()}
          position={[0, 0.35, 0]}
        >
          <primitive object={pulsingRingGeometry} />
          <meshBasicMaterial
            color="#BA55D3"
            transparent
            opacity={0.4 + Math.sin(Date.now() * 0.003) * 0.2}
            side={DoubleSide}
          />
        </mesh>


        {/* Rising fire particles */}
        {[...Array(FIRE_PARTICLES_COUNT)].map((_, i) => (
          <mesh
            key={i}
            position={[
              Math.sin(Date.now() * 0.001 + i) * (DAMAGE_RADIUS - 0.5),
              Math.sin(Date.now() * 0.002 + i) * 0.5,
              Math.cos(Date.now() * 0.001 + i) * (DAMAGE_RADIUS - 0.5)
            ]}
          >
            <primitive object={particleGeometry} />
            <meshBasicMaterial
              color="#BA55D3"
              transparent
              opacity={0.3 + Math.sin(Date.now() * 0.004 + i) * 0.2}
            />
          </mesh>
        ))}
      </group>

      {/* Meteor with trail */}
      {showMeteor && (
        <group ref={meteorGroupRef} position={startPos}>
          <mesh ref={meteorMeshRef}>
            <primitive object={meteorGeometry} />
            <primitive object={meteorMaterial} />
            <MeteorTrail
              meshRef={meteorMeshRef}
              color={new Color("#BA55D3")}
              size={0.05}
              {...(startPosition ? { backwardDir: trailBackward } : {})}
            />
          </mesh>
        </group>
      )}

      {/* Add impact effect — stable component to avoid per-render GPU allocation */}
      {showMeteor && (
        <MeteorImpactEffect
          positionRef={impactPositionRef}
          startTimeRef={impactStartTimeRef}
          activeRef={impactOccurredRef}
          onComplete={onComplete}
        />
      )}
    </>
  );
}

