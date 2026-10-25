import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { routes } from './App';
import { AppProviders } from './AppProviders';
import { getConfig } from './config';
import { createRepositories } from './data';
import { createI18n } from './i18n';
import { createIndexedDbUnsavedStore } from './state/unsavedStore';
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
