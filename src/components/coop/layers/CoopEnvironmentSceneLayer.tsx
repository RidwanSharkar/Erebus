'use client';

import React, { memo } from 'react';
import type { PerspectiveCamera } from 'three';
import Environment from '@/components/environment/Environment';
import HexCombatArena from '@/components/environment/HexCombatArena';
import CastleWallCollision from '@/components/environment/CastleWallCollision';
import { CoopMainArenaPortals } from '@/components/environment/CoopMainArenaPortals';
import CombatArenaPedestal from '@/components/environment/CombatArenaPedestal';
import MerchantNpcRenderer from '@/components/environment/MerchantNpcRenderer';
import { normalizeCoopPortalKind } from '@/components/environment/ThroneRoom';
import type { CoopTerrainTheme } from '@/contexts/MultiplayerContext';
import type { World } from '@/ecs/World';
import type { Vector3 } from 'three';

type CoopEnvironmentSceneLayerProps = {
  inThroneRoom: boolean;
  inBossThroneArena: boolean;
  isHexCombatArena: boolean;
  hexArenaVariant: 'stat' | 'chaos' | 'merchant';
  coopCombatArenaEnterSeq: number;
  coopTerrainTheme: CoopTerrainTheme;
  campTypes: string[];
  coopCurrentRoomKind: string | null;
  coopClearedRoomKind: string | null;
  coopMainArenaPortalPhase: 'pick_wave2' | 'pick_boss' | 'pick_post_boss' | null;
  thronePortalOffer: readonly string[];
  portalsUnlocked: boolean;
  combatArenaActive: boolean;
  enemiesCount: number;
  pedestalBoonReady: boolean;
  mushroomHiddenIndices: ReadonlySet<number>;
  mushroomHiddenVersion: number;
  world: World | null | undefined;
  camera: PerspectiveCamera | null;
  realTimePlayerPositionRef: React.MutableRefObject<Vector3>;
};

const CoopEnvironmentSceneLayer = memo(function CoopEnvironmentSceneLayer({
  inThroneRoom,
  inBossThroneArena,
  isHexCombatArena,
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
  world,
  camera,
  realTimePlayerPositionRef,
}: CoopEnvironmentSceneLayerProps) {
  void mushroomHiddenVersion;

  if (inThroneRoom || inBossThroneArena) {
    return null;
  }

  return (
    <>
      {isHexCombatArena ? (
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
      {world && !isHexCombatArena && (
        <CastleWallCollision
          world={world}
          enabled={!inThroneRoom && !inBossThroneArena && !isHexCombatArena}
        />
      )}
      {combatArenaActive && coopMainArenaPortalPhase && (
        <CoopMainArenaPortals
          thronePortalOffer={thronePortalOffer}
          phase={coopMainArenaPortalPhase}
          portalsUnlocked={portalsUnlocked}
        />
      )}
      {combatArenaActive && (
        <CombatArenaPedestal
          campType={((k) => (k === 'red' ? 'purple' : k))(
            normalizeCoopPortalKind(coopClearedRoomKind ?? coopCurrentRoomKind ?? campTypes[0]),
          )}
          showAura={pedestalBoonReady}
        />
      )}
      {combatArenaActive && coopCurrentRoomKind === 'merchant' && (
        <MerchantNpcRenderer playerPositionRef={realTimePlayerPositionRef} />
      )}
    </>
  );
});

export default CoopEnvironmentSceneLayer;
