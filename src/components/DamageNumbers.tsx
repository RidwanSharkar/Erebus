// Floating damage numbers component to display damage dealt to enemies
'use client';

import React, { useEffect, useState, memo } from 'react';
import { Vector3, Camera } from '@/utils/three-exports';

const MIN_VISIBLE_MS = 2000;
const OUTGOING_DAMAGE_DURATION_MS = 5000;
const INCOMING_DAMAGE_DURATION_MS = 3000;
const PICKUP_FLOAT_DURATION_MS = 2400;
const MAX_STACK_VISIBLE = 5;

const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1);
const easeOutCubic = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);

const getDamageNumberDuration = (damageData: DamageNumberData) => {
  if (damageData.isIncomingDamage) return INCOMING_DAMAGE_DURATION_MS;
  if (damageData.durationHint === 'pickup') return PICKUP_FLOAT_DURATION_MS;
  return OUTGOING_DAMAGE_DURATION_MS;
};

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

interface DamageNumberProps {
  damageData: DamageNumberData;
  onComplete: (id: string) => void;
  camera: Camera | null;
  size: { width: number; height: number };
}

interface DamageNumberPropsExtended extends DamageNumberProps {
  stackIndex: number; // Index in the stack (0 = newest, 1 = second newest, etc.)
}

