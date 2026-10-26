import { useTranslation } from 'react-i18next';
import { Navigate, type RouteObject } from 'react-router';
import { AppShell } from '@/app/layouts/AppShell';
import { RootLayout } from '@/app/layouts/RootLayout';
import { PlaceholderPage } from '@/app/routes/PlaceholderPage';
import { RouteError } from '@/components/ui/RouteError';
import { StartPage } from '@/features/start/components/StartPage';

function Loading() {
  const { t } = useTranslation();
  return <p className="p-4 text-text-muted">{t('common.loading')}</p>;
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
 * The app's routes: the start screen at `/` and the open project's views under `/project/`.
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
              path: 'settings',
              lazy: {
                Component: async () =>
                  (await import('@/features/settings/components/SettingsPage')).SettingsPage,
              },
            },
            {
              path: 'catalog',
              lazy: {
                Component: async () =>
                  (await import('@/features/catalog/components/CatalogPage')).CatalogPage,
              },
            },
            {
              path: 'company',
              lazy: {
                Component: async () =>
                  (await import('@/features/company/components/CompanyPage')).CompanyPage,
              },
            },
          ],
        },
        {
          element: <AppShell />,
          children: [
            { index: true, element: <StartPage /> },
            { path: '*', element: <PlaceholderPage titleKey="pages.notFound" /> },
          ],
        },
      ]),
    },
  ];
}
