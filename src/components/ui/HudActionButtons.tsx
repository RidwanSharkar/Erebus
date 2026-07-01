'use client';

import React from 'react';

interface HudActionButtonsProps {
  onOpenRulebook: () => void;
}

export default function HudActionButtons({
  onOpenRulebook,
}: HudActionButtonsProps) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onOpenRulebook}
        className="text-2xl hover:scale-110 transition-transform cursor-pointer text-yellow-400 hover:text-yellow-300"
        title="Rulebook"
      >
        📜
      </button>
    </div>
  );
}
