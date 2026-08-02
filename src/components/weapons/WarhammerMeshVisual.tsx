'use client';

import { useMemo } from 'react';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import { Color } from 'three';

/** Deathdealer yellow/gold palette (matches former Runeblade Deathdealer sword colors). */
export const DEATHDEALER_GOLD = new Color(0xeab308);
export const DEATHDEALER_GOLD_HEX = '#eab308';
export const DEATHDEALER_GOLD_BRIGHT = new Color(0xfde047);
export const DEATHDEALER_GOLD_EMISSIVE = new Color(0xca8a04);
export const DEATHDEALER_STAR = new Color(0xfff7cc);
export const DEATHDEALER_METAL = '#8B6914';
export const DEATHDEALER_METAL_DARK = '#5c4a12';

/** Blade theme for Crusader (orange) / Titan's Grip (red) — same priority as Runeblade sword. */
export type WarhammerBladeTheme = 'default' | 'crusader' | 'titans-grip';

export interface WarhammerMeshVisualProps {
  /** Crusader / Titan's Grip talent blade tint. Default = Deathdealer yellow. */
  bladeTheme?: WarhammerBladeTheme;
}

interface WarhammerPalette {
  gold: Color;
  goldBright: Color;
  goldEmissive: Color;
  star: Color;
  metal: string;
  metalDark: string;
}

const DEFAULT_PALETTE: WarhammerPalette = {
  gold: DEATHDEALER_GOLD,
  goldBright: DEATHDEALER_GOLD_BRIGHT,
  goldEmissive: DEATHDEALER_GOLD_EMISSIVE,
  star: DEATHDEALER_STAR,
  metal: DEATHDEALER_METAL,
  metalDark: DEATHDEALER_METAL_DARK,
};

/** Matches Runeblade Crusader / Corrupted Aura orange. */
const CRUSADER_PALETTE: WarhammerPalette = {
  gold: new Color('#ffaa00'),
  goldBright: new Color('#ffcc44'),
  goldEmissive: new Color('#ff8800'),
  star: new Color('#ffe8b0'),
  metal: '#8B5A14',
  metalDark: '#5c3a12',
};

/** Matches Runeblade Titan's Grip red. */
const TITANS_GRIP_PALETTE: WarhammerPalette = {
  gold: new Color('#B51010'),
  goldBright: new Color('#EE6666'),
  goldEmissive: new Color('#cc2222'),
  star: new Color('#ffcccc'),
  metal: '#6B1A1A',
  metalDark: '#3c0a0a',
};

function paletteForTheme(theme: WarhammerBladeTheme): WarhammerPalette {
  if (theme === 'crusader') return CRUSADER_PALETTE;
  if (theme === 'titans-grip') return TITANS_GRIP_PALETTE;
  return DEFAULT_PALETTE;
}

/**
 * Deathdealer warhammer geometry — spear-length shaft + crystalline maul head.
 * Used by Runeblade Deathdealer aspect (mesh only; animations stay on runebladeRef).
 * Shaft layout mirrors SpearMeshVisual for consistent grip/scale under the same mount.
 */
