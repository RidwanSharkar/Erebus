import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Color, Shape, AdditiveBlending } from '@/utils/three-exports';
import { WeaponSubclass } from '@/components/dragon/weapons';
import CorruptedAura from './CorruptedAura';
import Blizzard from './Blizzard/Blizzard';
import { BLIZZARD_DURATION_SEC, BLIZZARD_DPS_PER_TICK } from '@/utils/talents';
import { calculationCache } from '@/utils/CalculationCache';
import { isInsideMainArenaXZ } from '@/utils/mapConstants';
import { forEachMushroomHitBySwing } from '@/utils/mushroomMeleeUtils';
import { MELEE_ARC_MIN_DOT, MELEE_ARC_RANGE } from '@/utils/meleeArcConstants';

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
  chargeDirectionProp?: Vector3;
  onSwingComplete?: () => void;
  onSmiteComplete?: () => void;
  onDeathGraspComplete?: () => void;
  onWraithStrikeComplete?: () => void;
  onOathstrikeComplete?: () => void;
  onChargeComplete?: () => void;
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
  /** STORED CHARGE talent: 3 full post-dash spins + damage each full rotation. */
  storedCharge?: boolean;
  /** Windfury / Flurry — once per swing after real enemy hits (local player only). */
  onPrimaryHitsResolved?: (enemiesHit: number) => void;
  /** Local: live ControlSystem combo step (avoids throttled React prop on swing start). */
  comboStepResolver?: () => 1 | 2 | 3;
  /** Local: EXECUTIONER flat bonus consumed once when swing damage resolves. */
  getExecutionerFlatBonus?: () => number;
  /** Local: Crusader talent — additive base damage while buff is active (not consumed per swing). */
  getCrusaderLmbFlatBonus?: () => number;
  /** Local: Blizzard class talent — storm active while ControlSystem window is up. */
  getBlizzardTalentActive?: () => boolean;
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
  chargeDirectionProp,
  onSwingComplete,
  onSmiteComplete,
  onDeathGraspComplete,
  onWraithStrikeComplete,
  onOathstrikeComplete,
  onChargeComplete,
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
  getBlizzardTalentActive,
}: RunebladeProps) {
  const [blizzardStormVisible, setBlizzardStormVisible] = useState(false);
  const [blizzardMountKey, setBlizzardMountKey] = useState(0);
  const blizzardEdgeRef = useRef(false);

  const useCorruptedPalette = isCorruptedAuraActive || crusaderBladeThemeActive;
  // Color scheme: F-key Corrupted Aura or Crusader talent blade theme
  const primaryColor = useCorruptedPalette ? new Color("#ffaa00") : new Color(0x1097B5);
  const primaryEmissive = useCorruptedPalette ? new Color("#ff8800") : new Color(0x1097B5);
  const secondaryColor = useCorruptedPalette ? new Color("#ff8800") : new Color(0x87CEEB);
  const secondaryEmissive = useCorruptedPalette ? new Color("#ff6600") : new Color(0x4682B4);

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
  const basePosition = [-1.18, 0.675, 0.675] as const; // POSITIONING

  // Chain Lightning Sparks
  const sparkParticles = useRef<Array<{
    position: Vector3;
    velocity: Vector3;
    life: number;
    scale: number;
  }>>([]);

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

  const bladeShape = useMemo(() => {
    const shape = new Shape();

    shape.moveTo(0, 0);

    shape.lineTo(-0.25, 0.25);
    shape.lineTo(-0.15, -0.15);
    shape.lineTo(0, 0);

    shape.lineTo(0.25, 0.25);
    shape.lineTo(0.15, -0.15);
    shape.lineTo(0, 0);

    shape.lineTo(0, 0.08);
    shape.lineTo(-0.2, 0.12);
    shape.quadraticCurveTo(0.8, -0.15, -0.15, 0.12);
    shape.quadraticCurveTo(1.8, -0, 1.75, 0.05);
    shape.quadraticCurveTo(2.15, 0.05, 2.35, 0.225);

    shape.quadraticCurveTo(2.125, -0.125, 2.0, -0.25);
    shape.quadraticCurveTo(1.8, -0.45, 1.675, -0.55);
    shape.quadraticCurveTo(0.9, -0.35, 0.125, -0.325);
    shape.lineTo(0, -0.08);
    shape.lineTo(0, 0);

    return shape;
  }, []);

  const innerBladeShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);

    shape.lineTo(0, 0.06);
    shape.lineTo(-0.15, 0.09);
    shape.quadraticCurveTo(0.6, -0.11, -0.11, 0.09);
    shape.quadraticCurveTo(1.35, -0.11, 1.575, 0.04);
    shape.quadraticCurveTo(1.61, 0.015, 2.12, 0);

    shape.quadraticCurveTo(1.975, -0.094, 1.9, -0.188);
    shape.quadraticCurveTo(1.7, -0.338, 1.606, -0.413);
    shape.quadraticCurveTo(0.85, -0.263, 0.094, -0.244);
    shape.lineTo(0, -0.06);
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

  const chainLightningBladeExtrudeSettings = useMemo(
    () => ({ ...bladeExtrudeSettings, depth: 0.07 }),
    [bladeExtrudeSettings],
  );

  useFrame((_, delta) => {
    if (getBlizzardTalentActive) {
      const bz = getBlizzardTalentActive();
      if (bz !== blizzardEdgeRef.current) {
        blizzardEdgeRef.current = bz;
        if (bz) setBlizzardMountKey(k => k + 1);
        setBlizzardStormVisible(bz);
      }
    }

    if (!runebladeRef.current) return;

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
      wraithStrikeProgress.current += delta * 8; // Same speed as regular swing
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

    // Handle electrical effects when Chain Lightning is unlocked
    if (hasChainLightning && runebladeRef.current) {
      if (Math.random() < 0.8) {
        for (let i = 0; i < 3; i++) {
          const randomLength = Math.random() * 2.2;
          const randomOffset = new Vector3(
            (Math.random() - 0.5) * 0.4,
            randomLength,
            (Math.random() - 0.5) * 0.4
          );

          sparkParticles.current.push({
            position: randomOffset,
            velocity: new Vector3(
              (Math.random() - 0.5) * 4,
              (Math.random() - 0.2) * 4,
              (Math.random() - 0.5) * 4
            ).multiplyScalar(0.8),
            life: 1.0,
            scale: Math.random() * 0.02 + 0.005
          });
        }
      }

      sparkParticles.current.forEach(spark => {
        spark.velocity.x += Math.sin(Date.now() * 0.01) * delta * 0.5;
        spark.velocity.z += Math.cos(Date.now() * 0.01) * delta * 0.5;
        spark.position.add(spark.velocity.clone().multiplyScalar(delta));
        spark.life -= delta * 1.5;
        spark.velocity.y += delta * 0.5;
      });

      if (sparkParticles.current.length > 120) {
        sparkParticles.current = sparkParticles.current.slice(-120);
      }

      sparkParticles.current = sparkParticles.current.filter(spark => spark.life > 0);
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
    if (!playerPosition) return;
    if (!enemyData.length && !mushroomTargets?.length) return;

    const now = Date.now();

    const damageValues = {
      1: 45,
      2: 50,
      3: 60,
    };

    const baseDamage = damageValues[comboStep] + execBonus + crusaderBonus;

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
    <group rotation={[-0.65, 0, 0.2]} scale={[0.8, 0.9, 0.65]}>
      <group
        ref={runebladeRef}
        position={[basePosition[0], basePosition[1], basePosition[2]]}
        rotation={[0, 0, Math.PI]}
        scale={[0.75, 0.8, 0.65]}
      >
        {/* Handle */}
        <group position={[0.25, -0.55, 0.35]} rotation={[0, 0, -Math.PI]}>
          <mesh>
            <cylinderGeometry args={[0.03, 0.04, 0.9, 12]} />
            <meshStandardMaterial color="#2a3b4c" roughness={0.7} />
          </mesh>

          {/* Handle wrappings */}
          {[...Array(8)].map((_, i) => (
            <mesh key={i} position={[0, +0.35 - i * 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.045, 0.016, 8, 16]} />
              <meshStandardMaterial color="#1a2b3c" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>

        {/* CIRCLE CONNECTION POINT */}
        <group position={[0.25, 0.225, 0.35]} rotation={[Math.PI, 1.5, Math.PI]}>
          {/* Large torus */}
          <mesh>
            <torusGeometry args={[0.26, 0.07, 16, 32]} />
            <meshStandardMaterial
              color="#4a5b6c"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          {/* Decorative spikes around torus */}
          {[...Array(8)].map((_, i) => (
            <mesh
              key={`spike-${i}`}
              position={[
                0.25 * Math.cos(i * Math.PI / 4),
                0.25 * Math.sin(i * Math.PI / 4),
                0
              ]}
              rotation={[0, 0, i * Math.PI / 4 - Math.PI / 2]}
            >
              <coneGeometry args={[0.070, 0.55, 3]} />
              <meshStandardMaterial
                color="#4a5b6c"
                metalness={0.9}
                roughness={0.1}
              />
            </mesh>
          ))}

          {/* Core orb - YELLOW THEME */}
          <mesh>
            <sphereGeometry args={[0.155, 16, 16]} />
            <meshStandardMaterial
              color={new Color(0xB5B010)}         // Pure yellow
              emissive={new Color(0xB5B010)}      // Yellow emission
              emissiveIntensity={3}
              transparent
              opacity={1}
            />
          </mesh>

          {/* Multiple glow layers for depth */}
          <mesh>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial
              color={primaryColor}
              emissive={primaryEmissive}
              emissiveIntensity={40}
              transparent
              opacity={0.8}
            />
          </mesh>

          <mesh>
            <sphereGeometry args={[0.145, 16, 16]} />
            <meshStandardMaterial
              color={primaryColor}
              emissive={primaryEmissive}
              emissiveIntensity={35}
              transparent
              opacity={0.6}
            />
          </mesh>

          <mesh>
            <sphereGeometry args={[.175, 16, 16]} />
            <meshStandardMaterial
              color={primaryColor}
              emissive={primaryEmissive}
              emissiveIntensity={30}
              transparent
              opacity={0.4}
            />
          </mesh>


        </group>

        {/* Blade*/}
        <group position={[0.25, 0.5, 0.35]} rotation={[0, -Math.PI / 2, Math.PI / 2]}>
          {/* Base blade */}
          <mesh>
            <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
            <meshStandardMaterial
              color={primaryColor}  // Dynamic theme based on corrupted aura
              emissive={primaryEmissive}
              emissiveIntensity={1.5}
              metalness={0.3}
              roughness={0.1}
            />
          </mesh>

          {/* Blade glowing core */}
          <mesh>
            <extrudeGeometry args={[innerBladeShape, innerBladeExtrudeSettings]} />
            <meshStandardMaterial
              color={primaryColor}  // Dynamic theme based on corrupted aura
              emissive={primaryEmissive}
              emissiveIntensity={3}
              metalness={0.2}
              roughness={0.1}
              opacity={0.8}
              transparent
            />
          </mesh>
        </group>

        {/* Electrical effects */}
        {hasChainLightning && (
          <group>
            {/* Electrical aura around blade */}
            <group position={[0.25, 0.7, 0.35]} rotation={[0, -Math.PI / 2, Math.PI / 2]} scale={[0.95, 1.10, 0.95]}>
              <mesh>
                <extrudeGeometry args={[bladeShape, chainLightningBladeExtrudeSettings]} />
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={secondaryEmissive}
                  emissiveIntensity={1.5}
                  transparent
                  opacity={0.3}
                  blending={AdditiveBlending}
                />
              </mesh>
            </group>

            {/* Enhanced spark particles */}
            {sparkParticles.current.map((spark, index) => (
              <mesh
                key={index}
                position={spark.position.toArray()}
                scale={[spark.scale, spark.scale, spark.scale]}
              >
                <sphereGeometry args={[1.25, 6, 6]} />
                <meshStandardMaterial
                  color={secondaryColor}
                  emissive={secondaryEmissive}
                  emissiveIntensity={3 * spark.life}
                  transparent
                  opacity={spark.life * 0.6}
                  blending={AdditiveBlending}
                />
              </mesh>
            ))}
          </group>
        )}
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
        flatDamagePerTick={BLIZZARD_DPS_PER_TICK}
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
