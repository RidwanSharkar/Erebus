'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PointLight, Mesh, Color } from '@/utils/three-exports';

// ─── Per-type palette ──────────────────────────────────────────────────────
export const CAMP_TYPE_COLORS: Record<string, { beacon: string; torch: string; emissive: string }> = {
  blue:   { beacon: '#1133ff', torch: '#3366ff', emissive: '#2244ff' },
  green:  { beacon: '#11bb33', torch: '#33dd55', emissive: '#22cc44' },
  red:    { beacon: '#ff1111', torch: '#ff4422', emissive: '#dd1122' },
  purple: { beacon: '#8811ee', torch: '#aa33ff', emissive: '#9922dd' },
};

// ─── Per-camp torch positions (world space, y = torch height) ─────────────
// 5 positions per camp: 1 central beacon + 4 corner torches.
const CAMP_TORCH_OFFSETS: [number, number, number][] = [
  [  0, 4,   0 ], // central beacon
  [ -5, 2.5, -4 ], // corner 1
  [  5, 2.5, -4 ], // corner 2
  [ -5, 2.5,  4 ], // corner 3
  [  5, 2.5,  4 ], // corner 4
];

const CAMP_CENTERS: [number, number, number][] = [
  [  0, 0, -22 ], // Camp 0 — North Fortress
  [ 22, 0,   8 ], // Camp 1 — East Bastion
  [-22, 0,   8 ], // Camp 2 — West Citadel
];

// ─── Single pulsing torch / beacon light ──────────────────────────────────
function CampTorchLight({
  localPos,
  color,
  baseIntensity,
  distance,
  phaseOffset,
}: {
  localPos: [number, number, number];
  color: string;
  baseIntensity: number;
  distance: number;
  phaseOffset: number;
}) {
  const lightRef = useRef<PointLight>(null);

  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.elapsedTime + phaseOffset;
    // Irregular flicker: combine two sine waves at coprime frequencies
    const flicker = 0.82 + Math.sin(t * 2.3) * 0.1 + Math.sin(t * 5.7 + 1.1) * 0.08;
    lightRef.current.intensity = baseIntensity * flicker;
  });

  return (
    <pointLight
      ref={lightRef}
      position={localPos}
      color={new Color(color)}
      intensity={baseIntensity}
      distance={distance}
      decay={1.6}
      castShadow={false}
    />
  );
}

// ─── Glowing orb mesh — visible even on shader-material ground ────────────
function CampBeaconOrb({
  color,
  phaseOffset,
}: {
  color: string;
  phaseOffset: number;
}) {
  const meshRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.elapsedTime + phaseOffset;
    const pulse = 0.75 + Math.sin(t * 1.5) * 0.25;
    (meshRef.current.material as any).emissiveIntensity = 2.5 * pulse;
    const sc = 0.55 + Math.sin(t * 1.5) * 0.1;
    meshRef.current.scale.setScalar(sc);
  });

  return (
    // Positioned at the beacon height so it floats above the camp center
    <mesh ref={meshRef} position={[0, 5, 0]}>
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2.5}
        transparent
        opacity={0.85}
        roughness={0}
        metalness={0}
      />
    </mesh>
  );
}

// ─── One full camp light rig ───────────────────────────────────────────────
function CampLightRig({
  center,
  campType,
  campIndex,
}: {
  center: [number, number, number];
  campType: string;
  campIndex: number;
}) {
  const palette = CAMP_TYPE_COLORS[campType];
  if (!palette) return null;

  return (
    <group position={center}>
      {/* Central beacon — very bright, reaches across the entire camp */}
      <CampTorchLight
        localPos={CAMP_TORCH_OFFSETS[0]}
        color={palette.beacon}
        baseIntensity={12}
        distance={32}
        phaseOffset={campIndex * 2.1}
      />

      {/* 4 corner torches — tighter but still punchy */}
      {CAMP_TORCH_OFFSETS.slice(1).map((offset, i) => (
        <CampTorchLight
          key={i}
          localPos={offset}
          color={palette.torch}
          baseIntensity={5}
          distance={16}
          phaseOffset={campIndex * 2.1 + i * 0.7}
        />
      ))}

      {/* Floating glowing orb — emissive mesh visible regardless of shader type */}
      <CampBeaconOrb color={palette.emissive} phaseOffset={campIndex * 2.1} />
    </group>
  );
}

// ─── Public component ──────────────────────────────────────────────────────
interface CampThemeLightsProps {
  campTypes: string[];
}

const CampThemeLights: React.FC<CampThemeLightsProps> = ({ campTypes }) => {
  if (!campTypes || campTypes.length === 0) return null;

  return (
    <>
      {CAMP_CENTERS.map((center, i) => {
        const type = campTypes[i];
        if (!type) return null;
        return (
          <CampLightRig
            key={`camp-rig-${i}`}
            center={center}
            campType={type}
            campIndex={i}
          />
        );
      })}
    </>
  );
};

export default CampThemeLights;
