import { notifyManager, QueryClient } from '@tanstack/react-query';

// Notify components in a microtask instead of the default `setTimeout(0)`: an optimistic
// cache update made in a click handler (purchase ticks) then renders before the next task,
// like a React state update, so a controlled checkbox never shows its old value.
notifyManager.setScheduler(queueMicrotask);

/**
 * One client per app instance (tests create one per render). No automatic retries: a failed
 * load shows its error state with a Retry button at once. No refetch on window focus: data
 * is reloaded when a page mounts, as before.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}
