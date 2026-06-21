'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const BLINK_IN_MS = 320;
const BLINK_OUT_MS = 380;
const MIN_HOLD_AFTER_ENTER_MS = 450;

type BlinkPhase = 'idle' | 'blinkIn' | 'hold' | 'blinkOut';

interface PortalBlinkTransitionProps {
  active: boolean;
  triggerSeq: number;
  sceneReadySeq: number;
  onComplete: () => void;
}

/** Crescent/petal panels clustered from bottom and sides (reference: portal blink screenshot). */
const BLINK_PETALS = [
  { left: '-18%', top: '62%', w: '52vw', h: '48vh', rot: -28 },
  { left: '-12%', top: '78%', w: '58vw', h: '42vh', rot: -12 },
  { left: '8%', top: '88%', w: '48vw', h: '38vh', rot: 8 },
  { left: '38%', top: '92%', w: '44vw', h: '36vh', rot: 22 },
  { left: '62%', top: '84%', w: '50vw', h: '40vh', rot: 38 },
  { left: '72%', top: '68%', w: '46vw', h: '44vh', rot: 52 },
  { left: '-8%', top: '28%', w: '42vw', h: '38vh', rot: -48 },
  { left: '78%', top: '22%', w: '40vw', h: '36vh', rot: 58 },
  { left: '18%', top: '-12%', w: '38vw', h: '34vh', rot: -18 },
  { left: '48%', top: '-14%', w: '36vw', h: '32vh', rot: 14 },
  { left: '-22%', top: '44%', w: '36vw', h: '40vh', rot: -62 },
  { left: '82%', top: '46%', w: '34vw', h: '38vh', rot: 66 },
] as const;

function playPortalBlinkSound() {
  try {
    const audio = (window as unknown as {
      audioSystem?: { playEnemyBlinkSound?: (p: { x: number; y: number; z: number }) => void };
    }).audioSystem;
    audio?.playEnemyBlinkSound?.({ x: 0, y: 1, z: 0 });
  } catch {
    // optional polish
  }
}

export default function PortalBlinkTransition({
  active,
  triggerSeq,
  sceneReadySeq,
  onComplete,
}: PortalBlinkTransitionProps) {
  const [phase, setPhase] = useState<BlinkPhase>('idle');
  const [mounted, setMounted] = useState(false);
  const transitionSeqRef = useRef(0);
  const enterReadyAtRef = useRef<number | null>(null);
  const phaseRef = useRef<BlinkPhase>('idle');
  const blinkInTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const holdCheckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const clearTimers = useCallback(() => {
    if (blinkInTimerRef.current) {
      clearTimeout(blinkInTimerRef.current);
      blinkInTimerRef.current = null;
    }
    if (blinkOutTimerRef.current) {
      clearTimeout(blinkOutTimerRef.current);
      blinkOutTimerRef.current = null;
    }
    if (holdCheckTimerRef.current) {
      clearTimeout(holdCheckTimerRef.current);
      holdCheckTimerRef.current = null;
    }
  }, []);

  const startBlinkOut = useCallback(() => {
    phaseRef.current = 'blinkOut';
    setPhase('blinkOut');
    blinkOutTimerRef.current = setTimeout(() => {
      blinkOutTimerRef.current = null;
      phaseRef.current = 'idle';
      setPhase('idle');
      setMounted(false);
      onCompleteRef.current();
    }, BLINK_OUT_MS);
  }, []);

  const scheduleHoldCheck = useCallback(() => {
    if (holdCheckTimerRef.current) {
      clearTimeout(holdCheckTimerRef.current);
      holdCheckTimerRef.current = null;
    }

    const expectedSeq = transitionSeqRef.current;
    if (sceneReadySeq < expectedSeq) {
      holdCheckTimerRef.current = setTimeout(scheduleHoldCheck, 50);
      return;
    }

    if (enterReadyAtRef.current == null) {
      enterReadyAtRef.current = Date.now();
    }

    const elapsed = Date.now() - enterReadyAtRef.current;
    const remainingHold = Math.max(0, MIN_HOLD_AFTER_ENTER_MS - elapsed);

    const tryBlinkOut = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (phaseRef.current !== 'hold') return;
          startBlinkOut();
        });
      });
    };

    if (remainingHold > 0) {
      holdCheckTimerRef.current = setTimeout(tryBlinkOut, remainingHold);
    } else {
      tryBlinkOut();
    }
  }, [sceneReadySeq, startBlinkOut]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    if (!active || triggerSeq === 0) return;

    clearTimers();
    transitionSeqRef.current = triggerSeq;
    enterReadyAtRef.current = null;
    setMounted(true);
    phaseRef.current = 'blinkIn';
    setPhase('blinkIn');
    playPortalBlinkSound();

    blinkInTimerRef.current = setTimeout(() => {
      blinkInTimerRef.current = null;
      phaseRef.current = 'hold';
      setPhase('hold');
    }, BLINK_IN_MS);

    return clearTimers;
  }, [active, triggerSeq, clearTimers]);

  useEffect(() => {
    if (phase !== 'hold') return;
    scheduleHoldCheck();
    return () => {
      if (holdCheckTimerRef.current) {
        clearTimeout(holdCheckTimerRef.current);
        holdCheckTimerRef.current = null;
      }
    };
  }, [phase, sceneReadySeq, scheduleHoldCheck]);

  useEffect(() => {
    if (!active && mounted) {
      clearTimers();
      setMounted(false);
      phaseRef.current = 'idle';
      setPhase('idle');
    }
  }, [active, mounted, clearTimers]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  if (!mounted) return null;

  const isClosing = phase === 'blinkIn' || phase === 'hold';
  const animMs = phase === 'blinkOut' ? BLINK_OUT_MS : BLINK_IN_MS;
  const animName = isClosing ? 'portalBlinkIn' : 'portalBlinkOut';

  return (
    <div
      className="fixed inset-0 z-[9999] pointer-events-all overflow-hidden"
      aria-hidden
    >
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: phase === 'blinkOut' ? 0 : 1,
          transition: phase === 'blinkOut' ? `opacity ${BLINK_OUT_MS}ms ease-out` : undefined,
        }}
      />

      {BLINK_PETALS.map((p, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            left: p.left,
            top: p.top,
            width: p.w,
            height: p.h,
            transform: `rotate(${p.rot}deg)`,
          }}
        >
          <div
            className="portal-blink-petal w-full h-full"
            style={{
              animation: `${animName} ${animMs}ms cubic-bezier(0.4, 0, 0.2, 1) ${i * 18}ms forwards`,
            }}
          />
        </div>
      ))}

      <style jsx global>{`
        .portal-blink-petal {
          border-radius: 50% 50% 42% 58% / 55% 48% 52% 45%;
          background: radial-gradient(
            ellipse 80% 70% at 45% 40%,
            #1a1030 0%,
            #0a0612 45%,
            #050008 100%
          );
          box-shadow:
            inset 0 0 40px rgba(80, 40, 120, 0.15),
            0 0 24px rgba(40, 20, 80, 0.25);
          transform-origin: center center;
          pointer-events: none;
        }

        @keyframes portalBlinkIn {
          0% {
            opacity: 0;
            transform: scale(1.45) translate(14vw, 12vh);
          }
          100% {
            opacity: 1;
            transform: scale(1) translate(0, 0);
          }
        }

        @keyframes portalBlinkOut {
          0% {
            opacity: 1;
            transform: scale(1) translate(0, 0);
          }
          100% {
            opacity: 0;
            transform: scale(1.5) translate(-12vw, -10vh);
          }
        }
      `}</style>
    </div>
  );
}
