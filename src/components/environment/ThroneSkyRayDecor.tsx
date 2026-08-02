'use client';

import React from 'react';
import SkyRayOrbitDecor, { preloadSkyRayOrbitDecor } from './SkyRayOrbitDecor';

/**
 * Just beyond the grass disc — dark void outside the playable ring.
 * Keep in sync with `COOP_THRONE_ROOM_RADIUS` (15) in ThroneRoom.
 */
const THRONE_ORBIT_RADIUS = 15 + 6;
const BASILISK_SWIM_PATH = '/models/basilisk_swim.glb';

export function preloadThroneSkyRayDecor(): void {
  preloadSkyRayOrbitDecor(BASILISK_SWIM_PATH);
}

/** Two decorative basilisks orbiting the throne disc in the outer void. */
function ThroneSkyRayDecor() {
  return (
    <SkyRayOrbitDecor
      orbitRadius={THRONE_ORBIT_RADIUS}
      modelPath={BASILISK_SWIM_PATH}
    />
  );
}

export default React.memo(ThroneSkyRayDecor);
