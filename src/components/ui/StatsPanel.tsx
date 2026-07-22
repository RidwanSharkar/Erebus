'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StatSystem, StatPointData, StatKey } from '@/utils/StatSystem';
import { InventoryItem } from '@/contexts/MultiplayerContext';
import {
  TalentLoadout,
  shouldApplySpellbladeTalent,
  shouldApplyParryTalent,
  SPELLBLADE_INTELLECT_BONUS,
  PARRY_INTELLECT_BONUS,
  PARRY_STRENGTH_BONUS,
} from '@/utils/talents';
import type { AbilityLoadout } from '@/utils/weaponAbilities';

interface StatsPanelProps {
  statPointData: StatPointData;
  onAllocateStat: (stat: StatKey) => void;
  playerLevel: number;
  /** Used for effective stat calculation (inventory bonuses) */
  inventory?: InventoryItem[];
  talentLoadout?: TalentLoadout | null;
  abilityLoadout?: AbilityLoadout | null;
  criticalChance?: number;
  criticalDamageMultiplier?: number;
}

const STAT_KEYS: StatKey[] = ['strength', 'stamina', 'agility', 'intellect'];

const TOOLTIP_WIDTH = 240;
const VIEWPORT_PAD = 12;
const TOOLTIP_LINGER_MS = 5000;
const TOOLTIP_FADE_MS = 300;

function getClampedTooltipStyle(anchorX: number, anchorY: number): React.CSSProperties {
  const halfW = TOOLTIP_WIDTH / 2;
  let left = anchorX;
  let transform = 'translate(-50%, -100%)';

  if (anchorX < halfW + VIEWPORT_PAD) {
    left = VIEWPORT_PAD;
    transform = 'translate(0, -100%)';
  } else if (anchorX + halfW > window.innerWidth - VIEWPORT_PAD) {
    left = window.innerWidth - VIEWPORT_PAD;
    transform = 'translate(-100%, -100%)';
  }

  return {
    left,
    top: anchorY - 8,
    transform,
    width: TOOLTIP_WIDTH,
  };
}

interface StatTooltipProps {
  name: string;
  description: string;
  visible: boolean;
  x: number;
  y: number;
  opacity: number;
}

