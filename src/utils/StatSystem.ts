// Stat System for player character progression
// STRENGTH: +5% critical strike damage per point (additive crit multiplier)
// STAMINA:  +10 max health and +10 heal per point
// AGILITY:  +1% crit chance per point (no crit damage from Agility)
// INTELLECT: +2 max shield capacity per point (base max shield 25)

export type StatKey = 'strength' | 'stamina' | 'agility' | 'intellect';

export interface PlayerStats {
  strength: number;
  stamina: number;
  agility: number;
  intellect: number;
}

export interface StatPointData {
  statPoints: number;
  stats: PlayerStats;
  /** Unspent bonus points from pedestals / rewards (preserved across level-ups). */
  bonusStatPoints?: number;
}

export class StatSystem {
  private static readonly INITIAL_STAT_POINTS = 3;
  private static readonly STAT_POINTS_PER_LEVEL = 3;

  static readonly BASE_MAX_SHIELD = 25;
  static readonly STRENGTH_CRIT_DAMAGE_MULT_PER_POINT = 0.05;
  static readonly STAMINA_HEALTH_PER_POINT = 10;
  static readonly AGILITY_CRIT_CHANCE_PER_POINT = 0.01;
  static readonly INTELLECT_MAX_SHIELD_PER_POINT = 2;
  /** Co-op stat-room pedestal reward (points to spend on STR/STA/AGI/INT). */
  static readonly STAT_ROOM_PEDESTAL_POINTS = 5;

  static getInitialStatPointData(): StatPointData {
    return {
      statPoints: StatSystem.INITIAL_STAT_POINTS,
      stats: { strength: 0, stamina: 0, agility: 0, intellect: 0 }
    };
  }

  static getTotalStatPointsForLevel(level: number): number {
    return StatSystem.INITIAL_STAT_POINTS + Math.max(0, level - 1) * StatSystem.STAT_POINTS_PER_LEVEL;
  }

  /**
   * Flat STR/STA/AGI/INT granted by picked-up items. Rules must stay in sync with
   * `item-picked-up` (boss: positive `statBonus`; amulets: no `statBonus` → +1).
   */
  static sumInventoryItemStatBonuses(
    items: Iterable<{ stat?: StatKey | null; statBonus?: number | null }>,
  ): PlayerStats {
    const out: PlayerStats = { strength: 0, stamina: 0, agility: 0, intellect: 0 };
    for (const item of Array.from(items)) {
      const sk = item.stat;
      if (sk == null) continue;
      let delta: number;
      if (item.statBonus != null && item.statBonus > 0) {
        delta = item.statBonus;
      } else if (item.statBonus == null) {
        delta = 1;
      } else {
        continue;
      }
      out[sk] += delta;
    }
    return out;
  }

  /**
   * Merge stored stat totals with inventory so UI/combat always reflect item bonuses
   * even if the flat-stat grant path desyncs briefly.
   */
  static getEffectiveStatsWithInventory(
    storedStats: PlayerStats,
    items: Iterable<{ stat?: StatKey | null; statBonus?: number | null }>,
  ): PlayerStats {
    const inv = StatSystem.sumInventoryItemStatBonuses(items);
    return {
      strength: inv.strength + Math.max(0, storedStats.strength - inv.strength),
      stamina: inv.stamina + Math.max(0, storedStats.stamina - inv.stamina),
      agility: inv.agility + Math.max(0, storedStats.agility - inv.agility),
      intellect: inv.intellect + Math.max(0, storedStats.intellect - inv.intellect),
    };
  }

  /** Points spent on the four core stats via the allocate UI (excludes item-granted stats). */
  static getSpentAllocationPoints(
    data: StatPointData,
    items: Iterable<{ stat?: StatKey | null; statBonus?: number | null }>,
  ): number {
    const inv = StatSystem.sumInventoryItemStatBonuses(items);
    return (
      Math.max(0, data.stats.strength - inv.strength) +
      Math.max(0, data.stats.stamina - inv.stamina) +
      Math.max(0, data.stats.agility - inv.agility) +
      Math.max(0, data.stats.intellect - inv.intellect)
    );
  }

  static updateStatPointsForLevel(
    data: StatPointData,
    newLevel: number,
    items: Iterable<{ stat?: StatKey | null; statBonus?: number | null }> = [],
  ): StatPointData {
    const totalPoints = StatSystem.getTotalStatPointsForLevel(newLevel);
    const spentPoints = StatSystem.getSpentAllocationPoints(data, items);
    const levelBased = Math.max(0, totalPoints - spentPoints);
    const bonus = data.bonusStatPoints ?? 0;
    return { ...data, statPoints: levelBased + bonus };
  }

