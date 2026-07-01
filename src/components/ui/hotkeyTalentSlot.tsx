import React from 'react';
import type { TalentId } from '@/utils/talents';
import {
  getCoopRoomColorForTalent,
  getCoopRoomColorHudSlotStyle,
  getDuoBoonColors,
  getTalentBoonDefinition,
  getTalentIconSrc,
  type CoopRoomColor,
} from '@/utils/talents';

export const TALENT_SLOT_PX = 48;

const defaultTalentSlotStyle: React.CSSProperties = {
  background: 'linear-gradient(135deg, rgba(54,42,14,0.55), rgba(24,18,8,0.45))',
  border: '1px solid rgba(251,191,36,0.45)',
  boxShadow: '0 0 10px rgba(251,191,36,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
};

const DUO_COLOR_RGBA: Record<CoopRoomColor, string> = {
  blue: '96,165,250',
  green: '52,211,153',
  purple: '167,139,250',
  red: '249,115,22',
};

function getDuoTalentSlotStyle(id: TalentId): React.CSSProperties {
  const colors = getDuoBoonColors(id);
  if (!colors) return defaultTalentSlotStyle;
  const [c1, c2] = colors;
  const r1 = DUO_COLOR_RGBA[c1];
  const r2 = DUO_COLOR_RGBA[c2];
  return {
    background: `linear-gradient(135deg, rgba(${r1},0.18), rgba(${r2},0.18))`,
    border: `1px solid rgba(${r1},0.65)`,
    boxShadow: `0 0 12px rgba(${r1},0.25), 0 0 12px rgba(${r2},0.25), inset 0 1px 0 rgba(255,255,255,0.06)`,
  };
}

export interface TooltipContent {
  name: string;
  description: string;
}

interface HotkeyTooltipProps {
  content: TooltipContent;
  visible: boolean;
  x: number;
  y: number;
}

export function HotkeyTooltip({ content, visible, x, y }: HotkeyTooltipProps) {
  if (!visible) return null;

  return (
    <div
      className="fixed z-50 text-white text-sm max-w-xs pointer-events-none"
      style={{
        left: x - 150,
        top: y - 92,
        transform: 'translateX(-50%)',
        background: 'rgba(6,6,18,0.97)',
        border: '1px solid rgba(100,140,255,0.3)',
        borderTop: '2px solid rgba(120,160,255,0.75)',
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow:
          '0 8px 32px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      <div className="font-semibold text-blue-300 mb-1 text-[13px]">{content.name}</div>
      <div className="text-gray-400 text-xs leading-relaxed">{content.description}</div>
    </div>
  );
}

export function getTalentTooltipContent(talentId: TalentId): TooltipContent {
  const def = getTalentBoonDefinition(talentId);
  return {
    name: def?.name ?? talentId,
    description: def?.description ?? '',
  };
}

interface TalentSlotProps {
  talentId: TalentId;
  variant: 'primary' | 'default' | 'duo';
  onMouseEnter: (e: React.MouseEvent, talentId: TalentId) => void;
  onMouseLeave: () => void;
}

export function TalentSlot({ talentId, variant, onMouseEnter, onMouseLeave }: TalentSlotProps) {
  const roomColor = variant === 'primary' ? getCoopRoomColorForTalent(talentId) : null;
  const roomStyle = roomColor ? getCoopRoomColorHudSlotStyle(roomColor) : null;
  const src = getTalentIconSrc(talentId, roomColor);

  let slotStyle: React.CSSProperties;
  let iconFilter: string | undefined;
  let fallbackGlyphColor: string;

  if (variant === 'duo') {
    slotStyle = getDuoTalentSlotStyle(talentId);
    iconFilter = 'drop-shadow(0 0 4px rgba(251,191,36,0.45))';
    fallbackGlyphColor = 'rgba(253,224,71,0.85)';
  } else if (roomStyle) {
    slotStyle = {
      background: roomStyle.background,
      border: roomStyle.border,
      boxShadow: roomStyle.boxShadow,
    };
    iconFilter = roomStyle.iconFilter;
    fallbackGlyphColor = roomStyle.fallbackGlyphColor;
  } else {
    slotStyle = defaultTalentSlotStyle;
    iconFilter = 'drop-shadow(0 0 3px rgba(251,191,36,0.35))';
    fallbackGlyphColor = 'rgba(253,224,71,0.85)';
  }

  return (
    <div
      className="relative h-12 w-12 shrink-0 rounded-lg transition-all duration-200 flex items-center justify-center cursor-default"
      style={slotStyle}
      onMouseEnter={(e) => onMouseEnter(e, talentId)}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex h-7 w-7 items-center justify-center">
        {src ? (
          <img
            src={src}
            alt=""
            className="h-7 w-7 object-contain"
            style={{ filter: iconFilter }}
          />
        ) : (
          <span
            className="select-none text-lg leading-none"
            style={{ color: fallbackGlyphColor }}
          >
            ✦
          </span>
        )}
      </div>
    </div>
  );
}
