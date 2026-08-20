import {
  createContext,
  createSignal,
  onSettled,
  useContext,
  type ParentProps,
} from "solid-js";

import {
  applyThemeMode,
  getThemeMode,
  saveThemeMode,
  type ThemeMode,
} from "./theme-mode";

interface ThemeState {
  theme: () => ThemeMode;
  setTheme: (next: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeState>();

export function ThemeProvider(props: ParentProps) {
  const [theme, setThemeSignal] = createSignal<ThemeMode>("light");

  onSettled(() => {
    const stored = getThemeMode();
    setThemeSignal(stored);
    applyThemeMode(stored);
  });

  const setTheme = (next: ThemeMode) => {
    setThemeSignal(next);
    applyThemeMode(next);
    saveThemeMode(next);
  };

  const toggleTheme = () => setTheme(theme() === "light" ? "dark" : "light");

  return (
    <ThemeContext value={{ theme, setTheme, toggleTheme }}>
      {props.children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
