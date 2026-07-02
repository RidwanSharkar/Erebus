import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Vector3, Color, SphereGeometry } from 'three';
import { Group, MeshBasicMaterial } from '@/utils/three-exports';
import { WeaponType, WeaponSubclass } from './weapons';
import React from 'react';

const DASH_LINGER_MS = 100; // how long the trail stays visible after dash ends
const TRAIL_SPHERE_GEO = new SphereGeometry(0.475, 16, 16);

function resolveTrailColor(
  isStealthing: boolean,
  fixedTrailColor: string | undefined,
  weaponSubclass: WeaponSubclass | undefined,
  weaponType: WeaponType,
): string {
  // If player is stealthing, use dark grey for all trails
  if (isStealthing) {
    return '#333333'; // Dark grey color for stealth mode
  }

  if (fixedTrailColor) {
    return fixedTrailColor;
  }

  if (weaponSubclass) {
    switch (weaponSubclass) {
      // Scythe subclasses
      case WeaponSubclass.CHAOS:
        return '#8783D1'; // Keep original chaos color
      case WeaponSubclass.ABYSSAL:
        return '#0095FF'; // Purple for abyssal

      // Sword subclasses
      case WeaponSubclass.DIVINITY:
        return '#00C8FF'; // Light blue for divinity
      case WeaponSubclass.VENGEANCE:
        return '#4682B4'; // Steel blue for vengeance

      // Sabres subclasses
      case WeaponSubclass.FROST:
        return '#FF544E'; // Keep original frost color
      case WeaponSubclass.ASSASSIN:
        return '#FF544E'; // Dark purple for assassin

      // Runeblade subclasses
      case WeaponSubclass.ARCANE:
        return '#00B7FF'; // Bright green for arcane
      case WeaponSubclass.NATURE:
        return '#00FF88'; // Darker green for nature

      // Bow subclasses
      case WeaponSubclass.ELEMENTAL:
        return '#17CE54'; // Keep original elemental color
      case WeaponSubclass.VENOM:
        return '#17CC93'; // Green/purple for venom 17CE54

      // Spear subclasses
      case WeaponSubclass.STORM:
        return '#ABAAAA'; // Lighter greyish silver for storm
      case WeaponSubclass.VALOR:
        return '#A8A8A8'; // Darker greyish silver for valor
    }
  }

  // Fallback to weapon type colors
  switch (weaponType) {
    case WeaponType.NONE:
      return '#17CE54';
    case WeaponType.SCYTHE:
      return '#17CE54'; // 39ff14
    case WeaponType.SWORD:
      return '#6DFF9E'; // Light blue for sword
    case WeaponType.SABRES:
      return '#FF544E'; //78DFFF
    case WeaponType.RUNEBLADE:
      return '#00FF88'; // Green for runeblade
    case WeaponType.BOW:
      return '#3A905E'; //D09A1D try
    case WeaponType.SPEAR:
      return '#C0C0C0'; // Greyish silver for spear
  }

  return '#17CE54';
}

interface GhostTrailProps {
  parentRef: React.RefObject<Group>;
  weaponType: WeaponType;
  weaponSubclass?: WeaponSubclass;
  targetPosition?: Vector3; // Optional for multiplayer - if provided, use this instead of parentRef position
  isStealthing?: boolean; // Whether the local player is currently in stealth mode
  isDashingRef?: React.RefObject<boolean>; // Live ref to dashing state; trail only shows while dashing or within linger window
  /** Movement.startCharge (Sword/Runeblade Charge ability) — same trail treatment as regular dash */
  isWeaponChargeMovingRef?: React.RefObject<boolean>;
  isSkyfalling?: boolean; // Divebomb ability — keeps trail visible for the full duration
  yOffset?: number; // Additional Y lift — use when dragon body is hidden (character model)
  /** When set, overrides weapon-based trail color (e.g. enemy blink). */
  fixedTrailColor?: string;
  /** When set, drive visibility from this ref only (e.g. isBlinking); omit to use dash / weapon-charge refs. */
  isTrailMotionRef?: React.RefObject<boolean>;
}

