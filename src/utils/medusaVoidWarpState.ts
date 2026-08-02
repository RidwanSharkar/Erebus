/** Client-side Medusa VOIDWARP windows — synced from `medusa-voidwarp-telegraph`. */

const voidWarpActiveUntil = new Map<string, number>();

export function registerMedusaVoidWarp(
  medusaId: string,
  durationMs: number,
  timestamp: number = Date.now(),
): void {
  const until = timestamp + durationMs;
  const prev = voidWarpActiveUntil.get(medusaId) ?? 0;
  voidWarpActiveUntil.set(medusaId, Math.max(prev, until));
}

export function isMedusaVoidWarping(medusaId: string, now: number = Date.now()): boolean {
  const until = voidWarpActiveUntil.get(medusaId);
  return !!until && now < until;
}

export function clearMedusaVoidWarp(medusaId: string): void {
  voidWarpActiveUntil.delete(medusaId);
}
