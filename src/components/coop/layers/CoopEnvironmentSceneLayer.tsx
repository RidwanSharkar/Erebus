'use client';

import React, { memo } from 'react';
import type { PerspectiveCamera } from 'three';
import Environment from '@/components/environment/Environment';
import HexCombatArena from '@/components/environment/HexCombatArena';
import CastleRoom from '@/components/environment/CastleRoom';
import CastleWallCollision from '@/components/environment/CastleWallCollision';
import { CoopMainArenaPortals } from '@/components/environment/CoopMainArenaPortals';
import CombatArenaPedestal from '@/components/environment/CombatArenaPedestal';
import MerchantNpcRenderer from '@/components/environment/MerchantNpcRenderer';
import MerchantShopPedestals from '@/components/environment/MerchantShopPedestals';
import VoidPortal from '@/components/environment/VoidPortal';
import HealingFountain from '@/components/environment/HealingFountain';
import { ThronePortalRing, normalizeCoopPortalKind, MAIN_COMBAT_CHOICE_PORTAL_POSITIONS } from '@/components/environment/ThroneRoom';
import type { CoopTerrainTheme, MerchantPurchaseState, MerchantStockItem } from '@/contexts/MultiplayerContext';
import type { World } from '@/ecs/World';
import type { Vector3 } from 'three';

type CoopEnvironmentSceneLayerProps = {
  inThroneRoom: boolean;
  inBossThroneArena: boolean;
  isHexCombatArena: boolean;
  isIntroCastleRoom: boolean;
  hexArenaVariant: 'stat' | 'chaos' | 'merchant';
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
    | null;
  thronePortalOffer: readonly string[];
  portalsUnlocked: boolean;
  combatArenaActive: boolean;
  enemiesCount: number;
  pedestalBoonReady: boolean;
  mushroomHiddenIndices: ReadonlySet<number>;
  mushroomHiddenVersion: number;
  coopIntroPortalOpen: boolean;
  coopIntroFountainPhase: boolean;
  coopIntroFountainUsed: boolean;
  coopVoidPortalOffered: boolean;
  deepSanctumRewardKind: string | null;
  world: World | null | undefined;
  camera: PerspectiveCamera | null;
  realTimePlayerPositionRef: React.MutableRefObject<Vector3>;
  merchantInventory: MerchantStockItem[];
  merchantPurchaseState: MerchantPurchaseState;
};

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
  mushroomHiddenVersion,
  coopIntroPortalOpen,
  coopIntroFountainPhase,
  coopIntroFountainUsed,
  coopVoidPortalOffered,
  deepSanctumRewardKind,
  world,
  camera,
  realTimePlayerPositionRef,
  merchantInventory,
  merchantPurchaseState,
}: CoopEnvironmentSceneLayerProps) {
  void mushroomHiddenVersion;
  void isIntroCastleRoom;

  if (inThroneRoom || inBossThroneArena) {
    return null;
  }

  const o = thronePortalOffer;
  const leftCamp = o && o.length > 0 ? normalizeCoopPortalKind(o[0]) : 'purple';
  const rightCamp = o && o.length >= 2 ? normalizeCoopPortalKind(o[1]) : 'red';

  const isCastleRoom = coopCurrentRoomKind === 'intro' || coopCurrentRoomKind === 'deep_sanctum';
  const isDeepSanctum = coopCurrentRoomKind === 'deep_sanctum';
  const deepSanctumPedestalReady = isDeepSanctum && deepSanctumRewardKind != null;

  return (
    <>
      {isCastleRoom ? (
        <CastleRoom
          key={`coop-castle-env-${coopCombatArenaEnterSeq}`}
          combatActive={combatArenaActive && enemiesCount > 0}
        />
      ) : isHexCombatArena ? (
        <HexCombatArena
          key={`coop-hex-env-${coopCombatArenaEnterSeq}-${coopCurrentRoomKind}`}
          variant={hexArenaVariant}
          combatActive={combatArenaActive && enemiesCount > 0}
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
          mushroomHiddenIndices={mushroomHiddenIndices}
          animateClouds={!(combatArenaActive && enemiesCount > 0)}
        />
      )}
      {world && !isHexCombatArena && !isCastleRoom && (
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
          {o.length >= 2 && (
            <group name="intro-fountain-portals">
              {MAIN_COMBAT_CHOICE_PORTAL_POSITIONS.map((pos, i) => (
                <group key={`intro-fountain-portal-${i}`} position={[pos.x, pos.y, pos.z]}>
                  <ThronePortalRing
                    campType={i === 0 ? leftCamp : rightCamp}
                    locked={!coopIntroFountainUsed}
                  />
                </group>
              ))}
            </group>
          )}
        </>
      )}
      {combatArenaActive && coopMainArenaPortalPhase && !isCastleRoom && (
        <CoopMainArenaPortals
          thronePortalOffer={thronePortalOffer}
          phase={coopMainArenaPortalPhase}
          portalsUnlocked={portalsUnlocked}
          coopVoidPortalOffered={coopVoidPortalOffered}
        />
      )}
      {combatArenaActive && !isCastleRoom && coopCurrentRoomKind !== 'merchant' && (
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
    </>
  );
});

export default CoopEnvironmentSceneLayer;
