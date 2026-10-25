import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from './router';
import { AppProviders } from './provider';
import { getConfig } from '@/config/env';
import { createRepositories } from '@/lib/repositories/provider';
import { createI18n } from '@/lib/i18n';
import { createIndexedDbUnsavedStore } from '@/stores/editor/unsavedStore';
import './styles.css';

const config = getConfig();
const repos = createRepositories(config);
const i18n = createI18n();
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders
      repos={repos}
      i18n={i18n}
      services={{ unsaved: createIndexedDbUnsavedStore(), exposeTestHandle: config.testHandle }}
    >
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
