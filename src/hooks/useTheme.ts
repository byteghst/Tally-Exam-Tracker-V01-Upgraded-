import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Glass intensity, blur intensity, and motion level are no longer
 * user-adjustable — they're fixed to the values tuned in
 * src/styles/globals.css (--glass-alpha, --glass-hi-a, --blur) so every
 * screen looks consistent. This hook no longer overrides those CSS
 * variables, and no longer toggles reduce-motion/no-motion classes.
 */
export function useTheme() {
  const { settings } = useSettingsStore();

  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = settings.theme === 'dark' || (settings.theme === 'system' && prefersDark);
    root.classList.toggle('dark', isDark);
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--radius-card', `${settings.radius}px`);
    root.style.setProperty('--radius-control', `${Math.max(8, settings.radius - 4)}px`);
  }, [settings.radius]);
}
