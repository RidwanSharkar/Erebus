'use client';

import React, { useState } from 'react';
import { StatSystem, StatPointData, StatKey } from '@/utils/StatSystem';
import { InventoryItem } from '@/contexts/MultiplayerContext';

interface StatsPanelProps {
  statPointData: StatPointData;
  onAllocateStat: (stat: StatKey) => void;
  playerLevel: number;
  inventory?: InventoryItem[];
}

const STAT_KEYS: StatKey[] = ['strength', 'stamina', 'agility', 'intellect'];

const AMULET_ICONS: Record<string, string> = {
  AMULET_OF_STRENGTH:  '🛡',
  AMULET_OF_STAMINA:   '❤️',
  AMULET_OF_AGILITY:   '⚡',
  AMULET_OF_INTELLECT: '✨',
};

const BOSS_ITEM_ICONS: Record<string, string> = {
  CLOAK_OF_SPEED:  '🌀',
  WARDING_SHIELD:  '🔵',
  HOLY_RELIC:      '✴️',
  TITAN_HEART:     '🔥',
};

const BOSS_ITEM_COLORS: Record<string, string> = {
  CLOAK_OF_SPEED:  '#00cfff',
  WARDING_SHIELD:  '#4169e1',
  HOLY_RELIC:      '#ffd700',
  TITAN_HEART:     '#ff4500',
};

const BOSS_ITEM_DESCRIPTIONS: Record<string, string> = {
  CLOAK_OF_SPEED:  'Speed +5.0 · Jump ×1.5',
  WARDING_SHIELD:  'Max Shield +75',
  HOLY_RELIC:      'Mana Regen ×2',
  TITAN_HEART:     'HP Regen +4/s',
};

