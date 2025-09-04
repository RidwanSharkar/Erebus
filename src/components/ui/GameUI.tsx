import React, { useEffect, useState } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import HotkeyPanel from './HotkeyPanel';

interface GameUIProps {
  currentWeapon: WeaponType;
  playerHealth: number;
  maxHealth: number;
  playerShield?: number;
  maxShield?: number;
  mana?: number;
  maxMana?: number;
  energy?: number;
  maxEnergy?: number;
  rage?: number;
  maxRage?: number;
  controlSystem?: any; // Reference to control system for ability cooldowns
}

interface ResourceBarProps {
  current: number;
  max: number;
  color: string;
  backgroundColor?: string;
}

function ResourceBar({ current, max, color, backgroundColor = '#333'}: ResourceBarProps) {
  const percentage = Math.max(0, Math.min(100, (current / max) * 100));
  
  return (
    <div className="w-full">
      <div 
        className="w-full h-6 rounded-lg border-2 border-gray-600 overflow-hidden relative"
        style={{ backgroundColor }}
      >
        <div
          className="h-full transition-all duration-300 ease-out rounded-sm"
          style={{
            width: `${percentage}%`,
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}40`
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-white font-medium drop-shadow-lg">
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
  mana = 200, 
  maxMana = 200, 
  energy = 100,
  maxEnergy = 100,
  rage = 0, 
  maxRage = 100,
  controlSystem
}: GameUIProps) {
  const [currentMana, setCurrentMana] = useState(mana);
  const [currentEnergy, setCurrentEnergy] = useState(energy);
  const [currentRage, setCurrentRage] = useState(rage);
  const [lastSwordDamageTime, setLastSwordDamageTime] = useState<number>(Date.now());

  // Mana regeneration for Scythe (5 mana per second)
  useEffect(() => {
    if (currentWeapon === WeaponType.SCYTHE) {
      const interval = setInterval(() => {
        setCurrentMana(prev => Math.min(maxMana, prev + 4));
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [currentWeapon, maxMana]);

  // Energy regeneration for Bow (14 energy per second)
  useEffect(() => {
    if (currentWeapon === WeaponType.BOW) {
      const interval = setInterval(() => {
        setCurrentEnergy(prev => Math.min(maxEnergy, prev + 7)); // 20 energy per second = 10 every 500ms
      }, 500);
      
      return () => clearInterval(interval);
    }
  }, [currentWeapon, maxEnergy]);

  // Rage decay for Sword (5 rage per second after 5 seconds of no damage)
  useEffect(() => {
    if (currentWeapon === WeaponType.SWORD) {
      const interval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastDamage = now - lastSwordDamageTime;
        
        // If it's been more than 6 seconds since last sword damage, decay rage
        if (timeSinceLastDamage > 6000) {
          setCurrentRage(prev => Math.max(0, prev - 5));
        }
      }, 1000); // Check every second
      
      return () => clearInterval(interval);
    }
  }, [currentWeapon, lastSwordDamageTime]);

  // Reset resources when weapon changes
  useEffect(() => {
    if (currentWeapon === WeaponType.SCYTHE) {
      setCurrentMana(maxMana);
      setCurrentEnergy(maxEnergy);
      setCurrentRage(0);
    } else if (currentWeapon === WeaponType.SWORD) {
      setCurrentRage(0);
      setCurrentMana(maxMana);
      setCurrentEnergy(maxEnergy);
      setLastSwordDamageTime(Date.now()); // Reset damage timer when switching to sword
    } else if (currentWeapon === WeaponType.BOW) {
      // Bow - uses energy system
      setCurrentEnergy(maxEnergy);
      setCurrentMana(maxMana);
      setCurrentRage(0);
    }
  }, [currentWeapon, maxMana, maxEnergy, maxRage]);

  // Function to consume mana (for Crossentropy bolt)
  const consumeMana = (amount: number) => {
    if (currentWeapon === WeaponType.SCYTHE) {
      setCurrentMana(prev => Math.max(0, prev - amount));
    }
  };

  // Function to consume energy (for bow abilities)
  const consumeEnergy = (amount: number) => {
    if (currentWeapon === WeaponType.BOW) {
      setCurrentEnergy(prev => Math.max(0, prev - amount));
    }
  };

  // Function to gain rage (for sword attacks)
  const gainRage = (amount: number) => {
    if (currentWeapon === WeaponType.SWORD) {
      setCurrentRage(prev => Math.min(maxRage, prev + amount));
      setLastSwordDamageTime(Date.now()); // Update last damage time when gaining rage
    }
  };

  // Function to consume rage (for Divine Storm)
  const consumeRage = (amount: number) => {
    if (currentWeapon === WeaponType.SWORD) {
      setCurrentRage(prev => Math.max(0, prev - amount));
    }
  };

  // Function to consume all rage (for Divine Storm)
  const consumeAllRage = () => {
    if (currentWeapon === WeaponType.SWORD) {
      setCurrentRage(0);
    }
  };

  // Expose functions globally for other components to use
  useEffect(() => {
    (window as any).gameUI = {
      consumeMana,
      consumeEnergy,
      gainRage,
      consumeRage,
      consumeAllRage,
      getCurrentMana: () => currentMana,
      getCurrentEnergy: () => currentEnergy,
      getCurrentRage: () => currentRage,
      canCastCrossentropy: () => currentMana >= 40, 
      canCastEntropicBolt: () => currentMana >= 10,
      canCastCrossentropyBolt: () => currentMana >= 40,
      canCastReanimate: () => currentMana >= 20,
      canCastFrostNova: () => currentMana >= 25,
      canCastDivineStorm: () => currentRage >= 40,
      // Bow energy abilities
      canCastBarrage: () => currentEnergy >= 40,
      canCastCobraShot: () => currentEnergy >= 40,
      canCastViperSting: () => currentEnergy >= 60
    };
  }, [currentMana, currentEnergy, currentRage, currentWeapon]);

  const getResourceBar = () => {
    switch (currentWeapon) {
      case WeaponType.SCYTHE:
        return (
          <ResourceBar
            current={currentMana}
            max={maxMana}
            color="#4A90E2"
            backgroundColor="#1a2332"
          />
        );
      case WeaponType.SWORD:
        return (
          <ResourceBar
            current={currentRage}
            max={maxRage}
            color="#FF6B35"
            backgroundColor="#332318"
          />
        );
      case WeaponType.BOW:
        return (
          <ResourceBar
            current={currentEnergy}
            max={maxEnergy}
            color="#FFD700"
            backgroundColor="#332b18"
          />
        );
      default:
        return null;
    }
  };

  return (
    <>
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
          
          {/* Resource Bar (weapon-specific) */}
          {getResourceBar()}
          
        </div>
      </div>
      
      {/* Hotkey Panel - positioned below the main UI */}
      <HotkeyPanel 
        currentWeapon={currentWeapon}
        controlSystem={controlSystem}
      />
    </>
  );
}
