import { Vector3 } from '@/utils/three-exports';
import { DamageNumberManager } from '@/utils/DamageNumberManager';
import { isKnightBlocking, knightBlockBypassesDamageType } from '@/utils/knightBlockState';
import { isMedusaVoidWarping } from '@/utils/medusaVoidWarpState';

export type EnemyHitDamageNumberOpts = {
  enemyId?: string;
  enemyType?: string;
  damage: number;
  isCritical: boolean;
  position: Vector3;
  damageType?: string;
  isIncomingDamage?: boolean;
  mergeBarrageTargetEntityId?: number;
  dualCoilSlot?: 0 | 1;
  displayText?: string;
  durationHint?: 'pickup';
};

export function addEnemyHitDamageNumber(
  manager: DamageNumberManager,
  opts: EnemyHitDamageNumberOpts,
): string {
  const {
    enemyId,
    enemyType,
    damage,
    isCritical,
    position,
    damageType,
    isIncomingDamage,
    mergeBarrageTargetEntityId,
    dualCoilSlot,
    displayText,
    durationHint,
  } = opts;

  if (
    enemyId &&
    (
      (isKnightBlocking(enemyId) && (enemyType === undefined || enemyType === 'knight'))
      || (isMedusaVoidWarping(enemyId) && (enemyType === undefined || enemyType === 'medusa'))
    ) &&
    !knightBlockBypassesDamageType(damageType)
  ) {
    return manager.addDamageNumber(
      0,
      false,
      position,
      'knight_blocked',
      undefined,
      undefined,
      undefined,
      'BLOCKED',
    );
  }

  return manager.addDamageNumber(
    damage,
    isCritical,
    position,
    damageType,
    isIncomingDamage,
    mergeBarrageTargetEntityId,
    dualCoilSlot,
    displayText,
    durationHint,
  );
}
