// Floating damage numbers component to display damage dealt to enemies
'use client';

import React, { useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Vector3, Camera } from '@/utils/three-exports';

const MIN_VISIBLE_MS = 2000;
const OUTGOING_DAMAGE_DURATION_MS = 5000;
const INCOMING_DAMAGE_DURATION_MS = 3000;
const PICKUP_FLOAT_DURATION_MS = 2400;
const MAX_STACK_VISIBLE = 5;

/** Scratch vectors reused by the shared animation loop — never allocate per frame. */
const _worldPos = new Vector3();
const _screenPos = new Vector3();

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);

const getDamageNumberDuration = (damageData: DamageNumberData) => {
  if (damageData.isIncomingDamage) return INCOMING_DAMAGE_DURATION_MS;
  if (damageData.durationHint === 'pickup') return PICKUP_FLOAT_DURATION_MS;
  return OUTGOING_DAMAGE_DURATION_MS;
};

function isHealDamageType(type?: string): boolean {
  return type === 'healing' || (!!type && type.endsWith('_healing'));
}

/** Left-click primary attacks (all weapons). */
const PRIMARY_DAMAGE_TYPES = new Set([
  'sword',
  'runeblade_combo',
  'sabre_left',
  'sabre_right',
  'sabres_left',
  'sabres_right',
  'entropic',
  'projectile',
]);

/** Q / E / R hotkey abilities and spells. */
const ABILITY_DAMAGE_TYPES = new Set([
  'crossentropy',
  'summon_totem',
  'wraith_strike',
  'smite',
  'colossus_strike',
  'barrage',
  'reaping_talons',
  'reaping_talons_explosion',
  'lightning_storm',
  'backstab',
  'sunder',
  'fan_of_knives',
  'mortal_strike',
  'skyfall',
  'fire_affinity_skyfall',
  'poison_dart',
  'charge',
  'viper_sting',
  'aftershock',
]);

