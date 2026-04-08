import { WeaponType } from '@/components/dragon/weapons';

export interface SkillPointData {
  skillPoints: number;
  unlockedAbilities: Record<string, Set<string>>; // weaponType_slot -> Set of unlocked abilities (Q, E, R, F)
}

export interface AbilityUnlock {
  weaponType: WeaponType;
  abilityKey: 'Q' | 'E' | 'R' | 'F';
  weaponSlot: 'primary' | 'secondary'; // Which slot this weapon is in
}

export class SkillPointSystem {
  private static readonly SKILL_POINTS_PER_LEVEL = 1;
  
  /**
   * Get initial skill point data for a new player
   */
  static getInitialSkillPointData(): SkillPointData {
    return {
      skillPoints: 1,
      unlockedAbilities: {}
    };
  }
  
  /**
   * Calculate skill points gained when leveling up
   */
  static getSkillPointsForLevel(level: number): number {
    if (level <= 1) return 0;
    return (level - 1) * this.SKILL_POINTS_PER_LEVEL;
  }
  
  /**
   * Get available abilities that can be unlocked with current setup
   */
  static getAvailableUnlocks(
    skillPointData: SkillPointData,
    selectedWeapons: {
      primary: WeaponType;
      secondary: WeaponType;
    } | null
  ): AbilityUnlock[] {
    if (!selectedWeapons || skillPointData.skillPoints <= 0) {
      return [];
    }

    const available: AbilityUnlock[] = [];
    const unlockableKeys: Array<'Q' | 'E' | 'R' | 'F'> = ['Q', 'E', 'R', 'F'];

    // Check primary weapon Q, E, R, F abilities
    const primaryKey = `${selectedWeapons.primary}_primary`;
    const primaryUnlocked = skillPointData.unlockedAbilities[primaryKey] || new Set();
    for (const key of unlockableKeys) {
      if (!primaryUnlocked.has(key)) {
        available.push({ weaponType: selectedWeapons.primary, abilityKey: key, weaponSlot: 'primary' });
      }
    }

    // Check secondary weapon Q, E, R, F abilities
    const secondaryKey = `${selectedWeapons.secondary}_secondary`;
    const secondaryUnlocked = skillPointData.unlockedAbilities[secondaryKey] || new Set();
    for (const key of unlockableKeys) {
      if (!secondaryUnlocked.has(key)) {
        available.push({ weaponType: selectedWeapons.secondary, abilityKey: key, weaponSlot: 'secondary' });
      }
    }

    return available;
  }
  
  /**
   * Check if a specific ability is unlocked
   */
  static isAbilityUnlocked(
    skillPointData: SkillPointData,
    weaponType: WeaponType,
    abilityKey: 'Q' | 'E' | 'R' | 'F' | 'P',
    weaponSlot: 'primary' | 'secondary'
  ): boolean {
    // P (passive) abilities are always active — they are not part of the unlock system
    if (abilityKey === 'P') return true;

    const key = `${weaponType}_${weaponSlot}`;
    return skillPointData.unlockedAbilities[key]?.has(abilityKey) ?? false;
  }
  
  /**
   * Unlock an ability and spend a skill point
   */
  static unlockAbility(
    skillPointData: SkillPointData,
    weaponType: WeaponType,
    abilityKey: 'Q' | 'E' | 'R' | 'F',
    weaponSlot: 'primary' | 'secondary'
  ): SkillPointData {
    if (skillPointData.skillPoints <= 0) {
      throw new Error('No skill points available');
    }

    const key = `${weaponType}_${weaponSlot}`;
    const newUnlockedAbilities = { ...skillPointData.unlockedAbilities };

    if (!newUnlockedAbilities[key]) {
      newUnlockedAbilities[key] = new Set();
    } else {
      newUnlockedAbilities[key] = new Set(newUnlockedAbilities[key]);
    }

    if (newUnlockedAbilities[key].has(abilityKey)) {
      throw new Error('Ability already unlocked');
    }

    newUnlockedAbilities[key].add(abilityKey);

    return {
      skillPoints: skillPointData.skillPoints - 1,
      unlockedAbilities: newUnlockedAbilities
    };
  }
  
