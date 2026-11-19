import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeContext, THEME_STORAGE_KEY, readStoredTheme, type AppTheme } from './theme-context';

/** Tema claro/oscuro persistido en sessionStorage (`pmo_theme`); aplica la clase `.dark` de Shadcn. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>(readStoredTheme);

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.dataset['theme'] = theme;
    root.style.colorScheme = theme;
  }, [theme]);

  const setTheme = useCallback((next: AppTheme) => {
    setThemeState(next);
    sessionStorage.setItem(THEME_STORAGE_KEY, next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
