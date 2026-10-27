import { useTranslation } from 'react-i18next';
import { themePreferences, type ThemePreference } from '@epd/bridge/bridge';
import { Select } from '@/components/ui/Select';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { languages, setLanguage, type Language } from '@/lib/i18n';
import { useThemePreference } from '@/lib/theme/useThemePreference';
import { PageHeader } from './PageHeader';

/** `/settings/general`: app-wide preferences (theme and language). */
export function GeneralPage() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useThemePreference();
  return (
    <div className="flex max-w-xl flex-col gap-6">
      <PageHeader title={t('pages.general')} />
      <section aria-label={t('general.appearance')} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">{t('general.theme.label')}</div>
            <p className="text-text-muted">{t('general.theme.hint')}</p>
          </div>
          <SegmentedControl
            aria-label={t('general.theme.label')}
            value={theme}
            onValueChange={(value) => setTheme(value as ThemePreference)}
            options={themePreferences.map((value) => ({
              value,
              label: t(`general.theme.${value}`),
            }))}
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div className="font-medium">{t('language.label')}</div>
          <Select
            aria-label={t('language.label')}
            className="w-40"
            value={i18n.language}
            onValueChange={(lng) => void setLanguage(i18n, lng as Language)}
            options={languages.map((lng) => ({ value: lng, label: t(`language.${lng}`) }))}
          />
        </div>
      </section>
    </div>
  );
}
