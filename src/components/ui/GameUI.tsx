import React, { useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import HotkeyPanel from './HotkeyPanel';
import { SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
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
  onUnlockAbility?: (unlock: AbilityUnlock) => void;
  purchasedItems?: string[];
  criticalRuneCount?: number;
  critDamageRuneCount?: number;
  criticalChance?: number;
  criticalDamageMultiplier?: number;
}


function ResourceBar({ current, max, color, backgroundColor = '#333' }: { current: number; max: number; color: string; backgroundColor?: string }) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  return (
    <div className="w-full">
      <div className="w-full h-6 rounded-lg border-2 border-gray-600 overflow-hidden relative" style={{ backgroundColor }}>
        <div className="h-full transition-all duration-300 ease-out rounded-sm" style={{ width: `${percentage}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}40` }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-white font-medium drop-shadow-lg">{Math.round(current)}/{max}</span>
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
  onUnlockAbility,
  purchasedItems = [],
  criticalRuneCount = 0,
  critDamageRuneCount = 0,
  criticalChance = 0,
  criticalDamageMultiplier = 2.0,
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
        <div className="bg-black bg-opacity-60 backdrop-blur-sm rounded-lg p-4 border border-gray-600 min-w-80">
          {/* Shield Bar - Thinner bar above health */}
          <div className="w-full mb-2">
            <div 
              className="w-full h-3 rounded-lg border border-blue-500 overflow-hidden relative"
              style={{ backgroundColor: '#1a2332' }}
            >
              <div
                className="h-full transition-all duration-300 ease-out rounded-sm"
                style={{
                  width: `${Math.max(0, Math.min(100, (playerShield / maxShield) * 100))}%`,
                  backgroundColor: '#4A90E2',
                  boxShadow: '0 0 8px #4A90E240'
                }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs text-white font-medium drop-shadow-lg">
                  {Math.round(playerShield)}/{maxShield}
                </span>
              </div>
            </div>
          </div>
          
          {/* HP Bar */}
          <div className="mb-2">
            <ResourceBar
              current={playerHealth}
              max={maxHealth}
              color="#DC2626"
              backgroundColor="#331a1a"
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
        onUnlockAbility={handleUnlockAbility}
        purchasedItems={purchasedItems}
      />

      {/* Chat UI */}
      <ChatUI />
    </>
  );
}
