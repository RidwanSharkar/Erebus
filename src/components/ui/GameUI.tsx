import React, { useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import HotkeyPanel from './HotkeyPanel';
import ClassTalentPanel from './ClassTalentPanel';
import { SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { AbilityLoadout } from '@/utils/weaponAbilities';
import type { TalentId, TalentLoadout } from '@/utils/talents';
import { isSelectableArchetype, type Archetype } from '@/utils/archetypes';
import type { CoopAllyKind } from '@/utils/coopAllyTargeting';
import { EMPTY_EXPLORE_RESEARCH, type ExploreBuildMenuView, type ExploreCathedralOfferEntry, type ExploreFirePitHealAction, type ExploreResearchState, type ExploreResearchUpgradeId, type ExploreShrineGiftId } from '@/utils/exploreBuildings';
import type { FaeBeastCompanionKind } from '@/utils/faeBeastCompanion';
import {
  isBeastmasterBowAspect,
  type WeaponAspect,
} from '@/utils/weaponAspects';
import ArchetypeBadge from './ArchetypeBadge';
import CompanionBadge from './CompanionBadge';
import InteractHintPanel from './InteractHintPanel';
import BuildMenuPanel from './BuildMenuPanel';
import BarracksRecruitPanel from './BarracksRecruitPanel';
import ResearchStationPanel from './ResearchStationPanel';
import ShrineGiftPanel from './ShrineGiftPanel';
import CathedralLegendaryPanel from './CathedralLegendaryPanel';
import ObeliskShopPanel from './ObeliskShopPanel';
import FirePitHealPanel from './FirePitHealPanel';

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
  buildMenuOpen?: boolean;
  buildMenuView?: ExploreBuildMenuView;
  hasLiveSpiritLounge?: boolean;
  hasLiveShrineOrObelisk?: boolean;
  barracksRecruitOpen?: boolean;
  playerWood?: number;
  playerFlow?: number;
  playerGold?: number;
  playerStone?: number;
  researchPanelOpen?: boolean;
  exploreResearch?: ExploreResearchState;
  onResearchPurchase?: (id: ExploreResearchUpgradeId) => void;
  shrinePanelOpen?: boolean;
  onShrineGift?: (id: ExploreShrineGiftId) => void;
  cathedralPanelOpen?: boolean;
  cathedralOffer?: ExploreCathedralOfferEntry[];
  onCathedralClaim?: (itemType: string) => void;
  obeliskPanelOpen?: boolean;
  onObeliskPurchase?: (id: TalentId) => void;
  firePitHealOpen?: boolean;
  playerMeat?: number;
  playerHunger?: number;
  playerAtFullHp?: boolean;
  onFirePitHeal?: (action: ExploreFirePitHealAction) => void;
  exploreAllyCount?: number;
  exploreAllyCap?: number;
  onBarracksRecruit?: (kind: CoopAllyKind) => void;
  gameMode?: 'menu' | 'singleplayer' | 'multiplayer' | 'pvp' | 'coop';
  selectedArchetype?: Archetype;
  /** Current throne weapon aspect (Beastmaster bow unlocks the tiger badge). */
  weaponAspect?: WeaponAspect | null;
  /** Co-op: true after ally recruited at end of Inner Sanctum IV; persists for the run. */
  coopIntroAllyChoiceMade?: boolean;
  coopAllyKind?: CoopAllyKind;
  /** Co-op: true after Fae Realm III grants a beast companion; persists for the run. */
  coopFaeBeastCompanionGranted?: boolean;
  coopFaeBeastCompanionKind?: FaeBeastCompanionKind | null;
  /** Co-op: Pack Expansion second wolf badge. */
  coopPetPackWolfActive?: boolean;
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
  buildMenuOpen = false,
  buildMenuView = 'root',
  hasLiveSpiritLounge = false,
  hasLiveShrineOrObelisk = false,
  barracksRecruitOpen = false,
  playerWood = 0,
  playerFlow = 0,
  playerGold = 0,
  playerStone = 0,
  researchPanelOpen = false,
  exploreResearch = EMPTY_EXPLORE_RESEARCH,
  onResearchPurchase,
  shrinePanelOpen = false,
  onShrineGift,
  cathedralPanelOpen = false,
  cathedralOffer = [],
  onCathedralClaim,
  obeliskPanelOpen = false,
  onObeliskPurchase,
  firePitHealOpen = false,
  playerMeat = 0,
  playerHunger = 0,
  playerAtFullHp = false,
  onFirePitHeal,
  exploreAllyCount = 0,
  exploreAllyCap = 1,
  onBarracksRecruit,
  gameMode,
  selectedArchetype,
  weaponAspect = null,
  coopIntroAllyChoiceMade = false,
  coopAllyKind = 'knight',
  coopFaeBeastCompanionGranted = false,
  coopFaeBeastCompanionKind = null,
  coopPetPackWolfActive = false,
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

  const showBeastmasterTigerBadge =
    gameMode === 'coop' &&
    currentWeapon === WeaponType.BOW &&
    isBeastmasterBowAspect(weaponAspect);
  const showAncestorBadge = gameMode === 'coop' && coopIntroAllyChoiceMade;
  const showCompanionBadge =
    gameMode === 'coop' && coopFaeBeastCompanionGranted && !!coopFaeBeastCompanionKind;
  const showPackWolfBadge =
    gameMode === 'coop' && coopPetPackWolfActive;
  const showArchetypeBadge =
    gameMode === 'pvp' &&
    selectedArchetype &&
    isSelectableArchetype(selectedArchetype);

  return (
    <>
      <div
        className="fixed top-4 left-4 z-40 flex flex-col items-start gap-2"
        data-block-game-input
      >
        {(showBeastmasterTigerBadge ||
          showAncestorBadge ||
          showCompanionBadge ||
          showPackWolfBadge ||
          showArchetypeBadge) && (
          <div className="flex flex-row items-start gap-2">
            {showBeastmasterTigerBadge && <CompanionBadge kind="tiger" />}
            {showAncestorBadge && (
              <ArchetypeBadge mode="ancestor" allyKind={coopAllyKind} />
            )}
            {showCompanionBadge && coopFaeBeastCompanionKind && (
              <CompanionBadge kind={coopFaeBeastCompanionKind} />
            )}
            {showPackWolfBadge && (
              <CompanionBadge kind="wolf" id="pack-wolf-badge" labelOverride="Pack Wolf" />
            )}
            {showArchetypeBadge && (
              <ArchetypeBadge archetype={selectedArchetype} />
            )}
          </div>
        )}
        <ClassTalentPanel
          currentWeapon={currentWeapon}
          talentLoadout={talentLoadout ?? null}
          abilityLoadout={abilityLoadout}
        />
      </div>

      <div
        className="fixed bottom-4 inset-x-0 z-40 flex justify-center pointer-events-none"
        data-block-game-input
      >
        <div className="pointer-events-auto select-none inline-flex w-max flex-col items-stretch gap-2">
          <BuildMenuPanel open={buildMenuOpen} view={buildMenuView} wood={playerWood} flow={playerFlow} stone={playerStone} hasLiveSpiritLounge={hasLiveSpiritLounge} hasLiveShrineOrObelisk={hasLiveShrineOrObelisk} exploreResearch={exploreResearch} />
          <BarracksRecruitPanel
            open={barracksRecruitOpen && !buildMenuOpen && !researchPanelOpen && !shrinePanelOpen && !cathedralPanelOpen && !obeliskPanelOpen && !firePitHealOpen}
            gold={playerGold}
            allyCount={exploreAllyCount}
            allyCap={exploreAllyCap}
            onRecruit={(kind) => onBarracksRecruit?.(kind)}
          />
          <ResearchStationPanel
            open={researchPanelOpen && !buildMenuOpen && !barracksRecruitOpen && !shrinePanelOpen && !cathedralPanelOpen && !obeliskPanelOpen && !firePitHealOpen}
            flow={playerFlow}
            gold={playerGold}
            research={exploreResearch}
            onPurchase={(id) => onResearchPurchase?.(id)}
          />
          <ShrineGiftPanel
            open={shrinePanelOpen && !buildMenuOpen && !barracksRecruitOpen && !researchPanelOpen && !cathedralPanelOpen && !obeliskPanelOpen && !firePitHealOpen}
            onSelect={(id) => onShrineGift?.(id)}
          />
          <CathedralLegendaryPanel
            open={cathedralPanelOpen && !buildMenuOpen && !barracksRecruitOpen && !researchPanelOpen && !shrinePanelOpen && !obeliskPanelOpen && !firePitHealOpen}
            options={cathedralOffer}
            onSelect={(itemType) => onCathedralClaim?.(itemType)}
          />
          <ObeliskShopPanel
            open={obeliskPanelOpen && !buildMenuOpen && !barracksRecruitOpen && !researchPanelOpen && !shrinePanelOpen && !cathedralPanelOpen && !firePitHealOpen}
            gold={playerGold}
            currentWeapon={currentWeapon}
            talentLoadout={talentLoadout ?? null}
            onPurchase={(id) => onObeliskPurchase?.(id)}
          />
          <FirePitHealPanel
            open={firePitHealOpen && !buildMenuOpen && !barracksRecruitOpen && !researchPanelOpen && !shrinePanelOpen && !cathedralPanelOpen && !obeliskPanelOpen}
            meat={playerMeat}
            hunger={playerHunger}
            playerAtFullHp={playerAtFullHp}
            allyCount={exploreAllyCount}
            onHeal={(action) => onFirePitHeal?.(action)}
          />
          <InteractHintPanel hint={buildMenuOpen || barracksRecruitOpen || researchPanelOpen || shrinePanelOpen || cathedralPanelOpen || obeliskPanelOpen || firePitHealOpen ? null : interactHint} />
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
