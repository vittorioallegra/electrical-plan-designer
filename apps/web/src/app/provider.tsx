import type { i18n } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { RepositoriesProvider } from '@/lib/repositories/provider';
import type { Repositories } from '@/lib/repositories/types';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { EditorServicesProvider, type EditorServices } from '@/stores/editor/EditorContext';
import { ToastProvider } from '@/components/ui/Toast';

export function AppProviders({
  repos,
  i18n,
  services,
  children,
}: {
  repos: Repositories;
  i18n: i18n;
  services?: EditorServices | undefined;
  children: ReactNode;
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <RepositoriesProvider repos={repos}>
        <AuthProvider>
          <EditorServicesProvider services={services}>
            <ToastProvider>{children}</ToastProvider>
          </EditorServicesProvider>
        </AuthProvider>
      </RepositoriesProvider>
    </I18nextProvider>
  );
}