function getOutgoingDamageNumberClass(damageType?: string, isCritical?: boolean): string {
  if (isCritical) {
    return 'text-amber-200 text-2xl font-black tracking-wide drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]';
  }

  if (damageType === 'experience_gain') {
    return 'text-sky-300 text-sm font-bold tracking-wide drop-shadow-[0_0_6px_rgba(125,211,252,0.65)]';
  }
  if (damageType === 'gold_pickup') {
    return 'text-amber-300 text-sm font-bold tracking-wide drop-shadow-[0_0_6px_rgba(252,211,77,0.55)]';
  }
  if (isHealDamageType(damageType)) {
    return 'text-green-400 text-lg font-extrabold';
  }
  if (damageType === 'ignite') {
    return 'text-orange-500 text-lg font-bold drop-shadow-[0_0_6px_rgba(234,88,12,0.85)]';
  }
  if (damageType === 'shadowflame') {
    return 'text-violet-400 text-lg font-bold drop-shadow-[0_0_6px_rgba(167,139,250,0.85)]';
  }
  if (damageType === 'cobra_shot' || damageType === 'venom' || damageType === 'entanglement') {
    return 'text-green-400 text-lg';
  }
  if (damageType === 'stagger_break') {
    return 'text-blue-400 text-xl font-extrabold drop-shadow-[0_0_8px_rgba(96,165,250,0.9)]';
  }
  if (damageType === 'blizzard') {
    return 'text-sky-300 text-lg font-bold drop-shadow-[0_0_6px_rgba(125,211,252,0.75)]';
  }
  if (damageType === 'prime_materia') {
    return 'text-red-800 text-lg font-bold drop-shadow-[0_0_8px_rgba(153,27,27,0.9)]';
  }
  if (damageType === 'incineration') {
    return 'text-orange-400 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(251,146,60,0.95)]';
  }
  if (damageType && PRIMARY_DAMAGE_TYPES.has(damageType)) {
    return 'text-slate-300 text-lg font-bold drop-shadow-[0_0_6px_rgba(125,211,252,0.75)]';
  }
  if (damageType && ABILITY_DAMAGE_TYPES.has(damageType)) {
    return 'text-yellow-400 text-lg font-bold';
  }

  // Unrelated specialty colors — leave unchanged
  if (damageType === 'cloudkill') return 'text-teal-400 text-lg';
  if (damageType === 'mushroom') {
    return 'text-emerald-300 text-lg font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.85)]';
  }
  if (damageType === 'mushroom_eruption') {
    return 'text-teal-300 text-lg font-bold drop-shadow-[0_0_10px_rgba(45,212,191,0.9)]';
  }
  if (damageType === 'frost_nova' || damageType === 'icebeam') return 'text-blue-300 text-lg';
  if (damageType === 'entropic_cryoflame') return 'text-cyan-400 text-lg';
  if (damageType === 'player_zombie') {
    return 'text-lime-400 text-lg drop-shadow-[0_0_6px_rgba(163,230,53,0.75)]';
  }
  if (damageType === 'vengeful_spirit') {
    return 'text-green-400 text-lg font-bold drop-shadow-[0_0_6px_rgba(74,222,128,0.75)]';
  }
  if (damageType === 'allied_knight') {
    return 'text-slate-300 text-lg drop-shadow-[0_0_6px_rgba(180,180,190,0.65)]';
  }
  if (damageType === 'allied_huntress') {
    return 'text-lime-300 text-lg drop-shadow-[0_0_6px_rgba(132,204,22,0.75)]';
  }
  if (damageType === 'allied_phantom') {
    return 'text-yellow-300 text-lg drop-shadow-[0_0_6px_rgba(250,204,21,0.75)]';
  }
  if (damageType === 'allied_demon') {
    return 'text-red-400 text-lg drop-shadow-[0_0_6px_rgba(248,113,113,0.75)]';
  }
  if (damageType === 'allied_enchantress' || damageType === 'allied_enchantress_entanglement') {
    return 'text-emerald-300 text-lg drop-shadow-[0_0_6px_rgba(52,211,153,0.75)]';
  }
  if (damageType === 'allied_tiger') {
    return 'text-orange-300 text-lg drop-shadow-[0_0_6px_rgba(253,186,116,0.8)]';
  }
  if (damageType === 'allied_wolf') {
    return 'text-slate-200 text-lg drop-shadow-[0_0_6px_rgba(203,213,225,0.7)]';
  }
  if (damageType === 'allied_bear') {
    return 'text-amber-600 text-lg drop-shadow-[0_0_6px_rgba(180,83,9,0.75)]';
  }
  if (damageType === 'allied_serpent') {
    return 'text-teal-300 text-lg drop-shadow-[0_0_6px_rgba(45,212,191,0.75)]';
  }
  if (damageType === 'allied_spider') {
    return 'text-violet-300 text-lg drop-shadow-[0_0_6px_rgba(196,181,253,0.75)]';
  }
  if (damageType === 'hatemail') {
    return 'text-amber-300 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(252,211,77,0.95)]';
  }
  if (damageType === 'psionic_blades' || damageType === 'locust') {
    return 'text-purple-300 text-lg drop-shadow-[0_0_8px_rgba(168,85,247,0.75)]';
  }

  return 'text-white text-lg font-bold drop-shadow-[0_0_4px_rgba(255,255,255,0.35)]';
}

function getDisplayTextClass(damageType?: string): string {
  if (damageType === 'aegis_blocked') {
    return 'text-sky-200 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(56,189,248,0.95)] tracking-widest';
  }
  if (damageType === 'deflect_blocked') {
    return 'text-amber-200 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(255,193,7,0.95)] tracking-widest';
  }
  if (damageType === 'dodge_blocked') {
    return 'text-emerald-200 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(52,211,153,0.95)] tracking-widest';
  }
  if (damageType === 'soul_bond_blocked') {
    return 'text-violet-200 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(167,139,250,0.95)] tracking-widest';
  }
  if (damageType === 'knight_blocked') {
    return 'text-slate-200 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(203,213,225,0.95)] tracking-widest';
  }
  if (damageType === 'attack_missed') {
    return 'text-slate-300 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(148,163,184,0.95)] tracking-widest';
  }
  return 'text-slate-200 text-lg font-bold';
}

const getStableScreenJitter = (id: string, amplitudePx: number) => {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  const normalized = ((Math.abs(hash) % 1000) / 999) - 0.5;
  return normalized * amplitudePx;
};

