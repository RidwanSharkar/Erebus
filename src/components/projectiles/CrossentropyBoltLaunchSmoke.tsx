import React, { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  DoubleSide,
  Group,
  Mesh,
  Quaternion,
  TorusGeometry,
  Vector3,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import type { CrossentropyVisualTheme } from '@/utils/talents';

const Z_AXIS = new Vector3(0, 0, 1);
const FALLBACK_RIGHT = new Vector3(1, 0, 0);
const _dir = new Vector3();
const _quat = new Quaternion();

function alignRingAxis(group: Group | null, direction: Vector3) {
  if (!group) return;
  _dir.copy(direction).normalize();
  if (_dir.lengthSq() < 1e-8) return;
  if (Math.abs(_dir.dot(Z_AXIS)) > 0.995) {
    _quat.setFromUnitVectors(FALLBACK_RIGHT, _dir);
  } else {
    _quat.setFromUnitVectors(Z_AXIS, _dir);
  }
  group.quaternion.copy(_quat);
}

function smokeTint(theme: CrossentropyVisualTheme): Color {
  switch (theme) {
    case 'inferno':
      return new Color('#FF4A1F');
    case 'glacial':
      return new Color('#60C4FF');
    case 'tempest':
      return new Color('#64B5F6');
    case 'plague':
      return new Color('#81C784');
    default:
      return new Color('#FF6A20');
  }
}

export interface CrossentropyBoltLaunchSmokeProps {
  direction: Vector3;
  visualTheme: CrossentropyVisualTheme;
  anchorRef: React.RefObject<Vector3>;
  boltRadius: number;
  /** Reaper: purple-gray smoke to match trail */
  reaperPurple?: boolean;
  /** Non-Reaper: abort once traveled distance exceeds this band */
  launchDistanceRef?: React.MutableRefObject<number>;
  launchBand?: number;
  durationSec?: number;
}

const DEFAULT_DURATION = 0.26;
const DEFAULT_LAUNCH_BAND = 4;

export default function CrossentropyBoltLaunchSmoke({
  direction,
  visualTheme,
  anchorRef,
  boltRadius,
  reaperPurple = false,
  launchDistanceRef,
  launchBand = DEFAULT_LAUNCH_BAND,
  durationSec = DEFAULT_DURATION,
}: CrossentropyBoltLaunchSmokeProps) {
  const rootRef = useRef<Group>(null);
  const ring1Ref = useRef<Mesh>(null);
  const ring2Ref = useRef<Mesh>(null);
  const startElapsedRef = useRef<number | null>(null);
  const completedRef = useRef(false);
  const [done, setDone] = useState(false);

  const tint = useMemo(() => {
    if (reaperPurple) return new Color('#ddd4ea');
    return smokeTint(visualTheme);
  }, [visualTheme, reaperPurple]);

  const mats = useMemo(() => {
    const baseOpacity = 0.25;
    const m1 = new MeshBasicMaterial({
      color: tint.clone(),
      transparent: true,
      opacity: baseOpacity,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    const m2 = new MeshBasicMaterial({
      color: tint.clone().multiplyScalar(0.92),
      transparent: true,
      opacity: baseOpacity * 0.72,
      depthWrite: false,
      side: DoubleSide,
      toneMapped: false,
    });
    return { m1, m2 };
  }, [tint]);

  useEffect(() => {
    return () => {
      mats.m1.dispose();
      mats.m2.dispose();
    };
  }, [mats]);

  const { geo1, geo2 } = useMemo(() => {
    const tubeR = boltRadius * 0.38;
    const ringR = boltRadius * 0.96;
    return {
      geo1: new TorusGeometry(ringR, tubeR, 10, 36),
      geo2: new TorusGeometry(ringR * 0.82, tubeR * 0.72, 8, 28),
    };
  }, [boltRadius]);

  useEffect(() => {
    return () => {
      geo1.dispose();
      geo2.dispose();
    };
  }, [geo1, geo2]);

  useFrame((state) => {
    if (completedRef.current || !rootRef.current || !anchorRef.current) return;

    if (startElapsedRef.current === null) {
      startElapsedRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startElapsedRef.current;
    const t = Math.min(elapsed / durationSec, 1);

    const distAbort =
      launchDistanceRef != null && launchDistanceRef.current >= launchBand;

    if (elapsed >= durationSec || distAbort) {
      completedRef.current = true;
      setDone(true);
      return;
    }

    rootRef.current.position.copy(anchorRef.current);
    alignRingAxis(rootRef.current, direction);

    const easeOut = 1 - (1 - t) ** 1.65;
    const scale = boltRadius * (1.95 + easeOut * 5.0);
    const fade = Math.max(0, 1 - t ** 1.12);

    const spin = elapsed * 4.5;

    if (ring1Ref.current) {
      ring1Ref.current.rotation.z = spin;
      ring1Ref.current.scale.setScalar(scale / boltRadius);
      mats.m1.opacity = 0.46 * fade;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z = -spin * 0.72 + 0.35;
      ring2Ref.current.scale.setScalar((scale * 0.78) / boltRadius);
      mats.m2.opacity = 0.32 * fade;
    }
  });

  if (done) return null;

  return (
    <group ref={rootRef} renderOrder={2}>
      <mesh ref={ring1Ref} geometry={geo1} material={mats.m1} />
      <mesh ref={ring2Ref} geometry={geo2} material={mats.m2} />
    </group>
  );
}
