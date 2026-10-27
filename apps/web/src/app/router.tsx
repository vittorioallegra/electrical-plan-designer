import { Navigate, useParams, type RouteObject } from 'react-router';
import { AppShell } from '@/app/layouts/AppShell';
import { RootLayout } from '@/app/layouts/RootLayout';
import { PlaceholderPage } from '@/app/routes/PlaceholderPage';
import { LoadingState } from '@/components/ui/LoadingState';
import { RouteError } from '@/components/ui/RouteError';
import { StartPage } from '@/features/start/components/StartPage';

function Loading() {
  return <LoadingState />;
}

const legacyLibrarySections: Record<string, string> = { defaults: 'new-projects' };

/** `/library/<section>` became `/settings/<section>` (`defaults` is now `new-projects`). */
function LegacyLibraryRedirect() {
  const section = useParams()['*']?.split('/')[0] ?? '';
  return (
    <Navigate
      to={`/settings/${legacyLibrarySections[section] ?? section}`.replace(/\/$/, '')}
      replace
    />
  );
}

/** Every route gets an error boundary, so an error stays inside the part that failed. */
function withErrorBoundaries(routes: RouteObject[]): RouteObject[] {
  return routes.map((route) => {
    const children = route.children ? withErrorBoundaries(route.children) : undefined;
    return {
      ...route,
      ErrorBoundary: route.ErrorBoundary ?? RouteError,
      ...(children ? { children } : {}),
    } as RouteObject;
  });
}

/**
 * The app's routes: the start screen at `/`, the app Settings under `/settings/` and the open
 * project's views under `/project/`.
 * The editor, the canvas and the PDF code are lazy route modules, outside the initial bundle.
 */
export function createRoutes(): RouteObject[] {
  return [
    {
      // Root boundary: anything that escapes the boundaries below.
      Component: RootLayout,
      ErrorBoundary: RouteError,
      HydrateFallback: Loading,
      children: withErrorBoundaries([
        {
          path: 'project',
          lazy: {
            Component: async () => (await import('@/app/routes/project/layout')).ProjectLayoutRoute,
          },
          children: [
            { index: true, element: <Navigate to="plan" replace /> },
            {
              path: 'plan',
              lazy: {
                Component: async () => (await import('@/app/routes/project/plan')).PlanRoute,
              },
            },
            {
              path: 'panel',
              lazy: {
                Component: async () =>
                  (await import('@/features/panel/components/PanelView')).PanelView,
              },
            },
            {
              path: 'quote',
              lazy: {
                Component: async () => (await import('@/app/routes/project/quote')).QuoteRoute,
              },
            },
            {
              path: 'details',
              lazy: {
                Component: async () =>
                  (await import('@/features/project-details/components/ProjectDetailsPage'))
                    .ProjectDetailsPage,
              },
            },
          ],
        },
        // Old paths from before the Settings and Project renames.
        { path: 'library/*', element: <LegacyLibraryRedirect /> },
        { path: 'project/settings', element: <Navigate to="/project/details" replace /> },
        {
          element: <AppShell />,
          children: [
            { index: true, element: <StartPage /> },
            {
              path: 'settings',
              lazy: {
                Component: async () =>
                  (await import('@/features/app-settings/components/SettingsLayout'))
                    .SettingsLayout,
              },
              children: [
                { index: true, element: <Navigate to="general" replace /> },
                {
                  path: 'general',
                  lazy: {
                    Component: async () =>
                      (await import('@/features/app-settings/components/GeneralPage')).GeneralPage,
                  },
                },
                {
                  path: 'company',
                  lazy: {
                    Component: async () =>
                      (await import('@/features/app-settings/components/CompanyPage')).CompanyPage,
                  },
                },
                {
                  path: 'catalog',
                  lazy: {
                    Component: async () =>
                      (await import('@/features/app-settings/components/CatalogPage')).CatalogPage,
                  },
                },
                {
                  path: 'presets',
                  lazy: {
                    Component: async () =>
                      (await import('@/features/app-settings/components/PresetsPage')).PresetsPage,
                  },
                },
                {
                  path: 'new-projects',
                  lazy: {
                    Component: async () =>
                      (await import('@/features/app-settings/components/NewProjectsPage'))
                        .NewProjectsPage,
                  },
                },
              ],
            },
            { path: '*', element: <PlaceholderPage titleKey="pages.notFound" /> },
          ],
        },
      ]),
    },
  ];
}
