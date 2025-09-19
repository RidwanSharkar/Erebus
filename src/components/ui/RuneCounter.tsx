import React from 'react';

interface RuneCounterProps {
  criticalRuneCount: number;
  critDamageRuneCount: number;
  criticalChance: number;
  criticalDamageMultiplier: number;
}

export function RuneCounter({
  criticalRuneCount,
  critDamageRuneCount,
  criticalChance,
  criticalDamageMultiplier
}: RuneCounterProps) {
  return (
    <div className="flex items-center gap-2 bg-black bg-opacity-60 backdrop-blur-sm rounded-lg px-3 py-2 border border-gray-600">
      <div className="text-yellow-400">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"
            fill="currentColor"
          />
        </svg>
      </div>
      <div className="flex flex-col text-xs text-white">
        <div className="font-medium">
          Runes: {criticalRuneCount + critDamageRuneCount}
        </div>
        <div className="text-gray-300">
          Crit: {(criticalChance * 100).toFixed(1)}% | ×{(criticalDamageMultiplier * 100).toFixed(0)}%
        </div>
      </div>
    </div>
  );
}
