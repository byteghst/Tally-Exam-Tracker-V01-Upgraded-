import { Capacitor, registerPlugin } from '@capacitor/core';

/**
 * Colours of the phone's status bar (top) and navigation bar (bottom).
 * They match the app's page colour exactly, so the bars read as part of the app.
 * Light: warm paper with dark icons. Dark: warm charcoal with light icons.
 */
const LIGHT = { color: '#F6F1E8', darkIcons: true };
const DARK = { color: '#12100E', darkIcons: false };

interface SystemBarsPlugin {
  apply(options: { color: string; darkIcons: boolean }): Promise<void>;
}

// Implemented natively in ci/force-signing.sh (SystemBarsPlugin.java).
const SystemBars = registerPlugin<SystemBarsPlugin>('SystemBars');

/** Recolours the system bars and the browser's address-bar colour for the given theme. */
export async function applySystemBars(dark: boolean): Promise<void> {
  const { color, darkIcons } = dark ? DARK : LIGHT;

  // browser / installed web app: the address bar and task-switcher colour
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);

  if (Capacitor.getPlatform() !== 'android') return;
  try {
    await SystemBars.apply({ color, darkIcons });
  } catch {
    // Purely cosmetic: if the native side is missing, the bars just keep their default colours.
  }
}
