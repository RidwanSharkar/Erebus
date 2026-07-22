'use client';

import React from 'react';

interface DpsMeterProps {
  currentDps: number;
  totalDamage: number;
  onClear: () => void;
}

export default function DpsMeter({ currentDps, totalDamage, onClear }: DpsMeterProps) {
  return (
    <div className="text-white font-mono text-sm pointer-events-none">
      <div className="rounded-md bg-black/45 px-3 py-2 shadow-lg backdrop-blur-sm" data-block-game-input>
        <div className="text-yellow-300 font-semibold">
          DPS: {Math.round(currentDps).toLocaleString()}
        </div>
      </div>
    </div>
  );
}
