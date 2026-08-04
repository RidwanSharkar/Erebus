// Manager for handling damage number display and lifecycle
import { Vector3 } from '@/utils/three-exports';
import { DamageNumberData } from '@/components/DamageNumbers';

export class DamageNumberManager {
  private damageNumbers: DamageNumberData[] = [];
  private nextId = 0;

  /** Multiple barrage / entropic bolts can hit the same target in one volley — merge into one floating number. */
  private multiHitMergeByTarget = new Map<number, { id: string; lastHitMs: number }>();
  private static readonly MULTI_HIT_MERGE_GAP_MS = 500;

  public addDamageNumber(
    damage: number,
    isCritical: boolean,
    position: Vector3,
    damageType?: string,
    isIncomingDamage?: boolean,
    /** ECS target id — with `damageType === 'barrage' | 'entropic'`, consecutive hits on that target merge within ~500ms. */
    mergeBarrageTargetEntityId?: number,
    /** Bow Dual Coil: lane index so paired numbers don’t share one stack slot and get extra screen spread. */
    dualCoilSlot?: 0 | 1,
    displayText?: string,
    durationHint?: 'pickup'
  ): string {
    const now = Date.now();

    if (
      (damageType === 'barrage' || damageType === 'entropic') &&
      mergeBarrageTargetEntityId !== undefined &&
      !isIncomingDamage
    ) {
      const pending = this.multiHitMergeByTarget.get(mergeBarrageTargetEntityId);
      if (
        pending &&
        now - pending.lastHitMs <= DamageNumberManager.MULTI_HIT_MERGE_GAP_MS
      ) {
        const existing = this.damageNumbers.find(dn => dn.id === pending.id);
        if (existing) {
          existing.damage += damage;
          existing.timestamp = now;
          existing.isCritical = existing.isCritical || isCritical;
          pending.lastHitMs = now;
          this.bumpSnapshot();
          return pending.id;
        }
        this.multiHitMergeByTarget.delete(mergeBarrageTargetEntityId);
      }

      const id = `damage_${this.nextId++}`;
      const damageNumber: DamageNumberData = {
        id,
        damage,
        isCritical,
        position: position.clone(),
        timestamp: now,
        damageType,
        isIncomingDamage,
        ...(dualCoilSlot !== undefined ? { dualCoilSlot } : {}),
        ...(displayText !== undefined ? { displayText } : {}),
        ...(durationHint !== undefined ? { durationHint } : {}),
      };
      this.damageNumbers.push(damageNumber);
      this.multiHitMergeByTarget.set(mergeBarrageTargetEntityId, {
        id,
        lastHitMs: now,
      });
      this.bumpSnapshot();
      return id;
    }

    const id = `damage_${this.nextId++}`;
    const damageNumber: DamageNumberData = {
      id,
      damage,
      isCritical,
      position: position.clone(), // Clone to avoid reference issues
      timestamp: now,
      damageType,
      isIncomingDamage,
      ...(dualCoilSlot !== undefined ? { dualCoilSlot } : {}),
      ...(displayText !== undefined ? { displayText } : {}),
      ...(durationHint !== undefined ? { durationHint } : {}),
    };

    this.damageNumbers.push(damageNumber);
    this.bumpSnapshot();
    return id;
  }

  public removeDamageNumber(id: string): void {
    const index = this.damageNumbers.findIndex(dn => dn.id === id);
    if (index !== -1) {
      const removed = this.damageNumbers[index];
      this.damageNumbers.splice(index, 1);
      if (removed.damageType === 'barrage' || removed.damageType === 'entropic') {
        this.multiHitMergeByTarget.forEach((pending, targetId) => {
          if (pending.id === id) {
            this.multiHitMergeByTarget.delete(targetId);
          }
        });
      }
      this.bumpSnapshot();
    }
  }

  private snapshotVersion = 0;
  private cachedSnapshot: DamageNumberData[] = [];
  private cachedSnapshotVersion = -1;

  /** Marks the public snapshot stale after mutate/remove/cleanup. */
  private bumpSnapshot(): void {
    this.snapshotVersion++;
  }

  public getDamageNumbers(): DamageNumberData[] {
    if (this.cachedSnapshotVersion === this.snapshotVersion) {
      return this.cachedSnapshot;
    }
    this.cachedSnapshot = this.damageNumbers.slice();
    this.cachedSnapshotVersion = this.snapshotVersion;
    return this.cachedSnapshot;
  }

  public cleanup(): void {
    // Remove damage numbers older than 5 seconds (failsafe)
    const now = Date.now();
    const beforeLen = this.damageNumbers.length;
    this.damageNumbers = this.damageNumbers.filter(
      dn => now - dn.timestamp < 5000
    );
    let changed = this.damageNumbers.length !== beforeLen;

    this.multiHitMergeByTarget.forEach((pending, targetId) => {
      if (!this.damageNumbers.some(dn => dn.id === pending.id)) {
        this.multiHitMergeByTarget.delete(targetId);
      }
    });

    // Also limit total number of damage numbers to prevent memory issues
    if (this.damageNumbers.length > 50) {
      // Keep only the 50 most recent
      this.damageNumbers.sort((a, b) => b.timestamp - a.timestamp);
      this.damageNumbers = this.damageNumbers.slice(0, 50);
      changed = true;
    }

    if (changed) {
      this.bumpSnapshot();
    }
  }

  public clear(): void {
    this.damageNumbers.length = 0;
    this.nextId = 0;
    this.multiHitMergeByTarget.clear();
    this.bumpSnapshot();
  }

  public getCount(): number {
    return this.damageNumbers.length;
  }
}
