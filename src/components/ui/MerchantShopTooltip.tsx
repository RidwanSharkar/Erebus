'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';

const VIEWPORT_PADDING_PX = 8;

export interface MerchantShopTooltipProps {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  /** Omitted for non-merchant pedestals (e.g. throne weapon/archetype picks). */
  cost?: number;
  costSuffix?: string;
  description: string;
  limitLabel?: string;
}

export default function MerchantShopTooltip({
  visible,
  x,
  y,
  name,
  cost,
  costSuffix = 'g',
  description,
  limitLabel,
}: MerchantShopTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [clampedPosition, setClampedPosition] = useState<{ left: number; top: number } | null>(
    null,
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
  }, [visible, x, y, name, cost, description, limitLabel]);

  if (!visible) return null;

  const baseStyle: React.CSSProperties = {
    left: x,
    top: y - 12,
    transform: 'translate(-50%, -100%)',
  };

  const clampedStyle: React.CSSProperties | undefined = clampedPosition
    ? { left: clampedPosition.left, top: clampedPosition.top, transform: 'none' }
    : undefined;

  return (
    <div
      ref={tooltipRef}
      className="fixed z-50 text-white text-sm max-w-[220px] pointer-events-none"
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
      <div className="font-semibold text-blue-300 mb-1 text-[13px]">
        {cost != null ? `${name} — ${cost}${costSuffix}` : name}
      </div>
      <div className="text-gray-400 text-xs leading-relaxed">{description}</div>
      {limitLabel ? (
        <div className="text-gray-500 text-[11px] mt-1.5 tracking-wide">{limitLabel}</div>
      ) : null}
    </div>
  );
}
