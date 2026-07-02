import React, { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react';
import { WeaponType } from '@/components/dragon/weapons';
import type { AbilityLoadout } from '@/utils/weaponAbilities';
import type { TalentId, TalentLoadout } from '@/utils/talents';
import { partitionTalentsForHud } from '@/utils/talents';
import {
  HotkeyTooltip,
  TalentSlot,
  TALENT_SLOT_PX,
  getTalentTooltipContent,
  type TooltipContent,
} from './hotkeyTalentSlot';

const MAX_VISIBLE_SLOTS = 10;
const SLOT_GAP_PX = 8;
const SCROLL_STEP_PX = TALENT_SLOT_PX + SLOT_GAP_PX;
const DPS_METER_HUD_ID = 'dps-meter-hud';
const PANEL_TOP_GAP_PX = 8;
const FALLBACK_TOP_OFFSET_PX = 16 + 88 + PANEL_TOP_GAP_PX;

interface ClassTalentPanelProps {
  currentWeapon: WeaponType;
  talentLoadout?: TalentLoadout | null;
  abilityLoadout?: AbilityLoadout | null;
}

export default function ClassTalentPanel({
  currentWeapon,
  talentLoadout = null,
  abilityLoadout = null,
}: ClassTalentPanelProps) {
  const [tooltipContent, setTooltipContent] = useState<TooltipContent | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);
  const [topOffsetPx, setTopOffsetPx] = useState(FALLBACK_TOP_OFFSET_PX);

  useLayoutEffect(() => {
    const dpsMeter = document.getElementById(DPS_METER_HUD_ID);
    if (!dpsMeter) return;

    const updateTopOffset = () => {
      const rect = dpsMeter.getBoundingClientRect();
      setTopOffsetPx(rect.bottom + PANEL_TOP_GAP_PX);
    };

    updateTopOffset();

    const resizeObserver = new ResizeObserver(updateTopOffset);
    resizeObserver.observe(dpsMeter);
    window.addEventListener('resize', updateTopOffset);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateTopOffset);
    };
  }, []);

  const { classTalents, duoBoons } = useMemo(
    () =>
      talentLoadout
        ? partitionTalentsForHud(talentLoadout, currentWeapon, abilityLoadout)
        : { primaryRoomBoons: [], otherRoomBoons: [], classTalents: [], duoBoons: [] },
    [talentLoadout, currentWeapon, abilityLoadout]
  );

  const totalCount = classTalents.length + duoBoons.length;
  const needsScroll = totalCount > MAX_VISIBLE_SLOTS;
  const scrollableMaxHeightPx =
    MAX_VISIBLE_SLOTS * TALENT_SLOT_PX + Math.max(0, MAX_VISIBLE_SLOTS - 1) * SLOT_GAP_PX;

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  const scrollUp = useCallback(() => {
    scrollRef.current?.scrollBy({ top: -SCROLL_STEP_PX, behavior: 'smooth' });
  }, []);

  const scrollDown = useCallback(() => {
    scrollRef.current?.scrollBy({ top: SCROLL_STEP_PX, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !needsScroll) return;
    el.scrollTop = 0;
    updateScrollButtons();
  }, [classTalents, duoBoons, needsScroll, updateScrollButtons]);

  const handleTalentHover = useCallback((e: React.MouseEvent, talentId: TalentId) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipContent(getTalentTooltipContent(talentId));
    setTooltipPosition({
      x: rect.right + 10,
      y: rect.top + rect.height / 2,
    });
  }, []);

  const handleTalentLeave = useCallback(() => {
    setTooltipContent(null);
  }, []);

  const arrowButtonStyle = (enabled: boolean): React.CSSProperties => ({
    background: 'rgba(18,18,34,0.97)',
    border: enabled ? '1px solid rgba(120,120,160,0.5)' : '1px solid rgba(80,80,100,0.25)',
    color: enabled ? 'rgba(200,200,220,0.9)' : 'rgba(120,120,140,0.4)',
    boxShadow: enabled ? '0 1px 4px rgba(0,0,0,0.7)' : 'none',
    opacity: enabled ? 1 : 0.45,
    cursor: enabled ? 'pointer' : 'default',
  });

  if (totalCount === 0) return null;

  const slotList = (
    <>
      {classTalents.map((talentId) => (
        <TalentSlot
          key={talentId}
          talentId={talentId}
          variant="default"
          onMouseEnter={handleTalentHover}
          onMouseLeave={handleTalentLeave}
        />
      ))}
      {duoBoons.length > 0 && classTalents.length > 0 && (
        <div className="flex flex-row items-center justify-center gap-1 py-0.5">
          <div className="h-px w-3 rounded" style={{ background: 'rgba(120,120,160,0.3)' }} />
          <span className="text-[9px]" style={{ color: 'rgba(120,120,160,0.55)' }}>
            ★
          </span>
          <div className="h-px w-3 rounded" style={{ background: 'rgba(120,120,160,0.3)' }} />
        </div>
      )}
      {duoBoons.map((talentId) => (
        <TalentSlot
          key={talentId}
          talentId={talentId}
          variant="duo"
          onMouseEnter={handleTalentHover}
          onMouseLeave={handleTalentLeave}
        />
      ))}
    </>
  );

  return (
    <>
      <div className="fixed left-4 z-40" style={{ top: topOffsetPx }}>
        <div
          className="backdrop-blur-md px-3 py-3"
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
          {needsScroll ? (
            <div className="relative flex flex-col items-center">
              <button
                type="button"
                aria-label="Scroll talents up"
                disabled={!canScrollUp}
                onClick={scrollUp}
                className="absolute left-1/2 top-0 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded text-xs leading-none transition-colors"
                style={{ ...arrowButtonStyle(canScrollUp), transform: 'translateX(-50%) rotate(90deg)' }}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label="Scroll talents down"
                disabled={!canScrollDown}
                onClick={scrollDown}
                className="absolute bottom-0 left-1/2 z-10 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded text-xs leading-none transition-colors"
                style={{ ...arrowButtonStyle(canScrollDown), transform: 'translateX(-50%) rotate(-90deg)' }}
              >
                ‹
              </button>
              <div
                ref={scrollRef}
                className="flex flex-col gap-2 overflow-y-hidden"
                style={{ maxHeight: scrollableMaxHeightPx }}
                onScroll={updateScrollButtons}
              >
                {slotList}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">{slotList}</div>
          )}
        </div>
      </div>

      {tooltipContent && (
        <HotkeyTooltip
          content={tooltipContent}
          visible={true}
          x={tooltipPosition.x}
          y={tooltipPosition.y}
          placement="right"
        />
      )}
    </>
  );
}