export default function WarhammerMeshVisual({
  bladeTheme = 'default',
}: WarhammerMeshVisualProps) {
  const p = useMemo(() => paletteForTheme(bladeTheme), [bladeTheme]);

  return (
    <>
      {/* Shaft — same origin/dimensions as SpearMeshVisual handle */}
      <group position={[-0.025, -0.55, 0.35]} rotation={[0, 0, -Math.PI]}>
        <mesh>
          <cylinderGeometry args={[0.03, 0.04, 2.2, 12]} />
          <meshStandardMaterial color="#2a3b4c" roughness={0.7} />
        </mesh>

        {[...Array(12)].map((_, i) => (
          <mesh key={i} position={[0, 1.0 - i * 0.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.045, 0.016, 8, 16]} />
            <meshStandardMaterial color="#1a2b3c" metalness={0.6} roughness={0.4} />
          </mesh>
        ))}

        {/* Pommel at bottom of shaft (local +Y after -PI Z rotation = world-down end) */}
        <group position={[0, 1.15, 0]}>
          <mesh>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial
              color={p.metal}
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
          {/* Pommel gem accents */}
          {[0, 1, 2, 3].map((i) => (
            <mesh
              key={`pommel-gem-${i}`}
              position={[
                0.07 * Math.cos((i * Math.PI) / 2),
                0,
                0.07 * Math.sin((i * Math.PI) / 2),
              ]}
            >
              <sphereGeometry args={[0.02, 8, 8]} />
              <meshStandardMaterial
                color={p.goldBright}
                emissive={p.gold}
                emissiveIntensity={2.5}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* Flared collar / socket at top of shaft */}
      <group position={[-0.025, 0.52, 0.35]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.045, 0.14, 12]} />
          <meshStandardMaterial
            color={p.metal}
            metalness={0.9}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.1, 0.08, 0.06, 12]} />
          <meshStandardMaterial
            color={p.metalDark}
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
        {/* Crystal neck inset */}
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.035, 0.04, 0.08, 8]} />
          <meshStandardMaterial
            color={p.goldBright}
            emissive={p.goldEmissive}
            emissiveIntensity={1.8}
            transparent
            opacity={0.85}
          />
        </mesh>
      </group>

      {/* Crystalline maul head — rotated 90° so strike faces sit on the sides */}
      <group position={[-0.025, 0.975, 0.35]} rotation={[0, Math.PI / 2, Math.PI / 2]} scale={[1, 2.5, 1]}>
        {/* Outer translucent crystal block */}
        <mesh>
          <boxGeometry args={[0.42, 0.55, 0.32]} />
          <meshStandardMaterial
            color={p.goldBright}
            emissive={p.goldEmissive}
            emissiveIntensity={1.2}
            metalness={0.15}
            roughness={0.15}
            transparent
            opacity={0.72}
          />
        </mesh>

        {/* Brighter inner core */}
        <mesh>
          <boxGeometry args={[0.28, 0.42, 0.2]} />
          <meshStandardMaterial
            color={p.gold}
            emissive={p.gold}
            emissiveIntensity={2.8}
            metalness={0.1}
            roughness={0.1}
            transparent
            opacity={0.9}
          />
        </mesh>

        {/* Jagged top crystal facets */}
        <mesh position={[0, 0.3, 0]} rotation={[0, 0.3, 0]}>
          <coneGeometry args={[0.12, 0.14, 5]} />
          <meshStandardMaterial
            color={p.goldBright}
            emissive={p.goldEmissive}
            emissiveIntensity={1.5}
            transparent
            opacity={0.8}
          />
        </mesh>
        <mesh position={[0.08, 0.28, 0.05]} rotation={[0.2, -0.4, 0.15]} scale={[0.7, 0.7, 0.7]}>
          <coneGeometry args={[0.08, 0.12, 4]} />
          <meshStandardMaterial
            color={p.gold}
            emissive={p.goldEmissive}
            emissiveIntensity={1.2}
            transparent
            opacity={0.75}
          />
        </mesh>
        <mesh position={[-0.07, 0.27, -0.04]} rotation={[-0.15, 0.5, -0.1]} scale={[0.65, 0.65, 0.65]}>
          <coneGeometry args={[0.07, 0.11, 4]} />
          <meshStandardMaterial
            color={p.goldBright}
            emissive={p.goldEmissive}
            emissiveIntensity={1.2}
            transparent
            opacity={0.75}
          />
        </mesh>

        {/* Upper metal band */}
        <group position={[0, 0.18, 0]}>
          <mesh>
            <boxGeometry args={[0.46, 0.09, 0.36]} />
            <meshStandardMaterial
              color={p.metal}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          {/* Band gems (front/back) */}
          <mesh position={[0, 0, 0.19]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial
              color={p.goldBright}
              emissive={p.gold}
              emissiveIntensity={3}
            />
          </mesh>
          <mesh position={[0, 0, -0.19]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial
              color={p.goldBright}
              emissive={p.gold}
              emissiveIntensity={3}
            />
          </mesh>
          {/* Corner spikes on upper band */}
          {[
            [0.22, 0.04, 0.16],
            [-0.22, 0.04, 0.16],
            [0.22, 0.04, -0.16],
            [-0.22, 0.04, -0.16],
          ].map(([x, y, z], i) => (
            <mesh
              key={`upper-spike-${i}`}
              position={[x, y, z]}
              rotation={[0, 0, x! > 0 ? -0.4 : 0.4]}
            >
              <coneGeometry args={[0.035, 0.1, 4]} />
              <meshStandardMaterial
                color={p.metalDark}
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>

        {/* Lower metal band */}
        <group position={[0, -0.18, 0]}>
          <mesh>
            <boxGeometry args={[0.46, 0.09, 0.36]} />
            <meshStandardMaterial
              color={p.metal}
              metalness={0.9}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, 0, 0.19]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial
              color={p.goldBright}
              emissive={p.gold}
              emissiveIntensity={3}
            />
          </mesh>
          <mesh position={[0, 0, -0.19]}>
            <sphereGeometry args={[0.035, 10, 10]} />
            <meshStandardMaterial
              color={p.goldBright}
              emissive={p.gold}
              emissiveIntensity={3}
            />
          </mesh>
          {[
            [0.22, -0.04, 0.16],
            [-0.22, -0.04, 0.16],
            [0.22, -0.04, -0.16],
            [-0.22, -0.04, -0.16],
          ].map(([x, y, z], i) => (
            <mesh
              key={`lower-spike-${i}`}
              position={[x, y, z]}
              rotation={[0, 0, x! > 0 ? -0.4 : 0.4]}
            >
              <coneGeometry args={[0.035, 0.1, 4]} />
              <meshStandardMaterial
                color={p.metalDark}
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
          ))}
        </group>

        {/* Four-pointed star emblem on front face */}
        <group position={[0, 0, 0.165]}>
          <mesh>
            <boxGeometry args={[0.14, 0.028, 0.02]} />
            <meshStandardMaterial
              color={p.star}
              emissive={p.star}
              emissiveIntensity={4}
            />
          </mesh>
          <mesh>
            <boxGeometry args={[0.028, 0.14, 0.02]} />
            <meshStandardMaterial
              color={p.star}
              emissive={p.star}
              emissiveIntensity={4}
            />
          </mesh>
          {/* Thin circle ring around star */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.09, 0.008, 8, 24]} />
            <meshStandardMaterial
              color={p.star}
              emissive={p.star}
              emissiveIntensity={3}
            />
          </mesh>
        </group>

        {/* Matching star on back face */}
        <group position={[0, 0, -0.165]} rotation={[0, Math.PI, 0]}>
          <mesh>
            <boxGeometry args={[0.14, 0.028, 0.02]} />
            <meshStandardMaterial
              color={p.star}
              emissive={p.star}
              emissiveIntensity={4}
            />
          </mesh>
          <mesh>
            <boxGeometry args={[0.028, 0.14, 0.02]} />
            <meshStandardMaterial
              color={p.star}
              emissive={p.star}
              emissiveIntensity={4}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.09, 0.008, 8, 24]} />
            <meshStandardMaterial
              color={p.star}
              emissive={p.star}
              emissiveIntensity={3}
            />
          </mesh>
        </group>

        <PooledEffectLight
          color={p.gold}
          intensity={2.2}
          distance={0.65}
          decay={2}
        />
      </group>
    </>
  );
}
