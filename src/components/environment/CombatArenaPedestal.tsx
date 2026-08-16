import React, { useEffect, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { AdditiveBlending, TextureLoader } from '@/utils/three-exports';
import { useDynamicLight, PooledEffectLight } from '@/components/effects/DynamicLightPool';
import {
  PEDESTAL_BRICK_TEXTURE_PATH,
  PEDESTAL_BRICK_STONE_PROPS,
  PEDESTAL_BRICK_ARCHETYPE_STONE_PROPS,
  configurePedestalBrickTexture,
} from '@/utils/pedestalBrickTexture';
import type { CoopPortalKind } from './ThroneRoom';
import { MAIN_COMBAT_PEDESTAL_POSITION } from './ThroneRoom';

const CAMP_ORB_COLOR: Record<CoopPortalKind, string> = {
  purple: '#B18BFF',
  blue:   '#3b82f6',
  red:    '#ef4444',
  green:  '#22c55e',
  stat: '#f97316',
  trial: '#eab308',
  merchant: '#ec4899',
  boss: '#8b5cf6',
};

/** Shared stone cylinder + cap used by combat boon pedestals and throne archetype pedestals. */
export function ArenaRewardPedestalBase({
  position = [0, 0, 0],
  glowColor,
  glowIntensity = 1,
  stoneFinish = 'default',
}: {
  position?: [number, number, number];
  /** When set, paints an additive disc on the cap and a short-range point light. */
  glowColor?: string;
  /** 0–1 multiplier for disc / emissive / cap light (selected vs idle). */
  glowIntensity?: number;
  /** `archetype` uses a slightly duller brick response than weapon/combat pedestals. */
  stoneFinish?: 'default' | 'archetype';
}) {
  const g = Math.max(0, Math.min(1, glowIntensity));
  const brickTexture = useLoader(TextureLoader, PEDESTAL_BRICK_TEXTURE_PATH);
  const stoneProps =
    stoneFinish === 'archetype'
      ? PEDESTAL_BRICK_ARCHETYPE_STONE_PROPS
      : PEDESTAL_BRICK_STONE_PROPS;

  useEffect(() => {
    configurePedestalBrickTexture(brickTexture);
  }, [brickTexture]);

  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.65, 1.75, 12]} />
        <meshStandardMaterial
          map={brickTexture}
          emissiveMap={brickTexture}
          color={stoneProps.color}
          roughness={stoneProps.roughness}
          metalness={stoneProps.metalness}
          emissive={stoneProps.emissive}
          emissiveIntensity={stoneProps.emissiveIntensity}
        />
      </mesh>
      <mesh position={[0, 0.99, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.45, 0.24, 12]} />
        <meshStandardMaterial
          map={brickTexture}
          // Colored cap glow stays unmapped so selection tint isn’t crushed by dark brick.
          {...(glowColor
            ? {
                emissive: glowColor,
                emissiveIntensity: 0.28 * g,
              }
            : {
                emissiveMap: brickTexture,
                emissive: stoneProps.emissive,
                emissiveIntensity: stoneProps.emissiveIntensity,
              })}
          color={stoneProps.color}
          roughness={stoneProps.roughness}
          metalness={stoneProps.metalness}
        />
      </mesh>
      {glowColor && g > 0.01 ? (
        <>
          {/* Flat additive disc — reads as colored cap even under dim throne ambient */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.12, 0]}>
            <circleGeometry args={[0.48, 24]} />
            <meshBasicMaterial
              color={glowColor}
              transparent
              opacity={0.28 * g}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 1.115, 0]}>
            <ringGeometry args={[0.42, 0.52, 32]} />
            <meshBasicMaterial
              color={glowColor}
              transparent
              opacity={0.18 * g}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
          <PooledEffectLight
            color={glowColor}
            intensity={0.75 * g}
            distance={2.2}
            decay={2}
            position={[0, 1.05, 0]}
          />
        </>
      ) : null}
    </group>
  );
}

interface CombatArenaPedestalProps {
  campType: CoopPortalKind;
  showAura: boolean;
  position?: [number, number, number];
}

export default function CombatArenaPedestal({
  campType,
  showAura,
  position = [
    MAIN_COMBAT_PEDESTAL_POSITION.x,
    MAIN_COMBAT_PEDESTAL_POSITION.y,
    MAIN_COMBAT_PEDESTAL_POSITION.z,
  ],
}: CombatArenaPedestalProps) {
  const orbRef       = useRef<any>(null);
  const aura1Ref     = useRef<any>(null);
  const aura2Ref     = useRef<any>(null);

  const color = CAMP_ORB_COLOR[campType];
  const [px, py, pz] = position;
  const auraLight = useDynamicLight({ color, distance: 12, priority: 1 });

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Orb gentle float + spin
    if (orbRef.current) {
      orbRef.current.position.y = 1.85 + Math.sin(t * 1.4) * 0.1;
      orbRef.current.rotation.y = t * 0.9;
    }

    const aura = auraLight.current;
    if (aura?.active) {
      if (showAura) {
        aura.setPosition(px, py + 0.3, pz);
        aura.setIntensity(1.2 + Math.sin(t * 2.5) * 0.6);
      } else {
        aura.setIntensity(0);
      }
    }

    if (!showAura) return;

    // Aura ring 1: expand + fade
    if (aura1Ref.current) {
      const cycle = (t * 0.6) % 1;
      const s = 0.6 + cycle * 2.8;
      aura1Ref.current.scale.set(s, 1, s);
      const m = aura1Ref.current.material;
      m.opacity = (1 - cycle) * 0.55;
    }

    // Aura ring 2: same but half phase offset
    if (aura2Ref.current) {
      const cycle = ((t * 0.6) + 0.5) % 1;
      const s = 0.6 + cycle * 2.8;
      aura2Ref.current.scale.set(s, 1, s);
      const m = aura2Ref.current.material;
      m.opacity = (1 - cycle) * 0.55;
    }
  });

  return (
    <group position={position}>
      <ArenaRewardPedestalBase />

      {/* --- Colored orb --- */}
      <group ref={orbRef} position={[0, 1.85, 0]}>
        <mesh>
          <sphereGeometry args={[0.32, 20, 20]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.88}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
        {/* Inner bright core */}
        <mesh>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.6} depthWrite={false} blending={AdditiveBlending} />
        </mesh>
        <PooledEffectLight color={color} intensity={1.4} distance={8} position={[0, 0, 0]} />
      </group>

      {/* --- Ground aura (only when showAura) --- */}
      {showAura && (
        <>
          {/* Expanding ring 1 */}
          <mesh ref={aura1Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
            <ringGeometry args={[0.55, 0.75, 48]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.5}
              depthWrite={false}
              blending={AdditiveBlending}
              side={2}
            />
          </mesh>

          {/* Expanding ring 2 (phase-offset) */}
          <mesh ref={aura2Ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
            <ringGeometry args={[0.55, 0.75, 48]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.5}
              depthWrite={false}
              blending={AdditiveBlending}
              side={2}
            />
          </mesh>

          {/* Soft ground glow disc */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
            <circleGeometry args={[1.4, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.12}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </>
      )}
    </group>
  );
}
