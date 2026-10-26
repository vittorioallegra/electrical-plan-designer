import { useTranslation } from 'react-i18next';
import type { QuoteSettings } from '@epd/domain/types';
import { LaborLines } from '@/components/quote/LaborLines';
import { QuoteSettingsForm } from '@/components/quote/QuoteSettingsForm';
import { ProjectSettingsForm } from '@/components/settings/ProjectSettingsForm';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';

/** `/library/defaults`: the project and quote settings a new project starts with. */
export function DefaultsPage() {
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
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">{t('pages.defaults')}</h1>
        <p className="text-text-muted">{t('library.defaults.hint')}</p>
      </div>
      <section aria-label={t('pages.settings')} className="flex flex-col gap-2">
        <h2 className="font-medium">{t('pages.settings')}</h2>
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
