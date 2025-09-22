'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { WeaponType, WeaponSubclass } from '../components/dragon/weapons';
import { Camera } from '../utils/three-exports';
import type { DamageNumberData } from '../components/DamageNumbers';
import DamageNumbers from '../components/DamageNumbers';
import GameUI from '../components/ui/GameUI';
import { getGlobalRuneCounts, getCriticalChance, getCriticalDamageMultiplier } from '../core/DamageCalculator';
import ExperienceBar from '../components/ui/ExperienceBar';
import { MultiplayerProvider, useMultiplayer } from '../contexts/MultiplayerContext';
import RoomJoin from '../components/ui/RoomJoin';
import { weaponAbilities, getAbilityIcon, type AbilityData } from '../utils/weaponAbilities';

// Dynamic imports for maximum code splitting
const Canvas = dynamic(() => import('@react-three/fiber').then(mod => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen text-white">Loading 3D engine...</div>
});


// Lazy load PVP game scene
const PVPGameScene = dynamic(() => import('../components/PVPGameScene').then(mod => ({ default: mod.PVPGameScene })), {
  ssr: false,
  loading: () => null
});

// Weapon option interface
interface WeaponOption {
  type: WeaponType;
  name: string;
  icon: string;
  description: string;
  defaultSubclass: WeaponSubclass;
}

// Tooltip component for ability descriptions
interface TooltipProps {
  content: {
    name: string;
    description: string;
    cooldown?: number;
  };
  visible: boolean;
  x: number;
  y: number;
}

function AbilityTooltip({ content, visible, x, y }: TooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 bg-gray-900 border border-gray-600 rounded-lg p-3 text-white text-sm max-w-xs pointer-events-none"
      style={{
        left: x - 150, // Center tooltip above cursor
        top: y - 100,
        transform: 'translateX(-50%)'
      }}
    >
      <div className="font-semibold text-blue-300 mb-1">{content.name}</div>
      {content.cooldown !== undefined && (
        <div className="text-yellow-400 text-xs mb-1">Cooldown: {content.cooldown}s</div>
      )}
      <div className="text-gray-300">{content.description}</div>
    </div>
  );
}

