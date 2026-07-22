'use client';

import React, { memo } from 'react';
import type { PerspectiveCamera } from 'three';
import Environment from '@/components/environment/Environment';
import HexCombatArena from '@/components/environment/HexCombatArena';
import CastleRoom from '@/components/environment/CastleRoom';
import ErebusGateRoom from '@/components/environment/ErebusGateRoom';
import SunkenTempleRoom from '@/components/environment/SunkenTempleRoom';
import CastleWallCollision from '@/components/environment/CastleWallCollision';
import { CoopMainArenaPortals } from '@/components/environment/CoopMainArenaPortals';
import CombatArenaPedestal from '@/components/environment/CombatArenaPedestal';
import MerchantNpcRenderer from '@/components/environment/MerchantNpcRenderer';
import MerchantShopPedestals from '@/components/environment/MerchantShopPedestals';
import ArchitectNpcRenderer from '@/components/environment/ArchitectNpcRenderer';
import DreamLayerPedestals from '@/components/environment/DreamLayerPedestals';
import VoidPortal from '@/components/environment/VoidPortal';
import HealingFountain from '@/components/environment/HealingFountain';
import DeliriumStructure from '@/components/environment/DeliriumStructure';
import IntroAllyChoiceEncounter from '@/components/coop/IntroAllyChoiceEncounter';
import SunkenSentinelEncounter from '@/components/coop/SunkenSentinelEncounter';
import type { IntroAllyChoiceEncounterRef } from '@/utils/coopAllyChoice';
import type { SunkenSentinelEncounterRef } from '@/utils/sunkenSentinelEncounter';
import type { CoopAllyKind } from '@/utils/coopAllyTargeting';
import {
  ThronePortalRing,
  normalizeCoopPortalKind,
  MAIN_COMBAT_BOSS_PORTAL_POSITION,
  MAIN_COMBAT_CHOICE_PORTAL_POSITIONS,
} from '@/components/environment/ThroneRoom';
import type { CoopTerrainTheme, DeliriumStructureState, DreamLayerPurchaseState, DreamLayerStockItem, MerchantPurchaseState, MerchantStockItem } from '@/contexts/MultiplayerContext';
import type { World } from '@/ecs/World';
import type { Vector3 } from 'three';

