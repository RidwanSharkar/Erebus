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
  Plane,
} from '@/utils/three-exports';
import { useFrame, useThree } from '@react-three/fiber';
import { WeaponType } from '../dragon/weapons';
import { calculateDamage, DamageResult } from '@/core/DamageCalculator';
import { INFERNAL_SMITE_CRIT_CHANCE_ADD, STAGGERING_SMITE_BEAM_STAGGER } from '@/utils/talents';
import { createBeamCylinderAdditiveMaterial } from '@/utils/beamCylinderAdditiveMaterial';
import { addEnemyHitDamageNumber } from '@/utils/enemyDamageNumber';
import { queryDestructibleHarvestEntities } from '@/utils/destructibleEnvironmentTargeting';
import { Collider } from '@/ecs/components/Collider';
import { Transform } from '@/ecs/components/Transform';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  getSmiteAspectDefaultColorPair,
  type WeaponAspect,
} from '@/utils/weaponAspects';

const _hslScratch = { h: 0, s: 0, l: 0 };
const _smiteBoltLightPos = new Vector3();

/** How far below strike floor Y fragments may still render (short impact bite). */
const SMITE_UNDERFLOOR_ALLOW = 0.35;

/** Ref-count so concurrent Smites (e.g. Trinity) share localClippingEnabled safely. */
let smiteLocalClippingUsers = 0;
let smiteLocalClippingPrev: boolean | null = null;

