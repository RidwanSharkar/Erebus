import type { ItemRarity } from '@/utils/itemRarity';

export interface MerchantItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  currency: 'essence' | 'gold';
  sold?: boolean;
  kind?: 'boss_drop' | 'dash_charge' | 'weapon_talent';
  rarity?: ItemRarity;
  limitLabel?: string;
  limitRemaining?: number;
}

interface MerchantUIProps {
  isVisible: boolean;
  items: MerchantItem[];
  balance: number;
  balanceLabel?: string;
  title?: string;
  healOffer?: {
    cost: number;
    amount: number;
    disabled?: boolean;
  };
  onClose?: () => void;
  onPurchase?: (itemId: string) => void;
  onPurchaseHeal?: () => void;
}

const CURRENCY_LABEL: Record<MerchantItem['currency'], string> = {
  essence: '✨',
  gold: 'G',
};

const RARITY_STYLES: Record<string, { badge: string; border: string }> = {
  common: { badge: 'text-gray-300 bg-gray-800/80', border: 'border-gray-600/50' },
  rare: { badge: 'text-sky-200 bg-sky-950/80', border: 'border-sky-500/40' },
  epic: { badge: 'text-violet-200 bg-violet-950/80', border: 'border-violet-500/40' },
  legendary: { badge: 'text-amber-200 bg-amber-950/80', border: 'border-amber-400/50' },
};

function itemAccent(item: MerchantItem): { border: string; glow: string; badge?: string } {
  if (item.kind === 'dash_charge') {
    return {
      border: 'border-cyan-500/40',
      glow: 'hover:shadow-cyan-900/40',
      badge: 'text-cyan-200 bg-cyan-950/70 border-cyan-700/50',
    };
  }
  if (item.kind === 'weapon_talent') {
    return {
      border: 'border-violet-500/40',
      glow: 'hover:shadow-violet-900/40',
      badge: 'text-violet-200 bg-violet-950/70 border-violet-700/50',
    };
  }
  if (item.rarity && RARITY_STYLES[item.rarity]) {
    return {
      border: RARITY_STYLES[item.rarity].border,
      glow: 'hover:shadow-pink-900/30',
      badge: RARITY_STYLES[item.rarity].badge,
    };
  }
  return {
    border: 'border-pink-500/25',
    glow: 'hover:shadow-pink-900/30',
  };
}

export default function MerchantUI({
  isVisible,
  items,
  balance,
  balanceLabel = 'gold',
  title = 'Merchant',
  healOffer,
  onClose,
  onPurchase,
  onPurchaseHeal,
}: MerchantUIProps) {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      style={{
        background: 'radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.92) 100%)',
      }}
    >
      <div className="relative mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-pink-500/30 bg-gray-950/90 shadow-2xl shadow-pink-950/40">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-pink-500/10 to-transparent" />

        {/* Header */}
        <div className="relative flex items-start justify-between border-b border-pink-500/20 px-6 py-5">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-pink-400/70" />
              <span className="text-[10px] font-bold uppercase tracking-[0.35em] text-pink-300/80">
                Wandering Trader
              </span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-pink-400/70" />
            </div>
            <h2 className="text-2xl font-bold tracking-wide text-white">{title}</h2>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-950/40 px-3 py-1 shadow-[0_0_20px_rgba(234,179,8,0.15)]">
              <span className="text-xs uppercase tracking-widest text-yellow-200/70">Balance</span>
              <span className="text-sm font-bold text-yellow-300">{balance.toLocaleString()} {balanceLabel}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-2 py-1 text-xl text-gray-400 transition-colors hover:border-pink-400/40 hover:text-white"
            aria-label="Close merchant"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {healOffer && (
            <div className="mb-5 rounded-xl border border-pink-500/35 bg-gradient-to-br from-pink-950/50 to-gray-900/60 p-4 shadow-lg shadow-pink-950/20 transition-all hover:border-pink-400/50">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold text-pink-100">Restore Health</h3>
                  <p className="mt-1 text-sm text-gray-300">
                    Restore {healOffer.amount} HP. Cannot exceed max health.
                  </p>
                </div>
                <div className="shrink-0 rounded-md border border-yellow-500/30 bg-yellow-950/40 px-2 py-1 text-sm font-bold text-yellow-300">
                  {healOffer.cost} G
                </div>
              </div>
              <button
                type="button"
                onClick={onPurchaseHeal}
                disabled={healOffer.disabled || balance < healOffer.cost}
                className="w-full rounded-lg bg-gradient-to-r from-pink-600 to-pink-500 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-900/30 transition-all hover:from-pink-500 hover:to-pink-400 disabled:cursor-not-allowed disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 disabled:shadow-none"
              >
                {balance < healOffer.cost ? 'Not Enough Gold' : 'Buy Heal'}
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {items.map((item) => {
              const canAfford = balance >= item.cost;
              const accent = itemAccent(item);
              const isSold = !!item.sold;

              return (
                <div
                  key={item.id}
                  className={`relative rounded-xl border bg-gray-900/70 p-4 transition-all duration-200 ${accent.border} ${accent.glow} hover:bg-gray-800/70 hover:shadow-lg ${isSold ? 'opacity-60' : ''}`}
                >
                  {isSold && (
                    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-black/25">
                      <span className="rounded-full border border-white/20 bg-black/60 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gray-300">
                        Sold Out
                      </span>
                    </div>
                  )}

                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className={`truncate text-base font-semibold text-white ${isSold ? 'line-through decoration-gray-500' : ''}`}>
                        {item.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {item.rarity && (
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${accent.badge ?? RARITY_STYLES.common.badge}`}>
                            {item.rarity}
                          </span>
                        )}
                        {item.limitLabel && (
                          <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${accent.badge ?? 'text-gray-300 bg-gray-800/80 border-gray-700/50'}`}>
                            {item.limitLabel}
                            {item.limitRemaining != null && item.limitRemaining > 0
                              ? ` · ${item.limitRemaining} left`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className={`shrink-0 rounded-md border px-2 py-1 text-sm font-bold ${item.currency === 'gold' ? 'border-yellow-500/30 bg-yellow-950/40 text-yellow-300' : 'border-purple-500/30 bg-purple-950/40 text-purple-300'}`}>
                      {item.cost} {CURRENCY_LABEL[item.currency]}
                    </div>
                  </div>

                  <p className="mb-3 line-clamp-3 text-sm leading-relaxed text-gray-400">{item.description}</p>

                  <button
                    type="button"
                    onClick={() => onPurchase?.(item.id)}
                    disabled={isSold || !canAfford}
                    className="w-full rounded-lg border border-white/10 bg-gradient-to-r from-slate-700 to-slate-600 py-2 text-sm font-semibold text-white transition-all hover:from-slate-600 hover:to-slate-500 hover:shadow-md disabled:cursor-not-allowed disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-500 disabled:shadow-none"
                  >
                    {isSold
                      ? 'Unavailable'
                      : canAfford
                        ? 'Purchase'
                        : `Not Enough ${item.currency === 'gold' ? 'Gold' : 'Essence'}`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t border-pink-500/15 px-6 py-3 text-center text-xs tracking-wide text-gray-500">
          Purchases are final · Spend wisely
        </div>
      </div>
    </div>
  );
}
