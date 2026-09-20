import { create } from 'zustand'

export const useUIStore = create((set) => ({
  isDarkMode: false,
  sidebarCollapsed: false,
  theme: 'light',

  toggleDarkMode: () =>
    set((state) => ({
      isDarkMode: !state.isDarkMode,
      theme: state.isDarkMode ? 'light' : 'dark',
    })),
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
}))
