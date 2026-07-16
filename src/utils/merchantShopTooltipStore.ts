'use client';

import { useSyncExternalStore } from 'react';

export interface MerchantShopTooltipSnapshot {
  visible: boolean;
  x: number;
  y: number;
  name: string;
  cost: number;
  description: string;
  limitLabel?: string;
}

type Listener = () => void;

class MerchantShopTooltipStore {
  private snapshot: MerchantShopTooltipSnapshot | null = null;
  private listeners = new Set<Listener>();

  getSnapshot(): MerchantShopTooltipSnapshot | null {
    return this.snapshot;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish(snapshot: MerchantShopTooltipSnapshot | null): void {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  clear(): void {
    this.publish(null);
  }
}

export const merchantShopTooltipStore = new MerchantShopTooltipStore();

export function publishMerchantShopTooltip(
  snapshot: MerchantShopTooltipSnapshot | null,
): void {
  merchantShopTooltipStore.publish(snapshot);
}

export function clearMerchantShopTooltip(): void {
  merchantShopTooltipStore.clear();
}

export function useMerchantShopTooltip(): MerchantShopTooltipSnapshot | null {
  return useSyncExternalStore(
    merchantShopTooltipStore.subscribe.bind(merchantShopTooltipStore),
    merchantShopTooltipStore.getSnapshot.bind(merchantShopTooltipStore),
    merchantShopTooltipStore.getSnapshot.bind(merchantShopTooltipStore),
  );
}
