import { useState, useEffect } from 'react';

const THEME_KEY = 'sw_theme';

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  const theme = saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
  return theme;
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      return saved || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch { return 'light'; }
  });

  const isDark = theme === 'dark';

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark';
    try { localStorage.setItem(THEME_KEY, next); } catch {}
    setTheme(next);
  };

  const setDark  = () => { localStorage.setItem(THEME_KEY, 'dark');  setTheme('dark'); };
  const setLight = () => { localStorage.setItem(THEME_KEY, 'light'); setTheme('light'); };

  return { theme, isDark, toggleTheme, setDark, setLight };
}