  static allocateStat(data: StatPointData, stat: StatKey): StatPointData {
    if (data.statPoints <= 0) throw new Error('No stat points available');
    const bonus = data.bonusStatPoints ?? 0;
    return {
      statPoints: data.statPoints - 1,
      bonusStatPoints: Math.max(0, bonus - (bonus > 0 ? 1 : 0)),
      stats: { ...data.stats, [stat]: data.stats[stat] + 1 },
    };
  }

  /** Grant bonus points to spend on STR/STA/AGI/INT (e.g. co-op stat-room pedestal). */
  static grantStatPoints(data: StatPointData, amount: number): StatPointData {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (n <= 0) return data;
    const bonus = (data.bonusStatPoints ?? 0) + n;
    return { ...data, statPoints: data.statPoints + n, bonusStatPoints: bonus };
  }

  /** Grant flat stat points from an item drop — does NOT consume a stat point */
  static grantItemStat(data: StatPointData, stat: StatKey, amount: number = 1): StatPointData {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (n <= 0) return data;
    return {
      ...data,
      stats: { ...data.stats, [stat]: data.stats[stat] + n }
    };
  }

  // ── Derived stat helpers ──────────────────────────────────────────────────

  /** Bonus flat HP from Stamina */
  static getBonusMaxHealth(stats: PlayerStats): number {
    return stats.stamina * StatSystem.STAMINA_HEALTH_PER_POINT;
  }

  /** Additional crit chance fraction from Agility (e.g. 3 Agility → 0.03) */
  static getCritChanceBonus(stats: PlayerStats): number {
    return stats.agility * StatSystem.AGILITY_CRIT_CHANCE_PER_POINT;
  }

  /** Additive crit damage multiplier from Strength (e.g. 2 Strength → +0.10 on top of base 2x) */
  static getStrengthCritDamageMultiplierBonus(stats: PlayerStats): number {
    return stats.strength * StatSystem.STRENGTH_CRIT_DAMAGE_MULT_PER_POINT;
  }

  /** Max shield from Intellect (includes item-granted Intellect). */
  static getMaxShieldFromStats(stats: PlayerStats): number {
    return StatSystem.BASE_MAX_SHIELD + stats.intellect * StatSystem.INTELLECT_MAX_SHIELD_PER_POINT;
  }

  // ── Display helpers ──────────────────────────────────────────────────────

  static getStatDisplayName(stat: StatKey): string {
    const names: Record<StatKey, string> = {
      strength: 'Strength',
      stamina: 'Stamina',
      agility: 'Agility',
      intellect: 'Intellect'
    };
    return names[stat];
  }

  static getStatIcon(stat: StatKey): string {
    const icons: Record<StatKey, string> = {
      strength: '🛡',
      stamina: '❤️',
      agility: '⚡',
      intellect: '✨'
    };
    return icons[stat];
  }

  static getStatColor(stat: StatKey): string {
    const colors: Record<StatKey, string> = {
      strength: '#ef4444',
      stamina: '#22c55e',
      agility: '#3b82f6',
      intellect: '#a855f7'
    };
    return colors[stat];
  }

  static getStatDescription(stat: StatKey): string {
    const descs: Record<StatKey, string> = {
      strength: '+5% critical strike damage per point',
      stamina: '+10 max health and +10 heal per point',
      agility: '+1% crit chance per point',
      intellect: '+2 max shield per point (base 25)'
    };
    return descs[stat];
  }

  static getStatEffect(stat: StatKey, value: number): string {
    if (value === 0) return 'No bonus';
    switch (stat) {
      case 'strength':
        return `+${Math.round(StatSystem.getStrengthCritDamageMultiplierBonus({ strength: value, stamina: 0, agility: 0, intellect: 0 }) * 100)}% crit damage`;
      case 'stamina':
        return `+${StatSystem.getBonusMaxHealth({ strength: 0, stamina: value, agility: 0, intellect: 0 })} max HP & heal`;
      case 'agility':
        return `+${value}% crit chance`;
      case 'intellect':
        return `+${value * StatSystem.INTELLECT_MAX_SHIELD_PER_POINT} max shield`;
      default:
        return '';
    }
  }
}
