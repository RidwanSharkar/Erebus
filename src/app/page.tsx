'use client';

import { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { WeaponType, WeaponSubclass } from '../components/dragon/weapons';
import { Camera } from '../utils/three-exports';
import { ENABLE_REALTIME_SHADOWS } from '../utils/renderConfig';
import { isDevPerformanceHudEnabled } from '../utils/isDevPerformanceHudEnabled';
import type { DamageNumberData } from '../components/DamageNumbers';
import CombatOverlay, { type CombatOverlayCallbacks } from '../components/ui/CombatOverlay';
import MerchantShopTooltipOverlay from '../components/ui/MerchantShopTooltipOverlay';
import GameUI from '../components/ui/GameUI';
import PlayerStatusHud from '../components/ui/PlayerStatusHud';
import ChatUI from '../components/ui/ChatUI';
import PlayerDamageFeedbackOverlay from '../components/ui/PlayerDamageFeedbackOverlay';
import { getCriticalChance, getCriticalDamageMultiplier } from '../core/DamageCalculator';
import InventoryPanel from '../components/ui/InventoryPanel';
import EssenceDisplay from '../components/ui/EssenceDisplay';
import CurrencyPanel from '../components/ui/CurrencyPanel';
import HudActionButtons from '../components/ui/HudActionButtons';
import RulebookPanel from '../components/ui/RulebookPanel';
import { MultiplayerProvider, useMultiplayerActions, useMultiplayerRoom } from '../contexts/MultiplayerContext';
import type { CoopRoomKind } from '../contexts/MultiplayerContext';
import MerchantUI from '../components/ui/MerchantUI';
import StatsPanel from '../components/ui/StatsPanel';
import DpsMeter from '../components/ui/DpsMeter';
import LoadingScreen from '../components/ui/LoadingScreen';
import PortalBlinkTransition from '../components/ui/PortalBlinkTransition';
import RoomTitleAnnouncement from '../components/ui/RoomTitleAnnouncement';
import ControlsTutorialOverlay from '../components/ui/ControlsTutorialOverlay';
import AbilitySelectionModal from '../components/ui/AbilitySelectionModal';
import TalentSelectionModal from '../components/ui/TalentSelectionModal';
import CoopBoonPickerModal from '../components/ui/CoopBoonPickerModal';
import CoopBossLootPickerModal from '../components/ui/CoopBossLootPickerModal';
import CoopPetCompanionUpgradeModal from '../components/ui/CoopPetCompanionUpgradeModal';
import type { PetCompanionUpgradeId } from '@/utils/petCompanionUpgrades';
import { getPetCompanionUpgradeOptionsForKind } from '@/utils/petCompanionUpgrades';
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
  getEligibleDuoBoonsForColor,
  getEligibleUltimateBoonsForColor,
  isCoopRoomColor,
  pickPrioritizedRoomBoonOptions,
  pickRandomDistinctFromPool,
  pickRandomClassBoonForWeapon,
  TALENT_RAISE_DEAD,
  TALENT_METEOR_STRIKE,
  TALENT_COLDSNAP_ROOM,
  TALENT_LIGHTNING_BOLT_ROOM,
  TALENT_AEGIS_ROOM,
} from '../utils/talents';
import type { TalentId, TalentLoadout, CoopRoomColor } from '../utils/talents';
import type { AbilityLoadout } from '../utils/weaponAbilities';
import { getDefaultLoadoutForWeapon } from '../utils/weaponAbilities';
import {
  buildRoomTitleAnnouncement,
  buildRunePickupAnnouncement,
  BOON_REROLL_FATE_COST,
  STARTING_FATE,
  BOSS_SLAIN_ANNOUNCEMENTS,
  GUIDE_ANNOUNCEMENTS,
  LEVEL_UP_ANNOUNCEMENT,
  REWARD_ANNOUNCEMENT_COLORS,
  ROOM_TITLE_ANNOUNCEMENT_MS,
  STAT_ROOM_PEDESTAL_POINTS,
  INTRO_ROOM_GOLD_REWARDS,
  SUNKEN_ROOM_GOLD_REWARDS,
  ETERNITY_ROOM_GOLD_REWARDS,
  FAE_REALM_ROOM_GOLD_REWARDS,
  DEEP_SANCTUM_STAT_POINTS,
  TRIAL_ROOM_PEDESTAL_GOLD,
  type BossSlainLabel,
} from '../utils/coopRoomTitles';
import { useAnnouncementQueue } from '../utils/announcementQueue';
import { ITEM_RARITY_COLORS, isItemRarity } from '../utils/itemRarity';
import { DpsTracker, type DpsSnapshot } from '../utils/DpsTracker';
import { getWeaponAspectLabel, defaultWeaponAspect, type WeaponAspect } from '../utils/weaponAspects';

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