type CoopEnvironmentSceneLayerProps = {
  inThroneRoom: boolean;
  inBossThroneArena: boolean;
  isHexCombatArena: boolean;
  isIntroCastleRoom: boolean;
  hexArenaVariant: 'stat' | 'chaos' | 'merchant' | 'eden' | 'dream_layer';
  coopCombatArenaEnterSeq: number;
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
  coopSunkenPortalOpen: boolean;
  coopSunkenFountainPhase: boolean;
  coopSunkenFountainUsed: boolean;
  coopSunkenLootPhaseComplete: boolean;
  coopAllyOffer: readonly CoopAllyKind[];
  coopAllyKind: CoopAllyKind | null;
  introAllyChoiceEncounterRef: React.MutableRefObject<IntroAllyChoiceEncounterRef | null>;
  sunkenSentinelEncounterRef: React.MutableRefObject<SunkenSentinelEncounterRef | null>;
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
  dreamLayerInventory: DreamLayerStockItem[];
  dreamLayerPurchaseState: DreamLayerPurchaseState;
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
  coopSunkenPortalOpen,
  coopSunkenFountainPhase,
  coopSunkenFountainUsed,
  coopSunkenLootPhaseComplete,
  coopAllyOffer,
  coopAllyKind,
  introAllyChoiceEncounterRef,
  sunkenSentinelEncounterRef,
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
  dreamLayerInventory,
  dreamLayerPurchaseState,
}: CoopEnvironmentSceneLayerProps) {
  void isIntroCastleRoom;

  if (inThroneRoom || inBossThroneArena) {
    return null;
  }

  const o = thronePortalOffer;
  const leftCamp = o && o.length > 0 ? normalizeCoopPortalKind(o[0]) : 'purple';
  const rightCamp = o && o.length >= 2 ? normalizeCoopPortalKind(o[1]) : 'red';

  const isCastleRoom = coopCurrentRoomKind === 'intro' || coopCurrentRoomKind === 'deep_sanctum';
  const isSunkenTemple = coopCurrentRoomKind === 'sunken_temple';
  const isDeepSanctum = coopCurrentRoomKind === 'deep_sanctum';
  const isEdenRoom = coopCurrentRoomKind === 'eden';
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

  return (
    <>
      {isCastleRoom ? (
        <CastleRoom
          key={`coop-castle-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
        />
      ) : isSunkenTemple ? (
        <SunkenTempleRoom
          key={`coop-sunken-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
        />
      ) : isErebusGateRoom ? (
        <ErebusGateRoom
          key={`coop-erebus-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
        />
      ) : isHexCombatArena ? (
        <HexCombatArena
          key={`coop-hex-env-${coopCombatArenaEnterSeq}-${coopCurrentRoomKind}`}
          variant={hexArenaVariant}
          combatActive={combatArenaActive && enemiesCount > 0}
          hiddenIndices={mushroomHiddenIndices}
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
          mushroomHiddenIndices={mushroomHiddenIndices}
          animateClouds={!(combatArenaActive && enemiesCount > 0)}
        />
      )}
      {world && !isHexCombatArena && !isCastleRoom && !isSunkenTemple && !isErebusGateRoom && (
        <CastleWallCollision
          world={world}
          enabled={!inThroneRoom && !inBossThroneArena && !isHexCombatArena}
        />
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
              {MAIN_COMBAT_CHOICE_PORTAL_POSITIONS.map((pos, i) => (
                <group key={`intro-fountain-portal-${i}`} position={[pos.x, pos.y, pos.z]}>
                  <ThronePortalRing
                    campType={i === 0 ? leftCamp : rightCamp}
                    locked={false}
                  />
                </group>
              ))}
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
              {MAIN_COMBAT_CHOICE_PORTAL_POSITIONS.map((pos, i) => (
                <group key={`sunken-fountain-portal-${i}`} position={[pos.x, pos.y, pos.z]}>
                  <ThronePortalRing
                    campType={i === 0 ? leftCamp : rightCamp}
                    locked={false}
                  />
                </group>
              ))}
            </group>
          )}
        </>
      )}
      {isEdenRoom && (
        <>
          <HealingFountain active used={coopEdenFountainUsed} />
          {showSurpriseExitPortal && coopEdenResumeKind && (
            <group
              name="eden-exit-portal"
              position={[
                MAIN_COMBAT_BOSS_PORTAL_POSITION.x,
                MAIN_COMBAT_BOSS_PORTAL_POSITION.y,
                MAIN_COMBAT_BOSS_PORTAL_POSITION.z,
              ]}
            >
              <ThronePortalRing campType={edenExitPortalCamp} locked={false} />
            </group>
          )}
        </>
      )}
      {isFalseEdenRoom && showFalseEdenFountain && (
        <>
          <HealingFountain active used={coopEdenFountainUsed} />
          {showSurpriseExitPortal && coopEdenResumeKind && (
            <group
              name="false-eden-exit-portal"
              position={[
                MAIN_COMBAT_BOSS_PORTAL_POSITION.x,
                MAIN_COMBAT_BOSS_PORTAL_POSITION.y,
                MAIN_COMBAT_BOSS_PORTAL_POSITION.z,
              ]}
            >
              <ThronePortalRing campType={edenExitPortalCamp} locked={false} />
            </group>
          )}
        </>
      )}
      {isDeliriumRoom && deliriumStructure && (
        <DeliriumStructure structure={deliriumStructure} />
      )}
      {isDeliriumRoom && showSurpriseExitPortal && coopEdenResumeKind && (
        <group
          name="delirium-exit-portal"
          position={[
            MAIN_COMBAT_BOSS_PORTAL_POSITION.x,
            MAIN_COMBAT_BOSS_PORTAL_POSITION.y,
            MAIN_COMBAT_BOSS_PORTAL_POSITION.z,
          ]}
        >
          <ThronePortalRing campType={edenExitPortalCamp} locked={false} />
        </group>
      )}
      {isErebusGateRoom && showSurpriseExitPortal && coopEdenResumeKind && (
        <group
          name="erebus-exit-portal"
          position={[
            MAIN_COMBAT_BOSS_PORTAL_POSITION.x,
            MAIN_COMBAT_BOSS_PORTAL_POSITION.y,
            MAIN_COMBAT_BOSS_PORTAL_POSITION.z,
          ]}
        >
          <ThronePortalRing campType={edenExitPortalCamp} locked={false} />
        </group>
      )}
      {isDreamLayerRoom && showSurpriseExitPortal && coopEdenResumeKind && (
        <group
          name="dream-layer-exit-portal"
          position={[
            MAIN_COMBAT_BOSS_PORTAL_POSITION.x,
            MAIN_COMBAT_BOSS_PORTAL_POSITION.y,
            MAIN_COMBAT_BOSS_PORTAL_POSITION.z,
          ]}
        >
          <ThronePortalRing campType={edenExitPortalCamp} locked={false} />
        </group>
      )}
      {combatArenaActive && coopMainArenaPortalPhase && !isCastleRoom && !isSunkenTemple && !isSurpriseRoom && (
        <CoopMainArenaPortals
          thronePortalOffer={thronePortalOffer}
          phase={coopMainArenaPortalPhase}
          portalsUnlocked={portalsUnlocked}
          coopVoidPortalOffered={coopVoidPortalOffered}
          portalGroundY={isHexCombatArena ? 0 : MAIN_COMBAT_BOSS_PORTAL_POSITION.y}
        />
      )}
      {combatArenaActive && !isCastleRoom && !isSunkenTemple && coopCurrentRoomKind !== 'merchant' && coopCurrentRoomKind !== 'dream_layer' && !isSurpriseRoom && (
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