  /**
   * Update skill points when player levels up
   */
  static updateSkillPointsForLevel(
    skillPointData: SkillPointData,
    newLevel: number
  ): SkillPointData {
    // Calculate total skill points: initial 1 + (level - 1) skill points per level
    const initialSkillPoints = 1;
    const levelBasedSkillPoints = Math.max(0, (newLevel - 1) * this.SKILL_POINTS_PER_LEVEL);
    const totalSkillPoints = initialSkillPoints + levelBasedSkillPoints;
    const spentSkillPoints = this.getSpentSkillPoints(skillPointData);
    const availableSkillPoints = Math.max(0, totalSkillPoints - spentSkillPoints);

    return {
      ...skillPointData,
      skillPoints: availableSkillPoints
    };
  }
  
  /**
   * Calculate how many skill points have been spent
   */
  static getSpentSkillPoints(skillPointData: SkillPointData): number {
    let spent = 0;
    Object.values(skillPointData.unlockedAbilities).forEach(abilitySet => {
      spent += abilitySet.size;
    });
    return spent;
  }
  
  /**
   * Get ability name for display
   */
  static getAbilityName(weaponType: WeaponType, abilityKey: 'Q' | 'E' | 'R' | 'F'): string {
    const abilityNames: Record<WeaponType, Record<'Q' | 'E' | 'R' | 'F', string>> = {
      [WeaponType.SWORD]: {
        Q: 'Fullguard',
        E: 'Charge',
        R: 'Colossus Strike',
        F: 'Divine Wind'
      },
      [WeaponType.BOW]: {
        Q: 'Frost Bite',
        E: 'Viper Sting',
        R: 'Reaping Talons',
        F: 'Rejuvenating Shot'
      },
      [WeaponType.SCYTHE]: {
        Q: 'Sunwell',
        E: 'Coldsnap',
        R: 'Crossentropy',
        F: 'Mantra'
      },
      [WeaponType.SABRES]: {
        Q: 'Backstab',
        E: 'Flourish',
        R: 'Divebomb',
        F: 'Event Horizon'
      },
      [WeaponType.RUNEBLADE]: {
        Q: 'Aegis',
        E: 'Oathblade',
        R: 'Colossus Smite',
        F: "Titan's Grip"
      },
      [WeaponType.SPEAR]: {
        Q: 'Wind Shear',
        E: 'Tempest Sweep',
        R: 'Lightning Bolt',
        F: 'Storm Shroud'
      }
    };

    return abilityNames[weaponType]?.[abilityKey] || 'Unknown Ability';
  }
  
  /**
   * Get weapon display name
   */
  static getWeaponDisplayName(weaponType: WeaponType): string {
    const weaponNames: Record<WeaponType, string> = {
      [WeaponType.SWORD]: 'Sword',
      [WeaponType.BOW]: 'Bow',
      [WeaponType.SCYTHE]: 'Scythe',
      [WeaponType.SABRES]: 'Sabres',
      [WeaponType.RUNEBLADE]: 'Runeblade',
      [WeaponType.SPEAR]: 'Spear'
    };
    
    return weaponNames[weaponType] || 'Unknown Weapon';
  }
  
  /**
   * Serialize skill point data for storage/network
   */
  static serialize(skillPointData: SkillPointData): string {
    const serializable = {
      skillPoints: skillPointData.skillPoints,
      unlockedAbilities: {} as Record<string, string[]>
    };
    
    Object.entries(skillPointData.unlockedAbilities).forEach(([key, abilitySet]) => {
      serializable.unlockedAbilities[key] = Array.from(abilitySet);
    });
    
    return JSON.stringify(serializable);
  }
  
  /**
   * Deserialize skill point data from storage/network
   */
  static deserialize(data: string): SkillPointData {
    try {
      const parsed = JSON.parse(data);
      const skillPointData: SkillPointData = {
        skillPoints: parsed.skillPoints || 0,
        unlockedAbilities: {}
      };
      
      Object.entries(parsed.unlockedAbilities || {}).forEach(([key, abilities]) => {
        skillPointData.unlockedAbilities[key] = new Set(abilities as string[]);
      });
      
      return skillPointData;
    } catch (error) {
      console.error('Failed to deserialize skill point data:', error);
      return this.getInitialSkillPointData();
    }
  }
}
