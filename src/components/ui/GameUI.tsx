import React, { useCallback } from 'react';
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
}


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
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="flex items-center gap-2.5 w-full">
      <span
        className="text-base w-5 text-center select-none flex-shrink-0"
        style={{ filter: `drop-shadow(0 0 5px ${glowColor})` }}
      >
        {icon}
      </span>
      <div
        className="flex-1 relative h-[22px] rounded"
        style={{
          background: 'rgba(0,0,0,0.55)',
          boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.7)',
        }}
      >
        <div
          className="absolute inset-0 rounded pointer-events-none"
          style={{ border: `1px solid ${glowColor}35` }}
        />
        <div
          className="h-full rounded transition-all duration-300 ease-out relative overflow-hidden"
          style={{
            width: `${percentage}%`,
            background: `linear-gradient(90deg, ${gradientFrom}, ${gradientTo})`,
            boxShadow: `0 0 10px ${glowColor}55, inset 0 1px 0 rgba(255,255,255,0.18)`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.13) 0%, transparent 55%)',
            }}
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-end pr-2.5 pointer-events-none">
          <span
            className="text-xs font-bold tabular-nums"
            style={{
              color: 'rgba(255,255,255,0.88)',
              textShadow: '0 1px 4px rgba(0,0,0,1)',
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
        <div
          className="backdrop-blur-md px-5 py-3 flex flex-col gap-2.5"
          style={{
            minWidth: '340px',
            background:
              'linear-gradient(180deg, rgba(10,10,22,0.88) 0%, rgba(5,5,14,0.94) 100%)',
            borderTop: '1px solid rgba(100,160,255,0.22)',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            borderRight: '1px solid rgba(255,255,255,0.06)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            clipPath:
              'polygon(14px 0%, calc(100% - 14px) 0%, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0% calc(100% - 14px), 0% 14px)',
            boxShadow:
              '0 4px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
          >
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
            gradientFrom="#1D4ED8"
            gradientTo="#7DD3FC"
            glowColor="#4A90E2"
            icon="🛡"
          />

          {/* HP Bar */}
          <ResourceBar
            current={playerHealth}
            max={maxHealth}
            gradientFrom="#991B1B"
            gradientTo="#F87171"
            glowColor="#DC2626"
            icon="♥"
          />
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
      <ChatUI />
    </>
  );
}
