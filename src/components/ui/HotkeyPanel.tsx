import React, { useState, useEffect, useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';

interface AbilityData {
  name: string;
  key: 'Q' | 'E' | 'R' | 'F';
  cooldown: number;
  currentCooldown: number;
  isActive?: boolean;
  description: string;
}

interface HotkeyPanelProps {
  currentWeapon: WeaponType;
  controlSystem?: any; // Reference to control system for cooldown data
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
    tertiary?: WeaponType;
  } | null;
  onWeaponSwitch?: (slot: 1 | 2 | 3) => void;
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

export default function HotkeyPanel({ currentWeapon, controlSystem, selectedWeapons, onWeaponSwitch }: HotkeyPanelProps) {
  const [tooltipContent, setTooltipContent] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [weaponSwitchCooldown, setWeaponSwitchCooldown] = useState<{ current: number; max: number }>({ current: 0, max: 5 });

  // Define selected weapons for switching (only show 1, 2, and 3 keys)
  const weapons: WeaponData[] = [];

  if (selectedWeapons) {
    // Primary weapon - key 1
    const primaryWeapon = {
      name: selectedWeapons.primary === WeaponType.SWORD ? 'Sword' :
            selectedWeapons.primary === WeaponType.BOW ? 'Bow' :
            selectedWeapons.primary === WeaponType.SCYTHE ? 'Scythe' :
            selectedWeapons.primary === WeaponType.SABRES ? 'Sabres' :
            selectedWeapons.primary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
      type: selectedWeapons.primary,
      key: '1' as const,
      icon: selectedWeapons.primary === WeaponType.SWORD ? '⚜️' :
            selectedWeapons.primary === WeaponType.BOW ? '🏹' :
            selectedWeapons.primary === WeaponType.SCYTHE ? '☠️' :
            selectedWeapons.primary === WeaponType.SABRES ? '⚔️' :
            selectedWeapons.primary === WeaponType.RUNEBLADE ? '🔮' : '❓'
    };
    weapons.push(primaryWeapon);

    // Secondary weapon - key 2
    const secondaryWeapon = {
      name: selectedWeapons.secondary === WeaponType.SWORD ? 'Sword' :
            selectedWeapons.secondary === WeaponType.BOW ? 'Bow' :
            selectedWeapons.secondary === WeaponType.SCYTHE ? 'Scythe' :
            selectedWeapons.secondary === WeaponType.SABRES ? 'Sabres' :
            selectedWeapons.secondary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
      type: selectedWeapons.secondary,
      key: '2' as const,
      icon: selectedWeapons.secondary === WeaponType.SWORD ? '⚜️' :
            selectedWeapons.secondary === WeaponType.BOW ? '🏹' :
            selectedWeapons.secondary === WeaponType.SCYTHE ? '☠️' :
            selectedWeapons.secondary === WeaponType.SABRES ? '⚔️' :
            selectedWeapons.secondary === WeaponType.RUNEBLADE ? '🔮' : '❓'
    };
    weapons.push(secondaryWeapon);

    // Tertiary weapon - key 3 (if unlocked)
    if (selectedWeapons.tertiary) {
      const tertiaryWeapon = {
        name: selectedWeapons.tertiary === WeaponType.SWORD ? 'Sword' :
              selectedWeapons.tertiary === WeaponType.BOW ? 'Bow' :
              selectedWeapons.tertiary === WeaponType.SCYTHE ? 'Scythe' :
              selectedWeapons.tertiary === WeaponType.SABRES ? 'Sabres' :
              selectedWeapons.tertiary === WeaponType.RUNEBLADE ? 'Runeblade' : 'Unknown',
        type: selectedWeapons.tertiary,
        key: '3' as const,
        icon: selectedWeapons.tertiary === WeaponType.SWORD ? '⚜️' :
              selectedWeapons.tertiary === WeaponType.BOW ? '🏹' :
              selectedWeapons.tertiary === WeaponType.SCYTHE ? '☠️' :
              selectedWeapons.tertiary === WeaponType.SABRES ? '⚔️' :
              selectedWeapons.tertiary === WeaponType.RUNEBLADE ? '🔮' : '❓'
      };
      weapons.push(tertiaryWeapon);
    }
  }

  // Define abilities for each weapon (now using 1, 2, 3 keys)
  const weaponAbilities: Record<WeaponType, AbilityData[]> = {
    [WeaponType.SWORD]: [
      {
        name: 'Aegis',
        key: 'Q',
        cooldown: 6.0,
        currentCooldown: 0,
        description: 'Creates a protective barrier that blocks all incoming damage for 3 seconds. Cannot attack while shielded.'
      },
      {
        name: 'Charge',
        key: 'E',
        cooldown: 8.0,
        currentCooldown: 0,
        description: 'Dash forward, instantly gaining 25 rage, damaging enemies in your path.'
      },
      {
        name: 'Bladestorm',
        key: 'R',
        cooldown: 4.0,
        currentCooldown: 0,
        description: '{40 RAGE} Consumes all rage to create a devastating whirlwind, lasting longer with each 10 rage consumed.'
      },
      {
        name: 'Colossus Strike',
        key: 'F',
        cooldown: 4.0,
        currentCooldown: 0,
        description: '{40 RAGE} Calls down a massive lightning bolt that deals damage based on enemy missing health and rage consumed.'
      }
    ],
    [WeaponType.BOW]: [
      {
        name: 'Barrage',
        key: 'Q',
        cooldown: 5.0,
        currentCooldown: 0,
        description: '{50 ENERGY} Fires 5 frost arrows in an arc, dealing 30 damage per arrow and applying a 50% SLOW effect for 5 seconds.'
      },
      {
        name: 'Cobra Shot',
        key: 'E',
        cooldown: 2.0,
        currentCooldown: 0,
        description: '{40 ENERGY} Fires a venomous shot that applies VENOM damage over time to the target..'
      },
      {
        name: 'Viper Sting',
        key: 'R',
        cooldown: 7.0,
        currentCooldown: 0,
        description: '{60 ENERGY} Fires a powerful piercing arrow that returns to you after a short delay. Each hit on an enemy creates a soul fragment that heals you for 20 HP each when returned.'
      },
      {
        name: 'Cloudkill',
        key: 'F',
        cooldown: 1.5,
        currentCooldown: 0,
        description: '{25 ENERGY} Summons green arrows from the sky that rain down on enemy locations. If enemy has VENOM, arrows become homing and guaranteed to hit.'
      }
    ],
    [WeaponType.SCYTHE]: [
      {
        name: 'Sunwell',
        key: 'Q',
        cooldown: 1.0,
        currentCooldown: 0,
        description: '{20 MANA} Heals for 30 HP.'
      },
      {
        name: 'Frost Nova',
        key: 'E',
        cooldown: 0.5,
        currentCooldown: 0,
        description: '{50 MANA} Conjures a freezing vortex around you that deals damage to enemies and applies FREEZE to enemies hit for 6 seconds.'
      },
      {
        name: 'Crossentropy',
        key: 'R',
        cooldown: 1.0,
        currentCooldown: 0,
        description: '{40 MANA} Charges for 1 second to fire a devastating accelerating flaming bolt that deals 20 additional damage per stack of BURNING.'
      },
      {
        name: 'Tidal Wave',
        key: 'F',
        cooldown: 3.0,
        currentCooldown: 0,
        description: '{40 MANA} Charges for 1 second to unleash a crashing tidal wave that radiates outward, dealing 70 damage and knocking back enemies by 10 distance. Refunds 100 mana if it hits a FROZEN enemy.'
      }
    ],
    [WeaponType.SABRES]: [
      {
        name: 'Backstab',
        key: 'Q',
        cooldown: 2.0,
        currentCooldown: 0,
        description: '{60 ENERGY} Strikes the target with both sabres, dealing 75 damage or 175 damage if attacking the target from behind. The energy cost is refunded if the target is stunned.'
      },
      {
        name: 'Flourish',
        key: 'E',
        cooldown: 1,
        currentCooldown: 0,
        description: '{35 ENERGY} Unleash a flurry of slashes that deals increased damage with successsive hits on the same target, stacking up to 3 times. Expending 3 stacks applies STUN for 4 seconds.'
      },
      {
        name: 'Skyfall',
        key: 'R',
        cooldown: 5.0,
        currentCooldown: 0,
        description: '{40 ENERGY} Leap high into the air and crash down, dealing 125 damage and applying STUN for 2 seconds to enemies below.'
      },
      {
        name: 'Shadow Step',
        key: 'F',
        cooldown: 10.0,
        currentCooldown: 0,
        description: 'Fade into the shadows, becoming INVISIBLE for 6 seconds after a 0.5 second delay.'
      }
    ],
    [WeaponType.RUNEBLADE]: [
      {
        name: 'Void Grasp',
        key: 'Q',
        cooldown: 12.0,
        currentCooldown: 0,
        description: '{35 MANA} Fires a twisting nether that pulls the first enemy hit towards you.'
      },
      {
        name: 'Wraithblade',
        key: 'E',
        cooldown: 8.0,
        currentCooldown: 0,
        description: '{35 MANA} Unleashes a powerful strike that inflicts CORRUPTED debuff to the target, reducing their movement speed by 90%, regaining 10% movement speed per second.'
      },
      {
        name: 'Unholy Smite',
        key: 'R',
        cooldown: 15.0,
        currentCooldown: 0,
        description: '{50 MANA} Calls down unholy energy, dealing damage to enemies in a small area and healing you for 80 HP.'
      },
      {
        name: 'Corruption',
        key: 'F',
        cooldown: 0, // No cooldown, it's a toggle ability
        currentCooldown: 0,
        description: '{12 MANA/s} Toggle a force-multiplier aura that enhances strikes delivered by the Runeblade, increasing critical strike chance by 30% and critical strike damage by 75%.'
      }
    ]
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

  const handleAbilityHover = useCallback((
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
  }, []);

  const handleWeaponHover = useCallback((
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
  }, []);

  const handleAbilityLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

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

              const handleWeaponClick = useCallback(() => {
                if (!isOnCooldown && onWeaponSwitch) {
                  const slot = weapon.key === '1' ? 1 : weapon.key === '2' ? 2 : 3;
                  onWeaponSwitch(slot as 1 | 2 | 3);
                }
              }, [isOnCooldown, onWeaponSwitch, weapon.key]);

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
                  onClick={handleWeaponClick}
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

                    // Check for Particle Beam charging state
                    if (ability.key === 'F' && currentWeapon === WeaponType.SCYTHE && controlSystem.isParticleBeamChargingActive?.()) {
                      const progress = controlSystem.getParticleBeamChargeProgress?.() || 0;
                      return (
                        <div className="absolute inset-0 rounded-lg bg-cyan-400 bg-opacity-20 border-2 border-cyan-400">
                          <div
                            className="absolute bottom-0 left-0 right-0 bg-cyan-400 bg-opacity-60 transition-all duration-100"
                            style={{ height: `${progress * 100}%` }}
                          />
                        </div>
                      );
                    }
                    
                    // Check for Skyfall active state
                    if (ability.key === 'R' && currentWeapon === WeaponType.SABRES && controlSystem.isSkyfallActive?.()) {
                      return (
                        <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />
                      );
                    }

                    // Check for Stealth active state
                    if (ability.key === 'F' && currentWeapon === WeaponType.SABRES && controlSystem.isStealthActive?.()) {
                      return (
                        <div className="absolute inset-0 rounded-lg bg-purple-400 bg-opacity-20 border-2 border-purple-400 animate-pulse" />
                      );
                    }

                    // Check for Death Grasp active state
                    if (ability.key === 'Q' && currentWeapon === WeaponType.RUNEBLADE) {
                      const abilityData = abilityCooldowns[ability.key];
                      if (abilityData && abilityData.isActive) {
                        return (
                          <div className="absolute inset-0 rounded-lg bg-purple-400 bg-opacity-20 border-2 border-purple-400 animate-pulse" />
                        );
                      }
                    }

                    // Check for Smite active state
                    if (ability.key === 'E' && currentWeapon === WeaponType.RUNEBLADE) {
                      const abilityData = abilityCooldowns[ability.key];
                      if (abilityData && abilityData.isActive) {
                        return (
                          <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />
                        );
                      }
                    }

                    // Check for Corrupted Aura active state
                    if (ability.key === 'F' && currentWeapon === WeaponType.RUNEBLADE && controlSystem.isCorruptedAuraActive?.()) {
                      return (
                        <div className="absolute inset-0 rounded-lg bg-red-400 bg-opacity-20 border-2 border-red-400 animate-pulse" />
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
function getAbilityIcon(weapon: WeaponType, key: 'Q' | 'E' | 'R' | 'F'): string {
  const iconMap: Record<WeaponType, Record<'Q' | 'E' | 'R' | 'F', string>> = {
    [WeaponType.SWORD]: {
      Q: '🛡️', // Aegis
      E: '🔱', // Charge
      R: '🌪️', // Divine Storm
      F: '⚡️'  // Colossus Strike
    },
    [WeaponType.BOW]: {
      Q: '🎯', // Barrage
      E: '🐍', // Cobra Shot
      R: '🦂', // Viper Sting
      F: '☁️'  // Cloudkill
    },
    [WeaponType.SCYTHE]: {
      Q: '🔆', // Sunwell
      E: '❄️', // Frost Nova
      R: '☄️', // Crossentropy
      F: '🌊' // Tidal Wave
    },
    [WeaponType.SABRES]: {
      Q: '🗡️', // Backstab
      E: '💥', // Flourish
      R: '🐦‍🔥', // Skyfall
      F: '🌒' // Shadow Step
    },
    [WeaponType.RUNEBLADE]: {
      Q: '⛓️', // Death Grasp
      E: '🪝', // Wraith Strike
      R: '👻', // Unholy Smite
      F: '🩸' // Corruption 
    },
  };

  return iconMap[weapon]?.[key] || '❓';
}
