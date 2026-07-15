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
  | 'pick_post_boss';

export function CoopMainArenaPortals({
  thronePortalOffer,
  phase,
  portalsUnlocked = false,
  coopVoidPortalOffered = false,
}: {
  thronePortalOffer: readonly string[];
  phase: Phase;
  /** When false the portals render grey and are not interactable. */
  portalsUnlocked?: boolean;
  /** When true, a center void portal is offered alongside the dual gateways. */
  coopVoidPortalOffered?: boolean;
}) {
  const isBoss = phase === 'pick_boss' || phase === 'pre_boss_merchant';
  const isDualChoice = phase === 'pick_wave2' || phase === 'pick_pre_boss' || phase === 'pick_post_boss';
  const o = thronePortalOffer;

  const { left, right } = useMemo(() => {
    if (isBoss) {
      return { left: 'boss' as CoopPortalKind, right: 'boss' as CoopPortalKind };
    }
    return {
      left: o[0] ? normalizeCoopPortalKind(o[0]) : 'purple',
      right: o[1] ? normalizeCoopPortalKind(o[1]) : 'red',
    };
  }, [isBoss, o]);

  if (isBoss) {
    return (
      <group name="coop-main-arena-boss-portal" position={[MAIN_COMBAT_BOSS_PORTAL_POSITION.x, MAIN_COMBAT_BOSS_PORTAL_POSITION.y, MAIN_COMBAT_BOSS_PORTAL_POSITION.z]}>
        <ThronePortalRing campType="boss" locked={!portalsUnlocked} />
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