/** Saturated, punchy smite colors (Three.js) per talent theme; aspect is lowest priority. */
function smiteVividColorPair(
  isCorrupted: boolean,
  infernal: boolean,
  infested: boolean,
  staggering: boolean,
  deflect: boolean,
  aspect?: WeaponAspect | null,
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
  } else if (deflect) {
    p.set('#fbbf24');
    s.set('#fde68a');
  } else {
    const pair = getSmiteAspectDefaultColorPair(aspect);
    p.set(pair.primary);
    s.set(pair.secondary);
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
  /** Gladiator Deflect counter — gold beam theme. */
  deflectSmiteVisual?: boolean;
  /** Flat damage override (skips weapon crit / vengeance scaling). */
  baseDamageOverride?: number;
  /** Custom damage type for combat system and floating numbers. */
  damageTypeOverride?: string;
  /** Runeblade aspect — drives default beam colors when no talent theme is active. */
  weaponAspect?: WeaponAspect | null;
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
  deflectSmiteVisual = false,
  baseDamageOverride,
  damageTypeOverride,
  weaponAspect,
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
  /** Ref-based delay does not re-render; state flips visibility once the bolt should show. */
  const [boltVisible, setBoltVisible] = useState(false);
  const { gl } = useThree();
  const minWorldY = position.y - SMITE_UNDERFLOOR_ALLOW;
  const underfloorClipPlane = useMemo(
    () => new Plane(new Vector3(0, 1, 0), -minWorldY),
    [minWorldY],
  );

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

  // corrupted > Infernal > Infested > Staggering > Deflect > aspect default — vivid `Color` for materials + lights
  const { primary: primaryColor, secondary: secondaryColor } = useMemo(
    () => smiteVividColorPair(
      isCorruptedAuraActive,
      infernalSmiteVisual,
      infestedSmiteVisual,
      staggeringSmiteVisual,
      deflectSmiteVisual,
      weaponAspect,
    ),
    [isCorruptedAuraActive, infernalSmiteVisual, infestedSmiteVisual, staggeringSmiteVisual, deflectSmiteVisual, weaponAspect],
  );

  const burstPointColor = useMemo(
    () => primaryColor.clone().lerp(secondaryColor, 0.35),
    [primaryColor, secondaryColor],
  );

  // Two pooled point lights replace the three mounted <pointLight>s: one follows the
  // falling bolt (collapses the bolt's two near-coincident lights), one for the ground burst.
  const boltLight = useDynamicLight({ color: primaryColor, distance: 28, priority: 2 });
  const burstLight = useDynamicLight({ color: burstPointColor, distance: 11, priority: 1 });

  // Enable local clipping for MeshStandardMaterial spiral/particle planes while mounted.
  useEffect(() => {
    if (smiteLocalClippingUsers === 0) {
      smiteLocalClippingPrev = gl.localClippingEnabled;
      gl.localClippingEnabled = true;
    }
    smiteLocalClippingUsers += 1;
    return () => {
      smiteLocalClippingUsers = Math.max(0, smiteLocalClippingUsers - 1);
      if (smiteLocalClippingUsers === 0 && smiteLocalClippingPrev !== null) {
        gl.localClippingEnabled = smiteLocalClippingPrev;
        smiteLocalClippingPrev = null;
      }
    };
  }, [gl]);

  const beamCylinderMaterials = useMemo(() => {
    const glow2Color = primaryColor.clone().lerp(secondaryColor, 0.42);
    const outerGlowColor = primaryColor.clone().lerp(secondaryColor, 0.52);
    return {
      core: createBeamCylinderAdditiveMaterial(primaryColor, 0.92, 0.32, 1, minWorldY),
      inner: createBeamCylinderAdditiveMaterial(primaryColor, 0.78, 0.3, 1, minWorldY),
      outer: createBeamCylinderAdditiveMaterial(primaryColor, 0.62, 0.28, 1, minWorldY),
      glow1: createBeamCylinderAdditiveMaterial(primaryColor, 0.48, 0.26, 1, minWorldY),
      glow2: createBeamCylinderAdditiveMaterial(glow2Color, 0.38, 0.24, 1, minWorldY),
      outerGlow: createBeamCylinderAdditiveMaterial(outerGlowColor, 0.22, 0.2, 1, minWorldY),
    };
  }, [primaryColor, secondaryColor, minWorldY]);

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

  useEffect(() => {
    const g = cylinderGeometries;
    return () => {
      g.core.dispose();
      g.inner.dispose();
      g.outer.dispose();
      g.glow1.dispose();
      g.glow2.dispose();
      g.outerGlow.dispose();
      g.torus.dispose();
      g.skyTorus.dispose();
      g.sphere.dispose();
      g.burstRing.dispose();
      g.burstCore.dispose();
    };
  }, [cylinderGeometries]);

  const materials = useMemo(() => ({
    ...beamCylinderMaterials,
    spiral: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 12,
      transparent: true,
      opacity: 0.48,
      clippingPlanes: [underfloorClipPlane],
      clipShadows: false,
    }),
    skySpiral: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 11,
      transparent: true,
      opacity: 0.36,
      clippingPlanes: [underfloorClipPlane],
      clipShadows: false,
    }),
    particle: new MeshStandardMaterial({
      color: primaryColor,
      emissive: secondaryColor,
      emissiveIntensity: 12,
      transparent: true,
      opacity: 0.62,
      clippingPlanes: [underfloorClipPlane],
      clipShadows: false,
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
    }), [beamCylinderMaterials, primaryColor, secondaryColor, underfloorClipPlane]);

  useEffect(() => {
    const m = materials;
    return () => {
      m.spiral.dispose();
      m.skySpiral.dispose();
      m.particle.dispose();
      m.burstRing.dispose();
      m.burstCore.dispose();
    };
  }, [materials]);

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

    const baseSmiteDamage = baseDamageOverride ?? 245;
    const useFlatDamage = baseDamageOverride != null;
    const resolvedDamageType = damageTypeOverride ?? 'smite';
    const damageRadius = 3.0; // Horizontal radius around impact (Y ignored so hovering units still hit)
    let totalDamage = 0;
    let targetsHit = 0;

    const rollSmiteHit = (): { finalDamage: number; isCritical: boolean } => {
      if (useFlatDamage) {
        return { finalDamage: Math.max(0, Math.floor(baseSmiteDamage)), isCritical: false };
      }
      const damageResult: DamageResult = infernalSmiteVisual
        ? calculateDamage(baseSmiteDamage, weaponType ?? WeaponType.RUNEBLADE, {
            critChanceAdd: INFERNAL_SMITE_CRIT_CHANCE_ADD,
          })
        : calculateDamage(baseSmiteDamage, weaponType ?? WeaponType.RUNEBLADE);
      const vengeanceMult = getVengeanceSmiteDamageMultiplier?.() ?? 1;
      return {
        finalDamage: Math.max(0, Math.floor(damageResult.damage * vengeanceMult)),
        isCritical: damageResult.isCritical,
      };
    };

    enemyData.forEach(enemy => {
      if (!enemy.health || enemy.health <= 0) return;

      const dx = enemy.position.x - position.x;
      const dz = enemy.position.z - position.z;
      const horizontalDist = Math.hypot(dx, dz);

      if (horizontalDist <= damageRadius) {
        const { finalDamage, isCritical } = rollSmiteHit();

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
            const staggerToAdd = !useFlatDamage && staggeringSmiteVisual ? STAGGERING_SMITE_BEAM_STAGGER : undefined;
            combatSystem.queueDamage(
              enemyEntity,
              finalDamage,
              null,
              resolvedDamageType,
              undefined,
              isCritical,
              undefined,
              staggerToAdd,
              !useFlatDamage && infestedSmiteVisual,
              !useFlatDamage && infernalSmiteVisual,
            );
            queuedToCombatSystem = true;
            onBeamEnemyHit?.();
          }
        }

        if (!queuedToCombatSystem && combatSystem?.damageNumberManager) {
          const damagePosition = enemy.position.clone();
          damagePosition.y += 1.5;
          addEnemyHitDamageNumber(combatSystem.damageNumberManager, {
            enemyId: enemy.id,
            damage: finalDamage,
            isCritical,
            position: damagePosition,
            damageType: resolvedDamageType,
          });
        }

        if (!queuedToCombatSystem && setDamageNumbers && nextDamageNumberId) {
          setDamageNumbers(prev => [...prev, {
            id: nextDamageNumberId.current++,
            damage: finalDamage,
            position: enemy.position.clone(),
            isCritical,
            isSmite: resolvedDamageType === 'smite',
          }]);
        }

        totalDamage += finalDamage;
        targetsHit += 1;
      }
    });

    const harvestWorld = combatSystem?.world;
    if (harvestWorld) {
      const staggerToAdd = !useFlatDamage && staggeringSmiteVisual ? STAGGERING_SMITE_BEAM_STAGGER : undefined;
      for (const entity of queryDestructibleHarvestEntities(harvestWorld)) {
        const transform = entity.getComponent(Transform);
        if (!transform) continue;
        const worldPos = transform.getWorldPosition();
        const collider = entity.getComponent(Collider);
        const radius = collider?.radius ?? 0;
        const dx = worldPos.x - position.x;
        const dz = worldPos.z - position.z;
        const horizontalDist = Math.max(0, Math.hypot(dx, dz) - radius);
        if (horizontalDist > damageRadius) continue;

        const { finalDamage, isCritical } = rollSmiteHit();
        combatSystem.queueDamage(
          entity,
          finalDamage,
          null,
          resolvedDamageType,
          undefined,
          isCritical,
          undefined,
          staggerToAdd,
          !useFlatDamage && infestedSmiteVisual,
          !useFlatDamage && infernalSmiteVisual,
        );
        totalDamage += finalDamage;
        targetsHit += 1;
      }
    }

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

      // Drive the pooled bolt light following the falling bolt (world space). Collapses
      // the bolt's two original <pointLight>s; dominant one sat at local [0, -10, 0].
      lightningRef.current.getWorldPosition(_smiteBoltLightPos);
      boltLight.current?.setPosition(_smiteBoltLightPos.x, _smiteBoltLightPos.y - 10, _smiteBoltLightPos.z);
      boltLight.current?.setIntensity(34);

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
        burstLight.current?.setIntensity(0);
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
        // Ground burst pooled light at the strike point (world space). Original local
        // [0, 0.15, 0] inside a group scaled 1.55 → ~0.23 world offset above the base y.
        burstLight.current?.setPosition(position.x, position.y + 1.075 + 0.15 * 1.55, position.z);
        burstLight.current?.setIntensity(30 * (1 - bt));
        burstLight.current?.setDistance(5 + easeOut * 4);
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

      {/* Bolt point lights now driven via the shared dynamic light pool (see useFrame). */}
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
      {/* Ground burst point light now driven via the shared dynamic light pool (see useFrame). */}
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
  if (prevProps.deflectSmiteVisual !== nextProps.deflectSmiteVisual) return false;
  if (prevProps.weaponAspect !== nextProps.weaponAspect) return false;
  if ((prevProps.sequenceDelaySec ?? 0) !== (nextProps.sequenceDelaySec ?? 0)) return false;
  if (prevProps.onBeamEnemyHit !== nextProps.onBeamEnemyHit) return false;
  if (!!prevProps.getVengeanceSmiteDamageMultiplier !== !!nextProps.getVengeanceSmiteDamageMultiplier) return false;

  return true;
});

export default SmiteComponent;