const DamageNumber = memo(function DamageNumber({ damageData, onComplete, camera, size, stackIndex }: DamageNumberPropsExtended) {
  const duration = getDamageNumberDuration(damageData);
  const [ageMs, setAgeMs] = useState(() => Math.max(0, Date.now() - damageData.timestamp));

  useEffect(() => {
    let animationFrameId = 0;
    let completed = false;

    const animate = () => {
      const nextAgeMs = Math.max(0, Date.now() - damageData.timestamp);
      setAgeMs(nextAgeMs);

      if (nextAgeMs >= duration) {
        if (!completed) {
          completed = true;
          onComplete(damageData.id);
        }
        return;
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      completed = true;
      cancelAnimationFrame(animationFrameId);
    };
  }, [damageData.id, damageData.timestamp, duration, onComplete]);

  const progress = clamp01(ageMs / duration);
  const easedProgress = easeOutCubic(progress);
  const fadeProgress = ageMs <= MIN_VISIBLE_MS
    ? 0
    : clamp01((ageMs - MIN_VISIBLE_MS) / Math.max(1, duration - MIN_VISIBLE_MS));
  const stackScale = Math.max(0.62, 1 - stackIndex * 0.08);
  const settleProgress = easeOutCubic(ageMs / (damageData.isCritical ? 520 : 360));
  const initialScale = (damageData.isIncomingDamage ? 1.08 : 1.2) + (damageData.isCritical ? 0.45 : 0);
  const finalScale = Math.max(0.58, (damageData.isIncomingDamage ? 0.74 : 0.84) * stackScale + (damageData.isCritical ? 0.08 : 0));
  const scale = initialScale + (finalScale - initialScale) * settleProgress;
  const stackOpacity = ageMs <= MIN_VISIBLE_MS ? 1 : Math.max(0.35, 1 - stackIndex * 0.12);
  const opacity = stackOpacity * (1 - fadeProgress);
  const yOffset = damageData.isIncomingDamage
    ? easedProgress * -2 + stackIndex * -0.55
    : easedProgress * 4 + stackIndex * 0.72;
  const screenJitter = getStableScreenJitter(
    damageData.id,
    damageData.isIncomingDamage ? 24 : 36
  );
  const textShadow = damageData.isCritical
    ? '0 0 6px rgba(253, 224, 71, 0.95), 0 0 16px rgba(245, 158, 11, 0.8), 2px 2px 4px rgba(0, 0, 0, 0.9)'
    : '2px 2px 4px rgba(0, 0, 0, 0.8)';

  // Proper 3D to 2D projection using the camera
  let x = 0;
  let y = 0;
  
  if (camera && size.width > 0 && size.height > 0 && damageData.position && damageData.position.clone) {
    // Create a world position with the floating animation offset
    const worldPosition = damageData.position.clone();
    worldPosition.y += yOffset; // Apply the floating animation offset
    
    // Project the 3D world position to normalized device coordinates
    const screenPosition = worldPosition.clone().project(camera);
    
    // Convert normalized device coordinates (-1 to 1) to screen coordinates
    x = (screenPosition.x * 0.5 + 0.5) * size.width;
    y = (screenPosition.y * -0.5 + 0.5) * size.height;

    if (damageData.dualCoilSlot !== undefined && !damageData.isIncomingDamage) {
      const pairSpreadPx = 40;
      x += (damageData.dualCoilSlot * 2 - 1) * pairSpreadPx;
    }
    x += screenJitter;
  } else {
    // Fallback to simple projection if camera not available
    const projectionScale = 50;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    x = centerX + (damageData.position.x * projectionScale) + screenJitter;
    y = centerY - (damageData.position.z * projectionScale) - (yOffset * 20);
  }

  return (
    <div
      className="absolute pointer-events-none select-none font-bold text-lg"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        opacity,
        transform: `translate(-50%, -50%) scale(${scale})`,
        textShadow,
        zIndex: 1000 - stackIndex, // Newer numbers appear on top
        transition: 'opacity 0.25s ease-out',
      }}
    >
      <span
        className={`inline-block ${
          damageData.displayText
            ? damageData.damageType === 'aegis_blocked'
              ? 'text-sky-200 text-xl font-extrabold drop-shadow-[0_0_10px_rgba(56,189,248,0.95)] tracking-widest'
              : 'text-slate-200 text-lg font-bold'
            : damageData.isIncomingDamage
            ? // Incoming damage: red for all damage
              'text-red-400 text-lg font-bold'
            : // Outgoing damage: original logic
              damageData.damageType === 'experience_gain'
                ? 'text-sky-300 text-sm font-bold tracking-wide drop-shadow-[0_0_6px_rgba(125,211,252,0.65)]'
                : damageData.damageType === 'gold_pickup'
                ? 'text-amber-300 text-sm font-bold tracking-wide drop-shadow-[0_0_6px_rgba(252,211,77,0.55)]'
                : damageData.isCritical
                ? 'text-amber-200 text-2xl font-black tracking-wide drop-shadow-[0_0_12px_rgba(251,191,36,0.95)]'
                : damageData.damageType === 'crossentropy'
                ? 'text-orange-400'
                :               damageData.damageType === 'healing' ||
                  damageData.damageType === 'reanimate_healing' ||
                  damageData.damageType === 'smite_healing' ||
                  damageData.damageType === 'viper_sting_healing' ||
                  damageData.damageType === 'summon_totem_healing' ||
                  damageData.damageType === 'rejuvenating_shot_healing' ||
                  damageData.damageType === 'flurry_healing' ||
                  damageData.damageType === 'merchant_healing' ||
                  damageData.damageType === 'healing_stream_healing'
                ? 'text-green-400 text-lg font-extrabold'
                : damageData.damageType === 'colossus_strike' ||
                  damageData.damageType === 'lightning_storm'
                ? 'text-yellow-400 text-lg'
                : damageData.damageType === 'barrage'
                ? 'text-blue-400 text-lg'
                : damageData.damageType === 'ignite'
                ? 'text-orange-500 text-lg font-bold drop-shadow-[0_0_6px_rgba(234,88,12,0.85)]'
                : damageData.damageType === 'cobra_shot' ||
                  damageData.damageType === 'venom'
                ? 'text-green-400 text-lg'
                : damageData.damageType === 'viper_sting'
                ? 'text-purple-300 text-lg'
                : damageData.damageType === 'cloudkill'
                ? 'text-teal-400 text-lg'
                : damageData.damageType === 'frost_nova'
                ? 'text-blue-300 text-lg'
                : damageData.damageType === 'stagger_break'
                ? 'text-sky-200 text-xl font-extrabold drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]'
                : damageData.damageType === 'entropic_cryoflame'
                ? 'text-cyan-400 text-lg'
                : damageData.damageType === 'icebeam'
                ? 'text-blue-300 text-lg'
                : damageData.damageType === 'summon_totem'
                ? 'text-violet-300 text-lg drop-shadow-[0_0_8px_rgba(167,139,250,0.75)]'
                : damageData.damageType === 'player_zombie'
                ? 'text-lime-400 text-lg drop-shadow-[0_0_6px_rgba(163,230,53,0.75)]'
                : damageData.damageType === 'allied_knight'
                ? 'text-slate-300 text-lg drop-shadow-[0_0_6px_rgba(180,180,190,0.65)]'
                : damageData.damageType === 'psionic_blades'
                ? 'text-purple-300 text-lg drop-shadow-[0_0_8px_rgba(168,85,247,0.75)]'
                : 'text-red-400'
        }`}
        style={damageData.isCritical ? {
          animation: 'damage-number-critical-pop 620ms cubic-bezier(0.16, 1, 0.3, 1)',
          WebkitTextStroke: '0.5px rgba(120, 53, 15, 0.7)',
        } : undefined}
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
            {(damageData.damageType === 'healing' ||
              damageData.damageType === 'reanimate_healing' ||
              damageData.damageType === 'smite_healing' ||
              damageData.damageType === 'viper_sting_healing' ||
              damageData.damageType === 'summon_totem_healing' ||
              damageData.damageType === 'rejuvenating_shot_healing' ||
              damageData.damageType === 'flurry_healing' ||
              damageData.damageType === 'merchant_healing' ||
              damageData.damageType === 'healing_stream_healing' ||
              damageData.damageType === 'experience_gain' ||
              damageData.damageType === 'gold_pickup') && '+'}
            {damageData.damageType === 'experience_gain' ? (
              <>{Math.round(damageData.damage)} XP</>
            ) : damageData.damageType === 'gold_pickup' ? (
              <>{Math.round(damageData.damage)}</>
            ) : damageData.damageType === 'healing' ||
             damageData.damageType === 'reanimate_healing' ||
             damageData.damageType === 'smite_healing' ||
             damageData.damageType === 'viper_sting_healing' ||
             damageData.damageType === 'summon_totem_healing' ||
             damageData.damageType === 'rejuvenating_shot_healing' ||
             damageData.damageType === 'flurry_healing' ||
             damageData.damageType === 'merchant_healing' ||
             damageData.damageType === 'healing_stream_healing'
              ? Math.round(damageData.damage)
              : damageData.damage}
            {damageData.isCritical && '!'}
          </>
        )}
      </span>
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for performance optimization
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
    prevProps.stackIndex === nextProps.stackIndex &&
    prevProps.camera === nextProps.camera &&
    prevProps.size.width === nextProps.size.width &&
    prevProps.size.height === nextProps.size.height
  );
});

