'use client';

import React, { Suspense } from 'react';
import ThroneCenterSeal, { THRONE_CENTER_SEAL_RADIUS } from './ThroneCenterSeal';
import { TextureLoader } from '@/utils/three-exports';

const CENTER_TEXTURE_PATH = '/center.png';

/** Local XZ radius after scale (inside the 1.35× defense throne group). */
export const DEFENSE_PLATFORM_RADIUS = THRONE_CENTER_SEAL_RADIUS;

export function preloadDefenseCenterPlatform(): void {
  new TextureLoader().load(CENTER_TEXTURE_PATH);
}

function DefenseCenterPlatform() {
  return (
    <Suspense fallback={null}>
      <ThroneCenterSeal />
    </Suspense>
  );
}

export default React.memo(DefenseCenterPlatform);
