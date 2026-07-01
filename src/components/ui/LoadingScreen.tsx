'use client';

import { useEffect, useState } from 'react';
import {
  DEFAULT_LOADING_COLOR_SCHEME,
  getLoadingScreenTheme,
  pickRandomLoadingColorScheme,
  type LoadingColorScheme,
} from '@/utils/loadingScreenThemes';

interface LoadingScreenProps {
  isVisible: boolean;
  onFadeComplete?: () => void;
  /** Scene/engine bootstrap finished — progress can complete (vs fake ~90% cap). */
  sceneBootstrapReady?: boolean;
}

const LOADING_TIPS = [
  'Press X by a throne weapon to equip it; Q/E/R default for that weapon.',
  'Pick one permanent class talent after equipping—it (once per weapon).',
  'After your first room clear, pick a room boon tied to that room\'s color.',
  'Destroying a mushroom releases a toxic cloud that damages enemies and players.',
  'Every third combat room opens a boss portal.',
  'Double-tap WASD to dash.',
  'Interact with pedestal after each room to obtain the reward.',
  'Shield ticks up between fights; health does not.',
  'Press X near a portal when it appears to travel to the next trial.',
] as const;

const RUNE_SYMBOLS = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ'];

type RuneItem = {
  symbol: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
};

/** Deterministic layout so SSR and first client paint match (avoids hydration errors). */
function createDeterministicRunes(): RuneItem[] {
  return Array.from({ length: 18 }, (_, i) => ({
    symbol: RUNE_SYMBOLS[i % RUNE_SYMBOLS.length]!,
    x: (i * 37) % 100,
    y: (i * 53) % 100,
    size: 14 + (i % 22),
    duration: 6 + (i % 10),
    delay: ((i * 27) % 50) / 10,
  }));
}

function createRandomRunes(): RuneItem[] {
  return Array.from({ length: 18 }, (_, i) => ({
    symbol: RUNE_SYMBOLS[i % RUNE_SYMBOLS.length]!,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 14 + Math.random() * 22,
    duration: 6 + Math.random() * 10,
    delay: Math.random() * 5,
  }));
}

function FloatingRune({ symbol, color, style }: { symbol: string; color: string; style: React.CSSProperties }) {
  return (
    <span
      className="absolute select-none pointer-events-none font-mono"
      style={{ ...style, color }}
    >
      {symbol}
    </span>
  );
}