function HomeContent() {
  const { selectedWeapons, setSelectedWeapons, skillPointData, unlockAbility, updateSkillPointsForLevel } = useMultiplayer();

  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [cameraInfo, setCameraInfo] = useState<{
    camera: Camera | null;
    size: { width: number; height: number };
  }>({
    camera: null,
    size: { width: 0, height: 0 }
  });
  const [gameState, setGameState] = useState({
    playerHealth: 200,
    maxHealth: 200,
    playerShield: 100,
    maxShield: 100,
    currentWeapon: WeaponType.BOW,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    mana: 150,
    maxMana: 150
  });

  // Helper function to get default subclass for a weapon
  const getDefaultSubclassForWeapon = (weapon: WeaponType): WeaponSubclass => {
    switch (weapon) {
      case WeaponType.SWORD:
        return WeaponSubclass.DIVINITY;
      case WeaponType.BOW:
        return WeaponSubclass.ELEMENTAL;
      case WeaponType.SCYTHE:
        return WeaponSubclass.CHAOS;
      case WeaponType.SABRES:
        return WeaponSubclass.FROST;
      case WeaponType.RUNEBLADE:
        return WeaponSubclass.ARCANE;
      default:
        return WeaponSubclass.ELEMENTAL;
    }
  };

  // Update gameState when selectedWeapons changes
  useEffect(() => {
    if (selectedWeapons?.primary) {
      setGameState(prev => ({
        ...prev,
        currentWeapon: selectedWeapons.primary,
        // Update subclass based on weapon type
        currentSubclass: getDefaultSubclassForWeapon(selectedWeapons.primary)
      }));
    }
  }, [selectedWeapons]);

  const [controlSystem, setControlSystem] = useState<any>(null);
  const [gameMode, setGameMode] = useState<'menu' | 'singleplayer' | 'multiplayer' | 'pvp'>('menu');
  const [showRoomJoin, setShowRoomJoin] = useState(false);
  const [roomJoinMode, setRoomJoinMode] = useState<'multiplayer' | 'pvp'>('multiplayer');
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);

  // Local weapon selection state
  const [tempSelectedWeapons, setTempSelectedWeapons] = useState<WeaponType[]>([]);
  // Track weapon positions to maintain consistent primary/secondary assignment
  const [weaponPositions, setWeaponPositions] = useState<{ [key: string]: 'primary' | 'secondary' }>({});

  // Tooltip state for ability descriptions
  const [tooltipContent, setTooltipContent] = useState<{
    name: string;
    description: string;
    cooldown?: number;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Get weapon position for consistent display
  const getWeaponPosition = (weaponType: WeaponType): 'primary' | 'secondary' | null => {
    return weaponPositions[weaponType] || null;
  };

  // Get weapon color scheme for selection styling
  const getWeaponColorScheme = (weaponType: WeaponType) => {
    switch (weaponType) {
      case WeaponType.BOW:
        return {
          border: 'border-green-500',
          background: 'bg-green-500/20',
          shadow: 'shadow-green-500/30',
          badge: 'bg-green-600'
        };
      case WeaponType.SWORD:
        return {
          border: 'border-sky-400',
          background: 'bg-sky-400/20',
          shadow: 'shadow-sky-400/30',
          badge: 'bg-sky-500'
        };
      case WeaponType.SCYTHE:
        return {
          border: 'border-blue-500',
          background: 'bg-blue-500/20',
          shadow: 'shadow-blue-500/30',
          badge: 'bg-blue-600'
        };
      case WeaponType.RUNEBLADE:
        return {
          border: 'border-purple-500',
          background: 'bg-purple-500/20',
          shadow: 'shadow-purple-500/30',
          badge: 'bg-purple-600'
        };
      case WeaponType.SABRES:
        return {
          border: 'border-red-500',
          background: 'bg-red-500/20',
          shadow: 'shadow-red-500/30',
          badge: 'bg-red-600'
        };
      default:
        return {
          border: 'border-green-500',
          background: 'bg-green-500/20',
          shadow: 'shadow-green-500/30',
          badge: 'bg-green-600'
        };
    }
  };

  // Weapon options
  const weapons: WeaponOption[] = [
    {
      type: WeaponType.SCYTHE,
      name: 'Scythe',
      icon: '☠️',
      description: 'ENTROPY WEAVER',
      defaultSubclass: WeaponSubclass.CHAOS
    },
    {
      type: WeaponType.BOW,
      name: 'Bow',
      icon: '🏹',
      description: 'VIPER HUNTRESS',
      defaultSubclass: WeaponSubclass.ELEMENTAL
    },
    {
      type: WeaponType.SABRES,
      name: 'Sabres',
      icon: '⚔️',
      description: 'LURKER ASSASSIN',      defaultSubclass: WeaponSubclass.FROST
    },
    {
      type: WeaponType.RUNEBLADE,
      name: 'Runeblade',
      icon: '🔮',
      description: 'TEMPLAR KNIGHT',
      defaultSubclass: WeaponSubclass.ARCANE
    },
    {
      type: WeaponType.SWORD,
      name: 'Greatsword',
      icon: '💎',
      description: 'PRAETOR IMMORTAL',
      defaultSubclass: WeaponSubclass.DIVINITY
    }
  ];

  const handleWeaponToggle = (weaponType: WeaponType) => {
    const isSelected = tempSelectedWeapons.includes(weaponType);

    if (isSelected) {
      // Remove weapon if already selected
      const newSelectedWeapons = tempSelectedWeapons.filter(w => w !== weaponType);

      // Create new positions object
      const newPositions: { [key: string]: 'primary' | 'secondary' } = {};

      // If we have weapons remaining, ensure proper primary/secondary assignment
      if (newSelectedWeapons.length === 1) {
        // Only one weapon left - it becomes primary
        newPositions[newSelectedWeapons[0]] = 'primary';
      } else if (newSelectedWeapons.length === 2) {
        // Two weapons - preserve existing positions if possible, otherwise reassign
        const remainingPositions = Object.entries(weaponPositions)
          .filter(([weapon]) => weapon !== weaponType && newSelectedWeapons.includes(weapon as WeaponType));

        if (remainingPositions.length === 2) {
          // Both remaining weapons had positions - preserve them
          remainingPositions.forEach(([weapon, position]) => {
            newPositions[weapon] = position;
          });
        } else if (remainingPositions.length === 1) {
          // Only one had a position - assign it as primary, other as secondary
          const [weaponWithPosition, position] = remainingPositions[0];
          newPositions[weaponWithPosition] = position;

          // Find the weapon without a position
          const weaponWithoutPosition = newSelectedWeapons.find(w => w !== weaponWithPosition);
          if (weaponWithoutPosition) {
            // Assign secondary to the weapon that doesn't have a position
            newPositions[weaponWithoutPosition] = position === 'primary' ? 'secondary' : 'primary';
          }
        } else {
          // No positions preserved - assign first as primary, second as secondary
          newSelectedWeapons.forEach((weapon, index) => {
            newPositions[weapon] = index === 0 ? 'primary' : 'secondary';
          });
        }
      }

      // Update state with new arrays
      setTempSelectedWeapons(newSelectedWeapons);
      setWeaponPositions(newPositions);
    } else {
      // Add weapon if not selected and we haven't reached the limit
      if (tempSelectedWeapons.length < 2) {
        const newSelectedWeapons = [...tempSelectedWeapons, weaponType];

        // Create new positions
        const newPositions = { ...weaponPositions };

        if (newSelectedWeapons.length === 1) {
          // First weapon - always primary
          newPositions[weaponType] = 'primary';
        } else if (newSelectedWeapons.length === 2) {
          // Second weapon - always secondary
          newPositions[weaponType] = 'secondary';
        }

        setTempSelectedWeapons(newSelectedWeapons);
        setWeaponPositions(newPositions);
      }
    }
  };

  // Tooltip handlers
  const handleAbilityHover = useCallback((
    e: React.MouseEvent,
    ability: AbilityData
  ) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: ability.name,
      description: ability.description,
      cooldown: ability.cooldown
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleAbilityLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  const handleDamageNumberComplete = (id: string) => {
    // Use the global handler set by GameScene
    if ((window as any).handleDamageNumberComplete) {
      (window as any).handleDamageNumberComplete(id);
    }
  };

  const handleCameraUpdate = (camera: Camera, size: { width: number; height: number }) => {
    setCameraInfo({ camera, size });
  };

  const handleGameStateUpdate = (newGameState: {
    playerHealth: number;
    maxHealth: number;
    playerShield: number;
    maxShield: number;
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
    mana?: number;
    maxMana?: number;
  }) => {
    setGameState({
      ...newGameState,
      mana: newGameState.mana ?? 150,
      maxMana: newGameState.maxMana ?? 150
    });
  };

  const handleControlSystemUpdate = (newControlSystem: any) => {
    setControlSystem(newControlSystem);
  };

  // Sync skill point data with control system
  useEffect(() => {
    if (controlSystem && skillPointData) {
      controlSystem.setSkillPointData(skillPointData);
    }
  }, [controlSystem, skillPointData]);

  const handleExperienceUpdate = (experience: number, level: number) => {
    setPlayerExperience(experience);
    setPlayerLevel(level);
    
    // Update skill points when level changes
    if (level > playerLevel) {
      updateSkillPointsForLevel(level);
    }
  };

  // Initialize tempSelectedWeapons and weapon positions when selectedWeapons changes
  useEffect(() => {
    if (selectedWeapons) {
      const weapons = [selectedWeapons.primary, selectedWeapons.secondary];
      setTempSelectedWeapons(weapons);

      // Set up weapon positions
      const positions: { [key: string]: 'primary' | 'secondary' } = {};
      positions[selectedWeapons.primary] = 'primary';
      positions[selectedWeapons.secondary] = 'secondary';
      setWeaponPositions(positions);
    }
  }, [selectedWeapons]);

  // Auto-confirm selection when exactly 2 weapons are selected
  useEffect(() => {
    if (tempSelectedWeapons.length === 2) {
      // Find primary and secondary based on weapon positions
      const primaryWeapon = tempSelectedWeapons.find(w => weaponPositions[w] === 'primary');
      const secondaryWeapon = tempSelectedWeapons.find(w => weaponPositions[w] === 'secondary');

      if (primaryWeapon && secondaryWeapon) {
        // Only update if the weapons have actually changed
        if (!selectedWeapons ||
            selectedWeapons.primary !== primaryWeapon ||
            selectedWeapons.secondary !== secondaryWeapon) {
          setSelectedWeapons({
            primary: primaryWeapon,
            secondary: secondaryWeapon
          });
        }
      }
    }
  }, [tempSelectedWeapons, weaponPositions]);

  // Clear weapon positions when no weapons are selected
  useEffect(() => {
    if (tempSelectedWeapons.length === 0) {
      setWeaponPositions({});
    }
  }, [tempSelectedWeapons]);

  return (
    <MultiplayerProvider>
      <main className="w-full h-screen bg-black relative">
        {/* Main Menu */}
        {gameMode === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-gray-900/95 p-8 rounded-xl border-2 border-blue-500 text-white max-w-5xl w-11/12 my-6">
              <h1 className="text-xl font-bold mb-1 text-blue-400 text-center"> SELECT 2 WEAPONS</h1>

              {/* Weapon Selection Section */}
              <div className="mb-6">
                <h2 className="text-sm font-normal mb-2 text-center text-blue-400">
                  Primary Weapon becomes the '1' key | Secondary Weapon becomes the '2' key
                </h2>


                <div className="flex flex-wrap justify-center gap-3 mb-4">
                  {weapons.slice(0, 5).map((weapon) => {
                    const isSelected = tempSelectedWeapons.includes(weapon.type);
                    const canSelect = !isSelected && tempSelectedWeapons.length < 2;
                    const colorScheme = getWeaponColorScheme(weapon.type);

                    return (
                      <div
                        key={weapon.type}
                        onClick={() => handleWeaponToggle(weapon.type)}
                        className={`
                          w-full sm:w-72 md:w-64 lg:w-72 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300
                          ${isSelected
                            ? `${colorScheme.border} ${colorScheme.background} shadow-lg ${colorScheme.shadow}`
                            : canSelect
                              ? 'border-gray-600 bg-gray-800/50 hover:border-gray-400 hover:bg-gray-700/50'
                              : 'border-gray-700 bg-gray-900/50 opacity-60 cursor-not-allowed'
                          }
                        `}
                      >
                        <div className="text-center mb-2">
                          <div className="text-2xl mb-1">{weapon.icon}</div>
                          <h3 className="text-base font-bold mb-1">{weapon.name}</h3>
                        </div>

                        <p className="text-xs text-gray-300 mb-2 text-center">
                          {weapon.description}
                        </p>

                        {/* Weapon Abilities */}
                        <div className="mb-2">
                          <div className="text-xs text-gray-400 text-center mb-1">Abilities:</div>
                          <div className="flex justify-center gap-1">
                            {weaponAbilities[weapon.type]?.map((ability) => (
                              <div
                                key={ability.key}
                                className="relative w-7 h-7 rounded border border-gray-600 bg-gray-800 hover:bg-gray-700 transition-colors cursor-pointer flex items-center justify-center"
                                onMouseEnter={(e) => handleAbilityHover(e, ability)}
                                onMouseLeave={handleAbilityLeave}
                              >
                                {/* Hotkey indicator */}
                                <div className="absolute -top-1 -left-1 bg-gray-900 border border-gray-500 rounded text-xs text-white px-0.5 font-semibold leading-none text-[9px]">
                                  {ability.key}
                                </div>
                                
                                {/* Ability icon */}
                                <div className="text-xs">
                                  {getAbilityIcon(weapon.type, ability.key)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="text-center">
                            <span className={`inline-block px-1.5 py-0.5 ${colorScheme.badge} text-white text-xs rounded-full`}>
                              Selected ({getWeaponPosition(weapon.type) === 'primary' ? 'Primary' : 'Secondary'})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Game Mode Buttons */}
              <div className="flex flex-col gap-3 items-center">
                <button
                  className={`px-6 py-2.5 text-lg text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:-translate-y-1 w-1/2.5 ${
                    selectedWeapons
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-gray-600 cursor-not-allowed'
                  }`}
                  onClick={() => {
                    if (selectedWeapons) {
                      setRoomJoinMode('pvp');
                      setShowRoomJoin(true);
                    }
                  }}
                  disabled={!selectedWeapons}
                >
                  ENTER AVERNUS
                  {!selectedWeapons && ' (Select Weapons First)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Room Join UI */}
        {showRoomJoin && selectedWeapons && (
          <RoomJoin
            onJoinSuccess={() => {
              setShowRoomJoin(false);
              setGameMode(roomJoinMode);
            }}
            onBack={() => {
              setShowRoomJoin(false);
            }}
            currentWeapon={selectedWeapons.primary}
            currentSubclass={gameState.currentSubclass}
            gameMode={roomJoinMode}
          />
        )}

        <Canvas
          camera={{ 
            position: [0, 5, 10], 
            fov: 75,
            near: 0.1,
            far: 1000 
          }}
          shadows
          gl={{ 
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
          }}
        >


          {gameMode === 'pvp' && (
            <PVPGameScene
              onDamageNumbersUpdate={setDamageNumbers}
              onDamageNumberComplete={handleDamageNumberComplete}
              onCameraUpdate={handleCameraUpdate}
              onGameStateUpdate={handleGameStateUpdate}
              onControlSystemUpdate={handleControlSystemUpdate}
              onExperienceUpdate={handleExperienceUpdate}
              selectedWeapons={selectedWeapons}
            />
          )}
        </Canvas>
      
        {/* UI Overlay - Only show during gameplay */}
        {gameMode !== 'menu' && (
          <>
            <div className="absolute top-4 left-4 text-white font-mono text-sm">
              <div>WASD - Double Tap Dash</div>
              <div>Right Click - Camera </div>
              <div>Left Click - Attack </div>
              <div>Space - Jump</div>
            </div>
            
            {/* Performance Stats */}
            <div className="absolute top-4 right-4 text-white font-mono text-sm">
              <div id="fps-counter">FPS: --</div>

              {gameMode === 'pvp' && (
                <div className="mt-2 text-red-400">
                  <div>PVP Mode</div>
                </div>
              )}
            </div>
            
            {/* Damage Numbers Display - Outside Canvas */}
            {damageNumbers.length > 0 && cameraInfo.camera && cameraInfo.size && (
              <div className="absolute inset-0 pointer-events-none">
                <DamageNumbers
                  damageNumbers={damageNumbers}
                  onDamageNumberComplete={handleDamageNumberComplete}
                  camera={cameraInfo.camera}
                  size={cameraInfo.size}
                />
              </div>
            )}
            
            {/* Game UI - Outside Canvas */}
            <div className="absolute bottom-4 left-4">
              <GameUI
                currentWeapon={controlSystem?.getCurrentWeapon() || selectedWeapons?.primary || gameState.currentWeapon}
                playerHealth={gameState.playerHealth}
                maxHealth={gameState.maxHealth}
                playerShield={gameState.playerShield}
                maxShield={gameState.maxShield}
                mana={gameState.mana || 150}
                maxMana={gameState.maxMana || 150}
                level={playerLevel}
                controlSystem={controlSystem}
                selectedWeapons={selectedWeapons}
                onWeaponSwitch={(slot) => {
                  if (controlSystem?.switchWeaponBySlot) {
                    controlSystem.switchWeaponBySlot(slot);
                  }
                }}
                skillPointData={skillPointData}
                onUnlockAbility={unlockAbility}
                criticalRuneCount={getGlobalRuneCounts().criticalRunes}
                critDamageRuneCount={getGlobalRuneCounts().critDamageRunes}
                criticalChance={getCriticalChance()}
                criticalDamageMultiplier={getCriticalDamageMultiplier()}
              />
            </div>

            {/* Experience Bar - Only show in PVP mode */}
            {gameMode === 'pvp' && (
              <ExperienceBar
                experience={playerExperience}
                level={playerLevel}
                isLocalPlayer={true}
              />
            )}
          </>
        )}

        {/* Ability Tooltip - Show during weapon selection */}
        {gameMode === 'menu' && tooltipContent && (
          <AbilityTooltip 
            content={tooltipContent}
            visible={true}
            x={tooltipPosition.x}
            y={tooltipPosition.y}
          />
        )}

      </main>
    </MultiplayerProvider>
  );
}

export default function Home() {
  return (
    <MultiplayerProvider>
      <HomeContent />
    </MultiplayerProvider>
  );
}
