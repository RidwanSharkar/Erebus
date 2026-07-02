import React, { useLayoutEffect, useRef, useState } from 'react';
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

const VIEWPORT_PADDING_PX = 8;

interface HotkeyTooltipProps {
  content: TooltipContent;
  visible: boolean;
  x: number;
  y: number;
  placement?: 'above' | 'right';
}

export function HotkeyTooltip({
  content,
  visible,
  x,
  y,
  placement = 'above',
}: HotkeyTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [clampedPosition, setClampedPosition] = useState<{ left: number; top: number } | null>(
    null
  );

  useLayoutEffect(() => {
    if (!visible) {
      setClampedPosition(null);
      return;
    }

    const el = tooltipRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const maxLeft = window.innerWidth - VIEWPORT_PADDING_PX - rect.width;
    const maxTop = window.innerHeight - VIEWPORT_PADDING_PX - rect.height;
    const left = Math.min(Math.max(rect.left, VIEWPORT_PADDING_PX), maxLeft);
    const top = Math.min(Math.max(rect.top, VIEWPORT_PADDING_PX), maxTop);

    if (left !== rect.left || top !== rect.top) {
      setClampedPosition({ left, top });
    } else {
      setClampedPosition(null);
    }
  }, [visible, x, y, placement, content.name, content.description]);

  if (!visible) return null;

  const baseStyle: React.CSSProperties =
    placement === 'right'
      ? { left: x, top: y, transform: 'translateY(-50%)' }
      : { left: x - 150, top: y - 92, transform: 'translateX(-50%)' };

  const clampedStyle: React.CSSProperties | undefined = clampedPosition
    ? { left: clampedPosition.left, top: clampedPosition.top, transform: 'none' }
    : undefined;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 text-white text-sm max-w-xs pointer-events-none"
      style={{
        ...baseStyle,
        ...clampedStyle,
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
