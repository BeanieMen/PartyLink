import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface SessionState {
  currentUserId: string | null;
  setCurrentUserId: (userId: string) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      currentUserId: null,
      setCurrentUserId: (userId) => set({ currentUserId: userId.trim() || null }),
      clearSession: () => set({ currentUserId: null }),
    }),
    {
      name: 'partylink-mobile-session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ currentUserId: state.currentUserId }),
    },
  ),
);