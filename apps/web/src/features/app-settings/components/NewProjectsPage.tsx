import { useTranslation } from 'react-i18next';
import type { QuoteSettings } from '@epd/domain/types';
import { LaborLines } from '@/components/quote/LaborLines';
import { QuoteSettingsForm } from '@/components/quote/QuoteSettingsForm';
import { ProjectSettingsForm } from '@/components/settings/ProjectSettingsForm';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';
import { PageHeader } from './PageHeader';

/** `/settings/new-projects`: the project and quote settings a new project starts with. */
export function NewProjectsPage() {
  const { t } = useTranslation();
  const { library } = useEditorServices();
  const settings = useLibrary((s) => s.library.defaults.settings);
  const quote = useLibrary((s) => s.library.defaults.quote);
  const apply = library.getState().apply;
  const editQuote = (_label: string, fn: (q: QuoteSettings) => void) =>
    apply((d) => {
      fn(d.defaults.quote);
    });
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title={t('pages.newProjects')} hint={t('library.defaults.hint')} />
      <section aria-label={t('pages.projectSettings')} className="flex flex-col gap-2">
        <h2 className="font-medium">{t('pages.projectSettings')}</h2>
        <ProjectSettingsForm
          settings={settings}
          edit={(_label, fn) =>
            apply((d) => {
              fn(d.defaults.settings);
            })
          }
        />
      </section>
      <QuoteSettingsForm settings={quote} readOnly={false} edit={editQuote} />
      <LaborLines lines={quote.laborLines} readOnly={false} edit={editQuote} />
    </div>
  );
}
