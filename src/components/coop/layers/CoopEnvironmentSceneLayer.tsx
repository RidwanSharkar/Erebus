'use client';

import React, { memo } from 'react';
import type { PerspectiveCamera } from 'three';
import Environment from '@/components/environment/Environment';
import HexCombatArena from '@/components/environment/HexCombatArena';
import CastleRoom from '@/components/environment/CastleRoom';
import ErebusGateRoom from '@/components/environment/ErebusGateRoom';
import SunkenTempleRoom from '@/components/environment/SunkenTempleRoom';
import EternityPalaceRoom from '@/components/environment/EternityPalaceRoom';
import FaeRealmRoom from '@/components/environment/FaeRealmRoom';
import SpecialMapCenterDecor from '@/components/environment/SpecialMapCenterDecor';
import { CoopMainArenaPortals } from '@/components/environment/CoopMainArenaPortals';
import CombatArenaPedestal from '@/components/environment/CombatArenaPedestal';
import MerchantNpcRenderer from '@/components/environment/MerchantNpcRenderer';
import MerchantShopPedestals from '@/components/environment/MerchantShopPedestals';
import ArchitectNpcRenderer from '@/components/environment/ArchitectNpcRenderer';
import DreamLayerPedestals from '@/components/environment/DreamLayerPedestals';
import VoidPortal from '@/components/environment/VoidPortal';
import HealingFountain from '@/components/environment/HealingFountain';
import EdenFinaleDaisy from '@/components/environment/EdenFinaleDaisy';
import DeliriumStructure from '@/components/environment/DeliriumStructure';
import IntroAllyChoiceEncounter from '@/components/coop/IntroAllyChoiceEncounter';
import SunkenSentinelEncounter from '@/components/coop/SunkenSentinelEncounter';
import EternityPalaceLootEncounter from '@/components/coop/EternityPalaceLootEncounter';
import type { IntroAllyChoiceEncounterRef } from '@/utils/coopAllyChoice';
import type { SunkenSentinelEncounterRef } from '@/utils/sunkenSentinelEncounter';
import type { EternityPalaceEncounterRef } from '@/utils/eternityPalaceEncounter';
import type { CoopAllyKind } from '@/utils/coopAllyTargeting';
import {
  CoopPortalRingsWithTooltips,
  normalizeCoopPortalKind,
  MAIN_COMBAT_BOSS_PORTAL_POSITION,
  CASTLE_ROOM_CHOICE_PORTAL_POSITIONS,
  type CoopPortalTooltipEntry,
} from '@/components/environment/ThroneRoom';
import type { CoopTerrainTheme, DeliriumStructureState, DreamLayerPurchaseState, DreamLayerStockItem, MerchantPurchaseState, MerchantStockItem } from '@/contexts/MultiplayerContext';
import type { World } from '@/ecs/World';
import type { Vector3 } from 'three';
import type { WeaponAspect } from '@/utils/weaponAspects';

