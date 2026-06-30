'use client';

import { useEffect, useRef, useState } from 'react';

const TOTAL_MS = 7000;
const ENTER_MS = 400;
const EXIT_MS = 500;
const SPOTLIGHT_MS = 6000;

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

const SECTION_ACCENTS = {
  move: 'rgba(100, 180, 255, 0.85)',
  dash: 'rgba(251, 191, 36, 0.85)',
  attack: 'rgba(56, 189, 248, 0.85)',
  camera: 'rgba(125, 211, 252, 0.85)',
  jump: 'rgba(110, 231, 183, 0.85)',
} as const;

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
      className={`mouse-icon mouse-icon--${variant} relative w-11 h-[4.5rem] rounded-[1.1rem] overflow-visible`}
      style={{
        background: 'rgba(10,10,22,0.92)',
        border: '1px solid rgba(120,120,160,0.5)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 6px rgba(0,0,0,0.5)',
      }}
    >
      <div className="absolute inset-0 rounded-[1.1rem] overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-white/10" />
        <div
          className={`mouse-btn mouse-btn--left absolute top-0 left-0 w-1/2 h-[55%] rounded-tl-[1rem] ${isLmb ? 'mouse-btn--active' : ''}`}
        />
        <div
          className={`mouse-btn mouse-btn--right absolute top-0 right-0 w-1/2 h-[55%] rounded-tr-[1rem] ${!isLmb ? 'mouse-btn--active mouse-btn--held' : ''}`}
        />
        {isLmb && (
          <>
            <div className="mouse-ripple absolute top-[18%] left-[18%] w-5 h-5 rounded-full" />
            <div className="mouse-crosshair absolute top-[22%] left-[22%] w-3 h-3" />
          </>
        )}
      </div>
      {!isLmb && (
        <svg
          className="absolute -bottom-1 left-1/2 -translate-x-1/2"
          width="52"
          height="28"
          viewBox="0 0 52 28"
          fill="none"
          aria-hidden
        >
          <g className="mouse-orbit-spin" style={{ transformOrigin: '26px 22px' }}>
            <path
              d="M 8 22 A 18 18 0 1 1 44 22"
              stroke="rgba(125, 211, 252, 0.35)"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
            <circle cx="8" cy="22" r="3" fill="rgba(125, 211, 252, 0.9)" />
          </g>
        </svg>
      )}
    </div>
  );
}

function SectionLabel({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent: string;
}) {
  return (
    <p
      className="section-label text-[10px] font-mono uppercase tracking-[0.2em] text-center mb-2 transition-colors duration-300"
      style={{ color: accent }}
    >
      {children}
    </p>
  );
}

