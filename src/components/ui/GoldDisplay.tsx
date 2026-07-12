'use client';

import React, { useEffect, useState } from 'react';

interface GoldDisplayProps {
  gold: number;
  isLocalPlayer?: boolean;
}

export default function GoldDisplay({ gold, isLocalPlayer = false }: GoldDisplayProps) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    const onPocketCollect = () => {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 180);
    };
    window.addEventListener('gold-pocket-collected', onPocketCollect);
    return () => {
      window.removeEventListener('gold-pocket-collected', onPocketCollect);
    };
  }, []);

  return (
    <div
      className={[
        'rounded-lg border bg-black/70 px-3 py-1.5 backdrop-blur-sm transition-transform duration-150',
        pulse ? 'scale-110 border-yellow-300' : 'border-yellow-700',
      ].join(' ')}
      data-block-game-input
    >
      <div className="flex items-center gap-1">
        <img
          src="/icons/gold.svg"
          alt=""
          className="h-5 w-5 shrink-0 object-contain"
          aria-hidden
        />
        <div className={`text-sm font-bold ${isLocalPlayer ? 'text-yellow-300' : 'text-yellow-200'}`}>
          {gold}
        </div>
        <div className="text-xs text-gray-300">GOLD</div>
      </div>
    </div>
  );
}
