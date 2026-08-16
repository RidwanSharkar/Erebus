import React, { useEffect } from 'react';
import { useBowPowershot, clearGlobalPowershotEffects } from './useBowPowershot';
import BowPowershot from './BowPowershot';

/** Beam visible life is ~200ms + 300ms fade; skip anything older so a stranded effect cannot remount as a full-brightness duplicate. */
const MAX_EFFECT_AGE_MS = 600;

export default function BowPowershotManager() {
  const { activeEffects, removeEffect } = useBowPowershot();

  useEffect(() => {
    return () => {
      clearGlobalPowershotEffects();
    };
  }, []);

  useEffect(() => {
    const now = Date.now();
    for (const effect of activeEffects) {
      if (now - effect.startTime > MAX_EFFECT_AGE_MS) {
        removeEffect(effect.id);
      }
    }
  }, [activeEffects, removeEffect]);

  const now = Date.now();

  return (
    <>
      {activeEffects.map((effect) => {
        if (now - effect.startTime > MAX_EFFECT_AGE_MS) {
          return null;
        }
        return (
          <BowPowershot
            key={effect.id}
            position={effect.position}
            direction={effect.direction}
            subclass={effect.subclass}
            isElementalShotsUnlocked={effect.isElementalShotsUnlocked}
            isPerfectShot={effect.isPerfectShot}
            arcticStingTheme={effect.arcticStingTheme}
            highCaliberPerfectBeam={effect.highCaliberPerfectBeam}
            startTime={effect.startTime}
            onComplete={() => removeEffect(effect.id)}
          />
        );
      })}
    </>
  );
}
