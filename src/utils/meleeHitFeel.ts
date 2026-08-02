import { Vector3 } from '@/utils/three-exports';

export type MeleeWeightClass = 'beast' | 'large-beast' | 'humanoid' | 'giant';

export type MeleeAttackHitPayload = {
  position?: { x?: number; y?: number; z?: number };
  impactDirection?: { x?: number; y?: number; z?: number };
  weightClass?: string;
  hitStopMs?: number;
  knockback?: { distance?: number; duration?: number } | null;
};

export function normalizeMeleeWeightClass(raw?: string | null): MeleeWeightClass {
  if (raw === 'beast' || raw === 'large-beast' || raw === 'humanoid' || raw === 'giant') {
    return raw;
  }
  return 'humanoid';
}

/** Camera shake multipliers by weight class for incoming melee. */
export function meleeShakeForWeightClass(weightClass: MeleeWeightClass, baseIntensity: number) {
  switch (weightClass) {
    case 'beast':
      return { intensity: baseIntensity * 1.05, duration: 0.14 };
    case 'large-beast':
      return { intensity: baseIntensity * 1.35, duration: 0.18 };
    case 'giant':
      return { intensity: baseIntensity * 1.75, duration: 0.26 };
    case 'humanoid':
    default:
      return { intensity: baseIntensity, duration: 0.15 };
  }
}

export function meleeImpactPosition(data: MeleeAttackHitPayload): Vector3 {
  return new Vector3(data.position?.x ?? 0, data.position?.y ?? 0, data.position?.z ?? 0);
}

export function meleeImpactDirection(data: MeleeAttackHitPayload): Vector3 {
  const d = data.impactDirection;
  if (d && (d.x !== 0 || d.z !== 0)) {
    return new Vector3(d.x ?? 0, 0, d.z ?? 0).normalize();
  }
  return new Vector3(0, 0, 1);
}

/**
 * Play weight-class melee impact SFX via window.audioSystem.
 * Falls back to templar damage clips when weight-class methods are unavailable.
 */
export function playIncomingMeleeImpactSound(
  data: MeleeAttackHitPayload,
  variantRef?: { current: 1 | 2 },
) {
  const audio = typeof window !== 'undefined' ? window.audioSystem : null;
  if (!audio) return;
  const pos = meleeImpactPosition(data);
  const wc = normalizeMeleeWeightClass(data.weightClass);

  if (typeof (audio as any).playMeleeImpactByWeightClass === 'function') {
    (audio as any).playMeleeImpactByWeightClass(wc, pos);
    return;
  }

  // Legacy fallback
  const variant = variantRef?.current ?? 1;
  audio.playTemplarDamageSound?.(pos, variant);
  if (variantRef) variantRef.current = variant === 1 ? 2 : 1;
}

export function playIncomingMeleeWhiffSound(position: { x?: number; y?: number; z?: number } | Vector3) {
  const audio = typeof window !== 'undefined' ? window.audioSystem : null;
  if (!audio) return;
  const pos =
    position instanceof Vector3
      ? position
      : new Vector3(position?.x ?? 0, position?.y ?? 0, position?.z ?? 0);
  if (typeof (audio as any).playMeleeWhiffSound === 'function') {
    (audio as any).playMeleeWhiffSound(pos);
    return;
  }
  audio.playTemplarMissSound?.(pos);
}

/** Dispatch a short local hit-stop cue for the attacking enemy (renderers may listen). */
export function dispatchMeleeHitStop(enemyId: string | undefined, hitStopMs: number | undefined) {
  if (!enemyId || !hitStopMs || hitStopMs <= 0 || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('erebus-melee-hitstop', {
      detail: { enemyId, hitStopMs: Math.min(120, hitStopMs) },
    }),
  );
}
