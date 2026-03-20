// Experience System Utilities for co-op and PVP modes

export class ExperienceSystem {
  // Cumulative EXP needed to reach each level
  private static readonly LEVEL_REQUIREMENTS: Record<number, number> = {
    1: 0,     // Starting level
    2: 500,  // 1 000 total EXP to reach level 2
    3: 2000,  // 3 000 total EXP to reach level 3 (+2 000 from L2)
    4: 5000,  // 7 000 total EXP to reach level 4 (+4 000 from L3)
    5: 7500  // 15 000 total EXP to reach level 5 (+8 000 from L4, max)
  };

  // EXP needed to go from level N to level N+1
  private static readonly EXP_PER_LEVEL_INCREMENT: Record<number, number> = {
    1: 1000,  // 0    → 1 000
    2: 2000,  // 1000 → 3 000
    3: 4000,  // 3000 → 7 000
    4: 8000   // 7000 → 15 000
  };

  // Health scaling per level
  private static readonly BASE_HEALTH = 250;
  private static readonly HEALTH_PER_LEVEL = 100;

  /**
   * Calculate the level based on total experience
   */
  static getLevelFromExperience(experience: number): number {
    if (experience >= this.LEVEL_REQUIREMENTS[5]) return 5;
    if (experience >= this.LEVEL_REQUIREMENTS[4]) return 4;
    if (experience >= this.LEVEL_REQUIREMENTS[3]) return 3;
    if (experience >= this.LEVEL_REQUIREMENTS[2]) return 2;
    return 1;
  }

  /**
   * Get the cumulative experience required to reach a specific level
   */
  static getExperienceForLevel(level: number): number {
    return this.LEVEL_REQUIREMENTS[level] ?? 0;
  }

  /**
   * Get the cumulative experience required for the next level
   */
  static getExperienceForNextLevel(currentLevel: number): number {
    if (currentLevel >= 5) return 0;
    return this.LEVEL_REQUIREMENTS[currentLevel + 1] ?? 0;
  }

  /**
   * Get the experience increment needed to level up from currentLevel
   */
  static getExperienceIncrementForLevel(currentLevel: number): number {
    if (currentLevel >= 5) return 0;
    return this.EXP_PER_LEVEL_INCREMENT[currentLevel] ?? 0;
  }

  /**
   * Calculate current level progress as a percentage (0–100)
   */
  static getLevelProgress(currentLevel: number, currentExp: number): number {
    if (currentLevel >= 5) return 100;

    const expForCurrentLevel = this.getExperienceForLevel(currentLevel);
    const expForNextLevel = this.getExperienceForNextLevel(currentLevel);
    const currentLevelExp = currentExp - expForCurrentLevel;
    const requiredExp = expForNextLevel - expForCurrentLevel;

    return Math.min((currentLevelExp / requiredExp) * 100, 100);
  }

  /**
   * Get the experience range for the current level: { min, max, current }
   */
  static getCurrentLevelExpRange(currentLevel: number): { min: number; max: number; current: number } {
    const min = this.getExperienceForLevel(currentLevel);
    const max = this.getExperienceForNextLevel(currentLevel);
    return { min, max, current: max - min };
  }

  /**
   * Calculate max health based on level
   */
  static getMaxHealthForLevel(level: number): number {
    return this.BASE_HEALTH + (level - 1) * this.HEALTH_PER_LEVEL;
  }

  /**
   * Check whether a player can level up with their current experience
   */
  static canLevelUp(currentLevel: number, currentExp: number): boolean {
    if (currentLevel >= 5) return false;
    return currentExp >= this.getExperienceForNextLevel(currentLevel);
  }

  /**
   * Get the new level after gaining experience
   */
  static getNewLevelAfterExperience(currentLevel: number, currentExp: number, expGained: number): number {
    return this.getLevelFromExperience(currentExp + expGained);
  }

  /**
   * Award experience and return level-up information
   */
  static awardExperience(
    currentLevel: number,
    currentExp: number,
    expGained: number
  ): { newLevel: number; newExp: number; leveledUp: boolean; levelsGained: number } {
    const newExp = currentExp + expGained;
    const newLevel = this.getLevelFromExperience(newExp);
    return {
      newLevel,
      newExp,
      leveledUp: newLevel > currentLevel,
      levelsGained: newLevel - currentLevel
    };
  }

  /**
   * Get experience remaining until next level
   */
  static getExperienceToNextLevel(currentLevel: number, currentExp: number): number {
    if (currentLevel >= 5) return 0;
    return Math.max(this.getExperienceForNextLevel(currentLevel) - currentExp, 0);
  }
}
