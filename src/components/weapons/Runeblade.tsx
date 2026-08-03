import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Color, AdditiveBlending, BufferGeometry, Float32BufferAttribute, Points, PointsMaterial } from '@/utils/three-exports';
import { WeaponSubclass } from '@/components/dragon/weapons';
import CorruptedAura from './CorruptedAura';
import Blizzard from './Blizzard/Blizzard';
import { BLIZZARD_DURATION_SEC, BLIZZARD_DPS_PER_TICK, BLIZZARD_STORM_HIT_RADIUS } from '@/utils/talents';
import { calculationCache } from '@/utils/CalculationCache';
import { isInsideMainArenaXZ } from '@/utils/mapConstants';
import { forEachMushroomHitBySwing } from '@/utils/mushroomMeleeUtils';
import { MELEE_ARC_MIN_DOT, MELEE_ARC_RANGE } from '@/utils/meleeArcConstants';
import {
  ASPECT_BLADEMASTER,
  ASPECT_LEGIONNAIRE,
  ASPECT_ROYAL_GUARD,
  getRunebladeAspectComboDamage,
  type WeaponAspect,
} from '@/utils/weaponAspects';
import RunebladeItemMeshVisual from './RunebladeItemMeshVisual';

/** Mount scale for Runeblade aspect item meshes. */
const ASPECT_MESH_SCALE = 1.25;

/** Default Runeblade outer mount (tilted for combo swings). */
const RUNEBLADE_MOUNT = {
  position: [0, 0, 0] as const,
  rotation: [-0.65, 0, 0.2] as const,
  scale: [0.8, 0.9, 0.65] as const,
};

/** Spear.tsx outer mount — used only during Royal Guard Tempest Sweep. */
const SPEAR_MOUNT = {
  position: [0, 0.45, 0.25] as const,
  rotation: [-0.25, 0.15, 0] as const,
  scale: [0.825, 0.75, 0.75] as const,
};

/** Spear.tsx weapon-ref base — used only during Royal Guard Tempest Sweep. */
const SPEAR_REF_BASE = {
  position: [-1.18, 0.225, -0.3] as const,
  rotation: [Math.PI / 2, 0, 0] as const,
  scale: [0.8, 0.8, 0.7] as const,
  idleRotation: [-Math.PI / 2, 0, Math.PI] as const,
};

