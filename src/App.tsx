import { Navigate, type RouteObject } from 'react-router';
import { PlanView } from './features/editor/PlanView';
import { ProjectLayout } from './features/editor/ProjectLayout';
import { AppShell } from './features/shell/AppShell';
import { PlaceholderPage } from './features/shell/PlaceholderPage';

export const routes: RouteObject[] = [
  {
    path: 'projects/:id',
    element: <ProjectLayout />,
    children: [
      { index: true, element: <Navigate to="plan" replace /> },
      { path: 'plan', element: <PlanView /> },
      { path: 'panel', element: <PlaceholderPage titleKey="pages.panel" /> },
      { path: 'quote', element: <PlaceholderPage titleKey="pages.quote" /> },
      { path: 'settings', element: <PlaceholderPage titleKey="pages.settings" /> },
    ],
  },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/projects" replace /> },
      { path: 'login', element: <PlaceholderPage titleKey="pages.login" /> },
      { path: 'signup', element: <PlaceholderPage titleKey="pages.signup" /> },
      { path: 'projects', element: <PlaceholderPage titleKey="pages.projects" /> },
      { path: 'catalog', element: <PlaceholderPage titleKey="pages.catalog" /> },
      { path: 'profile', element: <PlaceholderPage titleKey="pages.profile" /> },
      { path: 'm/projects', element: <PlaceholderPage titleKey="pages.mobileProjects" /> },
      { path: 'm/projects/:id', element: <PlaceholderPage titleKey="pages.mobileProject" /> },
      { path: '*', element: <PlaceholderPage titleKey="pages.notFound" /> },
    ],
  },
];
