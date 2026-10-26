import type { QueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Navigate, type LoaderFunctionArgs, type RouteObject } from 'react-router';
import { catalogItemsQuery } from '@/api/catalog';
import { profileQuery } from '@/api/profile';
import { projectRecordQuery } from '@/api/projectRecord';
import { authMiddleware, sessionContext } from '@/app/auth';
import { AppShell } from '@/app/layouts/AppShell';
import { MobileShell } from '@/app/layouts/MobileShell';
import { RequireAuth } from '@/app/layouts/RequireAuth';
import { RootLayout } from '@/app/layouts/RootLayout';
import { PlaceholderPage } from '@/app/routes/PlaceholderPage';
import { RouteError } from '@/components/ui/RouteError';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { CatalogPage } from '@/features/catalog/components/CatalogPage';
import { ViewModeGate } from '@/features/mobile/components/ViewModeGate';
import { ProfilePage } from '@/features/profile/components/ProfilePage';
import { ProjectsPage } from '@/features/projects/components/ProjectsPage';
import { StartPage } from '@/features/start/components/StartPage';
import type { Repositories } from '@/lib/repositories/types';

export interface RouteDeps {
  repos: Repositories;
  queryClient: QueryClient;
}

function Loading() {
  const { t } = useTranslation();
  return <p className="p-4 text-text-muted">{t('common.loading')}</p>;
}

function ProjectError() {
  return <RouteError messageKey="editor.loadFailed" backTo="/projects" />;
}

function MobileProjectError() {
  return <RouteError messageKey="editor.loadFailed" backTo="/m/projects" />;
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
 * The app's routes. Loaders get their dependencies from here (not from React context), so
 * tests build the same routes with in-memory repositories. The editor, the canvas and the
 * PDF code are lazy route modules, outside the initial bundle.
 */
export function createRoutes({ repos, queryClient }: RouteDeps): RouteObject[] {
  // Project record: always read fresh when entering a project (see projectRecordQuery).
  const projectLoader = ({ params, context }: LoaderFunctionArgs) =>
    queryClient.fetchQuery(
      projectRecordQuery(repos, context.get(sessionContext).userId, params.id ?? ''),
    );
  // Only a new project (or Retry) reloads the record: switching views keeps the open editor.
  const projectShouldRevalidate = ({
    currentParams,
    nextParams,
    currentUrl,
    nextUrl,
    defaultShouldRevalidate,
  }: {
    currentParams: { id?: string };
    nextParams: { id?: string };
    currentUrl: URL;
    nextUrl: URL;
    defaultShouldRevalidate: boolean;
  }) =>
    currentParams.id !== nextParams.id ||
    (currentUrl.href === nextUrl.href && defaultShouldRevalidate);

  return [
    {
      // Root boundary: anything that escapes the boundaries below.
      Component: RootLayout,
      ErrorBoundary: RouteError,
      HydrateFallback: Loading,
      children: withErrorBoundaries([
        {
          element: <AppShell />,
          children: [
            { path: 'login', element: <AuthForm mode="login" /> },
            { path: 'signup', element: <AuthForm mode="signup" /> },
          ],
        },
        {
          element: <RequireAuth />,
          middleware: [authMiddleware(repos)],
          // Catalog and profile load in the background; pages render while they arrive.
          loader: ({ context }) => {
            const { userId } = context.get(sessionContext);
            void queryClient.prefetchQuery(catalogItemsQuery(repos, userId));
            void queryClient.prefetchQuery(profileQuery(repos, userId));
            return null;
          },
          shouldRevalidate: () => false,
          children: [
            {
              element: <ViewModeGate />,
              children: [
                {
                  path: 'projects/:id/*',
                  loader: projectLoader,
                  shouldRevalidate: projectShouldRevalidate,
                  ErrorBoundary: ProjectError,
                  lazy: {
                    Component: async () =>
                      (await import('@/app/routes/project/record')).RecordRoute,
                  },
                },
                {
                  path: 'project',
                  lazy: {
                    Component: async () =>
                      (await import('@/app/routes/project/layout')).ProjectLayoutRoute,
                  },
                  children: [
                    { index: true, element: <Navigate to="plan" replace /> },
                    {
                      path: 'plan',
                      lazy: {
                        Component: async () =>
                          (await import('@/app/routes/project/plan')).PlanRoute,
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
                        Component: async () =>
                          (await import('@/app/routes/project/quote')).QuoteRoute,
                      },
                    },
                    {
                      path: 'settings',
                      lazy: {
                        Component: async () =>
                          (await import('@/features/settings/components/SettingsPage'))
                            .SettingsPage,
                      },
                    },
                  ],
                },
                {
                  element: <MobileShell />,
                  children: [
                    { path: 'm/projects', element: <ProjectsPage basePath="/m/projects" /> },
                    {
                      path: 'm/projects/:id',
                      loader: projectLoader,
                      shouldRevalidate: projectShouldRevalidate,
                      ErrorBoundary: MobileProjectError,
                      lazy: {
                        Component: async () =>
                          (await import('@/app/routes/mobile/project')).MobileProjectRoute,
                      },
                    },
                  ],
                },
                {
                  element: <AppShell />,
                  children: [
                    { index: true, element: <StartPage /> },
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
      ]),
    },
  ];
}
