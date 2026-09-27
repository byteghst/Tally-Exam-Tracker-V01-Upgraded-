import {
  Home,
  FileSpreadsheet,
  ListChecks,
  CalendarDays,
  BarChart3,
  Settings,
  SlidersHorizontal,
  type LucideIcon
} from 'lucide-react';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** shown in the mobile bottom bar (max 5, rest go in the "More" sheet) */
  primary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: Home, primary: true },
  { label: 'Exams', path: '/exams', icon: FileSpreadsheet, primary: true },
  { label: 'Tasks', path: '/tasks', icon: ListChecks, primary: true },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays, primary: true },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Exam configs', path: '/configs', icon: SlidersHorizontal },
  { label: 'Settings', path: '/settings', icon: Settings, primary: true }
];
