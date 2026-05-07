import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending } from '@/utils/three-exports';
import type { CoopPortalKind } from './ThroneRoom';
import { MAIN_COMBAT_PEDESTAL_POSITION } from './ThroneRoom';

const CAMP_ORB_COLOR: Record<CoopPortalKind, string> = {
  purple: '#6c3dff',
  blue:   '#3b82f6',
  red:    '#ef4444',
  green:  '#22c55e',
  stat: '#f97316',
  trial: '#eab308',
  healing: '#ec4899',
  boss: '#8b5cf6',
};

interface CombatArenaPedestalProps {
  campType: CoopPortalKind;
  showAura: boolean;
}

export default function CombatArenaPedestal({ campType, showAura }: CombatArenaPedestalProps) {
  const orbRef       = useRef<any>(null);
  const aura1Ref     = useRef<any>(null);
  const aura2Ref     = useRef<any>(null);
  const auraLightRef = useRef<any>(null);

  const color = CAMP_ORB_COLOR[campType];

  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Orb gentle float + spin
    if (orbRef.current) {
      orbRef.current.position.y = 1.85 + Math.sin(t * 1.4) * 0.1;
      orbRef.current.rotation.y = t * 0.9;
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

    // Pulse the aura point light
    if (auraLightRef.current) {
      auraLightRef.current.intensity = 1.2 + Math.sin(t * 2.5) * 0.6;
    }
  });

  const px = MAIN_COMBAT_PEDESTAL_POSITION.x;
  const py = MAIN_COMBAT_PEDESTAL_POSITION.y;
  const pz = MAIN_COMBAT_PEDESTAL_POSITION.z;

  return (
    <group position={[px, py, pz]}>
      {/* --- Base column --- */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.45, 0.6, 1.3, 12]} />
        <meshStandardMaterial color="#c8c0b4" roughness={0.75} metalness={0.15} />
      </mesh>

      {/* Top cap */}
      <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.45, 0.14, 12]} />
        <meshStandardMaterial color="#b8b0a4" roughness={0.7} metalness={0.2} />
      </mesh>

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
        <pointLight color={color} intensity={1.4} distance={8} position={[0, 0, 0]} />
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

          {/* Aura point light */}
          <pointLight ref={auraLightRef} color={color} intensity={1.8} distance={12} position={[0, 0.3, 0]} />
        </>
      )}
    </group>
  );
}
