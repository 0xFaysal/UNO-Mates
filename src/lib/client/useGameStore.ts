import { create } from 'zustand';

interface LocalUIState {
  // Sound & haptics
  soundEnabled: boolean;
  musicEnabled: boolean;
  vibrationEnabled: boolean;
  toggleSound: () => void;
  toggleMusic: () => void;
  toggleVibration: () => void;

  // Modals & Panels
  isChatOpen: boolean;
  isSettingsOpen: boolean;
  isRulesOpen: boolean;
  setChatOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setRulesOpen: (open: boolean) => void;

  // Selected card
  selectedCardId: string | null;
  setSelectedCardId: (id: string | null) => void;

  // UNO button armed (declaring UNO for next play)
  isUnoArmed: boolean;
  setIsUnoArmed: (armed: boolean) => void;

  // Wild color picker dialog
  isColorPickerOpen: boolean;
  colorPickerMode: 'wild' | 'draw4';
  openColorPicker: (mode: 'wild' | 'draw4') => void;
  closeColorPicker: () => void;
}

export const useGameStore = create<LocalUIState>((set) => ({
  soundEnabled: true,
  musicEnabled: false,
  vibrationEnabled: true,
  toggleSound: () => set((s) => ({ soundEnabled: !s.soundEnabled })),
  toggleMusic: () => set((s) => ({ musicEnabled: !s.musicEnabled })),
  toggleVibration: () => set((s) => ({ vibrationEnabled: !s.vibrationEnabled })),

  isChatOpen: false,
  isSettingsOpen: false,
  isRulesOpen: false,
  setChatOpen: (isChatOpen) => set({ isChatOpen }),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  setRulesOpen: (isRulesOpen) => set({ isRulesOpen }),

  selectedCardId: null,
  setSelectedCardId: (selectedCardId) => set({ selectedCardId }),

  isUnoArmed: false,
  setIsUnoArmed: (isUnoArmed) => set({ isUnoArmed }),

  isColorPickerOpen: false,
  colorPickerMode: 'wild',
  openColorPicker: (mode) => set({ isColorPickerOpen: true, colorPickerMode: mode }),
  closeColorPicker: () => set({ isColorPickerOpen: false }),
}));
