import type { AbilityLoadout } from '@/utils/weaponAbilities';

export const TALENT_WRATH_STRIKE = 'WRATH_STRIKE' as const;
export const TALENT_INFESTED_STRIKE = 'INFESTED_STRIKE' as const;

export type TalentId = typeof TALENT_WRATH_STRIKE | typeof TALENT_INFESTED_STRIKE;

/** Modifies Wraith Strike (`RUNEBLADE_E`) when equipped in Q/E/R. */
export const WRATH_STRIKE_CRIT_CHANCE_ADD = 0.5;
export const WRATH_STRIKE_CRIT_DAMAGE_MULT_ADD = 0.5;

export interface TalentDefinition {
  id: TalentId;
  name: string;
  description: string;
  /** Universal ability id this talent augments. */
  modifiesAbilityId: string;
}

export const wrathStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_WRATH_STRIKE,
  name: 'Wrathful Strike',
  description:
    'While Wraith Strike is in your ability loadout, Wraith Strike gains +20% critical strike chance and +50% critical strike damage.',
  modifiesAbilityId: 'RUNEBLADE_E',
};

export const infestedStrikeTalentDefinition: TalentDefinition = {
  id: TALENT_INFESTED_STRIKE,
  name: 'INFESTED STRIKE',
  description:
    'Wraith Strike deals 190 damage and gains a green soul effect. Killing an enemy with Wraith Strike raises a zombie ally for 30s (max 3). Zombies attack nearby foes or follow you.',
  modifiesAbilityId: 'RUNEBLADE_E',
};

export interface TalentLoadout {
  wrathStrike: boolean;
  infestedStrike: boolean;
}

export function createDefaultTalentLoadout(): TalentLoadout {
  return { wrathStrike: false, infestedStrike: false };
}

export function isWraithStrikeInLoadout(loadout: AbilityLoadout | null | undefined): boolean {
  if (!loadout) return false;
  return loadout.Q === 'RUNEBLADE_E' || loadout.E === 'RUNEBLADE_E' || loadout.R === 'RUNEBLADE_E';
}
