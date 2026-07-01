import { useMemo, useRef } from 'react';
import { Group, Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { WeaponType } from '@/components/dragon/weapons';

interface AuraPalette {
  outer: string;
  plane: string;
  innerColor: string;
  streamColor: string;
  streamEmissive: string;
  ambient: string;
  glow: string;
}

const ROYAL_DEFAULT: AuraPalette = {
  outer: '#b8b8c8',
  plane: '#e8e8f0',
  innerColor: '#5a5a6a',
  streamColor: '#2a2a3a',
  streamEmissive: '#d4af37',
  ambient: '#c9a227',
  glow: '#d4af37',
};

const WEAPON_PALETTES: Partial<Record<WeaponType, AuraPalette>> = {
  [WeaponType.BOW]: {
    outer: '#22c55e',
    plane: '#fde047',
    innerColor: '#15803d',
    streamColor: '#14532d',
    streamEmissive: '#eab308',
    ambient: '#86efac',
    glow: '#22c55e',
  },
  [WeaponType.SABRES]: {
    outer: '#ef4444',
    plane: '#fb923c',
    innerColor: '#b91c1c',
    streamColor: '#7f1d1d',
    streamEmissive: '#f97316',
    ambient: '#fca5a5',
    glow: '#ef4444',
  },
  [WeaponType.SCYTHE]: {
    outer: '#d8b4fe',
    plane: '#7dd3fc',
    innerColor: '#6b21a8',
    streamColor: '#3b0764',
    streamEmissive: '#38bdf8',
    ambient: '#d8b4fe',
    glow: '#d8b4fe',
  },
  [WeaponType.RUNEBLADE]: {
    outer: '#7dd3fc',
    plane: '#38bdf8',
    innerColor: '#0284c7',
    streamColor: '#0c4a6e',
    streamEmissive: '#38bdf8',
    ambient: '#bae6fd',
    glow: '#7dd3fc',
  },
};

interface ThronePedestalAuraProps {
  weapon: WeaponType;
  equippedWeapon: WeaponType;
  position: [number, number, number];
}

export default function ThronePedestalAura({ weapon, equippedWeapon, position }: ThronePedestalAuraProps) {
  const auraRef = useRef<Group>(null);

  // Animated mesh refs
  const planesRef = useRef<Mesh[]>([]);
  const sigilsRef = useRef<Mesh[]>([]);
  const streamsRef = useRef<Mesh[]>([]);

  const pal = useMemo<AuraPalette>(() => {
    if (equippedWeapon === weapon) {
      return WEAPON_PALETTES[weapon] ?? ROYAL_DEFAULT;
    }
    return ROYAL_DEFAULT;
  }, [equippedWeapon, weapon]);

  const isActive = equippedWeapon === weapon;
  const someOtherEquipped = equippedWeapon !== WeaponType.NONE && !isActive;
  const auraScale = someOtherEquipped ? 0.825 : 1.15;
  const planeAngles = useMemo(() => Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2), []);
  const sigilAngles = useMemo(() => Array.from({ length: 5 }, (_, i) => (i / 5) * Math.PI * 2), []);
  const streamAngles = useMemo(() => Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    if (auraRef.current) {
      auraRef.current.rotation.y += 0.008 * 0.12;
    }

    // Spinning rune planes
    for (let i = 0; i < planesRef.current.length; i++) {
      const m = planesRef.current[i];
      if (!m) continue;
      m.rotation.z = planeAngles[i]! + t * 0.25;
      const mat = m.material as any;
      mat.opacity = 0.4 + Math.sin(t * 3.0 + i) * 0.2;
    }

    // Orbiting sigils
    const sigilRadius = 0.6;
    for (let i = 0; i < sigilsRef.current.length; i++) {
      const m = sigilsRef.current[i];
      if (!m) continue;
      const angle = sigilAngles[i]! + t * 0.25;
      m.position.x = Math.cos(angle) * sigilRadius;
      m.position.z = Math.sin(angle) * sigilRadius;
      const mat = m.material as any;
      mat.opacity = 0.3 + Math.sin(t * 2.0 + i * 0.5) * 0.2;
    }

    // Energy streams
    for (let i = 0; i < streamsRef.current.length; i++) {
      const m = streamsRef.current[i];
      if (!m) continue;
      const angle = streamAngles[i]! + t * 0.18;
      const radius = 0.9 + Math.sin(t * 2.0 + i) * 0.1;
      m.position.x = Math.cos(angle) * radius;
      m.position.z = Math.sin(angle) * radius;
      m.rotation.z = angle + t * 0.15;
      const mat = m.material as any;
      mat.opacity = 0.2 + Math.sin(t * 4.0 + i) * 0.1;
    }
  });

  const [px, py, pz] = position;

  return (
    <group ref={auraRef} position={[px, py + 0.095, pz]} scale={auraScale}>
      {/* Outer ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[1.0, 1.2, 64]} />
        <meshStandardMaterial
          color={pal.outer}
          emissive={pal.outer}
          emissiveIntensity={1.5}
          transparent
          opacity={0.35}
          depthWrite={false}
        />
      </mesh>

      {/* Spinning rune planes */}
      <group position={[0, 0.02, 0]}>
        {planeAngles.map((_, i) => (
          <mesh
            key={i}
            ref={(el) => { if (el) planesRef.current[i] = el; }}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.2, 1.3]} />
            <meshStandardMaterial
              color={pal.plane}
              emissive={pal.plane}
              emissiveIntensity={2}
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Orbiting sigils */}
      <group position={[0, 0.03, 0]}>
        {sigilAngles.map((angle, i) => (
          <mesh
            key={i}
            ref={(el) => { if (el) sigilsRef.current[i] = el; }}
            position={[Math.cos(angle) * 0.6, 0, Math.sin(angle) * 0.6]}
            rotation={[-Math.PI / 2, 0, angle + Math.PI / 2]}
          >
            <planeGeometry args={[0.3, 0.3]} />
            <meshStandardMaterial
              color={pal.innerColor}
              emissive={pal.outer}
              emissiveIntensity={2}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Energy streams */}
      <group position={[0, 0.01, 0]}>
        {streamAngles.map((angle, i) => (
          <mesh
            key={i}
            ref={(el) => { if (el) streamsRef.current[i] = el; }}
            position={[Math.cos(angle) * 0.9, 0, Math.sin(angle) * 0.9]}
            rotation={[-Math.PI / 2, 0, angle]}
          >
            <planeGeometry args={[0.1, 0.4]} />
            <meshStandardMaterial
              color={pal.streamColor}
              emissive={pal.streamEmissive}
              emissiveIntensity={3}
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* Center dark core with emissive glow */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.5, 32]} />
        <meshStandardMaterial
          color="#0a0a14"
          emissive={pal.outer}
          emissiveIntensity={1.25}
          transparent
          opacity={0.45}
          depthWrite={false}
        />
      </mesh>

      {/* Ambient glow ring */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.0, 1.1, 64, 1]} />
        <meshStandardMaterial
          color={pal.ambient}
          emissive={pal.ambient}
          emissiveIntensity={0.4}
          transparent
          opacity={0.6}
          depthWrite={false}
        />
      </mesh>

      {/* Point light for ground bloom */}
      <pointLight color={pal.glow} intensity={isActive ? 1.65 : 0.75} distance={6} position={[0, 0.3, 0]} />
    </group>
  );
}
