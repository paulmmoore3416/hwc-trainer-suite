import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ColorMode = 'light' | 'dark' | 'system';
const KEY = 'hwc-color-mode';

interface ModeState {
  mode: ColorMode;
  isDark: boolean;
  setMode: (m: ColorMode) => void;
  cycle: () => void;
}

const Ctx = createContext<ModeState>({ mode: 'system', isDark: false, setMode: () => {}, cycle: () => {} });

function readMode(): ColorMode {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

const media = () => window.matchMedia?.('(prefers-color-scheme: dark)');

/** Applies the `dark` class to <html> before first paint (called from main.tsx) to avoid a flash. */
export function applyInitialColorMode() {
  const m = readMode();
  const dark = m === 'dark' || (m === 'system' && !!media()?.matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function ColorModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ColorMode>(readMode);
  const [systemDark, setSystemDark] = useState<boolean>(() => !!media()?.matches);

  useEffect(() => {
    const mq = media();
    if (!mq) return;
    const h = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);

  const isDark = mode === 'dark' || (mode === 'system' && systemDark);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark ? '#0b1120' : '#1f2a44');
  }, [isDark]);

  const setMode = useCallback((m: ColorMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* private mode: keep in memory only */
    }
  }, []);

  const value = useMemo(
    () => ({ mode, isDark, setMode, cycle: () => setMode(mode === 'light' ? 'dark' : mode === 'dark' ? 'system' : 'light') }),
    [mode, isDark, setMode],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useColorMode() {
  return useContext(Ctx);
}
