import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

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
    root.style.setProperty('--blur', `${settings.reducedTransparency ? 0 : settings.blurIntensity / 2.5}px`);
    root.style.setProperty(
      '--glass-alpha',
      String(settings.reducedTransparency ? 0.95 : settings.glassIntensity / 100)
    );
  }, [settings.radius, settings.blurIntensity, settings.glassIntensity, settings.reducedTransparency]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('reduce-motion', settings.animationLevel !== 'full');
    root.classList.toggle('no-motion', settings.animationLevel === 'none');
  }, [settings.animationLevel]);
}
