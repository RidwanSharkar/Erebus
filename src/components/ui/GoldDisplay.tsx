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
    <div className="fixed bottom-16 right-4 z-40">
      <div
        className={[
          'rounded-lg border bg-black/70 px-3 py-1.5 backdrop-blur-sm transition-transform duration-150',
          pulse ? 'scale-110 border-yellow-300' : 'border-yellow-700',
        ].join(' ')}
      >
        <div className="flex items-center gap-1">
          <div className="text-lg text-yellow-400">🪙</div>
          <div className={`text-sm font-bold ${isLocalPlayer ? 'text-yellow-300' : 'text-yellow-200'}`}>
            {gold}
          </div>
          <div className="text-xs text-gray-300">GOLD</div>
        </div>
      </div>
    </div>
  );
}
