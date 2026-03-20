// Stat System for player character progression
// STRENGTH: -20% damage taken per point
// STAMINA:  +50 max health per point
// AGILITY:  +1% crit chance and +0.10x crit damage multiplier per point
// INTELLECT: +50 mana pool and +1/s mana regen per point

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
}

export class StatSystem {
  private static readonly INITIAL_STAT_POINTS = 5;
  private static readonly STAT_POINTS_PER_LEVEL = 1;

  // Per-stat effect constants
  static readonly STRENGTH_DAMAGE_REDUCTION_PER_POINT = 0.10;
  static readonly STAMINA_HEALTH_PER_POINT = 25;
  static readonly AGILITY_CRIT_CHANCE_PER_POINT = 0.02;
  static readonly AGILITY_CRIT_DAMAGE_PER_POINT = 0.10;
  static readonly INTELLECT_MANA_PER_POINT = 30;
  static readonly INTELLECT_MANA_REGEN_PER_POINT = 0.25; // mana per second

  static getInitialStatPointData(): StatPointData {
    return {
      statPoints: StatSystem.INITIAL_STAT_POINTS,
      stats: { strength: 0, stamina: 0, agility: 0, intellect: 0 }
    };
  }

  static getTotalStatPointsForLevel(level: number): number {
    return StatSystem.INITIAL_STAT_POINTS + Math.max(0, level - 1) * StatSystem.STAT_POINTS_PER_LEVEL;
  }

  static getSpentPoints(data: StatPointData): number {
    const { strength, stamina, agility, intellect } = data.stats;
    return strength + stamina + agility + intellect;
  }

  static updateStatPointsForLevel(data: StatPointData, newLevel: number): StatPointData {
    const totalPoints = StatSystem.getTotalStatPointsForLevel(newLevel);
    const spentPoints = StatSystem.getSpentPoints(data);
    return { ...data, statPoints: Math.max(0, totalPoints - spentPoints) };
  }

  static allocateStat(data: StatPointData, stat: StatKey): StatPointData {
    if (data.statPoints <= 0) throw new Error('No stat points available');
    return {
      statPoints: data.statPoints - 1,
      stats: { ...data.stats, [stat]: data.stats[stat] + 1 }
    };
  }

  /** Grant +1 to a stat from an item drop — does NOT consume a stat point */
  static grantItemStat(data: StatPointData, stat: StatKey): StatPointData {
    return {
      ...data,
      stats: { ...data.stats, [stat]: data.stats[stat] + 1 }
    };
  }

  // ── Derived stat helpers ──────────────────────────────────────────────────

  /** Fraction of incoming damage to absorb (e.g. 0.40 = 40% reduction, capped at 80%) */
  static getDamageReduction(stats: PlayerStats): number {
    return Math.min(stats.strength * StatSystem.STRENGTH_DAMAGE_REDUCTION_PER_POINT, 0.80);
  }

  /** Bonus flat HP from Stamina */
  static getBonusMaxHealth(stats: PlayerStats): number {
    return stats.stamina * StatSystem.STAMINA_HEALTH_PER_POINT;
  }

  /** Additional crit chance fraction from Agility (e.g. 3 Agility → 0.03) */
  static getCritChanceBonus(stats: PlayerStats): number {
    return stats.agility * StatSystem.AGILITY_CRIT_CHANCE_PER_POINT;
  }

  /** Additional crit damage multiplier from Agility (e.g. 3 Agility → +0.30x on top of base 2x) */
  static getCritDamageBonus(stats: PlayerStats): number {
    return stats.agility * StatSystem.AGILITY_CRIT_DAMAGE_PER_POINT;
  }

  /** Bonus flat mana from Intellect */
  static getBonusMana(stats: PlayerStats): number {
    return stats.intellect * StatSystem.INTELLECT_MANA_PER_POINT;
  }

  /**
   * Extra mana restored per 500 ms regen tick from Intellect.
   * Base regen is applied every 500 ms; 1 Intellect point = +1/s = +0.5 per tick.
   */
  static getManaRegenBonusPerTick(stats: PlayerStats): number {
    return stats.intellect * (StatSystem.INTELLECT_MANA_REGEN_PER_POINT / 2);
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
      strength: '#f97316',
      stamina: '#ef4444',
      agility: '#eab308',
      intellect: '#8b5cf6'
    };
    return colors[stat];
  }

  static getStatDescription(stat: StatKey): string {
    const descs: Record<StatKey, string> = {
      strength: '-10% damage taken per point',
      stamina: '+50 max health per point',
      agility: '+1% crit chance & +10% crit damage per point',
      intellect: '+50 mana pool & +1/s mana regen per point'
    };
    return descs[stat];
  }

  static getStatEffect(stat: StatKey, value: number): string {
    if (value === 0) return 'No bonus';
    switch (stat) {
      case 'strength':
        return `-${Math.round(StatSystem.getDamageReduction({ strength: value, stamina: 0, agility: 0, intellect: 0 }) * 100)}% damage taken`;
      case 'stamina':
        return `+${StatSystem.getBonusMaxHealth({ strength: 0, stamina: value, agility: 0, intellect: 0 })} max HP`;
      case 'agility':
        return `+${value}% crit chance, +${Math.round(StatSystem.getCritDamageBonus({ strength: 0, stamina: 0, agility: value, intellect: 0 }) * 100)}% crit dmg`;
      case 'intellect':
        return `+${StatSystem.getBonusMana({ strength: 0, stamina: 0, agility: 0, intellect: value })} mana, +${value}/s regen`;
      default:
        return '';
    }
  }
}
