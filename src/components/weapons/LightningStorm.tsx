import { useRef, useMemo, useCallback, memo } from 'react';
import { Vector3 } from '@/utils/three-exports';
import { WeaponType } from '../dragon/weapons';
import { calculateDamage } from '@/core/DamageCalculator';
import { LIGHTNING_BOLT_ROOM_DAMAGE, LIGHTNING_BOLT_ROOM_STAGGER } from '@/utils/talents';
import DirectionalProcLightning from '@/components/enemies/DirectionalProcLightning';
import { YELLOW_ROOM_PALETTE, PROC_LIGHTNING_SKY_Y } from '@/components/enemies/StaggerProcLightning';

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
  damage = LIGHTNING_BOLT_ROOM_DAMAGE,
  staggerToAdd = LIGHTNING_BOLT_ROOM_STAGGER,
  onComplete,
  onHit,
  onDamageDealt,
  enemyData = [],
  combatSystem
}: LightningStormProps) {
  const damageDealtRef = useRef(false);

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
    if (!selectedTarget) {
      return null;
    }
    return new Vector3(
      selectedTarget.position.x,
      selectedTarget.position.y + PROC_LIGHTNING_SKY_Y,
      selectedTarget.position.z,
    );
  }, [selectedTarget]);

  const performLightningStormDamage = useCallback(() => {
    if (damageDealtRef.current || !selectedTarget) {
      return;
    }
    damageDealtRef.current = true;

    let damageDealtFlag = false;

    const damageResult = calculateDamage(damage, weaponType);
    const finalDamage = damageResult.damage;
    const isCritical = damageResult.isCritical;

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

    if (onDamageDealt) {
      onDamageDealt(damageDealtFlag);
    }
  }, [combatSystem, damage, onDamageDealt, onHit, selectedTarget, staggerToAdd, weaponType]);

  const handleBoltComplete = useCallback(() => {
    performLightningStormDamage();
    onComplete();
  }, [onComplete, performLightningStormDamage]);

  if (!selectedTarget || !skyPosition) {
    return null;
  }

  return (
    <DirectionalProcLightning
      from={skyPosition}
      to={selectedTarget.position}
      palette={YELLOW_ROOM_PALETTE}
      onComplete={handleBoltComplete}
    />
  );
});

export default LightningStormComponent;
