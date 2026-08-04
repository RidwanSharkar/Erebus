'use client';

import React, { useMemo } from 'react';
import MapCenterPrismDecor, { preloadMapCenterPrismDecor } from './MapCenterPrismDecor';
import SkyRayOrbitDecor, { preloadSkyRayOrbitDecor } from './SkyRayOrbitDecor';
import {
  isMapCenterDecorRoomKind,
  MAP_CENTER_DECOR_BY_KIND,
  mapCenterDecorSeed,
} from '@/utils/throneCenterDecorLayout';

export function preloadSpecialMapCenterDecor(): void {
  preloadMapCenterPrismDecor();
  preloadSkyRayOrbitDecor();
}

/**
 * Center floating prism for Inner Sanctum, Fae Realm, and Eternity's Palace.
 * Sunken Temple is the exception: no prism, only orbiting SkyRays.
 * Prism model choice is deterministic from seed.
 */
export default function SpecialMapCenterDecor({
  roomKind,
  roomIndex,
  enterSeq,
  combatActive = false,
}: {
  roomKind: string | null | undefined;
  roomIndex: number;
  enterSeq: number;
  /** When true, strips heavy ambient orbit decor during fights. */
  combatActive?: boolean;
}) {
  const config = useMemo(() => {
    if (!isMapCenterDecorRoomKind(roomKind)) return null;
    return MAP_CENTER_DECOR_BY_KIND[roomKind];
  }, [roomKind]);

  const seed = useMemo(() => {
    if (!roomKind) return '';
    return mapCenterDecorSeed(roomKind, roomIndex, enterSeq);
  }, [roomKind, roomIndex, enterSeq]);

  if (!config || !seed) return null;

  const isSunkenTemple = roomKind === 'sunken_temple';

  return (
    <group name="special-map-center-decor">
      {!isSunkenTemple && <MapCenterPrismDecor seed={seed} config={config} />}
      {isSunkenTemple && !combatActive && (
        <SkyRayOrbitDecor orbitRadius={config.orbitRadius} />
      )}
    </group>
  );
}
