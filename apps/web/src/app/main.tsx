import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { createRoutes } from './router';
import { AppProviders } from './provider';
import { getConfig } from '@/config/env';
import { createQueryClient } from '@/lib/query-client';
import { createI18n } from '@/lib/i18n';
import {
  createDesktopFileAccess,
  createDesktopRecentRepository,
  createMemoryFileAccess,
} from '@/lib/repositories/fileAccess';
import {
  createDesktopRecoveryRepository,
  createMemoryRecoveryRepository,
} from '@/lib/repositories/recovery';
import {
  createDesktopLibraryRepository,
  createMemoryLibraryRepository,
  type MemoryLibraryRepository,
} from '@/lib/repositories/library';
import { createDesktopWindowHost, createMemoryWindowHost } from '@/lib/repositories/windowHost';
import { createWorkspace } from '@/stores/editor/workspace';
import { createLibraryStore } from '@/stores/library/libraryStore';
import '@fontsource-variable/ibm-plex-sans/index.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';

const config = getConfig();
const i18n = createI18n();
document.documentElement.lang = i18n.language;
i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
});

// The desktop app (`window.epd`) opens and saves real files and keeps the recovery copy on disk.
// In a browser (dev, browser E2E) both are in memory, where the tests fill and read them back (`window.__epd.files`).
const bridge = window.epd;
const fakeFiles = bridge ? null : createMemoryFileAccess();
if (fakeFiles && config.testHandle) window.__epd = { ...window.__epd, files: fakeFiles };

const recovery = bridge
  ? createDesktopRecoveryRepository(bridge.recovery)
  : createMemoryRecoveryRepository();
const services = {
  recovery,
  fileAccess: bridge ? createDesktopFileAccess(bridge.files) : fakeFiles!,
  recent: bridge ? createDesktopRecentRepository(bridge.recent) : fakeFiles!.recent,
  windowHost: bridge
    ? createDesktopWindowHost(bridge.window, bridge.menu, bridge.files)
    : createMemoryWindowHost(),
};

async function start() {
  // The library is read before the first route renders, so no page ever shows it half loaded.
  const libraryRepository = bridge
    ? createDesktopLibraryRepository(bridge.library)
    : createMemoryLibraryRepository();
  const library = await createLibraryStore(libraryRepository);
  const workspace = createWorkspace({ recovery, library, exposeTestHandle: config.testHandle });
  if (!bridge && config.testHandle)
    window.__epd = {
      ...window.__epd,
      library: { repository: libraryRepository as MemoryLibraryRepository, store: library },
    };

  const queryClient = createQueryClient();
  const router = createBrowserRouter(createRoutes());
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <AppProviders
        queryClient={queryClient}
        i18n={i18n}
        services={{ ...services, library, workspace }}
      >
        <RouterProvider router={router} />
      </AppProviders>
    </StrictMode>,
  );
}

void start();