function StatTooltip({ name, description, visible, x, y, opacity }: StatTooltipProps) {
  if (!visible) return null;

  const positionStyle = getClampedTooltipStyle(x, y);

  return (
    <div
      className="fixed z-[60] text-white text-sm pointer-events-none"
      style={{
        ...positionStyle,
        opacity,
        transition: `opacity ${TOOLTIP_FADE_MS}ms ease`,
        background: 'rgba(6,6,18,0.97)',
        border: '1px solid rgba(100,140,255,0.3)',
        borderTop: '2px solid rgba(120,160,255,0.75)',
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      <div className="font-semibold text-blue-300 mb-1 text-[13px]">{name}</div>
      <div className="text-gray-400 text-xs leading-relaxed">{description}</div>
    </div>
  );
}

export default function StatsPanel({
  statPointData,
  onAllocateStat,
  playerLevel,
  inventory = [],
  talentLoadout,
  abilityLoadout,
  criticalChance,
  criticalDamageMultiplier,
}: StatsPanelProps) {
  const [expanded, setExpanded] = useState(statPointData.statPoints > 0);
  const [tooltipContent, setTooltipContent] = useState<{ name: string; description: string } | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [tooltipOpacity, setTooltipOpacity] = useState(1);
  const tooltipLingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTooltipTimers = useCallback(() => {
    if (tooltipLingerTimerRef.current) {
      clearTimeout(tooltipLingerTimerRef.current);
      tooltipLingerTimerRef.current = null;
    }
    if (tooltipFadeTimerRef.current) {
      clearTimeout(tooltipFadeTimerRef.current);
      tooltipFadeTimerRef.current = null;
    }
  }, []);

  const hideTooltip = useCallback(() => {
    clearTooltipTimers();
    setTooltipContent(null);
    setTooltipOpacity(1);
  }, [clearTooltipTimers]);

  const handleStatHover = useCallback((e: React.MouseEvent, stat: StatKey) => {
    clearTooltipTimers();
    setTooltipOpacity(1);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent({
      name: StatSystem.getStatDisplayName(stat).toUpperCase(),
      description: StatSystem.getStatTooltipDescription(stat),
    });
    setTooltipPosition({ x: rect.left + rect.width / 2, y: rect.top });

    tooltipLingerTimerRef.current = setTimeout(() => {
      setTooltipOpacity(0);
      tooltipFadeTimerRef.current = setTimeout(() => {
        setTooltipContent(null);
        setTooltipOpacity(1);
      }, TOOLTIP_FADE_MS);
    }, TOOLTIP_LINGER_MS);
  }, [clearTooltipTimers]);

  const handleStatLeave = useCallback(() => {
    hideTooltip();
  }, [hideTooltip]);

  useEffect(() => () => clearTooltipTimers(), [clearTooltipTimers]);

  const { stats, statPoints } = statPointData;
  const prevStatPointsRef = useRef(statPoints);

  useEffect(() => {
    const prev = prevStatPointsRef.current;
    if (statPoints > prev) {
      setExpanded(true);
    }
    if (statPoints === 0) {
      setExpanded(false);
    }
    prevStatPointsRef.current = statPoints;
  }, [statPoints]);

  const displayStats = useMemo(
    () => StatSystem.getEffectiveStatsWithInventory(stats, inventory),
    [inventory, stats],
  );

  const talentStatBonuses = useMemo(() => {
    const bonuses = { strength: 0, stamina: 0, agility: 0, intellect: 0 };
    if (shouldApplySpellbladeTalent(talentLoadout, abilityLoadout ?? null)) {
      bonuses.intellect += SPELLBLADE_INTELLECT_BONUS;
    }
    if (shouldApplyParryTalent(talentLoadout, abilityLoadout ?? null)) {
      bonuses.intellect += PARRY_INTELLECT_BONUS;
      bonuses.strength += PARRY_STRENGTH_BONUS;
    }
    return bonuses;
  }, [talentLoadout, abilityLoadout]);

  const talentAdjustedStats = useMemo(
    () => ({
      strength: displayStats.strength + talentStatBonuses.strength,
      stamina: displayStats.stamina + talentStatBonuses.stamina,
      agility: displayStats.agility + talentStatBonuses.agility,
      intellect: displayStats.intellect + talentStatBonuses.intellect,
    }),
    [displayStats, talentStatBonuses],
  );

  const hasPoints = statPoints > 0;

  return (
    <div className="select-none" style={{ width: 228 }} data-block-game-input>
      <div
        className="overflow-hidden backdrop-blur-md shadow-2xl"
        style={{
          background:
            'linear-gradient(180deg, rgba(8,10,22,0.94) 0%, rgba(4,5,14,0.97) 100%)',
          border: '1px solid rgba(80,120,200,0.22)',
          clipPath:
            'polygon(10px 0%, calc(100% - 10px) 0%, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0% calc(100% - 10px), 0% 10px)',
        }}
      >
        {/* Header / toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-white/70">
              STATS
            </span>
            <span className="text-[11px] text-white/30">Lv {playerLevel}</span>
            {hasPoints && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 text-black text-[10px] font-black leading-none animate-pulse">
                {statPoints}
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/30">{expanded ? '▼' : '▲'}</span>
        </button>

        {/* Compact stat summary (always visible) */}
        <div className="px-3 pb-2.5 grid grid-cols-4 gap-1">
          {STAT_KEYS.map((stat) => {
            const color = StatSystem.getStatColor(stat);
            const value = talentAdjustedStats[stat];
            const talentBonus = talentStatBonuses[stat];
            return (
              <div
                key={stat}
                className="flex flex-col items-center gap-0.5 cursor-default"
                onMouseEnter={(e) => handleStatHover(e, stat)}
                onMouseLeave={handleStatLeave}
              >
                <span className="text-sm leading-none">{StatSystem.getStatIcon(stat)}</span>
                <span
                  className="text-xs font-black tabular-nums leading-none"
                  style={{ color }}
                >
                  {value}
                </span>
                {talentBonus > 0 && (
                  <span className="text-[8px] leading-none text-purple-300/70">+{talentBonus}T</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Expanded stat allocation */}
        {expanded && (
          <div className="px-3 py-2.5 space-y-2 border-t border-white/10">
            {hasPoints && (
              <p className="text-[11px] text-yellow-300 font-bold text-center">
                {statPoints} point{statPoints > 1 ? 's' : ''} available!
              </p>
            )}
            {STAT_KEYS.map((stat) => {
              const value = talentAdjustedStats[stat];
              const talentBonus = talentStatBonuses[stat];
              const color = StatSystem.getStatColor(stat);
              const canAllocate = statPoints > 0;
              return (
                <div
                  key={stat}
                  className="flex items-center gap-2 cursor-default"
                  onMouseEnter={(e) => handleStatHover(e, stat)}
                  onMouseLeave={handleStatLeave}
                >
                  <div
                    className="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                    style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                  >
                    {StatSystem.getStatIcon(stat)}
                  </div>
                  <span className="text-xs text-white/70 flex-1">
                    {StatSystem.getStatDisplayName(stat)}
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xs font-black tabular-nums" style={{ color }}>
                      {value}
                    </span>
                    {talentBonus > 0 && (
                      <span className="text-[9px] font-bold text-purple-300/70">
                        (+{talentBonus})
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => canAllocate && onAllocateStat(stat)}
                    disabled={!canAllocate}
                    className={`w-5 h-5 rounded text-xs font-black flex items-center justify-center transition-all
                      ${canAllocate
                        ? 'text-white hover:scale-110 active:scale-95 cursor-pointer'
                        : 'text-white/20 cursor-not-allowed'
                      }`}
                    style={
                      canAllocate
                        ? { background: color, boxShadow: `0 0 8px ${color}50` }
                        : { background: '#2a2a2a' }
                    }
                  >
                    +
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {criticalChance != null && criticalDamageMultiplier != null && (
          <div className="px-3 py-2 border-t border-white/10 flex items-center justify-center gap-1.5">
            <img
              src="/icons/dice.svg"
              alt=""
              className="h-4 w-4 shrink-0 object-contain opacity-60"
              aria-hidden
            />
            <span className="text-[10px] text-white/40 font-mono tabular-nums">
              Crit: {(criticalChance * 100).toFixed(1)}% | ×{(criticalDamageMultiplier * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      {tooltipContent && (
        <StatTooltip
          name={tooltipContent.name}
          description={tooltipContent.description}
          visible
          x={tooltipPosition.x}
          y={tooltipPosition.y}
          opacity={tooltipOpacity}
        />
      )}
    </div>
  );
}
