import { Vector3 } from '@/utils/three-exports';
import { Health } from '@/ecs/components/Health';
import { Shield } from '@/ecs/components/Shield';
import { Entity } from '@/ecs/Entity';
import { DamageNumberManager } from '@/utils/DamageNumberManager';

export type ApplyIncomingCoopDamageOptions = {
  damage: number;
  damageType: string;
  isCritical?: boolean;
  sourceEnemyId?: string;
  playerEntity: Entity;
  health: Health;
  shield?: Shield | null;
  /** When true, short post-hit i-frames can be bypassed (PvP / server-AOE path). */
  allowPvpIframeBypass?: boolean;
  damageNumberManager?: DamageNumberManager | null;
  /** World position for floating numbers; defaults to player transform minus 0.5y. */
  damageNumberPosition?: Vector3;
};

export type ApplyIncomingCoopDamageResult = {
  damageApplied: boolean;
  healthBefore: number;
  shieldBefore?: number;
};

/** PvP / server-AOE bypass: respect Aegis/Deflect always; allow rapid hits through short hit i-frames. */
export function computeBypassInvulnerability(
  health: Health,
  allowPvpIframeBypass: boolean,
): boolean {
  if (!allowPvpIframeBypass) return false;
  const isHitIframeOnly =
    health.invulnerabilitySource !== 'aegis' && health.invulnerabilitySource !== 'deflect';
  return !health.isInvulnerable || (isHitIframeOnly && health.invulnerabilityTimer <= 1.0);
}

export function showIncomingCoopDamageNumbers(
  damageNumberManager: DamageNumberManager,
  health: Health,
  {
    damage,
    damageType,
    isCritical = false,
    sourceEnemyId,
    damageApplied,
    position,
  }: {
    damage: number;
    damageType: string;
    isCritical?: boolean;
    sourceEnemyId?: string;
    damageApplied: boolean;
    position: Vector3;
  },
): void {
  if (damageApplied) {
    damageNumberManager.addDamageNumber(damage, isCritical, position, damageType, true);
    return;
  }

  if (damage <= 0) return;

  if (health.isAegisInvulnerable()) {
    damageNumberManager.addDamageNumber(
      0,
      false,
      position,
      'aegis_blocked',
      true,
      undefined,
      undefined,
      'AEGIS',
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aegis-block'));
    }
    return;
  }

  if (health.isDeflectInvulnerable()) {
    damageNumberManager.addDamageNumber(
      0,
      false,
      position,
      'deflect_blocked',
      true,
      undefined,
      undefined,
      'DEFLECT',
    );
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('deflect-block'));
      if (health.consumeDeflectNegation()) {
        window.dispatchEvent(
          new CustomEvent('deflect-negated', { detail: { sourceEnemyId } }),
        );
      }
    }
    return;
  }

  if (health.isDodgeInvulnerable()) {
    damageNumberManager.addDamageNumber(
      0,
      false,
      position,
      'dodge_blocked',
      true,
      undefined,
      undefined,
      'DODGE',
    );
  }
}

export function applyIncomingCoopDamage({
  damage,
  damageType,
  isCritical = false,
  sourceEnemyId,
  playerEntity,
  health,
  shield,
  allowPvpIframeBypass = false,
  damageNumberManager,
  damageNumberPosition,
}: ApplyIncomingCoopDamageOptions): ApplyIncomingCoopDamageResult {
  const healthBefore = health.currentHealth;
  const shieldBefore = shield?.currentShield;
  const bypassInvulnerability = computeBypassInvulnerability(health, allowPvpIframeBypass);
  const damageApplied = health.takeDamage(
    damage,
    Date.now() / 1000,
    playerEntity,
    bypassInvulnerability,
  );

  if (damageNumberManager?.addDamageNumber && damageNumberPosition) {
    showIncomingCoopDamageNumbers(damageNumberManager, health, {
      damage,
      damageType,
      isCritical,
      sourceEnemyId,
      damageApplied,
      position: damageNumberPosition,
    });
  }

  return { damageApplied, healthBefore, shieldBefore };
}
