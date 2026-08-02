import React, { useMemo } from 'react';
import {
  ThronePortalRing,
  normalizeCoopPortalKind,
  type CoopPortalKind,
  MAIN_COMBAT_CHOICE_PORTAL_POSITIONS,
  MAIN_COMBAT_BOSS_PORTAL_POSITION,
} from '@/components/environment/ThroneRoom';
import VoidPortal from '@/components/environment/VoidPortal';

type Phase =
  | 'pick_wave2'
  | 'pick_pre_boss'
  | 'pre_boss_reward'
  | 'pre_boss_merchant'
  | 'pick_boss'
  | 'pick_post_boss'
  | 'pick_sunken_entry'
  | 'pick_eternity_entry'
  | 'pick_eternity_late_entry'
  | 'eden_exit';

export function CoopMainArenaPortals({
  thronePortalOffer,
  phase,
  portalsUnlocked = false,
  coopVoidPortalOffered = false,
  portalGroundY = MAIN_COMBAT_BOSS_PORTAL_POSITION.y,
}: {
  thronePortalOffer: readonly string[];
  phase: Phase;
  /** When false the portals render grey and are not interactable. */
  portalsUnlocked?: boolean;
  /** When true, a center void portal is offered alongside the dual gateways. */
  coopVoidPortalOffered?: boolean;
  /** Y offset for the boss void portal group (0 on flat hex arenas, THRONE_PORTAL_Y on main map). */
  portalGroundY?: number;
}) {
  const isBoss = phase === 'pick_boss' || phase === 'pre_boss_merchant';
  const isDualChoice = phase === 'pick_wave2' || phase === 'pick_pre_boss' || phase === 'pick_post_boss';
  const isSunkenEntry = phase === 'pick_sunken_entry';
  const isEternityEntry = phase === 'pick_eternity_entry' || phase === 'pick_eternity_late_entry';
  const o = thronePortalOffer;

  const { left, right } = useMemo(() => {
    if (isBoss || isSunkenEntry || isEternityEntry) {
      return { left: 'boss' as CoopPortalKind, right: 'boss' as CoopPortalKind };
    }
    return {
      left: o[0] ? normalizeCoopPortalKind(o[0]) : 'purple',
      right: o[1] ? normalizeCoopPortalKind(o[1]) : 'red',
    };
  }, [isBoss, isSunkenEntry, isEternityEntry, o]);

  if (isBoss || isSunkenEntry || isEternityEntry) {
    const groundY = isSunkenEntry || isEternityEntry ? 0 : portalGroundY;
    const groupName = isEternityEntry
      ? 'coop-main-arena-eternity-portal'
      : isSunkenEntry
        ? 'coop-main-arena-sunken-portal'
        : 'coop-main-arena-boss-portal';
    return (
      <group
        name={groupName}
        position={[MAIN_COMBAT_BOSS_PORTAL_POSITION.x, groundY, MAIN_COMBAT_BOSS_PORTAL_POSITION.z]}
      >
        <VoidPortal
          scheme={isEternityEntry ? 'eternity' : isSunkenEntry ? 'sunken' : 'boss'}
          position={[0, 0.05, 0]}
          open={portalsUnlocked ? 1 : 0}
          visible={portalsUnlocked}
          effectHeightOffset={0.3}
        />
      </group>
    );
  }

  if (!isDualChoice) {
    return null;
  }

  return (
    <group name="coop-main-arena-choice-portals">
      {MAIN_COMBAT_CHOICE_PORTAL_POSITIONS.map((pos, i) => (
        <group key={`main-arena-portal-${i}`} position={[pos.x, pos.y, pos.z]}>
          <ThronePortalRing campType={i === 0 ? left : right} locked={!portalsUnlocked} />
        </group>
      ))}
      {coopVoidPortalOffered && (
        <group
          name="main-arena-void-portal"
          position={[
            MAIN_COMBAT_BOSS_PORTAL_POSITION.x,
            0,
            MAIN_COMBAT_BOSS_PORTAL_POSITION.z,
          ]}
        >
          <VoidPortal
            position={[0, 0.05, 0]}
            open={portalsUnlocked ? 1 : 0}
            visible={portalsUnlocked}
            effectHeightOffset={0.3}
          />
        </group>
      )}
    </group>
  );
}