export interface DamageNumberData {
  id: string;
  damage: number;
  isCritical: boolean;
  position: Vector3;
  timestamp: number;
  damageType?: string; // Added to distinguish damage types
  isIncomingDamage?: boolean; // Whether this damage was received by the local player
  /** Bow Dual Coil: 0/1 so paired hits aren’t deduped into one stack; adds screen spread. */
  dualCoilSlot?: 0 | 1;
  /** When set, shown instead of numeric damage (e.g. AEGIS block). */
  displayText?: string;
  /** Shorter lifetime for small pickup-style floats (EXP / gold). */
  durationHint?: 'pickup';
}

/** Imperative entry registered by each mounted DamageNumber for the shared RAF. */
interface AnimEntry {
  id: string;
  el: HTMLDivElement;
  damageData: DamageNumberData;
  stackIndex: number;
  duration: number;
  screenJitter: number;
  initialScale: number;
  finalScale: number;
  settleMs: number;
  completed: boolean;
}

interface DamageNumberProps {
  damageData: DamageNumberData;
  register: (entry: AnimEntry) => void;
  unregister: (id: string) => void;
  stackIndex: number;
}

/**
 * Renders static content once. Position / opacity / scale are driven
 * imperatively by the parent's shared RAF via the registered AnimEntry.
 */
const DamageNumber = memo(function DamageNumber({
  damageData,
  register,
  unregister,
  stackIndex,
}: DamageNumberProps) {
  const elRef = useRef<HTMLDivElement>(null);

  const textShadow = damageData.isCritical
    ? '0 0 6px rgba(253, 224, 71, 0.95), 0 0 16px rgba(245, 158, 11, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.9)'
    : '2px 2px 4px rgba(0, 0, 0, 0.8)';

  const stackScale = Math.max(0.62, 1 - stackIndex * 0.08);
  const initialScale =
    (damageData.isIncomingDamage ? 1.08 : 1.2) + (damageData.isCritical ? 0.45 : 0);
  const finalScale = Math.max(
    0.58,
    (damageData.isIncomingDamage ? 0.74 : 0.84) * stackScale + (damageData.isCritical ? 0.08 : 0),
  );
  const screenJitter = getStableScreenJitter(
    damageData.id,
    damageData.isIncomingDamage ? 24 : 36,
  );
  const duration = getDamageNumberDuration(damageData);
  const settleMs = damageData.isCritical ? 520 : 360;

  useEffect(() => {
    const el = elRef.current;
    if (!el) return;

    const entry: AnimEntry = {
      id: damageData.id,
      el,
      damageData,
      stackIndex,
      duration,
      screenJitter,
      initialScale,
      finalScale,
      settleMs,
      completed: false,
    };
    register(entry);
    return () => {
      entry.completed = true;
      unregister(damageData.id);
    };
  }, [
    damageData,
    stackIndex,
    duration,
    screenJitter,
    initialScale,
    finalScale,
    settleMs,
    register,
    unregister,
  ]);

  return (
    <div
      ref={elRef}
      className="absolute pointer-events-none select-none font-bold text-lg"
      style={{
        left: 0,
        top: 0,
        opacity: 0,
        transform: 'translate3d(-50%, -50%, 0) scale(1)',
        textShadow,
        zIndex: 1000 - stackIndex,
        willChange: 'transform, opacity',
      }}
    >
      <span
        className={`inline-block ${
          damageData.displayText
            ? getDisplayTextClass(damageData.damageType)
            : damageData.isIncomingDamage
            ? 'text-red-400 text-lg font-bold'
            : getOutgoingDamageNumberClass(damageData.damageType, damageData.isCritical)
        }`}
        style={
          damageData.isCritical
            ? {
                animation: 'damage-number-critical-pop 620ms cubic-bezier(0.16, 1, 0.3, 1)',
                WebkitTextStroke: '0.5px rgba(120, 53, 15, 0.7)',
              }
            : undefined
        }
      >
        {damageData.displayText ? (
          damageData.displayText
        ) : (
          <>
            {damageData.isCritical && (
              <span className="mr-1 align-super text-[0.55em] tracking-[0.18em] text-amber-100">
                CRIT
              </span>
            )}
            {damageData.isIncomingDamage && '-'}
            {(isHealDamageType(damageData.damageType) ||
              damageData.damageType === 'experience_gain' ||
              damageData.damageType === 'gold_pickup') &&
              '+'}
            {damageData.damageType === 'experience_gain' ? (
              <>{Math.round(damageData.damage)} XP</>
            ) : damageData.damageType === 'gold_pickup' ? (
              <>{Math.round(damageData.damage)}</>
            ) : isHealDamageType(damageData.damageType) ? (
              Math.round(damageData.damage)
            ) : (
              damageData.damage
            )}
            {damageData.isCritical && '!'}
          </>
        )}
      </span>
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.damageData.id === nextProps.damageData.id &&
    prevProps.damageData.damage === nextProps.damageData.damage &&
    prevProps.damageData.isCritical === nextProps.damageData.isCritical &&
    prevProps.damageData.damageType === nextProps.damageData.damageType &&
    prevProps.damageData.isIncomingDamage === nextProps.damageData.isIncomingDamage &&
    prevProps.damageData.timestamp === nextProps.damageData.timestamp &&
    prevProps.damageData.position.equals(nextProps.damageData.position) &&
    prevProps.damageData.dualCoilSlot === nextProps.damageData.dualCoilSlot &&
    prevProps.damageData.displayText === nextProps.damageData.displayText &&
    prevProps.damageData.durationHint === nextProps.damageData.durationHint &&
    prevProps.stackIndex === nextProps.stackIndex
  );
});

