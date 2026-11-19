import { createContext, useContext } from 'react';

export type AppTheme = 'light' | 'dark';

/** Clave de sessionStorage (la misma que la app Angular). */
export const THEME_STORAGE_KEY = 'pmo_theme';

export interface ThemeState {
  readonly theme: AppTheme;
  readonly setTheme: (theme: AppTheme) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

/** Igual que Angular: solo `'dark'` guardado activa el modo oscuro. */
export function readStoredTheme(): AppTheme {
  return sessionStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
}

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useTheme debe usarse dentro de <ThemeProvider>.');
  return state;
}
