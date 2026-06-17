import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  Vector3,
  Quaternion,
  Group,
  Mesh,
  AdditiveBlending,
  TorusGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import {
  VORPAL_GUST_BEAM_LENGTH,
  VORPAL_GUST_BEAM_RADIUS,
  VORPAL_GUST_BEAM_ORIGIN_FORWARD_OFFSET,
  VORPAL_GUST_BEAM_ORIGIN_Y_LOCAL,
  type VorpalGustStabBoonBeamTheme,
} from '@/utils/talents';

const VORPAL_GUST_THEME_COLORS = {
  default:    { beam: '#9fe8ff', puff: '#e8ffff', core: '#ffffff' },
  wrathful:   { beam: '#ff5252', puff: '#ffcdd2', core: '#ffaaaa' },
  staggering: { beam: '#73d8ff', puff: '#e0f7ff', core: '#cfffff' },
  infested:   { beam: '#66bb6a', puff: '#c8e6c9', core: '#aaffaa' },
  guard:      { beam: '#ffeb3b', puff: '#fff9c4', core: '#ffffaa' },
} satisfies Record<VorpalGustStabBoonBeamTheme, { beam: string; puff: string; core: string }>;

interface VorpalGustVfxProps {
  active: boolean;
  stabBoonTheme?: VorpalGustStabBoonBeamTheme;
}

const upAxis = new Vector3(0, 1, 0);
const forwardAxis = new Vector3(0, 0, 1);
/** Cylinder is built on Y; map local +Y to parent +Z so DragonRenderer yaw aims the beam. */
const BEAM_Y_TO_FORWARD_Z = new Quaternion().setFromUnitVectors(upAxis, forwardAxis);

/** Cone radius at normalized position t ∈ [0,1] along the beam. */
function coneRadius(t: number): number {
  return VORPAL_GUST_BEAM_RADIUS * (0.62 + (0.32 - 0.62) * t);
}

