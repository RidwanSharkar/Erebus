/**
 * Bow primary (LMB) charge: matches legacy 60 FPS where progress += 0.0125 per tick
 * (80 ticks → full) independent of current frame rate when driven by elapsed time.
 */
export const BOW_FULL_CHARGE_MS = (1000 * 70) / 60;

export const BOW_PERFECT_SHOT_MIN_PROGRESS = 0.75;
export const BOW_PERFECT_SHOT_MAX_PROGRESS = 0.98;

export function isBowPerfectShotProgress(progress: number): boolean {
  return (
    progress >= BOW_PERFECT_SHOT_MIN_PROGRESS && progress <= BOW_PERFECT_SHOT_MAX_PROGRESS
  );
}
