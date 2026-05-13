import { create } from 'zustand';

interface WalletState {
  coins: number;
  transactions: Array<{ id: string; amount: number; type: 'purchase' | 'spend'; description: string; timestamp: Date }>;
  setCoins: (coins: number) => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number, description: string) => boolean;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  coins: 0,
  transactions: [],

  setCoins: (coins) => set({ coins }),

  addCoins: (amount) => {
    const { coins, transactions } = get();
    set({
      coins: coins + amount,
      transactions: [
        { id: `tx_${Date.now()}`, amount, type: 'purchase', description: `Purchased ${amount} coins`, timestamp: new Date() },
        ...transactions,
      ],
    });
  },

  spendCoins: (amount, description) => {
    const { coins, transactions } = get();
    if (coins < amount) return false;
    set({
      coins: coins - amount,
      transactions: [
        { id: `tx_${Date.now()}`, amount: -amount, type: 'spend', description, timestamp: new Date() },
        ...transactions,
      ],
    });
    return true;
  },
}));