const DevPerformanceMeter = dynamic(() => import('../components/ui/DevPerformanceMeter'), {
  ssr: false,
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

interface RoomBoonExclusionSets {
  universalGreen: ReadonlySet<TalentId>;
  roomBoomDash: ReadonlySet<TalentId>;
  runeblade: ReadonlySet<TalentId>;
  scytheEntropic: ReadonlySet<TalentId>;
  sabres: ReadonlySet<TalentId>;
  bow: ReadonlySet<TalentId>;
}

function filterRoomBoonPool(
  color: string | null,
  primaryWeapon: WeaponType,
  talentLoadout: TalentLoadout | null | undefined,
  exclusions: RoomBoonExclusionSets,
  aspect?: WeaponAspect | null,
): TalentId[] {
  const rawPool = buildRoomBoonPoolForColor(color, primaryWeapon, aspect);
  let pool = filterTalentIdsByExclusionSet(rawPool, exclusions.universalGreen);
  pool = filterTalentIdsByExclusionSet(pool, exclusions.roomBoomDash);
  if (primaryWeapon === WeaponType.RUNEBLADE) {
    pool = filterTalentIdsByExclusionSet(pool, exclusions.runeblade);
  } else if (primaryWeapon === WeaponType.SCYTHE) {
    pool = filterTalentIdsByExclusionSet(pool, exclusions.scytheEntropic);
  } else if (primaryWeapon === WeaponType.SABRES) {
    pool = filterTalentIdsByExclusionSet(pool, exclusions.sabres);
  } else if (primaryWeapon === WeaponType.BOW) {
    pool = filterTalentIdsByExclusionSet(pool, exclusions.bow);
  }
  return excludeOwnedTalentsFromBoonPool(pool, talentLoadout);
}

function rollClassBoonOptions(
  weapon: WeaponType,
  talentLoadout: TalentLoadout | null | undefined,
): TalentId[] {
  const pool = excludeOwnedTalentsFromBoonPool(
    buildClassBoonPoolForWeapon(weapon, talentLoadout),
    talentLoadout,
  );
  return pickRandomDistinctFromPool(pool, 3);
}

function rollRoomBoonOptions(
  color: string | null,
  primaryWeapon: WeaponType,
  talentLoadout: TalentLoadout | null | undefined,
  abilityLoadout: AbilityLoadout | null | undefined,
  exclusions: RoomBoonExclusionSets,
  aspect?: WeaponAspect | null,
): TalentId[] {
  const TOTAL_OPTIONS = 3;
  const lowerColor = String(color ?? '').toLowerCase();

  const regularPool = filterRoomBoonPool(color, primaryWeapon, talentLoadout, exclusions, aspect);

  const eligibleSpecials = isCoopRoomColor(lowerColor)
    ? [
        ...getEligibleDuoBoonsForColor(
          lowerColor as CoopRoomColor,
          talentLoadout,
          primaryWeapon,
          abilityLoadout,
        ),
        ...getEligibleUltimateBoonsForColor(
          lowerColor as CoopRoomColor,
          talentLoadout,
          primaryWeapon,
          abilityLoadout,
        ),
      ]
    : [];

  const combinedPool = Array.from(new Set([...regularPool, ...eligibleSpecials]));
  return pickPrioritizedRoomBoonOptions(
    combinedPool,
    color,
    primaryWeapon,
    abilityLoadout,
    TOTAL_OPTIONS,
  );
}

const DEV_TALENT_MODAL =
  process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEV_TALENT_MODAL === '1';

const CANVAS_CAMERA = {
  position: [0, 5, 10] as [number, number, number],
  fov: 75,
  near: 0.1,
  far: 1000,
};

const CANVAS_GL = {
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance' as const,
};

const NOOP_COMBAT_OVERLAY_CALLBACKS: CombatOverlayCallbacks = {
  onCameraUpdate: () => {},
  onDamageNumbersUpdate: () => {},
  onDamageNumberComplete: () => {},
};

function HomeContent() {
  const {
    socket,
    playersRef,
    enemiesRef,
    subscribeEnemyDamage,
    joinRoom,
    setAbilityLoadout,
    setTalentLoadout,
    unlockAbility,
    updateSkillPointsForLevel,
    allocateStatPoint,
    updateStatPointsForLevel: updateStatPointsForLvl,
    grantStatPoints,
    updatePlayerGold,
    updatePlayerFate,
    purchaseItem,
    registerMerchantPurchaseSuccessHandler,
    registerBossDefeatedHandler,
    registerBossItemPickupHandler,
    registerRunePickupHandler,
    clearCoopClearedRoomColor,
    hideCoopPortalTransition,
    confirmCoopPortalTransitionComplete,
    setSelectedWeapons,
    clearLateJoinCombatLoadout,
    claimPreBossReward,
    claimDeepSanctumReward,
    registerDeepSanctumRewardClaimedHandler,
    chooseSunkenTempleLoot,
    chooseEternityPalaceLoot,
    chooseEternityPetUpgrade,
  } = useMultiplayerActions();

  const {
    selectedWeapons,
    abilityLoadout,
    talentLoadout,
    skillPointData,
    statPointData,
    skeletonKillCount,
    skeletonKillRequired,
    inventory,
    merchantPurchaseState,
    currentRoomId,
    isConnected,
    coopTransitionOverlay,
    coopPortalBlinkSeq,
    combatArenaActive,
    gameMode: sessionGameMode,
    gameStarted,
    coopCombatArenaEnterSeq,
    coopMainArenaIntermissionSeq,
    coopIntroIntermissionSeq,
    coopSunkenIntermissionSeq,
    coopEternityIntermissionSeq,
    coopFaeRealmIntermissionSeq,
    coopIntroRoomIndex,
    coopIntroFountainPhase,
    coopIntroFountainUsed,
    coopIntroAllyChoiceMade,
    coopFaeRealmRoomIndex,
    coopFaeBeastCompanionGranted,
    coopFaeBeastCompanionKind,
    coopSunkenRoomIndex,
    coopSunkenFountainPhase,
    coopSunkenFountainUsed,
    coopSunkenLootOffer,
    coopSunkenLootClaimedPlayerIds,
    coopSunkenLootPhaseComplete,
    coopEternityRoomIndex,
    coopEternityFountainPhase,
    coopEternityFountainUsed,
    coopEternityLootOffer,
    coopEternityLootClaimedPlayerIds,
    coopEternityLootPhaseComplete,
    coopPetCompanionUpgrade,
    coopAllyKind,
    coopVoidPortalOffered,
    coopDeepSanctumLevel,
    deepSanctumRewardKind,
    coopDeepSanctumIntermissionSeq,
    coopEdenFountainUsed,
    coopEdenResumeKind,
    coopEdenIntermissionSeq,
    coopFalseEdenCleared,
    coopDeliriumEventEnded,
    coopDeliriumSuccess,
    coopBossClearedBgmSeq,
    coopMainArenaPortalPhase,
    campTypes,
    coopClearedRoomColor,
    coopCurrentRoomKind,
    coopClearedRoomKind,
    coopColoredRoomVisitIndex,
    coopBossRoomVisitIndex,
    coopBossThroneArena,
    lateJoinCombatLoadout,
    selectedArchetype,
    selectedWeaponAspect,
  } = useMultiplayerRoom();

  const combatOverlayCallbacksRef = useRef<CombatOverlayCallbacks>(NOOP_COMBAT_OVERLAY_CALLBACKS);

  const [localPurchasedItems, setLocalPurchasedItems] = useState<string[]>([]);
  const [coopBossSpawned, setCoopBossSpawned] = useState(false);
  const [gameState, setGameState] = useState({
    playerHealth: 200,
    maxHealth: 200,
    playerShield: 100,
    maxShield: 100,
    playerEnergy: 100,
    maxEnergy: 100,
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
  const coopCurrentRoomKindRef = useRef(coopCurrentRoomKind);
  const coopColoredRoomVisitIndexRef = useRef(coopColoredRoomVisitIndex);
  const coopBossRoomVisitIndexRef = useRef(coopBossRoomVisitIndex);
  const coopIntroRoomIndexRef = useRef(coopIntroRoomIndex);
  const coopFaeRealmRoomIndexRef = useRef(coopFaeRealmRoomIndex);
  const coopSunkenRoomIndexRef = useRef(coopSunkenRoomIndex);
  const coopEternityRoomIndexRef = useRef(coopEternityRoomIndex);
  const coopDeepSanctumLevelRef = useRef(coopDeepSanctumLevel);
  const combatArenaActiveRef = useRef(combatArenaActive);
  coopCurrentRoomKindRef.current = coopCurrentRoomKind;
  coopColoredRoomVisitIndexRef.current = coopColoredRoomVisitIndex;
  coopBossRoomVisitIndexRef.current = coopBossRoomVisitIndex;
  coopIntroRoomIndexRef.current = coopIntroRoomIndex;
  coopFaeRealmRoomIndexRef.current = coopFaeRealmRoomIndex;
  coopSunkenRoomIndexRef.current = coopSunkenRoomIndex;
  coopEternityRoomIndexRef.current = coopEternityRoomIndex;
  coopDeepSanctumLevelRef.current = coopDeepSanctumLevel;
  combatArenaActiveRef.current = combatArenaActive;
  const [roomTitleAnnouncement, setRoomTitleAnnouncement] = useState<{
    triggerKey: string | number;
    title: string;
    color: string;
  } | null>(null);
  const [controlsTutorialVisible, setControlsTutorialVisible] = useState(false);
  const [controlsTutorialAutoDismiss, setControlsTutorialAutoDismiss] = useState(true);
  const [controlsTutorialKey, setControlsTutorialKey] = useState(0);

  const handleOpenControlsTutorial = useCallback(() => {
    setControlsTutorialAutoDismiss(false);
    setControlsTutorialKey((k) => k + 1);
    setControlsTutorialVisible(true);
  }, []);

  const queueOverlayAnnouncement = useCallback((
    title: string,
    color: string,
    triggerKey?: string | number,
  ) => {
    setRoomTitleAnnouncement({
      triggerKey: triggerKey ?? `${title}-${Date.now()}`,
      title,
      color,
    });
  }, []);

  const { enqueueAnnouncement, enqueueAnnouncementAfter } = useAnnouncementQueue(
    queueOverlayAnnouncement,
  );

  const queueRoomTitleAnnouncement = useCallback((
    kind: CoopRoomKind | 'throne',
    visitIndex?: number | null,
    triggerKey?: string | number,
  ) => {
    const announcement = buildRoomTitleAnnouncement(kind, visitIndex);
    if (!announcement) return;
    enqueueAnnouncement(
      announcement.title,
      announcement.color,
      triggerKey ?? `${kind}-${visitIndex ?? 'none'}-${Date.now()}`,
    );
  }, [enqueueAnnouncement]);

  const throneEnterPortalAnnouncedRef = useRef(false);
  const claimRewardAnnouncedSeqRef = useRef(-1);
  const chooseGatewayAnnouncedSeqRef = useRef(-1);
  const introAllyDrinkAnnouncedSeqRef = useRef(-1);
  const merchantInPlaceAnnouncedSeqRef = useRef(-1);
  const prevPortalsUnlockedRef = useRef(false);

  const announceThroneEnterPortal = useCallback(() => {
    if (throneEnterPortalAnnouncedRef.current || combatArenaActiveRef.current) return;
    throneEnterPortalAnnouncedRef.current = true;
    const { title, color } = GUIDE_ANNOUNCEMENTS.descendPortal;
    enqueueAnnouncement(title, color, 'throne-enter-portal');
  }, [enqueueAnnouncement]);

  const announceChooseGateway = useCallback((intermissionSeq: number) => {
    if (chooseGatewayAnnouncedSeqRef.current === intermissionSeq) return;
    chooseGatewayAnnouncedSeqRef.current = intermissionSeq;
    const { title, color } = GUIDE_ANNOUNCEMENTS.chooseGateway;
    enqueueAnnouncement(title, color, `gateway-${intermissionSeq}`);
  }, [enqueueAnnouncement]);

  const bootstrapWeaponsRef = useRef(selectedWeapons);
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const abilityLoadoutRef = useRef(abilityLoadout);
  abilityLoadoutRef.current = abilityLoadout;
  const [playerEssence, setPlayerEssence] = useState(50); // Start with 50 essence
  const [playerGold, setPlayerGold] = useState(0);
  const [playerFlow, setPlayerFlow] = useState(0);
  const [playerFate, setPlayerFate] = useState(STARTING_FATE);
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
  const [sunkenLootModalOpen, setSunkenLootModalOpen] = useState(false);
  const [eternityLootModalOpen, setEternityLootModalOpen] = useState(false);
  const [eternityPetUpgradeModalOpen, setEternityPetUpgradeModalOpen] = useState(false);
  /** Class boon completed for primary weapons in throne prep — one trio per weapon, not globally per run session. */
  const classBoonPickedWeaponsRef = useRef<Set<WeaponType>>(new Set());
  const [classTalentPickedWeapons, setClassTalentPickedWeapons] = useState<ReadonlySet<WeaponType>>(
    () => new Set(),
  );
  const lateJoinLoadoutHandledRef = useRef(false);
  const roomBoonIntermissionDoneSeqRef = useRef(-1);
  const deepSanctumRewardClaimedSeqRef = useRef(-1);
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
  const pedestalRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCoopIntermissionBgmRef = useRef(0);
  const lastCoopEnterBgmRef = useRef(0);
  const lastCoopBossBgmRef = useRef(0);
  /** Guards room-clear finish SFX vs mount / mid-phase sync. */
  const prevCoopMainArenaPortalPhaseRef = useRef<
    typeof coopMainArenaPortalPhase | 'unset'
  >('unset');

  const handleDamageNumberComplete = useCallback((id: string) => {
    combatOverlayCallbacksRef.current.onDamageNumberComplete(id);
  }, []);

  const handleCameraUpdate = useCallback((camera: Camera, size: { width: number; height: number }) => {
    combatOverlayCallbacksRef.current.onCameraUpdate(camera, size);
  }, []);

  const handleGameStateUpdate = useCallback((newGameState: {
    playerHealth: number;
    maxHealth: number;
    playerShield: number;
    maxShield: number;
    playerEnergy: number;
    maxEnergy: number;
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
    mana?: number;
    maxMana?: number;
  }) => {
    setGameState({
      ...newGameState,
      mana: newGameState.mana ?? 150,
      maxMana: newGameState.maxMana ?? 150,
    });
  }, []);

  const handleControlSystemUpdate = useCallback((newControlSystem: unknown) => {
    setControlSystem(newControlSystem);
  }, []);

  const handleDamageNumbersUpdate = useCallback((numbers: DamageNumberData[]) => {
    combatOverlayCallbacksRef.current.onDamageNumbersUpdate(numbers);
  }, []);

  const handleSceneReady = useCallback(() => {
    setLoadingSceneBootstrapReady(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsGameLoading(false));
    });
  }, []);

  const handleRequestThroneAbilityModal = useCallback((weapon: WeaponType) => {
    setThroneTalentWeapon(null);
    setThroneAbilityWeapon(weapon);
  }, []);

  const handleRequestThroneTalentModal = useCallback((weapon: WeaponType) => {
    setThroneAbilityWeapon(null);
    setThroneTalentWeapon(weapon);
  }, []);

  // Auto-join default co-op room and start throne prep immediately; a 2nd player who joins
  // during prep is synced into the same throne room via `coop-throne-sync`.
  useEffect(() => {
    if (!isConnected || !socket || coopEntryBootstrapStarted) return;
    coopEntryBootstrapStarted = true;
    void (async () => {
      try {
        const name = `Player${Math.floor(Math.random() * 10000)}`;
        const sw = bootstrapWeaponsRef.current;
        const joined = await joinRoom(
          'default',
          name,
          sw.primary,
          getDefaultSubclassForWeapon(sw.primary),
          'coop',
        );
        if (!joined.gameStarted) {
          socket.emit('start-game', { roomId: joined.roomId });
        }
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
    prevPortalsUnlockedRef.current = false;
  }, [coopCombatArenaEnterSeq]);

  useEffect(() => {
    if (gameMode !== 'coop') return;
    if (coopMainArenaPortalPhase === 'pre_boss_merchant') {
      setPortalsUnlocked(true);
    }
  }, [gameMode, coopMainArenaPortalPhase]);

  /** Pre-boss merchant is an in-place swap (no portal blink) — announce AVERNUS once per intermission. */
  useEffect(() => {
    if (gameMode !== 'coop') return;
    if (coopCurrentRoomKind !== 'merchant' || coopMainArenaPortalPhase !== 'pre_boss_merchant') return;
    if (merchantInPlaceAnnouncedSeqRef.current === coopMainArenaIntermissionSeq) return;
    merchantInPlaceAnnouncedSeqRef.current = coopMainArenaIntermissionSeq;
    queueRoomTitleAnnouncement(
      'merchant',
      null,
      `merchant-inplace-${coopMainArenaIntermissionSeq}`,
    );
  }, [
    gameMode,
    coopCurrentRoomKind,
    coopMainArenaPortalPhase,
    coopMainArenaIntermissionSeq,
    queueRoomTitleAnnouncement,
  ]);

  /** New wave-clear intermission: ensure pedestal aura / X-interact isn't stuck behind prior `pedestalInteracted`. */
  const lastIntermissionSeqForPedestalRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (lastIntermissionSeqForPedestalRef.current === coopMainArenaIntermissionSeq) return;
    lastIntermissionSeqForPedestalRef.current = coopMainArenaIntermissionSeq;
    if (gameMode !== 'coop' || coopMainArenaIntermissionSeq <= 0) return;
    setPedestalInteracted(false);
  }, [coopMainArenaIntermissionSeq, gameMode]);

  const lastDeepSanctumIntermissionSeqRef = useRef(-1);
  useEffect(() => {
    if (lastDeepSanctumIntermissionSeqRef.current === coopDeepSanctumIntermissionSeq) return;
    lastDeepSanctumIntermissionSeqRef.current = coopDeepSanctumIntermissionSeq;
    if (gameMode !== 'coop' || coopDeepSanctumIntermissionSeq <= 0) return;
    setPedestalInteracted(false);
  }, [coopDeepSanctumIntermissionSeq, gameMode]);

  useEffect(() => {
    if (gameMode !== 'coop' || coopMainArenaIntermissionSeq <= 0) return;
    if (!coopVoidPortalOffered) return;
    const { title, color } = GUIDE_ANNOUNCEMENTS.descendVoid;
    enqueueAnnouncementAfter(
      ROOM_TITLE_ANNOUNCEMENT_MS,
      title,
      color,
      `void-portal-${coopMainArenaIntermissionSeq}`,
    );
  }, [coopMainArenaIntermissionSeq, coopVoidPortalOffered, gameMode, enqueueAnnouncementAfter]);

  const lastIntroIntermissionSeqRef = useRef(-1);
  useEffect(() => {
    if (lastIntroIntermissionSeqRef.current === coopIntroIntermissionSeq) return;
    lastIntroIntermissionSeqRef.current = coopIntroIntermissionSeq;
    if (gameMode !== 'coop' || coopIntroIntermissionSeq <= 0) return;

    const clearedIndex = coopIntroRoomIndexRef.current;
    const goldAmount = INTRO_ROOM_GOLD_REWARDS[Math.max(0, clearedIndex - 1)] ?? 0;
    if (goldAmount > 0) {
      enqueueAnnouncement(
        `+${goldAmount} GOLD`,
        REWARD_ANNOUNCEMENT_COLORS.gold,
        `intro-gold-${coopIntroIntermissionSeq}`,
      );
    }

    if (coopIntroFountainPhase) {
      if (!coopIntroAllyChoiceMade) {
        const { title, color } = GUIDE_ANNOUNCEMENTS.chooseAlly;
        enqueueAnnouncementAfter(
          ROOM_TITLE_ANNOUNCEMENT_MS,
          title,
          color,
          `intro-ally-${coopIntroIntermissionSeq}`,
        );
      } else if (!coopIntroFountainUsed) {
        const { title, color } = GUIDE_ANNOUNCEMENTS.drinkFountain;
        enqueueAnnouncementAfter(
          ROOM_TITLE_ANNOUNCEMENT_MS,
          title,
          color,
          `intro-fountain-${coopIntroIntermissionSeq}`,
        );
      }
    } else {
      const { title, color } = GUIDE_ANNOUNCEMENTS.descendPortal;
      enqueueAnnouncementAfter(
        ROOM_TITLE_ANNOUNCEMENT_MS,
        title,
        color,
        `intro-descend-${coopIntroIntermissionSeq}`,
      );
    }
  }, [coopIntroIntermissionSeq, coopIntroFountainPhase, coopIntroAllyChoiceMade, coopIntroFountainUsed, gameMode, enqueueAnnouncement, enqueueAnnouncementAfter]);

  const lastFaeRealmIntermissionSeqRef = useRef(-1);
  useEffect(() => {
    if (lastFaeRealmIntermissionSeqRef.current === coopFaeRealmIntermissionSeq) return;
    lastFaeRealmIntermissionSeqRef.current = coopFaeRealmIntermissionSeq;
    if (gameMode !== 'coop' || coopFaeRealmIntermissionSeq <= 0) return;

    const clearedIndex = coopFaeRealmRoomIndexRef.current;
    const goldAmount = FAE_REALM_ROOM_GOLD_REWARDS[Math.max(0, clearedIndex - 1)] ?? 0;
    if (goldAmount > 0) {
      enqueueAnnouncement(
        `+${goldAmount} GOLD`,
        REWARD_ANNOUNCEMENT_COLORS.gold,
        `fae-gold-${coopFaeRealmIntermissionSeq}`,
      );
    }

    if (clearedIndex === 3 && coopFaeBeastCompanionGranted) {
      enqueueAnnouncementAfter(
        ROOM_TITLE_ANNOUNCEMENT_MS,
        'SPIRIT ANIMAL AWAKENED',
        '#c9a227',
        `fae-beast-${coopFaeRealmIntermissionSeq}`,
      );
    }

    const { title, color } = GUIDE_ANNOUNCEMENTS.descendPortal;
    enqueueAnnouncementAfter(
      ROOM_TITLE_ANNOUNCEMENT_MS + (clearedIndex === 3 && coopFaeBeastCompanionGranted ? 1800 : 0),
      title,
      color,
      `fae-descend-${coopFaeRealmIntermissionSeq}`,
    );
  }, [
    coopFaeRealmIntermissionSeq,
    coopFaeBeastCompanionGranted,
    gameMode,
    enqueueAnnouncement,
    enqueueAnnouncementAfter,
  ]);

  useEffect(() => {
    if (gameMode !== 'coop' || !coopIntroFountainPhase || !coopIntroAllyChoiceMade || coopIntroFountainUsed) return;
    if (introAllyDrinkAnnouncedSeqRef.current === coopIntroIntermissionSeq) return;
    introAllyDrinkAnnouncedSeqRef.current = coopIntroIntermissionSeq;
    const { title, color } = GUIDE_ANNOUNCEMENTS.drinkFountain;
    enqueueAnnouncement(title, color, `intro-fountain-after-ally-${coopIntroIntermissionSeq}`);
  }, [coopIntroAllyChoiceMade, coopIntroFountainPhase, coopIntroFountainUsed, coopIntroIntermissionSeq, gameMode, enqueueAnnouncement]);

  const lastSunkenIntermissionSeqRef = useRef(-1);
  useEffect(() => {
    if (lastSunkenIntermissionSeqRef.current === coopSunkenIntermissionSeq) return;
    lastSunkenIntermissionSeqRef.current = coopSunkenIntermissionSeq;
    if (gameMode !== 'coop' || coopSunkenIntermissionSeq <= 0) return;

    const clearedIndex = coopSunkenRoomIndexRef.current;
    const goldAmount = SUNKEN_ROOM_GOLD_REWARDS[Math.max(0, clearedIndex - 1)] ?? 0;
    if (goldAmount > 0) {
      enqueueAnnouncement(
        `+${goldAmount} GOLD`,
        REWARD_ANNOUNCEMENT_COLORS.gold,
        `sunken-gold-${coopSunkenIntermissionSeq}`,
      );
    }

    if (coopSunkenFountainPhase) {
      if (!coopSunkenLootPhaseComplete) {
        const { title, color } = GUIDE_ANNOUNCEMENTS.speakWithArchitect;
        enqueueAnnouncementAfter(
          ROOM_TITLE_ANNOUNCEMENT_MS,
          title,
          color,
          `sunken-architect-${coopSunkenIntermissionSeq}`,
        );
      } else if (!coopSunkenFountainUsed) {
        const { title, color } = GUIDE_ANNOUNCEMENTS.drinkFountain;
        enqueueAnnouncementAfter(
          ROOM_TITLE_ANNOUNCEMENT_MS,
          title,
          color,
          `sunken-fountain-${coopSunkenIntermissionSeq}`,
        );
      }
    } else {
      const { title, color } = GUIDE_ANNOUNCEMENTS.descendPortal;
      enqueueAnnouncementAfter(
        ROOM_TITLE_ANNOUNCEMENT_MS,
        title,
        color,
        `sunken-descend-${coopSunkenIntermissionSeq}`,
      );
    }
  }, [coopSunkenIntermissionSeq, coopSunkenFountainPhase, coopSunkenLootPhaseComplete, coopSunkenFountainUsed, gameMode, enqueueAnnouncement, enqueueAnnouncementAfter]);

  useEffect(() => {
    if (gameMode !== 'coop' || !coopSunkenFountainPhase || !coopSunkenLootPhaseComplete || coopSunkenFountainUsed) return;
    if (introAllyDrinkAnnouncedSeqRef.current === coopSunkenIntermissionSeq) return;
    introAllyDrinkAnnouncedSeqRef.current = coopSunkenIntermissionSeq;
    const { title, color } = GUIDE_ANNOUNCEMENTS.drinkFountain;
    enqueueAnnouncement(title, color, `sunken-fountain-after-loot-${coopSunkenIntermissionSeq}`);
  }, [coopSunkenLootPhaseComplete, coopSunkenFountainPhase, coopSunkenFountainUsed, coopSunkenIntermissionSeq, gameMode, enqueueAnnouncement]);

  useEffect(() => {
    if (!coopSunkenLootPhaseComplete || !coopSunkenFountainUsed || gameMode !== 'coop') return;
    const { title, color } = GUIDE_ANNOUNCEMENTS.chooseGateway;
    enqueueAnnouncement(title, color, `sunken-gateway-${coopSunkenIntermissionSeq}`);
  }, [coopSunkenLootPhaseComplete, coopSunkenFountainUsed, coopSunkenIntermissionSeq, gameMode, enqueueAnnouncement]);

  const lastEternityIntermissionSeqRef = useRef(-1);
  useEffect(() => {
    if (lastEternityIntermissionSeqRef.current === coopEternityIntermissionSeq) return;
    lastEternityIntermissionSeqRef.current = coopEternityIntermissionSeq;
    if (gameMode !== 'coop' || coopEternityIntermissionSeq <= 0) return;

    const clearedIndex = coopEternityRoomIndexRef.current;
    const goldAmount = ETERNITY_ROOM_GOLD_REWARDS[Math.max(0, clearedIndex - 1)] ?? 0;
    if (goldAmount > 0) {
      enqueueAnnouncement(
        `+${goldAmount} GOLD`,
        REWARD_ANNOUNCEMENT_COLORS.gold,
        `eternity-gold-${coopEternityIntermissionSeq}`,
      );
    }

    if (coopEternityFountainPhase) {
      if (!coopEternityLootPhaseComplete) {
        const { title, color } = GUIDE_ANNOUNCEMENTS.empowerSpiritAnimal
          ?? GUIDE_ANNOUNCEMENTS.speakWithArchitect;
        enqueueAnnouncementAfter(
          ROOM_TITLE_ANNOUNCEMENT_MS,
          title,
          color,
          `eternity-architect-${coopEternityIntermissionSeq}`,
        );
      } else if (!coopEternityFountainUsed) {
        const { title, color } = GUIDE_ANNOUNCEMENTS.drinkFountain;
        enqueueAnnouncementAfter(
          ROOM_TITLE_ANNOUNCEMENT_MS,
          title,
          color,
          `eternity-fountain-${coopEternityIntermissionSeq}`,
        );
      }
    } else {
      const { title, color } = GUIDE_ANNOUNCEMENTS.descendPortal;
      enqueueAnnouncementAfter(
        ROOM_TITLE_ANNOUNCEMENT_MS,
        title,
        color,
        `eternity-descend-${coopEternityIntermissionSeq}`,
      );
    }
  }, [coopEternityIntermissionSeq, coopEternityFountainPhase, coopEternityLootPhaseComplete, coopEternityFountainUsed, gameMode, enqueueAnnouncement, enqueueAnnouncementAfter]);

  useEffect(() => {
    if (gameMode !== 'coop' || !coopEternityFountainPhase || !coopEternityLootPhaseComplete || coopEternityFountainUsed) return;
    if (introAllyDrinkAnnouncedSeqRef.current === coopEternityIntermissionSeq) return;
    introAllyDrinkAnnouncedSeqRef.current = coopEternityIntermissionSeq;
    const { title, color } = GUIDE_ANNOUNCEMENTS.drinkFountain;
    enqueueAnnouncement(title, color, `eternity-fountain-after-loot-${coopEternityIntermissionSeq}`);
  }, [coopEternityLootPhaseComplete, coopEternityFountainPhase, coopEternityFountainUsed, coopEternityIntermissionSeq, gameMode, enqueueAnnouncement]);

  useEffect(() => {
    if (!coopEternityLootPhaseComplete || !coopEternityFountainUsed || gameMode !== 'coop') return;
    const { title, color } = GUIDE_ANNOUNCEMENTS.chooseGateway;
    enqueueAnnouncement(title, color, `eternity-gateway-${coopEternityIntermissionSeq}`);
  }, [coopEternityLootPhaseComplete, coopEternityFountainUsed, coopEternityIntermissionSeq, gameMode, enqueueAnnouncement]);

  useEffect(() => {
    if (!coopIntroAllyChoiceMade || !coopIntroFountainUsed || gameMode !== 'coop') return;
    const { title, color } = GUIDE_ANNOUNCEMENTS.chooseGateway;
    enqueueAnnouncement(title, color, `intro-gateway-${coopIntroIntermissionSeq}`);
  }, [coopIntroAllyChoiceMade, coopIntroFountainUsed, coopIntroIntermissionSeq, gameMode, enqueueAnnouncement]);

  const lastEdenEnterSeqRef = useRef(-1);
  useEffect(() => {
    if (gameMode !== 'coop' || coopCurrentRoomKind !== 'eden' || coopEdenFountainUsed) return;
    if (lastEdenEnterSeqRef.current === coopCombatArenaEnterSeq) return;
    lastEdenEnterSeqRef.current = coopCombatArenaEnterSeq;
    const { title, color } = GUIDE_ANNOUNCEMENTS.drinkFountain;
    enqueueAnnouncementAfter(
      ROOM_TITLE_ANNOUNCEMENT_MS,
      title,
      color,
      `eden-fountain-${coopCombatArenaEnterSeq}`,
    );
  }, [coopCombatArenaEnterSeq, coopCurrentRoomKind, coopEdenFountainUsed, gameMode, enqueueAnnouncementAfter]);

  const lastEdenIntermissionSeqRef = useRef(-1);
  useEffect(() => {
    if (lastEdenIntermissionSeqRef.current === coopEdenIntermissionSeq) return;
    lastEdenIntermissionSeqRef.current = coopEdenIntermissionSeq;
    if (gameMode !== 'coop' || coopEdenIntermissionSeq <= 0) return;
    const showGateway =
      coopEdenFountainUsed
      || (coopCurrentRoomKind === 'delirium_gate' && coopMainArenaPortalPhase === 'eden_exit')
      || (coopCurrentRoomKind === 'erebus_gate' && coopMainArenaPortalPhase === 'eden_exit');
    if (!showGateway) return;
    const { title, color } = GUIDE_ANNOUNCEMENTS.chooseGateway;
    enqueueAnnouncement(title, color, `surprise-gateway-${coopEdenIntermissionSeq}`);
  }, [
    coopCurrentRoomKind,
    coopDeliriumEventEnded,
    coopEdenFountainUsed,
    coopEdenIntermissionSeq,
    coopMainArenaPortalPhase,
    gameMode,
    enqueueAnnouncement,
  ]);

  const lastErebusEnterSeqRef = useRef(-1);
  useEffect(() => {
    if (gameMode !== 'coop' || coopCurrentRoomKind !== 'erebus_gate') return;
    if (lastErebusEnterSeqRef.current === coopCombatArenaEnterSeq) return;
    lastErebusEnterSeqRef.current = coopCombatArenaEnterSeq;
    const { title, color } = GUIDE_ANNOUNCEMENTS.defeatChampion;
    enqueueAnnouncementAfter(
      ROOM_TITLE_ANNOUNCEMENT_MS,
      title,
      color,
      `erebus-champion-${coopCombatArenaEnterSeq}`,
    );
  }, [coopCombatArenaEnterSeq, coopCurrentRoomKind, gameMode, enqueueAnnouncementAfter]);

  const lastFalseEdenEnterSeqRef = useRef(-1);
  useEffect(() => {
    if (gameMode !== 'coop' || coopCurrentRoomKind !== 'false_eden' || coopFalseEdenCleared) return;
    if (lastFalseEdenEnterSeqRef.current === coopCombatArenaEnterSeq) return;
    lastFalseEdenEnterSeqRef.current = coopCombatArenaEnterSeq;
    const { title, color } = GUIDE_ANNOUNCEMENTS.killSpines;
    enqueueAnnouncementAfter(
      ROOM_TITLE_ANNOUNCEMENT_MS,
      title,
      color,
      `false-eden-spines-${coopCombatArenaEnterSeq}`,
    );
  }, [coopCombatArenaEnterSeq, coopCurrentRoomKind, coopFalseEdenCleared, gameMode, enqueueAnnouncementAfter]);

  useEffect(() => {
    if (gameMode !== 'coop' || coopCurrentRoomKind !== 'false_eden' || !coopFalseEdenCleared || coopEdenFountainUsed) return;
    const { title, color } = GUIDE_ANNOUNCEMENTS.drinkFountain;
    enqueueAnnouncement(title, color, `false-eden-fountain-${coopEdenIntermissionSeq}`);
  }, [coopCurrentRoomKind, coopFalseEdenCleared, coopEdenFountainUsed, coopEdenIntermissionSeq, gameMode, enqueueAnnouncement]);

  const lastDeliriumEnterSeqRef = useRef(-1);
  useEffect(() => {
    if (gameMode !== 'coop' || coopCurrentRoomKind !== 'delirium_gate') return;
    if (lastDeliriumEnterSeqRef.current === coopCombatArenaEnterSeq) return;
    lastDeliriumEnterSeqRef.current = coopCombatArenaEnterSeq;
    const { title, color } = GUIDE_ANNOUNCEMENTS.defendStructure;
    enqueueAnnouncementAfter(
      ROOM_TITLE_ANNOUNCEMENT_MS,
      title,
      color,
      `delirium-defend-${coopCombatArenaEnterSeq}`,
    );
  }, [coopCombatArenaEnterSeq, coopCurrentRoomKind, gameMode, enqueueAnnouncementAfter]);

  useEffect(() => {
    if (gameMode !== 'coop' || coopEdenIntermissionSeq <= 0 || coopCurrentRoomKind !== 'delirium_gate' || !coopDeliriumEventEnded) return;
    const { title, color } = coopDeliriumSuccess
      ? GUIDE_ANNOUNCEMENTS.deliriumSuccess
      : GUIDE_ANNOUNCEMENTS.deliriumFailed;
    enqueueAnnouncement(title, color, `delirium-end-${coopEdenIntermissionSeq}`);
  }, [coopCurrentRoomKind, coopDeliriumEventEnded, coopDeliriumSuccess, coopEdenIntermissionSeq, gameMode, enqueueAnnouncement]);

  useEffect(() => {
    return () => {
      if (pedestalRevealTimeoutRef.current) {
        clearTimeout(pedestalRevealTimeoutRef.current);
        pedestalRevealTimeoutRef.current = null;
      }
    };
  }, []);

  const playPedestalInteractAndDelay = useCallback((reveal: () => void) => {
    window.audioSystem?.playPedestalSound?.();
    if (pedestalRevealTimeoutRef.current) clearTimeout(pedestalRevealTimeoutRef.current);
    pedestalRevealTimeoutRef.current = setTimeout(() => {
      reveal();
      pedestalRevealTimeoutRef.current = null;
    }, 800);
  }, []);

  useEffect(() => {
    runebladeRoomBoonExcludedIdsRef.current.clear();
    scytheEntropicRoomBoonExcludedIdsRef.current.clear();
    sabresRoomBoonExcludedIdsRef.current.clear();
    bowRoomBoonExcludedIdsRef.current.clear();
    universalGreenZombieRoomBoonExcludedIdsRef.current.clear();
    roomBoomDashBoonExcludedIdsRef.current.clear();
    lateJoinLoadoutHandledRef.current = false;
  }, [currentRoomId]);

  /** Late join after first portal: hydrate server-assigned weapon and auto-grant a starting class-boon. */
  useEffect(() => {
    if (!lateJoinCombatLoadout || lateJoinLoadoutHandledRef.current || sessionGameMode !== 'coop') return;

    lateJoinLoadoutHandledRef.current = true;
    const { weapon: w } = lateJoinCombatLoadout;

    setSelectedWeapons({ primary: w, secondary: w });
    setAbilityLoadout(getDefaultLoadoutForWeapon(w, defaultWeaponAspect(w)));

    setTalentLoadout((prev) => {
      const boonId = pickRandomClassBoonForWeapon(w, prev);
      if (!boonId) return prev;

      queueMicrotask(() => {
        if (
          boonId === TALENT_RAISE_DEAD
          || boonId === TALENT_METEOR_STRIKE
          || boonId === TALENT_COLDSNAP_ROOM
          || boonId === TALENT_LIGHTNING_BOLT_ROOM
          || boonId === TALENT_AEGIS_ROOM
        ) {
          const abilityId =
            boonId === TALENT_RAISE_DEAD ? 'RAISE_DEAD'
            : boonId === TALENT_METEOR_STRIKE ? 'METEOR_STRIKE'
            : boonId === TALENT_COLDSNAP_ROOM ? 'SCYTHE_E'
            : boonId === TALENT_AEGIS_ROOM ? 'AEGIS_ROOM'
            : 'SPEAR_R';
          setAbilityLoadout(
            abilityLoadoutRef.current
              ? { ...abilityLoadoutRef.current, R: abilityId }
              : { Q: null, E: null, R: abilityId },
          );
        }
        classBoonPickedWeaponsRef.current.add(w);
        setClassTalentPickedWeapons((prev) => {
          if (prev.has(w)) return prev;
          const next = new Set(prev);
          next.add(w);
          return next;
        });
        enqueueAnnouncement('UNLOCKED', REWARD_ANNOUNCEMENT_COLORS.unlocked, `boon-${boonId}`);
        window.audioSystem?.playUIInterface3Sound?.();
      });

      return applyTalentIdToLoadout(prev, boonId);
    });

    clearLateJoinCombatLoadout();
  }, [
    lateJoinCombatLoadout,
    sessionGameMode,
    setSelectedWeapons,
    setAbilityLoadout,
    setTalentLoadout,
    clearLateJoinCombatLoadout,
    enqueueAnnouncement,
  ]);

  const handleSunkenSentinelInteract = useCallback(() => {
    if (gameMode !== 'coop' || !coopSunkenFountainPhase || coopSunkenLootPhaseComplete) return;
    if (socket?.id && coopSunkenLootClaimedPlayerIds.includes(socket.id)) return;
    setSunkenLootModalOpen(true);
    window.audioSystem?.playUIInterface4Sound?.();
  }, [
    gameMode,
    coopSunkenFountainPhase,
    coopSunkenLootPhaseComplete,
    coopSunkenLootClaimedPlayerIds,
    socket?.id,
  ]);

  const handleSunkenLootPick = useCallback((stockId: string) => {
    chooseSunkenTempleLoot(stockId);
    setSunkenLootModalOpen(false);
    window.audioSystem?.playUISelectionSound?.();
  }, [chooseSunkenTempleLoot]);

  useEffect(() => {
    if (socket?.id && coopSunkenLootClaimedPlayerIds.includes(socket.id)) {
      setSunkenLootModalOpen(false);
    }
  }, [coopSunkenLootClaimedPlayerIds, socket?.id]);

  useEffect(() => {
    setSunkenLootModalOpen(false);
  }, [coopSunkenIntermissionSeq]);

  const handleEternityPalaceArchitectInteract = useCallback(() => {
    if (gameMode !== 'coop' || !coopEternityFountainPhase || coopEternityLootPhaseComplete) return;
    if (socket?.id && coopEternityLootClaimedPlayerIds.includes(socket.id)) return;
    if (!coopFaeBeastCompanionGranted || !coopFaeBeastCompanionKind) return;
    setEternityPetUpgradeModalOpen(true);
    window.audioSystem?.playUIInterface4Sound?.();
  }, [
    gameMode,
    coopEternityFountainPhase,
    coopEternityLootPhaseComplete,
    coopEternityLootClaimedPlayerIds,
    coopFaeBeastCompanionGranted,
    coopFaeBeastCompanionKind,
    socket?.id,
  ]);

  const handleEternityPetUpgradePick = useCallback((upgradeId: PetCompanionUpgradeId) => {
    chooseEternityPetUpgrade(upgradeId);
    setEternityPetUpgradeModalOpen(false);
    window.audioSystem?.playUISelectionSound?.();
  }, [chooseEternityPetUpgrade]);

  const handleEternityLootPick = useCallback((stockId: string) => {
    chooseEternityPalaceLoot(stockId);
    setEternityLootModalOpen(false);
    window.audioSystem?.playUISelectionSound?.();
  }, [chooseEternityPalaceLoot]);

  useEffect(() => {
    if (socket?.id && coopEternityLootClaimedPlayerIds.includes(socket.id)) {
      setEternityLootModalOpen(false);
      setEternityPetUpgradeModalOpen(false);
    }
  }, [coopEternityLootClaimedPlayerIds, socket?.id]);

  useEffect(() => {
    setEternityLootModalOpen(false);
    setEternityPetUpgradeModalOpen(false);
  }, [coopEternityIntermissionSeq]);

  /**
   * Called by CoopGameScene when the player presses X near the combat pedestal.
   * Builds and shows the room-boon picker, or immediately unlocks portals if the
   * boon pool is empty.
   */
  const handleCombatArenaPedestalInteract = useCallback((rewardKindFromScene?: string | null) => {
    if (gameMode !== 'coop') return;

    const rewardKind = (rewardKindFromScene ?? coopClearedRoomKind ?? coopCurrentRoomKind) as CoopRoomKind | null;

    if (rewardKind === 'deep_sanctum') {
      if (deepSanctumRewardClaimedSeqRef.current === coopDeepSanctumIntermissionSeq) return;
      deepSanctumRewardClaimedSeqRef.current = coopDeepSanctumIntermissionSeq;
      setPedestalInteracted(true);
      playPedestalInteractAndDelay(() => {
        claimDeepSanctumReward();
      });
      return;
    }

    if (roomBoonIntermissionDoneSeqRef.current === coopMainArenaIntermissionSeq) return;

    roomBoonIntermissionDoneSeqRef.current = coopMainArenaIntermissionSeq;
    setPedestalInteracted(true);

    if (rewardKind === 'boss') {
      const options = rollClassBoonOptions(selectedWeapons.primary, talentLoadout);
      if (options.length > 0) {
        playPedestalInteractAndDelay(() => {
          setCoopBoon({ kind: 'class', options, weaponForPick: selectedWeapons.primary });
        });
        return;
      }
      playPedestalInteractAndDelay(() => {
        setPortalsUnlocked(true);
      });
      return;
    }

    if (rewardKind === 'stat') {
      playPedestalInteractAndDelay(() => {
        grantStatPoints(STAT_ROOM_PEDESTAL_POINTS);
        window.audioSystem?.playUIInterface3Sound?.();
        enqueueAnnouncement(
          `+${STAT_ROOM_PEDESTAL_POINTS} STAT POINTS`,
          REWARD_ANNOUNCEMENT_COLORS.stat,
          `stat-points-${coopMainArenaIntermissionSeq}`,
        );
        clearCoopClearedRoomColor();
        if (coopMainArenaPortalPhase === 'pre_boss_reward') {
          claimPreBossReward();
        } else {
          setPortalsUnlocked(true);
        }
      });
      return;
    }

    if (rewardKind === 'merchant') {
      return;
    }

    if (rewardKind === 'trial') {
      playPedestalInteractAndDelay(() => {
        if (socket?.id) updatePlayerGold(socket.id, TRIAL_ROOM_PEDESTAL_GOLD);
        window.audioSystem?.playUIGoldPickupSound?.();
        enqueueAnnouncement(
          `+${TRIAL_ROOM_PEDESTAL_GOLD} GOLD`,
          REWARD_ANNOUNCEMENT_COLORS.gold,
          `trial-gold-${coopMainArenaIntermissionSeq}`,
        );
        clearCoopClearedRoomColor();
        if (coopMainArenaPortalPhase === 'pre_boss_reward') {
          claimPreBossReward();
        } else {
          setPortalsUnlocked(true);
        }
      });
      return;
    }

    if (
      coopMainArenaPortalPhase === 'pick_wave2' ||
      coopMainArenaPortalPhase === 'pick_pre_boss' ||
      coopMainArenaPortalPhase === 'pick_boss' ||
      coopMainArenaPortalPhase === 'pick_post_boss'
    ) {
      const color = coopRoomBoonColorFromContext(coopClearedRoomColor, coopClearedRoomKind, campTypes);
      const options = rollRoomBoonOptions(
        color,
        selectedWeapons.primary,
        talentLoadout,
        abilityLoadout,
        {
          universalGreen: universalGreenZombieRoomBoonExcludedIdsRef.current,
          roomBoomDash: roomBoomDashBoonExcludedIdsRef.current,
          runeblade: runebladeRoomBoonExcludedIdsRef.current,
          scytheEntropic: scytheEntropicRoomBoonExcludedIdsRef.current,
          sabres: sabresRoomBoonExcludedIdsRef.current,
          bow: bowRoomBoonExcludedIdsRef.current,
        },
        selectedWeaponAspect,
      );
      if (options.length > 0) {
        playPedestalInteractAndDelay(() => {
          setCoopBoon({ kind: 'room', options });
        });
        // portalsUnlocked will be set in handleCoopBoonPick after the player chooses
        return;
      }
    }

    // No boon to show (empty pool or non-boon reward) — unlock portals after pedestal beat
    playPedestalInteractAndDelay(() => {
      setPortalsUnlocked(true);
    });
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
    abilityLoadout,
    selectedWeaponAspect,
    socket?.id,
    enqueueAnnouncement,
    playPedestalInteractAndDelay,
    claimPreBossReward,
    claimDeepSanctumReward,
    coopDeepSanctumIntermissionSeq,
  ]);

  const handleThroneWeaponEquipped = useCallback(
    (weapon: WeaponType) => {
      if (combatArenaActive) return;
      if (classBoonPickedWeaponsRef.current.has(weapon)) {
        announceThroneEnterPortal();
        return;
      }
      const options = rollClassBoonOptions(weapon, talentLoadout);
      if (options.length === 0) {
        announceThroneEnterPortal();
        return;
      }
      playPedestalInteractAndDelay(() => {
        setCoopBoon({ kind: 'class', options, weaponForPick: weapon });
      });
    },
    [combatArenaActive, talentLoadout, playPedestalInteractAndDelay, announceThroneEnterPortal],
  );

  const handleCoopBoonReroll = useCallback(() => {
    if (combatArenaActive) {
      if (playerFate < BOON_REROLL_FATE_COST) return;
      if (socket?.id) updatePlayerFate(socket.id, -BOON_REROLL_FATE_COST);
    }
    window.audioSystem?.playBoonRerollSound?.();
    setCoopBoon((prev) => {
      if (!prev) return null;
      if (prev.kind === 'class') {
        const options = rollClassBoonOptions(prev.weaponForPick, talentLoadout);
        return options.length > 0 ? { ...prev, options } : prev;
      }
      const color = coopRoomBoonColorFromContext(coopClearedRoomColor, coopClearedRoomKind, campTypes);
      const options = rollRoomBoonOptions(
        color,
        selectedWeapons.primary,
        talentLoadout,
        abilityLoadout,
        {
          universalGreen: universalGreenZombieRoomBoonExcludedIdsRef.current,
          roomBoomDash: roomBoomDashBoonExcludedIdsRef.current,
          runeblade: runebladeRoomBoonExcludedIdsRef.current,
          scytheEntropic: scytheEntropicRoomBoonExcludedIdsRef.current,
          sabres: sabresRoomBoonExcludedIdsRef.current,
          bow: bowRoomBoonExcludedIdsRef.current,
        },
        selectedWeaponAspect,
      );
      return options.length > 0 ? { ...prev, options } : prev;
    });
  }, [
    combatArenaActive,
    playerFate,
    socket?.id,
    updatePlayerFate,
    talentLoadout,
    abilityLoadout,
    selectedWeapons.primary,
    selectedWeaponAspect,
    coopClearedRoomColor,
    coopClearedRoomKind,
    campTypes,
  ]);

  const handleCoopBoonPick = useCallback(
    (id: TalentId, kind: 'class' | 'room', classPickWeapon?: WeaponType) => {
      setTalentLoadout((prev) => {
        const next = applyTalentIdToLoadout(prev, id);
        window.dispatchEvent(
          new CustomEvent('coop-talent-loadout-picked', { detail: next }),
        );
        return next;
      });
      if (id === TALENT_RAISE_DEAD || id === TALENT_METEOR_STRIKE
          || id === TALENT_COLDSNAP_ROOM || id === TALENT_LIGHTNING_BOLT_ROOM
          || id === TALENT_AEGIS_ROOM) {
        const abilityId =
          id === TALENT_RAISE_DEAD ? 'RAISE_DEAD' :
          id === TALENT_METEOR_STRIKE ? 'METEOR_STRIKE' :
          id === TALENT_COLDSNAP_ROOM ? 'SCYTHE_E' :
          id === TALENT_AEGIS_ROOM ? 'AEGIS_ROOM' : 'SPEAR_R';
        setAbilityLoadout(abilityLoadout ? { ...abilityLoadout, R: abilityId } : { Q: null, E: null, R: abilityId });
      }
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
          setClassTalentPickedWeapons((prev) => {
            if (prev.has(classPickWeapon)) return prev;
            const next = new Set(prev);
            next.add(classPickWeapon);
            return next;
          });
        }
        if (coopMainArenaPortalPhase !== null) {
          clearCoopClearedRoomColor();
          setPortalsUnlocked(true);
        } else if (!combatArenaActive) {
          announceThroneEnterPortal();
        }
      }
      enqueueAnnouncement('UNLOCKED', REWARD_ANNOUNCEMENT_COLORS.unlocked, `boon-${id}`);
      window.audioSystem?.playUIInterface3Sound?.();
      setCoopBoon(null);
    },
    [clearCoopClearedRoomColor, coopMainArenaPortalPhase, combatArenaActive, setTalentLoadout, setAbilityLoadout, abilityLoadout, enqueueAnnouncement, announceThroneEnterPortal],
  );

  const handleWeaponAspectCycled = useCallback(
    (aspect: WeaponAspect) => {
      enqueueAnnouncement(
        getWeaponAspectLabel(aspect).toUpperCase(),
        REWARD_ANNOUNCEMENT_COLORS.unlocked,
        `weapon-aspect-${aspect}`,
      );
    },
    [enqueueAnnouncement],
  );

  useEffect(() => {
    return registerDeepSanctumRewardClaimedHandler((payload) => {
      if (payload.rewardKind === 'gold' && payload.goldGranted > 0) {
        window.audioSystem?.playUIGoldPickupSound?.();
        enqueueAnnouncement(
          `+${payload.goldGranted} GOLD`,
          REWARD_ANNOUNCEMENT_COLORS.gold,
          `deep-sanctum-gold-${payload.timestamp ?? Date.now()}`,
        );
      } else if (payload.rewardKind === 'stat') {
        const pts = payload.deepSanctumStatPoints || DEEP_SANCTUM_STAT_POINTS;
        grantStatPoints(pts);
        window.audioSystem?.playUIInterface3Sound?.();
        enqueueAnnouncement(
          `+${pts} STAT POINTS`,
          REWARD_ANNOUNCEMENT_COLORS.stat,
          `deep-sanctum-stat-${payload.timestamp ?? Date.now()}`,
        );
      } else if (payload.rewardKind === 'talent') {
        setTalentLoadout((prev) => {
          const pool = excludeOwnedTalentsFromBoonPool(
            buildClassBoonPoolForWeapon(selectedWeapons.primary, prev),
            prev,
          );
          const [id] = pickRandomDistinctFromPool(pool, 1);
          if (!id) {
            console.warn('Deep sanctum talent pool empty');
            return prev;
          }
          queueMicrotask(() => {
            if (
              id === TALENT_RAISE_DEAD
              || id === TALENT_METEOR_STRIKE
              || id === TALENT_COLDSNAP_ROOM
              || id === TALENT_LIGHTNING_BOLT_ROOM
              || id === TALENT_AEGIS_ROOM
            ) {
              const abilityId =
                id === TALENT_RAISE_DEAD ? 'RAISE_DEAD'
                : id === TALENT_METEOR_STRIKE ? 'METEOR_STRIKE'
                : id === TALENT_COLDSNAP_ROOM ? 'SCYTHE_E'
                : id === TALENT_AEGIS_ROOM ? 'AEGIS_ROOM'
                : 'SPEAR_R';
              setAbilityLoadout(
                abilityLoadoutRef.current
                  ? { ...abilityLoadoutRef.current, R: abilityId }
                  : { Q: null, E: null, R: abilityId },
              );
            }
          });
          return applyTalentIdToLoadout(prev, id);
        });
        enqueueAnnouncement('UNLOCKED', REWARD_ANNOUNCEMENT_COLORS.unlocked, `deep-sanctum-talent-${payload.timestamp ?? Date.now()}`);
        window.audioSystem?.playUIInterface3Sound?.();
      }
      setPortalsUnlocked(true);
    });
  }, [
    registerDeepSanctumRewardClaimedHandler,
    enqueueAnnouncement,
    grantStatPoints,
    selectedWeapons.primary,
    setTalentLoadout,
    setAbilityLoadout,
  ]);

  useEffect(() => {
    return registerMerchantPurchaseSuccessHandler(() => {
      enqueueAnnouncement('PURCHASED', REWARD_ANNOUNCEMENT_COLORS.purchased);
      window.audioSystem?.playUIInterface2Sound?.();
    });
  }, [registerMerchantPurchaseSuccessHandler, enqueueAnnouncement]);

  useEffect(() => {
    return registerMerchantPurchaseSuccessHandler((payload) => {
      if (payload.kind !== 'weapon_talent') return;
      setTalentLoadout((prev) => {
        const pool = excludeOwnedTalentsFromBoonPool(
          buildClassBoonPoolForWeapon(selectedWeapons.primary, prev),
          prev,
        );
        const [id] = pickRandomDistinctFromPool(pool, 1);
        if (!id) {
          console.warn('Merchant weapon talent pool empty');
          return prev;
        }
        queueMicrotask(() => {
          if (
            id === TALENT_RAISE_DEAD
            || id === TALENT_METEOR_STRIKE
            || id === TALENT_COLDSNAP_ROOM
            || id === TALENT_LIGHTNING_BOLT_ROOM
            || id === TALENT_AEGIS_ROOM
          ) {
            const abilityId =
              id === TALENT_RAISE_DEAD ? 'RAISE_DEAD'
              : id === TALENT_METEOR_STRIKE ? 'METEOR_STRIKE'
              : id === TALENT_COLDSNAP_ROOM ? 'SCYTHE_E'
              : id === TALENT_AEGIS_ROOM ? 'AEGIS_ROOM'
              : 'SPEAR_R';
            setAbilityLoadout(
              abilityLoadoutRef.current
                ? { ...abilityLoadoutRef.current, R: abilityId }
                : { Q: null, E: null, R: abilityId },
            );
          }
        });
        return applyTalentIdToLoadout(prev, id);
      });
    });
  }, [
    registerMerchantPurchaseSuccessHandler,
    selectedWeapons.primary,
    setTalentLoadout,
    setAbilityLoadout,
  ]);

  // Sync skill point data with control system
  useEffect(() => {
    if (controlSystem && skillPointData) {
      controlSystem.setSkillPointData(skillPointData);
    }
  }, [controlSystem, skillPointData]);

  const handleExperienceUpdate = useCallback((experience: number, level: number) => {
    setPlayerExperience(experience);
    setPlayerLevel(level);
    updateSkillPointsForLevel(level);
    updateStatPointsForLvl(level);
  }, [updateSkillPointsForLevel, updateStatPointsForLvl]);

  const handlePlayerLevelUp = useCallback((level: number) => {
    updateSkillPointsForLevel(level);
    updateStatPointsForLvl(level);
    enqueueAnnouncement(
      LEVEL_UP_ANNOUNCEMENT.title,
      LEVEL_UP_ANNOUNCEMENT.color,
      `level-up-${level}`,
    );
  }, [updateSkillPointsForLevel, updateStatPointsForLvl, enqueueAnnouncement]);

  const handleEssenceUpdate = useCallback((essence: number) => {
    setPlayerEssence(essence);
  }, []);

  const handleGoldUpdate = useCallback((gold: number) => {
    setPlayerGold(gold);
  }, []);

  const handleFlowUpdate = useCallback((flow: number) => {
    setPlayerFlow(flow);
  }, []);

  const handleFateUpdate = useCallback((fate: number) => {
    setPlayerFate(fate);
  }, []);

  useEffect(() => {
    if (!socket?.id || gameMode !== 'coop') return;
    const localPlayer = playersRef.current.get(socket.id);
    if (!localPlayer) return;
    if (typeof localPlayer.gold === 'number') setPlayerGold(localPlayer.gold);
    if (typeof localPlayer.flow === 'number') setPlayerFlow(localPlayer.flow);
    if (typeof localPlayer.fate === 'number') setPlayerFate(localPlayer.fate);
  }, [gameStarted, currentRoomId, socket?.id, gameMode, playersRef]);

  const refreshCoopBossSpawned = useCallback(() => {
    setCoopBossSpawned(
      Array.from(enemiesRef.current.values()).some(
        (e) => (e.type === 'boss' || e.type === 'boss2' || e.type === 'boss3' || e.type === 'destiny') && !e.isDying,
      ),
    );
  }, [enemiesRef]);

  // Sync localPurchasedItems from ref — avoids re-rendering on every player map update.
  useEffect(() => {
    const localPlayer = playersRef.current.get(socket?.id || '');
    if (!localPlayer) {
      const fallback = Array.from(playersRef.current.values()).find((p) => p.id);
      if (fallback?.purchasedItems) {
        setLocalPurchasedItems(fallback.purchasedItems);
      }
      return;
    }
    if (localPlayer.purchasedItems) {
      setLocalPurchasedItems(localPlayer.purchasedItems);
    }
  }, [merchantPurchaseState, currentRoomId, socket?.id, playersRef]);

  useEffect(() => {
    if (!socket) return;
    const onEnemyRosterChange = () => refreshCoopBossSpawned();
    socket.on('enemy-spawned', onEnemyRosterChange);
    socket.on('enemy-removed', onEnemyRosterChange);
    refreshCoopBossSpawned();
    return () => {
      socket.off('enemy-spawned', onEnemyRosterChange);
      socket.off('enemy-removed', onEnemyRosterChange);
    };
  }, [socket, currentRoomId, refreshCoopBossSpawned]);

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

  // Co-op BGM: throne prep track at run start, room-specific or random combat tracks,
  // chaos between rooms / after boss
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
      void audio.coopEnterThronePrepMusic();
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
      void audio.coopEnterCombatRoomMusic(coopCurrentRoomKind, {
        bossThroneArena: coopBossThroneArena,
      });
    }
  }, [
    sessionGameMode,
    gameStarted,
    combatArenaActive,
    coopMainArenaIntermissionSeq,
    coopCombatArenaEnterSeq,
    coopBossClearedBgmSeq,
    coopCurrentRoomKind,
    coopBossThroneArena,
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
      if (
        coopMainArenaPortalPhase !== 'pick_trinity_finale'
        && claimRewardAnnouncedSeqRef.current !== coopMainArenaIntermissionSeq
      ) {
        claimRewardAnnouncedSeqRef.current = coopMainArenaIntermissionSeq;
        const { title, color } = GUIDE_ANNOUNCEMENTS.claimReward;
        enqueueAnnouncement(title, color, `claim-${coopMainArenaIntermissionSeq}`);
      }
    }

    prevCoopMainArenaPortalPhaseRef.current = coopMainArenaPortalPhase;
  }, [
    sessionGameMode,
    gameStarted,
    combatArenaActive,
    coopMainArenaPortalPhase,
    coopMainArenaIntermissionSeq,
    enqueueAnnouncement,
  ]);

  // Pre-boss sequence: boss portal appears after merchant — no pedestal reward at pick_boss.
  // Trinity finale: yellow void appears after clear — no pedestal reward.
  useEffect(() => {
    if (gameMode !== 'coop') return;
    if (coopMainArenaPortalPhase === 'pick_boss' || coopMainArenaPortalPhase === 'pick_trinity_finale') {
      setPortalsUnlocked(true);
    }
  }, [gameMode, coopMainArenaPortalPhase]);

  useEffect(() => {
    const wasUnlocked = prevPortalsUnlockedRef.current;
    prevPortalsUnlockedRef.current = portalsUnlocked;
    if (
      sessionGameMode === 'coop' &&
      combatArenaActive &&
      !wasUnlocked &&
      portalsUnlocked &&
      coopMainArenaIntermissionSeq > 0
    ) {
      // Merchant (Avernus) has no gateway choice prompt — boss portal is already visible pre-boss.
      if (
        coopCurrentRoomKind === 'merchant'
        || coopMainArenaPortalPhase === 'pre_boss_merchant'
      ) {
        return;
      }
      if (coopMainArenaPortalPhase === 'pick_sunken_entry') {
        const { title, color } = GUIDE_ANNOUNCEMENTS.descendPortal;
        enqueueAnnouncement(title, color, `sunken-entry-${coopMainArenaIntermissionSeq}`);
      } else if (
        coopMainArenaPortalPhase === 'pick_eternity_entry'
        || coopMainArenaPortalPhase === 'pick_eternity_late_entry'
      ) {
        const { title, color } = GUIDE_ANNOUNCEMENTS.descendPortal;
        enqueueAnnouncement(title, color, `eternity-entry-${coopMainArenaIntermissionSeq}`);
      } else if (coopMainArenaPortalPhase === 'pick_trinity_finale') {
        const { title, color } = GUIDE_ANNOUNCEMENTS.descendVoid;
        enqueueAnnouncement(title, color, `trinity-finale-${coopMainArenaIntermissionSeq}`);
      } else {
        announceChooseGateway(coopMainArenaIntermissionSeq);
      }
    }
  }, [
    portalsUnlocked,
    combatArenaActive,
    sessionGameMode,
    coopMainArenaIntermissionSeq,
    coopMainArenaPortalPhase,
    coopCurrentRoomKind,
    announceChooseGateway,
    enqueueAnnouncement,
  ]);

  useEffect(() => {
    return registerBossDefeatedHandler((payload) => {
      const label = payload.slainLabel;
      if (!label || !(label in BOSS_SLAIN_ANNOUNCEMENTS)) return;
      const announcement = BOSS_SLAIN_ANNOUNCEMENTS[label as BossSlainLabel];
      enqueueAnnouncement(
        announcement.title,
        announcement.color,
        `slain-${label}-${payload.bossId ?? Date.now()}`,
      );
    });
  }, [registerBossDefeatedHandler, enqueueAnnouncement]);

  useEffect(() => {
    return registerBossItemPickupHandler(({ label, rarity }) => {
      const color =
        rarity && isItemRarity(rarity)
          ? ITEM_RARITY_COLORS[rarity]
          : '#eab308';
      enqueueAnnouncement(
        `PICKED UP ${label.toUpperCase()}`,
        color,
        `pickup-${label}-${Date.now()}`,
      );
    });
  }, [registerBossItemPickupHandler, enqueueAnnouncement]);

  useEffect(() => {
    return registerRunePickupHandler(({ stat }) => {
      const { title, color } = buildRunePickupAnnouncement(stat);
      enqueueAnnouncement(title, color, `rune-${stat}-${Date.now()}`);
    });
  }, [registerRunePickupHandler, enqueueAnnouncement]);

  const pvpMerchantItems = [
    {
      id: 'damage_boost',
      name: 'Damage Boost',
      description: 'Permanently increases your weapon damage by 15%',
      cost: 75,
      currency: 'essence' as const,
    },
    {
      id: 'ascendant_wings',
      name: 'Ascendant Wings',
      description: 'Beautiful angelic wings that replace your dragon wings with a celestial appearance',
      cost: 50,
      currency: 'essence' as const,
    },
  ];

  const uiBlocksGameInput =
    (gameMode === 'pvp' && showMerchantUI) ||
    showRulesPanel ||
    defeatDialogOpen ||
    throneAbilityWeapon !== null ||
    throneTalentWeapon !== null ||
    coopBoon !== null ||
    sunkenLootModalOpen;
    eternityLootModalOpen;
    eternityPetUpgradeModalOpen;

  return (
      <main className="w-full h-screen bg-black relative">
        {showRulesPanel && (
          <RulebookPanel onClose={() => setShowRulesPanel(false)} />
        )}

        {showCanvas && (
          <Canvas
            camera={CANVAS_CAMERA}
            {...(ENABLE_REALTIME_SHADOWS ? { shadows: true as const } : {})}
            dpr={[1, 1.5]}
            gl={CANVAS_GL}
          >
            <Suspense fallback={null}>
              {(gameMode === 'pvp' || gameMode === 'coop') && (
                <CoopGameScene
                  onDamageNumbersUpdate={handleDamageNumbersUpdate}
                  onDamageNumberComplete={handleDamageNumberComplete}
                  onCameraUpdate={handleCameraUpdate}
                  onGameStateUpdate={handleGameStateUpdate}
                  onControlSystemUpdate={handleControlSystemUpdate}
                  onExperienceUpdate={handleExperienceUpdate}
                  onPlayerLevelUp={handlePlayerLevelUp}
                  onEssenceUpdate={handleEssenceUpdate}
                  onGoldUpdate={handleGoldUpdate}
                  onFlowUpdate={handleFlowUpdate}
                  onFateUpdate={handleFateUpdate}
                  onMerchantUIUpdate={setShowMerchantUI}
                  onSceneReady={handleSceneReady}
                  selectedWeapons={selectedWeapons}
                  skillPointData={skillPointData}
                  statPointData={statPointData}
                  abilityLoadout={abilityLoadout}
                  throneAbilityModalOpen={
                    throneAbilityWeapon !== null || throneTalentWeapon !== null || coopBoon !== null || sunkenLootModalOpen || eternityLootModalOpen || eternityPetUpgradeModalOpen
                  }
                  uiBlocksGameInput={uiBlocksGameInput}
                  onRequestThroneAbilityModal={handleRequestThroneAbilityModal}
                  onRequestThroneTalentModal={handleRequestThroneTalentModal}
                  onThroneWeaponEquipped={handleThroneWeaponEquipped}
                  canCycleWeaponAspect={
                    selectedWeapons.primary !== WeaponType.NONE &&
                    classTalentPickedWeapons.has(selectedWeapons.primary)
                  }
                  onWeaponAspectCycled={handleWeaponAspectCycled}
                  throneDevTalentShortcutEnabled={DEV_TALENT_MODAL}
                  pedestalBoonReady={
                    (
                      coopMainArenaPortalPhase !== null
                      && coopMainArenaPortalPhase !== 'pick_boss'
                      && coopMainArenaPortalPhase !== 'pre_boss_merchant'
                      && coopMainArenaPortalPhase !== 'pick_trinity_finale'
                      && coopCurrentRoomKind !== 'merchant'
                      && !pedestalInteracted
                    )
                    || (
                      coopCurrentRoomKind === 'deep_sanctum'
                      && deepSanctumRewardKind != null
                      && !pedestalInteracted
                    )
                  }
                  portalsUnlocked={portalsUnlocked}
                  onCombatArenaPedestalInteract={handleCombatArenaPedestalInteract}
                  onSunkenSentinelInteract={handleSunkenSentinelInteract}
                  onEternityPalaceArchitectInteract={handleEternityPalaceArchitectInteract}
                  onInteractHintChange={onCoopInteractHintChange}
                  onLocalPlayerDefeated={onLocalPlayerDefeated}
                  onLocalPlayerRevived={onLocalPlayerRevived}
                  extraDashChargePurchased={merchantPurchaseState.dashChargePurchased}
                />
              )}
            </Suspense>
          </Canvas>
        )}
      
        {/* UI Overlay - Only show during gameplay */}
        {gameMode !== 'menu' && (
          <>
            <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2" data-block-game-input>
              {gameMode === 'coop' && <ChatUI isVisible />}
              {(gameMode === 'pvp' || gameMode === 'coop') && (
                <StatsPanel
                  statPointData={statPointData}
                  onAllocateStat={allocateStatPoint}
                  playerLevel={playerLevel}
                  inventory={inventory}
                  talentLoadout={talentLoadout}
                  abilityLoadout={abilityLoadout}
                  criticalChance={getCriticalChance()}
                  criticalDamageMultiplier={getCriticalDamageMultiplier()}
                />
              )}
              {gameMode === 'coop' && (
                <CurrencyPanel
                  gold={playerGold}
                  flow={playerFlow}
                  fate={playerFate}
                />
              )}
              {gameMode === 'pvp' && (
                <div className="flex items-center gap-2">
                  <EssenceDisplay essence={playerEssence} isLocalPlayer />
                </div>
              )}
            </div>
            
            {/* Performance Stats */}
            <div className="absolute top-4 right-4 flex flex-col items-end text-white font-mono text-sm" data-block-game-input>
              <div id="fps-counter" className="text-right">FPS: --</div>
              {isDevPerformanceHudEnabled() && <DevPerformanceMeter />}

              {sessionGameMode === 'coop' && (
                <HudActionButtons
                  onOpenRulebook={() => setShowRulesPanel(true)}
                  onOpenControls={handleOpenControlsTutorial}
                />
              )}

              {gameMode === 'pvp' && (
                <div className="mt-2 text-right text-red-400">
                  <div>PVP Mode</div>
                </div>
              )}
            </div>
            
            <CombatOverlay callbacksRef={combatOverlayCallbacksRef} />
            <MerchantShopTooltipOverlay />
            <PlayerDamageFeedbackOverlay />

            <DefeatRetryDialog open={defeatDialogOpen} />

            {/* Game UI - Outside Canvas */}
            <div className="absolute bottom-4 left-4" data-block-game-input>
              <GameUI
                key={`gameui-${localPurchasedItems.length}-${localPurchasedItems.join(',')}`}
                currentWeapon={controlSystem?.getCurrentWeapon() || selectedWeapons.primary || gameState.currentWeapon}
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
                talentLoadout={talentLoadout}
                interactHint={gameMode === 'coop' ? coopInteractHint : null}
                gameMode={gameMode}
                selectedArchetype={selectedArchetype}
                weaponAspect={selectedWeaponAspect}
                coopIntroAllyChoiceMade={coopIntroAllyChoiceMade}
                coopAllyKind={coopAllyKind}
                coopFaeBeastCompanionGranted={coopFaeBeastCompanionGranted}
                coopFaeBeastCompanionKind={coopFaeBeastCompanionKind}
                coopPetPackWolfActive={coopPetCompanionUpgrade === 'wolf_pack_expansion'}
              />
            </div>

            {/* Bottom-left HUD stack: DPS, Status, Inventory */}
            <div
              className="fixed bottom-4 left-4 z-40 flex flex-col items-start gap-2"
              data-block-game-input
            >
              <DpsMeter
                currentDps={dpsSnapshot.currentDps}
                totalDamage={dpsSnapshot.totalDamage}
                onClear={handleClearDpsData}
              />
              {(gameMode === 'pvp' || gameMode === 'coop') && (
                <>
                  <PlayerStatusHud
                    playerHealth={gameState.playerHealth}
                    maxHealth={gameState.maxHealth}
                    playerShield={gameState.playerShield}
                    maxShield={gameState.maxShield}
                    playerEnergy={gameState.playerEnergy}
                    maxEnergy={gameState.maxEnergy}
                    playerExperience={playerExperience}
                    playerLevel={playerLevel}
                    selectedArchetype={selectedArchetype}
                  />
                  <InventoryPanel inventory={inventory} />
                </>
              )}
            </div>

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
                onReroll={handleCoopBoonReroll}
                rerollCost={combatArenaActive ? BOON_REROLL_FATE_COST : 0}
                fateBalance={playerFate}
                coopAllyKind={coopAllyKind}
              />
            )}

            {gameMode === 'coop'
              && sunkenLootModalOpen
              && coopSunkenLootOffer.length > 0
              && !(socket?.id && coopSunkenLootClaimedPlayerIds.includes(socket.id)) && (
              <CoopBossLootPickerModal
                options={coopSunkenLootOffer}
                inventory={inventory}
                onPick={handleSunkenLootPick}
                onClose={() => setSunkenLootModalOpen(false)}
              />
            )}

            {gameMode === 'coop'
              && eternityPetUpgradeModalOpen
              && coopFaeBeastCompanionGranted
              && !!coopFaeBeastCompanionKind
              && !(socket?.id && coopEternityLootClaimedPlayerIds.includes(socket.id)) && (
              <CoopPetCompanionUpgradeModal
                beastKind={coopFaeBeastCompanionKind}
                options={getPetCompanionUpgradeOptionsForKind(coopFaeBeastCompanionKind)}
                onPick={handleEternityPetUpgradePick}
                onClose={() => setEternityPetUpgradeModalOpen(false)}
              />
            )}

            {gameMode === 'coop'
              && eternityLootModalOpen
              && coopEternityLootOffer.length > 0
              && !(socket?.id && coopEternityLootClaimedPlayerIds.includes(socket.id)) && (
              <CoopBossLootPickerModal
                options={coopEternityLootOffer}
                inventory={inventory}
                onPick={handleEternityLootPick}
                onClose={() => setEternityLootModalOpen(false)}
              />
            )}

            {/* Merchant UI */}
            {gameMode === 'pvp' && (
              <MerchantUI
                isVisible={showMerchantUI}
                items={pvpMerchantItems}
                balance={playerEssence}
                balanceLabel="essence"
                onClose={() => setShowMerchantUI(false)}
                onPurchase={(itemId) => {
                  const item = pvpMerchantItems.find(item => item.id === itemId);
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

        {/* Loading Screen - initial game boot only; portal transitions use PortalBlinkTransition */}
        <LoadingScreen
          isVisible={isGameLoading && !coopTransitionOverlay}
          sceneBootstrapReady={loadingSceneBootstrapReady}
          onFadeComplete={() => {
            setIsGameLoading(false);
            if (sessionGameMode === 'coop' && !combatArenaActiveRef.current && !lateJoinLoadoutHandledRef.current) {
              queueRoomTitleAnnouncement('throne', null, 'throne-start');
              const { title, color } = GUIDE_ANNOUNCEMENTS.chooseWeapon;
              enqueueAnnouncementAfter(
                ROOM_TITLE_ANNOUNCEMENT_MS,
                title,
                color,
                'throne-choose-weapon',
              );
              setControlsTutorialAutoDismiss(true);
              setControlsTutorialVisible(true);
            }
          }}
        />

        <PortalBlinkTransition
          active={coopTransitionOverlay}
          triggerSeq={coopPortalBlinkSeq}
          sceneReadySeq={coopCombatArenaEnterSeq}
          onComplete={() => {
            confirmCoopPortalTransitionComplete();
            hideCoopPortalTransition();
            const roomKind = coopCurrentRoomKindRef.current;
            if (roomKind) {
              const visitIndex = roomKind === 'boss'
                ? coopBossRoomVisitIndexRef.current
                : roomKind === 'intro'
                  ? coopIntroRoomIndexRef.current
                  : roomKind === 'fae_realm'
                    ? coopFaeRealmRoomIndexRef.current
                  : roomKind === 'sunken_temple'
                    ? coopSunkenRoomIndexRef.current
                    : roomKind === 'eternity_palace'
                      ? coopEternityRoomIndexRef.current
                    : roomKind === 'deep_sanctum'
                    ? coopDeepSanctumLevelRef.current
                    : coopColoredRoomVisitIndexRef.current;
              queueRoomTitleAnnouncement(
                roomKind,
                visitIndex,
                coopCombatArenaEnterSeq,
              );
            }
          }}
        />

        {sessionGameMode === 'coop' && roomTitleAnnouncement && (
          <RoomTitleAnnouncement
            triggerKey={roomTitleAnnouncement.triggerKey}
            title={roomTitleAnnouncement.title}
            color={roomTitleAnnouncement.color}
          />
        )}

        {sessionGameMode === 'coop' && controlsTutorialVisible && (
          <ControlsTutorialOverlay
            key={controlsTutorialKey}
            visible={controlsTutorialVisible}
            autoDismiss={controlsTutorialAutoDismiss}
            animationKey={controlsTutorialKey}
            onDismiss={() => setControlsTutorialVisible(false)}
          />
        )}

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
