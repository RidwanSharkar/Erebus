import { useRef, useMemo, useState, memo, useEffect } from 'react';
import {
  Group,
  Vector3,
  Color,
  MathUtils,
  CylinderGeometry,
  TorusGeometry,
  SphereGeometry,
  RingGeometry,
  CircleGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  Euler,
  AdditiveBlending,
  DoubleSide,
  Mesh,
  PointLight,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { WeaponType } from '../dragon/weapons';
import { calculateDamage, DamageResult } from '@/core/DamageCalculator';
import { INFERNAL_SMITE_CRIT_CHANCE_ADD, STAGGERING_SMITE_BEAM_STAGGER } from '@/utils/talents';
import { createBeamCylinderAdditiveMaterial } from '@/utils/beamCylinderAdditiveMaterial';

const _hslScratch = { h: 0, s: 0, l: 0 };

/** Saturated, punchy smite colors (Three.js) per talent theme. */
function smiteVividColorPair(
  isCorrupted: boolean,
  infernal: boolean,
  infested: boolean,
  staggering: boolean,
): { primary: Color; secondary: Color } {
  const p = new Color();
  const s = new Color();
  if (isCorrupted) {
    p.set('#ff2222');
    s.set('#ff8c8c');
  } else if (infernal) {
    p.set('#e01510');
    s.set('#ff8f1a');
  } else if (infested) {
    p.set('#00e65c');
    s.set('#8fff9a');
  } else if (staggering) {
    p.set('#00b8ff');
    s.set('#a8f0ff');
  } else {
    p.set('#ff8c00');
    s.set('#ffe033');
  }
  p.getHSL(_hslScratch);
  p.setHSL(
    _hslScratch.h,
    MathUtils.clamp(_hslScratch.s * 1.18, 0, 1),
    MathUtils.clamp(_hslScratch.l * 1.07, 0.22, 0.88),
  );
  s.getHSL(_hslScratch);
  s.setHSL(
    _hslScratch.h,
    MathUtils.clamp(_hslScratch.s * 1.22, 0, 1),
    MathUtils.clamp(_hslScratch.l * 1.1, 0.28, 0.95),
  );
  return { primary: p, secondary: s };
}

interface SmiteProps {
  weaponType: WeaponType;
  position: Vector3;
  onComplete: () => void;
  onHit?: (targetId: string, damage: number) => void;
  onDamageDealt?: (totalDamage: number, meta?: { targetsHit: number }) => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
  }>;
  playerPosition?: Vector3;
  setDamageNumbers?: (callback: (prev: Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSmite?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isSmite?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  combatSystem?: any; // CombatSystem for creating damage numbers
  isCorruptedAuraActive?: boolean; // Whether corrupted aura is active (affects colors and damage)
  /** Infested Smite talent — green beam theme. */
  infestedSmiteVisual?: boolean;
  /** Staggering Smite talent — blue beam theme. */
  staggeringSmiteVisual?: boolean;
  /** Infernal Smite talent — red fiery orange beam (visual priority below corrupted, above infested/staggering). */
  infernalSmiteVisual?: boolean;
  /** Extra seconds before the bolt begins (TRINITY follow-up strikes). */
  sequenceDelaySec?: number;
  /** Local player: invoked once per PvE enemy hit when beam damage is applied (e.g. Colossus Guard proc). */
  onBeamEnemyHit?: () => void;
  /** Local caster: Vengeance talent — called at strike time; scales damage after crit roll. */
  getVengeanceSmiteDamageMultiplier?: () => number;
}

const SmiteComponent = memo(function Smite({
  weaponType,
  position,
  onComplete,
  onHit,
  onDamageDealt,
  enemyData = [],
  setDamageNumbers,
  nextDamageNumberId,
  combatSystem,
  isCorruptedAuraActive = false,
  infestedSmiteVisual = false,
  staggeringSmiteVisual = false,
  infernalSmiteVisual = false,
  sequenceDelaySec = 0,
  onBeamEnemyHit,
  getVengeanceSmiteDamageMultiplier,
}: SmiteProps) {
  const lightningRef = useRef<Group>(null);
  const progressRef = useRef(0);
  const animationDuration = 1.0; // Extended animation duration to ensure full visibility in PVP mode
  const delayTimer = useRef(0);
  const startDelay = 0.05; // Initial delay
  const gateDelay = startDelay + sequenceDelaySec;
  const damageTriggered = useRef(false);
  /** Ground explosion phase 0→1 after impact (ref-driven; no extra React renders). */
  const groundBurstT = useRef(0);
  const burstRingRef = useRef<Mesh>(null);
  const burstCoreRef = useRef<Mesh>(null);
  const burstLightRef = useRef<PointLight | null>(null);
  /** Ref-based delay does not re-render; state flips visibility once the bolt should show. */
  const [boltVisible, setBoltVisible] = useState(false);

  // useMemo for static geometries — tight column, reduced outer halo
  const cylinderGeometries = useMemo(() => ({
    core: new CylinderGeometry(0.055, 0.055, 20, 20),
    inner: new CylinderGeometry(0.14, 0.12, 20, 20),
    outer: new CylinderGeometry(0.26, 0.24, 20, 18),
    glow1: new CylinderGeometry(0.3, 0.32, 20, 16),
    glow2: new CylinderGeometry(0.34, 0.36, 20, 16),
    outerGlow: new CylinderGeometry(0.38, 0.48, 20, 16),
    torus: new TorusGeometry(0.65, 0.055, 8, 32),
    skyTorus: new TorusGeometry(0.5, 0.055, 32, 32),
    sphere: new SphereGeometry(0.1, 8, 8),
    burstRing: new RingGeometry(0.1, 0.38, 40),
    burstCore: new CircleGeometry(0.58, 24),
  }), []);

  // corrupted > Infernal > Infested > Staggering > default — vivid `Color` for materials + lights
  const { primary: primaryColor, secondary: secondaryColor } = useMemo(
    () => smiteVividColorPair(
      isCorruptedAuraActive,
      infernalSmiteVisual,
      infestedSmiteVisual,
      staggeringSmiteVisual,
    ),
    [isCorruptedAuraActive, infernalSmiteVisual, infestedSmiteVisual, staggeringSmiteVisual],
  );

  const burstPointColor = useMemo(
    () => primaryColor.clone().lerp(secondaryColor, 0.35),
    [primaryColor, secondaryColor],
  );

  const beamCylinderMaterials = useMemo(() => {
    const glow2Color = primaryColor.clone().lerp(secondaryColor, 0.42);
    const outerGlowColor = primaryColor.clone().lerp(secondaryColor, 0.52);
    return {
      core: createBeamCylinderAdditiveMaterial(primaryColor, 0.92, 0.32),
      inner: createBeamCylinderAdditiveMaterial(primaryColor, 0.78, 0.3),
      outer: createBeamCylinderAdditiveMaterial(primaryColor, 0.62, 0.28),
      glow1: createBeamCylinderAdditiveMaterial(primaryColor, 0.48, 0.26),
      glow2: createBeamCylinderAdditiveMaterial(glow2Color, 0.38, 0.24),
      outerGlow: createBeamCylinderAdditiveMaterial(outerGlowColor, 0.22, 0.2),
    };
  }, [primaryColor, secondaryColor]);

  useEffect(() => {
    const m = beamCylinderMaterials;
    return () => {
      m.core.dispose();
      m.inner.dispose();
      m.outer.dispose();
      m.glow1.dispose();
      m.glow2.dispose();
      m.outerGlow.dispose();
    };
  }, [beamCylinderMaterials]);

  const materials = useMemo(() => ({
    ...beamCylinderMaterials,
    spiral: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 12,
      transparent: true,
      opacity: 0.48,
    }),
    skySpiral: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 11,
      transparent: true,
      opacity: 0.36,
    }),
    particle: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 12,
      transparent: true,
      opacity: 0.62,
    }),
    burstRing: new MeshBasicMaterial({
      color: primaryColor,
      transparent: true,
      opacity: 0.92,
      blending: AdditiveBlending,
      depthWrite: false,
      side: DoubleSide,
    }),
      burstCore: new MeshBasicMaterial({
        color: secondaryColor,
        transparent: true,
        opacity: 0.78,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      }),
    }), [beamCylinderMaterials, primaryColor, secondaryColor]);

  // Pre-calculate spiral positions
  const spiralPositions = useMemo(() => (
    Array(3).fill(0).map((_, i) => ({
      rotation: new Euler(Math.PI / 4, (i * Math.PI) / 1.5, Math.PI)
    }))
  ), []);

  // Pre-calculate sky spiral positions — fewer rings, tighter column read
  const skySpiralPositions = useMemo(() => (
    Array(10).fill(0).map((_, i) => ({
      rotation: new Euler(0, (i * Math.PI) / 1.5, 0),
      position: new Vector3(0, 5.5, 0),
    }))
  ), []);

  const particlePositions = useMemo(() => (
    Array(6).fill(0).map((_, i) => ({
      position: new Vector3(
        Math.cos((i * Math.PI) / 3) * 0.45,
        (i - 3) * 1.35,
        Math.sin((i * Math.PI) / 3) * 0.45,
      ),
    }))
  ), []);

  // Function to perform damage in a radius around the impact location
  const performSmiteDamage = () => {
    if (damageTriggered.current) return;
    damageTriggered.current = true;

    const baseSmiteDamage = 205;
    const damageRadius = 3.0; // Horizontal radius around impact (Y ignored so hovering units still hit)
    let totalDamage = 0;
    let targetsHit = 0;

    enemyData.forEach(enemy => {
      if (!enemy.health || enemy.health <= 0) return;

      const dx = enemy.position.x - position.x;
      const dz = enemy.position.z - position.z;
      const horizontalDist = Math.hypot(dx, dz);

      if (horizontalDist <= damageRadius) {
        // Calculate critical hit damage (Corrupted Aura bonuses are already applied via global rune count modifications)
        const damageResult: DamageResult = infernalSmiteVisual
          ? calculateDamage(baseSmiteDamage, weaponType ?? WeaponType.RUNEBLADE, {
              critChanceAdd: INFERNAL_SMITE_CRIT_CHANCE_ADD,
            })
          : calculateDamage(baseSmiteDamage, weaponType ?? WeaponType.RUNEBLADE);
        const vengeanceMult = getVengeanceSmiteDamageMultiplier?.() ?? 1;
        const finalDamage = Math.max(0, Math.floor(damageResult.damage * vengeanceMult));

        // Enemy is within damage radius - deal damage
        if (onHit) {
          onHit(enemy.id, finalDamage); // Pass target ID and damage amount
        }

        // Queue damage on the combat system when we can resolve the enemy entity.
        // applyDamage() already spawns the floating damage number — do not also add one here or it doubles.
        let queuedToCombatSystem = false;
        if (combatSystem) {
          const allEntities = combatSystem.world?.getAllEntities() || [];
          const enemyEntity = allEntities.find((entity: any) => entity.userData?.serverEnemyId === enemy.id);

          if (enemyEntity) {
            const staggerToAdd = staggeringSmiteVisual ? STAGGERING_SMITE_BEAM_STAGGER : undefined;
            combatSystem.queueDamage(
              enemyEntity,
              finalDamage,
              null,
              'smite',
              undefined,
              damageResult.isCritical,
              undefined,
              staggerToAdd,
              infestedSmiteVisual,
              infernalSmiteVisual,
            );
            queuedToCombatSystem = true;
            onBeamEnemyHit?.();
          }
        }

        if (!queuedToCombatSystem && combatSystem?.damageNumberManager) {
          const damagePosition = enemy.position.clone();
          damagePosition.y += 1.5;
          combatSystem.damageNumberManager.addDamageNumber(
            finalDamage,
            damageResult.isCritical,
            damagePosition,
            'smite',
          );
        }

        if (!queuedToCombatSystem && setDamageNumbers && nextDamageNumberId) {
          setDamageNumbers(prev => [...prev, {
            id: nextDamageNumberId.current++,
            damage: finalDamage,
            position: enemy.position.clone(),
            isCritical: damageResult.isCritical,
            isSmite: true,
          }]);
        }

        totalDamage += finalDamage;
        targetsHit += 1;
      }
    });

    if (onDamageDealt) {
      onDamageDealt(totalDamage, { targetsHit });
    }
  };

  useFrame((_, delta) => {
    if (!lightningRef.current) return;

    // Handle delay before starting the lightning effect
    if (delayTimer.current < gateDelay) {
      delayTimer.current += delta;
      if (delayTimer.current >= gateDelay) {
        setBoltVisible(true);
      }
      if (delayTimer.current < gateDelay) {
        return;
      }
    }

    progressRef.current += delta;
    const progress = Math.min(progressRef.current / animationDuration, 1);

    // Animate the lightning bolt
    if (progress < 1) {
      // Start from high up and strike down to target position
      const startY = position.y + 40;
      const targetY = position.y;
      const currentY = startY + (targetY - startY) * progress;
      lightningRef.current.position.y = currentY;

      if (!damageTriggered.current) {
        groundBurstT.current = 0;
        if (burstRingRef.current) {
          burstRingRef.current.scale.set(0.001, 0.001, 1);
          (burstRingRef.current.material as MeshBasicMaterial).opacity = 0;
        }
        if (burstCoreRef.current) {
          burstCoreRef.current.scale.set(0.001, 0.001, 1);
          (burstCoreRef.current.material as MeshBasicMaterial).opacity = 0;
        }
        if (burstLightRef.current) burstLightRef.current.intensity = 0;
      }

      // Trigger damage when bolt hits the ground (around 80% progress)
      if (progress >= 0.8 && !damageTriggered.current) {
        performSmiteDamage();
      }

      if (damageTriggered.current) {
        groundBurstT.current = Math.min(groundBurstT.current + delta * 3.8, 1);
        const bt = groundBurstT.current;
        const easeOut = 1 - Math.pow(1 - bt, 2);
        const ring = burstRingRef.current;
        const core = burstCoreRef.current;
        const bl = burstLightRef.current;
        if (ring) {
          const s = 0.35 + easeOut * 2.4;
          ring.scale.set(s, s, 1);
          const m = ring.material as MeshBasicMaterial;
          m.opacity = 0.85 * (1 - bt);
        }
        if (core) {
          const cs = 0.2 + easeOut * 2.2;
          core.scale.set(cs, cs, 1);
          const m = core.material as MeshBasicMaterial;
          m.opacity = 0.7 * (1 - Math.min(bt * 1.4, 1));
        }
        if (bl) {
          bl.intensity = 30 * (1 - bt);
          bl.distance = 5 + easeOut * 4;
        }
      }

      // Adjust scale effect
      const scale = progress < 0.9 ? 1 : 1 - (progress - 0.9) / 0.1;
      lightningRef.current.scale.set(scale, scale, scale);
    } else {
      onComplete();
    }
  });

  return (
    <group>
    <group
      ref={lightningRef}
      position={[position.x, position.y + 40, position.z]}
      visible={boltVisible}
    >
      {/* Core lightning bolts using shared geometries and materials */}
      <mesh geometry={cylinderGeometries.core} material={materials.core} />
      <mesh geometry={cylinderGeometries.inner} material={materials.inner} />
      <mesh geometry={cylinderGeometries.outer} material={materials.outer} />
      <mesh geometry={cylinderGeometries.glow1} material={materials.glow1} />
      <mesh geometry={cylinderGeometries.glow2} material={materials.glow2} />
      <mesh geometry={cylinderGeometries.outerGlow} material={materials.outerGlow} />

      {/* Spiral effect using pre-calculated positions */}
      {spiralPositions.map((props, i) => (
        <mesh key={i} rotation={props.rotation} geometry={cylinderGeometries.torus} material={materials.spiral} />
      ))}

      {/* Sky spiral effect using pre-calculated positions */}
      {skySpiralPositions.map((props, i) => (
        <mesh key={i} rotation={props.rotation} position={props.position} geometry={cylinderGeometries.skyTorus} material={materials.skySpiral} />
      ))}

      {/* Floating particles using pre-calculated positions */}
      {particlePositions.map((props, i) => (
        <mesh key={i} position={props.position} geometry={cylinderGeometries.sphere} material={materials.particle} />
      ))}

      <pointLight position={[0, -10, 0]} color={primaryColor} intensity={34} distance={28} />
      <pointLight position={[0, 0, 0]} color={secondaryColor} intensity={11} distance={5.5} />
    </group>

    {/* Small ground burst at strike point (sibling so not parented to falling bolt) */}
    <group position={[position.x, position.y + 1.075, position.z]} scale={[1.55, 1.55, 1.55]} visible={boltVisible}>
      <mesh
        ref={burstRingRef}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={cylinderGeometries.burstRing}
        material={materials.burstRing}
        renderOrder={1}
      />
      <mesh
        ref={burstCoreRef}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={cylinderGeometries.burstCore}
        material={materials.burstCore}
        renderOrder={2}
      />
      <pointLight
        ref={burstLightRef}
        position={[0, 0.15, 0]}
        color={burstPointColor}
        intensity={0}
        distance={11}
      />
    </group>
    </group>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
  if (prevProps.weaponType !== nextProps.weaponType) return false;
  if (!prevProps.position.equals(nextProps.position)) return false;
  if ((prevProps.enemyData?.length || 0) !== (nextProps.enemyData?.length || 0)) return false;

  if (prevProps.enemyData && nextProps.enemyData) {
    for (let i = 0; i < prevProps.enemyData.length; i++) {
      const prev = prevProps.enemyData[i];
      const next = nextProps.enemyData[i];
      if (!prev || !next) return false;
      if (prev.id !== next.id || prev.health !== next.health || !prev.position.equals(next.position)) {
        return false;
      }
    }
  }

  if (prevProps.playerPosition && nextProps.playerPosition) {
    if (!prevProps.playerPosition.equals(nextProps.playerPosition)) return false;
  } else if (prevProps.playerPosition !== nextProps.playerPosition) {
    return false;
  }

  if (prevProps.isCorruptedAuraActive !== nextProps.isCorruptedAuraActive) return false;
  if (prevProps.infestedSmiteVisual !== nextProps.infestedSmiteVisual) return false;
  if (prevProps.staggeringSmiteVisual !== nextProps.staggeringSmiteVisual) return false;
  if (prevProps.infernalSmiteVisual !== nextProps.infernalSmiteVisual) return false;
  if ((prevProps.sequenceDelaySec ?? 0) !== (nextProps.sequenceDelaySec ?? 0)) return false;
  if (prevProps.onBeamEnemyHit !== nextProps.onBeamEnemyHit) return false;
  if (!!prevProps.getVengeanceSmiteDamageMultiplier !== !!nextProps.getVengeanceSmiteDamageMultiplier) return false;

  return true;
});

export default SmiteComponent;
