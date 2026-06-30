'use client';

import React from 'react';

interface EssenceDisplayProps {
  essence: number;
  playerId?: string;
  isLocalPlayer?: boolean;
}

export default function EssenceDisplay({ essence, isLocalPlayer = false }: EssenceDisplayProps) {
  return (
    <div className="rounded-lg border border-purple-600 bg-black/70 p-1.5 backdrop-blur-sm">
      <div className="flex items-center gap-1">
        <div className="text-lg text-purple-400">⚡</div>
        <div className={`text-sm font-bold ${isLocalPlayer ? 'text-purple-400' : 'text-purple-300'}`}>
          {essence}
        </div>
        <div className="text-xs text-gray-400">ESSENCE</div>
      </div>
    </div>
  );
}
