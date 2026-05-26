
export interface MerchantItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  currency: 'essence' | 'gold';
  sold?: boolean;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-900 border-2 border-gray-600 rounded-lg p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
            <p className="text-sm text-yellow-300 mt-1">Balance: {balance} {balanceLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Items Grid */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {healOffer && (
            <div className="bg-gray-800 border border-pink-500/40 rounded-lg p-4 hover:bg-gray-700 transition-colors">
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-white">Restore Health</h3>
                <div className="font-bold text-yellow-300">
                  {healOffer.cost} G
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-3">
                Restore {healOffer.amount} HP. Costs gold and cannot exceed max health.
              </p>

              <button
                onClick={onPurchaseHeal}
                disabled={healOffer.disabled || balance < healOffer.cost}
                className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                {balance < healOffer.cost ? 'Not Enough Gold' : 'Buy Heal'}
              </button>
            </div>
          )}

          {items.map((item) => {
            const canAfford = balance >= item.cost;
            return (
            <div
              key={item.id}
              className="bg-gray-800 border border-gray-600 rounded-lg p-4 hover:bg-gray-700 transition-colors"
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-semibold text-white">{item.name}</h3>
                <div className="text-right">
                  <div className={item.currency === 'gold' ? 'font-bold text-yellow-300' : 'font-bold text-purple-400'}>
                    {item.cost} {CURRENCY_LABEL[item.currency]}
                  </div>
                </div>
              </div>

              <p className="text-gray-300 text-sm mb-3">{item.description}</p>

              <button
                onClick={() => onPurchase?.(item.id)}
                disabled={item.sold || !canAfford}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                {item.sold ? 'Sold' : canAfford ? 'Purchase' : `Not Enough ${item.currency === 'gold' ? 'Gold' : 'Essence'}`}
              </button>
            </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-gray-400 text-sm">
          Purchases are final.
        </div>
      </div>
    </div>
  );
}
