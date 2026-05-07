'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { WeaponType, WeaponSubclass } from '../components/dragon/weapons';
import { Camera } from '../utils/three-exports';
import type { DamageNumberData } from '../components/DamageNumbers';
import DamageNumbers from '../components/DamageNumbers';
import GameUI from '../components/ui/GameUI';
import StrikeIndicator from '../components/ui/StrikeIndicator';
import PlayerDamageFeedbackOverlay from '../components/ui/PlayerDamageFeedbackOverlay';
import { getGlobalRuneCounts, getCriticalChance, getCriticalDamageMultiplier } from '../core/DamageCalculator';
import ExperienceBar from '../components/ui/ExperienceBar';
import EssenceDisplay from '../components/ui/EssenceDisplay';
import GoldDisplay from '../components/ui/GoldDisplay';
import { MultiplayerProvider, useMultiplayer } from '../contexts/MultiplayerContext';
import type { CoopRoomKind } from '../contexts/MultiplayerContext';
import MerchantUI from '../components/ui/MerchantUI';
import StatsPanel from '../components/ui/StatsPanel';
import LoadingScreen from '../components/ui/LoadingScreen';
import AbilitySelectionModal from '../components/ui/AbilitySelectionModal';
import TalentSelectionModal from '../components/ui/TalentSelectionModal';
import CoopBoonPickerModal from '../components/ui/CoopBoonPickerModal';
import DefeatRetryDialog from '../components/ui/DefeatRetryDialog';
import {
  applyTalentIdToLoadout,
  buildClassBoonPoolForWeapon,
  buildRoomBoonPoolForColor,
  expandBowRoomBoonExclusionsAfterPick,
  expandRoomBoomDashExclusionsAfterPick,
  expandRunebladeRoomBoonExclusionsAfterPick,
  expandSabresBackstabRoomBoonExclusionsAfterPick,
  expandSabresSwipesRoomBoonExclusionsAfterPick,
  expandSabresFlourishRoomBoonExclusionsAfterPick,
  expandScytheCrossentropyExclusionsAfterPick,
  expandScytheEntropicExclusionsAfterPick,
  expandScytheTotemExclusionsAfterPick,
  expandUniversalGreenZombieBoonIdsAfterPick,
  excludeOwnedTalentsFromBoonPool,
  filterTalentIdsByExclusionSet,
  pickRandomDistinctFromPool,
} from '../utils/talents';
import type { TalentId } from '../utils/talents';
import { DpsTracker, type DpsSnapshot } from '../utils/DpsTracker';

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

const COOP_CAMP_COLORS = new Set<string>(['red', 'blue', 'green', 'purple']);

function coopRoomBoonColorFromContext(
  coopClearedRoomColor: string | null,
  coopClearedRoomKind: CoopRoomKind | null,
  campTypes: readonly string[],
): string | null {
  if (coopClearedRoomColor && COOP_CAMP_COLORS.has(coopClearedRoomColor)) {
    return coopClearedRoomColor;
  }
  if (coopClearedRoomKind && COOP_CAMP_COLORS.has(coopClearedRoomKind)) {
    return coopClearedRoomKind;
  }
  const c0 = campTypes[0] != null ? String(campTypes[0]).toLowerCase() : '';
  if (COOP_CAMP_COLORS.has(c0)) return c0;
  return null;
}

