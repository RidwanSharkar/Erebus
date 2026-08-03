import { useRef, useState, useEffect, useMemo } from 'react';
import {
  Group,
  MeshBasicMaterial,
  MeshStandardMaterial,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import {
  getIncinerationRuneBandTexture,
  INCINERATION_FIRE_CORE,
  INCINERATION_FIRE_DEEP,
  INCINERATION_FIRE_GLOW,
  INCINERATION_RUNE_BAND_BASE_OPACITY,
  INCINERATION_RUNE_BAND_INNER,
  INCINERATION_RUNE_BAND_OUTER,
  INCINERATION_RUNE_RIM_LINE_WIDTH,
} from '@/components/weapons/IncinerationChargeAura';

/** Matches IncinerationBeam launch ring — upright, pushed ahead of the caster. */
const RING_FORWARD = 0.75;
/** Local Y under DragonUnit groupRef (world ~1.5 when player Y ≈ 0). */
const RING_LOCAL_Y = 1.3;
const RING_SCALE = 0.775;

interface IncinerationVerticalChargeRingProps {
  isActive: boolean;
}

/**
 * Vertical incineration rune ring (perpendicular to ground, pushed forward).
 * Same mesh/look as IncinerationBeam launch rings; ChargeAura-style fade on release.
 * Parent dragon group already carries facing yaw — offset along local +Z only.
 */
export default function IncinerationVerticalChargeRing({
  isActive,
}: IncinerationVerticalChargeRingProps) {
  const ringRef = useRef<Group>(null);
  const innerRunesRef = useRef<Group>(null);
  const outerRunesRef = useRef<Group>(null);
  const runeBandMatRef = useRef<MeshBasicMaterial>(null);
  const innerRimMatRef = useRef<MeshStandardMaterial>(null);
  const outerRimMatRef = useRef<MeshStandardMaterial>(null);
  const opacityRef = useRef(0);
  const isActiveRef = useRef(isActive);
  const shouldRenderRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(false);

  const runeBandTexture = useMemo(() => getIncinerationRuneBandTexture(), []);

  isActiveRef.current = isActive;
  shouldRenderRef.current = shouldRender;

  useEffect(() => {
    if (!isActive) return;
    opacityRef.current = 0;
    setShouldRender(true);
  }, [isActive]);

  useFrame((_, delta) => {
    if (!ringRef.current) return;

    const active = isActiveRef.current;
    const target = active ? 1 : 0;
    const diff = target - opacityRef.current;
    if (Math.abs(diff) > 0.004) {
      opacityRef.current += diff * 0.05;
    } else {
      opacityRef.current = target;
    }

    const opacity = opacityRef.current;
    if (runeBandMatRef.current) {
      runeBandMatRef.current.opacity = INCINERATION_RUNE_BAND_BASE_OPACITY * opacity;
    }
    if (innerRimMatRef.current) {
      innerRimMatRef.current.opacity = 0.92 * opacity;
      innerRimMatRef.current.emissiveIntensity = 2.6 + Math.sin(performance.now() * 0.018) * 0.4;
    }
    if (outerRimMatRef.current) {
      outerRimMatRef.current.opacity = 0.95 * opacity;
      outerRimMatRef.current.emissiveIntensity = 2.4 + Math.cos(performance.now() * 0.016) * 0.35;
    }

    if (active) {
      if (innerRunesRef.current) {
        innerRunesRef.current.rotation.z += delta * 2.8;
      }
      if (outerRunesRef.current) {
        outerRunesRef.current.rotation.z -= delta * 3.4;
      }
    }

    if (!active && opacityRef.current <= 0.004) {
      opacityRef.current = 0;
      if (shouldRenderRef.current) setShouldRender(false);
    }
  });

  if (!shouldRender) return null;

  return (
    <group
      ref={ringRef}
      position={[0, RING_LOCAL_Y, RING_FORWARD]}
      scale={[RING_SCALE, RING_SCALE, RING_SCALE]}
    >
      <group ref={innerRunesRef} position={[0, 0, 0.005]}>
        <mesh>
          <ringGeometry args={[INCINERATION_RUNE_BAND_INNER, INCINERATION_RUNE_BAND_OUTER, 48]} />
          <meshBasicMaterial
            ref={runeBandMatRef}
            map={runeBandTexture}
            transparent
            opacity={INCINERATION_RUNE_BAND_BASE_OPACITY}
            depthWrite={false}
            side={2}
          />
        </mesh>
      </group>
      <group ref={outerRunesRef} position={[0, 0, -0.005]}>
        <mesh>
          <ringGeometry
            args={[
              INCINERATION_RUNE_BAND_INNER - INCINERATION_RUNE_RIM_LINE_WIDTH,
              INCINERATION_RUNE_BAND_INNER,
              48,
            ]}
          />
          <meshStandardMaterial
            ref={innerRimMatRef}
            color={INCINERATION_FIRE_CORE}
            emissive={INCINERATION_FIRE_GLOW}
            emissiveIntensity={2.6}
            transparent
            opacity={0.92}
            depthWrite={false}
            side={2}
          />
        </mesh>
        <mesh>
          <ringGeometry
            args={[
              INCINERATION_RUNE_BAND_OUTER,
              INCINERATION_RUNE_BAND_OUTER + INCINERATION_RUNE_RIM_LINE_WIDTH,
              48,
            ]}
          />
          <meshStandardMaterial
            ref={outerRimMatRef}
            color={INCINERATION_FIRE_DEEP}
            emissive={INCINERATION_FIRE_CORE}
            emissiveIntensity={2.4}
            transparent
            opacity={0.95}
            depthWrite={false}
            side={2}
          />
        </mesh>
      </group>
    </group>
  );
}
