import React from 'react';
import type { Archetype } from '@/utils/archetypes';
import LevelBadge from './LevelBadge';
import ResourceBar from './ResourceBar';
import {
  HUD_PANEL_BG,
  HUD_PANEL_BORDER,
  HUD_PANEL_CLIP,
  HUD_PANEL_SHADOW,
} from './hudChrome';

interface PlayerStatusHudProps {
  playerHealth: number;
  maxHealth: number;
  playerShield?: number;
  maxShield?: number;
  playerEnergy?: number;
  maxEnergy?: number;
  playerExperience?: number;
  playerLevel?: number;
  showLevelBadge?: boolean;
  selectedArchetype?: Archetype;
}

export default function PlayerStatusHud({
  playerHealth,
  maxHealth,
  playerShield = 200,
  maxShield = 200,
  playerEnergy = 100,
  maxEnergy = 100,
  playerExperience = 0,
  playerLevel = 1,
  showLevelBadge = true,
  selectedArchetype,
}: PlayerStatusHudProps) {
  return (
    <div
      className="flex flex-col items-stretch"
      style={{ position: 'relative', minWidth: showLevelBadge ? 454 : 380, gap: 8 }}
    >
      <div
        className="backdrop-blur-md flex items-center gap-0"
        style={{
          background: HUD_PANEL_BG,
          border: HUD_PANEL_BORDER,
          clipPath: HUD_PANEL_CLIP,
          boxShadow: HUD_PANEL_SHADOW,
          padding: showLevelBadge ? '12px 16px 12px 8px' : '16px 20px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: '16px',
            right: '16px',
            height: '1px',
            background:
              'linear-gradient(90deg, transparent, rgba(100,160,255,0.5) 25%, rgba(180,220,255,0.85) 50%, rgba(100,160,255,0.5) 75%, transparent)',
            pointerEvents: 'none',
          }}
        />

        {showLevelBadge && (
          <LevelBadge
            experience={playerExperience}
            level={playerLevel}
            isLocalPlayer
            selectedArchetype={selectedArchetype}
            variant="integrated"
            className="-mr-5"
          />
        )}

        <div
          className="flex flex-col gap-1 flex-1 min-w-0"
          style={{ paddingLeft: showLevelBadge ? 24 : 0 }}
        >
          <ResourceBar current={playerShield} max={maxShield} kind="shield" />
          <ResourceBar current={playerHealth} max={maxHealth} kind="health" />
          <ResourceBar
            current={playerEnergy}
            max={maxEnergy}
            kind="energy"
            archetype={selectedArchetype}
          />
        </div>
      </div>
    </div>
  );
}
