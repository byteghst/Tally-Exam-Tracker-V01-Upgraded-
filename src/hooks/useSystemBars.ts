import { useEffect } from 'react';
import { applySystemBars } from '@/lib/systemBars';

/**
 * Keeps the phone's status bar and navigation bar in step with the app's
 * theme. Watches the light/dark class on <html> (set by useTheme), so it
 * follows the Settings choice and the phone's own dark mode alike.
 */
export function useSystemBars() {
  useEffect(() => {
    const sync = () => void applySystemBars(document.documentElement.classList.contains('dark'));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
}
