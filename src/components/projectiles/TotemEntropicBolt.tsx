import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Vector3,
  Group,
  Mesh,
  Color,
  AdditiveBlending,
  Quaternion,
  DoubleSide,
} from '@/utils/three-exports';
import EntropicBoltTrail from './EntropicBoltTrail';

export interface TotemEntropicBoltProps {
  /** World-space start (totem origin). */
  from: Vector3;
  /** World-space end (target center / impact height). */
  to: Vector3;
  /** Called once when the bolt reaches `to`. */
  onImpact: (impactWorld: Vector3) => void;
  /**
   * When set, `endRef` is refreshed each frame so the bolt can follow a moving target.
   * Return `null` to keep the last resolved end (e.g. target temporarily missing).
   */
  getImpactWorld?: () => Vector3 | null;
}

const AXIS_Y = new Vector3(0, 1, 0);
const FALLBACK_UP = new Vector3(0, 0, 1);
const _dir = new Vector3();
const _quat = new Quaternion();

function alignBoltToDirection(group: Group | null, direction: Vector3) {
  if (!group) return;
  _dir.copy(direction).normalize();
  if (Math.abs(_dir.dot(AXIS_Y)) > 0.985) {
    _quat.setFromUnitVectors(FALLBACK_UP, _dir);
  } else {
    _quat.setFromUnitVectors(AXIS_Y, _dir);
  }
  group.quaternion.copy(_quat);
}

/** Simplified Entropic-style bolt using the same `EntropicBoltTrail` as `EntropicBolt`. */
export default function TotemEntropicBolt({ from, to, onImpact, getImpactWorld }: TotemEntropicBoltProps) {
  const boltRef = useRef<Group>(null);
  const orientRef = useRef<Group>(null);
  const coronaRef = useRef<Mesh>(null);
  const startRef = useRef(from.clone());
  const endRef = useRef(to.clone());
  const flightDir = useRef(new Vector3(0, 1, 0));
  const elapsed = useRef(0);
  const doneRef = useRef(false);
  const [flightActive, setFlightActive] = useState(true);
  const durationFlightRef = useRef(0.22);
  const durationInitializedRef = useRef(false);

  const durationStatic = useMemo(() => {
    const d = from.distanceTo(to);
    return Math.max(0.11, Math.min(0.38, d / 34));
  }, [from, to]);

  const theme = useMemo(
    () => ({
      primary: '#7c3aed',
      secondary: '#c4b5fd',
      light: '#ede9fe',
    }),
    [],
  );

  const trailColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const trailAccent = useMemo(() => {
    const c = new Color(theme.secondary);
    c.lerp(new Color('#ffffff'), 0.35);
    return c;
  }, [theme.secondary]);

  const primaryColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const secondaryColor = useMemo(() => new Color(theme.secondary), [theme.secondary]);

  useEffect(() => {
    startRef.current.copy(from);
    endRef.current.copy(to);
    elapsed.current = 0;
    doneRef.current = false;
    durationInitializedRef.current = false;
    setFlightActive(true);
    flightDir.current.copy(endRef.current).sub(startRef.current);
    if (flightDir.current.lengthSq() < 1e-6) {
      flightDir.current.set(0, 1, 0);
    } else {
      flightDir.current.normalize();
    }
    if (boltRef.current) {
      boltRef.current.position.copy(startRef.current);
    }
    alignBoltToDirection(orientRef.current, flightDir.current);
  }, [from, to]);

  useFrame((_, delta) => {
    if (doneRef.current || !boltRef.current) return;

    if (getImpactWorld) {
      const next = getImpactWorld();
      if (next) {
        endRef.current.copy(next);
      }
      if (!durationInitializedRef.current) {
        durationInitializedRef.current = true;
        const d = startRef.current.distanceTo(endRef.current);
        durationFlightRef.current = Math.max(0.11, Math.min(0.38, d / 34));
      }
    }

    elapsed.current += delta;
    const duration = getImpactWorld ? durationFlightRef.current : durationStatic;
    const t = Math.min(1, elapsed.current / duration);

    if (getImpactWorld) {
      flightDir.current.copy(endRef.current).sub(boltRef.current.position);
    } else {
      flightDir.current.copy(endRef.current).sub(startRef.current);
    }
    if (flightDir.current.lengthSq() < 1e-6) {
      flightDir.current.set(0, 1, 0);
    } else {
      flightDir.current.normalize();
    }

    alignBoltToDirection(orientRef.current, flightDir.current);

    const pulse = 1 + Math.sin(elapsed.current * 14) * 0.06;
    if (coronaRef.current) {
      coronaRef.current.scale.setScalar(pulse);
    }

    boltRef.current.position.lerpVectors(startRef.current, endRef.current, t);

    if (t >= 1 && !doneRef.current) {
      doneRef.current = true;
      setFlightActive(false);
      onImpact(endRef.current.clone());
    }
  });

  return (
    <group>
      {flightActive && (
        <>
          <EntropicBoltTrail
            color={trailColor}
            accentColor={trailAccent}
            size={0.26}
            meshRef={boltRef}
            opacity={0.95}
            flightDirectionRef={flightDir}
          />

          <group ref={boltRef} position={startRef.current.toArray()}>
            <group ref={orientRef}>
              <mesh>
                <cylinderGeometry args={[0.038, 0.022, 0.52, 8, 1, false]} />
                <meshStandardMaterial
                  color={primaryColor}
                  emissive={secondaryColor}
                  emissiveIntensity={2.4}
                  transparent
                  opacity={0.92}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              <mesh ref={coronaRef}>
                <cylinderGeometry args={[0.065, 0.042, 0.58, 10, 1, true]} />
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={primaryColor}
                  emissiveIntensity={1.15}
                  transparent
                  opacity={0.2}
                  blending={AdditiveBlending}
                  depthWrite={false}
                  side={DoubleSide}
                />
              </mesh>

              <mesh position={[0, 0.28, 0]}>
                <sphereGeometry args={[0.048, 8, 8]} />
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={secondaryColor}
                  emissiveIntensity={3.8}
                  transparent
                  opacity={0.88}
                  blending={AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>

              <pointLight color={theme.light} intensity={4.2} distance={6} decay={2} position={[0, 0.1, 0]} />
            </group>
          </group>
        </>
      )}
    </group>
  );
}
