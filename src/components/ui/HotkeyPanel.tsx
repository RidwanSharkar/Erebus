import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import { SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import {
  universalAbilityPool,
  getUniversalAbilityById,
  getPrimaryAttackForWeapon,
  type AbilityLoadout,
  type UniversalAbility,
} from '@/utils/weaponAbilities';
import type { TalentId, TalentLoadout } from '@/utils/talents';
import { partitionTalentsForHud } from '@/utils/talents';
import { getWeaponHudIconSrc } from '@/utils/weaponIcons';
import {
  HotkeyTooltip,
  TalentSlot,
  TALENT_SLOT_PX,
  getTalentTooltipContent,
  type TooltipContent,
} from './hotkeyTalentSlot';

const MAX_VISIBLE_TALENTS = 6;
const TALENT_GAP_PX = 8; // gap-2
const TALENT_SCROLL_STEP_PX = TALENT_SLOT_PX + TALENT_GAP_PX;

interface HotkeyPanelProps {
  currentWeapon: WeaponType;
  controlSystem?: any;
  selectedWeapons?: {
    primary: WeaponType;
    secondary: WeaponType;
  } | null;
  onWeaponSwitch?: (slot: 1 | 3) => void;
  skillPointData?: SkillPointData;
  abilityLoadout?: AbilityLoadout | null;
  onUnlockAbility?: (unlock: AbilityUnlock) => void;
  purchasedItems?: string[];
  talentLoadout?: TalentLoadout | null;
}

interface WeaponData {
  name: string;
  type: WeaponType;
  key: '1' | '2' | '3';
  icon: string;
}

interface TooltipProps {
  content: TooltipContent;
  visible: boolean;
  x: number;
  y: number;
}

function Tooltip({ content, visible, x, y }: TooltipProps) {
  return <HotkeyTooltip content={content} visible={visible} x={x} y={y} />;
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

export default function HotkeyPanel({
  currentWeapon,
  controlSystem,
  selectedWeapons,
  onWeaponSwitch,
  skillPointData,
  abilityLoadout,
  onUnlockAbility,
  purchasedItems = [],
  talentLoadout = null,
}: HotkeyPanelProps) {
  const [tooltipContent, setTooltipContent] = useState<{
    name: string;
    description: string;
  } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [weaponSwitchCooldown, setWeaponSwitchCooldown] = useState<{ current: number; max: number }>({ current: 0, max: 5 });
  const talentScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Define selected weapons for switching (only show 1, 2, and 3 keys)
  const weapons: WeaponData[] = [];

  if (selectedWeapons) {
    // Primary weapon - key 1
    const primaryWeapon = {
      name: selectedWeapons.primary === WeaponType.NONE ? 'Unarmed' :
            selectedWeapons.primary === WeaponType.SWORD ? 'Sword' :
            selectedWeapons.primary === WeaponType.BOW ? 'Bow' :
            selectedWeapons.primary === WeaponType.SCYTHE ? 'Scythe' :
            selectedWeapons.primary === WeaponType.SABRES ? 'Sabres' :
            selectedWeapons.primary === WeaponType.RUNEBLADE ? 'Runeblade' :
            selectedWeapons.primary === WeaponType.SPEAR ? 'Spear' : 'Unknown',
      type: selectedWeapons.primary,
      key: '1' as const,
      icon: selectedWeapons.primary === WeaponType.NONE ? '✦' :
            selectedWeapons.primary === WeaponType.SWORD ? '💎' :
            selectedWeapons.primary === WeaponType.BOW ? '🏹' :
            selectedWeapons.primary === WeaponType.SCYTHE ? '🦋' :
            selectedWeapons.primary === WeaponType.SABRES ? '⚔️' :
            selectedWeapons.primary === WeaponType.RUNEBLADE ? '⚜️' :
            selectedWeapons.primary === WeaponType.SPEAR ? '🔱' : '❓'
    };
    weapons.push(primaryWeapon);


    // Purchased items - key 3 (takes precedence over tertiary weapon)
    if (purchasedItems.length > 0) {
      // Show the first purchased item in the 3 slot
      const firstPurchasedItem = purchasedItems[0];
      let itemName = 'Unknown Item';
      let itemIcon = '🎁';

      if (firstPurchasedItem === 'damage_boost') {
        itemName = 'Damage Boost';
        itemIcon = '💪';
      } else if (firstPurchasedItem === 'ascendant_wings') {
        itemName = 'Ascendant Wings';
        itemIcon = '🕊️';
      }

      const purchasedItemSlot = {
        name: itemName,
        type: WeaponType.SWORD, // Use sword as placeholder since we need a WeaponType
        key: '3' as const,
        icon: itemIcon,
        isPurchasedItem: true // Custom flag to identify this is a purchased item
      };
      weapons.push(purchasedItemSlot);
    }
  }

  // Resolve the 3 assigned abilities from the loadout
  const loadoutAbilities: Array<{ slot: 'Q' | 'E' | 'R'; ability: UniversalAbility | null }> = (
    ['Q', 'E', 'R'] as const
  ).map(slot => ({
    slot,
    ability: abilityLoadout?.[slot] ? (getUniversalAbilityById(abilityLoadout[slot]!) ?? null) : null
  }));

  // Resolve the passive ability from the loadout (no hotkey, shown without a key badge)
  const passiveAbility: UniversalAbility | null = abilityLoadout?.passive
    ? (getUniversalAbilityById(abilityLoadout.passive) ?? null)
    : null;

  const { primaryRoomBoons, otherRoomBoons } = useMemo(
    () =>
      talentLoadout
        ? partitionTalentsForHud(talentLoadout, currentWeapon, abilityLoadout)
        : { primaryRoomBoons: [], otherRoomBoons: [], classTalents: [], duoBoons: [] },
    [talentLoadout, currentWeapon, abilityLoadout]
  );

  const totalRoomBoonCount = primaryRoomBoons.length + otherRoomBoons.length;
  const maxScrollableTalents = Math.max(0, MAX_VISIBLE_TALENTS - primaryRoomBoons.length);
  const needsTalentScroll = otherRoomBoons.length > maxScrollableTalents;

  const updateTalentScrollButtons = useCallback(() => {
    const el = talentScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  const scrollTalentLeft = useCallback(() => {
    talentScrollRef.current?.scrollBy({ left: -TALENT_SCROLL_STEP_PX, behavior: 'smooth' });
  }, []);

  const scrollTalentRight = useCallback(() => {
    talentScrollRef.current?.scrollBy({ left: TALENT_SCROLL_STEP_PX, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = talentScrollRef.current;
    if (!el || !needsTalentScroll) return;
    el.scrollLeft = 0;
    updateTalentScrollButtons();
  }, [otherRoomBoons, needsTalentScroll, updateTalentScrollButtons]);

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
    ability: UniversalAbility
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
    const isPurchasedItem = (weapon as { isPurchasedItem?: boolean }).isPurchasedItem;

    if (weapon.key === '1' && !isPurchasedItem) {
      const primaryAttack = getPrimaryAttackForWeapon(weapon.type, {
        passiveAbilityId: abilityLoadout?.passive,
        talentLoadout,
      });
      setTooltipContent({
        name: primaryAttack?.name ?? weapon.name,
        description: primaryAttack?.description ?? `Wielding the ${weapon.name}`,
      });
    } else {
      setTooltipContent({
        name: weapon.name,
        description: isPurchasedItem ? `Equipped: ${weapon.name}` : `Wielding the ${weapon.name}`,
      });
    }

    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, [abilityLoadout?.passive, talentLoadout]);

  const handleAbilityLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  const handleTalentHover = useCallback((e: React.MouseEvent, talentId: TalentId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent(getTalentTooltipContent(talentId));
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const talentArrowButtonStyle = (enabled: boolean): React.CSSProperties => ({
    background: 'rgba(18,18,34,0.97)',
    border: enabled ? '1px solid rgba(120,120,160,0.5)' : '1px solid rgba(80,80,100,0.25)',
    color: enabled ? 'rgba(200,200,220,0.9)' : 'rgba(120,120,140,0.4)',
    boxShadow: enabled ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? 'pointer' : 'default',
  });

  const scrollableTalentMaxWidthPx =
    maxScrollableTalents * TALENT_SLOT_PX +
    Math.max(0, maxScrollableTalents - 1) * TALENT_GAP_PX;

  // Always render even without a loadout (shows empty slots)


  return (
    <>
      <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40">
        <div
          className="backdrop-blur-md px-4 pt-5 pb-3"
          style={{
            background:
              'linear-gradient(180deg, rgba(8,8,20,0.78) 0%, rgba(4,4,14,0.90) 100%)',
            borderTop: '1px solid rgba(255,255,255,0.09)',
            borderLeft: '1px solid rgba(255,255,255,0.05)',
            borderRight: '1px solid rgba(255,255,255,0.05)',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            clipPath:
              'polygon(10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% 100%, 0% 100%, 0% 10px)',
            boxShadow:
              '0 -1px 0 rgba(255,255,255,0.05), 0 8px 32px rgba(0,0,0,0.55)',
          }}
        >
          <div className="flex flex-nowrap items-center justify-center gap-2">
            {/* Weapon Icons */}
            {weapons.map((weapon) => {
              const isCurrentWeapon = weapon.type === currentWeapon;
              const isOnCooldown = weaponSwitchCooldown.current > 0;
              const cooldownPercentage = weaponSwitchCooldown.max > 0 ? (weaponSwitchCooldown.current / weaponSwitchCooldown.max) * 100 : 0;

              const handleWeaponClick = useCallback(() => {
                // Don't allow clicking on purchased items
                if ((weapon as any).isPurchasedItem) return;

                if (!isOnCooldown && onWeaponSwitch) {
                  const slot = weapon.key === '1' ? 1 : 3;
                  onWeaponSwitch(slot as 1 | 3);
                }
              }, [isOnCooldown, onWeaponSwitch, weapon.key, weapon]);

              const isPurchased = (weapon as any).isPurchasedItem;
              const slotBorder = isPurchased
                ? '1px solid rgba(192,132,252,0.7)'
                : isCurrentWeapon
                  ? '1px solid rgba(251,191,36,0.85)'
                  : isOnCooldown
                    ? '1px solid rgba(239,68,68,0.55)'
                    : '1px solid rgba(100,100,130,0.38)';
              const slotBg = isPurchased
                ? 'linear-gradient(135deg, rgba(88,28,135,0.45), rgba(60,10,100,0.3))'
                : isCurrentWeapon
                  ? 'linear-gradient(135deg, rgba(120,80,0,0.45), rgba(80,50,0,0.25))'
                  : isOnCooldown
                    ? 'rgba(60,10,10,0.55)'
                    : 'rgba(10,10,22,0.82)';
              const slotShadow = isPurchased
                ? '0 0 14px rgba(192,132,252,0.35), inset 0 1px 0 rgba(255,255,255,0.07)'
                : isCurrentWeapon
                  ? '0 0 14px rgba(251,191,36,0.4), inset 0 1px 0 rgba(255,255,255,0.1)'
                  : 'inset 0 1px 0 rgba(255,255,255,0.05)';
              const iconColor = isPurchased
                ? '#d8b4fe'
                : isCurrentWeapon
                  ? '#fbbf24'
                  : isOnCooldown
                    ? '#f87171'
                    : '#9ca3af';

              return (
                <div
                  key={weapon.key}
                  className={`relative w-12 h-12 rounded-lg transition-all duration-200 flex items-center justify-center ${isPurchased ? 'cursor-default' : 'cursor-pointer'}`}
                  style={{ background: slotBg, border: slotBorder, boxShadow: slotShadow }}
                  onClick={handleWeaponClick}
                  onMouseEnter={(e) => handleWeaponHover(e, weapon)}
                  onMouseLeave={handleAbilityLeave}
                >
                  {/* Key badge — centered above */}
                  <div
                    className={`absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full py-px font-mono font-bold ${
                      weapon.key === '1' && !isPurchased ? 'px-1.5 text-[8px]' : 'px-2 text-[10px]'
                    }`}
                    style={{
                      background: 'rgba(18,18,34,0.97)',
                      border: '1px solid rgba(120,120,160,0.5)',
                      color: 'rgba(200,200,220,0.9)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {weapon.key === '1' && !isPurchased ? 'L-C' : weapon.key}
                  </div>

                  {/* Weapon icon */}
                  {(() => {
                    const iconSrc = getWeaponHudIconSrc(weapon.type);
                    if (iconSrc) {
                      return (
                        <img
                          src={iconSrc}
                          alt=""
                          className="h-7 w-7 object-contain"
                          style={{
                            filter: isCurrentWeapon
                              ? 'drop-shadow(0 0 6px rgba(251,191,36,0.6))'
                              : isOnCooldown
                                ? 'opacity(0.65)'
                                : undefined,
                          }}
                        />
                      );
                    }
                    return (
                      <div
                        className="text-xl"
                        style={{
                          filter: isCurrentWeapon ? 'drop-shadow(0 0 6px rgba(251,191,36,0.6))' : undefined,
                          color: iconColor,
                        }}
                      >
                        {weapon.icon}
                      </div>
                    );
                  })()}

                  {/* Cooldown overlay */}
                  {isOnCooldown && (
                    <>
                      <div className="absolute inset-0 rounded-lg" style={{ background: 'rgba(0,0,0,0.58)' }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          className="text-white text-sm font-bold tabular-nums"
                          style={{ textShadow: '0 1px 4px rgba(0,0,0,1)' }}
                        >
                          {Math.ceil(weaponSwitchCooldown.current)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}

            {/* Separator */}
            <div className="flex flex-col items-center justify-center gap-1.5 px-0.5">
              <div className="w-px h-3 rounded" style={{ background: 'rgba(120,120,160,0.3)' }} />
              <span className="text-[9px]" style={{ color: 'rgba(120,120,160,0.55)' }}>◆</span>
              <div className="w-px h-3 rounded" style={{ background: 'rgba(120,120,160,0.3)' }} />
            </div>

            {/* Passive Ability Icon — no hotkey, displayed after Q/E/R */}
            {passiveAbility && (
              <div
                className="relative w-12 h-12 rounded-lg flex items-center justify-center cursor-default"
                style={{
                  background: 'linear-gradient(135deg, rgba(60,10,100,0.45), rgba(30,5,60,0.3))',
                  border: '1px solid rgba(167,139,250,0.6)',
                  boxShadow: '0 0 12px rgba(167,139,250,0.3), inset 0 1px 0 rgba(255,255,255,0.07)',
                }}
                onMouseEnter={(e) => handleAbilityHover(e, passiveAbility)}
                onMouseLeave={handleAbilityLeave}
              >
                {/* "P" badge */}
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-1.5 py-px text-[10px] font-mono font-bold"
                  style={{
                    background: 'rgba(18,18,34,0.97)',
                    border: '1px solid rgba(167,139,250,0.45)',
                    color: 'rgba(196,181,253,0.9)',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  P
                </div>
                <div
                  className="w-7 h-7 rounded flex items-center justify-center text-base font-bold"
                  style={{ color: '#c4b5fd', filter: 'drop-shadow(0 0 5px rgba(167,139,250,0.6))' }}
                >
                  {passiveAbility.icon}
                </div>
              </div>
            )}

            {/* Ability Icons — driven by abilityLoadout (Q / E / R) */}
            {loadoutAbilities.map(({ slot, ability }) => {
              const cdSlot = controlSystem?.getAbilityCooldowns?.()?.[slot];
              const currentCooldown = cdSlot?.current ?? (cooldowns[slot] || 0);
              const isOnCooldown = currentCooldown > 0;
              const showChargeStacks =
                cdSlot?.charges != null && cdSlot.maxCharges != null && cdSlot.maxCharges > 1;

              // Determine active / charging state from controlSystem
              const getActiveOverlay = (): React.ReactNode => {
                if (!controlSystem) return null;
                const abilityCooldowns = controlSystem.getAbilityCooldowns?.() ?? {};
                const cd = abilityCooldowns[slot];

                if (cd?.isActive) {
                  return <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />;
                }

                // Ability-specific charge progress overlays (resolved from ability id)
                const id = abilityLoadout?.[slot];
                if (id === 'BOW_R' && controlSystem.isViperStingChargingActive?.()) {
                  const p = controlSystem.getViperStingChargeProgress?.() || 0;
                  return <div className="absolute inset-0 rounded-lg bg-purple-400 bg-opacity-20 border-2 border-purple-400"><div className="absolute bottom-0 left-0 right-0 bg-purple-400 bg-opacity-60 transition-all duration-100" style={{ height: `${p * 100}%` }} /></div>;
                }
                if (id === 'BOW_Q' && controlSystem.isBarrageChargingActive?.()) {
                  const p = controlSystem.getBarrageChargeProgress?.() || 0;
                  return <div className="absolute inset-0 rounded-lg bg-orange-400 bg-opacity-20 border-2 border-orange-400"><div className="absolute bottom-0 left-0 right-0 bg-orange-400 bg-opacity-60 transition-all duration-100" style={{ height: `${p * 100}%` }} /></div>;
                }
                if (id === 'BOW_E' && controlSystem.isCobraShotChargingActive?.()) {
                  const p = controlSystem.getCobraShotChargeProgress?.() || 0;
                  return <div className="absolute inset-0 rounded-lg bg-green-400 bg-opacity-20 border-2 border-green-400"><div className="absolute bottom-0 left-0 right-0 bg-green-400 bg-opacity-60 transition-all duration-100" style={{ height: `${p * 100}%` }} /></div>;
                }
                if (id === 'SABRES_R' && controlSystem.isSkyfallActive?.()) {
                  return <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />;
                }
                if (id === 'RUNEBLADE_Q' && controlSystem.isDeflectActive?.()) {
                  return <div className="absolute inset-0 rounded-lg bg-yellow-400 bg-opacity-20 border-2 border-yellow-400 animate-pulse" />;
                }
                if (id === 'SPEAR_Q' && controlSystem.isThrowSpearChargingActive?.()) {
                  const p = controlSystem.getThrowSpearChargeProgress?.() || 0;
                  return <div className="absolute inset-0 rounded-lg bg-blue-400 bg-opacity-20 border-2 border-blue-400"><div className="absolute bottom-0 left-0 right-0 bg-blue-400 bg-opacity-60 transition-all duration-100" style={{ height: `${p * 100}%` }} /></div>;
                }
                if (id === 'SPEAR_E' && controlSystem.isWhirlwindChargingActive?.()) {
                  const p = controlSystem.getWhirlwindChargeProgress?.() || 0;
                  return <div className="absolute inset-0 rounded-lg bg-cyan-400 bg-opacity-20 border-2 border-cyan-400"><div className="absolute bottom-0 left-0 right-0 bg-cyan-400 bg-opacity-60 transition-all duration-100" style={{ height: `${p * 100}%` }} /></div>;
                }
                return null;
              };

              const abilityBorder = !ability
                ? '1px dashed rgba(80,80,100,0.4)'
                : isOnCooldown
                  ? '1px solid rgba(239,68,68,0.5)'
                  : '1px solid rgba(52,211,153,0.55)';
              const abilityBg = !ability
                ? 'rgba(10,10,20,0.6)'
                : isOnCooldown
                  ? 'rgba(50,8,8,0.55)'
                  : 'linear-gradient(135deg, rgba(6,40,28,0.55), rgba(4,25,18,0.4))';
              const abilityShadow = !ability
                ? 'none'
                : isOnCooldown
                  ? 'inset 0 1px 0 rgba(255,255,255,0.04)'
                  : '0 0 10px rgba(52,211,153,0.2), inset 0 1px 0 rgba(255,255,255,0.07)';
              const abilityIconColor = !ability
                ? 'rgba(80,80,100,0.5)'
                : isOnCooldown
                  ? '#f87171'
                  : '#6ee7b7';

              return (
                <div
                  key={slot}
                  className={`relative w-12 h-12 rounded-lg transition-all duration-200 flex items-center justify-center ${ability ? 'cursor-pointer' : ''}`}
                  style={{
                    background: abilityBg,
                    border: abilityBorder,
                    boxShadow: abilityShadow,
                    opacity: !ability ? 0.55 : 1,
                  }}
                  onMouseEnter={ability ? (e) => handleAbilityHover(e, ability) : undefined}
                  onMouseLeave={handleAbilityLeave}
                >
                  {/* Key badge — centered above */}
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2 py-px text-[10px] font-mono font-bold"
                    style={{
                      background: 'rgba(18,18,34,0.97)',
                      border: ability && !isOnCooldown
                        ? '1px solid rgba(52,211,153,0.45)'
                        : '1px solid rgba(120,120,160,0.4)',
                      color: ability && !isOnCooldown
                        ? 'rgba(110,231,183,0.9)'
                        : 'rgba(180,180,200,0.8)',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.7)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {slot}
                  </div>

                  {ability && showChargeStacks && (
                    <div
                      className="absolute -bottom-2 -right-2 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full tabular-nums text-xs font-bold"
                      style={{
                        background: 'rgba(12,12,26,0.97)',
                        border: '1px solid rgba(245,158,11,0.75)',
                        color: '#fde68a',
                        boxShadow: '0 0 8px rgba(245,158,11,0.3)',
                      }}
                    >
                      {cdSlot?.charges}
                    </div>
                  )}

                  {/* Ability icon */}
                  <div
                    className="w-7 h-7 rounded flex items-center justify-center text-base font-bold"
                    style={{
                      color: abilityIconColor,
                      filter: ability && !isOnCooldown
                        ? 'drop-shadow(0 0 4px rgba(52,211,153,0.5))'
                        : undefined,
                    }}
                  >
                    {ability ? ability.icon : '·'}
                  </div>

                  {/* Cooldown overlay + number */}
                  {isOnCooldown && ability && (
                    <>
                      <div
                        className="absolute inset-0 rounded-lg"
                        style={{ background: 'rgba(0,0,0,0.52)' }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span
                          className="text-white text-sm font-bold tabular-nums"
                          style={{ textShadow: '0 1px 4px rgba(0,0,0,1)' }}
                        >
                          {Math.ceil(currentCooldown)}
                        </span>
                      </div>
                    </>
                  )}

                  {/* Active / charge overlay */}
                  {ability && getActiveOverlay()}
                </div>
              );
            })}

            {totalRoomBoonCount > 0 && (
              <>
                <div className="flex flex-col items-center justify-center gap-1.5 px-0.5">
                  <div className="w-px h-3 rounded" style={{ background: 'rgba(120,120,160,0.3)' }} />
                  <span className="text-[9px]" style={{ color: 'rgba(120,120,160,0.55)' }}>
                    ★
                  </span>
                  <div className="w-px h-3 rounded" style={{ background: 'rgba(120,120,160,0.3)' }} />
                </div>
                <div className="flex items-center gap-2">
                  {primaryRoomBoons.length > 0 &&
                    primaryRoomBoons.map((talentId) => (
                      <TalentSlot
                        key={talentId}
                        talentId={talentId}
                        variant="primary"
                        onMouseEnter={handleTalentHover}
                        onMouseLeave={handleAbilityLeave}
                      />
                    ))}
                  {otherRoomBoons.length > 0 &&
                    (needsTalentScroll ? (
                      <div className="relative flex items-center">
                        <button
                          type="button"
                          aria-label="Scroll talents left"
                          disabled={!canScrollLeft}
                          onClick={scrollTalentLeft}
                          className="absolute left-0 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-base leading-none transition-colors top-1/2"
                          style={talentArrowButtonStyle(canScrollLeft)}
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          aria-label="Scroll talents right"
                          disabled={!canScrollRight}
                          onClick={scrollTalentRight}
                          className="absolute right-0 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-base leading-none transition-colors top-1/2"
                          style={talentArrowButtonStyle(canScrollRight)}
                        >
                          ›
                        </button>
                        <div
                          ref={talentScrollRef}
                          className="flex flex-nowrap gap-2 overflow-x-hidden"
                          style={{ maxWidth: scrollableTalentMaxWidthPx }}
                          onScroll={updateTalentScrollButtons}
                        >
                          {otherRoomBoons.map((talentId) => (
                            <TalentSlot
                              key={talentId}
                              talentId={talentId}
                              variant="default"
                              onMouseEnter={handleTalentHover}
                              onMouseLeave={handleAbilityLeave}
                            />
                          ))}
                        </div>
                      </div>
                    ) : (
                      otherRoomBoons.map((talentId) => (
                        <TalentSlot
                          key={talentId}
                          talentId={talentId}
                          variant="default"
                          onMouseEnter={handleTalentHover}
                          onMouseLeave={handleAbilityLeave}
                        />
                      ))
                    ))}
                </div>
              </>
            )}
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

