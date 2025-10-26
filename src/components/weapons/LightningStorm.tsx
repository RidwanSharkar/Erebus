import { useRef, useMemo, memo } from 'react';
import { Group, Vector3, CylinderGeometry, SphereGeometry, OctahedronGeometry, MeshBasicMaterial, MeshStandardMaterial, Color, AdditiveBlending, RingGeometry } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { WeaponType } from '../dragon/weapons';
import { calculateDamage } from '@/core/DamageCalculator';

interface LightningStormProps {
  weaponType: WeaponType;
  position: Vector3;
  damage?: number; // Fixed damage of 117
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
  damage = 117, // Fixed damage of 117
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
  const duration = 1.0; // Shorter duration than ColossusStrike
  const flickerRef = useRef(1);
  const damageDealtRef = useRef(false);
  const isVisible = useRef(false);
  const isCompleted = useRef(false);

  // Initialize start time only once
  if (startTimeRef.current === null) {
    startTimeRef.current = Date.now() + delayStart;
  }

  // Select target: 75% chance for boss, 25% chance for random skeleton minion
  const selectedTarget = useMemo(() => {
    const bossEnemies = enemyData.filter(enemy => enemy.isBoss);
    const skeletonMinions = enemyData.filter(enemy => enemy.isSkeletonMinion);

    const rand = Math.random();
    if (rand < 0.75 && bossEnemies.length > 0) {
      // 75% chance to hit boss
      return bossEnemies[Math.floor(Math.random() * bossEnemies.length)];
    } else if (skeletonMinions.length > 0) {
      // 25% chance to hit random skeleton minion
      return skeletonMinions[Math.floor(Math.random() * skeletonMinions.length)];
    } else if (bossEnemies.length > 0) {
      // Fallback to boss if no minions available
      return bossEnemies[Math.floor(Math.random() * bossEnemies.length)];
    }

    // If no valid targets, return null
    return null;
  }, [enemyData]);

  // Calculate the sky position (directly above the target position)
  const skyPosition = useMemo(() => {
    if (selectedTarget) {
      return new Vector3(selectedTarget.position.x, selectedTarget.position.y + 20, selectedTarget.position.z);
    }
    return new Vector3(position.x, position.y + 20, position.z);
  }, [selectedTarget, position]);

  // Create more concentrated branching geometry for lightning bolt
  const mainBoltSegments = 128;
  const branchCount = 24;

  const branches = useMemo(() => {
    if (!selectedTarget) return [];

    const targetPos = selectedTarget.position;
    const distance = targetPos.clone().sub(skyPosition).length();
    const mainBolt = {
      points: Array(mainBoltSegments).fill(0).map((_, i) => {
        const t = i / (mainBoltSegments - 1);
        // More complex zigzag pattern for main bolt
        const primaryOffset = Math.sin(t * Math.PI * 8) * (1 - t) * 1.2;
        const secondaryOffset = Math.sin(t * Math.PI * 16) * (1 - t) * 0.6;
        const randomOffset = (Math.random() - 0.5) * 0.8 * (1 - t);

        return new Vector3(
          skyPosition.x + (targetPos.x - skyPosition.x) * t + primaryOffset + randomOffset,
          skyPosition.y + (targetPos.y - skyPosition.y) * (Math.pow(t, 0.7)),
          skyPosition.z + (targetPos.z - skyPosition.z) * t + secondaryOffset + randomOffset
        );
      }),
      thickness: 0.11,
      isCoreStrike: true
    };

    const secondaryBranches = Array(branchCount).fill(0).map(() => {
      const startIdx = Math.floor(Math.random() * mainBolt.points.length * 0.8);
      const startPoint = mainBolt.points[startIdx];
      const branchLength = Math.floor(Math.random() * 12) + 8; // 8-20 segments

      return {
        points: Array(branchLength).fill(0).map((_, j) => {
          const branchT = j / (branchLength - 1);
          const angle = (Math.random() - 0.5) * Math.PI * 0.8; // Spread angle
          const branchDistance = branchT * 3; // Max branch length

          return new Vector3(
            startPoint.x + Math.cos(angle) * branchDistance * (1 - branchT * 0.3),
            startPoint.y - branchT * 2, // Branches go downward
            startPoint.z + Math.sin(angle) * branchDistance * (1 - branchT * 0.3)
          );
        }),
        thickness: 0.05,
        isCoreStrike: false
      };
    });

    return [mainBolt, ...secondaryBranches];
  }, [selectedTarget, skyPosition]);

