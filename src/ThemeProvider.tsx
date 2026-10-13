import type { ReactNode } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useSystemBars } from '@/hooks/useSystemBars';

export function ThemeProvider({ children }: { children: ReactNode }) {
  useTheme();
  useSystemBars();
  return <>{children}</>;
}
