/**
 * uiStore.js
 * Global UI state — sidebar collapsed, active modal, etc.
 */
import { create } from 'zustand';

const useUIStore = create((set) => ({
  sidebarCollapsed: false,
  setSidebarCollapsed: (val) => set({ sidebarCollapsed: val }),
}));

export default useUIStore;