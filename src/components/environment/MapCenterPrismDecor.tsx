'use client';

import React, { Suspense, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { FloatingTrinketMesh } from './FloatingTrinketMesh';
import {
  buildMapCenterPrismDef,
  MAP_CENTER_PRISM_LIGHT,
  MAP_CENTER_PRISM_PATHS,
  pickMapCenterPrismModel,
  type MapCenterDecorConfig,
  type MapCenterPrismModel,
} from '@/utils/throneCenterDecorLayout';

for (const path of Object.values(MAP_CENTER_PRISM_PATHS)) {
  useGLTF.preload(path);
}

export function preloadMapCenterPrismDecor(): void {
  for (const path of Object.values(MAP_CENTER_PRISM_PATHS)) {
    useGLTF.preload(path);
  }
}

function MapCenterPrismDecorInner({
  model,
  config,
}: {
  model: MapCenterPrismModel;
  config: MapCenterDecorConfig;
}) {
  const def = useMemo(() => buildMapCenterPrismDef(model, config), [model, config]);
  const light = MAP_CENTER_PRISM_LIGHT[model];
  const path = MAP_CENTER_PRISM_PATHS[model];

  return (
    <group name="map-center-prism-decor">
      <FloatingTrinketMesh
        path={path}
        def={def}
        lightColor={light.color}
        lightIntensity={light.intensity}
      />
    </group>
  );
}

/** Single floating center prism/shard for special co-op maps. */
export default function MapCenterPrismDecor({
  seed,
  config,
}: {
  seed: string;
  config: MapCenterDecorConfig;
}) {
  const model = useMemo(() => pickMapCenterPrismModel(seed), [seed]);

  return (
    <Suspense fallback={null}>
      <MapCenterPrismDecorInner model={model} config={config} />
    </Suspense>
  );
}
