import { Navigate, type RouteObject } from 'react-router';
import { AuthForm } from './features/auth/AuthForm';
import { CatalogPage } from './features/catalog/CatalogPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { PlanView } from './features/editor/PlanView';
import { ProjectLoader } from './features/editor/ProjectLoader';
import { SettingsPage } from './features/editor/SettingsPage';
import { QuotePage } from './features/quote/QuotePage';
import { MobileProjectPage } from './features/mobile/MobileProjectPage';
import { MobileShell } from './features/mobile/MobileShell';
import { ViewModeGate } from './features/mobile/ViewModeGate';
import { PanelView } from './features/panel/PanelView';
import { ProfilePage } from './features/profile/ProfilePage';
import { ProjectsPage } from './features/projects/ProjectsPage';
import { AppShell } from './features/shell/AppShell';
import { PlaceholderPage } from './features/shell/PlaceholderPage';

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
