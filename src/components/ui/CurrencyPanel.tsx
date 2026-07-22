'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

interface CurrencySlot {
  id: 'gold' | 'flow' | 'fate';
  label: string;
  icon: string;
  value: number;
  pulseEvent?: string;
}

interface CurrencyPanelProps {
  gold: number;
  flow: number;
  fate: number;
}

const PANEL_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, rgba(8,12,28,0.92) 0%, rgba(4,6,16,0.96) 100%)',
  border: '1px solid rgba(60,140,220,0.25)',
  clipPath:
    'polygon(12px 0%, calc(100% - 12px) 0%, 100% 50%, calc(100% - 12px) 100%, 12px 100%, 0% 50%)',
  boxShadow:
    '0 4px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(100,180,255,0.08)',
};

const DIVIDER_STYLE: React.CSSProperties = {
  width: 1,
  alignSelf: 'stretch',
  background:
    'linear-gradient(180deg, rgba(100,180,255,0.05) 0%, rgba(160,200,255,0.35) 50%, rgba(100,180,255,0.05) 100%)',
};

const TOOLTIP_WIDTH = 120;
const VIEWPORT_PAD = 12;

function formatCurrency(value: number): string {
  return value.toLocaleString('en-US');
}

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

  return { left, top: anchorY - 8, transform, width: TOOLTIP_WIDTH };
}

function CurrencySlotDisplay({
  label,
  icon,
  value,
  pulseEvent,
  onHover,
  onLeave,
}: Omit<CurrencySlot, 'id'> & {
  onHover: (e: React.MouseEvent, label: string) => void;
  onLeave: () => void;
}) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!pulseEvent) return;
    const onPulse = () => {
      setPulse(true);
      window.setTimeout(() => setPulse(false), 180);
    };
    window.addEventListener(pulseEvent, onPulse);
    return () => window.removeEventListener(pulseEvent, onPulse);
  }, [pulseEvent]);

  return (
    <div
      className={[
        'flex min-w-[88px] cursor-default items-center justify-center gap-2 px-3 py-1.5 transition-transform duration-150',
        pulse ? 'scale-110' : '',
      ].join(' ')}
      onMouseEnter={(e) => onHover(e, label)}
      onMouseLeave={onLeave}
    >
      <img
        src={icon}
        alt=""
        className="h-5 w-5 shrink-0 object-contain"
        aria-hidden
      />
      <span className="text-sm font-semibold tabular-nums tracking-wide text-white">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

export default function CurrencyPanel({ gold, flow, fate }: CurrencyPanelProps) {
  const [tooltip, setTooltip] = useState<{ title: string; x: number; y: number } | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = useCallback((e: React.MouseEvent, label: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({
      title: label,
      x: rect.left + rect.width / 2,
      y: rect.top,
    });
  }, []);

  const hideTooltip = useCallback(() => {
    tooltipTimerRef.current = setTimeout(() => setTooltip(null), 80);
  }, []);

  useEffect(() => () => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
  }, []);

  const slots: CurrencySlot[] = [
    { id: 'gold', label: 'GOLD', icon: '/icons/gold-coin.svg', value: gold, pulseEvent: 'gold-pocket-collected' },
    { id: 'flow', label: 'FLOW', icon: '/icons/flow.svg', value: flow, pulseEvent: 'flow-collected' },
    { id: 'fate', label: 'FATE', icon: '/icons/fate.svg', value: fate },
  ];

  return (
    <div className="select-none" data-block-game-input>
      <div className="flex items-stretch" style={PANEL_STYLE}>
        {slots.map((slot, index) => (
          <React.Fragment key={slot.id}>
            {index > 0 && <div style={DIVIDER_STYLE} aria-hidden />}
            <CurrencySlotDisplay
              label={slot.label}
              icon={slot.icon}
              value={slot.value}
              pulseEvent={slot.pulseEvent}
              onHover={showTooltip}
              onLeave={hideTooltip}
            />
          </React.Fragment>
        ))}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none fixed z-[60] text-sm text-white"
          style={{
            ...getClampedTooltipStyle(tooltip.x, tooltip.y),
            background: 'rgba(6,6,18,0.97)',
            border: '1px solid rgba(100,140,255,0.3)',
            borderTop: '2px solid rgba(120,160,255,0.75)',
            borderRadius: '8px',
            padding: '8px 12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)',
            textAlign: 'center',
          }}
        >
          <div className="text-[13px] font-semibold text-blue-300">{tooltip.title}</div>
        </div>
      )}
    </div>
  );
}
