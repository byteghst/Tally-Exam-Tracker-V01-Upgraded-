import { useEffect, useState } from 'react';

export interface ChartColors {
  accent: string;
  forest: string;
  saffron: string;
  rose: string;
  ink: string;
  muted: string;
  faint: string;
  border: string;
  surface: string;
}

function read(): ChartColors {
  const style = getComputedStyle(document.documentElement);
  const rgb = (name: string) => `rgb(${style.getPropertyValue(name).trim().split(/\s+/).join(' ')})`;
  return {
    accent: rgb('--accent'),
    forest: rgb('--forest'),
    saffron: rgb('--saffron'),
    rose: rgb('--rose'),
    ink: rgb('--ink'),
    muted: rgb('--ink-muted'),
    faint: rgb('--ink-faint'),
    border: rgb('--border'),
    surface: rgb('--surface-raised')
  };
}

/**
 * Chart libraries draw with plain colour strings, which cannot use CSS
 * variables. This reads the current theme's colours and updates when the
 * light/dark class on <html> changes, so charts always match the app.
 */
export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(() => read());

  useEffect(() => {
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return colors;
}
