import React, { useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import HotkeyPanel from './HotkeyPanel';
import ClassTalentPanel from './ClassTalentPanel';
import { SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { AbilityLoadout } from '@/utils/weaponAbilities';
import type { TalentLoadout } from '@/utils/talents';
import { isSelectableArchetype, type Archetype } from '@/utils/archetypes';
import ArchetypeBadge from './ArchetypeBadge';
import InteractHintPanel from './InteractHintPanel';

interface GameUIProps {
  currentWeapon: WeaponType;
  controlSystem?: any;
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null;
  onWeaponSwitch?: (slot: 1 | 3) => void;
  skillPointData?: SkillPointData;
  abilityLoadout?: AbilityLoadout | null;
  onUnlockAbility?: (unlock: AbilityUnlock) => void;
  purchasedItems?: string[];
  talentLoadout?: TalentLoadout | null;
  interactHint?: string | null;
  gameMode?: 'menu' | 'singleplayer' | 'multiplayer' | 'pvp' | 'coop';
  selectedArchetype?: Archetype;
}

export default function GameUI({
  currentWeapon,
  controlSystem,
  selectedWeapons,
  onWeaponSwitch,
  skillPointData,
  abilityLoadout,
  onUnlockAbility,
  purchasedItems = [],
  talentLoadout,
  interactHint = null,
  gameMode,
  selectedArchetype,
}: GameUIProps) {
  const handleUnlockAbility = useCallback(
    (unlock: AbilityUnlock) => {
      if (controlSystem) {
        controlSystem.unlockAbility(unlock.weaponType, unlock.abilityKey, unlock.weaponSlot);
      }
      if (onUnlockAbility) {
        onUnlockAbility(unlock);
      }
    },
    [controlSystem, onUnlockAbility],
  );

  return (
    <>
      <div
        className="fixed top-4 left-4 z-40 flex flex-col items-start gap-2"
        data-block-game-input
      >
        {(gameMode === 'pvp' || gameMode === 'coop') &&
          selectedArchetype &&
          isSelectableArchetype(selectedArchetype) && (
            <ArchetypeBadge archetype={selectedArchetype} />
          )}
        <ClassTalentPanel
          currentWeapon={currentWeapon}
          talentLoadout={talentLoadout ?? null}
          abilityLoadout={abilityLoadout}
        />
      </div>

      <div
        className="fixed bottom-8 left-1/2 z-40 -translate-x-1/2"
        data-block-game-input
      >
        <div className="inline-flex w-max flex-col items-stretch gap-2">
          <InteractHintPanel hint={interactHint} />
          <HotkeyPanel
          embedded
          currentWeapon={currentWeapon}
          controlSystem={controlSystem}
          selectedWeapons={selectedWeapons}
          onWeaponSwitch={onWeaponSwitch}
          skillPointData={skillPointData}
          abilityLoadout={abilityLoadout}
          onUnlockAbility={handleUnlockAbility}
          purchasedItems={purchasedItems}
          talentLoadout={talentLoadout ?? null}
          selectedArchetype={selectedArchetype}
          gameMode={gameMode}
        />
        </div>
      </div>
    </>
  );
}
