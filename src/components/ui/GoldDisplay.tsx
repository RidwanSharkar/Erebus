'use client';

import React, { useEffect, useState } from 'react';

interface GoldDisplayProps {
  gold: number;
  isLocalPlayer?: boolean;
}

function GoldCoinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden>
      <defs>
        <linearGradient id="goldCoinGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FDE68A" />
          <stop offset="50%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#D97706" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="10" fill="url(#goldCoinGrad)" stroke="#B8860B" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="7" fill="none" stroke="#FDE68A" strokeWidth="0.75" opacity="0.6" />
      <text x="12" y="15.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#92400E">
        G
      </text>
    </svg>
  );
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
    >
      <div className="flex items-center gap-1">
        <GoldCoinIcon />
        <div className={`text-sm font-bold ${isLocalPlayer ? 'text-yellow-300' : 'text-yellow-200'}`}>
          {gold}
        </div>
        <div className="text-xs text-gray-300">GOLD</div>
      </div>
    </div>
  );
}