function weaponIconSrcForHud(weapon: WeaponType): string | null {
  switch (weapon) {
    case WeaponType.SABRES:
      return '/icons/sabres.svg';
    case WeaponType.RUNEBLADE:
      return '/icons/runeblade.svg';
    case WeaponType.SCYTHE:
      return '/icons/scythe.svg';
    case WeaponType.BOW:
      return '/icons/bow.svg';
    default:
      return null;
  }
}

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
    grantStatPoints,
    updatePlayerGold,
    purchaseItem,
    players,
    socket,
    skeletonKillCount,
    enemies,
    inventory,
    joinRoom,
    currentRoomId,
    isConnected,
    coopTransitionOverlay,
    combatArenaActive,
    gameMode: sessionGameMode,
    gameStarted,
    coopCombatArenaEnterSeq,
    coopMainArenaIntermissionSeq,
    coopBossClearedBgmSeq,
    coopMainArenaPortalPhase,
    campTypes,
    coopClearedRoomColor,
    coopCurrentRoomKind,
    coopClearedRoomKind,
    clearCoopClearedRoomColor,
    confirmCoopPortalTransitionComplete,
    subscribeEnemyDamage,
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
  const dpsTrackerRef = useRef<DpsTracker | null>(null);
  if (dpsTrackerRef.current === null) {
    dpsTrackerRef.current = new DpsTracker();
  }
  const [dpsSnapshot, setDpsSnapshot] = useState<DpsSnapshot>({
    currentDps: 0,
    totalDamage: 0,
    peakDps: 0,
    recentDamage: 0,
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
  const [coopInteractHint, setCoopInteractHint] = useState<string | null>(null);
  const onCoopInteractHintChange = useCallback((hint: string | null) => {
    setCoopInteractHint(hint);
  }, []);

  useEffect(() => {
    const tracker = dpsTrackerRef.current;
    if (!tracker || !socket?.id) return;

    return subscribeEnemyDamage((event) => {
      if (event.fromPlayerId !== socket.id || event.damage <= 0) return;
      tracker.recordDamage(event.damageEventId, event.damage, Date.now());
    });
  }, [socket?.id, subscribeEnemyDamage]);

  useEffect(() => {
    const tracker = dpsTrackerRef.current;
    if (!tracker) return;

    tracker.reset();
    setDpsSnapshot(tracker.getSnapshot());
  }, [currentRoomId, gameStarted, coopCombatArenaEnterSeq]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const tracker = dpsTrackerRef.current;
      if (!tracker) return;
      setDpsSnapshot(tracker.getSnapshot());
    }, 250);

    return () => window.clearInterval(intervalId);
  }, []);

  const handleClearDpsData = useCallback(() => {
    const tracker = dpsTrackerRef.current;
    if (!tracker) return;

    tracker.reset();
    setDpsSnapshot(tracker.getSnapshot());
  }, []);

  const [loadingSceneBootstrapReady, setLoadingSceneBootstrapReady] = useState(false);
  const [isGameLoading, setIsGameLoading] = useState(true);
  const [showCanvas, setShowCanvas] = useState(false);
  // Tracks whether the last LoadingScreen show was driven by a co-op portal transition so
  // onFadeComplete knows to send the server confirmation.
  const pendingCoopTransitionConfirmRef = useRef(false);
  useEffect(() => {
    if (coopTransitionOverlay) {
      pendingCoopTransitionConfirmRef.current = true;
    }
  }, [coopTransitionOverlay]);
  const bootstrapWeaponsRef = useRef(selectedWeapons);
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [playerEssence, setPlayerEssence] = useState(50); // Start with 50 essence
  const [playerGold, setPlayerGold] = useState(0);
  const [showMerchantUI, setShowMerchantUI] = useState(false);
  const [showRulesPanel, setShowRulesPanel] = useState(false);
  const [defeatDialogOpen, setDefeatDialogOpen] = useState(false);
  const defeatDialogRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (defeatDialogRevealTimeoutRef.current !== null) {
        clearTimeout(defeatDialogRevealTimeoutRef.current);
        defeatDialogRevealTimeoutRef.current = null;
      }
    };
  }, []);

  const onLocalPlayerDefeated = useCallback(() => {
    if (defeatDialogRevealTimeoutRef.current !== null) {
      clearTimeout(defeatDialogRevealTimeoutRef.current);
    }
    defeatDialogRevealTimeoutRef.current = setTimeout(() => {
      defeatDialogRevealTimeoutRef.current = null;
      setDefeatDialogOpen(true);
    }, 3000);
  }, []);

  const onLocalPlayerRevived = useCallback(() => {
    if (defeatDialogRevealTimeoutRef.current !== null) {
      clearTimeout(defeatDialogRevealTimeoutRef.current);
      defeatDialogRevealTimeoutRef.current = null;
    }
    setDefeatDialogOpen(false);
  }, []);
  const [throneAbilityWeapon, setThroneAbilityWeapon] = useState<WeaponType | null>(null);
  const [throneTalentWeapon, setThroneTalentWeapon] = useState<WeaponType | null>(null);
  type CoopBoonState =
    | { kind: 'class'; options: TalentId[]; weaponForPick: WeaponType }
    | { kind: 'room'; options: TalentId[] };
  const [coopBoon, setCoopBoon] = useState<CoopBoonState | null>(null);
  /** Class boon completed for primary weapons in throne prep — one trio per weapon, not globally per run session. */
  const classBoonPickedWeaponsRef = useRef<Set<WeaponType>>(new Set());
  const roomBoonIntermissionDoneSeqRef = useRef(-1);
  /** Runeblade colored-room boon mutex: excludes entire combo / strike / smite slot after one pick (per co-op room session). */
  const runebladeRoomBoonExcludedIdsRef = useRef<Set<TalentId>>(new Set());
  /** Scythe Entropic bolt boon mutex (Wrathful / Staggering / Infesting Entropic). */
  const scytheEntropicRoomBoonExcludedIdsRef = useRef<Set<TalentId>>(new Set());
  /** Sabres colored-room mutex: Backstab trio + Swipes trio. */
  const sabresRoomBoonExcludedIdsRef = useRef<Set<TalentId>>(new Set());
  /** Bow colored-room mutex: primary / Q / E branches. */
  const bowRoomBoonExcludedIdsRef = useRef<Set<TalentId>>(new Set());
  /** Universal green zombie room boons — each id excluded after pick for this arena session. */
  const universalGreenZombieRoomBoonExcludedIdsRef = useRef<Set<TalentId>>(new Set());
  /** Weapon-agnostic room-boom dash boons — choosing one excludes the other colored dash boons for this run. */
  const roomBoomDashBoonExcludedIdsRef = useRef<Set<TalentId>>(new Set());
  /** True after the player interacts with the combat pedestal (X), triggering the boon picker. */
  const [pedestalInteracted, setPedestalInteracted] = useState(false);
  /** True after the boon has been picked (or no boon options), unlocking the portals. */
  const [portalsUnlocked, setPortalsUnlocked] = useState(false);
  const lastCoopIntermissionBgmRef = useRef(0);
  const lastCoopEnterBgmRef = useRef(0);
  const lastCoopBossBgmRef = useRef(0);
  /** Guards room-clear finish SFX vs mount / mid-phase sync. */
  const prevCoopMainArenaPortalPhaseRef = useRef<
    typeof coopMainArenaPortalPhase | 'unset'
  >('unset');

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
        setLoadingSceneBootstrapReady(false);
        setIsGameLoading(true);
      } catch (e) {
        console.error('Failed to bootstrap game:', e);
        coopEntryBootstrapStarted = false;
      }
    })();
  }, [isConnected, socket, joinRoom]);

  // Reset pedestal / portal state each time the player enters a new combat arena.
  const lastArenaEnterSeqRef = useRef(-1);
  useEffect(() => {
    if (coopCombatArenaEnterSeq === lastArenaEnterSeqRef.current) return;
    lastArenaEnterSeqRef.current = coopCombatArenaEnterSeq;
    setPedestalInteracted(false);
    setPortalsUnlocked(false);
  }, [coopCombatArenaEnterSeq]);

  useEffect(() => {
    runebladeRoomBoonExcludedIdsRef.current.clear();
    scytheEntropicRoomBoonExcludedIdsRef.current.clear();
    sabresRoomBoonExcludedIdsRef.current.clear();
    bowRoomBoonExcludedIdsRef.current.clear();
    universalGreenZombieRoomBoonExcludedIdsRef.current.clear();
    roomBoomDashBoonExcludedIdsRef.current.clear();
  }, [currentRoomId]);

  /**
   * Called by CoopGameScene when the player presses X near the combat pedestal.
   * Builds and shows the room-boon picker, or immediately unlocks portals if the
   * boon pool is empty.
   */
  const handleCombatArenaPedestalInteract = useCallback((rewardKindFromScene?: string | null) => {
    if (gameMode !== 'coop') return;
    if (roomBoonIntermissionDoneSeqRef.current === coopMainArenaIntermissionSeq) return;

    roomBoonIntermissionDoneSeqRef.current = coopMainArenaIntermissionSeq;
    setPedestalInteracted(true);

    const rewardKind = (rewardKindFromScene ?? coopClearedRoomKind ?? coopCurrentRoomKind) as CoopRoomKind | null;

    if (rewardKind === 'boss') {
      const classPool = excludeOwnedTalentsFromBoonPool(
        buildClassBoonPoolForWeapon(selectedWeapons.primary, talentLoadout),
        talentLoadout,
      );
      const options = pickRandomDistinctFromPool(classPool, 3);
      if (options.length > 0) {
        setCoopBoon({ kind: 'class', options, weaponForPick: selectedWeapons.primary });
        return;
      }
      setPortalsUnlocked(true);
      return;
    }

    if (rewardKind === 'stat') {
      grantStatPoints(5);
      clearCoopClearedRoomColor();
      setPortalsUnlocked(true);
      return;
    }

    if (rewardKind === 'healing') {
      clearCoopClearedRoomColor();
      setPortalsUnlocked(true);
      return;
    }

    if (rewardKind === 'trial') {
      if (socket?.id) updatePlayerGold(socket.id, 100);
      clearCoopClearedRoomColor();
      setPortalsUnlocked(true);
      return;
    }

    if (
      coopMainArenaPortalPhase === 'pick_wave2' ||
      coopMainArenaPortalPhase === 'pick_boss' ||
      coopMainArenaPortalPhase === 'pick_post_boss'
    ) {
      const color = coopRoomBoonColorFromContext(coopClearedRoomColor, coopClearedRoomKind, campTypes);
      const rawPool = buildRoomBoonPoolForColor(color, selectedWeapons.primary);
      let pool = filterTalentIdsByExclusionSet(
        rawPool,
        universalGreenZombieRoomBoonExcludedIdsRef.current,
      );
      pool = filterTalentIdsByExclusionSet(pool, roomBoomDashBoonExcludedIdsRef.current);
      if (selectedWeapons.primary === WeaponType.RUNEBLADE) {
        pool = filterTalentIdsByExclusionSet(pool, runebladeRoomBoonExcludedIdsRef.current);
      } else if (selectedWeapons.primary === WeaponType.SCYTHE) {
        pool = filterTalentIdsByExclusionSet(pool, scytheEntropicRoomBoonExcludedIdsRef.current);
      } else if (selectedWeapons.primary === WeaponType.SABRES) {
        pool = filterTalentIdsByExclusionSet(pool, sabresRoomBoonExcludedIdsRef.current);
      } else if (selectedWeapons.primary === WeaponType.BOW) {
        pool = filterTalentIdsByExclusionSet(pool, bowRoomBoonExcludedIdsRef.current);
      }
      pool = excludeOwnedTalentsFromBoonPool(pool, talentLoadout);
      const options = pickRandomDistinctFromPool(pool, 3);
      if (options.length > 0) {
        setCoopBoon({ kind: 'room', options });
        // portalsUnlocked will be set in handleCoopBoonPick after the player chooses
        return;
      }
    }

    // No boon to show (empty pool or non-boon reward) — unlock portals immediately
    setPortalsUnlocked(true);
  }, [
    gameMode,
    coopMainArenaIntermissionSeq,
    coopMainArenaPortalPhase,
    coopClearedRoomColor,
    coopClearedRoomKind,
    coopCurrentRoomKind,
    campTypes,
    selectedWeapons.primary,
    grantStatPoints,
    updatePlayerGold,
    clearCoopClearedRoomColor,
    talentLoadout,
  ]);

  const handleThroneWeaponEquipped = useCallback(
    (weapon: WeaponType) => {
      if (combatArenaActive) return;
      if (classBoonPickedWeaponsRef.current.has(weapon)) return;
      const pool = excludeOwnedTalentsFromBoonPool(
        buildClassBoonPoolForWeapon(weapon, talentLoadout),
        talentLoadout,
      );
      if (pool.length === 0) return;
      const options = pickRandomDistinctFromPool(pool, 3);
      if (options.length === 0) return;
      setCoopBoon({ kind: 'class', options, weaponForPick: weapon });
    },
    [combatArenaActive, talentLoadout],
  );

  const handleCoopBoonPick = useCallback(
    (id: TalentId, kind: 'class' | 'room', classPickWeapon?: WeaponType) => {
      setTalentLoadout((prev) => applyTalentIdToLoadout(prev, id));
      if (kind === 'room') {
        for (const exId of expandBowRoomBoonExclusionsAfterPick(id)) {
          bowRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandRunebladeRoomBoonExclusionsAfterPick(id)) {
          runebladeRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandScytheEntropicExclusionsAfterPick(id)) {
          scytheEntropicRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandScytheTotemExclusionsAfterPick(id)) {
          scytheEntropicRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandScytheCrossentropyExclusionsAfterPick(id)) {
          scytheEntropicRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandSabresBackstabRoomBoonExclusionsAfterPick(id)) {
          sabresRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandSabresSwipesRoomBoonExclusionsAfterPick(id)) {
          sabresRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandSabresFlourishRoomBoonExclusionsAfterPick(id)) {
          sabresRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandUniversalGreenZombieBoonIdsAfterPick(id)) {
          universalGreenZombieRoomBoonExcludedIdsRef.current.add(exId);
        }
        for (const exId of expandRoomBoomDashExclusionsAfterPick(id)) {
          roomBoomDashBoonExcludedIdsRef.current.add(exId);
        }
        clearCoopClearedRoomColor();
        setPortalsUnlocked(true);
      }
      if (kind === 'class') {
        if (
          classPickWeapon !== undefined &&
          classPickWeapon !== WeaponType.NONE
        ) {
          classBoonPickedWeaponsRef.current.add(classPickWeapon);
        }
        if (coopMainArenaPortalPhase !== null) {
          clearCoopClearedRoomColor();
          setPortalsUnlocked(true);
        }
      }
      setCoopBoon(null);
    },
    [clearCoopClearedRoomColor, coopMainArenaPortalPhase, setTalentLoadout],
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

  const handleGoldUpdate = useCallback((gold: number) => {
    setPlayerGold(gold);
  }, []);

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
        void audioSystem.preloadStartupSounds();
      } catch (error) {
        console.warn('Failed to initialize audio system:', error);
      }
    };

    initAudioSystem();
  }, []);

  // Co-op BGM: silent throne prep, random room tracks in combat, chaos between rooms / after boss
  useEffect(() => {
    const audio = typeof window !== 'undefined' ? window.audioSystem : undefined;
    if (!audio) {
      return;
    }
    if (sessionGameMode !== 'coop') {
      audio.coopSyncNonCoopMode();
      return;
    }
    if (!gameStarted) {
      return;
    }
    if (!combatArenaActive) {
      lastCoopIntermissionBgmRef.current = coopMainArenaIntermissionSeq;
      lastCoopEnterBgmRef.current = coopCombatArenaEnterSeq;
      lastCoopBossBgmRef.current = coopBossClearedBgmSeq;
      audio.coopEnterHubMusic();
      return;
    }
    if (coopMainArenaIntermissionSeq > lastCoopIntermissionBgmRef.current) {
      lastCoopIntermissionBgmRef.current = coopMainArenaIntermissionSeq;
      lastCoopEnterBgmRef.current = coopCombatArenaEnterSeq;
      lastCoopBossBgmRef.current = coopBossClearedBgmSeq;
      audio.coopEnterChaosIntermissionMusic();
    }
    if (coopBossClearedBgmSeq > lastCoopBossBgmRef.current) {
      lastCoopBossBgmRef.current = coopBossClearedBgmSeq;
      lastCoopEnterBgmRef.current = coopCombatArenaEnterSeq;
      lastCoopIntermissionBgmRef.current = coopMainArenaIntermissionSeq;
      audio.coopEnterChaosIntermissionMusic();
    }
    if (coopCombatArenaEnterSeq > lastCoopEnterBgmRef.current) {
      lastCoopEnterBgmRef.current = coopCombatArenaEnterSeq;
      void audio.coopEnterRandomCombatRoomMusic();
    }
  }, [
    sessionGameMode,
    gameStarted,
    combatArenaActive,
    coopMainArenaIntermissionSeq,
    coopCombatArenaEnterSeq,
    coopBossClearedBgmSeq,
  ]);

  // Co-op room clear: portal phase unlocks (pedestal) — plays once per null → phase transition.
  useEffect(() => {
    const audio = typeof window !== 'undefined' ? window.audioSystem : undefined;
    const prev = prevCoopMainArenaPortalPhaseRef.current;

    if (prev === 'unset') {
      prevCoopMainArenaPortalPhaseRef.current = coopMainArenaPortalPhase;
      return;
    }

    if (
      sessionGameMode === 'coop' &&
      gameStarted &&
      combatArenaActive &&
      prev === null &&
      coopMainArenaPortalPhase !== null
    ) {
      audio?.playCoopRoomClearFinish?.();
    }

    prevCoopMainArenaPortalPhaseRef.current = coopMainArenaPortalPhase;
  }, [
    sessionGameMode,
    gameStarted,
    combatArenaActive,
    coopMainArenaPortalPhase,
  ]);

  const dpsWeaponIconSrc = weaponIconSrcForHud(
    controlSystem?.getCurrentWeapon() ?? selectedWeapons.primary ?? gameState.currentWeapon,
  );

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
                    <li>After you <strong>clear the first combat room</strong>, a <strong>room boon</strong> offers 3 picks from a pool determined by <strong>that room&apos;s color</strong> (blue / green / purple / red). Weapon affects most colors; green rooms always add universal zombie boons usable with any weapon.</li>
                    <li>On the <strong>main arena map</strong>, every <strong>third</strong> combat room you clear opens a <strong>boss portal</strong> (Boss 1 → Boss 2 → …; room color does not change that cadence). After a boss, you return to three rooms before the next boss gate.</li>
                    <li>Use rim <strong>portals</strong> to leave prep or, in the arena, to choose the next challenge when prompted.</li>
                  </ul>
                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">Boons at a glance</h3>
                  <ul className="text-gray-300 text-sm space-y-1 ml-4 list-disc">
                    <li><strong className="text-sky-300">Runeblade</strong>: class pool includes Trinity, Vengeance, Crusader, Windfury, Blizzard, Blade Rush, Double Strike, Spellblade, Aftershock, and Stored Charge only after you have Blade Rush this run. Colored <strong>room</strong> boons for your basic combo, Wraith Strike, and Smite are mutually exclusive branches for the rest of that run (one palette per branch); class boons ignore this split.</li>
                    <li><strong className="text-green-300">Bow</strong>: class pool includes Execute, Explosive Talons, Concentrated Volley, Dual Coil, Tempest Rounds. Room colors gate talents like Stagger Shot, Wrathful Bite/Talons, Wyvern Sting/Bite.</li>
                    <li><strong className="text-purple-300">Scythe</strong>: class pool includes Icebeam, Reaper, Frostpath, Solar Recharge, SHAMAN, Superconductor, Accelerator, Healing Stream, Meteor, and Fragmentation. Colored <strong>room</strong> boons: red — Wrathful Entropic &amp; Totem; blue — Staggering Entropic &amp; Totem; green — Infesting Entropic &amp; Totem; purple — Inferno.</li>
                    <li><strong className="text-red-400">Sabres</strong>: class pool includes Killstreak, Relentless, and Vorpal Gust (Backstab). Colored <strong>room</strong> boons still gate Backstab / Swipes / Flourish branches.</li>
                    <li><strong>Tempest Rounds</strong> (Bow) and <strong>Icebeam</strong> (Scythe) are <strong>talents / boons</strong>, not passives on the ability picker.</li>
                  </ul>

                </div>

                <div className="border-b border-gray-600 pb-4">
                  <h3 className="text-lg font-semibold text-yellow-400 mb-2">Weapons</h3>
                  <p className="text-gray-300 text-sm mb-2">
                    Each weapon has a distinct fantasy and boon lists
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
            <Suspense fallback={null}>
              {(gameMode === 'pvp' || gameMode === 'coop') && (
                <CoopGameScene
                  onDamageNumbersUpdate={setDamageNumbers}
                  onDamageNumberComplete={handleDamageNumberComplete}
                  onCameraUpdate={handleCameraUpdate}
                  onGameStateUpdate={handleGameStateUpdate}
                  onControlSystemUpdate={handleControlSystemUpdate}
                  onExperienceUpdate={handleExperienceUpdate}
                  onEssenceUpdate={handleEssenceUpdate}
                  onGoldUpdate={handleGoldUpdate}
                  onMerchantUIUpdate={setShowMerchantUI}
                  onSceneReady={() => {
                    setLoadingSceneBootstrapReady(true);
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => setIsGameLoading(false));
                    });
                  }}
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
                  onRequestThroneTalentModal={(weapon) => {
                    setThroneAbilityWeapon(null);
                    setThroneTalentWeapon(weapon);
                  }}
                  onThroneWeaponEquipped={handleThroneWeaponEquipped}
                  throneDevTalentShortcutEnabled={DEV_TALENT_MODAL}
                  pedestalBoonReady={coopMainArenaPortalPhase !== null && !pedestalInteracted}
                  portalsUnlocked={portalsUnlocked}
                  onCombatArenaPedestalInteract={handleCombatArenaPedestalInteract}
                  onInteractHintChange={onCoopInteractHintChange}
                  onLocalPlayerDefeated={onLocalPlayerDefeated}
                  onLocalPlayerRevived={onLocalPlayerRevived}
                />
              )}
            </Suspense>
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
            <div className="absolute top-4 left-4 flex items-start gap-2 text-white font-mono text-sm pointer-events-none">
              {dpsWeaponIconSrc && (
                <img
                  src={dpsWeaponIconSrc}
                  alt=""
                  className="h-10 w-10 shrink-0 object-contain drop-shadow-[0_0_8px_rgba(251,191,36,0.35)]"
                />
              )}
              <div className="rounded-md bg-black/45 px-3 py-2 shadow-lg backdrop-blur-sm">
                <div className="text-yellow-300 font-semibold">
                  DPS: {Math.round(dpsSnapshot.currentDps).toLocaleString()}
                </div>
                <div className="text-white/80 text-xs">
                  Total: {Math.round(dpsSnapshot.totalDamage).toLocaleString()}
                </div>
                <button
                  type="button"
                  onClick={handleClearDpsData}
                  className="pointer-events-auto mt-2 rounded border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/70 transition-colors hover:border-yellow-300/60 hover:text-yellow-200"
                >
                  Clear
                </button>
              </div>
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

            <StrikeIndicator
              enabled
              camera={cameraInfo.camera}
              size={cameraInfo.size}
            />
            <PlayerDamageFeedbackOverlay />

            <DefeatRetryDialog open={defeatDialogOpen} />

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
                talentLoadout={talentLoadout}
                interactHint={gameMode === 'coop' ? coopInteractHint : null}
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
                  ? Array.from(enemies.values()).some(e => (e.type === 'boss' || e.type === 'boss2' || e.type === 'boss3') && !e.isDying)
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

            {/* GOLD Display - Only show in co-op mode */}
            {gameMode === 'coop' && (
              <GoldDisplay
                gold={playerGold}
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

            {gameMode === 'coop' && throneTalentWeapon !== null && (
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
                roomColor={coopBoon.kind === 'room' ? coopClearedRoomColor ?? campTypes[0] : undefined}
                options={coopBoon.options}
                weapon={
                  coopBoon.kind === 'class'
                    ? coopBoon.weaponForPick
                    : selectedWeapons.primary
                }
                onPick={(id) =>
                  handleCoopBoonPick(
                    id,
                    coopBoon.kind,
                    coopBoon.kind === 'class' ? coopBoon.weaponForPick : undefined,
                  )
                }
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
          sceneBootstrapReady={
            loadingSceneBootstrapReady || Boolean(!isGameLoading && coopTransitionOverlay)
          }
          onFadeComplete={() => {
            setIsGameLoading(false);
            if (pendingCoopTransitionConfirmRef.current) {
              pendingCoopTransitionConfirmRef.current = false;
              confirmCoopPortalTransitionComplete();
            }
          }}
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
