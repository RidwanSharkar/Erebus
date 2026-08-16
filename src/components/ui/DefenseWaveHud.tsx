'use client';

import React, { useEffect, useState } from 'react';
import { useMultiplayerRoom } from '@/contexts/MultiplayerContext';
import { DEFENSE_WAVE_COUNT } from '@/utils/defenseLayout';

function formatBreakSeconds(endsAt: number, now: number): string {
  const remaining = Math.max(0, endsAt - now);
  return (remaining / 1000).toFixed(1);
}

export default function DefenseWaveHud() {
  const { coopDefenseWave, coopDefenseWaveState, coopDefenseBreakEndsAt } = useMultiplayerRoom();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (coopDefenseWaveState !== 'break') return;
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [coopDefenseWaveState]);

  if (coopDefenseWaveState === 'idle') return null;

  let label = `WAVE ${coopDefenseWave} / ${DEFENSE_WAVE_COUNT}`;
  if (coopDefenseWaveState === 'break') {
    label = `NEXT WAVE IN ${formatBreakSeconds(coopDefenseBreakEndsAt, now)}s`;
  } else if (coopDefenseWaveState === 'complete') {
    label = 'DEFENSE HELD';
  } else if (coopDefenseWaveState === 'failed') {
    label = 'TOWERS FALLEN';
  }

  return (
    <div
      className="pointer-events-none select-none rounded-md border border-sky-400/40 bg-black/55 px-3 py-1.5 font-semibold tracking-widest text-sky-200 shadow-[0_0_18px_rgba(56,189,248,0.25)]"
      style={{ fontSize: 13 }}
    >
      {label}
    </div>
  );
}
