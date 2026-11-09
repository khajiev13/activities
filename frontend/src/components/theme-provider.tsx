import { createContext, useContext, useEffect, useState } from 'react';
import { getTelegramApp } from '@/platform/telegram';

type Theme = 'dark' | 'light' | 'system';
type ResolvedTheme = 'dark' | 'light';
type ThemeProviderProps = { children: React.ReactNode; defaultTheme?: Theme; storageKey?: string };
type ThemeProviderState = { theme: Theme; resolvedTheme: ResolvedTheme; setTheme: (theme: Theme) => void };
const ThemeProviderContext = createContext<ThemeProviderState>({ theme: 'system', resolvedTheme: 'light', setTheme: () => null });

export function ThemeProvider({ children, defaultTheme = 'system', storageKey = 'vite-ui-theme' }: ThemeProviderProps) {
  const [theme, updateTheme] = useState<Theme>(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : defaultTheme;
    } catch { return defaultTheme; }
  });
  const [preferredTheme, setPreferredTheme] = useState<ResolvedTheme>('light');
  useEffect(() => {
    const app = getTelegramApp();
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setPreferredTheme(app?.colorScheme === 'light' || app?.colorScheme === 'dark'
      ? app.colorScheme : media.matches ? 'dark' : 'light');
    update();
    app?.onEvent?.('themeChanged', update);
    media.addEventListener('change', update);
    return () => { app?.offEvent?.('themeChanged', update); media.removeEventListener('change', update); };
  }, []);
  const resolvedTheme = theme === 'system' ? preferredTheme : theme;
  useEffect(() => {
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedTheme);
  }, [resolvedTheme]);
  const setTheme = (next: Theme) => {
    try { window.localStorage.setItem(storageKey, next); } catch { /* The in-memory choice still works when browser storage is unavailable. */ }
    updateTheme(next);
  };
  return <ThemeProviderContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeProviderContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- Existing public theme context API.
export const useTheme = () => useContext(ThemeProviderContext);