interface RunebladeProps {
  isSwinging: boolean;
  isSmiting: boolean;
  isOathstriking: boolean;
  isDeathGrasping?: boolean;
  isWraithStriking?: boolean;
  isCharging?: boolean;
  isDeflecting?: boolean;
  isCorruptedAuraActive?: boolean;
  /** Crusader talent — use corrupted-aura palette on blade only (F aura / CorruptedAura VFX unchanged). */
  crusaderBladeThemeActive?: boolean;
  /** Titan's Grip — permanent red blade palette (Crusader/Corrupted Aura override). */
  titansGripBladeThemeActive?: boolean;
  /** Throne weapon aspect — Blademaster sword / Deathdealer warhammer / Royal Guard spear (below Titan's Grip / Crusader). */
  weaponAspect?: WeaponAspect;
  /** Royal Guard Tempest Sweep — charge phase. */
  isWhirlwindCharging?: boolean;
  whirlwindChargeProgress?: number;
  /** Royal Guard Tempest Sweep — active spin. */
  isWhirlwinding?: boolean;
  chargeDirectionProp?: Vector3;
  onSwingComplete?: () => void;
  onSmiteComplete?: () => void;
  onDeathGraspComplete?: () => void;
  onWraithStrikeComplete?: () => void;
  onOathstrikeComplete?: () => void;
  onChargeComplete?: () => void;
  /** Cyclone Rush — post-charge blade spin audio start (storedCharge only). */
  onChargeSpinStart?: () => void;
  /** Cyclone Rush — post-charge blade spin audio stop. */
  onChargeSpinEnd?: () => void;
  onCorruptedAuraToggle?: (active: boolean) => void;
  hasChainLightning?: boolean;
  comboStep?: 1 | 2 | 3;
  currentSubclass?: WeaponSubclass;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  onHit?: (targetId: string, damage: number, isCritical?: boolean, position?: Vector3, isBlizzard?: boolean) => void;
  mushroomTargets?: Array<{ index: number; position: Vector3 }>;
  onMushroomHit?: (index: number, baseDamage: number) => void;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isLightning?: boolean;
    isHealing?: boolean;
    isSmite?: boolean;
    isOathstrike?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isLightning?: boolean;
    isHealing?: boolean;
    isSmite?: boolean;
    isOathstrike?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  setActiveEffects?: (callback: (prev: Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => Array<{
    id: number;
    type: string;
    position: Vector3;
    direction: Vector3;
    duration?: number;
    startTime?: number;
    summonId?: number;
    targetId?: string;
  }>) => void;
  playerPosition?: Vector3;
  playerRotation?: Vector3;
  dragonGroupRef?: React.RefObject<Group>; // Reference to dragon's group for real-time positioning
  playerEntityId?: number; // Player's entity ID to prevent self-damage
  realTimePositionRef?: React.RefObject<Vector3>; // Player position during charge (matches Sword)
  /** Cyclone Rush — 3 full post-Charge spins + damage each full rotation. */
  storedCharge?: boolean;
  /** Windfury / Flurry — once per swing after real enemy hits (local player only). */
  onPrimaryHitsResolved?: (enemiesHit: number) => void;
  /** Local: live ControlSystem combo step (avoids throttled React prop on swing start). */
  comboStepResolver?: () => 1 | 2 | 3;
  /** Local: EXECUTIONER flat bonus consumed once when swing damage resolves. */
  getExecutionerFlatBonus?: () => number;
  /** Local: Crusader talent — additive base damage while buff is active (not consumed per swing). */
  getCrusaderLmbFlatBonus?: () => number;
  /** Local: Titan's Grip — +2 base damage per Strength on each combo strike. */
  getTitansGripLmbFlatBonus?: () => number;
  /** Local: Vicegrip (Exodia Gauntlets) — +50 flat base damage on each combo strike. */
  getVicegripFlatBonus?: () => number;
  /** Local: Blizzard class talent — storm active while ControlSystem window is up. */
  getBlizzardTalentActive?: () => boolean;
  /** Local: Runeblade Blizzard — stat-scaled tick damage (42 + 1 per STR/STA/INT/AGI). */
  getBlizzardDamagePerTick?: () => number;
  /** Local: Awakened Eye — scaled storm hit radius. */
  getBlizzardStormHitRadius?: () => number;
  /** Local: Awakened Eye — denser frost particles. */
  getBlizzardParticleSpawnMultiplier?: () => number;
}

export default function Runeblade({
  isSwinging,
  isSmiting,
  isOathstriking,
  isDeathGrasping = false,
  isWraithStriking = false,
  isCharging = false,
  isDeflecting = false,
  isCorruptedAuraActive = false,
  crusaderBladeThemeActive = false,
  titansGripBladeThemeActive = false,
  weaponAspect,
  isWhirlwindCharging = false,
  whirlwindChargeProgress = 0,
  isWhirlwinding = false,
  chargeDirectionProp,
  onSwingComplete,
  onSmiteComplete,
  onDeathGraspComplete,
  onWraithStrikeComplete,
  onOathstrikeComplete,
  onChargeComplete,
  onChargeSpinStart,
  onChargeSpinEnd,
  onCorruptedAuraToggle,
  hasChainLightning = false,
  comboStep = 1,
  currentSubclass,
  enemyData = [],
  onHit,
  setDamageNumbers,
  nextDamageNumberId,
  setActiveEffects,
  playerPosition,
  playerRotation,
  dragonGroupRef,
  playerEntityId,
  realTimePositionRef,
  storedCharge = false,
  onPrimaryHitsResolved,
  comboStepResolver,
  mushroomTargets,
  onMushroomHit,
  getExecutionerFlatBonus,
  getCrusaderLmbFlatBonus,
  getTitansGripLmbFlatBonus,
  getVicegripFlatBonus,
  getBlizzardTalentActive,
  getBlizzardDamagePerTick,
  getBlizzardStormHitRadius,
  getBlizzardParticleSpawnMultiplier,
}: RunebladeProps) {
  const [blizzardStormVisible, setBlizzardStormVisible] = useState(false);
  const [blizzardMountKey, setBlizzardMountKey] = useState(0);
  const blizzardEdgeRef = useRef(false);

  const useCrusaderOrCorruptedPalette = isCorruptedAuraActive || crusaderBladeThemeActive;
  const useTitansGripPalette = titansGripBladeThemeActive && !useCrusaderOrCorruptedPalette;
  const useBlademasterPalette =
    weaponAspect === ASPECT_BLADEMASTER && !useCrusaderOrCorruptedPalette && !useTitansGripPalette;
  // Color scheme for Chain Lightning sparks: Corrupted/Crusader > Titan's Grip > Blademaster > Legionnaire.
  // Sword GLB themes (Crusader / Titan's Grip) are applied via RunebladeItemMeshVisual bladeTheme.
  const aspectBladeTheme: 'default' | 'crusader' | 'titans-grip' = useCrusaderOrCorruptedPalette
    ? 'crusader'
    : useTitansGripPalette
      ? 'titans-grip'
      : 'default';
  const secondaryColor = useMemo(
    () => {
      if (useCrusaderOrCorruptedPalette) return new Color('#ff8800');
      if (useTitansGripPalette) return new Color('#EE6666');
      if (useBlademasterPalette) return new Color('#DDD6FE');
      return new Color(0x87CEEB);
    },
    [useCrusaderOrCorruptedPalette, useTitansGripPalette, useBlademasterPalette],
  );

  const outerMountRef = useRef<Group>(null);
  const runebladeRef = useRef<Group>(null);
  const corruptedAuraRef = useRef<{ toggle: () => void; isActive: boolean }>(null);
  const swingProgress = useRef(0);
  const smiteProgress = useRef(0);
  const deathGraspProgress = useRef(0);
  const wraithStrikeProgress = useRef(0);
  const chargeProgress = useRef(0);
  const chargeStartPosition = useRef<Vector3 | null>(null);
  const chargeDirection = useRef<Vector3>(new Vector3());
  const chargeStartTime = useRef<number | null>(null);
  const chargeHitEnemies = useRef<Set<string>>(new Set());
  const chargeTrail = useRef<Array<{id: number, position: Vector3, life: number}>>([]);
  const nextChargeParticleId = useRef(1);
  const chargeSpinRotation = useRef(0);
  const chargeSpinStartTime = useRef<number | null>(null);
  const isChargeSpinning = useRef(false);
  const shouldStartSpin = useRef(false);
  const chargeSpinAudioActiveRef = useRef(false);
  const onChargeSpinEndRef = useRef(onChargeSpinEnd);
  onChargeSpinEndRef.current = onChargeSpinEnd;
  const basePosition = [-1.18, 0.675, 0.675] as const; // POSITIONING
  const whirlwindRotation = useRef(0);
  const whirlwindSpeed = useRef(0);
  const prevWhirlwindState = useRef(false);
  const wasRoyalGuardTempestActive = useRef(false);

  // Chain Lightning Sparks
  const sparkParticles = useRef<Array<{
    position: Vector3;
    velocity: Vector3;
    life: number;
    scale: number;
  }>>([]);
  const MAX_SPARKS = 120;
  // Pre-allocated GPU buffers updated each frame — avoids per-frame JS allocation
  // from the old N×<mesh> pattern and collapses all sparks to a single draw call.
  const sparkPositions = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);
  const sparkColors    = useMemo(() => new Float32Array(MAX_SPARKS * 3), []);

