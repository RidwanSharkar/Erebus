'use client';

import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  EREBUS_PLAYER_DAMAGE_FEEDBACK_EVENT,
  type PlayerDamageFeedbackDetail,
} from '@/utils/playerDamageFeedbackEvent';

declare global {
  interface WindowEventMap {
    [EREBUS_PLAYER_DAMAGE_FEEDBACK_EVENT]: CustomEvent<PlayerDamageFeedbackDetail>;
  }
}

interface OverlayState {
  visible: boolean;
  tone: NonNullable<PlayerDamageFeedbackDetail['tone']>;
  intensity: number;
  durationMs: number;
  nonce: number;
}

const PlayerDamageFeedbackOverlay = memo(function PlayerDamageFeedbackOverlay() {
  const [state, setState] = useState<OverlayState>({
    visible: false,
    tone: 'health',
    intensity: 0,
    durationMs: 180,
    nonce: 0,
  });
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventAtRef = useRef(0);

  const handleDamageFeedback = useCallback((ev: Event) => {
    const event = ev as CustomEvent<PlayerDamageFeedbackDetail>;
    const now = performance.now();
    const detail = event.detail ?? { damage: 0 };
    const damageIntensity = Math.min(1, Math.max(0.22, (detail.damage || 0) / 80));
    const intensity = Math.min(1, Math.max(0.16, detail.intensity ?? damageIntensity));

    if (now - lastEventAtRef.current < 55 && intensity < 0.45) {
      return;
    }
    lastEventAtRef.current = now;

    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }

    const durationMs = Math.max(120, Math.min(360, detail.durationMs ?? 160 + intensity * 120));
    setState((prev) => ({
      visible: true,
      tone: detail.tone ?? 'health',
      intensity,
      durationMs,
      nonce: prev.nonce + 1,
    }));

    hideTimeoutRef.current = setTimeout(() => {
      setState((prev) => ({ ...prev, visible: false }));
      hideTimeoutRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    window.addEventListener(EREBUS_PLAYER_DAMAGE_FEEDBACK_EVENT, handleDamageFeedback);
    return () => {
      window.removeEventListener(EREBUS_PLAYER_DAMAGE_FEEDBACK_EVENT, handleDamageFeedback);
      if (hideTimeoutRef.current !== null) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [handleDamageFeedback]);

  if (!state.visible) {
    return null;
  }

  const isShield = state.tone === 'shield';
  const isFatal = state.tone === 'fatal';
  const edgeColor = isShield ? '80, 190, 255' : '255, 36, 44';
  const centerOpacity = isFatal ? 0.18 : 0.06 + state.intensity * 0.06;
  const edgeOpacity = isShield ? 0.26 + state.intensity * 0.24 : 0.34 + state.intensity * 0.34;

  return (
    <div
      key={state.nonce}
      className="fixed inset-0 pointer-events-none"
      style={{
        zIndex: 9997,
        animation: `erebus-player-damage-feedback ${state.durationMs}ms ease-out forwards`,
        background: `
          radial-gradient(circle at center, rgba(${edgeColor}, ${centerOpacity}) 0%, rgba(${edgeColor}, 0.03) 34%, transparent 58%),
          radial-gradient(circle at center, transparent 45%, rgba(${edgeColor}, ${edgeOpacity}) 100%)
        `,
        boxShadow: `inset 0 0 ${isFatal ? 120 : 80}px rgba(${edgeColor}, ${edgeOpacity})`,
        mixBlendMode: isShield ? 'screen' : 'normal',
      }}
    >
      <style jsx>{`
        @keyframes erebus-player-damage-feedback {
          0% {
            opacity: 0;
            transform: scale(1.015);
          }
          12% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
});

export default PlayerDamageFeedbackOverlay;

