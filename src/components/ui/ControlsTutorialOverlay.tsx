'use client';

import { useEffect, useRef, useState } from 'react';

const TOTAL_MS = 5000;
const ENTER_MS = 400;
const EXIT_MS = 500;

interface ControlsTutorialOverlayProps {
  visible: boolean;
  autoDismiss?: boolean;
  animationKey?: number;
  onDismiss?: () => void;
}

const KEY_STYLE: React.CSSProperties = {
  background: 'rgba(10,10,22,0.92)',
  border: '1px solid rgba(120,120,160,0.5)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.5)',
};

function KeyCap({
  label,
  className = '',
  wide = false,
}: {
  label: string;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-md font-mono font-bold text-gray-200 select-none ${wide ? 'h-9 min-w-[120px] px-4 text-xs' : 'w-10 h-10 text-sm'} ${className}`}
      style={KEY_STYLE}
    >
      {label}
    </div>
  );
}

function MouseIcon({ variant }: { variant: 'lmb' | 'rmb' }) {
  const isLmb = variant === 'lmb';
  return (
    <div
      className={`mouse-icon mouse-icon--${variant} relative w-11 h-[4.5rem] rounded-[1.1rem] overflow-hidden`}
      style={{
        background: 'rgba(10,10,22,0.92)',
        border: '1px solid rgba(120,120,160,0.5)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/10" />
      <div
        className={`mouse-btn mouse-btn--left absolute top-0 left-0 w-1/2 h-[55%] rounded-tl-[1rem] ${isLmb ? 'mouse-btn--active' : ''}`}
      />
      <div
        className={`mouse-btn mouse-btn--right absolute top-0 right-0 w-1/2 h-[55%] rounded-tr-[1rem] ${!isLmb ? 'mouse-btn--active mouse-btn--held' : ''}`}
      />
      {isLmb && <div className="mouse-ripple absolute top-[18%] left-[18%] w-5 h-5 rounded-full" />}
      {!isLmb && (
        <div className="mouse-orbit absolute top-[62%] left-1/2 -translate-x-1/2 text-[10px] text-sky-300/80">
          ↻
        </div>
      )}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400 text-center mb-2">
      {children}
    </p>
  );
}

export default function ControlsTutorialOverlay({
  visible,
  autoDismiss = true,
  animationKey = 0,
  onDismiss,
}: ControlsTutorialOverlayProps) {
  const [mounted, setMounted] = useState(visible);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (!visible) {
      setMounted(false);
      return;
    }
    setMounted(true);
    if (!autoDismiss) return;
    const timer = window.setTimeout(() => {
      setMounted(false);
      onDismissRef.current?.();
    }, TOTAL_MS);
    return () => window.clearTimeout(timer);
  }, [visible, autoDismiss]);

  const handleClose = () => {
    setMounted(false);
    onDismissRef.current?.();
  };

  if (!mounted) return null;

  const enterEnd = (ENTER_MS / TOTAL_MS) * 100;
  const exitStart = ((TOTAL_MS - EXIT_MS) / TOTAL_MS) * 100;

  return (
    <div
      className="controls-tutorial fixed inset-0 z-[340] flex items-center justify-center pointer-events-none px-4"
      style={{
        background:
          'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.55) 100%)',
      }}
    >
      <div
        key={animationKey}
        className={`controls-tutorial-panel relative backdrop-blur-md px-6 py-5 sm:px-8 sm:py-6 max-w-[92vw] w-[min(520px,92vw)] ${autoDismiss ? 'controls-tutorial-panel--auto' : 'controls-tutorial-panel--persistent'}`}
        style={{
          background:
            'linear-gradient(180deg, rgba(8,8,20,0.88) 0%, rgba(4,4,14,0.94) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.09)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          borderRight: '1px solid rgba(255,255,255,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          clipPath:
            'polygon(10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% 100%, 0% 100%, 0% 10px)',
          boxShadow:
            '0 0 0 1px rgba(100,160,255,0.08), 0 12px 40px rgba(0,0,0,0.65)',
        }}
      >
        {!autoDismiss && (
          <button
            type="button"
            onClick={handleClose}
            className="pointer-events-auto absolute top-3 right-3 rounded-lg border border-white/10 px-2 py-1 text-xl text-gray-400 transition-colors hover:border-sky-400/40 hover:text-white"
            aria-label="Close controls tutorial"
          >
            ×
          </button>
        )}
        <h2
          className="text-center font-mono font-black uppercase text-sm sm:text-base tracking-[0.3em] text-sky-200/90 mb-5"
          style={{ textShadow: '0 0 16px rgba(100,160,255,0.35)' }}
        >
          Controls
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          {/* Movement — WASD */}
          <div className="flex flex-col items-center">
            <SectionLabel>Move</SectionLabel>
            <div className="wasd-grid flex flex-col items-center gap-1">
              <KeyCap label="W" className="wasd-key wasd-key--w" />
              <div className="flex gap-1">
                <KeyCap label="A" className="wasd-key wasd-key--a" />
                <KeyCap label="S" className="wasd-key wasd-key--s" />
                <KeyCap label="D" className="wasd-key wasd-key--d" />
              </div>
            </div>
          </div>

          {/* Dash — double-tap WASD */}
          <div className="flex flex-col items-center">
            <SectionLabel>Double-Tap to Dash</SectionLabel>
            <div className="relative flex flex-col items-center gap-1">
              <div className="absolute -top-1 -right-3 rounded-full px-1.5 py-px text-[9px] font-mono font-bold text-amber-300 bg-amber-900/60 border border-amber-500/40">
                ×2
              </div>
              <KeyCap label="W" className="dash-key w-9 h-9 text-xs" />
              <div className="flex gap-1 opacity-60">
                <KeyCap label="A" className="w-8 h-8 text-xs" />
                <KeyCap label="S" className="w-8 h-8 text-xs" />
                <KeyCap label="D" className="w-8 h-8 text-xs" />
              </div>
            </div>
          </div>

          {/* Primary attack — LMB */}
          <div className="flex flex-col items-center">
            <SectionLabel>Primary Attack</SectionLabel>
            <MouseIcon variant="lmb" />
            <p className="mt-2 text-[10px] font-mono text-gray-400">Left Click</p>
          </div>

          {/* Camera — RMB hold */}
          <div className="flex flex-col items-center">
            <SectionLabel>Hold to Orbit Camera</SectionLabel>
            <MouseIcon variant="rmb" />
            <p className="mt-2 text-[10px] font-mono text-gray-400">Right Click Hold</p>
          </div>
        </div>

        {/* Jump — Space */}
        <div className="mt-5 pt-4 border-t border-white/5 flex flex-col items-center">
          <SectionLabel>Jump</SectionLabel>
          <KeyCap label="SPACE" wide className="space-key" />
        </div>
      </div>

      <style jsx>{`
        .controls-tutorial-panel--auto {
          animation: controlsPanelAuto ${TOTAL_MS}ms ease-in-out forwards;
        }

        .controls-tutorial-panel--persistent {
          animation: controlsPanelPersistent ${ENTER_MS}ms ease-out forwards;
        }

        @keyframes controlsPanelAuto {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(12px);
          }
          ${enterEnd}% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          ${exitStart}% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
          100% {
            opacity: 0;
            transform: scale(0.96) translateY(-8px);
          }
        }

        @keyframes controlsPanelPersistent {
          0% {
            opacity: 0;
            transform: scale(0.92) translateY(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .wasd-key {
          animation: wasdPulse 2.4s ease-in-out infinite;
        }
        .wasd-key--w { animation-delay: 0s; }
        .wasd-key--a { animation-delay: 0.6s; }
        .wasd-key--s { animation-delay: 1.2s; }
        .wasd-key--d { animation-delay: 1.8s; }

        @keyframes wasdPulse {
          0%, 100% {
            transform: scale(1);
            border-color: rgba(120, 120, 160, 0.5);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 6px rgba(0, 0, 0, 0.5);
          }
          8%, 16% {
            transform: scale(0.92) translateY(2px);
            border-color: rgba(100, 180, 255, 0.7);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 0 12px rgba(100, 160, 255, 0.35);
          }
        }

        .dash-key {
          animation: dashDoubleTap 1.1s ease-in-out infinite;
        }

        @keyframes dashDoubleTap {
          0%, 100% {
            transform: scale(1);
            border-color: rgba(120, 120, 160, 0.5);
          }
          12%, 22% {
            transform: scale(0.88) translateY(2px);
            border-color: rgba(251, 191, 36, 0.8);
            box-shadow: 0 0 14px rgba(251, 191, 36, 0.4);
          }
          32%, 42% {
            transform: scale(0.88) translateY(2px);
            border-color: rgba(251, 191, 36, 0.8);
            box-shadow: 0 0 14px rgba(251, 191, 36, 0.4);
          }
        }

        .mouse-btn--left.mouse-btn--active {
          background: linear-gradient(180deg, rgba(100, 180, 255, 0.45), rgba(60, 120, 200, 0.25));
          animation: lmbFlash 1.2s ease-in-out infinite;
        }

        @keyframes lmbFlash {
          0%, 100% { opacity: 0.5; }
          15%, 25% { opacity: 1; }
        }

        .mouse-ripple {
          background: rgba(100, 180, 255, 0.5);
          animation: ripple 1.2s ease-out infinite;
          pointer-events: none;
        }

        @keyframes ripple {
          0% { transform: scale(0.3); opacity: 0.8; }
          40% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        .mouse-btn--right.mouse-btn--held {
          background: linear-gradient(180deg, rgba(56, 189, 248, 0.5), rgba(14, 116, 144, 0.3));
          box-shadow: inset 0 0 8px rgba(56, 189, 248, 0.4);
          animation: rmbHold 1.5s ease-in-out infinite;
        }

        @keyframes rmbHold {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }

        .mouse-orbit {
          animation: orbitSpin 2s linear infinite;
        }

        @keyframes orbitSpin {
          from { transform: translateX(-50%) rotate(0deg); }
          to { transform: translateX(-50%) rotate(360deg); }
        }

        .space-key {
          animation: spaceBounce 1.5s ease-in-out infinite;
        }

        @keyframes spaceBounce {
          0%, 100% {
            transform: scale(1);
            border-color: rgba(120, 120, 160, 0.5);
          }
          20%, 30% {
            transform: scale(0.95) translateY(3px);
            border-color: rgba(110, 231, 183, 0.7);
            box-shadow: 0 0 12px rgba(110, 231, 183, 0.3);
          }
        }
      `}</style>
    </div>
  );
}