export default function StatsPanel({
  statPointData,
  onAllocateStat,
  playerLevel,
  inventory = [],
}: StatsPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<'stats' | 'inventory'>('stats');

  const { stats, statPoints } = statPointData;
  const hasPoints = statPoints > 0;

  return (
    <div className="fixed bottom-4 left-4 z-40 select-none" style={{ width: 228 }}>
      <div className="rounded-xl border border-white/15 bg-gray-950/92 backdrop-blur-md shadow-2xl overflow-hidden">

        {/* ── Header / toggle ── */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-white/70">Character</span>
            <span className="text-[11px] text-white/30">Lv {playerLevel}</span>
            {hasPoints && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-yellow-500 text-black text-[10px] font-black leading-none animate-pulse">
                {statPoints}
              </span>
            )}
            {inventory.length > 0 && (
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-purple-500/80 text-white text-[10px] font-black leading-none">
                {inventory.length}
              </span>
            )}
          </div>
          <span className="text-[10px] text-white/30">{expanded ? '▼' : '▲'}</span>
        </button>

        {/* ── Compact stat summary (always visible) ── */}
        <div className="px-3 pb-2.5 grid grid-cols-4 gap-1">
          {STAT_KEYS.map(stat => {
            const color = StatSystem.getStatColor(stat);
            const value = stats[stat];
            return (
              <div key={stat} className="flex flex-col items-center gap-0.5">
                <span className="text-sm leading-none">{StatSystem.getStatIcon(stat)}</span>
                <span className="text-xs font-black tabular-nums leading-none" style={{ color }}>
                  {value}
                </span>
              </div>
            );
          })}
        </div>

        {/* ── Expanded panel ── */}
        {expanded && (
          <>
            {/* Tabs */}
            <div className="flex border-t border-white/10">
              <button
                onClick={() => setTab('stats')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  tab === 'stats'
                    ? 'text-white border-b-2 border-yellow-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                Stats
              </button>
              <button
                onClick={() => setTab('inventory')}
                className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors relative ${
                  tab === 'inventory'
                    ? 'text-white border-b-2 border-yellow-400'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                Items
                {inventory.length > 0 && (
                  <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-yellow-500 text-black text-[9px] font-black">
                    {inventory.length}
                  </span>
                )}
              </button>
            </div>

            {/* Stats tab */}
            {tab === 'stats' && (
              <div className="px-3 py-2.5 space-y-2">
                {hasPoints && (
                  <p className="text-[11px] text-yellow-300 font-bold text-center">
                    {statPoints} point{statPoints > 1 ? 's' : ''} available!
                  </p>
                )}
                {STAT_KEYS.map(stat => {
                  const value = stats[stat];
                  const color = StatSystem.getStatColor(stat);
                  const canAllocate = statPoints > 0;
                  return (
                    <div key={stat} className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0"
                        style={{ background: `${color}22`, border: `1px solid ${color}44` }}
                      >
                        {StatSystem.getStatIcon(stat)}
                      </div>
                      <span className="text-xs text-white/70 flex-1">{StatSystem.getStatDisplayName(stat)}</span>
                      <span className="text-xs font-black tabular-nums" style={{ color }}>{value}</span>
                      <button
                        onClick={() => canAllocate && onAllocateStat(stat)}
                        disabled={!canAllocate}
                        className={`w-5 h-5 rounded text-xs font-black flex items-center justify-center transition-all
                          ${canAllocate
                            ? 'text-white hover:scale-110 active:scale-95 cursor-pointer'
                            : 'text-white/20 cursor-not-allowed'
                          }`}
                        style={canAllocate ? { background: color, boxShadow: `0 0 8px ${color}50` } : { background: '#2a2a2a' }}
                      >
                        +
                      </button>
                    </div>
                  );
                })}
                <p className="text-[10px] text-white/25 text-center pt-1">
                  Lv {playerLevel} · {StatSystem.getTotalStatPointsForLevel(playerLevel)} total pts
                </p>
              </div>
            )}

            {/* Inventory tab */}
            {tab === 'inventory' && (
              <div className="px-3 py-2.5">
                {inventory.length === 0 ? (
                  <div className="flex flex-col items-center py-4 text-white/30">
                    <span className="text-2xl mb-1">💍</span>
                    <p className="text-xs">No items yet</p>
                    <p className="text-[10px] mt-0.5 text-center">Defeat skeletons to find amulets</p>
                  </div>
                ) : (() => {
                  const amulets   = inventory.filter(i => i.category !== 'boss_drop');
                  const bossDrops = inventory.filter(i => i.category === 'boss_drop');
                  return (
                    <div className="space-y-2 max-h-52 overflow-y-auto pr-0.5">

                      {/* Boss Rewards */}
                      {bossDrops.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400/70 mb-1">
                            👑 Boss Rewards
                          </p>
                          <div className="space-y-1">
                            {bossDrops.map((item, idx) => {
                              const color = BOSS_ITEM_COLORS[item.type] || '#ffffff';
                              const icon  = BOSS_ITEM_ICONS[item.type] || '👑';
                              const desc  = BOSS_ITEM_DESCRIPTIONS[item.type] || '';
                              return (
                                <div
                                  key={`${item.id}-${idx}`}
                                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                                  style={{ background: `${color}18`, border: `1px solid ${color}35` }}
                                >
                                  <span className="text-sm">{icon}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white/90 font-semibold truncate">{item.label}</p>
                                    <p className="text-[10px] truncate" style={{ color }}>{desc}</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Amulets */}
                      {amulets.length > 0 && (
                        <div>
                          {bossDrops.length > 0 && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                              💍 Amulets
                            </p>
                          )}
                          <div className="space-y-1">
                            {amulets.map((item, idx) => {
                              const color = item.stat ? StatSystem.getStatColor(item.stat) : '#888';
                              const icon  = AMULET_ICONS[item.type] || '💍';
                              return (
                                <div
                                  key={`${item.id}-${idx}`}
                                  className="flex items-center gap-2 rounded-lg px-2 py-1.5"
                                  style={{ background: `${color}12`, border: `1px solid ${color}25` }}
                                >
                                  <span className="text-sm">{icon}</span>
                                  <span className="text-xs text-white/80 flex-1 truncate">{item.label}</span>
                                  <span className="text-[11px] font-black" style={{ color }}>+1</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Stat bonuses summary */}
                      {amulets.length > 0 && (
                        <div className="pt-1.5 border-t border-white/10 grid grid-cols-2 gap-1">
                          {STAT_KEYS.map(stat => {
                            const bonus = amulets.filter(i => i.stat === stat).length;
                            if (bonus === 0) return null;
                            const color = StatSystem.getStatColor(stat);
                            return (
                              <div
                                key={stat}
                                className="flex items-center gap-1.5 rounded px-2 py-1"
                                style={{ background: `${color}18`, border: `1px solid ${color}30` }}
                              >
                                <span className="text-xs">{StatSystem.getStatIcon(stat)}</span>
                                <span className="text-[11px] font-black" style={{ color }}>+{bonus}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