type CoopEnvironmentSceneLayerProps = {
  inThroneRoom: boolean;
  inBossThroneArena: boolean;
  isHexCombatArena: boolean;
  isIntroCastleRoom: boolean;
  hexArenaVariant: 'stat' | 'trial' | 'chaos' | 'merchant' | 'eden' | 'dream_layer';
  coopCombatArenaEnterSeq: number;
  coopDeepSanctumLevel: number;
  coopSunkenRoomIndex: number;
  coopFaeRealmRoomIndex: number;
  coopEternityRoomIndex: number;
  coopTerrainTheme: CoopTerrainTheme;
  campTypes: string[];
  coopCurrentRoomKind: string | null;
  coopClearedRoomKind: string | null;
  coopMainArenaPortalPhase:
    | 'pick_wave2'
    | 'pick_pre_boss'
    | 'pre_boss_reward'
    | 'pre_boss_merchant'
    | 'pick_boss'
    | 'pick_post_boss'
    | 'pick_sunken_entry'
    | 'pick_eternity_entry'
    | 'pick_eternity_late_entry'
    | 'pick_trinity_finale'
    | 'eden_exit'
    | null;
  thronePortalOffer: readonly string[];
  portalsUnlocked: boolean;
  combatArenaActive: boolean;
  enemiesCount: number;
  pedestalBoonReady: boolean;
  mushroomHiddenIndices: ReadonlySet<number>;
  coopIntroPortalOpen: boolean;
  coopIntroFountainPhase: boolean;
  coopIntroFountainUsed: boolean;
  coopIntroAllyChoiceMade: boolean;
  coopFaeRealmPortalOpen: boolean;
  coopSunkenPortalOpen: boolean;
  coopSunkenFountainPhase: boolean;
  coopSunkenFountainUsed: boolean;
  coopSunkenLootPhaseComplete: boolean;
  coopEternityPortalOpen: boolean;
  coopEternityFountainPhase: boolean;
  coopEternityFountainUsed: boolean;
  coopEternityLootPhaseComplete: boolean;
  coopAllyOffer: readonly CoopAllyKind[];
  coopAllyKind: CoopAllyKind | null;
  introAllyChoiceEncounterRef: React.MutableRefObject<IntroAllyChoiceEncounterRef | null>;
  sunkenSentinelEncounterRef: React.MutableRefObject<SunkenSentinelEncounterRef | null>;
  eternityPalaceEncounterRef: React.MutableRefObject<EternityPalaceEncounterRef | null>;
  coopVoidPortalOffered: boolean;
  deepSanctumRewardKind: string | null;
  coopEdenFountainUsed: boolean;
  coopEdenResumeKind: string | null;
  coopFalseEdenCleared: boolean;
  deliriumStructure: DeliriumStructureState | null;
  world: World | null | undefined;
  camera: PerspectiveCamera | null;
  realTimePlayerPositionRef: React.MutableRefObject<Vector3>;
  merchantInventory: MerchantStockItem[];
  merchantPurchaseState: MerchantPurchaseState;
  weaponAspect?: WeaponAspect | null;
  dreamLayerInventory: DreamLayerStockItem[];
  dreamLayerPurchaseState: DreamLayerPurchaseState;
  /** Server-authoritative random CustomSky preset index. */
  skyPresetIndex: number;
  onEdenFinaleDaisyInteract?: () => void;
};

function edenResumePortalCampType(kind: string | null | undefined) {
  if (kind === 'deep_sanctum') return 'purple' as const;
  return normalizeCoopPortalKind(kind ?? undefined);
}

