'use client';

import React, { useCallback, useState } from 'react';
import {
  ARCHETYPE_DISPLAY,
  getArchetypeIconSrc,
  type ThroneArchetype,
} from '@/utils/archetypes';
import {
  getAllyAncestorIconSrc,
  getAllyChoiceCard,
  getAllyChoiceTooltipDescription,
} from '@/utils/coopAllyChoice';
import type { CoopAllyKind } from '@/utils/coopAllyTargeting';
import { HotkeyTooltip } from './hotkeyTalentSlot';
import { CardinalNotch } from './LevelBadge';
import { HEX_PATTERN_BG } from './hudChrome';

type ArchetypeBadgeProps =
  | {
      mode?: 'archetype';
      archetype: ThroneArchetype;
      allyKind?: never;
      className?: string;
      id?: string;
    }
  | {
      mode: 'ancestor';
      allyKind: CoopAllyKind;
      archetype?: never;
      className?: string;
      id?: string;
    };

const RING_SIZE = 64;
const RING_STROKE = 4;
const FRAME_PADDING = 12;

export default function ArchetypeBadge(props: ArchetypeBadgeProps) {
  const { className = '', id } = props;
  const isAncestor = props.mode === 'ancestor';

  const iconSrc = isAncestor
    ? getAllyAncestorIconSrc(props.allyKind)
    : getArchetypeIconSrc(props.archetype);

  const nameLabel = isAncestor
    ? (getAllyChoiceCard(props.allyKind)?.title ?? props.allyKind)
    : ARCHETYPE_DISPLAY[props.archetype].label;

  const tooltipName = isAncestor
    ? `Ancestor: ${String(nameLabel)}`
    : nameLabel;

  const tooltipDescription = isAncestor
    ? getAllyChoiceTooltipDescription(props.allyKind)
    : ARCHETYPE_DISPLAY[props.archetype].description;

  const accentColor = isAncestor
    ? '#eab308'
    : ARCHETYPE_DISPLAY[props.archetype].accentColor;

  const outerSize = RING_SIZE + FRAME_PADDING;
  const ringRadius = (RING_SIZE - RING_STROKE) / 2;

  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      x: rect.right + 10,
      y: rect.top + rect.height / 2,
    });
    setTooltipVisible(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setTooltipVisible(false);
  }, []);

  if (!iconSrc) return null;

  return (
    <>
      <div
        id={id}
        className={`select-none shrink-0 cursor-default ${className}`}
        style={{ width: outerSize, height: outerSize }}
        data-block-game-input
        aria-label={tooltipName}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div
          className="relative flex items-center justify-center"
          style={{
            width: outerSize,
            height: outerSize,
            background:
              'linear-gradient(145deg, rgba(50,60,90,0.75) 0%, rgba(10,12,22,0.98) 55%, rgba(4,6,14,1) 100%)',
            borderRadius: '50%',
            boxShadow: `0 0 24px ${accentColor}33, inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -3px 6px rgba(0,0,0,0.55)`,
          }}
        >
          <CardinalNotch position="top" />
          <CardinalNotch position="bottom" />
          <CardinalNotch position="left" />
          <CardinalNotch position="right" />

          <svg
            width={outerSize}
            height={outerSize}
            className="absolute inset-0"
            aria-hidden
          >
            <circle
              cx={outerSize / 2}
              cy={outerSize / 2}
              r={ringRadius + 2}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={RING_STROKE}
            />
          </svg>

          <div
            className="relative overflow-hidden"
            style={{
              width: RING_SIZE,
              height: RING_SIZE,
              borderRadius: '50%',
              background:
                'radial-gradient(circle at 35% 28%, rgba(35,50,90,0.96) 0%, rgba(8,10,20,0.98) 68%)',
              border: '1px solid rgba(100,140,220,0.3)',
              boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.65)',
            }}
          >
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage: HEX_PATTERN_BG,
                backgroundSize: '40px 35px',
              }}
            />
            <img
              src={iconSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ filter: `drop-shadow(0 0 10px ${accentColor}88)` }}
            />
          </div>
        </div>
      </div>

      <HotkeyTooltip
        content={{ name: tooltipName, description: tooltipDescription }}
        visible={tooltipVisible}
        x={tooltipPosition.x}
        y={tooltipPosition.y}
        placement="right"
      />
    </>
  );
}
