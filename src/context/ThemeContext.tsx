import React, { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    const loadTheme = async () => {
      const saved = await window.electronAPI?.settingsGet?.('theme');
      if (saved === 'light' || saved === 'dark') {
        setThemeState(saved);
        document.body.setAttribute('data-theme', saved);
      }
    };
    loadTheme();
  }, []);

  const toggleTheme = async () => {
    const newTheme: Theme = theme === 'dark' ? 'light' : 'dark';
    setThemeState(newTheme);
    document.body.setAttribute('data-theme', newTheme);
    await window.electronAPI?.settingsSet?.('theme', newTheme);
  };

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    document.body.setAttribute('data-theme', newTheme);
    await window.electronAPI?.settingsSet?.('theme', newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