const CoopEnvironmentSceneLayer = memo(function CoopEnvironmentSceneLayer({
  inThroneRoom,
  inBossThroneArena,
  isHexCombatArena,
  isIntroCastleRoom,
  hexArenaVariant,
  coopCombatArenaEnterSeq,
  coopDeepSanctumLevel,
  coopSunkenRoomIndex,
  coopFaeRealmRoomIndex,
  coopEternityRoomIndex,
  coopTerrainTheme,
  campTypes,
  coopCurrentRoomKind,
  coopClearedRoomKind,
  coopMainArenaPortalPhase,
  thronePortalOffer,
  portalsUnlocked,
  combatArenaActive,
  enemiesCount,
  pedestalBoonReady,
  mushroomHiddenIndices,
  coopIntroPortalOpen,
  coopIntroFountainPhase,
  coopIntroFountainUsed,
  coopIntroAllyChoiceMade,
  coopFaeRealmPortalOpen,
  coopSunkenPortalOpen,
  coopSunkenFountainPhase,
  coopSunkenFountainUsed,
  coopSunkenLootPhaseComplete,
  coopEternityPortalOpen,
  coopEternityFountainPhase,
  coopEternityFountainUsed,
  coopEternityLootPhaseComplete,
  coopAllyOffer,
  coopAllyKind,
  introAllyChoiceEncounterRef,
  sunkenSentinelEncounterRef,
  eternityPalaceEncounterRef,
  coopVoidPortalOffered,
  deepSanctumRewardKind,
  coopEdenFountainUsed,
  coopEdenResumeKind,
  coopFalseEdenCleared,
  deliriumStructure,
  world,
  camera,
  realTimePlayerPositionRef,
  merchantInventory,
  merchantPurchaseState,
  weaponAspect,
  dreamLayerInventory,
  dreamLayerPurchaseState,
  skyPresetIndex,
  onEdenFinaleDaisyInteract,
}: CoopEnvironmentSceneLayerProps) {
  void isIntroCastleRoom;

  if (inThroneRoom || inBossThroneArena) {
    return null;
  }

  const o = thronePortalOffer;
  const leftCamp = o && o.length > 0 ? normalizeCoopPortalKind(o[0]) : 'purple';
  const rightCamp = o && o.length >= 2 ? normalizeCoopPortalKind(o[1]) : 'red';

  const isCastleRoom = coopCurrentRoomKind === 'intro' || coopCurrentRoomKind === 'deep_sanctum';  const isSunkenTemple = coopCurrentRoomKind === 'sunken_temple';  const isEternityPalace = coopCurrentRoomKind === 'eternity_palace';  const isFaeRealm = coopCurrentRoomKind === 'fae_realm';  const isDeepSanctum = coopCurrentRoomKind === 'deep_sanctum';  const isEdenRoom = coopCurrentRoomKind === 'eden';
  const isEdenFinaleRoom = coopCurrentRoomKind === 'eden_finale';
  const isFalseEdenRoom = coopCurrentRoomKind === 'false_eden';
  const isDeliriumRoom = coopCurrentRoomKind === 'delirium_gate';
  const isErebusGateRoom = coopCurrentRoomKind === 'erebus_gate';
  const isDreamLayerRoom = coopCurrentRoomKind === 'dream_layer';
  const isSurpriseRoom = isEdenRoom || isFalseEdenRoom || isDeliriumRoom || isErebusGateRoom || isDreamLayerRoom;
  const showFalseEdenFountain = isFalseEdenRoom && coopFalseEdenCleared;
  const showSurpriseExitPortal =
    (isEdenRoom && coopEdenFountainUsed)
    || (isFalseEdenRoom && coopEdenFountainUsed)
    || (isDeliriumRoom && coopMainArenaPortalPhase === 'eden_exit')
    || (isErebusGateRoom && coopMainArenaPortalPhase === 'eden_exit')
    || (isDreamLayerRoom && coopMainArenaPortalPhase === 'eden_exit');
  const deepSanctumPedestalReady = isDeepSanctum && deepSanctumRewardKind != null;
  const edenExitPortalCamp = edenResumePortalCampType(coopEdenResumeKind);

  const fountainChoicePortals: CoopPortalTooltipEntry[] = [
    {
      key: 'fountain-left',
      kind: leftCamp,
      x: CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[0]!.x,
      y: CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[0]!.y,
      z: CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[0]!.z,
    },
    {
      key: 'fountain-right',
      kind: rightCamp,
      x: CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[1]!.x,
      y: CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[1]!.y,
      z: CASTLE_ROOM_CHOICE_PORTAL_POSITIONS[1]!.z,
    },
  ];

  const surpriseExitPortals: CoopPortalTooltipEntry[] = [
    {
      key: 'surprise-exit',
      kind: edenExitPortalCamp,
      x: MAIN_COMBAT_BOSS_PORTAL_POSITION.x,
      y: MAIN_COMBAT_BOSS_PORTAL_POSITION.y,
      z: MAIN_COMBAT_BOSS_PORTAL_POSITION.z,
    },
  ];

  const specialMapRoomIndex = isDeepSanctum
    ? coopDeepSanctumLevel
    : isSunkenTemple
      ? coopSunkenRoomIndex
      : isFaeRealm
        ? coopFaeRealmRoomIndex
        : isEternityPalace
          ? coopEternityRoomIndex
          : 0;
  const showSpecialMapCenterDecor =
    isDeepSanctum || isSunkenTemple || isFaeRealm || isEternityPalace;

  return (
    <>
      {showSpecialMapCenterDecor && (
        <SpecialMapCenterDecor
          roomKind={coopCurrentRoomKind}
          roomIndex={specialMapRoomIndex}
          enterSeq={coopCombatArenaEnterSeq}
          combatActive={combatArenaActive && enemiesCount > 0}
        />
      )}
      {isFaeRealm ? (
        <FaeRealmRoom
          key={`coop-fae-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
          hiddenIndices={mushroomHiddenIndices}
        />
      ) : isCastleRoom ? (
        <CastleRoom
          key={`coop-castle-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
          skyPresetIndex={skyPresetIndex}
        />
      ) : isSunkenTemple ? (
        <SunkenTempleRoom
          key={`coop-sunken-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
        />
      ) : isEternityPalace ? (
        <EternityPalaceRoom
          key={`coop-eternity-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
          skyPresetIndex={skyPresetIndex}
        />
      ) : isErebusGateRoom ? (
        <ErebusGateRoom
          key={`coop-erebus-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
          skyPresetIndex={skyPresetIndex}
        />
      ) : isHexCombatArena ? (
        <HexCombatArena
          key={`coop-hex-env-${coopCombatArenaEnterSeq}-${coopCurrentRoomKind}`}
          variant={hexArenaVariant}
          combatActive={combatArenaActive && enemiesCount > 0}
          hiddenIndices={mushroomHiddenIndices}
          skyPresetIndex={skyPresetIndex}
        />
      ) : (
        <Environment
          key="coop-main-environment"
          level={1}
          world={world ?? undefined}
          camera={camera as PerspectiveCamera}
          enableLargeTree={true}
          isPVP={false}
          campTypes={campTypes}
          coopTerrainTheme={coopTerrainTheme}
          coopCurrentRoomKind={coopCurrentRoomKind}
          animateClouds={!(combatArenaActive && enemiesCount > 0)}
          skyPresetIndex={skyPresetIndex}
        />
      )}
      {isFaeRealm && coopFaeRealmPortalOpen && (
        <VoidPortal position={[0, 0.05, 0]} open={1} visible />
      )}
      {isCastleRoom && coopCurrentRoomKind === 'intro' && coopIntroPortalOpen && (
        <VoidPortal position={[0, 0.05, 0]} open={1} visible />
      )}
      {isCastleRoom && coopCurrentRoomKind === 'intro' && coopIntroFountainPhase && (
        <>
          <HealingFountain active used={coopIntroFountainUsed} />
          {(coopAllyOffer.length > 0 || coopIntroAllyChoiceMade) && (
            <IntroAllyChoiceEncounter
              offer={coopAllyOffer}
              allyChoiceMade={coopIntroAllyChoiceMade}
              chosenKind={coopAllyKind}
              playerPositionRef={realTimePlayerPositionRef}
              encounterRef={introAllyChoiceEncounterRef}
            />
          )}
          {coopIntroAllyChoiceMade && coopIntroFountainUsed && o.length >= 2 && (
            <group name="intro-fountain-portals">
              <CoopPortalRingsWithTooltips
                portals={fountainChoicePortals}
                playerPositionRef={realTimePlayerPositionRef}
                locked={false}
              />
            </group>
          )}
        </>
      )}
      {isSunkenTemple && coopSunkenPortalOpen && (
        <VoidPortal position={[0, 0.05, 0]} open={1} visible scheme="sunken" />
      )}
      {isSunkenTemple && coopSunkenFountainPhase && (
        <>
          <HealingFountain active used={coopSunkenFountainUsed} />
          {!coopSunkenLootPhaseComplete && (
            <SunkenSentinelEncounter
              lootPhaseComplete={coopSunkenLootPhaseComplete}
              playerPositionRef={realTimePlayerPositionRef}
              encounterRef={sunkenSentinelEncounterRef}
            />
          )}
          {coopSunkenLootPhaseComplete && coopSunkenFountainUsed && o.length >= 2 && (
            <group name="sunken-fountain-portals">
              <CoopPortalRingsWithTooltips
                portals={fountainChoicePortals}
                playerPositionRef={realTimePlayerPositionRef}
                locked={false}
              />
            </group>
          )}
        </>
      )}
      {isEternityPalace && coopEternityPortalOpen && (
        <VoidPortal position={[0, 0.05, 0]} open={1} visible scheme="eternity" />
      )}
      {isEternityPalace && coopEternityFountainPhase && (
        <>
          <HealingFountain active used={coopEternityFountainUsed} />
          {!coopEternityLootPhaseComplete && (
            <EternityPalaceLootEncounter
              lootPhaseComplete={coopEternityLootPhaseComplete}
              playerPositionRef={realTimePlayerPositionRef}
              encounterRef={eternityPalaceEncounterRef}
            />
          )}
          {coopEternityLootPhaseComplete && coopEternityFountainUsed && o.length >= 2 && (
            <group name="eternity-fountain-portals">
              <CoopPortalRingsWithTooltips
                portals={fountainChoicePortals}
                playerPositionRef={realTimePlayerPositionRef}
                locked={false}
              />
            </group>
          )}
        </>
      )}
      {isEdenRoom && (
        <>
          <HealingFountain active used={coopEdenFountainUsed} />
          {showSurpriseExitPortal && coopEdenResumeKind && (
            <group name="eden-exit-portal">
              <CoopPortalRingsWithTooltips
                portals={surpriseExitPortals}
                playerPositionRef={realTimePlayerPositionRef}
                locked={false}
              />
            </group>
          )}
        </>
      )}
      {isEdenFinaleRoom && (
        <EdenFinaleDaisy onInteract={onEdenFinaleDaisyInteract} />
      )}
      {isFalseEdenRoom && showFalseEdenFountain && (
        <>
          <HealingFountain active used={coopEdenFountainUsed} />
          {showSurpriseExitPortal && coopEdenResumeKind && (
            <group name="false-eden-exit-portal">
              <CoopPortalRingsWithTooltips
                portals={surpriseExitPortals}
                playerPositionRef={realTimePlayerPositionRef}
                locked={false}
              />
            </group>
          )}
        </>
      )}
      {isDeliriumRoom && deliriumStructure && (
        <DeliriumStructure structure={deliriumStructure} />
      )}
      {isDeliriumRoom && showSurpriseExitPortal && coopEdenResumeKind && (
        <group name="delirium-exit-portal">
          <CoopPortalRingsWithTooltips
            portals={surpriseExitPortals}
            playerPositionRef={realTimePlayerPositionRef}
            locked={false}
          />
        </group>
      )}
      {isErebusGateRoom && showSurpriseExitPortal && coopEdenResumeKind && (
        <group name="erebus-exit-portal">
          <CoopPortalRingsWithTooltips
            portals={surpriseExitPortals}
            playerPositionRef={realTimePlayerPositionRef}
            locked={false}
          />
        </group>
      )}
      {isDreamLayerRoom && showSurpriseExitPortal && coopEdenResumeKind && (
        <group name="dream-layer-exit-portal">
          <CoopPortalRingsWithTooltips
            portals={surpriseExitPortals}
            playerPositionRef={realTimePlayerPositionRef}
            locked={false}
          />
        </group>
      )}
      {combatArenaActive && coopMainArenaPortalPhase && !isCastleRoom && !isSunkenTemple && !isEternityPalace && !isSurpriseRoom && (
        <CoopMainArenaPortals
          thronePortalOffer={thronePortalOffer}
          phase={coopMainArenaPortalPhase}
          portalsUnlocked={portalsUnlocked}
          coopVoidPortalOffered={coopVoidPortalOffered}
          portalGroundY={isHexCombatArena ? 0 : MAIN_COMBAT_BOSS_PORTAL_POSITION.y}
          playerPositionRef={realTimePlayerPositionRef}
        />
      )}
      {combatArenaActive && !isCastleRoom && !isSunkenTemple && !isEternityPalace && coopCurrentRoomKind !== 'merchant' && coopCurrentRoomKind !== 'dream_layer' && coopCurrentRoomKind !== 'fae_realm' && coopCurrentRoomKind !== 'eden_finale' && !isSurpriseRoom && (
        <CombatArenaPedestal
          campType={((k) => (k === 'red' ? 'purple' : k))(
            normalizeCoopPortalKind(coopClearedRoomKind ?? coopCurrentRoomKind ?? campTypes[0]),
          )}
          showAura={pedestalBoonReady}
        />
      )}
      {combatArenaActive && isDeepSanctum && (
        <CombatArenaPedestal
          campType="purple"
          showAura={deepSanctumPedestalReady}
        />
      )}
      {combatArenaActive && coopCurrentRoomKind === 'merchant' && (
        <>
          <MerchantShopPedestals
            inventory={merchantInventory}
            purchaseState={merchantPurchaseState}
            playerPositionRef={realTimePlayerPositionRef}
            weaponAspect={weaponAspect}
          />
          <MerchantNpcRenderer playerPositionRef={realTimePlayerPositionRef} />
        </>
      )}
      {combatArenaActive && coopCurrentRoomKind === 'dream_layer' && (
        <>
          <DreamLayerPedestals
            inventory={dreamLayerInventory}
            purchaseState={dreamLayerPurchaseState}
            playerPositionRef={realTimePlayerPositionRef}
          />
          <ArchitectNpcRenderer playerPositionRef={realTimePlayerPositionRef} />
        </>
      )}
    </>
  );
});

export default CoopEnvironmentSceneLayer;
