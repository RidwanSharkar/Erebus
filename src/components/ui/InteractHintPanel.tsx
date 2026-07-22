import React from 'react';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';

interface InteractHintPanelProps {
  hint: string | null;
  widthPercent?: number;
}

const PANEL_HEIGHT = 34;
const DEFAULT_WIDTH_PERCENT = 65;

export default function InteractHintPanel({
  hint,
  widthPercent = DEFAULT_WIDTH_PERCENT,
}: InteractHintPanelProps) {
  if (!hint) return null;

  return (
    <div style={{ width: `${widthPercent}%`, margin: '0 auto' }}>
      <div
        className="backdrop-blur-md flex items-center justify-center"
        style={{
          position: 'relative',
          height: PANEL_HEIGHT,
          background: HUD_PANEL_BG,
          border: HUD_PANEL_BORDER,
          clipPath: HUD_PANEL_CLIP,
          boxShadow: HUD_PANEL_SHADOW,
          padding: '0 16px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '16px',
            right: '16px',
            height: '1px',
            background:
              'linear-gradient(90deg, transparent, rgba(100,160,255,0.5) 25%, rgba(180,220,255,0.85) 50%, rgba(100,160,255,0.5) 75%, transparent)',
            pointerEvents: 'none',
          }}
        />
        <p
          className="text-center text-xs font-medium tracking-wide m-0"
          style={{
            color: 'rgba(220, 230, 255, 0.92)',
            textShadow: '0 1px 6px rgba(0,0,0,0.9)',
          }}
        >
          {hint}
        </p>
      </div>
    </div>
  );
}
