import React, { useMemo } from 'react';
import {
  ThronePortalRing,
  normalizeCoopPortalKind,
  type CoopPortalKind,
  MAIN_COMBAT_CHOICE_PORTAL_POSITIONS,
  MAIN_COMBAT_BOSS_PORTAL_POSITION,
} from '@/components/environment/ThroneRoom';

type Phase = 'pick_wave2' | 'pick_boss' | 'pick_post_boss';

export function CoopMainArenaPortals({
  thronePortalOffer,
  phase,
  portalsUnlocked = false,
}: {
  thronePortalOffer: readonly string[];
  phase: Phase;
  /** When false the portals render grey and are not interactable. */
  portalsUnlocked?: boolean;
}) {
  const isBoss = phase === 'pick_boss';
  const isDualChoice = phase === 'pick_wave2' || phase === 'pick_post_boss';
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
    </group>
  );
}