  const sparkGeometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(sparkPositions, 3));
    geo.setAttribute('color', new Float32BufferAttribute(sparkColors, 3));
    geo.setDrawRange(0, 0);
    return geo;
  }, [sparkPositions, sparkColors]);

  const sparkMaterial = useMemo(
    () =>
      new PointsMaterial({
        vertexColors: true,
        size: 0.04,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    [],
  );

  const sparkPoints = useMemo(
    () => new Points(sparkGeometry, sparkMaterial),
    [sparkGeometry, sparkMaterial],
  );

  useEffect(() => {
    return () => {
      sparkGeometry.dispose();
      sparkMaterial.dispose();
    };
  }, [sparkGeometry, sparkMaterial]);

  useEffect(() => {
    return () => {
      if (chargeSpinAudioActiveRef.current) {
        chargeSpinAudioActiveRef.current = false;
        onChargeSpinEndRef.current?.();
      }
    };
  }, []);

  // Swing collision tracking
  const lastSwingHitTime = useRef<Record<string, number>>({});
  /** Horizontal attack forward from playerRotation.y (matches DragonRenderer camera yaw). */
  const attackForwardScratch = useRef(new Vector3());
  const swingHasDealtDamage = useRef(false);
  const currentComboStep = useRef(comboStep);

  // Combo flow state for smooth transitions
  const isInCombo = useRef(false);
  const comboTransitionProgress = useRef(0);
  const lastComboStep = useRef<1 | 2 | 3>(comboStep); // Initialize to match initial comboStep prop
  const targetPosition = useRef<[number, number, number]>([...basePosition]);
  const targetRotation = useRef<[number, number, number]>([0, 0, 0]);

  // Monitor comboStep prop changes for debugging
  useEffect(() => {
    if (currentComboStep.current !== comboStep) {
      currentComboStep.current = comboStep;
    }
  }, [comboStep]);

  // Royal Guard Tempest Sweep — reset orbit when spin starts
  useEffect(() => {
    if (isWhirlwinding && !prevWhirlwindState.current) {
      whirlwindRotation.current = 0;
    }
    prevWhirlwindState.current = isWhirlwinding || false;
  }, [isWhirlwinding]);

  const isRoyalGuard = weaponAspect === ASPECT_ROYAL_GUARD;

  useFrame((state, delta) => {
    if (getBlizzardTalentActive) {
      const bz = getBlizzardTalentActive();
      if (bz !== blizzardEdgeRef.current) {
        blizzardEdgeRef.current = bz;
        if (bz) setBlizzardMountKey(k => k + 1);
        setBlizzardStormVisible(bz);
      }
    }

    if (!runebladeRef.current) return;

    // Royal Guard Tempest Sweep — swap to Spear mount so charge/spin match original spear orientation
    const isRoyalGuardTempestActive =
      isRoyalGuard &&
      (isWhirlwindCharging || isWhirlwinding || whirlwindSpeed.current > 0);

    if (outerMountRef.current && isRoyalGuard) {
      if (isRoyalGuardTempestActive) {
        outerMountRef.current.position.set(...SPEAR_MOUNT.position);
        outerMountRef.current.rotation.set(...SPEAR_MOUNT.rotation);
        outerMountRef.current.scale.set(...SPEAR_MOUNT.scale);
        runebladeRef.current.scale.set(...SPEAR_REF_BASE.scale);
        if (!wasRoyalGuardTempestActive.current) {
          // Entering tempest — snap ref to Spear default before charge/spin takes over
          runebladeRef.current.position.set(...SPEAR_REF_BASE.position);
          runebladeRef.current.rotation.set(...SPEAR_REF_BASE.rotation);
        }
      } else if (wasRoyalGuardTempestActive.current) {
        // Tempest ended — restore Runeblade mount for combo swings
        outerMountRef.current.position.set(...RUNEBLADE_MOUNT.position);
        outerMountRef.current.rotation.set(...RUNEBLADE_MOUNT.rotation);
        outerMountRef.current.scale.set(...RUNEBLADE_MOUNT.scale);
        runebladeRef.current.scale.set(0.75, 0.8, 0.65);
        runebladeRef.current.position.set(...basePosition);
        runebladeRef.current.rotation.set(0, 0, Math.PI);
      }
      wasRoyalGuardTempestActive.current = isRoyalGuardTempestActive;
    }

    // Royal Guard Tempest Sweep — orbital spin (ported from Spear.tsx)
    if (isRoyalGuard && isWhirlwinding) {
      if (whirlwindSpeed.current === 0) {
        whirlwindSpeed.current = 60;
      }
      whirlwindSpeed.current = Math.max(0, whirlwindSpeed.current - delta * 1920);
      whirlwindRotation.current += delta * whirlwindSpeed.current;

      const orbitRadius = 2.5;
      const angle = whirlwindRotation.current;
      const orbitalX = Math.cos(angle) * orbitRadius;
      const orbitalZ = Math.sin(angle) * orbitRadius;
      const fixedHeight = 0.4;

      runebladeRef.current.rotation.set(Math.PI / 3, -angle + Math.PI, 1);
      runebladeRef.current.rotateY(-angle + Math.PI);
      runebladeRef.current.position.set(orbitalX, fixedHeight, orbitalZ);
      return;
    } else if (isRoyalGuard && whirlwindSpeed.current > 0) {
      whirlwindSpeed.current = Math.max(0, whirlwindSpeed.current - delta * 1920);
      whirlwindRotation.current += delta * whirlwindSpeed.current;

      if (whirlwindSpeed.current < 0.5) {
        whirlwindSpeed.current = 0;
        const spearBase = SPEAR_REF_BASE.position;
        const spearIdle = SPEAR_REF_BASE.idleRotation;
        runebladeRef.current.position.x += (spearBase[0] - runebladeRef.current.position.x) * 0.75;
        runebladeRef.current.position.y += (spearBase[1] - runebladeRef.current.position.y) * 0.75;
        runebladeRef.current.position.z += (spearBase[2] - runebladeRef.current.position.z) * 0.75;
        runebladeRef.current.rotation.x += (spearIdle[0] - runebladeRef.current.rotation.x) * 0.75;
        runebladeRef.current.rotation.y += (spearIdle[1] - runebladeRef.current.rotation.y) * 0.75;
        runebladeRef.current.rotation.z += (spearIdle[2] - runebladeRef.current.rotation.z) * 0.75;
      } else {
        const orbitRadius = 2.5;
        const angle = whirlwindRotation.current;
        const orbitalX = Math.cos(angle) * orbitRadius;
        const orbitalZ = Math.sin(angle) * orbitRadius;
        const fixedHeight = 0.4;
        runebladeRef.current.rotation.set(Math.PI / 3, -angle + Math.PI, 1);
        runebladeRef.current.rotateY(-angle + Math.PI);
        runebladeRef.current.position.set(orbitalX, fixedHeight, orbitalZ);
      }
      return;
    }

    if (isRoyalGuard && isWhirlwindCharging) {
      const pullAmount = whirlwindChargeProgress;
      const heightOffset = 0.3 * pullAmount + 0.5;
      const spinSpeed = pullAmount * 60;
      const spearBase = SPEAR_REF_BASE.position;
      const targetX = -0.5 * (1 - pullAmount) - 0.65;
      const targetY = spearBase[1] + heightOffset;
      const targetZ = spearBase[2] + 0.5 * pullAmount;

      runebladeRef.current.position.x += (targetX - runebladeRef.current.position.x) * 0.1;
      runebladeRef.current.position.y += (targetY - runebladeRef.current.position.y) * 0.1;
      runebladeRef.current.position.z += (targetZ - runebladeRef.current.position.z) * 0.1;
      // Match Spear.tsx charge: upright (sky-facing) local axes, spin on local Y
      runebladeRef.current.rotation.x = -Math.PI;
      runebladeRef.current.rotation.y += delta * spinSpeed;
      runebladeRef.current.rotation.z = Math.PI;
      return;
    }

    const now = Date.now();

    // Handle smooth combo transitions when not actively swinging
    if (!isSwinging && !isSmiting && !isDeathGrasping && !isOathstriking && !isCharging && !isDeflecting && isInCombo.current) {
      if (comboTransitionProgress.current === 0) {
      }
      comboTransitionProgress.current += delta * 7; // Fast transition speed

      if (comboTransitionProgress.current >= 1) {
        // Transition complete
        isInCombo.current = false;
        comboTransitionProgress.current = 0;

        // Determine final position based on whether we're continuing combo or resetting
        if (comboStep !== lastComboStep.current) {
          // We're continuing the combo - set up ready position for next swing
          const readyPositions = getComboReadyPosition(comboStep);
          targetPosition.current = readyPositions.position;
          targetRotation.current = readyPositions.rotation;
        } else {
          // Combo ended - return to base position
          targetPosition.current = [...basePosition];
          targetRotation.current = [0, 0, 0];
        }

        runebladeRef.current.position.set(...targetPosition.current);
        runebladeRef.current.rotation.set(...targetRotation.current);
      } else {
        // Smooth interpolation during transition with curved backswing path
        const easeOut = 1 - Math.pow(1 - comboTransitionProgress.current, 3);

        // Get current position and rotation
        const currentPos = runebladeRef.current.position;
        const currentRot = runebladeRef.current.rotation;

        // Determine target based on next combo step
        let nextTarget;
        if (comboStep !== lastComboStep.current) {
          // Continuing combo - transition to ready position for next swing
          nextTarget = getComboReadyPosition(comboStep);
        } else {
          // Combo ended - return to base
          nextTarget = {
            position: [...basePosition] as [number, number, number],
            rotation: [0, 0, 0] as [number, number, number]
          };
        }

        // Create a curved backswing path by adding a slight arc
        // This makes the runeblade follow a more natural motion instead of straight lines
        const arcHeight = 0.15; // Height of the arc during backswing
        const arcProgress = Math.sin(comboTransitionProgress.current * Math.PI); // Creates a bell curve


        // Interpolate position with arc
        const lerpedX = currentPos.x + (nextTarget.position[0] - currentPos.x) * easeOut;
        const lerpedY = currentPos.y + (nextTarget.position[1] - currentPos.y) * easeOut + (arcHeight * arcProgress);
        const lerpedZ = currentPos.z + (nextTarget.position[2] - currentPos.z) * easeOut;
        runebladeRef.current.position.set(lerpedX, lerpedY, lerpedZ);

        // Interpolate rotation
        const lerpedRotX = currentRot.x + (nextTarget.rotation[0] - currentRot.x) * easeOut;
        const lerpedRotY = currentRot.y + (nextTarget.rotation[1] - currentRot.y) * easeOut;
        const lerpedRotZ = currentRot.z + (nextTarget.rotation[2] - currentRot.z) * easeOut;
        runebladeRef.current.rotation.set(lerpedRotX, lerpedRotY, lerpedRotZ);
      }

      return; // Don't process other animations during transition
    }

    // ── Charge: same flow as Sword (dash pose → movement phase → orbital spin → onChargeComplete)
    if (isChargeSpinning.current) {
      const TARGET_ROTATIONS = storedCharge ? 3 : 1.5;
      const MAX_ROTATION = TARGET_ROTATIONS * Math.PI * 2;
      const SPIN_ROTATION_SPEED = 32.5;

      const prevSpinAngle = chargeSpinRotation.current;
      chargeSpinRotation.current += delta * SPIN_ROTATION_SPEED;
      const currSpinAngle = chargeSpinRotation.current;

      if (storedCharge) {
        const TAU = Math.PI * 2;
        const CHARGE_SPIN_DAMAGE = 70;
        const CHARGE_SPIN_RADIUS = 2.95;
        const prevFloor = Math.floor(prevSpinAngle / TAU);
        const currFloor = Math.floor(currSpinAngle / TAU);
        if (currFloor > prevFloor && enemyData.length > 0 && onHit) {
          const currentPosition = realTimePositionRef?.current || playerPosition;
          if (currentPosition) {
            for (let f = prevFloor + 1; f <= currFloor; f++) {
              if (f < 1 || f > 3) continue;
              for (const enemy of enemyData) {
                if (enemy.health <= 0) continue;
                const distance = currentPosition.distanceTo(enemy.position);
                if (distance <= CHARGE_SPIN_RADIUS) {
                  onHit(enemy.id, CHARGE_SPIN_DAMAGE);
                  if (setDamageNumbers && nextDamageNumberId) {
                    setDamageNumbers(prev => [...prev, {
                      id: nextDamageNumberId.current++,
                      damage: CHARGE_SPIN_DAMAGE,
                      position: enemy.position.clone(),
                      isCritical: false,
                    }]);
                  }
                }
              }
            }
          }
        }
      }

      if (chargeSpinRotation.current >= MAX_ROTATION) {
        chargeSpinRotation.current = 0;
        chargeSpinStartTime.current = null;
        isChargeSpinning.current = false;

        if (chargeSpinAudioActiveRef.current) {
          chargeSpinAudioActiveRef.current = false;
          onChargeSpinEnd?.();
        }

        runebladeRef.current.position.set(...basePosition);
        runebladeRef.current.rotation.set(0, 0, 0);

        onChargeComplete?.();
        return;
      }

      const angle = currSpinAngle;
      const orbitRadius = 1.125;
      const orbitalX = calculationCache.getTrigCalculation('cos', angle) * orbitRadius;
      const orbitalZ = calculationCache.getTrigCalculation('sin', angle) * orbitRadius;
      const fixedHeight = 0.65;

      runebladeRef.current.position.set(orbitalX, fixedHeight, orbitalZ);
      runebladeRef.current.rotation.set(
        Math.PI / 4,
        -angle + Math.PI,
        1
      );
      runebladeRef.current.rotateY(-angle + Math.PI);

      return;
    }

    if (isCharging) {
      const CHARGE_DISTANCE = 8;
      const CHARGE_WINDUP_DURATION = 0.1;
      const CHARGE_DURATION = 0.45;
      const CHARGE_DAMAGE = 75;
      const CHARGE_COLLISION_RADIUS = 2.5;
      const CHARGE_FAILSAFE_TIMEOUT = 0.6;

      if (!chargeStartTime.current) {
        chargeStartTime.current = Date.now();
        chargeStartPosition.current = playerPosition?.clone() || new Vector3(0, 0, 0);
        chargeHitEnemies.current.clear();

        if (chargeDirectionProp) {
          chargeDirection.current = chargeDirectionProp.clone().normalize();
        } else {
          chargeDirection.current = new Vector3(0, 0, -1).normalize();
        }
      }

      const elapsed = (Date.now() - chargeStartTime.current) / 1000;

      if (elapsed > CHARGE_FAILSAFE_TIMEOUT) {
        chargeStartTime.current = null;
        chargeStartPosition.current = null;
        chargeHitEnemies.current.clear();
        chargeTrail.current = [];
        runebladeRef.current.rotation.set(0, 0, 0);
        runebladeRef.current.position.set(...basePosition);
        onChargeComplete?.();
        return;
      }

      if (elapsed < CHARGE_WINDUP_DURATION) {
        const windupProgress = elapsed / CHARGE_WINDUP_DURATION;
        const easeInOut = windupProgress < 0.5
          ? 2 * windupProgress * windupProgress
          : calculationCache.getEasingCalculation('easeInOut', windupProgress, 0, 1);

        const targetRotationX = Math.PI / 2;
        const currentRotationX = easeInOut * targetRotationX;
        runebladeRef.current.rotation.set(currentRotationX, 0, 0);

        const currentZ = basePosition[2] + (easeInOut * 1.5);
        runebladeRef.current.position.set(basePosition[0], basePosition[1] + 0.2, currentZ);

        return;
      }

      const dashElapsed = elapsed - CHARGE_WINDUP_DURATION;
      const progress = Math.min(dashElapsed / CHARGE_DURATION, 1);
      const easeOutQuad = calculationCache.getEasingCalculation('easeOutQuad', progress, 0, 1);

      if (!chargeStartPosition.current || !chargeDirection.current || !playerPosition) {
        chargeStartTime.current = null;
        chargeStartPosition.current = null;
        onChargeComplete?.();
        return;
      }

      const displacement = chargeDirection.current.clone().multiplyScalar(CHARGE_DISTANCE * easeOutQuad);
      const newPosition = chargeStartPosition.current.clone().add(displacement);
      if (!isInsideMainArenaXZ(newPosition.x, newPosition.z)) {
        chargeStartTime.current = null;
        chargeStartPosition.current = null;
        onChargeComplete?.();
        return;
      }

      const currentPosition = realTimePositionRef?.current || playerPosition;
      if (enemyData && enemyData.length > 0 && onHit && progress > 0 && currentPosition) {
        for (const enemy of enemyData) {
          if (chargeHitEnemies.current.has(enemy.id)) continue;
          if (enemy.health <= 0) continue;

          const distance = currentPosition.distanceTo(enemy.position);

          if (distance <= CHARGE_COLLISION_RADIUS) {
            chargeHitEnemies.current.add(enemy.id);
            onHit(enemy.id, CHARGE_DAMAGE);

            if (setDamageNumbers && nextDamageNumberId) {
              setDamageNumbers(prev => [...prev, {
                id: nextDamageNumberId.current++,
                damage: CHARGE_DAMAGE,
                position: enemy.position.clone(),
                isCritical: false,
              }]);
            }
          }
        }
      }

      runebladeRef.current.rotation.set(Math.PI / 2, 0, -0.175);
      runebladeRef.current.position.set(basePosition[0], basePosition[1] + 0.2, basePosition[2] + 1.5);

      return;
    }

    if (!isCharging && chargeStartTime.current !== null && !isChargeSpinning.current && !shouldStartSpin.current) {
      shouldStartSpin.current = true;
    }

    if (!isCharging && chargeStartTime.current !== null && !isChargeSpinning.current && !shouldStartSpin.current) {
      const timeSinceChargeEnd = (Date.now() - chargeStartTime.current) / 1000;
      if (timeSinceChargeEnd > 2.0) {
        chargeStartTime.current = null;
        chargeStartPosition.current = null;
        chargeHitEnemies.current.clear();
        chargeTrail.current = [];
        shouldStartSpin.current = false;
        runebladeRef.current.rotation.set(0, 0, 0);
        runebladeRef.current.position.set(...basePosition);
        return;
      }
    }

    if (shouldStartSpin.current && !isChargeSpinning.current) {
      chargeStartTime.current = null;
      chargeStartPosition.current = null;
      chargeHitEnemies.current.clear();
      chargeTrail.current = [];
      shouldStartSpin.current = false;

      isChargeSpinning.current = true;
      chargeSpinRotation.current = 0;
      chargeSpinStartTime.current = Date.now();

      if (storedCharge) {
        chargeSpinAudioActiveRef.current = true;
        onChargeSpinStart?.();
      }
    }

    if (!isCharging && chargeStartTime.current !== null && !shouldStartSpin.current && !isChargeSpinning.current) {
      chargeStartTime.current = null;
      chargeStartPosition.current = null;
      chargeHitEnemies.current.clear();
      chargeTrail.current = [];
      shouldStartSpin.current = false;
      runebladeRef.current.rotation.set(0, 0, 0);
      runebladeRef.current.position.set(...basePosition);
    }

    if (isCharging && !chargeStartTime.current) {
      if (isChargeSpinning.current && chargeSpinAudioActiveRef.current) {
        chargeSpinAudioActiveRef.current = false;
        onChargeSpinEnd?.();
      }
      shouldStartSpin.current = false;
      isChargeSpinning.current = false;
      chargeSpinRotation.current = 0;
    }

    if (isSmiting) {
      smiteProgress.current += delta * (smiteProgress.current < Math.PI/2 ? 3 : 6);
      const smitePhase = Math.min(smiteProgress.current / Math.PI, 1);

      let rotationX, rotationY, positionX, positionY, positionZ;

      if (smitePhase < 0.5) {
        // Wind-up phase: pull back and up, with more movement towards center
        const windupPhase = smitePhase * 0.45;
        rotationX = -Math.PI/3 - (windupPhase * Math.PI/3);
        rotationY = windupPhase * Math.PI/4;

        // Move towards center during windup
        positionX = basePosition[0] + (windupPhase * 1.5);
        positionY = basePosition[1] + windupPhase * 1.5;
        positionZ = basePosition[2] - windupPhase * 1.5;
      } else {
        // Strike phase: swing down towards center point
        const strikePhase = (smitePhase - 0.5) * 2;
        rotationX = -2*Math.PI/3 + (strikePhase * 3*Math.PI/2);
        rotationY = (Math.PI/4) * (1 - strikePhase);

        // Strike towards center
        positionX = basePosition[0] + (1.5 * (1 - strikePhase));
        positionY = basePosition[1] + (1.5 - strikePhase * 2.0);
        positionZ = basePosition[2] - (1.5 - strikePhase * 3.0);
      }

      runebladeRef.current.position.set(
        positionX,
        positionY,
        positionZ
      );

      runebladeRef.current.rotation.set(rotationX, rotationY, 0);

      if (smiteProgress.current >= Math.PI) {
        smiteProgress.current = 0;
        runebladeRef.current.rotation.set(0, 0, 0);
        runebladeRef.current.position.set(...basePosition);
        onSmiteComplete?.();
      }
      return;
    }

    if (isDeathGrasping) {
      deathGraspProgress.current += delta * 4; // Faster animation
      const deathGraspPhase = Math.min(deathGraspProgress.current / (Math.PI * 1.2), 1);

      let rotationX, rotationY, positionX, positionY, positionZ;

      if (deathGraspPhase < 0.4) {
        // Wind-up phase: pull back and to the side
        const windupPhase = deathGraspPhase / 0.4;
        rotationX = -Math.PI/6 - (windupPhase * Math.PI/3);
        rotationY = windupPhase * Math.PI/6;

        // Move back and to the side during windup
        positionX = basePosition[0] - windupPhase * 1.0;
        positionY = basePosition[1] + windupPhase * 0.5;
        positionZ = basePosition[2] + windupPhase * 0.5;
      } else {
        // Strike phase: thrust forward
        const strikePhase = (deathGraspPhase - 0.4) / 0.6;
        rotationX = -Math.PI/2 + (strikePhase * Math.PI);
        rotationY = (Math.PI/6) * (1 - strikePhase);

        // Thrust forward
        positionX = basePosition[0] - (1.0 - strikePhase * 2.5);
        positionY = basePosition[1] + (0.5 - strikePhase * 1.0);
        positionZ = basePosition[2] + (0.5 - strikePhase * 1.5);
      }

      runebladeRef.current.position.set(
        positionX,
        positionY,
        positionZ
      );

      runebladeRef.current.rotation.set(rotationX, rotationY, 0);

      if (deathGraspProgress.current >= Math.PI * 1.2) {
        deathGraspProgress.current = 0;
        runebladeRef.current.rotation.set(0, 0, 0);
        runebladeRef.current.position.set(...basePosition);
        onDeathGraspComplete?.();
      }
      return;
    }

    // Handle WraithStrike animation (uses 2nd swing animation)
    if (isWraithStriking) {
      wraithStrikeProgress.current += delta * 10; // Same speed as regular swing
      const swingPhase = Math.min(wraithStrikeProgress.current / Math.PI/1.5, 1);

      // Use the exact 2nd swing animation logic
      // 2nd Hit: Mirrored swing (top-left to bottom-right)
      const forwardPhase = swingPhase <= 0.275
        ? swingPhase * 2
        : (0.625 - (swingPhase - 0.075) * 1.20);

      const leftOffset = 2.5;
      const pivotX = basePosition[0] + leftOffset - Math.sin(forwardPhase * Math.PI) * 2.5;
      const pivotY = basePosition[1] + Math.sin(forwardPhase * Math.PI) * -0.2;
      const pivotZ = basePosition[2] + Math.cos(forwardPhase * Math.PI) * 1.1;

      runebladeRef.current.position.set(pivotX, pivotY, pivotZ);

      const rotationX = Math.sin(forwardPhase * Math.PI) * (-0.75) + 1.5;
      const rotationY = -Math.sin(forwardPhase * Math.PI) * Math.PI;
      const rotationZ = -Math.sin(forwardPhase * Math.PI) * (Math.PI/1.75);

      runebladeRef.current.rotation.set(rotationX, rotationY, rotationZ);

      // Complete the animation when done
      if (wraithStrikeProgress.current >= Math.PI * 0.55) {
        wraithStrikeProgress.current = 0;
        runebladeRef.current.rotation.set(0, 0, 0);
        runebladeRef.current.position.set(...basePosition);
        onWraithStrikeComplete?.();
      }
      return;
    }

    // Handle regular swinging animation
    if (isSwinging) {
      const resolvedStep = (comboStepResolver?.() ?? comboStep) as 1 | 2 | 3;
      if (currentComboStep.current !== resolvedStep) {
        currentComboStep.current = resolvedStep;
      }

      // Update current combo step when swing starts
      if (swingProgress.current === 0) {
        swingHasDealtDamage.current = false;
      }

      swingProgress.current += delta * 11;
      const swingPhase = Math.min(swingProgress.current / Math.PI/1.5, 1);

      // Use the stored combo step for this swing animation
      const effectiveComboStep = currentComboStep.current;

      // Different completion timing for 3rd swing (takes longer to show full downstrike)
      const completionThreshold = effectiveComboStep === 3 ? Math.PI * 0.9 : Math.PI * 0.55;

      // Check for damage during the active part of the swing - widened damage windows
      const damageWindow = effectiveComboStep === 3 ?
        (swingPhase >= 0.25 && swingPhase <= 0.75) : // 3rd hit has wider timing window
        (swingPhase >= 0.15 && swingPhase <= 0.65);   // 1st and 2nd hits have wider windows

      if (damageWindow && !swingHasDealtDamage.current) {
        performSwingDamage(effectiveComboStep);
        swingHasDealtDamage.current = true;
      }

      if (swingProgress.current >= completionThreshold) {
        swingProgress.current = 0;
        swingHasDealtDamage.current = false;
        lastSwingHitTime.current = {}; // Reset hit tracking
        lastComboStep.current = effectiveComboStep;

        // Set up for smooth transition to next combo position
        if (effectiveComboStep === 2) {
          isInCombo.current = false; // No transition needed
        } else {
          isInCombo.current = true;
          comboTransitionProgress.current = 0;
        }

        onSwingComplete?.();
        return;
      }

      if (effectiveComboStep === 1) {
        // 1st Hit: Original swing (top-right to bottom-left)
        const forwardPhase = swingPhase <= 0.25
          ? swingPhase * 2
          : (0.725 - (swingPhase - 0.115) * 1.1);

        const pivotX = basePosition[0] + Math.sin(forwardPhase * Math.PI) * 2;
        const pivotY = basePosition[1] + Math.sin(forwardPhase * Math.PI) * -2;
        const pivotZ = basePosition[2] + Math.cos(forwardPhase * Math.PI) * 1;

        runebladeRef.current.position.set(pivotX, pivotY, pivotZ);

        const rotationX = Math.sin(forwardPhase * Math.PI) * (-0.75) + 1.25;
        const rotationY = Math.sin(forwardPhase * Math.PI) * Math.PI/1.125;
        const rotationZ = Math.sin(forwardPhase * Math.PI) * (Math.PI / 3);

        runebladeRef.current.rotation.set(rotationX, rotationY, rotationZ);
      } else if (effectiveComboStep === 2) {
        // 2nd Hit: Mirrored swing (top-left to bottom-right)
        const forwardPhase = swingPhase <= 0.275
          ? swingPhase * 2
          : (0.625 - (swingPhase - 0.075) * 1.20);

        const leftOffset = 2.5;
        const pivotX = basePosition[0] + leftOffset - Math.sin(forwardPhase * Math.PI) * 2.5;
        const pivotY = basePosition[1] + Math.sin(forwardPhase * Math.PI) * -0.2;
        const pivotZ = basePosition[2] + Math.cos(forwardPhase * Math.PI) * 1.1;

        runebladeRef.current.position.set(pivotX, pivotY, pivotZ);

        const rotationX = Math.sin(forwardPhase * Math.PI) * (-0.75) +1.5;
        const rotationY = -Math.sin(forwardPhase * Math.PI) * Math.PI;
        const rotationZ = -Math.sin(forwardPhase * Math.PI) * (Math.PI/1.75);

        runebladeRef.current.rotation.set(rotationX, rotationY, rotationZ);
      } else if (effectiveComboStep === 3) {
        // 3rd Hit: Smite-like animation (top to center down)
        let rotationX, rotationY, positionX, positionY, positionZ;

        if (swingProgress.current <= delta * 3) {
          const currentPos = runebladeRef.current.position;
          const currentRot = runebladeRef.current.rotation;

          runebladeRef.current.userData = {
            startPos: [currentPos.x, currentPos.y, currentPos.z],
            startRot: [currentRot.x, currentRot.y, currentRot.z]
          };
        }

        const startPos = runebladeRef.current.userData?.startPos || basePosition;
        const startRot = runebladeRef.current.userData?.startRot || [0, 0, 0];

        if (swingPhase < 0.2) {
          const windupPhase = swingPhase * 5;

          const targetWindupX = basePosition[0] + 1.5;
          const targetWindupY = basePosition[1] + 1.5;
          const targetWindupZ = basePosition[2] - 1.5;

          positionX = startPos[0] + (targetWindupX - startPos[0]) * windupPhase;
          positionY = startPos[1] + (targetWindupY - startPos[1]) * windupPhase;
          positionZ = startPos[2] + (targetWindupZ - startPos[2]) * windupPhase;

          const targetRotX = -Math.PI/3 - Math.PI/3;
          const targetRotY = Math.PI/4;
          rotationX = startRot[0] + (targetRotX - startRot[0]) * windupPhase;
          rotationY = startRot[1] + (targetRotY - startRot[1]) * windupPhase;
        } else {
          const strikePhase = (swingPhase - 0.2) * 2;
          rotationX = -2*Math.PI/3 + (strikePhase * 3*Math.PI/2);
          rotationY = (Math.PI/4) * (1 - strikePhase);

          positionX = basePosition[0] + (1.5 * (1 - strikePhase));
          positionY = basePosition[1] + (2 - strikePhase * 5);
          positionZ = basePosition[2] - (1.5 - strikePhase * 3.5);
        }

        runebladeRef.current.position.set(positionX, positionY, positionZ);
        runebladeRef.current.rotation.set(rotationX, rotationY, 0);
      }
    } else if (!isSwinging && !isSmiting && !isDeathGrasping && !isOathstriking && !isCharging && !isDeflecting && !isInCombo.current) {
      const justCompleted2ndSwing = lastComboStep.current === 2 && comboStep === 3;

      if (!justCompleted2ndSwing) {
        runebladeRef.current.rotation.x *= 0.85;
        runebladeRef.current.rotation.y *= 0.85;
        runebladeRef.current.rotation.z *= 0.85;

        runebladeRef.current.position.x += (basePosition[0] - runebladeRef.current.position.x) * 0.14;
        runebladeRef.current.position.y += (basePosition[1] - runebladeRef.current.position.y) * 0.14;
        runebladeRef.current.position.z += (basePosition[2] - runebladeRef.current.position.z) * 0.14;
      }
    }

    // Handle electrical effects when Chain Lightning is unlocked.
    // Sparks are rendered as a single <points> draw call — no per-spark <mesh>.
    if (hasChainLightning && runebladeRef.current) {
      const nowMs = Date.now();

      // Spawn up to 3 sparks per frame when the random threshold passes
      if (Math.random() < 0.8) {
        for (let i = 0; i < 3; i++) {
          const randomLength = Math.random() * 2.2;
          sparkParticles.current.push({
            position: new Vector3(
              (Math.random() - 0.5) * 0.4,
              randomLength,
              (Math.random() - 0.5) * 0.4
            ),
            velocity: new Vector3(
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.2) * 4,
              (Math.random() - 0.5) * 4
            ).multiplyScalar(0.8),
            life: 1.0,
            scale: Math.random() * 0.02 + 0.005,
          });
        }
      }

      // Update & cull dead sparks
      const sinT = Math.sin(nowMs * 0.01);
      const cosT = Math.cos(nowMs * 0.01);
      const live: typeof sparkParticles.current = [];
      for (const spark of sparkParticles.current) {
        spark.velocity.x += sinT * delta * 0.5;
        spark.velocity.z += cosT * delta * 0.5;
        spark.velocity.y += delta * 0.5;
        spark.position.x += spark.velocity.x * delta;
        spark.position.y += spark.velocity.y * delta;
        spark.position.z += spark.velocity.z * delta;
        spark.life -= delta * 1.5;
        if (spark.life > 0) live.push(spark);
      }
      // Cap at MAX_SPARKS to stay within the pre-allocated buffer
      sparkParticles.current = live.length > MAX_SPARKS ? live.slice(-MAX_SPARKS) : live;

      // Write live-spark positions + faded colours into the GPU buffer
      {
        const pos = sparkPositions;
        const col = sparkColors;
        const count = Math.min(sparkParticles.current.length, MAX_SPARKS);
        const sr = secondaryColor.r;
        const sg = secondaryColor.g;
        const sb = secondaryColor.b;
        for (let i = 0; i < count; i++) {
          const sp = sparkParticles.current[i];
          const idx = i * 3;
          pos[idx]     = sp.position.x;
          pos[idx + 1] = sp.position.y;
          pos[idx + 2] = sp.position.z;
          const fade = sp.life;
          col[idx]     = sr * fade;
          col[idx + 1] = sg * fade;
          col[idx + 2] = sb * fade;
        }
        const geo = sparkGeometry;
        (geo.attributes.position as Float32BufferAttribute).set(pos);
        (geo.attributes.color as Float32BufferAttribute).set(col);
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
        const attrCount = geo.attributes.position.count;
        geo.setDrawRange(0, Math.min(count, attrCount));
      }
    }
  });

  // Helper function to get ready positions for each combo step
  const getComboReadyPosition = (step: 1 | 2 | 3): {
    position: [number, number, number];
    rotation: [number, number, number];
  } => {
    switch (step) {
      case 1:
        return {
          position: [basePosition[0] + 0.3, basePosition[1] + 0.2, basePosition[2] + 0.1],
          rotation: [0.2, 0.3, 0.1]
        };
      case 2:
        return {
          position: [basePosition[0] - 0.3, basePosition[1] - 0.1, basePosition[2] + 0.1],
          rotation: [0.2, -0.3, -0.1]
        };
      case 3:
        return {
          position: [basePosition[0], basePosition[1] - 0.15, basePosition[2] - 0.2],
          rotation: [-0.5, 0, 0]
        };
      default:
        return {
          position: [...basePosition],
          rotation: [0, 0, 0]
        };
    }
  };

  // Runeblade LMB damage: `onHit` forwards to DragonRenderer.handleSwordHit (crits, Infested Combo, Guard Combo talents).
  const performSwingDamage = (comboStep: 1 | 2 | 3) => {
    const execBonus = getExecutionerFlatBonus?.() ?? 0;
    const crusaderBonus = getCrusaderLmbFlatBonus?.() ?? 0;
    const titansGripBonus = getTitansGripLmbFlatBonus?.() ?? 0;
    const vicegripBonus = getVicegripFlatBonus?.() ?? 0;
    if (!playerPosition) return;

    // Scorpion Lance / Warlord Poison Dart: fire on primary attempt even if no melee targets (whiff still consumes the arm window).
    const cs = (window as any).controlSystemRef?.current;
    if (cs) {
      const yaw = playerRotation?.y ?? 0;
      const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
      cs.tryFireScorpionLanceShardIfArmed?.(playerPosition, forward);
      cs.tryFirePoisonDartIfArmed?.(playerPosition, forward);
    }

    if (!enemyData.length && !mushroomTargets?.length) return;

    const now = Date.now();

    const baseDamage =
      getRunebladeAspectComboDamage(weaponAspect ?? ASPECT_LEGIONNAIRE, comboStep) +
      execBonus +
      crusaderBonus +
      titansGripBonus +
      vicegripBonus;

    let enemiesHitThisSwing = 0;
    let mushroomsHitThisSwing = 0;

    enemyData.forEach((enemy) => {
      if (!enemy.health || enemy.health <= 0) return;

      const lastHitTime = lastSwingHitTime.current[enemy.id] || 0;
      if (now - lastHitTime < 100) return;

      const distance = playerPosition.distanceTo(enemy.position);

      if (distance <= MELEE_ARC_RANGE) {
        let shouldHit = false;

        if (comboStep === 3) {
          shouldHit = true;
        } else {
          const yaw = playerRotation?.y ?? 0;
          attackForwardScratch.current.set(Math.sin(yaw), 0, Math.cos(yaw));
          const toEnemy = enemy.position.clone().sub(playerPosition);
          toEnemy.y = 0;
          if (toEnemy.lengthSq() < 1e-8) {
            shouldHit = true;
          } else {
            toEnemy.normalize();
            shouldHit = toEnemy.dot(attackForwardScratch.current) > MELEE_ARC_MIN_DOT;
          }
        }

        if (shouldHit) {
          lastSwingHitTime.current[enemy.id] = now;

          onHit?.(enemy.id, baseDamage);

          setActiveEffects?.(prev => [...prev, {
            id: Date.now() + Math.random(),
            type: 'runeblade-slash-impact',
            position: enemy.position.clone(),
            direction: attackForwardScratch.current.clone(),
            startTime: Date.now(),
            duration: 0.5,
          }]);

          enemiesHitThisSwing++;

          if (setDamageNumbers && nextDamageNumberId) {
            setDamageNumbers(prev => [...prev, {
              id: nextDamageNumberId.current++,
              damage: baseDamage,
              position: enemy.position.clone(),
              isCritical: false,
            }]);
          }
        }
      }
    });

    if (mushroomTargets?.length && onMushroomHit) {
      const yaw = playerRotation?.y ?? 0;
      forEachMushroomHitBySwing(
        playerPosition,
        yaw,
        comboStep,
        mushroomTargets,
        (index) => {
          onMushroomHit(index, baseDamage);
          mushroomsHitThisSwing++;
          if (setDamageNumbers && nextDamageNumberId) {
            const m = mushroomTargets.find((t) => t.index === index);
            if (m) {
              setDamageNumbers((prev) => [
                ...prev,
                {
                  id: nextDamageNumberId.current++,
                  damage: baseDamage,
                  position: m.position.clone(),
                  isCritical: false,
                },
              ]);
            }
          }
        },
        now,
        lastSwingHitTime.current,
      );
    }

    onPrimaryHitsResolved?.(enemiesHitThisSwing + mushroomsHitThisSwing);
  };

  return (
    <>
    <group
      ref={outerMountRef}
      position={[RUNEBLADE_MOUNT.position[0], RUNEBLADE_MOUNT.position[1], RUNEBLADE_MOUNT.position[2]]}
      rotation={[RUNEBLADE_MOUNT.rotation[0], RUNEBLADE_MOUNT.rotation[1], RUNEBLADE_MOUNT.rotation[2]]}
      scale={[RUNEBLADE_MOUNT.scale[0], RUNEBLADE_MOUNT.scale[1], RUNEBLADE_MOUNT.scale[2]]}
    >
      <group
        ref={runebladeRef}
        position={[basePosition[0], basePosition[1], basePosition[2]]}
        rotation={[0, 0, Math.PI]}
        scale={[0.75, 0.8, 0.65]}
      >
        <>
          <group
            key={weaponAspect ?? 'LEGIONNAIRE'}
            position={[0.25, 0, 0.35]}
            rotation={[0, 0, Math.PI]}
            scale={[ASPECT_MESH_SCALE, -ASPECT_MESH_SCALE, ASPECT_MESH_SCALE]}
          >
            <RunebladeItemMeshVisual
              aspect={weaponAspect}
              bladeTheme={aspectBladeTheme}
              emissiveBoost={
                isRoyalGuard && isWhirlwindCharging ? whirlwindChargeProgress : 0
              }
            />
          </group>
          {hasChainLightning && <primitive object={sparkPoints} />}
        </>
      </group>

      {isCharging && chargeTrail.current.map(particle => (
        <mesh
          key={particle.id}
          position={[particle.position.x, particle.position.y, particle.position.z]}
          scale={[particle.life * 0.2, particle.life * 0.2, particle.life * 0.2]}
        >
          <sphereGeometry args={[0.5, 6, 6]} />
          <meshStandardMaterial
            color={new Color(0xB5B010)}
            emissive={new Color(0xB5B010)}
            emissiveIntensity={particle.life * 3}
            transparent
            opacity={particle.life * 0.9}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </group>

    {getBlizzardTalentActive && blizzardStormVisible && dragonGroupRef && (
      <Blizzard
        key={blizzardMountKey}
        position={new Vector3(0, 0, 0)}
        durationSeconds={BLIZZARD_DURATION_SEC}
        flatDamagePerTick={getBlizzardDamagePerTick?.() ?? BLIZZARD_DPS_PER_TICK}
        hitRadius={getBlizzardStormHitRadius?.() ?? BLIZZARD_STORM_HIT_RADIUS}
        particleSpawnMultiplier={getBlizzardParticleSpawnMultiplier?.() ?? 1}
        onComplete={() => {}}
        enemyData={enemyData}
        parentRef={dragonGroupRef}
        onHitTarget={(targetId, damage, isCritical, hitPosition, isBlizzard) => {
          onHit?.(targetId, damage, isCritical, hitPosition, isBlizzard);
        }}
      />
    )}

    {/* Corrupted Aura - Rendered outside runeblade group to avoid inheriting transformations */}
    <CorruptedAura
      ref={corruptedAuraRef}
      parentRef={dragonGroupRef || runebladeRef}
      isActive={isCorruptedAuraActive}
      onToggle={onCorruptedAuraToggle}
    />
    
    {/* Wraith Strike soul VFX: ControlSystem → HauntedSoulEffect callback; rendered in CoopGameScene */}
    </>
  );
}
