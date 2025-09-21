import React from 'react';

interface RuneCounterProps {
  criticalRuneCount: number;
  critDamageRuneCount: number;
  criticalChance: number;
  criticalDamageMultiplier: number;
}

export function RuneCounter({
  criticalChance,
  criticalDamageMultiplier
}: RuneCounterProps) {
  return (
    <div className="flex items-center gap-2 bg-black bg-opacity-60 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-600">
      <div className="text-yellow-400 text-lg">
        🎲
      </div>
      <div className="flex flex-col text-xs text-white">

        <div className="text-gray-300">
          Critical: {(criticalChance * 100).toFixed(1)}% | ×{(criticalDamageMultiplier * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
