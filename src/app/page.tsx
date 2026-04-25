'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import AbilitySelectionModal from '../components/ui/AbilitySelectionModal';
import TalentSelectionModal from '../components/ui/TalentSelectionModal';
import CoopBoonPickerModal from '../components/ui/CoopBoonPickerModal';
import {
  TALENT_BLADE_RUSH,
  applyTalentIdToLoadout,
  buildClassBoonPoolForWeapon,
  buildRoomBoonPoolForColor,
  pickRandomDistinctFromPool,
  writeBladeRushBoonMetaUnlocked,
} from '../utils/talents';
import type { TalentId } from '../utils/talents';

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

const DEV_TALENT_MODAL =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV_TALENT_MODAL === '1';

function HomeContent() {
  const {
    selectedWeapons,
    abilityLoadout,
    setAbilityLoadout,
    talentLoadout,
    setTalentLoadout,
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
    coopTransitionOverlay,
    combatArenaActive,
    coopMainArenaIntermissionSeq,
    coopMainArenaPortalPhase,
    campTypes,
    coopClearedRoomColor,
    clearCoopClearedRoomColor,
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
    currentWeapon: WeaponType.NONE,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    mana: 150,
    maxMana: 150
  });

  // Helper function to get default subclass for a weapon
  const getDefaultSubclassForWeapon = (weapon: WeaponType): WeaponSubclass => {
    switch (weapon) {
      case WeaponType.NONE:
        return WeaponSubclass.ELEMENTAL;
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
  const [throneAbilityWeapon, setThroneAbilityWeapon] = useState<WeaponType | null>(null);
  const [throneTalentWeapon, setThroneTalentWeapon] = useState<WeaponType | null>(null);
  const [coopBoon, setCoopBoon] = useState<{
    kind: 'class' | 'room';
    options: TalentId[];
  } | null>(null);
  const classBoonPickedThisRunRef = useRef(false);
  const roomBoonIntermissionDoneSeqRef = useRef(-1);

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

  // First wave cleared → 3 room-color boons (co-op main-arena intermission, wave 2 pick).
  useEffect(() => {
    if (gameMode !== 'coop') return;
    if (coopMainArenaPortalPhase !== 'pick_wave2') return;
    if (roomBoonIntermissionDoneSeqRef.current === coopMainArenaIntermissionSeq) return;

    const color = coopClearedRoomColor ?? campTypes[0] ?? null;
    const pool = buildRoomBoonPoolForColor(color, selectedWeapons.primary);
    const options = pickRandomDistinctFromPool(pool, 3);
    roomBoonIntermissionDoneSeqRef.current = coopMainArenaIntermissionSeq;
    if (options.length === 0) return;
    setCoopBoon({ kind: 'room', options });
  }, [
    gameMode,
    coopMainArenaIntermissionSeq,
    coopMainArenaPortalPhase,
    coopClearedRoomColor,
    campTypes,
    selectedWeapons.primary,
  ]);

  const handleThroneWeaponEquipped = useCallback(
    (weapon: WeaponType) => {
      if (combatArenaActive) return;
      if (classBoonPickedThisRunRef.current) return;
      const pool = buildClassBoonPoolForWeapon(weapon);
      if (pool.length === 0) return;
      const options = pickRandomDistinctFromPool(pool, 3);
      if (options.length === 0) return;
      setCoopBoon({ kind: 'class', options });
    },
    [combatArenaActive],
  );

  const handleCoopBoonPick = useCallback(
    (id: TalentId, kind: 'class' | 'room') => {
      setTalentLoadout((prev) => applyTalentIdToLoadout(prev, id));
      if (id === TALENT_BLADE_RUSH) writeBladeRushBoonMetaUnlocked(true);
      if (kind === 'room') clearCoopClearedRoomColor();
      if (kind === 'class') classBoonPickedThisRunRef.current = true;
      setCoopBoon(null);
    },
    [clearCoopClearedRoomColor, setTalentLoadout],
  );

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
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">Co-op run (roguelike flow)</h3>
                  <p className="text-gray-300 text-sm mb-2">
                    You start in the <strong className="text-green-400">throne room</strong>: pick a weapon, shape your ability bar, then enter the arena. Combat is room- and wave-based; between beats you choose where to go next. Boons you pick <strong>stack</strong> for the rest of the run (Hades-style).
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc">
                    <li>Stand by a floating weapon and press <strong className="text-green-400">X</strong> to equip it (resets default Q/E/R for that weapon).</li>
                    <li>Use the east <strong>ability pillar</strong> with <strong className="text-green-400">X</strong> to assign Q, E, and R from the shared pool.</li>
                    <li>When a <strong>class boon</strong> modal appears, pick 1 of 3 random talents for your <strong>current weapon</strong> (once per run after that weapon is equipped).</li>
                    <li>After you <strong>clear the first combat room</strong>, a <strong>room boon</strong> offers 3 picks from a pool determined by <strong>that room&apos;s color</strong> (blue / green / purple / red). Weapon matters: Runeblade, Bow, and Scythe see different room pools.</li>
                    <li>Use rim <strong>portals</strong> to leave prep or, in the arena, to choose the next challenge when prompted.</li>
                  </ul>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">Boons at a glance</h3>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc">
                    <li><strong className="text-sky-300">Runeblade</strong>: class pool includes Trinity, Vengeance, Crusader, Windfury, Blizzard, Blade Rush or Stored Charge (after meta unlock), Double Strike, Spellblade, and more by weapon.</li>
                    <li><strong className="text-green-300">Bow</strong>: class pool includes Execute, Explosive Talons, Concentrated Volley, Dual Coil, Tempest Rounds. Room colors gate talents like Stagger Shot, Wrathful Bite/Talons, Wyvern Sting/Bite.</li>
                    <li><strong className="text-purple-300">Scythe</strong>: class pool includes Frostpath, Icebeam, Solar Recharge, Reaper. Red rooms can offer Inferno; other colors may offer no room boon yet.</li>
                    <li><strong>Tempest Rounds</strong> (Bow) and <strong>Icebeam</strong> (Scythe) are <strong>talents / boons</strong>, not passives on the ability picker.</li>
                  </ul>

                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">Weapons</h3>
                  <p className="text-gray-300 text-sm mb-2">
                    Each weapon has a distinct fantasy and boon lists; abilities are chosen at the prep pillar, not only via leveling.
                  </p>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc">
                    <li><strong className="text-green-400">Bow</strong> — Ranged pressure, crit scaling, Barrage and Talons lines.</li>
                    <li><strong className="text-purple-400">Scythe</strong> — Entropic Bolt, Crossentropy, heals and control.</li>
                    <li><strong className="text-sky-400">Runeblade</strong> — Combo, Smite, stagger and guard talents.</li>
                    <li><strong className="text-red-400">Sabres</strong> — Assassin melee (where enabled).</li>
                  </ul>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">Controls</h3>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc">
                    <li><strong>WASD</strong> — Move (double-tap to dash).</li>
                    <li><strong>Left click</strong> — Primary attack.</li>
                    <li><strong>Right click</strong> — Camera.</li>
                    <li><strong>Space</strong> — Jump.</li>
                    <li><strong>Q / E / R / F</strong> — Abilities (loadout-dependent).</li>
                    <li><strong>X</strong> — Throne prep: nearest interact (weapon swap, ability pillar, or talent pillar by proximity).</li>
                    <li><strong>1 / 2</strong> — Swap primary/secondary weapon when slots differ (non-throne contexts).</li>
                  </ul>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">Progression and survival</h3>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc">
                    <li>Kills and objectives still feed <strong>experience</strong>; levels can unlock <strong>skill points</strong> for extra abilities where that system applies.</li>
                    <li><strong>Shield</strong> recovers between fights; <strong>health</strong> is precious — use boons and positioning.</li>
                    <li>Room difficulty and portal choices shape what you face next; read boon text before you commit.</li>
                  </ul>
                </div>

                <div className="pb-2">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">PVP (other mode)</h3>
                  <p className="text-gray-300 text-sm">
                    In PVP, the classic MOBA loop still applies: towers, inhibitors, summoned units, essence and merchant upgrades. Co-op runs above are separate from that structure.
                  </p>
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
                throneAbilityModalOpen={
                  throneAbilityWeapon !== null || throneTalentWeapon !== null || coopBoon !== null
                }
                onRequestThroneAbilityModal={(weapon) => {
                  setThroneTalentWeapon(null);
                  setThroneAbilityWeapon(weapon);
                }}
                onRequestThroneTalentModal={
                  DEV_TALENT_MODAL
                    ? (weapon) => {
                        setThroneAbilityWeapon(null);
                        setThroneTalentWeapon(weapon);
                      }
                    : undefined
                }
                onThroneWeaponEquipped={handleThroneWeaponEquipped}
                throneDevTalentShortcutEnabled={DEV_TALENT_MODAL}
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
              {gameMode === 'coop' && (
                <div className="text-green-400/90 mt-1">
                  <div>X — Prep interact (weapon / abilities)</div>
                  {DEV_TALENT_MODAL && (
                    <div className="text-amber-400/90">Dev: T — Talent pillar (when in range)</div>
                  )}
                </div>
              )}
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

            {gameMode === 'coop' && throneAbilityWeapon !== null && (
              <AbilitySelectionModal
                key={`throne-ability-${throneAbilityWeapon}`}
                selectedWeapon={throneAbilityWeapon}
                initialLoadout={abilityLoadout}
                onConfirm={(loadout) => {
                  setAbilityLoadout(loadout);
                  setThroneAbilityWeapon(null);
                }}
                onBack={() => setThroneAbilityWeapon(null)}
              />
            )}

            {gameMode === 'coop' && DEV_TALENT_MODAL && throneTalentWeapon !== null && (
              <TalentSelectionModal
                key={`throne-talent-${throneTalentWeapon}`}
                selectedWeapon={throneTalentWeapon}
                abilityLoadout={abilityLoadout}
                initialTalentLoadout={talentLoadout}
                onConfirm={(loadout) => {
                  setTalentLoadout(loadout);
                  setThroneTalentWeapon(null);
                }}
                onBack={() => setThroneTalentWeapon(null)}
              />
            )}

            {gameMode === 'coop' && coopBoon !== null && (
              <CoopBoonPickerModal
                kind={coopBoon.kind}
                weapon={selectedWeapons.primary}
                roomColor={coopBoon.kind === 'room' ? coopClearedRoomColor ?? campTypes[0] : undefined}
                options={coopBoon.options}
                onPick={(id) => handleCoopBoonPick(id, coopBoon.kind)}
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
          isVisible={isGameLoading || coopTransitionOverlay}
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
