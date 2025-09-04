'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

// Lazy load heavy game systems - ONLY 3D components that can be rendered inside Canvas
const LazyGameScene = dynamic(() => import('./GameScene').then(mod => ({ default: mod.GameScene })), {
  ssr: false,
  loading: () => null // No HTML elements inside Canvas
});

interface LazyGameSystemsProps {
  onDamageNumbersUpdate: (numbers: any[]) => void;
  onDamageNumberComplete: (id: string) => void;
  onCameraUpdate: (camera: any, size: any) => void;
  onGameStateUpdate: (state: any) => void;
  onControlSystemUpdate?: (controlSystem: any) => void;
}

export default function LazyGameSystems(props: LazyGameSystemsProps) {
  return (
    <Suspense fallback={null}>
      <LazyGameScene {...props} />
    </Suspense>
  );
}
