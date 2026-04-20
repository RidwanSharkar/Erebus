'use client';

import { useState, useEffect, useRef } from 'react';
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
import MerchantUI from '../components/ui/MerchantUI';
import StatsPanel from '../components/ui/StatsPanel';
import LoadingScreen from '../components/ui/LoadingScreen';

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

/** Prevents double bootstrap in React Strict Mode (ref resets on remount). */
let coopEntryBootstrapStarted = false;

function HomeContent() {
  const {
    selectedWeapons,
    abilityLoadout,
    skillPointData,
    unlockAbility,
    updateSkillPointsForLevel,
    statPointData,
    allocateStatPoint,
    updateStatPointsForLevel: updateStatPointsForLvl,
    purchaseItem,
    players,
    socket,
    skeletonKillCount,
    enemies,
    inventory,
    joinRoom,
    isConnected,
  } = useMultiplayer();

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
      case WeaponType.KNIGHT:
        return WeaponSubclass.DIVINITY;
      default:
        return WeaponSubclass.ELEMENTAL;
    }
  };

  // Update gameState when selectedWeapons changes
  useEffect(() => {
    setGameState(prev => ({
      ...prev,
      currentWeapon: selectedWeapons.primary,
      currentSubclass: getDefaultSubclassForWeapon(selectedWeapons.primary),
    }));
  }, [selectedWeapons]);

  const [controlSystem, setControlSystem] = useState<any>(null);
  const [gameMode, setGameMode] = useState<'menu' | 'singleplayer' | 'multiplayer' | 'pvp' | 'coop'>('menu');
  const [isGameLoading, setIsGameLoading] = useState(true);
  const [showCanvas, setShowCanvas] = useState(false);
  const bootstrapWeaponsRef = useRef(selectedWeapons);
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerEssence, setPlayerEssence] = useState(50); // Start with 50 essence
  const [showMerchantUI, setShowMerchantUI] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);

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

  // Auto-join default co-op room and start (throne-first entry; no weapon menu / room UI).
  useEffect(() => {
    if (!isConnected || !socket || coopEntryBootstrapStarted) return;
    coopEntryBootstrapStarted = true;
    void (async () => {
      try {
        const name = `Player${Math.floor(Math.random() * 10000)}`;
        const sw = bootstrapWeaponsRef.current;
        const joinedRoomId = await joinRoom(
          'default',
          name,
          sw.primary,
          getDefaultSubclassForWeapon(sw.primary),
          'coop',
        );
        socket.emit('start-game', { roomId: joinedRoomId });
        setGameMode('coop');
        setShowCanvas(true);
        setIsGameLoading(true);
      } catch (e) {
        console.error('Failed to bootstrap game:', e);
        coopEntryBootstrapStarted = false;
      }
    })();
  }, [isConnected, socket, joinRoom]);

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

    // Update skill points and stat points when level changes
    if (isLevelUp) {
      updateSkillPointsForLevel(level);
      updateStatPointsForLvl(level);
    }
  };

  const handleEssenceUpdate = (essence: number) => {
    setPlayerEssence(essence);
  };

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
      <main className="w-full h-screen bg-black relative">
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
                    In the throne room, stand near a weapon and press <strong className="text-green-400">X</strong> to equip it. Each weapon has unique abilities and playstyles:
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
                    <li>• <strong>1/2</strong>: Switch between primary/secondary weapons (when both slots differ)</li>
                    <li>• <strong>X</strong>: Equip the weapon at the nearest throne pedestal (prep room)</li>
                    <li>• <strong>Q/E/R/F</strong>: Weapon abilities</li>
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

        {showCanvas && (
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
                onSceneReady={() => setIsGameLoading(false)}
                selectedWeapons={selectedWeapons}
                skillPointData={skillPointData}
                statPointData={statPointData}
                abilityLoadout={abilityLoadout}
              />
            )}
          </Canvas>
        )}
      
        {/* UI Overlay - Only show during gameplay */}
        {gameMode !== 'menu' && (
          <>
            <button
              type="button"
              onClick={() => setShowRulesPanel(true)}
              className="absolute top-4 right-28 z-[100] text-2xl hover:scale-110 transition-transform cursor-pointer text-yellow-400 hover:text-yellow-300"
              title="Rulebook"
            >
              📜
            </button>
            <div className="absolute top-4 left-4 text-white font-mono text-sm">
              <div>WASD - Double Tap Dash</div>
              <div>Right Click - Camera </div>
              <div>Left Click - Attack </div>
              <div>Space - Jump</div>
              {gameMode === 'coop' && <div className="text-green-400/90 mt-1">Throne: X — equip weapon at pedestal</div>}
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
                currentWeapon={controlSystem?.getCurrentWeapon() || selectedWeapons.primary || gameState.currentWeapon}
                playerHealth={gameState.playerHealth}
                maxHealth={gameState.maxHealth}
                playerShield={gameState.playerShield}
                maxShield={gameState.maxShield}
                controlSystem={controlSystem}
                selectedWeapons={selectedWeapons}
                onWeaponSwitch={(slot) => {
                  if (controlSystem?.switchWeaponBySlot) {
                    controlSystem.switchWeaponBySlot(slot);
                  }
                }}
                skillPointData={skillPointData}
                abilityLoadout={abilityLoadout}
                onUnlockAbility={unlockAbility}
                purchasedItems={localPurchasedItems}
                criticalRuneCount={getGlobalRuneCounts().criticalRunes}
                critDamageRuneCount={getGlobalRuneCounts().critDamageRunes}
                criticalChance={getCriticalChance()}
                criticalDamageMultiplier={getCriticalDamageMultiplier()}
              />
            </div>

            {/* Experience Bar - show in PVP and co-op modes */}
            {(gameMode === 'pvp' || gameMode === 'coop') && (
              <ExperienceBar
                experience={playerExperience}
                level={playerLevel}
                isLocalPlayer={true}
                skeletonKillCount={gameMode === 'coop' ? skeletonKillCount : undefined}
                bossSpawned={gameMode === 'coop'
                  ? Array.from(enemies.values()).some(e => e.type === 'boss' && !e.isDying)
                  : undefined}
              />
            )}

            {/* Character Stats & Inventory Panel - bottom left */}
            {(gameMode === 'pvp' || gameMode === 'coop') && (
              <StatsPanel
                statPointData={statPointData}
                onAllocateStat={allocateStatPoint}
                playerLevel={playerLevel}
                inventory={inventory}
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

        {/* Loading Screen - shown until scene ready */}
        <LoadingScreen
          isVisible={isGameLoading}
          onFadeComplete={() => setIsGameLoading(false)}
        />

      </main>
  );
}

export default function Home() {
  return (
    <MultiplayerProvider>
      <HomeContent />
    </MultiplayerProvider>
  );
}
