import { create } from 'zustand';

export const useSceneStore = create((set) => ({
  scene: null,
  setScene: (scene) => set({ scene }),
}));