export default function LoadingScreen({
  isVisible,
  onFadeComplete,
  sceneBootstrapReady = false,
}: LoadingScreenProps) {
  const [fadeOut, setFadeOut] = useState(false);
  const [tipIndex, setTipIndex] = useState(0);
  const [dots, setDots] = useState('');
  const [progress, setProgress] = useState(0);
  const [runes, setRunes] = useState<RuneItem[]>(createDeterministicRunes);
  const [colorScheme, setColorScheme] = useState<LoadingColorScheme>(DEFAULT_LOADING_COLOR_SCHEME);

  // Randomize tips, runes, and color scheme only after mount so server HTML matches hydrated tree (Next.js).
  useEffect(() => {
    setRunes(createRandomRunes());
    setTipIndex(Math.floor(Math.random() * LOADING_TIPS.length));
  }, []);

  // Pick a new random color scheme each time the loading screen becomes visible.
  useEffect(() => {
    if (isVisible) {
      setColorScheme(pickRandomLoadingColorScheme());
    }
  }, [isVisible]);

  // Trigger fade-out when isVisible goes false
  useEffect(() => {
    if (!isVisible) {
      setFadeOut(true);
      const timer = setTimeout(() => {
        onFadeComplete?.();
      }, 700);
      return () => clearTimeout(timer);
    } else {
      setFadeOut(false);
      setProgress(0);
    }
  }, [isVisible]);

  // Animate loading dots
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setDots(d => (d.length >= 3 ? '' : d + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, [isVisible]);

  // Cycle tips every 4 seconds
  useEffect(() => {
    if (!isVisible) return;
    const interval = setInterval(() => {
      setTipIndex(i => (i + 1) % LOADING_TIPS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isVisible]);

  /* Indeterminate easing until `sceneBootstrapReady`, then reflects real readiness (avoids misleading 90% stall). */
  useEffect(() => {
    if (!isVisible) return;
    if (sceneBootstrapReady) {
      setProgress(100);
      return;
    }
    let current = 0;
    const tick = setInterval(() => {
      current += (82 - current) * 0.04;
      setProgress(Math.min(current, 82));
    }, 80);
    return () => clearInterval(tick);
  }, [isVisible, sceneBootstrapReady]);

  // Jump to 100 when fading out
  useEffect(() => {
    if (fadeOut) setProgress(100);
  }, [fadeOut]);

  if (!isVisible && !fadeOut) return null;

  const theme = getLoadingScreenTheme(colorScheme);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: theme.background,
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 0.7s ease-in-out',
        pointerEvents: fadeOut ? 'none' : 'all',
      }}
    >
      {/* Ambient vignette rings */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: theme.vignette }}
      />

      {/* Floating runes */}
      {runes.map((r, i) => (
        <FloatingRune
          key={i}
          symbol={r.symbol}
          color={theme.rune}
          style={{
            left: `${r.x}%`,
            top: `${r.y}%`,
            fontSize: `${r.size}px`,
            animation: `runeFloat ${r.duration}s ease-in-out ${r.delay}s infinite alternate`,
          }}
        />
      ))}

      {/* Centre content */}
      <div className="relative flex flex-col items-center gap-8 px-8 max-w-lg w-full">

        {/* Title */}
        <div className="text-center">
          <h1
            className="font-mono font-black tracking-[0.35em] select-none"
            style={{
              fontSize: 'clamp(2.5rem, 8vw, 5rem)',
              color: theme.title,
              textShadow: theme.titleGlow,
              letterSpacing: '0.35em',
            }}
          >
            EMPYREA
          </h1>
          <div
            className="mt-1 font-mono text-xs tracking-[0.5em] uppercase"
            style={{ color: theme.subtitle, textShadow: theme.subtitleGlow }}
          >
            entering the rift
          </div>
        </div>

        {/* Spinning sigil */}
        <div className="relative flex items-center justify-center" style={{ width: 80, height: 80 }}>
          {/* Outer ring */}
          <div
            className="absolute border rounded-full"
            style={{
              width: 80,
              height: 80,
              borderColor: theme.ringOuter,
              animation: 'spin 8s linear infinite',
            }}
          />
          {/* Middle ring (counter) */}
          <div
            className="absolute border rounded-full"
            style={{
              width: 56,
              height: 56,
              borderColor: theme.ringInner,
              animation: 'spin 5s linear infinite reverse',
            }}
          />
          {/* Inner glow */}
          <div
            className="w-6 h-6 rounded-full"
            style={{
              backgroundColor: theme.sigilCore,
              boxShadow: theme.sigilGlow,
              animation: 'pulse 2s ease-in-out infinite',
            }}
          />
          {/* Rune markers on outer ring */}
          {[0, 90, 180, 270].map((deg) => (
            <div
              key={deg}
              className="absolute font-mono text-xs"
              style={{
                color: theme.marker,
                transform: `rotate(${deg}deg) translateY(-36px) rotate(-${deg}deg)`,
              }}
            >
              ✦
            </div>
          ))}
        </div>

        {/* Progress bar */}
        <div className="w-full flex flex-col gap-2">
          <div className="w-full h-px rounded-full overflow-hidden" style={{ backgroundColor: theme.progressTrack }}>
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: theme.progressFill,
                transition: 'width 0.15s ease-out',
                boxShadow: theme.progressGlow,
              }}
            />
          </div>
          <div className="font-mono text-xs text-right tracking-widest" style={{ color: theme.label }}>
            {Math.round(progress)}%
          </div>
        </div>

        {/* Loading label */}
        <div className="font-mono text-sm tracking-widest uppercase -mt-4" style={{ color: theme.label }}>
          Loading{dots}
        </div>

        {/* Tips */}
        <div
          className="border rounded-lg px-5 py-3 max-w-sm w-full"
          style={{ borderColor: theme.tipsBorder, backgroundColor: theme.tipsBackground }}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-xs uppercase tracking-widest font-mono" style={{ color: theme.tipsHeader }}>Tips</span>
            <span className="text-[10px] font-mono tabular-nums" style={{ color: theme.tipsCounter }}>
              {tipIndex + 1}/{LOADING_TIPS.length}
            </span>
          </div>
          <div className="min-h-[4.25rem] flex items-center justify-center text-center">
            <p
              key={tipIndex}
              className="text-sm font-mono leading-snug tip-line"
              style={{ color: theme.tipsBody }}
            >
              {LOADING_TIPS[tipIndex]}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom separator */}
      <div className="absolute bottom-6 flex gap-3 items-center">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="w-1 h-1 rounded-full"
            style={{
              backgroundColor: theme.dot,
              animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
            }}
          />
        ))}
      </div>

      <style jsx>{`
        @keyframes runeFloat {
          0% { opacity: 0.05; transform: translateY(0px) scale(1); }
          100% { opacity: 0.25; transform: translateY(-12px) scale(1.05); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes tipEnter {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .tip-line {
          animation: tipEnter 0.22s ease-out forwards;
        }
      `}</style>
    </div>
  );
}
