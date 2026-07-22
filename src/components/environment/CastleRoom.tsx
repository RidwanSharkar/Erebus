'use client';

import React from 'react';
import CustomSky from './CustomSky';
import SanctumIncinerationRuneDisc from './SanctumIncinerationRuneDisc';
import ThroneOuterFloor from './ThroneOuterFloor';
import { CASTLE_ROOM_HALF_SIZE } from '@/utils/mapConstants';

interface CastleRoomProps {
  combatActive?: boolean;
}

const CastleRoom: React.FC<CastleRoomProps> = ({ combatActive = false }) => {
  return (
    <group name="castle-intro-room">
      <CustomSky skyPreset="sanctumHoly" animateClouds={!combatActive} />

      <ThroneOuterFloor
        radius={CASTLE_ROOM_HALF_SIZE}
        texturePath="/outer1.webp"
        position={[-0.4, 0.01, -0.2]}
      />

      <SanctumIncinerationRuneDisc />
    </group>
  );
};

export default React.memo(CastleRoom);
