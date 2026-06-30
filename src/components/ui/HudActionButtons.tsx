'use client';

import React from 'react';

interface HudActionButtonsProps {
  onOpenRulebook: () => void;
  onOpenControlsTutorial: () => void;
  showControlsButton?: boolean;
}

export default function HudActionButtons({
  onOpenRulebook,
  onOpenControlsTutorial,
  showControlsButton = false,
}: HudActionButtonsProps) {
  return (
    <div className="flex gap-2">
      {showControlsButton && (
        <button
          type="button"
          onClick={onOpenControlsTutorial}
          className="text-2xl hover:scale-110 transition-transform cursor-pointer text-sky-300 hover:text-sky-200"
          title="Replay controls"
        >
          ⌨️
        </button>
      )}
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
