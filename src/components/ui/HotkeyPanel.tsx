import React, { useState, useEffect, useCallback } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import { SkillPointData, AbilityUnlock } from '@/utils/SkillPointSystem';
import { universalAbilityPool, getUniversalAbilityById, type AbilityLoadout, type UniversalAbility } from '@/utils/weaponAbilities';

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

export default function HotkeyPanel({ currentWeapon, controlSystem, selectedWeapons, onWeaponSwitch, skillPointData, abilityLoadout, onUnlockAbility, purchasedItems = [] }: HotkeyPanelProps) {
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
    setTooltipContent({
      name: weapon.name,
      description: `Weilding the ${weapon.name}`
    });
    setTooltipPosition({
      x: rect.left + rect.width / 2,
      y: rect.top
    });
  }, []);

  const handleAbilityLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  // Always render even without a loadout (shows empty slots)


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
                // Don't allow clicking on purchased items
                if ((weapon as any).isPurchasedItem) return;

                if (!isOnCooldown && onWeaponSwitch) {
                  const slot = weapon.key === '1' ? 1 : 3;
                  onWeaponSwitch(slot as 1 | 3);
                }
              }, [isOnCooldown, onWeaponSwitch, weapon.key, weapon]);

              return (
                <div
                  key={weapon.key}
                  className={`relative w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                    (weapon as any).isPurchasedItem
                      ? 'border-purple-400 bg-purple-900 bg-opacity-50'
                      : isCurrentWeapon
                        ? 'border-yellow-400 bg-yellow-900 bg-opacity-50'
                        : isOnCooldown
                          ? 'border-red-500 bg-red-900 bg-opacity-30'
                          : 'border-gray-400 bg-gray-900 bg-opacity-30 hover:bg-opacity-50'
                  } ${(weapon as any).isPurchasedItem ? 'cursor-default' : 'cursor-pointer'} flex items-center justify-center`}
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
                    (weapon as any).isPurchasedItem
                      ? 'text-purple-400'
                      : isCurrentWeapon
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

            {/* Passive Ability Icon — no hotkey, displayed after Q/E/R */}
            {passiveAbility && (
              <div
                className="relative w-12 h-12 rounded-lg border-2 border-violet-400 bg-violet-900 bg-opacity-30 flex items-center justify-center"
                onMouseEnter={(e) => handleAbilityHover(e, passiveAbility)}
                onMouseLeave={handleAbilityLeave}
              >
                <div className="w-8 h-8 rounded flex items-center justify-center text-lg font-bold text-violet-300">
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

              return (
                <div
                  key={slot}
                  className={`relative w-12 h-12 rounded-lg border-2 transition-all duration-200 ${
                    !ability
                      ? 'border-dashed border-gray-600 bg-gray-800 opacity-50'
                      : isOnCooldown
                        ? 'border-red-500 bg-red-900 bg-opacity-30 cursor-pointer'
                        : 'border-green-400 bg-green-900 bg-opacity-30 hover:bg-opacity-50 cursor-pointer'
                  } flex items-center justify-center`}
                  onMouseEnter={ability ? (e) => handleAbilityHover(e, ability) : undefined}
                  onMouseLeave={handleAbilityLeave}
                >
                  {/* Slot key badge */}
                  <div className="absolute -top-2 -left-2 bg-gray-800 border border-gray-600 rounded text-xs text-white px-1 py-0.5 font-semibold">
                    {slot}
                  </div>

                  {ability && showChargeStacks && (
                    <div className="absolute -bottom-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded bg-gray-900 border border-amber-500/80 text-amber-200 text-xs font-bold tabular-nums">
                      {cdSlot?.charges}
                    </div>
                  )}

                  {/* Ability icon */}
                  <div className={`w-8 h-8 rounded flex items-center justify-center text-lg font-bold ${
                    !ability ? 'text-gray-600' : isOnCooldown ? 'text-red-400' : 'text-green-400'
                  }`}>
                    {ability ? ability.icon : '·'}
                  </div>

                  {/* Cooldown number */}
                  {isOnCooldown && ability && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white text-sm font-bold bg-black bg-opacity-60 rounded px-1">
                        {Math.ceil(currentCooldown)}
                      </span>
                    </div>
                  )}

                  {/* Active / charge overlay */}
                  {ability && getActiveOverlay()}
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