const GhostTrail = React.memo(({ parentRef, weaponType, weaponSubclass, targetPosition, isStealthing = false, isDashingRef, isWeaponChargeMovingRef, isSkyfalling = false, yOffset = 0, fixedTrailColor, isTrailMotionRef }: GhostTrailProps) => {
  const trailsRef = useRef<Mesh[]>([]);
  const ringBuffer = useRef<Vector3[]>([]);
  const writeIndex = useRef(0);
  const sampleScratch = useRef(new Vector3());
  const [isInitialized, setIsInitialized] = useState(false);
  const lastDashEndTime = useRef<number>(-Infinity); // timestamp when dash-like motion last became false
  const wasTrailMotionActive = useRef<boolean>(false);
  const trailCount = 24;

  const trailColorHex = resolveTrailColor(isStealthing, fixedTrailColor, weaponSubclass, weaponType);
  const trailMaterials = useMemo(
    () =>
      Array.from(
        { length: trailCount },
        () =>
          new MeshBasicMaterial({
            color: new Color(trailColorHex),
            transparent: true,
            opacity: 0.3,
            depthWrite: false,
          }),
      ),
    [trailCount],
  );

  useEffect(() => {
    trailMaterials.forEach((mat) => mat.color.set(trailColorHex));
  }, [trailColorHex, trailMaterials]);

  useEffect(() => {
    let initialPos: Vector3;
    if (targetPosition) {
      initialPos = targetPosition.clone();
    } else if (parentRef.current) {
      initialPos = parentRef.current.position.clone();
    } else {
      return;
    }
    ringBuffer.current = Array.from({ length: trailCount }, () => initialPos.clone());
    writeIndex.current = 0;
    setIsInitialized(true);
  }, [parentRef, targetPosition, trailCount]);

  useEffect(() => {
    return () => {
      trailMaterials.forEach((mat) => mat.dispose());
      trailsRef.current = [];
      ringBuffer.current = [];
    };
  }, [trailMaterials]);

  useFrame(() => {
    if (!isInitialized) return;

    const isTrailMotionActive = isTrailMotionRef
      ? (isTrailMotionRef.current ?? false)
      : (isDashingRef ? (isDashingRef.current ?? false) : false) ||
        (isWeaponChargeMovingRef ? (isWeaponChargeMovingRef.current ?? false) : false);
    if (wasTrailMotionActive.current && !isTrailMotionActive) {
      lastDashEndTime.current = Date.now();
    }
    wasTrailMotionActive.current = isTrailMotionActive;
    const withinLinger = Date.now() - lastDashEndTime.current < DASH_LINGER_MS;
    const shouldShow = isTrailMotionActive || withinLinger || isSkyfalling;

    const scratch = sampleScratch.current;
    if (targetPosition) {
      scratch.copy(targetPosition);
    } else if (parentRef.current?.position) {
      scratch.copy(parentRef.current.position);
    } else {
      return;
    }

    scratch.y += -0.1 + yOffset;

    const buffer = ringBuffer.current;
    buffer[writeIndex.current].copy(scratch);
    writeIndex.current = (writeIndex.current + 1) % trailCount;

    trailsRef.current.forEach((trail, i) => {
      const slot = (writeIndex.current - 1 - i + trailCount * 64) % trailCount;
      const pos = buffer[slot];
      if (trail && pos) {
        trail.position.copy(pos);

        const scale = 1 - (i / trailCount) * 0.6;
        trail.scale.setScalar(scale);

        const mat = trailMaterials[i];
        if (mat) {
          mat.opacity = shouldShow ? (1 - i / trailCount) * 0.2 : 0;
        }
      }
    });
  });

  if (!isInitialized) return null;

  return (
    <>
      {Array.from({ length: trailCount }).map((_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            if (el) trailsRef.current[i] = el;
          }}
          geometry={TRAIL_SPHERE_GEO}
          material={trailMaterials[i]}
        />
      ))}
    </>
  );
});

GhostTrail.displayName = 'GhostTrail';

export default GhostTrail;
