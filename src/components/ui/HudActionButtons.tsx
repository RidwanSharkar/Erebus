'use client';

import React from 'react';

interface HudActionButtonsProps {
  onOpenRulebook: () => void;
}

export default function HudActionButtons({
  onOpenRulebook,
}: HudActionButtonsProps) {
  return (
    <div className="flex gap-2" data-block-game-input>

    </div>
  );
}
