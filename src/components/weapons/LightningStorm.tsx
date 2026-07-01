import { useRef, useMemo, useEffect, memo } from 'react';
import { Vector3, SphereGeometry, OctahedronGeometry, MeshBasicMaterial, MeshStandardMaterial, Color, AdditiveBlending } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { WeaponType } from '../dragon/weapons';
import { calculateDamage } from '@/core/DamageCalculator';
import { LIGHTNING_BOLT_ROOM_DAMAGE, LIGHTNING_BOLT_ROOM_STAGGER } from '@/utils/talents';
import DirectionalProcLightning, { type DirectionalProcLightningPalette } from '@/components/enemies/DirectionalProcLightning';

const LIGHTNING_STORM_LIGHT_COLOR = new Color('#FFD700');

const GOLD_PALETTE: DirectionalProcLightningPalette = {
  core: '#fff7ad',
  glow: '#FFD700',
  halo: '#FFA500',
  light: '#FFD700',
};

interface LightningStormProps {
  weaponType: WeaponType;
  position: Vector3;
  damage?: number;
  staggerToAdd?: number;
  delayStart?: number;
  onComplete: () => void;
  onHit?: (targetId: string, damage: number, isCritical?: boolean) => void;
  onDamageDealt?: (damageDealt: boolean) => void;
  enemyData?: Array<{
    id: string;
    position: Vector3;
    health: number;
    isBoss?: boolean;
    isSkeletonMinion?: boolean;
  }>;
  targetPlayerData?: Array<{
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
    isLightningStorm?: boolean;
  }>) => Array<{
    id: number;
    damage: number;
    position: Vector3;
    isCritical: boolean;
    isLightningStorm?: boolean;
  }>) => void;
  nextDamageNumberId?: { current: number };
  combatSystem?: any; // CombatSystem for creating damage numbers
}

