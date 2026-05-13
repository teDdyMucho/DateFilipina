import { create } from 'zustand';
import { User } from '@/constants/types';

interface DiscoverState {
  profiles: User[];
  passedProfiles: User[];   // profiles swiped left — recycled when deck runs out
  currentIndex: number;
  matches: User[];
  incomingLikes: User[];    // people who liked me but I haven't responded
  setProfiles: (profiles: User[]) => void;
  setMatches: (matches: User[]) => void;
  setIncomingLikes: (users: User[]) => void;
  removeIncomingLike: (userId: string) => void;
  swipeLeft: () => void;
  swipeRight: () => void;
  addMatch: (user: User) => void;
  resetIndex: () => void;
  recyclePassedProfiles: () => void;
}

export const useDiscoverStore = create<DiscoverState>((set, get) => ({
  profiles: [],
  passedProfiles: [],
  currentIndex: 0,
  matches: [],
  incomingLikes: [],

  setProfiles: (profiles) => set({ profiles, currentIndex: 0, passedProfiles: [] }),
  setMatches: (matches) => set({ matches }),
  setIncomingLikes: (incomingLikes) => set({ incomingLikes }),
  removeIncomingLike: (userId) => set(s => ({ incomingLikes: s.incomingLikes.filter(u => u.id !== userId) })),

  swipeLeft: () => {
    const { currentIndex, profiles } = get();
    const current = profiles[currentIndex];
    if (currentIndex < profiles.length) {
      set(s => ({
        currentIndex: currentIndex + 1,
        passedProfiles: current ? [...s.passedProfiles, current] : s.passedProfiles,
      }));
    }
  },

  swipeRight: () => {
    const { currentIndex, profiles } = get();
    if (currentIndex < profiles.length) set({ currentIndex: currentIndex + 1 });
  },

  addMatch: (user) => {
    const { matches } = get();
    if (!matches.find(m => m.id === user.id)) {
      set({ matches: [user, ...matches] });
    }
  },

  resetIndex: () => set({ currentIndex: 0 }),

  // Load passed (swiped-left) profiles back into the deck
  recyclePassedProfiles: () => {
    const { passedProfiles } = get();
    if (passedProfiles.length === 0) return;
    set({ profiles: passedProfiles, currentIndex: 0, passedProfiles: [] });
  },
}));
