export interface DpsSnapshot {
  currentDps: number;
  totalDamage: number;
  peakDps: number;
  recentDamage: number;
}

interface DpsHit {
  eventId: number;
  damage: number;
  timestamp: number;
}

export class DpsTracker {
  private readonly windowMs: number;
  private hits: DpsHit[] = [];
  private seenEventIds = new Set<number>();
  private totalDamage = 0;
  private peakDps = 0;

  constructor(windowMs: number = 5000) {
    this.windowMs = windowMs;
  }

  public recordDamage(eventId: number, damage: number, timestamp: number = Date.now()): void {
    if (!Number.isFinite(eventId) || this.seenEventIds.has(eventId)) return;
    if (!Number.isFinite(damage) || damage <= 0) return;

    const hit = {
      eventId,
      damage,
      timestamp,
    };

    this.hits.push(hit);
    this.seenEventIds.add(eventId);
    this.totalDamage += damage;

    const snapshot = this.getSnapshot(timestamp);
    this.peakDps = Math.max(this.peakDps, snapshot.currentDps);
  }

  public getSnapshot(now: number = Date.now()): DpsSnapshot {
    this.prune(now);

    const recentDamage = this.hits.reduce((sum, hit) => sum + hit.damage, 0);
    if (this.hits.length === 0) {
      return {
        currentDps: 0,
        totalDamage: this.totalDamage,
        peakDps: this.peakDps,
        recentDamage: 0,
      };
    }

    const firstHitAt = this.hits[0]?.timestamp ?? now;
    const elapsedMs = Math.max(1000, Math.min(this.windowMs, now - firstHitAt));
    const currentDps = recentDamage / (elapsedMs / 1000);

    return {
      currentDps,
      totalDamage: this.totalDamage,
      peakDps: this.peakDps,
      recentDamage,
    };
  }

  public reset(): void {
    this.hits = [];
    this.seenEventIds.clear();
    this.totalDamage = 0;
    this.peakDps = 0;
  }

  private prune(now: number): void {
    const cutoff = now - this.windowMs;
    while (this.hits.length > 0 && (this.hits[0]?.timestamp ?? 0) < cutoff) {
      this.hits.shift();
    }

    if (this.seenEventIds.size > 2000) {
      this.seenEventIds = new Set(this.hits.map((hit) => hit.eventId));
    }
  }
}
