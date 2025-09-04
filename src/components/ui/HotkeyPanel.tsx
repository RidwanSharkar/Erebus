import React, { useState, useEffect } from 'react';
import { WeaponType } from '@/components/dragon/weapons';

interface AbilityData {
  name: string;
  key: 'Q' | 'E' | 'R';
  cooldown: number;
  currentCooldown: number;
  isActive?: boolean;
  description: string;
}

interface HotkeyPanelProps {
  currentWeapon: WeaponType;
  controlSystem?: any; // Reference to control system for cooldown data
}

interface WeaponData {
  name: string;
  type: WeaponType;
  key: '1' | '2' | '3';
  icon: string;
}

interface TooltipProps {
  content: {
    name: string;
    description: string;
  };
  visible: boolean;
  x: number;
  y: number;
}

function Tooltip({ content, visible, x, y }: TooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm max-w-xs pointer-events-none"
      style={{
        left: x - 150, // Center tooltip above cursor
        top: y - 80,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="font-semibold text-blue-300 mb-1">{content.name}</div>
      <div className="text-gray-300">{content.description}</div>
    </div>
  );
}

/**
 * RoundedSquareProgress Component
 * Renders a sweeping cooldown animation around a rounded square.
 */
const RoundedSquareProgress: React.FC<{
  size: number;
  strokeWidth: number;
  percentage: number;
  borderRadius: number;
  isActive?: boolean;
}> = ({ size, strokeWidth, percentage, borderRadius, isActive }) => {
  const halfStroke = strokeWidth / 2;
  const adjustedSize = size - strokeWidth;
  const perimeter = 4 * adjustedSize;
  const dashOffset = perimeter - (perimeter * percentage) / 100;

  return (
    <svg
      width={size}
      height={size}
      className="absolute inset-0"
      style={{ zIndex: 10 }}
    >
      <rect
        x={halfStroke}
        y={halfStroke}
        width={adjustedSize}
        height={adjustedSize}
        rx={borderRadius}
        ry={borderRadius}
        stroke={isActive ? "#ff3333" : "#39ff14"}
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={perimeter}
        strokeDashoffset={dashOffset}
        style={{
          transition: 'stroke-dashoffset 0.1s ease-out'
        }}
      />
    </svg>
  );
};

export default function HotkeyPanel({ currentWeapon, controlSystem }: HotkeyPanelProps) {
  const [tooltipContent, setTooltipContent] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [weaponSwitchCooldown, setWeaponSwitchCooldown] = useState<{ current: number; max: number }>({ current: 0, max: 5 });

  // Define weapons for switching
  const weapons: WeaponData[] = [
    {
      name: 'Sword',
      type: WeaponType.SWORD,
      key: '1',
      icon: '⚔️'
    },
    {
      name: 'Bow',
      type: WeaponType.BOW,
      key: '2',
      icon: '🏹'
    },
    {
      name: 'Scythe',
      type: WeaponType.SCYTHE,
      key: '3',
      icon: '⚡'
    }
  ];

  // Define abilities for each weapon
  const weaponAbilities: Record<WeaponType, AbilityData[]> = {
    [WeaponType.SWORD]: [
      {
        name: 'Deflect Barrier',
        key: 'Q',
        cooldown: 8.0,
        currentCooldown: 0,
        description: 'Creates a protective barrier that blocks damage and reflects projectiles for 3 seconds.'
      },
      {
        name: 'Charge',
        key: 'E',
        cooldown: 3.0,
        currentCooldown: 0,
        description: 'Dash forward 10.5 units, gaining 20 rage. Can damage enemies in your path.'
      },
      {
        name: 'Divine Storm',
        key: 'R',
        cooldown: 4.0,
        currentCooldown: 0,
        description: 'Consumes all rage (min 20) to create a devastating storm. Duration: 4s + 1s per 10 rage consumed.'
      }
    ],
    [WeaponType.BOW]: [
      {
        name: 'Barrage',
        key: 'Q',
        cooldown: 5.0,
        currentCooldown: 0,
        description: 'Fires 5 arrows in a spread pattern after a short charge. High damage per arrow.'
      },
      {
        name: 'Cobra Shot',
        key: 'E',
        cooldown: 2.0,
        currentCooldown: 0,
        description: 'Fires a venomous green arrow that applies poison damage over time to enemies.'
      },
      {
        name: 'Viper Sting',
        key: 'R',
        cooldown: 7.0,
        currentCooldown: 0,
        description: 'Charges for 1 second then fires a powerful piercing projectile with special effects.'
      }
    ],
    [WeaponType.SCYTHE]: [
      {
        name: 'Reanimate',
        key: 'Q',
        cooldown: 1.0,
        currentCooldown: 0,
        description: 'Costs 20 mana. Heals 20 HP and creates visual healing effects around the player.'
      },
      {
        name: 'Entropic Bolt',
        key: 'E',
        cooldown: 0.5,
        currentCooldown: 0,
        description: 'Fires a chaotic bolt that moves erratically and deals high damage to enemies.'
      },
      {
        name: 'Crossentropy Bolt',
        key: 'R',
        cooldown: 1.0,
        currentCooldown: 0,
        description: 'Costs 40 mana. Fires a slow, high-damage piercing projectile with extended range.'
      }
    ],
    [WeaponType.SABRES]: [], // Not implemented in current system
    [WeaponType.SPEAR]: []   // Not implemented in current system
  };

  // Update cooldowns from control system
  useEffect(() => {
    if (!controlSystem || !controlSystem.getAbilityCooldowns) return;

    const updateCooldowns = () => {
      const abilityCooldowns = controlSystem.getAbilityCooldowns();
      const newCooldowns: Record<string, number> = {};

      // Extract current cooldown values
      Object.keys(abilityCooldowns).forEach(key => {
        newCooldowns[key] = abilityCooldowns[key].current;
      });

      setCooldowns(newCooldowns);

      // Update weapon switch cooldown if available
      if (controlSystem.getWeaponSwitchCooldown) {
        setWeaponSwitchCooldown(controlSystem.getWeaponSwitchCooldown());
      }
    };

    // Update cooldowns every 100ms for smooth animation
    const interval = setInterval(updateCooldowns, 100);
    updateCooldowns(); // Initial update

    return () => clearInterval(interval);
  }, [controlSystem, currentWeapon]);

  const handleAbilityHover = (
    e: React.MouseEvent,
    ability: AbilityData
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: ability.name,
      description: ability.description
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  const handleWeaponHover = (
    e: React.MouseEvent,
    weapon: WeaponData
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: weapon.name,
      description: `Switch to ${weapon.name} (${weapon.key})`
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  };

  const handleAbilityLeave = () => {
    setTooltipContent(null);
  };

  const currentAbilities = weaponAbilities[currentWeapon] || [];

  if (currentAbilities.length === 0) {
    return null; // Don't render for weapons that aren't implemented
  }

  return (
    <>
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
        <div className="bg-black bg-opacity-70 backdrop-blur-sm rounded-lg p-3 border border-gray-600">
          <div className="flex items-center space-x-4">
            {/* Weapon Icons */}
            {weapons.map((weapon) => {
              const isCurrentWeapon = weapon.type === currentWeapon;
              const isOnCooldown = weaponSwitchCooldown.current > 0;
              const cooldownPercentage = weaponSwitchCooldown.max > 0 ? (weaponSwitchCooldown.current / weaponSwitchCooldown.max) * 100 : 0;

              return (
                <div
                  key={weapon.key}
                  className={`relative w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                    isCurrentWeapon 
                      ? 'border-yellow-400 bg-yellow-900 bg-opacity-50' 
                      : isOnCooldown 
                        ? 'border-red-500 bg-red-900 bg-opacity-30' 
                        : 'border-gray-400 bg-gray-900 bg-opacity-30 hover:bg-opacity-50'
                  } cursor-pointer flex items-center justify-center`}
                  onMouseEnter={(e) => handleWeaponHover(e, weapon)}
                  onMouseLeave={handleAbilityLeave}
                >
                  {/* Hotkey indicator */}
                  <div className="absolute -top-2 -left-2 bg-gray-800 border border-gray-600 rounded text-xs text-white px-1 py-0.5 font-semibold">
                    {weapon.key}
                  </div>

                  {/* Weapon icon */}
                  <div className={`text-2xl ${
                    isCurrentWeapon 
                      ? 'text-yellow-400' 
                      : isOnCooldown 
                        ? 'text-red-400' 
                        : 'text-gray-300'
                  }`}>
                    {weapon.icon}
                  </div>

                  {/* Cooldown overlay */}
                  {isOnCooldown && (
                    <>
                      <div className="absolute inset-0 bg-black bg-opacity-60 rounded-lg" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-sm font-bold bg-black bg-opacity-60 rounded px-1">
                          {Math.ceil(weaponSwitchCooldown.current)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Separator */}
            <div className="w-px h-8 bg-gray-600" />

            {/* Ability Icons */}
            {currentAbilities.map((ability) => {
              const currentCooldown = cooldowns[ability.key] || 0;
              const cooldownPercentage = ability.cooldown > 0 ? (currentCooldown / ability.cooldown) * 100 : 0;
              const isOnCooldown = currentCooldown > 0;
              const isUnassigned = ability.name === 'Not Assigned';

              return (
                <div
                  key={ability.key}
                  className={`relative w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                    isUnassigned 
                      ? 'border-gray-600 bg-gray-800 opacity-50' 
                      : isOnCooldown 
                        ? 'border-red-500 bg-red-900 bg-opacity-30' 
                        : 'border-green-400 bg-green-900 bg-opacity-30 hover:bg-opacity-50'
                  } cursor-pointer flex items-center justify-center`}
                  onMouseEnter={(e) => handleAbilityHover(e, ability)}
                  onMouseLeave={handleAbilityLeave}
                >
                  {/* Hotkey indicator */}
                  <div className="absolute -top-2 -left-2 bg-gray-800 border border-gray-600 rounded text-xs text-white px-1 py-0.5 font-semibold">
                    {ability.key}
                  </div>

                  {/* Ability icon placeholder - you can replace with actual icons */}
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-lg font-bold ${
                    isUnassigned 
                      ? 'text-gray-500' 
                      : isOnCooldown 
                        ? 'text-red-400' 
                        : 'text-green-400'
                  }`}>
                    {getAbilityIcon(currentWeapon, ability.key)}
                  </div>

                  {/* Cooldown overlay */}
                  {isOnCooldown && !isUnassigned && (
                    <>

                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white text-sm font-bold bg-black bg-opacity-60 rounded px-1">
                          {Math.ceil(currentCooldown)}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Active state indicator for abilities */}
                  {(() => {
                    if (!controlSystem || !controlSystem.getAbilityCooldowns) return null;
                    
                    const abilityCooldowns = controlSystem.getAbilityCooldowns();
                    const abilityData = abilityCooldowns[ability.key];
                    
                    if (abilityData && abilityData.isActive) {
                      return (
                        <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />
                      );
                    }
                    
                    // Check for charging states (Viper Sting, Barrage)
                    if (ability.key === 'R' && currentWeapon === WeaponType.BOW && controlSystem.isViperStingChargingActive?.()) {
                      const progress = controlSystem.getViperStingChargeProgress?.() || 0;
                      return (
                        <div className="absolute inset-0 rounded-lg bg-purple-400 bg-opacity-20 border-2 border-purple-400">
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-purple-400 bg-opacity-60 transition-all duration-100"
                            style={{ height: `${progress * 100}%` }}
                          />
                        </div>
                      );
                    }
                    
                    if (ability.key === 'Q' && currentWeapon === WeaponType.BOW && controlSystem.isBarrageChargingActive?.()) {
                      const progress = controlSystem.getBarrageChargeProgress?.() || 0;
                      return (
                        <div className="absolute inset-0 rounded-lg bg-orange-400 bg-opacity-20 border-2 border-orange-400">
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-orange-400 bg-opacity-60 transition-all duration-100"
                            style={{ height: `${progress * 100}%` }}
                          />
                        </div>
                      );
                    }
                    
                    // Check for Cobra Shot charging state
                    if (ability.key === 'E' && currentWeapon === WeaponType.BOW && controlSystem.isCobraShotChargingActive?.()) {
                      const progress = controlSystem.getCobraShotChargeProgress?.() || 0;
                      return (
                        <div className="absolute inset-0 rounded-lg bg-green-400 bg-opacity-20 border-2 border-green-400">
                          <div 
                            className="absolute bottom-0 left-0 right-0 bg-green-400 bg-opacity-60 transition-all duration-100"
                            style={{ height: `${progress * 100}%` }}
                          />
                        </div>
                      );
                    }
                    
                    return null;
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {tooltipContent && (
        <Tooltip 
          content={tooltipContent}
          visible={true}
          x={tooltipPosition.x}
          y={tooltipPosition.y}
        />
      )}
    </>
  );
}

// Helper function to get ability icons
function getAbilityIcon(weapon: WeaponType, key: 'Q' | 'E' | 'R'): string {
  const iconMap: Record<WeaponType, Record<'Q' | 'E' | 'R', string>> = {
    [WeaponType.SWORD]: {
      Q: '🛡️', // Deflect Barrier
      E: '⚡', // Charge
      R: '🌪️'  // Divine Storm
    },
    [WeaponType.BOW]: {
      Q: '🏹', // Barrage
      E: '🐍', // Cobra Shot
      R: '🐍'  // Viper Sting
    },
    [WeaponType.SCYTHE]: {
      Q: '💚', // Reanimate
      E: '⚡', // Entropic Bolt
      R: '⚔️'  // Crossentropy Bolt
    },
    [WeaponType.SABRES]: {
      Q: '❓',
      E: '❓',
      R: '❓'
    },
    [WeaponType.SPEAR]: {
      Q: '❓',
      E: '❓',
      R: '❓'
    }
  };

  return iconMap[weapon]?.[key] || '❓';
}
