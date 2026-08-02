'use client';

import { useMemo, type Ref } from 'react';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import { Group, Shape, DoubleSide } from '@/utils/three-exports';
import { Color } from 'three';

export const SPEAR_GOLD = new Color(0xE8CD57);
export const SPEAR_GOLD_HEX = '#E8CD57';

/** Blade theme for Crusader (orange) / Titan's Grip (red) — same priority as Runeblade sword. */
export type SpearBladeTheme = 'default' | 'crusader' | 'titans-grip';

export interface SpearMeshVisualProps {
  /** Optional — Spear passes this for its idle inner-blade spin; Royal Guard omits it. */
  innerBladeRef?: Ref<Group>;
  /** Extra emissive intensity from throw/whirlwind charge (0 for Royal Guard). */
  emissiveBoost?: number;
  /** Crusader / Titan's Grip talent blade tint. Default = spear gold. */
  bladeTheme?: SpearBladeTheme;
}

interface SpearPalette {
  primary: Color;
  primaryHex: string;
  emissive: Color;
  innerCore: Color;
}

const DEFAULT_SPEAR_PALETTE: SpearPalette = {
  primary: SPEAR_GOLD,
  primaryHex: SPEAR_GOLD_HEX,
  emissive: new Color(0xe8cd57),
  innerCore: new Color(0xc0c0c0),
};

/** Matches Runeblade Crusader / Corrupted Aura orange. */
const CRUSADER_SPEAR_PALETTE: SpearPalette = {
  primary: new Color('#ffaa00'),
  primaryHex: '#ffaa00',
  emissive: new Color('#ff8800'),
  innerCore: new Color('#ffcc88'),
};

/** Matches Runeblade Titan's Grip red. */
const TITANS_GRIP_SPEAR_PALETTE: SpearPalette = {
  primary: new Color('#B51010'),
  primaryHex: '#B51010',
  emissive: new Color('#cc2222'),
  innerCore: new Color('#EE6666'),
};

function spearPaletteForTheme(theme: SpearBladeTheme): SpearPalette {
  if (theme === 'crusader') return CRUSADER_SPEAR_PALETTE;
  if (theme === 'titans-grip') return TITANS_GRIP_SPEAR_PALETTE;
  return DEFAULT_SPEAR_PALETTE;
}

/**
 * Shared spear geometry (shaft, guard orb, triple blade heads, inner blade).
 * Used by Spear.tsx (with animations) and Runeblade Royal Guard (mesh only).
 */
