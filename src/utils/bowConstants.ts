/**
 * Bow primary (LMB) charge: matches legacy 60 FPS where progress += 0.0125 per tick
 * (80 ticks → full) independent of current frame rate when driven by elapsed time.
 */
export const BOW_FULL_CHARGE_MS = (1000 * 60) / 60;

/** HIGH CALIBER bow talent — full charge takes this many times baseline duration (90/60 ≈ 1.5×). */
export const BOW_HIGH_CALIBER_CHARGE_TIME_MULT = 100 / 60;

export function getBowFullChargeMs(highCaliber: boolean): number {
  return BOW_FULL_CHARGE_MS * (highCaliber ? BOW_HIGH_CALIBER_CHARGE_TIME_MULT : 1);
}

export const BOW_PERFECT_SHOT_MIN_PROGRESS = 0.75;
export const BOW_PERFECT_SHOT_MAX_PROGRESS = 0.98;

export function isBowPerfectShotProgress(progress: number): boolean {
  return (
    progress >= BOW_PERFECT_SHOT_MIN_PROGRESS && progress <= BOW_PERFECT_SHOT_MAX_PROGRESS
  );
}
