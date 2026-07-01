import React, { useCallback, useEffect, useRef, useState } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import HotkeyPanel from './HotkeyPanel';
import { SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { AbilityLoadout } from '@/utils/weaponAbilities';
import type { TalentLoadout } from '@/utils/talents';
import { RuneCounter } from './RuneCounter';
import ChatUI from './ChatUI';

interface GameUIProps {
  currentWeapon: WeaponType;
  playerHealth: number;
  maxHealth: number;
  playerShield?: number;
  maxShield?: number;
  controlSystem?: any;
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null;
  onWeaponSwitch?: (slot: 1 | 3) => void;
  skillPointData?: SkillPointData;
  abilityLoadout?: AbilityLoadout | null;
  onUnlockAbility?: (unlock: AbilityUnlock) => void;
  purchasedItems?: string[];
  criticalRuneCount?: number;
  critDamageRuneCount?: number;
  criticalChance?: number;
  criticalDamageMultiplier?: number;
  talentLoadout?: TalentLoadout | null;
  /** Shown above the health bar when near a co-op interactable (e.g. pedestal, portal). */
  interactHint?: string | null;
  gameMode?: 'menu' | 'singleplayer' | 'multiplayer' | 'pvp' | 'coop';
}


// ─── Segment tick positions ───────────────────────────────────────────────────
const TICKS = [25, 50, 75] as const;

function ResourceBar({
  current,
  max,
  gradientFrom,
  gradientTo,
  glowColor,
  icon,
}: {
  current: number;
  max: number;
  gradientFrom: string;
  gradientTo: string;
  glowColor: string;
  icon: string;
}) {
  const pct = Math.max(0, Math.min(100, (current / max) * 100));
  const isLow = pct < 30;
  const isCritical = pct < 15;

  // Drain / afterimage effect
  const prevPctRef = useRef(pct);
  const drainTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [drainPct, setDrainPct] = useState(pct);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (pct < prevPctRef.current) {
      // Damage taken: lock drain at old value, flash, then bleed down
      setDrainPct(prevPctRef.current);
      setFlashing(true);
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
      drainTimerRef.current = setTimeout(() => setDrainPct(pct), 380);
      flashTimerRef.current = setTimeout(() => setFlashing(false), 480);
    } else {
      // Healed or no change: sync drain immediately
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      setDrainPct(pct);
    }
    prevPctRef.current = pct;
  }, [pct]);

  useEffect(() => {
    return () => {
      if (drainTimerRef.current) clearTimeout(drainTimerRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>

      {/* Bar track */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          height: '26px',
          borderRadius: '2px',
          background: 'rgba(0,0,0,0.72)',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.95), inset 0 -1px 2px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}
      >
        {/* Drain ghost bar (afterimage of old value) */}
        <div
          style={{
            position: 'absolute',
            top: '14%',
            left: 0,
            height: '72%',
            width: `${drainPct}%`,
            borderRadius: '2px',
            background: `linear-gradient(90deg, ${glowColor}50, ${glowColor}28)`,
            transition: 'width 0.48s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
            pointerEvents: 'none',
          }}
        />

        {/* Main fill bar */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${gradientFrom}dd, ${gradientTo}, ${gradientFrom}cc)`,
            backgroundSize: '200% 100%',
            animation: pct > 0 ? 'hb-flow 3s linear infinite' : 'none',
            boxShadow: `0 0 ${isCritical ? 14 : 7}px ${glowColor}${isCritical ? 'bb' : '77'}`,
            transition: 'width 0.18s ease-out',
            borderRadius: pct >= 100 ? '3px' : '3px 0 0 3px',
            overflow: 'hidden',
          }}
        >
          {/* Gloss highlight */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '48%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.18) 0%, transparent 100%)',
              borderRadius: '3px 0 0 0',
              pointerEvents: 'none',
            }}
          />
          {/* Bottom depth shadow */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '30%',
              background: 'linear-gradient(0deg, rgba(0,0,0,0.25) 0%, transparent 100%)',
              pointerEvents: 'none',
            }}
          />
          {/* Shimmer sweep (GPU-accelerated via transform) */}
          <div
            style={{
              position: 'absolute',
              top: '-20%',
              left: 0,
              width: '32%',
              height: '140%',
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.22) 50%, transparent 100%)',
              animation: 'hb-shimmer 4.8s ease-in-out infinite',
              willChange: 'transform',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Damage flash overlay */}
        {flashing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(255,255,255,0.52)',
              borderRadius: '3px',
              animation: 'hb-flash 0.48s ease-out forwards',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          />
        )}

        {/* Segment tick marks */}
        {TICKS.map((t) => (
          <div
            key={t}
            style={{
              position: 'absolute',
              top: '18%',
              bottom: '18%',
              left: `${t}%`,
              width: '1px',
              background: 'rgba(0,0,0,0.45)',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        ))}

        {/* Border + low-HP glow */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '3px',
            border: `1px solid ${glowColor}${isLow ? 'aa' : '32'}`,
            boxShadow: isLow ? `inset 0 0 10px ${glowColor}22` : 'none',
            animation: 'hb-border-pulse 1s ease-in-out infinite',
            animationPlayState: isLow ? 'running' : 'paused',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />

        {/* Value text */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: '10px',
            pointerEvents: 'none',
            zIndex: 6,
          }}
        >
          <span
            style={{
              fontSize: '11px',
              fontWeight: 700,
              fontVariantNumeric: 'tabular-nums',
              color: 'rgba(255,255,255,0.92)',
              textShadow: '0 1px 5px rgba(0,0,0,1), 0 0 8px rgba(0,0,0,0.8)',
              letterSpacing: '0.02em',
            }}
          >
            {Math.round(current)}/{max}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function GameUI({
  currentWeapon,
  playerHealth,
  maxHealth,
  playerShield = 200,
  maxShield = 200,
  controlSystem,
  selectedWeapons,
  onWeaponSwitch,
  skillPointData,
  abilityLoadout,
  onUnlockAbility,
  purchasedItems = [],
  criticalRuneCount = 0,
  critDamageRuneCount = 0,
  criticalChance = 0,
  criticalDamageMultiplier = 2.0,
  talentLoadout,
  interactHint = null,
  gameMode,
}: GameUIProps) {

  // Wrapper for unlockAbility to ensure ControlSystem is updated immediately
  const handleUnlockAbility = useCallback((unlock: AbilityUnlock) => {
    if (controlSystem) {
      controlSystem.unlockAbility(unlock.weaponType, unlock.abilityKey, unlock.weaponSlot);
    }
    if (onUnlockAbility) {
      onUnlockAbility(unlock);
    }
  }, [controlSystem, onUnlockAbility]);

  return (
    <>
      {/* Rune Counter - positioned in right corner */}
      <div className="fixed bottom-4 right-4 z-50">
        <RuneCounter
          criticalRuneCount={criticalRuneCount}
          critDamageRuneCount={critDamageRuneCount}
          criticalChance={criticalChance}
          criticalDamageMultiplier={criticalDamageMultiplier}
        />
      </div>

      {/* Main UI Panel - positioned above the hotkey panel */}
      <div className="fixed bottom-32 left-1/2 transform -translate-x-1/2 z-50">
        {/* Outer wrapper for corner ornaments */}
        <div style={{ position: 'relative', minWidth: '360px' }}>
          {/* Corner bracket ornaments - REMOVED */}

          <div
            className="backdrop-blur-md px-5 py-3 flex flex-col gap-2.5"
            style={{
              background:
                'linear-gradient(180deg, rgba(10,10,24,0.92) 0%, rgba(5,5,15,0.96) 100%)',
              borderTop: '1px solid rgba(100,160,255,0.28)',
              borderLeft: '1px solid rgba(255,255,255,0.07)',
              borderRight: '1px solid rgba(255,255,255,0.07)',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              clipPath:
                'polygon(14px 0%, calc(100% - 14px) 0%, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0% calc(100% - 14px), 0% 14px)',
              boxShadow:
                '0 4px 36px rgba(0,0,0,0.75), 0 0 60px rgba(30,60,120,0.12), inset 0 1px 0 rgba(255,255,255,0.05)',
            }}
          >
            {/* Top accent gradient line */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '14px',
                right: '14px',
                height: '1px',
                background:
                  'linear-gradient(90deg, transparent, rgba(100,160,255,0.45) 25%, rgba(160,210,255,0.75) 50%, rgba(100,160,255,0.45) 75%, transparent)',
                pointerEvents: 'none',
              }}
            />

            {interactHint ? (
              <p
                className="text-center text-xs font-medium tracking-wide m-0 pb-1.5"
                style={{
                  color: 'rgba(220, 230, 255, 0.92)',
                  textShadow: '0 1px 6px rgba(0,0,0,0.9)',
                }}
              >
                {interactHint}
              </p>
            ) : null}

            {/* Shield Bar */}
            <ResourceBar
              current={playerShield}
              max={maxShield}
              gradientFrom="#1a3fa8"
              gradientTo="#60b8f8"
              glowColor="#4A90E2"
              icon="🛡"
            />

            {/* HP Bar */}
            <ResourceBar
              current={playerHealth}
              max={maxHealth}
              gradientFrom="#7a1010"
              gradientTo="#ef5050"
              glowColor="#DC2626"
              icon="♥"
            />
          </div>
        </div>
      </div>
      
      {/* Hotkey Panel - positioned below the main UI */}
      <HotkeyPanel
        currentWeapon={currentWeapon}
        controlSystem={controlSystem}
        selectedWeapons={selectedWeapons}
        onWeaponSwitch={onWeaponSwitch}
        skillPointData={skillPointData}
        abilityLoadout={abilityLoadout}
        onUnlockAbility={handleUnlockAbility}
        purchasedItems={purchasedItems}
        talentLoadout={talentLoadout ?? null}
      />

      {/* Chat UI */}
      <ChatUI isVisible={gameMode === 'coop'} />
    </>
  );
}
