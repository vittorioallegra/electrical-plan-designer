import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createRoutes } from './router';
import { AppProviders } from './provider';
import { getConfig } from '@/config/env';
import { createQueryClient } from '@/lib/query-client';
import { createI18n } from '@/lib/i18n';
import { createIndexedDbDraftRepository } from '@/lib/repositories/drafts';
import { createBrowserFileAccess } from '@/lib/repositories/fileAccess';
import { createWorkspace } from '@/stores/editor/workspace';
import './styles.css';

const config = getConfig();
const i18n = createI18n();
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

const drafts = createIndexedDbDraftRepository();
const services = {
  drafts,
  fileAccess: createBrowserFileAccess(),
  workspace: createWorkspace({ drafts, exposeTestHandle: config.testHandle }),
};

const queryClient = createQueryClient();
const router = createBrowserRouter(createRoutes());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders queryClient={queryClient} i18n={i18n} services={services}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
