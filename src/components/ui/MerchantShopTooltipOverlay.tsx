'use client';

import React from 'react';

import MerchantShopTooltip from '@/components/ui/MerchantShopTooltip';
import { useMerchantShopTooltip } from '@/utils/merchantShopTooltipStore';

export default function MerchantShopTooltipOverlay() {
  const snapshot = useMerchantShopTooltip();

  if (!snapshot?.visible) return null;

  return (
    <MerchantShopTooltip
      visible
      x={snapshot.x}
      y={snapshot.y}
      name={snapshot.name}
      cost={snapshot.cost}
      description={snapshot.description}
      limitLabel={snapshot.limitLabel}
    />
  );
}