/** Build a helix particle geometry inside the cone envelope. */
function buildHelixGeo(
  strands: number,
  perStrand: number,
  twists: number,
  radiusScale: number,
): BufferGeometry {
  const n = strands * perStrand;
  const pos = new Float32Array(n * 3);
  for (let s = 0; s < strands; s++) {
    const phase = (s / strands) * Math.PI * 2;
    for (let i = 0; i < perStrand; i++) {
      const t = (i + 0.5) / perStrand;
      const y = t * VORPAL_GUST_BEAM_LENGTH;
      const r = coneRadius(t) * radiusScale;
      const angle = phase + t * Math.PI * 2 * twists;
      const idx = (s * perStrand + i) * 3;
      pos[idx]     = Math.cos(angle) * r;
      pos[idx + 1] = y;
      pos[idx + 2] = Math.sin(angle) * r;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return geo;
}

type MatRef = { opacity?: number };

export default function VorpalGustVfx({
  active,
  stabBoonTheme = 'default',
}: VorpalGustVfxProps) {
  const groupRef        = useRef<Group>(null);
  const burstRef        = useRef<Mesh>(null);
  const beamMatRef      = useRef<MeshBasicMaterial & MatRef>(null);
  const innerMatRef     = useRef<MeshBasicMaterial & MatRef>(null);
  const puffMatRef      = useRef<MeshBasicMaterial & MatRef>(null);
  const outerHelixRef   = useRef<Group>(null);
  const outerHelixMat   = useRef<PointsMaterial & MatRef>(null);
  const innerHelixRef   = useRef<Group>(null);
  const innerHelixMat   = useRef<PointsMaterial & MatRef>(null);
  const tipRingGroupRef = useRef<Group>(null);
  const tipRingRef      = useRef<Mesh>(null);
  const tipRingMat      = useRef<MeshBasicMaterial & MatRef>(null);
  const tipBurstRef     = useRef<Mesh>(null);
  const tipBurstMat     = useRef<MeshBasicMaterial & MatRef>(null);
  const startRef        = useRef<number | null>(null);

  const durationMs = 360;
  const half = VORPAL_GUST_BEAM_LENGTH * 0.5;

  const { beam: beamColor, puff: puffColor, core: coreColor } = useMemo(
    () => VORPAL_GUST_THEME_COLORS[stabBoonTheme] ?? VORPAL_GUST_THEME_COLORS.default,
    [stabBoonTheme],
  );

  // Outer spiral — 3 strands hugging the cone surface, 3.5 twists
  const outerHelixGeo = useMemo(() => buildHelixGeo(3, 22, 3.5, 0.97), []);
  // Inner counter-spiral — 2 strands at 55% radius, 5 twists (tighter eye)
  const innerHelixGeo = useMemo(() => buildHelixGeo(2, 18, 5.0, 0.52), []);
  // Tip vortex torus — lies in XZ plane (perpendicular to beam axis)
  const tipTorusGeo = useMemo(
    () => new TorusGeometry(coneRadius(1) * 0.82, 0.042, 8, 28),
    [],
  );

  useEffect(() => {
    return () => {
      outerHelixGeo.dispose();
      innerHelixGeo.dispose();
      tipTorusGeo.dispose();
    };
  }, [outerHelixGeo, innerHelixGeo, tipTorusGeo]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.position.set(
      0,
      VORPAL_GUST_BEAM_ORIGIN_Y_LOCAL,
      VORPAL_GUST_BEAM_ORIGIN_FORWARD_OFFSET,
    );
    groupRef.current.quaternion.copy(BEAM_Y_TO_FORWARD_Z);

    if (!active) {
      startRef.current = null;
      if (beamMatRef.current)    beamMatRef.current.opacity    = 0;
      if (innerMatRef.current)   innerMatRef.current.opacity   = 0;
      if (puffMatRef.current)    puffMatRef.current.opacity    = 0;
      if (outerHelixMat.current) outerHelixMat.current.opacity = 0;
      if (innerHelixMat.current) innerHelixMat.current.opacity = 0;
      if (tipRingMat.current)    tipRingMat.current.opacity    = 0;
      if (tipBurstMat.current)   tipBurstMat.current.opacity   = 0;
      return;
    }

    const now = performance.now();
    if (startRef.current == null) startRef.current = now;
    const t    = Math.min(1, (now - startRef.current) / durationMs);
    const rise = Math.min(1, t / 0.12);
    const fall = Math.max(0, 1 - Math.max(0, t - 0.18) / 0.82);
    const alpha = rise * fall;

    if (beamMatRef.current)  beamMatRef.current.opacity  = alpha * 0.38;
    if (innerMatRef.current) innerMatRef.current.opacity = alpha * 0.72;

    if (puffMatRef.current) {
      puffMatRef.current.opacity =
        alpha * 0.85 * (t < 0.15 ? 1 : Math.max(0, 1 - (t - 0.15) / 0.2));
    }
    if (burstRef.current) burstRef.current.scale.setScalar(1 + t * 2.2);

    // Outer helix spins clockwise around beam axis
    if (outerHelixRef.current)   outerHelixRef.current.rotation.y   += delta * 8.5;
    if (outerHelixMat.current)   outerHelixMat.current.opacity        = alpha * 0.78;

    // Inner helix counter-spins — creates the eye-of-the-storm look
    if (innerHelixRef.current)   innerHelixRef.current.rotation.y   -= delta * 5.8;
    if (innerHelixMat.current)   innerHelixMat.current.opacity        = alpha * 0.60;

    // Tip vortex ring spins fast + pulses
    if (tipRingGroupRef.current) tipRingGroupRef.current.rotation.y += delta * 14.0;
    if (tipRingRef.current) {
      const pulse = 1 + Math.sin(now * 0.018) * 0.14;
      tipRingRef.current.scale.setScalar(pulse);
    }
    if (tipRingMat.current)  tipRingMat.current.opacity  = alpha * 0.92;

    // Tip burst sphere — offset pulse phase
    if (tipBurstRef.current) {
      const s = 0.82 + Math.sin(now * 0.024 + 1.4) * 0.13;
      tipBurstRef.current.scale.setScalar(s);
    }
    if (tipBurstMat.current) tipBurstMat.current.opacity = alpha * 0.42;
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      {/* ── Origin puff burst ─────────────────────────────────── */}
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

      {/* ── Outer cone envelope ───────────────────────────────── */}
      <mesh position={[0, half, 0]}>
        <cylinderGeometry
          args={[
            VORPAL_GUST_BEAM_RADIUS * 0.32,
            VORPAL_GUST_BEAM_RADIUS * 0.62,
            VORPAL_GUST_BEAM_LENGTH,
            20, 1, true,
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

      {/* ── Inner glowing core cone ───────────────────────────── */}
      <mesh position={[0, half, 0]}>
        <cylinderGeometry
          args={[
            VORPAL_GUST_BEAM_RADIUS * 0.13,
            VORPAL_GUST_BEAM_RADIUS * 0.26,
            VORPAL_GUST_BEAM_LENGTH,
            16, 1, true,
          ]}
        />
        <meshBasicMaterial
          ref={innerMatRef as any}
          color={coreColor}
          transparent
          opacity={0}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      {/* ── Outer helix spiral particles (clockwise) ─────────── */}
      <group ref={outerHelixRef}>
        <points geometry={outerHelixGeo}>
          <pointsMaterial
            ref={outerHelixMat as any}
            color={beamColor}
            size={0.068}
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
            sizeAttenuation
          />
        </points>
      </group>

      {/* ── Inner helix spiral particles (counter-clockwise) ─── */}
      <group ref={innerHelixRef}>
        <points geometry={innerHelixGeo}>
          <pointsMaterial
            ref={innerHelixMat as any}
            color={coreColor}
            size={0.052}
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
            sizeAttenuation
          />
        </points>
      </group>

      {/* ── Tip vortex ────────────────────────────────────────── */}
      <group position={[0, VORPAL_GUST_BEAM_LENGTH, 0]}>
        {/* Spinning torus ring — group rotates around Y, mesh pulses in scale */}
        <group ref={tipRingGroupRef}>
          <mesh
            ref={tipRingRef}
            geometry={tipTorusGeo}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshBasicMaterial
              ref={tipRingMat as any}
              color={puffColor}
              transparent
              opacity={0}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
        {/* Pulsing compressed sphere — the funnel tip */}
        <mesh ref={tipBurstRef}>
          <sphereGeometry args={[coneRadius(1) * 0.65, 10, 8]} />
          <meshBasicMaterial
            ref={tipBurstMat as any}
            color={puffColor}
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}
