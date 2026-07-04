'use client';

import { useMemo, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import DirectionalProcLightning from './DirectionalProcLightning';
import { GREEN_PALETTE } from './WeaverLightningStrike';

const WEAVER_HEAL_BOLT_Y = 1.85;

interface WeaverHealZapProps {
  from: Vector3;
  to: Vector3;
  variant: 'cast' | 'impact';
  onComplete: () => void;
}

export default function WeaverHealZap({ from, to, variant, onComplete }: WeaverHealZapProps) {
  const [done, setDone] = useState(false);

  const boltFrom = useMemo(
    () => new Vector3(from.x, WEAVER_HEAL_BOLT_Y, from.z),
    [from.x, from.z],
  );
  const boltTo = useMemo(
    () => new Vector3(to.x, WEAVER_HEAL_BOLT_Y, to.z),
    [to.x, to.z],
  );

  if (done) return null;

  const isCast = variant === 'cast';

  return (
    <DirectionalProcLightning
      from={boltFrom}
      to={boltTo}
      palette={GREEN_PALETTE}
      durationMs={isCast ? 380 : 620}
      thicknessScale={isCast ? 0.55 : 1}
      suppressImpactLight
      onComplete={() => {
        setDone(true);
        onComplete();
      }}
    />
  );
}
