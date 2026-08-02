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

/** Optional Tiger Evasion chance provider (0–1). Set by CoopGameScene. */
let petEvasionChanceProvider: (() => number) | null = null;

export function setPetEvasionChanceProvider(provider: (() => number) | null): void {
  petEvasionChanceProvider = provider;
}

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

/** Floating "MISS" when an enemy attack fails to connect (out of range / arrow miss). */
export function showIncomingAttackMissNumber(
  damageNumberManager: DamageNumberManager,
  position: Vector3,
): void {
  damageNumberManager.addDamageNumber(
    0,
    false,
    position,
    'attack_missed',
    true,
    undefined,
    undefined,
    'MISS',
  );
}

/**
 * True when a melee/shot telegraph is aimed at the local player (not a combat ally / pet).
 * Server emits `targetCombatAllyId` when swinging at pets so owners do not see false MISS.
 */
export function isLocalPlayerMeleeTelegraphTarget(
  data: { targetPlayerId?: string; targetCombatAllyId?: string },
  localPlayerId: string | undefined,
): boolean {
  if (!localPlayerId || data.targetCombatAllyId) return false;
  return data.targetPlayerId === localPlayerId;
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

  const evasionChance = petEvasionChanceProvider?.() ?? 0;
  if (evasionChance > 0 && damage > 0 && Math.random() < evasionChance) {
    if (damageNumberManager?.addDamageNumber && damageNumberPosition) {
      damageNumberManager.addDamageNumber(
        0,
        false,
        damageNumberPosition,
        'dodge_blocked',
        true,
        undefined,
        undefined,
        'DODGE',
      );
    }
    return { damageApplied: false, healthBefore, shieldBefore };
  }

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
