import { Navigate, type RouteObject } from 'react-router';
import { AuthForm } from './features/auth/AuthForm';
import { RequireAuth } from './features/auth/RequireAuth';
import { PlanView } from './features/editor/PlanView';
import { ProjectLoader } from './features/editor/ProjectLoader';
import { SettingsPage } from './features/editor/SettingsPage';
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
        path: 'projects/:id',
        element: <ProjectLoader />,
        children: [
          { index: true, element: <Navigate to="plan" replace /> },
          { path: 'plan', element: <PlanView /> },
          { path: 'panel', element: <PlaceholderPage titleKey="pages.panel" /> },
          { path: 'quote', element: <PlaceholderPage titleKey="pages.quote" /> },
          { path: 'settings', element: <SettingsPage /> },
        ],
      },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/projects" replace /> },
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'catalog', element: <PlaceholderPage titleKey="pages.catalog" /> },
          { path: 'profile', element: <ProfilePage /> },
          { path: 'm/projects', element: <ProjectsPage basePath="/m/projects" /> },
          { path: 'm/projects/:id', element: <PlaceholderPage titleKey="pages.mobileProject" /> },
          { path: '*', element: <PlaceholderPage titleKey="pages.notFound" /> },
        ],
      },
    ],
  },
];
