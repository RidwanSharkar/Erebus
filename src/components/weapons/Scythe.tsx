import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Color } from '@/utils/three-exports';
import { WeaponSubclass } from '@/components/dragon/weapons';
import ScytheHandleTrail from '@/components/weapons/ScytheHandleTrail';
import ScytheItemMeshVisual, {
  resolveScytheAspectKey,
  SCYTHE_ITEM_LOCAL_BY_ASPECT,
} from '@/components/weapons/ScytheItemMeshVisual';
import {
  getEntropicBoltTalentVariantFromTalentLoadout,
  type EntropicBoltTalentVariant,
  type TalentLoadout,
} from '@/utils/talents';
import { resolveScytheAspectTrailColor, type WeaponAspect } from '@/utils/weaponAspects';

const SCYTHE_TRAIL_TALENT_COLORS: Record<EntropicBoltTalentVariant, string> = {
  wrathful: '#ef4444',
  staggering: '#3b82f6',
  infesting: '#22c55e',
  arctic: '#84C8D1',
};

interface ScytheProps {
  parentRef: React.RefObject<Group>;
  currentSubclass?: WeaponSubclass;
  level?: number;
  isEmpowered?: boolean;
  isSpinning?: boolean;
  talentLoadout?: TalentLoadout | null;
  isCrossentropyCharging?: boolean;
  /** Throne weapon aspect — Archmage / Necromancer / Draconic GLB. */
  weaponAspect?: WeaponAspect;
}

export default function Scythe({
  currentSubclass = WeaponSubclass.CHAOS,
  level = 1,
  isEmpowered = false,
  isSpinning = false,
  talentLoadout = null,
  isCrossentropyCharging = false,
  weaponAspect,
}: ScytheProps) {
  useEffect(() => {
    if (isEmpowered) {
      // console.log('[Scythe] Legion empowerment activated - showing green trails');
    }
  }, [isEmpowered]);

  useEffect(() => {
    if (isSpinning) {
      // console.log('[Scythe] Spinning animation started');
    }
  }, [isSpinning]);

  const containerRef = useRef<Group>(null);
  const scytheRef = useRef<Group>(null);
  const handleTopRef = useRef<Group>(null);
  const handleBottomRef = useRef<Group>(null);
  const spinTime = useRef(0);

  const basePosition = [-0.8, 0.75, 0.4] as const;
  const aspectKey = resolveScytheAspectKey(weaponAspect);
  const local = SCYTHE_ITEM_LOCAL_BY_ASPECT[aspectKey];

  const entropicVariant = getEntropicBoltTalentVariantFromTalentLoadout(talentLoadout);
  const trailColorHex =
    isCrossentropyCharging
      ? resolveScytheAspectTrailColor(weaponAspect)
      : entropicVariant
        ? SCYTHE_TRAIL_TALENT_COLORS[entropicVariant]
        : resolveScytheAspectTrailColor(weaponAspect);
  const trailColor = useMemo(() => new Color(trailColorHex), [trailColorHex]);

  useFrame((_, delta) => {
    if (!scytheRef.current) return;

    if (isSpinning) {
      // Continuously accumulate spin time for smooth rotation
      spinTime.current += delta;

      // Spin the scythe around its center
      const spinSpeed = 19; // Adjust speed as needed
      const currentRotation = spinTime.current * spinSpeed;

      // Position scythe in front of dragon for spinning
      scytheRef.current.position.set(0, 0.925, 1.5);

      // Rotate the scythe around its handle (Z-axis rotation for spinning)
      scytheRef.current.rotation.set(Math.PI / 8, 0, currentRotation);
    } else {
      // Reset spin time when not spinning
      spinTime.current = 0;

      // Return to base position when not spinning
      const easeFactor = 0.85;
      scytheRef.current.rotation.x *= easeFactor;
      scytheRef.current.rotation.y *= easeFactor;
      scytheRef.current.rotation.z *= easeFactor;

      scytheRef.current.position.x += (basePosition[0] - scytheRef.current.position.x) * 0.14;
      scytheRef.current.position.y += (basePosition[1] - scytheRef.current.position.y) * 0.14;
      scytheRef.current.position.z += (basePosition[2] - scytheRef.current.position.z) * 0.025;
    }
  });

  return (
    <group ref={containerRef}>
      <group
        ref={scytheRef}
        position={[basePosition[0], basePosition[1], basePosition[2]]}
        rotation={[0, 0, Math.PI]}
        scale={[0.45, 0.8, 0.55]}
      >
        {/* Handle orientation matches former procedural scythe handle group. */}
        <group
          key={weaponAspect ?? 'ARCHMAGE'}
          rotation={[0, 0, Math.PI + 0.3]}
        >
          <ScytheItemMeshVisual aspect={weaponAspect} isEmpowered={isEmpowered} />
          <group
            ref={handleTopRef}
            position={[
              local.trailAnchorTop[0],
              local.trailAnchorTop[1],
              local.trailAnchorTop[2],
            ]}
          />
          <group
            ref={handleBottomRef}
            position={[
              local.trailAnchorBottom[0],
              local.trailAnchorBottom[1],
              local.trailAnchorBottom[2],
            ]}
          />
        </group>
      </group>
      <ScytheHandleTrail anchorRef={handleTopRef} parentRef={containerRef} color={trailColor} />
      <ScytheHandleTrail anchorRef={handleBottomRef} parentRef={containerRef} color={trailColor} />
    </group>
  );
}
