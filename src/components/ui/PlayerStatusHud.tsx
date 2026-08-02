import React from 'react';
import type { Archetype } from '@/utils/archetypes';
import LevelBadge from './LevelBadge';
import ResourceBar from './ResourceBar';
import {
  RESOURCE_BARS_COLUMN_MARGIN_LEFT,
  RESOURCE_BARS_COLUMN_PAD_LEFT,
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
      <div className="flex items-center gap-0">
        {showLevelBadge && (
          <LevelBadge
            experience={playerExperience}
            level={playerLevel}
            isLocalPlayer
            selectedArchetype={selectedArchetype}
            variant="integrated"
            className="-mr-5 relative z-[2]"
          />
        )}

        <div
          className="flex flex-col gap-1 flex-1 min-w-0"
          style={{
            paddingLeft: showLevelBadge ? RESOURCE_BARS_COLUMN_PAD_LEFT : 0,
            marginLeft: showLevelBadge ? RESOURCE_BARS_COLUMN_MARGIN_LEFT : 0,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <ResourceBar
            current={playerShield}
            max={maxShield}
            kind="shield"
            barSlot={showLevelBadge ? 0 : undefined}
            integrated={showLevelBadge}
          />
          <ResourceBar
            current={playerHealth}
            max={maxHealth}
            kind="health"
            barSlot={showLevelBadge ? 1 : undefined}
            integrated={showLevelBadge}
          />
          <ResourceBar
            current={playerEnergy}
            max={maxEnergy}
            kind="energy"
            archetype={selectedArchetype}
            barSlot={showLevelBadge ? 2 : undefined}
            integrated={showLevelBadge}
          />
        </div>
      </div>
    </div>
  );
}
