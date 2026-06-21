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
import type { TotemBoltVariant } from '@/utils/talents';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import EntropicBoltTrail from './EntropicBoltTrail';

export interface TotemEntropicBoltProps {
  /** World-space start (totem origin). */
  from: Vector3;
  /** World-space end (target center / impact height). */
  to: Vector3;
  /** Called once when the bolt reaches `to`. */
  onImpact: (impactWorld: Vector3) => void;
  /** Boon tint; default rose gold aligns with baseline Mantra / Entropic LMB bolts. */
  totemBoltVariant?: TotemBoltVariant;
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

/** Match `EntropicBolt` palettes for red/green/blue; default aligns with rose gold Entropic LMB. */
export function getTotemBoltTheme(variant: TotemBoltVariant | undefined): {
  primary: string;
  secondary: string;
  light: string;
} {
  switch (variant) {
    case 'wrathful':
      return { primary: '#ef4444', secondary: '#fca5a5', light: '#fecaca' };
    case 'staggering':
      return { primary: '#3b82f6', secondary: '#93c5fd', light: '#93c5fd' };
    case 'infesting':
      return { primary: '#22c55e', secondary: '#86efac', light: '#bbf7d0' };
    case 'frost':
      return { primary: '#075985', secondary: '#0369a1', light: '#7dd3fc' };
    default:
      return { primary: '#d4849a', secondary: '#f0b8c8', light: '#fde0ea' };
  }
}

/** Simplified Entropic-style bolt using the same `EntropicBoltTrail` as `EntropicBolt`. */
export default function TotemEntropicBolt({ from, to, onImpact, totemBoltVariant }: TotemEntropicBoltProps) {
  const boltRef = useRef<Group>(null);
  const orientRef = useRef<Group>(null);
  const coronaRef = useRef<Mesh>(null);
  const startRef = useRef(from.clone());
  const endRef = useRef(to.clone());
  const flightDir = useRef(new Vector3(0, 1, 0));
  const elapsed = useRef(0);
  const doneRef = useRef(false);
  const [flightActive, setFlightActive] = useState(true);

  const duration = useMemo(() => {
    const d = from.distanceTo(to);
    return Math.max(0.11, Math.min(0.38, d / 34));
  }, [from, to]);

  const theme = useMemo(() => getTotemBoltTheme(totemBoltVariant), [totemBoltVariant]);

  const trailColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const trailAccent = useMemo(() => {
    const c = new Color(theme.secondary);
    c.lerp(new Color('#ffffff'), 0.35);
    return c;
  }, [theme.secondary]);

  const primaryColor = useMemo(() => new Color(theme.primary), [theme.primary]);
  const secondaryColor = useMemo(() => new Color(theme.secondary), [theme.secondary]);

  // Pooled point light follows the bolt body (replaces the per-bolt <pointLight>).
  const boltLight = useDynamicLight({ color: theme.light, distance: 6, decay: 2, priority: 2 });

  useEffect(() => {
    startRef.current.copy(from);
    endRef.current.copy(to);
    (window as any).audioSystem?.playTotemBoltLaunchSound?.(startRef.current.clone());
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

    elapsed.current += delta;
    const t = Math.min(1, elapsed.current / duration);

    alignBoltToDirection(orientRef.current, flightDir.current);

    const pulse = 1 + Math.sin(elapsed.current * 14) * 0.06;
    if (coronaRef.current) {
      coronaRef.current.scale.setScalar(pulse);
    }

    boltRef.current.position.lerpVectors(startRef.current, endRef.current, t);

    // Drive the pooled light at the bolt body (matches the [0, 0.1, 0] local offset).
    const bp = boltRef.current.position;
    boltLight.current?.setPosition(bp.x, bp.y + 0.1, bp.z);
    boltLight.current?.setIntensity(4.2);

    if (t >= 1 && !doneRef.current) {
      doneRef.current = true;
      setFlightActive(false);
      boltLight.current?.setIntensity(0);
      onImpact(endRef.current.clone());
    }
  });

  return (
    <group>
      {flightActive && (
        <>
          <EntropicBoltTrail
            color={trailColor}
            accentColor={trailColor}
            size={0.075}
            meshRef={boltRef}
            opacity={0.95}
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

            </group>
          </group>
        </>
      )}
    </group>
  );
}