interface DamageNumbersProps {
  damageNumbers: DamageNumberData[];
  onDamageNumberComplete: (id: string) => void;
  camera: Camera | null;
  size: { width: number; height: number };
}

const DamageNumbersComponent = memo(function DamageNumbers({ damageNumbers, onDamageNumberComplete, camera, size }: DamageNumbersProps) {
  // Group damage numbers by position to create stacks
  const positionGroups = new Map<string, DamageNumberData[]>();
  
  damageNumbers.forEach(damageData => {
    // Create a position key with some tolerance for grouping nearby damage
    const baseKey = `${Math.round(damageData.position.x * 2)}_${Math.round(damageData.position.z * 2)}`;
    const posKey =
      damageData.dualCoilSlot !== undefined
        ? `${baseKey}_dc${damageData.dualCoilSlot}`
        : baseKey;
    if (!positionGroups.has(posKey)) {
      positionGroups.set(posKey, []);
    }
    positionGroups.get(posKey)!.push(damageData);
  });

  const now = Date.now();

  // Sort each group newest first, but keep fresh hits even when the stack is busy.
  positionGroups.forEach(group => {
    group.sort((a, b) => b.timestamp - a.timestamp);
    const activeNumbers = group.filter(damageData => now - damageData.timestamp < getDamageNumberDuration(damageData));
    const guaranteedVisible = activeNumbers.filter(damageData => now - damageData.timestamp < MIN_VISIBLE_MS);
    const olderVisibleSlots = Math.max(0, MAX_STACK_VISIBLE - guaranteedVisible.length);
    const olderVisible = activeNumbers
      .filter(damageData => now - damageData.timestamp >= MIN_VISIBLE_MS)
      .slice(0, olderVisibleSlots);

    group.splice(0, group.length, ...guaranteedVisible, ...olderVisible);
  });

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
      {Array.from(positionGroups.values()).flat().map((damageData) => {
        // Find the stack index for this damage number
        const baseKey = `${Math.round(damageData.position.x * 2)}_${Math.round(damageData.position.z * 2)}`;
        const posKey =
          damageData.dualCoilSlot !== undefined
            ? `${baseKey}_dc${damageData.dualCoilSlot}`
            : baseKey;
        const group = positionGroups.get(posKey)!;
        const stackIndex = group.findIndex(d => d.id === damageData.id);

        return (
          <DamageNumber
            key={damageData.id}
            damageData={damageData}
            onComplete={onDamageNumberComplete}
            camera={camera}
            size={size}
            stackIndex={stackIndex}
          />
        );
      })}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for main component
  return (
    prevProps.damageNumbers.length === nextProps.damageNumbers.length &&
    prevProps.damageNumbers.every((prev, index) => {
      const next = nextProps.damageNumbers[index];
      return prev?.id === next?.id &&
             prev?.damage === next?.damage &&
             prev?.isCritical === next?.isCritical &&
             prev?.damageType === next?.damageType &&
             prev?.isIncomingDamage === next?.isIncomingDamage &&
             prev?.dualCoilSlot === next?.dualCoilSlot &&
             prev?.displayText === next?.displayText &&
             prev?.durationHint === next?.durationHint &&
             prev?.timestamp === next?.timestamp;
    }) &&
    prevProps.camera === nextProps.camera &&
    prevProps.size.width === nextProps.size.width &&
    prevProps.size.height === nextProps.size.height
  );
});

export default DamageNumbersComponent;
