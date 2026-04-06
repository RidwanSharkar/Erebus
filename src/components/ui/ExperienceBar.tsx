'use client';

import React from 'react';
import { ExperienceSystem } from '@/utils/ExperienceSystem';

interface ExperienceBarProps {
  experience: number;
  level: number;
  isLocalPlayer?: boolean;
  /** Co-op: how many of the 15 starting knights have been killed (0–15) */
  skeletonKillCount?: number;
  /** Co-op: whether the boss has already been spawned */
  bossSpawned?: boolean;
}

const KNIGHT_KILLS_REQUIRED = 15;

export default function ExperienceBar({
  experience,
  level,
  isLocalPlayer = false,
  skeletonKillCount = 0,
  bossSpawned = false,
}: ExperienceBarProps) {
  const isMaxLevel = level >= 5;
  const progress = ExperienceSystem.getLevelProgress(level, experience);
  const { min, max } = ExperienceSystem.getCurrentLevelExpRange(level);
  const currentLevelExp = experience - min;
  const maxLevelExp = max - min;

  const skeletonProgress = Math.min((skeletonKillCount / KNIGHT_KILLS_REQUIRED) * 100, 100);
  const showSkeletonTracker = !bossSpawned;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-40 select-none">
      <div
        className="rounded-xl border border-white/10 bg-black/75 backdrop-blur-md px-4 py-2.5 shadow-xl"
        style={{ minWidth: 320 }}
      >
        {/* ── Level & EXP row ── */}
        <div className="flex items-center gap-3 mb-1.5">

          {/* Level badge */}
          <div
            className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black shadow-inner
              ${isLocalPlayer
                ? 'bg-gradient-to-br from-yellow-500 to-amber-600 text-black'
                : 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
              }`}
          >
            {level}
          </div>

          <div className="flex-1 min-w-0">
            {/* Label row */}
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wide">
                {isMaxLevel ? 'Max Level' : `Level ${level}`}
              </span>
              <span className="text-[11px] text-white/50 tabular-nums">
                {isMaxLevel
                  ? `${experience} EXP`
                  : `${currentLevelExp.toLocaleString()} / ${maxLevelExp.toLocaleString()} EXP`}
              </span>
            </div>

            {/* EXP bar */}
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out
                  ${isLocalPlayer
                    ? 'bg-gradient-to-r from-yellow-400 to-amber-300'
                    : 'bg-gradient-to-r from-blue-400 to-indigo-300'
                  }`}
                style={{ width: `${isMaxLevel ? 100 : progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Knight kill tracker — fills as knights die, boss spawns at 15/15 (co-op only) ── */}
        {showSkeletonTracker && (
          <div className="mt-2 pt-2 border-t border-white/10">

            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out bg-gradient-to-r from-red-600 to-rose-400"
                style={{ width: `${skeletonProgress}%` }}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
