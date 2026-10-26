import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createRoutes } from './router';
import { AppProviders } from './provider';
import { getConfig } from '@/config/env';
import { createQueryClient } from '@/lib/query-client';
import { createRepositories } from '@/lib/repositories/provider';
import { createI18n } from '@/lib/i18n';
import { createIndexedDbDraftRepository } from '@/lib/repositories/drafts';
import './styles.css';

const config = getConfig();
const repos = createRepositories(config);
const i18n = createI18n();
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

const queryClient = createQueryClient();
const router = createBrowserRouter(createRoutes({ repos, queryClient }));

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders
      queryClient={queryClient}
      repos={repos}
      i18n={i18n}
      services={{ drafts: createIndexedDbDraftRepository(), exposeTestHandle: config.testHandle }}
    >
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
