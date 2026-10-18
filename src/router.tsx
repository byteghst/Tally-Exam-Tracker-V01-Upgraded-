import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Exams } from '@/pages/Exams';
import { ExamDetail } from '@/pages/ExamDetail';
import { ExamConfigs } from '@/pages/ExamConfigs';
import { Tasks } from '@/pages/Tasks';
import { Deadlines } from '@/pages/Deadlines';
import { Study } from '@/pages/Study';
import { Calendar } from '@/pages/Calendar';
import { Analytics } from '@/pages/Analytics';
import { Settings } from '@/pages/Settings';
import { NotFound } from '@/pages/NotFound';

export const router = createBrowserRouter(
  [
    { path: '/login', element: <Login /> },
    {
      path: '/',
      element: <AppShell />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <Dashboard /> },
        { path: 'exams', element: <Exams /> },
        { path: 'exams/daily', element: <Exams /> },
        { path: 'exams/weekly', element: <Exams /> },
        { path: 'exams/monthly', element: <Exams /> },
        { path: 'exams/:id', element: <ExamDetail /> },
        { path: 'configs', element: <ExamConfigs /> },
        { path: 'tasks', element: <Tasks /> },
        { path: 'deadlines', element: <Deadlines /> },
        { path: 'study', element: <Study /> },
        { path: 'calendar', element: <Calendar /> },
        { path: 'analytics', element: <Analytics /> },
        { path: 'settings', element: <Settings /> },
        { path: '*', element: <NotFound /> }
      ]
    }
  ],
  // '/' for the app; '/<repo>/' on GitHub Pages (set from Vite's `base`).
  { basename: import.meta.env.BASE_URL }
);
