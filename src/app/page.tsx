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
import EssenceDisplay from '../components/ui/EssenceDisplay';
import { MultiplayerProvider, useMultiplayer } from '../contexts/MultiplayerContext';
import RoomJoin from '../components/ui/RoomJoin';
import MerchantUI from '../components/ui/MerchantUI';
import { weaponAbilities, getAbilityIcon, type AbilityData } from '../utils/weaponAbilities';

// Extend Window interface to include audioSystem
declare global {
  interface Window {
    audioSystem?: any;
  }
}

// Dynamic imports for maximum code splitting
const Canvas = dynamic(() => import('@react-three/fiber').then(mod => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen text-white">Loading 3D engine...</div>
});


// Lazy load PVP game scene
const CoopGameScene = dynamic(() => import('../components/CoopGameScene').then(mod => ({ default: mod.CoopGameScene })), {
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
      <div className="font-semibold text-yellow-300 mb-1">{content.name}</div>
      {content.cooldown !== undefined && (
        <div className="text-yellow-400 text-xs mb-1">Cooldown: {content.cooldown}s</div>
      )}
      <div className="text-gray-300">{content.description}</div>
    </div>
  );
}

function HomeContent() {
  const { selectedWeapons, setSelectedWeapons, skillPointData, unlockAbility, updateSkillPointsForLevel, purchaseItem, players, socket } = useMultiplayer();

  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [cameraInfo, setCameraInfo] = useState<{
    camera: Camera | null;
    size: { width: number; height: number };
  }>({
    camera: null,
    size: { width: 0, height: 0 }
  });
  const [localPurchasedItems, setLocalPurchasedItems] = useState<string[]>([]);
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
      case WeaponType.BOW:
        return WeaponSubclass.ELEMENTAL;
      case WeaponType.SCYTHE:
        return WeaponSubclass.CHAOS;
      case WeaponType.SABRES:
        return WeaponSubclass.FROST;
      case WeaponType.RUNEBLADE:
        return WeaponSubclass.ARCANE;
      case WeaponType.SPEAR:
        return WeaponSubclass.STORM;
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
  const [gameMode, setGameMode] = useState<'menu' | 'singleplayer' | 'multiplayer' | 'pvp' | 'coop'>('menu');
  const [showRoomJoin, setShowRoomJoin] = useState(false);
  const [roomJoinMode, setRoomJoinMode] = useState<'multiplayer' | 'pvp' | 'coop'>('multiplayer');
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerEssence, setPlayerEssence] = useState(50); // Start with 50 essence
  const [showMerchantUI, setShowMerchantUI] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);

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
      case WeaponType.SCYTHE:
        return {
          border: 'border-purple-500',
          background: 'bg-purple-500/20',
          shadow: 'shadow-purple-500/30',
          badge: 'bg-purple-600'
        };
      case WeaponType.RUNEBLADE:
        return {
          border: 'border-sky-400',
          background: 'bg-sky-400/20',
          shadow: 'shadow-sky-400/30',
          badge: 'bg-sky-500'
        };
      case WeaponType.SABRES:
        return {
          border: 'border-red-500',
          background: 'bg-red-500/20',
          shadow: 'shadow-red-500/30',
          badge: 'bg-red-600'
        };
      case WeaponType.SPEAR:
        return {
          border: 'border-gray-400',
          background: 'bg-gray-400/20',
          shadow: 'shadow-gray-400/30',
          badge: 'bg-gray-500'
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
      type: WeaponType.RUNEBLADE,
      name: 'Runeblade',
      icon: '⚜️',
      description: 'TEMPLAR',
      defaultSubclass: WeaponSubclass.ARCANE
    },
    {
      type: WeaponType.SCYTHE,
      name: 'Scythe',
      icon: '🦋',
      description: 'WEAVER',
      defaultSubclass: WeaponSubclass.CHAOS
    },
    {
      type: WeaponType.SABRES,
      name: 'Sabres',
      icon: '⚔️',
      description: 'ASSASSIN',
      defaultSubclass: WeaponSubclass.FROST
    },
    {
      type: WeaponType.BOW,
      name: 'Bow',
      icon: '🏹',
      description: 'VIPER',
      defaultSubclass: WeaponSubclass.ELEMENTAL
    },
    {
      type: WeaponType.SPEAR,
      name: 'Spear',
      icon: '🔱',
      description: 'IMMORTAL',
      defaultSubclass: WeaponSubclass.STORM
    }
  ];

  const handleWeaponToggle = (weaponType: WeaponType) => {
    // Play selection sound when weapon is clicked
    if (window.audioSystem) {
      window.audioSystem.playUISelectionSound();
    }

    const isSelected = tempSelectedWeapons.includes(weaponType);

    if (isSelected) {
      // Remove weapon if already selected
      setTempSelectedWeapons([]);
      setWeaponPositions({});
    } else {
      // Select this weapon (only allow 1 weapon)
      setTempSelectedWeapons([weaponType]);
      setWeaponPositions({ [weaponType]: 'primary' });
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
    // Check if this is a level up before updating state
    const isLevelUp = level > playerLevel;

    setPlayerExperience(experience);
    setPlayerLevel(level);

    // Update skill points when level changes
    if (isLevelUp) {
      updateSkillPointsForLevel(level);
    }
  };

  const handleEssenceUpdate = (essence: number) => {
    setPlayerEssence(essence);
  };

  // Initialize tempSelectedWeapons and weapon positions when selectedWeapons changes
  useEffect(() => {
    if (selectedWeapons) {
      const weapons = [selectedWeapons.primary]; // Only use primary weapon
      setTempSelectedWeapons(weapons);

      // Set up weapon positions
      const positions: { [key: string]: 'primary' | 'secondary' } = {};
      positions[selectedWeapons.primary] = 'primary';
      setWeaponPositions(positions);
    }
  }, [selectedWeapons]);

  // Auto-confirm selection when exactly 1 weapon is selected
  useEffect(() => {
    if (tempSelectedWeapons.length === 1) {
      const selectedWeapon = tempSelectedWeapons[0];

      // Only update if the weapon has actually changed
      if (!selectedWeapons ||
          selectedWeapons.primary !== selectedWeapon) {
        setSelectedWeapons({
          primary: selectedWeapon,
          secondary: selectedWeapon // Use same weapon for secondary for compatibility
        });
      }
    }
  }, [tempSelectedWeapons]);

  // Clear weapon positions when no weapons are selected
  useEffect(() => {
    if (tempSelectedWeapons.length === 0) {
      setWeaponPositions({});
    }
  }, [tempSelectedWeapons]);

  // Sync localPurchasedItems with multiplayer context player data
  useEffect(() => {
    if (players.size > 0) {
      // Find the local player (either by socket ID or first player if in single-player mode)
      let localPlayer = players.get(socket?.id || '');
      if (!localPlayer) {
        // If no player found by socket ID, try to find any player (for cases where socket isn't connected)
        const allPlayers = Array.from(players.values());
        localPlayer = allPlayers.find(p => p.id) || undefined;
      }

      if (localPlayer?.purchasedItems) {
        setLocalPurchasedItems(localPlayer.purchasedItems);
      }
    }
  }, [players, socket?.id]);

  // Initialize audio system for UI sounds
  useEffect(() => {
    const initAudioSystem = async () => {
      try {
        const { AudioSystem } = await import('../systems/AudioSystem');
        const audioSystem = new AudioSystem();
        (window as any).audioSystem = audioSystem;

        // Only preload weapon sounds (fast loading)
        await audioSystem.preloadWeaponSounds();

        // Lazy load background music in the background (doesn't block UI)
        audioSystem.preloadBackgroundMusic().then(() => {
          // Start background music once loaded (35% volume for subtle background)
          audioSystem.startBackgroundMusic();
        }).catch((error) => {
          console.warn('Background music failed to load:', error);
        });

      } catch (error) {
        console.warn('Failed to initialize audio system:', error);
      }
    };

    initAudioSystem();
  }, []);

  return (
    <MultiplayerProvider>
      <main className="w-full h-screen bg-black relative">
        {/* Main Menu */}
        {gameMode === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-gray-900/95 p-8 rounded-xl border-2 border-green-500 text-white max-w-5xl w-11/12 my-6 relative">
              <button
                onClick={() => setShowRulesPanel(true)}
                className="absolute top-4 right-4 text-2xl hover:scale-110 transition-transform cursor-pointer text-yellow-400 hover:text-yellow-300"
                title="Rulebook"
              >
                📜
              </button>
              <h1 className="text-xl font-bold mb-2 text-green-400 text-center"> EREBUS </h1>

              {/* Weapon Selection Section */}
              <div className="mb-6">
     


                <div className="flex flex-col gap-3 mb-4 max-w-4xl mx-auto">
                  {/* First row - 3 weapons */}
                  <div className="grid grid-cols-3 gap-3">
                    {weapons.slice(0, 3).map((weapon) => {
                      const isSelected = tempSelectedWeapons.includes(weapon.type);
                      const canSelect = !isSelected && tempSelectedWeapons.length < 1;
                      const colorScheme = getWeaponColorScheme(weapon.type);

                      return (
                        <div
                          key={weapon.type}
                          onClick={() => handleWeaponToggle(weapon.type)}
                          className={`
                            w-full p-3 rounded-lg border-2 cursor-pointer transition-all duration-300
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
                              {weaponAbilities[weapon.type]?.filter(ability => ability.key !== 'P').map((ability) => (
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
                                Selected
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Second row - 2 weapons centered */}
                  <div className="flex justify-center gap-3">
                    {weapons.slice(3, 5).map((weapon) => {
                      const isSelected = tempSelectedWeapons.includes(weapon.type);
                      const canSelect = !isSelected && tempSelectedWeapons.length < 1;
                      const colorScheme = getWeaponColorScheme(weapon.type);

                      return (
                        <div
                          key={weapon.type}
                          onClick={() => handleWeaponToggle(weapon.type)}
                          className={`
                            w-64 p-3 rounded-lg border-2 cursor-pointer transition-all duration-300
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
                              {weaponAbilities[weapon.type]?.filter(ability => ability.key !== 'P').map((ability) => (
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
                                Selected
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
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
                    // Play interface sound
                    if (window.audioSystem) {
                      window.audioSystem.playUIInterfaceSound();
                    }

                    if (selectedWeapons) {
                      setRoomJoinMode('coop');
                      setShowRoomJoin(true);
                    }
                  }}
                  disabled={!selectedWeapons}
                >
                  ENTER
                  {!selectedWeapons && ' (Select Weapons First)'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules Panel */}
        {showRulesPanel && (
          <div
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowRulesPanel(false)}
          >
            <div
              className="bg-gray-900 border-2 border-green-400 rounded-xl p-8 max-w-2xl w-11/12 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-yellow-400 mb-2">📜 RULEBOOK</h2>
              </div>

              <div className="text-white space-y-4">
                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">🎯 OVERVIEW</h3>
                  <p className="text-gray-300">
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Each player has a Tower and 3 Inhibitors.</li>
                    <li>• Each player's Tower summons 3 Units every 45 seconds.</li>
                    <li>• Player kills and Summoned Unit kills award experience points.</li>
                    <li>• Leveling up grants a Skill Point to unlock additional abilities.</li>
                    <li>• Players respawn upon 10 seconds after death.</li>
                    <li>• Only Summoned Units can damage the opposing player's Tower.</li>
                    <li>• Players can destroy the opposing player's Inhibitors to upgrade their Summoned Units into ELITES.</li>
                    <li>• The first player to destroy the opposing player's Tower wins.</li>
                  </ul>
                  </p>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">⚔️ WEAPON SYSTEM</h3>
                  <p className="text-gray-300 mb-2">
                    Choose 1 weapon to equip. All abilities for your chosen weapon are unlocked by default. Each weapon has unique abilities and playstyles:
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• <strong className="text-green-400">Bow (VIPER) Ranged sniper with burst, harass and long-range siege potential</strong>:</li>
                    <li>• <strong className="text-yellow-400">Scythe (WEAVER) Mana-based caster with offensive and defensive fire and ice spells</strong>:</li>
                    <li>• <strong className="text-sky-400">Runeblade (TEMPLAR) Mana-based knight with life-stealing, area control and debuff abilities</strong>: </li>
                    <li>• <strong className="text-red-400">Sabres (ASSASSIN) Stealth-based close-quarters specialist with high-risk, high-reward damage</strong>:</li>
                  </ul>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">🎮 CONTROLS</h3>
                  <ul className="text-gray-300 text-sm space-y-1">
                    <li>• <strong>WASD</strong>: Movement (Double-tap to dash)</li>
                    <li>• <strong>Left Click</strong>: Attack</li>
                    <li>• <strong>Right Click</strong>: Camera control</li>
                    <li>• <strong>Space</strong>: Jump</li>
                    <li>• <strong>1/2</strong>: Switch between primary/secondary weapons</li>
                    <li>• <strong>Q/E/R/F</strong>: Weapon abilities (hover over abilities to see details)</li>
                  </ul>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">🏆 OBJECTIVE</h3>
                  <p className="text-gray-300 mb-2">
                    Level up by killing enemy Players and their Summoned Units. Unlock skill points to enhance your abilities.
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4">
                    <li>• Defend your Tower from the enemy player's Summoned Units</li>
                    <li>• Defend your Inhibitors from the enemy Player</li>
                    <li>• Use your Summoned Units to damage the enemy Player's Tower</li>
                    <li>• Destroy the enemy Player's Inhibitors to upgrade your Summoned Units into ELITES</li>
                    <li>• Level up to gain combat bonuses and to invest Skill Points into additional weapon abilities</li>
                    <li>• Destroy the enemy Player's Tower to win the game</li>
                  </ul>
                </div>

              
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


          {(gameMode === 'pvp' || gameMode === 'coop') && (
            <CoopGameScene
              onDamageNumbersUpdate={setDamageNumbers}
              onDamageNumberComplete={handleDamageNumberComplete}
              onCameraUpdate={handleCameraUpdate}
              onGameStateUpdate={handleGameStateUpdate}
              onControlSystemUpdate={handleControlSystemUpdate}
              onExperienceUpdate={handleExperienceUpdate}
              onEssenceUpdate={handleEssenceUpdate}
              onMerchantUIUpdate={setShowMerchantUI}
              selectedWeapons={selectedWeapons}
              skillPointData={skillPointData}
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
                key={`gameui-${localPurchasedItems.length}-${localPurchasedItems.join(',')}`}
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
                purchasedItems={localPurchasedItems}
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

            {/* Essence Display - Only show in PVP mode */}
            {gameMode === 'pvp' && (
              <EssenceDisplay
                essence={playerEssence}
                isLocalPlayer={true}
              />
            )}

            {/* Merchant UI - Only show in PVP mode */}
            {gameMode === 'pvp' && (
              <MerchantUI
                isVisible={showMerchantUI}
                onClose={() => setShowMerchantUI(false)}
                onPurchase={(itemId) => {
                  // Find the item details
                  const MERCHANT_ITEMS = [
                    {
                      id: 'damage_boost',
                      name: 'Damage Boost',
                      description: 'Permanently increases your weapon damage by 15%',
                      cost: 75,
                      currency: 'essence' as const
                    },
                    {
                      id: 'ascendant_wings',
                      name: 'Ascendant Wings',
                      description: 'Beautiful angelic wings that replace your dragon wings with a celestial appearance',
                      cost: 50,
                      currency: 'essence' as const
                    }
                  ];

                  const item = MERCHANT_ITEMS.find(item => item.id === itemId);
                  if (item) {
                    const success = purchaseItem(item.id, item.cost, item.currency);
                    if (success) {
                      // Update local state for immediate UI feedback
                      setLocalPurchasedItems(prev => {
                        if (!prev.includes(item.id)) {
                          return [...prev, item.id];
                        }
                        return prev;
                      });
                    }
                  }
                }}
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
