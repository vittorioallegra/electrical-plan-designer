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
import { createDesktopFileAccess, createMemoryFileAccess } from '@/lib/repositories/fileAccess';
import { createDesktopWindowHost, createMemoryWindowHost } from '@/lib/repositories/windowHost';
import { createWorkspace } from '@/stores/editor/workspace';
import './styles.css';

const config = getConfig();
const i18n = createI18n();
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

// The desktop app (`window.epd`) opens and saves real files. In a browser (dev, browser E2E)
// the files are in memory, where the tests fill and read them back (`window.__epd.files`).
const bridge = window.epd;
const fakeFiles = bridge ? null : createMemoryFileAccess();
if (fakeFiles && config.testHandle) window.__epd = { ...window.__epd, files: fakeFiles };

const drafts = createIndexedDbDraftRepository();
const presence = createDraftPresence();
const services = {
  drafts,
  presence,
  fileAccess: bridge ? createDesktopFileAccess(bridge.files) : fakeFiles!,
  windowHost: bridge ? createDesktopWindowHost(bridge.window) : createMemoryWindowHost(),
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
