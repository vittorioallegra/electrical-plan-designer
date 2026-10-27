import { useTranslation } from 'react-i18next';

/** `/settings/general`: app-wide preferences (filled in by the Settings screen step). */
export function GeneralPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-xl font-semibold">{t('pages.general')}</h1>
    </div>
  );
}
