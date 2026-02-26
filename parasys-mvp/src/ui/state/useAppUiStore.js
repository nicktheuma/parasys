import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export const APP_UI_STATE_KEY = 'parasys:ui-state:v2'

export const useAppUiStore = create(
  persist(
    (set) => ({
      levaVisible: true,
      selectedMaterial: 'Painted',
      showDimensions: true,
      setLevaVisible: (levaVisible) => set({ levaVisible }),
      setSelectedMaterial: (selectedMaterial) => set({ selectedMaterial }),
      setShowDimensions: (showDimensions) => set({ showDimensions }),
      toggleLevaVisible: () => set((state) => ({ levaVisible: !state.levaVisible })),
      toggleShowDimensions: () => set((state) => ({ showDimensions: !state.showDimensions })),
    }),
    {
      name: APP_UI_STATE_KEY,
      version: 1,
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        levaVisible: state.levaVisible,
        selectedMaterial: state.selectedMaterial,
        showDimensions: state.showDimensions,
      }),
    },
  ),
)
