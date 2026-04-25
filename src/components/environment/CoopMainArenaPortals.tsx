import React, { useMemo } from 'react';
import {
  ThronePortalRing,
  normalizeThroneCamp,
  type ThroneMainRoomCamp,
  MAIN_COMBAT_CHOICE_PORTAL_POSITIONS,
  MAIN_COMBAT_BOSS_PORTAL_POSITION,
} from '@/components/environment/ThroneRoom';

type Phase = 'pick_wave2' | 'pick_boss';

export function CoopMainArenaPortals({
  thronePortalOffer,
  phase,
}: {
  thronePortalOffer: readonly string[];
  phase: Phase;
}) {
  const isBoss = phase === 'pick_boss';
  const o = thronePortalOffer;

  const { left, right } = useMemo(() => {
    if (isBoss) {
      return { left: 'purple' as ThroneMainRoomCamp, right: 'purple' as ThroneMainRoomCamp };
    }
    return {
      left: o[0] ? normalizeThroneCamp(o[0]) : 'purple',
      right: o[1] ? normalizeThroneCamp(o[1]) : 'red',
    };
  }, [isBoss, o]);

  if (isBoss) {
    return (
      <group name="coop-main-arena-boss-portal" position={[MAIN_COMBAT_BOSS_PORTAL_POSITION.x, MAIN_COMBAT_BOSS_PORTAL_POSITION.y, MAIN_COMBAT_BOSS_PORTAL_POSITION.z]}>
        <ThronePortalRing campType="purple" />
      </group>
    );
  }

  return (
    <group name="coop-main-arena-choice-portals">
      {MAIN_COMBAT_CHOICE_PORTAL_POSITIONS.map((pos, i) => (
        <group key={`main-arena-portal-${i}`} position={[pos.x, pos.y, pos.z]}>
          <ThronePortalRing campType={i === 0 ? left : right} />
        </group>
      ))}
    </group>
  );
}
