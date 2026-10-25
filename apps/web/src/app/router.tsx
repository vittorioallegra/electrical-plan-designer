import { Navigate, type RouteObject } from 'react-router';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { CatalogPage } from '@/features/catalog/components/CatalogPage';
import { RequireAuth } from '@/app/layouts/RequireAuth';
import { PlanView } from '@/features/editor/components/PlanView';
import { ProjectLoader } from '@/features/editor/components/ProjectLoader';
import { SettingsPage } from '@/features/settings/components/SettingsPage';
import { QuotePage } from '@/features/quote/components/QuotePage';
import { MobileProjectPage } from '@/features/mobile/components/MobileProjectPage';
import { MobileShell } from '@/app/layouts/MobileShell';
import { ViewModeGate } from '@/features/mobile/components/ViewModeGate';
import { PanelView } from '@/features/panel/components/PanelView';
import { ProfilePage } from '@/features/profile/components/ProfilePage';
import { ProjectsPage } from '@/features/projects/components/ProjectsPage';
import { AppShell } from '@/app/layouts/AppShell';
import { PlaceholderPage } from '@/app/routes/PlaceholderPage';

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: 'login', element: <AuthForm mode="login" /> },
      { path: 'signup', element: <AuthForm mode="signup" /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <ViewModeGate />,
        children: [
          {
            path: 'projects/:id',
            element: <ProjectLoader />,
            children: [
              { index: true, element: <Navigate to="plan" replace /> },
              { path: 'plan', element: <PlanView /> },
              { path: 'panel', element: <PanelView /> },
              { path: 'quote', element: <QuotePage /> },
              { path: 'settings', element: <SettingsPage /> },
            ],
          },
          {
            element: <MobileShell />,
            children: [
              { path: 'm/projects', element: <ProjectsPage basePath="/m/projects" /> },
              { path: 'm/projects/:id', element: <MobileProjectPage /> },
            ],
          },
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/projects" replace /> },
              { path: 'projects', element: <ProjectsPage /> },
              { path: 'catalog', element: <CatalogPage /> },
              { path: 'profile', element: <ProfilePage /> },
              { path: '*', element: <PlaceholderPage titleKey="pages.notFound" /> },
            ],
          },
        ],
      },
    ],
  },
];
