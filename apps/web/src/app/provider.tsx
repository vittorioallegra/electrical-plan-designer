import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { i18n } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { EditorServicesProvider, type EditorServices } from '@/stores/editor/EditorContext';
import { ToastProvider } from '@/components/ui/Toast';
import { WindowSync } from './WindowSync';

export function AppProviders({
  queryClient,
  i18n,
  services,
  children,
}: {
  queryClient: QueryClient;
  i18n: i18n;
  services: EditorServices;
  children: ReactNode;
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <EditorServicesProvider services={services}>
          <ToastProvider>
            <WindowSync />
            {children}
          </ToastProvider>
        </EditorServicesProvider>
      </QueryClientProvider>
    </I18nextProvider>
  );
}
