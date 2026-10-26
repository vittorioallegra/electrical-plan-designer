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
import { createDraftPresence } from '@/lib/repositories/draftPresence';
import { createBrowserFileAccess, createMemoryFileAccess } from '@/lib/repositories/fileAccess';
import { createWorkspace } from '@/stores/editor/workspace';
import './styles.css';

const config = getConfig();
const i18n = createI18n();
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

// E2E builds use in-memory files the tests fill and read back, unless a test asks for the real
// file access (`window.__epdRealFiles`, set by an init script).
const fakeFiles = config.fakeFiles && !window.__epdRealFiles ? createMemoryFileAccess() : null;
if (fakeFiles) window.__epd = { ...window.__epd, files: fakeFiles };

const drafts = createIndexedDbDraftRepository();
const presence = createDraftPresence();
const services = {
  drafts,
  presence,
  fileAccess: fakeFiles ?? createBrowserFileAccess(),
  workspace: createWorkspace({ drafts, presence, exposeTestHandle: config.testHandle }),
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
