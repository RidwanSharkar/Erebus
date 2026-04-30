// Stat System for player character progression
// STRENGTH: +5% critical strike damage per point (additive crit multiplier)
// STAMINA:  +10 max health per point
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
}

export class StatSystem {
  private static readonly INITIAL_STAT_POINTS = 5;
  private static readonly STAT_POINTS_PER_LEVEL = 1;

  static readonly BASE_MAX_SHIELD = 25;
  static readonly STRENGTH_CRIT_DAMAGE_MULT_PER_POINT = 0.05;
  static readonly STAMINA_HEALTH_PER_POINT = 10;
  static readonly AGILITY_CRIT_CHANCE_PER_POINT = 0.01;
  static readonly INTELLECT_MAX_SHIELD_PER_POINT = 2;

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

  /** Grant bonus points to spend on STR/STA/AGI/INT (e.g. co-op stat-room pedestal). */
  static grantStatPoints(data: StatPointData, amount: number): StatPointData {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (n <= 0) return data;
    return { ...data, statPoints: data.statPoints + n };
  }

  /** Grant +1 to a stat from an item drop — does NOT consume a stat point */
  static grantItemStat(data: StatPointData, stat: StatKey): StatPointData {
    return {
      ...data,
      stats: { ...data.stats, [stat]: data.stats[stat] + 1 }
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

  /** Max shield from Intellect only (excludes items like Warding Shield). */
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
      stamina: '+10 max health per point',
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
        return `+${StatSystem.getBonusMaxHealth({ strength: 0, stamina: value, agility: 0, intellect: 0 })} max HP`;
      case 'agility':
        return `+${value}% crit chance`;
      case 'intellect':
        return `+${value * StatSystem.INTELLECT_MAX_SHIELD_PER_POINT} max shield`;
      default:
        return '';
    }
  }
}
