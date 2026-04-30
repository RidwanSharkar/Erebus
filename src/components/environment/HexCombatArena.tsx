import React, { useMemo } from 'react';
import { AdditiveBlending, Color } from '@/utils/three-exports';
import CustomSky from './CustomSky';
import AtmosphericParticles from './AtmosphericParticles';
import StylizedGrass from './StylizedGrass';

export const HEX_ARENA_RADIUS = 22;
const HEX_WALL_HEIGHT = 4;
const HEX_WALL_THICKNESS = 0.7;

type HexArenaVariant = 'stat' | 'chaos';

interface HexCombatArenaProps {
  variant: HexArenaVariant;
}

function HexWalls({ variant }: HexCombatArenaProps) {
  const wallColor = variant === 'chaos' ? '#1e293b' : '#6b5b48';
  const emissive = variant === 'chaos' ? '#312e81' : '#3b2412';
  const sideLength = HEX_ARENA_RADIUS;
  const apothem = HEX_ARENA_RADIUS * Math.cos(Math.PI / 6);

  return (
    <group name="hex-castle-walls">
      {Array.from({ length: 6 }).map((_, i) => {
        const angle = (Math.PI / 3) * i;
        const x = Math.cos(angle) * apothem;
        const z = Math.sin(angle) * apothem;
        return (
          <group
            key={`hex-wall-${i}`}
            position={[x, HEX_WALL_HEIGHT / 2, z]}
            rotation={[0, Math.PI / 2 - angle, 0]}
          >
            <mesh castShadow receiveShadow>
              <boxGeometry args={[sideLength, HEX_WALL_HEIGHT, HEX_WALL_THICKNESS]} />
              <meshStandardMaterial
                color={wallColor}
                emissive={emissive}
                emissiveIntensity={variant === 'chaos' ? 0.32 : 0.04}
                roughness={0.85}
                metalness={0.1}
              />
            </mesh>
            {Array.from({ length: 7 }).map((__, merlon) => (
              <mesh
                key={`hex-wall-${i}-merlon-${merlon}`}
                position={[(-sideLength / 2) + merlon * (sideLength / 6), HEX_WALL_HEIGHT / 2 + 0.45, 0]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[0.75, 0.9, HEX_WALL_THICKNESS + 0.08]} />
                <meshStandardMaterial color={wallColor} roughness={0.85} metalness={0.1} />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function HexTileField({ variant }: HexCombatArenaProps) {
  const tiles = useMemo(() => {
    const out: Array<{ x: number; z: number; s: number; c: string }> = [];
    const step = 2.1;
    const apothem = HEX_ARENA_RADIUS * Math.cos(Math.PI / 6) - 1.4;
    for (let x = -18; x <= 18; x += step) {
      for (let z = -18; z <= 18; z += step) {
        let inside = true;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i;
          if (x * Math.cos(a) + z * Math.sin(a) > apothem) {
            inside = false;
            break;
          }
        }
        if (!inside) continue;
        const jitter = ((Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1 + 1) % 1;
        const c = variant === 'chaos'
          ? (jitter > 0.55 ? '#1e293b' : '#334155')
          : (jitter > 0.55 ? '#6b5b48' : '#8a755c');
        out.push({ x, z, s: 1.8 + jitter * 0.25, c });
      }
    }
    return out;
  }, [variant]);

  return (
    <group name="hex-tiled-ground">
      <mesh receiveShadow position={[0, -0.08, 0]}>
        <cylinderGeometry args={[HEX_ARENA_RADIUS, HEX_ARENA_RADIUS, 0.12, 6]} />
        <meshStandardMaterial
          color={variant === 'chaos' ? '#0f172a' : '#5c4b38'}
          roughness={0.95}
          metalness={0.02}
        />
      </mesh>
      {tiles.map((tile, i) => (
        <mesh key={`hex-tile-${i}`} receiveShadow position={[tile.x, 0.005, tile.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <boxGeometry args={[tile.s, tile.s, 0.035]} />
          <meshStandardMaterial color={tile.c} roughness={0.9} metalness={0.04} />
        </mesh>
      ))}
    </group>
  );
}

export default function HexCombatArena({ variant }: HexCombatArenaProps) {
  const accent = variant === 'chaos' ? '#312e81' : '#f97316';
  const particleColor = useMemo(() => new Color(variant === 'chaos' ? '#b91c1c' : '#fb923c'), [variant]);

  return (
    <group name={`${variant}-hex-combat-arena`}>
      <CustomSky roomTheme={variant === 'chaos' ? 'purple' : 'red'} />
      <ambientLight intensity={variant === 'chaos' ? 0.12 : 0.14} />
      <hemisphereLight
        color={accent}
        groundColor={variant === 'chaos' ? '#1e1b2e' : '#08040b'}
        intensity={variant === 'chaos' ? 0.38 : 0.35}
      />
      <directionalLight position={[8, 16, 6]} intensity={variant === 'chaos' ? 0.34 : 0.36} castShadow />
      <pointLight
        position={[0, 5, 0]}
        color={variant === 'chaos' ? '#c4b5fd' : '#fb923c'}
        intensity={variant === 'chaos' ? 0.55 : 0.12}
        distance={45}
        decay={2}
      />
      <HexTileField variant={variant} />
      {variant === 'stat' && (
        <StylizedGrass
          fieldShape="disc"
          radius={HEX_ARENA_RADIUS * 0.82}
          count={900}
          bladeHeight={0.24}
          windStrength={0.1}
          roomTheme="red"
        />
      )}
      <HexWalls variant={variant} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[5.8, 6.15, 6]} />
        <meshBasicMaterial
          color={variant === 'chaos' ? '#7f1d1d' : '#fb923c'}
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <AtmosphericParticles
        position={[0, 0, 0]}
        count={variant === 'chaos' ? 55 : 35}
        radius={14}
        color={`#${particleColor.getHexString()}`}
        speed={variant === 'chaos' ? 0.18 : 0.25}
        size={0.025}
      />
    </group>
  );
}