export default function SpearMeshVisual({
  innerBladeRef,
  emissiveBoost = 0,
  bladeTheme = 'default',
}: SpearMeshVisualProps) {
  const palette = useMemo(() => spearPaletteForTheme(bladeTheme), [bladeTheme]);

  const bladeShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.4, -0.130);
    shape.bezierCurveTo(0.6, 0.2, 1.33, 0.5, 1.65, 1.515);
    shape.lineTo(1.125, 0.75);
    shape.bezierCurveTo(0.45, 0.2, 0.225, 0.0, 0.1, 0.7);
    shape.lineTo(0, 0);
    return shape;
  }, []);

  const innerBladeShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0, 0.06);
    shape.lineTo(0.15, 0.15);
    shape.quadraticCurveTo(1.2, 0.12, 1.5, 0.15);
    shape.quadraticCurveTo(2.0, 0.08, 2.15, 0);
    shape.quadraticCurveTo(2.0, -0.08, 1.5, -0.15);
    shape.quadraticCurveTo(1.2, -0.12, 0.15, -0.15);
    shape.lineTo(0, -0.05);
    shape.lineTo(0, 0);
    return shape;
  }, []);

  const bladeExtrudeSettings = useMemo(
    () => ({
      steps: 2,
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.02,
      bevelOffset: 0.04,
      bevelSegments: 2,
    }),
    [],
  );

  const innerBladeExtrudeSettings = useMemo(
    () => ({
      ...bladeExtrudeSettings,
      depth: 0.06,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelOffset: 0,
      bevelSegments: 6,
    }),
    [bladeExtrudeSettings],
  );

  return (
    <>
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
      </group>

      <group position={[-0.025, 0.35, 0.35]} rotation={[Math.PI, 1, Math.PI]}>
        <mesh>
          <torusGeometry args={[0.185, 0.07, 16, 32]} />
          <meshStandardMaterial color="#4a5b6c" metalness={0.9} roughness={0.1} />
        </mesh>

        {[...Array(8)].map((_, i) => (
          <mesh
            key={`spike-${i}`}
            position={[0.25 * Math.cos((i * Math.PI) / 4), 0.25 * Math.sin((i * Math.PI) / 4), 0]}
            rotation={[0, 0, (i * Math.PI) / 4 - Math.PI / 4]}
          >
            <coneGeometry args={[0.0625, 0.25, 3]} />
            <meshStandardMaterial color="#4a5b6c" metalness={0.9} roughness={0.1} />
          </mesh>
        ))}

        <mesh>
          <sphereGeometry args={[0.155, 16, 16]} />
          <meshStandardMaterial
            color={palette.primary}
            emissive={palette.emissive}
            emissiveIntensity={1 + emissiveBoost * 20}
            transparent
            opacity={1}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial
            color={palette.primary}
            emissive={palette.primary}
            emissiveIntensity={40 + emissiveBoost * 60}
            transparent
            opacity={0.8}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.145, 16, 16]} />
          <meshStandardMaterial
            color={palette.primary}
            emissive={palette.primary}
            emissiveIntensity={35 + emissiveBoost * 50}
            transparent
            opacity={0.6}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.175, 16, 16]} />
          <meshStandardMaterial
            color={palette.primary}
            emissive={palette.primary}
            emissiveIntensity={30 + emissiveBoost * 40}
            transparent
            opacity={0.4}
          />
        </mesh>

        <PooledEffectLight
          color={palette.primary}
          intensity={2 + emissiveBoost * 15}
          distance={0.5}
          decay={2}
        />
      </group>

      <group position={[0, 0.55, 0.35]}>
        <group rotation={[0, 0, 0]}>
          <group rotation={[0, 0, 0.7]} scale={[0.4, 0.4, -0.4]}>
            <mesh>
              <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
              <meshStandardMaterial
                color={palette.primaryHex}
                emissive={palette.emissive}
                emissiveIntensity={1.55}
                metalness={0.8}
                roughness={0.1}
                opacity={0.8}
                transparent
                side={DoubleSide}
              />
            </mesh>
          </group>
        </group>

        <group rotation={[0, (2 * Math.PI) / 3, Math.PI / 2]}>
          <group rotation={[0, 0, 5.33]} scale={[0.4, 0.4, -0.4]}>
            <mesh>
              <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
              <meshStandardMaterial
                color={palette.primaryHex}
                emissive={palette.emissive}
                emissiveIntensity={1.55}
                metalness={0.8}
                roughness={0.1}
                opacity={0.8}
                transparent
                side={DoubleSide}
              />
            </mesh>
          </group>
        </group>

        <group rotation={[0, (4 * Math.PI) / 3, Math.PI / 2]}>
          <group rotation={[0, 0, 5.33]} scale={[0.4, 0.4, -0.4]}>
            <mesh>
              <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
              <meshStandardMaterial
                color={palette.primaryHex}
                emissive={palette.emissive}
                emissiveIntensity={1.55}
                metalness={0.8}
                roughness={0.1}
                opacity={0.8}
                transparent
                side={DoubleSide}
              />
            </mesh>
          </group>
        </group>
      </group>

      <group
        ref={innerBladeRef}
        position={[0, 0.475, 0.35]}
        rotation={[0, -Math.PI / 6, Math.PI / 2]}
        scale={[0.725, 0.5125, 0.75]}
      >
        <mesh>
          <extrudeGeometry args={[innerBladeShape, bladeExtrudeSettings]} />
          <meshStandardMaterial
            color={palette.primary}
            emissive={palette.primary}
            emissiveIntensity={1.25}
            metalness={0.3}
            roughness={0.1}
          />
        </mesh>

        <mesh>
          <extrudeGeometry args={[innerBladeShape, innerBladeExtrudeSettings]} />
          <meshStandardMaterial
            color={palette.innerCore}
            emissive={palette.innerCore}
            emissiveIntensity={1.25}
            metalness={0.2}
            roughness={0.1}
            opacity={0.8}
            transparent
          />
        </mesh>
      </group>
    </>
  );
}
