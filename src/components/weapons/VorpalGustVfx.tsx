import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  Vector3,
  Quaternion,
  Group,
  Mesh,
  AdditiveBlending,
} from '@/utils/three-exports';
import {
  VORPAL_GUST_BEAM_LENGTH,
  VORPAL_GUST_BEAM_RADIUS,
  VORPAL_GUST_BEAM_ORIGIN_FORWARD_OFFSET,
  VORPAL_GUST_BEAM_ORIGIN_Y_LOCAL,
  type VorpalGustStabBoonBeamTheme,
} from '@/utils/talents';

const VORPAL_GUST_THEME_COLORS: Record<
  VorpalGustStabBoonBeamTheme,
  { beam: string; puff: string }
> = {
  default: { beam: '#9fe8ff', puff: '#e8ffff' },
  wrathful: { beam: '#ff5252', puff: '#ffcdd2' },
  staggering: { beam: '#73d8ff', puff: '#e0f7ff' },
  infested: { beam: '#66bb6a', puff: '#c8e6c9' },
  guard: { beam: '#ffeb3b', puff: '#fff9c4' },
};

interface VorpalGustVfxProps {
  active: boolean;
  stabBoonTheme?: VorpalGustStabBoonBeamTheme;
}

const upAxis = new Vector3(0, 1, 0);
const forwardAxis = new Vector3(0, 0, 1);
/** Cylinder is built on Y; map local +Y to parent +Z so DragonRenderer yaw aims the beam. */
const BEAM_Y_TO_FORWARD_Z = new Quaternion().setFromUnitVectors(upAxis, forwardAxis);

export default function VorpalGustVfx({
  active,
  stabBoonTheme = 'default',
}: VorpalGustVfxProps) {
  const groupRef = useRef<Group>(null);
  const { beam: beamColor, puff: puffColor } = useMemo(
    () => VORPAL_GUST_THEME_COLORS[stabBoonTheme] ?? VORPAL_GUST_THEME_COLORS.default,
    [stabBoonTheme],
  );
  const burstRef = useRef<Mesh>(null);
  const beamMatRef = useRef<Mesh['material'] & { opacity?: number }>(null);
  const puffMatRef = useRef<Mesh['material'] & { opacity?: number }>(null);
  const startRef = useRef<number | null>(null);
  const durationMs = 360;
  const half = VORPAL_GUST_BEAM_LENGTH * 0.5;

  useFrame(() => {
    if (!groupRef.current) return;

    groupRef.current.position.set(
      0,
      VORPAL_GUST_BEAM_ORIGIN_Y_LOCAL,
      VORPAL_GUST_BEAM_ORIGIN_FORWARD_OFFSET,
    );
    groupRef.current.quaternion.copy(BEAM_Y_TO_FORWARD_Z);

    if (!active) {
      startRef.current = null;
      if (beamMatRef.current && 'opacity' in beamMatRef.current) beamMatRef.current.opacity = 0;
      if (puffMatRef.current && 'opacity' in puffMatRef.current) puffMatRef.current.opacity = 0;
      return;
    }

    const now = performance.now();
    if (startRef.current == null) startRef.current = now;
    const t = Math.min(1, (now - startRef.current) / durationMs);
    const rise = Math.min(1, t / 0.12);
    const fall = Math.max(0, 1 - Math.max(0, t - 0.18) / 0.82);
    const alpha = rise * fall;
    if (beamMatRef.current && 'opacity' in beamMatRef.current) {
      beamMatRef.current.opacity = alpha * 0.55;
    }
    if (puffMatRef.current && 'opacity' in puffMatRef.current) {
      puffMatRef.current.opacity =
        alpha * 0.85 * (t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.2));
    }
    if (burstRef.current) {
      const s = 1 + t * 2.2;
      burstRef.current.scale.setScalar(s);
    }
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      <mesh ref={burstRef} position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshBasicMaterial
          ref={puffMatRef as any}
          color={puffColor}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <mesh position={[0, half, 0]}>
        <cylinderGeometry
          args={[
            VORPAL_GUST_BEAM_RADIUS * 0.32,
            VORPAL_GUST_BEAM_RADIUS * 0.62,
            VORPAL_GUST_BEAM_LENGTH,
            20,
            1,
            true,
          ]}
        />
        <meshBasicMaterial
          ref={beamMatRef as any}
          color={beamColor}
          transparent
          opacity={0}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