function ControlSection({
  id,
  accent,
  children,
}: {
  id: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`control-section control-section--${id}`}>
      <div
        className="control-section-inner flex flex-col items-center"
        style={{ '--section-accent': accent } as React.CSSProperties}
      >
        {children}
      </div>
    </div>
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
  const dismissTimerRef = useRef<number | null>(null);
  onDismissRef.current = onDismiss;

  const clearDismissTimer = () => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!visible) {
      setMounted(false);
      clearDismissTimer();
      return;
    }
    setMounted(true);
    if (!autoDismiss) return;
    dismissTimerRef.current = window.setTimeout(() => {
      dismissTimerRef.current = null;
      setMounted(false);
      onDismissRef.current?.();
    }, TOTAL_MS);
    return clearDismissTimer;
  }, [visible, autoDismiss, animationKey]);

  const handleClose = () => {
    clearDismissTimer();
    setMounted(false);
    onDismissRef.current?.();
  };

  if (!mounted) return null;

  const enterEnd = (ENTER_MS / TOTAL_MS) * 100;
  const exitStart = ((TOTAL_MS - EXIT_MS) / TOTAL_MS) * 100;

  return (
    <div
      className="controls-tutorial fixed inset-0 z-[340] flex items-center justify-center px-4"
      onClick={handleClose}
      role="presentation"
    >
      <div
        key={animationKey}
        className={`controls-tutorial-panel relative backdrop-blur-lg px-6 py-5 sm:px-8 sm:py-6 max-w-[92vw] w-[min(520px,92vw)] overflow-hidden ${autoDismiss ? 'controls-tutorial-panel--auto' : 'controls-tutorial-panel--persistent'}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Controls tutorial"
        style={{
          background:
            'linear-gradient(180deg, rgba(12,12,28,0.92) 0%, rgba(6,6,18,0.96) 100%)',
          borderTop: '1px solid rgba(255,255,255,0.12)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          clipPath:
            'polygon(10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% 100%, 0% 100%, 0% 10px)',
          boxShadow:
            '0 0 0 1px rgba(100,160,255,0.14), 0 0 32px rgba(100,160,255,0.12), 0 8px 48px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        <div className="panel-border-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="panel-scan-line pointer-events-none absolute top-0 left-0 right-0 h-px" aria-hidden />

        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 z-10 rounded-lg border border-white/10 px-2 py-1 text-xl text-gray-400 transition-colors hover:border-sky-400/40 hover:text-white"
          aria-label="Close controls tutorial"
        >
          ×
        </button>

        <h2 className="controls-title text-center font-mono font-black uppercase text-sm sm:text-base text-sky-200/90 mb-5">
          Controls
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6">
          <ControlSection id="move" accent={SECTION_ACCENTS.move}>
            <SectionLabel accent={SECTION_ACCENTS.move}>Move</SectionLabel>
            <div className="wasd-grid flex flex-col items-center gap-1">
              <KeyCap label="W" className="wasd-key wasd-key--w" />
              <div className="flex gap-1">
                <KeyCap label="A" className="wasd-key wasd-key--a" />
                <KeyCap label="S" className="wasd-key wasd-key--s" />
                <KeyCap label="D" className="wasd-key wasd-key--d" />
              </div>
            </div>
          </ControlSection>

          <ControlSection id="dash" accent={SECTION_ACCENTS.dash}>
            <SectionLabel accent={SECTION_ACCENTS.dash}>Double-Tap to Dash</SectionLabel>
            <div className="relative flex flex-col items-center gap-1">
              <div className="dash-badge absolute -top-1 -right-3 rounded-full px-1.5 py-px text-[9px] font-mono font-bold text-amber-300 bg-amber-900/60 border border-amber-500/40">
                ×2
              </div>
              <div className="relative">
                <KeyCap label="W" className="dash-key w-9 h-9 text-xs relative z-[1]" />
                <KeyCap label="W" className="dash-ghost dash-ghost--1 absolute inset-0 w-9 h-9 text-xs opacity-0 pointer-events-none" />
                <KeyCap label="W" className="dash-ghost dash-ghost--2 absolute inset-0 w-9 h-9 text-xs opacity-0 pointer-events-none" />
              </div>
              <div className="flex gap-1 opacity-60">
                <KeyCap label="A" className="w-8 h-8 text-xs" />
                <KeyCap label="S" className="w-8 h-8 text-xs" />
                <KeyCap label="D" className="w-8 h-8 text-xs" />
              </div>
            </div>
          </ControlSection>

          <ControlSection id="attack" accent={SECTION_ACCENTS.attack}>
            <SectionLabel accent={SECTION_ACCENTS.attack}>Primary Attack</SectionLabel>
            <MouseIcon variant="lmb" />
            <p className="mt-2 text-[10px] font-mono text-gray-400">Left Click</p>
          </ControlSection>

          <ControlSection id="camera" accent={SECTION_ACCENTS.camera}>
            <SectionLabel accent={SECTION_ACCENTS.camera}>Hold to Orbit Camera</SectionLabel>
            <MouseIcon variant="rmb" />
            <p className="mt-2 text-[10px] font-mono text-gray-400">Right Click Hold</p>
          </ControlSection>
        </div>

        <ControlSection id="jump" accent={SECTION_ACCENTS.jump}>
          <div className="mt-5 pt-4 border-t border-white/5 flex flex-col items-center w-full">
            <SectionLabel accent={SECTION_ACCENTS.jump}>Jump</SectionLabel>
            <div className="relative">
              <KeyCap label="SPACE" wide className="space-key" />
              <div className="space-burst pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 flex flex-col items-center opacity-0">
                <span className="text-[10px] text-emerald-300/80">▲</span>
                <span className="text-[8px] text-emerald-300/50">▲</span>
              </div>
            </div>
          </div>
        </ControlSection>

        {autoDismiss && (
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-white/5 overflow-hidden">
            <div className="dismiss-progress h-full origin-left" />
          </div>
        )}
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
            transform: scale(0.94) translateY(12px);
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
            transform: scale(0.94) translateY(12px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .panel-border-glow {
          clip-path: inherit;
          box-shadow: inset 0 0 20px rgba(100, 160, 255, 0.06);
          animation: borderPulse 3s ease-in-out infinite;
        }

        @keyframes borderPulse {
          0%, 100% {
            box-shadow: inset 0 0 20px rgba(100, 160, 255, 0.06);
          }
          50% {
            box-shadow: inset 0 0 28px rgba(100, 160, 255, 0.14);
          }
        }

        .panel-scan-line {
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(100, 180, 255, 0) 35%,
            rgba(100, 180, 255, 0.55) 50%,
            rgba(100, 180, 255, 0) 65%,
            transparent 100%
          );
          animation: scanShimmer 3s ease-in-out infinite;
        }

        @keyframes scanShimmer {
          0% { transform: translateX(-120%); opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { transform: translateX(120%); opacity: 0; }
        }

        .controls-title {
          animation: titleEnter 700ms ease-out forwards;
          letter-spacing: 0.42em;
          text-shadow: 0 0 16px rgba(100, 160, 255, 0.35);
        }

        @keyframes titleEnter {
          0% {
            opacity: 0;
            transform: translateY(-6px);
            letter-spacing: 0.55em;
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            letter-spacing: 0.3em;
          }
        }

        .control-section {
          animation: sectionStagger 500ms ease-out backwards;
        }

        .control-section--move { animation-delay: 120ms; }
        .control-section--dash { animation-delay: 200ms; }
        .control-section--attack { animation-delay: 280ms; }
        .control-section--camera { animation-delay: 360ms; }
        .control-section--jump { animation-delay: 440ms; }

        @keyframes sectionStagger {
          0% {
            opacity: 0;
            transform: translateY(14px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .control-section-inner {
          transition: opacity 0.45s ease, transform 0.45s ease, filter 0.45s ease;
        }

        .control-section--move .control-section-inner { animation: spotlightMove ${SPOTLIGHT_MS}ms ease-in-out infinite; }
        .control-section--dash .control-section-inner { animation: spotlightDash ${SPOTLIGHT_MS}ms ease-in-out infinite; }
        .control-section--attack .control-section-inner { animation: spotlightAttack ${SPOTLIGHT_MS}ms ease-in-out infinite; }
        .control-section--camera .control-section-inner { animation: spotlightCamera ${SPOTLIGHT_MS}ms ease-in-out infinite; }
        .control-section--jump .control-section-inner { animation: spotlightJump ${SPOTLIGHT_MS}ms ease-in-out infinite; }

        @keyframes spotlightMove {
          0%, 18% { opacity: 1; transform: scale(1.03); filter: drop-shadow(0 0 8px rgba(100, 180, 255, 0.35)); }
          22%, 100% { opacity: 0.45; transform: scale(1); filter: none; }
        }
        @keyframes spotlightDash {
          0%, 18% { opacity: 0.45; transform: scale(1); filter: none; }
          22%, 38% { opacity: 1; transform: scale(1.03); filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.35)); }
          42%, 100% { opacity: 0.45; transform: scale(1); filter: none; }
        }
        @keyframes spotlightAttack {
          0%, 38% { opacity: 0.45; transform: scale(1); filter: none; }
          42%, 58% { opacity: 1; transform: scale(1.03); filter: drop-shadow(0 0 8px rgba(56, 189, 248, 0.35)); }
          62%, 100% { opacity: 0.45; transform: scale(1); filter: none; }
        }
        @keyframes spotlightCamera {
          0%, 58% { opacity: 0.45; transform: scale(1); filter: none; }
          62%, 78% { opacity: 1; transform: scale(1.03); filter: drop-shadow(0 0 8px rgba(125, 211, 252, 0.35)); }
          82%, 100% { opacity: 0.45; transform: scale(1); filter: none; }
        }
        @keyframes spotlightJump {
          0%, 78% { opacity: 0.45; transform: scale(1); filter: none; }
          82%, 98% { opacity: 1; transform: scale(1.03); filter: drop-shadow(0 0 8px rgba(110, 231, 183, 0.35)); }
          100% { opacity: 0.45; transform: scale(1); filter: none; }
        }

        .wasd-key {
          animation: wasdWave 2.4s ease-in-out infinite;
        }
        .wasd-key--w { animation-delay: 0s; }
        .wasd-key--a { animation-delay: 0.6s; }
        .wasd-key--s { animation-delay: 1.2s; }
        .wasd-key--d { animation-delay: 1.8s; }

        @keyframes wasdWave {
          0%, 100% {
            transform: scale(1) translateY(0);
            border-color: rgba(120, 120, 160, 0.5);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 6px rgba(0, 0, 0, 0.5);
          }
          6%, 14% {
            transform: scale(0.9) translateY(3px);
            border-color: rgba(100, 180, 255, 0.85);
            box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.45), 0 0 14px rgba(100, 160, 255, 0.4);
          }
        }

        .dash-badge {
          animation: dashBadgeBounce 1.1s ease-in-out infinite;
        }

        @keyframes dashBadgeBounce {
          0%, 100% { transform: scale(1); }
          12%, 22% { transform: scale(1.15); }
          32%, 42% { transform: scale(1.15); }
        }

        .dash-key {
          animation: dashDoubleTap 1.1s ease-in-out infinite;
        }

        .dash-ghost--1 {
          animation: dashGhost 1.1s ease-out infinite;
        }

        .dash-ghost--2 {
          animation: dashGhost 1.1s ease-out infinite;
          animation-delay: 0.18s;
        }

        @keyframes dashDoubleTap {
          0%, 100% {
            transform: scale(1) translateY(0);
            border-color: rgba(120, 120, 160, 0.5);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 6px rgba(0, 0, 0, 0.5);
          }
          12%, 22% {
            transform: scale(0.86) translateY(3px);
            border-color: rgba(251, 191, 36, 0.85);
            box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.4), 0 0 16px rgba(251, 191, 36, 0.45);
          }
          32%, 42% {
            transform: scale(0.86) translateY(3px);
            border-color: rgba(251, 191, 36, 0.85);
            box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.4), 0 0 16px rgba(251, 191, 36, 0.45);
          }
        }

        @keyframes dashGhost {
          0%, 10%, 30%, 100% {
            opacity: 0;
            transform: scale(1) translateY(0);
          }
          14%, 24% {
            opacity: 0.55;
            transform: scale(1.08) translateY(-6px);
            border-color: rgba(251, 191, 36, 0.5);
            box-shadow: 0 0 10px rgba(251, 191, 36, 0.25);
          }
          34%, 44% {
            opacity: 0.55;
            transform: scale(1.08) translateY(-6px);
            border-color: rgba(251, 191, 36, 0.5);
            box-shadow: 0 0 10px rgba(251, 191, 36, 0.25);
          }
        }

        .mouse-btn--left.mouse-btn--active {
          background: linear-gradient(180deg, rgba(100, 180, 255, 0.5), rgba(60, 120, 200, 0.28));
          animation: lmbFlash 1.2s ease-in-out infinite;
        }

        @keyframes lmbFlash {
          0%, 100% { opacity: 0.55; }
          15%, 25% { opacity: 1; }
        }

        .mouse-ripple {
          background: rgba(100, 180, 255, 0.55);
          animation: ripple 1.2s ease-out infinite;
          pointer-events: none;
        }

        .mouse-crosshair {
          border: 1px solid rgba(100, 180, 255, 0.7);
          border-radius: 1px;
          animation: crosshairFlash 1.2s ease-in-out infinite;
          pointer-events: none;
        }

        .mouse-crosshair::before,
        .mouse-crosshair::after {
          content: '';
          position: absolute;
          background: rgba(100, 180, 255, 0.7);
        }

        .mouse-crosshair::before {
          width: 1px;
          height: 100%;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
        }

        .mouse-crosshair::after {
          height: 1px;
          width: 100%;
          top: 50%;
          left: 0;
          transform: translateY(-50%);
        }

        @keyframes crosshairFlash {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          15%, 25% { opacity: 1; transform: scale(1); }
        }

        @keyframes ripple {
          0% { transform: scale(0.3); opacity: 0.85; }
          40% { transform: scale(2.4); opacity: 0; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        .mouse-btn--right.mouse-btn--held {
          background: linear-gradient(180deg, rgba(56, 189, 248, 0.55), rgba(14, 116, 144, 0.32));
          box-shadow: inset 0 0 10px rgba(56, 189, 248, 0.45);
          animation: rmbHold 1.5s ease-in-out infinite;
        }

        @keyframes rmbHold {
          0%, 100% { opacity: 0.75; }
          50% { opacity: 1; }
        }

        .mouse-orbit-spin {
          animation: orbitSpin 2.4s linear infinite;
        }

        @keyframes orbitSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .space-key {
          animation: spaceBounce 1.5s ease-in-out infinite;
        }

        .space-burst {
          animation: spaceBurst 1.5s ease-out infinite;
        }

        @keyframes spaceBounce {
          0%, 100% {
            transform: scale(1) translateY(0);
            border-color: rgba(120, 120, 160, 0.5);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 2px 6px rgba(0, 0, 0, 0.5);
          }
          20%, 30% {
            transform: scale(0.94) translateY(4px);
            border-color: rgba(110, 231, 183, 0.75);
            box-shadow: inset 0 3px 6px rgba(0, 0, 0, 0.4), 0 0 14px rgba(110, 231, 183, 0.35);
          }
        }

        @keyframes spaceBurst {
          0%, 100% { opacity: 0; transform: translateX(-50%) translateY(0); }
          20%, 35% { opacity: 1; transform: translateX(-50%) translateY(-8px); }
          45% { opacity: 0; transform: translateX(-50%) translateY(-14px); }
        }

        .dismiss-progress {
          background: linear-gradient(90deg, rgba(100, 160, 255, 0.5), rgba(125, 211, 252, 0.85));
          animation: dismissDrain ${TOTAL_MS}ms linear forwards;
        }

        @keyframes dismissDrain {
          0% { transform: scaleX(1); }
          100% { transform: scaleX(0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .controls-tutorial-panel--auto,
          .controls-tutorial-panel--persistent,
          .panel-border-glow,
          .panel-scan-line,
          .controls-title,
          .control-section,
          .control-section-inner,
          .wasd-key,
          .dash-key,
          .dash-ghost,
          .dash-badge,
          .mouse-btn--left.mouse-btn--active,
          .mouse-ripple,
          .mouse-crosshair,
          .mouse-btn--right.mouse-btn--held,
          .mouse-orbit-spin,
          .space-key,
          .space-burst,
          .dismiss-progress {
            animation: none !important;
          }

          .control-section,
          .control-section-inner {
            opacity: 1 !important;
            transform: none !important;
            filter: none !important;
          }

          .controls-title {
            letter-spacing: 0.3em;
            opacity: 1;
          }

          .dismiss-progress {
            transform: scaleX(0);
          }
        }
      `}</style>
    </div>
  );
}