interface DamageNumbersProps {
  damageNumbers: DamageNumberData[];
  onDamageNumberComplete: (id: string) => void;
  camera: Camera | null;
  size: { width: number; height: number };
}

const DamageNumbersComponent = memo(function DamageNumbers({
  damageNumbers,
  onDamageNumberComplete,
  camera,
  size,
}: DamageNumbersProps) {
  const entriesRef = useRef<Map<string, AnimEntry>>(new Map());
  const cameraRef = useRef(camera);
  const sizeRef = useRef(size);
  const onCompleteRef = useRef(onDamageNumberComplete);
  cameraRef.current = camera;
  sizeRef.current = size;
  onCompleteRef.current = onDamageNumberComplete;

  const register = useCallback((entry: AnimEntry) => {
    entriesRef.current.set(entry.id, entry);
  }, []);

  const unregister = useCallback((id: string) => {
    entriesRef.current.delete(id);
  }, []);

  // Single shared RAF — drives all active damage numbers without React re-renders.
  useEffect(() => {
    let rafId = 0;
    let running = true;

    const tick = () => {
      if (!running) return;

      const now = Date.now();
      const cam = cameraRef.current;
      const sz = sizeRef.current;
      const hasCamera = !!(cam && sz.width > 0 && sz.height > 0);

      entriesRef.current.forEach((entry) => {
        if (entry.completed) return;

        const { damageData, el, stackIndex, duration, screenJitter, initialScale, finalScale, settleMs } =
          entry;
        const ageMs = Math.max(0, now - damageData.timestamp);

        if (ageMs >= duration) {
          entry.completed = true;
          onCompleteRef.current(entry.id);
          return;
        }

        const progress = clamp01(ageMs / duration);
        const easedProgress = easeOutCubic(progress);
        const fadeProgress =
          ageMs <= MIN_VISIBLE_MS
            ? 0
            : clamp01((ageMs - MIN_VISIBLE_MS) / Math.max(1, duration - MIN_VISIBLE_MS));
        const settleProgress = easeOutCubic(ageMs / settleMs);
        const scale = initialScale + (finalScale - initialScale) * settleProgress;
        const stackOpacity = ageMs <= MIN_VISIBLE_MS ? 1 : Math.max(0.35, 1 - stackIndex * 0.12);
        const opacity = stackOpacity * (1 - fadeProgress);
        const yOffset = damageData.isIncomingDamage
          ? easedProgress * -2 + stackIndex * -0.55
          : easedProgress * 4 + stackIndex * 0.72;

        let x = 0;
        let y = 0;

        if (hasCamera && damageData.position) {
          _worldPos.copy(damageData.position);
          _worldPos.y += yOffset;
          _screenPos.copy(_worldPos).project(cam!);
          x = (_screenPos.x * 0.5 + 0.5) * sz.width;
          y = (_screenPos.y * -0.5 + 0.5) * sz.height;

          if (damageData.dualCoilSlot !== undefined && !damageData.isIncomingDamage) {
            x += (damageData.dualCoilSlot * 2 - 1) * 40;
          }
          x += screenJitter;
        } else if (damageData.position) {
          const projectionScale = 50;
          const centerX = window.innerWidth / 2;
          const centerY = window.innerHeight / 2;
          x = centerX + damageData.position.x * projectionScale + screenJitter;
          y = centerY - damageData.position.z * projectionScale - yOffset * 20;
        }

        // Compositor-only path: no left/top layout thrash.
        el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${scale})`;
        el.style.opacity = String(opacity);
        el.style.zIndex = String(1000 - stackIndex);
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Group damage numbers by position to create stacks — only when the list identity/contents change
  const visibleDamageNumbers = useMemo(() => {
    const positionGroups = new Map<string, DamageNumberData[]>();

    damageNumbers.forEach((damageData) => {
      const baseKey = `${Math.round(damageData.position.x * 2)}_${Math.round(damageData.position.z * 2)}`;
      const posKey =
        damageData.dualCoilSlot !== undefined ? `${baseKey}_dc${damageData.dualCoilSlot}` : baseKey;
      if (!positionGroups.has(posKey)) {
        positionGroups.set(posKey, []);
      }
      positionGroups.get(posKey)!.push(damageData);
    });

    const now = Date.now();

    // Sort each group newest first, but keep fresh hits even when the stack is busy.
    positionGroups.forEach((group) => {
      group.sort((a, b) => b.timestamp - a.timestamp);
      const activeNumbers = group.filter(
        (damageData) => now - damageData.timestamp < getDamageNumberDuration(damageData),
      );
      const guaranteedVisible = activeNumbers.filter(
        (damageData) => now - damageData.timestamp < MIN_VISIBLE_MS,
      );
      const olderVisibleSlots = Math.max(0, MAX_STACK_VISIBLE - guaranteedVisible.length);
      const olderVisible = activeNumbers
        .filter((damageData) => now - damageData.timestamp >= MIN_VISIBLE_MS)
        .slice(0, olderVisibleSlots);

      group.splice(0, group.length, ...guaranteedVisible, ...olderVisible);
    });

    return Array.from(positionGroups.entries()).flatMap(([posKey, group]) =>
      group.map((damageData, stackIndex) => ({ damageData, posKey, stackIndex })),
    );
  }, [damageNumbers]);

  return (
    <div className="fixed inset-0 pointer-events-none">
      <style>{`
        @keyframes damage-number-critical-pop {
          0% {
            transform: translateY(4px) scale(0.65) rotate(-3deg);
            filter: brightness(1.6);
          }
          38% {
            transform: translateY(-8px) scale(1.22) rotate(2deg);
            filter: brightness(1.35);
          }
          100% {
            transform: translateY(0) scale(1) rotate(0deg);
            filter: brightness(1);
          }
        }
      `}</style>
      {visibleDamageNumbers.map(({ damageData, stackIndex }) => {
          return (
            <DamageNumber
              key={damageData.id}
              damageData={damageData}
              register={register}
              unregister={unregister}
              stackIndex={stackIndex}
            />
          );
        })}
    </div>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.damageNumbers.length === nextProps.damageNumbers.length &&
    prevProps.damageNumbers.every((prev, index) => {
      const next = nextProps.damageNumbers[index];
      return (
        prev?.id === next?.id &&
        prev?.damage === next?.damage &&
        prev?.isCritical === next?.isCritical &&
        prev?.damageType === next?.damageType &&
        prev?.isIncomingDamage === next?.isIncomingDamage &&
        prev?.dualCoilSlot === next?.dualCoilSlot &&
        prev?.displayText === next?.displayText &&
        prev?.durationHint === next?.durationHint &&
        prev?.timestamp === next?.timestamp
      );
    }) &&
    prevProps.camera === nextProps.camera &&
    prevProps.size.width === nextProps.size.width &&
    prevProps.size.height === nextProps.size.height
  );
});

export default DamageNumbersComponent;