const LightningStormComponent = memo(function LightningStorm({
  weaponType,
  position,
  damage = LIGHTNING_BOLT_ROOM_DAMAGE,
  staggerToAdd = LIGHTNING_BOLT_ROOM_STAGGER,
  delayStart = 0,
  onComplete,
  onHit,
  onDamageDealt,
  enemyData = [],
  targetPlayerData = [],
  playerPosition,
  setDamageNumbers,
  nextDamageNumberId,
  combatSystem
}: LightningStormProps) {
  const startTimeRef = useRef<number | null>(null);
  const duration = 1.0;
  const flickerRef = useRef(1);
  const damageDealtRef = useRef(false);
  const isVisible = useRef(false);
  const isCompleted = useRef(false);

  const stormLight = useDynamicLight({ color: LIGHTNING_STORM_LIGHT_COLOR, distance: 8, decay: 2, priority: 1 });

  if (startTimeRef.current === null) {
    startTimeRef.current = Date.now() + delayStart;
  }

  // Lock in a single random target on first render and never re-roll.
  // enemyData is a new array reference on every parent re-render, so useMemo
  // would re-roll the random pick mid-animation causing the bolt to jump targets.
  const selectedTargetRef = useRef<typeof enemyData[0] | null>(null);
  const targetLockedRef = useRef(false);
  if (!targetLockedRef.current) {
    targetLockedRef.current = true;
    selectedTargetRef.current = enemyData.length > 0
      ? enemyData[Math.floor(Math.random() * enemyData.length)]
      : null;
  }
  const selectedTarget = selectedTargetRef.current;

  const skyPosition = useMemo(() => {
    if (selectedTarget) {
      return new Vector3(selectedTarget.position.x, selectedTarget.position.y + 20, selectedTarget.position.z);
    }
    return new Vector3(position.x, position.y + 20, position.z);
  }, [selectedTarget, position]);

  const performLightningStormDamage = () => {
    if (damageDealtRef.current || !selectedTarget) {
      return;
    }
    damageDealtRef.current = true;

    let damageDealtFlag = false;

    const damageResult = calculateDamage(damage, weaponType);
    const finalDamage = damageResult.damage;
    const isCritical = damageResult.isCritical;

    if (selectedTarget) {
      if (onHit) {
        onHit(selectedTarget.id, finalDamage, isCritical);
      }

      let queuedToCombatSystem = false;
      if (combatSystem) {
        const allEntities = combatSystem.world?.getAllEntities() || [];
        const enemyEntity = allEntities.find((entity: any) => entity.userData?.serverEnemyId === selectedTarget.id);

        if (enemyEntity) {
          combatSystem.queueDamage(
            enemyEntity,
            finalDamage,
            null,
            'lightning_storm',
            undefined,
            isCritical,
            undefined,
            staggerToAdd > 0 ? staggerToAdd : undefined,
          );
          queuedToCombatSystem = true;
        }
      }

      if (!queuedToCombatSystem && combatSystem?.damageNumberManager) {
        const damagePosition = selectedTarget.position.clone();
        damagePosition.y += 1.5;
        combatSystem.damageNumberManager.addDamageNumber(
          finalDamage,
          isCritical,
          damagePosition,
          'lightning_storm',
        );
      }

      damageDealtFlag = true;
    }

    if (onDamageDealt) {
      onDamageDealt(damageDealtFlag);
    }
  };

  useFrame(() => {
    if (isCompleted.current) return;

    const currentTime = Date.now();
    const startTime = startTimeRef.current!;

    if (currentTime < startTime) {
      return;
    }

    if (!isVisible.current) {
      isVisible.current = true;
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / (duration * 1000), 1);

    flickerRef.current = 0.8 + Math.random() * 0.4;

    if (progress >= 0.6 && !damageDealtRef.current) {
      performLightningStormDamage();
    }

    if (progress >= 1) {
      if (!isCompleted.current) {
        isCompleted.current = true;
        onComplete();
      }
      return;
    }

    const fadeOut = (1.0 * (1 - progress)) * flickerRef.current;
    materials.impact.opacity = fadeOut * 0.9;
    materials.particle.opacity = fadeOut;

    if (selectedTarget) {
      const tp = selectedTarget.position;
      stormLight.current?.setPosition(tp.x, tp.y, tp.z);
      stormLight.current?.setIntensity(25 * (1 - progress) * flickerRef.current);
    }
  });

  const geometries = useMemo(() => ({
    impact: new SphereGeometry(1, 16, 16),
    particle: new OctahedronGeometry(0.08, 0),
  }), []);

  const materials = useMemo(() => ({
    impact: new MeshBasicMaterial({
      color: '#FFD700',
      transparent: true,
      blending: AdditiveBlending
    }),
    particle: new MeshStandardMaterial({
      color: '#FFD700',
      emissive: '#FFD700',
      emissiveIntensity: 0.8,
      transparent: true,
      blending: AdditiveBlending
    })
  }), []);

  useEffect(() => {
    return () => {
      Object.values(geometries).forEach(g => g.dispose());
      Object.values(materials).forEach(m => m.dispose());
    };
  }, [geometries, materials]);

  if (!isVisible.current || isCompleted.current || !selectedTarget) {
    return null;
  }

  return (
    <group>
      {/* Segmented lightning bolt (DirectionalProcLightning style) */}
      <DirectionalProcLightning
        from={skyPosition}
        to={selectedTarget.position}
        palette={GOLD_PALETTE}
        durationMs={620}
        suppressImpactLight
        onComplete={() => {}}
      />

      {/* Impact effect at target location */}
      <group position={selectedTarget.position.toArray()}>
        <mesh
          geometry={geometries.impact}
          material={materials.impact}
          scale={[1, 1, 1]}
        />

        {/* Impact rings */}
        {[1, 1.4, 1.8].map((size, i) => (
          <mesh
            key={i}
            rotation={[Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI]}
          >
            <ringGeometry args={[size, size + 0.2, 32]} />
            <meshBasicMaterial
              color='#FFD700'
              transparent
              opacity={(0.8 - (i * 0.15)) * (1 - (startTimeRef.current ? (Date.now() - startTimeRef.current) / (duration * 1000) : 0))}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}
      </group>

      {/* Spinning diamond particles around impact */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const spinAngle = angle + (Date.now() * 0.008);
        const radius = 1.2 + (Math.sin(Date.now() * 0.01 + i) * 0.3);
        const height = (Math.sin(Date.now() * 0.007 + i * 0.8) * 0.8);

        return (
          <mesh
            key={`lightning-particle-${i}`}
            position={[
              selectedTarget.position.x + Math.sin(spinAngle) * radius,
              selectedTarget.position.y + height + 0.5,
              selectedTarget.position.z + Math.cos(spinAngle) * radius
            ]}
            rotation={[Date.now() * 0.01 + i, Date.now() * 0.008 + i, Date.now() * 0.006 + i]}
            geometry={geometries.particle}
            material={materials.particle}
          />
        );
      })}

      {/* Additional floating diamond particles */}
      {[...Array(8)].map((_, i) => {
        const angle = (i / 8) * Math.PI * 2 + (Date.now() * 0.003);
        const radius = 0.6;
        const height = 0.8 + (Math.sin(Date.now() * 0.005 + i) * 0.4);

        return (
          <mesh
            key={`floating-particle-${i}`}
            position={[
              selectedTarget.position.x + Math.sin(angle) * radius,
              selectedTarget.position.y + height,
              selectedTarget.position.z + Math.cos(angle) * radius
            ]}
            rotation={[Date.now() * 0.008 + i * 0.5, Date.now() * 0.006 + i * 0.3, Date.now() * 0.004 + i * 0.7]}
            geometry={geometries.particle}
            material={materials.particle}
            scale={[0.6, 0.6, 0.6]}
          />
        );
      })}
    </group>
  );
});

export default LightningStormComponent;