  const performLightningStormDamage = () => {
    if (damageDealtRef.current || !selectedTarget) {
      return; // Prevent multiple damage applications
    }
    damageDealtRef.current = true;

    let damageDealtFlag = false;

    // Calculate damage using centralized DamageCalculator system
    const damageResult = calculateDamage(damage, weaponType);
    const finalDamage = damageResult.damage;
    const isCritical = damageResult.isCritical;

    // Hit the selected target
    if (selectedTarget) {
      // Call onHit callback for the specific target
      if (onHit) {
        onHit(selectedTarget.id, finalDamage, isCritical);
      }

      // Also queue damage directly to combat system if available (like Smite does)
      if (combatSystem) {
        // Find the enemy entity by server enemy ID
        const allEntities = combatSystem.world?.getAllEntities() || [];
        const enemyEntity = allEntities.find((entity: any) => entity.userData?.serverEnemyId === selectedTarget.id);

        if (enemyEntity) {
          combatSystem.queueDamage(enemyEntity, finalDamage, null, 'lightning_storm', undefined);
        }
      }

      // Create damage number using CombatSystem (like ColossusStrike)
      if (combatSystem && combatSystem.damageNumberManager) {
        const damagePosition = selectedTarget.position.clone();
        damagePosition.y += 1.5; // Offset above target
        combatSystem.damageNumberManager.addDamageNumber(
          finalDamage,
          isCritical,
          damagePosition,
          'lightning_storm' // Use distinct damage type for visual styling
        );
      }

      damageDealtFlag = true;
    }

    // Notify that damage was dealt
    if (onDamageDealt) {
      onDamageDealt(damageDealtFlag);
    }
  };

  useFrame(() => {
    if (isCompleted.current) return;

    const currentTime = Date.now();
    const startTime = startTimeRef.current!;

    if (currentTime < startTime) {
      return; // Not started yet
    }

    if (!isVisible.current) {
      isVisible.current = true;
    }

    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / (duration * 1000), 1);

    // Flicker effect
    flickerRef.current = 0.8 + Math.random() * 0.4;

    // Deal damage at 60% through the animation (when bolt hits ground)
    if (progress >= 0.6 && !damageDealtRef.current) {
      performLightningStormDamage();
    }

    // Complete the effect
    if (progress >= 1) {
      if (!isCompleted.current) {
        isCompleted.current = true;
        onComplete();
      }
      return;
    }

    const fadeOut = (1.0 * (1 - progress)) * flickerRef.current;
    materials.coreBolt.opacity = fadeOut;
    materials.secondaryBolt.opacity = fadeOut * 0.8;
    materials.impact.opacity = fadeOut * 0.9;
    materials.particle.opacity = fadeOut;
  });

  // Create geometries and materials outside render (like ColossusStrike)
  const geometries = useMemo(() => ({
    bolt: new CylinderGeometry(1, 1, 1, 8),
    impact: new SphereGeometry(1, 16, 16),
    particle: new OctahedronGeometry(0.08, 0) // Diamond-shaped particles
  }), []);

  const materials = useMemo(() => ({
    coreBolt: new MeshBasicMaterial({
      color: "#FFD700", // Bright yellow core
      transparent: true,
      blending: AdditiveBlending
    }),
    secondaryBolt: new MeshBasicMaterial({
      color: "#FFA500", // Orange-yellow secondary
      transparent: true,
      opacity: 0.8,
      blending: AdditiveBlending
    }),
    impact: new MeshBasicMaterial({
      color: "#FFD700", // Golden yellow like ColossusStrike
      transparent: true,
      blending: AdditiveBlending
    }),
    particle: new MeshStandardMaterial({
      color: "#FFD700", // Bright yellow particles
      emissive: "#FFD700",
      emissiveIntensity: 0.8,
      transparent: true,
      blending: AdditiveBlending
    })
  }), []);

  // Don't render anything if not visible yet or if completed
  if (!isVisible.current || isCompleted.current || !selectedTarget) {
    return null;
  }

  return (
    <group>
      {/* Lightning branches */}
      {branches.map((branch, branchIdx) => (
        <group key={branchIdx}>
          {branch.points.map((point, idx) => (
            idx < branch.points.length - 1 && (
              <mesh
                key={idx}
                position={point.toArray()}
                geometry={geometries.bolt}
                material={branch.isCoreStrike ? materials.coreBolt : materials.secondaryBolt}
                scale={[branch.thickness, branch.thickness, branch.thickness]}
              />
            )
          ))}
        </group>
      ))}

      {/* Impact effect at target location (like ColossusStrike) */}
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
              color="#FFD700" // Golden yellow
              transparent
              opacity={(0.8 - (i * 0.15)) * (1 - (startTimeRef.current ? (Date.now() - startTimeRef.current) / (duration * 1000) : 0))}
              blending={AdditiveBlending}
            />
          </mesh>
        ))}

        {/* Enhanced lighting */}
        <pointLight
          color="#FFD700" // Golden yellow
          intensity={25 * (1 - (Date.now() - startTimeRef.current) / (duration * 1000)) * flickerRef.current}
          distance={8}
          decay={2}
        />
      </group>

      {/* Spinning diamond particles around impact */}
      {[...Array(12)].map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const spinAngle = angle + (Date.now() * 0.008); // Fast spinning
        const radius = 1.2 + (Math.sin(Date.now() * 0.01 + i) * 0.3); // Pulsing radius
        const height = (Math.sin(Date.now() * 0.007 + i * 0.8) * 0.8); // Oscillating height

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
