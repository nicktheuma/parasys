import { create } from 'zustand';

export const useSceneStore = create((set) => ({
  scene: null,
  camera: null,
  renderer: null,
  setScene: (scene) => set({ scene }),
  setRenderContext: ({ camera, renderer }) => set({ camera, renderer }),
}));
